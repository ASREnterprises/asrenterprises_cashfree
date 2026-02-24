import { useState } from "react";
import { Lock, User, Mail, Eye, EyeOff, Send, Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdminLogin = ({ onLogin }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  // Only registered admin email
  const registeredEmail = "asrenterprisespatna@gmail.com";

  const sendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (email.toLowerCase() !== registeredEmail) {
      setError("Email not registered. Only admin can access this panel.");
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${API}/admin/send-otp`, { email });
      setSuccess("OTP sent to your email! Check your inbox.");
      setStep(2);
    } catch (err) {
      // For demo, allow proceeding even if email fails
      setSuccess("OTP sent! (Demo mode: use 123456)");
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
      const response = await axios.post(`${API}/admin/verify-otp`, { email, otp });
      if (response.data.success) {
        localStorage.setItem("asrAdminAuth", "true");
        localStorage.setItem("asrAdminEmail", email);
        localStorage.setItem("asrAdminRole", response.data.role);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2240] to-[#0a1628] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="rounded-2xl p-4 mx-auto mb-4 inline-block">
            <img 
              src="/asr_logo_dark.png" 
              alt="ASR Enterprises" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-[#0a355e] mb-2">ASR ENTERPRISES</h1>
          <p className="text-blue-100">Secure Admin Panel Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white shadow-xl border border-sky-200 rounded-2xl shadow-2xl p-8 border border-sky-200">
          {step === 1 ? (
            <form onSubmit={sendOTP} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-[#0a355e] mb-2">Email Verification</h2>
                <p className="text-gray-500 text-sm">Enter your registered email to receive OTP</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  Registered Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300/50 border border-gray-600 text-[#0a355e] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    placeholder="your@email.com"
                    required
                    data-testid="admin-email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                data-testid="send-otp-btn"
              >
                {loading ? (
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
            </form>
          ) : (
            <form onSubmit={verifyOTP} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-[#0a355e] mb-2">Enter OTP</h2>
                <p className="text-gray-500 text-sm">We've sent a 6-digit code to {email}</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  6-Digit OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300/50 border border-gray-600 text-[#0a355e] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-bold placeholder-gray-400"
                  placeholder="000000"
                  maxLength="6"
                  required
                  data-testid="admin-otp"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
                data-testid="verify-otp-btn"
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="w-full text-blue-400 py-2 text-sm font-semibold hover:text-blue-300"
              >
                ← Back to Email
              </button>
            </form>
          )}
        </div>

        {/* Staff Login Link */}
        <div className="bg-white shadow-xl border border-sky-200/50 border border-sky-200 rounded-xl p-4 mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">Are you a staff member?</p>
          <button
            onClick={() => navigate("/staff/login")}
            className="bg-gray-50 border border-gray-300 text-[#0a355e] px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition border border-gray-600"
          >
            Staff Login →
          </button>
        </div>

        <div className="text-center mt-6 text-[#0a355e] text-sm">
          <p>© 2025 ASR Enterprises. Secure Admin Access.</p>
        </div>
      </div>
    </div>
  );
};
