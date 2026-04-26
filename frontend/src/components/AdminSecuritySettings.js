import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, MessageCircle, Mail, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp Only", desc: "Primary channel — fastest delivery", icon: <MessageCircle className="w-5 h-5" /> },
  { value: "email",    label: "Email Only",    desc: "Use Resend (support@asrenterprises.in)", icon: <Mail className="w-5 h-5" /> },
  { value: "auto",     label: "Smart (Default)",      desc: "WhatsApp first → Email after 10s if no delivery", icon: <ShieldCheck className="w-5 h-5" /> },
  { value: "both",     label: "Both Channels",        desc: "Send via WhatsApp AND Email — accept either OTP", icon: <RefreshCw className="w-5 h-5" /> },
];

const fmtTs = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
};

export const AdminSecuritySettings = () => {
  const [pref, setPref] = useState("auto");
  const [savedPref, setSavedPref] = useState("auto");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const loadPref = async () => {
    try {
      const r = await axios.get(`${API}/admin/otp-preference`);
      setPref(r.data?.channel || "auto");
      setSavedPref(r.data?.channel || "auto");
      setUpdatedAt(r.data?.updated_at || "");
    } catch (_e) { /* defaults */ }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const r = await axios.get(`${API}/admin/otp-audit?limit=30`);
      setAudit(r.data?.items || []);
    } catch (_e) {
      setAudit([]);
    } finally { setAuditLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPref(), loadAudit()]).finally(() => setLoading(false));
  }, []);

  const savePref = async () => {
    if (pref === savedPref) return;
    setSaving(true);
    setMsg("");
    try {
      const r = await axios.put(`${API}/admin/otp-preference`, { channel: pref });
      setSavedPref(r.data?.channel || pref);
      setUpdatedAt(r.data?.updated_at || "");
      setMsg("Preference saved.");
      setTimeout(() => setMsg(""), 2500);
    } catch (err) {
      setMsg(err?.response?.data?.detail || "Could not save preference.");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 py-8 px-4" data-testid="admin-security-settings">
      <div className="max-w-4xl mx-auto">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0B3C5D] text-sm mb-4" data-testid="admin-security-back">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[#0a355e]">Admin Security</h1>
            <p className="text-gray-500 text-sm">Dual OTP settings · session policy · audit trail</p>
          </div>
        </div>

        {/* OTP preference card */}
        <div className="bg-white rounded-2xl shadow-md border border-sky-100 p-6 mb-8">
          <h2 className="text-lg font-bold text-[#0B3C5D] mb-1">Preferred OTP Method</h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose how Admin OTPs are delivered for login, session unlock, payment updates, customer status changes, and Guardian approvals. Last updated: <strong>{fmtTs(updatedAt)}</strong>
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {CHANNELS.map((c) => (
                  <label
                    key={c.value}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                      pref === c.value
                        ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                        : "border-gray-200 hover:border-amber-300 bg-white"
                    }`}
                    data-testid={`otp-pref-${c.value}`}
                  >
                    <input
                      type="radio" name="otp-pref" value={c.value}
                      checked={pref === c.value} onChange={() => setPref(c.value)}
                      className="mt-1 accent-amber-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-semibold text-[#0B3C5D]">
                        {c.icon}<span>{c.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Smart Fallback: 10s WhatsApp wait → automatic Email re-send if undelivered.
                </p>
                <button
                  type="button" onClick={savePref}
                  disabled={saving || pref === savedPref}
                  className="bg-[#F5A623] text-[#071A2E] font-bold px-5 py-2.5 rounded-lg hover:shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  data-testid="otp-pref-save"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                          : "Save Preference"}
                </button>
              </div>

              {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
            </>
          )}
        </div>

        {/* Audit log */}
        <div className="bg-white rounded-2xl shadow-md border border-sky-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B3C5D]">OTP Audit Log</h2>
              <p className="text-xs text-gray-500">Last 30 OTP deliveries + verifications across all admin channels.</p>
            </div>
            <button
              type="button" onClick={loadAudit} disabled={auditLoading}
              className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5"
              data-testid="otp-audit-refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Event</th>
                  <th className="px-2 py-2">Purpose</th>
                  <th className="px-2 py-2">Channel</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-6">No OTP activity yet.</td></tr>
                ) : audit.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-slate-50" data-testid={`otp-audit-row-${row.id}`}>
                    <td className="px-2 py-2 whitespace-nowrap text-gray-700">{fmtTs(row.ts)}</td>
                    <td className="px-2 py-2"><span className={`px-2 py-0.5 text-xs rounded font-semibold ${row.event === "verify" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{row.event || "send"}</span></td>
                    <td className="px-2 py-2 text-gray-600">{row.purpose || "—"}</td>
                    <td className="px-2 py-2 text-gray-600">{row.channel_used || row.channel_requested || "—"}{row.smart_fallback && <span className="ml-1 text-amber-600 text-xs">↳ fallback</span>}</td>
                    <td className="px-2 py-2">
                      {row.success
                        ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> ok</span>
                        : <span className="inline-flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" /> fail</span>}
                    </td>
                    <td className="px-2 py-2 text-gray-400 font-mono text-xs">{row.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coverage info */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mt-6 text-sm text-amber-900">
          <p className="font-semibold mb-1">Where Dual-OTP is enforced</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Admin Login (Email OTP / Smart auto-fallback)</li>
            <li>Session re-unlock after 20 min inactivity</li>
            <li>Recording payments on GST invoices</li>
            <li>Changing customer status (active / inactive / payment_due)</li>
            <li>Guardian high-risk approvals (existing flow)</li>
          </ul>
          <p className="text-xs mt-2 opacity-80">All events are written to the audit log above with channel, IP, time, and outcome.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSecuritySettings;
