import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FileText, Download, Send, Mail, Plus, RefreshCw, Search, IndianRupee,
  ArrowLeft, Loader2, X, CheckCircle2, AlertCircle, Trash2, History,
  ArrowRightLeft, Bell, TrendingUp, Wallet, Receipt, Edit3, Calendar
} from "lucide-react";
import { confirm } from "../utils/confirm";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PROJECT_TYPES = [
  { value: "solar_project", label: "Solar Project (Full EPC — 90/10 split @ 5%+18%)" },
  { value: "solar_project_flat_5", label: "Solar Project — Flat 5%" },
  { value: "solar_goods", label: "Solar Goods only (5% GST)" },
  { value: "service", label: "Service / AMC (18% GST)" },
];

// Solar Quotation form — ordered per owner's spec.
const SOLAR_BRANDS = ["Tata", "Adani", "Loom", "Waaree", "Luminous", "Vikram", "UTL"];
const SOLAR_CAPACITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Effective GST rate per scheme (matches backend _BLENDED_GST_RATE in gst_invoices.py)
const GST_RATES = {
  "solar_project": 0.063,       // 90%@5% + 10%@18%
  "solar_project_flat_5": 0.05,
  "solar_goods": 0.05,
  "service": 0.18,
};
// District master — Bihar is exhaustive (owner operates here), others allow free-text fallback.
const DISTRICTS = {
  "Bihar": ["Patna","Nalanda","Gaya","Bhagalpur","Muzaffarpur","Darbhanga","Saran","Rohtas","Vaishali","Samastipur","Begusarai","Purnia","Katihar","Madhubani","East Champaran","West Champaran","Sitamarhi","Sheohar","Siwan","Gopalganj","Lakhisarai","Sheikhpura","Jamui","Jehanabad","Nawada","Aurangabad","Arwal","Banka","Buxar","Kaimur","Khagaria","Kishanganj","Madhepura","Munger","Saharsa","Supaul","Arariya"],
};

const PAGE_SIZE = 30;

const PAYMENT_MODES = ["ICICI", "SBI", "Cashfree", "Cash", "UPI", "Cheque", "Other"];

const STATES = [
  ["Bihar", "10"], ["Jharkhand", "20"], ["Uttar Pradesh", "09"], ["West Bengal", "19"],
  ["Delhi", "07"], ["Maharashtra", "27"], ["Karnataka", "29"], ["Tamil Nadu", "33"],
  ["Gujarat", "24"], ["Rajasthan", "08"], ["Madhya Pradesh", "23"], ["Odisha", "21"],
  ["Assam", "18"], ["Chhattisgarh", "22"], ["Haryana", "06"], ["Punjab", "03"],
  ["Kerala", "32"], ["Telangana", "36"], ["Andhra Pradesh", "37"],
];

const formatINR = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
};

export const InvoicesManagement = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", status: "", doc_type: "invoice" });
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createQuotationBackdate, setCreateQuotationBackdate] = useState(false);
  const [recordPaymentFor, setRecordPaymentFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [convertFor, setConvertFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [changeDateFor, setChangeDateFor] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState({});  // id -> action name

  const showToast = (message, kind = "ok") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      const [listRes, dashRes] = await Promise.all([
        axios.get(`${API}/gst/invoices?${params.toString()}`),
        axios.get(`${API}/gst/dashboard`),
      ]);
      setInvoices(listRes.data.invoices || []);
      setTotal(listRes.data.total || 0);
      setDashboard(dashRes.data);
      setStats(dashRes.data?.kpi || null);
    } catch (e) {
      console.error("Invoice fetch failed:", e);
      showToast("Failed to load invoices", "err");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [filters.search, filters.status, filters.doc_type]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const downloadPdf = async (inv) => {
    try {
      setBusy((b) => ({ ...b, [inv.id]: "download" }));
      const res = await axios.get(`${API}/gst/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(inv.invoice_number || "invoice").replace(/\//g, "_")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast("Download failed", "err");
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[inv.id]; return n; });
    }
  };

  const resendWhatsApp = async (inv) => {
    try {
      setBusy((b) => ({ ...b, [inv.id]: "wa" }));
      const res = await axios.post(`${API}/gst/invoices/${inv.id}/resend-whatsapp`);
      showToast(res.data?.success ? "WhatsApp resent" : `WhatsApp: ${res.data?.error || "failed"}`, res.data?.success ? "ok" : "err");
    } catch { showToast("Resend WhatsApp failed", "err"); }
    finally { setBusy((b) => { const n = { ...b }; delete n[inv.id]; return n; }); }
  };

  const resendEmail = async (inv) => {
    try {
      setBusy((b) => ({ ...b, [inv.id]: "email" }));
      const res = await axios.post(`${API}/gst/invoices/${inv.id}/resend-email`);
      showToast(res.data?.success ? "Email sent" : `Email: ${res.data?.error || "not configured"}`, res.data?.success ? "ok" : "err");
    } catch { showToast("Resend email failed", "err"); }
    finally { setBusy((b) => { const n = { ...b }; delete n[inv.id]; return n; }); }
  };

  const deleteInvoice = async (inv) => {
    const label = inv.doc_type === "quotation" ? "quotation" : "invoice";
    const ok = await confirm({
      title: `Delete ${label}?`,
      message: `${inv.invoice_number}\n\nThis cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    // Optimistic remove — revert on error.
    const before = null;
    setInvoices((list) => {
      const prev = list;
      // restore closure var
      // eslint-disable-next-line no-unused-vars
      const _ = prev;
      return list.filter((i) => i.id !== inv.id);
    });
    setTotal((t) => Math.max(0, t - 1));
    try {
      setBusy((b) => ({ ...b, [inv.id]: "delete" }));
      await axios.delete(`${API}/gst/invoices/${inv.id}`);
      showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} ${inv.invoice_number} deleted`);
    } catch (e) {
      // Revert by re-fetching (simpler than reconstructing filtered list).
      fetchAll();
      showToast(e?.response?.data?.detail || "Delete failed", "err");
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[inv.id]; return n; });
    }
  };

  const sendReminder = async (inv) => {
    const ok = await confirm({
      title: "Send WhatsApp reminder?",
      message: `${inv.invoice_number}\nTo: +91 ${inv.customer?.phone || "—"}`,
      confirmText: "Send",
      cancelText: "Cancel",
      tone: "info",
    });
    if (!ok) return;
    try {
      setBusy((b) => ({ ...b, [inv.id]: "reminder" }));
      const res = await axios.post(`${API}/gst/reminders/invoices/${inv.id}/send`);
      showToast(
        res.data?.success
          ? `Reminder sent via ${res.data?.result?.channel || "WhatsApp"}`
          : `Reminder: ${res.data?.result?.error || "failed"}`,
        res.data?.success ? "ok" : "err"
      );
      fetchAll();
    } catch (e) {
      showToast(e?.response?.data?.detail || "Could not send reminder", "err");
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[inv.id]; return n; });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
              data-testid="invoices-back-btn"
            >
              <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Back</span>
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-[#0a355e] flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" /> GST Invoices
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              data-testid="invoices-refresh-btn" title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => { setCreateQuotationBackdate(filters.doc_type === "quotation"); setShowCreate(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-[#0a355e] hover:bg-[#092a4b] text-white rounded-lg font-medium"
              data-testid="invoices-create-btn"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{filters.doc_type === "quotation" ? "New Quotation" : "New Invoice"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* KPI Strip — Revenue / Pending / Total / Paid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="Total Revenue" value={formatINR(stats?.total_revenue || 0)}
            icon={<TrendingUp className="w-5 h-5" />} color="from-emerald-600 to-emerald-700"
            testid="kpi-revenue"
          />
          <KpiCard
            label="Pending Amount" value={formatINR(stats?.total_due || 0)}
            icon={<Wallet className="w-5 h-5" />} color="from-red-600 to-red-700"
            subtitle={`${(stats?.unpaid_count || 0) + (stats?.partial_count || 0)} invoices outstanding`}
            testid="kpi-pending"
          />
          <KpiCard
            label="Total Invoices" value={stats?.total_invoices ?? "—"}
            icon={<Receipt className="w-5 h-5" />} color="from-indigo-700 to-indigo-800"
            subtitle={`${stats?.this_month_count || 0} this month`}
            testid="kpi-total"
          />
          <KpiCard
            label="Paid Invoices" value={stats?.paid_count ?? "—"}
            icon={<CheckCircle2 className="w-5 h-5" />} color="from-amber-600 to-amber-700"
            subtitle={`${stats?.partial_count || 0} partial · ${stats?.unpaid_count || 0} unpaid`}
            testid="kpi-paid"
          />
        </div>

        {/* Monthly revenue spark (optional) */}
        {dashboard?.monthly_revenue?.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-5 hidden md:block">
            <div className="text-xs font-semibold text-slate-600 uppercase mb-3">Revenue — last 6 months</div>
            <MonthlyBarChart data={dashboard.monthly_revenue} />
          </div>
        )}

        {/* Doc-type Tabs (Invoices / Quotations / All) */}
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 mb-3 w-fit">
          {[
            { id: "invoice", label: "Invoices", icon: Receipt },
            { id: "quotation", label: "Quotations", icon: FileText },
            { id: "", label: "All" },
          ].map(t => (
            <button
              key={t.id || "all"}
              onClick={() => setFilters({ ...filters, doc_type: t.id })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition ${
                filters.doc_type === t.id ? "bg-[#0a355e] text-white shadow" : "text-slate-600 hover:text-[#0a355e]"
              }`}
              data-testid={`invoices-doctab-${t.id || "all"}`}
            >
              {t.icon && <t.icon className="w-4 h-4" />} {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text" placeholder="Search invoice no / customer / phone / order id"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm"
              data-testid="invoices-search-input"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            data-testid="invoices-status-filter"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <span className="text-xs text-slate-500">{total} result{total === 1 ? "" : "s"}</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Invoice #</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Due</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400 inline" /></td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 text-slate-300 inline-block mb-2" /><br/>
                    No invoices yet. Click "New Invoice" to create one.
                  </td></tr>
                ) : invoices.map((inv) => {
                  const action = busy[inv.id];
                  const isQuote = inv.doc_type === "quotation";
                  const paid = Number(inv.amount_paid || 0);
                  const due = Number(inv.due_amount ?? Math.max(0, (inv.grand_total || 0) - paid));
                  const pstatus = (inv.payment_status || "unpaid").toLowerCase();
                  return (
                    <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`invoice-row-${inv.invoice_number}`}>
                      <td className="px-3 py-2 font-mono font-semibold text-[#0a355e]">
                        {inv.invoice_number}
                        {inv.scheme === "pm_surya_ghar" && (
                          <div className="text-[10px] font-sans font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 mt-0.5 inline-block">PM Surya Ghar</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{inv.invoice_date || formatDate(inv.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{inv.customer?.name}</div>
                        <div className="text-xs text-slate-500">{inv.customer?.phone} · {inv.customer?.state || "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatINR(inv.grand_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatINR(paid)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${due > 0 ? "text-red-600" : "text-slate-400"}`}>
                        {formatINR(due)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isQuote ? (
                          inv.status === "converted" ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800" data-testid={`invoice-status-${inv.invoice_number}`}>CONVERTED</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800" data-testid={`invoice-status-${inv.invoice_number}`}>QUOTE</span>
                          )
                        ) : pstatus === "paid" ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800" data-testid={`invoice-status-${inv.invoice_number}`}>PAID</span>
                        ) : pstatus === "partial" ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800" data-testid={`invoice-status-${inv.invoice_number}`}>PARTIAL</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800" data-testid={`invoice-status-${inv.invoice_number}`}>UNPAID</span>
                        )}
                        {inv.payment_mode && !isQuote && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{inv.payment_mode}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {isQuote && inv.status !== "converted" && (
                            <IconBtn onClick={() => setConvertFor(inv)} busy={false} title="Convert to Invoice" testid={`invoice-convert-${inv.invoice_number}`} color="indigo">
                              <ArrowRightLeft className="w-4 h-4" />
                            </IconBtn>
                          )}
                          {!isQuote && pstatus !== "paid" && (
                            <IconBtn onClick={() => setRecordPaymentFor(inv)} busy={false} title="Record Payment" testid={`invoice-record-payment-${inv.invoice_number}`} color="emerald-strong">
                              <IndianRupee className="w-4 h-4" />
                            </IconBtn>
                          )}
                          {!isQuote && pstatus !== "paid" && (
                            <IconBtn onClick={() => sendReminder(inv)} busy={action === "reminder"} title="Send Payment Reminder (WhatsApp)" testid={`invoice-reminder-${inv.invoice_number}`} color="amber">
                              <Bell className="w-4 h-4" />
                            </IconBtn>
                          )}
                          {!isQuote && (inv.payment_history?.length || 0) > 0 && (
                            <IconBtn onClick={() => setHistoryFor(inv)} busy={false} title="Payment History" testid={`invoice-history-${inv.invoice_number}`} color="slate">
                              <History className="w-4 h-4" />
                            </IconBtn>
                          )}
                          <IconBtn onClick={() => setEditFor(inv)} busy={false} title={isQuote ? "Edit Quotation" : "Edit Invoice"} testid={`invoice-edit-${inv.invoice_number}`} color="indigo">
                            <Edit3 className="w-4 h-4" />
                          </IconBtn>
                          {!isQuote && pstatus === "paid" && inv.scheme === "pm_surya_ghar" && (
                            <IconBtn onClick={() => setChangeDateFor(inv)} busy={false} title="Change Invoice Date (PMSG paid)" testid={`invoice-changedate-${inv.invoice_number}`} color="amber">
                              <Calendar className="w-4 h-4" />
                            </IconBtn>
                          )}
                          <IconBtn onClick={() => downloadPdf(inv)} busy={action === "download"} title="Download PDF" testid={`invoice-download-${inv.invoice_number}`}>
                            <Download className="w-4 h-4" />
                          </IconBtn>
                          <IconBtn onClick={() => resendWhatsApp(inv)} busy={action === "wa"} title="Resend WhatsApp" testid={`invoice-wa-${inv.invoice_number}`} color="green">
                            <Send className="w-4 h-4" />
                          </IconBtn>
                          <IconBtn onClick={() => resendEmail(inv)} busy={action === "email"} title="Resend Email" testid={`invoice-email-${inv.invoice_number}`} color="blue">
                            <Mail className="w-4 h-4" />
                          </IconBtn>
                          <IconBtn onClick={() => deleteInvoice(inv)} busy={action === "delete"} title="Delete" testid={`invoice-delete-${inv.invoice_number}`} color="red">
                            <Trash2 className="w-4 h-4" />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — 30 per page */}
          {total > PAGE_SIZE && (() => {
            const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const safePage = Math.min(page, pageCount);
            const pagesToShow = [];
            const windowSize = 5;
            let startP = Math.max(1, safePage - Math.floor(windowSize / 2));
            let endP = Math.min(pageCount, startP + windowSize - 1);
            startP = Math.max(1, endP - windowSize + 1);
            for (let p = startP; p <= endP; p++) pagesToShow.push(p);
            const firstIdx = (safePage - 1) * PAGE_SIZE + 1;
            const lastIdx = Math.min(safePage * PAGE_SIZE, total);
            return (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-3 bg-white border-t border-slate-200" data-testid="invoices-pagination">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700">{firstIdx}–{lastIdx}</span> of <span className="font-semibold text-slate-700">{total}</span> {filters.doc_type === "quotation" ? "quotations" : (filters.doc_type === "invoice" ? "invoices" : "records")}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button" onClick={() => setPage(1)} disabled={safePage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    data-testid="pagination-first">« First
                  </button>
                  <button
                    type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    data-testid="pagination-prev">‹ Prev
                  </button>
                  {pagesToShow.map(p => (
                    <button
                      key={p} type="button" onClick={() => setPage(p)}
                      className={`min-w-[28px] px-2 py-1 text-xs rounded border ${p === safePage ? "bg-[#0a355e] text-white border-[#0a355e] font-semibold" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}
                      data-testid={`pagination-page-${p}`}
                    >{p}</button>
                  ))}
                  <button
                    type="button" onClick={() => setPage(Math.min(pageCount, safePage + 1))} disabled={safePage === pageCount}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    data-testid="pagination-next">Next ›
                  </button>
                  <button
                    type="button" onClick={() => setPage(pageCount)} disabled={safePage === pageCount}
                    className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    data-testid="pagination-last">Last »
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {showCreate && <CreateInvoiceModal
        initialDocType={filters.doc_type === "quotation" ? "quotation" : "invoice"}
        allowBackdate={createQuotationBackdate || filters.doc_type === "quotation"}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchAll(); showToast(filters.doc_type === "quotation" ? "Quotation created" : "Invoice created"); }}
      />}

      {editFor && <EditInvoiceModal
        invoice={editFor}
        onClose={() => setEditFor(null)}
        onSaved={(msg) => { setEditFor(null); fetchAll(); showToast(msg || "Saved"); }}
      />}

      {changeDateFor && <ChangeInvoiceDateModal
        invoice={changeDateFor}
        onClose={() => setChangeDateFor(null)}
        onSaved={(msg) => { setChangeDateFor(null); fetchAll(); showToast(msg || "Invoice date updated"); }}
      />}

      {recordPaymentFor && <RecordPaymentModal
        invoice={recordPaymentFor}
        onClose={() => setRecordPaymentFor(null)}
        onSaved={(msg) => { setRecordPaymentFor(null); fetchAll(); showToast(msg || "Payment recorded"); }}
      />}

      {historyFor && <PaymentHistoryModal
        invoice={historyFor}
        onClose={() => setHistoryFor(null)}
        onDeleted={(msg) => { fetchAll(); showToast(msg || "Entry removed"); }}
      />}

      {convertFor && <ConvertQuotationModal
        quotation={convertFor}
        onClose={() => setConvertFor(null)}
        onConverted={(invoiceNumber) => { setConvertFor(null); fetchAll(); showToast(`Converted to invoice ${invoiceNumber}`); }}
      />}

      {toast && (
        <div
          data-testid="invoice-toast"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white ${
            toast.kind === "err" ? "bg-red-600" : "bg-emerald-700"
          }`}
        >
          {toast.kind === "err" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color, small }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-3" data-testid="stat-card-legacy">
    <div className={`w-1 h-6 rounded-full ${color} inline-block mr-2 align-middle`} />
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <div className={`mt-1 font-bold text-[#0a355e] ${small ? "text-sm" : "text-2xl"}`}>{value}</div>
  </div>
);
// Note: StatCard retained for backwards-compatibility; KpiCard is the new dashboard card.
// eslint-disable-next-line no-unused-vars
const _legacyStatCard = StatCard;

const IconBtn = ({ children, onClick, busy, title, testid, color = "slate" }) => {
  const colorMap = {
    slate: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    green: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
    "emerald-strong": "bg-emerald-600 hover:bg-emerald-700 text-white",
    blue: "bg-sky-100 hover:bg-sky-200 text-sky-700",
    indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
    amber: "bg-amber-100 hover:bg-amber-200 text-amber-700",
    red: "bg-red-100 hover:bg-red-200 text-red-700",
  };
  return (
    <button
      onClick={onClick} disabled={busy} title={title} data-testid={testid}
      className={`p-1.5 rounded ${colorMap[color]} disabled:opacity-50 transition`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};

// ==================== CREATE INVOICE MODAL ====================
const CreateInvoiceModal = ({ onClose, onCreated, initialDocType = "invoice", allowBackdate = false }) => {
  const [form, setForm] = useState({
    // Customer
    name: "", phone: "", email: "", gstin: "", address: "",
    state: "Bihar", state_code: "10", district: "Patna", pincode: "",
    // Segmentation — drives bank + scheme
    customer_segment: initialDocType === "quotation" ? "residential" : "commercial",
    pm_surya_ghar_app_no: "",
    // Solar spec — powers auto-generated item name
    solar_brand: "Tata", capacity_kw: "3", capacity_custom: "",
    // Pricing
    project_type: "solar_project_flat_5", project_name: "",
    total_amount: "", amount_is_inclusive: false, notes: "", doc_type: initialDocType,
    auto_send_whatsapp: true, auto_send_email: true,
    invoice_date: "",
  });
  // Track whether admin has manually edited the item name (so we stop auto-overwriting it).
  const [nameEdited, setNameEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onStateChange = (name) => {
    const row = STATES.find(([n]) => n === name);
    setForm((f) => ({
      ...f, state: name, state_code: row ? row[1] : f.state_code,
      // Reset district when state changes
      district: name === "Bihar" ? "Patna" : "",
    }));
  };

  const effectiveCapacity = form.capacity_kw === "custom"
    ? (parseFloat(form.capacity_custom) || 0)
    : parseFloat(form.capacity_kw || "0");

  // Dynamic Item Name: brand-aware naming per owner spec.
  //   Tata           → "TATA Power Solar System Kit of {N}kW"
  //   Other brands   → "{BRAND} Solar System Kit of {N}kW"
  useEffect(() => {
    if (nameEdited) return;
    if (form.solar_brand && effectiveCapacity > 0) {
      const brandUpper = form.solar_brand.toUpperCase();
      const middle = brandUpper === "TATA" ? "Power Solar System Kit" : "Solar System Kit";
      setForm((f) => ({
        ...f,
        project_name: `${brandUpper} ${middle} of ${effectiveCapacity}kW`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.solar_brand, form.capacity_kw, form.capacity_custom, nameEdited]);

  const isResidential = form.customer_segment === "residential";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone || !form.email) {
      setError("Customer Name, Phone and Email are required."); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Please enter a valid email address."); return;
    }
    if (!form.total_amount || parseFloat(form.total_amount) <= 0) {
      setError("Total Amount is required."); return;
    }
    if (effectiveCapacity <= 0) {
      setError("Solar Capacity is required."); return;
    }
    setSubmitting(true);
    try {
      // Build a rich note trailer so nothing gets lost on the PDF.
      const trailerBits = [];
      if (isResidential && form.pm_surya_ghar_app_no) {
        trailerBits.push(`PM Surya Ghar App No: ${form.pm_surya_ghar_app_no}`);
      }
      if (!isResidential && form.gstin) {
        trailerBits.push(`GSTIN: ${form.gstin}`);
      }
      trailerBits.push(`Solar Brand: ${form.solar_brand} · Capacity: ${effectiveCapacity} kW`);
      const finalNotes = [form.notes || "", trailerBits.join(" | ")].filter(Boolean).join("\n");

      const body = {
        customer: {
          name: form.name, phone: form.phone, email: form.email || "",
          gstin: isResidential ? "" : (form.gstin || ""),
          address: form.address || "",
          state: form.state, state_code: form.state_code, pincode: form.pincode || "",
        },
        // GST Scheme is now user-selectable for BOTH residential + commercial.
        project_type: form.project_type,
        project_name: form.project_name || "Solar Service",
        total_amount: parseFloat(form.total_amount),
        // AMOUNT + GST = TOTAL mode: entered amount is pre-GST (backend computes GST).
        // Inclusive mode: entered amount is final (backend back-calculates).
        total_is_gst_inclusive: !!form.amount_is_inclusive,
        notes: finalNotes,
        doc_type: form.doc_type,
        // Bank auto-routing: Residential → pm_surya_ghar (ICICI). Commercial → "" (SBI).
        scheme: isResidential ? "pm_surya_ghar" : "",
        auto_send_whatsapp: form.auto_send_whatsapp,
        auto_send_email: form.auto_send_email,
      };
      if (form.invoice_date) body.invoice_date = form.invoice_date;
      await axios.post(`${API}/gst/invoices`, body);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to create document");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <FileText className="w-5 h-5" /> New {form.doc_type === "quotation" ? "Solar Quotation" : "Tax Invoice"}
          </h2>
          <button onClick={onClose} data-testid="invoice-create-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Doc type toggle */}
          <div className="flex gap-2">
            {["invoice", "quotation"].map((t) => (
              <button
                type="button" key={t}
                onClick={() => setForm({ ...form, doc_type: t })}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  form.doc_type === t ? "bg-[#0a355e] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                data-testid={`invoice-type-${t}`}
              >
                {t === "invoice" ? "Tax Invoice" : "Quotation"}
              </button>
            ))}
          </div>

          {/* Section 1 — Basic Details */}
          <fieldset className="border border-slate-200 rounded-lg px-4 pt-3 pb-4 space-y-3">
            <legend className="text-xs font-bold text-[#0a355e] px-1">1. Customer Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Customer Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="inv-name" />
              <Field label="Phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="inv-phone" />
              <Field label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="inv-email" />
              <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v.replace(/\D/g, "").slice(0, 6) })} testid="inv-pincode" />
              <div className="md:col-span-2">
                <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} testid="inv-address" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                <select value={form.state} onChange={(e) => onStateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" data-testid="inv-state">
                  {STATES.map(([n]) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">District</label>
                {DISTRICTS[form.state] ? (
                  <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" data-testid="inv-district">
                    {DISTRICTS[form.state].map((d) => <option key={d}>{d}</option>)}
                  </select>
                ) : (
                  <input type="text" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="Enter district"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" data-testid="inv-district" />
                )}
              </div>
            </div>
          </fieldset>

          {/* Section 2 — Project Type + Conditional */}
          <fieldset className="border border-slate-200 rounded-lg px-4 pt-3 pb-4 space-y-3">
            <legend className="text-xs font-bold text-[#0a355e] px-1">2. Project Type</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Segment</label>
                <select value={form.customer_segment}
                  onChange={(e) => setForm({ ...form, customer_segment: e.target.value, project_type: e.target.value === "residential" ? "solar_project_flat_5" : "solar_project" })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-segment">
                  <option value="residential">Residential (PM Surya Ghar)</option>
                  <option value="commercial">Commercial</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1" data-testid="inv-bank-hint">
                  Bank: <b>{isResidential ? "ICICI — PMSG" : "SBI"}</b> · Auto-assigned
                </p>
              </div>
              {isResidential ? (
                <Field label="PM Surya Ghar Application Number (optional)"
                  value={form.pm_surya_ghar_app_no}
                  onChange={(v) => setForm({ ...form, pm_surya_ghar_app_no: v })}
                  testid="inv-pmsg-appno" />
              ) : (
                <Field label="GSTIN (optional)" value={form.gstin}
                  onChange={(v) => setForm({ ...form, gstin: v.toUpperCase() })}
                  testid="inv-gstin" />
              )}
              {/* GST Scheme dropdown — shown for BOTH Residential + Commercial
                  (owner spec: Residential must expose the same GST Scheme picker). */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">GST Scheme</label>
                <select value={form.project_type}
                  onChange={(e) => setForm({ ...form, project_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-project-type">
                  {PROJECT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Section 3 — Solar Configuration */}
          <fieldset className="border border-slate-200 rounded-lg px-4 pt-3 pb-4 space-y-3">
            <legend className="text-xs font-bold text-[#0a355e] px-1">3. Solar Configuration</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Solar Panel Brand *</label>
                <select value={form.solar_brand}
                  onChange={(e) => { setForm({ ...form, solar_brand: e.target.value }); setNameEdited(false); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-brand">
                  {SOLAR_BRANDS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Capacity *</label>
                <select value={form.capacity_kw}
                  onChange={(e) => { setForm({ ...form, capacity_kw: e.target.value }); setNameEdited(false); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-capacity">
                  {SOLAR_CAPACITIES.map((n) => <option key={n} value={n}>{n} kW</option>)}
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {form.capacity_kw === "custom" && (
                <Field label="Custom Capacity (kW)" value={form.capacity_custom}
                  onChange={(v) => { setForm({ ...form, capacity_custom: v.replace(/[^\d.]/g, "") }); setNameEdited(false); }}
                  testid="inv-capacity-custom" type="number" />
              )}
            </div>
          </fieldset>

          {/* Section 4 — Pricing */}
          <fieldset className="border border-slate-200 rounded-lg px-4 pt-3 pb-4 space-y-3">
            <legend className="text-xs font-bold text-[#0a355e] px-1">4. Pricing</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Item Name (auto-generated, editable)</label>
                <input type="text" value={form.project_name}
                  onChange={(e) => { setForm({ ...form, project_name: e.target.value }); setNameEdited(true); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-project-name" />
              </div>
              <Field
                label={`Amount (${form.amount_is_inclusive ? "GST-inclusive" : "before GST"}) *`}
                value={form.total_amount}
                onChange={(v) => setForm({ ...form, total_amount: v.replace(/[^\d.]/g, "") })}
                testid="inv-amount" type="number" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount Entry Mode</label>
                <select value={form.amount_is_inclusive ? "inclusive" : "exclusive"}
                  onChange={(e) => setForm({ ...form, amount_is_inclusive: e.target.value === "inclusive" })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-amount-mode">
                  <option value="exclusive">Amount + GST = Total (before GST)</option>
                  <option value="inclusive">Amount is GST-inclusive (back-calculate)</option>
                </select>
              </div>

              {/* Live AMOUNT + GST = TOTAL preview — recomputes on every keystroke */}
              <div className="md:col-span-2 p-3 bg-sky-50 border border-sky-100 rounded-lg" data-testid="inv-gst-preview">
                {(() => {
                  const rate = GST_RATES[form.project_type] ?? 0.05;
                  const amt = parseFloat(form.total_amount || "0") || 0;
                  const subtotal = form.amount_is_inclusive ? amt / (1 + rate) : amt;
                  const gst = subtotal * rate;
                  const total = subtotal + gst;
                  const fmt = (n) => `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return (
                    <div className="grid grid-cols-3 gap-2 text-center text-[#0a355e]">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Amount</div>
                        <div className="font-bold text-sm" data-testid="inv-preview-amount">{fmt(subtotal)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">+ GST @ {(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%</div>
                        <div className="font-bold text-sm text-amber-700" data-testid="inv-preview-gst">{fmt(gst)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">= Total</div>
                        <div className="font-extrabold text-base text-emerald-700" data-testid="inv-preview-total">{fmt(total)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="md:col-span-2">
                <Field label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testid="inv-notes" />
              </div>
              {(form.doc_type === "quotation" || isResidential) && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {form.doc_type === "quotation" ? "Quotation Date (back-date allowed)" : "Invoice Date (back-date allowed for PM Surya Ghar)"}
                  </label>
                  <input type="date" value={form.invoice_date}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    data-testid="inv-backdate-input" />
                  <p className="text-[11px] text-slate-500 mt-1">Leave empty to use today.</p>
                </div>
              )}
            </div>
          </fieldset>

          {/* Section 5 — Delivery channels */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.auto_send_whatsapp}
                onChange={(e) => setForm({ ...form, auto_send_whatsapp: e.target.checked })}
                data-testid="inv-auto-wa" />
              Send on WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.auto_send_email}
                onChange={(e) => setForm({ ...form, auto_send_email: e.target.checked })}
                data-testid="inv-auto-email" />
              Send by Email (Resend)
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-testid="inv-create-error">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium">
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="px-5 py-2 bg-[#0a355e] hover:bg-[#092a4b] text-white rounded-md text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              data-testid="inv-create-submit"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create {form.doc_type === "quotation" ? "Quotation" : "Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, testid, type = "text" }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
      data-testid={testid}
    />
  </div>
);

// ==================== RECORD PAYMENT MODAL ====================
const RecordPaymentModal = ({ invoice, onClose, onSaved }) => {
  const due = Math.max(0, Number(invoice.due_amount ?? ((invoice.grand_total || 0) - (invoice.amount_paid || 0))));
  const defaultMode = invoice.payment_mode || (invoice.scheme === "pm_surya_ghar" ? "ICICI" : "Cashfree");
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    amount: due.toFixed(2),
    payment_mode: defaultMode,
    payment_date: today,
    reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    if (amt > due + 0.01) { setError(`Amount exceeds due (₹${due.toFixed(2)}).`); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/gst/invoices/${invoice.id}/payments`, {
        amount: amt,
        payment_mode: form.payment_mode,
        payment_date: form.payment_date,
        reference: form.reference,
        notes: form.notes,
      });
      onSaved(`Payment of ₹${amt.toFixed(2)} recorded. Status: ${res.data?.invoice?.payment_status?.toUpperCase()}`);
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <IndianRupee className="w-5 h-5" /> Record Payment
          </h2>
          <button onClick={onClose} data-testid="record-payment-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Invoice summary */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Invoice</span>
              <span className="font-mono font-semibold text-[#0a355e]">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Customer</span>
              <span className="font-medium">{invoice.customer?.name}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold">₹ {(invoice.grand_total || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Paid so far</span>
              <span className="text-emerald-700 font-semibold">₹ {(invoice.amount_paid || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-semibold">Balance Due</span>
              <span className="text-red-600 font-bold text-base">₹ {due.toLocaleString("en-IN")}</span>
            </div>
            {invoice.scheme === "pm_surya_ghar" && (
              <div className="mt-2 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                PM Surya Ghar — default payment mode <b>ICICI</b>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount Received *</label>
              <input
                type="number" step="0.01" min="0" max={due}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold"
                data-testid="record-payment-amount"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, amount: due.toFixed(2) })}
                className="text-xs text-sky-600 hover:underline mt-1"
                data-testid="record-payment-full"
              >
                Set full due (₹{due.toLocaleString("en-IN")})
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode *</label>
              <select
                value={form.payment_mode}
                onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="record-payment-mode"
              >
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
              <input
                type="date" value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="record-payment-date"
              />
            </div>

            <div className="col-span-2">
              <Field label="Reference (UTR / Cheque / Txn ID)" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} testid="record-payment-ref" />
            </div>

            <div className="col-span-2">
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testid="record-payment-notes" />
            </div>
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-testid="record-payment-error">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium">Cancel</button>
            <button
              type="submit" disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              data-testid="record-payment-submit"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== PAYMENT HISTORY MODAL ====================
const PaymentHistoryModal = ({ invoice, onClose, onDeleted }) => {
  const history = invoice.payment_history || [];
  const [removing, setRemoving] = useState("");

  const removeEntry = async (entry) => {
    const ok = await confirm({
      title: "Remove this payment?",
      message: `Amount: ₹${entry.amount}\n\nInvoice totals will recompute.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    setRemoving(entry.id);
    try {
      await axios.delete(`${API}/gst/invoices/${invoice.id}/payments/${entry.id}`);
      onDeleted("Payment entry removed");
      onClose();
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not remove entry");
    } finally {
      setRemoving("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <History className="w-5 h-5" /> Payment History — {invoice.invoice_number}
          </h2>
          <button onClick={onClose} data-testid="payment-history-close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {history.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No payments recorded yet.</div>
          ) : (
            <ul className="space-y-2">
              {history.map((p, idx) => (
                <li key={p.id || idx} className="flex items-start justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div>
                    <div className="font-semibold text-[#0a355e]">₹ {Number(p.amount || 0).toLocaleString("en-IN")} <span className="text-xs font-medium text-slate-500 ml-2">{p.payment_mode}</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.payment_date} · Ref: {p.reference || "—"}</div>
                    {p.notes && <div className="text-xs text-slate-600 mt-1 italic">{p.notes}</div>}
                    {p.recorded_by && <div className="text-[10px] text-slate-400 mt-0.5">by {p.recorded_by}</div>}
                  </div>
                  <button
                    onClick={() => removeEntry(p)} disabled={removing === p.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                    data-testid={`payment-history-remove-${idx}`}
                  >
                    {removing === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== DASHBOARD KPI CARD ====================
const KpiCard = ({ label, value, subtitle, icon, color, testid }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-4 relative overflow-hidden" data-testid={testid}>
    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${color}`} />
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
        <div className="mt-1.5 text-xl md:text-2xl font-bold text-[#0a355e] tabular-nums">{value}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
      </div>
      <div className={`bg-gradient-to-br ${color} text-white p-2 rounded-lg shadow-sm`}>{icon}</div>
    </div>
  </div>
);

// ==================== MONTHLY REVENUE BAR CHART ====================
const MonthlyBarChart = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => Number(d.revenue || 0)));
  return (
    <div className="flex items-end gap-2 h-32" data-testid="monthly-chart">
      {data.map((m, i) => {
        const h = Math.max(4, (Number(m.revenue || 0) / max) * 110);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-[10px] font-semibold text-[#0a355e] tabular-nums">
              ₹{(Number(m.revenue) / 1000).toFixed(0)}k
            </div>
            <div
              className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t hover:from-emerald-700 hover:to-emerald-500 transition"
              style={{ height: `${h}px` }}
              title={`${m.label}: ₹${Number(m.revenue).toLocaleString("en-IN")}`}
            />
            <div className="text-[10px] text-slate-500">{m.label.split(" ")[0]}</div>
          </div>
        );
      })}
    </div>
  );
};

// ==================== CONVERT QUOTATION TO INVOICE MODAL ====================
const ConvertQuotationModal = ({ quotation, onClose, onConverted }) => {
  const grand = Number(quotation.grand_total || 0);
  const scheme = (quotation.scheme || "").toLowerCase();
  const defaultMode = scheme === "pm_surya_ghar" ? "ICICI" : "SBI";
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    amount_received: "0",
    payment_mode: defaultMode,
    payment_date: today,
    reference: "",
    notes: "",
    discount_amount: "0",
    discount_percent: "0",
    discount_reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const discountAbs = parseFloat(form.discount_amount || "0") || 0;
  const discountPct = parseFloat(form.discount_percent || "0") || 0;
  const afterFlat = Math.max(0, grand - discountAbs);
  const finalGrand = Math.max(0, afterFlat * (1 - discountPct / 100));
  const discountTotal = grand - finalGrand;
  const received = parseFloat(form.amount_received || "0") || 0;
  const due = Math.max(0, finalGrand - received);
  const preview =
    received <= 0 ? "unpaid" : received + 0.01 >= finalGrand ? "paid" : "partial";
  const statusColor = { paid: "bg-green-100 text-green-800", partial: "bg-amber-100 text-amber-800", unpaid: "bg-red-100 text-red-800" }[preview];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (discountAbs > grand) { setError("Flat discount cannot exceed quotation total."); return; }
    if (discountPct < 0 || discountPct > 100) { setError("Discount % must be between 0 and 100."); return; }
    if (received < 0 || received > finalGrand + 0.01) {
      setError(`Amount received must be between 0 and ₹${finalGrand.toFixed(2)} (post-discount).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/gst/quotations/${quotation.id}/convert`, {
        amount_received: received,
        payment_mode: form.payment_mode,
        payment_date: form.payment_date,
        reference: form.reference || "",
        notes: form.notes || "",
        discount_amount: discountAbs,
        discount_percent: discountPct,
        discount_reason: form.discount_reason || "",
      });
      onConverted(res.data?.invoice?.invoice_number || "");
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Conversion failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" /> Convert Quotation to Invoice
          </h2>
          <button onClick={onClose} data-testid="convert-close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Quotation #</span>
              <span className="font-mono font-semibold text-[#0a355e]">{quotation.invoice_number}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Customer</span>
              <span className="font-medium">{quotation.customer?.name}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Quotation Total</span>
              <span className="font-semibold">₹ {grand.toLocaleString("en-IN")}</span>
            </div>
            {scheme === "pm_surya_ghar" && (
              <div className="mt-2 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                PM Surya Ghar — default mode <b>ICICI</b> (cannot switch to SBI)
              </div>
            )}
          </div>

          {/* Discount Section */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Discount (optional)</p>
              {discountTotal > 0 && (
                <span className="text-xs font-bold text-emerald-700" data-testid="convert-discount-badge">
                  - ₹ {discountTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Flat Discount (₹)</label>
                <input
                  type="number" step="0.01" min="0" max={grand}
                  value={form.discount_amount}
                  onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="convert-discount-amount"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Discount (%)</label>
                <input
                  type="number" step="0.01" min="0" max="100"
                  value={form.discount_percent}
                  onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="convert-discount-percent"
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <Field label="Discount Reason (optional)" value={form.discount_reason} onChange={(v) => setForm({ ...form, discount_reason: v })} testid="convert-discount-reason" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
              {[5, 10, 15].map(p => (
                <button key={p} type="button"
                  onClick={() => setForm({ ...form, discount_percent: String(p), discount_amount: "0" })}
                  className="px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold" data-testid={`convert-discount-preset-${p}`}>
                  {p}% off
                </button>
              ))}
              <button type="button"
                onClick={() => setForm({ ...form, discount_amount: "0", discount_percent: "0", discount_reason: "" })}
                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">
                Clear
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount Received *</label>
            <input
              type="number" step="0.01" min="0" max={finalGrand}
              value={form.amount_received}
              onChange={(e) => setForm({ ...form, amount_received: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold"
              data-testid="convert-amount"
            />
            <div className="flex items-center gap-3 mt-1 text-xs">
              <button type="button" onClick={() => setForm({ ...form, amount_received: "0" })} className="text-sky-600 hover:underline">₹0</button>
              <button type="button" onClick={() => setForm({ ...form, amount_received: (finalGrand / 2).toFixed(2) })} className="text-sky-600 hover:underline">Half</button>
              <button type="button" onClick={() => setForm({ ...form, amount_received: finalGrand.toFixed(2) })} className="text-sky-600 hover:underline">Full ₹{finalGrand.toLocaleString("en-IN")}</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode *</label>
              <select
                value={form.payment_mode}
                onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="convert-mode"
              >
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
              <input
                type="date" value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="convert-date"
              />
            </div>
            <div className="col-span-2">
              <Field label="Reference (UTR / Txn ID)" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} testid="convert-ref" />
            </div>
            <div className="col-span-2">
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testid="convert-notes" />
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm">
            {discountTotal > 0 && (
              <>
                <div className="flex justify-between"><span className="text-slate-500">Quotation Total</span><span className="font-medium">₹ {grand.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between mt-1"><span className="text-slate-500">Discount</span><span className="text-emerald-700 font-semibold" data-testid="convert-summary-discount">- ₹ {discountTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between mt-1 pt-1 border-t border-slate-200"><span className="text-slate-500 font-semibold">Invoice Total</span><span className="font-bold text-[#0a355e]" data-testid="convert-summary-final">₹ {finalGrand.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
              </>
            )}
            <div className="flex justify-between mt-1"><span className="text-slate-500">Amount Received</span><span className="text-emerald-700 font-semibold">₹ {received.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between mt-1"><span className="text-slate-500">Balance Due</span><span className={`font-semibold ${due > 0 ? "text-red-600" : "text-slate-400"}`}>₹ {due.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
              <span className="text-slate-500">Status will be</span>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColor}`} data-testid="convert-preview-status">{preview.toUpperCase()}</span>
            </div>
          </div>

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-testid="convert-error">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium">Cancel</button>
            <button
              type="submit" disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              data-testid="convert-submit"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <ArrowRightLeft className="w-4 h-4" /> Convert to Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoicesManagement;

// ==================== EDIT INVOICE / QUOTATION MODAL ====================
const EditInvoiceModal = ({ invoice, onClose, onSaved }) => {
  const isQuote = invoice.doc_type === "quotation";
  const [form, setForm] = useState({
    name: invoice.customer?.name || "",
    phone: invoice.customer?.phone || "",
    email: invoice.customer?.email || "",
    gstin: invoice.customer?.gstin || "",
    address: invoice.customer?.address || "",
    state: invoice.customer?.state || "Bihar",
    state_code: invoice.customer?.state_code || "10",
    pincode: invoice.customer?.pincode || "",
    project_type: invoice.project_type || "solar_project",
    project_name: (invoice.line_items?.[0]?.description || "").split(" — ")[0] || "Solar Rooftop System",
    total_amount: String(invoice.grand_total || ""),
    notes: invoice.notes || "",
    is_pm_surya_ghar: invoice.scheme === "pm_surya_ghar",
    invoice_date: invoice.created_at ? new Date(invoice.created_at).toISOString().slice(0, 10) : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onStateChange = (name) => {
    const row = STATES.find(([n]) => n === name);
    setForm(f => ({ ...f, state: name, state_code: row ? row[1] : f.state_code }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone) { setError("Name and phone are required."); return; }
    setSubmitting(true);
    try {
      const body = {
        customer: {
          name: form.name, phone: form.phone, email: form.email || "",
          gstin: form.gstin || "", address: form.address || "",
          state: form.state, state_code: form.state_code, pincode: form.pincode || "",
        },
        project_type: form.project_type,
        project_name: form.project_name || "Solar Service",
        notes: form.notes || "",
        scheme: form.is_pm_surya_ghar ? "pm_surya_ghar" : "",
      };
      // Only send total_amount when admin wants to re-split the solar project total.
      if (form.total_amount && Number(form.total_amount) > 0) {
        body.total_amount = parseFloat(form.total_amount);
        // The Edit modal label says "GST-inclusive" — honor that on the backend
        // so final grand_total equals the entered figure exactly.
        body.total_is_gst_inclusive = true;
      }
      if (form.invoice_date) body.invoice_date = form.invoice_date;
      await axios.put(`${API}/gst/invoices/${invoice.id}`, body);
      onSaved(isQuote ? "Quotation updated" : "Invoice updated");
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <Edit3 className="w-5 h-5" /> Edit {isQuote ? "Quotation" : "Invoice"} — {invoice.invoice_number}
          </h2>
          <button onClick={onClose} data-testid="invoice-edit-close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Customer Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="edit-inv-name" />
            <Field label="Phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="edit-inv-phone" />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="edit-inv-email" />
            <Field label="GSTIN" value={form.gstin} onChange={(v) => setForm({ ...form, gstin: v.toUpperCase() })} testid="edit-inv-gstin" />
            <div className="md:col-span-2">
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} testid="edit-inv-address" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <select value={form.state} onChange={(e) => onStateChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" data-testid="edit-inv-state">
                {STATES.map(([n]) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} testid="edit-inv-pincode" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Project Type</label>
              <select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" data-testid="edit-inv-project-type">
                {PROJECT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <Field label="Project / Item Name" value={form.project_name} onChange={(v) => setForm({ ...form, project_name: v })} testid="edit-inv-project-name" />
            <Field label="Total (GST-inclusive, leave blank to keep)" value={form.total_amount} onChange={(v) => setForm({ ...form, total_amount: v.replace(/[^\d.]/g, "") })} testid="edit-inv-total" type="number" />
            <div className="md:col-span-2">
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testid="edit-inv-notes" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {isQuote ? "Quotation Date" : "Invoice Date"} (back-date allowed)
              </label>
              <input
                type="date" value={form.invoice_date} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="edit-inv-date"
              />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_pm_surya_ghar} onChange={(e) => setForm({ ...form, is_pm_surya_ghar: e.target.checked })} data-testid="edit-inv-pmsg" />
              PM Surya Ghar scheme (default rail ICICI)
            </label>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-testid="edit-inv-error">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#0a355e] hover:bg-[#092a4b] text-white rounded-md text-sm font-semibold flex items-center gap-2 disabled:opacity-50" data-testid="edit-inv-submit">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== CHANGE INVOICE DATE MODAL (PMSG paid) ====================
const ChangeInvoiceDateModal = ({ invoice, onClose, onSaved }) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [newDate, setNewDate] = useState(invoice.created_at ? new Date(invoice.created_at).toISOString().slice(0, 10) : todayIso);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!newDate) { setError("Please pick a date."); return; }
    setSubmitting(true);
    try {
      await axios.patch(`${API}/gst/invoices/${invoice.id}/invoice-date`, { invoice_date: newDate });
      onSaved("Invoice date updated");
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to update date");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-base font-bold text-[#0a355e] flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Change Invoice Date
          </h2>
          <button onClick={onClose} data-testid="change-date-close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            Available for <span className="font-semibold">paid PM Surya Ghar invoices</span> whose payment was recorded before today. Useful for correcting historical dates on legacy installations.
          </div>
          <div className="text-sm text-slate-700">
            <div className="flex justify-between py-1"><span className="text-slate-500">Invoice #</span><span className="font-mono font-semibold">{invoice.invoice_number}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Current Date</span><span className="font-semibold">{invoice.invoice_date}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Payment Date</span><span className="font-semibold text-emerald-700">{invoice.payment_date || "—"}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New Invoice Date</label>
            <input type="date" value={newDate} max={todayIso} onChange={(e) => setNewDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" data-testid="change-date-input" />
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-testid="change-date-error">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#0a355e] hover:bg-[#092a4b] text-white rounded-md text-sm font-semibold flex items-center gap-2 disabled:opacity-50" data-testid="change-date-submit">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Save Date
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
