import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { 
  ShoppingCart, ChevronRight, ChevronLeft, Sun, Zap, Battery, Settings, Wrench,
  Plus, Minus, X, MapPin, CreditCard, Banknote, Truck, Store,
  Package, CheckCircle, AlertCircle, Loader2, Search, Eye, Cable,
  Star, Shield, Clock, Tag, Share2, ArrowUpDown, Copy, Mail,
  Facebook, MapPinCheck, Heart, Filter, ChevronDown, ExternalLink,
  Sparkles, BadgePercent, ThumbsUp, Phone
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categoryIcons = {
  solar_panel: <Sun className="w-4 h-4" />,
  inverter: <Zap className="w-4 h-4" />,
  battery: <Battery className="w-4 h-4" />,
  wire: <Cable className="w-4 h-4" />,
  accessory: <Settings className="w-4 h-4" />,
  service: <Wrench className="w-4 h-4" />
};

const SORT_OPTIONS = [
  { id: "relevance", label: "Relevance" },
  { id: "newest", label: "Newest First" },
  { id: "price_low", label: "Price -- Low to High" },
  { id: "price_high", label: "Price -- High to Low" },
  { id: "name_az", label: "Name A-Z" }
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
  const [sortBy, setSortBy] = useState("relevance");
  const [showShareMenu, setShowShareMenu] = useState(null);
  const [pincodeCheck, setPincodeCheck] = useState({ pincode: "", result: null, loading: false });
  const [productPincode, setProductPincode] = useState({ pincode: "", result: null, loading: false });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [addedToCart, setAddedToCart] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [biharDistricts, setBiharDistricts] = useState({ districts: [], delivery_fees: {} });
  const [reviewsSummary, setReviewsSummary] = useState({});
  const [productReviews, setProductReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ customer_name: "", rating: 5, title: "", review_text: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  
  const searchRef = useRef(null);
  const location = useLocation();
  
  const [checkoutData, setCheckoutData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_type: "pickup",
    delivery_address: "",
    delivery_district: "Patna",
    payment_method: "cod",
    notes: ""
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBiharDistricts();
    fetchReviewsSummary();
    const savedCart = localStorage.getItem("asr_cart");
    if (savedCart) setCart(JSON.parse(savedCart));
    const viewed = localStorage.getItem("asr_recently_viewed");
    if (viewed) setRecentlyViewed(JSON.parse(viewed));
    const saved_wishlist = localStorage.getItem("asr_wishlist");
    if (saved_wishlist) setWishlist(JSON.parse(saved_wishlist));
  }, []);

  useEffect(() => { localStorage.setItem("asr_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("asr_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // Handle Cashfree payment return URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get("payment_status");
    const cfOrderId = params.get("order_id");
    if (paymentStatus === "success" && cfOrderId) {
      // Verify payment with backend and get order details
      axios.post(`${API}/shop/cashfree-verify`, { cf_order_id: cfOrderId })
        .then(res => {
          if (res.data?.success) {
            setOrderSuccess(res.data.order);
            setCart([]);
            localStorage.removeItem("asr_cart");
          }
          // Clean URL
          window.history.replaceState({}, "", "/shop");
        })
        .catch(err => {
          console.error("Payment verify error:", err);
          window.history.replaceState({}, "", "/shop");
        });
    }
  }, [location.search]);

  const fetchProducts = async (category = null) => {
    try {
      setLoading(true);
      const url = category ? `${API}/shop/products?category=${category}` : `${API}/shop/products`;
      const res = await axios.get(url);
      setProducts(res.data);
    } catch (err) { console.error("Error fetching products:", err); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try { const res = await axios.get(`${API}/shop/categories`); setCategories(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchBiharDistricts = async () => {
    try { const res = await axios.get(`${API}/shop/bihar-districts`); setBiharDistricts(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchReviewsSummary = async () => {
    try { const res = await axios.get(`${API}/shop/reviews/summary`); setReviewsSummary(res.data); }
    catch (err) { console.error(err); }
  };

  const fetchProductReviews = async (productId) => {
    try { const res = await axios.get(`${API}/shop/products/${productId}/reviews`); setProductReviews(res.data.reviews || []); }
    catch (err) { console.error(err); setProductReviews([]); }
  };

  const submitReview = async (productId) => {
    if (!reviewForm.customer_name || !reviewForm.review_text) { alert("Please fill name and review"); return; }
    setSubmittingReview(true);
    try {
      await axios.post(`${API}/shop/products/${productId}/reviews`, reviewForm);
      fetchProductReviews(productId);
      fetchReviewsSummary();
      setShowReviewForm(false);
      setReviewForm({ customer_name: "", rating: 5, title: "", review_text: "" });
      alert("Thank you for your review!");
    } catch { alert("Failed to submit review."); }
    finally { setSubmittingReview(false); }
  };

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, { product_id: product.id, product_name: product.name, price: product.sale_price || product.price, quantity: qty, image: product.images?.[0] || "" }];
    });
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
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

  const removeFromCart = (productId) => { setCart(prev => prev.filter(item => item.product_id !== productId)); };

  const toggleWishlist = (productId) => {
    setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    setProductPincode({ pincode: "", result: null, loading: false });
    setShowReviewForm(false);
    fetchProductReviews(product.id);
    setRecentlyViewed(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, 8);
      localStorage.setItem("asr_recently_viewed", JSON.stringify(updated));
      return updated;
    });
  };

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : categoryId;
  };

  const checkPincode = async () => {
    if (!pincodeCheck.pincode || pincodeCheck.pincode.length !== 6) return;
    setPincodeCheck(p => ({ ...p, loading: true }));
    try {
      const res = await axios.get(`${API}/shop/check-delivery/${pincodeCheck.pincode}`);
      setPincodeCheck(p => ({ ...p, result: res.data, loading: false }));
    } catch { setPincodeCheck(p => ({ ...p, result: { deliverable: false, note: "Unable to check." }, loading: false })); }
  };

  const checkProductPincode = async (productId) => {
    if (!productPincode.pincode || productPincode.pincode.length !== 6) return;
    setProductPincode(p => ({ ...p, loading: true }));
    try {
      const res = await axios.get(`${API}/shop/products/${productId}/check-delivery/${productPincode.pincode}`);
      setProductPincode(p => ({ ...p, result: res.data, loading: false }));
    } catch { setProductPincode(p => ({ ...p, result: { deliverable: false, note: "Unable to check." }, loading: false })); }
  };

  const shareProduct = (product, platform) => {
    const url = `${window.location.origin}/shop?product=${encodeURIComponent(product.id)}`;
    const text = `Check out ${product.name} - ₹${(product.sale_price || product.price).toLocaleString()} at ASR Enterprises Solar Hub!`;
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(product.name)}&body=${encodeURIComponent(text + "\n\n" + url)}`,
    };
    if (platform === "copy") { navigator.clipboard.writeText(text + "\n" + url); alert("Link copied!"); }
    else { window.open(shareUrls[platform], "_blank"); }
    setShowShareMenu(null);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = checkoutData.delivery_type === "delivery" 
    ? (biharDistricts.delivery_fees[checkoutData.delivery_district] || 200) 
    : 0;
  const grandTotal = cartTotal + deliveryFee;

  const handleCheckout = async () => {
    if (!checkoutData.customer_name || !checkoutData.customer_phone) { alert("Please fill name and phone"); return; }
    if (checkoutData.delivery_type === "delivery" && !checkoutData.delivery_address) { alert("Please enter delivery address"); return; }
    setPlacingOrder(true);
    try {
      const orderData = { ...checkoutData, items: cart, subtotal: cartTotal, delivery_charge: deliveryFee, total: grandTotal, origin_url: window.location.origin };
      const res = await axios.post(`${API}/shop/orders`, orderData);
      const orderId = res.data.order?.id;
      const paymentSessionId = res.data.payment_session_id;
      
      if (checkoutData.payment_method === "online" && paymentSessionId) {
        // Backend stores the order in cashfree_orders by cf order_id, so
        // /api/cashfree/pay/<cf_order_id> serves a hosted checkout page that
        // works as a reliable fallback if the in-page SDK fails to launch.
        const cfOrderId = res.data.cashfree_order_id;
        const hostedCheckoutUrl = cfOrderId
          ? `${API}/cashfree/pay/${cfOrderId}`
          : null;

        const goHosted = (reason) => {
          console.warn('Cashfree SDK fallback ->', reason);
          if (hostedCheckoutUrl) {
            window.location.href = hostedCheckoutUrl;
          } else {
            alert('Payment could not be processed. Please try again or call 9296389097.');
            setPlacingOrder(false);
          }
        };

        try {
          const loadCashfreeSDK = () => new Promise((resolve, reject) => {
            if (window.Cashfree) { resolve(window.Cashfree); return; }
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
            script.async = true;
            script.onload = () => window.Cashfree
              ? resolve(window.Cashfree)
              : reject(new Error('Cashfree SDK failed'));
            script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
            document.body.appendChild(script);
          });

          const Cashfree = await loadCashfreeSDK();
          const cashfree = Cashfree({ mode: "production" });

          const result = cashfree.checkout({
            paymentSessionId: paymentSessionId,
            redirectTarget: "_self",
          });
          if (result && typeof result.then === 'function') {
            result.catch((err) => goHosted(err && err.message));
          }
          return; // either redirected or hosted-fallback will redirect
        } catch (paymentErr) {
          goHosted(paymentErr && paymentErr.message);
          return;
        }
      }
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

  const sortedProducts = [...products]
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "price_low": return (a.sale_price || a.price) - (b.sale_price || b.price);
        case "price_high": return (b.sale_price || b.price) - (a.sale_price || a.price);
        case "name_az": return a.name.localeCompare(b.name);
        case "newest": return -1;
        default: return 0;
      }
    });

  const relatedProducts = selectedProduct ? products.filter(p => p.category === selectedProduct.category && p.id !== selectedProduct.id).slice(0, 4) : [];
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Star Rating Component
  const StarRating = ({ rating, size = "w-3 h-3", interactive = false, onChange }) => (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => interactive && onChange?.(i)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <Star className={`${size} ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F6FF]" style={{ fontFamily: "'Inter', 'Segoe UI', Roboto, Arial, sans-serif" }}>
      
      {/* === TOP HEADER BAR - Premium Dark Blue === */}
      <header className="bg-gradient-to-r from-[#0B3C5D] to-[#071A2E] sticky top-0 z-50 shadow-xl">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6">
          <div className="flex items-center h-16 gap-3">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/asr_logo_transparent.png" alt="ASR" className="h-10 w-10 object-contain" />
              <span className="text-white font-bold text-xl hidden sm:block font-[Poppins]">ASR Solar Hub</span>
            </Link>

            {/* Search Bar */}
            <div className="flex-1 min-w-0 max-w-[160px] sm:max-w-2xl relative" ref={searchRef}>
              <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-full overflow-hidden border border-white/20">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm text-white bg-transparent outline-none placeholder-white/60"
                  data-testid="search-input"
                />
                <button className="bg-[#00C389] px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-[#00A372] transition rounded-r-full flex-shrink-0">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Nav Items — always visible */}
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              <Link to="/track-order"
                className="text-white/80 hover:text-[#FFD166] transition flex items-center gap-1 bg-white/10 px-2.5 py-2 rounded-full"
                title="Track Order"
                data-testid="track-order-link"
              >
                <Package className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Track</span>
              </Link>
              <button
                onClick={() => setShowCart(true)}
                className="relative text-white hover:text-[#FFD166] transition flex items-center gap-1 bg-white/10 px-2.5 sm:px-4 py-2 rounded-full"
                title="Cart"
                data-testid="cart-button"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm font-medium">Cart</span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#00C389] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow">{cartItemCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>
        {/* Category Strip - Premium Gold Active */}
        <div className="bg-[#0B3C5D]/80 border-t border-white/10">
          <div className="max-w-[1400px] mx-auto px-3 sm:px-6 overflow-x-auto">
            <div className="flex items-center gap-2 py-2">
              <button onClick={() => { setSelectedCategory(null); fetchProducts(); }}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${!selectedCategory ? 'bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                data-testid="category-all"
              >All Products</button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); fetchProducts(cat.id); }}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${selectedCategory === cat.id ? 'bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] shadow-lg' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                  data-testid={`category-${cat.id}`}
                >{categoryIcons[cat.id]}<span>{cat.name}</span></button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* === PROMO BANNER === */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 py-2">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-center gap-4 text-white text-xs sm:text-sm">
          <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Free Pickup from Store</span>
          <span className="hidden sm:block">|</span>
          <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> Quality Guaranteed</span>
          <span className="hidden sm:block">|</span>
          <span className="hidden sm:flex items-center gap-1"><CreditCard className="w-4 h-4" /> Secure Payments</span>
          <span className="hidden md:block">|</span>
          <span className="hidden md:flex items-center gap-1"><Phone className="w-4 h-4" /> 9296389097</span>
        </div>
      </div>

      {/* === DELIVERY CHECKER STRIP === */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <MapPin className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-gray-600">Deliver to</span>
              <div className="flex items-center gap-2">
                <input
                  type="text" maxLength={6} placeholder="Enter Pincode"
                  value={pincodeCheck.pincode}
                  onChange={(e) => setPincodeCheck({ pincode: e.target.value.replace(/\D/g, ""), result: null, loading: false })}
                  onKeyDown={(e) => e.key === "Enter" && checkPincode()}
                  className="w-28 px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-amber-500 focus:outline-none"
                  data-testid="pincode-input"
                />
                <button onClick={checkPincode} disabled={pincodeCheck.loading || pincodeCheck.pincode.length !== 6}
                  className="text-amber-600 hover:text-amber-700 font-semibold text-sm disabled:text-gray-400"
                  data-testid="check-pincode-btn"
                >{pincodeCheck.loading ? "..." : "Check"}</button>
              </div>
              {pincodeCheck.result && (
                <span className={`text-xs ${pincodeCheck.result.deliverable ? "text-green-600" : "text-red-500"}`} data-testid="pincode-result">
                  {pincodeCheck.result.deliverable ? `Delivery to ${pincodeCheck.result.district} (${pincodeCheck.result.estimated_days} days) | Delivery Fee: ₹${biharDistricts.delivery_fees[pincodeCheck.result.district] || 200}` : (pincodeCheck.result.note || "Not available")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{sortedProducts.length} Products</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none bg-white cursor-pointer"
                data-testid="sort-select"
              >
                {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <button
                onClick={() => setShowMobileFilters(true)}
                className="sm:hidden flex items-center gap-1.5 bg-[#0B3C5D] text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                <Filter className="w-3.5 h-3.5" /> Filter
                {selectedCategory && <span className="bg-amber-400 text-[#0B3C5D] rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">1</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === MOBILE FILTER PANEL (slide-in) === */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="relative ml-auto w-72 bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Filter className="w-4 h-4" /> Filter & Sort</h3>
              <button onClick={() => setShowMobileFilters(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Sort */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Sort By</h4>
                <div className="space-y-1">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => { setSortBy(opt.id); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${sortBy === opt.id ? "bg-amber-500 text-white" : "hover:bg-gray-100 text-gray-700"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Categories */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Category</h4>
                <div className="space-y-1">
                  <button onClick={() => { setSelectedCategory(null); fetchProducts(); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${!selectedCategory ? "bg-amber-500 text-white" : "hover:bg-gray-100 text-gray-700"}`}>
                    All Products ({products.length})
                  </button>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); fetchProducts(cat.id); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${selectedCategory === cat.id ? "bg-amber-500 text-white" : "hover:bg-gray-100 text-gray-700"}`}>
                      {categoryIcons[cat.id]} {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowMobileFilters(false)} className="w-full bg-[#0B3C5D] text-white py-2.5 rounded-xl font-semibold text-sm">
                Show {sortedProducts.length} Products
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-32"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /></div>
        ) : sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-lg shadow-sm">
            <Package className="w-20 h-20 text-gray-300 mb-4" />
            <h3 className="text-xl text-gray-500 font-medium">No products found</h3>
            <p className="text-gray-400 text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
            {sortedProducts.map(product => {
              const discount = product.sale_price ? Math.round((1 - product.sale_price / product.price) * 100) : 0;
              const isInCart = cart.some(item => item.product_id === product.id);
              const isWished = wishlist.includes(product.id);
              return (
                <div key={product.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group relative border border-gray-100/50 hover:-translate-y-1" data-testid={`product-card-${product.id}`}>
                  {/* Badges - Gold Gradient */}
                  {discount > 0 && <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">{discount}% OFF</div>}
                  
                  {/* Wishlist + Share */}
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                      className="bg-white/90 backdrop-blur-sm shadow-lg p-2 rounded-full hover:bg-white transition"
                      data-testid={`wishlist-btn-${product.id}`}
                    ><Heart className={`w-4 h-4 ${isWished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} /></button>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowShareMenu(showShareMenu === product.id ? null : product.id); }}
                        className="bg-white/90 backdrop-blur-sm shadow-lg p-2 rounded-full hover:bg-white transition" data-testid={`share-btn-${product.id}`}
                      ><Share2 className="w-4 h-4 text-gray-400" /></button>
                      {showShareMenu === product.id && (
                        <div className="absolute right-0 top-10 bg-white border shadow-2xl rounded-xl p-2 min-w-[140px] z-30">
                          {[["whatsapp","WhatsApp","text-green-600"],["facebook","Facebook","text-blue-600"],["email","Email","text-red-500"],["copy","Copy Link","text-gray-600"]].map(([key,label,color]) => (
                            <button key={key} onClick={() => shareProduct(product, key)} className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 rounded-lg ${color}`}>{label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Image */}
                  <div className="aspect-square bg-gradient-to-b from-gray-50 to-white p-4 relative cursor-pointer overflow-hidden" onClick={() => openProductDetail(product)} data-testid={`product-image-${product.id}`}>
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Sun className="w-16 h-16 text-gray-200" /></div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4 border-t border-gray-100">
                    {product.brand && <p className="text-[#0B3C5D]/60 text-[10px] uppercase tracking-wider mb-1 font-semibold">{product.brand}</p>}
                    <h3 className="text-[#0B3C5D] font-semibold text-sm line-clamp-2 mb-1.5 cursor-pointer hover:text-[#F5A623] transition leading-snug" onClick={() => openProductDetail(product)}>
                      {product.name}
                    </h3>
                    
                    {/* Rating */}
                    {reviewsSummary[product.id] && (
                      <div className="flex items-center gap-1 mb-1">
                        <StarRating rating={Math.round(reviewsSummary[product.id].avg_rating)} />
                        <span className="text-xs text-gray-500">({reviewsSummary[product.id].count})</span>
                      </div>
                    )}
                    
                    {/* Price */}
                    <div className="mb-2">
                      {product.sale_price ? (
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-lg font-bold text-gray-900">₹{product.sale_price.toLocaleString()}</span>
                          <span className="text-xs text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
                          <span className="text-xs text-green-600 font-semibold">{discount}% off</span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
                      )}
                      {product.category === "wire" && <span className="text-gray-400 text-[10px] ml-1">/meter</span>}
                    </div>

                    {/* Delivery Info */}
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2">
                      <Truck className="w-3 h-3" />
                      <span>Delivery across Bihar</span>
                    </div>

                    {/* Stock */}
                    {product.stock <= 5 && product.stock > 0 && <p className="text-red-500 text-[10px] font-semibold mb-1">Only {product.stock} left!</p>}

                    {/* Add to Cart - Green CTA */}
                    {isInCart ? (
                      <div className="flex items-center justify-between bg-[#00C389]/10 rounded-xl px-3 py-2">
                        <button onClick={() => updateCartQuantity(product.id, -1)} className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 shadow-sm"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-bold text-[#0B3C5D]">{cart.find(i => i.product_id === product.id)?.quantity}</span>
                        <button onClick={() => updateCartQuantity(product.id, 1)} className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 shadow-sm"><Plus className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(product)} disabled={product.stock === 0}
                        className={`w-full py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${product.stock === 0 ? 'bg-gray-100 text-gray-400' : addedToCart === product.id ? 'bg-[#00C389] text-white shadow-lg' : 'bg-[#00C389] hover:bg-[#00A372] text-white shadow-md hover:shadow-lg hover:shadow-[#00C389]/30'}`}
                        data-testid={`add-to-cart-${product.id}`}
                      >
                        {addedToCart === product.id ? <><CheckCircle className="w-4 h-4" /> Added</> : product.stock === 0 ? 'Out of Stock' : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recently Viewed - Glass Card */}
        {recentlyViewed.length > 0 && !selectedProduct && (
          <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 sm:p-6 border border-white/50">
            <h2 className="text-lg font-bold text-[#0B3C5D] mb-4 flex items-center gap-2 font-[Poppins]"><Clock className="w-5 h-5 text-[#F5A623]" /> Recently Viewed</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentlyViewed.map(product => (
                <div key={product.id} className="flex-shrink-0 w-36 bg-white rounded-xl border border-gray-100 cursor-pointer hover:shadow-lg transition overflow-hidden" onClick={() => openProductDetail(product)}>
                  <div className="aspect-square p-2">{product.images?.[0] ? <img src={product.images[0]} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center"><Sun className="w-8 h-8 text-gray-200" /></div>}</div>
                  <div className="p-2 border-t border-gray-50">
                    <p className="text-[#0B3C5D] text-xs line-clamp-1">{product.name}</p>
                    <p className="text-[#0B3C5D] font-bold text-sm">₹{(product.sale_price || product.price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trust Badges - Premium Cards */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Shield className="w-6 h-6 text-blue-500" />, title: "Genuine Products", sub: "100% authentic solar equipment" },
            { icon: <Truck className="w-6 h-6 text-green-500" />, title: "Bihar Delivery", sub: "All districts covered" },
            { icon: <CreditCard className="w-6 h-6 text-purple-500" />, title: "Secure Payment", sub: "UPI, Card, NetBanking" },
            { icon: <ThumbsUp className="w-6 h-6 text-amber-500" />, title: "Expert Support", sub: "MNRE registered vendor" }
          ].map((badge, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3 border border-gray-100">
              <div className="flex-shrink-0">{badge.icon}</div>
              <div><p className="text-gray-800 font-semibold text-sm">{badge.title}</p><p className="text-gray-400 text-xs">{badge.sub}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* === CART SIDEBAR === */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-sky-600 to-blue-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Cart ({cartItemCount})</h2>
              <button onClick={() => setShowCart(false)} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-16"><ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" /><p className="text-gray-400">Your cart is empty</p></div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.product_id} className="bg-gray-50 rounded-lg p-3 flex gap-3">
                      {item.image ? <img src={item.image} alt="" className="w-16 h-16 rounded object-cover border" /> : <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center"><Sun className="w-8 h-8 text-gray-300" /></div>}
                      <div className="flex-1">
                        <h4 className="text-gray-800 font-medium text-sm line-clamp-1">{item.product_name}</h4>
                        <p className="text-gray-900 font-bold">₹{item.price.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => updateCartQuantity(item.product_id, -1)} className="w-6 h-6 bg-white border rounded flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-medium">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product_id, 1)} className="w-6 h-6 bg-white border rounded flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => removeFromCart(item.product_id)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        <span className="text-gray-900 font-bold text-sm">₹{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t p-4 bg-gray-50">
                <div className="flex justify-between text-gray-800 font-bold text-lg mb-3"><span>Total</span><span>₹{cartTotal.toLocaleString()}</span></div>
                <button onClick={() => { setShowCart(false); setShowCheckout(true); }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-lg font-bold text-base transition shadow-lg shadow-amber-500/30"
                  data-testid="proceed-checkout-btn"
                >PLACE ORDER</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === CHECKOUT MODAL === */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !placingOrder && setShowCheckout(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-lg font-bold text-white">Checkout</h2>
              <button onClick={() => !placingOrder && setShowCheckout(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Customer */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Customer Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Full Name *" value={checkoutData.customer_name} onChange={(e) => setCheckoutData({...checkoutData, customer_name: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg text-gray-800 text-sm focus:border-amber-500 focus:outline-none" data-testid="checkout-name" />
                  <input type="tel" placeholder="Phone Number *" value={checkoutData.customer_phone} onChange={(e) => setCheckoutData({...checkoutData, customer_phone: e.target.value})} className="px-4 py-3 border border-gray-300 rounded-lg text-gray-800 text-sm focus:border-amber-500 focus:outline-none" data-testid="checkout-phone" />
                  <input type="email" placeholder="Email (Optional)" value={checkoutData.customer_email} onChange={(e) => setCheckoutData({...checkoutData, customer_email: e.target.value})} className="sm:col-span-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-800 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
              {/* Delivery */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Delivery</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setCheckoutData({...checkoutData, delivery_type: "pickup"})}
                    className={`p-4 rounded-lg border-2 transition text-center ${checkoutData.delivery_type === "pickup" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <Store className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-gray-800">Store Pickup</p>
                    <p className="text-xs text-green-600 font-semibold">FREE</p>
                  </button>
                  <button onClick={() => setCheckoutData({...checkoutData, delivery_type: "delivery"})}
                    className={`p-4 rounded-lg border-2 transition text-center ${checkoutData.delivery_type === "delivery" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <Truck className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-gray-800">Home Delivery</p>
                    <p className="text-xs text-gray-500">Bihar Only</p>
                  </button>
                </div>
                {checkoutData.delivery_type === "delivery" && (
                  <div className="mt-3 space-y-3">
                    <select value={checkoutData.delivery_district} onChange={(e) => setCheckoutData({...checkoutData, delivery_district: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-amber-500 focus:outline-none">
                      {biharDistricts.districts.map(d => (
                        <option key={d} value={d}>{d} - ₹{biharDistricts.delivery_fees[d] || 200} delivery</option>
                      ))}
                    </select>
                    <textarea placeholder="Full Address *" value={checkoutData.delivery_address} onChange={(e) => setCheckoutData({...checkoutData, delivery_address: e.target.value})} rows={2} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-amber-500 focus:outline-none" data-testid="checkout-address" />
                  </div>
                )}
                {checkoutData.delivery_type === "pickup" && (
                  <div className="mt-3 bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
                    <p className="text-gray-800 font-medium">Shop no 10, AMAN SKS COMPLEX</p>
                    <p className="text-gray-600">Khagaul Saguna Road, Patna 801503</p>
                    <p className="text-amber-600 text-xs mt-1">Open: 9 AM - 7 PM (Mon-Sat)</p>
                  </div>
                )}
              </div>
              {/* Payment */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Payment</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setCheckoutData({...checkoutData, payment_method: "cod"})}
                    className={`p-4 rounded-lg border-2 transition text-center ${checkoutData.payment_method === "cod" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`} data-testid="payment-cod">
                    <Banknote className="w-6 h-6 text-green-600 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-gray-800">Cash on {checkoutData.delivery_type === "pickup" ? "Store" : "Delivery"}</p>
                  </button>
                  <button onClick={() => setCheckoutData({...checkoutData, payment_method: "online"})}
                    className={`p-4 rounded-lg border-2 transition text-center ${checkoutData.payment_method === "online" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`} data-testid="payment-online">
                    <CreditCard className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-gray-800">Pay Online</p>
                    <p className="text-[10px] text-gray-500">UPI / Card / Net Banking</p>
                  </button>
                </div>
              </div>
              {/* Notes */}
              <textarea placeholder="Order Notes (Optional)" value={checkoutData.notes} onChange={(e) => setCheckoutData({...checkoutData, notes: e.target.value})} rows={2} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-amber-500 focus:outline-none" />
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h4 className="font-semibold text-gray-800 mb-2 text-sm">Order Summary</h4>
                {cart.map(item => (
                  <div key={item.product_id} className="flex justify-between text-sm text-gray-600 py-1"><span>{item.product_name} x{item.quantity}</span><span>₹{(item.price * item.quantity).toLocaleString()}</span></div>
                ))}
                <div className="border-t mt-2 pt-2 space-y-1">
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>₹{cartTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>Delivery</span><span>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t"><span>Total</span><span className="text-amber-600">₹{grandTotal.toLocaleString()}</span></div>
                </div>
              </div>
              <button onClick={handleCheckout} disabled={placingOrder}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white py-4 rounded-lg font-bold text-base transition shadow-lg flex items-center justify-center gap-2"
                data-testid="place-order-btn"
              >{placingOrder ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />} {placingOrder ? "Processing..." : `Pay ₹${grandTotal.toLocaleString()}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* === ORDER SUCCESS === */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Order Placed!</h2>
            <p className="text-gray-500 mb-4">Thank you for shopping with ASR Solar</p>
            <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
              <p className="text-amber-700 text-xs font-medium uppercase tracking-wide mb-1">Your Order Number</p>
              <p className="text-amber-600 font-extrabold text-2xl" data-testid="order-number">{orderSuccess.order_number}</p>
              <p className="text-gray-500 text-xs mt-1">Save this for tracking your order</p>
            </div>
            {orderSuccess.payment_completed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-4">
                <p className="text-green-700 text-sm font-semibold">✓ Payment Confirmed</p>
              </div>
            )}
            {orderSuccess.customer_whatsapp_url && (
              <a href={orderSuccess.customer_whatsapp_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition mb-3" data-testid="whatsapp-confirmation-btn">
                💬 Get WhatsApp Confirmation
              </a>
            )}
            <Link to="/track-order"
              className="flex items-center justify-center gap-2 w-full bg-[#0B3C5D] text-white py-3 rounded-lg font-semibold hover:bg-[#073B4C] transition mb-3 text-sm"
              data-testid="track-order-btn"
            >
              <Package className="w-4 h-4" /> Track Your Order
            </Link>
            <div className="flex gap-3">
              <Link to="/" className="flex-1 bg-gray-100 text-gray-800 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition text-sm">Home</Link>
              <button onClick={() => setOrderSuccess(null)} className="flex-1 bg-amber-500 text-white py-2.5 rounded-lg font-semibold hover:bg-amber-600 transition text-sm">Shop More</button>
            </div>
          </div>
        </div>
      )}

      {/* === PRODUCT DETAIL MODAL === */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50" data-testid="product-detail-modal">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setSelectedProduct(null); setActiveImageIndex(0); }} />
          <div className="absolute inset-2 sm:inset-4 md:inset-8 bg-white rounded-xl shadow-2xl overflow-y-auto">
            <button onClick={() => { setSelectedProduct(null); setActiveImageIndex(0); }} className="absolute top-3 right-3 z-20 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition" data-testid="close-product-detail"><X className="w-5 h-5 text-gray-600" /></button>
            
            <div className="grid md:grid-cols-2 min-h-full">
              {/* Images */}
              <div className="bg-gray-50 p-4 sm:p-8 flex flex-col sticky top-0">
                <div className="flex-1 flex items-center justify-center aspect-square bg-white rounded-lg relative overflow-hidden mb-4 border">
                  {selectedProduct.images?.length > 0 ? (
                    <>
                      <img src={selectedProduct.images[activeImageIndex]} alt={selectedProduct.name} className="max-w-full max-h-full object-contain" data-testid="product-main-image" />
                      {selectedProduct.images.length > 1 && (
                        <>
                          <button onClick={() => setActiveImageIndex(p => p === 0 ? selectedProduct.images.length - 1 : p - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white shadow-lg p-2 rounded-full hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
                          <button onClick={() => setActiveImageIndex(p => p === selectedProduct.images.length - 1 ? 0 : p + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white shadow-lg p-2 rounded-full hover:bg-gray-50"><ChevronRight className="w-5 h-5" /></button>
                        </>
                      )}
                    </>
                  ) : <Sun className="w-32 h-32 text-gray-200" />}
                </div>
                {selectedProduct.images?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {selectedProduct.images.map((img, idx) => (
                      <button key={idx} onClick={() => setActiveImageIndex(idx)} className={`flex-shrink-0 w-14 h-14 rounded border-2 overflow-hidden ${activeImageIndex === idx ? 'border-amber-500' : 'border-gray-200'}`}>
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-4 sm:p-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">{categoryIcons[selectedProduct.category]}{getCategoryName(selectedProduct.category)}</span>
                  {selectedProduct.is_featured && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Star className="w-3 h-3" />Featured</span>}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2" data-testid="product-detail-name">{selectedProduct.name}</h1>

                {/* Rating in detail */}
                {reviewsSummary[selectedProduct.id] && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                      {reviewsSummary[selectedProduct.id].avg_rating} <Star className="w-3 h-3 fill-white" />
                    </div>
                    <span className="text-sm text-gray-500">{reviewsSummary[selectedProduct.id].count} Rating{reviewsSummary[selectedProduct.id].count !== 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* Price */}
                <div className="mb-4 pb-4 border-b">
                  {selectedProduct.sale_price ? (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl sm:text-3xl font-bold text-gray-900">₹{selectedProduct.sale_price.toLocaleString()}</span>
                      <span className="text-lg text-gray-400 line-through">₹{selectedProduct.price.toLocaleString()}</span>
                      <span className="text-green-600 font-bold text-sm">{Math.round((1 - selectedProduct.sale_price / selectedProduct.price) * 100)}% off</span>
                    </div>
                  ) : <span className="text-2xl sm:text-3xl font-bold text-gray-900">₹{selectedProduct.price.toLocaleString()}</span>}
                  {selectedProduct.category === "wire" && <p className="text-gray-500 text-sm mt-1">Price per meter</p>}
                </div>

                {/* Availability */}
                <div className="flex items-center gap-3 mb-4">
                  {selectedProduct.stock > 0 ? <span className="text-green-600 font-semibold text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" />In Stock</span> : <span className="text-red-500 font-semibold text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />Out of Stock</span>}
                  {selectedProduct.warranty && <span className="text-sm text-gray-600 flex items-center gap-1"><Shield className="w-4 h-4 text-blue-500" />{selectedProduct.warranty} Warranty</span>}
                </div>

                {/* Description */}
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">Description</h3>
                  <p className="text-gray-600 text-sm leading-relaxed" data-testid="product-detail-description">{selectedProduct.description || "No description available."}</p>
                </div>

                {/* Delivery Check */}
                <div className="bg-gray-50 rounded-lg p-4 border mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-1"><Truck className="w-4 h-4 text-blue-500" />Check Delivery</h3>
                  <div className="flex gap-2">
                    <input type="text" maxLength={6} placeholder="Enter Pincode"
                      value={productPincode.pincode} onChange={(e) => setProductPincode({ pincode: e.target.value.replace(/\D/g, ""), result: null, loading: false })}
                      onKeyDown={(e) => e.key === "Enter" && checkProductPincode(selectedProduct.id)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:border-amber-500 focus:outline-none" />
                    <button onClick={() => checkProductPincode(selectedProduct.id)} disabled={productPincode.loading || productPincode.pincode.length !== 6}
                      className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white px-4 py-2 rounded text-sm font-semibold transition">
                      {productPincode.loading ? "..." : "Check"}
                    </button>
                  </div>
                  {productPincode.result && (
                    <div className={`mt-2 text-sm ${productPincode.result.deliverable ? "text-green-600" : "text-red-500"}`}>
                      {productPincode.result.deliverable 
                        ? <span>Delivery to <strong>{productPincode.result.district}</strong> | Delivery Fee: <strong>₹{productPincode.result.fee}</strong> | Est: {productPincode.result.estimated_days} days</span>
                        : <span>{productPincode.result.note}</span>}
                    </div>
                  )}
                </div>

                {/* Share */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-500">Share:</span>
                  {[["whatsapp","bg-green-50 text-green-600 hover:bg-green-100"],["facebook","bg-blue-50 text-blue-600 hover:bg-blue-100"],["email","bg-red-50 text-red-500 hover:bg-red-100"],["copy","bg-gray-50 text-gray-600 hover:bg-gray-100"]].map(([key,cls]) => (
                    <button key={key} onClick={() => shareProduct(selectedProduct, key)} className={`p-2 rounded-lg transition ${cls}`} data-testid={key === "whatsapp" ? "share-whatsapp" : undefined}>
                      {key === "whatsapp" ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                        : key === "facebook" ? <Facebook className="w-4 h-4" />
                        : key === "email" ? <Mail className="w-4 h-4" />
                        : <Copy className="w-4 h-4" />}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 mb-6">
                  <button onClick={() => { addToCart(selectedProduct); }} disabled={selectedProduct.stock === 0}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white py-3.5 rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-lg"
                    data-testid="modal-add-to-cart"
                  ><ShoppingCart className="w-5 h-5" />ADD TO CART</button>
                  <button onClick={() => toggleWishlist(selectedProduct.id)}
                    className={`px-4 py-3.5 rounded-lg border-2 transition ${wishlist.includes(selectedProduct.id) ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Heart className={`w-5 h-5 ${wishlist.includes(selectedProduct.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                {/* Services */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { icon: <Truck className="w-4 h-4 text-blue-500" />, text: "Bihar Delivery", sub: "All districts" },
                    { icon: <Shield className="w-4 h-4 text-green-500" />, text: "Quality Assured", sub: "Genuine products" },
                    { icon: <CreditCard className="w-4 h-4 text-purple-500" />, text: "Secure Payment", sub: "UPI/Card/COD" },
                    { icon: <Store className="w-4 h-4 text-amber-500" />, text: "Free Pickup", sub: "Patna store" }
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border"><div>{s.icon}</div><div><p className="text-xs font-semibold text-gray-700">{s.text}</p><p className="text-[10px] text-gray-400">{s.sub}</p></div></div>
                  ))}
                </div>

                {/* Customer Reviews */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm">Customer Reviews</h3>
                    <button onClick={() => setShowReviewForm(!showReviewForm)}
                      className="text-amber-600 hover:text-amber-700 text-sm font-semibold" data-testid="write-review-btn"
                    >{showReviewForm ? "Cancel" : "Write a Review"}</button>
                  </div>

                  {/* Review Summary */}
                  {reviewsSummary[selectedProduct.id] && (
                    <div className="flex items-center gap-3 mb-3 bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{reviewsSummary[selectedProduct.id].avg_rating}</p>
                        <StarRating rating={Math.round(reviewsSummary[selectedProduct.id].avg_rating)} size="w-4 h-4" />
                      </div>
                      <p className="text-sm text-gray-600">{reviewsSummary[selectedProduct.id].count} review{reviewsSummary[selectedProduct.id].count !== 1 ? "s" : ""}</p>
                    </div>
                  )}

                  {/* Review Form */}
                  {showReviewForm && (
                    <div className="bg-gray-50 rounded-lg p-4 border mb-4" data-testid="review-form">
                      <h4 className="font-semibold text-gray-800 text-sm mb-3">Write Your Review</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-600 text-xs mb-1 block">Rating</label>
                          <StarRating rating={reviewForm.rating} size="w-6 h-6" interactive={true} onChange={(r) => setReviewForm({...reviewForm, rating: r})} />
                        </div>
                        <input type="text" placeholder="Your Name *" value={reviewForm.customer_name} onChange={(e) => setReviewForm({...reviewForm, customer_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-amber-500 focus:outline-none" data-testid="review-name" />
                        <input type="text" placeholder="Review Title (Optional)" value={reviewForm.title} onChange={(e) => setReviewForm({...reviewForm, title: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-amber-500 focus:outline-none" />
                        <textarea placeholder="Your Review *" value={reviewForm.review_text} onChange={(e) => setReviewForm({...reviewForm, review_text: e.target.value})} rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-amber-500 focus:outline-none" data-testid="review-text" />
                        <button onClick={() => submitReview(selectedProduct.id)} disabled={submittingReview}
                          className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-6 py-2 rounded text-sm font-semibold transition"
                          data-testid="submit-review-btn"
                        >{submittingReview ? "Submitting..." : "Submit Review"}</button>
                      </div>
                    </div>
                  )}

                  {/* Reviews List */}
                  {productReviews.length > 0 ? (
                    <div className="space-y-3">
                      {productReviews.slice(0, 5).map(review => (
                        <div key={review.id} className="bg-gray-50 rounded-lg p-3 border">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xs">{review.customer_name[0]?.toUpperCase()}</div>
                              <span className="text-sm font-semibold text-gray-800">{review.customer_name}</span>
                            </div>
                            <StarRating rating={review.rating} />
                          </div>
                          {review.title && <p className="font-semibold text-gray-800 text-sm mb-1">{review.title}</p>}
                          <p className="text-gray-600 text-sm">{review.review_text}</p>
                          <p className="text-gray-400 text-xs mt-1">{new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                      ))}
                    </div>
                  ) : !showReviewForm && (
                    <p className="text-gray-400 text-sm">No reviews yet. Be the first to review!</p>
                  )}
                </div>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-800 text-sm mb-3">Similar Products</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {relatedProducts.map(rp => (
                        <div key={rp.id} className="bg-gray-50 rounded-lg overflow-hidden border cursor-pointer hover:shadow-md transition" onClick={() => { setSelectedProduct(rp); setActiveImageIndex(0); setProductPincode({ pincode: "", result: null, loading: false }); }}>
                          <div className="aspect-square p-2 bg-white">{rp.images?.[0] ? <img src={rp.images[0]} alt="" className="w-full h-full object-contain" /> : <Sun className="w-8 h-8 text-gray-200 mx-auto" />}</div>
                          <div className="p-2"><p className="text-xs text-gray-700 line-clamp-1">{rp.name}</p><p className="font-bold text-sm text-gray-900">₹{(rp.sale_price || rp.price).toLocaleString()}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
