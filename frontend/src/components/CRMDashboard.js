import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Users, ClipboardList, TrendingUp, Calendar, 
  Phone, Mail, MapPin, DollarSign, CheckCircle, Clock, 
  AlertCircle, Sparkles, RefreshCw, Plus, Search, Filter,
  UserPlus, PhoneCall, FileText, Wrench, CreditCard, BarChart3,
  Send, ChevronRight, Edit, Trash2, Eye, MessageSquare, Key, Copy,
  Image, Upload, Camera, ListTodo, MessageCircle, Activity, Zap, FileSpreadsheet, Download
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { id: "new", label: "New Lead", color: "bg-blue-500" },
  { id: "follow_up", label: "Follow Up", color: "bg-yellow-500" },
  { id: "telecall", label: "Tele Call", color: "bg-purple-500" },
  { id: "quotation", label: "Quotation", color: "bg-orange-500" },
  { id: "installation", label: "Installation", color: "bg-cyan-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "lost", label: "Lost", color: "bg-red-500" }
];

const TASK_TYPES = [
  { id: "call", label: "📞 Call" },
  { id: "visit", label: "🏠 Site Visit" },
  { id: "telecall", label: "📞 Tele Call" },
  { id: "installation", label: "🔧 Installation" },
  { id: "follow_up", label: "🔄 Follow Up" },
  { id: "other", label: "📝 Other" }
];

export const CRMDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editStaffForm, setEditStaffForm] = useState(null);
  const [newStaffCredentials, setNewStaffCredentials] = useState(null);
  const [filterStage, setFilterStage] = useState("");
  const [newStaffForm, setNewStaffForm] = useState({ name: '', email: '', phone: '', role: 'sales', password: 'asr@123', custom_staff_id: '' });
  const STAFF_ROLES = [
    { id: 'sales', label: 'Sales Executive' },
    { id: 'manager', label: 'Manager' },
    { id: 'telecaller', label: 'Tele Caller' },
    { id: 'technician', label: 'Technician' },
    { id: 'admin', label: 'Admin' }
  ];
  const [taskForm, setTaskForm] = useState({ staff_id: '', title: '', description: '', task_type: 'call', lead_id: '', priority: 'medium', due_date: '', due_time: '10:00' });
  const [messageForm, setMessageForm] = useState({ receiver_id: '', message: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoForm, setPhotoForm] = useState({ title: '', description: '', location: '', system_size: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const ASR_LOGO = "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png";
  
  // Manual Lead Creation State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '', email: '', phone: '', district: '', address: '',
    property_type: 'residential', roof_type: 'rcc', monthly_bill: '',
    roof_area: '', source: 'manual', notes: ''
  });
  const [districts, setDistricts] = useState([]);
  
  // Bulk Import State
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const bulkFileInputRef = useRef(null);
  
  // Quick Add Lead State
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickLeadForm, setQuickLeadForm] = useState({ name: '', phone: '', district: '', source: 'manual' });
  
  // Multiple Photo Upload State  
  const [photoFiles, setPhotoFiles] = useState([]);
  
  // Registration Fee State
  const [registrationFee, setRegistrationFee] = useState(1500);
  const [newRegistrationFee, setNewRegistrationFee] = useState('');
  const [registrations, setRegistrations] = useState([]);

  useEffect(() => { fetchAllData(); fetchDistricts(); fetchRegistrations(); }, []);
  
  const fetchRegistrations = async () => {
    try {
      const [feeRes, regRes] = await Promise.all([
        axios.get(`${API}/registration/fee`),
        axios.get(`${API}/admin/registrations`)
      ]);
      setRegistrationFee(feeRes.data.fee);
      setRegistrations(regRes.data.registrations || []);
    } catch (err) { console.error("Error fetching registrations", err); }
  };
  
  const updateRegistrationFee = async () => {
    if (!newRegistrationFee || parseFloat(newRegistrationFee) < 0) {
      alert("Please enter a valid fee amount");
      return;
    }
    try {
      await axios.post(`${API}/registration/update-fee`, { fee: parseFloat(newRegistrationFee) });
      setRegistrationFee(parseFloat(newRegistrationFee));
      setNewRegistrationFee('');
      alert("Registration fee updated successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Error updating fee");
    }
  };
  
  const fetchDistricts = async () => {
    try {
      const res = await axios.get(`${API}/districts`);
      setDistricts(res.data.districts || []);
    } catch (err) { console.error("Error fetching districts", err); }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, leadsRes, staffRes, tasksRes, msgRes, followRes, projRes, payRes, photosRes] = await Promise.all([
        axios.get(`${API}/crm/dashboard`),
        axios.get(`${API}/crm/leads`),
        axios.get(`${API}/admin/staff-accounts`),
        axios.get(`${API}/crm/tasks`).catch(() => ({ data: [] })),
        axios.get(`${API}/crm/messages`).catch(() => ({ data: [] })),
        axios.get(`${API}/crm/followups`),
        axios.get(`${API}/crm/projects`),
        axios.get(`${API}/crm/payments`),
        axios.get(`${API}/admin/photos`)
      ]);
      setDashboardData(dashRes.data);
      setLeads(leadsRes.data);
      setStaffAccounts(staffRes.data);
      setTasks(tasksRes.data || []);
      setMessages(msgRes.data || []);
      setFollowups(followRes.data);
      setProjects(projRes.data);
      setPayments(payRes.data);
      setGalleryPhotos(photosRes.data || []);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const createStaffAccount = async () => {
    try {
      const payload = {
        ...newStaffForm,
        custom_staff_id: newStaffForm.custom_staff_id?.trim() || undefined
      };
      const res = await axios.post(`${API}/staff/register`, payload);
      setNewStaffCredentials({ staff_id: res.data.staff_id, password: res.data.password });
      setNewStaffForm({ name: '', email: '', phone: '', role: 'sales', password: 'asr@123', custom_staff_id: '' });
      setShowStaffModal(false);
      fetchAllData();
    } catch (err) { alert(err.response?.data?.detail || "Error creating staff"); }
  };

  const assignLeadToStaff = async (leadId, staffInternalId) => {
    try {
      const res = await axios.post(`${API}/crm/leads/${leadId}/assign`, { employee_id: staffInternalId, assigned_by: "admin" });
      fetchAllData();
      alert("Lead assigned!");
      // Open WhatsApp notification if URL available
      if (res.data.whatsapp_notification_url) {
        if (window.confirm("Open WhatsApp to notify staff?")) {
          window.open(res.data.whatsapp_notification_url, '_blank');
        }
      }
    } catch (err) { alert("Error assigning lead"); }
  };

  // Create Manual Lead
  const createManualLead = async () => {
    if (!newLeadForm.name || !newLeadForm.phone) {
      alert("Name and Phone are required!");
      return;
    }
    try {
      await axios.post(`${API}/crm/leads`, {
        ...newLeadForm,
        monthly_bill: newLeadForm.monthly_bill ? parseFloat(newLeadForm.monthly_bill) : null,
        roof_area: newLeadForm.roof_area ? parseFloat(newLeadForm.roof_area) : null
      });
      setShowAddLeadModal(false);
      setNewLeadForm({
        name: '', email: '', phone: '', district: '', address: '',
        property_type: 'residential', roof_type: 'rcc', monthly_bill: '',
        roof_area: '', source: 'manual', notes: ''
      });
      fetchAllData();
      alert("Lead created successfully!");
    } catch (err) { 
      alert(err.response?.data?.detail || "Error creating lead"); 
    }
  };

  // Quick Add Lead (simplified)
  const createQuickLead = async () => {
    if (!quickLeadForm.name || !quickLeadForm.phone) {
      alert("Name and Phone are required!");
      return;
    }
    try {
      await axios.post(`${API}/crm/leads`, quickLeadForm);
      setShowQuickAddModal(false);
      setQuickLeadForm({ name: '', phone: '', district: '', source: 'manual' });
      fetchAllData();
      alert("Lead added successfully!");
    } catch (err) { 
      alert(err.response?.data?.detail || "Error creating lead"); 
    }
  };

  // Bulk Import Leads
  const handleBulkImport = async () => {
    if (!bulkImportFile) { alert("Please select a CSV file"); return; }
    setBulkImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      const res = await axios.post(`${API}/crm/leads/bulk-import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBulkImportResult(res.data);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || "Import failed");
    }
    setBulkImporting(false);
  };

  // Fetch Social Leads (WhatsApp, Facebook, etc.)
  const fetchSocialLeads = async () => {
    try {
      const res = await axios.get(`${API}/webhook/recent-social-leads`);
      if (res.data.total > 0) {
        alert(`Found ${res.data.total} social media leads!\n\nWhatsApp: ${res.data.by_source?.whatsapp || 0}\nFacebook: ${res.data.by_source?.facebook || 0}`);
        fetchAllData();
      } else {
        alert("No new social media leads found. Make sure WhatsApp/Facebook webhooks are configured.");
      }
    } catch (err) {
      alert("Error fetching social leads. Check webhook configuration.");
    }
  };

  // Download CSV Template
  const downloadCSVTemplate = () => {
    const headers = "name,phone,email,district,address,property_type,monthly_bill,roof_area,source,notes\n";
    const example = "Ramesh Kumar,9876543210,ramesh@example.com,Patna,123 Main Road,residential,3500,500,referral,Interested in 5kW system\n";
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const autoAssignLead = async (leadId) => {
    try {
      const res = await axios.post(`${API}/crm/leads/${leadId}/auto-assign`);
      if (res.data.success) {
        fetchAllData();
        alert(`Lead auto-assigned to ${res.data.assigned_name} (${res.data.assignment_reason})`);
        if (res.data.whatsapp_notification_url && window.confirm("Open WhatsApp to notify staff?")) {
          window.open(res.data.whatsapp_notification_url, '_blank');
        }
      } else {
        alert(res.data.message || "Auto-assign failed");
      }
    } catch (err) { alert(err.response?.data?.detail || "Error auto-assigning lead"); }
  };

  const autoAssignAllLeads = async () => {
    if (!window.confirm("Auto-assign ALL unassigned leads using AI?")) return;
    try {
      const res = await axios.post(`${API}/crm/leads/auto-assign-all`);
      fetchAllData();
      alert(`Processed ${res.data.total_processed} leads. ${res.data.successful} assigned successfully.`);
    } catch (err) { alert("Error in bulk auto-assign"); }
  };

  const sendQuoteViaWhatsApp = async (leadId) => {
    const systemSize = prompt("Enter system size (e.g., 3kW):", "3kW");
    if (!systemSize) return;
    const totalCost = parseInt(prompt("Enter total cost:", "210000") || "210000");
    const subsidy = parseInt(prompt("Enter govt subsidy:", "78000") || "78000");
    
    try {
      const res = await axios.post(`${API}/crm/leads/${leadId}/send-quote-whatsapp`, {
        system_size: systemSize,
        total_cost: totalCost,
        subsidy: subsidy,
        final_cost: totalCost - subsidy
      });
      if (res.data.whatsapp_url) {
        window.open(res.data.whatsapp_url, '_blank');
      }
    } catch (err) { alert("Error generating quote"); }
  };

  const createTask = async () => {
    if (!taskForm.staff_id || !taskForm.title || !taskForm.due_date) { alert("Fill required fields"); return; }
    try {
      await axios.post(`${API}/crm/tasks`, taskForm);
      setTaskForm({ staff_id: '', title: '', description: '', task_type: 'call', lead_id: '', priority: 'medium', due_date: '', due_time: '10:00' });
      setShowTaskModal(false);
      fetchAllData();
      alert("Task assigned!");
    } catch (err) { alert("Error creating task"); }
  };

  const sendMessage = async () => {
    if (!messageForm.message.trim()) return;
    try {
      await axios.post(`${API}/crm/messages`, {
        sender_id: "admin",
        sender_name: "Admin",
        sender_type: "admin",
        receiver_id: messageForm.receiver_id || null,
        message: messageForm.message
      });
      setMessageForm({ receiver_id: '', message: '' });
      fetchAllData();
    } catch (err) { alert("Error sending message"); }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // Validate each file
      const validFiles = files.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} is too large. Max 10MB allowed.`);
          return false;
        }
        return true;
      });
      
      if (validFiles.length === 1) {
        // Single file - use existing flow
        setPhotoFile(validFiles[0]);
        setPhotoFiles([]);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(validFiles[0]);
      } else if (validFiles.length > 1) {
        // Multiple files
        setPhotoFiles(validFiles);
        setPhotoFile(null);
        setPhotoPreview('');
      }
    }
  };

  const uploadPhoto = async () => {
    if (!photoForm.title) { alert("Please add title"); return; }
    
    // Handle multiple file upload
    if (photoFiles.length > 1) {
      if (!window.confirm(`Upload ${photoFiles.length} photos with title "${photoForm.title}"?`)) return;
      setUploading(true);
      let successCount = 0;
      for (let i = 0; i < photoFiles.length; i++) {
        try {
          const formData = new FormData();
          formData.append('file', photoFiles[i]);
          formData.append('title', `${photoForm.title} (${i + 1}/${photoFiles.length})`);
          formData.append('description', photoForm.description || '');
          formData.append('location', photoForm.location || '');
          formData.append('system_size', photoForm.system_size || '');
          await axios.post(`${API}/gallery/upload-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          successCount++;
        } catch (err) { console.error(`Failed to upload ${photoFiles[i].name}`, err); }
      }
      setPhotoForm({ title: '', description: '', location: '', system_size: '', image_url: '' });
      setPhotoFile(null);
      setPhotoFiles([]);
      setPhotoPreview('');
      setShowPhotoUploadModal(false);
      fetchAllData();
      alert(`Uploaded ${successCount}/${photoFiles.length} photos!`);
      setUploading(false);
      return;
    }
    
    // Single file or URL upload
    if (!photoFile && !photoForm.image_url) { alert("Please select image or enter URL"); return; }
    setUploading(true);
    try {
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('title', photoForm.title);
        formData.append('description', photoForm.description || '');
        formData.append('location', photoForm.location || '');
        formData.append('system_size', photoForm.system_size || '');
        
        await axios.post(`${API}/gallery/upload-file`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`${API}/gallery/upload`, {
          title: photoForm.title,
          description: photoForm.description,
          location: photoForm.location,
          system_size: photoForm.system_size,
          image_url: photoForm.image_url,
          category: "installation"
        });
      }
      setPhotoForm({ title: '', description: '', location: '', system_size: '', image_url: '' });
      setPhotoFile(null);
      setPhotoFiles([]);
      setPhotoPreview('');
      setShowPhotoUploadModal(false);
      fetchAllData();
      alert("Photo uploaded to gallery!");
    } catch (err) { 
      alert(err.response?.data?.detail || "Error uploading photo"); 
    }
    setUploading(false);
  };

  const sendWhatsApp = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const forwardLeadToStaffWhatsApp = async (lead, staff) => {
    const msg = `🔔 *New Lead Assigned*\n\n👤 Name: ${lead.name}\n📞 Phone: ${lead.phone}\n📍 District: ${lead.district}\n💰 Monthly Bill: ₹${lead.monthly_bill}\n🏠 Property: ${lead.property_type}\n\n_Please contact within 24 hours_\n\n- ASR Enterprises Admin`;
    sendWhatsApp(staff.phone, msg);
  };

  const updateLeadStage = async (leadId, newStage) => {
    try {
      await axios.put(`${API}/crm/leads/${leadId}`, { stage: newStage });
      fetchAllData();
    } catch (err) { alert("Error updating"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/admin/dashboard" className="text-gray-400 hover:text-white"><ArrowLeft className="w-6 h-6" /></Link>
              <img src={ASR_LOGO} alt="ASR" className="h-12 bg-white rounded-lg p-1" />
              <div>
                <h1 className="text-2xl font-bold text-white">ASR CRM System</h1>
                <p className="text-gray-400 text-sm">Manage leads, staff & operations</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={fetchAllData} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" /><span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
              { id: "leads", label: "Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "tasks", label: "Tasks", icon: <ListTodo className="w-4 h-4" /> },
              { id: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
              { id: "messages", label: "Messages", icon: <MessageCircle className="w-4 h-4" /> },
              { id: "gallery", label: "Gallery", icon: <Camera className="w-4 h-4" /> },
              { id: "projects", label: "Projects", icon: <Wrench className="w-4 h-4" /> },
              { id: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700"}`}>
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Dashboard */}
        {activeTab === "dashboard" && dashboardData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
                <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboardData.total_leads || 0}</div>
                <div className="text-blue-200 text-sm">Total Leads</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-white">
                <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboardData.pipeline_stats?.completed || 0}</div>
                <div className="text-green-200 text-sm">Completed</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-5 text-white">
                <Users className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{staffAccounts.length}</div>
                <div className="text-yellow-200 text-sm">Staff Members</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white">
                <DollarSign className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">₹{((dashboardData.total_revenue || 0) / 1000).toFixed(0)}K</div>
                <div className="text-purple-200 text-sm">Revenue</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Pipeline Overview</h2>
                <div className="space-y-3">
                  {PIPELINE_STAGES.map((stage) => (
                    <div key={stage.id} className="flex items-center justify-between">
                      <span className="text-gray-300">{stage.label}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-gray-700 rounded-full h-2">
                          <div className={`${stage.color} h-2 rounded-full`} style={{ width: `${Math.min(100, ((dashboardData.pipeline_stats?.[stage.id] || 0) / Math.max(1, dashboardData.total_leads)) * 100)}%` }} />
                        </div>
                        <span className="text-white font-bold w-8">{dashboardData.pipeline_stats?.[stage.id] || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Recent Leads</h2>
                <div className="space-y-3">
                  {dashboardData.recent_leads?.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                      <div>
                        <div className="text-white font-medium">{lead.name}</div>
                        <div className="text-gray-400 text-sm">{lead.district}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${lead.ai_priority === 'high' ? 'bg-red-600' : lead.ai_priority === 'medium' ? 'bg-yellow-600' : 'bg-gray-600'} text-white`}>
                        {lead.ai_priority?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="bg-gray-700 text-white px-4 py-2 rounded-lg">
                <option value="">All Stages</option>
                {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowQuickAddModal(true)} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-green-700 transition" data-testid="quick-add-btn">
                  <Plus className="w-4 h-4" /><span>Quick Add</span>
                </button>
                <button onClick={() => setShowAddLeadModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-blue-700 transition" data-testid="add-lead-btn">
                  <UserPlus className="w-4 h-4" /><span>Full Form</span>
                </button>
                <button onClick={() => setShowBulkImportModal(true)} className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-orange-700 transition" data-testid="bulk-import-btn">
                  <Upload className="w-4 h-4" /><span>CSV Import</span>
                </button>
                <button onClick={fetchSocialLeads} className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-green-600 hover:to-teal-600 transition" data-testid="fetch-social-btn">
                  <Download className="w-4 h-4" /><span>Fetch Social Leads</span>
                </button>
                <button onClick={autoAssignAllLeads} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-purple-700 hover:to-pink-700 transition" data-testid="auto-assign-all-btn">
                  <Zap className="w-4 h-4" /><span>AI Auto-Assign</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Contact</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Source</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Stage</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Assign To</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.filter(l => !filterStage || l.stage === filterStage).map((lead) => (
                    <tr key={lead.id} className="border-t border-gray-700">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{lead.name}</div>
                        <div className="text-gray-400 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          lead.source === 'whatsapp' ? 'bg-green-600' : 
                          lead.source === 'facebook' ? 'bg-blue-600' : 
                          lead.source === 'website' ? 'bg-purple-600' : 
                          lead.source === 'registration' ? 'bg-orange-600' : 'bg-gray-600'
                        } text-white`}>
                          {lead.source?.toUpperCase() || 'MANUAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={lead.stage} onChange={(e) => updateLeadStage(lead.id, e.target.value)} className="bg-gray-700 text-white text-sm px-2 py-1 rounded">
                          {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={lead.assigned_to || ''} onChange={(e) => { if(e.target.value) assignLeadToStaff(lead.id, e.target.value); }} className="bg-gray-700 text-white text-sm px-2 py-1 rounded">
                          <option value="">Assign Staff</option>
                          {staffAccounts.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}, this is ASR Enterprises...`)} className="text-green-400 hover:text-green-300" title="WhatsApp Customer"><MessageSquare className="w-4 h-4" /></button>
                          <a href={`tel:${lead.phone}`} className="text-blue-400 hover:text-blue-300" title="Call"><Phone className="w-4 h-4" /></a>
                          <button onClick={() => sendQuoteViaWhatsApp(lead.id)} className="text-orange-400 hover:text-orange-300" title="Send Quote via WhatsApp"><FileSpreadsheet className="w-4 h-4" /></button>
                          {!lead.assigned_to && (
                            <button onClick={() => autoAssignLead(lead.id)} className="text-purple-400 hover:text-purple-300" title="AI Auto-Assign"><Zap className="w-4 h-4" /></button>
                          )}
                          {lead.assigned_to && (
                            <button onClick={() => {
                              const staff = staffAccounts.find(s => s.id === lead.assigned_to);
                              if(staff) forwardLeadToStaffWhatsApp(lead, staff);
                            }} className="text-yellow-400 hover:text-yellow-300" title="Forward to Staff WhatsApp"><Send className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => window.open(`/admin/leads?edit=${lead.id}`, '_blank')} className="text-cyan-400 hover:text-cyan-300" title="Edit Lead"><Edit className="w-4 h-4" /></button>
                          <button onClick={async () => {
                            if(window.confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) {
                              try {
                                await axios.delete(`${API}/admin/leads/${lead.id}`);
                                fetchAllData();
                              } catch(err) { alert('Error deleting lead'); }
                            }
                          }} className="text-red-400 hover:text-red-300" title="Delete Lead"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowTaskModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                <Plus className="w-4 h-4" /><span>Assign Task</span>
              </button>
            </div>
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Task</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Assigned To</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Due Date</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Priority</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-gray-700">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{task.title}</div>
                        <div className="text-gray-400 text-sm">{task.task_type} {task.lead_name && `• ${task.lead_name}`}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{task.staff_name}</td>
                      <td className="px-4 py-3 text-gray-300">{task.due_date} {task.due_time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${task.priority === 'high' ? 'bg-red-600' : task.priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'} text-white`}>{task.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${task.status === 'completed' ? 'bg-green-600' : task.status === 'in_progress' ? 'bg-blue-600' : 'bg-gray-600'} text-white`}>{task.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.length === 0 && <div className="text-center py-12 text-gray-400">No tasks assigned yet</div>}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Staff Accounts</h2>
              <button onClick={() => setShowStaffModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                <UserPlus className="w-4 h-4" /><span>Add Staff</span>
              </button>
            </div>
            {newStaffCredentials && (
              <div className="bg-green-600 bg-opacity-20 border border-green-500 rounded-xl p-4">
                <h3 className="text-green-400 font-bold">New Staff Created!</h3>
                <p className="text-white">Staff ID: <strong>{newStaffCredentials.staff_id}</strong></p>
                <p className="text-white">Password: <strong>{newStaffCredentials.password}</strong></p>
                <button onClick={() => { navigator.clipboard.writeText(`ID: ${newStaffCredentials.staff_id}\nPassword: ${newStaffCredentials.password}`); alert('Copied!'); }} className="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm">Copy</button>
                <button onClick={() => setNewStaffCredentials(null)} className="ml-2 text-gray-400 text-sm">Dismiss</button>
              </div>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffAccounts.map((staff) => (
                <div key={staff.id} className="bg-gray-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">{staff.name?.[0]}</div>
                      <div>
                        <div className="text-white font-bold">{staff.name}</div>
                        <div className="text-cyan-400 text-sm font-mono">{staff.staff_id}</div>
                        <div className="text-gray-400 text-xs capitalize">{staff.role}</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      const newStatus = !staff.is_active;
                      await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/toggle-status`, { is_active: newStatus });
                      fetchAllData();
                    }} className={`px-2 py-1 rounded text-xs ${staff.is_active ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-700 rounded-lg p-2 text-center">
                      <div className="text-blue-400 font-bold">{staff.leads_assigned || 0}</div>
                      <div className="text-gray-500 text-xs">Assigned</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-2 text-center">
                      <div className="text-green-400 font-bold">{staff.leads_converted || 0}</div>
                      <div className="text-gray-500 text-xs">Converted</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-2 text-center">
                      <div className="text-yellow-400 font-bold">₹{((staff.total_revenue || 0) / 1000).toFixed(0)}K</div>
                      <div className="text-gray-500 text-xs">Revenue</div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={async () => {
                      const newPass = prompt('New password:', 'asr@123');
                      if(newPass) { await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/reset-password`, { password: newPass }); alert('Password updated!'); }
                    }} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm flex items-center justify-center space-x-1">
                      <Key className="w-3 h-3" /><span>Password</span>
                    </button>
                    <button onClick={() => sendWhatsApp(staff.phone, 'Hi, this is Admin from ASR Enterprises...')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm flex items-center justify-center space-x-1">
                      <MessageSquare className="w-3 h-3" /><span>WhatsApp</span>
                    </button>
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <button onClick={async () => {
                      const newName = prompt('Edit Name:', staff.name);
                      const newRole = prompt('Edit Role (sales/manager/telecaller/technician):', staff.role);
                      if(newName && newRole) {
                        await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/update`, { name: newName, role: newRole });
                        alert('Staff updated!');
                        fetchAllData();
                      }
                    }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm flex items-center justify-center space-x-1">
                      <Edit className="w-3 h-3" /><span>Edit</span>
                    </button>
                    <button onClick={async () => {
                      if(window.confirm(`Delete staff member "${staff.name}" (${staff.staff_id})? This cannot be undone.`)) {
                        await axios.delete(`${API}/admin/staff-accounts/${staff.staff_id}`);
                        alert('Staff deleted!');
                        fetchAllData();
                      }
                    }} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm flex items-center justify-center space-x-1">
                      <Trash2 className="w-3 h-3" /><span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages Tab - Staff-wise Conversations (PRIVATE & SECURE) */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">Staff Conversations (End-to-End Secure)</h3>
                <span className="text-green-400 text-xs flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Private & Encrypted</span>
                </span>
              </div>
              <div className="grid md:grid-cols-4 gap-4">
                {/* Staff List */}
                <div className="space-y-2 border-r border-gray-700 pr-4 max-h-96 overflow-y-auto">
                  <div 
                    className={`p-3 rounded-lg cursor-pointer transition ${messageForm.receiver_id === '' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => setMessageForm({...messageForm, receiver_id: ''})}
                  >
                    <span className="text-white font-medium">📢 Broadcast to All</span>
                    <p className="text-gray-400 text-xs">All staff can see</p>
                  </div>
                  {staffAccounts.map((staff) => (
                    <div 
                      key={staff.id}
                      className={`p-3 rounded-lg cursor-pointer transition ${messageForm.receiver_id === staff.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                      onClick={() => setMessageForm({...messageForm, receiver_id: staff.id})}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{staff.name}</span>
                        <span className="text-gray-400 text-xs capitalize">{staff.role}</span>
                      </div>
                      <span className="text-gray-400 text-xs">{staff.staff_id}</span>
                      <p className="text-green-400 text-xs mt-1">🔒 Private chat</p>
                    </div>
                  ))}
                </div>
                
                {/* Chat Area */}
                <div className="md:col-span-3">
                  <div className="bg-gray-900 rounded-lg border border-gray-700 mb-4">
                    <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                      <span className="text-white font-medium">
                        {messageForm.receiver_id 
                          ? `🔒 Private: ${staffAccounts.find(s => s.id === messageForm.receiver_id)?.name || 'Staff'}`
                          : '📢 Broadcast Channel (All Staff)'}
                      </span>
                      {messageForm.receiver_id && (
                        <span className="text-green-400 text-xs">Only you and {staffAccounts.find(s => s.id === messageForm.receiver_id)?.name} can see</span>
                      )}
                    </div>
                    <div className="p-4 h-64 overflow-y-auto">
                      {(() => {
                        // SECURE FILTER: Only show messages that belong to this conversation
                        const conversationMessages = messages.filter(msg => {
                          if (!messageForm.receiver_id) {
                            // Broadcast: only show broadcast messages (receiver_id is null/empty)
                            return !msg.receiver_id || msg.receiver_id === '';
                          } else {
                            // Private: only show messages between admin and this specific staff
                            return (
                              (msg.sender_id === 'admin' && msg.receiver_id === messageForm.receiver_id) ||
                              (msg.sender_id === messageForm.receiver_id && (msg.receiver_id === 'admin' || !msg.receiver_id))
                            );
                          }
                        });
                        
                        return conversationMessages.length > 0 ? (
                          <div className="space-y-3">
                            {conversationMessages.map((msg) => (
                              <div key={msg.id} className={`p-3 rounded-lg relative group ${msg.sender_type === 'admin' ? 'bg-blue-600 bg-opacity-30 ml-12' : 'bg-gray-700 mr-12'}`}>
                                <button 
                                  onClick={async () => {
                                    if(window.confirm('Delete this message?')) {
                                      await axios.delete(`${API}/crm/messages/${msg.id}`);
                                      fetchAllData();
                                    }
                                  }}
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="flex justify-between items-start mb-1 pr-6">
                                  <span className={`font-medium text-sm ${msg.sender_type === 'admin' ? 'text-blue-400' : 'text-green-400'}`}>
                                    {msg.sender_name}
                                  </span>
                                  <span className="text-gray-500 text-xs">{new Date(msg.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-gray-200">{msg.message}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No messages in this conversation</p>
                            <p className="text-xs mt-1 text-gray-500">Start a secure conversation</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={messageForm.message} 
                      onChange={(e) => setMessageForm({...messageForm, message: e.target.value})} 
                      placeholder={messageForm.receiver_id ? `🔒 Private message to ${staffAccounts.find(s => s.id === messageForm.receiver_id)?.name || 'staff'}...` : "📢 Broadcast to all staff..."} 
                      className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 transition" 
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
                    />
                    <button onClick={sendMessage} className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition">
                      <Send className="w-5 h-5" /><span>Send</span>
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    {messageForm.receiver_id 
                      ? "🔒 This is a private conversation. Only you and the selected staff member can see these messages. Other staff cannot view this chat."
                      : "📢 Broadcast messages are visible to all staff members."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === "gallery" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Work Photos Gallery</h2>
              <button onClick={() => setShowPhotoUploadModal(true)} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 font-semibold">
                <Upload className="w-5 h-5" /><span>Upload Photo</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="bg-gray-800 rounded-xl overflow-hidden group">
                  <div className="relative aspect-video">
                    <img src={photo.image_url || photo.imageUrl} alt={photo.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center">
                      <button onClick={async () => { if(window.confirm('Delete?')) { await axios.delete(`${API}/admin/photos/${photo.id}`); fetchAllData(); }}} className="opacity-0 group-hover:opacity-100 bg-red-600 text-white p-2 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-semibold truncate">{photo.title}</h3>
                    <p className="text-gray-400 text-sm truncate">{photo.location || photo.description}</p>
                  </div>
                </div>
              ))}
              {galleryPhotos.length === 0 && (
                <div className="col-span-4 text-center py-16">
                  <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No photos yet. Upload your first work photo!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <div key={proj.id} className="bg-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-white font-bold">{proj.customer_name}</div>
                    <div className="text-gray-400 text-sm">{proj.location}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${proj.installation_status === 'completed' ? 'bg-green-600' : proj.installation_status === 'in_progress' ? 'bg-blue-600' : 'bg-yellow-600'} text-white`}>{proj.installation_status}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">System</span><span className="text-white">{proj.system_size}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-white">₹{proj.total_amount?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pending</span><span className="text-red-400">₹{proj.pending_amount?.toLocaleString()}</span></div>
                </div>
              </div>
            ))}
            {projects.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">No projects yet</div>}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            {/* Registration Fee Management */}
            <div className="bg-gradient-to-r from-orange-600 to-yellow-600 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Service Registration Fee</h3>
                  <p className="text-orange-100 text-sm">Current fee charged to customers for solar service registration</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-lg px-4 py-2">
                    <span className="text-white/80 text-sm">Current:</span>
                    <span className="text-white text-2xl font-bold ml-2">₹{registrationFee}</span>
                  </div>
                  <input
                    type="number"
                    value={newRegistrationFee}
                    onChange={(e) => setNewRegistrationFee(e.target.value)}
                    placeholder="New fee"
                    className="bg-white/20 text-white placeholder-white/50 px-4 py-2 rounded-lg w-32"
                  />
                  <button
                    onClick={updateRegistrationFee}
                    className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>

            {/* Paid Registrations */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Service Registrations</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left text-gray-300 px-4 py-3 text-sm">Date</th>
                      <th className="text-left text-gray-300 px-4 py-3 text-sm">Customer</th>
                      <th className="text-left text-gray-300 px-4 py-3 text-sm">Phone</th>
                      <th className="text-left text-gray-300 px-4 py-3 text-sm">Amount</th>
                      <th className="text-left text-gray-300 px-4 py-3 text-sm">Status</th>
                      <th className="text-left text-gray-300 px-4 py-3 text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="border-t border-gray-700">
                        <td className="px-4 py-3 text-white">{reg.timestamp?.split('T')[0]}</td>
                        <td className="px-4 py-3 text-white">{reg.customer?.name}</td>
                        <td className="px-4 py-3 text-gray-300">{reg.customer?.phone}</td>
                        <td className="px-4 py-3 text-green-400 font-bold">₹{reg.amount?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${reg.payment_status === 'paid' ? 'bg-green-600' : 'bg-yellow-600'} text-white`}>
                            {reg.payment_status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {reg.payment_status !== 'paid' ? (
                            <button
                              onClick={async () => {
                                const paymentId = prompt("Enter Razorpay Payment/Transaction ID:");
                                if (paymentId) {
                                  try {
                                    await axios.post(`${API}/admin/registrations/${reg.id}/mark-paid`, {
                                      payment_id: paymentId,
                                      amount: reg.amount
                                    });
                                    alert("Payment marked as confirmed!");
                                    fetchRegistrations();
                                  } catch (err) {
                                    alert("Error marking payment");
                                  }
                                }
                              }}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                            >
                              Mark Paid
                            </button>
                          ) : (
                            <span className="text-green-400 text-xs">✓ Confirmed</span>
                          )}
                          <button
                            onClick={async () => {
                              if(window.confirm('Delete this registration record?')) {
                                try {
                                  await axios.delete(`${API}/admin/registrations/${reg.id}`);
                                  fetchRegistrations();
                                } catch (err) {
                                  alert("Error deleting registration");
                                }
                              }
                            }}
                            className="ml-2 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {registrations.length === 0 && (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400">No registrations yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-bold text-white">Payment History</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Amount</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id} className="border-t border-gray-700">
                      <td className="px-4 py-3 text-white">{pay.timestamp?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-green-400 font-bold">₹{pay.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{pay.payment_type}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{pay.payment_mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && <div className="text-center py-12 text-gray-400">No payments recorded</div>}
            </div>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Create Staff Account</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Custom Staff ID (Optional)</label>
                <input type="text" value={newStaffForm.custom_staff_id} onChange={(e) => setNewStaffForm({...newStaffForm, custom_staff_id: e.target.value})} placeholder="e.g., ASR2001 (leave blank for auto)" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
                <p className="text-gray-500 text-xs mt-1">Leave empty for auto-generated ID</p>
              </div>
              <input type="text" value={newStaffForm.name} onChange={(e) => setNewStaffForm({...newStaffForm, name: e.target.value})} placeholder="Name *" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <input type="tel" value={newStaffForm.phone} onChange={(e) => setNewStaffForm({...newStaffForm, phone: e.target.value})} placeholder="Phone *" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <input type="email" value={newStaffForm.email} onChange={(e) => setNewStaffForm({...newStaffForm, email: e.target.value})} placeholder="Email" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <select value={newStaffForm.role} onChange={(e) => setNewStaffForm({...newStaffForm, role: e.target.value})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg">
                {STAFF_ROLES.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
              <input type="text" value={newStaffForm.password} onChange={(e) => setNewStaffForm({...newStaffForm, password: e.target.value})} placeholder="Password" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={createStaffAccount} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold">Create</button>
              <button onClick={() => setShowStaffModal(false)} className="px-6 py-2 bg-gray-700 text-white rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Assign Task</h2>
            <div className="space-y-4">
              <select value={taskForm.staff_id} onChange={(e) => setTaskForm({...taskForm, staff_id: e.target.value})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg">
                <option value="">Select Staff</option>
                {staffAccounts.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>))}
              </select>
              <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} placeholder="Task Title" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <textarea value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} placeholder="Description" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-20 resize-none" />
              <div className="grid grid-cols-2 gap-4">
                <select value={taskForm.task_type} onChange={(e) => setTaskForm({...taskForm, task_type: e.target.value})} className="bg-gray-700 text-white px-4 py-2 rounded-lg">
                  {TASK_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                </select>
                <select value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})} className="bg-gray-700 text-white px-4 py-2 rounded-lg">
                  <option value="high">High Priority</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <select value={taskForm.lead_id} onChange={(e) => setTaskForm({...taskForm, lead_id: e.target.value})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg">
                <option value="">Link to Lead (Optional)</option>
                {leads.map((l) => (<option key={l.id} value={l.id}>{l.name} - {l.district}</option>))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})} className="bg-gray-700 text-white px-4 py-2 rounded-lg" />
                <input type="time" value={taskForm.due_time} onChange={(e) => setTaskForm({...taskForm, due_time: e.target.value})} className="bg-gray-700 text-white px-4 py-2 rounded-lg" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={createTask} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">Assign Task</button>
              <button onClick={() => setShowTaskModal(false)} className="px-6 py-2 bg-gray-700 text-white rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2"><Camera className="w-5 h-5 text-green-400" /><span>Upload Work Photo</span></h2>
            <div className="space-y-4">
              <input type="text" value={photoForm.title} onChange={(e) => setPhotoForm({...photoForm, title: e.target.value})} placeholder="Photo Title *" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              
              {/* File Upload from Gallery - Mobile Optimized */}
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="image/*"
                  multiple
                  className="hidden" 
                />
                <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold mb-3">
                  <Image className="w-5 h-5 inline mr-2" />Select Photos from Gallery
                </button>
                <p className="text-gray-400 text-sm">Choose photos from gallery or storage (multiple selection supported)</p>
                {photoFiles.length > 1 && (
                  <p className="text-green-400 text-sm mt-2">{photoFiles.length} photos selected</p>
                )}
                <p className="text-gray-500 text-xs mt-1">or paste image URL below</p>
              </div>
              
              <input type="url" value={photoForm.image_url} onChange={(e) => setPhotoForm({...photoForm, image_url: e.target.value})} placeholder="Image URL (optional if file selected)" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <input type="text" value={photoForm.location} onChange={(e) => setPhotoForm({...photoForm, location: e.target.value})} placeholder="Location (e.g., Patna)" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <input type="text" value={photoForm.system_size} onChange={(e) => setPhotoForm({...photoForm, system_size: e.target.value})} placeholder="System Size (e.g., 5kW)" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              <textarea value={photoForm.description} onChange={(e) => setPhotoForm({...photoForm, description: e.target.value})} placeholder="Description" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-20 resize-none" />
              
              {(photoPreview || photoForm.image_url) && (
                <div className="mt-4">
                  <p className="text-gray-400 text-sm mb-2">Preview:</p>
                  <img src={photoPreview || photoForm.image_url} alt="Preview" className="w-full h-40 object-cover rounded-lg" onError={(e) => e.target.style.display='none'} />
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={uploadPhoto} disabled={uploading} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center space-x-2">
                {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span>{uploading ? "Uploading..." : photoFiles.length > 1 ? `Upload ${photoFiles.length} Photos` : "Upload to Gallery"}</span>
              </button>
              <button onClick={() => { setShowPhotoUploadModal(false); setPhotoPreview(''); setPhotoFile(null); setPhotoFiles([]); }} className="px-6 py-3 bg-gray-700 text-white rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full my-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-green-400" />
              <span>Add New Lead</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Customer Details */}
              <div className="space-y-3">
                <h3 className="text-gray-400 text-sm font-semibold border-b border-gray-700 pb-1">Customer Details</h3>
                <input 
                  type="text" 
                  value={newLeadForm.name} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, name: e.target.value})} 
                  placeholder="Customer Name *" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  data-testid="lead-name-input"
                />
                <input 
                  type="tel" 
                  value={newLeadForm.phone} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, phone: e.target.value})} 
                  placeholder="Phone Number *" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  data-testid="lead-phone-input"
                />
                <input 
                  type="email" 
                  value={newLeadForm.email} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, email: e.target.value})} 
                  placeholder="Email (Optional)" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
                <select 
                  value={newLeadForm.district} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, district: e.target.value})} 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  data-testid="lead-district-select"
                >
                  <option value="">Select District</option>
                  {districts.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
                <input 
                  type="text" 
                  value={newLeadForm.address} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, address: e.target.value})} 
                  placeholder="Full Address" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              
              {/* Property & Requirements */}
              <div className="space-y-3">
                <h3 className="text-gray-400 text-sm font-semibold border-b border-gray-700 pb-1">Property & Requirements</h3>
                <select 
                  value={newLeadForm.property_type} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, property_type: e.target.value})} 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="agricultural">Agricultural</option>
                </select>
                <select 
                  value={newLeadForm.roof_type} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, roof_type: e.target.value})} 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="rcc">RCC (Concrete)</option>
                  <option value="tin">Tin/Metal Sheet</option>
                  <option value="asbestos">Asbestos</option>
                  <option value="tile">Tile</option>
                  <option value="other">Other</option>
                </select>
                <input 
                  type="number" 
                  value={newLeadForm.monthly_bill} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, monthly_bill: e.target.value})} 
                  placeholder="Monthly Electricity Bill (₹)" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
                <input 
                  type="number" 
                  value={newLeadForm.roof_area} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, roof_area: e.target.value})} 
                  placeholder="Roof Area (sq ft)" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
                <select 
                  value={newLeadForm.source} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, source: e.target.value})} 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  data-testid="lead-source-select"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="referral">Referral</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="website">Website</option>
                  <option value="exhibition">Exhibition/Event</option>
                </select>
              </div>
              
              {/* Notes - Full Width */}
              <div className="md:col-span-2">
                <textarea 
                  value={newLeadForm.notes} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, notes: e.target.value})} 
                  placeholder="Additional Notes (requirements, special requests, etc.)" 
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-24 resize-none"
                  data-testid="lead-notes-input"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={createManualLead} 
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:from-green-600 hover:to-emerald-700 transition"
                data-testid="create-lead-btn"
              >
                <Plus className="w-5 h-5" />
                <span>Create Lead</span>
              </button>
              <button 
                onClick={() => setShowAddLeadModal(false)} 
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Lead Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-green-400" />
              <span>Quick Add Lead</span>
            </h2>
            <div className="space-y-3">
              <input 
                type="text" 
                value={quickLeadForm.name} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, name: e.target.value})} 
                placeholder="Customer Name *" 
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                data-testid="quick-lead-name"
              />
              <input 
                type="tel" 
                value={quickLeadForm.phone} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, phone: e.target.value})} 
                placeholder="Phone Number *" 
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                data-testid="quick-lead-phone"
              />
              <select 
                value={quickLeadForm.district} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, district: e.target.value})} 
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="">Select District (Optional)</option>
                {districts.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <select 
                value={quickLeadForm.source} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, source: e.target.value})} 
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="manual">Manual Entry</option>
                <option value="walk_in">Walk-in</option>
                <option value="phone_call">Phone Call</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={createQuickLead} 
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"
                data-testid="quick-create-btn"
              >
                <Plus className="w-5 h-5" />
                <span>Add Lead</span>
              </button>
              <button 
                onClick={() => setShowQuickAddModal(false)} 
                className="px-6 py-3 bg-gray-700 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-orange-400" />
              <span>Bulk Import Leads</span>
            </h2>
            
            {!bulkImportResult ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <input 
                    type="file" 
                    ref={bulkFileInputRef}
                    accept=".csv"
                    onChange={(e) => setBulkImportFile(e.target.files[0])}
                    className="hidden" 
                  />
                  <FileSpreadsheet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <button 
                    onClick={() => bulkFileInputRef.current?.click()} 
                    className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium mb-2"
                  >
                    Select CSV File
                  </button>
                  {bulkImportFile && (
                    <p className="text-green-400 text-sm mt-2">{bulkImportFile.name}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-2">CSV file with columns: name, phone, email, district, etc.</p>
                </div>
                
                <button 
                  onClick={downloadCSVTemplate} 
                  className="w-full bg-gray-700 text-gray-300 py-2 rounded-lg text-sm flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV Template</span>
                </button>

                <div className="flex space-x-3 mt-4">
                  <button 
                    onClick={handleBulkImport} 
                    disabled={!bulkImportFile || bulkImporting}
                    className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {bulkImporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <span>{bulkImporting ? "Importing..." : "Import Leads"}</span>
                  </button>
                  <button 
                    onClick={() => { setShowBulkImportModal(false); setBulkImportFile(null); setBulkImportResult(null); }} 
                    className="px-6 py-3 bg-gray-700 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${bulkImportResult.imported_count > 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <p className="text-lg font-semibold text-white mb-2">{bulkImportResult.message}</p>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-green-400">Imported: {bulkImportResult.imported_count}</span>
                    <span className="text-red-400">Errors: {bulkImportResult.error_count}</span>
                  </div>
                </div>
                
                {bulkImportResult.errors?.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-red-400 text-sm font-semibold mb-2">Errors:</p>
                    {bulkImportResult.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-gray-400 text-xs">Row {err.row}: {err.error}</p>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => { setShowBulkImportModal(false); setBulkImportFile(null); setBulkImportResult(null); }} 
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
