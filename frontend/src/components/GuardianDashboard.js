import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  Shield, Activity, ListChecks, CheckCircle2, AlertCircle, Loader2, RefreshCw,
  ArrowLeft, Terminal, History, Plus, Play, Trash2, Settings, X, Lock, Unlock,
  Clock, AlertTriangle, RotateCcw, ChevronRight,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/guardian`;

const MODE_BADGE = {
  alert:    "bg-slate-100 text-slate-700",
  approval: "bg-amber-100 text-amber-800",
  autofix:  "bg-emerald-100 text-emerald-700",
};

const STATUS_COLOR = {
  good:     { bg: "bg-emerald-500", text: "text-emerald-700", label: "GOOD" },
  warning:  { bg: "bg-amber-500",   text: "text-amber-700",   label: "WARNING" },
  critical: { bg: "bg-red-500",     text: "text-red-700",     label: "CRITICAL" },
};

const LEVEL_STYLE = {
  info:  "text-slate-600 bg-slate-50",
  warn:  "text-amber-700 bg-amber-50",
  error: "text-red-700 bg-red-50",
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
};

const fmtAgo = (iso) => {
  if (!iso) return "never";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return iso; }
};

// ──────────────────────────────────────────────────────────────────────
// Hooks
// ──────────────────────────────────────────────────────────────────────
const useGuardian = () => {
  const [health, setHealth] = useState(null);
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [h, r, l, a, b] = await Promise.all([
        axios.get(`${API}/health`),
        axios.get(`${API}/rules`),
        axios.get(`${API}/logs?limit=200`),
        axios.get(`${API}/approvals?status=pending&limit=100`),
        axios.get(`${API}/backups?limit=50`),
      ]);
      setHealth(h.data);
      setRules(r.data.rules || []);
      setLogs(l.data.logs || []);
      setApprovals(a.data.approvals || []);
      setBackups(b.data.backups || []);
    } catch (e) {
      setToast({ type: "err", msg: e?.response?.data?.detail || "Failed to load" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return { health, rules, logs, approvals, backups, loading, toast, setToast, refresh };
};

// ──────────────────────────────────────────────────────────────────────
// Small components
// ──────────────────────────────────────────────────────────────────────
const HealthCard = ({ health, onRefresh, loading }) => {
  if (!health) return null;
  const s = STATUS_COLOR[health.status] || STATUS_COLOR.warning;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div className={`col-span-2 md:col-span-1 rounded-xl p-4 text-white ${s.bg}`} data-testid="guardian-health">
        <div className="flex items-center gap-2 opacity-90 text-xs font-semibold">SYSTEM HEALTH</div>
        <div className="text-3xl font-bold mt-1">{s.label}</div>
        <div className="text-xs opacity-90 mt-1">Checked {fmtAgo(health.checked_at)}</div>
      </div>
      <Stat label="Errors (24h)"    value={health.errors_24h}       colorHint={health.errors_24h > 0 ? "red" : "slate"} />
      <Stat label="Warnings (24h)"  value={health.warns_24h}        colorHint={health.warns_24h > 5 ? "amber" : "slate"} />
      <Stat label="Pending Approvals" value={health.pending_approvals} colorHint={health.pending_approvals > 0 ? "amber" : "slate"} />
      <div className="rounded-xl p-4 bg-white border border-slate-200 flex flex-col">
        <div className="text-xs font-semibold text-slate-500">RULES</div>
        <div className="text-3xl font-bold text-slate-900 mt-1">{health.rules_enabled}/{health.rules_total}</div>
        <button onClick={onRefresh} className="mt-auto text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
    </div>
  );
};

const Stat = ({ label, value, colorHint }) => {
  const tone = {
    red: "text-red-700", amber: "text-amber-700", slate: "text-slate-900",
  }[colorHint] || "text-slate-900";
  return (
    <div className="rounded-xl p-4 bg-white border border-slate-200">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${tone}`}>{value ?? 0}</div>
    </div>
  );
};

const Tab = ({ active, onClick, icon, label, badge }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 flex items-center gap-2 text-sm font-medium rounded-lg border transition
      ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}
    data-testid={`guardian-tab-${label.toLowerCase()}`}
  >
    {icon}
    {label}
    {badge != null && badge > 0 && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-amber-500 text-white"}`}>{badge}</span>
    )}
  </button>
);

// ──────────────────────────────────────────────────────────────────────
// Tab: Rules
// ──────────────────────────────────────────────────────────────────────
const RulesTab = ({ rules, onRefresh, onToast }) => {
  const [templates, setTemplates] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    axios.get(`${API}/rules/templates`).then(r => setTemplates(r.data.templates || [])).catch(() => {});
  }, []);

  const runNow = async (r) => {
    setBusy(r.id + ":run");
    try {
      const res = await axios.post(`${API}/rules/${r.id}/run`);
      onToast({ type: "ok", msg: `${r.name}: ${res.data.issue_count} issue(s), ${res.data.fixes_applied || 0} fixed` });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Run failed" }); }
    finally { setBusy(null); }
  };

  const toggle = async (r) => {
    setBusy(r.id + ":toggle");
    try {
      await axios.patch(`${API}/rules/${r.id}`, { enabled: !r.enabled });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Toggle failed" }); }
    finally { setBusy(null); }
  };

  const setMode = async (r, action_mode) => {
    setBusy(r.id + ":mode");
    try {
      await axios.patch(`${API}/rules/${r.id}`, { action_mode });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Change failed" }); }
    finally { setBusy(null); }
  };

  const setFreq = async (r, frequency_minutes) => {
    setBusy(r.id + ":freq");
    try {
      await axios.patch(`${API}/rules/${r.id}`, { frequency_minutes: Number(frequency_minutes) });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Change failed" }); }
    finally { setBusy(null); }
  };

  const deleteRule = async (r) => {
    if (!window.confirm(`Delete rule "${r.name}"? This only removes the rule — no data changes.`)) return;
    setBusy(r.id + ":del");
    try {
      await axios.delete(`${API}/rules/${r.id}`);
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Delete failed" }); }
    finally { setBusy(null); }
  };

  const runAll = async () => {
    setBusy("runall");
    try {
      const res = await axios.post(`${API}/rules/run-all`);
      onToast({ type: "ok", msg: `Ran ${res.data.ran} rules` });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Run failed" }); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">{rules.length} monitoring layer{rules.length === 1 ? "" : "s"}</div>
        <div className="flex gap-2">
          <button onClick={runAll} disabled={busy === "runall"}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
            data-testid="guardian-run-all">
            {busy === "runall" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run All Now
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg hover:border-slate-400"
            data-testid="guardian-add-rule">
            <Plus className="w-4 h-4" /> Add Layer
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rules.length === 0 && <EmptyBox icon={<Shield />} msg="No rules configured yet." />}
        {rules.map(r => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3"
               data-testid={`guardian-rule-${r.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${MODE_BADGE[r.action_mode]}`}>{r.action_mode}</span>
                <span className="text-[10px] uppercase font-semibold text-slate-500">{r.module}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${r.enabled ? "text-emerald-700" : "text-slate-400"}`}>
                  {r.enabled ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {r.enabled ? "enabled" : "disabled"}
                </span>
              </div>
              <div className="font-semibold text-slate-900 mt-1">{r.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Template: {r.template_key} · Last run: {fmtAgo(r.last_run_at)} · Last issues: {r.last_issue_count ?? 0}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={r.action_mode} onChange={(e) => setMode(r, e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5" data-testid={`guardian-mode-${r.id}`}>
                <option value="alert">Alert only</option>
                <option value="approval">Approval</option>
                <option value="autofix">Auto-fix</option>
              </select>
              <select value={r.frequency_minutes} onChange={(e) => setFreq(r, e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5" data-testid={`guardian-freq-${r.id}`}>
                <option value={5}>Every 5m</option>
                <option value={15}>Every 15m</option>
                <option value={30}>Every 30m</option>
                <option value={60}>Every 1h</option>
                <option value={120}>Every 2h</option>
                <option value={240}>Every 4h</option>
                <option value={360}>Every 6h</option>
                <option value={720}>Every 12h</option>
                <option value={1440}>Every 24h</option>
              </select>
              <button onClick={() => toggle(r)} disabled={busy === r.id + ":toggle"}
                className={`p-1.5 rounded border ${r.enabled ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-slate-200 text-slate-400 hover:bg-slate-50"}`}
                title={r.enabled ? "Disable" : "Enable"}>
                {r.enabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
              <button onClick={() => runNow(r)} disabled={busy === r.id + ":run"}
                className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50" title="Run now">
                {busy === r.id + ":run" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteRule(r)} disabled={busy === r.id + ":del"}
                className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddRuleModal templates={templates} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); onRefresh(); }} />}
    </div>
  );
};

const AddRuleModal = ({ templates, onClose, onDone }) => {
  const [form, setForm] = useState({ template_key: templates[0]?.key || "", name: "", action_mode: "alert", frequency_minutes: 60 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const selected = templates.find(t => t.key === form.template_key);

  useEffect(() => {
    if (selected) {
      setForm(f => ({
        ...f,
        name: f.name || selected.title.split("—")[0].trim(),
        action_mode: selected.supports_modes[0],
        frequency_minutes: selected.default_frequency_minutes,
      }));
    }
  }, [form.template_key]);  // eslint-disable-line

  const submit = async () => {
    setErr(""); setSaving(true);
    try {
      await axios.post(`${API}/rules`, form);
      onDone();
    } catch (e) { setErr(e?.response?.data?.detail || "Create failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Monitoring Layer</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick a template — all templates are safe & reversible.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Template</span>
            <select value={form.template_key} onChange={(e) => setForm({ ...form, template_key: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" data-testid="guardian-new-template">
              {templates.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder="e.g. Billing Alerts"
              data-testid="guardian-new-name" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Action Mode</span>
              <select value={form.action_mode} onChange={(e) => setForm({ ...form, action_mode: e.target.value })}
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm">
                {(selected?.supports_modes || ["alert"]).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Frequency (minutes)</span>
              <input type="number" min={5} max={10080} value={form.frequency_minutes}
                onChange={(e) => setForm({ ...form, frequency_minutes: Number(e.target.value) })}
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </label>
          </div>
          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50">Cancel</button>
            <button onClick={submit} disabled={saving || !form.name.trim()}
              className="px-3 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-700 disabled:opacity-50"
              data-testid="guardian-new-save">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Layer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Tab: Logs
// ──────────────────────────────────────────────────────────────────────
const LogsTab = ({ logs }) => {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter(l => l.level === filter);
  }, [logs, filter]);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">{filtered.length} of {logs.length}</span>
        <div className="ml-auto flex gap-1">
          {["all", "info", "warn", "error"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded ${filter === f ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 && <EmptyBox icon={<ListChecks />} msg="No logs yet." />}
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {filtered.map(l => (
            <div key={l.id} className="px-4 py-2.5 text-sm flex items-start gap-3" data-testid={`guardian-log-${l.id}`}>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${LEVEL_STYLE[l.level] || LEVEL_STYLE.info}`}>{l.level}</span>
              <span className="text-[11px] text-slate-400 font-mono w-32 flex-shrink-0">{fmtTime(l.ts).replace(",", "")}</span>
              <span className="text-[11px] text-slate-500 font-medium w-24 flex-shrink-0 uppercase">{l.module}</span>
              <span className="text-slate-700 flex-1 min-w-0 break-words">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Tab: Approvals
// ──────────────────────────────────────────────────────────────────────
const ApprovalsTab = ({ approvals, onRefresh, onToast }) => {
  const [busy, setBusy] = useState(null);
  const act = async (id, kind) => {
    setBusy(id + ":" + kind);
    try {
      await axios.post(`${API}/approvals/${id}/${kind}`, { actor: "admin" });
      onToast({ type: "ok", msg: `${kind === "approve" ? "Approved" : "Rejected"} successfully` });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Failed" }); }
    finally { setBusy(null); }
  };
  return (
    <div>
      <div className="text-sm text-slate-500 mb-3">{approvals.length} pending approval{approvals.length === 1 ? "" : "s"}</div>
      {approvals.length === 0 && <EmptyBox icon={<CheckCircle2 />} msg="All caught up — no pending approvals." />}
      <div className="space-y-2">
        {approvals.map(a => (
          <div key={a.id} className="bg-white border border-amber-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3"
               data-testid={`guardian-approval-${a.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-amber-700">
                <AlertTriangle className="w-4 h-4" /> PENDING · {a.module?.toUpperCase()}
              </div>
              <div className="font-semibold text-slate-900 mt-1">{a.action}</div>
              <div className="text-xs text-slate-500 mt-0.5">Target: {a.target} · {fmtAgo(a.proposed_at)}</div>
              <pre className="text-[11px] mt-1.5 bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(a.proposal, null, 2)}</pre>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => act(a.id, "approve")} disabled={busy?.startsWith(a.id)}
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                data-testid={`guardian-approve-${a.id}`}>
                {busy === a.id + ":approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
              </button>
              <button onClick={() => act(a.id, "reject")} disabled={busy?.startsWith(a.id)}
                className="px-3 py-1.5 bg-white border border-red-300 text-red-700 text-sm rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                data-testid={`guardian-reject-${a.id}`}>
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Tab: Backups (Rollback)
// ──────────────────────────────────────────────────────────────────────
const BackupsTab = ({ backups, onRefresh, onToast }) => {
  const [busy, setBusy] = useState(null);
  const restore = async (b) => {
    if (!window.confirm(`Restore ${b.collection}/${b.doc_id.slice(0, 8)}… to previous state?\n\nFields: ${Object.keys(b.before || {}).join(", ")}`)) return;
    setBusy(b.id);
    try {
      await axios.post(`${API}/backups/${b.id}/restore`, { actor: "admin", note: "manual rollback" });
      onToast({ type: "ok", msg: "Restored successfully" });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Restore failed" }); }
    finally { setBusy(null); }
  };
  return (
    <div>
      <div className="text-sm text-slate-500 mb-3">
        {backups.length} un-restored backup{backups.length === 1 ? "" : "s"} · Each Guardian autofix creates one.
      </div>
      {backups.length === 0 && <EmptyBox icon={<History />} msg="No rollbacks available." />}
      <div className="space-y-2">
        {backups.map(b => (
          <div key={b.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3"
               data-testid={`guardian-backup-${b.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold">
                <span className="text-slate-500">{b.collection}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 font-mono">{b.doc_id?.slice(0, 8)}…</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">{fmtAgo(b.ts)}</span>
              </div>
              <div className="text-sm text-slate-700 mt-1">{b.reason}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-[11px]">
                <div className="bg-red-50 border border-red-100 rounded p-2">
                  <div className="font-semibold text-red-700 mb-0.5">BEFORE</div>
                  <pre className="text-slate-700">{JSON.stringify(b.before || {}, null, 1)}</pre>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded p-2">
                  <div className="font-semibold text-emerald-700 mb-0.5">AFTER</div>
                  <pre className="text-slate-700">{JSON.stringify(b.after || {}, null, 1)}</pre>
                </div>
              </div>
            </div>
            <button onClick={() => restore(b)} disabled={busy === b.id}
              className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
              data-testid={`guardian-restore-${b.id}`}>
              {busy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Tab: Command Console
// ──────────────────────────────────────────────────────────────────────
const ConsoleTab = ({ onRefresh, onToast }) => {
  const [cmd, setCmd] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const doPreview = async () => {
    if (!cmd.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await axios.post(`${API}/command/preview`, { command: cmd });
      setPreview(r.data);
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Preview failed" }); }
    finally { setBusy(false); }
  };

  const doExecute = async () => {
    setBusy(true);
    try {
      const r = await axios.post(`${API}/command/execute`, { command: cmd, actor: "admin" });
      setResult(r.data);
      if (r.data.success) onToast({ type: "ok", msg: "Executed" });
      else onToast({ type: "err", msg: r.data.error || "Failed" });
      onRefresh();
    } catch (e) { onToast({ type: "err", msg: e?.response?.data?.detail || "Execute failed" }); }
    finally { setBusy(false); }
  };

  const examples = [
    "show health",
    "show issues",
    "show approvals",
    "run billing sync",
    "block customer 9XXXXXXXXX",
    "activate customer 9XXXXXXXXX",
    "mark payment_due 9XXXXXXXXX",
  ];

  return (
    <div className="max-w-3xl">
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 font-mono text-sm shadow-lg">
        <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3">
          <Terminal className="w-4 h-4" /> ASR GUARDIAN — COMMAND CONSOLE
        </div>
        <div className="flex gap-2">
          <span className="text-emerald-400">$</span>
          <input value={cmd} onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doPreview(); }}
            placeholder="type command and press Enter…"
            className="flex-1 bg-transparent border-0 outline-none placeholder-slate-500 text-slate-100"
            data-testid="guardian-console-input" autoFocus />
        </div>
        {preview && (
          <div className="mt-4 pl-4 border-l-2 border-emerald-500/50 text-xs space-y-1">
            <div className="text-slate-400">parsed → <span className="text-amber-300">{preview.parsed.kind}</span> {JSON.stringify(preview.parsed.args || {})}</div>
            <div className="text-slate-300">{preview.preview.summary}</div>
            <div className="text-slate-500">risk: {preview.preview.risk} · reversible: {String(preview.preview.reversible)}</div>
          </div>
        )}
        {result && (
          <div className="mt-4 pl-4 border-l-2 border-sky-500/50 text-xs">
            <pre className="text-slate-300 whitespace-pre-wrap">{JSON.stringify(result, null, 2).slice(0, 800)}</pre>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={doPreview} disabled={busy || !cmd.trim()}
          className="px-3 py-2 bg-white border border-slate-200 text-sm rounded hover:border-slate-400 disabled:opacity-50"
          data-testid="guardian-console-preview">
          Preview
        </button>
        <button onClick={doExecute} disabled={busy || !preview || preview.parsed.kind === "unknown"}
          className="px-3 py-2 bg-slate-900 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1"
          data-testid="guardian-console-execute">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Execute
        </button>
        <button onClick={() => { setCmd(""); setPreview(null); setResult(null); }}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">Clear</button>
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold text-slate-500 mb-2">EXAMPLES — click to use</div>
        <div className="flex flex-wrap gap-2">
          {examples.map(e => (
            <button key={e} onClick={() => { setCmd(e); setPreview(null); setResult(null); }}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded hover:border-slate-400 text-slate-700">
              {e}
            </button>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-3 flex gap-2">
          <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div>
            Every command runs through Guardian's whitelist — it can only toggle a fixed set of safe fields, queue approvals, or run monitoring rules.
            <strong> No code generation, no schema changes, no payment config touches.</strong> Every write creates a backup you can restore from the Rollbacks tab.
          </div>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Empty box
// ──────────────────────────────────────────────────────────────────────
const EmptyBox = ({ icon, msg }) => (
  <div className="p-10 text-center text-slate-400">
    <div className="inline-flex w-10 h-10 items-center justify-center text-slate-300">{icon}</div>
    <div className="text-sm mt-2">{msg}</div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────
export const GuardianDashboard = () => {
  const guardian = useGuardian();
  const [tab, setTab] = useState("rules");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-800" data-testid="guardian-back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Shield className="w-6 h-6 text-indigo-700" />
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">AI Website Guardian</h1>
          <span className="ml-auto text-xs text-slate-400">monitor · approve · rollback</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <HealthCard health={guardian.health} onRefresh={guardian.refresh} loading={guardian.loading} />

        <div className="flex flex-wrap gap-2 mb-5">
          <Tab active={tab === "rules"}     onClick={() => setTab("rules")}     icon={<Settings className="w-4 h-4" />}    label="Rules" />
          <Tab active={tab === "logs"}      onClick={() => setTab("logs")}      icon={<ListChecks className="w-4 h-4" />} label="Logs" />
          <Tab active={tab === "approvals"} onClick={() => setTab("approvals")} icon={<AlertTriangle className="w-4 h-4" />} label="Approvals" badge={guardian.approvals?.length} />
          <Tab active={tab === "backups"}   onClick={() => setTab("backups")}   icon={<History className="w-4 h-4" />}    label="Rollbacks" />
          <Tab active={tab === "console"}   onClick={() => setTab("console")}   icon={<Terminal className="w-4 h-4" />}   label="Console" />
        </div>

        {tab === "rules"     && <RulesTab     rules={guardian.rules}     onRefresh={guardian.refresh} onToast={guardian.setToast} />}
        {tab === "logs"      && <LogsTab      logs={guardian.logs} />}
        {tab === "approvals" && <ApprovalsTab approvals={guardian.approvals} onRefresh={guardian.refresh} onToast={guardian.setToast} />}
        {tab === "backups"   && <BackupsTab   backups={guardian.backups} onRefresh={guardian.refresh} onToast={guardian.setToast} />}
        {tab === "console"   && <ConsoleTab   onRefresh={guardian.refresh} onToast={guardian.setToast} />}
      </div>

      {guardian.toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
          guardian.toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {guardian.toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {guardian.toast.msg}
        </div>
      )}
    </div>
  );
};

export default GuardianDashboard;
