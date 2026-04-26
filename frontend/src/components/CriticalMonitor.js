import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Activity, AlertTriangle, MessageCircle, Mail, RefreshCw, Loader2,
  CheckCircle2, XCircle, Send, Wallet, Search, ShieldAlert, Wrench, BarChart3,
  Zap,
} from "lucide-react";
import DualOtpModal from "./DualOtpModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtTs = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
};

const headers = () => ({
  "x-staff-id": (localStorage.getItem("asrAdminStaffId") || "").trim(),
  "x-admin-name": (localStorage.getItem("asrAdminName") || "").trim(),
});

const StatCard = ({ icon, label, value, color = "from-sky-500 to-sky-600", testid }) => (
  <div className={`rounded-2xl p-4 text-white shadow-md bg-gradient-to-br ${color}`} data-testid={testid}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
      {icon}
    </div>
    <div className="text-2xl font-extrabold">{value}</div>
  </div>
);

const Tab = ({ active, onClick, label, icon, count, testid }) => (
  <button
    type="button" onClick={onClick} data-testid={testid}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
      active ? "bg-amber-500 text-[#071A2E] shadow"
             : "bg-white text-slate-600 hover:bg-amber-50"}`}
  >
    {icon} {label}
    {typeof count === "number" && (
      <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-[#071A2E]/20" : "bg-slate-200 text-slate-600"}`}>{count}</span>
    )}
  </button>
);

const ReasonChip = ({ reason }) => {
  const tone = /(token|api key|key|domain|configured)/i.test(reason || "")  ? "red"
             : /(rate|limit|outside|expired|timeout)/i.test(reason || "")   ? "amber"
             : /(template|variable|mismatch)/i.test(reason || "")           ? "purple"
             : "slate";
  const cls = {
    red: "bg-red-100 text-red-700 border-red-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  }[tone];
  return <span className={`text-xs px-2 py-1 rounded border ${cls} inline-block max-w-[260px] truncate`} title={reason}>{reason}</span>;
};

const Sparkline = ({ points, color = "#ef4444", height = 40 }) => {
  if (!points || points.length === 0) return <div className="h-10 text-xs text-slate-400 flex items-center justify-center">No data</div>;
  const max = Math.max(1, ...points.map(p => p.value));
  const w = 280;
  const dx = w / Math.max(1, points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i * dx).toFixed(1)} ${(height - (p.value / max) * (height - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={path} stroke={color} strokeWidth="2" fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={i * dx} cy={height - (p.value / max) * (height - 4) - 2} r={p.value > 0 ? 2.5 : 1.5} fill={color} />
      ))}
    </svg>
  );
};

export const CriticalMonitor = () => {
  // Access gate — super admin only
  const isSuper = ((localStorage.getItem("asrAdminStaffId") || "").trim().toUpperCase() === "ASR1001")
               && ((localStorage.getItem("asrAdminName") || "").trim().toUpperCase() === "ABHIJEET KUMAR");

  const [tab, setTab] = useState("otp");
  const [health, setHealth] = useState(null);
  const [otpRows, setOtpRows] = useState([]);
  const [payRows, setPayRows] = useState([]);
  const [trend, setTrend] = useState({ otp_failures: [], payment_failures: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [errorTypeFilter, setErrorTypeFilter] = useState("all"); // all | user | system
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // Entry gate — block UI until Super Admin verifies via Dual OTP
  const [entryUnlocked, setEntryUnlocked] = useState(
    sessionStorage.getItem("cm_entry_unlocked") === "1"
  );
  const [entryOtpOpen, setEntryOtpOpen] = useState(!entryUnlocked && isSuper);

  // Test tools state
  const [testOtpForm, setTestOtpForm] = useState({ channel: "auto" });
  const [testPayForm, setTestPayForm] = useState({ mobile: "", name: "Test Customer", email: "", amount: 1 });
  const [testOtpResult, setTestOtpResult] = useState(null);
  const [testPayResult, setTestPayResult] = useState(null);

  // Mark-as-paid + Retry Dual-OTP gates
  const [markPaidFor, setMarkPaidFor] = useState(null);
  const [otpOpenMarkPaid, setOtpOpenMarkPaid] = useState(false);
  const [retryRequest, setRetryRequest] = useState(null); // {channel}
  const [otpOpenRetry, setOtpOpenRetry] = useState(false);

  const flashToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };
  const flashError = (msg) => { setError(msg); setTimeout(() => setError(""), 6000); };

  const loadAll = async () => {
    if (!isSuper || !entryUnlocked) return;
    setLoading(true); setError("");
    try {
      const [h, o, p, t] = await Promise.all([
        axios.get(`${API}/critical-monitor/health`, { headers: headers() }),
        axios.get(`${API}/critical-monitor/failures/otp?limit=80`, { headers: headers() }),
        axios.get(`${API}/critical-monitor/failures/payments?limit=80`, { headers: headers() }),
        axios.get(`${API}/critical-monitor/trend?hours=24`, { headers: headers() }),
      ]);
      setHealth(h.data); setOtpRows(o.data?.items || []); setPayRows(p.data?.items || []);
      setTrend(t.data || { otp_failures: [], payment_failures: [] });
    } catch (e) {
      flashError(e?.response?.data?.detail || "Could not load monitor data.");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [entryUnlocked]);

  // Auto refresh every 60s
  useEffect(() => {
    if (!isSuper || !entryUnlocked) return;
    const t = setInterval(loadAll, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [isSuper, entryUnlocked]);

  const filteredOtp = useMemo(() => {
    let rows = otpRows;
    if (errorTypeFilter !== "all") rows = rows.filter(r => (r.error_type || "system") === errorTypeFilter);
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [otpRows, search, errorTypeFilter]);
  const filteredPay = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payRows;
    return payRows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [payRows, search]);

  // Retry — requires Dual-OTP token (per spec section 10)
  const requestRetry = (channel) => {
    setRetryRequest({ channel });
    setOtpOpenRetry(true);
  };
  const completeRetry = async (action_token) => {
    setOtpOpenRetry(false);
    setBusy(`retry:${retryRequest?.channel}`);
    try {
      const r = await axios.post(`${API}/critical-monitor/otp/retry`,
        { channel: retryRequest?.channel, action_token },
        { headers: headers() });
      flashToast(`OTP re-issued via ${(r.data?.channel_used || retryRequest?.channel).toUpperCase()}`);
      loadAll();
    } catch (e) {
      flashError(e?.response?.data?.detail || "Retry failed");
    } finally { setBusy(""); setRetryRequest(null); }
  };

  const sendTestOtp = async () => {
    setBusy("test_otp");
    setTestOtpResult(null);
    try {
      const r = await axios.post(`${API}/critical-monitor/test-otp`,
        { channel: testOtpForm.channel || "auto", purpose: "test" },
        { headers: headers() });
      setTestOtpResult(r.data);
      flashToast(r.data?.ok ? "Test OTP fired — check your inbox / WhatsApp." : "Test OTP failed.");
      loadAll();
    } catch (e) {
      setTestOtpResult({ ok: false, error: e?.response?.data?.detail || String(e) });
    } finally { setBusy(""); }
  };

  const sendTestPayment = async () => {
    setBusy("test_pay");
    setTestPayResult(null);
    try {
      const r = await axios.post(`${API}/critical-monitor/test-payment`, {
        mobile: (testPayForm.mobile || "").replace(/\D/g, "").slice(-10),
        name: testPayForm.name || "Test Customer",
        email: testPayForm.email || "",
        amount: parseInt(testPayForm.amount, 10) || 1,
      }, { headers: headers() });
      setTestPayResult(r.data);
      flashToast(r.data?.ok ? "Test payment link generated." : "Test payment failed.");
    } catch (e) {
      setTestPayResult({ ok: false, error: e?.response?.data?.detail || String(e) });
    } finally { setBusy(""); }
  };

  const retryPaymentLink = async (orderRow) => {
    const invoiceId = orderRow?.invoice_id || orderRow?.id || orderRow?.cf_order_id;
    if (!invoiceId) { flashError("No linked invoice id"); return; }
    setBusy(`retry_pay:${invoiceId}`);
    try {
      const r = await axios.post(`${API}/critical-monitor/payment/retry-link`,
        { invoice_id: invoiceId, channel: "both" }, { headers: headers() });
      flashToast(`Reminder sent: ${(r.data?.sent_via || []).join(", ") || "n/a"}`);
    } catch (e) {
      flashError(e?.response?.data?.detail || "Could not resend payment link");
    } finally { setBusy(""); }
  };

  const requestMarkPaid = (row) => {
    setMarkPaidFor({
      invoice_id: row?.invoice_id || row?.id,
      customer_name: row?.customer_name || "—",
      amount: row?.amount || 0,
    });
    setOtpOpenMarkPaid(true);
  };

  const completeMarkPaid = async (action_token) => {
    setOtpOpenMarkPaid(false);
    setBusy("mark_paid");
    try {
      await axios.post(`${API}/critical-monitor/payment/mark-paid`, {
        invoice_id: markPaidFor.invoice_id, action_token,
      }, { headers: headers() });
      flashToast("Invoice marked PAID. Audit log updated.");
      setMarkPaidFor(null); loadAll();
    } catch (e) {
      flashError(e?.response?.data?.detail || "Mark-paid failed");
    } finally { setBusy(""); }
  };

  const runAutoFix = async () => {
    setBusy("auto_fix");
    try {
      const r = await axios.post(`${API}/critical-monitor/auto-fix`, {}, { headers: headers() });
      const s = r.data?.summary || {};
      flashToast(`Auto-Fix: OTP ${s.otp?.channel_used || "?"}, ${s.payments?.length || 0} payment reminder(s) re-sent.`);
      loadAll();
    } catch (e) {
      flashError(e?.response?.data?.detail || "Auto-fix failed");
    } finally { setBusy(""); }
  };

  if (!isSuper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" data-testid="critical-monitor-blocked">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-red-200">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Super Admin Only</h2>
          <p className="text-sm text-slate-600">Critical System Monitor is restricted to ABHIJEET KUMAR (ASR1001).</p>
          <Link to="/admin/dashboard" className="inline-block mt-5 text-sm text-sky-700 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Entry gate — block UI until Dual-OTP verified
  if (!entryUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-amber-50 p-6">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl p-8 border border-amber-200">
          <ShieldAlert className="w-14 h-14 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#0a355e] mb-2">Critical Monitor — Locked</h2>
          <p className="text-sm text-slate-600 mb-5">A Dual-OTP confirmation is required to view system failure data and recovery actions.</p>
          <button
            type="button"
            onClick={() => setEntryOtpOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-[#071A2E] font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 mx-auto"
            data-testid="cm-entry-unlock"
          >
            <ShieldAlert className="w-5 h-5" /> Unlock with Dual-OTP
          </button>
          <Link to="/admin/dashboard" className="inline-block mt-4 text-xs text-slate-500 hover:underline">← Back to Dashboard</Link>
        </div>
        <DualOtpModal
          open={entryOtpOpen}
          purpose="secure_action"
          title="Critical Monitor Access"
          description="Verify Dual-OTP to unlock the system failure dashboard and recovery actions."
          onClose={() => setEntryOtpOpen(false)}
          onVerified={async (action_token) => {
            try {
              await axios.post(`${API}/critical-monitor/entry/verify`, { action_token }, { headers: headers() });
              sessionStorage.setItem("cm_entry_unlocked", "1");
              setEntryOtpOpen(false);
              setEntryUnlocked(true);
            } catch (e) {
              flashError(e?.response?.data?.detail || "Entry verification failed");
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 py-6 px-4" data-testid="critical-monitor">
      <div className="max-w-7xl mx-auto">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0B3C5D] text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-start md:items-center justify-between mb-6 gap-3 flex-col md:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Activity className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a355e]">Critical System Monitor</h1>
              <p className="text-slate-500 text-sm">Super Admin Only · Real-time OTP & Payment failure recovery</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runAutoFix} disabled={busy === "auto_fix"}
                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow"
                    data-testid="cm-auto-fix">
              {busy === "auto_fix" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Auto-Fix Issues
            </button>
            <button
              type="button" onClick={loadAll} disabled={loading}
              className="bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              data-testid="cm-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Toast / Error */}
        {toast && (<div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm mb-3" data-testid="cm-toast">{toast}</div>)}
        {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm mb-3" data-testid="cm-error">{error}</div>)}

        {/* Health card */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="cm-health">
            <StatCard icon={<MessageCircle className="w-5 h-5 opacity-80" />} label="OTP Success"
                      value={`${health.otp.success_rate}%`}
                      color={health.otp.failure_rate > 20 ? "from-red-500 to-red-600" : "from-emerald-500 to-emerald-600"}
                      testid="cm-stat-otp-rate" />
            <StatCard icon={<XCircle className="w-5 h-5 opacity-80" />} label="OTP Failures (24h)"
                      value={health.otp.failed}
                      color={health.otp.failed ? "from-red-500 to-rose-600" : "from-slate-500 to-slate-600"}
                      testid="cm-stat-otp-failed" />
            <StatCard icon={<Wallet className="w-5 h-5 opacity-80" />} label="Payment Success"
                      value={`${health.payment.success_rate}%`}
                      color={health.payment.success_rate < 80 ? "from-amber-500 to-orange-600" : "from-blue-500 to-sky-600"}
                      testid="cm-stat-pay-rate" />
            <StatCard icon={<AlertTriangle className="w-5 h-5 opacity-80" />} label="Payment Failures"
                      value={health.payment.failed}
                      color={health.payment.failed ? "from-rose-500 to-red-600" : "from-slate-500 to-slate-600"}
                      testid="cm-stat-pay-failed" />
          </div>
        )}

        {/* Alerts */}
        {(health?.alerts || []).length > 0 && (
          <div className="space-y-2 mb-5" data-testid="cm-alerts">
            {health.alerts.map((a, i) => (
              <div key={i}
                   className={`rounded-xl px-4 py-3 border-l-4 flex items-start gap-3 ${
                     a.severity === "critical"
                       ? "bg-red-50 border-red-500 text-red-800"
                       : "bg-amber-50 border-amber-500 text-amber-900"}`}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">{a.severity.toUpperCase()} · {a.topic}</div>
                  <div className="text-sm">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Tab active={tab === "otp"}    onClick={() => setTab("otp")}    label="OTP Failures"     icon={<MessageCircle className="w-4 h-4" />} count={otpRows.length} testid="cm-tab-otp" />
          <Tab active={tab === "pay"}    onClick={() => setTab("pay")}    label="Payment Failures" icon={<Wallet className="w-4 h-4" />}      count={payRows.length} testid="cm-tab-pay" />
          <Tab active={tab === "tools"}  onClick={() => setTab("tools")}  label="Test Tools"       icon={<Wrench className="w-4 h-4" />}      testid="cm-tab-tools" />
          <Tab active={tab === "health"} onClick={() => setTab("health")} label="System Health"    icon={<BarChart3 className="w-4 h-4" />}   testid="cm-tab-health" />
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reason, name, phone…"
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none w-60"
              data-testid="cm-search"
            />
          </div>
        </div>

        {/* OTP Failures Tab */}
        {tab === "otp" && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden" data-testid="cm-panel-otp">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-[#0B3C5D]">OTP Failures · Last 80</h3>
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={errorTypeFilter} onChange={(e) => setErrorTypeFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                  data-testid="cm-error-type-filter"
                >
                  <option value="all">All errors</option>
                  <option value="user">User errors</option>
                  <option value="system">System errors</option>
                </select>
                <button type="button" onClick={() => requestRetry("whatsapp")} disabled={busy.startsWith("retry")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
                        data-testid="cm-retry-wa">
                  <MessageCircle className="w-3.5 h-3.5" /> Retry WA
                </button>
                <button type="button" onClick={() => requestRetry("email")} disabled={busy.startsWith("retry")}
                        className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1"
                        data-testid="cm-retry-email">
                  <Mail className="w-3.5 h-3.5" /> Retry Email
                </button>
                <button type="button" onClick={() => requestRetry("auto")} disabled={busy.startsWith("retry")}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-[#071A2E] text-xs font-semibold flex items-center gap-1"
                        data-testid="cm-retry-auto">
                  <RefreshCw className="w-3.5 h-3.5" /> Auto-retry
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Event</th>
                    <th className="px-3 py-2 text-left">Channel</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Reason &amp; Suggestion</th>
                    <th className="px-3 py-2 text-left">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOtp.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-8">No OTP failures match the current filter.</td></tr>
                  ) : filteredOtp.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-amber-50/40 align-top" data-testid={`cm-otp-row-${r.id}`}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{fmtTs(r.ts)}</td>
                      <td className="px-3 py-2 text-slate-600">{r.actor || "—"}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 text-xs rounded font-semibold ${r.event === "verify" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{r.purpose || r.event || "—"}</span></td>
                      <td className="px-3 py-2 text-slate-600">{(r.channel_used || r.channel_requested || "—").toUpperCase()}{r.smart_fallback && <span className="ml-1 text-amber-600 text-xs">↳ fallback</span>}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          r.error_type === "user" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"
                        }`}>
                          {(r.error_type || "system").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[420px]">
                        <ReasonChip reason={r.reason} />
                        <p className="text-xs text-slate-500 mt-1 leading-snug">{r.suggestion}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-400 font-mono text-xs">{r.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Failures Tab */}
        {tab === "pay" && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden" data-testid="cm-panel-pay">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-[#0B3C5D]">Payment Failures · Last 80</h3>
              <p className="text-xs text-slate-500">Failed / expired / cancelled / pending &gt; 30 minutes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Order #</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPay.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-8">🎉 No payment failures recorded.</td></tr>
                  ) : filteredPay.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-amber-50/40" data-testid={`cm-pay-row-${r.id}`}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{fmtTs(r.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-700">{r.customer_name}</div>
                        <div className="text-xs text-slate-400 font-mono">{r.customer_phone}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.cf_order_id || r.id || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">₹ {Number(r.amount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-slate-600">{r.payment_method}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">{(r.payment_status || "—").toUpperCase()}</span>
                      </td>
                      <td className="px-3 py-2"><ReasonChip reason={r.reason} /></td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => retryPaymentLink(r)}
                                  disabled={busy.startsWith("retry_pay")}
                                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-[#071A2E] text-xs font-semibold flex items-center gap-1"
                                  data-testid={`cm-pay-retry-${r.id}`}>
                            <Send className="w-3 h-3" /> Resend Link
                          </button>
                          <button type="button" onClick={() => requestMarkPaid(r)}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                                  data-testid={`cm-pay-markpaid-${r.id}`}>
                            <CheckCircle2 className="w-3 h-3" /> Mark Paid
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Test Tools Tab */}
        {tab === "tools" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="cm-panel-tools">
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-[#0B3C5D]">Send Test OTP</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">Sends a real OTP to the registered admin email/mobile to verify deliverability.</p>
              <select
                value={testOtpForm.channel}
                onChange={(e) => setTestOtpForm({ ...testOtpForm, channel: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
                data-testid="cm-test-otp-channel"
              >
                <option value="auto">Smart (WhatsApp → Email auto-fallback)</option>
                <option value="whatsapp">WhatsApp only</option>
                <option value="email">Email only</option>
                <option value="both">Both (parallel)</option>
              </select>
              <button type="button" onClick={sendTestOtp} disabled={busy === "test_otp"}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      data-testid="cm-test-otp-send">
                {busy === "test_otp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test OTP
              </button>
              {testOtpResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${testOtpResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
                     data-testid="cm-test-otp-result">
                  {testOtpResult.ok
                    ? <>Delivered via <strong>{(testOtpResult.delivery?.channel_used || "?").toUpperCase()}</strong> · valid 5 min</>
                    : <>{testOtpResult.error || "Failed"}</>}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-[#0B3C5D]">Send Test Payment Link</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">Creates a ₹1 Cashfree order to verify the gateway end-to-end.</p>
              <input
                value={testPayForm.mobile}
                onChange={(e) => setTestPayForm({ ...testPayForm, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="10-digit mobile" maxLength={10}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
                data-testid="cm-test-pay-mobile"
              />
              <input
                value={testPayForm.name}
                onChange={(e) => setTestPayForm({ ...testPayForm, name: e.target.value })}
                placeholder="Customer name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
                data-testid="cm-test-pay-name"
              />
              <input
                value={testPayForm.amount}
                onChange={(e) => setTestPayForm({ ...testPayForm, amount: e.target.value })}
                placeholder="Amount in ₹" type="number" min="1"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
                data-testid="cm-test-pay-amount"
              />
              <button type="button" onClick={sendTestPayment} disabled={busy === "test_pay" || (testPayForm.mobile || "").length !== 10}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      data-testid="cm-test-pay-send">
                {busy === "test_pay" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Generate Test Link
              </button>
              {testPayResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${testPayResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
                     data-testid="cm-test-pay-result">
                  {testPayResult.ok
                    ? <>Order created. CF id: <strong>{testPayResult.order?.cashfree_order_id || testPayResult.order?.cf_order_id || "—"}</strong>{testPayResult.order?.payment_session_id && (<><br /><a href={`https://payments.cashfree.com/forms?session=${testPayResult.order.payment_session_id}`} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">Open payment page →</a></>)}</>
                    : <>{testPayResult.error || "Failed"}</>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* System Health tab */}
        {tab === "health" && health && (
          <div className="space-y-4" data-testid="cm-panel-health">
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
              <h3 className="font-bold text-[#0B3C5D] mb-3">System Health · 24h window</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="font-bold mb-2 text-emerald-700">OTP Delivery</h4>
                  <ul className="space-y-1">
                    <li>Total: <strong>{health.otp.total}</strong></li>
                    <li>Success: <strong className="text-emerald-700">{health.otp.success}</strong> ({health.otp.success_rate}%)</li>
                    <li>Failed: <strong className="text-red-600">{health.otp.failed}</strong> ({health.otp.failure_rate}%)</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h4 className="font-bold mb-2 text-blue-700">Payments</h4>
                  <ul className="space-y-1">
                    <li>Total: <strong>{health.payment.total}</strong></li>
                    <li>Success: <strong className="text-emerald-700">{health.payment.success}</strong> ({health.payment.success_rate}%)</li>
                    <li>Failed/Pending: <strong className="text-red-600">{health.payment.failed}</strong></li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">Last refreshed: {fmtTs(health.ts)} · Auto-refresh every 60 s.</p>
            </div>

            {/* Trend Sparklines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="cm-trends">
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-rose-600">OTP Failure Trend (24h)</h4>
                  <span className="text-xs text-slate-400">{(trend.otp_failures || []).reduce((s, p) => s + p.value, 0)} total fails</span>
                </div>
                <Sparkline points={trend.otp_failures} color="#e11d48" height={60} />
              </div>
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-amber-600">Payment Failure Trend (24h)</h4>
                  <span className="text-xs text-slate-400">{(trend.payment_failures || []).reduce((s, p) => s + p.value, 0)} total fails</span>
                </div>
                <Sparkline points={trend.payment_failures} color="#d97706" height={60} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mark-as-paid Dual OTP gate */}
      {markPaidFor && (
        <DualOtpModal
          open={otpOpenMarkPaid}
          purpose="payment_update"
          title="Mark Invoice as Paid"
          description={`Force-mark invoice for ${markPaidFor.customer_name} (₹${Number(markPaidFor.amount || 0).toLocaleString("en-IN")}) as paid. Requires Dual-OTP verification.`}
          onClose={() => { setOtpOpenMarkPaid(false); setMarkPaidFor(null); }}
          onVerified={completeMarkPaid}
        />
      )}

      {/* OTP Retry Dual OTP gate */}
      {retryRequest && (
        <DualOtpModal
          open={otpOpenRetry}
          purpose="secure_action"
          title="Verify before Retry"
          description={`A Dual-OTP confirmation is required to re-issue an OTP via ${retryRequest.channel?.toUpperCase()}.`}
          onClose={() => { setOtpOpenRetry(false); setRetryRequest(null); }}
          onVerified={completeRetry}
        />
      )}
    </div>
  );
};

export default CriticalMonitor;
