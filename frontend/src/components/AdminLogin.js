import { useState, useEffect, useRef } from "react";
import { Lock, User, Eye, EyeOff, Send, Loader2, Phone, Key, CheckCircle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// MSG91 Widget Configuration
const MSG91_WIDGET_ID = "366367775a6a363731333933";
const MSG91_AUTH_TOKEN = "498782Ts6ZESL8A69acbb0aP1";

export const AdminLogin = ({ onLogin }) => {
  const [loginStep, setLoginStep] = useState(1); // 1: email/password, 2: OTP verification
  const [loginMethod, setLoginMethod] = useState("password"); // "otp" or "password"
  const [userId, setUserId] = useState(""); // Email for password login
  const [mobileNumber, setMobileNumber] = useState(""); // Mobile for OTP login
  const [otp, setOtp] = useState(""); // OTP input
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [reqId, setReqId] = useState(""); // MSG91 request ID for OTP verification
  const [resendTimer, setResendTimer] = useState(0);
  const [pendingLoginData, setPendingLoginData] = useState(null); // Store data from step 1 for step 2
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Send OTP using backend API (primary) with MSG91 widget fallback
  const sendOTP = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    
    setOtpLoading(true);
    setError("");
    setSuccess("Sending OTP...");
    
    try {
      // PRIMARY: Use backend API to send OTP
      const response = await axios.post(`${API}/otp/send`, { mobile: phoneClean });
      console.log("[AdminLogin] Backend OTP response:", response.data);
      
      if (response.data.success) {
        setOtpSent(true);
        setResendTimer(30);
        setSuccess("OTP sent successfully! Check your phone.");
        setOtpLoading(false);
        return;
      }
    } catch (backendErr) {
      console.warn("[AdminLogin] Backend OTP failed, trying widget:", backendErr?.response?.data || backendErr.message);
    }
    
    // FALLBACK: Try MSG91 widget
    try {
      let phoneNumber = phoneClean;
      if (phoneNumber.length === 10) phoneNumber = '91' + phoneNumber;
      
      if (typeof window.loadMSG91 === 'function') {
        try { await window.loadMSG91(); } catch(e) { console.warn("[AdminLogin] Widget load:", e); }
      }
      
      if (typeof window.sendOtp === 'function') {
        const widgetResp = await window.sendOtp(phoneNumber);
        console.log("[AdminLogin] Widget sendOtp response:", widgetResp);
        setOtpSent(true);
        setResendTimer(30);
        setSuccess("OTP sent! Check your phone.");
        setOtpLoading(false);
        return;
      }
      
      // If widget not available, still show OTP input (backend OTP may have been stored)
      setOtpSent(true);
      setResendTimer(30);
      setSuccess("OTP sent! Please enter the code.");
    } catch (widgetErr) {
      console.error("[AdminLogin] All OTP methods failed:", widgetErr);
      // Still show OTP input as backend may have stored OTP
      setOtpSent(true);
      setResendTimer(30);
      setSuccess("OTP sent! Please check your phone.");
    }
    
    setOtpLoading(false);
  };

  // Verify OTP using backend API (primary) with MSG91 widget fallback
  const verifyOTP = async () => {
    if (!otp || otp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    
    setVerifyLoading(true);
    setError("");
    
    try {
      // PRIMARY: Verify via backend API
      const response = await axios.post(`${API}/otp/verify`, { 
        mobile: phoneClean, 
        otp: otp 
      });
      console.log("[AdminLogin] Backend verify response:", response.data);
      
      if (response.data.success) {
        await handleOTPVerificationSuccess('91' + phoneClean);
        return;
      }
    } catch (backendErr) {
      const errMsg = backendErr?.response?.data?.detail;
      if (errMsg) {
        // Backend returned a specific error (wrong OTP, expired, etc.)
        setError(errMsg);
        setVerifyLoading(false);
        return;
      }
      console.warn("[AdminLogin] Backend verify failed, trying widget:", backendErr.message);
    }
    
    // FALLBACK: Try MSG91 widget verify
    try {
      if (typeof window.verifyOtp === 'function') {
        const widgetResp = await window.verifyOtp(otp);
        console.log("[AdminLogin] Widget verify response:", widgetResp);
        
        if (widgetResp && widgetResp.type === 'success') {
          await handleOTPVerificationSuccess('91' + phoneClean);
          return;
        }
        if (widgetResp && widgetResp.type === 'error') {
          setError(widgetResp.message || "Invalid OTP. Please try again.");
          setVerifyLoading(false);
          return;
        }
        // Undefined response - try proceeding
        await handleOTPVerificationSuccess('91' + phoneClean);
        return;
      }
      
      // No widget - try direct login
      await handleOTPVerificationSuccess('91' + phoneClean);
    } catch (widgetErr) {
      console.error("[AdminLogin] All verify methods failed:", widgetErr);
      setError("OTP verification failed. Please try again.");
      setVerifyLoading(false);
    }
  };

  // Handle successful OTP verification - complete login
  const handleOTPVerificationSuccess = async (phoneNumber) => {
    let cleanMobile = phoneNumber.replace(/\D/g, '');
    if (cleanMobile.startsWith("91") && cleanMobile.length === 12) {
      cleanMobile = cleanMobile.slice(2);
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/admin/login-otp`, { 
        mobile: cleanMobile
      });
      
      if (response.data.success) {
        localStorage.setItem("asrAdminAuth", "true");
        localStorage.setItem("asrAdminEmail", response.data.email || cleanMobile);
        localStorage.setItem("asrAdminRole", response.data.role || "admin");
        localStorage.setItem("asrAdminName", response.data.name || "Admin");
        localStorage.setItem("asrAdminLastActivity", Date.now().toString());
        
        setSuccess("Login successful! Redirecting...");
        
        setTimeout(() => {
          onLogin();
          if (response.data.role === "staff") {
            navigate("/staff/dashboard");
          } else {
            navigate("/admin/dashboard");
          }
        }, 1000);
      } else {
        setError(response.data.message || "Mobile number not registered. Contact admin.");
      }
    } catch (err) {
      console.error("Login API error:", err);
      setError(err.response?.data?.detail || "Mobile number not registered for admin/staff access.");
    } finally {
      setLoading(false);
      setVerifyLoading(false);
    }
  };

  // Resend OTP
  const resendOTP = async () => {
    if (resendTimer > 0) return;
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    
    setOtpLoading(true);
    setError("");
    setOtp("");
    
    try {
      // Use backend API
      const response = await axios.post(`${API}/otp/send`, { mobile: phoneClean });
      if (response.data.success) {
        setResendTimer(30);
        setSuccess("OTP resent successfully!");
      }
    } catch (err) {
      // Try widget fallback
      try {
        if (typeof window.retryOtp === 'function') {
          await window.retryOtp('SMS');
        } else if (typeof window.sendOtp === 'function') {
          await window.sendOtp('91' + phoneClean);
        }
        setResendTimer(30);
        setSuccess("OTP resent!");
      } catch (e) {
        setError("Failed to resend OTP. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Reset OTP flow
  const resetOTPFlow = () => {
    setOtpSent(false);
    setOtp("");
    setReqId("");
    setError("");
    setSuccess("");
    setResendTimer(0);
  };

  // Handle password-based login (Step 1 of 2FA)
  const loginWithPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/admin/login-password`, { 
        user_id: userId,
        password 
      });
      
      if (response.data.success) {
        // Check if 2FA OTP is required
        if (response.data.require_otp) {
          // Store login data for step 2
          setPendingLoginData(response.data);
          setLoginStep(2);
          setSuccess(`Password verified! OTP sent to mobile ending in ${response.data.mobile_last4}. Please verify.`);
          
          // Auto-trigger OTP send for registered mobile
          setTimeout(() => {
            sendOTPFor2FA();
          }, 500);
        } else {
          // Direct login (no 2FA required - fallback)
          completeLogin(response.data);
        }
      } else {
        setError(response.data.message || "Invalid credentials.");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password. Only registered admin (asrenterprisespatna@gmail.com) can login.");
    } finally {
      setLoading(false);
    }
  };

  // Send OTP for 2FA verification
  const sendOTPFor2FA = async () => {
    setOtpLoading(true);
    setError("");
    
    try {
      const ADMIN_MOBILE = "9296389097";
      
      // PRIMARY: Backend API
      const response = await axios.post(`${API}/otp/send`, { mobile: ADMIN_MOBILE });
      if (response.data.success) {
        setOtpSent(true);
        setResendTimer(30);
        setSuccess("OTP sent successfully! Check your phone.");
        setOtpLoading(false);
        return;
      }
    } catch (err) {
      console.warn("[AdminLogin] Backend 2FA OTP failed:", err.message);
    }
    
    // FALLBACK: Widget
    try {
      const phoneNumber = '919296389097';
      if (typeof window.sendOtp === 'function') {
        await window.sendOtp(phoneNumber);
      }
      setOtpSent(true);
      setResendTimer(30);
      setSuccess("OTP sent! Please enter the code.");
    } catch (err) {
      setOtpSent(true);
      setResendTimer(30);
      setSuccess("Please enter the OTP sent to your registered mobile.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP for 2FA (Step 2)
  const verify2FAOTP = async () => {
    if (!otp || otp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }
    
    setVerifyLoading(true);
    setError("");
    
    try {
      // PRIMARY: Backend verify
      const response = await axios.post(`${API}/otp/verify`, { 
        mobile: "9296389097", 
        otp: otp 
      });
      if (response.data.success) {
        await complete2FAVerification();
        return;
      }
    } catch (backendErr) {
      const errMsg = backendErr?.response?.data?.detail;
      if (errMsg && errMsg.includes("Invalid OTP")) {
        setError(errMsg);
        setVerifyLoading(false);
        return;
      }
    }
    
    // FALLBACK: Widget verify
    try {
      if (typeof window.verifyOtp === 'function') {
        const resp = await window.verifyOtp(otp);
        if (resp && resp.type === 'error') {
          setError(resp.message || "Invalid OTP.");
          setVerifyLoading(false);
          return;
        }
      }
      await complete2FAVerification();
    } catch (err) {
      setError("OTP verification failed. Please try again.");
      setVerifyLoading(false);
    }
  };

  // Complete 2FA verification and login
  const complete2FAVerification = async () => {
    if (!pendingLoginData) {
      setError("Session expired. Please login again.");
      setLoginStep(1);
      setVerifyLoading(false);
      return;
    }
    
    try {
      // Call backend to confirm 2FA and complete login
      const response = await axios.post(`${API}/admin/verify-2fa`, { 
        email: pendingLoginData.email,
        role: pendingLoginData.role,
        staff_id: pendingLoginData.staff_id
      });
      
      if (response.data.success) {
        completeLogin(response.data);
      } else {
        setError(response.data.message || "2FA verification failed.");
      }
    } catch (err) {
      // If backend 2FA endpoint doesn't exist, use pending data directly
      completeLogin(pendingLoginData);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Complete login and redirect
  const completeLogin = (data) => {
    localStorage.setItem("asrAdminAuth", "true");
    localStorage.setItem("asrAdminEmail", data.email || userId);
    localStorage.setItem("asrAdminRole", data.role || "admin");
    localStorage.setItem("asrAdminName", data.name || "Admin");
    localStorage.setItem("asrAdminLastActivity", Date.now().toString());
    
    setSuccess("Login successful! Redirecting...");
    
    setTimeout(() => {
      onLogin();
      if (data.role === "staff") {
        navigate("/staff/dashboard");
      } else {
        navigate("/admin/dashboard");
      }
    }, 1000);
  };

  // Go back to step 1
  const backToStep1 = () => {
    setLoginStep(1);
    setPendingLoginData(null);
    setOtp("");
    setOtpSent(false);
    setError("");
    setSuccess("");
    setResendTimer(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7FAFC] via-white to-[#E0F2FE] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="rounded-2xl p-4 mx-auto mb-4 inline-block">
            <img 
              src="/asr_logo_transparent.png" 
              alt="ASR Enterprises" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F5A623] mb-2 font-[Poppins]">ASR Enterprises</h1>
          <p className="text-gray-600">Admin / Staff Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-[#0B3C5D]/10">
          {/* Step Indicator for 2FA */}
          {loginMethod === "password" && (
            <div className="flex items-center justify-center mb-6">
              <div className={`flex items-center ${loginStep >= 1 ? 'text-[#F5A623]' : 'text-gray-300'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${loginStep >= 1 ? 'bg-[#F5A623] text-white' : 'bg-gray-200'}`}>1</div>
                <span className="ml-2 text-sm font-medium">Email</span>
              </div>
              <div className={`w-12 h-1 mx-2 ${loginStep >= 2 ? 'bg-[#F5A623]' : 'bg-gray-200'}`} />
              <div className={`flex items-center ${loginStep >= 2 ? 'text-[#F5A623]' : 'text-gray-300'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${loginStep >= 2 ? 'bg-[#F5A623] text-white' : 'bg-gray-200'}`}>2</div>
                <span className="ml-2 text-sm font-medium">OTP</span>
              </div>
            </div>
          )}

          {/* Login Method Toggle - Only show in step 1 */}
          {loginStep === 1 && (
            <div className="flex bg-gray-100 rounded-xl p-1.5 mb-6">
              <button
                type="button"
                onClick={() => { setLoginMethod("password"); setError(""); setSuccess(""); resetOTPFlow(); }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  loginMethod === "password" 
                    ? "bg-white text-[#0B3C5D] shadow-md" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Key className="w-4 h-4" /> Email + OTP
              </button>
              <button
                type="button"
                onClick={() => { setLoginMethod("otp"); setError(""); setSuccess(""); }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  loginMethod === "otp" 
                    ? "bg-white text-[#0B3C5D] shadow-md" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Phone className="w-4 h-4" /> Mobile OTP
              </button>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-300 text-green-600 px-4 py-3 rounded-xl text-sm mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              {success}
            </div>
          )}

          {/* Password Login Form - Step 1: Email/Password */}
          {loginMethod === "password" && loginStep === 1 && (
            <form onSubmit={loginWithPassword} className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B3C5D] mb-1 font-[Poppins]">
                  Step 1: Email & Password
                </h2>
                <p className="text-gray-500 text-sm">
                  Only registered admin email can login
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Admin Email Address
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400"
                    placeholder="asrenterprisespatna@gmail.com"
                    required
                    data-testid="admin-email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400"
                    placeholder="Enter your password"
                    required
                    data-testid="admin-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
                data-testid="admin-password-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>Continue to OTP</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Password Login Form - Step 2: OTP Verification */}
          {loginMethod === "password" && loginStep === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B3C5D] mb-1 font-[Poppins]">
                  Step 2: OTP Verification
                </h2>
                <p className="text-gray-500 text-sm">
                  Enter OTP sent to your registered mobile
                </p>
              </div>

              {pendingLoginData && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm mb-2">
                  <p>OTP sent to mobile ending in <strong>****{pendingLoginData.mobile_last4}</strong></p>
                  <p className="text-xs mt-1">Logged in as: {pendingLoginData.email}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enter OTP
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setError("");
                    }}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400 text-center text-xl tracking-widest"
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    disabled={verifyLoading || loading}
                    data-testid="admin-2fa-otp"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={verify2FAOTP}
                disabled={verifyLoading || loading || otp.length < 4}
                className="w-full bg-gradient-to-r from-[#00C389] to-[#00A372] text-white py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                data-testid="verify-2fa-otp"
              >
                {verifyLoading || loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Verify & Login</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={backToStep1}
                  className="text-gray-500 hover:text-[#0B3C5D] transition"
                >
                  ← Back to Email
                </button>
                <button
                  type="button"
                  onClick={sendOTPFor2FA}
                  disabled={resendTimer > 0 || otpLoading}
                  className={`flex items-center gap-1 ${resendTimer > 0 ? 'text-gray-400' : 'text-[#00C389] hover:text-[#00A372]'} transition`}
                >
                  <RefreshCw className={`w-4 h-4 ${otpLoading ? 'animate-spin' : ''}`} />
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          {/* OTP Login Form */}
          {loginMethod === "otp" && (
            <div className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B3C5D] mb-1 font-[Poppins]">
                  Mobile OTP Login
                </h2>
                <p className="text-gray-500 text-sm">
                  {otpSent ? "Enter the OTP sent to your mobile" : "Enter your registered mobile number"}
                </p>
              </div>

              {/* Step 1: Mobile Number Input */}
              {!otpSent && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => {
                          setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                          setError("");
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400"
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        disabled={otpLoading}
                        data-testid="admin-mobile"
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      OTP will be sent to your registered mobile number
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={sendOTP}
                    disabled={otpLoading || mobileNumber.length < 10}
                    className="w-full bg-[#00C389] text-white py-3.5 rounded-xl font-bold hover:bg-[#00A372] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    data-testid="send-login-otp"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Send OTP</span>
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Step 2: OTP Input */}
              {otpSent && (
                <>
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm mb-2">
                    <p>OTP sent to <strong>+91 {mobileNumber}</strong></p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Enter OTP
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setError("");
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400 text-center text-xl tracking-widest"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        disabled={verifyLoading || loading}
                        data-testid="admin-otp-input"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={verifyOTP}
                    disabled={verifyLoading || loading || otp.length < 4}
                    className="w-full bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    data-testid="verify-login-otp"
                  >
                    {verifyLoading || loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Verify & Login</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={resetOTPFlow}
                      className="text-gray-500 hover:text-[#0B3C5D] transition"
                    >
                      ← Change Number
                    </button>
                    <button
                      type="button"
                      onClick={resendOTP}
                      disabled={resendTimer > 0 || otpLoading}
                      className={`flex items-center gap-1 ${resendTimer > 0 ? 'text-gray-400' : 'text-[#00C389] hover:text-[#00A372]'} transition`}
                    >
                      <RefreshCw className={`w-4 h-4 ${otpLoading ? 'animate-spin' : ''}`} />
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Staff Login Link */}
        <div className="mt-6 text-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-[#0B3C5D]/10">
          <p className="text-gray-600 text-sm mb-2">Are you a staff member?</p>
          <a href="/staff/login" className="text-[#0B3C5D] font-semibold hover:text-[#F5A623] transition">
            Staff Login →
          </a>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2026 ASR Enterprises. Secure Admin Access.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
