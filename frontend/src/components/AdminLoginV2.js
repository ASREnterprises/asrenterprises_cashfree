/**
 * AdminLoginV2 — UI rebrand to match Solar Advisor login.
 * Same auth endpoints as the legacy AdminLogin.js:
 *   • password mode: POST /api/admin/login-password
 *   • OTP mode (Email):    /admin/send-otp-smart channel=email   → /admin/verify-otp
 *   • OTP mode (WhatsApp): /admin/send-otp-smart channel=whatsapp → /admin/verify-otp
 *
 * Visual: white card on purple→indigo gradient, ASR brand header,
 * Password / OTP top tabs, Email-OTP / WhatsApp-OTP sub-tabs.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Lock, User, Eye, EyeOff, LogIn, AlertCircle,
  Loader2, MessageCircle, Mail, ChevronRight, ShieldCheck,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const OWNER_EMAIL_DEFAULT = "asrenterprisespatna@gmail.com";

export const AdminLogin = ({ onLogin }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("password");          // password | otp
  const [otpChannel, setOtpChannel] = useState("email"); // email | whatsapp

  const [userId, setUserId] = useState(OWNER_EMAIL_DEFAULT);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [maskedTarget, setMaskedTarget] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const timerRef = useRef(null);
  useEffect(() => {
    if (resendIn <= 0) return;
    timerRef.current = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [resendIn]);

  const persistLogin = (data) => {
    // Persist the same keys the rest of the app reads from localStorage
    const adminEmail = (data?.email || data?.user_id || OWNER_EMAIL_DEFAULT).toLowerCase();
    const adminName = data?.name || "ABHIJEET KUMAR";
    const adminRole = (data?.role || "admin").toLowerCase();
    const staffId = (data?.staff_id || "ASR1001").toUpperCase();
    localStorage.setItem("asrAdminAuth", "true");
    localStorage.setItem("asrAdminEmail", adminEmail);
    localStorage.setItem("asrAdminName", adminName);
    localStorage.setItem("asrAdminRole", adminRole);
    localStorage.setItem("asrAdminStaffId", staffId);
    localStorage.setItem("asrAdminLastActivity", String(Date.now()));
    if (data?.token) localStorage.setItem("asrAdminToken", data.token);
    if (typeof onLogin === "function") onLogin(data);
    navigate("/admin/dashboard");
  };

  // ── PASSWORD ───────────────────────────────────────────────────────────────
  const submitPassword = async (e) => {
    e?.preventDefault?.();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const r = await axios.post(`${API}/admin/login-password`, {
        user_id: (userId || "").trim(),
        password,
        direct_login: true,
      });
      if (r.data?.success || r.data?.access_token || r.data?.token) {
        setSuccess("Welcome back. Redirecting…");
        setTimeout(() => persistLogin(r.data || {}), 250);
      } else {
        setError(r.data?.detail || "Login failed.");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Invalid credentials.");
    } finally { setLoading(false); }
  };

  // ── OTP ────────────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const r = await axios.post(`${API}/admin/send-otp-smart`,
        { channel: otpChannel, purpose: "login" });
      if (r.data?.success) {
        setOtpSent(true);
        setResendIn(r.data?.resend_in || 60);
        setMaskedTarget(r.data?.masked_recipient || "");
        const ch = (r.data.channel_used || otpChannel).toUpperCase();
        setSuccess(`OTP delivered via ${ch.replace("+", " + ")}. Valid 5 minutes.`);
      } else {
        setError(r.data?.detail || "Could not send OTP.");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to send OTP. Try the other channel.");
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault?.();
    if (otp.length < 6) { setError("Enter the 6-digit OTP"); return; }
    setError(""); setLoading(true);
    try {
      const r = await axios.post(`${API}/admin/verify-otp`, { email: OWNER_EMAIL_DEFAULT, otp });
      if (r.data?.success || r.data?.access_token || r.data?.token) {
        setSuccess("Verified. Redirecting…");
        setTimeout(() => persistLogin(r.data || {}), 250);
      } else {
        setError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Verification failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-purple-200 hover:text-white mb-4 inline-flex items-center text-sm" data-testid="admin-login-back">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to Login
        </Link>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-3 mb-4 justify-center">
              <img src="/asr_logo_transparent.png" alt="ASR Enterprises" className="h-12 w-auto" />
              <div className="text-left">
                <div className="font-extrabold text-lg text-gray-800">ASR Enterprises</div>
                <div className="text-xs text-purple-600">Super Admin Portal</div>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>
            <p className="text-gray-500 text-sm mt-1">Owner & Super-Admin access only</p>
          </div>

          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => { setMode("password"); setError(""); setSuccess(""); setOtpSent(false); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                mode === "password" ? "bg-white text-purple-700 shadow" : "text-gray-600"}`}
              data-testid="admin-login-mode-password"
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                mode === "otp" ? "bg-white text-purple-700 shadow" : "text-gray-600"}`}
              data-testid="admin-login-mode-otp"
            >
              OTP
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2" data-testid="admin-login-error">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2" data-testid="admin-login-success">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" /> {success}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email" value={userId} onChange={(e) => setUserId(e.target.value)}
                    required placeholder="asrenterprisespatna@gmail.com"
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    data-testid="admin-login-email"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPw ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Your admin password"
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    data-testid="admin-login-password"
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      data-testid="admin-login-submit">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                         : <><LogIn className="w-4 h-4" /> Login</>}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg" data-testid="admin-otp-channel-switch">
                <button type="button"
                        onClick={() => { setOtpChannel("email"); setOtpSent(false); setError(""); setSuccess(""); }}
                        className={`py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1 ${
                          otpChannel === "email" ? "bg-white text-purple-700 shadow" : "text-gray-500"}`}
                        data-testid="admin-otp-channel-email">
                  <Mail className="w-3.5 h-3.5" /> Email OTP
                </button>
                <button type="button"
                        onClick={() => { setOtpChannel("whatsapp"); setOtpSent(false); setError(""); setSuccess(""); }}
                        className={`py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1 ${
                          otpChannel === "whatsapp" ? "bg-white text-purple-700 shadow" : "text-gray-500"}`}
                        data-testid="admin-otp-channel-whatsapp">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp OTP
                </button>
              </div>

              {!otpSent ? (
                <button type="button" onClick={sendOtp} disabled={loading}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        data-testid="admin-send-otp-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" />
                           : (otpChannel === "email" ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />)}
                  Send OTP via {otpChannel === "email" ? "Email" : "WhatsApp"}
                </button>
              ) : (
                <>
                  {maskedTarget && (
                    <p className="text-xs text-gray-500">Sent to <strong>{maskedTarget}</strong> · valid 5 min</p>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                    <input
                      type="text" inputMode="numeric" value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit OTP" maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-xl tracking-[0.5em] font-bold"
                      data-testid="admin-otp-input" autoFocus
                    />
                  </div>
                  <button type="submit" disabled={loading || otp.length < 6}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                          data-testid="admin-verify-otp-btn">
                    {loading ? "Verifying…" : "Verify & Login"}
                  </button>
                  <div className="flex justify-between items-center text-xs">
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }}
                            className="text-gray-500 hover:text-purple-700">
                      ← Change channel
                    </button>
                    <button type="button" disabled={resendIn > 0 || loading} onClick={sendOtp}
                            className={resendIn > 0 ? "text-gray-400" : "text-purple-600 hover:text-purple-800 font-semibold"}
                            data-testid="admin-resend-otp">
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm">
            <span className="text-gray-600">Are you a staff member? </span>
            <Link to="/staff/login" className="text-purple-600 hover:text-purple-800 font-semibold" data-testid="admin-login-to-staff">
              Staff Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
