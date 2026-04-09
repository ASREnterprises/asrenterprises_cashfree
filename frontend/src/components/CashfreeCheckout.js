import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, Shield, AlertCircle, Phone, MessageCircle } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ASR_SUPPORT_PHONE = "9296389097";
const ASR_WHATSAPP_PHONE = "8298389097";

// Load Cashfree SDK
const loadCashfreeSDK = () => {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        reject(new Error('Cashfree SDK failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.body.appendChild(script);
  });
};

const CashfreeCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');
  
  useEffect(() => {
    if (sessionId) {
      initializeCheckout();
    } else if (orderId) {
      fetchOrderAndInitialize();
    } else {
      setError('No payment session or order ID provided');
      setLoading(false);
    }
  }, [sessionId, orderId]);
  
  const fetchOrderAndInitialize = async () => {
    try {
      const res = await axios.get(`${API}/cashfree/order/${orderId}`);
      if (res.data.payment_session_id) {
        setOrderDetails(res.data);
        await initializeCheckoutWithSession(res.data.payment_session_id);
      } else {
        setError('Payment session not found for this order');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Unable to load payment details');
    }
    setLoading(false);
  };
  
  const initializeCheckout = async () => {
    await initializeCheckoutWithSession(sessionId);
  };
  
  const initializeCheckoutWithSession = async (paymentSessionId) => {
    try {
      // Load Cashfree SDK
      const Cashfree = await loadCashfreeSDK();
      
      // Initialize Cashfree in PRODUCTION mode
      const cashfree = Cashfree({
        mode: "production"  // IMPORTANT: Production mode
      });
      
      setLoading(false);
      
      // Auto-redirect to payment page
      setProcessingPayment(true);
      
      // Use redirect checkout
      cashfree.checkout({
        paymentSessionId: paymentSessionId,
        redirectTarget: "_self"  // Redirect in same tab
      });
      
    } catch (err) {
      console.error('Cashfree SDK error:', err);
      setError(`Payment initialization failed: ${err.message}`);
      setLoading(false);
    }
  };
  
  const handleManualPay = async () => {
    const paymentSessionId = sessionId || orderDetails?.payment_session_id;
    if (!paymentSessionId) {
      setError('No payment session available');
      return;
    }
    
    setProcessingPayment(true);
    
    try {
      const Cashfree = await loadCashfreeSDK();
      const cashfree = Cashfree({ mode: "production" });
      
      cashfree.checkout({
        paymentSessionId: paymentSessionId,
        redirectTarget: "_self"
      });
    } catch (err) {
      console.error('Payment error:', err);
      setError(`Payment failed: ${err.message}`);
      setProcessingPayment(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-4 shadow-xl">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Initializing Secure Payment</h2>
          <p className="text-gray-600">Please wait while we connect to the payment gateway...</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Secured by Cashfree Payments</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Payment Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          
          <div className="space-y-3">
            <button
              onClick={handleManualPay}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Try Again
            </button>
            
            <a
              href={`https://wa.me/91${ASR_WHATSAPP_PHONE}?text=Hi, I'm having trouble with my payment. Order: ${orderId || 'N/A'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Get Help on WhatsApp
            </a>
            
            <a
              href={`tel:${ASR_SUPPORT_PHONE}`}
              className="w-full py-3 px-4 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              <Phone className="w-5 h-5" />
              Call: {ASR_SUPPORT_PHONE}
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl">
          {processingPayment ? (
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          ) : (
            <CreditCard className="w-10 h-10 text-white" />
          )}
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {processingPayment ? 'Redirecting to Payment...' : 'Secure Payment'}
        </h2>
        
        <p className="text-gray-600 mb-6">
          {processingPayment 
            ? 'Please wait while we redirect you to the secure payment page...'
            : 'Click the button below to complete your payment securely'}
        </p>
        
        {orderDetails && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Amount:</span>
              <span className="font-bold text-blue-600">₹{orderDetails.amount?.toLocaleString()}</span>
            </div>
            {orderDetails.purpose && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Purpose:</span>
                <span className="font-medium text-gray-800">{orderDetails.purpose}</span>
              </div>
            )}
          </div>
        )}
        
        {!processingPayment && (
          <button
            onClick={handleManualPay}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg transition shadow-lg flex items-center justify-center gap-2"
          >
            <CreditCard className="w-6 h-6" />
            Pay Now Securely
          </button>
        )}
        
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4 text-green-500" />
          <span>256-bit SSL Encrypted • Secured by Cashfree</span>
        </div>
        
        {/* Payment Method Logos */}
        <div className="mt-4 flex items-center justify-center gap-3 opacity-60">
          <img src="https://www.cashfree.com/images/pg/upi-icon.svg" alt="UPI" className="h-6" />
          <img src="https://www.cashfree.com/images/pg/visa-icon.svg" alt="Visa" className="h-6" />
          <img src="https://www.cashfree.com/images/pg/mastercard-icon.svg" alt="Mastercard" className="h-6" />
          <img src="https://www.cashfree.com/images/pg/rupay-icon.svg" alt="RuPay" className="h-6" />
        </div>
      </div>
    </div>
  );
};

export default CashfreeCheckout;
