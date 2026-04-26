import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Send, CheckCircle, ShieldAlert, MessageCircle, Mail, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Dual-OTP verification modal — used to gate sensitive admin actions
 * (payment update, customer status change, session unlock).
 *
 * Props:
 *   open       (bool)
 *   purpose    (string)              — e.g. "payment_update", "customer_status", "session_unlock"
 *   title      (string)               — heading shown on the modal
 *   description(string)               — sub-text explaining the action
 *   onClose    ()=>void               — dismiss without verifying
 *   onVerified (token, channelUsed)  — fired ONLY on successful verify; receives action_token
 */
export const DualOtpModal = ({ open, purpose, title, description, onClose, onVerified }) => {
  const [pref, setPref] = useState("auto");           // saved admin preference
  const [channel, setChannel] = useState("auto");     // current send choice (override)
  const [stage, setStage] = useState("send");          // 'send' | 'verify'
  const [otp, setOtp] = useState("");
  const [meta, setMeta] = useState(null);              // last send response
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [resendIn, setResendIn] = useState(0);

  // Pull admin preference once on open
  useEffect(() => {
    if (!open) return;
    setStage("send");
    setOtp("");
    setError("");
    setSuccess("");
    setAttemptsLeft(3);
    setResendIn(0);
    setMeta(null);
    (async () => {
      try {
        const r = await axios.get(`${API}/admin/otp-preference`);
        const ch = (r.data?.channel || "auto").toLowerCase();
        setPref(ch);
        setChannel(ch);
      } catch (_e) { /* keep defaults */ }
    })();
  }, [open]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async (chan) => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const r = await axios.post(`${API}/admin/send-otp-smart`, {
        channel: chan || channel,
        purpose: purpose || "secure_action",
      });
      setMeta(r.data || {});
      setStage("verify");
      setSuccess(r.data?.message || "OTP delivered.");
      setResendIn(r.data?.resend_in || 30);
      setAttemptsLeft(r.data?.max_attempts || 3);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to send OTP. Try the other channel.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const r = await axios.post(`${API}/admin/secure-otp/verify`, {
        otp,
        purpose: purpose || "secure_action",
      });
      if (r.data?.success && r.data?.action_token) {
        setSuccess("Verified. Continuing securely…");
        setTimeout(() => {
          onVerified && onVerified(r.data.action_token, meta?.channel_used || "auto");
        }, 250);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || "Invalid or expired OTP.";
      setError(detail);
      // Decrement local attempt counter (server-side enforced too)
      setAttemptsLeft((n) => Math.max(0, n - 1));
    } finally {
      setVerifying(false);
    }
  };

  if (!open) return null;

  const renderChannelButtons = () => (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <button
        type="button"
        onClick={() => sendOtp("whatsapp")}
        disabled={loading}
        className={`px-3 py-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition ${
          channel === "whatsapp" ? "border-green-500 bg-green-50 text-green-700"
                                 : "border-gray-200 hover:border-green-300 text-gray-600"}`}
        data-testid="dual-otp-send-whatsapp"
      >
        <MessageCircle className="w-4 h-4" /> WhatsApp
      </button>
      <button
        type="button"
        onClick={() => sendOtp("email")}
        disabled={loading}
        className={`px-3 py-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition ${
          channel === "email" ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 hover:border-blue-300 text-gray-600"}`}
        data-testid="dual-otp-send-email"
      >
        <Mail className="w-4 h-4" /> Email
      </button>
      <button
        type="button"
        onClick={() => sendOtp("auto")}
        disabled={loading}
        className={`px-3 py-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition ${
          channel === "auto" ? "border-amber-500 bg-amber-50 text-amber-700"
                             : "border-gray-200 hover:border-amber-300 text-gray-600"}`}
        data-testid="dual-otp-send-auto"
      >
        <Send className="w-4 h-4" /> Smart
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
         data-testid="dual-otp-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          type="button" onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          data-testid="dual-otp-close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0B3C5D]">{title || "Security Verification"}</h3>
            <p className="text-xs text-gray-500">Dual OTP · WhatsApp + Email fallback</p>
          </div>
        </div>
        {description && <p className="text-sm text-gray-600 mb-4">{description}</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3"
               data-testid="dual-otp-error">{error}</div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg mb-3 flex items-center gap-2"
               data-testid="dual-otp-success">
            <CheckCircle className="w-4 h-4" /> {success}
          </div>
        )}

        {stage === "send" && (
          <>
            <p className="text-xs text-gray-500 mb-2">
              Preferred channel: <span className="font-semibold uppercase">{pref}</span>
              {pref === "auto" && " · WhatsApp first → Email after 10s"}
            </p>
            {renderChannelButtons()}
            <button
              type="button"
              onClick={() => sendOtp(channel)}
              disabled={loading}
              className="w-full bg-[#F5A623] text-[#071A2E] font-bold py-3 rounded-xl hover:shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="dual-otp-send-default"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Sending…</span></>
                       : <><Send className="w-4 h-4" /><span>Send OTP</span></>}
            </button>
          </>
        )}

        {stage === "verify" && (
          <>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded-lg mb-3">
              Sent via <strong>{(meta?.channel_used || "auto").toUpperCase()}</strong>
              {meta?.smart_fallback && " (auto-fallback)"}
              {meta?.masked_recipient && <> to <strong>{meta.masked_recipient}</strong></>}
              · valid 5 min · {attemptsLeft} attempt(s) left
            </div>

            <input
              type="text" inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit OTP"
              className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F5A623] focus:border-transparent"
              data-testid="dual-otp-input"
              autoFocus
              maxLength={6}
            />

            <button
              type="button"
              onClick={verifyOtp}
              disabled={verifying || otp.length < 6 || attemptsLeft === 0}
              className="mt-3 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl hover:shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="dual-otp-verify"
            >
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Verifying…</span></>
                         : <><CheckCircle className="w-4 h-4" /><span>Verify & Continue</span></>}
            </button>

            <div className="flex items-center justify-between mt-3 text-xs">
              <button
                type="button" onClick={() => { setStage("send"); setOtp(""); }}
                className="text-gray-500 hover:text-[#0B3C5D]"
                data-testid="dual-otp-change-channel"
              >
                ← Change channel
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || loading}
                onClick={() => sendOtp(channel)}
                className={resendIn > 0 ? "text-gray-400" : "text-emerald-600 hover:text-emerald-700 font-semibold"}
                data-testid="dual-otp-resend"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DualOtpModal;
