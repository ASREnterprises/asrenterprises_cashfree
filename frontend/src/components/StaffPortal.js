import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  User, LogOut, ClipboardList, Calendar, Phone, MapPin,
  CheckCircle, Clock, AlertCircle, MessageSquare, RefreshCw,
  ChevronRight, ChevronUp, FileText, TrendingUp, Bell, Plus, Edit,
  Send, Briefcase, ListTodo, MessageCircle, Activity, Menu, X, ChevronDown, GraduationCap, History, Inbox, Search
} from "lucide-react";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import StaffTraining from "./StaffTraining";
import { SendWhatsAppModal } from "@/components/WhatsAppCRM";
import { WhatsAppInbox } from "@/components/WhatsAppInbox";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "contacted", label: "Contacted", color: "bg-indigo-500" },
  { id: "site_visit", label: "Site Visit", color: "bg-yellow-500" },
  { id: "quotation", label: "Quotation", color: "bg-orange-500" },
  { id: "negotiation", label: "Negotiation", color: "bg-purple-500" },
  { id: "converted", label: "Converted", color: "bg-pink-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "lost", label: "Lost", color: "bg-red-500" }
];

const TASK_TYPES = {
  call: { label: "📞 Call", color: "bg-blue-500" },
  visit: { label: "🏠 Visit", color: "bg-green-500" },
  survey: { label: "📋 Survey", color: "bg-purple-500" },
  installation: { label: "🔧 Installation", color: "bg-orange-500" },
  follow_up: { label: "🔄 Follow Up", color: "bg-yellow-500" },
  other: { label: "📝 Other", color: "bg-gray-500" }
};

export const StaffPortal = () => {
  const [staffData, setStaffData] = useState(null);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPagination, setLeadsPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 150,
    has_next: false,
    has_prev: false
  });
  const [dashboard, setDashboard] = useState(null);
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [updateData, setUpdateData] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [activityForm, setActivityForm] = useState({ activity_type: "note", title: "", description: "" });
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '', district: '', monthly_bill: '', property_type: 'residential', notes: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState(null);
  const [calledLeads, setCalledLeads] = useState(new Set()); // Track called leads locally
  const [callFilter, setCallFilter] = useState('all'); // all, called, uncalled
  const [pipelineStageFilter, setPipelineStageFilter] = useState(null); // Filter leads by pipeline stage
  const [leadSearchQuery, setLeadSearchQuery] = useState(''); // Search leads by name/phone
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // WhatsApp real-time notification state
  const [whatsAppNewMessage, setWhatsAppNewMessage] = useState(null);
  const [showWhatsAppNotification, setShowWhatsAppNotification] = useState(false);
  
  // New leads tracking - Track lead IDs seen previously
  const [seenLeadIds, setSeenLeadIds] = useState(() => {
    const stored = localStorage.getItem('staffSeenLeadIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [previousTotalCount, setPreviousTotalCount] = useState(0);
  
  // WhatsApp Cloud API state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppModalLead, setWhatsAppModalLead] = useState(null);
  const [showLeadWhatsAppHistory, setShowLeadWhatsAppHistory] = useState(false);
  const [leadWhatsAppMessages, setLeadWhatsAppMessages] = useState([]);
  
  // Floating Action Button state
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [quickActionLead, setQuickActionLead] = useState(null);
  
  const navigate = useNavigate();

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 300);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auto-logout callback for staff
  const handleStaffLogout = () => {
    localStorage.removeItem("asrStaffAuth");
    localStorage.removeItem("asrStaffData");
    localStorage.removeItem("asrStaffId");
    localStorage.removeItem("asrStaffName");
  };

  // Auto-logout after 15 minutes of inactivity
  const isStaffAuthenticated = localStorage.getItem("asrStaffAuth") === "true";
  useAutoLogout(isStaffAuthenticated, handleStaffLogout, 'staff');

  useEffect(() => {
    const isAuth = localStorage.getItem("asrStaffAuth");
    const data = localStorage.getItem("asrStaffData");
    if (!isAuth || !data) {
      navigate("/staff/login");
      return;
    }
    setStaffData(JSON.parse(data));
  }, [navigate]);

  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (staffData?.staff_id) fetchAllData();
  }, [staffData]);

  // Auto-sync leads and data every 30 seconds when enabled
  useEffect(() => {
    if (!autoSyncEnabled || !staffData?.staff_id) return;
    
    const syncInterval = setInterval(() => {
      fetchAllData();
      setLastSyncTime(new Date());
    }, 30000); // 30 seconds
    
    return () => clearInterval(syncInterval);
  }, [autoSyncEnabled, staffData?.staff_id, activeTab]);

  const fetchAllData = async (page = leadsPage, forceRefresh = false) => {
    // Don't show loading spinner if we already have data (prevents flash/white screen)
    if (!dashboard && !leads.length) {
      setLoading(true);
    }
    try {
      // Always fetch page 1 first to check for new leads
      const pageToFetch = forceRefresh ? 1 : page;
      
      const [dashRes, leadsRes, followupsRes, tasksRes, msgRes, unreadRes, notifRes] = await Promise.all([
        axios.get(`${API}/staff/${staffData.staff_id}/dashboard`),
        axios.get(`${API}/staff/${staffData.staff_id}/leads?page=${pageToFetch}&limit=250`),
        axios.get(`${API}/staff/${staffData.staff_id}/followups`),
        axios.get(`${API}/staff/${staffData.staff_id}/tasks/today`).catch(() => ({ data: [] })),
        axios.get(`${API}/staff/${staffData.staff_id}/messages`).catch(() => ({ data: [] })),
        axios.get(`${API}/staff/${staffData.staff_id}/messages/unread`).catch(() => ({ data: { count: 0 } })),
        axios.get(`${API}/staff/${staffData.staff_id}/notifications`).catch(() => ({ data: { notifications: [], unread_count: 0 } }))
      ]);
      
      setDashboard(dashRes.data);
      
      // Handle paginated leads response
      const leadsData = leadsRes.data;
      if (leadsData.leads && leadsData.pagination) {
        const fetchedLeads = leadsData.leads;
        const newTotal = leadsData.pagination.total_count;
        
        // Check for new leads
        const currentLeadIds = fetchedLeads.map(l => l.id);
        const newLeadsList = fetchedLeads.filter(l => !seenLeadIds.has(l.id));
        
        // If total count increased, there are new leads
        if (previousTotalCount > 0 && newTotal > previousTotalCount) {
          setNewLeadsCount(prev => prev + (newTotal - previousTotalCount));
          // Auto-switch to page 1 if new leads detected during auto-sync
          if (autoSyncEnabled && pageToFetch !== 1) {
            setLeadsPage(1);
          }
        }
        
        // Mark current leads as seen
        if (currentLeadIds.length > 0) {
          const updatedSeenIds = new Set(seenLeadIds);
          currentLeadIds.forEach(id => updatedSeenIds.add(id));
          setSeenLeadIds(updatedSeenIds);
          localStorage.setItem('staffSeenLeadIds', JSON.stringify([...updatedSeenIds]));
        }
        
        // Mark leads as "new" for visual indicator (within last 2 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const leadsWithNewFlag = fetchedLeads.map(lead => ({
          ...lead,
          isNew: (lead.assigned_at && lead.assigned_at > twoHoursAgo) || !seenLeadIds.has(lead.id)
        }));
        
        setLeads(leadsWithNewFlag);
        setLeadsPagination(leadsData.pagination);
        setPreviousTotalCount(newTotal);
        
        // Update cache
        localStorage.setItem(`staffLeadsCache_${staffData.staff_id}`, JSON.stringify(leadsWithNewFlag));
        localStorage.setItem(`staffLeadsCacheTime_${staffData.staff_id}`, Date.now().toString());
      } else if (Array.isArray(leadsData)) {
        // Old array response format (backwards compatibility)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const leadsWithNewFlag = leadsData.map(lead => ({
          ...lead,
          isNew: (lead.assigned_at && lead.assigned_at > twoHoursAgo) || !seenLeadIds.has(lead.id)
        }));
        setLeads(leadsWithNewFlag);
        setLeadsPagination({
          current_page: 1,
          total_pages: 1,
          total_count: leadsData.length,
          per_page: 150,
          has_next: false,
          has_prev: false
        });
        localStorage.setItem(`staffLeadsCache_${staffData.staff_id}`, JSON.stringify(leadsWithNewFlag));
        localStorage.setItem(`staffLeadsCacheTime_${staffData.staff_id}`, Date.now().toString());
      }
      
      setFollowups(followupsRes.data);
      setTasks(tasksRes.data || []);
      setMessages(msgRes.data || []);
      setUnreadCount(unreadRes.data?.count || 0);
      setNotifications(notifRes.data?.notifications || []);
      setNotifUnread(notifRes.data?.unread_count || 0);
    } catch (err) {
      console.error("Error fetching data:", err);
      // Don't clear existing data on error - keeps the UI stable
    }
    setLoading(false);
  };
  
  // Mark lead as seen (remove new badge)
  const markLeadAsSeen = (leadId) => {
    const updatedSeenIds = new Set(seenLeadIds);
    updatedSeenIds.add(leadId);
    setSeenLeadIds(updatedSeenIds);
    localStorage.setItem('staffSeenLeadIds', JSON.stringify([...updatedSeenIds]));
    
    // Update leads to remove isNew flag
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, isNew: false } : lead
    ));
    
    // Decrease new leads count
    setNewLeadsCount(prev => Math.max(0, prev - 1));
  };
  
  // Change leads page
  const changeLeadsPage = (newPage) => {
    setLeadsPage(newPage);
    fetchAllData(newPage);
  };

  const markNotificationRead = async (notifId) => {
    try {
      await axios.put(`${API}/staff/${staffData.staff_id}/notifications/${notifId}/read`);
      fetchAllData();
    } catch (err) {
      console.error("Error marking notification read");
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.put(`${API}/staff/${staffData.staff_id}/notifications/read-all`);
      fetchAllData();
    } catch (err) {
      console.error("Error marking all read");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("asrStaffAuth");
    localStorage.removeItem("asrStaffData");
    navigate("/staff/login");
  };

  // Quick status update for leads
  const quickUpdateLeadStatus = async (leadId, newStage) => {
    setUpdatingLeadId(leadId);
    try {
      // If marking as "not_interested", transfer lead back to CRM as "contacted" and remove from staff
      if (newStage === 'not_interested') {
        await axios.post(`${API}/staff/${staffData.staff_id}/leads/${leadId}/not-interested`);
        // Add activity log
        await axios.post(`${API}/crm/leads/${leadId}/activities`, {
          staff_id: staffData.staff_id,
          staff_name: staffData.name,
          activity_type: "not_interested",
          title: "Customer Not Interested",
          description: `Lead marked as not interested by ${staffData.name}. Transferred back to CRM.`
        });
      } else {
        await axios.put(`${API}/staff/${staffData.staff_id}/leads/${leadId}`, { stage: newStage });
        // Add activity log
        await axios.post(`${API}/crm/leads/${leadId}/activities`, {
          staff_id: staffData.staff_id,
          staff_name: staffData.name,
          activity_type: "status_change",
          title: `Status changed to ${newStage}`,
          description: `Quick status update by ${staffData.name}`
        });
      }
      fetchAllData();
    } catch (err) {
      alert("Error updating lead status");
    }
    setUpdatingLeadId(null);
  };

  // Mark lead as called and open phone app
  const handleCallLead = async (lead) => {
    // Mark as called locally FIRST to ensure UI updates
    setCalledLeads(prev => new Set([...prev, lead.id]));
    
    // Save to localStorage for persistence (important for when user returns from call)
    const storedCalled = JSON.parse(localStorage.getItem(`calledLeads_${staffData.staff_id}`) || '[]');
    if (!storedCalled.includes(lead.id)) {
      storedCalled.push(lead.id);
      localStorage.setItem(`calledLeads_${staffData.staff_id}`, JSON.stringify(storedCalled));
    }
    
    // Save current leads data to localStorage before navigating away (prevents white screen on return)
    localStorage.setItem(`staffLeadsCache_${staffData.staff_id}`, JSON.stringify(leads));
    localStorage.setItem(`staffLeadsCacheTime_${staffData.staff_id}`, Date.now().toString());
    
    // Log call activity AND mark as called in backend (don't wait for it)
    Promise.all([
      axios.post(`${API}/crm/leads/${lead.id}/activities`, {
        staff_id: staffData.staff_id,
        staff_name: staffData.name,
        activity_type: "call",
        title: "Call Initiated",
        description: `${staffData.name} called ${lead.name} at ${lead.phone}`
      }),
      // Update lead's call_status in backend
      axios.put(`${API}/staff/${staffData.staff_id}/leads/${lead.id}`, { 
        call_status: 'called',
        last_call_at: new Date().toISOString()
      })
    ]).catch(err => console.error("Error logging call:", err));
    
    // Update lead stage to contacted if still new (in background)
    if (lead.stage === 'new') {
      axios.put(`${API}/staff/${staffData.staff_id}/leads/${lead.id}`, { stage: 'contacted' })
        .catch(err => console.error("Error updating stage:", err));
    }
    
    // Clean phone number for calling
    const cleanPhone = lead.phone?.replace(/\D/g, '').replace(/^91/, '');
    
    // Use small timeout to ensure state is saved before navigating
    setTimeout(() => {
      // Simple and reliable - just use tel: link which works on all devices
      window.location.href = `tel:${cleanPhone}`;
    }, 100);
  };

  // Handle new WhatsApp message notification from WhatsAppInbox
  const handleNewWhatsAppMessage = useCallback((messageInfo) => {
    setWhatsAppNewMessage(messageInfo);
    setShowWhatsAppNotification(true);
    // Auto-hide notification after 10 seconds
    setTimeout(() => {
      setShowWhatsAppNotification(false);
    }, 10000);
  }, []);

  // Load called leads and cached leads data from localStorage on mount
  useEffect(() => {
    if (staffData?.staff_id) {
      // Load called leads tracking
      const storedCalled = JSON.parse(localStorage.getItem(`calledLeads_${staffData.staff_id}`) || '[]');
      setCalledLeads(new Set(storedCalled));
      
      // Check if we have cached leads data (from before a call)
      const cachedLeads = localStorage.getItem(`staffLeadsCache_${staffData.staff_id}`);
      const cacheTime = localStorage.getItem(`staffLeadsCacheTime_${staffData.staff_id}`);
      
      // Use cached data if it's less than 5 minutes old and leads array is empty
      if (cachedLeads && cacheTime && leads.length === 0) {
        const cacheAge = Date.now() - parseInt(cacheTime);
        if (cacheAge < 5 * 60 * 1000) { // 5 minutes
          try {
            const parsedLeads = JSON.parse(cachedLeads);
            if (parsedLeads.length > 0) {
              setLeads(parsedLeads);
            }
          } catch (e) {
            console.error("Error parsing cached leads:", e);
          }
        }
      }
    }
  }, [staffData?.staff_id]);

  const updateLead = async () => {
    if (!selectedLead) return;
    try {
      await axios.put(`${API}/staff/${staffData.staff_id}/leads/${selectedLead.id}`, updateData);
      // Add activity log
      if (updateData.stage) {
        await axios.post(`${API}/crm/leads/${selectedLead.id}/activities`, {
          staff_id: staffData.staff_id,
          staff_name: staffData.name,
          activity_type: "status_change",
          title: `Status changed to ${updateData.stage}`,
          description: updateData.follow_up_notes || ""
        });
      }
      setShowUpdateModal(false);
      setSelectedLead(null);
      setUpdateData({});
      fetchAllData();
      alert("Lead updated!");
    } catch (err) {
      alert("Error updating lead");
    }
  };

  const addActivity = async () => {
    if (!selectedLead || !activityForm.title) return;
    try {
      await axios.post(`${API}/crm/leads/${selectedLead.id}/activities`, {
        ...activityForm,
        staff_id: staffData.staff_id,
        staff_name: staffData.name
      });
      setShowActivityModal(false);
      setActivityForm({ activity_type: "note", title: "", description: "" });
      alert("Activity added!");
    } catch (err) {
      alert("Error adding activity");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await axios.post(`${API}/crm/messages`, {
        sender_id: staffData.id,
        sender_name: staffData.name,
        sender_type: "staff",
        receiver_id: "admin",
        message: newMessage
      });
      setNewMessage("");
      fetchAllData();
    } catch (err) {
      alert("Error sending message");
    }
  };

  const createLead = async () => {
    if (!newLeadForm.name.trim() || !newLeadForm.phone.trim()) {
      alert("Name and Phone are required");
      return;
    }
    try {
      await axios.post(`${API}/staff/${staffData.staff_id}/leads`, newLeadForm);
      setShowAddLeadModal(false);
      setNewLeadForm({ name: '', phone: '', district: '', monthly_bill: '', property_type: 'residential', notes: '' });
      fetchAllData();
    } catch (err) {
      alert("Error creating lead");
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await axios.put(`${API}/crm/tasks/${taskId}`, { status });
      fetchAllData();
    } catch (err) {
      alert("Error updating task");
    }
  };

  // Open WhatsApp CRM for a lead - instead of external WhatsApp
  const sendWhatsApp = (phone, message, lead = null) => {
    // If we have a lead, switch to WhatsApp tab and open their conversation
    if (lead) {
      setActiveTab('whatsapp');
      setSelectedWhatsAppLead(lead);
    } else {
      // Fallback to WhatsApp tab
      setActiveTab('whatsapp');
    }
  };
  
  // State for selected WhatsApp lead
  const [selectedWhatsAppLead, setSelectedWhatsAppLead] = useState(null);

  // WhatsApp Cloud API Integration Functions
  const openWhatsAppTemplateModal = (lead) => {
    setWhatsAppModalLead(lead);
    setShowWhatsAppModal(true);
  };

  const fetchLeadWhatsAppHistory = async (leadId) => {
    try {
      const res = await axios.get(`${API}/whatsapp/messages/lead/${leadId}`);
      setLeadWhatsAppMessages(res.data || []);
      setShowLeadWhatsAppHistory(true);
    } catch (err) {
      console.error('Error fetching WhatsApp history:', err);
      setLeadWhatsAppMessages([]);
    }
  };

  if (loading || !staffData) {
    return (
      <div className="min-h-screen bg-white shadow-lg flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayFollowups = followups.filter(f => f.reminder_date === todayStr && f.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100">
      {/* Header */}
      <div className="bg-white shadow-lg border border-sky-200 border-b border-sky-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-[#0a355e] font-bold">
                {staffData.name?.[0]}
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#0a355e]">{staffData.name}</h1>
                <p className="text-gray-500 text-xs">{staffData.staff_id} • {staffData.role}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  className="text-gray-500 hover:text-[#0a355e] relative"
                  data-testid="notifications-bell"
                >
                  <Bell className="w-5 h-5" />
                  {notifUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-[#0a355e] text-xs w-4 h-4 rounded-full flex items-center justify-center">
                      {notifUnread}
                    </span>
                  )}
                </button>
                {/* Notifications Dropdown - Mobile Responsive */}
                {showNotifications && (
                  <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-80 bg-white shadow-lg border border-sky-200 rounded-xl shadow-2xl z-[100] max-h-[70vh] sm:max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-sky-200 flex justify-between items-center sticky top-0 bg-white">
                      <h3 className="font-bold text-[#0a355e]">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {notifUnread > 0 && (
                          <button onClick={markAllNotificationsRead} className="text-xs text-blue-500 hover:text-blue-700">Mark all read</button>
                        )}
                        <button 
                          onClick={() => setShowNotifications(false)} 
                          className="sm:hidden p-1 text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No notifications</div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {notifications.slice(0, 10).map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => { markNotificationRead(notif.id); setShowNotifications(false); if(notif.lead_id) setActiveTab('leads'); }}
                            className={`p-3 cursor-pointer hover:bg-gray-50 ${!notif.is_read ? 'bg-blue-50' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className={`text-sm font-medium ${!notif.is_read ? 'text-[#0a355e]' : 'text-gray-500'}`}>{notif.title}</div>
                              {!notif.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2"></span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Overlay for mobile notification dropdown */}
                {showNotifications && (
                  <div 
                    className="fixed inset-0 bg-black/20 z-[99] sm:hidden" 
                    onClick={() => setShowNotifications(false)}
                  />
                )}
              </div>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-[#0a355e] text-xs px-2 py-1 rounded-full">{unreadCount} msg</span>
              )}
              {newLeadsCount > 0 && (
                <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse font-bold">
                  {newLeadsCount} NEW
                </span>
              )}
              <button onClick={() => fetchAllData(1, true)} className="text-gray-500 hover:text-[#0a355e]" title="Refresh all data"><RefreshCw className="w-5 h-5" /></button>
              <button
                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1 transition ${autoSyncEnabled ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-300'}`}
                title={autoSyncEnabled ? 'Auto-sync ON (every 30s)' : 'Auto-sync OFF'}
                data-testid="auto-sync-toggle"
              >
                <RefreshCw className={`w-3 h-3 ${autoSyncEnabled ? 'animate-spin' : ''}`} style={autoSyncEnabled ? { animationDuration: '3s' } : {}} />
                <span className="hidden sm:inline">{autoSyncEnabled ? 'Sync' : 'Off'}</span>
              </button>
              <button onClick={handleLogout} className="bg-red-600 text-[#0a355e] px-3 py-1.5 rounded-lg text-sm flex items-center space-x-1">
                <LogOut className="w-4 h-4" /><span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation - Mobile Optimized with Sticky Position */}
      <div className="bg-white shadow-lg border-b border-sky-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-2 sm:px-4">
          <div className="flex space-x-1 py-2 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {[
              { id: "dashboard", label: "Dashboard", shortLabel: "Home", icon: <TrendingUp className="w-4 h-4" /> },
              { id: "tasks", label: "Today's Tasks", shortLabel: "Tasks", icon: <ListTodo className="w-4 h-4" /> },
              { id: "leads", label: "My Leads", shortLabel: "Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "whatsapp", label: "WhatsApp", shortLabel: "WA", icon: <Inbox className="w-4 h-4" /> },
              { id: "followups", label: "Follow-ups", shortLabel: "Follow", icon: <Calendar className="w-4 h-4" /> },
              { id: "training", label: "Training", shortLabel: "Train", icon: <GraduationCap className="w-4 h-4" /> },
              { id: "messages", label: "Messages", shortLabel: "Msgs", icon: <MessageCircle className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-sm ${
                  activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
                data-testid={`nav-tab-${tab.id}`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.id === "messages" && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 rounded-full ml-1">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20">
        {/* Dashboard */}
        {activeTab === "dashboard" && dashboard && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-[#0a355e]">
                <ClipboardList className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{dashboard.total_assigned || 0}</div>
                <div className="text-blue-200 text-xs">Assigned Leads</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-[#0a355e]">
                <CheckCircle className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{dashboard.total_converted || 0}</div>
                <div className="text-green-200 text-xs">Converted</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 text-[#0a355e]">
                <Bell className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{todayFollowups.length}</div>
                <div className="text-yellow-200 text-xs">Today's Follow-ups</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 text-[#0a355e]">
                <ListTodo className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</div>
                <div className="text-purple-200 text-xs">Pending Tasks</div>
              </div>
            </div>

            {/* Today's Tasks */}
            {tasks.length > 0 && (
              <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-5">
                <h2 className="text-lg font-bold text-[#0a355e] mb-4 flex items-center"><ListTodo className="w-5 h-5 mr-2 text-blue-400" />Today's Tasks</h2>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded text-xs ${TASK_TYPES[task.task_type]?.color || 'bg-gray-500'} text-[#0a355e]`}>
                          {TASK_TYPES[task.task_type]?.label || task.task_type}
                        </span>
                        <div>
                          <div className="text-[#0a355e] font-medium">{task.title}</div>
                          <div className="text-gray-500 text-sm">{task.lead_name || task.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 text-sm">{task.due_time}</span>
                        {task.status === 'pending' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'completed')} className="bg-green-600 text-[#0a355e] px-3 py-1 rounded text-sm">Done</button>
                        ) : (
                          <span className="text-green-400 text-sm">✓ Done</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Follow-ups */}
            {todayFollowups.length > 0 && (
              <div className="bg-yellow-600 bg-opacity-20 border border-yellow-600 rounded-xl p-5">
                <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center"><Bell className="w-5 h-5 mr-2" />Today's Follow-ups</h2>
                <div className="space-y-3">
                  {todayFollowups.map((fu) => {
                    const lead = leads.find(l => l.id === fu.lead_id);
                    return (
                      <div key={fu.id} className="bg-white shadow-lg border border-sky-200 rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <div className="text-[#0a355e] font-medium">{lead?.name || 'Unknown'}</div>
                          <div className="text-gray-500 text-sm">{fu.reminder_type} • {fu.reminder_time}</div>
                        </div>
                        <div className="flex space-x-2">
                          {lead && (
                            <button onClick={() => sendWhatsApp(lead.phone, '', lead)} className="bg-green-600 text-[#0a355e] px-3 py-1 rounded text-sm">WhatsApp</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pipeline - Mobile Scrollable & Clickable */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-5">
              <h2 className="text-lg font-bold text-[#0a355e] mb-4">My Pipeline</h2>
              <div className="overflow-x-auto pb-2 -mx-2 px-2">
                <div className="flex gap-2 min-w-max sm:grid sm:grid-cols-4 lg:grid-cols-8 sm:min-w-0">
                  {PIPELINE_STAGES.map((stage) => (
                    <button 
                      key={stage.id} 
                      onClick={() => {
                        setActiveTab('leads');
                        setCallFilter('all');
                        setPipelineStageFilter(stage.id);
                      }}
                      className="text-center min-w-[70px] sm:min-w-0 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <div className={`${stage.color} rounded-lg p-3 text-white mb-1 hover:shadow-lg transition-shadow`}>
                        <div className="text-xl font-bold">{dashboard.pipeline_stats?.[stage.id] || 0}</div>
                      </div>
                      <div className="text-gray-500 text-xs truncate">{stage.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">Tap any stage to view those leads</p>
            </div>
          </div>
        )}

        {/* Today's Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#0a355e]">Today's Work List</h2>
            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className={`bg-white shadow-lg border border-sky-200 rounded-xl p-5 border-l-4 ${task.priority === 'high' ? 'border-red-500' : task.priority === 'medium' ? 'border-yellow-500' : 'border-green-500'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs ${TASK_TYPES[task.task_type]?.color || 'bg-gray-500'} text-[#0a355e]`}>
                            {TASK_TYPES[task.task_type]?.label || task.task_type}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${task.priority === 'high' ? 'bg-red-600' : task.priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'} text-[#0a355e]`}>
                            {task.priority} priority
                          </span>
                        </div>
                        <h3 className="text-[#0a355e] font-bold text-lg">{task.title}</h3>
                        <p className="text-gray-500">{task.description}</p>
                        {task.lead_name && <p className="text-blue-400 text-sm mt-1">Lead: {task.lead_name}</p>}
                        <p className="text-gray-500 text-sm mt-2">Due: {task.due_time}</p>
                      </div>
                      <div>
                        {task.status === 'pending' ? (
                          <div className="flex flex-col space-y-2">
                            <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="bg-blue-600 text-[#0a355e] px-4 py-2 rounded-lg text-sm">Start</button>
                            <button onClick={() => updateTaskStatus(task.id, 'completed')} className="bg-green-600 text-[#0a355e] px-4 py-2 rounded-lg text-sm">Complete</button>
                          </div>
                        ) : task.status === 'in_progress' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'completed')} className="bg-green-600 text-[#0a355e] px-4 py-2 rounded-lg text-sm">Complete</button>
                        ) : (
                          <span className="text-green-400 font-medium">✓ Completed</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-12 text-center">
                <ListTodo className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-500">No Tasks for Today</h3>
                <p className="text-gray-500">Check back later or contact admin for assignments</p>
              </div>
            )}
          </div>
        )}

        {/* Leads Tab - Mobile Optimized */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            {/* Header - Mobile Friendly */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0a355e]">
                My Leads ({leadsPagination.total_count || leads.length})
                {leadsPagination.total_pages > 1 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    Page {leadsPagination.current_page} of {leadsPagination.total_pages}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    // Force refresh - clear cache and fetch fresh data
                    localStorage.removeItem(`staffLeadsCache_${staffData.staff_id}`);
                    localStorage.removeItem(`staffLeadsCacheTime_${staffData.staff_id}`);
                    setLeads([]);
                    setLeadsPage(1);
                    fetchAllData(1);
                  }} 
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-2.5 rounded-xl hover:shadow-lg active:scale-95 transition flex items-center gap-1" 
                  title="Refresh Leads"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Refresh</span>
                </button>
                <button onClick={() => setShowAddLeadModal(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-blue-700 active:bg-blue-800 transition text-sm font-medium shadow-md" data-testid="staff-add-lead-btn">
                  <Plus className="w-5 h-5" /><span>Add Lead</span>
                </button>
              </div>
            </div>
            
            {/* Pagination Info Banner */}
            {leadsPagination.total_count > 150 && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="text-blue-700 text-sm font-medium">
                  Showing {leads.length} of {leadsPagination.total_count} total leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeLeadsPage(leadsPagination.current_page - 1)}
                    disabled={!leadsPagination.has_prev}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${leadsPagination.has_prev ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    ← Prev
                  </button>
                  <span className="text-blue-700 text-sm font-bold px-2">
                    {leadsPagination.current_page} / {leadsPagination.total_pages}
                  </span>
                  <button
                    onClick={() => changeLeadsPage(leadsPagination.current_page + 1)}
                    disabled={!leadsPagination.has_next}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${leadsPagination.has_next ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
            
            {/* Last Updated Time */}
            {loading && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-blue-600 text-sm font-medium">Refreshing your leads...</span>
              </div>
            )}
            
            {/* Filter Buttons - Large Touch Targets for Mobile */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setCallFilter('all'); setPipelineStageFilter(null); }}
                className={`py-3 px-2 rounded-xl text-sm font-semibold transition ${callFilter === 'all' && !pipelineStageFilter ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All ({leads.length})
              </button>
              <button
                onClick={() => { setCallFilter('uncalled'); setPipelineStageFilter(null); }}
                className={`py-3 px-2 rounded-xl text-sm font-semibold transition ${callFilter === 'uncalled' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Uncalled ({leads.filter(l => !calledLeads.has(l.id) && l.call_status !== 'called').length})
              </button>
              <button
                onClick={() => { setCallFilter('called'); setPipelineStageFilter(null); }}
                className={`py-3 px-2 rounded-xl text-sm font-semibold transition ${callFilter === 'called' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Called ({leads.filter(l => calledLeads.has(l.id) || l.call_status === 'called').length})
              </button>
            </div>
            
            {/* Search Bar for Staff Leads */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads by name or phone..."
                value={leadSearchQuery}
                onChange={(e) => setLeadSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                data-testid="staff-lead-search"
              />
              {leadSearchQuery && (
                <button 
                  onClick={() => setLeadSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Pipeline Stage Filter Indicator */}
            {pipelineStageFilter && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-purple-700 font-medium">
                  Showing: {PIPELINE_STAGES.find(s => s.id === pipelineStageFilter)?.label || pipelineStageFilter} ({leads.filter(l => l.stage === pipelineStageFilter).length})
                </span>
                <button
                  onClick={() => setPipelineStageFilter(null)}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Clear Filter ×
                </button>
              </div>
            )}

            {/* Quick Stats - Larger for Mobile */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{leads.filter(l => !calledLeads.has(l.id) && l.call_status !== 'called').length}</div>
                <div className="text-sm text-blue-700 font-medium">To Call</div>
              </div>
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{leads.filter(l => calledLeads.has(l.id) || l.call_status === 'called').length}</div>
                <div className="text-sm text-green-700 font-medium">Called</div>
              </div>
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{leads.filter(l => l.stage === 'contacted' || l.stage === 'site_visit').length}</div>
                <div className="text-sm text-orange-700 font-medium">In Progress</div>
              </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow-lg border border-sky-200 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-gray-600 px-3 py-3 text-sm font-semibold w-8">📞</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm font-semibold">Lead</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm font-semibold">Status</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm font-semibold">Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads
                    .filter(lead => {
                      // Pipeline stage filter
                      if (pipelineStageFilter && lead.stage !== pipelineStageFilter) return false;
                      // Call status filter
                      if (callFilter === 'called') return calledLeads.has(lead.id) || lead.call_status === 'called';
                      if (callFilter === 'uncalled') return !calledLeads.has(lead.id) && lead.call_status !== 'called';
                      return true;
                    })
                    // Sort: NEW leads first, then by assigned_at descending
                    .sort((a, b) => {
                      // isNew leads come first
                      if (a.isNew && !b.isNew) return -1;
                      if (!a.isNew && b.isNew) return 1;
                      // Then sort by assigned_at (newest first)
                      const aTime = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
                      const bTime = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
                      return bTime - aTime;
                    })
                    .map((lead) => (
                    <tr key={lead.id} className={`border-t border-gray-100 hover:bg-gray-50 ${calledLeads.has(lead.id) ? 'bg-green-50/50' : ''}`}>
                      <td className="px-3 py-3">
                        {calledLeads.has(lead.id) || lead.call_status === 'called' ? (
                          <span className="text-green-500 text-lg" title="Called">✓</span>
                        ) : (
                          <span className="text-gray-300 text-lg" title="Not Called">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => markLeadAsSeen(lead.id)}>
                        <div className="flex items-center gap-2">
                          <div className="text-[#0a355e] font-medium">{lead.name || 'Unknown'}</div>
                          {lead.isNew && (
                            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 text-sm font-mono">{lead.phone}</div>
                        <div className="text-gray-400 text-xs">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.stage || 'new'}
                          onChange={(e) => quickUpdateLeadStatus(lead.id, e.target.value)}
                          disabled={updatingLeadId === lead.id}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border ${PIPELINE_STAGES.find(s => s.id === lead.stage)?.color || 'bg-gray-100'} text-white cursor-pointer focus:ring-2 focus:ring-blue-300`}
                          data-testid={`lead-status-${lead.id}`}
                        >
                          {PIPELINE_STAGES.map(stage => (
                            <option key={stage.id} value={stage.id} className="text-gray-800 bg-white">{stage.label}</option>
                          ))}
                        </select>
                        {updatingLeadId === lead.id && <span className="ml-2 text-xs text-blue-500">Saving...</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleCallLead(lead)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                            title="Call Customer"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                          <button 
                            onClick={() => sendWhatsApp(lead.phone, '', lead)} 
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                            title="WhatsApp Customer (Direct)"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                          <button 
                            onClick={() => openWhatsAppTemplateModal(lead)} 
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                            title="Send WhatsApp Template"
                            data-testid="staff-whatsapp-template-btn"
                          >
                            <Send className="w-3 h-3" />
                            <span>Template</span>
                          </button>
                          <button 
                            onClick={() => fetchLeadWhatsAppHistory(lead.id)} 
                            className="bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                            title="WhatsApp History"
                            data-testid="staff-whatsapp-history-btn"
                          >
                            <History className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => { setSelectedLead(lead); setUpdateData({ stage: lead.stage }); setShowUpdateModal(true); }} 
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                            title="Update Lead Details"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Update</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Super Touch Friendly */}
            <div className="md:hidden space-y-4">
              {leads
                .filter(lead => {
                  // Search filter
                  if (leadSearchQuery) {
                    const search = leadSearchQuery.toLowerCase();
                    const nameMatch = lead.name?.toLowerCase().includes(search);
                    const phoneMatch = lead.phone?.includes(search);
                    if (!nameMatch && !phoneMatch) return false;
                  }
                  if (pipelineStageFilter && lead.stage !== pipelineStageFilter) return false;
                  if (callFilter === 'called') return calledLeads.has(lead.id) || lead.call_status === 'called';
                  if (callFilter === 'uncalled') return !calledLeads.has(lead.id) && lead.call_status !== 'called';
                  return true;
                })
                // Sort: NEW leads first, then by assigned_at descending
                .sort((a, b) => {
                  // isNew leads come first
                  if (a.isNew && !b.isNew) return -1;
                  if (!a.isNew && b.isNew) return 1;
                  // Then sort by assigned_at (newest first)
                  const aTime = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
                  const bTime = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
                  return bTime - aTime;
                })
                .map((lead) => (
                <div key={lead.id} className={`bg-white shadow-lg border-2 rounded-2xl overflow-hidden ${calledLeads.has(lead.id) ? 'border-green-400 bg-green-50/30' : 'border-sky-200'}`} data-testid={`lead-card-${lead.id}`}>
                  {/* Lead Header with Call Status */}
                  <div className={`px-5 py-4 ${calledLeads.has(lead.id) ? 'bg-green-100' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {calledLeads.has(lead.id) && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1" /> Called
                            </span>
                          )}
                          {lead.isNew && (
                            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                              NEW
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PIPELINE_STAGES.find(s => s.id === lead.stage)?.color || 'bg-gray-500'} text-white`}>
                            {PIPELINE_STAGES.find(s => s.id === lead.stage)?.label || 'New'}
                          </span>
                        </div>
                        <h3 className="text-[#0a355e] font-bold text-xl" onClick={() => markLeadAsSeen(lead.id)}>{lead.name || 'Unknown'}</h3>
                      </div>
                    </div>
                    
                    {/* Phone Number - Large and Tappable */}
                    <a 
                      href={`tel:${lead.phone}`} 
                      className="mt-2 flex items-center gap-2 text-blue-600 font-mono text-xl font-bold underline"
                      onClick={(e) => { e.preventDefault(); handleCallLead(lead); }}
                    >
                      <Phone className="w-5 h-5" />
                      {lead.phone}
                    </a>
                    
                    {/* Lead Details */}
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                      {lead.district && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{lead.district}</span>}
                      {lead.monthly_bill && <span>₹{lead.monthly_bill}/month</span>}
                    </div>
                  </div>
                  
                  {/* Action Buttons - Full Width, Large Touch Targets */}
                  <div className="p-4 space-y-3">
                    {/* Primary Action: Call */}
                    <button 
                      onClick={() => handleCallLead(lead)}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 text-white py-4 rounded-xl text-base flex items-center justify-center space-x-2 transition font-bold shadow-lg"
                      data-testid={`call-btn-${lead.id}`}
                    >
                      <Phone className="w-5 h-5" />
                      <span>Call Now</span>
                    </button>
                    
                    {/* Secondary Actions Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name || ''}, this is ${staffData?.name} from ASR Enterprises regarding your solar inquiry.`)} 
                        className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white py-3.5 rounded-xl text-base flex items-center justify-center space-x-2 transition font-semibold shadow-md"
                        data-testid={`whatsapp-btn-${lead.id}`}
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span>WhatsApp</span>
                      </button>
                      <button 
                        onClick={() => { setSelectedLead(lead); setUpdateData({ stage: lead.stage }); setShowUpdateModal(true); }}
                        className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white py-3.5 rounded-xl text-base flex items-center justify-center space-x-2 transition font-semibold shadow-md"
                        data-testid={`update-btn-${lead.id}`}
                      >
                        <Edit className="w-5 h-5" />
                        <span>Update</span>
                      </button>
                    </div>
                    
                    {/* Status Update & Not Interested */}
                    <div className="flex gap-3">
                      <select
                        value={lead.stage || 'new'}
                        onChange={(e) => quickUpdateLeadStatus(lead.id, e.target.value)}
                        disabled={updatingLeadId === lead.id}
                        className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-base focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium bg-white"
                        data-testid={`mobile-lead-status-${lead.id}`}
                      >
                        {PIPELINE_STAGES.map(stage => (
                          <option key={stage.id} value={stage.id}>{stage.label}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => quickUpdateLeadStatus(lead.id, 'not_interested')}
                        disabled={updatingLeadId === lead.id}
                        className="bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 px-4 py-3 rounded-xl text-sm flex items-center justify-center transition font-medium disabled:opacity-50"
                        title="Not Interested"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {updatingLeadId === lead.id && <p className="text-center text-sm text-blue-500">Saving...</p>}
                  </div>
                </div>
              ))}
            </div>

            {leads.filter(lead => {
              // Search filter
              if (leadSearchQuery) {
                const search = leadSearchQuery.toLowerCase();
                const nameMatch = lead.name?.toLowerCase().includes(search);
                const phoneMatch = lead.phone?.includes(search);
                if (!nameMatch && !phoneMatch) return false;
              }
              if (pipelineStageFilter && lead.stage !== pipelineStageFilter) return false;
              if (callFilter === 'called') return calledLeads.has(lead.id) || lead.call_status === 'called';
              if (callFilter === 'uncalled') return !calledLeads.has(lead.id) && lead.call_status !== 'called';
              return true;
            }).length === 0 && (
              <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-8 text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {leadSearchQuery
                    ? `No leads found for "${leadSearchQuery}"`
                    : pipelineStageFilter 
                    ? `No leads in "${PIPELINE_STAGES.find(s => s.id === pipelineStageFilter)?.label}" stage`
                    : callFilter === 'all' 
                      ? 'No leads assigned yet' 
                      : `No ${callFilter} leads`
                  }
                </p>
                {(callFilter !== 'all' || pipelineStageFilter || leadSearchQuery) && (
                  <button onClick={() => { setCallFilter('all'); setPipelineStageFilter(null); setLeadSearchQuery(''); }} className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Show All Leads</button>
                )}
              </div>
            )}
            
            {/* Bottom Pagination */}
            {leadsPagination.total_pages > 1 && leads.length > 0 && (
              <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-gray-600 text-sm">
                  Showing {((leadsPagination.current_page - 1) * 150) + 1} - {Math.min(leadsPagination.current_page * 150, leadsPagination.total_count)} of {leadsPagination.total_count} leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeLeadsPage(1)}
                    disabled={leadsPagination.current_page === 1}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${leadsPagination.current_page > 1 ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    First
                  </button>
                  <button
                    onClick={() => changeLeadsPage(leadsPagination.current_page - 1)}
                    disabled={!leadsPagination.has_prev}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${leadsPagination.has_prev ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    ← Prev
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(5, leadsPagination.total_pages))].map((_, i) => {
                      let pageNum;
                      if (leadsPagination.total_pages <= 5) {
                        pageNum = i + 1;
                      } else if (leadsPagination.current_page <= 3) {
                        pageNum = i + 1;
                      } else if (leadsPagination.current_page >= leadsPagination.total_pages - 2) {
                        pageNum = leadsPagination.total_pages - 4 + i;
                      } else {
                        pageNum = leadsPagination.current_page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => changeLeadsPage(pageNum)}
                          className={`w-10 h-10 rounded-lg text-sm font-bold transition ${pageNum === leadsPagination.current_page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => changeLeadsPage(leadsPagination.current_page + 1)}
                    disabled={!leadsPagination.has_next}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${leadsPagination.has_next ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    Next →
                  </button>
                  <button
                    onClick={() => changeLeadsPage(leadsPagination.total_pages)}
                    disabled={leadsPagination.current_page === leadsPagination.total_pages}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${leadsPagination.current_page < leadsPagination.total_pages ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Tab - Staff Inbox for Assigned Leads */}
        {activeTab === "whatsapp" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#0a355e] flex items-center gap-2">
                <Inbox className="w-6 h-6 text-green-500" />
                WhatsApp Inbox
              </h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Only your assigned leads
              </span>
            </div>
            
            {/* Selected Lead Quick Actions */}
            {selectedWhatsAppLead && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{selectedWhatsAppLead.name}</p>
                      <p className="text-sm text-gray-500">{selectedWhatsAppLead.phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openWhatsAppTemplateModal(selectedWhatsAppLead)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Send Template
                    </button>
                    <button
                      onClick={() => setSelectedWhatsAppLead(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* WhatsApp Inbox Component - Filtered for staff's leads */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <WhatsAppInbox 
                staffMode={true}
                staffId={staffData?.staff_id}
                staffLeadIds={leads.map(l => l.id)}
                openLeadPhone={selectedWhatsAppLead?.phone}
                onLeadOpened={() => setSelectedWhatsAppLead(null)}
                onNewMessage={handleNewWhatsAppMessage}
              />
            </div>
          </div>
        )}


        {/* Follow-ups Tab */}
        {activeTab === "followups" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#0a355e]">My Follow-ups</h2>
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border border-gray-300">
                  <tr>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-600 px-4 py-3 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.map((fu) => {
                    const lead = leads.find(l => l.id === fu.lead_id);
                    return (
                      <tr key={fu.id} className="border-t border-sky-200">
                        <td className="px-4 py-3 text-[#0a355e]">{fu.reminder_date} {fu.reminder_time}</td>
                        <td className="px-4 py-3 text-gray-600">{lead?.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{fu.reminder_type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${fu.status === 'completed' ? 'bg-green-600' : fu.status === 'missed' ? 'bg-red-600' : 'bg-yellow-600'} text-[#0a355e]`}>
                            {fu.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Training Tab - Full Training Portal */}
        {activeTab === "training" && (
          <StaffTraining 
            staffId={staffData?.staff_id}
            staffName={staffData?.name}
            staffRole={staffData?.role}
          />
        )}

        {/* Messages Tab - Private Chat with Admin */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#0a355e]">Private Chat with Admin</h2>
              <span className="text-green-400 text-xs flex items-center space-x-1">
                <CheckCircle className="w-4 h-4" />
                <span>End-to-End Private</span>
              </span>
            </div>
            
            {/* Messages List - Chronological order */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4 h-80 overflow-y-auto" data-testid="staff-messages-list">
              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg ${msg.sender_type === 'staff' ? 'bg-blue-600 bg-opacity-20 ml-8' : 'bg-gray-50 border border-gray-300 mr-8'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium text-sm ${msg.sender_type === 'admin' ? 'text-green-400' : 'text-blue-400'}`}>
                          {msg.sender_name} {msg.sender_type === 'admin' && '(Admin)'}
                        </span>
                        <span className="text-gray-500 text-xs">{new Date(msg.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-600">{msg.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start a private conversation with Admin.</p>
                </div>
              )}
            </div>

            {/* Send Message */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4">
              <p className="text-green-400 text-xs mb-2">Only you and Admin can see this conversation. No other staff member has access.</p>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Private message to Admin..."
                  className="flex-1 bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  data-testid="staff-message-input"
                />
                <button onClick={sendMessage} className="bg-blue-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2" data-testid="staff-send-message-btn">
                  <Send className="w-4 h-4" /><span>Send</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Update Lead Modal */}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" data-testid="add-lead-modal">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Add New Lead</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Customer Name *" value={newLeadForm.name} onChange={(e) => setNewLeadForm({...newLeadForm, name: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" data-testid="lead-name-input" />
              <input type="text" placeholder="Phone Number *" value={newLeadForm.phone} onChange={(e) => setNewLeadForm({...newLeadForm, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" data-testid="lead-phone-input" />
              <input type="text" placeholder="District" value={newLeadForm.district} onChange={(e) => setNewLeadForm({...newLeadForm, district: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <input type="number" placeholder="Monthly Electricity Bill (₹)" value={newLeadForm.monthly_bill} onChange={(e) => setNewLeadForm({...newLeadForm, monthly_bill: parseInt(e.target.value) || ''})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              <select value={newLeadForm.property_type} onChange={(e) => setNewLeadForm({...newLeadForm, property_type: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
              <textarea placeholder="Notes" value={newLeadForm.notes} onChange={(e) => setNewLeadForm({...newLeadForm, notes: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" rows={2} />
            </div>
            <div className="flex space-x-3 mt-4">
              <button onClick={createLead} className="flex-1 bg-blue-600 text-[#0a355e] py-2 rounded-lg hover:bg-blue-700 transition" data-testid="submit-lead-btn">Add Lead</button>
              <button onClick={() => setShowAddLeadModal(false)} className="flex-1 bg-gray-600 text-[#0a355e] py-2 rounded-lg hover:bg-gray-500 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Update: {selectedLead.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-500 text-sm mb-2">Stage</label>
                <select value={updateData.stage || selectedLead.stage} onChange={(e) => setUpdateData({...updateData, stage: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                  {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-gray-500 text-sm mb-2">Survey Done?</label>
                <select value={updateData.survey_done ?? selectedLead.survey_done ?? false} onChange={(e) => setUpdateData({...updateData, survey_done: e.target.value === 'true'})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 text-sm mb-2">Quoted Amount (₹)</label>
                <input type="number" value={updateData.quoted_amount || selectedLead.quoted_amount || ''} onChange={(e) => setUpdateData({...updateData, quoted_amount: parseFloat(e.target.value)})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-gray-500 text-sm mb-2">Notes</label>
                <textarea value={updateData.follow_up_notes || ''} onChange={(e) => setUpdateData({...updateData, follow_up_notes: e.target.value})} placeholder="Add notes..." className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg h-24 resize-none" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={updateLead} className="flex-1 bg-blue-600 text-[#0a355e] py-2 rounded-lg font-semibold">Save</button>
              <button onClick={() => { setShowUpdateModal(false); setSelectedLead(null); setUpdateData({}); }} className="px-6 py-2 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showActivityModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Add Note: {selectedLead.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-500 text-sm mb-2">Activity Type</label>
                <select value={activityForm.activity_type} onChange={(e) => setActivityForm({...activityForm, activity_type: e.target.value})} className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                  <option value="note">📝 Note</option>
                  <option value="call">📞 Call</option>
                  <option value="visit">🏠 Visit</option>
                  <option value="quotation">💰 Quotation</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 text-sm mb-2">Title</label>
                <input type="text" value={activityForm.title} onChange={(e) => setActivityForm({...activityForm, title: e.target.value})} placeholder="e.g., Called customer, discussed pricing" className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-gray-500 text-sm mb-2">Details</label>
                <textarea value={activityForm.description} onChange={(e) => setActivityForm({...activityForm, description: e.target.value})} placeholder="Additional details..." className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg h-24 resize-none" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={addActivity} className="flex-1 bg-purple-600 text-[#0a355e] py-2 rounded-lg font-semibold">Add Activity</button>
              <button onClick={() => { setShowActivityModal(false); setSelectedLead(null); }} className="px-6 py-2 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 bg-[#0a355e] text-white p-4 rounded-full shadow-xl hover:bg-[#0B3C5D] transition-all hover:scale-110 border border-white/30"
          data-testid="staff-scroll-to-top"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}

      {/* WhatsApp Send Template Modal for Staff */}
      <SendWhatsAppModal 
        isOpen={showWhatsAppModal} 
        onClose={() => { setShowWhatsAppModal(false); setWhatsAppModalLead(null); }}
        lead={whatsAppModalLead}
        onSent={() => { fetchLeads(leadsPage); }}
      />

      {/* WhatsApp Lead History Modal for Staff */}
      {showLeadWhatsAppHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <History className="w-6 h-6 text-green-500" />
                WhatsApp History
              </h2>
              <button onClick={() => setShowLeadWhatsAppHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {leadWhatsAppMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No WhatsApp messages for this lead yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leadWhatsAppMessages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-xl ${msg.direction === 'incoming' ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-green-50 border-l-4 border-green-400'}`}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{msg.direction === 'incoming' ? '📥 Received' : '📤 Sent'}</span>
                        <span>{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-700 text-sm">{msg.content || msg.template_name || '-'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          msg.status === 'read' ? 'bg-cyan-100 text-cyan-700' :
                          msg.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                          msg.status === 'sent' ? 'bg-green-100 text-green-700' :
                          msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {msg.status}
                        </span>
                        {msg.template_name && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            {msg.template_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Floating Action Button - Positioned higher to not block scrolling */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        {/* FAB Menu Options */}
        {showFabMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-56 animate-in slide-in-from-bottom-4 duration-200">
            <div className="p-2 border-b border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 font-medium px-2">Quick Actions</p>
            </div>
            
            {/* Recent Lead Quick Actions */}
            {leads.slice(0, 3).map((lead) => (
              <div key={lead.id} className="border-b border-gray-100 last:border-0">
                <div className="px-3 py-2 bg-gray-50">
                  <p className="text-sm font-medium text-gray-800 truncate">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.phone}</p>
                </div>
                <div className="grid grid-cols-3 gap-1 p-2">
                  <button
                    onClick={() => { handleCallLead(lead); setShowFabMenu(false); }}
                    className="flex flex-col items-center p-2 rounded-lg hover:bg-green-50 transition"
                  >
                    <Phone className="w-5 h-5 text-green-600" />
                    <span className="text-[10px] text-gray-600 mt-1">Call</span>
                  </button>
                  <button
                    onClick={() => { sendWhatsApp(lead.phone, '', lead); setShowFabMenu(false); }}
                    className="flex flex-col items-center p-2 rounded-lg hover:bg-green-50 transition"
                  >
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    <span className="text-[10px] text-gray-600 mt-1">WhatsApp</span>
                  </button>
                  <button
                    onClick={() => { setSelectedLead(lead); setUpdateData({ stage: lead.stage }); setShowUpdateModal(true); setShowFabMenu(false); }}
                    className="flex flex-col items-center p-2 rounded-lg hover:bg-amber-50 transition"
                  >
                    <Edit className="w-5 h-5 text-amber-600" />
                    <span className="text-[10px] text-gray-600 mt-1">Update</span>
                  </button>
                </div>
              </div>
            ))}
            
            {/* Add New Lead */}
            <button
              onClick={() => { setShowAddLeadModal(true); setShowFabMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-700">Add New Lead</span>
            </button>
            
            {/* Open WhatsApp */}
            <button
              onClick={() => { setActiveTab('whatsapp'); setShowFabMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition text-left border-t border-gray-100"
            >
              <Inbox className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-700">WhatsApp Inbox</span>
            </button>
          </div>
        )}
        
        {/* Main FAB Button */}
        <button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            showFabMenu 
              ? 'bg-gray-600 rotate-45' 
              : 'bg-gradient-to-br from-green-500 to-green-600'
          }`}
        >
          {showFabMenu ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Plus className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
      
      {/* WhatsApp New Message Notification Toast */}
      {showWhatsAppNotification && whatsAppNewMessage && (
        <div className="fixed top-16 left-2 right-2 sm:left-auto sm:right-4 sm:w-80 z-[200] animate-slide-in-top">
          <div 
            className="bg-green-600 text-white rounded-xl shadow-2xl p-4 cursor-pointer"
            onClick={() => {
              setActiveTab('whatsapp');
              setShowWhatsAppNotification(false);
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">New WhatsApp Message</div>
                <div className="text-green-100 text-xs mt-0.5 truncate">
                  {whatsAppNewMessage.lead?.name || whatsAppNewMessage.phone}
                </div>
                <div className="text-green-200 text-xs mt-1">Tap to view in inbox</div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowWhatsAppNotification(false); }}
                className="p-1 hover:bg-white/20 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPortal;