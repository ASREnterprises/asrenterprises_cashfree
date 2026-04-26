/**
 * StaffLoginV2 — UI rebrand to match Solar Advisor login.
 * Auth endpoints:
 *   • password mode: POST /api/staff/login         { staff_id, password }
 *   • Email OTP:    /api/staff/send-otp-smart channel=email + /staff/verify-otp
 *   • WhatsApp OTP: /api/staff/send-otp-smart channel=whatsapp + /staff/verify-otp
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Lock, User, Eye, EyeOff, LogIn, AlertCircle,
  Loader2, MessageCircle, Mail, ChevronRight, ShieldCheck, IdCard,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function routeByRole(staffData, navigate, setError) {
  const role = (staffData?.role || "").toLowerCase();
  const staffId = (staffData?.staff_id || "").toUpperCase();
  const isOwner = staffData?.is_owner === true || staffData?.is_super_admin === true;

  if (role === "super_admin" || isOwner || staffId === "ASR1001") {
    setError("This is the Super Admin account. Use the Admin Login at /admin/login.");
    return false;
  }
  if (role === "solar_advisor") {
    setError("Solar Advisors must log in at the Solar Advisor portal.");
    return false;
  }
  return true;
}

export const StaffLogin = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("password");
  const [otpChannel, setOtpChannel] = useState("email");

  const [staffId, setStaffId] = useState("");
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

  const persistLogin = (staff, token) => {
    if (!routeByRole(staff, navigate, setError)) return;
    // CRITICAL: persist the FULL staff object as JSON so that StaffPortal.js
    // (which reads localStorage["asrStaffData"]) can hydrate. Earlier versions
    // only set individual keys → portal kicked the user back to /staff/login
    // because data was missing. This is the fix for that bounce loop.
    localStorage.setItem("asrStaffAuth", "true");
    localStorage.setItem("asrStaffData", JSON.stringify(staff || {}));
    localStorage.setItem("asrStaffId", (staff?.staff_id || "").toUpperCase());
    localStorage.setItem("asrStaffName", staff?.name || "");
    localStorage.setItem("asrStaffRole", staff?.role || "staff");
    localStorage.setItem("asrStaffDepartment", staff?.department || "");
    localStorage.setItem("asrStaffEmail", staff?.email || "");
    if (token) localStorage.setItem("asrStaffToken", token);
    localStorage.setItem("asrStaffLastActivity", String(Date.now()));
    // Per business policy, managers + admin-dept staff land on the Admin
    // Dashboard; everyone else uses the Staff Portal.
    const role = (staff?.role || "").toLowerCase();
    const dept = (staff?.department || "").toLowerCase();
    const isAdminMgr = role === "manager" && dept === "admin";
    if (isAdminMgr || role === "admin") {
      // Map onto Admin localStorage so ProtectedRoute admits them.
      localStorage.setItem("asrAdminAuth", "true");
      localStorage.setItem("asrAdminEmail", staff?.email || "");
      localStorage.setItem("asrAdminName", staff?.name || "");
      localStorage.setItem("asrAdminRole", role || "manager");
      localStorage.setItem("asrAdminStaffId", (staff?.staff_id || "").toUpperCase());
      localStorage.setItem("asrAdminLastActivity", String(Date.now()));
      navigate("/admin/dashboard");
    } else {
      navigate("/staff/portal");
    }
  };

  const submitPassword = async (e) => {
    e?.preventDefault?.();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const raw = (staffId || "").trim();
      const looksLikeEmail = raw.includes("@");
      const r = await axios.post(`${API}/staff/login`, {
        staff_id: looksLikeEmail ? raw.toLowerCase() : raw.toUpperCase(),
        password,
      });
      if (r.data?.success && r.data?.staff) {
        setSuccess("Welcome. Redirecting…");
        setTimeout(() => persistLogin(r.data.staff, r.data.token), 250);
      } else {
        setError("Login failed.");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Invalid Staff ID / Email or password.");
    } finally { setLoading(false); }
  };

  const sendOtp = async () => {
    if (!staffId || staffId.length < 4) { setError("Enter your Staff ID or Email first"); return; }
    setError(""); setSuccess(""); setLoading(true);
    const raw = staffId.trim();
    const idNorm = raw.includes("@") ? raw.toLowerCase() : raw.toUpperCase();
    try {
      const r = await axios.post(`${API}/staff/send-otp-smart`, {
        staff_id: idNorm, channel: otpChannel,
      });
      if (r.data?.success) {
        setOtpSent(true);
        setResendIn(r.data?.resend_in || 60);
        setMaskedTarget(r.data?.masked_recipient || "");
        setSuccess(`OTP sent via ${(r.data.channel_used || otpChannel).toUpperCase()}. Valid 5 min.`);
      } else {
        setError("Could not send OTP.");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to send OTP. Try the other channel.");
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault?.();
    if (otp.length < 6) { setError("Enter the 6-digit OTP"); return; }
    setError(""); setLoading(true);
    const raw = staffId.trim();
    const idNorm = raw.includes("@") ? raw.toLowerCase() : raw.toUpperCase();
    try {
      const r = await axios.post(`${API}/staff/verify-otp`, {
        staff_id: idNorm, otp,
      });
      if (r.data?.success && r.data?.staff) {
        setSuccess("Verified. Redirecting…");
        setTimeout(() => persistLogin(r.data.staff, r.data.token), 250);
      } else {
        setError("Invalid OTP.");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Verification failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-purple-200 hover:text-white mb-4 inline-flex items-center text-sm" data-testid="staff-login-back">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to Login
        </Link>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-3 mb-4 justify-center">
              <img src="/asr_logo_transparent.png" alt="ASR Enterprises" className="h-12 w-auto" />
              <div className="text-left">
                <div className="font-extrabold text-lg text-gray-800">ASR Enterprises</div>
                <div className="text-xs text-purple-600">Staff Portal</div>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Staff Login</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your ASR Staff portal</p>
          </div>

          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button type="button"
                    onClick={() => { setMode("password"); setError(""); setSuccess(""); setOtpSent(false); }}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === "password" ? "bg-white text-purple-700 shadow" : "text-gray-600"}`}
                    data-testid="staff-login-mode-password">
              Password
            </button>
            <button type="button"
                    onClick={() => { setMode("otp"); setError(""); setSuccess(""); }}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === "otp" ? "bg-white text-purple-700 shadow" : "text-gray-600"}`}
                    data-testid="staff-login-mode-otp">
              OTP
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2" data-testid="staff-login-error">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2" data-testid="staff-login-success">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" /> {success}
            </div>
          )}

          {/* Staff ID or Email always required */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID or Email</label>
            <div className="relative">
              <IdCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={staffId} required
                onChange={(e) => {
                  const v = e.target.value;
                  // Auto-uppercase only if the user is typing a Staff ID (no '@')
                  setStaffId(v.includes("@") ? v : v.toUpperCase());
                }}
                placeholder="ASR1003 or your.email@asrenterprises.in"
                autoComplete="username"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="staff-login-staffid"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">You can sign in with your Staff ID or your registered email.</p>
          </div>

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPw ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Your password"
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    data-testid="staff-login-password"
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading || !staffId || !password}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      data-testid="staff-login-submit">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                         : <><LogIn className="w-4 h-4" /> Login</>}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg" data-testid="staff-otp-channel-switch">
                <button type="button"
                        onClick={() => { setOtpChannel("email"); setOtpSent(false); setError(""); setSuccess(""); }}
                        className={`py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1 ${otpChannel === "email" ? "bg-white text-purple-700 shadow" : "text-gray-500"}`}
                        data-testid="staff-otp-channel-email">
                  <Mail className="w-3.5 h-3.5" /> Email OTP
                </button>
                <button type="button"
                        onClick={() => { setOtpChannel("whatsapp"); setOtpSent(false); setError(""); setSuccess(""); }}
                        className={`py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1 ${otpChannel === "whatsapp" ? "bg-white text-purple-700 shadow" : "text-gray-500"}`}
                        data-testid="staff-otp-channel-whatsapp">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp OTP
                </button>
              </div>

              {!otpSent ? (
                <button type="button" onClick={sendOtp} disabled={loading || !staffId}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        data-testid="staff-send-otp-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" />
                           : (otpChannel === "email" ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />)}
                  Send OTP via {otpChannel === "email" ? "Email" : "WhatsApp"}
                </button>
              ) : (
                <>
                  {maskedTarget && <p className="text-xs text-gray-500">Sent to <strong>{maskedTarget}</strong> · valid 5 min</p>}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                    <input
                      type="text" inputMode="numeric" value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit OTP" maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-xl tracking-[0.5em] font-bold"
                      data-testid="staff-otp-input" autoFocus
                    />
                  </div>
                  <button type="submit" disabled={loading || otp.length < 6}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                          data-testid="staff-verify-otp-btn">
                    {loading ? "Verifying…" : "Verify & Login"}
                  </button>
                  <div className="flex justify-between items-center text-xs">
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }}
                            className="text-gray-500 hover:text-purple-700">
                      ← Change channel
                    </button>
                    <button type="button" disabled={resendIn > 0 || loading} onClick={sendOtp}
                            className={resendIn > 0 ? "text-gray-400" : "text-purple-600 hover:text-purple-800 font-semibold"}
                            data-testid="staff-resend-otp">
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm">
            <span className="text-gray-600">Super Admin? </span>
            <Link to="/admin/login" className="text-purple-600 hover:text-purple-800 font-semibold" data-testid="staff-login-to-admin">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
