import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { User, Lock, LogIn, Loader2, ArrowLeft, Mail, KeyRound } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const StaffLogin = () => {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginMethod, setLoginMethod] = useState("password"); // password or otp
  const [otpSent, setOtpSent] = useState(false);
  const [step, setStep] = useState("credentials"); // credentials or otp_verify
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link to="/" className="flex items-center text-gray-500 hover:text-[#0a355e] mb-6 transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="bg-white shadow-lg border border-sky-200 rounded-2xl shadow-2xl p-8 border border-sky-200">
          <div className="text-center mb-8">
            <div className="rounded-xl p-3 inline-block mb-4">
              <img 
                src="/asr_logo_dark.png" 
                alt="ASR Enterprises" 
                className="h-14 w-auto"
              />
            </div>
            <h1 className="text-2xl font-bold text-[#0a355e]">Staff Portal</h1>
            <p className="text-gray-500 mt-2">ASR Enterprises CRM</p>
          </div>

          {/* Login Method Toggle */}
          <div className="flex space-x-2 mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setOtpSent(false); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-lg font-medium transition ${loginMethod === "password" ? "bg-blue-600 text-[#0a355e]" : "bg-gray-50 border border-gray-300 text-gray-500"}`}
            >
              <Lock className="w-4 h-4 inline mr-2" />Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("otp"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-lg font-medium transition ${loginMethod === "otp" ? "bg-blue-600 text-[#0a355e]" : "bg-gray-50 border border-gray-300 text-gray-500"}`}
            >
              <Mail className="w-4 h-4 inline mr-2" />Email OTP
            </button>
          </div>

          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500 bg-opacity-20 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6 text-center">
              {success}
            </div>
          )}

          {loginMethod === "password" ? (
            step === "credentials" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-6">
              <div>
                <label className="block text-gray-500 text-sm font-medium mb-2">Staff ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                    placeholder="ASR1001"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                    required
                    data-testid="staff-id-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                    data-testid="staff-password-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !staffId || !password}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                data-testid="staff-login-btn"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5" /><span>Login</span></>}
              </button>
            </form>
            ) : (
            <form onSubmit={handleVerify2FA} className="space-y-6">
              <div className="bg-blue-500 bg-opacity-10 border border-blue-500/30 rounded-lg p-4 text-center">
                <KeyRound className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-blue-300 text-sm">OTP sent to your registered email</p>
                <p className="text-gray-500 text-xs mt-1">Enter the 6-digit code to complete login</p>
              </div>

              <div>
                <label className="block text-gray-500 text-sm font-medium mb-2">Enter OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit OTP"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-center text-xl tracking-widest"
                    maxLength={6}
                    required
                    autoFocus
                    data-testid="staff-2fa-otp-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                data-testid="staff-verify-2fa-btn"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5" /><span>Verify & Login</span></>}
              </button>

              <button
                type="button"
                onClick={() => { setStep("credentials"); setOtp(""); setError(""); setSuccess(""); }}
                className="w-full text-gray-500 hover:text-[#0a355e] py-2 transition text-sm"
              >
                Back to Login
              </button>
            </form>
            )
          ) : (
            <form onSubmit={handleOtpLogin} className="space-y-6">
              <div>
                <label className="block text-gray-500 text-sm font-medium mb-2">Staff ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => { setStaffId(e.target.value.toUpperCase()); setOtpSent(false); }}
                    placeholder="ASR1001"
                    className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                    required
                    disabled={otpSent}
                    data-testid="staff-id-otp-input"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !staffId}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                  data-testid="send-otp-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mail className="w-5 h-5" /><span>Send OTP to Email</span></>}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-500 text-sm font-medium mb-2">Enter OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-center text-xl tracking-widest"
                        maxLength={6}
                        required
                        data-testid="otp-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                    data-testid="verify-otp-btn"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5" /><span>Verify & Login</span></>}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full text-gray-500 hover:text-[#0a355e] py-2 transition"
                  >
                    Resend OTP
                  </button>
                </>
              )}
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">Contact admin if you need help</p>
          </div>

          <div className="mt-6 pt-6 border-t border-sky-200 text-center">
            <Link to="/admin/login" className="text-blue-400 hover:text-blue-300 text-sm">
              Admin Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
