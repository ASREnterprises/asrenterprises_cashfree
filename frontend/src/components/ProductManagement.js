import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Plus, Edit, Trash2, Package, Image, Save, X, Search,
  Sun, Zap, Battery, Settings, Wrench, Eye, EyeOff, Star,
  Upload, ShoppingBag, DollarSign, TrendingUp, AlertCircle, Cable, ArrowLeft
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
    images: []
  });

  const [imageUrl, setImageUrl] = useState("");

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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div className="flex space-x-2 border-b border-gray-700 pb-2">
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
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-sm mb-1 block">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="e.g., 5kW Solar Panel System"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                    >
                      {categoryOptions.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

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

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                      placeholder="25000"
                    />
                  </div>

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
                    <div className="flex gap-2 mb-2">
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
                        placeholder="Paste image URL"
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
  );
};
