import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  ArrowLeft, FileCheck2, Search, Download, Send, Trash2,
  Loader2, RefreshCw, CheckCircle2, AlertCircle, Phone, Calendar, FileText,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PAGE_SIZE = 30;

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso || "—"; }
};

export const AgreementsManagement = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      const r = await axios.get(`${API}/agreements?${params.toString()}`);
      setRows(r.data.agreements || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
      setToast({ type: "err", msg: e?.response?.data?.detail || "Failed to load agreements" });
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openPdf = (a) => {
    // Append a cache-buster so Chrome / WhatsApp's embedded PDF viewer never
    // serves a stale copy after the backend template is updated.
    const v = a.regenerated_at || a.created_at || Date.now();
    const url = `${API}/agreements/${a.id}/pdf?v=${encodeURIComponent(v)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sendWhatsapp = async (a) => {
    if (busyId) return;
    if (!window.confirm(`Send agreement to ${a.customer_name} on WhatsApp (${a.customer_phone})?`)) return;
    setBusyId(a.id + ":wa");
    try {
      const r = await axios.post(`${API}/agreements/${a.id}/send-whatsapp`);
      if (r.data?.success) {
        setToast({ type: "ok", msg: "Sent on WhatsApp" });
        fetchAll();
      } else {
        setToast({ type: "err", msg: r.data?.error || "WhatsApp send failed" });
      }
    } catch (e) {
      setToast({ type: "err", msg: e?.response?.data?.detail || "WhatsApp send failed" });
    } finally { setBusyId(null); }
  };

  const deleteAgreement = async (a) => {
    if (busyId) return;
    if (!window.confirm(`Move this agreement to Trash?\n\n${a.quotation_number || ""} · ${a.customer_name}\n\nIt will be auto-purged after 30 days if not restored.`)) return;
    setBusyId(a.id + ":del");
    try {
      await axios.delete(`${API}/agreements/${a.id}`);
      setToast({ type: "ok", msg: "Moved to Trash (30 days)" });
      fetchAll();
    } catch (e) {
      setToast({ type: "err", msg: e?.response?.data?.detail || "Delete failed" });
    } finally { setBusyId(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastIdx = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-800" data-testid="agreements-back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <FileCheck2 className="w-6 h-6 text-emerald-700" />
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Solar Agreements — PM Surya Ghar Yojana</h1>
          <span className="ml-auto text-xs sm:text-sm text-slate-500 font-medium">
            {total} agreement{total === 1 ? "" : "s"}
          </span>
          <button
            onClick={fetchAll}
            className="ml-2 inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100"
            data-testid="agreements-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, phone or quotation number…"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            data-testid="agreements-search"
          />
        </div>
      </div>

      {/* List */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {loading && rows.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading agreements…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <FileCheck2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No Solar Agreements yet</p>
              <p className="text-xs mt-1">Agreements are auto-generated when a PM Surya Ghar quotation is created.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-left px-4 py-3">Quotation</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50" data-testid={`agreement-row-${a.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{a.customer_name || "—"}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {a.customer_phone || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-700">{a.quotation_number || "—"}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{((a.file_size || 0) / 1024).toFixed(0)} KB PDF</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(a.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.whatsapp_sent_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                            <FileText className="w-3 h-3" /> Generated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openPdf(a)}
                            title="Open PDF"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                            data-testid={`agreement-pdf-${a.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => sendWhatsapp(a)}
                            disabled={busyId === a.id + ":wa"}
                            title="Send on WhatsApp"
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                            data-testid={`agreement-whatsapp-${a.id}`}
                          >
                            {busyId === a.id + ":wa" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteAgreement(a)}
                            disabled={busyId === a.id + ":del"}
                            title="Delete (move to Trash for 30 days)"
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                            data-testid={`agreement-delete-${a.id}`}
                          >
                            {busyId === a.id + ":del" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {rows.map((a) => (
                  <div key={a.id} className="p-4" data-testid={`agreement-card-${a.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{a.customer_name || "—"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{a.customer_phone} · {a.quotation_number}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{formatDate(a.created_at)}</div>
                      </div>
                      {a.whatsapp_sent_at ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Sent</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Generated</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openPdf(a)} className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded flex items-center justify-center gap-1">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button onClick={() => sendWhatsapp(a)} disabled={busyId === a.id + ":wa"} className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded flex items-center justify-center gap-1 disabled:opacity-50">
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      <button onClick={() => deleteAgreement(a)} disabled={busyId === a.id + ":del"} className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded flex items-center gap-1 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-slate-500">
              Showing <span className="font-semibold text-slate-700">{firstIdx}–{lastIdx}</span> of{" "}
              <span className="font-semibold text-slate-700">{total}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs border rounded disabled:opacity-40">First</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Prev</button>
              <span className="px-3 py-1 text-xs bg-slate-100 rounded">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Next</button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Last</button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
          toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AgreementsManagement;
