import { useState, useEffect } from "react";
import { Lock, User, Eye, EyeOff, Send, Shield, Loader2, Phone, Key, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdminLogin = ({ onLogin }) => {
  const [loginMethod, setLoginMethod] = useState("password"); // "otp" or "password"
  const [userId, setUserId] = useState(""); // Email for password login
  const [mobileNumber, setMobileNumber] = useState(""); // Mobile for OTP login
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState("");
  const navigate = useNavigate();

  // Listen for MSG91 OTP verification success
  useEffect(() => {
    const handleOtpVerified = async (event) => {
      console.log("OTP Verified for Login:", event.detail);
      
      // Get mobile from event detail (MSG91 returns the identifier)
      const verifiedPhone = event.detail?.identifier || event.detail?.mobile || mobileNumber;
      let cleanMobile = verifiedPhone.replace(/\D/g, '');
      
      // Remove country code if present
      if (cleanMobile.startsWith("91") && cleanMobile.length === 12) {
        cleanMobile = cleanMobile.slice(2);
      }
      
      console.log("Verified mobile number:", cleanMobile);
      
      setOtpVerified(true);
      setOtpLoading(false);
      setVerifiedMobile(cleanMobile);
      
      // Auto-login after OTP verification - call API directly with the verified mobile
      setLoading(true);
      setError("");
      
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
            // Redirect based on role
            if (response.data.role === "staff") {
              navigate("/staff/dashboard");
            } else {
              navigate("/admin/dashboard");
            }
          }, 1000);
        } else {
          setError(response.data.message || "Mobile number not registered. Contact admin.");
          setOtpVerified(false);
        }
      } catch (err) {
        console.error("OTP Login error:", err);
        setError(err.response?.data?.detail || "Mobile number not registered for admin/staff access.");
        setOtpVerified(false);
      } finally {
        setLoading(false);
      }
    };
    
    window.addEventListener('otpVerifiedLogin', handleOtpVerified);
    return () => window.removeEventListener('otpVerifiedLogin', handleOtpVerified);
  }, [mobileNumber, onLogin, navigate]);

  // Trigger MSG91 OTP for login
  const sendLoginOTP = () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    
    // Format phone number (add 91 prefix if not present)
    let phoneNumber = mobileNumber.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setError("");
    
    // Configure MSG91 for login with custom success handler
    if (typeof window.initSendOTP === 'function') {
      // Store the mobile number for the success callback
      const storedMobile = phoneNumber;
      
      const loginConfig = {
        widgetId: "366367775a6a363731333933",
        tokenAuth: "498782Ts6ZESL8A69acbb0aP1",
        identifier: phoneNumber,
        exposeMethods: true,
        success: function (data) {
          console.log("OTP Verified for Login", data);
          // Include the mobile number in the event detail
          window.dispatchEvent(new CustomEvent('otpVerifiedLogin', { 
            detail: { ...data, identifier: storedMobile, mobile: storedMobile }
          }));
        },
        failure: function (error) {
          console.log("OTP Failed", error);
          setOtpLoading(false);
          setError("OTP verification failed. Please try again.");
        },
        VAR1: "OTP"
      };
      window.initSendOTP(loginConfig);
      
      // Reset loading state after widget opens (MSG91 widget handles the rest)
      setTimeout(() => {
        setOtpLoading(false);
      }, 1500);
    } else {
      setError("OTP service is not available. Please refresh the page and try again.");
      setOtpLoading(false);
    }
  };

  // Handle OTP-based login after verification
  const handleOTPLogin = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await axios.post(`${API}/admin/login-otp`, { 
        mobile: mobileNumber.replace(/\D/g, '')
      });
      
      if (response.data.success) {
        localStorage.setItem("asrAdminAuth", "true");
        localStorage.setItem("asrAdminEmail", response.data.email || mobileNumber);
        localStorage.setItem("asrAdminRole", response.data.role || "admin");
        localStorage.setItem("asrAdminName", response.data.name || "Admin");
        localStorage.setItem("asrAdminLastActivity", Date.now().toString());
        
        setSuccess("Login successful! Redirecting...");
        
        setTimeout(() => {
          onLogin();
          // Redirect based on role
          if (response.data.role === "staff") {
            navigate("/staff/dashboard");
          } else {
            navigate("/admin/dashboard");
          }
        }, 1000);
      } else {
        setError(response.data.message || "Mobile number not registered. Contact admin.");
        setOtpVerified(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Mobile number not registered for admin/staff access.");
      setOtpVerified(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle password-based login
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
        localStorage.setItem("asrAdminAuth", "true");
        localStorage.setItem("asrAdminEmail", response.data.email || userId);
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
        setError(response.data.message || "Invalid credentials.");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loginMethod === "password") {
      loginWithPassword(e);
    }
    // OTP login is handled by MSG91 callback
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
          {/* Login Method Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1.5 mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setError(""); setSuccess(""); }}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                loginMethod === "password" 
                  ? "bg-white text-[#0B3C5D] shadow-md" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Key className="w-4 h-4" /> Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("otp"); setError(""); setSuccess(""); setOtpVerified(false); }}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                loginMethod === "otp" 
                  ? "bg-white text-[#0B3C5D] shadow-md" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Phone className="w-4 h-4" /> Mobile OTP
            </button>
          </div>

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

          {/* Password Login Form */}
          {loginMethod === "password" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B3C5D] mb-1 font-[Poppins]">
                  Password Login
                </h2>
                <p className="text-gray-500 text-sm">
                  Enter your email and password
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400"
                    placeholder="admin@example.com"
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
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>Login</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Login Form */}
          {loginMethod === "otp" && (
            <div className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B3C5D] mb-1 font-[Poppins]">
                  Mobile OTP Login
                </h2>
                <p className="text-gray-500 text-sm">
                  Enter your registered mobile number
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mobile Number {otpVerified && <span className="text-green-600">(Verified ✓)</span>}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                        setOtpVerified(false);
                        setError("");
                      }}
                      className={`w-full pl-10 pr-4 py-3 bg-gray-50 border ${otpVerified ? 'border-green-500 bg-green-50' : 'border-gray-300'} text-gray-800 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent placeholder-gray-400`}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      disabled={otpVerified || loading}
                      data-testid="admin-mobile"
                    />
                  </div>
                  {!otpVerified && !loading && (
                    <button
                      type="button"
                      onClick={sendLoginOTP}
                      disabled={otpLoading || mobileNumber.length < 10}
                      className="px-5 py-3 bg-[#00C389] text-white rounded-xl font-semibold hover:bg-[#00A372] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                      data-testid="send-login-otp"
                    >
                      {otpLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      {otpLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  )}
                  {otpVerified && (
                    <span className="px-4 py-3 bg-green-500 text-white rounded-xl font-semibold flex items-center">
                      <CheckCircle className="w-5 h-5" />
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  OTP will be sent to your registered mobile number
                </p>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-[#F5A623] mr-2" />
                  <span className="text-gray-600">Verifying and logging in...</span>
                </div>
              )}

              {!otpVerified && !otpLoading && mobileNumber.length >= 10 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
                  <p>Click "Send OTP" to receive verification code on your mobile</p>
                </div>
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
