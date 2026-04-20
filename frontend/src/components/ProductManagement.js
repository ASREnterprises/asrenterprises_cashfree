import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Plus, Edit, Trash2, Package, Image, Save, X, Search,
  Sun, Zap, Battery, Settings, Wrench, Eye, EyeOff, Star,
  Upload, ShoppingBag, DollarSign, TrendingUp, AlertCircle, Cable, ArrowLeft,
  Sparkles, Loader2, MapPin, RefreshCw, CreditCard, CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Book Service Price Config (inline mini-component)
const BookServiceConfig = () => {
  const [price, setPrice] = useState(1500);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    axios.get(`${API}/shop/book-service-config`).then(res => { setPrice(res.data.price); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/shop/book-service-config`, { price: Number(price) }); alert("Price updated!"); }
    catch { alert("Failed to update."); }
    finally { setSaving(false); }
  };

  if (!loaded) return null;
  return (
    <div className="bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
      <DollarSign className="w-5 h-5 text-amber-400" />
      <span className="text-[#0a355e] font-semibold text-sm">Book Service Price:</span>
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
        className="w-32 px-3 py-2 bg-gray-50 border border-gray-300 border border-gray-600 rounded-lg text-[#0a355e] text-sm" />
      <button onClick={save} disabled={saving}
        className="bg-amber-500 hover:bg-amber-600 text-[#0a355e] px-4 py-2 rounded-lg text-sm font-semibold transition disabled:bg-gray-600"
      >{saving ? "Saving..." : "Update Price"}</button>
      <span className="text-gray-500 text-xs">This is the price shown on homepage "Book Service" button</span>
    </div>
  );
};

// District Delivery Fees Config Component
const DistrictFeesConfig = () => {
  const [fees, setFees] = useState({});
  const [districts, setDistricts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/district-fees`).then(res => {
      setFees(res.data.fees || {});
      setDistricts(res.data.districts || []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const updateFee = (district, value) => {
    setFees(prev => ({ ...prev, [district]: Number(value) || 0 }));
  };

  const saveFees = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/shop/bihar-districts/fees`, { delivery_fees: fees });
      alert("Delivery fees updated successfully!");
    } catch { alert("Failed to update fees."); }
    finally { setSaving(false); }
  };

  if (!loaded) return null;
  return (
    <div className="bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-400" />
          <span className="text-[#0a355e] font-semibold">District Delivery Fees</span>
        </div>
        <button onClick={saveFees} disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-[#0a355e] px-4 py-2 rounded-lg text-sm font-semibold transition disabled:bg-gray-600">
          {saving ? "Saving..." : "Save All Fees"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
        {districts.map(district => (
          <div key={district} className="flex flex-col">
            <label className="text-gray-500 text-xs truncate">{district}</label>
            <input type="number" value={fees[district] || 0} onChange={(e) => updateFee(district, e.target.value)}
              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 border border-gray-600 rounded text-[#0a355e] text-sm" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Reusable key-value spec table editor used in product form
const SpecTableEditor = ({ title, icon: Icon, data = {}, onChange, placeholder = "e.g. 730W" }) => {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const addRow = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    onChange({ ...data, [newKey.trim()]: newVal.trim() });
    setNewKey(""); setNewVal("");
  };

  const removeRow = (key) => {
    const copy = { ...data };
    delete copy[key];
    onChange(copy);
  };

  return (
    <div className="md:col-span-2 bg-blue-900/10 border border-sky-200 rounded-xl p-4">
      <h3 className="text-[#0a355e] font-semibold mb-3 flex items-center gap-2 text-sm">
        {Icon && <Icon className="w-4 h-4" />} {title}
      </h3>
      {Object.entries(data).length > 0 && (
        <table className="w-full text-sm mb-3">
          <tbody>
            {Object.entries(data).map(([k, v]) => (
              <tr key={k} className="border-b border-sky-100">
                <td className="py-1 pr-2 text-gray-600 font-medium w-1/2">{k}</td>
                <td className="py-1 pr-2 text-[#0a355e]">{v}</td>
                <td className="py-1 w-8">
                  <button type="button" onClick={() => removeRow(k)} className="text-red-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-2">
        <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)}
          placeholder="Parameter name" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRow())}
          className="flex-1 px-3 py-1.5 bg-white border border-sky-200 rounded-lg text-[#0a355e] text-sm" />
        <input type="text" value={newVal} onChange={e => setNewVal(e.target.value)}
          placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRow())}
          className="flex-1 px-3 py-1.5 bg-white border border-sky-200 rounded-lg text-[#0a355e] text-sm" />
        <button type="button" onClick={addRow}
          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
};

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
  const [successMessage, setSuccessMessage] = useState("");
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
    delivery_districts: [],
    delivery_fees: {},
    // Wire-specific fields
    wire_type: "AC",
    wire_size: "4sqmm",
    // Service-specific fields
    service_type: "cleaning",
    // Enhanced product detail fields
    electrical_specs: {},
    mechanical_specs: {},
    warranty_info: {},
    shipping_info: "",
    product_highlights: []
  });

  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [biharDistricts, setBiharDistricts] = useState({ districts: [], delivery_fees: {} });
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [formError, setFormError] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
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
      newFormData.name = "Solar Cleaning Service";
      newFormData.price = serviceBasePrice;
      newFormData.description = "Professional solar panel cleaning service by ASR Enterprises certified technicians. Thorough cleaning for optimal energy generation.";
      newFormData.stock = 999;
      newFormData.delivery_available = false;
      newFormData.pickup_available = true;
      newFormData.service_type = "cleaning";
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
    fetchBiharDistricts();
  }, []);

  const fetchBiharDistricts = async () => {
    try { const res = await axios.get(`${API}/shop/bihar-districts`); setBiharDistricts(res.data); }
    catch (err) { console.error(err); }
  };

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

  // Handle image upload from mobile/desktop storage (supports multiple files)
  const handleImageUpload = async (e, productId = null) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        alert(`${file.name}: Invalid type. Use JPEG, PNG, WebP or GIF.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}: Must be under 5 MB.`);
        return;
      }
    }

    setUploadingImage(true);

    try {
      if (productId) {
        // Upload to existing product (one at a time)
        for (const file of files) {
          const formDataUpload = new FormData();
          formDataUpload.append('file', file);
          await axios.post(`${API}/shop/products/${productId}/upload-image`, formDataUpload, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
        fetchProducts();
        alert(`${files.length} image${files.length > 1 ? 's' : ''} uploaded successfully!`);
      } else {
        // Add to form for new product — convert each file to base64
        const readAll = files.map(file => new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        }));
        const base64s = await Promise.all(readAll);
        setFormData(prev => ({ ...prev, images: [...prev.images, ...base64s] }));
      }
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to upload image(s). Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!formData.name?.trim()) { setFormError("Product name is required."); return; }
    const price = parseFloat(formData.price);
    if (!price || price <= 0) { setFormError("Please enter a valid MRP / price."); return; }

    try {
      const isEditing = !!editingProduct;
      const data = {
        ...formData,
        price,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        stock: parseInt(formData.stock) || 0
      };

      if (isEditing) {
        await axios.put(`${API}/shop/products/${editingProduct.id}`, data);
      } else {
        await axios.post(`${API}/shop/products`, data);
      }

      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
      fetchShopStats();
      setSuccessMessage(isEditing ? "Product updated successfully!" : "Product created successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("Error saving product:", err);
      const detail = err?.response?.data?.detail;
      let errorMsg;
      if (Array.isArray(detail)) {
        errorMsg = detail.map(e => e.msg || JSON.stringify(e)).join("; ");
      } else if (typeof detail === "string") {
        errorMsg = detail;
      } else {
        errorMsg = err?.message || "Unknown error. Please try again.";
      }
      setFormError(errorMsg);
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
      images: product.images || [],
      delivery_districts: product.delivery_districts || [],
      delivery_fees: product.delivery_fees || {},
      wire_type: product.wire_type || "AC",
      wire_size: product.wire_size || "4sqmm",
      service_type: product.service_type || "cleaning",
      electrical_specs: product.electrical_specs || {},
      mechanical_specs: product.mechanical_specs || {},
      warranty_info: product.warranty_info || {},
      shipping_info: product.shipping_info || "",
      product_highlights: product.product_highlights || []
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
      images: [],
      delivery_districts: [],
      delivery_fees: {},
      wire_type: "AC",
      wire_size: "4sqmm",
      service_type: "cleaning",
      electrical_specs: {},
      mechanical_specs: {},
      warranty_info: {},
      shipping_info: "",
      product_highlights: []
    });
    setDiscountPercent("");
    setFormError("");
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/shop/orders/${orderId}/status`, { order_status: status });
      fetchOrders();
    } catch (err) {
      console.error("Error updating order:", err);
    }
  };

  const handleDeleteOrder = async (orderId, orderStatus) => {
    const isPaidOrder = orderStatus && !["pending", "cancelled"].includes(orderStatus);
    
    if (isPaidOrder) {
      if (!window.confirm("⚠️ WARNING: This order has been paid/processed.\n\nAre you sure you want to permanently delete it?\n\nThis action cannot be undone!")) return;
      try {
        await axios.delete(`${API}/shop/orders/${orderId}?force=true`);
        fetchOrders();
        fetchShopStats();
        alert("Order deleted successfully.");
      } catch (err) {
        console.error("Error deleting order:", err);
        alert(err.response?.data?.detail || "Failed to delete order.");
      }
    } else {
      if (!window.confirm("Are you sure you want to delete this order?")) return;
      try {
        await axios.delete(`${API}/shop/orders/${orderId}`);
        fetchOrders();
        fetchShopStats();
      } catch (err) {
        console.error("Error deleting order:", err);
        alert(err.response?.data?.detail || "Failed to delete order.");
      }
    }
  };

  // Sync Razorpay Payments
  const syncRazorpayPayments = async () => {
    setSyncingPayments(true);
    setSyncResult(null);
    try {
      const res = await axios.post(`${API}/admin/razorpay/sync`, { sync_all: true });
      setSyncResult(res.data);
      fetchOrders();
      fetchShopStats();
      alert(`Sync complete! ${res.data.new_orders_created} new orders created, ${res.data.orders_updated} orders updated.`);
    } catch (err) {
      console.error("Error syncing Razorpay payments:", err);
      alert(err.response?.data?.detail || "Failed to sync Razorpay payments. Check if API keys are configured.");
    } finally {
      setSyncingPayments(false);
    }
  };

  // Sync Service Bookings to Orders
  const syncServiceBookings = async () => {
    setSyncingPayments(true);
    try {
      const res = await axios.post(`${API}/admin/sync-service-bookings`);
      fetchOrders();
      fetchShopStats();
      alert(`Service bookings synced! ${res.data.new_orders_created} new orders created.`);
    } catch (err) {
      console.error("Error syncing service bookings:", err);
      alert("Failed to sync service bookings.");
    } finally {
      setSyncingPayments(false);
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link to="/admin/dashboard" className="inline-flex items-center text-gray-500 hover:text-[#0a355e] mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-[#0a355e]">Shop Management</h1>
            <p className="text-gray-500">Manage products, orders & payments</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-4 text-[#0a355e]">
            <Package className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{shopStats.total_products || 0}</p>
            <p className="text-sm opacity-80">Products</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-[#0a355e]">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{shopStats.total_orders || 0}</p>
            <p className="text-sm opacity-80">Total Orders</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-2xl p-4 text-[#0a355e]">
            <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{shopStats.pending_orders || 0}</p>
            <p className="text-sm opacity-80">Pending</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-4 text-[#0a355e]">
            <DollarSign className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">₹{(shopStats.total_revenue || 0).toLocaleString()}</p>
            <p className="text-sm opacity-80">Revenue</p>
          </div>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-300 text-green-700 rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-sky-200 pb-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "products" ? "bg-amber-500 text-[#0a355e]" : "text-gray-500 hover:text-[#0a355e]"
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Products
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "orders" ? "bg-amber-500 text-[#0a355e]" : "text-gray-500 hover:text-[#0a355e]"
            }`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "settings" ? "bg-amber-500 text-[#0a355e]" : "text-gray-500 hover:text-[#0a355e]"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e] placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => { setShowForm(true); setEditingProduct(null); resetForm(); }}
              className="bg-amber-500 hover:bg-amber-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Product</span>
            </button>
          </div>

          {/* Products Table */}
          <div className="bg-white shadow-lg border border-sky-200/30 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-white shadow-lg border border-sky-200/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Product</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Category</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Price</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Stock</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Status</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Actions</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-white shadow-lg border border-sky-200/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-50 border border-gray-300 rounded-lg flex items-center justify-center">
                            <Sun className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-[#0a355e] font-medium">{product.name}</p>
                          <p className="text-gray-500 text-sm">{product.sku || "No SKU"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 capitalize">{product.category?.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      {product.sale_price ? (
                        <div>
                          <span className="text-amber-400 font-semibold">₹{product.sale_price.toLocaleString()}</span>
                          <span className="text-gray-500 line-through text-sm ml-2">₹{product.price.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-[#0a355e] font-semibold">₹{product.price?.toLocaleString()}</span>
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
                          product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'
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
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No products found. Add your first product!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Sync Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Razorpay Sync */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-blue-400" />
                <div>
                  <h3 className="text-[#0a355e] font-semibold">Razorpay Payments</h3>
                  <p className="text-gray-500 text-xs">Sync all successful payments</p>
                </div>
              </div>
              <button onClick={syncRazorpayPayments} disabled={syncingPayments}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[#0a355e] px-4 py-2 rounded-lg text-sm font-semibold transition disabled:bg-gray-600"
                data-testid="sync-razorpay-btn">
                {syncingPayments ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync
              </button>
            </div>
            
            {/* Service Bookings Sync */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wrench className="w-6 h-6 text-green-400" />
                <div>
                  <h3 className="text-[#0a355e] font-semibold">Service Bookings</h3>
                  <p className="text-gray-500 text-xs">Sync paid service bookings</p>
                </div>
              </div>
              <button onClick={syncServiceBookings} disabled={syncingPayments}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-[#0a355e] px-4 py-2 rounded-lg text-sm font-semibold transition disabled:bg-gray-600">
                {syncingPayments ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync
              </button>
            </div>
          </div>
          
          {/* Sync Result Message */}
          {syncResult && (
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div className="text-green-300">
                <span className="font-semibold">Sync Complete!</span>
                <span className="ml-2 text-green-400">
                  {syncResult.total_processed} payments processed • {syncResult.new_orders_created} new orders • {syncResult.orders_updated} updated
                </span>
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="bg-white shadow-lg border border-sky-200/30 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-white shadow-lg border border-sky-200/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Order #</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Customer</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Items</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Total</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Payment</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Status</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-sm">Actions</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-700/50">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-white shadow-lg border border-sky-200/20">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-amber-400 font-mono">{order.order_number}</span>
                        {order.source === "razorpay_sync" && (
                          <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Synced</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[#0a355e]">{order.customer_name}</p>
                        <p className="text-gray-500 text-sm">{order.customer_phone}</p>
                        {order.customer_email && <p className="text-gray-500 text-xs">{order.customer_email}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{order.items?.length || 0} items</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#0a355e] font-semibold">₹{order.total?.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        order.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {order.payment_status?.toUpperCase()}
                      </span>
                      {order.razorpay_payment_id && (
                        <p className="text-gray-500 text-xs mt-1 font-mono">{order.razorpay_payment_id.substring(0, 14)}...</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs capitalize ${orderStatusColors[order.order_status] || ''}`}>
                        {order.order_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                      <select
                        value={order.order_status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-[#0a355e] text-sm rounded px-2 py-1 border border-gray-600"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="ready">Ready</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        onClick={() => handleDeleteOrder(order.id, order.order_status)}
                        className={`p-1 rounded ${
                          order.order_status === "pending" || order.order_status === "cancelled" 
                            ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" 
                            : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        }`}
                        title={order.order_status === "pending" || order.order_status === "cancelled" 
                          ? "Delete Order" 
                          : "Force Delete (Paid Order)"}
                        data-testid={`delete-order-${order.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            {orders.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No orders yet. Click "Sync Payments" to import from Razorpay.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" /> Shop Settings
          </h2>

          {/* Book Service Price */}
          <BookServiceConfig />

          {/* Delivery Fees by District */}
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="font-bold text-[#0a355e] text-sm">Delivery Fees by District</h3>
                <p className="text-gray-500 text-xs">Set district-wise delivery charges across Bihar. Per-product overrides can be set in the product form.</p>
              </div>
            </div>
            <div className="p-5">
              <DistrictFeesConfig />
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#0a355e]">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-[#0a355e]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Selection - First so it can auto-populate fields */}
                  <div className="md:col-span-2">
                    <label className="text-gray-500 text-sm mb-1 block">Category *</label>
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
                                : 'border-sky-200 text-gray-500 hover:border-gray-600'
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
                          <label className="text-gray-500 text-sm mb-2 block">Wire Type</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleWireChange("wire_type", "AC")}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                                formData.wire_type === "AC"
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                  : 'border-sky-200 text-gray-500 hover:border-gray-600'
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
                                  : 'border-sky-200 text-gray-500 hover:border-gray-600'
                              }`}
                            >
                              DC Wire
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-500 text-sm mb-2 block">Wire Size</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleWireChange("wire_size", "4sqmm")}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                                formData.wire_size === "4sqmm"
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                  : 'border-sky-200 text-gray-500 hover:border-gray-600'
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
                                  : 'border-sky-200 text-gray-500 hover:border-gray-600'
                              }`}
                            >
                              6 sqmm
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-500 text-sm mb-1 block">Price per Meter (₹) *</label>
                          <input
                            type="number"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                            placeholder="e.g., 35"
                          />
                          <p className="text-gray-500 text-xs mt-1">Suggested: AC 4sqmm=₹35, AC 6sqmm=₹55, DC 4sqmm=₹45, DC 6sqmm=₹65</p>
                        </div>
                        <div>
                          <label className="text-gray-500 text-sm mb-1 block">Sale Price per Meter (₹)</label>
                          <input
                            type="number"
                            value={formData.sale_price}
                            onChange={(e) => setFormData({...formData, sale_price: e.target.value})}
                            className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
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
                      <div>
                        <label className="text-gray-500 text-sm mb-2 block">Service Type</label>
                        <select
                          value={formData.service_type}
                          onChange={(e) => {
                            const serviceType = e.target.value;
                            let serviceName = "Solar Cleaning Service";
                            if (serviceType === "maintenance") serviceName = "Solar Maintenance Service";
                            else if (serviceType === "repair") serviceName = "Solar Repair Service";
                            else if (serviceType === "consultation") serviceName = "Solar Consultation Service";
                            setFormData({ ...formData, service_type: serviceType, name: serviceName, description: "" });
                          }}
                          className="w-full px-4 py-3 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        >
                          <option value="cleaning">Cleaning Service</option>
                          <option value="maintenance">Maintenance Service</option>
                          <option value="repair">Repair Service</option>
                          <option value="consultation">Consultation Service</option>
                        </select>
                        <p className="text-gray-500 text-xs mt-1">Service price is set in the Pricing section below</p>
                      </div>
                      
                      {/* AI Description Generator for Service */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-gray-500 text-sm">Service Description</label>
                          <button
                            type="button"
                            onClick={generateServiceDescription}
                            disabled={generatingDescription}
                            className="flex items-center gap-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-[#0a355e] px-3 py-1.5 rounded-lg transition disabled:opacity-50"
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
                          className="w-full px-4 py-3 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                          placeholder="Click 'Generate with AI' or write your own service description..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Product Name - Editable for all categories */}
                  <div className="md:col-span-2">
                    <label className="text-gray-500 text-sm mb-1 block">
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
                      className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                      placeholder="e.g., 5kW Solar Panel System"
                    />
                  </div>

                  {/* Brand - Hidden for Wire and Service */}
                  {formData.category !== "wire" && formData.category !== "service" && (
                    <div>
                      <label className="text-gray-500 text-sm mb-1 block">Brand</label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value})}
                        className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        placeholder="e.g., Luminous, Tata Power"
                      />
                    </div>
                  )}

                  {/* MRP + Discount + Selling Price - Hidden for Wire (auto-calculated) */}
                  {formData.category !== "wire" && (
                    <div className="md:col-span-2">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <h3 className="text-[#0a355e] font-semibold text-sm mb-3 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-500" /> Pricing
                          {formData.category === "service" && <span className="text-green-600 text-xs font-normal ml-1">(Base suggested: ₹1,500)</span>}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* MRP */}
                          <div>
                            <label className="text-gray-600 text-xs font-semibold mb-1 block">MRP (₹) *</label>
                            <input
                              type="number"
                              required
                              value={formData.price}
                              onChange={(e) => {
                                const mrp = parseFloat(e.target.value) || 0;
                                const disc = parseFloat(discountPercent) || 0;
                                const selling = disc > 0 ? Math.round(mrp * (1 - disc / 100)) : "";
                                setFormData(prev => ({ ...prev, price: e.target.value, sale_price: selling ? String(selling) : prev.sale_price }));
                              }}
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-[#0a355e] font-semibold text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                              placeholder="e.g. 28000"
                            />
                            <p className="text-gray-500 text-xs mt-1">Original / maximum price</p>
                          </div>

                          {/* Discount % */}
                          {formData.category !== "service" && (
                            <div>
                              <label className="text-gray-600 text-xs font-semibold mb-1 block">Discount (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={discountPercent}
                                onChange={(e) => {
                                  const disc = parseFloat(e.target.value) || 0;
                                  const mrp = parseFloat(formData.price) || 0;
                                  const selling = mrp > 0 && disc > 0 ? Math.round(mrp * (1 - disc / 100)) : "";
                                  setDiscountPercent(e.target.value);
                                  if (selling) setFormData(prev => ({ ...prev, sale_price: String(selling) }));
                                }}
                                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-[#0a355e] text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                                placeholder="e.g. 10"
                              />
                              <p className="text-gray-500 text-xs mt-1">Auto-calculates selling price</p>
                            </div>
                          )}

                          {/* Selling Price */}
                          {formData.category !== "service" && (
                            <div>
                              <label className="text-gray-600 text-xs font-semibold mb-1 block">Selling Price (₹)</label>
                              <input
                                type="number"
                                value={formData.sale_price}
                                onChange={(e) => {
                                  const mrp = parseFloat(formData.price) || 0;
                                  const selling = parseFloat(e.target.value) || 0;
                                  const disc = mrp > 0 && selling > 0 ? Math.round((1 - selling / mrp) * 100) : 0;
                                  setFormData(prev => ({ ...prev, sale_price: e.target.value }));
                                  if (disc > 0) setDiscountPercent(String(disc));
                                }}
                                className="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-green-700 font-semibold text-sm focus:ring-2 focus:ring-green-400 focus:outline-none"
                                placeholder="Leave empty if no offer"
                              />
                              <p className="text-gray-500 text-xs mt-1">Price shown to customer</p>
                            </div>
                          )}
                        </div>

                        {/* Live preview */}
                        {formData.price && (
                          <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-3 text-sm">
                            <span className="text-gray-500">Preview:</span>
                            {formData.sale_price && parseFloat(formData.sale_price) < parseFloat(formData.price) ? (
                              <>
                                <span className="text-green-700 font-bold text-base">₹{parseFloat(formData.sale_price).toLocaleString('en-IN')}</span>
                                <span className="text-gray-400 line-through">₹{parseFloat(formData.price).toLocaleString('en-IN')}</span>
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                  {Math.round((1 - parseFloat(formData.sale_price) / parseFloat(formData.price)) * 100)}% OFF
                                </span>
                              </>
                            ) : (
                              <span className="text-[#0a355e] font-bold text-base">₹{parseFloat(formData.price || 0).toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stock - Hidden for Service */}
                  {formData.category !== "service" && (
                    <div>
                      <label className="text-gray-500 text-sm mb-1 block">
                        Stock Quantity * {formData.category === "wire" && "(meters)"}
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: e.target.value})}
                        className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        placeholder={formData.category === "wire" ? "1000" : "10"}
                      />
                    </div>
                  )}

                  {/* SKU - Hidden for Wire and Service */}
                  {formData.category !== "wire" && formData.category !== "service" && (
                    <div>
                      <label className="text-gray-500 text-sm mb-1 block">SKU</label>
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        placeholder="ASR-SP-5KW-001"
                      />
                    </div>
                  )}

                  {/* Warranty - Hidden for Wire and Service */}
                  {formData.category !== "wire" && formData.category !== "service" && (
                    <div>
                      <label className="text-gray-500 text-sm mb-1 block">Warranty</label>
                      <input
                        type="text"
                        value={formData.warranty}
                        onChange={(e) => setFormData({...formData, warranty: e.target.value})}
                        className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        placeholder="5 Years"
                      />
                    </div>
                  )}

                  {/* Short Description - Hidden for Service (uses AI generated full description) */}
                  {formData.category !== "service" && (
                    <div className="md:col-span-2">
                      <label className="text-gray-500 text-sm mb-1 block">Short Description</label>
                      <input
                        type="text"
                        value={formData.short_description}
                        onChange={(e) => setFormData({...formData, short_description: e.target.value})}
                        className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                      placeholder="Brief product description for listing"
                    />
                    </div>
                  )}

                  {/* Full Description - Hidden for Service (has its own AI-powered description field) */}
                  {formData.category !== "service" && (
                    <div className="md:col-span-2">
                      <label className="text-gray-500 text-sm mb-1 block">Full Description</label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        placeholder="Detailed product description"
                      />
                    </div>
                  )}

                  {/* ── Enhanced Specs (solar_panel / inverter / battery / accessory) ── */}
                  {!["wire","service"].includes(formData.category) && (<>
                    {/* Product Highlights */}
                    <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h3 className="text-[#0a355e] font-semibold mb-2 flex items-center gap-2 text-sm">
                        <Star className="w-4 h-4 text-amber-500" /> Product Highlights
                      </h3>
                      <textarea
                        rows={3}
                        value={(formData.product_highlights || []).join("\n")}
                        onChange={e => setFormData({...formData, product_highlights: e.target.value.split("\n").filter(Boolean)})}
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-[#0a355e] text-sm"
                        placeholder={"One feature per line:\nBiFacial technology for rear power generation\nMBBR anti-LID treatment\nIP68 junction box"}
                      />
                      <p className="text-gray-500 text-xs mt-1">Each line becomes a bullet point on the product page</p>
                    </div>

                    {/* Electrical Specs */}
                    <SpecTableEditor
                      title="Electrical Specifications"
                      icon={Zap}
                      data={formData.electrical_specs || {}}
                      onChange={val => setFormData({...formData, electrical_specs: val})}
                      placeholder="e.g. 730W"
                    />

                    {/* Mechanical Specs */}
                    <SpecTableEditor
                      title="Mechanical Specifications"
                      icon={Settings}
                      data={formData.mechanical_specs || {}}
                      onChange={val => setFormData({...formData, mechanical_specs: val})}
                      placeholder="e.g. 38.3 kg"
                    />

                    {/* Warranty Info */}
                    <SpecTableEditor
                      title="Warranty Information"
                      icon={CheckCircle}
                      data={formData.warranty_info || {}}
                      onChange={val => setFormData({...formData, warranty_info: val})}
                      placeholder="e.g. 15 years"
                    />

                    {/* Shipping & Returns */}
                    <div className="md:col-span-2 bg-blue-900/10 border border-sky-200 rounded-xl p-4">
                      <h3 className="text-[#0a355e] font-semibold mb-2 flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4" /> Shipping & Returns Info
                      </h3>
                      <textarea
                        rows={3}
                        value={formData.shipping_info || ""}
                        onChange={e => setFormData({...formData, shipping_info: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg text-[#0a355e] text-sm"
                        placeholder="Dispatched within 3-5 working days. Free shipping on orders above ₹5000. Returns accepted within 7 days of delivery."
                      />
                    </div>
                  </>)}

                  {/* Images - Available for all categories including service */}
                  <div className="md:col-span-2">
                      <label className="text-gray-500 text-sm mb-1 block">Product Images {formData.category === "service" && "(Service Photos)"}</label>
                      
                      {/* Upload from Mobile/Desktop */}
                      <div className="mb-3">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          onChange={(e) => handleImageUpload(e)}
                          className="hidden"
                          id="mobile-image-upload"
                        />
                        <label
                          htmlFor="mobile-image-upload"
                          className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-amber-500 transition ${uploadingImage ? 'opacity-50' : ''}`}
                        >
                          <Upload className="w-5 h-5 text-amber-400" />
                          <span className="text-gray-600">
                            {uploadingImage ? 'Uploading...' : 'Upload Photos (select multiple)'}
                          </span>
                        </label>
                        <p className="text-gray-500 text-xs mt-1">Hold Ctrl/Cmd to select multiple • Max 5 MB each • JPEG, PNG, WebP, GIF</p>
                      </div>

                      {/* Or paste URL */}
                      <div className="flex gap-2 mb-2">
                        <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 px-4 py-2 bg-white shadow-lg border border-sky-200/50 border border-sky-200 rounded-lg text-[#0a355e]"
                        placeholder="Or paste image URL"
                      />
                      <button
                        type="button"
                        onClick={addImageUrl}
                        className="bg-blue-500 hover:bg-blue-600 text-[#0a355e] px-4 py-2 rounded-lg"
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
                              className="absolute -top-2 -right-2 bg-red-500 text-[#0a355e] rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>

                  {/* Options - Simplified for Service (only Active) */}
                  <div className="md:col-span-2 flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2 text-[#0a355e]">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <span>Active</span>
                    </label>
                    {formData.category !== "service" && (
                      <>
                        <label className="flex items-center space-x-2 text-[#0a355e]">
                          <input
                            type="checkbox"
                            checked={formData.is_featured}
                            onChange={(e) => setFormData({...formData, is_featured: e.target.checked})}
                            className="w-4 h-4 rounded"
                          />
                          <span>Featured</span>
                        </label>
                        <label className="flex items-center space-x-2 text-[#0a355e]">
                          <input
                            type="checkbox"
                            checked={formData.delivery_available}
                            onChange={(e) => setFormData({...formData, delivery_available: e.target.checked})}
                            className="w-4 h-4 rounded"
                          />
                          <span>Delivery Available</span>
                        </label>
                        <label className="flex items-center space-x-2 text-[#0a355e]">
                          <input
                            type="checkbox"
                            checked={formData.pickup_available}
                            onChange={(e) => setFormData({...formData, pickup_available: e.target.checked})}
                            className="w-4 h-4 rounded"
                          />
                          <span>Store Pickup</span>
                        </label>
                      </>
                    )}
                  </div>

                  {/* Delivery Districts Configuration */}
                  {formData.delivery_available && formData.category !== "service" && (
                    <div className="md:col-span-2 bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
                      <h3 className="text-blue-400 font-semibold mb-3 flex items-center">
                        <MapPin className="w-5 h-5 mr-2" />
                        Delivery Districts (Bihar)
                      </h3>
                      <p className="text-gray-500 text-sm mb-3">Select districts where this product can be delivered. Leave empty to deliver to all districts.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                        {biharDistricts.districts.map(district => (
                          <label key={district} className="flex items-center gap-2 text-sm text-[#0a355e] bg-white shadow-lg border border-sky-200/50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 border border-gray-300/50">
                            <input
                              type="checkbox"
                              checked={formData.delivery_districts?.includes(district) || false}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...(formData.delivery_districts || []), district]
                                  : (formData.delivery_districts || []).filter(d => d !== district);
                                setFormData({...formData, delivery_districts: updated});
                              }}
                              className="w-3 h-3 rounded"
                            />
                            <span className="truncate">{district}</span>
                            <span className="text-gray-500 text-xs ml-auto">₹{biharDistricts.delivery_fees[district] || 200}</span>
                          </label>
                        ))}
                      </div>
                      {formData.delivery_districts?.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-blue-400 text-xs">{formData.delivery_districts.length} districts selected</span>
                          <button type="button" onClick={() => setFormData({...formData, delivery_districts: []})} className="text-red-400 text-xs hover:text-red-300">Clear all</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-4 border-t border-sky-200">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError(""); }}
                    className="px-6 py-2 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-amber-500 text-[#0a355e] rounded-lg hover:bg-amber-600 flex items-center space-x-2 font-semibold"
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
