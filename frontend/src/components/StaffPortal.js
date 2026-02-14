import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  User, LogOut, ClipboardList, Calendar, Phone, MapPin,
  CheckCircle, Clock, AlertCircle, MessageSquare, RefreshCw,
  ChevronRight, FileText, TrendingUp, Bell, Plus, Edit,
  Send, Briefcase, ListTodo, MessageCircle, Activity
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "follow_up", label: "Follow Up", color: "bg-yellow-500" },
  { id: "survey", label: "Survey", color: "bg-purple-500" },
  { id: "quotation", label: "Quotation", color: "bg-orange-500" },
  { id: "installation", label: "Installation", color: "bg-cyan-500" },
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
  const navigate = useNavigate();

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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, leadsRes, followupsRes, tasksRes, msgRes, unreadRes, notifRes] = await Promise.all([
        axios.get(`${API}/staff/${staffData.staff_id}/dashboard`),
        axios.get(`${API}/staff/${staffData.staff_id}/leads`),
        axios.get(`${API}/staff/${staffData.staff_id}/followups`),
        axios.get(`${API}/staff/${staffData.staff_id}/tasks/today`).catch(() => ({ data: [] })),
        axios.get(`${API}/staff/${staffData.staff_id}/messages`).catch(() => ({ data: [] })),
        axios.get(`${API}/staff/${staffData.staff_id}/messages/unread`).catch(() => ({ data: { count: 0 } })),
        axios.get(`${API}/staff/${staffData.staff_id}/notifications`).catch(() => ({ data: { notifications: [], unread_count: 0 } }))
      ]);
      setDashboard(dashRes.data);
      setLeads(leadsRes.data);
      setFollowups(followupsRes.data);
      setTasks(tasksRes.data || []);
      setMessages(msgRes.data || []);
      setUnreadCount(unreadRes.data?.count || 0);
      setNotifications(notifRes.data?.notifications || []);
      setNotifUnread(notifRes.data?.unread_count || 0);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
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

  const sendWhatsApp = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading || !staffData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayFollowups = followups.filter(f => f.reminder_date === todayStr && f.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" alt="ASR" className="h-10 bg-white rounded-lg p-1" />
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                {staffData.name?.[0]}
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{staffData.name}</h1>
                <p className="text-gray-400 text-xs">{staffData.staff_id} • {staffData.role}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  className="text-gray-400 hover:text-white relative"
                  data-testid="notifications-bell"
                >
                  <Bell className="w-5 h-5" />
                  {notifUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                      {notifUnread}
                    </span>
                  )}
                </button>
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="font-bold text-white">Notifications</h3>
                      {notifUnread > 0 && (
                        <button onClick={markAllNotificationsRead} className="text-xs text-blue-400 hover:text-blue-300">Mark all read</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No notifications</div>
                    ) : (
                      <div className="divide-y divide-gray-700">
                        {notifications.slice(0, 10).map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => { markNotificationRead(notif.id); setShowNotifications(false); if(notif.lead_id) setActiveTab('leads'); }}
                            className={`p-3 cursor-pointer hover:bg-gray-700 ${!notif.is_read ? 'bg-gray-700/50' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className={`text-sm font-medium ${!notif.is_read ? 'text-white' : 'text-gray-400'}`}>{notif.title}</div>
                              {!notif.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                            <p className="text-xs text-gray-600 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{unreadCount} msg</span>
              )}
              <button onClick={fetchAllData} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
              <button onClick={handleLogout} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center space-x-1">
                <LogOut className="w-4 h-4" /><span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-1 py-2 overflow-x-auto">
            {[
              { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="w-4 h-4" /> },
              { id: "tasks", label: "Today's Tasks", icon: <ListTodo className="w-4 h-4" /> },
              { id: "leads", label: "My Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "followups", label: "Follow-ups", icon: <Calendar className="w-4 h-4" /> },
              { id: "messages", label: "Messages", icon: <MessageCircle className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700"
                }`}
              >
                {tab.icon}<span>{tab.label}</span>
                {tab.id === "messages" && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Dashboard */}
        {activeTab === "dashboard" && dashboard && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
                <ClipboardList className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{dashboard.total_assigned || 0}</div>
                <div className="text-blue-200 text-xs">Assigned Leads</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
                <CheckCircle className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{dashboard.total_converted || 0}</div>
                <div className="text-green-200 text-xs">Converted</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 text-white">
                <Bell className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{todayFollowups.length}</div>
                <div className="text-yellow-200 text-xs">Today's Follow-ups</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 text-white">
                <ListTodo className="w-6 h-6 mb-2 opacity-80" />
                <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</div>
                <div className="text-purple-200 text-xs">Pending Tasks</div>
              </div>
            </div>

            {/* Today's Tasks */}
            {tasks.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-5">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center"><ListTodo className="w-5 h-5 mr-2 text-blue-400" />Today's Tasks</h2>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded text-xs ${TASK_TYPES[task.task_type]?.color || 'bg-gray-500'} text-white`}>
                          {TASK_TYPES[task.task_type]?.label || task.task_type}
                        </span>
                        <div>
                          <div className="text-white font-medium">{task.title}</div>
                          <div className="text-gray-400 text-sm">{task.lead_name || task.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-sm">{task.due_time}</span>
                        {task.status === 'pending' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'completed')} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Done</button>
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
                      <div key={fu.id} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <div className="text-white font-medium">{lead?.name || 'Unknown'}</div>
                          <div className="text-gray-400 text-sm">{fu.reminder_type} • {fu.reminder_time}</div>
                        </div>
                        <div className="flex space-x-2">
                          {lead && (
                            <button onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}, this is from ASR Enterprises...`)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">WhatsApp</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pipeline */}
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white mb-4">My Pipeline</h2>
              <div className="grid grid-cols-7 gap-2">
                {PIPELINE_STAGES.map((stage) => (
                  <div key={stage.id} className="text-center">
                    <div className={`${stage.color} rounded-lg p-3 text-white mb-1`}>
                      <div className="text-xl font-bold">{dashboard.pipeline_stats?.[stage.id] || 0}</div>
                    </div>
                    <div className="text-gray-400 text-xs">{stage.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Today's Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Today's Work List</h2>
            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className={`bg-gray-800 rounded-xl p-5 border-l-4 ${task.priority === 'high' ? 'border-red-500' : task.priority === 'medium' ? 'border-yellow-500' : 'border-green-500'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs ${TASK_TYPES[task.task_type]?.color || 'bg-gray-500'} text-white`}>
                            {TASK_TYPES[task.task_type]?.label || task.task_type}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${task.priority === 'high' ? 'bg-red-600' : task.priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'} text-white`}>
                            {task.priority} priority
                          </span>
                        </div>
                        <h3 className="text-white font-bold text-lg">{task.title}</h3>
                        <p className="text-gray-400">{task.description}</p>
                        {task.lead_name && <p className="text-blue-400 text-sm mt-1">Lead: {task.lead_name}</p>}
                        <p className="text-gray-500 text-sm mt-2">Due: {task.due_time}</p>
                      </div>
                      <div>
                        {task.status === 'pending' ? (
                          <div className="flex flex-col space-y-2">
                            <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Start</button>
                            <button onClick={() => updateTaskStatus(task.id, 'completed')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Complete</button>
                          </div>
                        ) : task.status === 'in_progress' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'completed')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Complete</button>
                        ) : (
                          <span className="text-green-400 font-medium">✓ Completed</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <ListTodo className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400">No Tasks for Today</h3>
                <p className="text-gray-500">Check back later or contact admin for assignments</p>
              </div>
            )}
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">My Leads</h2>
              <button onClick={() => setShowAddLeadModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition" data-testid="staff-add-lead-btn">
                <Plus className="w-4 h-4" /><span>Add Lead</span>
              </button>
            </div>
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Contact</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Stage</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{lead.name}</div>
                        <div className="text-gray-400 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-300 text-sm">{lead.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${PIPELINE_STAGES.find(s => s.id === lead.stage)?.color || 'bg-gray-600'} text-white capitalize`}>
                          {lead.stage?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}, this is from ASR Enterprises...`)} className="text-green-400 hover:text-green-300" title="WhatsApp">
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <a href={`tel:${lead.phone}`} className="text-blue-400 hover:text-blue-300" title="Call">
                            <Phone className="w-4 h-4" />
                          </a>
                          <button onClick={() => { setSelectedLead(lead); setShowUpdateModal(true); }} className="text-yellow-400 hover:text-yellow-300" title="Update">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setSelectedLead(lead); setShowActivityModal(true); }} className="text-purple-400 hover:text-purple-300" title="Add Note">
                            <Activity className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <div className="text-center py-12 text-gray-400">No leads assigned yet</div>
              )}
            </div>
          </div>
        )}

        {/* Follow-ups Tab */}
        {activeTab === "followups" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">My Follow-ups</h2>
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.map((fu) => {
                    const lead = leads.find(l => l.id === fu.lead_id);
                    return (
                      <tr key={fu.id} className="border-t border-gray-700">
                        <td className="px-4 py-3 text-white">{fu.reminder_date} {fu.reminder_time}</td>
                        <td className="px-4 py-3 text-gray-300">{lead?.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 capitalize">{fu.reminder_type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${fu.status === 'completed' ? 'bg-green-600' : fu.status === 'missed' ? 'bg-red-600' : 'bg-yellow-600'} text-white`}>
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

        {/* Messages Tab - Private Chat with Admin */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Private Chat with Admin</h2>
              <span className="text-green-400 text-xs flex items-center space-x-1">
                <CheckCircle className="w-4 h-4" />
                <span>End-to-End Private</span>
              </span>
            </div>
            
            {/* Messages List - Chronological order */}
            <div className="bg-gray-800 rounded-xl p-4 h-80 overflow-y-auto" data-testid="staff-messages-list">
              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg ${msg.sender_type === 'staff' ? 'bg-blue-600 bg-opacity-20 ml-8' : 'bg-gray-700 mr-8'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium text-sm ${msg.sender_type === 'admin' ? 'text-green-400' : 'text-blue-400'}`}>
                          {msg.sender_name} {msg.sender_type === 'admin' && '(Admin)'}
                        </span>
                        <span className="text-gray-500 text-xs">{new Date(msg.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-300">{msg.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start a private conversation with Admin.</p>
                </div>
              )}
            </div>

            {/* Send Message */}
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-green-400 text-xs mb-2">Only you and Admin can see this conversation. No other staff member has access.</p>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Private message to Admin..."
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  data-testid="staff-message-input"
                />
                <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2" data-testid="staff-send-message-btn">
                  <Send className="w-4 h-4" /><span>Send</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Update Lead Modal */}
      {showUpdateModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Update: {selectedLead.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Stage</label>
                <select value={updateData.stage || selectedLead.stage} onChange={(e) => setUpdateData({...updateData, stage: e.target.value})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg">
                  {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Survey Done?</label>
                <select value={updateData.survey_done ?? selectedLead.survey_done ?? false} onChange={(e) => setUpdateData({...updateData, survey_done: e.target.value === 'true'})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Quoted Amount (₹)</label>
                <input type="number" value={updateData.quoted_amount || selectedLead.quoted_amount || ''} onChange={(e) => setUpdateData({...updateData, quoted_amount: parseFloat(e.target.value)})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Notes</label>
                <textarea value={updateData.follow_up_notes || ''} onChange={(e) => setUpdateData({...updateData, follow_up_notes: e.target.value})} placeholder="Add notes..." className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-24 resize-none" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={updateLead} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">Save</button>
              <button onClick={() => { setShowUpdateModal(false); setSelectedLead(null); setUpdateData({}); }} className="px-6 py-2 bg-gray-700 text-white rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showActivityModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Add Note: {selectedLead.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Activity Type</label>
                <select value={activityForm.activity_type} onChange={(e) => setActivityForm({...activityForm, activity_type: e.target.value})} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg">
                  <option value="note">📝 Note</option>
                  <option value="call">📞 Call</option>
                  <option value="visit">🏠 Visit</option>
                  <option value="quotation">💰 Quotation</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Title</label>
                <input type="text" value={activityForm.title} onChange={(e) => setActivityForm({...activityForm, title: e.target.value})} placeholder="e.g., Called customer, discussed pricing" className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Details</label>
                <textarea value={activityForm.description} onChange={(e) => setActivityForm({...activityForm, description: e.target.value})} placeholder="Additional details..." className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-24 resize-none" />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={addActivity} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold">Add Activity</button>
              <button onClick={() => { setShowActivityModal(false); setSelectedLead(null); }} className="px-6 py-2 bg-gray-700 text-white rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
