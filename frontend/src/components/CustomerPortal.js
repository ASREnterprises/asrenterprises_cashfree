import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Sun, Zap, CheckCircle, Clock, AlertCircle, FileText, Phone, Mail, MessageCircle,
  LogOut, Shield, Battery, Home, TrendingUp, Star, RefreshCw, Send, ChevronRight,
  Award, Calendar, Wrench, IndianRupee, ArrowUpRight, Info, X, ArrowLeft,
  Download, Share2, Gift, Copy, Bell, Loader2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  application_status: {
    pending:   { label: "Application Pending",   color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200", icon: Clock },
    submitted: { label: "Application Submitted",  color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",  icon: FileText },
    approved:  { label: "Application Approved",   color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-200",icon: CheckCircle },
    completed: { label: "Installation Completed", color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200",icon: CheckCircle },
    rejected:  { label: "Application Rejected",   color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",   icon: AlertCircle },
  },
  subsidy_status: {
    pending:  { label: "Subsidy Pending",  color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200", icon: Clock },
    applied:  { label: "Subsidy Applied",  color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",  icon: FileText },
    approved: { label: "Subsidy Approved", color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-200",icon: CheckCircle },
    credited: { label: "Subsidy Credited", color: "text-emerald-700",bg: "bg-green-50",  border: "border-green-200",  icon: CheckCircle },
    rejected: { label: "Subsidy Rejected", color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",   icon: AlertCircle },
  },
  payment_status: {
    pending:   { label: "Payment Pending",   color: "text-amber-600",   bg: "bg-amber-50" },
    partial:   { label: "Partially Paid",    color: "text-blue-600",    bg: "bg-blue-50" },
    completed: { label: "Fully Paid",        color: "text-emerald-600", bg: "bg-emerald-50" },
  },
  net_metering_status: {
    not_applied: { label: "Not Applied", color: "text-slate-500" },
    applied:     { label: "Applied",     color: "text-blue-600" },
    approved:    { label: "Approved",    color: "text-emerald-600" },
    active:      { label: "Active",      color: "text-emerald-700" },
  }
};

const StatusBadge = ({ type, value }) => {
  const cfg = statusConfig[type]?.[value];
  if (!cfg) return <span className="text-slate-400 text-sm capitalize">{value || "—"}</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border || ""}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {cfg.label}
    </span>
  );
};

const InfoCard = ({ label, value, icon: Icon, color = "text-[#073B4C]", sub }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-50 flex-shrink-0">
          <Icon className="w-5 h-5 text-[#0369A1]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className={`font-bold text-base mt-0.5 ${color} break-words`}>{value || "—"}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

const SavingsCard = ({ customer }) => {
  const monthlyBefore = Math.round((customer.system_capacity_kw || 3) * 120);
  const monthlySaved = Math.round(monthlyBefore * 0.85);
  const yearlyBilled = (monthlyBefore - monthlySaved) * 12;
  const yearlySaved = monthlySaved * 12;
  const totalSavedSince = customer.installation_date
    ? Math.round((new Date() - new Date(customer.installation_date)) / (1000 * 60 * 60 * 24 * 30) * monthlySaved)
    : 0;
  return (
    <div className="bg-gradient-to-br from-[#FFFDF4] to-[#F7FBFF] rounded-2xl border border-amber-100 p-5">
      <h3 className="font-bold text-[#073B4C] flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-[#F6A600]" /> Savings Tracker
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
          <div className="text-2xl font-extrabold text-emerald-600">₹{monthlySaved.toLocaleString()}</div>
          <div className="text-xs text-slate-400">Monthly Savings</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
          <div className="text-2xl font-extrabold text-amber-600">₹{yearlySaved.toLocaleString()}</div>
          <div className="text-xs text-slate-400">Yearly Savings</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-sky-100 col-span-2">
          <div className="text-3xl font-extrabold text-[#0369A1]">₹{totalSavedSince.toLocaleString()}</div>
          <div className="text-xs text-slate-400">Total Saved Since Installation</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
        <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs text-emerald-700 font-medium">
          Estimated monthly bill now: ₹{(monthlyBefore - monthlySaved).toLocaleString()} (from ₹{monthlyBefore.toLocaleString()})
        </p>
      </div>
    </div>
  );
};

const ServiceRequestModal = ({ mobile, onClose, onSuccess }) => {
  const [type, setType] = useState("maintenance");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!description.trim()) { setError("Please describe your issue"); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/customer/service-request`, { mobile, type, description });
      onSuccess();
    } catch (e) {
      setError("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-[#073B4C]">Submit Service Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 text-[#073B4C] focus:outline-none focus:ring-2 focus:ring-[#0369A1]">
          <option value="maintenance">Routine Maintenance</option>
          <option value="repair">Panel/Inverter Repair</option>
          <option value="subsidy">Subsidy Enquiry</option>
          <option value="cleaning">Panel Cleaning</option>
          <option value="net_metering">Net Metering Help</option>
          <option value="general">General Query</option>
        </select>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe your issue or request..."
          rows={4}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 text-[#073B4C] focus:outline-none focus:ring-2 focus:ring-[#0369A1] resize-none"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button onClick={submit} disabled={loading} className="w-full bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-50">
          {loading ? "Submitting..." : <><Send className="w-4 h-4" /> Submit Request</>}
        </button>
      </div>
    </div>
  );
};

export const CustomerPortal = () => {
  const [customer, setCustomer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceSuccess, setServiceSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Billing & portal-extension state
  const [billing, setBilling] = useState(null);    // {kpi, invoices, quotations}
  const [progress, setProgress] = useState(null);  // {installation, subsidy}
  const [documents, setDocuments] = useState([]);  // download list
  const [referral, setReferral] = useState(null);  // {code, link, stats}
  const [payNow, setPayNow] = useState(null);      // {invoice, upi} — modal state
  const [billingLoading, setBillingLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-logout after 15 minutes of inactivity
  const CUSTOMER_TIMEOUT = 15 * 60 * 1000;
  const inactivityTimer = useRef(null);
  const resetCustomerTimer = useCallback(() => {
    localStorage.setItem("asrCustomerLastActivity", Date.now().toString());
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      sessionStorage.removeItem("asrCustomerData");
      sessionStorage.removeItem("asrCustomerPortalSettings");
      sessionStorage.removeItem("asrCustomerMobile");
      localStorage.removeItem("asrCustomerLastActivity");
      alert("Your session has expired after 15 minutes of inactivity. Please login again.");
      navigate("/customer/login");
    }, CUSTOMER_TIMEOUT);
  }, [navigate, CUSTOMER_TIMEOUT]);

  useEffect(() => {
    const data = sessionStorage.getItem("asrCustomerData");
    const s = sessionStorage.getItem("asrCustomerPortalSettings");
    if (!data) { navigate("/customer/login"); return; }
    setCustomer(JSON.parse(data));
    if (s) setSettings(JSON.parse(s));

    // Start inactivity tracking
    const storedActivity = localStorage.getItem("asrCustomerLastActivity");
    if (storedActivity && Date.now() - parseInt(storedActivity) > CUSTOMER_TIMEOUT) {
      sessionStorage.clear();
      navigate("/customer/login");
      return;
    }
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(ev => document.addEventListener(ev, resetCustomerTimer, { passive: true }));
    resetCustomerTimer();
    return () => {
      events.forEach(ev => document.removeEventListener(ev, resetCustomerTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [navigate, resetCustomerTimer, CUSTOMER_TIMEOUT]);

  // --- Load billing/portal extensions once we have a mobile ---
  const fetchPortalData = useCallback(async (mob) => {
    if (!mob) return;
    setBillingLoading(true);
    try {
      const [bRes, pRes, dRes, rRes] = await Promise.all([
        axios.get(`${API}/customer/invoices/${mob}`).catch(() => ({ data: null })),
        axios.get(`${API}/customer/progress/${mob}`).catch(() => ({ data: null })),
        axios.get(`${API}/customer/documents/${mob}`).catch(() => ({ data: { documents: [] } })),
        axios.get(`${API}/customer/referral/${mob}`).catch(() => ({ data: null })),
      ]);
      if (bRes.data) setBilling(bRes.data);
      if (pRes.data) setProgress(pRes.data);
      if (dRes.data) setDocuments(dRes.data.documents || []);
      if (rRes.data) setReferral(rRes.data);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    const mob = sessionStorage.getItem("asrCustomerMobile") || customer?.mobile;
    if (mob) fetchPortalData(mob);
  }, [customer, fetchPortalData]);

  const openPayNow = async (inv, mob) => {
    try {
      const res = await axios.get(`${API}/customer/invoices/${mob}/${inv.id}/upi`);
      setPayNow({ invoice: inv, upi: res.data });
    } catch {
      alert("Could not generate UPI link. Please try again.");
    }
  };

  const handleLogout = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    sessionStorage.removeItem("asrCustomerData");
    sessionStorage.removeItem("asrCustomerPortalSettings");
    sessionStorage.removeItem("asrCustomerMobile");
    localStorage.removeItem("asrCustomerLastActivity");
    navigate("/customer/login");
  };

  const handleServiceSuccess = () => {
    const mobile = sessionStorage.getItem("asrCustomerMobile");
    setShowServiceModal(false);
    setServiceSuccess(true);
    setTimeout(() => setServiceSuccess(false), 5000);
    axios.get(`${API}/customer/verify-otp`, { mobile }).catch(() => {});
  };

  if (!customer) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#0369A1] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "billing", label: "Billing", icon: IndianRupee },
    { id: "installation", label: "Installation", icon: Sun },
    { id: "subsidy", label: "Subsidy & Finance", icon: Award },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "referral", label: "Refer & Earn", icon: Gift },
    { id: "savings", label: "Savings", icon: TrendingUp },
    { id: "service", label: "Service", icon: Wrench },
  ];

  const mobile = sessionStorage.getItem("asrCustomerMobile") || customer.mobile;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #FFFDF4 0%, #F7FBFF 50%, #EEF9FF 100%)" }}>
      <div className="absolute inset-0 solar-panel-grid opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-1 text-slate-500 hover:text-[#073B4C] transition p-1.5 rounded-lg hover:bg-slate-100" title="Go back / Logout">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Link to="/"><img src="/asr_logo_transparent.png" alt="ASR" className="h-14 w-auto" /></Link>
            <div>
              <div className="text-sm font-bold text-[#073B4C]">{customer.name}</div>
              <div className="text-xs text-slate-400">Customer Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`https://wa.me/91${settings?.contact_number || "8877896889"}?text=Hello%2C%20I%20need%20support`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-2 rounded-full text-xs font-semibold hover:bg-emerald-600 transition">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 text-xs font-medium transition px-2 py-2">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 relative">

        {/* Banner */}
        {settings?.banner_text && (
          <div className="mb-4 bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white px-5 py-3 rounded-2xl text-sm flex items-center gap-2 shadow">
            <Info className="w-4 h-4 flex-shrink-0" />
            {settings.banner_text}
          </div>
        )}

        {serviceSuccess && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3 rounded-2xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Service request submitted! We'll contact you within 24 hours.
          </div>
        )}

        {/* Welcome card */}
        <div className="bg-gradient-to-r from-[#073B4C] to-[#0369A1] rounded-3xl p-6 mb-6 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sky-200 text-sm">Welcome back,</p>
              <h1 className="text-2xl font-extrabold">{customer.name}</h1>
              {customer.district && <p className="text-sky-200 text-sm">{customer.address || customer.district}</p>}
              {settings?.welcome_message && <p className="text-sky-100 text-xs mt-2 max-w-xl">{settings.welcome_message}</p>}
            </div>
            <div className="flex-shrink-0 flex flex-col gap-2 text-right">
              <div className="bg-white/15 rounded-xl px-4 py-2">
                <div className="text-xs text-sky-200">System Capacity</div>
                <div className="text-xl font-bold">{customer.system_capacity_kw || "—"} kW</div>
              </div>
              <div className="bg-white/15 rounded-xl px-4 py-2">
                <div className="text-xs text-sky-200">App. ID</div>
                <div className="text-sm font-bold">{customer.application_id || "Not Assigned"}</div>
              </div>
            </div>
          </div>

          {/* Status row */}
          <div className="flex flex-wrap gap-2 mt-4">
            <StatusBadge type="application_status" value={customer.application_status} />
            <StatusBadge type="subsidy_status" value={customer.subsidy_status} />
            {customer.installation_date && (
              <span className="inline-flex items-center gap-1.5 bg-white/15 text-white px-3 py-1.5 rounded-full text-xs font-medium">
                <Calendar className="w-3.5 h-3.5" />
                Installed: {new Date(customer.installation_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/80 rounded-2xl p-1.5 mb-6 border border-slate-100 shadow-sm overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  activeTab === tab.id
                    ? "bg-[#0369A1] text-white shadow"
                    : "text-slate-500 hover:text-[#073B4C]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB: Overview */}
        {activeTab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard label="Customer Name" value={customer.name} icon={Home} />
            <InfoCard label="Mobile Number" value={`+91 ${mobile.slice(0,2)}XXXXXXXX${mobile.slice(-2)}`} icon={Phone} />
            <InfoCard label="District" value={customer.district} icon={Award} />
            <InfoCard label="Installation Date" value={customer.installation_date ? new Date(customer.installation_date).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }) : "—"} icon={Calendar} />
            <InfoCard label="System Capacity" value={customer.system_capacity_kw ? `${customer.system_capacity_kw} kW` : "—"} icon={Zap} color="text-amber-600" />
            <InfoCard label="Net Metering" value={<span className={statusConfig.net_metering_status[customer.net_metering_status]?.color || "text-slate-500"}>{statusConfig.net_metering_status[customer.net_metering_status]?.label || "—"}</span>} icon={ArrowUpRight} />
            {customer.notes && (
              <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Message from ASR Enterprises</p>
                  <p className="text-[#073B4C] text-sm">{customer.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Installation */}
        {activeTab === "installation" && (
          <div className="space-y-4">
            {progress && <ProgressTracker
              title="Installation Progress"
              stages={progress.installation.stages}
              currentIndex={progress.installation.current_index}
              icon={Sun}
              accent="amber"
              testid="installation-progress"
            />}
            {/* Free Installation Warranty (5-year, auto-computed from installation_date) */}
            {progress?.warranty && (
              <div
                data-testid="cust-warranty-card"
                className={`rounded-2xl p-4 border shadow-sm flex items-start gap-3 ${
                  progress.warranty.expired
                    ? "bg-red-50 border-red-200"
                    : (progress.warranty.has_installation_date
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-slate-50 border-slate-200")
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  progress.warranty.expired
                    ? "bg-red-100 text-red-600"
                    : (progress.warranty.has_installation_date ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500")
                }`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Free Installation Warranty · {progress.warranty.total_years} Years
                  </p>
                  <p
                    className={`text-lg font-extrabold mt-0.5 ${
                      progress.warranty.expired
                        ? "text-red-600"
                        : (progress.warranty.has_installation_date ? "text-emerald-700" : "text-slate-500")
                    }`}
                    data-testid="cust-warranty-remaining"
                  >
                    {progress.warranty.expired
                      ? "Warranty Expired"
                      : (progress.warranty.has_installation_date
                          ? `Remaining: ${progress.warranty.remaining_label}`
                          : "Will start when installation date is set")}
                  </p>
                  {progress.warranty.install_date && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Installed on {new Date(progress.warranty.install_date).toLocaleDateString("en-IN")} · Valid till {new Date(progress.warranty.expires_on).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoCard label="Solar Brand" value={customer.solar_brand} icon={Sun} color="text-amber-600" />
              <InfoCard label="Inverter Brand" value={customer.inverter_brand} icon={Zap} color="text-sky-600" />
              <InfoCard label="Capacity" value={customer.system_capacity_kw ? `${customer.system_capacity_kw} kW` : "—"} icon={Battery} sub="System size" />
              <InfoCard label="Solar Panels" value={customer.panels_count ? `${customer.panels_count} Panels` : "—"} icon={Sun} />
              <InfoCard label="Panel Warranty" value={customer.panel_warranty_years ? `${customer.panel_warranty_years} Years` : "—"} icon={Shield} color="text-emerald-600" sub="Performance guaranteed" />
              <InfoCard label="Inverter Warranty" value={customer.inverter_warranty_years ? `${customer.inverter_warranty_years} Years` : "—"} icon={Shield} color="text-sky-600" />
              <InfoCard label="Installation Warranty" value={customer.installation_warranty_years ? `${customer.installation_warranty_years} Year(s)` : "—"} icon={Wrench} sub="ASR workmanship guarantee" />
              <InfoCard label="Net Metering Status" value={statusConfig.net_metering_status[customer.net_metering_status]?.label} icon={ArrowUpRight} />
            </div>
          </div>
        )}

        {/* TAB: Subsidy & Finance */}
        {activeTab === "subsidy" && (
          <div className="space-y-4">
            {progress && <ProgressTracker
              title="Subsidy Progress — PM Surya Ghar Yojana"
              stages={progress.subsidy.stages}
              currentIndex={progress.subsidy.current_index}
              icon={Award}
              accent="emerald"
              testid="subsidy-progress"
            />}
            <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow">
                <p className="text-emerald-100 text-sm">PM Surya Ghar Application ID</p>
                <p className="text-3xl font-extrabold mt-1">{customer.application_id || "Not Assigned"}</p>
                <StatusBadge type="application_status" value={customer.application_status} />
              </div>
            </div>
            <InfoCard label="Subsidy Amount" value={customer.subsidy_amount ? `₹${customer.subsidy_amount.toLocaleString()}` : "—"} icon={IndianRupee} color="text-emerald-600" />
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Subsidy Status</p>
              <StatusBadge type="subsidy_status" value={customer.subsidy_status} />
              {customer.subsidy_credited_date && (
                <p className="text-xs text-slate-400 mt-2">Credited on: {new Date(customer.subsidy_credited_date).toLocaleDateString("en-IN")}</p>
              )}
            </div>
            <InfoCard label="Total System Cost" value={customer.total_cost ? `₹${customer.total_cost.toLocaleString()}` : "—"} icon={IndianRupee} />
            <InfoCard label="Amount Paid" value={customer.amount_paid ? `₹${customer.amount_paid.toLocaleString()}` : "—"} icon={CheckCircle} color="text-emerald-600" />
            <div className="sm:col-span-2 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Payment Status</p>
              <StatusBadge type="payment_status" value={customer.payment_status} />
              {customer.total_cost > 0 && customer.amount_paid > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Paid: ₹{customer.amount_paid.toLocaleString()}</span>
                    <span>Total: ₹{customer.total_cost.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (customer.amount_paid / customer.total_cost) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="sm:col-span-2 bg-sky-50 border border-sky-100 rounded-2xl p-4">
              <p className="text-xs text-sky-700 font-semibold mb-2 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> About PM Surya Ghar Yojana</p>
              <p className="text-xs text-sky-600">The PM Surya Ghar Muft Bijli Yojana provides up to ₹78,000 subsidy for 3kW solar rooftop systems. The subsidy is directly credited to your bank account by the government within 30 days of installation approval. For application status, visit <a href="https://pmsuryaghar.gov.in" target="_blank" rel="noopener noreferrer" className="underline font-semibold">pmsuryaghar.gov.in</a>.</p>
            </div>
            </div>
          </div>
        )}

        {/* TAB: Billing */}
        {activeTab === "billing" && (
          <BillingTab
            billing={billing}
            mobile={mobile}
            loading={billingLoading}
            onPayNow={(inv) => openPayNow(inv, mobile)}
            onRefresh={() => fetchPortalData(mobile)}
          />
        )}

        {/* TAB: Documents */}
        {activeTab === "documents" && (
          <DocumentsTab documents={documents} loading={billingLoading} />
        )}

        {/* TAB: Referral */}
        {activeTab === "referral" && (
          <ReferralTab referral={referral} loading={billingLoading} />
        )}

        {/* TAB: Savings */}
        {activeTab === "savings" && (
          <div className="space-y-4">
            <SavingsCard customer={customer} />
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "CO₂ Saved Monthly", value: `${Math.round((customer.system_capacity_kw || 3) * 4 * 0.82)} kg`, icon: "🌱", sub: "Equivalent to planting trees" },
                { label: "Units Generated/Month", value: `${Math.round((customer.system_capacity_kw || 3) * 4 * 30)} kWh`, icon: "⚡", sub: "Estimated solar generation" },
                { label: "Payback Period", value: "3.5 – 5 Years", icon: "📅", sub: "Based on current tariffs" },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <div className="font-bold text-[#073B4C] text-lg">{item.value}</div>
                  <div className="text-xs text-slate-500 font-medium">{item.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.sub}</div>
                </div>
              ))}
            </div>
            <div className="bg-gradient-to-r from-amber-50 to-sky-50 border border-amber-100 rounded-2xl p-5">
              <h4 className="font-bold text-[#073B4C] flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-500" /> Benefits Summary</h4>
              {[
                "Zero or minimal electricity bills every month",
                "25-year performance warranty on solar panels",
                "Government subsidy directly credited to your account",
                "Net metering: sell surplus power to DISCOM",
                "Carbon neutral lifestyle — go green!",
                "Increase property value by up to 4%"
              ].map(b => (
                <div key={b} className="flex items-start gap-2 text-sm text-[#073B4C] mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /> {b}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Service */}
        {activeTab === "service" && (
          <div className="space-y-4">
            <button
              onClick={() => setShowServiceModal(true)}
              className="w-full bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition"
            >
              <Wrench className="w-5 h-5" /> Raise a Service Request
            </button>

            <div className="grid sm:grid-cols-2 gap-3">
              <a href={`tel:${settings?.contact_number || "8877896889"}`} className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-sky-200 transition group">
                <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-[#0369A1]" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Call Support</p>
                  <p className="font-bold text-[#073B4C]">{settings?.contact_number || "8877896889"}</p>
                  <p className="text-xs text-slate-400">{settings?.service_hours || "Mon-Sat: 9 AM - 6 PM"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-[#0369A1] transition" />
              </a>
              <a href={`https://wa.me/91${settings?.contact_number || "8877896889"}?text=Hello%2C%20I%20need%20service%20support%20for%20my%20solar%20system`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-emerald-200 transition group">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">WhatsApp Support</p>
                  <p className="font-bold text-[#073B4C]">WhatsApp Us</p>
                  <p className="text-xs text-slate-400">Fastest response</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-emerald-500 transition" />
              </a>
              {settings?.support_email && (
                <a href={`mailto:${settings.support_email}`} className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-amber-200 transition group sm:col-span-2">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Email Support</p>
                    <p className="font-bold text-[#073B4C]">{settings.support_email}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-amber-500 transition" />
                </a>
              )}
            </div>

            {/* Past service requests */}
            {customer.service_requests?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h4 className="font-bold text-[#073B4C] text-sm">Your Service Requests</h4>
                </div>
                <div className="divide-y divide-slate-50">
                  {[...customer.service_requests].reverse().map(req => (
                    <div key={req.id} className="px-4 py-3 flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${req.status === "open" ? "bg-amber-500" : req.status === "resolved" ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-[#073B4C] font-medium capitalize">{req.type.replace("_", " ")}</p>
                        <p className="text-xs text-slate-400 break-words">{req.description}</p>
                        <p className="text-xs text-slate-300 mt-1">{new Date(req.created_at).toLocaleDateString("en-IN")}</p>
                      </div>
                      <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${req.status === "open" ? "bg-amber-50 text-amber-600" : req.status === "resolved" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-sm text-sky-700">
              <p className="font-semibold mb-1 flex items-center gap-1.5"><Info className="w-4 h-4" /> Service Response Policy</p>
              <p className="text-xs">We respond to service requests within 24 hours (business days). For emergencies, please call directly. Maintenance visits are scheduled within 48-72 hours.</p>
            </div>
          </div>
        )}

        {/* Important Notices */}
        {settings?.important_notices?.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-bold text-[#073B4C]">Important Notices</h4>
            {settings.important_notices.map((notice, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {notice}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          ASR Enterprises · Bihar's Trusted Solar Rooftop Partner ·{" "}
          <Link to="/" className="underline hover:text-[#0369A1]">Visit Website</Link>
        </p>
      </div>

      {showServiceModal && (
        <ServiceRequestModal
          mobile={mobile}
          onClose={() => setShowServiceModal(false)}
          onSuccess={handleServiceSuccess}
        />
      )}

      {/* Logout Confirmation Popup */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-[#073B4C] mb-1">Logout of Portal?</h3>
            <p className="text-slate-400 text-sm mb-6">
              You will be signed out of your customer account. Your data is safe.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition text-sm"
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition text-sm flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Now modal */}
      {payNow && <PayNowModal payNow={payNow} onClose={() => setPayNow(null)} />}
    </div>
  );
};

// ==================== PROGRESS TRACKER ====================
const ProgressTracker = ({ title, stages, currentIndex, icon: Icon, accent = "amber", testid }) => {
  const pct = currentIndex < 0 ? 0 : Math.round(((currentIndex + 1) / stages.length) * 100);
  const accents = {
    amber: { bar: "bg-gradient-to-r from-amber-400 to-orange-500", dot: "bg-amber-500", text: "text-amber-700" },
    emerald: { bar: "bg-gradient-to-r from-emerald-400 to-emerald-600", dot: "bg-emerald-500", text: "text-emerald-700" },
  };
  const a = accents[accent] || accents.amber;
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm" data-testid={testid}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className={`w-4 h-4 ${a.text}`} />}
        <h3 className="text-sm font-bold text-[#073B4C]">{title}</h3>
        <span className={`ml-auto text-xs font-bold ${a.text}`}>{pct}%</span>
      </div>
      <div className="relative">
        <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 rounded-full" />
        <div
          className={`absolute top-4 left-4 h-1 ${a.bar} rounded-full transition-all duration-500`}
          style={{ width: currentIndex < 0 ? 0 : `calc(${(currentIndex / Math.max(1, stages.length - 1)) * 100}% - ${currentIndex === stages.length - 1 ? '0px' : '16px'} + 16px * ${currentIndex === 0 ? 0 : 1})` }}
        />
        <div className="relative flex justify-between">
          {stages.map((s, i) => {
            const done = i <= currentIndex;
            return (
              <div key={s} className="flex flex-col items-center flex-1 text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${done ? `${a.dot} border-transparent text-white` : "bg-white border-slate-300 text-slate-400"}`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </div>
                <div className={`mt-1.5 text-[11px] font-semibold ${done ? a.text : "text-slate-400"}`}>
                  {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==================== BILLING TAB ====================
const BillingTab = ({ billing, mobile, loading, onPayNow, onRefresh }) => {
  const kpi = billing?.kpi || { total_cost: 0, total_paid: 0, total_due: 0, payment_status: "none", invoices_count: 0, unpaid_count: 0, payment_mode: "" };
  const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusColor = {
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    partial: "bg-amber-100 text-amber-800 border-amber-200",
    unpaid: "bg-red-100 text-red-800 border-red-200",
    none: "bg-slate-100 text-slate-600 border-slate-200",
  }[kpi.payment_status || "none"];

  const paidPct = kpi.total_cost > 0 ? Math.min(100, Math.round((kpi.total_paid / kpi.total_cost) * 100)) : 0;
  const invoices = billing?.invoices || [];
  const firstUnpaidInvoice = invoices.find(i => (i.payment_status || "unpaid") !== "paid");

  return (
    <div className="space-y-4">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm" data-testid="cust-kpi-total">
          <p className="text-xs text-slate-400 uppercase font-semibold">Total Cost</p>
          <p className="text-xl md:text-2xl font-bold text-[#073B4C] mt-1 tabular-nums">{inr(kpi.total_cost)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm" data-testid="cust-kpi-paid">
          <p className="text-xs text-slate-400 uppercase font-semibold">Amount Paid</p>
          <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{inr(kpi.total_paid)}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm col-span-2 ${kpi.total_due > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`} data-testid="cust-kpi-due">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 uppercase font-semibold">Due Amount</p>
              <p className={`text-2xl md:text-3xl font-extrabold mt-1 tabular-nums ${kpi.total_due > 0 ? "text-red-600" : "text-slate-400"}`}>{inr(kpi.total_due)}</p>
              {kpi.total_due > 0 && (
                <p className="text-[11px] font-semibold text-red-600 mt-0.5" data-testid="cust-pending-label">
                  ₹ {Number(kpi.total_due).toLocaleString("en-IN")} Pending
                </p>
              )}
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border flex-shrink-0 ${statusColor}`} data-testid="cust-payment-status">
              {(kpi.payment_status || "NONE").toUpperCase()}
            </span>
          </div>

          {/* Paid vs Total progress bar */}
          {kpi.total_cost > 0 && (
            <div className="mt-3" data-testid="cust-billing-progressbar">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-medium">
                <span>Paid: ₹{Number(kpi.total_paid).toLocaleString("en-IN")}</span>
                <span>Total: ₹{Number(kpi.total_cost).toLocaleString("en-IN")}</span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${kpi.payment_status === "paid" ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-400 to-emerald-600"}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 text-right">{paidPct}% paid</p>
            </div>
          )}

          {/* Top-level Pay Now CTA — surfaces the earliest unpaid invoice's UPI flow */}
          {kpi.total_due > 0 && firstUnpaidInvoice && (
            <button
              onClick={() => onPayNow(firstUnpaidInvoice)}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
              data-testid="cust-top-paynow-btn"
            >
              <IndianRupee className="w-4 h-4" /> Pay Now · {inr(kpi.total_due)}
              {kpi.payment_mode && (
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  via {kpi.payment_mode}
                </span>
              )}
            </button>
          )}
          {/* If due exists but invoice not yet synced, show a polite message */}
          {kpi.total_due > 0 && !firstUnpaidInvoice && (
            <button
              onClick={onRefresh}
              className="mt-3 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition"
              data-testid="cust-top-paynow-sync-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Preparing your invoice — tap to refresh
            </button>
          )}
        </div>
      </div>

      {/* Alert banner if there are unpaid/partial invoices */}
      {kpi.unpaid_count > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-2xl p-4 flex gap-3" data-testid="cust-alert-banner">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-700 text-sm">Payment Pending</p>
            <p className="text-xs text-slate-700 mt-0.5">
              You have {kpi.unpaid_count} invoice{kpi.unpaid_count > 1 ? "s" : ""} with <span className="font-bold">₹ {Number(kpi.total_due).toLocaleString("en-IN")} outstanding</span>. Pay directly below via UPI.
            </p>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#073B4C] text-sm">Your Invoices</h3>
        <button
          onClick={onRefresh}
          className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
          data-testid="cust-billing-refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {(billing?.invoices?.length || 0) === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center text-slate-500 text-sm">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          No invoices yet. They'll show up here automatically once you've been onboarded.
        </div>
      ) : (
        billing.invoices.map((inv) => (
          <BillingInvoiceCard key={inv.id} inv={inv} mobile={mobile} onPayNow={() => onPayNow(inv)} inr={inr} />
        ))
      )}
    </div>
  );
};

const BillingInvoiceCard = ({ inv, mobile, onPayNow, inr }) => {
  const pstatus = (inv.payment_status || "unpaid").toLowerCase();
  const isPaid = pstatus === "paid";
  const statusMap = {
    paid: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    unpaid: "bg-red-100 text-red-800",
  };
  const pct = inv.total_amount > 0 ? Math.min(100, Math.round((inv.amount_paid / inv.total_amount) * 100)) : 0;
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm" data-testid={`cust-inv-${inv.invoice_number}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Invoice</p>
          <p className="font-mono font-bold text-[#073B4C]">{inv.invoice_number}</p>
          <p className="text-xs text-slate-500 mt-0.5">{inv.invoice_date}{inv.scheme === "pm_surya_ghar" && " · PM Surya Ghar"}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusMap[pstatus]}`}>{pstatus.toUpperCase()}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div><p className="text-slate-400">Total</p><p className="font-bold text-[#073B4C]">{inr(inv.total_amount)}</p></div>
        <div><p className="text-slate-400">Paid</p><p className="font-bold text-emerald-600">{inr(inv.amount_paid)}</p></div>
        <div><p className="text-slate-400">Due</p><p className={`font-bold ${inv.due_amount > 0 ? "text-red-600" : "text-slate-400"}`}>{inr(inv.due_amount)}</p></div>
      </div>
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        {!isPaid && (
          <button
            onClick={onPayNow}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5"
            data-testid={`cust-paynow-${inv.invoice_number}`}
          >
            <IndianRupee className="w-4 h-4" /> Pay {inr(inv.due_amount)}
          </button>
        )}
        <a
          href={`${API}/customer/invoices/${mobile}/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer"
          className={`${isPaid ? "flex-1" : ""} bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold flex items-center justify-center gap-1.5`}
          data-testid={`cust-pdf-${inv.invoice_number}`}
        >
          <Download className="w-4 h-4" /> PDF
        </a>
      </div>
      {inv.reminder_count > 0 && inv.payment_status !== "paid" && (
        <p className="mt-2 text-[11px] text-amber-700 flex items-center gap-1">
          <Bell className="w-3 h-3" /> Reminders sent: {inv.reminder_count} (last {inv.last_reminder_at ? new Date(inv.last_reminder_at).toLocaleDateString("en-IN") : "—"})
        </p>
      )}
    </div>
  );
};

// ==================== PAY-NOW MODAL ====================
const PayNowModal = ({ payNow, onClose }) => {
  const { invoice, upi } = payNow;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(upi.upi_link); } catch { /* ignore */ }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="cust-paynow-modal">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-[#073B4C]">Pay via UPI</h3>
          <button onClick={onClose} data-testid="cust-paynow-close"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Amount Due</p>
            <p className="text-3xl font-extrabold text-[#0a355e]">₹ {Number(upi.due_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-500 mt-0.5">{invoice.invoice_number}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wide mb-1">Scan & Pay • {upi.bank}</p>
            {upi.qr_data_uri ? (
              <img src={upi.qr_data_uri} alt="UPI QR" className="w-56 h-56 mx-auto" data-testid="cust-paynow-qr" />
            ) : (
              <div className="text-xs text-red-600">QR unavailable</div>
            )}
            <p className="text-xs text-slate-500 mt-1 break-all">{upi.vpa}</p>
          </div>
          <a
            href={upi.upi_link}
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 font-bold text-center"
            data-testid="cust-paynow-intent-btn"
          >
            Open UPI App →
          </a>
          <button
            onClick={copyLink}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
            data-testid="cust-paynow-copy"
          >
            <Copy className="w-4 h-4" /> Copy UPI Link
          </button>
          <p className="text-[11px] text-slate-400 text-center leading-4">
            Pay securely via any UPI app — GPay · PhonePe · Paytm · BHIM · BankApp. Payment will reflect within a few hours of receipt.
          </p>
        </div>
      </div>
    </div>
  );
};

// ==================== DOCUMENTS TAB ====================
const DocumentsTab = ({ documents, loading }) => (
  <div className="space-y-3" data-testid="cust-docs-tab">
    <h3 className="font-bold text-[#073B4C] text-sm">Downloads & Documents</h3>
    {loading && documents.length === 0 ? (
      <div className="bg-white rounded-2xl p-6 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
    ) : documents.length === 0 ? (
      <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center text-slate-500 text-sm">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        No documents attached yet. Invoices will appear here after every payment. Warranty & certificates are added by our team.
      </div>
    ) : documents.map((d, i) => (
      <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3" data-testid={`cust-doc-${i}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          d.type === "invoice" ? "bg-emerald-50 text-emerald-600"
          : d.type === "warranty" ? "bg-amber-50 text-amber-600"
          : "bg-sky-50 text-sky-600"
        }`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#073B4C] text-sm truncate">{d.label}</p>
          <p className="text-xs text-slate-500 truncate">{d.meta || d.date}</p>
        </div>
        {d.url ? (
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
            <Download className="w-5 h-5" />
          </a>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
    ))}
  </div>
);

// ==================== REFERRAL TAB ====================
const ReferralTab = ({ referral, loading }) => {
  const [copied, setCopied] = useState(false);
  if (loading && !referral) return <div className="bg-white rounded-2xl p-6 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  if (!referral) return <div className="bg-white rounded-2xl p-6 border border-slate-100 text-sm text-slate-500">Referral data unavailable.</div>;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(referral.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  return (
    <div className="space-y-4" data-testid="cust-referral-tab">
      <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5" />
          <h3 className="font-bold">Refer Friends, Earn ₹1,000</h3>
        </div>
        <p className="text-xs text-amber-50">For every friend who installs solar through your referral, you earn ₹1,000 cashback/service credit.</p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <p className="text-xs text-slate-400 uppercase font-semibold">Your Referral Code</p>
        <p className="font-mono font-extrabold text-2xl text-[#073B4C] mt-1 tracking-wider" data-testid="cust-ref-code">{referral.code}</p>
        <p className="text-xs text-slate-500 mt-2 break-all" data-testid="cust-ref-link">{referral.link}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={copyLink}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
            data-testid="cust-ref-copy"
          >
            <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy Link"}
          </button>
          <a
            href={referral.whatsapp_share_link} target="_blank" rel="noopener noreferrer"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
            data-testid="cust-ref-share"
          >
            <Share2 className="w-4 h-4" /> Share
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <RefStat label="Link Clicks" value={referral.stats.link_clicks} testid="cust-ref-clicks" />
        <RefStat label="Referrals" value={referral.stats.referrals} testid="cust-ref-referrals" />
        <RefStat label="Converted" value={referral.stats.converted} accent="emerald" testid="cust-ref-converted" />
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-600">Total Rewards Earned</p>
        <p className="text-2xl font-extrabold text-emerald-700 mt-1">₹ {Number(referral.stats.reward_earned || 0).toLocaleString("en-IN")}</p>
        <p className="text-[11px] text-slate-500 mt-1">Paid out as cashback / free annual service. Admin verifies each conversion manually.</p>
      </div>
    </div>
  );
};

const RefStat = ({ label, value, accent = "slate", testid }) => (
  <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center" data-testid={testid}>
    <p className="text-xs text-slate-400 uppercase font-semibold">{label}</p>
    <p className={`text-2xl font-extrabold mt-0.5 ${accent === "emerald" ? "text-emerald-600" : "text-[#073B4C]"}`}>{value}</p>
  </div>
);

