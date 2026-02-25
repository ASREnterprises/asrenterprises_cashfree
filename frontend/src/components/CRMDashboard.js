import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Users, ClipboardList, TrendingUp, Calendar, 
  Phone, Mail, MapPin, DollarSign, CheckCircle, Clock, 
  AlertCircle, Sparkles, RefreshCw, Plus, Search, Filter,
  UserPlus, PhoneCall, FileText, Wrench, CreditCard, BarChart3,
  Send, ChevronRight, Edit, Trash2, Eye, MessageSquare, Key, Copy,
  Image, Upload, Camera, ListTodo, MessageCircle, Activity, Zap, FileSpreadsheet, Download, Star, Shield
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Memoized Testimonials Tab Component
const TestimonialsTab = memo(() => {
  const [testimonials, setTestimonials] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', solar_capacity: '', bill_before: '', bill_after: '0', rating: 5 });
  const [loading, setLoading] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/reviews`);
      setTestimonials(res.data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const generateTestimonial = async () => {
    if (!form.name || !form.address || !form.solar_capacity) return alert("Name, Address & Solar Capacity required");
    setLoading(true);
    try {
      await axios.post(`${API}/crm/generate-testimonial`, form);
      setForm({ name: '', address: '', solar_capacity: '', bill_before: '', bill_after: '0', rating: 5 });
      fetchTestimonials();
    } catch (err) { alert("Error generating testimonial"); }
    setLoading(false);
  };

  const deleteTestimonial = async (id) => {
    if (!window.confirm('Delete this testimonial?')) return;
    try {
      await axios.delete(`${API}/admin/reviews/${id}`);
      fetchTestimonials();
    } catch (err) { alert("Error deleting"); }
  };

  return (
    <div className="space-y-6">
      {/* Generator */}
      <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#0a355e] mb-4 flex items-center"><Star className="w-5 h-5 mr-2 text-amber-400" />Generate Customer Testimonial</h3>
        <p className="text-gray-600 text-sm mb-4">Fill in customer details to auto-generate a testimonial. It will appear on the website automatically.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <input type="text" placeholder="Customer Name *" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg" data-testid="testimonial-name" />
          <input type="text" placeholder="Address/Location *" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg" data-testid="testimonial-address" />
          <input type="text" placeholder="Solar Capacity (kW) *" value={form.solar_capacity} onChange={(e) => setForm({...form, solar_capacity: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg" data-testid="testimonial-capacity" />
          <input type="number" placeholder="Bill Before Solar (₹)" value={form.bill_before} onChange={(e) => setForm({...form, bill_before: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg" data-testid="testimonial-bill" />
          <input type="number" placeholder="Bill After Solar (₹)" value={form.bill_after} onChange={(e) => setForm({...form, bill_after: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg" />
          <select value={form.rating} onChange={(e) => setForm({...form, rating: parseInt(e.target.value)})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg">
            <option value={5}>5 Stars</option><option value={4}>4 Stars</option><option value={3}>3 Stars</option>
          </select>
        </div>
        <button onClick={generateTestimonial} disabled={loading} className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-[#0a355e] px-6 py-3 rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50" data-testid="generate-testimonial-btn">
          {loading ? 'Generating...' : 'Generate & Publish Testimonial'}
        </button>
      </div>

      {/* Existing Testimonials */}
      <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#0a355e] mb-4">Published Testimonials ({testimonials.length})</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {testimonials.map((t) => (
            <div key={t.id} className="bg-gray-50 border border-gray-300/50 rounded-lg p-4 flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-bold text-[#0a355e]">{t.customer_name}</span>
                  <span className="text-gray-600 text-xs">{t.location}</span>
                  {t.is_testimonial && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded">Auto-generated</span>}
                </div>
                <div className="flex mb-1">{[...Array(5)].map((_, i) => (<Star key={i} className={`w-3 h-3 ${i < (t.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />))}</div>
                <p className="text-gray-600 text-sm">{t.review_text?.substring(0, 120)}...</p>
                {t.solar_capacity && <p className="text-amber-400 text-xs mt-1">{t.solar_capacity} kW | ₹{t.monthly_bill_before} → ₹{t.monthly_bill_after || '0'}</p>}
              </div>
              <button onClick={() => deleteTestimonial(t.id)} className="text-red-400 hover:text-red-300 p-1 ml-3"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {testimonials.length === 0 && <p className="text-gray-600 text-center py-8">No testimonials yet. Generate one above!</p>}
        </div>
      </div>
    </div>
  );
});

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
  const ASR_LOGO = "/asr_logo_dark.png";
  
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

  useEffect(() => { 
    // Load only essential data first (dashboard stats)
    fetchDashboardData();
    fetchDistricts(); 
    fetchGalleryPhotos(); // Load gallery photos for admin
  }, []);
  
  // Load tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === "leads") fetchLeads();
    if (activeTab === "tasks") fetchTasks();
    if (activeTab === "team") fetchStaff();
    if (activeTab === "messages") fetchMessages();
  }, [activeTab]);
  
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Use the optimized widget endpoint
      const res = await axios.get(`${API}/crm/widget/stats`);
      setDashboardData(res.data);
    } catch (err) { 
      console.error("Dashboard error:", err);
      // Fallback to regular endpoint
      try {
        const res = await axios.get(`${API}/crm/dashboard`);
        setDashboardData(res.data);
      } catch (e) { console.error("Fallback error:", e); }
    }
    setLoading(false);
  };
  
  const fetchLeads = async () => {
    try {
      const res = await axios.get(`${API}/crm/leads`);
      setLeads(res.data);
    } catch (err) { console.error("Leads error:", err); }
  };
  
  const fetchTasks = async () => {
    try {
      const [tasksRes, followRes] = await Promise.all([
        axios.get(`${API}/crm/tasks`).catch(() => ({ data: [] })),
        axios.get(`${API}/crm/followups`)
      ]);
      setTasks(tasksRes.data || []);
      setFollowups(followRes.data);
    } catch (err) { console.error("Tasks error:", err); }
  };
  
  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API}/admin/staff-accounts`);
      setStaffAccounts(res.data);
    } catch (err) { console.error("Staff error:", err); }
  };
  
  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/crm/messages`);
      setMessages(res.data || []);
    } catch (err) { console.error("Messages error:", err); }
  };
  
  const fetchGalleryPhotos = async () => {
    try {
      const res = await axios.get(`${API}/admin/photos`);
      setGalleryPhotos(res.data || []);
    } catch (err) { console.error("Gallery error:", err); }
  };
  
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
    // Refresh all data
    await Promise.all([
      fetchDashboardData(),
      fetchLeads(),
      fetchTasks(),
      fetchStaff(),
      fetchMessages()
    ]);
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
    if (!messageForm.message.trim() || !messageForm.receiver_id) return;
    try {
      await axios.post(`${API}/crm/messages`, {
        sender_id: "admin",
        sender_name: "Admin",
        sender_type: "admin",
        receiver_id: messageForm.receiver_id,
        message: messageForm.message
      });
      setMessageForm({ ...messageForm, message: '' });
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
      <div className="min-h-screen bg-white shadow-lg flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100">
      {/* Header */}
      <div className="bg-white shadow-lg border border-sky-200 border-b border-sky-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/admin/dashboard" className="text-gray-600 hover:text-[#0a355e]"><ArrowLeft className="w-6 h-6" /></Link>
              <div>
                <h1 className="text-2xl font-bold text-[#0a355e]">ASR CRM System</h1>
                <p className="text-gray-600 text-sm">Manage leads, staff & operations</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={fetchAllData} className="bg-blue-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" /><span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-lg border border-sky-200 border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
              { id: "leads", label: "Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "tasks", label: "Tasks", icon: <ListTodo className="w-4 h-4" /> },
              { id: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
              { id: "credentials", label: "Credentials", icon: <Key className="w-4 h-4" /> },
              { id: "messages", label: "Messages", icon: <MessageCircle className="w-4 h-4" /> }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${activeTab === tab.id ? "bg-blue-600 text-[#0a355e]" : "text-gray-600 hover:bg-gray-50 border border-gray-300"}`}>
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
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-[#0a355e]">
                <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboardData.total_leads || 0}</div>
                <div className="text-blue-200 text-sm">Total Leads</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-[#0a355e]">
                <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboardData.pipeline_stats?.completed || 0}</div>
                <div className="text-green-200 text-sm">Completed</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-5 text-[#0a355e]">
                <Users className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{staffAccounts.length}</div>
                <div className="text-yellow-200 text-sm">Staff Members</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-[#0a355e]">
                <DollarSign className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">₹{((dashboardData.total_revenue || 0) / 1000).toFixed(0)}K</div>
                <div className="text-purple-200 text-sm">Revenue</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-[#0a355e] mb-4">Pipeline Overview</h2>
                <div className="space-y-3">
                  {PIPELINE_STAGES.map((stage) => (
                    <div key={stage.id} className="flex items-center justify-between">
                      <span className="text-gray-600">{stage.label}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-gray-50 border border-gray-300 rounded-full h-2">
                          <div className={`${stage.color} h-2 rounded-full`} style={{ width: `${Math.min(100, ((dashboardData.pipeline_stats?.[stage.id] || 0) / Math.max(1, dashboardData.total_leads)) * 100)}%` }} />
                        </div>
                        <span className="text-[#0a355e] font-bold w-8">{dashboardData.pipeline_stats?.[stage.id] || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-[#0a355e] mb-4">Recent Leads</h2>
                <div className="space-y-3">
                  {dashboardData.recent_leads?.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between bg-gray-50 border border-gray-300 rounded-lg p-3">
                      <div>
                        <div className="text-[#0a355e] font-medium">{lead.name}</div>
                        <div className="text-gray-600 text-sm">{lead.district}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${lead.ai_priority === 'high' ? 'bg-red-600' : lead.ai_priority === 'medium' ? 'bg-yellow-600' : 'bg-gray-600'} text-[#0a355e]`}>
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
              <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                <option value="">All Stages</option>
                {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowQuickAddModal(true)} className="bg-green-600 text-[#0a355e] px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-green-700 transition" data-testid="quick-add-btn">
                  <Plus className="w-4 h-4" /><span>Quick Add</span>
                </button>
                <button onClick={() => setShowAddLeadModal(true)} className="bg-blue-600 text-[#0a355e] px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-blue-700 transition" data-testid="add-lead-btn">
                  <UserPlus className="w-4 h-4" /><span>Full Form</span>
                </button>
                <button onClick={() => setShowBulkImportModal(true)} className="bg-orange-600 text-[#0a355e] px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-orange-700 transition" data-testid="bulk-import-btn">
                  <Upload className="w-4 h-4" /><span>CSV Import</span>
                </button>
                <button onClick={fetchSocialLeads} className="bg-gradient-to-r from-green-500 to-teal-500 text-[#0a355e] px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-green-600 hover:to-teal-600 transition" data-testid="fetch-social-btn">
                  <Download className="w-4 h-4" /><span>Fetch Social Leads</span>
                </button>
                <button onClick={autoAssignAllLeads} className="bg-gradient-to-r from-purple-600 to-pink-600 text-[#0a355e] px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-purple-700 hover:to-pink-700 transition" data-testid="auto-assign-all-btn">
                  <Zap className="w-4 h-4" /><span>AI Auto-Assign</span>
                </button>
              </div>
            </div>
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border border-gray-300">
                  <tr>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Contact</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Source</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Stage</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Assign To</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.filter(l => !filterStage || l.stage === filterStage).map((lead) => (
                    <tr key={lead.id} className="border-t border-sky-200">
                      <td className="px-4 py-3">
                        <div className="text-[#0a355e] font-medium">{lead.name}</div>
                        <div className="text-gray-600 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          lead.source === 'whatsapp' ? 'bg-green-600' : 
                          lead.source === 'facebook' ? 'bg-blue-600' : 
                          lead.source === 'website' ? 'bg-purple-600' : 
                          lead.source === 'registration' ? 'bg-orange-600' : 'bg-gray-600'
                        } text-[#0a355e]`}>
                          {lead.source?.toUpperCase() || 'MANUAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={lead.stage} onChange={(e) => updateLeadStage(lead.id, e.target.value)} className="bg-gray-50 border border-gray-300 text-[#0a355e] text-sm px-2 py-1 rounded">
                          {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={lead.assigned_to || ''} onChange={(e) => { if(e.target.value) assignLeadToStaff(lead.id, e.target.value); }} className="bg-gray-50 border border-gray-300 text-[#0a355e] text-sm px-2 py-1 rounded">
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
              <button onClick={() => setShowTaskModal(true)} className="bg-green-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2">
                <Plus className="w-4 h-4" /><span>Assign Task</span>
              </button>
            </div>
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border border-gray-300">
                  <tr>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Task</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Assigned To</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Due Date</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Priority</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-sky-200">
                      <td className="px-4 py-3">
                        <div className="text-[#0a355e] font-medium">{task.title}</div>
                        <div className="text-gray-600 text-sm">{task.task_type} {task.lead_name && `• ${task.lead_name}`}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{task.staff_name}</td>
                      <td className="px-4 py-3 text-gray-600">{task.due_date} {task.due_time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${task.priority === 'high' ? 'bg-red-600' : task.priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'} text-[#0a355e]`}>{task.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${task.status === 'completed' ? 'bg-green-600' : task.status === 'in_progress' ? 'bg-blue-600' : 'bg-gray-600'} text-[#0a355e]`}>{task.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.length === 0 && <div className="text-center py-12 text-gray-600">No tasks assigned yet</div>}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0a355e]">Team Management</h2>
                <p className="text-gray-500 text-sm">Staff auto-synced from HR Management</p>
              </div>
              <a href="/admin/hr" className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-semibold hover:from-blue-600 hover:to-cyan-600 transition">
                <UserPlus className="w-4 h-4" /><span>Add via HR</span>
              </a>
            </div>
            
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-blue-800 font-semibold text-sm">Staff accounts are managed via HR Management</p>
                <p className="text-blue-600 text-xs mt-1">New employees added in HR are automatically synced here. Go to <a href="/admin/hr" className="underline">HR Management</a> to add new team members.</p>
              </div>
            </div>

            {newStaffCredentials && (
              <div className="bg-green-600 bg-opacity-20 border border-green-500 rounded-xl p-4">
                <h3 className="text-green-400 font-bold">New Staff Created!</h3>
                <p className="text-[#0a355e]">Staff ID: <strong>{newStaffCredentials.staff_id}</strong></p>
                <p className="text-[#0a355e]">Password: <strong>{newStaffCredentials.password}</strong></p>
                <button onClick={() => { navigator.clipboard.writeText(`ID: ${newStaffCredentials.staff_id}\nPassword: ${newStaffCredentials.password}`); alert('Copied!'); }} className="mt-2 bg-green-600 text-[#0a355e] px-3 py-1 rounded text-sm">Copy</button>
                <button onClick={() => setNewStaffCredentials(null)} className="ml-2 text-gray-600 text-sm">Dismiss</button>
              </div>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffAccounts.map((staff) => (
                <div key={staff.id} className="bg-white shadow-lg border border-sky-200 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">{staff.name?.[0]}</div>
                      <div>
                        <div className="text-[#0a355e] font-bold">{staff.name}</div>
                        <div className="text-cyan-600 text-sm font-mono">{staff.staff_id}</div>
                        <div className="text-gray-500 text-xs capitalize">{staff.role}</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      const newStatus = !staff.is_active;
                      await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/toggle-status`, { is_active: newStatus });
                      fetchAllData();
                    }} className={`px-2 py-1 rounded text-xs text-white ${staff.is_active ? 'bg-green-500' : 'bg-red-500'}`}>
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                      <div className="text-blue-600 font-bold">{staff.leads_assigned || 0}</div>
                      <div className="text-gray-500 text-xs">Assigned</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                      <div className="text-green-600 font-bold">{staff.leads_converted || 0}</div>
                      <div className="text-gray-500 text-xs">Converted</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                      <div className="text-amber-600 font-bold">₹{((staff.total_revenue || 0) / 1000).toFixed(0)}K</div>
                      <div className="text-gray-500 text-xs">Revenue</div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={async () => {
                      const newPass = prompt('New password:', 'asr@123');
                      if(newPass) { await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/reset-password`, { password: newPass }); alert('Password updated!'); }
                    }} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition">
                      <Key className="w-3 h-3" /><span>Password</span>
                    </button>
                    <button onClick={() => sendWhatsApp(staff.phone, 'Hi, this is Admin from ASR Enterprises...')} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition">
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
                    }} className="flex-1 bg-blue-600 text-[#0a355e] py-2 rounded-lg text-sm flex items-center justify-center space-x-1">
                      <Edit className="w-3 h-3" /><span>Edit</span>
                    </button>
                    <button onClick={async () => {
                      if(window.confirm(`Delete staff member "${staff.name}" (${staff.staff_id})? This cannot be undone.`)) {
                        await axios.delete(`${API}/admin/staff-accounts/${staff.staff_id}`);
                        alert('Staff deleted!');
                        fetchAllData();
                      }
                    }} className="flex-1 bg-red-600 text-[#0a355e] py-2 rounded-lg text-sm flex items-center justify-center space-x-1">
                      <Trash2 className="w-3 h-3" /><span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credentials Management Tab */}
        {activeTab === "credentials" && (
          <div className="space-y-6">
            {/* Admin Credentials */}
            <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
                <h3 className="font-bold text-[#0a355e] flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-amber-500" />
                  Admin Credentials
                </h3>
                <p className="text-gray-500 text-sm mt-1">Manage admin login access</p>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl">A</div>
                    <div>
                      <div className="font-bold text-[#0a355e]">Admin Account</div>
                      <div className="text-gray-500 text-sm">asrenterprisespatna@gmail.com</div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newPass = prompt('Enter new admin password (min 6 chars):');
                      if (newPass && newPass.length >= 6) {
                        try {
                          await axios.post(`${API}/admin/set-password`, { 
                            user_id: 'asrenterprisespatna@gmail.com', 
                            password: newPass,
                            role: 'admin'
                          });
                          alert('Admin password updated successfully!');
                        } catch (err) {
                          alert('Error updating password');
                        }
                      } else if (newPass) {
                        alert('Password must be at least 6 characters');
                      }
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition"
                  >
                    <Key className="w-4 h-4" />
                    <span>Change Password</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Staff Credentials */}
            <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#0a355e] flex items-center">
                    <Users className="w-5 h-5 mr-2 text-blue-500" />
                    Staff Credentials
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">Auto-synced from HR Management</p>
                </div>
                <button
                  onClick={() => fetchAllData()}
                  className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-sm hover:bg-blue-200 transition flex items-center space-x-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="p-5">
                {staffAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No staff accounts found</p>
                    <a href="/admin/hr" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Add employees via HR Management →</a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staffAccounts.map((staff) => (
                      <div key={staff.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                            {staff.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[#0a355e]">{staff.name}</div>
                            <div className="text-gray-500 text-sm flex items-center space-x-2">
                              <span className="font-mono">{staff.staff_id}</span>
                              <span>•</span>
                              <span className="capitalize">{staff.role}</span>
                              <span>•</span>
                              <span>{staff.phone}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${staff.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {staff.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={async () => {
                              const action = window.confirm(`Generate new password for ${staff.name}?`);
                              if (action) {
                                const newPass = `asr${Math.random().toString(36).slice(-6)}`;
                                try {
                                  await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/reset-password`, { password: newPass });
                                  alert(`New Password for ${staff.name}:\n\nStaff ID: ${staff.staff_id}\nPassword: ${newPass}\n\nCopy this and share with the staff member.`);
                                } catch (err) {
                                  alert('Error generating password');
                                }
                              }
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center space-x-1 transition"
                          >
                            <Key className="w-3 h-3" />
                            <span>Generate</span>
                          </button>
                          <button
                            onClick={async () => {
                              const newPass = prompt(`Set password for ${staff.name}:`, 'asr@123');
                              if (newPass) {
                                try {
                                  await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/reset-password`, { password: newPass });
                                  alert('Password updated successfully!');
                                } catch (err) {
                                  alert('Error updating password');
                                }
                              }
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center space-x-1 transition"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Set</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Remove login access for ${staff.name}? They will no longer be able to login.`)) {
                                try {
                                  await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/toggle-status`, { is_active: false });
                                  fetchAllData();
                                  alert('Login access removed');
                                } catch (err) {
                                  alert('Error removing access');
                                }
                              }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center space-x-1 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Login Information
              </h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Staff can login using their <strong>Staff ID</strong>, <strong>Email</strong>, or <strong>Phone Number</strong> as username</li>
                <li>• New staff accounts are automatically created when employees are added in HR Management</li>
                <li>• Default password for new staff: <code className="bg-blue-100 px-1 rounded">asr@123</code></li>
                <li>• Sessions auto-expire after 20 minutes of inactivity</li>
              </ul>
            </div>
          </div>
        )}

        {/* Messages Tab - Staff-wise Private Conversations */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0a355e] font-bold" data-testid="messages-header">Private Staff Conversations</h3>
                <span className="text-green-400 text-xs flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>End-to-End Private</span>
                </span>
              </div>
              <div className="grid md:grid-cols-4 gap-4">
                {/* Staff List */}
                <div className="space-y-2 border-r border-sky-200 pr-4 max-h-96 overflow-y-auto" data-testid="staff-conversations-list">
                  {staffAccounts.length === 0 && <p className="text-gray-600 text-sm">No staff members yet</p>}
                  {staffAccounts.map((staff) => (
                    <div 
                      key={staff.id}
                      className={`p-3 rounded-lg cursor-pointer transition ${messageForm.receiver_id === staff.id ? 'bg-blue-600' : 'bg-gray-50 border border-gray-300 hover:bg-gray-600'}`}
                      onClick={() => setMessageForm({...messageForm, receiver_id: staff.id})}
                      data-testid={`staff-chat-${staff.staff_id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[#0a355e] font-medium">{staff.name}</span>
                        <span className="text-gray-600 text-xs capitalize">{staff.role}</span>
                      </div>
                      <span className="text-gray-600 text-xs">{staff.staff_id}</span>
                    </div>
                  ))}
                </div>
                
                {/* Chat Area */}
                <div className="md:col-span-3">
                  {!messageForm.receiver_id ? (
                    <div className="bg-white shadow-lg rounded-lg border border-sky-200 p-12 text-center text-gray-600">
                      <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg font-medium">Select a staff member to start chatting</p>
                      <p className="text-sm mt-1">Each conversation is private and only visible to you and the selected staff member</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white shadow-lg rounded-lg border border-sky-200 mb-4">
                        <div className="bg-white shadow-lg border border-sky-200 px-4 py-2 border-b border-sky-200 flex items-center justify-between">
                          <span className="text-[#0a355e] font-medium" data-testid="chat-header">
                            Private: {staffAccounts.find(s => s.id === messageForm.receiver_id)?.name || 'Staff'}
                          </span>
                          <span className="text-green-400 text-xs">Only you and {staffAccounts.find(s => s.id === messageForm.receiver_id)?.name} can see this</span>
                        </div>
                        <div className="p-4 h-64 overflow-y-auto" data-testid="admin-chat-messages">
                          {(() => {
                            const conversationMessages = messages.filter(msg => {
                              return (
                                (msg.sender_id === 'admin' && msg.receiver_id === messageForm.receiver_id) ||
                                (msg.sender_id === messageForm.receiver_id && msg.receiver_id === 'admin')
                              );
                            });
                            
                            return conversationMessages.length > 0 ? (
                              <div className="space-y-3">
                                {conversationMessages.map((msg) => (
                                  <div key={msg.id} className={`p-3 rounded-lg relative group ${msg.sender_type === 'admin' ? 'bg-blue-600 bg-opacity-30 ml-12' : 'bg-gray-50 border border-gray-300 mr-12'}`}>
                                    <button 
                                      onClick={async () => {
                                        if(window.confirm('Delete this message?')) {
                                          await axios.delete(`${API}/crm/messages/${msg.id}`);
                                          fetchAllData();
                                        }
                                      }}
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition"
                                      data-testid={`delete-msg-${msg.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="flex justify-between items-start mb-1 pr-6">
                                      <span className={`font-medium text-sm ${msg.sender_type === 'admin' ? 'text-blue-400' : 'text-green-400'}`}>
                                        {msg.sender_name}
                                      </span>
                                      <span className="text-gray-600 text-xs">{new Date(msg.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p className="text-gray-200">{msg.message}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12 text-gray-600">
                                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No messages yet</p>
                                <p className="text-xs mt-1 text-gray-600">Start a private conversation</p>
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
                          placeholder={`Private message to ${staffAccounts.find(s => s.id === messageForm.receiver_id)?.name || 'staff'}...`}
                          className="flex-1 bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg border border-sky-200 focus:border-blue-500 transition" 
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
                          data-testid="admin-message-input"
                        />
                        <button onClick={sendMessage} className="bg-blue-600 text-[#0a355e] px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition" data-testid="admin-send-message-btn">
                          <Send className="w-5 h-5" /><span>Send</span>
                        </button>
                      </div>
                      <p className="text-green-400 text-xs mt-2">
                        This is a private conversation. Only you and {staffAccounts.find(s => s.id === messageForm.receiver_id)?.name} can see these messages.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === "gallery" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#0a355e]">Work Photos Gallery</h2>
              <button onClick={() => setShowPhotoUploadModal(true)} className="bg-gradient-to-r from-green-500 to-emerald-600 text-[#0a355e] px-6 py-3 rounded-lg flex items-center space-x-2 font-semibold">
                <Upload className="w-5 h-5" /><span>Upload Photo</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden group">
                  <div className="relative aspect-video">
                    <img src={photo.image_url || photo.imageUrl} alt={photo.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center">
                      <button onClick={async () => { if(window.confirm('Delete?')) { await axios.delete(`${API}/admin/photos/${photo.id}`); fetchAllData(); }}} className="opacity-0 group-hover:opacity-100 bg-red-600 text-[#0a355e] p-2 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-[#0a355e] font-semibold truncate">{photo.title}</h3>
                    <p className="text-gray-600 text-sm truncate">{photo.location || photo.description}</p>
                  </div>
                </div>
              ))}
              {galleryPhotos.length === 0 && (
                <div className="col-span-4 text-center py-16">
                  <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600">No photos yet. Upload your first work photo!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <div key={proj.id} className="bg-white shadow-lg border border-sky-200 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[#0a355e] font-bold">{proj.customer_name}</div>
                    <div className="text-gray-600 text-sm">{proj.location}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${proj.installation_status === 'completed' ? 'bg-green-600' : proj.installation_status === 'in_progress' ? 'bg-blue-600' : 'bg-yellow-600'} text-[#0a355e]`}>{proj.installation_status}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">System</span><span className="text-[#0a355e]">{proj.system_size}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total</span><span className="text-[#0a355e]">₹{proj.total_amount?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Pending</span><span className="text-red-400">₹{proj.pending_amount?.toLocaleString()}</span></div>
                </div>
              </div>
            ))}
            {projects.length === 0 && <div className="col-span-3 text-center py-12 text-gray-600">No projects yet</div>}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            {/* Registration Fee Management */}
            <div className="bg-gradient-to-r from-orange-600 to-yellow-600 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[#0a355e] mb-1">Service Registration Fee</h3>
                  <p className="text-orange-100 text-sm">Current fee charged to customers for solar service registration</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-lg px-4 py-2">
                    <span className="text-[#0a355e]/80 text-sm">Current:</span>
                    <span className="text-[#0a355e] text-2xl font-bold ml-2">₹{registrationFee}</span>
                  </div>
                  <input
                    type="number"
                    value={newRegistrationFee}
                    onChange={(e) => setNewRegistrationFee(e.target.value)}
                    placeholder="New fee"
                    className="bg-white/20 text-[#0a355e] placeholder-white/50 px-4 py-2 rounded-lg w-32"
                  />
                  <button
                    onClick={updateRegistrationFee}
                    className="bg-amber-500 text-[#0a355e] px-4 py-2 rounded-lg font-semibold hover:bg-amber-600 transition"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>

            {/* Paid Registrations */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#0a355e] mb-4">Service Registrations</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border border-gray-300">
                    <tr>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Date</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Customer</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Phone</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Amount</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Status</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="border-t border-sky-200">
                        <td className="px-4 py-3 text-[#0a355e]">{reg.timestamp?.split('T')[0]}</td>
                        <td className="px-4 py-3 text-[#0a355e]">{reg.customer?.name}</td>
                        <td className="px-4 py-3 text-gray-600">{reg.customer?.phone}</td>
                        <td className="px-4 py-3 text-green-400 font-bold">₹{reg.amount?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${reg.payment_status === 'paid' ? 'bg-green-600' : 'bg-yellow-600'} text-[#0a355e]`}>
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
                              className="bg-green-600 text-[#0a355e] px-3 py-1 rounded text-xs hover:bg-green-700"
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
                            className="ml-2 bg-red-600 text-[#0a355e] px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {registrations.length === 0 && (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-600">No registrations yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-sky-200">
                <h3 className="text-lg font-bold text-[#0a355e]">Payment History</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border border-gray-300">
                  <tr>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Amount</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id} className="border-t border-sky-200">
                      <td className="px-4 py-3 text-[#0a355e]">{pay.timestamp?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-green-400 font-bold">₹{pay.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{pay.payment_type}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{pay.payment_mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && <div className="text-center py-12 text-gray-600">No payments recorded</div>}
            </div>
          </div>
        )}

        {/* Testimonials Generator Tab */}
        {activeTab === "testimonials" && (
          <TestimonialsTab />
        )}
      </div>
      {showStaffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Create Staff Account</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-600 text-sm mb-1 block">Custom Staff ID (Optional)</label>
                <input type="text" value={newStaffForm.custom_staff_id} onChange={(e) => setNewStaffForm({...newStaffForm, custom_staff_id: e.target.value})} placeholder="e.g., ASR2001 (leave blank for auto)" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
                <p className="text-gray-600 text-xs mt-1">Leave empty for auto-generated ID</p>
              </div>
              <input type="text" value={newStaffForm.name} onChange={(e) => setNewStaffForm({...newStaffForm, name: e.target.value})} placeholder="Name *" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <input type="tel" value={newStaffForm.phone} onChange={(e) => setNewStaffForm({...newStaffForm, phone: e.target.value})} placeholder="Phone *" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <input type="email" value={newStaffForm.email} onChange={(e) => setNewStaffForm({...newStaffForm, email: e.target.value})} placeholder="Email" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <select value={newStaffForm.role} onChange={(e) => setNewStaffForm({...newStaffForm, role: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                {STAFF_ROLES.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
              <input type="text" value={newStaffForm.password} onChange={(e) => setNewStaffForm({...newStaffForm, password: e.target.value})} placeholder="Password" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={createStaffAccount} className="flex-1 bg-green-600 text-[#0a355e] py-2 rounded-lg font-semibold">Create</button>
              <button onClick={() => setShowStaffModal(false)} className="px-6 py-2 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Assign Task</h2>
            <div className="space-y-4">
              <select value={taskForm.staff_id} onChange={(e) => setTaskForm({...taskForm, staff_id: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                <option value="">Select Staff</option>
                {staffAccounts.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>))}
              </select>
              <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} placeholder="Task Title" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <textarea value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} placeholder="Description" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg h-20 resize-none" />
              <div className="grid grid-cols-2 gap-4">
                <select value={taskForm.task_type} onChange={(e) => setTaskForm({...taskForm, task_type: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                  {TASK_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                </select>
                <select value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                  <option value="high">High Priority</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <select value={taskForm.lead_id} onChange={(e) => setTaskForm({...taskForm, lead_id: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                <option value="">Link to Lead (Optional)</option>
                {leads.map((l) => (<option key={l.id} value={l.id}>{l.name} - {l.district}</option>))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
                <input type="time" value={taskForm.due_time} onChange={(e) => setTaskForm({...taskForm, due_time: e.target.value})} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={createTask} className="flex-1 bg-blue-600 text-[#0a355e] py-2 rounded-lg font-semibold">Assign Task</button>
              <button onClick={() => setShowTaskModal(false)} className="px-6 py-2 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center space-x-2"><Camera className="w-5 h-5 text-green-400" /><span>Upload Work Photo</span></h2>
            <div className="space-y-4">
              <input type="text" value={photoForm.title} onChange={(e) => setPhotoForm({...photoForm, title: e.target.value})} placeholder="Photo Title *" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              
              {/* File Upload from Gallery - Mobile Optimized */}
              <div className="border-2 border-dashed border-sky-200 rounded-lg p-6 text-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="image/*"
                  multiple
                  className="hidden" 
                />
                <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold mb-3">
                  <Image className="w-5 h-5 inline mr-2" />Select Photos from Gallery
                </button>
                <p className="text-gray-600 text-sm">Choose photos from gallery or storage (multiple selection supported)</p>
                {photoFiles.length > 1 && (
                  <p className="text-green-400 text-sm mt-2">{photoFiles.length} photos selected</p>
                )}
                <p className="text-gray-600 text-xs mt-1">or paste image URL below</p>
              </div>
              
              <input type="url" value={photoForm.image_url} onChange={(e) => setPhotoForm({...photoForm, image_url: e.target.value})} placeholder="Image URL (optional if file selected)" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <input type="text" value={photoForm.location} onChange={(e) => setPhotoForm({...photoForm, location: e.target.value})} placeholder="Location (e.g., Patna)" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <input type="text" value={photoForm.system_size} onChange={(e) => setPhotoForm({...photoForm, system_size: e.target.value})} placeholder="System Size (e.g., 5kW)" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <textarea value={photoForm.description} onChange={(e) => setPhotoForm({...photoForm, description: e.target.value})} placeholder="Description" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg h-20 resize-none" />
              
              {(photoPreview || photoForm.image_url) && (
                <div className="mt-4">
                  <p className="text-gray-600 text-sm mb-2">Preview:</p>
                  <img src={photoPreview || photoForm.image_url} alt="Preview" className="w-full h-40 object-cover rounded-lg" onError={(e) => e.target.style.display='none'} />
                </div>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={uploadPhoto} disabled={uploading} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-[#0a355e] py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center space-x-2">
                {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span>{uploading ? "Uploading..." : photoFiles.length > 1 ? `Upload ${photoFiles.length} Photos` : "Upload to Gallery"}</span>
              </button>
              <button onClick={() => { setShowPhotoUploadModal(false); setPhotoPreview(''); setPhotoFile(null); setPhotoFiles([]); }} className="px-6 py-3 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-2xl w-full my-8">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-green-400" />
              <span>Add New Lead</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Customer Details */}
              <div className="space-y-3">
                <h3 className="text-gray-600 text-sm font-semibold border-b border-sky-200 pb-1">Customer Details</h3>
                <input 
                  type="text" 
                  value={newLeadForm.name} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, name: e.target.value})} 
                  placeholder="Customer Name *" 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                  data-testid="lead-name-input"
                />
                <input 
                  type="tel" 
                  value={newLeadForm.phone} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, phone: e.target.value})} 
                  placeholder="Phone Number *" 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                  data-testid="lead-phone-input"
                />
                <input 
                  type="email" 
                  value={newLeadForm.email} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, email: e.target.value})} 
                  placeholder="Email (Optional)" 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                />
                <select 
                  value={newLeadForm.district} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, district: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
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
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                />
              </div>
              
              {/* Property & Requirements */}
              <div className="space-y-3">
                <h3 className="text-gray-600 text-sm font-semibold border-b border-sky-200 pb-1">Property & Requirements</h3>
                <select 
                  value={newLeadForm.property_type} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, property_type: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="agricultural">Agricultural</option>
                </select>
                <select 
                  value={newLeadForm.roof_type} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, roof_type: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
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
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                />
                <input 
                  type="number" 
                  value={newLeadForm.roof_area} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, roof_area: e.target.value})} 
                  placeholder="Roof Area (sq ft)" 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                />
                <select 
                  value={newLeadForm.source} 
                  onChange={(e) => setNewLeadForm({...newLeadForm, source: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
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
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg h-24 resize-none"
                  data-testid="lead-notes-input"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={createManualLead} 
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-[#0a355e] py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:from-green-600 hover:to-emerald-700 transition"
                data-testid="create-lead-btn"
              >
                <Plus className="w-5 h-5" />
                <span>Create Lead</span>
              </button>
              <button 
                onClick={() => setShowAddLeadModal(false)} 
                className="px-6 py-3 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg hover:bg-gray-600 transition"
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
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-green-400" />
              <span>Quick Add Lead</span>
            </h2>
            <div className="space-y-3">
              <input 
                type="text" 
                value={quickLeadForm.name} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, name: e.target.value})} 
                placeholder="Customer Name *" 
                className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                data-testid="quick-lead-name"
              />
              <input 
                type="tel" 
                value={quickLeadForm.phone} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, phone: e.target.value})} 
                placeholder="Phone Number *" 
                className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                data-testid="quick-lead-phone"
              />
              <select 
                value={quickLeadForm.district} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, district: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
              >
                <option value="">Select District (Optional)</option>
                {districts.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <select 
                value={quickLeadForm.source} 
                onChange={(e) => setQuickLeadForm({...quickLeadForm, source: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
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
                className="flex-1 bg-green-600 text-[#0a355e] py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"
                data-testid="quick-create-btn"
              >
                <Plus className="w-5 h-5" />
                <span>Add Lead</span>
              </button>
              <button 
                onClick={() => setShowQuickAddModal(false)} 
                className="px-6 py-3 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg"
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
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-orange-400" />
              <span>Bulk Import Leads</span>
            </h2>
            
            {!bulkImportResult ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-sky-200 rounded-lg p-6 text-center">
                  <input 
                    type="file" 
                    ref={bulkFileInputRef}
                    accept=".csv"
                    onChange={(e) => setBulkImportFile(e.target.files[0])}
                    className="hidden" 
                  />
                  <FileSpreadsheet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <button 
                    onClick={() => bulkFileInputRef.current?.click()} 
                    className="bg-orange-600 text-[#0a355e] px-6 py-2 rounded-lg font-medium mb-2"
                  >
                    Select CSV File
                  </button>
                  {bulkImportFile && (
                    <p className="text-green-400 text-sm mt-2">{bulkImportFile.name}</p>
                  )}
                  <p className="text-gray-600 text-xs mt-2">CSV file with columns: name, phone, email, district, etc.</p>
                </div>
                
                <button 
                  onClick={downloadCSVTemplate} 
                  className="w-full bg-gray-50 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV Template</span>
                </button>

                <div className="flex space-x-3 mt-4">
                  <button 
                    onClick={handleBulkImport} 
                    disabled={!bulkImportFile || bulkImporting}
                    className="flex-1 bg-orange-600 text-[#0a355e] py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {bulkImporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <span>{bulkImporting ? "Importing..." : "Import Leads"}</span>
                  </button>
                  <button 
                    onClick={() => { setShowBulkImportModal(false); setBulkImportFile(null); setBulkImportResult(null); }} 
                    className="px-6 py-3 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${bulkImportResult.imported_count > 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <p className="text-lg font-semibold text-[#0a355e] mb-2">{bulkImportResult.message}</p>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-green-400">Imported: {bulkImportResult.imported_count}</span>
                    <span className="text-red-400">Errors: {bulkImportResult.error_count}</span>
                  </div>
                </div>
                
                {bulkImportResult.errors?.length > 0 && (
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-red-400 text-sm font-semibold mb-2">Errors:</p>
                    {bulkImportResult.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-gray-600 text-xs">Row {err.row}: {err.error}</p>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => { setShowBulkImportModal(false); setBulkImportFile(null); setBulkImportResult(null); }} 
                  className="w-full bg-blue-600 text-[#0a355e] py-3 rounded-lg font-semibold"
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
