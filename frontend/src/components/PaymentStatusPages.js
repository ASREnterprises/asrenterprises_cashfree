import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, MessageCircle, Phone, ArrowLeft, ExternalLink, RefreshCw, Home, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';
const API_BASE = `${API}/api`;  // API routes require /api prefix
const ASR_SUPPORT_PHONE = "9296389097";
const ASR_WHATSAPP_PHONE = "8298389097";
const ASR_SUPPORT_EMAIL = "support@asrenterprises.in";
const ASR_WEBSITE = "https://asrenterprises.in";

// Payment Success Page
export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cashfree/order/${orderId}`);
      setOrderDetails(res.data);
    } catch (err) {
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hi ASR Enterprises! I just completed a payment. Order ID: ${orderId || 'N/A'}. Please confirm.`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Payment Successful!</h1>
          <p className="text-green-100">Thank you for choosing ASR Enterprises</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-500" />
            </div>
          ) : (
            <>
              {/* Order Details Card */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-semibold text-green-800 mb-3">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  {orderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-mono font-semibold text-gray-800">{orderId}</span>
                    </div>
                  )}
                  {orderDetails?.amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount Paid:</span>
                      <span className="font-bold text-green-600">₹{orderDetails.amount.toLocaleString()}</span>
                    </div>
                  )}
                  {orderDetails?.purpose && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Purpose:</span>
                      <span className="font-medium text-gray-800">{orderDetails.purpose}</span>
                    </div>
                  )}
                  {orderDetails?.customer_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium text-gray-800">{orderDetails.customer_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">What's Next?</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Our team will contact you within 24 hours</li>
                  <li>• You'll receive a confirmation on WhatsApp</li>
                  <li>• Keep this order ID for reference</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <a
                  href={`https://wa.me/91${ASR_WHATSAPP_PHONE}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat on WhatsApp
                </a>
                
                <a
                  href={`tel:${ASR_SUPPORT_PHONE}`}
                  className="w-full flex items-center justify-center gap-2 bg-[#0a355e] hover:bg-[#071f38] text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg"
                >
                  <Phone className="w-5 h-5" />
                  Call: {ASR_SUPPORT_PHONE}
                </a>

                <Link
                  to="/"
                  className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-3 px-4 rounded-xl font-semibold transition"
                >
                  <Home className="w-5 h-5" />
                  Back to Home
                </Link>
              </div>
            </>
          )}

          {/* Support Info */}
          <div className="text-center text-sm text-gray-500 pt-4 border-t">
            <p>Need help? Contact us at</p>
            <p className="font-medium">{ASR_SUPPORT_EMAIL}</p>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="bg-gray-50 p-4 text-center border-t">
          <p className="text-xs text-gray-500">
            Powered by <span className="font-semibold text-[#0a355e]">ASR Enterprises</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Bihar's #1 Solar Company</p>
        </div>
      </div>
    </div>
  );
};

// Payment Failed Page
export const PaymentFailed = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const reason = searchParams.get('reason') || 'Payment could not be completed';
  const [retrying, setRetrying] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cashfree/order/${orderId}`);
      setOrderDetails(res.data);
    } catch (err) {
      console.error('Error fetching order:', err);
    }
  };

  const handleRetry = async () => {
    if (!orderDetails?.payment_url) {
      alert('Cannot retry. Please create a new payment.');
      return;
    }
    setRetrying(true);
    // Redirect to payment URL
    window.location.href = orderDetails.payment_url;
  };

  const whatsappMessage = encodeURIComponent(
    `Hi ASR Enterprises! I had an issue with my payment. Order ID: ${orderId || 'N/A'}. Error: ${reason}. Please help.`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-6 text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Payment Failed</h1>
          <p className="text-red-100">Don't worry, you can try again</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Details */}
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <h3 className="font-semibold text-red-800 mb-2">What Happened?</h3>
            <p className="text-sm text-red-700">{reason}</p>
            {orderId && (
              <p className="text-xs text-red-500 mt-2 font-mono">Order ID: {orderId}</p>
            )}
          </div>

          {/* Tips */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-2">Try These:</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Check your bank/card balance</li>
              <li>• Use a different payment method</li>
              <li>• Check your internet connection</li>
              <li>• Contact your bank if issue persists</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {orderDetails?.payment_url && orderDetails?.status !== 'paid' && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg disabled:opacity-50"
              >
                {retrying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                Try Again
              </button>
            )}

            <a
              href={`https://wa.me/91${ASR_WHATSAPP_PHONE}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg"
            >
              <MessageCircle className="w-5 h-5" />
              Get Help on WhatsApp
            </a>

            <a
              href={`tel:${ASR_SUPPORT_PHONE}`}
              className="w-full flex items-center justify-center gap-2 bg-[#0a355e] hover:bg-[#071f38] text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg"
            >
              <Phone className="w-5 h-5" />
              Call Support: {ASR_SUPPORT_PHONE}
            </a>

            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-3 px-4 rounded-xl font-semibold transition"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </Link>
          </div>

          {/* Support */}
          <div className="text-center text-sm text-gray-500 pt-4 border-t">
            <p>No amount was deducted from your account</p>
            <p className="text-xs text-gray-400 mt-1">If deducted, it will be refunded in 5-7 business days</p>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="bg-gray-50 p-4 text-center border-t">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-[#0a355e]">ASR Enterprises</span> | {ASR_SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </div>
  );
};

// Payment Pending Page
export const PaymentPending = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const [orderDetails, setOrderDetails] = useState(null);
  const [checking, setChecking] = useState(false);
  const [autoCheckCount, setAutoCheckCount] = useState(0);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  // Auto-check status periodically
  useEffect(() => {
    if (orderId && autoCheckCount < 5) {
      const interval = setInterval(() => {
        checkStatus();
        setAutoCheckCount(prev => prev + 1);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [orderId, autoCheckCount]);

  const fetchOrderDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cashfree/order/${orderId}`);
      setOrderDetails(res.data);
      if (res.data.paid) {
        navigate(`/payment/success?order_id=${orderId}`);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
    }
  };

  const checkStatus = async () => {
    if (!orderId || checking) return;
    setChecking(true);
    try {
      const res = await axios.get(`${API_BASE}/cashfree/order/${orderId}/refresh`);
      if (res.data.paid) {
        navigate(`/payment/success?order_id=${orderId}`);
      } else if (res.data.status === 'failed') {
        navigate(`/payment/failed?order_id=${orderId}`);
      } else {
        setOrderDetails(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Error checking status:', err);
    } finally {
      setChecking(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hi ASR Enterprises! I made a payment but it's showing as pending. Order ID: ${orderId || 'N/A'}. Please check.`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
            <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Payment Processing</h1>
          <p className="text-amber-100">Please wait while we confirm your payment</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Card */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-amber-800">Verifying Payment</span>
            </div>
            <p className="text-sm text-amber-700">This may take a few moments</p>
            {orderId && (
              <p className="text-xs text-amber-500 mt-2 font-mono">Order: {orderId}</p>
            )}
            {orderDetails?.amount && (
              <p className="text-lg font-bold text-amber-800 mt-2">₹{orderDetails.amount.toLocaleString()}</p>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">Please Note</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Do not close this page or press back</li>
              <li>• Do not make duplicate payments</li>
              <li>• Status will update automatically</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg disabled:opacity-50"
            >
              {checking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Check Status
                </>
              )}
            </button>

            <a
              href={`https://wa.me/91${ASR_WHATSAPP_PHONE}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 px-4 rounded-xl font-semibold transition shadow-lg"
            >
              <MessageCircle className="w-5 h-5" />
              Contact Support
            </a>

            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-3 px-4 rounded-xl font-semibold transition"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </Link>
          </div>

          {/* Auto-check status */}
          {autoCheckCount < 5 && (
            <div className="text-center text-xs text-gray-400">
              Auto-checking status... ({autoCheckCount}/5)
            </div>
          )}
        </div>

        {/* Brand Footer */}
        <div className="bg-gray-50 p-4 text-center border-t">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-[#0a355e]">ASR Enterprises</span> | Support: {ASR_SUPPORT_PHONE}
          </p>
        </div>
      </div>
    </div>
  );
};

// Payment Status Page (Generic - redirects based on status)
export const PaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      checkAndRedirect();
    } else {
      navigate('/');
    }
  }, [orderId]);

  const checkAndRedirect = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cashfree/order/${orderId}/refresh`);
      const status = res.data.status;
      
      if (res.data.paid || status === 'paid') {
        navigate(`/payment/success?order_id=${orderId}`, { replace: true });
      } else if (status === 'failed') {
        navigate(`/payment/failed?order_id=${orderId}`, { replace: true });
      } else if (status === 'expired') {
        navigate(`/payment/failed?order_id=${orderId}&reason=Payment link expired`, { replace: true });
      } else {
        navigate(`/payment/pending?order_id=${orderId}`, { replace: true });
      }
    } catch (err) {
      console.error('Error checking status:', err);
      navigate(`/payment/pending?order_id=${orderId}`, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#0a355e] mx-auto mb-4" />
        <p className="text-gray-600">Checking payment status...</p>
        <p className="text-sm text-gray-400 mt-2">Please wait</p>
      </div>
    </div>
  );
};

export default PaymentStatus;
