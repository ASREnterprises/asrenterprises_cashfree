import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  ShoppingCart, ChevronRight, ChevronLeft, Sun, Zap, Battery, Settings, Wrench,
  Plus, Minus, X, MapPin, CreditCard, Banknote, Truck, Store,
  Package, CheckCircle, AlertCircle, Loader2, Search, Eye, Cable,
  Star, Shield, Clock, Tag, Share2, ArrowUpDown, Copy, Mail,
  Facebook, MapPinCheck, ChevronDown
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categoryIcons = {
  solar_panel: <Sun className="w-5 h-5" />,
  inverter: <Zap className="w-5 h-5" />,
  battery: <Battery className="w-5 h-5" />,
  wire: <Cable className="w-5 h-5" />,
  accessory: <Settings className="w-5 h-5" />,
  service: <Wrench className="w-5 h-5" />
};

const SORT_OPTIONS = [
  { id: "newest", label: "Newest First" },
  { id: "price_low", label: "Price: Low to High" },
  { id: "price_high", label: "Price: High to Low" },
  { id: "name_az", label: "Name: A to Z" }
];

export const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sortBy, setSortBy] = useState("newest");
  const [showShareMenu, setShowShareMenu] = useState(null);
  const [pincodeCheck, setPincodeCheck] = useState({ pincode: "", result: null, loading: false });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  
  const [checkoutData, setCheckoutData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_type: "pickup",
    delivery_address: "",
    delivery_distance: "0-5",
    delivery_pincode: "",
    payment_method: "cod",
    notes: ""
  });

  const DELIVERY_FEES = {
    "0-5": 50, "5-10": 100, "10-20": 150, "20-30": 200, "30+": 300
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    const savedCart = localStorage.getItem("asr_cart");
    if (savedCart) setCart(JSON.parse(savedCart));
    const viewed = localStorage.getItem("asr_recently_viewed");
    if (viewed) setRecentlyViewed(JSON.parse(viewed));
  }, []);

  useEffect(() => {
    localStorage.setItem("asr_cart", JSON.stringify(cart));
  }, [cart]);

  const fetchProducts = async (category = null) => {
    try {
      setLoading(true);
      const url = category ? `${API}/shop/products?category=${category}` : `${API}/shop/products`;
      const res = await axios.get(url);
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/shop/categories`);
      setCategories(res.data);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        price: product.sale_price || product.price,
        quantity: qty,
        image: product.images?.[0] || ""
      }];
    });
  };

  const updateCartQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    // Track recently viewed
    setRecentlyViewed(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, 8);
      localStorage.setItem("asr_recently_viewed", JSON.stringify(updated));
      return updated;
    });
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
    setActiveImageIndex(0);
  };

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : categoryId;
  };

  // Pincode delivery check
  const checkPincode = async () => {
    if (!pincodeCheck.pincode || pincodeCheck.pincode.length !== 6) return;
    setPincodeCheck(p => ({ ...p, loading: true }));
    try {
      const res = await axios.get(`${API}/shop/check-delivery/${pincodeCheck.pincode}`);
      setPincodeCheck(p => ({ ...p, result: res.data, loading: false }));
    } catch {
      setPincodeCheck(p => ({ ...p, result: { deliverable: false, note: "Unable to check. Try again." }, loading: false }));
    }
  };

  // Share product
  const shareProduct = (product, platform) => {
    const url = `${window.location.origin}/shop`;
    const text = `Check out ${product.name} - ₹${(product.sale_price || product.price).toLocaleString()} at ASR Enterprises Solar Shop!`;
    const imageUrl = product.images?.[0] || "";
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + "\n" + url + (imageUrl ? "\n" + imageUrl : ""))}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(`${product.name} - ASR Solar Shop`)}&body=${encodeURIComponent(text + "\n\n" + url)}`,
      copy: null
    };

    if (platform === "copy") {
      navigator.clipboard.writeText(text + "\n" + url);
      alert("Link copied to clipboard!");
    } else {
      window.open(shareUrls[platform], "_blank");
    }
    setShowShareMenu(null);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryCharge = checkoutData.delivery_type === "delivery" ? DELIVERY_FEES[checkoutData.delivery_distance] : 0;
  const grandTotal = cartTotal + deliveryCharge;

  const handleCheckout = async () => {
    if (!checkoutData.customer_name || !checkoutData.customer_phone) {
      alert("Please fill in your name and phone number");
      return;
    }
    if (checkoutData.delivery_type === "delivery" && !checkoutData.delivery_address) {
      alert("Please enter delivery address");
      return;
    }
    setPlacingOrder(true);

    try {
      const orderData = {
        ...checkoutData,
        items: cart,
        subtotal: cartTotal,
        delivery_charge: deliveryCharge,
        total: grandTotal,
        delivery_district: "Patna"
      };

      const res = await axios.post(`${API}/shop/orders`, orderData);
      const orderId = res.data.order?.id;
      const orderNumber = res.data.order_number;
      
      if (checkoutData.payment_method === "razorpay") {
        try {
          const configRes = await axios.get(`${API}/shop/razorpay-config`);
          const razorpayKeyId = configRes.data.key_id;
          
          if (!razorpayKeyId || !window.Razorpay) {
            alert("Payment gateway is not available. Please try again.");
            setPlacingOrder(false);
            return;
          }

          const options = {
            key: razorpayKeyId,
            amount: Math.round(grandTotal * 100),
            currency: "INR",
            name: "ASR Enterprises",
            description: `Order #${orderNumber}`,
            handler: async function (response) {
              // Payment SUCCESS
              try {
                await axios.post(`${API}/shop/orders/${orderId}/payment-verify`, {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id || "",
                  razorpay_signature: response.razorpay_signature || ""
                });
              } catch (verifyErr) {
                console.error("Payment verification error:", verifyErr);
              }
              // Show success only after payment
              setOrderSuccess({ ...res.data, payment_completed: true });
              setCart([]);
              localStorage.removeItem("asr_cart");
              setShowCheckout(false);
              setPlacingOrder(false);
            },
            modal: {
              ondismiss: function() {
                // Payment cancelled/dismissed - mark as failed
                axios.put(`${API}/shop/orders/${orderId}/status`, { 
                  order_status: "cancelled", 
                  payment_status: "failed" 
                }).catch(() => {});
                setPlacingOrder(false);
                alert("Payment was cancelled. Your order has been cancelled.");
              }
            },
            prefill: {
              name: checkoutData.customer_name,
              contact: checkoutData.customer_phone,
              email: checkoutData.customer_email || ""
            },
            theme: { color: "#f59e0b" },
            notes: { order_number: orderNumber, order_id: orderId || "" }
          };

          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", function() {
            axios.put(`${API}/shop/orders/${orderId}/status`, { 
              order_status: "cancelled", 
              payment_status: "failed" 
            }).catch(() => {});
            setPlacingOrder(false);
            alert("Payment failed. Please try again.");
          });
          rzp.open();
          // Don't show success yet - wait for handler
          return;
        } catch (rzpErr) {
          console.error("Razorpay error:", rzpErr);
          setPlacingOrder(false);
          return;
        }
      }

      // COD - show success immediately
      setOrderSuccess(res.data);
      setCart([]);
      localStorage.removeItem("asr_cart");
      setShowCheckout(false);
      setPlacingOrder(false);
    } catch (err) {
      console.error("Order error:", err);
      alert("Failed to place order. Please try again.");
      setPlacingOrder(false);
    }
  };

  // Sort and filter products
  const sortedProducts = [...products]
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "price_low": return (a.sale_price || a.price) - (b.sale_price || b.price);
        case "price_high": return (b.sale_price || b.price) - (a.sale_price || a.price);
        case "name_az": return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

  // Related products for detail modal
  const relatedProducts = selectedProduct 
    ? products.filter(p => p.category === selectedProduct.category && p.id !== selectedProduct.id).slice(0, 4) 
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1b33] to-[#0a1628]">
      {/* Header */}
      <div className="bg-[#0a1628]/90 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center text-amber-400 hover:text-amber-300 transition">
              <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
              <span>Back to Home</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <Link to="/track-order" className="text-gray-300 hover:text-amber-400 transition text-sm flex items-center gap-1" data-testid="track-order-link">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Track Order</span>
              </Link>
              <button 
                onClick={() => setShowCart(true)}
                className="relative bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                data-testid="cart-button"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>Cart</span>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            ASR <span className="text-amber-400">Solar Shop</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-4">
            Quality solar products delivered across Bihar
          </p>
          
          {/* Pincode Delivery Check */}
          <div className="max-w-md mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPinCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter pincode to check delivery"
                  maxLength={6}
                  value={pincodeCheck.pincode}
                  onChange={(e) => setPincodeCheck({ pincode: e.target.value.replace(/\D/g, ""), result: null, loading: false })}
                  onKeyDown={(e) => e.key === "Enter" && checkPincode()}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/70 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:border-amber-500 focus:outline-none"
                  data-testid="pincode-input"
                />
              </div>
              <button
                onClick={checkPincode}
                disabled={pincodeCheck.loading || pincodeCheck.pincode.length !== 6}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                data-testid="check-pincode-btn"
              >
                {pincodeCheck.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </button>
            </div>
            {pincodeCheck.result && (
              <div className={`mt-2 text-sm px-3 py-2 rounded-lg ${pincodeCheck.result.deliverable ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`} data-testid="pincode-result">
                {pincodeCheck.result.deliverable ? (
                  <span>Delivery available to <strong>{pincodeCheck.result.district}</strong> ({pincodeCheck.result.estimated_days} days) {pincodeCheck.result.note || ""}</span>
                ) : (
                  <span>{pincodeCheck.result.note || "Delivery not available for this pincode"}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search, Filter & Sort */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                data-testid="search-input"
              />
            </div>
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-gray-800/50 border border-gray-700 text-white px-4 py-3 pr-10 rounded-xl focus:border-amber-500 focus:outline-none cursor-pointer"
                data-testid="sort-select"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => { setSelectedCategory(null); fetchProducts(); }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${!selectedCategory ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              data-testid="category-all"
            >All</button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); fetchProducts(cat.id); }}
                className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center space-x-2 transition ${selectedCategory === cat.id ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                data-testid={`category-${cat.id}`}
              >
                {categoryIcons[cat.id]}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Products Count */}
        <p className="text-gray-400 text-sm mb-4">{sortedProducts.length} product{sortedProducts.length !== 1 ? "s" : ""} found</p>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400">No products found</h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {sortedProducts.map(product => (
              <div key={product.id} className="bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-amber-500/50 transition group relative" data-testid={`product-card-${product.id}`}>
                {/* Share Button */}
                <div className="absolute top-2 right-2 z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowShareMenu(showShareMenu === product.id ? null : product.id); }}
                    className="bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white p-2 rounded-full transition"
                    data-testid={`share-btn-${product.id}`}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  {showShareMenu === product.id && (
                    <div className="absolute right-0 top-10 bg-gray-800 border border-gray-600 rounded-xl p-2 shadow-xl min-w-[140px] z-20">
                      <button onClick={() => shareProduct(product, "whatsapp")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg">
                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                        WhatsApp
                      </button>
                      <button onClick={() => shareProduct(product, "facebook")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg">
                        <Facebook className="w-4 h-4 text-blue-400" />
                        Facebook
                      </button>
                      <button onClick={() => shareProduct(product, "email")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg">
                        <Mail className="w-4 h-4 text-red-400" />
                        Email
                      </button>
                      <button onClick={() => shareProduct(product, "copy")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg">
                        <Copy className="w-4 h-4 text-gray-400" />
                        Copy Link
                      </button>
                    </div>
                  )}
                </div>

                {/* Product Image */}
                <div 
                  className="aspect-square bg-gray-900 relative overflow-hidden cursor-pointer"
                  onClick={() => openProductDetail(product)}
                  data-testid={`product-image-${product.id}`}
                >
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Sun className="w-20 h-20 text-gray-700" /></div>
                  )}
                  {product.is_featured && <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">Featured</span>}
                  {product.sale_price && <span className="absolute top-10 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">{Math.round((1 - product.sale_price / product.price) * 100)}% OFF</span>}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                      <Eye className="w-4 h-4" /><span>View Details</span>
                    </span>
                  </div>
                </div>
                
                {/* Product Info */}
                <div className="p-3 md:p-4">
                  <h3 className="text-white font-semibold text-sm md:text-base mb-1 line-clamp-2 cursor-pointer hover:text-amber-400 transition" onClick={() => openProductDetail(product)}>
                    {product.name}
                  </h3>
                  {product.brand && <p className="text-gray-400 text-xs mb-1">{product.brand}</p>}
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      {product.sale_price ? (
                        <div className="flex items-center space-x-1">
                          <span className="text-lg md:text-xl font-bold text-amber-400">₹{product.sale_price.toLocaleString()}</span>
                          <span className="text-gray-500 line-through text-xs">₹{product.price.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-lg md:text-xl font-bold text-amber-400">₹{product.price.toLocaleString()}</span>
                      )}
                      {product.category === "wire" && <span className="text-gray-500 text-xs">/meter</span>}
                    </div>
                    {product.stock > 0 ? (
                      <span className="text-green-400 text-xs">In Stock</span>
                    ) : (
                      <span className="text-red-400 text-xs">Out of Stock</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center space-x-2 transition text-sm"
                    data-testid={`add-to-cart-${product.id}`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && !selectedProduct && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" /> Recently Viewed
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {recentlyViewed.map(product => (
                <div key={product.id} className="flex-shrink-0 w-40 bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700/50 cursor-pointer hover:border-amber-500/50 transition" onClick={() => openProductDetail(product)}>
                  <div className="aspect-square bg-gray-900">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Sun className="w-10 h-10 text-gray-700" /></div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-white text-xs line-clamp-2">{product.name}</p>
                    <p className="text-amber-400 font-semibold text-sm">₹{(product.sale_price || product.price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0d1b33] shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Shopping Cart</h2>
                <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map(item => (
                      <div key={item.product_id} className="bg-gray-800/50 rounded-xl p-4 flex items-center space-x-4">
                        {item.image ? (
                          <img src={item.image} alt={item.product_name} className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center"><Sun className="w-8 h-8 text-gray-500" /></div>
                        )}
                        <div className="flex-1">
                          <h4 className="text-white font-medium line-clamp-1 text-sm">{item.product_name}</h4>
                          <p className="text-amber-400 font-semibold">₹{item.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => updateCartQuantity(item.product_id, -1)} className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center text-white hover:bg-gray-600"><Minus className="w-3 h-3" /></button>
                          <span className="text-white w-6 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product_id, 1)} className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center text-white hover:bg-gray-600"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.product_id)} className="text-red-400 hover:text-red-300"><X className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex justify-between text-gray-300 mb-2">
                      <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                      <span>₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => { setShowCart(false); setShowCheckout(true); }}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition"
                      data-testid="proceed-checkout-btn"
                    >Proceed to Checkout</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !placingOrder && setShowCheckout(false)} />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Checkout</h2>
                <button onClick={() => !placingOrder && setShowCheckout(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-6">
                {/* Customer Details */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Customer Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Name *" value={checkoutData.customer_name} onChange={(e) => setCheckoutData({...checkoutData, customer_name: e.target.value})} className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none" data-testid="checkout-name" />
                    <input type="tel" placeholder="Phone Number *" value={checkoutData.customer_phone} onChange={(e) => setCheckoutData({...checkoutData, customer_phone: e.target.value})} className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none" data-testid="checkout-phone" />
                    <input type="email" placeholder="Email (Optional)" value={checkoutData.customer_email} onChange={(e) => setCheckoutData({...checkoutData, customer_email: e.target.value})} className="w-full md:col-span-2 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none" />
                  </div>
                </div>

                {/* Delivery Options */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Delivery Option</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setCheckoutData({...checkoutData, delivery_type: "pickup"})} className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${checkoutData.delivery_type === "pickup" ? "border-amber-500 bg-amber-500/20" : "border-gray-700 hover:border-gray-600"}`}>
                      <Store className="w-8 h-8 text-amber-400" />
                      <span className="text-white font-semibold">Store Pickup</span>
                      <span className="text-green-400 text-sm">FREE</span>
                    </button>
                    <button onClick={() => setCheckoutData({...checkoutData, delivery_type: "delivery"})} className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${checkoutData.delivery_type === "delivery" ? "border-amber-500 bg-amber-500/20" : "border-gray-700 hover:border-gray-600"}`}>
                      <Truck className="w-8 h-8 text-blue-400" />
                      <span className="text-white font-semibold">Home Delivery</span>
                      <span className="text-amber-400 text-sm">Bihar Only</span>
                    </button>
                  </div>

                  {checkoutData.delivery_type === "delivery" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="text-gray-300 text-sm mb-2 block">Distance from Store</label>
                        <select value={checkoutData.delivery_distance} onChange={(e) => setCheckoutData({...checkoutData, delivery_distance: e.target.value})} className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-amber-500 focus:outline-none">
                          <option value="0-5">0-5 km - ₹50</option>
                          <option value="5-10">5-10 km - ₹100</option>
                          <option value="10-20">10-20 km - ₹150</option>
                          <option value="20-30">20-30 km - ₹200</option>
                          <option value="30+">30+ km - ₹300</option>
                        </select>
                      </div>
                      <textarea placeholder="Full Delivery Address *" value={checkoutData.delivery_address} onChange={(e) => setCheckoutData({...checkoutData, delivery_address: e.target.value})} rows={3} className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none" data-testid="checkout-address" />
                    </div>
                  )}

                  {checkoutData.delivery_type === "pickup" && (
                    <div className="mt-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                      <p className="text-white font-medium mb-2">Pickup Address:</p>
                      <p className="text-gray-300">Shop no 10, AMAN SKS COMPLEX</p>
                      <p className="text-gray-300">Khagaul Saguna Road, Patna 801503</p>
                      <p className="text-amber-400 text-sm mt-2">Open: 9 AM - 7 PM (Mon-Sat)</p>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Payment Method</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setCheckoutData({...checkoutData, payment_method: "cod"})} className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${checkoutData.payment_method === "cod" ? "border-amber-500 bg-amber-500/20" : "border-gray-700 hover:border-gray-600"}`} data-testid="payment-cod">
                      <Banknote className="w-8 h-8 text-green-400" />
                      <span className="text-white font-semibold">Cash on {checkoutData.delivery_type === "pickup" ? "Store" : "Delivery"}</span>
                    </button>
                    <button onClick={() => setCheckoutData({...checkoutData, payment_method: "razorpay"})} className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${checkoutData.payment_method === "razorpay" ? "border-amber-500 bg-amber-500/20" : "border-gray-700 hover:border-gray-600"}`} data-testid="payment-razorpay">
                      <CreditCard className="w-8 h-8 text-blue-400" />
                      <span className="text-white font-semibold">Pay Online</span>
                      <span className="text-gray-400 text-xs">UPI / Card / NetBanking</span>
                    </button>
                  </div>
                </div>

                {/* Order Notes */}
                <textarea placeholder="Order Notes (Optional)" value={checkoutData.notes} onChange={(e) => setCheckoutData({...checkoutData, notes: e.target.value})} rows={2} className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none" />

                {/* Order Summary */}
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <h4 className="text-white font-semibold mb-3">Order Summary</h4>
                  <div className="space-y-2 text-sm">
                    {cart.map(item => (
                      <div key={item.product_id} className="flex justify-between text-gray-300">
                        <span>{item.product_name} x {item.quantity}</span>
                        <span>₹{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-600 pt-2 mt-2">
                      <div className="flex justify-between text-gray-300">
                        <span>Subtotal</span>
                        <span>₹{cartTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Delivery</span>
                        <span>{deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge}`}</span>
                      </div>
                      <div className="flex justify-between text-white font-bold text-lg mt-2">
                        <span>Total</span>
                        <span className="text-amber-400">₹{grandTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Place Order Button */}
                <button
                  onClick={handleCheckout}
                  disabled={placingOrder}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-600 transition flex items-center justify-center space-x-2"
                  data-testid="place-order-btn"
                >
                  {placingOrder ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />}
                  <span>{placingOrder ? "Processing..." : `Place Order - ₹${grandTotal.toLocaleString()}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Order Placed Successfully!</h2>
            <p className="text-gray-400 mb-4">Thank you for your order</p>
            
            <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
              <p className="text-gray-400 text-sm">Order Number</p>
              <p className="text-amber-400 font-bold text-xl" data-testid="order-number">{orderSuccess.order_number}</p>
            </div>

            {orderSuccess.payment_completed && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3 mb-4">
                <p className="text-green-300 text-sm font-semibold">Payment Confirmed</p>
              </div>
            )}

            {/* WhatsApp Confirmation - Manual button only */}
            {orderSuccess.customer_whatsapp_url && (
              <a href={orderSuccess.customer_whatsapp_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition mb-4"
                data-testid="whatsapp-confirmation-btn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Get Order Confirmation on WhatsApp
              </a>
            )}

            <div className="flex gap-4">
              <Link to="/" className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition">Go Home</Link>
              <button onClick={() => setOrderSuccess(null)} className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 transition">Continue Shopping</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="product-detail-modal">
          <div className="absolute inset-0 bg-black/70" onClick={closeProductDetail} />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <button onClick={closeProductDetail} className="absolute top-4 right-4 z-10 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full p-2 transition" data-testid="close-product-detail">
              <X className="w-6 h-6" />
            </button>

            <div className="grid md:grid-cols-2 gap-0">
              {/* Image Gallery */}
              <div className="bg-gray-900 p-6">
                <div className="aspect-square bg-gray-800 rounded-xl overflow-hidden mb-4 relative">
                  {selectedProduct.images?.length > 0 ? (
                    <>
                      <img src={selectedProduct.images[activeImageIndex]} alt={selectedProduct.name} className="w-full h-full object-contain" data-testid="product-main-image" />
                      {selectedProduct.images.length > 1 && (
                        <>
                          <button onClick={() => setActiveImageIndex(prev => prev === 0 ? selectedProduct.images.length - 1 : prev - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"><ChevronLeft className="w-5 h-5" /></button>
                          <button onClick={() => setActiveImageIndex(prev => prev === selectedProduct.images.length - 1 ? 0 : prev + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"><ChevronRight className="w-5 h-5" /></button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Sun className="w-32 h-32 text-gray-700" /></div>
                  )}
                </div>
                {selectedProduct.images?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedProduct.images.map((img, idx) => (
                      <button key={idx} onClick={() => setActiveImageIndex(idx)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${activeImageIndex === idx ? 'border-amber-500' : 'border-transparent hover:border-gray-600'}`}>
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                    {categoryIcons[selectedProduct.category]}<span>{getCategoryName(selectedProduct.category)}</span>
                  </span>
                  {selectedProduct.is_featured && <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm flex items-center space-x-1"><Star className="w-4 h-4" /><span>Featured</span></span>}
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2" data-testid="product-detail-name">{selectedProduct.name}</h2>
                {selectedProduct.brand && <p className="text-gray-400 text-sm mb-4">Brand: {selectedProduct.brand}</p>}

                <div className="mb-4">
                  {selectedProduct.sale_price ? (
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl font-bold text-amber-400">₹{selectedProduct.sale_price.toLocaleString()}</span>
                      <span className="text-xl text-gray-500 line-through">₹{selectedProduct.price.toLocaleString()}</span>
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-sm">{Math.round((1 - selectedProduct.sale_price / selectedProduct.price) * 100)}% OFF</span>
                    </div>
                  ) : (
                    <span className="text-3xl font-bold text-amber-400">₹{selectedProduct.price.toLocaleString()}</span>
                  )}
                  {selectedProduct.category === 'wire' && <p className="text-gray-400 text-sm mt-1">Price per meter</p>}
                </div>

                <div className="flex items-center space-x-4 mb-4">
                  {selectedProduct.stock > 0 ? (
                    <span className="flex items-center text-green-400"><CheckCircle className="w-5 h-5 mr-2" />In Stock</span>
                  ) : (
                    <span className="flex items-center text-red-400"><AlertCircle className="w-5 h-5 mr-2" />Out of Stock</span>
                  )}
                  {selectedProduct.warranty && <span className="flex items-center text-blue-400 text-sm"><Shield className="w-4 h-4 mr-1" />{selectedProduct.warranty} Warranty</span>}
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-gray-300 leading-relaxed text-sm" data-testid="product-detail-description">{selectedProduct.description || "No description available."}</p>
                </div>

                {/* Share Buttons */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-400 text-sm">Share:</span>
                  <button onClick={() => shareProduct(selectedProduct, "whatsapp")} className="bg-green-600/20 hover:bg-green-600/40 text-green-400 p-2 rounded-lg transition" data-testid="share-whatsapp">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  </button>
                  <button onClick={() => shareProduct(selectedProduct, "facebook")} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 p-2 rounded-lg transition"><Facebook className="w-4 h-4" /></button>
                  <button onClick={() => shareProduct(selectedProduct, "email")} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-2 rounded-lg transition"><Mail className="w-4 h-4" /></button>
                  <button onClick={() => shareProduct(selectedProduct, "copy")} className="bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 p-2 rounded-lg transition"><Copy className="w-4 h-4" /></button>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={() => { addToCart(selectedProduct); closeProductDetail(); setShowCart(true); }}
                  disabled={selectedProduct.stock === 0}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white py-4 rounded-xl font-bold text-lg transition flex items-center justify-center space-x-2"
                  data-testid="modal-add-to-cart"
                >
                  <ShoppingCart className="w-6 h-6" />
                  <span>Add to Cart</span>
                </button>

                {/* Delivery Info */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-gray-400 text-sm"><Truck className="w-4 h-4 mr-2 text-blue-400" />Free pickup from store</div>
                  <div className="flex items-center text-gray-400 text-sm"><MapPin className="w-4 h-4 mr-2 text-green-400" />Delivery across Bihar</div>
                  <div className="flex items-center text-gray-400 text-sm"><Shield className="w-4 h-4 mr-2 text-amber-400" />Quality guaranteed</div>
                </div>
              </div>
            </div>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
              <div className="border-t border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Related Products</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {relatedProducts.map(rp => (
                    <div key={rp.id} className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700/50 cursor-pointer hover:border-amber-500/50 transition" onClick={() => { setSelectedProduct(rp); setActiveImageIndex(0); }}>
                      <div className="aspect-square bg-gray-900">
                        {rp.images?.[0] ? <img src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Sun className="w-10 h-10 text-gray-700" /></div>}
                      </div>
                      <div className="p-3">
                        <p className="text-white text-sm line-clamp-1">{rp.name}</p>
                        <p className="text-amber-400 font-semibold">₹{(rp.sale_price || rp.price).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
