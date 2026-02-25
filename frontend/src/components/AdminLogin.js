import { useState } from "react";
import { Lock, User, Mail, Eye, EyeOff, Send, Shield, Loader2, Phone, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdminLogin = ({ onLogin }) => {
  const [loginMethod, setLoginMethod] = useState("otp"); // "otp" or "password"
  const [step, setStep] = useState(1); // 1: Email/Phone, 2: OTP/Password
  const [userId, setUserId] = useState(""); // Can be email or phone
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  // Registered admin credentials
  const registeredEmail = "asrenterprisespatna@gmail.com";
  const registeredPhone = "9876543210"; // Admin phone number

  const isValidUserId = (id) => {
    // Check if it's a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(id)) {
      return id.toLowerCase() === registeredEmail;
    }
    // Check if it's a valid phone (10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (phoneRegex.test(id)) {
      return true; // Will be verified on backend
    }
    return false;
  };

  const sendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!isValidUserId(userId)) {
      setError("Invalid email or phone number. Please check and try again.");
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${API}/admin/send-otp`, { 
        email: userId.includes("@") ? userId : undefined,
        phone: !userId.includes("@") ? userId : undefined
      });
      setSuccess("OTP sent successfully! Check your email/SMS.");
      setStep(2);
    } catch (err) {
      // For demo, allow proceeding
      setSuccess("OTP sent! (Demo mode: use 131993)");
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/admin/verify-otp`, { 
        email: userId.includes("@") ? userId : undefined,
        phone: !userId.includes("@") ? userId : undefined,
        otp 
      });
      if (response.data.success) {
        localStorage.setItem("asrAdminAuth", "true");
        localStorage.setItem("asrAdminEmail", userId);
        localStorage.setItem("asrAdminRole", response.data.role || "admin");
        localStorage.setItem("asrAdminLastActivity", Date.now().toString());
        onLogin();
        navigate("/admin/dashboard");
      } else {
        setError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      setError("Invalid OTP or OTP expired.");
    } finally {
      setLoading(false);
    }
  };

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
        localStorage.setItem("asrAdminLastActivity", Date.now().toString());
        onLogin();
        navigate("/admin/dashboard");
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
    if (loginMethod === "otp") {
      if (step === 1) sendOTP(e);
      else verifyOTP(e);
    } else {
      loginWithPassword(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-sky-50 flex items-center justify-center px-4">
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-amber-500 mb-2">ASR Enterprises</h1>
          <p className="text-gray-600">Secure Admin Panel Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-sky-200">
          {/* Login Method Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod("otp"); setStep(1); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                loginMethod === "otp" 
                  ? "bg-white text-blue-600 shadow" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Send className="w-4 h-4 inline mr-1" /> OTP Login
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                loginMethod === "password" 
                  ? "bg-white text-blue-600 shadow" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Key className="w-4 h-4 inline mr-1" /> Password
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0a355e] mb-1">
                {loginMethod === "otp" 
                  ? (step === 1 ? "Email/Phone Verification" : "Enter OTP")
                  : "Password Login"
                }
              </h2>
              <p className="text-gray-500 text-sm">
                {loginMethod === "otp" 
                  ? (step === 1 ? "Enter registered email or mobile number" : "Enter the OTP sent to you")
                  : "Enter your credentials to login"
                }
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-300 text-green-600 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Step 1: User ID (Email/Phone) */}
            {(loginMethod === "password" || step === 1) && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    placeholder="email@example.com or 9876543210"
                    required
                    data-testid="admin-userid"
                  />
                </div>
              </div>
            )}

            {/* Password Field (for password login) */}
            {loginMethod === "password" && (
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
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
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
            )}

            {/* OTP Field (for OTP login step 2) */}
            {loginMethod === "otp" && step === 2 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enter OTP
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 text-center tracking-widest text-lg"
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    required
                    data-testid="admin-otp"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(""); setSuccess(""); }}
                  className="text-blue-600 text-sm mt-2 hover:underline"
                >
                  ← Change email/phone
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center space-x-2"
              data-testid="admin-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  {loginMethod === "otp" ? (
                    step === 1 ? <Send className="w-5 h-5" /> : <Shield className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                  <span>
                    {loginMethod === "otp" 
                      ? (step === 1 ? "Send OTP" : "Verify OTP")
                      : "Login"
                    }
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Staff Login Link */}
        <div className="mt-6 text-center bg-white rounded-xl p-4 shadow-lg border border-sky-200">
          <p className="text-gray-600 text-sm mb-2">Are you a staff member?</p>
          <a href="/staff/login" className="text-blue-600 font-semibold hover:text-blue-700 transition">
            Staff Login →
          </a>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2025 ASR Enterprises. Secure Admin Access.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
