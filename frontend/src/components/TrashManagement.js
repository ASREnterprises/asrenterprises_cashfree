import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Trash2, RotateCcw, ArrowLeft, AlertCircle, Clock, RefreshCw, Loader2, Receipt, Users, ShoppingBag, UserCog, CheckCircle2, FileCheck2, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { confirm } from "../utils/confirm";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SOURCE_TABS = [
  { key: "all", label: "All", icon: Trash2 },
  { key: "invoices", label: "Invoices & Quotations", icon: Receipt },
  { key: "customers", label: "Customers", icon: Users },
  { key: "orders", label: "Shop Orders", icon: ShoppingBag },
  { key: "agents", label: "Solar Advisors", icon: UserCog },
  { key: "agreements", label: "Solar Agreements", icon: FileCheck2 },
  { key: "crm_leads", label: "CRM Leads", icon: Target },
];

export const TrashManagement = () => {
  const [active, setActive] = useState("all");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [ttlDays, setTtlDays] = useState(30);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (active !== "all") params.set("source", active);
      const r = await axios.get(`${API}/trash?${params.toString()}`);
      setItems(r.data.items || []);
      setCounts(r.data.counts || {});
      setTtlDays(r.data.ttl_days || 30);
    } catch (e) {
      console.error(e);
      setToast({ type: "err", msg: "Failed to load trash" });
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const totalAll = useMemo(() => Object.values(counts).reduce((s, n) => s + Number(n || 0), 0), [counts]);

  const restore = async (it) => {
    if (busyId) return;
    // Optimistic remove — revert on failure.
    const before = items;
    setItems(before.filter(x => x.id !== it.id));
    setBusyId(it.id);
    try {
      await axios.post(`${API}/trash/${it.id}/restore`);
      setToast({ type: "ok", msg: `Restored "${it.label}"` });
      fetchTrash();
    } catch (e) {
      setItems(before);
      setToast({ type: "err", msg: e?.response?.data?.detail || "Restore failed" });
    } finally { setBusyId(null); }
  };

  const purge = async (it) => {
    if (busyId) return;
    const ok = await confirm({
      title: "Permanently delete?",
      message: `"${it.label}"\n\nThis cannot be undone.`,
      confirmText: "Delete Forever",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    const before = items;
    setItems(before.filter(x => x.id !== it.id));
    setBusyId(it.id);
    try {
      await axios.delete(`${API}/trash/${it.id}`);
      setToast({ type: "ok", msg: `Permanently deleted` });
      fetchTrash();
    } catch (e) {
      setItems(before);
      setToast({ type: "err", msg: e?.response?.data?.detail || "Delete failed" });
    } finally { setBusyId(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 hover:bg-slate-100 rounded-lg" data-testid="trash-back">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#0a355e] flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Trash
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Deleted items from GST Invoices, Customer Portal, Shop Management, and Solar Advisors are kept for {ttlDays} days and then auto-deleted.</p>
          </div>
          <button onClick={fetchTrash} disabled={loading} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50" data-testid="trash-refresh">
            <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Source tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {SOURCE_TABS.map(({ key, label, icon: Icon }) => {
            const count = key === "all" ? totalAll : (counts[key] || 0);
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-semibold border transition ${isActive ? "bg-[#0a355e] text-white border-[#0a355e]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                data-testid={`trash-tab-${key}`}
              >
                <Icon className="w-4 h-4" /> {label}
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <Trash2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Trash is empty</p>
            <p className="text-xs text-slate-400 mt-1">Deleted items will appear here for {ttlDays} days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const srcLabel = SOURCE_TABS.find(s => s.key === it.source_collection)?.label || it.source_collection;
              const Icon = SOURCE_TABS.find(s => s.key === it.source_collection)?.icon || Trash2;
              const urgent = it.days_remaining <= 7;
              return (
                <div key={it.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3" data-testid={`trash-row-${it.id}`}>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#0a355e] truncate">{it.label}</p>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{srcLabel}</span>
                    </div>
                    {it.subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{it.subtitle}</p>}
                    <p className={`text-[11px] mt-1 flex items-center gap-1 ${urgent ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                      <Clock className="w-3 h-3" />
                      Auto-deletes in <span className="font-bold">{it.days_remaining} day{it.days_remaining === 1 ? "" : "s"}</span>
                      <span className="text-slate-300">·</span>
                      Deleted {new Date(it.deleted_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => restore(it)}
                      disabled={busyId === it.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200 flex items-center gap-1 disabled:opacity-50"
                      data-testid={`trash-restore-${it.id}`}
                    >
                      {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Restore
                    </button>
                    <button
                      onClick={() => purge(it)}
                      disabled={busyId === it.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 flex items-center gap-1 disabled:opacity-50"
                      data-testid={`trash-purge-${it.id}`}
                    >
                      <Trash2 className="w-3 h-3" /> Delete Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toast.type === "ok" ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};
