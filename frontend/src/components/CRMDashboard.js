import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Users, ClipboardList, TrendingUp, Calendar, 
  Phone, Mail, MapPin, DollarSign, CheckCircle, Clock, 
  AlertCircle, Sparkles, RefreshCw, Plus, Search, Filter,
  UserPlus, PhoneCall, FileText, Wrench, CreditCard, BarChart3,
  Send, ChevronRight, Edit, Trash2, Eye, MessageSquare, Key, Copy
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Pipeline Stages
const PIPELINE_STAGES = [
  { id: "new", label: "New Lead", color: "bg-blue-500" },
  { id: "follow_up", label: "Follow Up", color: "bg-yellow-500" },
  { id: "survey", label: "Survey", color: "bg-purple-500" },
  { id: "quotation", label: "Quotation", color: "bg-orange-500" },
  { id: "installation", label: "Installation", color: "bg-cyan-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "lost", label: "Lost", color: "bg-red-500" }
];

export const CRMDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newStaffCredentials, setNewStaffCredentials] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [newStaffForm, setNewStaffForm] = useState({ name: '', email: '', phone: '', role: 'sales', password: 'asr@123' });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, leadsRes, staffRes, followRes, projRes, payRes] = await Promise.all([
        axios.get(`${API}/crm/dashboard`),
        axios.get(`${API}/crm/leads`),
        axios.get(`${API}/crm/employees`),
        axios.get(`${API}/crm/followups`),
        axios.get(`${API}/crm/projects`),
        axios.get(`${API}/crm/payments`)
      ]);
      setDashboardData(dashRes.data);
      setLeads(leadsRes.data);
      setEmployees(empRes.data);
      setFollowups(followRes.data);
      setProjects(projRes.data);
      setPayments(payRes.data);
    } catch (err) {
      console.error("Error fetching CRM data:", err);
    }
    setLoading(false);
  };

  const getAISuggestions = async (leadId) => {
    try {
      const res = await axios.post(`${API}/crm/ai/followup-suggestions`, { lead_id: leadId });
      setAiSuggestions(res.data.suggestions);
    } catch (err) {
      setAiSuggestions("Focus on PM Surya Ghar subsidy benefits and free site survey.");
    }
  };

  const updateLeadStage = async (leadId, newStage) => {
    try {
      await axios.put(`${API}/crm/leads/${leadId}`, { stage: newStage });
      fetchAllData();
    } catch (err) {
      alert("Error updating lead");
    }
  };

  const sendWhatsApp = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading CRM...</p>
        </div>
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
              <Link to="/admin/dashboard" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">ASR CRM System</h1>
                <p className="text-gray-400 text-sm">Manage leads, sales & installations</p>
              </div>
            </div>
            <button
              onClick={fetchAllData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
              { id: "leads", label: "Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "pipeline", label: "Pipeline", icon: <TrendingUp className="w-4 h-4" /> },
              { id: "employees", label: "Team", icon: <Users className="w-4 h-4" /> },
              { id: "followups", label: "Follow-ups", icon: <Calendar className="w-4 h-4" /> },
              { id: "projects", label: "Projects", icon: <Wrench className="w-4 h-4" /> },
              { id: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> },
              { id: "reports", label: "Reports", icon: <FileText className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && dashboardData && (
          <div className="space-y-6">
            {/* Stats Cards */}
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
                <Calendar className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboardData.todays_followups || 0}</div>
                <div className="text-yellow-200 text-sm">Today's Follow-ups</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white">
                <DollarSign className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">₹{((dashboardData.total_revenue || 0) / 1000).toFixed(0)}K</div>
                <div className="text-purple-200 text-sm">Total Revenue</div>
              </div>
            </div>

            {/* Pipeline Overview */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Sales Pipeline</h2>
              <div className="grid grid-cols-7 gap-2">
                {PIPELINE_STAGES.map((stage) => (
                  <div key={stage.id} className="text-center">
                    <div className={`${stage.color} rounded-lg p-4 text-white mb-2`}>
                      <div className="text-2xl font-bold">{dashboardData.pipeline_stats?.[stage.id] || 0}</div>
                    </div>
                    <div className="text-gray-400 text-xs">{stage.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Leads & Projects */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Recent Leads</h2>
                <div className="space-y-3">
                  {dashboardData.recent_leads?.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                      <div>
                        <div className="text-white font-medium">{lead.name}</div>
                        <div className="text-gray-400 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        lead.ai_priority === 'high' ? 'bg-red-600 text-white' :
                        lead.ai_priority === 'medium' ? 'bg-yellow-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {lead.ai_priority?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Project Status</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Pending</span>
                    <span className="text-yellow-400 font-bold">{dashboardData.projects?.pending || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">In Progress</span>
                    <span className="text-blue-400 font-bold">{dashboardData.projects?.in_progress || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Completed</span>
                    <span className="text-green-400 font-bold">{dashboardData.projects?.completed || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="">All Stages</option>
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowLeadModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lead</span>
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Contact</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Stage</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Priority</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Assigned</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads
                    .filter((l) => !filterStage || l.stage === filterStage)
                    .map((lead) => (
                    <tr key={lead.id} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{lead.name}</div>
                        <div className="text-gray-400 text-sm">{lead.district}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-300 text-sm">{lead.phone}</div>
                        <div className="text-gray-400 text-xs">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.stage}
                          onChange={(e) => updateLeadStage(lead.id, e.target.value)}
                          className="bg-gray-700 text-white text-sm px-2 py-1 rounded"
                        >
                          {PIPELINE_STAGES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          lead.ai_priority === 'high' ? 'bg-red-600 text-white' :
                          lead.ai_priority === 'medium' ? 'bg-yellow-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {lead.ai_priority?.toUpperCase() || 'MEDIUM'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {employees.find(e => e.id === lead.assigned_to)?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}, this is ASR Enterprises. We wanted to follow up on your solar inquiry.`)}
                            className="text-green-400 hover:text-green-300"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedLead(lead); getAISuggestions(lead.id); }}
                            className="text-purple-400 hover:text-purple-300"
                            title="AI Suggestions"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <a
                            href={`tel:${lead.phone}`}
                            className="text-blue-400 hover:text-blue-300"
                            title="Call"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pipeline Tab */}
        {activeTab === "pipeline" && (
          <div className="overflow-x-auto">
            <div className="flex space-x-4 min-w-max pb-4">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.id} className="w-72 flex-shrink-0">
                  <div className={`${stage.color} rounded-t-xl px-4 py-3`}>
                    <div className="flex justify-between items-center text-white">
                      <span className="font-bold">{stage.label}</span>
                      <span className="bg-white bg-opacity-20 px-2 py-1 rounded text-sm">
                        {leads.filter(l => l.stage === stage.id).length}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-b-xl p-3 space-y-3 min-h-96">
                    {leads.filter(l => l.stage === stage.id).map((lead) => (
                      <div key={lead.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-white font-medium">{lead.name}</div>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            lead.ai_priority === 'high' ? 'bg-red-600' :
                            lead.ai_priority === 'medium' ? 'bg-yellow-600' : 'bg-gray-600'
                          } text-white`}>
                            {lead.ai_priority?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-gray-400 text-sm mb-2">{lead.district}</div>
                        <div className="text-gray-400 text-xs mb-3">₹{lead.monthly_bill || 0}/mo</div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}!`)}
                            className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700"
                          >
                            WhatsApp
                          </button>
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 text-center"
                          >
                            Call
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowEmployeeModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp) => (
                <div key={emp.id} className="bg-gray-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {emp.name?.[0]}
                      </div>
                      <div>
                        <div className="text-white font-bold">{emp.name}</div>
                        <div className="text-gray-400 text-sm capitalize">{emp.role}</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-700 rounded-lg p-2 text-center">
                      <div className="text-blue-400 font-bold">{emp.leads_assigned || 0}</div>
                      <div className="text-gray-500 text-xs">Assigned</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-2 text-center">
                      <div className="text-green-400 font-bold">{emp.leads_converted || 0}</div>
                      <div className="text-gray-500 text-xs">Converted</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-2 text-center">
                      <div className="text-yellow-400 font-bold">₹{((emp.total_revenue || 0) / 1000).toFixed(0)}K</div>
                      <div className="text-gray-500 text-xs">Revenue</div>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    <div className="flex items-center space-x-2 mb-1">
                      <Phone className="w-3 h-3" />
                      <span>{emp.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-ups Tab */}
        {activeTab === "followups" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowFollowupModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Follow-up</span>
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Employee</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Status</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.map((fu) => {
                    const lead = leads.find(l => l.id === fu.lead_id);
                    const emp = employees.find(e => e.id === fu.employee_id);
                    return (
                      <tr key={fu.id} className="border-t border-gray-700">
                        <td className="px-4 py-3 text-white">{fu.reminder_date}</td>
                        <td className="px-4 py-3 text-gray-300">{lead?.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 capitalize">{fu.reminder_type}</td>
                        <td className="px-4 py-3 text-gray-300">{emp?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            fu.status === 'completed' ? 'bg-green-600' :
                            fu.status === 'missed' ? 'bg-red-600' : 'bg-yellow-600'
                          } text-white`}>
                            {fu.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={async () => {
                              await axios.put(`${API}/crm/followups/${fu.id}`, { status: 'completed' });
                              fetchAllData();
                            }}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            Mark Done
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowProjectModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Project</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => (
                <div key={proj.id} className="bg-gray-800 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-white font-bold">{proj.customer_name}</div>
                      <div className="text-gray-400 text-sm">{proj.location}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      proj.installation_status === 'completed' ? 'bg-green-600' :
                      proj.installation_status === 'in_progress' ? 'bg-blue-600' : 'bg-yellow-600'
                    } text-white`}>
                      {proj.installation_status}
                    </span>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">System</span>
                      <span className="text-white">{proj.system_size} - {proj.brand}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total</span>
                      <span className="text-white">₹{proj.total_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Received</span>
                      <span className="text-green-400">₹{proj.advance_received?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Pending</span>
                      <span className="text-red-400">₹{proj.pending_amount?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => sendWhatsApp(proj.customer_phone, `Hello ${proj.customer_name}, update on your solar installation...`)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm"
                    >
                      Add Payment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Amount</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Mode</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id} className="border-t border-gray-700">
                      <td className="px-4 py-3 text-white">{pay.timestamp?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-green-400 font-bold">₹{pay.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{pay.payment_type}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{pay.payment_mode}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {employees.find(e => e.id === pay.received_by)?.name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
              <div className="flex items-center space-x-4 mb-4">
                <Sparkles className="w-10 h-10" />
                <div>
                  <h2 className="text-2xl font-bold">AI Business Insights</h2>
                  <p className="text-purple-200">Powered by AI analytics</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const res = await axios.post(`${API}/crm/ai/lead-priority`, {});
                  setAiSuggestions(res.data.recommendations);
                }}
                className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold"
              >
                Get AI Recommendations
              </button>
              {aiSuggestions && (
                <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-4">
                  <pre className="text-sm whitespace-pre-wrap">{aiSuggestions}</pre>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Lead Sources</h3>
                <div className="space-y-3">
                  {['website', 'whatsapp', 'call', 'facebook', 'instagram'].map((src) => (
                    <div key={src} className="flex items-center justify-between">
                      <span className="text-gray-300 capitalize">{src}</span>
                      <span className="text-white font-bold">
                        {leads.filter(l => l.source === src).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Conversion Rate</h3>
                <div className="text-center">
                  <div className="text-5xl font-bold text-green-400">
                    {leads.length > 0 
                      ? Math.round((leads.filter(l => l.stage === 'completed').length / leads.length) * 100)
                      : 0}%
                  </div>
                  <div className="text-gray-400 mt-2">Overall Conversion</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Suggestions Modal */}
      {selectedLead && aiSuggestions && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>AI Suggestions for {selectedLead.name}</span>
              </h2>
              <button onClick={() => { setSelectedLead(null); setAiSuggestions(""); }} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-gray-300 whitespace-pre-wrap">
              {aiSuggestions}
            </div>
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => sendWhatsApp(selectedLead.phone, `Hi ${selectedLead.name}, this is ASR Enterprises...`)}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg"
              >
                WhatsApp Now
              </button>
              <a href={`tel:${selectedLead.phone}`} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-center">
                Call Now
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
