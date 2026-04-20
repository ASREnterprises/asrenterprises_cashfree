import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Plus, Search, Edit3, Trash2, X, Loader2, CheckCircle, Users, Sun,
  Phone, MapPin, IndianRupee, Zap, Shield, Save, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Settings, FileText, Bell, ArrowLeft
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = {
  application_status: ["pending", "submitted", "approved", "completed", "rejected"],
  subsidy_status: ["pending", "applied", "approved", "credited", "rejected"],
  payment_status: ["pending", "partial", "completed"],
  net_metering_status: ["not_applied", "applied", "approved", "active"],
};

const EMPTY_FORM = {
  mobile: "", name: "", address: "", district: "",
  installation_date: "", application_id: "",
  application_status: "pending", subsidy_amount: 0, subsidy_status: "pending",
  subsidy_credited_date: "", system_capacity_kw: 0, solar_brand: "",
  inverter_brand: "", panels_count: 0, panel_warranty_years: 25,
  inverter_warranty_years: 5, installation_warranty_years: 1,
  total_cost: 0, amount_paid: 0, payment_status: "pending",
  net_metering_status: "not_applied", notes: ""
};

const BIHAR_DISTRICTS = [
  "Patna","Gaya","Bhagalpur","Muzaffarpur","Purnia","Darbhanga","Begusarai","Ara",
  "Katihar","Munger","Chapra","Sitamarhi","Hajipur","Nalanda","Siwan","Samastipur",
  "Vaishali","Bettiah","Motihari","Saharsa","Buxar","Jehanabad","Kishanganj",
  "Araria","Supaul","Madhubani","Gopalganj","Aurangabad","Nawada","Jamui",
  "Banka","Lakhisarai","Sheikhpura","Khagaria","Sheohar","Madhepura","Supaul",
  "Kaimur","Rohtas","Saran","East Champaran","West Champaran","Other"
];

const FormField = ({ label, children, required }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#073B4C] focus:outline-none focus:ring-2 focus:ring-[#0369A1] focus:border-transparent placeholder:text-slate-300";

export const CustomerManagement = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("customers");
  const [portalSettings, setPortalSettings] = useState({
    welcome_message: "", contact_number: "", support_email: "",
    service_hours: "", banner_text: "", important_notices: []
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [noticeInput, setNoticeInput] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchCustomers(); fetchPortalSettings(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/customers`);
      setCustomers(res.data);
    } catch (e) {
      setError("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchPortalSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/customer-portal-settings`);
      setPortalSettings(res.data);
    } catch (e) {}
  };

  const openAdd = () => { setEditingCustomer(null); setForm(EMPTY_FORM); setError(""); setShowModal(true); };
  const openEdit = (c) => { setEditingCustomer(c); setForm({ ...EMPTY_FORM, ...c }); setError(""); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingCustomer(null); setError(""); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Customer name is required"); return; }
    if (!editingCustomer && (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10)) {
      setError("Valid 10-digit mobile number is required"); return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingCustomer) {
        await axios.put(`${API}/admin/customers/${editingCustomer.id}`, form);
        setSuccess("Customer updated successfully!");
      } else {
        await axios.post(`${API}/admin/customers`, form);
        setSuccess("Customer registered successfully!");
      }
      closeModal();
      fetchCustomers();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/admin/customers/${id}`);
      setDeleteId(null);
      setCustomers(customers.filter(c => c.id !== id));
      setSuccess("Customer deleted.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Failed to delete customer");
    }
  };

  const savePortalSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API}/admin/customer-portal-settings`, portalSettings);
      setSuccess("Portal settings saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search) ||
    c.application_id?.toLowerCase().includes(search.toLowerCase()) ||
    c.district?.toLowerCase().includes(search.toLowerCase())
  );

  const STATUS_COLORS = {
    pending: "bg-amber-100 text-amber-700",
    submitted: "bg-blue-100 text-blue-700",
    approved: "bg-emerald-100 text-emerald-700",
    completed: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-700",
    applied: "bg-blue-100 text-blue-700",
    credited: "bg-green-100 text-green-800",
    partial: "bg-orange-100 text-orange-700",
    not_applied: "bg-slate-100 text-slate-500",
    active: "bg-teal-100 text-teal-700",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-[#0369A1] text-sm font-medium transition bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#073B4C] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0369A1]" /> Customer Management
            </h2>
            <p className="text-slate-400 text-xs mt-1">{customers.length} customers registered</p>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg transition">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
      {error && !showModal && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      {/* Sub-tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit">
        {[{ id: "customers", label: "Customers", icon: Users }, { id: "settings", label: "Portal Settings", icon: Settings }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === t.id ? "bg-[#0369A1] text-white shadow" : "text-slate-500 hover:text-[#073B4C]"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* CUSTOMERS LIST */}
      {activeTab === "customers" && (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, mobile, app ID, district..." className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#0369A1]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">{search ? "No customers found" : "No customers registered yet. Add your first customer!"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-start justify-between p-4 gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#0369A1] to-[#0284C7] rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{c.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#073B4C] text-sm">{c.name}</h4>
                        <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> +91 {c.mobile}</p>
                        {c.district && <p className="text-slate-400 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.district}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(c)} className="p-2 hover:bg-sky-50 rounded-lg transition text-[#0369A1]"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(c.id)} className="p-2 hover:bg-red-50 rounded-lg transition text-red-500"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="p-2 hover:bg-slate-50 rounded-lg transition text-slate-400">
                        {expandedId === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.application_status] || "bg-slate-100 text-slate-500"}`}>{c.application_status}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.subsidy_status] || "bg-slate-100 text-slate-500"}`}>Subsidy: {c.subsidy_status}</span>
                    {c.system_capacity_kw > 0 && <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700">{c.system_capacity_kw} kW</span>}
                    {c.application_id && <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-600"># {c.application_id}</span>}
                  </div>

                  {expandedId === c.id && (
                    <div className="border-t border-slate-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/50">
                      {[
                        { label: "Solar Brand", value: c.solar_brand },
                        { label: "Inverter", value: c.inverter_brand },
                        { label: "Capacity", value: c.system_capacity_kw ? `${c.system_capacity_kw} kW` : "—" },
                        { label: "Panels", value: c.panels_count || "—" },
                        { label: "Subsidy", value: c.subsidy_amount ? `₹${c.subsidy_amount.toLocaleString()}` : "—" },
                        { label: "Total Cost", value: c.total_cost ? `₹${c.total_cost.toLocaleString()}` : "—" },
                        { label: "Amount Paid", value: c.amount_paid ? `₹${c.amount_paid.toLocaleString()}` : "—" },
                        { label: "Net Metering", value: c.net_metering_status?.replace("_", " ") || "—" },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-slate-400">{item.label}</p>
                          <p className="font-semibold text-[#073B4C]">{item.value || "—"}</p>
                        </div>
                      ))}
                      {c.notes && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-slate-400">Notes</p>
                          <p className="font-medium text-[#073B4C]">{c.notes}</p>
                        </div>
                      )}
                      {c.service_requests?.length > 0 && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-slate-400">Service Requests: <span className="font-semibold text-amber-600">{c.service_requests.length}</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PORTAL SETTINGS */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-[#073B4C] flex items-center gap-2 text-base">
            <Settings className="w-5 h-5 text-[#0369A1]" /> Customer Portal Content
          </h3>

          <FormField label="Welcome Message">
            <textarea value={portalSettings.welcome_message} onChange={e => setPortalSettings({ ...portalSettings, welcome_message: e.target.value })} rows={3} className={inputCls} placeholder="Message shown at the top of customer portal..." />
          </FormField>

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Support Phone Number">
              <input type="tel" value={portalSettings.contact_number} onChange={e => setPortalSettings({ ...portalSettings, contact_number: e.target.value })} className={inputCls} placeholder="8877896889" />
            </FormField>
            <FormField label="Support Email">
              <input type="email" value={portalSettings.support_email} onChange={e => setPortalSettings({ ...portalSettings, support_email: e.target.value })} className={inputCls} placeholder="support@asrenterprises.in" />
            </FormField>
            <FormField label="Service Hours">
              <input type="text" value={portalSettings.service_hours} onChange={e => setPortalSettings({ ...portalSettings, service_hours: e.target.value })} className={inputCls} placeholder="Mon-Sat: 9 AM - 6 PM" />
            </FormField>
            <FormField label="Top Banner Text">
              <input type="text" value={portalSettings.banner_text} onChange={e => setPortalSettings({ ...portalSettings, banner_text: e.target.value })} className={inputCls} placeholder="Important announcement shown as a banner..." />
            </FormField>
          </div>

          <FormField label="Important Notices">
            <div className="flex gap-2 mb-2">
              <input value={noticeInput} onChange={e => setNoticeInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && noticeInput.trim()) { setPortalSettings({ ...portalSettings, important_notices: [...(portalSettings.important_notices || []), noticeInput.trim()] }); setNoticeInput(""); }}} className={`${inputCls} flex-1`} placeholder="Type notice and press Enter..." />
              <button onClick={() => { if (noticeInput.trim()) { setPortalSettings({ ...portalSettings, important_notices: [...(portalSettings.important_notices || []), noticeInput.trim()] }); setNoticeInput(""); }}} className="bg-[#0369A1] text-white px-4 rounded-xl font-semibold text-sm">Add</button>
            </div>
            <div className="space-y-2">
              {(portalSettings.important_notices || []).map((n, i) => (
                <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                  <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-sm text-amber-800 flex-1">{n}</span>
                  <button onClick={() => setPortalSettings({ ...portalSettings, important_notices: portalSettings.important_notices.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </FormField>

          <button onClick={savePortalSettings} disabled={savingSettings} className="flex items-center gap-2 bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingSettings ? "Saving..." : "Save Portal Settings"}
          </button>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h4 className="font-bold text-[#073B4C] mb-2">Delete Customer?</h4>
            <p className="text-slate-400 text-sm mb-5">This will permanently remove all their data and they'll lose portal access.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-[#073B4C]">{editingCustomer ? "Edit Customer" : "Register New Customer"}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <FormField label="Full Name" required>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Customer name" />
              </FormField>
              <FormField label="Mobile Number" required>
                <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} className={inputCls} placeholder="10-digit mobile" disabled={!!editingCustomer} />
              </FormField>
              <FormField label="Address">
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Full address" />
              </FormField>
              <FormField label="District">
                <select value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className={inputCls}>
                  <option value="">Select district</option>
                  {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </FormField>
              <FormField label="Installation Date">
                <input type="date" value={form.installation_date} onChange={e => setForm({ ...form, installation_date: e.target.value })} className={inputCls} />
              </FormField>
              <FormField label="PM Surya Ghar Application ID">
                <input value={form.application_id} onChange={e => setForm({ ...form, application_id: e.target.value })} className={inputCls} placeholder="Application ID from portal" />
              </FormField>
              <FormField label="Application Status">
                <select value={form.application_status} onChange={e => setForm({ ...form, application_status: e.target.value })} className={inputCls}>
                  {STATUS_OPTIONS.application_status.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </FormField>
              <FormField label="Subsidy Status">
                <select value={form.subsidy_status} onChange={e => setForm({ ...form, subsidy_status: e.target.value })} className={inputCls}>
                  {STATUS_OPTIONS.subsidy_status.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </FormField>
              <FormField label="Subsidy Amount (₹)">
                <input type="number" value={form.subsidy_amount} onChange={e => setForm({ ...form, subsidy_amount: parseFloat(e.target.value) || 0 })} className={inputCls} min={0} />
              </FormField>
              <FormField label="Subsidy Credited Date">
                <input type="date" value={form.subsidy_credited_date} onChange={e => setForm({ ...form, subsidy_credited_date: e.target.value })} className={inputCls} />
              </FormField>

              <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1"><Sun className="w-3.5 h-3.5" /> Solar System Details</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField label="System Capacity (kW)">
                    <input type="number" value={form.system_capacity_kw} onChange={e => setForm({ ...form, system_capacity_kw: parseFloat(e.target.value) || 0 })} className={inputCls} step="0.5" min={0} />
                  </FormField>
                  <FormField label="Solar Panel Brand">
                    <input value={form.solar_brand} onChange={e => setForm({ ...form, solar_brand: e.target.value })} className={inputCls} placeholder="e.g. Tata Solar, Luminous" />
                  </FormField>
                  <FormField label="Inverter Brand">
                    <input value={form.inverter_brand} onChange={e => setForm({ ...form, inverter_brand: e.target.value })} className={inputCls} placeholder="e.g. Growatt, Solis" />
                  </FormField>
                  <FormField label="Number of Panels">
                    <input type="number" value={form.panels_count} onChange={e => setForm({ ...form, panels_count: parseInt(e.target.value) || 0 })} className={inputCls} min={0} />
                  </FormField>
                  <FormField label="Panel Warranty (Years)">
                    <input type="number" value={form.panel_warranty_years} onChange={e => setForm({ ...form, panel_warranty_years: parseInt(e.target.value) || 0 })} className={inputCls} min={0} />
                  </FormField>
                  <FormField label="Inverter Warranty (Years)">
                    <input type="number" value={form.inverter_warranty_years} onChange={e => setForm({ ...form, inverter_warranty_years: parseInt(e.target.value) || 0 })} className={inputCls} min={0} />
                  </FormField>
                  <FormField label="Net Metering Status">
                    <select value={form.net_metering_status} onChange={e => setForm({ ...form, net_metering_status: e.target.value })} className={inputCls}>
                      {STATUS_OPTIONS.net_metering_status.map(s => <option key={s} value={s}>{s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}</option>)}
                    </select>
                  </FormField>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" /> Financial Details</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <FormField label="Total System Cost (₹)">
                    <input type="number" value={form.total_cost} onChange={e => setForm({ ...form, total_cost: parseFloat(e.target.value) || 0 })} className={inputCls} min={0} />
                  </FormField>
                  <FormField label="Amount Paid (₹)">
                    <input type="number" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: parseFloat(e.target.value) || 0 })} className={inputCls} min={0} />
                  </FormField>
                  <FormField label="Payment Status">
                    <select value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })} className={inputCls}>
                      {STATUS_OPTIONS.payment_status.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </FormField>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                <FormField label="Admin Notes (visible to customer)">
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={inputCls} placeholder="Any message or note for this customer..." />
                </FormField>
              </div>

              {error && <div className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : editingCustomer ? "Update Customer" : "Register Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
