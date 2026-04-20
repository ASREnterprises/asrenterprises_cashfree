import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Search, Phone, Mail, MapPin, Star, Trash2, Edit, X, Save, Plus, 
  Upload, RefreshCw, UserPlus, FileSpreadsheet, FileText, CheckCircle, AlertCircle, 
  Loader2, Eye, Filter, ChevronDown, ChevronUp, Calendar, Clock, MessageSquare,
  Users, TrendingUp, Flame, Snowflake, ThermometerSun, Zap, History, 
  MoreVertical, Download, Archive, RotateCcw, AlertTriangle, ExternalLink,
  Table, LayoutGrid, Settings, Bell, Target, Building2, Home, Factory,
  CreditCard, IndianRupee, Send, Copy, Wallet, Link as LinkIcon
} from "lucide-react";
import axios from "axios";
import { useAutoLogout } from "@/hooks/useAutoLogout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== PHONE CALL INTEGRATION ====================
// Standard phone call (using tel: link)
const initiatePhoneCall = (phoneNumber, leadId, leadName) => {
  const cleanPhone = phoneNumber?.replace(/\D/g, '').replace(/^91/, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    alert("Invalid phone number");
    return;
  }
  
  // Log call attempt
  axios.post(`${API}/crm/log-call-attempt`, {
    lead_id: leadId,
    phone: cleanPhone,
    lead_name: leadName,
    call_type: "phone",
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Failed to log call:", err));
  
  // Use standard tel: link
  window.location.href = `tel:${cleanPhone}`;
};

// ==================== CONSTANTS ====================

// Payment Types for Cashfree Orders
const PAYMENT_TYPES = {
  advance: "Advance Payment",
  site_visit: "Site Visit Payment",
  booking: "Booking Token Amount",
  consultation: "Consultation Fee",
  installation: "Installation Payment",
  custom: "Custom Payment"
};

const BIHAR_DISTRICTS = [
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
  "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
  "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
  "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
  "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
  "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
];

const LEAD_SOURCES = [
  { id: "website", label: "Website", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-100" },
  { id: "whatsapp", label: "WhatsApp", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-100" },
  { id: "facebook", label: "Facebook", color: "bg-indigo-500", textColor: "text-indigo-700", bgLight: "bg-indigo-100" },
  { id: "instagram", label: "Instagram", color: "bg-pink-500", textColor: "text-pink-700", bgLight: "bg-pink-100" },
  { id: "manual", label: "Manual Entry", color: "bg-gray-500", textColor: "text-gray-700", bgLight: "bg-gray-100" },
  { id: "csv_import", label: "CSV Import", color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-100" },
  { id: "old_database", label: "Old Database", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-100" },
  { id: "referral", label: "Referral", color: "bg-teal-500", textColor: "text-teal-700", bgLight: "bg-teal-100" },
  { id: "walk_in", label: "Walk-in", color: "bg-purple-500", textColor: "text-purple-700", bgLight: "bg-purple-100" },
  { id: "call", label: "Phone Call", color: "bg-cyan-500", textColor: "text-cyan-700", bgLight: "bg-cyan-100" },
  { id: "other", label: "Other", color: "bg-slate-500", textColor: "text-slate-700", bgLight: "bg-slate-100" },
];

const SOLAR_STAGES = [
  { id: "new", label: "New Lead", color: "bg-blue-500", icon: Zap },
  { id: "contacted", label: "Contacted", color: "bg-yellow-500", icon: Phone },
  { id: "interested", label: "Interested", color: "bg-lime-500", icon: Star },
  { id: "documents_pending", label: "Documents Pending", color: "bg-orange-500", icon: FileText },
  { id: "site_visit", label: "Site Survey", color: "bg-cyan-500", icon: MapPin },
  { id: "quotation", label: "Quotation Sent", color: "bg-purple-500", icon: FileSpreadsheet },
  { id: "subsidy_explained", label: "Subsidy Explained", color: "bg-amber-500", icon: TrendingUp },
  { id: "negotiation", label: "Negotiation", color: "bg-pink-500", icon: MessageSquare },
  { id: "converted", label: "Converted", color: "bg-emerald-500", icon: CheckCircle },
  { id: "installation_scheduled", label: "Installation Scheduled", color: "bg-teal-500", icon: Calendar },
  { id: "completed", label: "Completed", color: "bg-green-600", icon: CheckCircle },
  { id: "lost", label: "Lost", color: "bg-red-500", icon: X },
];

const LEAD_PRIORITIES = [
  { id: "hot", label: "Hot", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-100", icon: Flame },
  { id: "warm", label: "Warm", color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-100", icon: ThermometerSun },
  { id: "cold", label: "Cold", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-100", icon: Snowflake },
  { id: "low_quality", label: "Low Quality", color: "bg-gray-500", textColor: "text-gray-700", bgLight: "bg-gray-100", icon: AlertTriangle },
];

const PROPERTY_TYPES = [
  { id: "residential", label: "Residential", icon: Home },
  { id: "commercial", label: "Commercial", icon: Building2 },
  { id: "industrial", label: "Industrial", icon: Factory },
  { id: "agricultural", label: "Agricultural", icon: MapPin },
];

const QUICK_FILTERS = [
  { id: "fresh", label: "Fresh Leads", color: "from-green-500 to-emerald-500" },
  { id: "today", label: "Today's Leads", color: "from-blue-500 to-cyan-500" },
  { id: "follow_up_due", label: "Follow-up Due", color: "from-orange-500 to-amber-500" },
  { id: "unassigned", label: "Unassigned", color: "from-purple-500 to-pink-500" },
  { id: "hot_leads", label: "Hot Leads", color: "from-red-500 to-rose-500" },
  { id: "converted", label: "Converted", color: "from-emerald-500 to-green-600" },
  { id: "lost", label: "Lost", color: "from-gray-500 to-slate-600" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest First" },
  { id: "oldest", label: "Oldest First" },
  { id: "fresh_first", label: "Fresh Leads First" },
  { id: "hot_first", label: "Hot Leads First" },
  { id: "follow_up_due", label: "Follow-up Due First" },
  { id: "uncontacted_first", label: "Uncontacted First" },
  { id: "recently_updated", label: "Recently Updated" },
  { id: "name_asc", label: "Name A-Z" },
  { id: "name_desc", label: "Name Z-A" },
];

// ==================== HELPER FUNCTIONS ====================

const getSourceConfig = (source) => {
  return LEAD_SOURCES.find(s => s.id === source) || LEAD_SOURCES.find(s => s.id === "other");
};

const getStageConfig = (stage) => {
  return SOLAR_STAGES.find(s => s.id === stage) || SOLAR_STAGES[0];
};

const getPriorityConfig = (priority) => {
  return LEAD_PRIORITIES.find(p => p.id === priority) || LEAD_PRIORITIES[2]; // Default to cold
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const isLeadFresh = (lead) => {
  if (!lead.timestamp) return false;
  const createdAt = new Date(lead.timestamp);
  const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreated <= 48 && (lead.is_new || lead.stage === 'new');
};

const isFollowUpDue = (lead) => {
  if (!lead.next_follow_up) return false;
  const followUpDate = new Date(lead.next_follow_up);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return followUpDate <= today;
};

const isFollowUpOverdue = (lead) => {
  if (!lead.next_follow_up) return false;
  const followUpDate = new Date(lead.next_follow_up);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  return followUpDate < yesterday;
};

// ==================== MAIN COMPONENT ====================

export const ProfessionalLeadsManagement = () => {
  const navigate = useNavigate();
  
  // Auth
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  useAutoLogout(isAuthenticated, () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminEmail");
    localStorage.removeItem("asrAdminRole");
  }, 'admin');

  // State
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [staffList, setStaffList] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [filterPropertyType, setFilterPropertyType] = useState("");
  const [filterDateRange, setFilterDateRange] = useState({ start: "", end: "" });
  const [quickFilter, setQuickFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0, fresh: 0, today: 0, follow_up_due: 0, hot: 0, converted: 0, lost: 0, unassigned: 0
  });
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Bulk Import State
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [bulkImportMode, setBulkImportMode] = useState('file');
  const [bulkPasteText, setBulkPasteText] = useState('');
  const bulkFileInputRef = useRef(null);

  // Smart Import State
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [smartImportStep, setSmartImportStep] = useState('upload');
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [smartImportResult, setSmartImportResult] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [smartImporting, setSmartImporting] = useState(false);
  const [selectedSmartFile, setSelectedSmartFile] = useState(null);
  const smartFileInputRef = useRef(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showBulkActionsMenu, setShowBulkActionsMenu] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  
  // WhatsApp API state
  const [waTemplates, setWaTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [waMessage, setWaMessage] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [skipAlreadyMessaged, setSkipAlreadyMessaged] = useState(true);

  // Trash view state
  const [showTrashView, setShowTrashView] = useState(false);
  const [trashedLeads, setTrashedLeads] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  
  // Payment state
  const [paymentData, setPaymentData] = useState({
    amount: "",
    purpose: "Solar Service Payment",
    send_via_whatsapp: true,
    expiry_minutes: 1440
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [leadPayments, setLeadPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  
  // Forms
  const [newLead, setNewLead] = useState({
    name: "", phone: "", alternate_phone: "", email: "", district: "Patna", address: "",
    property_type: "residential", roof_type: "rcc", monthly_bill: "", required_capacity: "",
    source: "manual", priority: "warm", notes: ""
  });
  const [followUpData, setFollowUpData] = useState({
    date: "", time: "10:00", type: "call", notes: ""
  });
  
  // Loading states
  const [saving, setSaving] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // ==================== DATA FETCHING ====================

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(filterSource && { source: filterSource }),
        ...(filterStage && { stage: filterStage }),
        ...(filterPriority && { priority: filterPriority }),
        ...(filterAssignedTo && { assigned_to: filterAssignedTo }),
        ...(filterDistrict && { district: filterDistrict }),
        ...(filterPropertyType && { property_type: filterPropertyType }),
        ...(searchTerm && { search: searchTerm }),
        ...(sortBy && { sort: sortBy }),
        ...(quickFilter && { quick_filter: quickFilter }),
      });
      
      const res = await axios.get(`${API}/crm/leads/advanced?${params}`);
      const data = res.data;
      
      setLeads(data.leads || []);
      setFilteredLeads(data.leads || []);
      setTotalPages(data.pagination?.total_pages || 1);
      setTotalLeads(data.pagination?.total_count || 0);
      setCurrentPage(page);
      
      // Update stats
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
      // Fallback to basic endpoint
      try {
        const res = await axios.get(`${API}/crm/leads?limit=${pageSize}&page=${page}`);
        const leadsData = Array.isArray(res.data) ? res.data : (res.data.leads || []);
        setLeads(leadsData);
        setFilteredLeads(leadsData);
        setTotalLeads(leadsData.length);
      } catch (e) {
        setLeads([]);
        setFilteredLeads([]);
      }
    }
    setLoading(false);
  }, [pageSize, filterSource, filterStage, filterPriority, filterAssignedTo, filterDistrict, filterPropertyType, searchTerm, sortBy, quickFilter]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/staff-accounts`);
      setStaffList(res.data || []);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/crm/leads/stats`);
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      // Calculate stats locally from leads
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      setStats({
        total: leads.length,
        fresh: leads.filter(l => isLeadFresh(l)).length,
        today: leads.filter(l => new Date(l.timestamp) >= todayStart).length,
        follow_up_due: leads.filter(l => isFollowUpDue(l)).length,
        hot: leads.filter(l => l.priority === 'hot').length,
        converted: leads.filter(l => l.stage === 'converted' || l.stage === 'completed').length,
        lost: leads.filter(l => l.stage === 'lost').length,
        unassigned: leads.filter(l => !l.assigned_to).length
      });
    }
  }, [leads]);

  const fetchWhatsAppTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/templates`);
      setWaTemplates(res.data.templates || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  }, []);

  const syncAndFetchTemplates = useCallback(async () => {
    try {
      await axios.post(`${API}/whatsapp/templates/sync`);
      const res = await axios.get(`${API}/whatsapp/templates`);
      setWaTemplates(res.data.templates || []);
    } catch (err) {
      console.error("Template sync error:", err);
    }
  }, []);

  const fetchTrashedLeads = useCallback(async () => {
    setTrashLoading(true);
    try {
      const res = await axios.get(`${API}/crm/leads/trash`);
      setTrashedLeads(res.data.leads || []);
    } catch (err) {
      console.error("Error fetching trash:", err);
    }
    setTrashLoading(false);
  }, []);

  const sendWhatsAppMessage = async () => {
    if (!selectedLead) return;
    setWaSending(true);
    try {
      if (selectedTemplate) {
        // Send template message via API
        const res = await axios.post(`${API}/whatsapp/send-template`, {
          phone: selectedLead.phone,
          template_name: selectedTemplate.name,
          lead_id: selectedLead.id
        });
        if (res.data.success) {
          alert("WhatsApp template sent successfully!");
          setShowWhatsAppModal(false);
          setSelectedTemplate(null);
        } else {
          alert("Error sending template: " + (res.data.error || "Unknown error"));
        }
      } else if (waMessage.trim()) {
        // Send custom message via API
        const res = await axios.post(`${API}/whatsapp/send-message`, {
          phone: selectedLead.phone,
          message: waMessage,
          lead_id: selectedLead.id
        });
        if (res.data.success) {
          alert("WhatsApp message sent successfully!");
          setShowWhatsAppModal(false);
          setWaMessage("");
        } else {
          alert("Error sending message: " + (res.data.error || "Unknown error"));
        }
      }
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
    setWaSending(false);
  };

  const openWhatsAppModal = (lead) => {
    setSelectedLead(lead);
    setShowWhatsAppModal(true);
    setSelectedTemplate(null);
    setWaMessage("");
    fetchWhatsAppTemplates();
  };

  // ==================== PAYMENT FUNCTIONS ====================
  
  const openPaymentModal = (lead) => {
    setSelectedLead(lead);
    setShowPaymentModal(true);
    setPaymentData({
      amount: "",
      purpose: "Solar Service Payment",
      payment_type: "custom",
      send_via_whatsapp: true,
      expiry_minutes: 1440
    });
    setPaymentResult(null);
    fetchLeadPayments(lead.id);
  };

  const fetchLeadPayments = async (leadId) => {
    setPaymentsLoading(true);
    try {
      // Use new Cashfree Orders API endpoint
      const res = await axios.get(`${API}/cashfree/lead/${leadId}/orders`);
      setLeadPayments(res.data.orders || []);
    } catch (err) {
      console.error("Error fetching lead payments:", err);
      setLeadPayments([]);
    }
    setPaymentsLoading(false);
  };

  const createPaymentLink = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setPaymentLoading(true);
    try {
      // Use new Cashfree Orders API (Hosted Checkout) instead of Payment Links
      const res = await axios.post(`${API}/cashfree/create-order`, {
        lead_id: selectedLead.id,
        customer_name: selectedLead.name || "Customer",
        customer_phone: selectedLead.phone,
        customer_email: selectedLead.email || "",
        amount: parseFloat(paymentData.amount),
        payment_type: paymentData.payment_type || "custom",
        purpose: paymentData.purpose,
        send_via_whatsapp: paymentData.send_via_whatsapp
      });

      if (res.data.success) {
        setPaymentResult({
          ...res.data,
          payment_link: res.data.payment_url  // Map payment_url to payment_link for UI
        });
        // Refresh lead payments
        fetchLeadPayments(selectedLead.id);
        // Update lead to reflect payment sent
        handleUpdateLead(selectedLead.id, { last_payment_link_sent: new Date().toISOString() });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "";
      // Handle any Cashfree API errors gracefully
      if (errorMsg.toLowerCase().includes("not enabled") ||
          errorMsg.toLowerCase().includes("not approved") ||
          errorMsg.toLowerCase().includes("not configured")) {
        setPaymentResult({
          success: false,
          error: true,
          message: "Payment system temporarily unavailable. Please contact support.",
          activation_pending: true
        });
      } else {
        alert(errorMsg || "Failed to create payment order. Please try again.");
      }
    }
    setPaymentLoading(false);
  };

  const resendPaymentLink = async (orderId) => {
    try {
      // Use new Cashfree Orders API endpoint
      await axios.post(`${API}/cashfree/order/${orderId}/resend-whatsapp`);
      alert("Payment link resent via WhatsApp!");
      fetchLeadPayments(selectedLead.id);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to resend payment link");
    }
  };

  const copyPaymentLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      alert("Payment link copied to clipboard!");
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert("Payment link copied!");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      link_created: { bg: "bg-blue-100", text: "text-blue-700", label: "Link Created" },
      link_sent: { bg: "bg-purple-100", text: "text-purple-700", label: "Link Sent" },
      pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
      paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
      failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
      expired: { bg: "bg-gray-100", text: "text-gray-600", label: "Expired" },
      cancelled: { bg: "bg-gray-100", text: "text-gray-500", label: "Cancelled" }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>{config.label}</span>;
  };

  useEffect(() => {
    fetchLeads(1);
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [leads, fetchStats]);

  // Re-fetch when filters change
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchLeads(1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [filterSource, filterStage, filterPriority, filterAssignedTo, filterDistrict, filterPropertyType, sortBy, quickFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchLeads(1);
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  // ==================== LOCAL FILTERING ====================

  useEffect(() => {
    let result = [...leads];
    
    // Apply quick filter locally
    if (quickFilter === 'fresh') {
      result = result.filter(l => isLeadFresh(l));
    } else if (quickFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      result = result.filter(l => new Date(l.timestamp) >= todayStart);
    } else if (quickFilter === 'follow_up_due') {
      result = result.filter(l => isFollowUpDue(l));
    } else if (quickFilter === 'unassigned') {
      result = result.filter(l => !l.assigned_to);
    } else if (quickFilter === 'hot_leads') {
      result = result.filter(l => l.priority === 'hot');
    } else if (quickFilter === 'converted') {
      result = result.filter(l => l.stage === 'converted' || l.stage === 'completed');
    } else if (quickFilter === 'lost') {
      result = result.filter(l => l.stage === 'lost');
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.timestamp) - new Date(a.timestamp);
        case 'oldest': return new Date(a.timestamp) - new Date(b.timestamp);
        case 'fresh_first': return (isLeadFresh(b) ? 1 : 0) - (isLeadFresh(a) ? 1 : 0);
        case 'hot_first': return (b.priority === 'hot' ? 1 : 0) - (a.priority === 'hot' ? 1 : 0);
        case 'follow_up_due': return (isFollowUpDue(b) ? 1 : 0) - (isFollowUpDue(a) ? 1 : 0);
        case 'name_asc': return (a.name || '').localeCompare(b.name || '');
        case 'name_desc': return (b.name || '').localeCompare(a.name || '');
        default: return 0;
      }
    });
    
    setFilteredLeads(result);
  }, [leads, quickFilter, sortBy]);

  // ==================== ACTIONS ====================

  const handleAddLead = async (e) => {
    e.preventDefault();
    if (!newLead.name || !newLead.phone) {
      alert("Name and Phone are required");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/crm/leads`, newLead);
      setShowAddModal(false);
      setNewLead({
        name: "", phone: "", alternate_phone: "", email: "", district: "Patna", address: "",
        property_type: "residential", roof_type: "rcc", monthly_bill: "", required_capacity: "",
        source: "manual", priority: "warm", notes: ""
      });
      fetchLeads(currentPage);
      alert("Lead added successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Error adding lead");
    }
    setSaving(false);
  };

  const handleUpdateLead = async (leadId, updates) => {
    try {
      await axios.put(`${API}/crm/leads/${leadId}`, updates);
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error updating lead");
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm("Move this lead to trash? It will be permanently deleted after 30 days.")) return;
    try {
      await axios.post(`${API}/crm/leads/${leadId}/trash`);
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error deleting lead");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!window.confirm(`Move ${selectedLeadIds.length} leads to trash?`)) return;
    
    setBulkProcessing(true);
    try {
      await axios.post(`${API}/crm/leads/bulk-delete`, { lead_ids: selectedLeadIds });
      setSelectedLeadIds([]);
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error deleting leads");
    }
    setBulkProcessing(false);
  };

  const handleBulkAssign = async (staffId) => {
    if (selectedLeadIds.length === 0) return;
    
    setBulkProcessing(true);
    try {
      await axios.post(`${API}/crm/leads/bulk-assign`, { 
        lead_ids: selectedLeadIds, 
        staff_id: staffId 
      });
      setSelectedLeadIds([]);
      setShowAssignModal(false);
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error assigning leads");
    }
    setBulkProcessing(false);
  };

  const handleBulkStageChange = async (stage) => {
    if (selectedLeadIds.length === 0) return;
    
    setBulkProcessing(true);
    try {
      await axios.post(`${API}/crm/leads/bulk-update`, { 
        lead_ids: selectedLeadIds, 
        updates: { stage } 
      });
      setSelectedLeadIds([]);
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error updating leads");
    }
    setBulkProcessing(false);
  };

  const handleBulkPriorityChange = async (priority) => {
    if (selectedLeadIds.length === 0) return;
    
    setBulkProcessing(true);
    try {
      await axios.post(`${API}/crm/leads/bulk-update`, { 
        lead_ids: selectedLeadIds, 
        updates: { priority } 
      });
      setSelectedLeadIds([]);
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error updating leads");
    }
    setBulkProcessing(false);
  };

  const handleAddFollowUp = async () => {
    if (!selectedLead || !followUpData.date) return;
    
    setSaving(true);
    try {
      await axios.post(`${API}/crm/followups`, {
        lead_id: selectedLead.id,
        scheduled_date: followUpData.date,
        scheduled_time: followUpData.time,
        followup_type: followUpData.type,
        notes: followUpData.notes
      });
      setShowFollowUpModal(false);
      setFollowUpData({ date: "", time: "10:00", type: "call", notes: "" });
      fetchLeads(currentPage);
    } catch (err) {
      alert("Error adding follow-up");
    }
    setSaving(false);
  };

  const handleExportSelected = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Please select leads to export");
      return;
    }
    
    const selectedData = leads.filter(l => selectedLeadIds.includes(l.id));
    const csv = convertToCSV(selectedData);
    downloadCSV(csv, `leads_export_${Date.now()}.csv`);
  };

  const convertToCSV = (data) => {
    const headers = ["Name", "Phone", "Email", "District", "Source", "Stage", "Priority", "Assigned To", "Created Date"];
    const rows = data.map(lead => [
      lead.name || "",
      lead.phone || "",
      lead.email || "",
      lead.district || "",
      lead.source || "",
      lead.stage || "",
      lead.priority || "",
      lead.assigned_to_name || "",
      formatDate(lead.timestamp)
    ]);
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterSource("");
    setFilterStage("");
    setFilterPriority("");
    setFilterDistrict("");
    setFilterAssignedTo("");
    setFilterPropertyType("");
    setFilterDateRange({ start: "", end: "" });
    setQuickFilter("");
    setSortBy("newest");
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  // ==================== BULK / SMART IMPORT HANDLERS ====================
  const handleBulkImport = async () => {
    if (bulkImportMode === 'file') {
      if (!bulkImportFile) { alert("Please select a CSV or Excel file"); return; }
      setBulkImporting(true);
      try {
        const formData = new FormData();
        formData.append('file', bulkImportFile);
        const res = await axios.post(`${API}/crm/leads/bulk-import`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setBulkImportResult(res.data);
        fetchLeads(1);
      } catch (err) {
        alert(err.response?.data?.detail || "Import failed");
      }
      setBulkImporting(false);
    } else {
      if (!bulkPasteText.trim()) { alert("Please paste phone numbers"); return; }
      setBulkImporting(true);
      try {
        const res = await axios.post(`${API}/crm/leads/bulk-import-manual`, { phones: bulkPasteText });
        setBulkImportResult(res.data);
        fetchLeads(1);
      } catch (err) {
        alert(err.response?.data?.detail || "Import failed");
      }
      setBulkImporting(false);
    }
  };

  const closeBulkImportModal = () => {
    setShowBulkImportModal(false);
    setBulkImportFile(null);
    setBulkImportResult(null);
    setBulkPasteText('');
    setBulkImportMode('file');
  };

  const handleSmartFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedSmartFile(file);
    setExtracting(true);
    setExtractedLeads([]);
    setSmartImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API}/crm/leads/smart-import`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data.success && res.data.preview_data?.length > 0) {
        setExtractedLeads(res.data.preview_data.map((lead, idx) => ({ ...lead, _selected: true, _index: idx })));
        setSmartImportStep('preview');
      } else {
        alert("No leads found in the file. Please check the file format.");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error extracting data from file");
    }
    setExtracting(false);
  };

  const handleConfirmSmartImport = async () => {
    const selectedLeads = extractedLeads.filter(l => l._selected);
    if (selectedLeads.length === 0) { alert("Please select at least one lead"); return; }
    setSmartImporting(true);
    try {
      const res = await axios.post(`${API}/crm/leads/confirm-import`, {
        leads: selectedLeads.map(({ _selected, _index, ...lead }) => lead),
        lead_type: 'auto'
      });
      setSmartImportResult(res.data);
      setSmartImportStep('result');
      fetchLeads(1);
    } catch (err) {
      alert(err.response?.data?.detail || "Error importing leads");
    }
    setSmartImporting(false);
  };

  const closeSmartImportModal = () => {
    setSmartImportStep('upload');
    setExtractedLeads([]);
    setSmartImportResult(null);
    setSelectedSmartFile(null);
    if (smartFileInputRef.current) smartFileInputRef.current.value = '';
    setShowSmartImportModal(false);
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-lg transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Leads Management</h1>
                <p className="text-sm text-slate-500">{totalLeads.toLocaleString()} total leads</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* View Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition ${viewMode === 'table' ? 'bg-white shadow text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Table View"
                >
                  <Table className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded-md transition ${viewMode === 'card' ? 'bg-white shadow text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              
              <button
                onClick={() => fetchLeads(currentPage)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={() => setShowSmartImportModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition shadow-sm text-sm"
                data-testid="smart-import-btn"
                title="Smart Import - AI extracts leads from Excel, CSV, PDF, Image"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Smart Import</span>
              </button>
              <button
                onClick={() => setShowBulkImportModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-2 rounded-lg font-medium hover:from-orange-600 hover:to-orange-700 transition shadow-sm text-sm"
                data-testid="bulk-import-btn"
                title="Bulk Import - Upload CSV/Excel or paste phone numbers"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Import</span>
              </button>
              <button
                onClick={() => { setShowTrashView(true); fetchTrashedLeads(); }}
                className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-2 rounded-lg font-medium hover:bg-red-50 hover:text-red-600 transition border border-gray-200"
                title="View Trash"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Trash</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Lead</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
          {[
            { key: 'total', label: 'Total', value: stats.total, color: 'from-slate-500 to-slate-600', icon: Users },
            { key: 'fresh', label: 'Fresh', value: stats.fresh, color: 'from-green-500 to-emerald-600', icon: Zap },
            { key: 'today', label: 'Today', value: stats.today, color: 'from-blue-500 to-cyan-600', icon: Calendar },
            { key: 'follow_up_due', label: 'Follow-up Due', value: stats.follow_up_due, color: 'from-orange-500 to-amber-600', icon: Clock },
            { key: 'hot_leads', label: 'Hot', value: stats.hot, color: 'from-red-500 to-rose-600', icon: Flame },
            { key: 'unassigned', label: 'Unassigned', value: stats.unassigned, color: 'from-purple-500 to-pink-600', icon: UserPlus },
            { key: 'converted', label: 'Converted', value: stats.converted, color: 'from-emerald-500 to-green-600', icon: CheckCircle },
            { key: 'lost', label: 'Lost', value: stats.lost, color: 'from-gray-500 to-slate-600', icon: X },
          ].map((stat) => (
            <button
              key={stat.key}
              onClick={() => setQuickFilter(quickFilter === stat.key ? '' : stat.key)}
              className={`relative p-3 rounded-xl text-white shadow-sm transition transform hover:scale-105 hover:shadow-md ${
                quickFilter === stat.key ? 'ring-2 ring-offset-2 ring-blue-500' : ''
              } bg-gradient-to-br ${stat.color}`}
            >
              <stat.icon className="w-5 h-5 opacity-80 mb-1" />
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs opacity-80 truncate">{stat.label}</div>
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, phone, email, district, lead ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            
            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sources</option>
                {LEAD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Stages</option>
                {SOLAR_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Priorities</option>
                {LEAD_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-3 py-2.5 rounded-lg border transition ${
                  showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">More</span>
              </button>
              
              {(searchTerm || filterSource || filterStage || filterPriority || filterDistrict || filterAssignedTo || quickFilter) && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 px-2"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
          
          {/* Extended Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Districts</option>
                {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              
              <select
                value={filterPropertyType}
                onChange={(e) => setFilterPropertyType(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Property Types</option>
                {PROPERTY_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              
              <select
                value={filterAssignedTo}
                onChange={(e) => setFilterAssignedTo(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Staff</option>
                <option value="unassigned">Unassigned</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              
              <input
                type="date"
                value={filterDateRange.start}
                onChange={(e) => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="From Date"
              />
              
              <input
                type="date"
                value={filterDateRange.end}
                onChange={(e) => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="To Date"
              />
            </div>
          )}
        </div>

        {/* Bulk Actions Bar - Mobile Responsive */}
        {selectedLeadIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 sticky top-0 z-30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Selection Info */}
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="text-blue-700 font-medium text-sm sm:text-base">{selectedLeadIds.length} selected</span>
                <button onClick={() => setSelectedLeadIds([])} className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm">
                  Clear
                </button>
              </div>
              
              {/* Action Buttons - Scrollable on Mobile */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* WhatsApp Bulk - Primary on Mobile */}
                <button
                  onClick={() => { setShowBulkWhatsAppModal(true); fetchWhatsAppTemplates(); }}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-xs sm:text-sm hover:bg-green-600 transition font-medium"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Campaign</span>
                </button>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg text-xs sm:text-sm hover:bg-purple-600 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Assign</span>
                </button>
                <div className="relative group flex-shrink-0">
                  <button className="flex items-center gap-1 px-3 py-2 bg-cyan-500 text-white rounded-lg text-xs sm:text-sm hover:bg-cyan-600 transition">
                    <TrendingUp className="w-4 h-4" />
                    <span>Stage</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-20 min-w-[160px]">
                    {SOLAR_STAGES.map(stage => (
                      <button
                        key={stage.id}
                        onClick={() => handleBulkStageChange(stage.id)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${stage.color}`}></span>
                        {stage.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative group flex-shrink-0">
                  <button className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs sm:text-sm hover:bg-orange-600 transition">
                    <Flame className="w-4 h-4" />
                    <span>Priority</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-20 min-w-[140px]">
                    {LEAD_PRIORITIES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleBulkPriorityChange(p.id)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${p.color}`}></span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleExportSelected}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs sm:text-sm hover:bg-emerald-600 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkProcessing}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm hover:bg-red-600 transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leads Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500">Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Leads Found</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm || filterSource || filterStage ? "Try adjusting your filters" : "Add your first lead to get started"}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Lead</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Contact</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden lg:table-cell">Location</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Source</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Stage</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Priority</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden xl:table-cell">Assigned</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden xl:table-cell">Follow-up</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden lg:table-cell">Created</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead) => {
                    const sourceConfig = getSourceConfig(lead.source);
                    const stageConfig = getStageConfig(lead.stage);
                    const priorityConfig = getPriorityConfig(lead.priority);
                    const isFresh = isLeadFresh(lead);
                    const followUpDue = isFollowUpDue(lead);
                    const followUpOverdue = isFollowUpOverdue(lead);
                    
                    return (
                      <tr 
                        key={lead.id} 
                        className={`hover:bg-slate-50 transition ${isFresh ? 'bg-green-50/30' : ''} ${followUpOverdue ? 'bg-red-50/30' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => toggleLeadSelection(lead.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-slate-800 truncate max-w-[150px]">
                                  {lead.name || 'Unnamed Lead'}
                                </span>
                                {isFresh && (
                                  <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded animate-pulse">
                                    NEW
                                  </span>
                                )}
                                {lead.templateSent && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded" title={`WA sent: ${lead.templateName || 'template'}`}>
                                    📤 WA
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 truncate max-w-[150px]">
                                ID: {lead.id?.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm">
                            <a
                              href={`tel:${lead.phone?.replace(/\D/g, '')}`}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition"
                              title="Call"
                            >
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </a>
                            {lead.email && (
                              <div className="text-xs text-slate-500 truncate max-w-[140px]">{lead.email}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <div className="text-sm text-slate-600">{lead.district || '-'}</div>
                          <div className="text-xs text-slate-400 capitalize">{lead.property_type || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${sourceConfig.bgLight} ${sourceConfig.textColor}`}>
                            {sourceConfig.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={lead.stage || 'new'}
                            onChange={(e) => handleUpdateLead(lead.id, { stage: e.target.value })}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 ${stageConfig.color} text-white cursor-pointer`}
                          >
                            {SOLAR_STAGES.map(s => (
                              <option key={s.id} value={s.id} className="text-slate-800 bg-white">{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={lead.priority || 'warm'}
                            onChange={(e) => handleUpdateLead(lead.id, { priority: e.target.value })}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 ${priorityConfig.bgLight} ${priorityConfig.textColor} cursor-pointer`}
                          >
                            {LEAD_PRIORITIES.map(p => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 hidden xl:table-cell">
                          <div className="text-sm text-slate-600">
                            {lead.assigned_to_name || <span className="text-slate-400 italic">Unassigned</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden xl:table-cell">
                          {lead.next_follow_up ? (
                            <div className={`text-xs ${followUpOverdue ? 'text-red-600 font-medium' : followUpDue ? 'text-orange-600' : 'text-slate-600'}`}>
                              {followUpOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              {formatDate(lead.next_follow_up)}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <div className="text-xs text-slate-600">{formatDate(lead.timestamp)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openPaymentModal(lead)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                              title="Send Payment Link"
                              data-testid={`payment-btn-${lead.id}`}
                            >
                              <IndianRupee className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openWhatsAppModal(lead)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition"
                              title="Send WhatsApp via API"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => initiatePhoneCall(lead.phone, lead.id, lead.name)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                              title="Call"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedLead(lead); setShowDetailModal(true); }}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedLead(lead); setShowFollowUpModal(true); }}
                              className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition"
                              title="Add Follow-up"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => {
              const sourceConfig = getSourceConfig(lead.source);
              const stageConfig = getStageConfig(lead.stage);
              const priorityConfig = getPriorityConfig(lead.priority);
              const isFresh = isLeadFresh(lead);
              const followUpDue = isFollowUpDue(lead);
              const followUpOverdue = isFollowUpOverdue(lead);
              
              return (
                <div 
                  key={lead.id}
                  className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition ${
                    isFresh ? 'border-l-4 border-l-green-500' : followUpOverdue ? 'border-l-4 border-l-red-500' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="mt-1 rounded border-slate-300"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800">{lead.name || 'Unnamed Lead'}</span>
                          {isFresh && (
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded animate-pulse">NEW</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceConfig.bgLight} ${sourceConfig.textColor}`}>
                            {sourceConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${stageConfig.color}`}>
                            {stageConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priorityConfig.bgLight} ${priorityConfig.textColor}`}>
                            {priorityConfig.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(lead.timestamp)}
                    </div>
                  </div>
                  
                  {/* Contact Info */}
                  <div className="space-y-1.5 text-sm mb-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <a href={`tel:${lead.phone}`} className="hover:text-blue-600">{lead.phone}</a>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.district && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{lead.district}, Bihar</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Meta Info */}
                  <div className="flex flex-wrap gap-2 mb-3 text-xs">
                    {lead.property_type && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded capitalize">{lead.property_type}</span>
                    )}
                    {lead.monthly_bill && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Rs {lead.monthly_bill}/month</span>
                    )}
                    {lead.assigned_to_name && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">{lead.assigned_to_name}</span>
                    )}
                  </div>
                  
                  {/* Follow-up Warning */}
                  {followUpOverdue && (
                    <div className="flex items-center gap-2 text-red-600 text-xs mb-3 bg-red-50 p-2 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Follow-up overdue: {formatDate(lead.next_follow_up)}</span>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openPaymentModal(lead)}
                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
                        title="Send Payment Link"
                      >
                        <IndianRupee className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openWhatsAppModal(lead)}
                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                        title="Send WhatsApp via API"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => initiatePhoneCall(lead.phone, lead.id, lead.name)}
                        className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                        title="Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setSelectedLead(lead); setShowFollowUpModal(true); }}
                        className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition"
                        title="Add Follow-up"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedLead(lead); setShowDetailModal(true); }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600">
              Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalLeads)} of {totalLeads}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLeads(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => fetchLeads(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Add New Lead</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="10-digit mobile"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={newLead.alternate_phone}
                    onChange={(e) => setNewLead({ ...newLead, alternate_phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                  <select
                    value={newLead.district}
                    onChange={(e) => setNewLead({ ...newLead, district: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Property Type</label>
                  <select
                    value={newLead.property_type}
                    onChange={(e) => setNewLead({ ...newLead, property_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {PROPERTY_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Bill (Rs)</label>
                  <input
                    type="number"
                    value={newLead.monthly_bill}
                    onChange={(e) => setNewLead({ ...newLead, monthly_bill: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 3000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Required Capacity</label>
                  <select
                    value={newLead.required_capacity}
                    onChange={(e) => setNewLead({ ...newLead, required_capacity: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="1kW">1 kW</option>
                    <option value="2kW">2 kW</option>
                    <option value="3kW">3 kW</option>
                    <option value="5kW">5 kW</option>
                    <option value="7kW">7 kW</option>
                    <option value="10kW">10 kW</option>
                    <option value="10kW+">10+ kW</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {LEAD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={newLead.priority}
                    onChange={(e) => setNewLead({ ...newLead, priority: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {LEAD_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newLead.address}
                  onChange={(e) => setNewLead({ ...newLead, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Full address (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Assign {selectedLeadIds.length} Lead(s)</h2>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">Select a staff member to assign these leads:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {staffList.filter(s => s.is_active && !['ASR1001','ASR1002'].includes(s.staff_id) && s.role !== "owner" && s.role !== "super_admin" && !['ABHIJEET KUMAR','ANAMIKA'].includes(s.name?.toUpperCase?.())).map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => handleBulkAssign(staff.id)}
                    className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-left"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                      {staff.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">{staff.name}</div>
                      <div className="text-xs text-slate-500">{staff.role || 'Sales'} - {staff.leads_assigned || 0} leads</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Add Follow-up</h2>
              <button onClick={() => { setShowFollowUpModal(false); setSelectedLead(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="font-medium text-slate-800">{selectedLead.name}</div>
                <div className="text-sm text-slate-600">{selectedLead.phone}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Date *</label>
                <input
                  type="date"
                  value={followUpData.date}
                  onChange={(e) => setFollowUpData({ ...followUpData, date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                <input
                  type="time"
                  value={followUpData.time}
                  onChange={(e) => setFollowUpData({ ...followUpData, time: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={followUpData.type}
                  onChange={(e) => setFollowUpData({ ...followUpData, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="call">Phone Call</option>
                  <option value="visit">Site Visit</option>
                  <option value="quotation">Send Quotation</option>
                  <option value="payment">Payment Follow-up</option>
                  <option value="whatsapp">WhatsApp Message</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={followUpData.notes}
                  onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                  placeholder="Follow-up notes..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowFollowUpModal(false); setSelectedLead(null); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFollowUp}
                  disabled={saving || !followUpData.date}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Lead Details</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedLead(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {/* Lead Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold text-slate-800">{selectedLead.name || 'Unnamed Lead'}</h3>
                    {isLeadFresh(selectedLead) && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">NEW</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceConfig(selectedLead.source).bgLight} ${getSourceConfig(selectedLead.source).textColor}`}>
                      {getSourceConfig(selectedLead.source).label}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStageConfig(selectedLead.stage).color}`}>
                      {getStageConfig(selectedLead.stage).label}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityConfig(selectedLead.priority).bgLight} ${getPriorityConfig(selectedLead.priority).textColor}`}>
                      {getPriorityConfig(selectedLead.priority).label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/91${selectedLead.phone?.replace(/\D/g, '').slice(-10)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${selectedLead.phone?.replace(/\D/g, '')}`}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                </div>
              </div>
              
              {/* Lead Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Phone</div>
                  <div className="font-medium text-slate-800">{selectedLead.phone}</div>
                </div>
                {selectedLead.email && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Email</div>
                    <div className="font-medium text-slate-800">{selectedLead.email}</div>
                  </div>
                )}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">District</div>
                  <div className="font-medium text-slate-800">{selectedLead.district || '-'}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Property Type</div>
                  <div className="font-medium text-slate-800 capitalize">{selectedLead.property_type || '-'}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Monthly Bill</div>
                  <div className="font-medium text-slate-800">{selectedLead.monthly_bill ? `Rs ${selectedLead.monthly_bill}` : '-'}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Assigned To</div>
                  <div className="font-medium text-slate-800">{selectedLead.assigned_to_name || 'Unassigned'}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Created</div>
                  <div className="font-medium text-slate-800">{formatDateTime(selectedLead.timestamp)}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Next Follow-up</div>
                  <div className={`font-medium ${isFollowUpOverdue(selectedLead) ? 'text-red-600' : 'text-slate-800'}`}>
                    {selectedLead.next_follow_up ? formatDate(selectedLead.next_follow_up) : '-'}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Lead ID</div>
                  <div className="font-medium text-slate-800 text-xs">{selectedLead.id}</div>
                </div>
              </div>
              
              {/* Notes */}
              {selectedLead.follow_up_notes && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Notes & History</h4>
                  <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedLead.follow_up_notes}
                  </div>
                </div>
              )}
              
              {/* Status History */}
              {selectedLead.status_history && selectedLead.status_history.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Activity Timeline</h4>
                  <div className="space-y-2">
                    {selectedLead.status_history.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${getStageConfig(entry.stage).color}`}></div>
                        <div>
                          <div className="font-medium text-slate-700">{getStageConfig(entry.stage).label}</div>
                          <div className="text-xs text-slate-500">
                            {formatDateTime(entry.timestamp)}
                            {entry.notes && ` - ${entry.notes}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp API Modal */}
      {showWhatsAppModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Send WhatsApp Message
              </h2>
              <button onClick={() => { setShowWhatsAppModal(false); setSelectedLead(null); }} className="p-2 hover:bg-white/20 rounded-lg transition text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Lead Info */}
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="font-medium text-slate-800">{selectedLead.name || 'Unnamed Lead'}</div>
                <div className="text-sm text-slate-600">{selectedLead.phone}</div>
              </div>
              
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Template (Recommended)</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {waTemplates.length > 0 ? waTemplates.map((template) => (
                    <button
                      key={template.name}
                      onClick={() => { setSelectedTemplate(template); setWaMessage(""); }}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        selectedTemplate?.name === template.name 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium text-slate-800 text-sm">{template.name.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-500 mt-1">{template.status || 'approved'}</div>
                    </button>
                  )) : (
                    <div className="text-center text-slate-500 py-4 text-sm">
                      No templates found. Configure WhatsApp templates in Meta Business Suite.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Custom Message Option */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Or Send Custom Message</label>
                <textarea
                  value={waMessage}
                  onChange={(e) => { setWaMessage(e.target.value); setSelectedTemplate(null); }}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition h-24"
                />
                <p className="text-xs text-slate-500 mt-1">Note: Custom messages may have delivery limitations compared to approved templates.</p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowWhatsAppModal(false); setSelectedLead(null); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={sendWhatsAppMessage}
                  disabled={waSending || (!selectedTemplate && !waMessage.trim())}
                  className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {waSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  Send via API
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Link Modal */}
      {showPaymentModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Send Payment Link
              </h2>
              <button 
                onClick={() => { setShowPaymentModal(false); setSelectedLead(null); setPaymentResult(null); }} 
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Lead Info */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{selectedLead.name || 'Unnamed Lead'}</div>
                    <div className="text-sm text-slate-600">{selectedLead.phone}</div>
                    {selectedLead.email && <div className="text-sm text-slate-500">{selectedLead.email}</div>}
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedLead.stage === 'converted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedLead.stage}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Result */}
              {paymentResult ? (
                <div className="space-y-4">
                  {/* Error/Activation Pending State */}
                  {paymentResult.error || paymentResult.activation_pending ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                      </div>
                      <h3 className="font-bold text-amber-800 mb-2">Live Payment Links Awaiting Activation</h3>
                      <p className="text-amber-700 text-sm mb-3">{paymentResult.message}</p>
                      <div className="bg-white border border-amber-200 rounded-lg p-3 text-left text-sm">
                        <p className="font-medium text-slate-700 mb-2">What's happening?</p>
                        <ul className="text-slate-600 space-y-1 text-xs">
                          <li>• Your Cashfree merchant account is under verification</li>
                          <li>• Payment Links API will be activated after approval</li>
                          <li>• This typically takes 1-3 business days</li>
                        </ul>
                      </div>
                      <p className="text-xs text-amber-600 mt-3">
                        Need help? Contact support@asrenterprises.in
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="font-bold text-green-800 mb-1">Payment Link Created!</h3>
                        <p className="text-green-600 text-sm">Amount: {formatCurrency(paymentData.amount)}</p>
                        {paymentResult.whatsapp_sent && (
                          <p className="text-green-500 text-xs mt-1 flex items-center justify-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Sent via WhatsApp
                          </p>
                        )}
                      </div>
                      
                      {/* Payment Link */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-2">Payment Link</p>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={paymentResult.payment_link} 
                            readOnly 
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-600 truncate"
                          />
                          <button 
                            onClick={() => copyPaymentLink(paymentResult.payment_link)}
                            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            title="Copy Link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <a
                            href={paymentResult.payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
                            title="Open Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentResult(null)}
                      className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {paymentResult.error ? 'Try Again' : 'Create Another'}
                    </button>
                    <button
                      onClick={() => { setShowPaymentModal(false); setPaymentResult(null); }}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Create Payment Link Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount (INR) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          value={paymentData.amount}
                          onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                          className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-semibold"
                          placeholder="0"
                          min="1"
                          data-testid="payment-amount-input"
                        />
                      </div>
                    </div>
                    
                    {/* Payment Type Selector */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
                      <select
                        value={paymentData.payment_type}
                        onChange={(e) => setPaymentData({...paymentData, payment_type: e.target.value, purpose: PAYMENT_TYPES[e.target.value] || paymentData.purpose})}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        data-testid="payment-type-select"
                      >
                        <option value="advance">Advance Payment</option>
                        <option value="site_visit">Site Visit Payment</option>
                        <option value="booking">Booking Token Amount</option>
                        <option value="consultation">Consultation Fee</option>
                        <option value="installation">Installation Payment</option>
                        <option value="custom">Custom Payment</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Purpose / Description</label>
                      <input
                        type="text"
                        value={paymentData.purpose}
                        onChange={(e) => setPaymentData({...paymentData, purpose: e.target.value})}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="Solar Service Payment"
                      />
                    </div>
                    
                    {/* WhatsApp Option */}
                    <label className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition">
                      <input
                        type="checkbox"
                        checked={paymentData.send_via_whatsapp}
                        onChange={(e) => setPaymentData({...paymentData, send_via_whatsapp: e.target.checked})}
                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                      />
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Send via WhatsApp</p>
                          <p className="text-xs text-green-600">Auto-send payment link to customer</p>
                        </div>
                      </div>
                    </label>
                    
                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setShowPaymentModal(false); setSelectedLead(null); }}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createPaymentLink}
                        disabled={paymentLoading || !paymentData.amount}
                        className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        data-testid="create-payment-btn"
                      >
                        {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Create Payment
                      </button>
                    </div>
                  </div>
                  
                  {/* Payment History */}
                  {leadPayments.length > 0 && (
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Payment History ({leadPayments.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {leadPayments.map((payment) => (
                          <div key={payment.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-800">{formatCurrency(payment.amount)}</span>
                              {getPaymentStatusBadge(payment.status)}
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{payment.purpose}</span>
                              <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                            </div>
                            {payment.status !== 'paid' && payment.status !== 'cancelled' && payment.payment_link && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => copyPaymentLink(payment.payment_link)}
                                  className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center gap-1"
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                                <button
                                  onClick={() => resendPaymentLink(payment.link_id)}
                                  className="flex-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center justify-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" /> Resend
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Support Info */}
              <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                Support: support@asrenterprises.in | 8877896889
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk WhatsApp Template Modal - Mobile Responsive */}
      {showBulkWhatsAppModal && selectedLeadIds.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:w-full sm:max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 rounded-t-2xl">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Bulk WhatsApp ({selectedLeadIds.length} leads)
              </h2>
              <button 
                onClick={() => setShowBulkWhatsAppModal(false)} 
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              {/* Selected Leads Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm text-green-800 font-medium mb-2">
                  Selected {selectedLeadIds.length} leads for messaging
                </div>
                <div className="text-xs text-green-600">
                  Messages will be sent via WhatsApp API to all selected leads
                </div>
              </div>

              {/* Skip already messaged toggle */}
              {(() => {
                const alreadyCount = leads.filter(l => selectedLeadIds.includes(l.id) && l.templateSent).length;
                const newCount = selectedLeadIds.length - alreadyCount;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">Smart Campaign Filter</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipAlreadyMessaged}
                          onChange={e => setSkipAlreadyMessaged(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-xs text-blue-700">Skip already messaged</span>
                      </label>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {skipAlreadyMessaged ? newCount : selectedLeadIds.length} will receive
                      </span>
                      {alreadyCount > 0 && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {alreadyCount} already messaged {skipAlreadyMessaged ? '(skipped)' : '(will re-send)'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Template Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Select Template</label>
                  <button
                    onClick={syncAndFetchTemplates}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Sync from Meta
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {waTemplates.length > 0 ? waTemplates.map((template) => (
                    <div
                      key={template.name}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 border rounded-lg cursor-pointer transition ${
                        selectedTemplate?.name === template.name
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-green-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-slate-800">{template.label || template.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{template.name}</div>
                    </div>
                  )) : (
                    <div className="text-center py-4">
                      <div className="text-sm text-slate-500 mb-2">No templates loaded yet.</div>
                      <button onClick={syncAndFetchTemplates} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">
                        Sync from Meta
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Message Option */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Or type custom message</label>
                <textarea
                  value={waMessage}
                  onChange={(e) => { setWaMessage(e.target.value); setSelectedTemplate(null); }}
                  placeholder="Type your message here..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowBulkWhatsAppModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedTemplate && !waMessage) {
                      alert('Please select a template or type a message');
                      return;
                    }
                    setWaSending(true);
                    try {
                      const allSelected = leads.filter(l => selectedLeadIds.includes(l.id));
                      const selectedLeadsData = skipAlreadyMessaged
                        ? allSelected.filter(l => !l.templateSent)
                        : allSelected;
                      if (selectedLeadsData.length === 0) {
                        alert('No new leads to send to. All selected leads have already received a template.');
                        setWaSending(false);
                        return;
                      }
                      let successCount = 0;
                      for (const lead of selectedLeadsData) {
                        try {
                          if (selectedTemplate) {
                            await axios.post(`${API}/whatsapp/send-template`, {
                              phone: lead.phone,
                              template_name: selectedTemplate.name,
                              lead_id: lead.id
                            });
                          } else {
                            await axios.post(`${API}/whatsapp/send-message`, {
                              phone: lead.phone,
                              message: waMessage,
                              lead_id: lead.id
                            });
                          }
                          successCount++;
                        } catch (err) {
                          console.error(`Failed to send to ${lead.phone}:`, err);
                        }
                      }
                      alert(`Successfully sent to ${successCount}/${selectedLeadsData.length} leads`);
                      setShowBulkWhatsAppModal(false);
                      setSelectedLeadIds([]);
                    } catch (err) {
                      alert('Failed to send bulk messages');
                    }
                    setWaSending(false);
                  }}
                  disabled={waSending || (!selectedTemplate && !waMessage)}
                  className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {waSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BULK IMPORT MODAL ==================== */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-500" />
                Bulk Import Leads
              </h2>
              <button onClick={closeBulkImportModal} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!bulkImportResult ? (
              <div className="space-y-4">
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setBulkImportMode('file')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${bulkImportMode === 'file' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <FileSpreadsheet className="w-4 h-4 inline mr-1" /> Upload File
                  </button>
                  <button
                    onClick={() => setBulkImportMode('paste')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${bulkImportMode === 'paste' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <FileText className="w-4 h-4 inline mr-1" /> Paste Numbers
                  </button>
                </div>

                {bulkImportMode === 'file' ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      ref={bulkFileInputRef}
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setBulkImportFile(e.target.files[0])}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <button
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition"
                    >
                      Select CSV or Excel File
                    </button>
                    {bulkImportFile && (
                      <p className="text-green-600 text-sm mt-2 font-medium">{bulkImportFile.name}</p>
                    )}
                    <div className="text-slate-500 text-xs mt-3 space-y-1">
                      <p className="font-semibold text-green-600">Only phone number column required!</p>
                      <p>Supports: CSV, Excel (.xlsx, .xls)</p>
                      <p>Column names: phone, mobile, contact, number</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                      <p className="font-semibold mb-1">Paste phone numbers below:</p>
                      <p>• One per line, comma-separated, or space-separated</p>
                      <p>• 10-digit Indian mobile numbers</p>
                    </div>
                    <textarea
                      value={bulkPasteText}
                      onChange={e => setBulkPasteText(e.target.value)}
                      placeholder="9876543210&#10;9876543211&#10;9876543212"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                      rows={6}
                    />
                  </div>
                )}

                <button
                  onClick={handleBulkImport}
                  disabled={bulkImporting || (bulkImportMode === 'file' ? !bulkImportFile : !bulkPasteText.trim())}
                  className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {bulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {bulkImporting ? 'Importing...' : 'Start Bulk Import'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700 font-bold text-lg">Import Successful!</p>
                  <p className="text-slate-600 text-sm mt-1">
                    Imported: <span className="font-semibold text-green-600">{bulkImportResult.imported_count || 0}</span>
                    {bulkImportResult.duplicate_count > 0 && <> · Duplicates: <span className="font-semibold text-amber-600">{bulkImportResult.duplicate_count}</span></>}
                    {bulkImportResult.error_count > 0 && <> · Errors: <span className="font-semibold text-red-600">{bulkImportResult.error_count}</span></>}
                  </p>
                </div>
                <button
                  onClick={closeBulkImportModal}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SMART IMPORT MODAL ==================== */}
      {showSmartImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-500" />
                  Smart Import Leads
                </h2>
                <p className="text-slate-500 text-sm">AI extracts leads from Excel, CSV, PDF, or images</p>
              </div>
              <button onClick={closeSmartImportModal} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step: Upload */}
            {smartImportStep === 'upload' && (
              <div className="flex-1 overflow-y-auto">
                <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center bg-purple-50">
                  <input
                    type="file"
                    ref={smartFileInputRef}
                    accept=".csv,.xlsx,.xls,.pdf,image/*"
                    onChange={handleSmartFileSelect}
                    className="hidden"
                  />
                  <FileSpreadsheet className="w-16 h-16 text-purple-400 mx-auto mb-3" />
                  <button
                    onClick={() => smartFileInputRef.current?.click()}
                    disabled={extracting}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {extracting ? <><Loader2 className="w-5 h-5 animate-spin" /> Extracting with AI...</> : <><Upload className="w-5 h-5" /> Select File</>}
                  </button>
                  {selectedSmartFile && (
                    <p className="text-green-600 text-sm mt-3 font-medium">{selectedSmartFile.name}</p>
                  )}
                  <div className="text-slate-500 text-xs mt-4 space-y-1">
                    <p className="font-semibold text-purple-600">AI extracts: name, phone, email, location & more</p>
                    <p>Supports: CSV, Excel, PDF, Images (JPG/PNG)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {smartImportStep === 'preview' && (
              <div className="flex-1 overflow-y-auto">
                <div className="mb-3 flex justify-between items-center">
                  <p className="text-sm text-slate-600">
                    Found <span className="font-bold text-purple-600">{extractedLeads.length}</span> leads.
                    Selected: <span className="font-bold text-green-600">{extractedLeads.filter(l => l._selected).length}</span>
                  </p>
                  <button
                    onClick={() => setExtractedLeads(prev => prev.map(l => ({ ...l, _selected: !prev.every(x => x._selected) })))}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Toggle All
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">✓</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Phone</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {extractedLeads.slice(0, 100).map((lead, idx) => (
                        <tr key={idx} className={lead._selected ? 'bg-green-50' : 'bg-white'}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={lead._selected}
                              onChange={() => setExtractedLeads(prev => prev.map((l, i) => i === idx ? { ...l, _selected: !l._selected } : l))}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2">{lead.name || <span className="text-slate-400 italic">No name</span>}</td>
                          <td className="px-3 py-2 font-mono">{lead.phone || ''}</td>
                          <td className="px-3 py-2 text-slate-600">{lead.email || ''}</td>
                          <td className="px-3 py-2 text-slate-600">{lead.district || lead.address || lead.location || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {extractedLeads.length > 100 && (
                    <p className="text-xs text-slate-500 text-center py-2 bg-slate-50">
                      Showing first 100 of {extractedLeads.length} leads
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { setSmartImportStep('upload'); setExtractedLeads([]); setSelectedSmartFile(null); if (smartFileInputRef.current) smartFileInputRef.current.value = ''; }}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmSmartImport}
                    disabled={smartImporting || extractedLeads.filter(l => l._selected).length === 0}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-2 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {smartImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Import {extractedLeads.filter(l => l._selected).length} Selected Leads
                  </button>
                </div>
              </div>
            )}

            {/* Step: Result */}
            {smartImportStep === 'result' && smartImportResult && (
              <div className="flex-1 overflow-y-auto">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
                  <p className="text-green-700 font-bold text-xl">Import Complete!</p>
                  <p className="text-slate-700 mt-2">
                    Successfully imported <span className="font-bold text-green-600 text-lg">{smartImportResult.imported_count || 0}</span> leads
                  </p>
                  {smartImportResult.duplicate_count > 0 && (
                    <p className="text-amber-600 text-sm mt-1">{smartImportResult.duplicate_count} duplicate(s) skipped</p>
                  )}
                  {smartImportResult.error_count > 0 && (
                    <p className="text-red-600 text-sm mt-1">{smartImportResult.error_count} error(s)</p>
                  )}
                </div>
                <button
                  onClick={closeSmartImportModal}
                  className="w-full mt-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TRASH VIEW MODAL ===== */}
      {showTrashView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Trash — Deleted Leads
                </h2>
                <p className="text-red-100 text-xs mt-0.5">Leads are permanently deleted after 30 days</p>
              </div>
              <button
                onClick={() => setShowTrashView(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {trashLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
              ) : trashedLeads.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Trash is empty</p>
                  <p className="text-sm">Deleted leads will appear here for 30 days</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trashedLeads.map(lead => {
                    const deletedAt = lead.deleted_at ? new Date(lead.deleted_at) : null;
                    const daysLeft = deletedAt
                      ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)))
                      : 30;
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800">{lead.name || 'Unnamed Lead'}</span>
                            <span className="text-xs text-red-500 font-medium">
                              {daysLeft > 0 ? `${daysLeft}d left` : 'Expires today'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {lead.phone} · {lead.district || 'N/A'} · Deleted: {deletedAt ? deletedAt.toLocaleDateString('en-IN') : 'Unknown'}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await axios.post(`${API}/crm/leads/restore`, { lead_ids: [lead.id] });
                              setTrashedLeads(prev => prev.filter(l => l.id !== lead.id));
                              fetchLeads();
                            } catch {
                              alert('Failed to restore lead');
                            }
                          }}
                          className="ml-3 flex-shrink-0 px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition font-medium flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <span className="text-xs text-gray-500">{trashedLeads.length} deleted lead(s)</span>
              <button
                onClick={fetchTrashedLeads}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalLeadsManagement;
