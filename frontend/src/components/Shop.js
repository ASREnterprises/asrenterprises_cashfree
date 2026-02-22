import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  ShoppingCart, ChevronRight, Sun, Zap, Battery, Settings, Wrench,
  Plus, Minus, X, MapPin, CreditCard, Banknote, Truck, Store,
  Package, CheckCircle, AlertCircle, Loader2, Search, Filter
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Razorpay Payment Link (using existing)
const RAZORPAY_PAYMENT_LINK = "https://razorpay.me/@asrenterprises9465";

const categoryIcons = {
  solar_panel: <Sun className="w-5 h-5" />,
  inverter: <Zap className="w-5 h-5" />,
  battery: <Battery className="w-5 h-5" />,
  accessory: <Settings className="w-5 h-5" />,
  service: <Wrench className="w-5 h-5" />
};

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
  
  const [checkoutData, setCheckoutData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_type: "pickup", // pickup or delivery
    delivery_address: "",
    payment_method: "cod", // cod or razorpay
    notes: ""
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // Load cart from localStorage
    const savedCart = localStorage.getItem("asr_cart");
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  useEffect(() => {
    // Save cart to localStorage
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

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        price: product.sale_price || product.price,
        quantity: 1,
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryCharge = checkoutData.delivery_type === "delivery" ? 100 : 0;
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
      
      if (checkoutData.payment_method === "razorpay") {
        // Open Razorpay payment link
        window.open(`${RAZORPAY_PAYMENT_LINK}?amount=${grandTotal}`, "_blank");
      }

      // Send order confirmation to customer via WhatsApp
      if (res.data.customer_whatsapp_url) {
        // Open WhatsApp with pre-filled confirmation message for customer
        window.open(res.data.customer_whatsapp_url, "_blank");
      }

      setOrderSuccess(res.data);
      setCart([]);
      localStorage.removeItem("asr_cart");
      setShowCheckout(false);
    } catch (err) {
      console.error("Order error:", err);
      alert("Failed to place order. Please try again.");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            
            {/* Cart Button */}
            <button 
              onClick={() => setShowCart(true)}
              className="relative bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition"
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

      {/* Hero */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ASR <span className="text-amber-400">Solar Shop</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Quality solar products delivered to your doorstep in Patna or pick up from our store
          </p>
          
          {/* Delivery Notice */}
          <div className="mt-6 inline-flex items-center bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg border border-blue-500/30">
            <MapPin className="w-5 h-5 mr-2" />
            <span>Delivery available in <strong>Patna District</strong> only | Store Pickup Available</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => { setSelectedCategory(null); fetchProducts(); }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                !selectedCategory ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); fetchProducts(cat.id); }}
                className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center space-x-2 transition ${
                  selectedCategory === cat.id ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {categoryIcons[cat.id]}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400">No products found</h3>
            <p className="text-gray-500 mt-2">Check back later for new products</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-amber-500/50 transition group">
                {/* Product Image */}
                <div className="aspect-square bg-gray-900 relative overflow-hidden">
                  {product.images?.[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sun className="w-20 h-20 text-gray-700" />
                    </div>
                  )}
                  {product.is_featured && (
                    <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">Featured</span>
                  )}
                  {product.sale_price && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">Sale</span>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg mb-1 line-clamp-2">{product.name}</h3>
                  {product.brand && (
                    <p className="text-gray-400 text-sm mb-2">{product.brand}</p>
                  )}
                  <p className="text-gray-400 text-sm line-clamp-2 mb-3">{product.short_description || product.description}</p>
                  
                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {product.sale_price ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl font-bold text-amber-400">₹{product.sale_price.toLocaleString()}</span>
                          <span className="text-gray-500 line-through text-sm">₹{product.price.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-amber-400">₹{product.price.toLocaleString()}</span>
                      )}
                    </div>
                    {product.stock > 0 ? (
                      <span className="text-green-400 text-xs">In Stock</span>
                    ) : (
                      <span className="text-red-400 text-xs">Out of Stock</span>
                    )}
                  </div>
                  
                  {/* Add to Cart Button */}
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ))}
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
                <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
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
                          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                            <Sun className="w-8 h-8 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="text-white font-medium line-clamp-1">{item.product_name}</h4>
                          <p className="text-amber-400 font-semibold">₹{item.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => updateCartQuantity(item.product_id, -1)}
                            className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-white hover:bg-gray-600"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-white w-8 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.product_id, 1)}
                            className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-white hover:bg-gray-600"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex justify-between text-gray-300 mb-2">
                      <span>Subtotal</span>
                      <span>₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => { setShowCart(false); setShowCheckout(true); }}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition"
                    >
                      Proceed to Checkout
                    </button>
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
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Checkout</h2>
                <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Customer Details */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Customer Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={checkoutData.customer_name}
                      onChange={(e) => setCheckoutData({...checkoutData, customer_name: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number *"
                      value={checkoutData.customer_phone}
                      onChange={(e) => setCheckoutData({...checkoutData, customer_phone: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Email (Optional)"
                      value={checkoutData.customer_email}
                      onChange={(e) => setCheckoutData({...checkoutData, customer_email: e.target.value})}
                      className="w-full md:col-span-2 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Delivery Options */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Delivery Option</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setCheckoutData({...checkoutData, delivery_type: "pickup"})}
                      className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${
                        checkoutData.delivery_type === "pickup" 
                          ? "border-amber-500 bg-amber-500/20" 
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <Store className="w-8 h-8 text-amber-400" />
                      <span className="text-white font-semibold">Store Pickup</span>
                      <span className="text-green-400 text-sm">FREE</span>
                    </button>
                    <button
                      onClick={() => setCheckoutData({...checkoutData, delivery_type: "delivery"})}
                      className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${
                        checkoutData.delivery_type === "delivery" 
                          ? "border-amber-500 bg-amber-500/20" 
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <Truck className="w-8 h-8 text-blue-400" />
                      <span className="text-white font-semibold">Home Delivery</span>
                      <span className="text-amber-400 text-sm">₹100 (Patna Only)</span>
                    </button>
                  </div>

                  {checkoutData.delivery_type === "delivery" && (
                    <div className="mt-4">
                      <textarea
                        placeholder="Delivery Address in Patna District *"
                        value={checkoutData.delivery_address}
                        onChange={(e) => setCheckoutData({...checkoutData, delivery_address: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                      />
                      <p className="text-yellow-400 text-sm mt-2 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Delivery available only in Patna District
                      </p>
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
                    <button
                      onClick={() => setCheckoutData({...checkoutData, payment_method: "cod"})}
                      className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${
                        checkoutData.payment_method === "cod" 
                          ? "border-amber-500 bg-amber-500/20" 
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <Banknote className="w-8 h-8 text-green-400" />
                      <span className="text-white font-semibold">Cash on {checkoutData.delivery_type === "pickup" ? "Store" : "Delivery"}</span>
                    </button>
                    <button
                      onClick={() => setCheckoutData({...checkoutData, payment_method: "razorpay"})}
                      className={`p-4 rounded-xl border-2 transition flex flex-col items-center space-y-2 ${
                        checkoutData.payment_method === "razorpay" 
                          ? "border-amber-500 bg-amber-500/20" 
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <CreditCard className="w-8 h-8 text-blue-400" />
                      <span className="text-white font-semibold">Pay Online</span>
                      <span className="text-gray-400 text-xs">UPI / Card / NetBanking</span>
                    </button>
                  </div>
                </div>

                {/* Order Notes */}
                <div>
                  <textarea
                    placeholder="Order Notes (Optional)"
                    value={checkoutData.notes}
                    onChange={(e) => setCheckoutData({...checkoutData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                  />
                </div>

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
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-600 transition flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-6 h-6" />
                  <span>Place Order - ₹{grandTotal.toLocaleString()}</span>
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
            
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
              <p className="text-gray-400 text-sm">Order Number</p>
              <p className="text-amber-400 font-bold text-xl">{orderSuccess.order_number}</p>
            </div>

            {checkoutData.payment_method === "razorpay" && (
              <p className="text-yellow-400 text-sm mb-4">
                Please complete your payment on the Razorpay page that opened.
              </p>
            )}

            <div className="flex gap-4">
              <Link 
                to="/"
                className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition"
              >
                Go Home
              </Link>
              <button
                onClick={() => setOrderSuccess(null)}
                className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
