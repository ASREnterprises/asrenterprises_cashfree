import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { User, Lock, LogIn, Loader2, ArrowLeft, Mail, KeyRound, Phone, Send, CheckCircle, RefreshCw, Key } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// MSG91 Widget Configuration
const MSG91_WIDGET_ID = "366367775a6a363731333933";
const MSG91_AUTH_TOKEN = "498782Ts6ZESL8A69acbb0aP1";

export const StaffLogin = () => {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginMethod, setLoginMethod] = useState("password"); // password, email_otp, or mobile_otp
  const [otpSent, setOtpSent] = useState(false);
  const [step, setStep] = useState("credentials"); // credentials or otp_verify
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Send Mobile OTP using MSG91
  const sendMobileOTP = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    
    let phoneNumber = mobileNumber.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setError("");
    
    try {
      if (typeof window.sendOtp === 'function') {
        const response = await window.sendOtp(phoneNumber);
        console.log("MSG91 sendOtp response:", response);
        if (response && response.type === 'success') {
          setOtpSent(true);
          setResendTimer(30);
          setSuccess("OTP sent successfully! Check your phone.");
        } else if (response && response.type === 'error') {
          // Only show error if MSG91 explicitly returned an error
          setError(response?.message || "Failed to send OTP. Please try again.");
        } else {
          // MSG91 widget opened or returned undefined - show OTP input
          setOtpSent(true);
          setResendTimer(30);
          setSuccess("OTP sent! Enter the code you received.");
        }
      } else if (typeof window.initSendOTP === 'function') {
        const config = {
          widgetId: MSG91_WIDGET_ID,
          tokenAuth: MSG91_AUTH_TOKEN,
          identifier: phoneNumber,
          exposeMethods: true,
          success: (data) => {
            console.log("MSG91 OTP success:", data);
            handleMobileOTPSuccess(phoneNumber);
          },
          failure: (error) => {
            console.log("MSG91 OTP failure:", error);
            setError("OTP verification failed. Please try again.");
            setVerifyLoading(false);
          }
        };
        window.initSendOTP(config);
        
        setTimeout(async () => {
          if (typeof window.sendOtp === 'function') {
            try {
              const response = await window.sendOtp(phoneNumber);
              if (response && response.type === 'success') {
                setOtpSent(true);
                setResendTimer(30);
                setSuccess("OTP sent successfully! Check your phone.");
              } else if (response && response.type === 'error') {
                // Only show error if MSG91 explicitly returned an error
                setError(response?.message || "Failed to send OTP.");
              } else {
                // MSG91 widget opened or returned undefined - show OTP input
                setOtpSent(true);
                setResendTimer(30);
                setSuccess("OTP sent! Enter the code you received.");
              }
            } catch (err) {
              setError("Failed to send OTP. Please try again.");
            }
          } else {
            setOtpSent(true);
            setResendTimer(30);
            setSuccess("OTP sent! Please enter the code you received.");
          }
          setOtpLoading(false);
        }, 1500);
        return;
      } else {
        setError("OTP service is not available. Please refresh the page.");
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setError("Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify Mobile OTP
  const verifyMobileOTP = async () => {
    if (!mobileOtp || mobileOtp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }
    
    let phoneNumber = mobileNumber.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setVerifyLoading(true);
    setError("");
    
    try {
      if (typeof window.verifyOtp === 'function') {
        try {
          const response = await window.verifyOtp(mobileOtp);
          
          // Debug: Log the exact response for troubleshooting
          console.log("MSG91 verifyOtp raw response:", JSON.stringify(response));
          console.log("MSG91 verifyOtp response type:", typeof response);
          console.log("MSG91 verifyOtp response.type:", response?.type);
          console.log("MSG91 verifyOtp response.message:", response?.message);
          
          // MSG91 verified response handling based on documentation:
          // Success: {type: 'success', message: '...', data: {...}}
          // Error: {type: 'error', message: '...', errorCode: ...}
          
          if (response && response.type === 'success') {
            // OTP verified successfully
            console.log("MSG91 OTP verified successfully");
            await handleMobileOTPSuccess(phoneNumber);
            return;
          }
          
          if (response && response.type === 'error') {
            // OTP verification failed with specific error
            console.log("MSG91 OTP verification error:", response.message);
            setError(response.message || "Invalid OTP. Please try again.");
            setVerifyLoading(false);
            return;
          }
          
          // Handle case where response is undefined/null but no error thrown
          if (!response || response === undefined || response === null) {
            console.log("MSG91 returned undefined - checking window.otpVerificationStatus");
            // Check if callback-based verification already handled it
            if (window.otpVerificationStatus === 'verified') {
              await handleMobileOTPSuccess(phoneNumber);
              return;
            }
            // Otherwise, treat undefined as needing verification via API
            setError("OTP verification incomplete. Please try again.");
            setVerifyLoading(false);
            return;
          }
          
          // Unrecognized response format - log and show error
          console.log("MSG91 unrecognized response format:", response);
          setError("Verification error. Please try again.");
          setVerifyLoading(false);
          
        } catch (verifyError) {
          // MSG91 threw an exception
          console.error("MSG91 verifyOtp exception:", verifyError);
          console.error("MSG91 exception message:", verifyError?.message);
          setError(verifyError?.message || "OTP verification failed. Please try again.");
          setVerifyLoading(false);
        }
      } else {
        // MSG91 verifyOtp not available - show error
        console.log("MSG91 verifyOtp function not available");
        setError("OTP service unavailable. Please refresh and try again.");
        setVerifyLoading(false);
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
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
        localStorage.setItem("asrStaffAuth", "true");
        localStorage.setItem("asrStaffData", JSON.stringify({
          name: res.data.name,
          email: res.data.email,
          role: res.data.role,
          staff_id: res.data.staff_id
        }));
        
        setSuccess("Login successful! Redirecting...");
        
        setTimeout(() => {
          if (res.data.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/staff/portal");
          }
        }, 1000);
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
    
    let phoneNumber = mobileNumber.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setError("");
    setMobileOtp("");
    
    try {
      if (typeof window.retryOtp === 'function') {
        const response = await window.retryOtp('SMS');
        if (response && response.type === 'success') {
          setResendTimer(30);
          setSuccess("OTP resent successfully!");
        } else {
          setError(response?.message || "Failed to resend OTP.");
        }
      } else if (typeof window.sendOtp === 'function') {
        const response = await window.sendOtp(phoneNumber);
        if (response && response.type === 'success') {
          setResendTimer(30);
          setSuccess("OTP resent successfully!");
        } else {
          setError(response?.message || "Failed to resend OTP.");
        }
      } else {
        setResendTimer(30);
        setSuccess("OTP resent! Please check your phone.");
      }
    } catch (err) {
      setError("Failed to resend OTP. Please try again.");
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

  // Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/login`, {
        staff_id: staffId.toUpperCase(),
        password: password
      });

      if (res.data.requires_otp) {
        setStep("otp_verify");
        setSuccess(res.data.message || "OTP sent to your email for verification");
      } else if (res.data.success) {
        localStorage.setItem("asrStaffAuth", "true");
        localStorage.setItem("asrStaffData", JSON.stringify(res.data.staff));
        localStorage.setItem("asrStaffToken", res.data.token);
        navigate("/staff/portal");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid Staff ID or Password");
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
        localStorage.setItem("asrStaffAuth", "true");
        localStorage.setItem("asrStaffData", JSON.stringify(res.data.staff));
        localStorage.setItem("asrStaffToken", res.data.token);
        navigate("/staff/portal");
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
        localStorage.setItem("asrStaffAuth", "true");
        localStorage.setItem("asrStaffData", JSON.stringify(res.data.staff));
        localStorage.setItem("asrStaffToken", res.data.token);
        navigate("/staff/portal");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7FAFC] via-white to-[#E0F2FE] flex items-center justify-center p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-md w-full">
        <Link to="/" className="flex items-center text-gray-600 hover:text-[#0B3C5D] mb-6 transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
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
          <div className="flex bg-gray-100 rounded-xl p-1.5 mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setOtpSent(false); setError(""); setSuccess(""); setStep("credentials"); resetMobileOTPFlow(); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${loginMethod === "password" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
            >
              <Lock className="w-3.5 h-3.5" />Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("email_otp"); setError(""); setSuccess(""); setOtpSent(false); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${loginMethod === "email_otp" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
            >
              <Mail className="w-3.5 h-3.5" />Email OTP
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("mobile_otp"); setError(""); setSuccess(""); resetMobileOTPFlow(); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${loginMethod === "mobile_otp" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
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

          {/* Password Login */}
          {loginMethod === "password" && (
            step === "credentials" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
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
                <span>{loading ? "Logging in..." : "Login"}</span>
              </button>
            </form>
            ) : (
            <form onSubmit={handleVerify2FA} className="space-y-5">
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
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                <span>{loading ? "Verifying..." : "Verify OTP"}</span>
              </button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setEmailOtp(""); setSuccess(""); }}
                className="w-full text-gray-500 text-sm hover:text-[#0B3C5D]"
              >
                ← Back to login
              </button>
            </form>
            )
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
