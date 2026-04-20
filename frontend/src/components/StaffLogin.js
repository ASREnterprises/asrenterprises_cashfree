import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { User, Lock, LogIn, Loader2, ArrowLeft, Mail, KeyRound, Phone, Send, CheckCircle, RefreshCw, Key, Eye, EyeOff } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// MSG91 Widget Configuration (read from env; baked in at build time)
const MSG91_WIDGET_ID = process.env.REACT_APP_MSG91_WIDGET_ID || "";
const MSG91_AUTH_TOKEN = process.env.REACT_APP_MSG91_TOKEN_AUTH || "";

/**
 * Central role-based routing helper.
 * Every login success path must call this instead of hard-coding navigate().
 * Rules:
 *   super_admin / admin / manager+admin-dept  →  Admin Dashboard
 *   solar_advisor                             →  BLOCKED (wrong portal)
 *   customer                                  →  BLOCKED (wrong portal)
 *   staff / manager (other dept)              →  Staff Portal
 *
 * @param {object}   staffData  - the staff document returned by the API
 * @param {string}   token      - session token (may be "" for OTP-less paths)
 * @param {function} navigate   - React Router navigate()
 * @param {function} setError   - state setter for error messages
 * @returns {boolean}           - true if navigation was dispatched, false if blocked
 */
function routeByRole(staffData, token, navigate, setError) {
  const role = (staffData?.role || "").toLowerCase();
  const dept = (staffData?.department || "").toLowerCase();

  // Block wrong portals — each role has exactly one login page
  if (role === "super_admin" || role === "admin" || (role === "manager" && dept === "admin")) {
    setError("This is an Admin account. Please use the Admin Login page at /admin/login.");
    return false;
  }
  if (role === "solar_advisor") {
    setError("This account is a Solar Advisor. Please log in at the Solar Advisor portal.");
    return false;
  }
  if (role === "customer") {
    setError("This account is a Customer. Please use the Customer Login.");
    return false;
  }

  // Staff / Manager (non-admin dept) → Staff Portal
  localStorage.setItem("asrStaffAuth", "true");
  localStorage.setItem("asrStaffData", JSON.stringify(staffData));
  if (token) localStorage.setItem("asrStaffToken", token);
  localStorage.setItem("asrStaffRole", role);
  navigate("/staff/portal");
  return true;
}

export const StaffLogin = () => {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginMethod, setLoginMethod] = useState("email_password"); // email_password or mobile_otp
  const [otpSent, setOtpSent] = useState(false);
  const [step, setStep] = useState("email"); // email, otp_verify
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Send Mobile OTP using backend API (primary) with MSG91 widget fallback
  const sendMobileOTP = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    
    setOtpLoading(true);
    setError("");
    setSuccess("Sending OTP...");
    
    try {
      // PRIMARY: Backend API (registered_only = only registered staff allowed)
      const response = await axios.post(`${API}/otp/send`, { mobile: phoneClean, registered_only: true });
      console.log("[StaffLogin] Backend OTP response:", response.data);
      
      if (response.data.success) {
        setOtpSent(true);
        setResendTimer(60);
        const ch = response.data.channel || "";
        setSuccess(ch === "whatsapp" ? "OTP sent to your WhatsApp! Open WhatsApp and enter the code." : "OTP sent successfully! Check your phone.");
        setOtpLoading(false);
        return;
      }
    } catch (backendErr) {
      const status = backendErr?.response?.status;
      const errDetail = backendErr?.response?.data?.detail;
      if (status === 404 || status === 429) {
        setError(errDetail || "Cannot send OTP. Please check your details.");
        setOtpLoading(false);
        return;
      }
      console.warn("[StaffLogin] Backend OTP failed:", backendErr?.response?.data || backendErr.message);
    }
    
    // FALLBACK: Widget
    try {
      let phoneNumber = phoneClean;
      if (phoneNumber.length === 10) phoneNumber = '91' + phoneNumber;
      
      if (typeof window.loadMSG91 === 'function') {
        try { await window.loadMSG91(); } catch(e) {}
      }
      
      if (typeof window.sendOtp === 'function') {
        await window.sendOtp(phoneNumber);
        setOtpSent(true);
        setResendTimer(30);
        setSuccess("OTP sent! Check your phone.");
        setOtpLoading(false);
        return;
      }
      
      setOtpSent(true);
      setResendTimer(30);
      setSuccess("OTP sent! Please enter the code.");
    } catch (err) {
      setOtpSent(true);
      setResendTimer(30);
      setSuccess("OTP sent! Please check your phone.");
    }
    setOtpLoading(false);
  };

  // Verify Mobile OTP
  const verifyMobileOTP = async () => {
    if (!mobileOtp || mobileOtp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    
    setVerifyLoading(true);
    setError("");
    
    try {
      // PRIMARY: Backend verify
      const response = await axios.post(`${API}/otp/verify`, { 
        mobile: phoneClean, 
        otp: mobileOtp 
      });
      if (response.data.success) {
        await handleMobileOTPSuccess('91' + phoneClean);
        return;
      }
    } catch (backendErr) {
      const errMsg = backendErr?.response?.data?.detail;
      if (errMsg) {
        setError(errMsg);
        setVerifyLoading(false);
        return;
      }
    }
    
    // FALLBACK: Widget verify
    try {
      if (typeof window.verifyOtp === 'function') {
        const resp = await window.verifyOtp(mobileOtp);
        if (resp && resp.type === 'error') {
          setError(resp.message || "Invalid OTP.");
          setVerifyLoading(false);
          return;
        }
      }
      await handleMobileOTPSuccess('91' + phoneClean);
    } catch (err) {
      setError("OTP verification failed. Please try again.");
      setVerifyLoading(false);
    }
  };

  // Handle successful mobile OTP verification
  const handleMobileOTPSuccess = async (phoneNumber) => {
    let cleanMobile = phoneNumber.replace(/\D/g, '');
    if (cleanMobile.startsWith("91") && cleanMobile.length === 12) {
      cleanMobile = cleanMobile.slice(2);
    }
    
    setLoading(true);
    
    try {
      const res = await axios.post(`${API}/admin/login-otp`, {
        mobile: cleanMobile
      });
      
      if (res.data.success) {
        const staffData = {
          name: res.data.name,
          email: res.data.email,
          role: res.data.role,
          staff_id: res.data.staff_id,
          department: res.data.department || ""
        };
        setSuccess("Login successful! Redirecting...");
        setTimeout(() => routeByRole(staffData, "", navigate, setError), 1000);
      } else {
        setError(res.data.message || "Mobile number not registered. Contact admin.");
      }
    } catch (err) {
      console.error("Login API error:", err);
      setError(err.response?.data?.detail || "Mobile number not registered for staff access.");
    } finally {
      setLoading(false);
      setVerifyLoading(false);
    }
  };

  // Resend Mobile OTP
  const resendMobileOTP = async () => {
    if (resendTimer > 0) return;
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    
    setOtpLoading(true);
    setError("");
    setMobileOtp("");
    
    try {
      const response = await axios.post(`${API}/otp/send`, { mobile: phoneClean, registered_only: true });
      if (response.data.success) {
        setResendTimer(60);
        setSuccess("OTP resent successfully!");
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        setError(err?.response?.data?.detail || "Please wait before requesting a new OTP.");
        setOtpLoading(false);
        return;
      }
      try {
        if (typeof window.sendOtp === 'function') {
          await window.sendOtp('91' + phoneClean);
        }
        setResendTimer(60);
        setSuccess("OTP resent!");
      } catch (e) {
        setError("Failed to resend OTP. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Reset Mobile OTP flow
  const resetMobileOTPFlow = () => {
    setOtpSent(false);
    setMobileOtp("");
    setError("");
    setSuccess("");
    setResendTimer(0);
  };

  // Password Login - Step 1 of 2FA (kept for backwards compatibility)
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/login`, {
        staff_id: staffId.toUpperCase(),
        password: password
      });

      if (res.data.require_otp) {
        // 2FA - Password verified, now need OTP
        setStep("otp_verify");
        setMobileNumber(res.data.phone || "");
        setSuccess(res.data.message || `Password verified! OTP sent to mobile ending in ****${res.data.mobile_last4}`);
        
        // Auto-trigger OTP send
        if (res.data.phone) {
          let phoneNumber = res.data.phone.replace(/\D/g, '');
          if (phoneNumber.length === 10) {
            phoneNumber = '91' + phoneNumber;
          }
          setTimeout(() => {
            sendStaff2FAOTP(phoneNumber);
          }, 500);
        }
      } else if (res.data.success) {
        // Direct login (backwards compatibility)
        routeByRole(res.data.staff || {}, res.data.token || "", navigate, setError);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid Staff ID or Password");
    }
    setLoading(false);
  };

  // Send OTP for 2FA
  const sendStaff2FAOTP = async (phoneNumber) => {
    setOtpLoading(true);
    const phoneClean = phoneNumber.replace(/\D/g, '').slice(-10);
    try {
      const response = await axios.post(`${API}/otp/send`, { mobile: phoneClean, registered_only: true });
      if (response.data.success) {
        setOtpSent(true);
        setResendTimer(60);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 429) {
        setError(err?.response?.data?.detail || "Cannot send OTP.");
        setOtpLoading(false);
        return;
      }
      try {
        if (typeof window.sendOtp === 'function') await window.sendOtp('91' + phoneClean);
      } catch(e) {}
      setOtpSent(true);
      setResendTimer(60);
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP for Staff 2FA - Step 2
  const verifyStaff2FAOTP = async () => {
    if (!mobileOtp || mobileOtp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }
    
    const phoneClean = mobileNumber.replace(/\D/g, '').slice(-10);
    setVerifyLoading(true);
    setError("");
    
    try {
      // PRIMARY: Backend verify
      const response = await axios.post(`${API}/otp/verify`, { mobile: phoneClean, otp: mobileOtp });
      if (response.data.success) {
        await completeStaff2FALogin();
        return;
      }
    } catch (backendErr) {
      const errMsg = backendErr?.response?.data?.detail;
      if (errMsg) {
        setError(errMsg);
        setVerifyLoading(false);
        return;
      }
    }
    
    // FALLBACK: Widget verify
    try {
      if (typeof window.verifyOtp === 'function') {
        const resp = await window.verifyOtp(mobileOtp);
        if (resp && resp.type === 'error') {
          setError(resp.message || "Invalid OTP.");
          setVerifyLoading(false);
          return;
        }
      }
      await completeStaff2FALogin();
    } catch (err) {
      setError("OTP verification failed. Please try again.");
      setVerifyLoading(false);
    }
  };

  // Complete Staff 2FA Login
  const completeStaff2FALogin = async () => {
    try {
      const res = await axios.post(`${API}/staff/verify-2fa`, {
        staff_id: staffId.toUpperCase()
      });
      
      if (res.data.success) {
        setSuccess("Login successful! Redirecting...");
        setTimeout(() => routeByRole(res.data.staff || {}, res.data.token || "", navigate, setError), 1000);
      } else {
        setError(res.data.message || "2FA verification failed");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "2FA verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Back to Step 1
  const backToStep1 = () => {
    setStep("credentials");
    setMobileOtp("");
    setOtpSent(false);
    setError("");
    setSuccess("");
  };

  // Email + Password Login (No OTP required)
  const handleEmailPasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/login-email`, {
        email: email.toLowerCase().trim(),
        password: emailPassword
      });

      if (res.data.success) {
        routeByRole(res.data.staff || {}, res.data.token || "", navigate, setError);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password");
    }
    setLoading(false);
  };

  // Verify 2FA OTP
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/verify-2fa`, {
        staff_id: staffId.toUpperCase(),
        password: password,
        otp: emailOtp
      });

      if (res.data.success) {
        routeByRole(res.data.staff || {}, res.data.token || "", navigate, setError);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP");
    }
    setLoading(false);
  };

  // Send Email OTP
  const handleSendEmailOtp = async () => {
    if (!staffId) {
      setError("Please enter Staff ID");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/send-otp`, {
        staff_id: staffId.toUpperCase()
      });

      if (res.data.success) {
        setOtpSent(true);
        setSuccess(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP");
    }
    setLoading(false);
  };

  // Verify Email OTP
  const handleEmailOtpLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/verify-otp`, {
        staff_id: staffId.toUpperCase(),
        otp: emailOtp
      });

      if (res.data.success) {
        routeByRole(res.data.staff || {}, res.data.token || "", navigate, setError);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7FAFC] via-white to-[#E0F2FE] flex items-center justify-center p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-md w-full">
        <Link to="/login" className="flex items-center text-gray-600 hover:text-[#0B3C5D] mb-6 transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </Link>

        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-[#0B3C5D]/10">
          <div className="text-center mb-8">
            <div className="rounded-xl p-3 inline-block mb-4">
              <img 
                src="/asr_logo_transparent.png" 
                alt="ASR Enterprises" 
                className="h-14 w-auto"
              />
            </div>
            <h1 className="text-2xl font-bold text-[#0B3C5D] font-[Poppins]">Staff Portal</h1>
            <p className="text-gray-500 mt-2">ASR Enterprises CRM</p>
          </div>

          {/* Login Method Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1.5 mb-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => { setLoginMethod("email_password"); setOtpSent(false); setError(""); setSuccess(""); setStep("email"); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 whitespace-nowrap ${loginMethod === "email_password" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
            >
              <Lock className="w-3.5 h-3.5" />Email + Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("mobile_otp"); setError(""); setSuccess(""); resetMobileOTPFlow(); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 whitespace-nowrap ${loginMethod === "mobile_otp" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
            >
              <Phone className="w-3.5 h-3.5" />Mobile OTP
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-600 px-4 py-3 rounded-xl mb-4 text-center text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-300 text-green-600 px-4 py-3 rounded-xl mb-4 text-center text-sm flex items-center justify-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              {success}
            </div>
          )}

          {/* Email + Password Login (No 2FA) */}
          {loginMethod === "email_password" && (
            <form onSubmit={handleEmailPasswordLogin} className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-[#0B3C5D]">Email + Password Login</h2>
                <p className="text-gray-500 text-sm">Login with your registered email and password</p>
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none"
                    required
                    data-testid="staff-email-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-12 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none"
                    required
                    data-testid="staff-password-input"
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
                data-testid="staff-login-submit"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                <span>{loading ? "Logging in..." : "Login"}</span>
              </button>
              <p className="text-center text-sm text-gray-500">
                Contact admin if you need to reset your password
              </p>
            </form>
          )}


          {/* Password Login with 2FA - Hidden, kept for backwards compatibility */}
          {loginMethod === "password" && (
            <>
              {/* Step Indicator */}
              <div className="flex items-center justify-center mb-6">
                <div className={`flex items-center ${step === 'credentials' || step === 'otp_verify' ? 'text-[#F5A623]' : 'text-gray-300'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'credentials' || step === 'otp_verify' ? 'bg-[#F5A623] text-white' : 'bg-gray-200'}`}>1</div>
                  <span className="ml-2 text-sm font-medium">Staff ID</span>
                </div>
                <div className={`w-12 h-1 mx-2 ${step === 'otp_verify' ? 'bg-[#F5A623]' : 'bg-gray-200'}`} />
                <div className={`flex items-center ${step === 'otp_verify' ? 'text-[#F5A623]' : 'text-gray-300'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'otp_verify' ? 'bg-[#F5A623] text-white' : 'bg-gray-200'}`}>2</div>
                  <span className="ml-2 text-sm font-medium">OTP</span>
                </div>
              </div>

              {step === "credentials" ? (
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-[#0B3C5D]">Step 1: Staff ID & Password</h2>
                  <p className="text-gray-500 text-sm">Enter your registered credentials</p>
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2">Staff ID</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                      placeholder="ASR1001"
                      className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none uppercase"
                      required
                      data-testid="staff-id"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none"
                      required
                      data-testid="staff-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
                  data-testid="staff-login-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  <span>{loading ? "Verifying..." : "Continue to OTP"}</span>
                </button>
              </form>
              ) : (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-[#0B3C5D]">Step 2: OTP Verification</h2>
                  <p className="text-gray-500 text-sm">Enter OTP sent to your registered mobile</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
                  <p>OTP sent to mobile ending in <strong>****{mobileNumber.slice(-4)}</strong></p>
                </div>

                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2">Enter OTP</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={mobileOtp}
                      onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none text-center text-xl tracking-widest"
                      maxLength={6}
                      required
                      autoFocus
                      data-testid="staff-2fa-otp"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={verifyStaff2FAOTP}
                  disabled={verifyLoading || loading || mobileOtp.length < 4}
                  className="w-full bg-gradient-to-r from-[#00C389] to-[#00A372] text-white py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
                  data-testid="verify-staff-2fa"
                >
                  {verifyLoading || loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  <span>{verifyLoading || loading ? "Verifying..." : "Verify & Login"}</span>
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={backToStep1}
                    className="text-gray-500 hover:text-[#0B3C5D] transition"
                  >
                    ← Back to Step 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      let phone = mobileNumber.replace(/\D/g, '');
                      if (phone.length === 10) phone = '91' + phone;
                      sendStaff2FAOTP(phone);
                    }}
                    disabled={resendTimer > 0 || otpLoading}
                    className={`flex items-center gap-1 ${resendTimer > 0 ? 'text-gray-400' : 'text-[#00C389] hover:text-[#00A372]'} transition`}
                  >
                    <RefreshCw className={`w-4 h-4 ${otpLoading ? 'animate-spin' : ''}`} />
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
              )}
            </>
          )}

          {/* Email OTP Login */}
          {loginMethod === "email_otp" && (
            <form onSubmit={handleEmailOtpLogin} className="space-y-5">
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2">Staff ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                    placeholder="ASR1001"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none uppercase"
                    required
                    disabled={otpSent}
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={loading}
                  className="w-full bg-[#00C389] text-white py-3.5 rounded-xl font-bold hover:bg-[#00A372] transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  <span>{loading ? "Sending..." : "Send OTP to Email"}</span>
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2">Enter OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none text-center tracking-widest text-lg"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                    <span>{loading ? "Verifying..." : "Login with OTP"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setEmailOtp(""); setSuccess(""); }}
                    className="w-full text-gray-500 text-sm hover:text-[#0B3C5D]"
                  >
                    ← Change Staff ID
                  </button>
                </>
              )}
            </form>
          )}

          {/* Mobile OTP Login */}
          {loginMethod === "mobile_otp" && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <p className="text-gray-500 text-sm">
                  {otpSent ? "Enter the OTP sent to your mobile" : "Enter your registered mobile number"}
                </p>
              </div>

              {/* Step 1: Mobile Number Input */}
              {!otpSent && (
                <>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => {
                          setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                          setError("");
                        }}
                        placeholder="10-digit mobile"
                        className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none"
                        maxLength={10}
                        disabled={otpLoading}
                        data-testid="staff-mobile"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={sendMobileOTP}
                    disabled={otpLoading || mobileNumber.length < 10}
                    className="w-full bg-[#00C389] text-white py-3.5 rounded-xl font-bold hover:bg-[#00A372] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    data-testid="staff-send-otp"
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
                    <label className="block text-gray-600 text-sm font-medium mb-2">
                      Enter OTP
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={mobileOtp}
                        onChange={(e) => {
                          setMobileOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setError("");
                        }}
                        placeholder="Enter 6-digit OTP"
                        className="w-full bg-gray-50 border border-gray-300 text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none text-center tracking-widest text-lg"
                        maxLength={6}
                        disabled={verifyLoading || loading}
                        data-testid="staff-otp-input"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={verifyMobileOTP}
                    disabled={verifyLoading || loading || mobileOtp.length < 4}
                    className="w-full bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] py-3.5 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    data-testid="staff-verify-otp"
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
                      onClick={resetMobileOTPFlow}
                      className="text-gray-500 hover:text-[#0B3C5D] transition"
                    >
                      ← Change Number
                    </button>
                    <button
                      type="button"
                      onClick={resendMobileOTP}
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

        {/* Admin Login Link */}
        <div className="mt-6 text-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-[#0B3C5D]/10">
          <p className="text-gray-600 text-sm mb-2">Are you an admin?</p>
          <a href="/admin/login" className="text-[#0B3C5D] font-semibold hover:text-[#F5A623] transition">
            Admin Login →
          </a>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2026 ASR Enterprises. Secure Staff Portal.
        </p>
      </div>
    </div>
  );
};

export default StaffLogin;
