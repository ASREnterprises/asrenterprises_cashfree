import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FileText, Download, Send, Mail, Plus, RefreshCw, Search,
  ArrowLeft, Loader2, X, CheckCircle2, AlertCircle, Trash2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PROJECT_TYPES = [
  { value: "solar_project", label: "Solar Project (Full EPC — 70/30 split @ 5%+18%)" },
  { value: "solar_goods", label: "Solar Goods only (5% GST)" },
  { value: "service", label: "Service / AMC (18% GST)" },
];

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
  const [filters, setFilters] = useState({ search: "", status: "", doc_type: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState({});  // id -> action name

  const showToast = (message, kind = "ok") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      const [listRes, statsRes] = await Promise.all([
        axios.get(`${API}/gst/invoices?${params.toString()}`),
        axios.get(`${API}/gst/stats`),
      ]);
      setInvoices(listRes.data.invoices || []);
      setTotal(listRes.data.total || 0);
      setStats(statsRes.data);
    } catch (e) {
      console.error("Invoice fetch failed:", e);
      showToast("Failed to load invoices", "err");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    if (!window.confirm(`Delete ${label} ${inv.invoice_number}? This cannot be undone.`)) return;
    try {
      setBusy((b) => ({ ...b, [inv.id]: "delete" }));
      await axios.delete(`${API}/gst/invoices/${inv.id}`);
      setInvoices((list) => list.filter((i) => i.id !== inv.id));
      setTotal((t) => Math.max(0, t - 1));
      showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} ${inv.invoice_number} deleted`);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Delete failed", "err");
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
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#0a355e] hover:bg-[#092a4b] text-white rounded-lg font-medium"
              data-testid="invoices-create-btn"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Invoice</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Invoices" value={stats?.total_invoices ?? "—"} color="bg-slate-900" />
          <StatCard label="This Month" value={stats?.this_month_count ?? "—"} color="bg-indigo-700" />
          <StatCard label="This Month Value" value={formatINR(stats?.this_month_value || 0)} color="bg-emerald-700" small />
          <StatCard label="Paid This Month" value={`${stats?.this_month_paid_count || 0} • ${formatINR(stats?.this_month_paid_value || 0)}`} color="bg-amber-700" small />
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
            <option value="unpaid">Unpaid</option>
          </select>
          <select
            value={filters.doc_type}
            onChange={(e) => setFilters({ ...filters, doc_type: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            data-testid="invoices-doctype-filter"
          >
            <option value="">Invoices & Quotations</option>
            <option value="invoice">Invoices only</option>
            <option value="quotation">Quotations only</option>
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
                  <th className="px-3 py-2 text-left">State</th>
                  <th className="px-3 py-2 text-right">Taxable</th>
                  <th className="px-3 py-2 text-right">GST</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400 inline" /></td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 text-slate-300 inline-block mb-2" /><br/>
                    No invoices yet. Click "New Invoice" to create one.
                  </td></tr>
                ) : invoices.map((inv) => {
                  const gst = (inv.cgst_total || 0) + (inv.sgst_total || 0) + (inv.igst_total || 0);
                  const action = busy[inv.id];
                  return (
                    <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`invoice-row-${inv.invoice_number}`}>
                      <td className="px-3 py-2 font-mono font-semibold text-[#0a355e]">{inv.invoice_number}</td>
                      <td className="px-3 py-2 text-slate-600">{inv.invoice_date || formatDate(inv.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{inv.customer?.name}</div>
                        <div className="text-xs text-slate-500">{inv.customer?.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{inv.customer?.state || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINR(inv.subtotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINR(gst)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatINR(inv.grand_total)}</td>
                      <td className="px-3 py-2 text-center">
                        {inv.doc_type === "quotation" ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">QUOTE</span>
                        ) : inv.payment_status === "paid" ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">PAID</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">UNPAID</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
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
        </div>
      </div>

      {showCreate && <CreateInvoiceModal
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchAll(); showToast("Invoice created"); }}
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
  <div className="bg-white rounded-lg border border-slate-200 p-3">
    <div className={`w-1 h-6 rounded-full ${color} inline-block mr-2 align-middle`} />
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <div className={`mt-1 font-bold text-[#0a355e] ${small ? "text-sm" : "text-2xl"}`}>{value}</div>
  </div>
);

const IconBtn = ({ children, onClick, busy, title, testid, color = "slate" }) => {
  const colorMap = {
    slate: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    green: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
    blue: "bg-sky-100 hover:bg-sky-200 text-sky-700",
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
const CreateInvoiceModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gstin: "", address: "",
    state: "Bihar", state_code: "10", pincode: "",
    project_type: "solar_project", project_name: "Solar Rooftop System",
    total_amount: "", notes: "", doc_type: "invoice",
    auto_send_whatsapp: true, auto_send_email: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onStateChange = (name) => {
    const row = STATES.find(([n]) => n === name);
    setForm((f) => ({ ...f, state: name, state_code: row ? row[1] : f.state_code }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.phone || !form.total_amount) {
      setError("Name, phone and total amount are required."); return;
    }
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
        total_amount: parseFloat(form.total_amount),
        notes: form.notes || "",
        doc_type: form.doc_type,
        auto_send_whatsapp: form.auto_send_whatsapp,
        auto_send_email: form.auto_send_email,
      };
      await axios.post(`${API}/gst/invoices`, body);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#0a355e] flex items-center gap-2">
            <FileText className="w-5 h-5" /> New {form.doc_type === "quotation" ? "Quotation" : "Invoice"}
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

          {/* Customer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Customer Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="inv-name" />
            <Field label="Phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="inv-phone" />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="inv-email" />
            <Field label="GSTIN (if B2B)" value={form.gstin} onChange={(v) => setForm({ ...form, gstin: v.toUpperCase() })} testid="inv-gstin" />
            <div className="md:col-span-2">
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} testid="inv-address" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <select
                value={form.state}
                onChange={(e) => onStateChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="inv-state"
              >
                {STATES.map(([n]) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} testid="inv-pincode" />
          </div>

          {/* Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Project Type</label>
              <select
                value={form.project_type}
                onChange={(e) => setForm({ ...form, project_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                data-testid="inv-project-type"
              >
                {PROJECT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <Field label="Project / Item Name" value={form.project_name} onChange={(v) => setForm({ ...form, project_name: v })} testid="inv-project-name" />
            <Field label="Total Amount (pre-GST) *" value={form.total_amount} onChange={(v) => setForm({ ...form, total_amount: v.replace(/[^\d.]/g, "") })} testid="inv-amount" type="number" />
            <div className="md:col-span-2">
              <Field label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testid="inv-notes" />
            </div>
          </div>

          {/* Notifications */}
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
              Send by Email (if configured)
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

export default InvoicesManagement;
