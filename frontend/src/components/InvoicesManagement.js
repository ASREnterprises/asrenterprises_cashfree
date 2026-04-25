import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FileText, Download, Send, Mail, Plus, RefreshCw, Search, IndianRupee,
  ArrowLeft, Loader2, X, CheckCircle2, AlertCircle, Trash2, History,
  ArrowRightLeft, Bell, TrendingUp, Wallet, Receipt, Edit3, Calendar,
  UserCog, MessageCircle, Save
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

// Detailed Technical Breakdown — NEW (panels + inverter + system type)
// Panel wattage range is segment-aware: residential PMSG caps at 600W, commercial unlocks 730W.
const PANEL_WATT_RESIDENTIAL = [540, 545, 550, 555, 560, 565, 570, 580, 590, 600];
const PANEL_WATT_COMMERCIAL  = [540, 550, 560, 580, 600, 620, 650, 680, 700, 720, 730];
const INVERTER_CAPACITIES_KW = [1, 2, 3, 3.3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 50, 75, 100];
// Brand list with sub-OEM suggestions for TATA per owner spec.
const INVERTER_BRANDS = [
  { name: "TATA", note: "Solis / Solax / Goodwe" },
  { name: "Loom", note: "" },
  { name: "Luminous", note: "" },
  { name: "Microtek", note: "" },
  { name: "Havells", note: "" },
  { name: "Polycab", note: "" },
  { name: "Waaree", note: "" },
  { name: "Deye", note: "" },
  { name: "Eastman", note: "" },
  { name: "UTL", note: "" },
];
const SYSTEM_TYPES = [
  { value: "Ongrid", label: "Ongrid System" },
  { value: "Hybrid", label: "Hybrid System" },
  { value: "Offgrid", label: "Off Grid System" },
];

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
  const [showCASettings, setShowCASettings] = useState(false);
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

  // Forward an invoice to the configured CA — Email + WhatsApp (Meta doc upload).
  const sendToCA = async (inv) => {
    const ok = await confirm({
      title: "Send invoice to CA?",
      message: `${inv.invoice_number} (${inv.customer?.name || "Customer"})\n\nThe configured CA receives the PDF on Email + WhatsApp for filing reference.`,
      confirmText: "Send to CA",
      cancelText: "Cancel",
      tone: "info",
    });
    if (!ok) return;
    try {
      setBusy((b) => ({ ...b, [inv.id]: "ca" }));
      const r = await axios.post(`${API}/gst/invoices/${inv.id}/send-to-ca`);
      const channels = [];
      if (r.data?.email?.success) channels.push("Email");
      if (r.data?.whatsapp?.success) channels.push("WhatsApp");
      if (channels.length) {
        showToast(`Sent to CA via ${channels.join(" + ")}`);
        fetchAll();
      } else {
        showToast("CA send failed — please verify CA contact in Settings", "err");
      }
    } catch (e) {
      showToast(e?.response?.data?.detail || "Could not send to CA", "err");
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
              onClick={async () => {
                const ok = await confirm({
                  title: "Regenerate ALL invoice PDFs?",
                  message: "Re-renders every invoice + quotation PDF using the current branded header, bank, and UPI details.\n\nSafe to run anytime — recommended after global config changes.",
                  confirmText: "Regenerate All",
                  cancelText: "Cancel",
                  tone: "info",
                });
                if (!ok) return;
                try {
                  const r = await axios.post(`${API}/gst/invoices/regenerate-all-pdfs`);
                  showToast(`${r.data.regenerated} PDFs regenerated · ${r.data.failed} failed`);
                  fetchAll();
                } catch (e) {
                  showToast(e?.response?.data?.detail || "Regenerate failed", "err");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-medium text-sm"
              data-testid="invoices-regen-all-btn" title="Regenerate ALL invoice PDFs with current branded header"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Regenerate All</span>
            </button>
            <button
              onClick={() => setShowCASettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-medium text-sm"
              data-testid="invoices-ca-settings-btn" title="CA Contact & Auto-Send Settings"
            >
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">CA Settings</span>
            </button>
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
                          {!isQuote && (
                            <IconBtn onClick={() => sendToCA(inv)} busy={action === "ca"} title="Send to CA (Email + WhatsApp)" testid={`invoice-send-ca-${inv.invoice_number}`} color="amber">
                              <UserCog className="w-4 h-4" />
                            </IconBtn>
                          )}
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

      {showCASettings && (
        <CASettingsModal
          onClose={() => setShowCASettings(false)}
          onSaved={(msg) => { showToast(msg || "CA contact saved"); }}
        />
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

// ==================== CA SETTINGS MODAL ====================
// Owner sets the CA's WhatsApp + email, toggles the monthly auto-batch, and
// can fire the previous-month batch on demand. Updates take effect immediately
// — every subsequent invoice email + the cron use the latest CA contact.
const CASettingsModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", auto_monthly: true });
  const [last, setLast] = useState({ at: "", count: 0, window: "", email_count: 0, wa_count: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/gst/ca-contact`);
      setForm({
        name: r.data?.name || "",
        email: r.data?.email || "",
        phone: r.data?.phone || "",
        auto_monthly: r.data?.auto_monthly !== false,
      });
      setLast({
        at: r.data?.last_run_at || "", count: r.data?.last_run_count || 0,
        window: r.data?.last_run_window || "",
        email_count: r.data?.last_run_email_count || 0,
        wa_count: r.data?.last_run_wa_count || 0,
      });
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not load CA contact");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e?.preventDefault?.();
    setError(""); setOkMsg(""); setSaving(true);
    try {
      const payload = {
        name: form.name?.trim() || "",
        email: form.email?.trim().toLowerCase() || "",
        phone: form.phone?.replace(/\D/g, "").slice(-10) || "",
        auto_monthly: !!form.auto_monthly,
      };
      if (!payload.email && !payload.phone) {
        setError("Add at least one of CA email or WhatsApp number"); setSaving(false); return;
      }
      const r = await axios.put(`${API}/gst/ca-contact`, payload);
      setForm({
        name: r.data?.name || "", email: r.data?.email || "",
        phone: r.data?.phone || "", auto_monthly: r.data?.auto_monthly !== false,
      });
      setOkMsg("CA contact saved · changes apply to every future invoice");
      onSaved && onSaved();
    } catch (e2) {
      setError(e2?.response?.data?.detail || "Failed to save CA contact");
    } finally { setSaving(false); }
  };

  const runBatch = async () => {
    setError(""); setOkMsg(""); setRunning(true);
    try {
      const r = await axios.post(`${API}/gst/ca-monthly-batch/run-now`);
      const c = r.data?.count || 0;
      setOkMsg(c
        ? `Sent ${c} invoice(s) for ${r.data?.window || "previous month"} · Email:${r.data?.email_sent || 0}, WhatsApp:${r.data?.whatsapp_sent || 0}`
        : `No invoices in ${r.data?.window || "previous month"}`);
      load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not run batch");
    } finally { setRunning(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()} data-testid="ca-settings-modal">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <UserCog className="w-5 h-5 text-amber-700" /> CA Contact & Auto-Send
          </h2>
          <button onClick={onClose} data-testid="ca-settings-close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 border border-amber-200 rounded p-2.5">
                Update your CA's WhatsApp + email here. Changes apply to every <b>future</b> invoice email + the auto-batch.
                Old invoices keep their original recipient list (audit trail).
              </p>

              <Field label="CA Name (optional)" value={form.name}
                onChange={(v) => setForm({ ...form, name: v })} testid="ca-name" />

              <Field label="CA Email" value={form.email}
                onChange={(v) => setForm({ ...form, email: v })} testid="ca-email" type="email" />

              <Field label="CA WhatsApp Number (10-digit, no +91)" value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })}
                testid="ca-phone" type="tel" />

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.auto_monthly} className="mt-0.5"
                  onChange={(e) => setForm({ ...form, auto_monthly: e.target.checked })}
                  data-testid="ca-auto-monthly" />
                <span>
                  <b>Auto-send last month's invoices on the 5th @ 09:30 IST</b>
                  <br/>
                  <span className="text-xs text-slate-500">All non-trashed invoices dated in the previous calendar month are sent to the CA via Email (consolidated batch) and WhatsApp (one-by-one).</span>
                </span>
              </label>

              {last.at && (
                <div className="text-xs text-slate-600 bg-slate-50 rounded p-2.5 border border-slate-200" data-testid="ca-last-run">
                  <div className="font-semibold text-slate-700 mb-0.5">Last run</div>
                  <div>{new Date(last.at).toLocaleString("en-IN")} · window: {last.window || "—"}</div>
                  <div>{last.count} invoices · Email {last.email_count} · WhatsApp {last.wa_count}</div>
                </div>
              )}

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2" data-testid="ca-settings-error">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              {okMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700 flex items-center gap-2" data-testid="ca-settings-ok">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {okMsg}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={runBatch} disabled={running}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded text-sm font-medium border border-sky-200 disabled:opacity-50"
                  data-testid="ca-run-now-btn">
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  Run last-month batch now
                </button>
                <div className="flex items-center gap-2 justify-end">
                  <button type="button" onClick={onClose}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium">
                    Close
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0a355e] hover:bg-[#092a4b] text-white rounded text-sm font-semibold disabled:opacity-50"
                    data-testid="ca-save-btn">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
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
    // Detailed Technical Breakdown (NEW)
    show_detailed_breakdown: false,
    panel_watt: 550,                 // selected dropdown value
    panel_count: 6,                  // numeric input
    inverter_brand: "TATA",
    inverter_capacity_kw: 3,
    system_type: "Ongrid",
    // Pricing
    project_type: "solar_project_flat_5", project_name: "",
    total_amount: "", amount_is_inclusive: false, notes: "", doc_type: initialDocType,
    // Billing Type — Standard (single line) or Detailed (item-wise breakdown)
    billing_type: "standard",
    // Detailed line items — editable table
    line_items: [],
    // PMSG residential extras
    subsidy_amount: "", show_savings: false, expected_savings_per_year: "",
    // Bank override (defaults: residential→icici, commercial→sbi)
    payment_mode_override: "",
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

  // Detailed-breakdown derived capacity: (Watt × Panels) ÷ 1000.
  // When detailed breakdown is on, this overrides the simple Capacity dropdown.
  const detailedCapacityKw = (
    (parseFloat(form.panel_watt) || 0) * (parseInt(form.panel_count, 10) || 0)
  ) / 1000;

  const isResidential = form.customer_segment === "residential";

  const effectiveCapacity = form.show_detailed_breakdown
    ? Number(detailedCapacityKw.toFixed(2))
    : (form.capacity_kw === "custom"
        ? (parseFloat(form.capacity_custom) || 0)
        : parseFloat(form.capacity_kw || "0"));

  // Smart suggest: when detailed breakdown is on, snap inverter to the closest standard kW.
  useEffect(() => {
    if (!form.show_detailed_breakdown || effectiveCapacity <= 0) return;
    const closest = INVERTER_CAPACITIES_KW.reduce((best, n) =>
      Math.abs(n - effectiveCapacity) < Math.abs(best - effectiveCapacity) ? n : best,
      INVERTER_CAPACITIES_KW[0]);
    setForm((f) => f.inverter_capacity_kw === closest ? f : { ...f, inverter_capacity_kw: closest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.show_detailed_breakdown, form.panel_watt, form.panel_count]);

  // When user toggles segment, reset inverter brand default + re-clamp panel watt range.
  useEffect(() => {
    setForm((f) => {
      const allowed = isResidential ? PANEL_WATT_RESIDENTIAL : PANEL_WATT_COMMERCIAL;
      const newWatt = allowed.includes(f.panel_watt) ? f.panel_watt : allowed[Math.min(2, allowed.length - 1)];
      const newBrand = isResidential ? "TATA" : f.inverter_brand;
      return { ...f, panel_watt: newWatt, inverter_brand: newBrand };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customer_segment]);

  // Dynamic Item Name:
  //   • Detailed breakdown ON  → "{InverterBrand} {SystemType} Solar System – {N}kW"
  //   • Default                → brand-aware "TATA Power Solar System Kit of {N}kW" / "{BRAND} Solar System Kit of {N}kW"
  useEffect(() => {
    if (nameEdited) return;
    if (effectiveCapacity > 0) {
      let name;
      if (form.show_detailed_breakdown) {
        const brandUpper = (form.inverter_brand || "TATA").toUpperCase();
        name = `${brandUpper} ${form.system_type} Solar System – ${effectiveCapacity}kW`;
      } else {
        const brandUpper = (form.solar_brand || "TATA").toUpperCase();
        const middle = brandUpper === "TATA" ? "Power Solar System Kit" : "Solar System Kit";
        name = `${brandUpper} ${middle} of ${effectiveCapacity}kW`;
      }
      setForm((f) => ({ ...f, project_name: name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.solar_brand, form.capacity_kw, form.capacity_custom,
      form.show_detailed_breakdown, form.panel_watt, form.panel_count,
      form.inverter_brand, form.system_type, nameEdited]);

  // Auto-build the 6 standard solar EPC line items from the technical breakdown.
  // Owner can edit / add / remove rows after auto-fill.
  const autofillDetailedItems = useCallback(() => {
    const cap = effectiveCapacity || 1;
    const totalRupees = parseFloat(form.total_amount || "0") || 0;
    const split = (pct) => Number((totalRupees * pct).toFixed(0));
    const items = [
      { item_name: `Solar Panels — ${form.panel_watt}W × ${form.panel_count} Panels`,
        hsn: "85414300", quantity: parseInt(form.panel_count, 10) || 1,
        rate: parseInt(form.panel_count, 10) > 0 ? split(0.60) / (parseInt(form.panel_count, 10) || 1) : split(0.60), kind: "goods" },
      { item_name: `Solar Inverter — ${form.inverter_brand} ${form.inverter_capacity_kw}kW`,
        hsn: "85044090", quantity: 1, rate: split(0.18), kind: "goods" },
      { item_name: "Module Mounting Structure", hsn: "73089090", quantity: 1, rate: split(0.06), kind: "goods" },
      { item_name: "DC/AC Wiring & Accessories", hsn: "85444290", quantity: 1, rate: split(0.06), kind: "goods" },
      { item_name: `Installation & Commissioning — ${cap}kW`,
        hsn: "9954", quantity: 1, rate: split(0.06), kind: "service" },
      { item_name: "Net Metering / Documentation", hsn: "9983", quantity: 1, rate: split(0.04), kind: "service" },
    ];
    setForm((f) => ({ ...f, line_items: items }));
  }, [effectiveCapacity, form.total_amount, form.panel_watt, form.panel_count,
      form.inverter_brand, form.inverter_capacity_kw]);

  // When billing_type flips to detailed and items empty, auto-fill once.
  useEffect(() => {
    if (form.billing_type === "detailed" && form.line_items.length === 0
        && form.show_detailed_breakdown && effectiveCapacity > 0
        && parseFloat(form.total_amount || "0") > 0) {
      autofillDetailedItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.billing_type]);

  const updateLineItem = (idx, patch) => {
    setForm((f) => ({
      ...f, line_items: f.line_items.map((it, i) => i === idx ? { ...it, ...patch } : it),
    }));
  };
  const removeLineItem = (idx) => {
    setForm((f) => ({ ...f, line_items: f.line_items.filter((_, i) => i !== idx) }));
  };
  const addLineItem = () => {
    setForm((f) => ({
      ...f, line_items: [...f.line_items, { item_name: "", hsn: "85414300", quantity: 1, rate: 0, kind: "goods" }],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone || !form.email) {
      setError("Customer Name, Phone and Email are required."); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Please enter a valid email address."); return;
    }
    if (form.billing_type === "detailed") {
      if (!(form.line_items || []).length) {
        setError("Please add at least one line item or enable Auto-fill from technical breakdown."); return;
      }
      const sum = form.line_items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0);
      if (sum <= 0) { setError("Detailed bill total must be greater than zero."); return; }
    } else if (!form.total_amount || parseFloat(form.total_amount) <= 0) {
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
      if (form.show_detailed_breakdown) {
        // Detailed Technical Breakdown — kept inside notes for now so the PDF
        // shows it; Phase 2 can promote these to dedicated invoice fields.
        trailerBits.push(
          `Panels: ${form.panel_watt}W × ${form.panel_count} = ${effectiveCapacity}kW`,
          `Inverter: ${form.inverter_brand} ${form.inverter_capacity_kw}kW`,
          `System Type: ${form.system_type}`,
        );
      } else {
        trailerBits.push(`Solar Brand: ${form.solar_brand} · Capacity: ${effectiveCapacity} kW`);
      }
      const finalNotes = [form.notes || "", trailerBits.join(" | ")].filter(Boolean).join("\n");

      // Detailed billing: convert front-end rows to backend InvoiceLineItem shape.
      const useDetailed = form.billing_type === "detailed" && (form.line_items || []).length > 0;
      const lineItemsPayload = useDetailed
        ? form.line_items.map((it) => {
            const qty = parseFloat(it.quantity) || 1;
            const rate = parseFloat(it.rate) || 0;
            const taxable = qty * rate;
            return {
              description: it.item_name || "Item",
              hsn_sac: (it.hsn || "").toString(),
              quantity: qty,
              unit_price: rate,
              taxable_value: Number(taxable.toFixed(2)),
              gst_rate: it.kind === "service" ? 18 : 5,
              kind: it.kind === "service" ? "service" : "goods",
            };
          })
        : null;

      const body = {
        customer: {
          name: form.name, phone: form.phone, email: form.email || "",
          gstin: isResidential ? "" : (form.gstin || ""),
          address: form.address || "",
          state: form.state, state_code: form.state_code, pincode: form.pincode || "",
        },
        // GST Scheme is now user-selectable for BOTH residential + commercial.
        project_type: useDetailed ? "solar_goods" : form.project_type,
        project_name: form.project_name || "Solar Service",
        // For Detailed Bill the backend recomputes total from line items.
        total_amount: useDetailed ? null : parseFloat(form.total_amount),
        line_items: lineItemsPayload,
        // AMOUNT + GST = TOTAL mode: entered amount is pre-GST (backend computes GST).
        // Inclusive mode: entered amount is final (backend back-calculates).
        total_is_gst_inclusive: !useDetailed && !!form.amount_is_inclusive,
        notes: finalNotes,
        doc_type: form.doc_type,
        // Bank auto-routing: Residential → pm_surya_ghar (ICICI). Commercial → "" (SBI).
        scheme: isResidential ? "pm_surya_ghar" : "",
        // Structured technical breakdown — backend stores as-is; mirrored on convert.
        technical_breakdown: form.show_detailed_breakdown ? {
          panel_watt: form.panel_watt,
          panel_count: parseInt(form.panel_count, 10) || 0,
          system_capacity_kw: effectiveCapacity,
          inverter_brand: form.inverter_brand,
          inverter_capacity_kw: form.inverter_capacity_kw,
          system_type: form.system_type,
          billing_type: form.billing_type,
        } : null,
        // Residential subsidy + savings (informational — surfaces on PDF + customer record)
        subsidy_amount: isResidential && form.subsidy_amount ? parseFloat(form.subsidy_amount) : 0,
        savings_per_year: form.show_savings && form.expected_savings_per_year ? parseFloat(form.expected_savings_per_year) : 0,
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

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.show_detailed_breakdown}
                onChange={(e) => { setForm({ ...form, show_detailed_breakdown: e.target.checked }); setNameEdited(false); }}
                data-testid="inv-detailed-toggle" />
              <span><b>Show Detailed Technical Breakdown</b> <span className="text-[11px] text-slate-500">(panels + inverter + system type)</span></span>
            </label>

            {!form.show_detailed_breakdown ? (
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
            ) : (
              <div className="space-y-3">
                {/* PANEL CONFIG */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Panel Watt Range * <span className="text-[10px] text-slate-400">({isResidential ? "540–600W (PMSG)" : "540–730W"})</span>
                    </label>
                    <select value={form.panel_watt}
                      onChange={(e) => { setForm({ ...form, panel_watt: parseInt(e.target.value, 10) }); setNameEdited(false); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      data-testid="inv-panel-watt">
                      {(isResidential ? PANEL_WATT_RESIDENTIAL : PANEL_WATT_COMMERCIAL).map((w) =>
                        <option key={w} value={w}>{w} W</option>
                      )}
                    </select>
                  </div>
                  <Field label="Number of Panels *" type="number" value={form.panel_count}
                    onChange={(v) => { setForm({ ...form, panel_count: v.replace(/\D/g, "") }); setNameEdited(false); }}
                    testid="inv-panel-count" />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">System Capacity (auto)</label>
                    <input type="text" readOnly value={`${detailedCapacityKw.toFixed(2)} kW`}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-50 font-semibold text-[#0a355e]"
                      data-testid="inv-detailed-capacity" />
                  </div>
                </div>
                {/* INVERTER */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Inverter Brand *</label>
                    <select value={form.inverter_brand}
                      onChange={(e) => { setForm({ ...form, inverter_brand: e.target.value }); setNameEdited(false); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      data-testid="inv-inverter-brand">
                      {INVERTER_BRANDS.map((b) => <option key={b.name} value={b.name}>{b.name}{b.note ? ` (${b.note})` : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Inverter Capacity *</label>
                    <select value={form.inverter_capacity_kw}
                      onChange={(e) => setForm({ ...form, inverter_capacity_kw: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      data-testid="inv-inverter-capacity">
                      {INVERTER_CAPACITIES_KW.map((n) => <option key={n} value={n}>{n} kW</option>)}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Snaps to closest kW based on panel total.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">System Type *</label>
                    <select value={form.system_type}
                      onChange={(e) => { setForm({ ...form, system_type: e.target.value }); setNameEdited(false); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      data-testid="inv-system-type">
                      {SYSTEM_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                {/* DETAILED BILL ITEMS — preview */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-700" data-testid="inv-bill-breakdown">
                  <div className="font-semibold text-[#0a355e] mb-1.5">Detailed Bill Items</div>
                  <ol className="list-decimal pl-5 space-y-0.5">
                    <li>Solar Panels — <b>{form.panel_watt}W × {form.panel_count || 0} Panels</b></li>
                    <li>Solar Inverter — <b>{form.inverter_brand} {form.inverter_capacity_kw}kW Inverter</b></li>
                    <li>Module Mounting Structure</li>
                    <li>DC/AC Wiring & Accessories</li>
                    <li>Installation & Commissioning</li>
                    <li>Net Metering / Documentation</li>
                  </ol>
                </div>
              </div>
            )}
          </fieldset>

          {/* Section 4 — Pricing */}
          <fieldset className="border border-slate-200 rounded-lg px-4 pt-3 pb-4 space-y-3">
            <legend className="text-xs font-bold text-[#0a355e] px-1">4. Pricing</legend>

            {/* Billing Type toggle — Standard or Detailed Bill (item-wise) */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-md w-fit" data-testid="billing-type-toggle">
              {[
                { value: "standard", label: "Standard (single line)" },
                { value: "detailed", label: "Detailed Bill (item-wise)" },
              ].map((b) => (
                <button key={b.value} type="button"
                  onClick={() => setForm({ ...form, billing_type: b.value })}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${
                    form.billing_type === b.value ? "bg-white text-[#0a355e] shadow" : "text-slate-600"
                  }`}
                  data-testid={`billing-type-${b.value}`}>
                  {b.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Item Name (auto-generated, editable)</label>
                <input type="text" value={form.project_name}
                  onChange={(e) => { setForm({ ...form, project_name: e.target.value }); setNameEdited(true); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  data-testid="inv-project-name" />
              </div>
              <Field
                label={`Amount (${form.amount_is_inclusive ? "GST-inclusive" : "before GST"}) ${form.billing_type === "detailed" ? "(used for auto-fill)" : "*"}`}
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
                  let amt;
                  if (form.billing_type === "detailed") {
                    amt = (form.line_items || []).reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0);
                  } else {
                    amt = parseFloat(form.total_amount || "0") || 0;
                  }
                  const subtotal = (form.billing_type === "standard" && form.amount_is_inclusive) ? amt / (1 + rate) : amt;
                  const gst = subtotal * rate;
                  const total = subtotal + gst;
                  const subsidy = isResidential && form.subsidy_amount ? (parseFloat(form.subsidy_amount) || 0) : 0;
                  const netPayable = Math.max(0, total - subsidy);
                  const fmt = (n) => `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return (
                    <div>
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
                      {subsidy > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[#0a355e] border-t border-sky-200 pt-2" data-testid="inv-subsidy-preview">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">PMSG Subsidy</div>
                            <div className="font-bold text-sm text-emerald-700">− {fmt(subsidy)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Net Payable</div>
                            <div className="font-extrabold text-base text-rose-700">{fmt(netPayable)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Detailed Line Items Table */}
              {form.billing_type === "detailed" && (
                <div className="md:col-span-2 space-y-2" data-testid="detailed-bill-section">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#0a355e]">Item-wise Breakdown</div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={autofillDetailedItems}
                        className="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-[11px] font-semibold rounded border border-sky-200"
                        data-testid="autofill-items-btn">
                        Auto-fill from Tech Breakdown
                      </button>
                      <button type="button" onClick={addLineItem}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-semibold rounded border border-emerald-200"
                        data-testid="add-line-item-btn">
                        + Add Row
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-semibold text-slate-700">Item Name</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-slate-700 w-24">HSN/SAC</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-slate-700 w-16">Qty</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-slate-700 w-28">Rate (₹)</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-slate-700 w-28">Amount</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.line_items || []).map((it, i) => {
                          const amount = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
                          return (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-1.5 py-1">
                                <input value={it.item_name} onChange={(e) => updateLineItem(i, { item_name: e.target.value })}
                                  className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs"
                                  data-testid={`li-name-${i}`} />
                              </td>
                              <td className="px-1.5 py-1">
                                <input value={it.hsn} onChange={(e) => updateLineItem(i, { hsn: e.target.value })}
                                  className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs"
                                  data-testid={`li-hsn-${i}`} />
                              </td>
                              <td className="px-1.5 py-1">
                                <input type="number" value={it.quantity} onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                                  className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs text-right"
                                  data-testid={`li-qty-${i}`} />
                              </td>
                              <td className="px-1.5 py-1">
                                <input type="number" value={it.rate} onChange={(e) => updateLineItem(i, { rate: e.target.value })}
                                  className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs text-right"
                                  data-testid={`li-rate-${i}`} />
                              </td>
                              <td className="px-1.5 py-1 text-right font-semibold text-[#0a355e]" data-testid={`li-amount-${i}`}>
                                ₹ {amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-1 py-1 text-center">
                                <button type="button" onClick={() => removeLineItem(i)}
                                  className="text-red-500 hover:text-red-700 text-base"
                                  data-testid={`li-remove-${i}`}>×</button>
                              </td>
                            </tr>
                          );
                        })}
                        {(form.line_items || []).length === 0 && (
                          <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-400">No items yet — click "Auto-fill from Tech Breakdown" or "+ Add Row".</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Residential subsidy + savings */}
              {isResidential && (
                <>
                  <Field label="PMSG Subsidy Amount (₹) — optional"
                    value={form.subsidy_amount} type="number"
                    onChange={(v) => setForm({ ...form, subsidy_amount: v.replace(/[^\d.]/g, "") })}
                    testid="inv-subsidy-amount" />
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={form.show_savings}
                        onChange={(e) => setForm({ ...form, show_savings: e.target.checked })}
                        data-testid="inv-show-savings" />
                      <span>Show Savings Estimate</span>
                    </label>
                  </div>
                  {form.show_savings && (
                    <Field label="Expected Annual Savings (₹/year)"
                      value={form.expected_savings_per_year} type="number"
                      onChange={(v) => setForm({ ...form, expected_savings_per_year: v.replace(/[^\d.]/g, "") })}
                      testid="inv-savings-amount" />
                  )}
                </>
              )}

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
