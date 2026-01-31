import { useState } from "react";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useState } from "react";
import { Lock, User, Mail, Eye, EyeOff, Send, Shield } from "lucide-react";
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

  // Registered admin emails
  const registeredEmails = [
    "asrenterprisespatna@gmail.com",
    "admin@asrenterprises.com",
    "manager@asrenterprises.com"
  ];

  const sendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!registeredEmails.includes(email.toLowerCase())) {
      setError("Email not registered. Please contact administrator.");
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${API}/admin/send-otp`, { email });
      setSuccess("OTP sent to your email! Check your inbox.");
      setStep(2);
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">ASR ENTERPRISES</h1>
          <p className="text-blue-100">Secure Admin Panel Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === 1 ? (
            <form onSubmit={sendOTP} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verification</h2>
                <p className="text-gray-600 text-sm">Enter your registered email to receive OTP</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Registered Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                    data-testid="admin-email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
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

              <div className="mt-6 text-center text-xs text-gray-600">
                <p className="font-semibold mb-2">Registered Emails:</p>
                <p className="font-mono bg-gray-50 p-2 rounded">asrenterprisespatna@gmail.com</p>
              </div>
            </form>
          ) : (
            <form onSubmit={verifyOTP} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter OTP</h2>
                <p className="text-gray-600 text-sm">We've sent a 6-digit code to {email}</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  6-Digit OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-bold"
                  placeholder="000000"
                  maxLength="6"
                  required
                  data-testid="admin-otp"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
                data-testid="verify-otp-btn"
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="w-full text-blue-600 py-2 text-sm font-semibold hover:text-blue-700"
              >
                ← Back to Email
              </button>

              <div className="mt-4 text-center text-xs text-gray-600 bg-yellow-50 p-3 rounded">
                <p className="font-semibold">For Demo: Use OTP <span className="font-mono text-lg">123456</span></p>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-6 text-white text-sm">
          <p>© 2025 ASR Enterprises. Secure Admin Access.</p>
        </div>
      </div>
    </div>
  );
};
