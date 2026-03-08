import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { User, Lock, LogIn, Loader2, ArrowLeft, Mail, KeyRound, Phone, Send, CheckCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const StaffLogin = () => {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginMethod, setLoginMethod] = useState("password"); // password, email_otp, or mobile_otp
  const [otpSent, setOtpSent] = useState(false);
  const [step, setStep] = useState("credentials"); // credentials or otp_verify
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const navigate = useNavigate();

  // Listen for MSG91 OTP verification success
  useEffect(() => {
    const handleOtpVerified = async (event) => {
      console.log("Staff OTP Verified:", event.detail);
      
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
      
      // Auto-login after OTP verification - call API directly
      setLoading(true);
      setError("");
      
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
          setOtpVerified(false);
        }
      } catch (err) {
        console.error("Staff OTP Login error:", err);
        setError(err.response?.data?.detail || "Mobile number not registered for staff access.");
        setOtpVerified(false);
      } finally {
        setLoading(false);
      }
    };
    
    window.addEventListener('otpVerifiedStaffLogin', handleOtpVerified);
    return () => window.removeEventListener('otpVerifiedStaffLogin', handleOtpVerified);
  }, [mobileNumber, navigate]);

  // Trigger MSG91 OTP for staff login
  const sendMobileOTP = () => {
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
    
    if (typeof window.initSendOTP === 'function') {
      // Store the mobile number for the success callback
      const storedMobile = phoneNumber;
      
      const loginConfig = {
        widgetId: "366367775a6a363731333933",
        tokenAuth: "498782Ts6ZESL8A69acbb0aP1",
        identifier: phoneNumber,
        exposeMethods: true,
        success: function (data) {
          console.log("Staff OTP Verified", data);
          // Include the mobile number in the event detail
          window.dispatchEvent(new CustomEvent('otpVerifiedStaffLogin', { 
            detail: { ...data, identifier: storedMobile, mobile: storedMobile }
          }));
        },
        failure: function (error) {
          console.log("Staff OTP Failed", error);
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
      setError("OTP service is not available. Please refresh the page.");
      setOtpLoading(false);
    }
  };

  // Handle mobile OTP login
  const handleMobileOTPLogin = async () => {
    setLoading(true);
    setError("");
    
    try {
      const res = await axios.post(`${API}/admin/login-otp`, {
        mobile: mobileNumber.replace(/\D/g, '')
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
        setOtpVerified(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Mobile number not registered for staff access.");
      setOtpVerified(false);
    } finally {
      setLoading(false);
    }
  };

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

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/verify-2fa`, {
        staff_id: staffId.toUpperCase(),
        password: password,
        otp: otp
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

  const handleSendOtp = async () => {
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

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/verify-otp`, {
        staff_id: staffId.toUpperCase(),
        otp: otp
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
              onClick={() => { setLoginMethod("password"); setOtpSent(false); setError(""); setSuccess(""); setStep("credentials"); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${loginMethod === "password" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
            >
              <Lock className="w-3.5 h-3.5" />Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("email_otp"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${loginMethod === "email_otp" ? "bg-white text-[#0B3C5D] shadow-md" : "text-gray-500"}`}
            >
              <Mail className="w-3.5 h-3.5" />Email OTP
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("mobile_otp"); setError(""); setSuccess(""); setOtpVerified(false); }}
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
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                onClick={() => { setStep("credentials"); setOtp(""); setSuccess(""); }}
                className="w-full text-gray-500 text-sm hover:text-[#0B3C5D]"
              >
                ← Back to login
              </button>
            </form>
            )
          )}

          {/* Email OTP Login */}
          {loginMethod === "email_otp" && (
            <form onSubmit={handleOtpLogin} className="space-y-5">
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
                  onClick={handleSendOtp}
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
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                    onClick={() => { setOtpSent(false); setOtp(""); setSuccess(""); }}
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
                <p className="text-gray-500 text-sm">Enter your registered mobile number</p>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2">
                  Mobile Number {otpVerified && <span className="text-green-600">(Verified ✓)</span>}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                        setOtpVerified(false);
                        setError("");
                      }}
                      placeholder="10-digit mobile"
                      className={`w-full bg-gray-50 border ${otpVerified ? 'border-green-500 bg-green-50' : 'border-gray-300'} text-[#0B3C5D] pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:outline-none`}
                      maxLength={10}
                      disabled={otpVerified || loading}
                      data-testid="staff-mobile"
                    />
                  </div>
                  {!otpVerified && !loading && (
                    <button
                      type="button"
                      onClick={sendMobileOTP}
                      disabled={otpLoading || mobileNumber.length < 10}
                      className="px-4 py-3 bg-[#00C389] text-white rounded-xl font-semibold hover:bg-[#00A372] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                      data-testid="staff-send-otp"
                    >
                      {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      {otpLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  )}
                  {otpVerified && (
                    <span className="px-4 py-3 bg-green-500 text-white rounded-xl flex items-center">
                      <CheckCircle className="w-5 h-5" />
                    </span>
                  )}
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-[#F5A623] mr-2" />
                  <span className="text-gray-600">Logging in...</span>
                </div>
              )}

              {!otpVerified && !otpLoading && mobileNumber.length >= 10 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
                  Click "Send OTP" to receive verification code
                </div>
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
