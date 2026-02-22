import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Plus, Edit, Trash2, Package, Image, Save, X, Search,
  Sun, Zap, Battery, Settings, Wrench, Eye, EyeOff, Star,
  Upload, ShoppingBag, DollarSign, TrendingUp, AlertCircle, Cable, ArrowLeft,
  Sparkles, Loader2
} from "lucide-react";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categoryOptions = [
  { id: "solar_panel", name: "Solar Panels", icon: Sun },
  { id: "inverter", name: "Inverters", icon: Zap },
  { id: "battery", name: "Batteries", icon: Battery },
  { id: "wire", name: "Solar Wire", icon: Cable },
  { id: "accessory", name: "Accessories", icon: Settings },
  { id: "service", name: "Services", icon: Wrench, basePrice: 1500 }
];

// Wire options with sqmm sizes
const wireOptions = [
  { id: "ac_4sqmm", name: "AC Wire 4 sqmm", type: "AC", size: "4sqmm", unit: "per meter" },
  { id: "ac_6sqmm", name: "AC Wire 6 sqmm", type: "AC", size: "6sqmm", unit: "per meter" },
  { id: "dc_4sqmm", name: "DC Wire 4 sqmm", type: "DC", size: "4sqmm", unit: "per meter" },
  { id: "dc_6sqmm", name: "DC Wire 6 sqmm", type: "DC", size: "6sqmm", unit: "per meter" }
];

export const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shopStats, setShopStats] = useState({});
  const [activeTab, setActiveTab] = useState("products");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    short_description: "",
    category: "solar_panel",
    price: "",
    sale_price: "",
    stock: "",
    sku: "",
    brand: "",
    warranty: "",
    is_active: true,
    is_featured: false,
    delivery_available: true,
    pickup_available: true,
    images: [],
    // Wire-specific fields
    wire_type: "AC", // AC or DC
    wire_size: "4sqmm", // 4sqmm or 6sqmm
    // Service-specific fields
    service_type: "installation"
  });

  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const fileInputRef = useRef(null);

  // Wire price reference (per meter) - just for suggestions
  const wirePrices = {
    "AC_4sqmm": 35,
    "AC_6sqmm": 55,
    "DC_4sqmm": 45,
    "DC_6sqmm": 65
  };

  // Service base price
  const serviceBasePrice = 1500;

  // Auto-update name and price when wire options change
  const handleWireChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    
    if (newFormData.category === "wire") {
      const wireType = field === "wire_type" ? value : newFormData.wire_type;
      const wireSize = field === "wire_size" ? value : newFormData.wire_size;
      const priceKey = `${wireType}_${wireSize}`;
      
      newFormData.name = `${wireType} Wire ${wireSize} (per meter)`;
      newFormData.price = wirePrices[priceKey] || "";
      newFormData.description = `${wireType === "AC" ? "AC" : "Solar DC"} wire ${wireSize}. ${wireType === "DC" ? "Double insulated, UV resistant for outdoor solar installations." : "High quality copper conductor with PVC insulation for solar installations."} Price is per meter.`;
    }
    
    setFormData(newFormData);
  };

  // Auto-set service defaults
  const handleCategoryChange = (category) => {
    const newFormData = { ...formData, category };
    
    if (category === "wire") {
      const wireType = newFormData.wire_type || "AC";
      const wireSize = newFormData.wire_size || "4sqmm";
      const priceKey = `${wireType}_${wireSize}`;
      newFormData.wire_type = wireType;
      newFormData.wire_size = wireSize;
      newFormData.name = `${wireType} Wire ${wireSize} (per meter)`;
      newFormData.price = wirePrices[priceKey] || 35;
      newFormData.description = `${wireType === "AC" ? "AC" : "Solar DC"} wire ${wireSize}. High quality copper conductor for solar installations. Price is per meter.`;
      newFormData.stock = 1000;
    } else if (category === "service") {
      newFormData.name = "Solar Installation Service";
      newFormData.price = serviceBasePrice;
      newFormData.description = "Professional solar installation service by ASR Enterprises certified technicians. Includes site assessment, mounting, wiring and commissioning.";
      newFormData.stock = 999;
      newFormData.delivery_available = false;
      newFormData.pickup_available = true;
    } else {
      // Reset to defaults for other categories
      newFormData.name = "";
      newFormData.description = "";
      newFormData.price = "";
      newFormData.stock = "";
    }
    
    setFormData(newFormData);
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchShopStats();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/shop/products?active_only=false`);
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/shop/orders`);
      setOrders(res.data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  const fetchShopStats = async () => {
    try {
      const res = await axios.get(`${API}/shop/stats`);
      setShopStats(res.data);
    } catch (err) {
      console.error("Error fetching shop stats:", err);
    }
  };

  // Generate AI description for service
  const generateServiceDescription = async () => {
    if (!formData.name) {
      alert("Please enter a service name first");
      return;
    }

    setGeneratingDescription(true);
    try {
      const res = await axios.post(`${API}/generate-service-description`, {
        service_name: formData.name,
        service_type: formData.service_type,
        price: formData.price || serviceBasePrice
      });
      
      if (res.data.description) {
        setFormData({ ...formData, description: res.data.description });
      }
    } catch (err) {
      console.error("Error generating description:", err);
      // Fallback to template-based description
      const templates = {
        installation: `Professional ${formData.name} by ASR Enterprises. Our certified technicians provide expert solar installation services including site assessment, mounting, electrical wiring, inverter setup, and system commissioning. We ensure optimal panel placement for maximum energy generation. Service includes safety checks and post-installation support.`,
        maintenance: `Comprehensive ${formData.name} from ASR Enterprises. Keep your solar system running at peak efficiency with our annual maintenance package. Includes thorough panel cleaning, connection inspection, performance analysis, and detailed system health report. Preventive care to maximize your investment.`,
        repair: `Expert ${formData.name} by ASR Enterprises. Quick diagnosis and repair of all solar system issues - inverter faults, panel damage, wiring problems, and more. Our experienced technicians carry genuine spare parts for on-site repairs. Fast turnaround to minimize your downtime.`,
        consultation: `Expert ${formData.name} from ASR Enterprises. Get personalized guidance for your solar journey. Our consultants assess your energy needs, roof suitability, and budget to recommend the ideal solar solution. Includes detailed cost-benefit analysis and subsidy guidance under PM Surya Ghar Yojana.`
      };
      setFormData({ 
        ...formData, 
        description: templates[formData.service_type] || templates.installation 
      });
    } finally {
      setGeneratingDescription(false);
    }
  };

  // Handle image upload from mobile/desktop storage
  const handleImageUpload = async (e, productId = null) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, WebP, GIF)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      if (productId) {
        // Upload to existing product
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const res = await axios.post(`${API}/shop/products/${productId}/upload-image`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.status === 'success') {
          fetchProducts();
          alert('Image uploaded successfully!');
        }
      } else {
        // Add to form for new product - convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, reader.result]
          }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        stock: parseInt(formData.stock) || 0
      };

      if (editingProduct) {
        await axios.put(`${API}/shop/products/${editingProduct.id}`, data);
      } else {
        await axios.post(`${API}/shop/products`, data);
      }

      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
      fetchShopStats();
    } catch (err) {
      console.error("Error saving product:", err);
      alert("Failed to save product");
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      short_description: product.short_description || "",
      category: product.category,
      price: product.price?.toString() || "",
      sale_price: product.sale_price?.toString() || "",
      stock: product.stock?.toString() || "",
      sku: product.sku || "",
      brand: product.brand || "",
      warranty: product.warranty || "",
      is_active: product.is_active,
      is_featured: product.is_featured,
      delivery_available: product.delivery_available,
      pickup_available: product.pickup_available,
      images: product.images || []
    });
    setShowForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await axios.delete(`${API}/shop/products/${productId}`);
      fetchProducts();
      fetchShopStats();
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to delete product");
    }
  };

  const handleToggleActive = async (product) => {
    try {
      await axios.put(`${API}/shop/products/${product.id}`, { is_active: !product.is_active });
      fetchProducts();
    } catch (err) {
      console.error("Error toggling product:", err);
    }
  };

  const addImageUrl = () => {
    if (imageUrl && !formData.images.includes(imageUrl)) {
      setFormData({ ...formData, images: [...formData.images, imageUrl] });
      setImageUrl("");
    }
  };

  const removeImage = (url) => {
    setFormData({ ...formData, images: formData.images.filter(i => i !== url) });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      short_description: "",
      category: "solar_panel",
      price: "",
      sale_price: "",
      stock: "",
      sku: "",
      brand: "",
      warranty: "",
      is_active: true,
      is_featured: false,
      delivery_available: true,
      pickup_available: true,
      images: []
    });
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/shop/orders/${orderId}/status`, { order_status: status });
      fetchOrders();
    } catch (err) {
      console.error("Error updating order:", err);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const orderStatusColors = {
    pending: "bg-yellow-500/20 text-yellow-400",
    confirmed: "bg-blue-500/20 text-blue-400",
    processing: "bg-purple-500/20 text-purple-400",
    ready: "bg-cyan-500/20 text-cyan-400",
    delivered: "bg-green-500/20 text-green-400",
    cancelled: "bg-red-500/20 text-red-400"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link to="/admin/dashboard" className="inline-flex items-center text-gray-400 hover:text-white mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-white">Shop Management</h1>
            <p className="text-gray-400">Manage products, orders & payments</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-4 text-white">
            <Package className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{shopStats.total_products || 0}</p>
            <p className="text-sm opacity-80">Products</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{shopStats.total_orders || 0}</p>
            <p className="text-sm opacity-80">Total Orders</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-2xl p-4 text-white">
            <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{shopStats.pending_orders || 0}</p>
            <p className="text-sm opacity-80">Pending</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-4 text-white">
            <DollarSign className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">₹{(shopStats.total_revenue || 0).toLocaleString()}</p>
            <p className="text-sm opacity-80">Revenue</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-gray-700 pb-2 mb-6">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-t-lg font-medium transition ${
              activeTab === "products" ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Products
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-t-lg font-medium transition ${
              activeTab === "orders" ? "bg-amber-500 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Orders
          </button>
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => { setShowForm(true); setEditingProduct(null); resetForm(); }}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Product</span>
            </button>
          </div>

          {/* Products Table */}
          <div className="bg-gray-800/30 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Product</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Category</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Price</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Stock</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Status</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                            <Sun className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{product.name}</p>
                          <p className="text-gray-400 text-sm">{product.sku || "No SKU"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 capitalize">{product.category?.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      {product.sale_price ? (
                        <div>
                          <span className="text-amber-400 font-semibold">₹{product.sale_price.toLocaleString()}</span>
                          <span className="text-gray-500 line-through text-sm ml-2">₹{product.price.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-white font-semibold">₹{product.price?.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${product.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(product)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No products found. Add your first product!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="bg-gray-800/30 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Order #</th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Customer</th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Items</th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Total</th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Payment</th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Status</th>
                <th className="px-4 py-3 text-left text-gray-400 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-800/20">
                  <td className="px-4 py-3">
                    <span className="text-amber-400 font-mono">{order.order_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white">{order.customer_name}</p>
                      <p className="text-gray-400 text-sm">{order.customer_phone}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-300">{order.items?.length || 0} items</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-semibold">₹{order.total?.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      order.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {order.payment_status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs capitalize ${orderStatusColors[order.order_status] || ''}`}>
                      {order.order_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.order_status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No orders yet
            </div>
          )}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Selection - First so it can auto-populate fields */}
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-sm mb-1 block">Category *</label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {categoryOptions.map(cat => {
                        const IconComponent = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategoryChange(cat.id)}
                            className={`p-3 rounded-xl border-2 transition flex flex-col items-center space-y-1 ${
                              formData.category === cat.id 
                                ? 'border-amber-500 bg-amber-500/20 text-amber-400' 
                                : 'border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                          >
                            <IconComponent className="w-5 h-5" />
                            <span className="text-xs">{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wire-Specific Options */}
                  {formData.category === "wire" && (
                    <div className="md:col-span-2 bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
                      <h3 className="text-blue-400 font-semibold mb-3 flex items-center">
                        <Cable className="w-5 h-5 mr-2" />
                        Wire Configuration
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-400 text-sm mb-2 block">Wire Type</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleWireChange("wire_type", "AC")}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                                formData.wire_type === "AC"
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
                              }`}
                            >
                              AC Wire
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWireChange("wire_type", "DC")}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                                formData.wire_type === "DC"
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
                              }`}
                            >
                              DC Wire
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm mb-2 block">Wire Size</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleWireChange("wire_size", "4sqmm")}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                                formData.wire_size === "4sqmm"
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
                              }`}
                            >
                              4 sqmm
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWireChange("wire_size", "6sqmm")}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                                formData.wire_size === "6sqmm"
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
                              }`}
                            >
                              6 sqmm
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-400 text-sm mb-1 block">Price per Meter (₹) *</label>
                          <input
                            type="number"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                            placeholder="e.g., 35"
                          />
                          <p className="text-gray-500 text-xs mt-1">Suggested: AC 4sqmm=₹35, AC 6sqmm=₹55, DC 4sqmm=₹45, DC 6sqmm=₹65</p>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm mb-1 block">Sale Price per Meter (₹)</label>
                          <input
                            type="number"
                            value={formData.sale_price}
                            onChange={(e) => setFormData({...formData, sale_price: e.target.value})}
                            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                            placeholder="Leave empty if no sale"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Service-Specific Options */}
                  {formData.category === "service" && (
                    <div className="md:col-span-2 bg-green-900/20 border border-green-700/50 rounded-xl p-4">
                      <h3 className="text-green-400 font-semibold mb-3 flex items-center">
                        <Wrench className="w-5 h-5 mr-2" />
                        Service Configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-400 text-sm mb-2 block">Service Type</label>
                          <select
                            value={formData.service_type}
                            onChange={(e) => {
                              const serviceType = e.target.value;
                              let serviceName = "Solar Installation Service";
                              
                              if (serviceType === "maintenance") {
                                serviceName = "Solar Maintenance Service";
                              } else if (serviceType === "repair") {
                                serviceName = "Solar Repair Service";
                              } else if (serviceType === "consultation") {
                                serviceName = "Solar Consultation Service";
                              }
                              
                              setFormData({
                                ...formData, 
                                service_type: serviceType,
                                name: serviceName,
                                description: "" // Clear description so user can generate new one
                              });
                            }}
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                          >
                            <option value="installation">Installation Service</option>
                            <option value="maintenance">Maintenance Service</option>
                            <option value="repair">Repair Service</option>
                            <option value="consultation">Consultation Service</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm mb-2 block">Service Price (₹) *</label>
                          <input
                            type="number"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                            placeholder="1500"
                          />
                          <p className="text-gray-500 text-xs mt-1">Suggested base price: ₹1,500</p>
                        </div>
                      </div>
                      
                      {/* AI Description Generator for Service */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-gray-400 text-sm">Service Description</label>
                          <button
                            type="button"
                            onClick={generateServiceDescription}
                            disabled={generatingDescription}
                            className="flex items-center gap-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {generatingDescription ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                Generate with AI
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          rows={4}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                          placeholder="Click 'Generate with AI' or write your own service description..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Product Name - Editable for all categories */}
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-sm mb-1 block">
                      Product Name * 
                      {(formData.category === "wire" || formData.category === "service") && (
                        <span className="text-amber-400 ml-2">(Auto-filled, editable)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="e.g., 5kW Solar Panel System"
                    />
                  </div>

                  {/* Brand - Hidden for Wire and Service */}
                  {formData.category !== "wire" && formData.category !== "service" && (
                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">Brand</label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="e.g., Luminous, Tata Power"
                      />
                    </div>
                  )}

                  {/* Price - Hidden for Wire (auto-calculated), Editable for Service */}
                  {formData.category !== "wire" && (
                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">
                        Price (₹) * 
                        {formData.category === "service" && <span className="text-green-400 ml-1">(Base: ₹1,500)</span>}
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="25000"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Sale Price (₹)</label>
                    <input
                      type="number"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({...formData, sale_price: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="22000 (leave empty if no sale)"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Stock Quantity *</label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">SKU</label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="ASR-SP-5KW-001"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Warranty</label>
                    <input
                      type="text"
                      value={formData.warranty}
                      onChange={(e) => setFormData({...formData, warranty: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="5 Years"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-sm mb-1 block">Short Description</label>
                    <input
                      type="text"
                      value={formData.short_description}
                      onChange={(e) => setFormData({...formData, short_description: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="Brief product description for listing"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-sm mb-1 block">Full Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="Detailed product description"
                    />
                  </div>

                  {/* Images */}
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-sm mb-1 block">Product Images</label>
                    
                    {/* Upload from Mobile/Desktop */}
                    <div className="mb-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => handleImageUpload(e)}
                        className="hidden"
                        id="mobile-image-upload"
                      />
                      <label
                        htmlFor="mobile-image-upload"
                        className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-amber-500 transition ${uploadingImage ? 'opacity-50' : ''}`}
                      >
                        <Upload className="w-5 h-5 text-amber-400" />
                        <span className="text-gray-300">
                          {uploadingImage ? 'Uploading...' : 'Upload from Mobile/Gallery'}
                        </span>
                      </label>
                      <p className="text-gray-500 text-xs mt-1">Max 5MB • JPEG, PNG, WebP, GIF</p>
                    </div>

                    {/* Or paste URL */}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="Or paste image URL"
                      />
                      <button
                        type="button"
                        onClick={addImageUrl}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    {formData.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.images.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(url)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Options */}
                  <div className="md:col-span-2 flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2 text-white">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <span>Active</span>
                    </label>
                    <label className="flex items-center space-x-2 text-white">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({...formData, is_featured: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <span>Featured</span>
                    </label>
                    <label className="flex items-center space-x-2 text-white">
                      <input
                        type="checkbox"
                        checked={formData.delivery_available}
                        onChange={(e) => setFormData({...formData, delivery_available: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <span>Delivery Available</span>
                    </label>
                    <label className="flex items-center space-x-2 text-white">
                      <input
                        type="checkbox"
                        checked={formData.pickup_available}
                        onChange={(e) => setFormData({...formData, pickup_available: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <span>Store Pickup</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center space-x-2"
                  >
                    <Save className="w-5 h-5" />
                    <span>{editingProduct ? "Update" : "Create"} Product</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
