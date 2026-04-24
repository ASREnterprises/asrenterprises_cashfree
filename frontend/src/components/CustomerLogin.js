import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Phone, Mail, ArrowRight, Loader2, CheckCircle, RefreshCw, ShieldCheck, Zap, Star, Info } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CustomerLogin = () => {
  // channel = 'email' (primary) or 'mobile' (WhatsApp OTP fallback)
  const [channel, setChannel] = useState("email");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState("id"); // id | otp
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const cleanMobile = () => mobile.replace(/\D/g, "").slice(-10);
  const cleanEmail = () => email.trim().toLowerCase();

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const sendEmailOtp = async () => {
    const em = cleanEmail();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setError("Please enter a valid email address"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await axios.post(`${API}/customer/send-otp-email`, { email: em });
      setStep("otp");
      setSuccess(`OTP emailed to ${em}${res.data?.masked_mobile ? " · WhatsApp fallback available" : ""}`);
      setResendTimer(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to send email OTP.";
      // If Resend is unavailable or the email isn't recognised, surface a WhatsApp fallback CTA
      setError(detail + " You can also try WhatsApp OTP below.");
    } finally { setLoading(false); }
  };

  const sendMobileOtp = async () => {
    const cleaned = cleanMobile();
    if (cleaned.length !== 10) { setError("Please enter a valid 10-digit mobile number"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      await axios.post(`${API}/customer/send-otp`, { mobile: cleaned });
      setStep("otp");
      setSuccess(`WhatsApp OTP sent to +91 ${cleaned.slice(0, 2)}XXXXXXXX${cleaned.slice(-2)}`);
      setResendTimer(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to send OTP.";
      setError(err.response?.status === 404
        ? "This mobile is not registered. Please contact ASR Enterprises to get your customer account created."
        : msg);
    } finally { setLoading(false); }
  };

  const handleSendOtp = () => channel === "email" ? sendEmailOtp() : sendMobileOtp();

  const handleVerifyOtp = async () => {
    const otpValue = otp.join("");
    if (otpValue.length !== 6) { setError("Please enter the complete 6-digit OTP"); return; }
    setOtpLoading(true); setError("");
    try {
      const res = channel === "email"
        ? await axios.post(`${API}/customer/verify-otp-email`, { email: cleanEmail(), otp: otpValue })
        : await axios.post(`${API}/customer/verify-otp`, { mobile: cleanMobile(), otp: otpValue });
      sessionStorage.setItem("asrCustomerData", JSON.stringify(res.data.customer));
      sessionStorage.setItem("asrCustomerPortalSettings", JSON.stringify(res.data.portal_settings));
      sessionStorage.setItem("asrCustomerMobile", res.data.customer?.mobile || cleanMobile());
      navigate("/customer/portal");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid OTP. Please try again.");
    } finally { setOtpLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true); setError("");
    try {
      if (channel === "email") await axios.post(`${API}/customer/send-otp-email`, { email: cleanEmail() });
      else await axios.post(`${API}/customer/send-otp`, { mobile: cleanMobile() });
      setOtp(["", "", "", "", "", ""]);
      setSuccess("New OTP sent successfully!");
      setResendTimer(60);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend OTP");
    } finally { setLoading(false); }
  };

  const switchChannel = (next) => {
    setChannel(next);
    setStep("id");
    setOtp(["", "", "", "", "", ""]);
    setError(""); setSuccess("");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #FFFDF4 0%, #F7FBFF 50%, #EEF9FF 100%)" }}>
      <div className="absolute inset-0 solar-panel-grid opacity-20 pointer-events-none" />
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative">
        <div className="w-full max-w-md">
          <a href="/login" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#073B4C] text-sm mb-5 transition" data-testid="customer-back-login">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Login
          </a>

          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-3 mb-6 justify-center">
              <img src="/asr_logo_transparent.png" alt="ASR Enterprises" className="h-14 w-auto" />
              <div className="text-left">
                <div className="font-extrabold text-xl text-[#073B4C]">ASR Enterprises</div>
                <div className="text-xs text-[#0369A1]">Customer Portal</div>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-[#073B4C] mb-1">Customer Login</h1>
            <p className="text-slate-500 text-sm">Access your solar installation dashboard</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-sky-100 p-8">
            {step === "id" && (
              <div data-testid="customer-login-form">
                <div className="mb-5 flex items-start gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3.5 py-2.5" data-testid="customer-admin-only-notice">
                  <Info className="w-4 h-4 text-[#0369A1] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#0369A1] leading-relaxed">
                    Only customers registered by ASR Enterprises can log in. If you don't have an account yet, please contact our team to get registered.
                  </p>
                </div>

                {/* Channel switch — Email is primary (first), WhatsApp is fallback. */}
                <div className="grid grid-cols-2 gap-2 mb-5 bg-slate-100 p-1 rounded-xl" data-testid="customer-channel-switch">
                  <button
                    type="button"
                    onClick={() => switchChannel("email")}
                    data-testid="customer-channel-email"
                    className={`py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${channel === "email" ? "bg-white text-[#073B4C] shadow" : "text-slate-500"}`}
                  >
                    <Mail className="w-4 h-4" /> Email OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => switchChannel("mobile")}
                    data-testid="customer-channel-mobile"
                    className={`py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${channel === "mobile" ? "bg-white text-[#073B4C] shadow" : "text-slate-500"}`}
                  >
                    <Phone className="w-4 h-4" /> WhatsApp OTP
                  </button>
                </div>

                {channel === "email" ? (
                  <>
                    <label className="block text-sm font-semibold text-[#073B4C] mb-2">Registered Email Address</label>
                    <div className="relative mb-4">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0369A1]" />
                      <input data-testid="customer-email-input" type="email" value={email}
                        onChange={e => { setEmail(e.target.value); setError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                        placeholder="you@example.com"
                        className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1] text-[#073B4C] text-base" />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-semibold text-[#073B4C] mb-2">Registered Mobile Number</label>
                    <div className="relative mb-4">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0369A1]" />
                      <div className="absolute left-11 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium border-r border-slate-200 pr-2">+91</div>
                      <input data-testid="customer-mobile-input" type="tel" value={mobile}
                        onChange={e => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                        placeholder="Enter your mobile number" maxLength={10}
                        className="w-full pl-24 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1] text-[#073B4C] text-base" />
                    </div>
                  </>
                )}

                {error && (
                  <div data-testid="customer-error" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                    {error}
                    {channel === "email" && (
                      <button onClick={() => switchChannel("mobile")} className="block mt-1 underline font-semibold" data-testid="customer-fallback-whatsapp">
                        Use WhatsApp OTP instead →
                      </button>
                    )}
                  </div>
                )}

                <button data-testid="customer-send-otp-btn"
                  onClick={handleSendOtp}
                  disabled={loading || (channel === "email" ? !email.includes("@") : cleanMobile().length !== 10)}
                  className="w-full bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Send OTP via {channel === "email" ? "Email" : "WhatsApp"}</>}
                </button>

                <div className="mt-6 flex flex-col gap-2">
                  {[
                    { icon: ShieldCheck, text: "Secure OTP-based login", color: "text-emerald-600" },
                    { icon: Zap, text: "View your solar system details instantly", color: "text-amber-500" },
                    { icon: Star, text: "Track PM Surya Ghar application status", color: "text-sky-500" },
                  ].map(({ icon: Icon, text, color }) => (
                    <div key={text} className="flex items-center gap-2 text-slate-500 text-sm">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                      {text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === "otp" && (
              <div data-testid="customer-otp-form">
                <div className="text-center mb-6">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">{success}</p>
                  <p className="text-xs text-slate-400 mt-1">Enter the 6-digit OTP to continue</p>
                </div>

                <div className="flex gap-2 justify-center mb-6">
                  {otp.map((digit, idx) => (
                    <input data-testid={`customer-otp-${idx}`} key={idx} ref={el => (otpRefs.current[idx] = el)} type="tel" maxLength={1} value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/20 text-[#073B4C] transition" />
                  ))}
                </div>

                {error && <div data-testid="customer-otp-error" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

                <button data-testid="customer-verify-otp-btn" onClick={handleVerifyOtp} disabled={otpLoading || otp.join("").length !== 6} className="w-full bg-gradient-to-r from-[#12B981] to-[#10B981] text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-50 mb-4">
                  {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Verify & Login</>}
                </button>

                <div className="flex items-center justify-between">
                  <button data-testid="customer-change-id" onClick={() => { setStep("id"); setOtp(["","","","","",""]); setError(""); setSuccess(""); }} className="text-slate-500 text-sm hover:text-[#073B4C] transition flex items-center gap-1">
                    ← Change {channel === "email" ? "email" : "mobile"}
                  </button>
                  <button data-testid="customer-resend-otp" onClick={handleResend} disabled={resendTimer > 0 || loading} className="flex items-center gap-1 text-sm text-[#0369A1] hover:text-[#073B4C] disabled:text-slate-400 transition font-medium">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Not registered yet?{" "}
            <a href="https://wa.me/918298389097?text=Hello%2C%20I%20want%20to%20register%20as%20a%20customer%20with%20ASR%20Enterprises" target="_blank" rel="noopener noreferrer" className="text-[#0369A1] font-medium underline" data-testid="customer-contact-whatsapp">Contact ASR Enterprises on WhatsApp</a>
          </p>
          <p className="text-center text-xs text-slate-400 mt-2">
            <Link to="/" className="hover:text-[#0369A1] transition">← Back to Website</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
