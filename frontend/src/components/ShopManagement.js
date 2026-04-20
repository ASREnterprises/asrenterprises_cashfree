import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Package, Plus, Edit2, Trash2, Search, Filter, Eye, EyeOff,
  ShoppingCart, TrendingUp, DollarSign, Users, ArrowLeft,
  Save, X, Upload, Image, Star, Truck, BarChart3, RefreshCw,
  ChevronDown, ChevronUp, Copy, ExternalLink, Loader2,
  CheckCircle, AlertCircle, Clock, Tag, Settings, Box
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: "solar_panel", label: "Solar Panels" },
  { id: "inverter", label: "Inverters" },
  { id: "battery", label: "Batteries" },
  { id: "wire", label: "Solar Wire" },
  { id: "accessory", label: "Accessories" },
  { id: "service", label: "Services" }
];

export const ShopManagement = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const [productForm, setProductForm] = useState({
    name: "", description: "", price: "", sale_price: "",
    category: "solar_panel", stock: "10", unit: "piece",
    specifications: "", warranty: "",
    is_active: true, is_featured: false
  });
  const [discountPct, setDiscountPct] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [districtFees, setDistrictFees] = useState({});
  const [biharDistricts, setBiharDistricts] = useState([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [savingFees, setSavingFees] = useState(false);
  const [bookServicePrice, setBookServicePrice] = useState("");
  const [savingServicePrice, setSavingServicePrice] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchOrders(), fetchStats(), fetchDistrictFees(), fetchBookServicePrice()]);
    setLoading(false);
  };

  const fetchDistrictFees = async () => {
    setLoadingFees(true);
    try {
      const res = await axios.get(`${API}/admin/district-fees`);
      setDistrictFees(res.data.fees || {});
      setBiharDistricts(res.data.districts || []);
    } catch (err) { console.error("District fees fetch error:", err); }
    setLoadingFees(false);
  };

  const fetchBookServicePrice = async () => {
    try {
      const res = await axios.get(`${API}/shop/book-service-config`);
      setBookServicePrice(String(res.data.price || ""));
    } catch (err) { console.error("Book service price fetch:", err); }
  };

  const saveDistrictFees = async () => {
    setSavingFees(true);
    try {
      await axios.put(`${API}/shop/bihar-districts/fees`, { delivery_fees: districtFees });
      setSuccessMsg("Delivery fees updated on ASR Solar Hub!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Failed to update delivery fees. Please try again.");
    }
    setSavingFees(false);
  };

  const saveBookServicePrice = async () => {
    setSavingServicePrice(true);
    try {
      await axios.put(`${API}/shop/book-service-config`, { price: Number(bookServicePrice) });
      setSuccessMsg("Service price updated!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Failed to update service price.");
    }
    setSavingServicePrice(false);
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/shop/products`);
      setProducts(Array.isArray(res.data) ? res.data : res.data.products || []);
    } catch (err) { console.error("Products fetch error:", err); }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/shop/orders`);
      setOrders(Array.isArray(res.data) ? res.data : res.data.orders || []);
    } catch (err) { console.error("Orders fetch error:", err); }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/shop/stats`);
      setStats(res.data);
    } catch (err) { console.error("Stats fetch error:", err); }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (productId) => {
    if (!photoFile) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      await axios.post(`${API}/shop/products/${productId}/upload-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    } catch (err) {
      console.error("Photo upload error:", err);
    }
    setPhotoUploading(false);
  };

  const handleSaveProduct = async () => {
    setFormError("");
    if (!productForm.name?.trim()) { setFormError("Product name is required."); return; }
    const mrp = parseFloat(productForm.price);
    if (!mrp || mrp <= 0) { setFormError("Please enter a valid MRP."); return; }

    setSaving(true);
    try {
      const sellingPrice = productForm.sale_price ? parseFloat(productForm.sale_price) : null;
      const highlights = productForm.specifications
        ? productForm.specifications.split("\n").filter(Boolean)
        : [];
      const payload = {
        name: productForm.name,
        description: productForm.description,
        category: productForm.category,
        price: mrp,
        sale_price: sellingPrice,
        stock: parseInt(productForm.stock) || 0,
        unit: productForm.unit,
        warranty: productForm.warranty,
        product_highlights: highlights,
        is_active: productForm.is_active,
        is_featured: productForm.is_featured
      };

      let savedProductId = editingProduct?.id;
      if (editingProduct) {
        await axios.put(`${API}/shop/products/${editingProduct.id}`, payload);
      } else {
        const res = await axios.post(`${API}/shop/products`, payload);
        savedProductId = res.data?.id || res.data?.product?.id;
      }

      if (photoFile && savedProductId) {
        await uploadPhoto(savedProductId);
      }

      setShowProductForm(false);
      setEditingProduct(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      resetForm();
      await fetchProducts();
      setSuccessMsg(editingProduct ? "Product updated successfully!" : "Product added to shop!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save product error:", err);
      const detail = err?.response?.data?.detail;
      let msg;
      if (Array.isArray(detail)) {
        msg = detail.map(e => e.msg || JSON.stringify(e)).join("; ");
      } else if (typeof detail === "string") {
        msg = detail;
      } else {
        msg = err?.message || "Failed to save product. Please try again.";
      }
      setFormError(msg);
    }
    setSaving(false);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`${API}/shop/products/${productId}`);
      await fetchProducts();
    } catch (err) { alert("Error deleting product"); }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    const mrp = product.price || 0;
    const selling = product.sale_price || 0;
    const disc = mrp > 0 && selling > 0 && selling < mrp
      ? String(Math.round((1 - selling / mrp) * 100))
      : "";
    const highlights = Array.isArray(product.product_highlights) ? product.product_highlights.join("\n")
      : Array.isArray(product.specifications) ? product.specifications.join("\n")
      : "";
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      price: mrp.toString(),
      sale_price: selling > 0 ? selling.toString() : "",
      category: product.category || "solar_panel",
      stock: product.stock?.toString() || "0",
      unit: product.unit || "piece",
      specifications: highlights,
      warranty: product.warranty || "",
      is_active: product.is_active !== false,
      is_featured: product.is_featured || false
    });
    setDiscountPct(disc);
    setFormError("");
    setPhotoFile(null);
    setPhotoPreview(product.images?.[0] || product.image_url || null);
    setShowProductForm(true);
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/shop/orders/${orderId}/status`, {
        order_status: status,
        payment_status: status === "delivered" ? "paid" : undefined
      });
      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        const updated = await axios.get(`${API}/shop/orders/${orderId}`);
        setSelectedOrder(updated.data);
      }
    } catch (err) { alert("Error updating order status"); }
  };

  const resetForm = () => {
    setProductForm({
      name: "", description: "", price: "", sale_price: "",
      category: "solar_panel", stock: "10", unit: "piece",
      specifications: "", warranty: "",
      is_active: true, is_featured: false
    });
    setDiscountPct("");
    setFormError("");
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const filteredOrders = orders.filter(o => {
    if (!orderFilter) return true;
    return o.order_status === orderFilter || o.payment_status === orderFilter;
  });

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-indigo-100 text-indigo-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    active: "bg-blue-100 text-blue-800"
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="shop-management">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" /> Shop Management
              </h1>
              <p className="text-xs text-gray-500">{products.length} products, {orders.length} orders</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100" data-testid="refresh-shop">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link to="/shop" target="_blank" className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">
              <ExternalLink className="w-4 h-4" /> View Shop
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
            { id: "products", label: "Products", icon: <Package className="w-4 h-4" /> },
            { id: "orders", label: "Orders", icon: <ShoppingCart className="w-4 h-4" /> },
            { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`} data-testid={`tab-${tab.id}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Success banner */}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-300 text-green-800 rounded-xl px-4 py-3 text-sm font-medium">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-8 h-8 text-blue-500" />
                  <span className="text-xs text-gray-400">Products</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats?.total_products || products.length}</div>
                <div className="text-xs text-gray-500">{products.filter(p => p.is_active !== false).length} active</div>
              </div>
              <div className="bg-white rounded-xl p-5 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-8 h-8 text-green-500" />
                  <span className="text-xs text-gray-400">Orders</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats?.total_orders || orders.length}</div>
                <div className="text-xs text-gray-500">{orders.filter(o => o.order_status === "pending").length} pending</div>
              </div>
              <div className="bg-white rounded-xl p-5 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 text-amber-500" />
                  <span className="text-xs text-gray-400">Revenue</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{(stats?.total_revenue || orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (o.total || 0), 0)).toLocaleString()}
                </div>
                <div className="text-xs text-green-600">Paid orders</div>
              </div>
              <div className="bg-white rounded-xl p-5 border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                  <span className="text-xs text-gray-400">Avg Order</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{orders.length > 0 ? Math.round(orders.reduce((s, o) => s + (o.total || 0), 0) / orders.length).toLocaleString() : 0}
                </div>
                <div className="text-xs text-gray-500">Per order value</div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Orders</h3>
                <button onClick={() => setActiveTab("orders")} className="text-sm text-amber-600 hover:text-amber-700">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Order</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Customer</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Amount</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Status</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Payment</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedOrder(order); setActiveTab("orders"); }}>
                        <td className="px-4 py-3 font-medium text-amber-600">{order.order_number}</td>
                        <td className="px-4 py-3">{order.customer_name}</td>
                        <td className="px-4 py-3 font-semibold">₹{(order.total || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.order_status] || "bg-gray-100 text-gray-600"}`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.payment_status] || "bg-gray-100 text-gray-600"}`}>
                            {order.payment_status || order.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN') : '-'}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">No orders yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Stock Alert */}
            {products.filter(p => (p.stock || 0) <= 5 && p.is_active !== false).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4" /> Low Stock Alert
                </h3>
                <div className="space-y-1">
                  {products.filter(p => (p.stock || 0) <= 5 && p.is_active !== false).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-red-700">{p.name}</span>
                      <span className="font-bold text-red-800">{p.stock || 0} left</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== PRODUCTS TAB ===== */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" data-testid="product-search" />
                </div>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <button onClick={() => { resetForm(); setEditingProduct(null); setShowProductForm(true); }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap" data-testid="add-product-btn">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${product.is_active === false ? 'opacity-60' : ''}`} data-testid={`product-card-${product.id}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mt-1 inline-block">
                          {CATEGORIES.find(c => c.id === product.category)?.label || product.category}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {product.is_featured && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                        {product.is_active === false && <EyeOff className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                      <span className="text-lg font-bold text-amber-600">
                        ₹{((product.sale_price || product.price) || 0).toLocaleString('en-IN')}
                      </span>
                      {product.sale_price && product.sale_price < product.price && (
                        <>
                          <span className="text-sm text-gray-400 line-through">₹{product.price.toLocaleString('en-IN')}</span>
                          <span className="text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                            {Math.round((1 - product.sale_price / product.price) * 100)}% OFF
                          </span>
                        </>
                      )}
                      {product.unit && product.unit !== "piece" && (
                        <span className="text-xs text-gray-500">/{product.unit}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span className={`font-medium ${(product.stock || 0) <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                        Stock: {product.stock || 0}
                      </span>
                      <span>{product.rating ? `${product.rating} / 5` : 'No ratings'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditProduct(product)}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => handleDeleteProduct(product.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 py-2 px-3 rounded-lg text-xs font-medium">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No products found</p>
              </div>
            )}
          </div>
        )}

        {/* ===== ORDERS TAB ===== */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {["", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map(f => (
                <button key={f} onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    orderFilter === f ? "bg-amber-500 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
                  }`}>
                  {f ? f.charAt(0).toUpperCase() + f.slice(1) : "All"} ({f ? orders.filter(o => o.order_status === f).length : orders.length})
                </button>
              ))}
            </div>

            {selectedOrder ? (
              /* Order Detail View */
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900">Order #{selectedOrder.order_number}</h3>
                  <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500">Customer</span>
                      <p className="font-medium">{selectedOrder.customer_name}</p>
                      <p className="text-sm text-gray-600">{selectedOrder.customer_phone}</p>
                      {selectedOrder.customer_email && <p className="text-sm text-gray-600">{selectedOrder.customer_email}</p>}
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Delivery</span>
                      <p className="text-sm">{selectedOrder.delivery_type === "pickup" ? "Store Pickup" : "Home Delivery"}</p>
                      {selectedOrder.delivery_address && <p className="text-sm text-gray-600">{selectedOrder.delivery_address}</p>}
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Payment</span>
                      <p className="text-sm">{selectedOrder.payment_method === "online" ? "Online (Cashfree)" : "Cash on Delivery"}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedOrder.payment_status] || "bg-gray-100"}`}>
                        {selectedOrder.payment_status || "pending"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Items</span>
                    <div className="space-y-2 mt-1">
                      {(selectedOrder.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm border-b pb-1">
                          <span>{item.product_name} x{item.quantity}</span>
                          <span className="font-medium">₹{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-1">
                        <span>Total</span>
                        <span className="text-amber-600">₹{(selectedOrder.total || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs text-gray-500">Update Status</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map(s => (
                          <button key={s} onClick={() => handleUpdateOrderStatus(selectedOrder.id, s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                              selectedOrder.order_status === s ? "bg-amber-500 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                            }`}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Orders List */
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Order #</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Customer</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Items</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Amount</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Payment</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Date</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(order => (
                        <tr key={order.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-amber-600 cursor-pointer" onClick={() => setSelectedOrder(order)}>{order.order_number}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-sm">{order.customer_name}</div>
                            <div className="text-xs text-gray-500">{order.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{(order.items || []).length} items</td>
                          <td className="px-4 py-3 font-semibold">₹{(order.total || 0).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.order_status] || "bg-gray-100"}`}>
                              {order.order_status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.payment_status] || "bg-gray-100"}`}>
                              {order.payment_method === "online" ? "Online" : "COD"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN') : '-'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setSelectedOrder(order)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">View</button>
                          </td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-8 text-gray-400">No orders found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== SETTINGS TAB ===== */}
        {activeTab === "settings" && (
          <div className="space-y-6">

            {/* Book Service Price */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Book Solar Service Price
              </h3>
              <p className="text-sm text-gray-400 mb-4">This price is shown on the homepage "Book Service" button.</p>
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-sm font-medium">₹</span>
                <input
                  type="number"
                  value={bookServicePrice}
                  onChange={e => setBookServicePrice(e.target.value)}
                  className="w-36 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="1500"
                />
                <button
                  onClick={saveBookServicePrice}
                  disabled={savingServicePrice}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {savingServicePrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingServicePrice ? "Saving..." : "Update Price"}
                </button>
              </div>
            </div>

            {/* Delivery Fees by District */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-500" /> District-wise Delivery Fees
                </h3>
                <button
                  onClick={saveDistrictFees}
                  disabled={savingFees}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {savingFees ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingFees ? "Saving..." : "Save All Fees"}
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-4">Set delivery charge per district across Bihar. Changes apply to ASR Solar Hub immediately on save.</p>
              {loadingFees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {biharDistricts.map(district => (
                    <div key={district} className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600 truncate">{district}</label>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">₹</span>
                        <input
                          type="number"
                          value={districtFees[district] ?? ""}
                          onChange={e => setDistrictFees(prev => ({ ...prev, [district]: Number(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                  {biharDistricts.length === 0 && (
                    <p className="text-gray-400 text-sm col-span-4">Loading districts...</p>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">Store Pickup is always free. District fees apply to home delivery orders.</p>
            </div>

            {/* Payment Gateway Info */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Tag className="w-5 h-5" /> Payment Gateway</h3>
              <p className="text-sm text-gray-600 mb-2">Cashfree Payments (Production Mode)</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700">UPI, Cards, Net Banking, Wallets enabled</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Box className="w-5 h-5" /> Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onClick={() => { setActiveTab("products"); resetForm(); setEditingProduct(null); setShowProductForm(true); }}
                  className="bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg p-3 text-center text-sm font-medium text-amber-700 transition">
                  <Plus className="w-5 h-5 mx-auto mb-1" /> Add Product
                </button>
                <button onClick={() => setActiveTab("orders")}
                  className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-3 text-center text-sm font-medium text-blue-700 transition">
                  <ShoppingCart className="w-5 h-5 mx-auto mb-1" /> View Orders
                </button>
                <Link to="/shop" target="_blank"
                  className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-3 text-center text-sm font-medium text-green-700 transition">
                  <Eye className="w-5 h-5 mx-auto mb-1" /> Preview Shop
                </Link>
                <button onClick={fetchAll}
                  className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-3 text-center text-sm font-medium text-purple-700 transition">
                  <RefreshCw className="w-5 h-5 mx-auto mb-1" /> Refresh Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProductForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" data-testid="product-form-modal">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="font-bold text-gray-900">{editingProduct ? "Edit Product" : "Add New Product"}</h3>
              <button onClick={() => setShowProductForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Product Photo Upload */}
              <div>
                <label className="text-sm font-medium text-gray-700">Product Photo</label>
                <div className="mt-1 flex items-center gap-3">
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-amber-400 flex items-center justify-center bg-gray-50 cursor-pointer overflow-hidden transition group"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400 group-hover:text-amber-500">
                        <Image className="w-7 h-7 mb-1" />
                        <span className="text-xs">Upload</span>
                      </div>
                    )}
                    {photoUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="text-sm px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5" /> Choose Photo
                    </button>
                    {photoPreview && (
                      <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                        className="mt-1.5 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                        <X className="w-3 h-3" /> Remove photo
                      </button>
                    )}
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — max 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Product Name *</label>
                <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="e.g. Loom Solar 400W Panel" data-testid="product-name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" rows={2} placeholder="Product description..." />
              </div>
              {/* Pricing — MRP + Discount + Selling Price */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Pricing</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">MRP (₹) *</label>
                    <input
                      type="number"
                      value={productForm.price}
                      onChange={e => {
                        const mrp = parseFloat(e.target.value) || 0;
                        const disc = parseFloat(discountPct) || 0;
                        const selling = disc > 0 ? String(Math.round(mrp * (1 - disc / 100))) : productForm.sale_price;
                        setProductForm(prev => ({ ...prev, price: e.target.value, sale_price: selling }));
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      placeholder="28000"
                      data-testid="product-price"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Max retail price</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Discount (%)</label>
                    <input
                      type="number"
                      min="0" max="99"
                      value={discountPct}
                      onChange={e => {
                        const disc = parseFloat(e.target.value) || 0;
                        const mrp = parseFloat(productForm.price) || 0;
                        const selling = mrp > 0 && disc > 0 ? String(Math.round(mrp * (1 - disc / 100))) : productForm.sale_price;
                        setDiscountPct(e.target.value);
                        setProductForm(prev => ({ ...prev, sale_price: selling }));
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      placeholder="10"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Auto-calculates</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Selling Price (₹)</label>
                    <input
                      type="number"
                      value={productForm.sale_price}
                      onChange={e => {
                        const selling = parseFloat(e.target.value) || 0;
                        const mrp = parseFloat(productForm.price) || 0;
                        const disc = mrp > 0 && selling > 0 ? String(Math.round((1 - selling / mrp) * 100)) : "";
                        setProductForm(prev => ({ ...prev, sale_price: e.target.value }));
                        if (disc) setDiscountPct(disc);
                      }}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none bg-white font-semibold text-green-700"
                      placeholder="leave empty"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Price shown to buyer</p>
                  </div>
                </div>
                {productForm.price && (
                  <div className="flex items-center gap-2 text-sm pt-1 border-t border-amber-200">
                    <span className="text-gray-500 text-xs">Preview:</span>
                    {productForm.sale_price && parseFloat(productForm.sale_price) < parseFloat(productForm.price) ? (
                      <>
                        <span className="font-bold text-green-700">₹{parseFloat(productForm.sale_price).toLocaleString('en-IN')}</span>
                        <span className="text-gray-400 line-through text-xs">₹{parseFloat(productForm.price).toLocaleString('en-IN')}</span>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {Math.round((1 - parseFloat(productForm.sale_price) / parseFloat(productForm.price)) * 100)}% OFF
                        </span>
                      </>
                    ) : (
                      <span className="font-bold text-gray-800">₹{parseFloat(productForm.price || 0).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Stock</label>
                  <input type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Unit</label>
                  <select value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    <option value="piece">Piece</option>
                    <option value="meter">Meter</option>
                    <option value="kg">Kg</option>
                    <option value="set">Set</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Warranty</label>
                <input type="text" value={productForm.warranty} onChange={e => setProductForm({...productForm, warranty: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="25 years performance" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Specifications (one per line)</label>
                <textarea value={productForm.specifications} onChange={e => setProductForm({...productForm, specifications: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" rows={3} placeholder="400W output&#10;Mono PERC cell&#10;IP68 rated" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={productForm.is_active} onChange={e => setProductForm({...productForm, is_active: e.target.checked})}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                  Active (visible in shop)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={productForm.is_featured} onChange={e => setProductForm({...productForm, is_featured: e.target.checked})}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                  Featured
                </label>
              </div>
            </div>
            {formError && (
              <div className="mx-4 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 rounded-b-2xl">
              <button onClick={() => { setShowProductForm(false); setFormError(""); }} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveProduct} disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5" data-testid="save-product-btn">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopManagement;
