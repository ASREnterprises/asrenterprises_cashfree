import { useState, useEffect, useCallback, memo } from "react";
import axios from "axios";
import {
  CreditCard, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle,
  RefreshCw, Plus, Search, Filter, Send, Copy, Eye, X, Edit,
  Link as LinkIcon, MessageSquare, Phone, Mail, User, Calendar,
  ChevronDown, ChevronUp, ExternalLink, Settings, Loader2,
  Download, BarChart3, PieChart, Wallet, Ban, RotateCcw, Trash2,
  Building2, Smartphone, Globe, FileText, ArrowRight, Check
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Constants
const ASR_SUPPORT_PHONE = "9296389097";
const ASR_WHATSAPP_API_PHONE = "8298389097";
const ASR_SUPPORT_EMAIL = "support@asrenterprises.in";

const PAYMENT_STATUSES = {
  link_created: { label: "Link Created", color: "bg-blue-100 text-blue-700", icon: LinkIcon },
  link_sent: { label: "Link Sent", color: "bg-purple-100 text-purple-700", icon: Send },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: AlertCircle },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-700", icon: Clock },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600", icon: Ban }
};

const PAYMENT_SOURCES = {
  crm_link: { label: "CRM Link", color: "bg-blue-500", icon: Building2 },
  crm_bulk: { label: "Bulk CRM", color: "bg-indigo-500", icon: Building2 },
  whatsapp: { label: "WhatsApp", color: "bg-green-500", icon: MessageSquare },
  website: { label: "Website", color: "bg-amber-500", icon: Globe },
  manual: { label: "Manual", color: "bg-gray-500", icon: Wallet }
};

// Helper Functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const copyToClipboard = async (text, onSuccess) => {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess?.();
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

// ==================== STATISTICS CARDS ====================
const StatsCard = memo(({ title, value, subtext, icon: Icon, color, trend }) => (
  <div className={`bg-gradient-to-br ${color} rounded-xl p-5 text-white shadow-lg`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-white/80 text-sm font-medium">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1">{value}</p>
        {subtext && <p className="text-white/70 text-xs mt-1">{subtext}</p>}
      </div>
      <div className="p-3 bg-white/20 rounded-xl">
        <Icon className="w-6 h-6" />
      </div>
    </div>
    {trend && (
      <div className="mt-3 flex items-center text-xs text-white/80">
        <TrendingUp className="w-3 h-3 mr-1" />
        {trend}
      </div>
    )}
  </div>
));

// ==================== CREATE PAYMENT LINK MODAL ====================
const CreatePaymentLinkModal = memo(({ isOpen, onClose, onCreated, selectedLead }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    amount: "",
    purpose: "Solar Service Payment",
    notes: "",
    send_via_whatsapp: false,
    expiry_minutes: 1440
  });
  const [createdLink, setCreatedLink] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (selectedLead) {
      setFormData(prev => ({
        ...prev,
        customer_name: selectedLead.name || "",
        customer_phone: selectedLead.phone || "",
        customer_email: selectedLead.email || "",
        lead_id: selectedLead.id
      }));
    }
  }, [selectedLead]);

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      amount: "",
      purpose: "Solar Service Payment",
      notes: "",
      send_via_whatsapp: false,
      expiry_minutes: 1440
    });
    setCreatedLink(null);
    setCopySuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.customer_phone || !formData.amount) {
      alert("Please fill name, phone, and amount");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/payments/create-link`, {
        ...formData,
        amount: parseFloat(formData.amount),
        lead_id: selectedLead?.id || formData.lead_id
      });

      if (response.data.success) {
        setCreatedLink(response.data);
        onCreated?.();
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create payment link");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    copyToClipboard(createdLink.payment_link, () => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-green-500 to-emerald-500 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            {createdLink ? "Payment Link Created" : "Create Payment Link"}
          </h2>
          <button 
            onClick={() => { resetForm(); onClose(); }} 
            className="text-white/80 hover:text-white p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {createdLink ? (
            // Success State
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">Link Created Successfully!</h3>
              <p className="text-gray-500 mb-4">Amount: <span className="font-bold text-green-600">{formatCurrency(formData.amount)}</span></p>
              
              {/* Payment Link Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-2">Payment Link</p>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={createdLink.payment_link} 
                    readOnly 
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono"
                  />
                  <button 
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-1 transition ${
                      copySuccess 
                        ? "bg-green-500 text-white" 
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copySuccess ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Open Link Button */}
              <a 
                href={createdLink.payment_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition mb-4"
              >
                <ExternalLink className="w-5 h-5" />
                Open Payment Link
              </a>

              {createdLink.whatsapp_sent && (
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
                  <MessageSquare className="w-4 h-4" />
                  Sent via WhatsApp
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <button 
                  onClick={resetForm}
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Create Another Link
                </button>
              </div>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-4">
              {selectedLead && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                  <User className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <span className="text-blue-700">Creating link for:</span>
                    <span className="font-semibold text-blue-800 ml-1">{selectedLead.name}</span>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Customer Name *</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter name"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="10-digit mobile"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email (Optional)</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="customer@email.com"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (INR) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Link Expiry</label>
                  <select
                    value={formData.expiry_minutes}
                    onChange={(e) => setFormData({...formData, expiry_minutes: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value={60}>1 Hour</option>
                    <option value={360}>6 Hours</option>
                    <option value={720}>12 Hours</option>
                    <option value={1440}>24 Hours</option>
                    <option value={4320}>3 Days</option>
                    <option value={10080}>7 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Purpose / Description</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Solar Service Payment"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes (Internal)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Internal notes..."
                  rows={2}
                />
              </div>

              {/* WhatsApp Option */}
              <label className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition">
                <input
                  type="checkbox"
                  checked={formData.send_via_whatsapp}
                  onChange={(e) => setFormData({...formData, send_via_whatsapp: e.target.checked})}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Send via WhatsApp</p>
                    <p className="text-xs text-green-600">Automatically send link to customer</p>
                  </div>
                </div>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Creating Link...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Create Payment Link
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
});

// ==================== RECORD MANUAL PAYMENT MODAL ====================
const ManualPaymentModal = memo(({ isOpen, onClose, onRecorded, leads }) => {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [formData, setFormData] = useState({
    amount: "",
    payment_mode: "cash",
    reference_number: "",
    notes: ""
  });

  const filteredLeads = leads?.filter(lead => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm)
  ).slice(0, 10) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead || !formData.amount) {
      alert("Please select a lead and enter amount");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/payments/manual`, {
        lead_id: selectedLead.id,
        amount: parseFloat(formData.amount),
        payment_mode: formData.payment_mode,
        reference_number: formData.reference_number,
        notes: formData.notes
      });

      alert("Payment recorded successfully!");
      onRecorded?.();
      onClose();
      setSelectedLead(null);
      setFormData({ amount: "", payment_mode: "cash", reference_number: "", notes: "" });
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to record payment");
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            Record Manual Payment
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Lead Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Select Lead *</label>
            {selectedLead ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div>
                  <p className="font-semibold text-blue-800">{selectedLead.name}</p>
                  <p className="text-sm text-blue-600">{selectedLead.phone}</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedLead(null)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5"
                    placeholder="Search by name or phone..."
                  />
                </div>
                {searchTerm && filteredLeads.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {filteredLeads.map(lead => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => { setSelectedLead(lead); setSearchTerm(""); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-0"
                      >
                        <p className="font-medium text-gray-800">{lead.name}</p>
                        <p className="text-sm text-gray-500">{lead.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (INR) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5"
                  placeholder="0"
                  min="1"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Mode</label>
              <select
                value={formData.payment_mode}
                onChange={(e) => setFormData({...formData, payment_mode: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Reference / Transaction ID</label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Enter reference number if available"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedLead}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Record Payment
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
});

// ==================== PAYMENT SETTINGS MODAL ====================
const PaymentSettingsModal = memo(({ isOpen, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    app_id: "",
    secret_key: "",
    webhook_secret: "",
    is_sandbox: true,
    is_active: true
  });
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchWebhookUrl();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/payments/settings`);
      if (res.data.configured) {
        // Only show masked values, don't expose actual keys
        setSettings(prev => ({
          ...prev,
          is_sandbox: res.data.is_sandbox,
          is_active: res.data.is_active
        }));
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchWebhookUrl = async () => {
    try {
      const res = await axios.get(`${API}/payments/webhook-url`);
      setWebhookUrl(res.data.webhook_url);
    } catch (err) {
      console.error("Error fetching webhook URL:", err);
    }
  };

  const handleSave = async () => {
    if (!settings.app_id || !settings.secret_key) {
      alert("Please enter App ID and Secret Key");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/payments/settings`, settings);
      alert("Settings saved successfully!");
      onSaved?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save settings");
    }
    setLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await axios.post(`${API}/payments/settings/test`);
      if (res.data.success) {
        alert(`Connection successful! Environment: ${res.data.environment}`);
      } else {
        alert(`Connection failed: ${res.data.message}`);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Connection test failed");
    }
    setTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-purple-500 to-indigo-500 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Cashfree Payment Settings
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Cashfree Dashboard</h4>
            <p className="text-sm text-blue-600">
              Get your API keys from{" "}
              <a 
                href="https://merchant.cashfree.com/merchant/pg/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Cashfree Merchant Dashboard
              </a>
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">App ID *</label>
            <input
              type="text"
              value={settings.app_id}
              onChange={(e) => setSettings({...settings, app_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Your Cashfree App ID"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Secret Key *</label>
            <input
              type="password"
              value={settings.secret_key}
              onChange={(e) => setSettings({...settings, secret_key: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Your Cashfree Secret Key"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Webhook Secret (Optional)</label>
            <input
              type="text"
              value={settings.webhook_secret}
              onChange={(e) => setSettings({...settings, webhook_secret: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
              placeholder="Webhook signature verification secret"
            />
          </div>

          {/* Webhook URL Info */}
          {webhookUrl && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Webhook URL (Add in Cashfree Dashboard)</p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={webhookUrl} 
                  readOnly 
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-600"
                />
                <button 
                  onClick={() => copyToClipboard(webhookUrl, () => alert("Copied!"))}
                  className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.is_sandbox}
                onChange={(e) => setSettings({...settings, is_sandbox: e.target.checked})}
                className="w-5 h-5 text-purple-600 rounded"
              />
              <span className="text-sm text-gray-700">Sandbox / Test Mode</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.is_active}
                onChange={(e) => setSettings({...settings, is_active: e.target.checked})}
                className="w-5 h-5 text-green-600 rounded"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              {testing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}
              Test Connection
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-3 rounded-xl font-bold hover:from-purple-600 hover:to-indigo-600 transition flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ==================== TRANSACTION ROW ====================
const TransactionRow = memo(({ payment, onRefresh, onResend, isSelected, onToggleSelect, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const statusConfig = PAYMENT_STATUSES[payment.status] || PAYMENT_STATUSES.pending;
  const sourceConfig = PAYMENT_SOURCES[payment.source] || PAYMENT_SOURCES.manual;
  const StatusIcon = statusConfig.icon;

  const handleCopy = () => {
    if (payment.payment_link) {
      copyToClipboard(payment.payment_link, () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
    }
  };

  const handleResend = async () => {
    try {
      await axios.post(`${API}/payments/link/${payment.link_id}/resend`);
      alert("Link resent via WhatsApp!");
      onRefresh?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to resend link");
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this payment link?")) return;
    try {
      await axios.post(`${API}/payments/link/${payment.link_id}/cancel`);
      alert("Link cancelled");
      onRefresh?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to cancel link");
    }
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden mb-3 hover:shadow-md transition ${isSelected ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
      {/* Main Row */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Checkbox + Main Info */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 mt-1 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
            />
            <div className={`p-2 rounded-lg ${sourceConfig.color} text-white`}>
              <sourceConfig.icon className="w-5 h-5" />
            </div>
            <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
              <p className="font-semibold text-gray-800">{payment.customer_name}</p>
              <p className="text-sm text-gray-500">{payment.customer_phone}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDateTime(payment.created_at)}</p>
              {payment.is_verified ? (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✔ Verified by Cashfree
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                  ⚠ Unverified
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-800">{formatCurrency(payment.amount)}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition"
                title="Delete Transaction"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronDown 
                className={`w-5 h-5 text-gray-400 transition-transform cursor-pointer ${expanded ? 'rotate-180' : ''}`} 
                onClick={() => setExpanded(!expanded)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <div className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-500">Order ID</p>
              <p className="font-mono text-gray-700">{payment.order_id || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Link ID</p>
              <p className="font-mono text-gray-700">{payment.link_id || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Purpose</p>
              <p className="text-gray-700">{payment.purpose || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Expiry</p>
              <p className="text-gray-700">{payment.expiry_time ? formatDateTime(payment.expiry_time) : "-"}</p>
            </div>
            {payment.paid_at && (
              <div>
                <p className="text-gray-500">Paid At</p>
                <p className="text-green-600 font-medium">{formatDateTime(payment.paid_at)}</p>
              </div>
            )}
            {payment.notes && (
              <div className="sm:col-span-2">
                <p className="text-gray-500">Notes</p>
                <p className="text-gray-700">{payment.notes}</p>
              </div>
            )}
          </div>

          {/* Payment Link */}
          {payment.payment_link && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Payment Link</p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={payment.payment_link} 
                  readOnly 
                  className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs font-mono text-gray-600"
                />
                <button 
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${copySuccess ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
                <a 
                  href={payment.payment_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-gray-200 rounded text-xs font-medium hover:bg-gray-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* Actions */}
          {payment.status !== "paid" && payment.status !== "cancelled" && (
            <div className="flex flex-wrap gap-2">
              {payment.payment_link && (
                <button 
                  onClick={handleResend}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                >
                  <MessageSquare className="w-4 h-4" />
                  Resend WhatsApp
                </button>
              )}
              <button 
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                <Ban className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ==================== MAIN PAYMENTS DASHBOARD ====================
export const PaymentsDashboard = ({ leads = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 });
  const [filters, setFilters] = useState({ status: "", source: "", search: "", from_date: "", to_date: "", include_unverified: false });
  const [revenueChart, setRevenueChart] = useState({ points: [], total_revenue: 0, period: "daily" });
  
  // Delete functionality
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/payments/dashboard/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching payment stats:", err);
    }
  }, []);

  const fetchRevenueChart = useCallback(async (period = "daily", days = 30) => {
    try {
      const res = await axios.get(`${API}/payments/revenue/chart?period=${period}&days=${days}`);
      setRevenueChart(res.data);
    } catch (err) {
      console.error("Error fetching revenue chart:", err);
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.source) params.append("source", filters.source);
    if (filters.search) params.append("search", filters.search);
    if (filters.from_date) params.append("from_date", filters.from_date);
    if (filters.to_date) params.append("to_date", filters.to_date);
    window.open(`${API}/payments/transactions/export.csv?${params}`, "_blank");
  }, [filters]);

  useEffect(() => { fetchRevenueChart("daily", 30); }, [fetchRevenueChart]);

  const fetchTransactions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", 20);
      if (filters.status) params.append("status", filters.status);
      if (filters.source) params.append("source", filters.source);
      if (filters.search) params.append("search", filters.search);
      if (filters.from_date) params.append("from_date", filters.from_date);
      if (filters.to_date) params.append("to_date", filters.to_date);
      if (filters.include_unverified) params.append("include_unverified", "true");

      const res = await axios.get(`${API}/payments/transactions?${params}`);
      setTransactions(res.data.transactions || []);
      setPagination({
        page: res.data.page,
        total: res.data.total,
        total_pages: res.data.total_pages
      });
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchStats();
    fetchTransactions();
  }, [fetchStats, fetchTransactions]);

  // Toggle single transaction selection
  const toggleTransactionSelect = (orderId) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Toggle all transactions selection
  const toggleAllTransactions = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.order_id)));
    }
  };

  // Delete single transaction
  const handleDeleteTransaction = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/cashfree/orders/${orderId}`);
      fetchTransactions(pagination.page);
      fetchStats();
      alert("Transaction deleted successfully");
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.response?.data?.detail || "Failed to delete transaction");
    }
    setDeleteLoading(false);
  };

  // Bulk delete transactions
  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) {
      alert("No transactions selected");
      return;
    }
    
    setDeleteLoading(true);
    try {
      const orderIds = Array.from(selectedTransactions);
      await axios.post(`${API}/cashfree/orders/bulk-delete`, { order_ids: orderIds });
      setSelectedTransactions(new Set());
      setShowDeleteConfirm(false);
      fetchTransactions(pagination.page);
      fetchStats();
      alert(`Successfully deleted ${orderIds.length} transactions`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete transactions");
    }
    setDeleteLoading(false);
  };

  // Targeted cleanup of obvious garbage transactions: tiny ₹1-style test
  // payments, script-injected names, and stale never-paid orders. Always
  // dry-runs first so the admin sees what will be removed.
  const handleCleanupTestData = async () => {
    // In production the backend requires `x-admin-token` matching the
    // ADMIN_API_TOKEN env var. We pull it from localStorage so the admin can
    // paste it once via devtools without baking a secret into the JS bundle.
    // In dev (no token configured server-side) the call works without it.
    const adminToken = (localStorage.getItem("asrAdminApiToken") || "").trim();
    const headers = adminToken ? { "x-admin-token": adminToken } : {};
    setDeleteLoading(true);
    try {
      const dry = await axios.post(
        `${API}/cashfree/orders/cleanup-test-data`, null, { headers }
      );
      const n = dry.data?.would_delete_count || 0;
      if (!n) {
        alert("No test/fake transactions found. Nothing to clean up.");
        return;
      }
      const sample = (dry.data?.sample || [])
        .slice(0, 5)
        .map(s => `• ${s.order_id} — ₹${s.amount} — ${s.status} — ${s.name || "(no name)"}`)
        .join("\n");
      const ok = window.confirm(
        `Found ${n} suspicious transactions to soft-delete:\n\n${sample}\n\n` +
        `Verified-paid orders are NOT touched. Proceed?`
      );
      if (!ok) return;
      const res = await axios.post(
        `${API}/cashfree/orders/cleanup-test-data?confirm=true`, null, { headers }
      );
      alert(`Cleaned up ${res.data?.deleted_count || 0} transactions.`);
      fetchTransactions(pagination.page);
      fetchStats();
    } catch (err) {
      const detail = err.response?.data?.detail || "Cleanup failed";
      const hint = err.response?.status === 401
        ? "\n\nIn production set ADMIN_API_TOKEN on the deployment, then run in devtools:\n  localStorage.setItem('asrAdminApiToken','<your-token>')"
        : "";
      alert(detail + hint);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateForLead = (lead) => {
    setSelectedLead(lead);
    setShowCreateModal(true);
  };

  const subTabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "transactions", label: "Transactions", icon: FileText },
    { id: "pending", label: "Pending", icon: Clock },
    { id: "paid", label: "Collected", icon: CheckCircle }
  ];

  return (
    <div className="space-y-6" data-testid="payments-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-green-600" />
            Cashfree Payments
          </h2>
          <p className="text-gray-500 text-sm mt-1">Create payment links, track transactions, and collect payments</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
            data-testid="manual-payment-btn"
          >
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Manual Payment</span>
          </button>
          <button
            onClick={() => { setSelectedLead(null); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            data-testid="create-payment-link-btn"
          >
            <Plus className="w-4 h-4" />
            Create Link
          </button>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSubTab(tab.id);
              if (tab.id === "pending") setFilters({ ...filters, status: "link_sent" });
              else if (tab.id === "paid") setFilters({ ...filters, status: "paid" });
              else setFilters({ ...filters, status: "" });
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
              activeSubTab === tab.id
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Overview */}
      {(activeSubTab === "overview" || activeSubTab === "transactions") && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Collected"
            value={formatCurrency(stats.overview?.total_collected || 0)}
            subtext={`${stats.overview?.total_paid_count || 0} payments`}
            icon={DollarSign}
            color="from-green-500 to-emerald-600"
          />
          <StatsCard
            title="Today's Collection"
            value={formatCurrency(stats.today?.amount_collected || 0)}
            subtext={`${stats.today?.success_count || 0} payments`}
            icon={TrendingUp}
            color="from-blue-500 to-cyan-600"
          />
          <StatsCard
            title="Pending Links"
            value={stats.overview?.pending_links || 0}
            subtext={formatCurrency(stats.overview?.total_amount_requested - stats.overview?.total_collected || 0)}
            icon={Clock}
            color="from-amber-500 to-orange-600"
          />
          <StatsCard
            title="This Month"
            value={formatCurrency(stats.this_month?.amount_collected || 0)}
            subtext={`${stats.this_month?.success_count || 0} payments`}
            icon={Calendar}
            color="from-purple-500 to-pink-600"
          />
        </div>
      )}

      {/* Revenue Chart */}
      {revenueChart.points && revenueChart.points.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-800">Revenue Trend</h3>
              <span className="text-xs text-gray-500">
                Last {revenueChart.days || 30}d • Total {formatCurrency(revenueChart.total_revenue)}
              </span>
            </div>
            <select
              value={revenueChart.period}
              onChange={(e) => fetchRevenueChart(e.target.value, e.target.value === "monthly" ? 365 : (e.target.value === "weekly" ? 90 : 30))}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="daily">Daily (30d)</option>
              <option value="weekly">Weekly (90d)</option>
              <option value="monthly">Monthly (1y)</option>
            </select>
          </div>
          <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2">
            {(() => {
              const max = Math.max(...revenueChart.points.map(p => p.revenue), 1);
              return revenueChart.points.map((p, i) => (
                <div key={i} className="flex flex-col items-center min-w-[28px] flex-1" title={`${p.label}: ${formatCurrency(p.revenue)} (${p.count} payments)`}>
                  <div className="text-[9px] text-gray-500 mb-0.5">{p.revenue >= 1000 ? `${Math.round(p.revenue/1000)}k` : Math.round(p.revenue)}</div>
                  <div
                    className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t hover:from-green-600 hover:to-green-500 transition cursor-pointer"
                    style={{ height: `${Math.max((p.revenue / max) * 100, 2)}%`, minHeight: "4px" }}
                  />
                  <div className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">{p.label.slice(-5)}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              onKeyPress={(e) => e.key === 'Enter' && fetchTransactions(1)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Search by name, phone, order ID..."
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Statuses</option>
            {Object.entries(PAYMENT_STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button
            onClick={() => setFilters(f => ({ ...f, include_unverified: !f.include_unverified }))}
            title="Show unverified/test payments — for admin debugging only. Default: OFF."
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium transition ${
              filters.include_unverified
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-emerald-50 text-emerald-700 border-emerald-400"
            }`}
          >
            {filters.include_unverified ? "⚠ Showing All (Debug)" : "✔ Verified Only"}
          </button>
          <select
            value={filters.source}
            onChange={(e) => setFilters({...filters, source: e.target.value})}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Sources</option>
            {Object.entries(PAYMENT_SOURCES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters({...filters, from_date: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            title="From date"
          />
          <input
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters({...filters, to_date: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            title="To date"
          />
          <button
            onClick={() => fetchTransactions(1)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            title="Download all matching transactions as CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleCleanupTestData}
            disabled={deleteLoading}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50"
            title="Remove ₹1 test entries, script-injected names, and stale unpaid orders. Verified payments are never touched."
          >
            <Trash2 className="w-4 h-4" />
            Cleanup Test Data
          </button>
        </div>
        
        {/* Bulk Actions Bar - Only show when transactions exist */}
        {transactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTransactions.size === transactions.length && transactions.length > 0}
                  onChange={toggleAllTransactions}
                  className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                />
                <span className="text-sm text-gray-600">Select All</span>
              </label>
              {selectedTransactions.size > 0 && (
                <span className="text-sm text-blue-600 font-medium">
                  {selectedTransactions.size} selected
                </span>
              )}
            </div>
            
            {selectedTransactions.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                data-testid="bulk-delete-btn"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedTransactions.size})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Transactions?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete {selectedTransactions.size} transaction(s)? 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Transactions Found</h3>
            <p className="text-gray-500 mb-4">Create your first payment link to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Create Payment Link
            </button>
          </div>
        ) : (
          <>
            {transactions.map(payment => (
              <TransactionRow
                key={payment.id}
                payment={payment}
                onRefresh={() => { fetchStats(); fetchTransactions(pagination.page); }}
                isSelected={selectedTransactions.has(payment.order_id)}
                onToggleSelect={() => toggleTransactionSelect(payment.order_id)}
                onDelete={() => handleDeleteTransaction(payment.order_id)}
              />
            ))}

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-500">
                  Showing {transactions.length} of {pagination.total} transactions
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchTransactions(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <button
                    onClick={() => fetchTransactions(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                    className="px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Support Info */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">Customer Support</p>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1 text-gray-800 font-medium">
                <Phone className="w-4 h-4 text-green-600" />
                {ASR_SUPPORT_PHONE}
              </span>
              <span className="flex items-center gap-1 text-gray-800 font-medium">
                <Mail className="w-4 h-4 text-blue-600" />
                {ASR_SUPPORT_EMAIL}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Powered by</p>
            <p className="font-bold text-purple-700">Cashfree Payments</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreatePaymentLinkModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setSelectedLead(null); }}
        onCreated={() => { fetchStats(); fetchTransactions(1); }}
        selectedLead={selectedLead}
      />

      <ManualPaymentModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onRecorded={() => { fetchStats(); fetchTransactions(1); }}
        leads={leads}
      />

      <PaymentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSaved={() => fetchStats()}
      />
    </div>
  );
};

export default PaymentsDashboard;
