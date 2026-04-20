import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, Shield, AlertCircle, Phone, MessageCircle } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';
const API_BASE = `${API}/api`;  // API routes require /api prefix
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
  
  // Extract session_id from URL params - try multiple methods for reliability
  const sessionIdFromRouter = searchParams.get('session_id');
  const orderIdFromRouter = searchParams.get('order_id');
  
  // BACKUP: Also parse directly from window.location to ensure we get the value
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdDirect = urlParams.get('session_id');
  const orderIdDirect = urlParams.get('order_id');
  
  // Use the value that exists (prefer direct parsing as it's more reliable)
  const sessionId = sessionIdDirect || sessionIdFromRouter;
  const orderId = orderIdDirect || orderIdFromRouter;
  
  // DEBUG: Log all URL parameters on mount
  console.log('=== CASHFREE CHECKOUT PAGE LOADED ===');
  console.log('Full URL:', window.location.href);
  console.log('window.location.search:', window.location.search);
  console.log('');
  console.log('--- Router parsing ---');
  console.log('session_id (router):', sessionIdFromRouter);
  console.log('order_id (router):', orderIdFromRouter);
  console.log('');
  console.log('--- Direct parsing ---');
  console.log('session_id (direct):', sessionIdDirect);
  console.log('order_id (direct):', orderIdDirect);
  console.log('');
  console.log('--- Final values ---');
  console.log('sessionId to use:', sessionId);
  console.log('sessionId type:', typeof sessionId);
  console.log('sessionId length:', sessionId ? sessionId.length : 'null');
  console.log('orderId to use:', orderId);
  
  useEffect(() => {
    console.log('=== CashfreeCheckout useEffect triggered ===');
    console.log('sessionId value:', sessionId);
    console.log('orderId value:', orderId);
    
    if (sessionId && sessionId.length > 10) {
      console.log('Proceeding with session_id checkout...');
      initializeCheckout();
    } else if (orderId) {
      console.log('No valid session_id, fetching order details...');
      fetchOrderAndInitialize();
    } else {
      console.error('ERROR: No valid session_id or order_id provided');
      console.error('URL was:', window.location.href);
      setError('No payment session or order ID provided. Please try again.');
      setLoading(false);
    }
  }, [sessionId, orderId]);
  
  const fetchOrderAndInitialize = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cashfree/order/${orderId}`);
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
    console.log('=== initializeCheckoutWithSession CALLED ===');
    console.log('Received paymentSessionId:', paymentSessionId);
    console.log('paymentSessionId type:', typeof paymentSessionId);
    console.log('paymentSessionId length:', paymentSessionId ? paymentSessionId.length : 'null/undefined');
    
    // CRITICAL: Validate payment_session_id before proceeding
    if (!paymentSessionId || 
        paymentSessionId === 'null' || 
        paymentSessionId === 'undefined' ||
        paymentSessionId === '' ||
        paymentSessionId.length < 20) {
      console.error('=== INVALID PAYMENT SESSION ID ===');
      console.error('Value received:', paymentSessionId);
      console.error('This will cause Cashfree to show "payment_session_id_invalid" error');
      setError('Invalid payment session. The session ID is missing or malformed. Please go back and try again.');
      setLoading(false);
      return;
    }
    
    // Check if session_id starts with expected prefix
    if (!paymentSessionId.startsWith('session_')) {
      console.error('=== SUSPICIOUS SESSION ID FORMAT ===');
      console.error('Expected to start with "session_" but got:', paymentSessionId.substring(0, 20));
    }
    
    console.log('Payment session ID validated successfully');
    console.log('First 50 chars:', paymentSessionId.substring(0, 50));
    console.log('Last 20 chars:', paymentSessionId.substring(paymentSessionId.length - 20));
    
    try {
      // Load Cashfree SDK
      console.log('Loading Cashfree SDK...');
      const Cashfree = await loadCashfreeSDK();
      console.log('Cashfree SDK loaded, typeof:', typeof Cashfree);
      console.log('Cashfree function:', Cashfree.toString().substring(0, 100));
      
      // Initialize Cashfree in PRODUCTION mode
      console.log('Initializing Cashfree with mode: production');
      const cashfree = Cashfree({
        mode: "production"  // IMPORTANT: Production mode
      });
      console.log('Cashfree initialized successfully');
      console.log('cashfree object type:', typeof cashfree);
      console.log('cashfree.checkout type:', typeof cashfree.checkout);
      
      setLoading(false);
      
      // Small delay to ensure SDK is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Auto-redirect to payment page
      setProcessingPayment(true);
      
      // CRITICAL: Log everything before calling checkout
      console.log('=== LAUNCHING CASHFREE CHECKOUT ===');
      console.log('paymentSessionId to use:', paymentSessionId);
      console.log('paymentSessionId type:', typeof paymentSessionId);
      console.log('paymentSessionId is string:', typeof paymentSessionId === 'string');
      console.log('paymentSessionId is truthy:', !!paymentSessionId);
      console.log('paymentSessionId first 60 chars:', paymentSessionId.substring(0, 60));
      console.log('paymentSessionId last 30 chars:', paymentSessionId.substring(paymentSessionId.length - 30));
      
      // Build checkout config
      const checkoutConfig = {
        paymentSessionId: String(paymentSessionId),  // Ensure it's a string
        redirectTarget: "_self"  // Redirect in same tab
      };
      
      console.log('=== CHECKOUT CONFIG ===');
      console.log('checkoutConfig:', JSON.stringify(checkoutConfig, null, 2));
      console.log('checkoutConfig.paymentSessionId:', checkoutConfig.paymentSessionId);
      console.log('typeof checkoutConfig.paymentSessionId:', typeof checkoutConfig.paymentSessionId);
      
      // Final verification
      if (!checkoutConfig.paymentSessionId || checkoutConfig.paymentSessionId.length < 50) {
        console.error('=== CRITICAL ERROR: Invalid session ID in config! ===');
        setError('Payment session is invalid. Please try again.');
        setLoading(false);
        return;
      }
      
      console.log('Calling cashfree.checkout() NOW...');
      
      // Call Cashfree checkout
      cashfree.checkout(checkoutConfig);
      
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
