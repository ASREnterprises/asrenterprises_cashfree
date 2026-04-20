import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  Package, Search, ChevronRight, Loader2, CheckCircle, Clock, Truck, 
  XCircle, MapPin, Phone, CreditCard, AlertCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusSteps = ["pending", "confirmed", "processing", "ready", "delivered"];
const statusLabels = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled"
};
const statusIcons = {
  pending: Clock,
  confirmed: CheckCircle,
  processing: Package,
  ready: Truck,
  delivered: CheckCircle,
  cancelled: XCircle
};

export const OrderTrackingPage = () => {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trackOrder = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) {
      setError("Please enter both order number and phone number");
      return;
    }
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const res = await axios.post(`${API}/shop/track-order`, {
        order_number: orderNumber.trim(),
        phone: phone.trim()
      });
      setOrder(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Order not found. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = order ? statusSteps.indexOf(order.order_status) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1b33] to-[#0a1628]">
      {/* Header */}
      <div className="bg-[#0a1628]/90 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/shop" className="inline-flex items-center text-amber-400 hover:text-amber-300 transition">
              <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
              <span>Back to Shop</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Track Your Order</h1>
          <p className="text-gray-400">Enter your order number and phone number to check status</p>
        </div>

        {/* Search Form */}
        <form onSubmit={trackOrder} className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-8">
          <div className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Order Number</label>
              <input
                type="text"
                placeholder="e.g., ASR-20260222-001"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                data-testid="track-order-number"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Phone Number</label>
              <input
                type="tel"
                placeholder="Phone number used during order"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                data-testid="track-phone"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 transition flex items-center justify-center gap-2"
              data-testid="track-submit-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span>{loading ? "Searching..." : "Track Order"}</span>
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-6 flex items-center gap-3" data-testid="track-error">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Order Details */}
        {order && (
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden" data-testid="order-details">
            {/* Order Header */}
            <div className="bg-gray-800/80 p-6 border-b border-gray-700">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Order Number</p>
                  <p className="text-amber-400 font-bold text-xl">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Total Amount</p>
                  <p className="text-white font-bold text-xl">₹{order.total?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="p-6">
              {order.order_status === "cancelled" ? (
                <div className="flex items-center justify-center gap-3 py-4">
                  <XCircle className="w-8 h-8 text-red-400" />
                  <span className="text-red-400 font-semibold text-lg">Order Cancelled</span>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-8 relative">
                  <div className="absolute top-5 left-0 right-0 h-1 bg-gray-700 rounded" />
                  <div className="absolute top-5 left-0 h-1 bg-amber-500 rounded transition-all" style={{ width: `${Math.max(0, currentStepIndex) / (statusSteps.length - 1) * 100}%` }} />
                  {statusSteps.map((step, idx) => {
                    const Icon = statusIcons[step];
                    const isActive = idx <= currentStepIndex;
                    return (
                      <div key={step} className="relative z-10 flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs mt-2 ${isActive ? 'text-amber-400' : 'text-gray-500'}`}>{statusLabels[step]}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Customer</p>
                  <p className="text-white font-medium">{order.customer_name}</p>
                  <p className="text-gray-300 text-sm flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{order.customer_phone}</p>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Payment</p>
                  <p className="text-white font-medium capitalize">{order.payment_method === "razorpay" ? "Online Payment" : "Cash on Delivery"}</p>
                  <p className={`text-sm mt-1 ${order.payment_status === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Delivery</p>
                  <p className="text-white font-medium capitalize">{order.delivery_type === "pickup" ? "Store Pickup" : "Home Delivery"}</p>
                  {order.delivery_address && <p className="text-gray-300 text-sm mt-1 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />{order.delivery_address}</p>}
                </div>
                <div className="bg-gray-900/50 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Order Date</p>
                  <p className="text-white font-medium">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Items */}
              <div className="mt-6">
                <h3 className="text-white font-semibold mb-3">Items Ordered</h3>
                <div className="space-y-2">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-white text-sm">{item.product_name}</p>
                          <p className="text-gray-400 text-xs">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="text-amber-400 font-semibold">₹{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
