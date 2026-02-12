import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  User, LogOut, ClipboardList, Calendar, Phone, MapPin,
  CheckCircle, Clock, AlertCircle, MessageSquare, RefreshCw,
  ChevronRight, FileText, TrendingUp, Bell, Plus, Edit
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Pipeline Stages
const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "follow_up", label: "Follow Up", color: "bg-yellow-500" },
  { id: "survey", label: "Survey", color: "bg-purple-500" },
  { id: "quotation", label: "Quotation", color: "bg-orange-500" },
  { id: "installation", label: "Installation", color: "bg-cyan-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "lost", label: "Lost", color: "bg-red-500" }
];

export const StaffPortal = () => {
  const [staffData, setStaffData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [updateData, setUpdateData] = useState({});
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

  useEffect(() => {
    if (staffData?.staff_id) {
      fetchAllData();
    }
  }, [staffData]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, leadsRes, followupsRes] = await Promise.all([
        axios.get(`${API}/staff/${staffData.staff_id}/dashboard`),
        axios.get(`${API}/staff/${staffData.staff_id}/leads`),
        axios.get(`${API}/staff/${staffData.staff_id}/followups`)
      ]);
      setDashboard(dashRes.data);
      setLeads(leadsRes.data);
      setFollowups(followupsRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("asrStaffAuth");
    localStorage.removeItem("asrStaffData");
    localStorage.removeItem("asrStaffToken");
    navigate("/staff/login");
  };

  const updateLead = async () => {
    if (!selectedLead) return;
    try {
      await axios.put(`${API}/staff/${staffData.staff_id}/leads/${selectedLead.id}`, updateData);
      setShowUpdateModal(false);
      setSelectedLead(null);
      setUpdateData({});
      fetchAllData();
      alert("Lead updated successfully!");
    } catch (err) {
      alert("Error updating lead");
    }
  };

  const createFollowup = async () => {
    if (!selectedLead || !updateData.reminder_date) return;
    try {
      await axios.post(`${API}/staff/${staffData.staff_id}/followups`, {
        lead_id: selectedLead.id,
        reminder_date: updateData.reminder_date,
        reminder_time: updateData.reminder_time || "10:00",
        reminder_type: updateData.reminder_type || "call",
        notes: updateData.notes || ""
      });
      setShowFollowupModal(false);
      setSelectedLead(null);
      setUpdateData({});
      fetchAllData();
      alert("Follow-up reminder created!");
    } catch (err) {
      alert("Error creating follow-up");
    }
  };

  const markFollowupDone = async (followupId) => {
    try {
      await axios.put(`${API}/staff/${staffData.staff_id}/followups/${followupId}`, {
        status: "completed"
      });
      fetchAllData();
    } catch (err) {
      alert("Error updating follow-up");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" 
                alt="ASR Enterprises" 
                className="h-10 w-auto bg-white rounded-lg p-1"
              />
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                {staffData.name?.[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{staffData.name}</h1>
                <p className="text-gray-400 text-sm">{staffData.staff_id} • {staffData.role}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={fetchAllData} className="text-gray-400 hover:text-white">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-1 py-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="w-4 h-4" /> },
              { id: "leads", label: "My Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "followups", label: "Follow-ups", icon: <Calendar className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
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

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && dashboard && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
                <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboard.total_assigned || 0}</div>
                <div className="text-blue-200 text-sm">Assigned Leads</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-white">
                <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboard.total_converted || 0}</div>
                <div className="text-green-200 text-sm">Converted</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-5 text-white">
                <Bell className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{dashboard.todays_followups?.length || 0}</div>
                <div className="text-yellow-200 text-sm">Today's Follow-ups</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white">
                <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">
                  {dashboard.total_assigned > 0 
                    ? Math.round((dashboard.total_converted / dashboard.total_assigned) * 100) 
                    : 0}%
                </div>
                <div className="text-purple-200 text-sm">Conversion Rate</div>
              </div>
            </div>

            {/* Pipeline Stats */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">My Pipeline</h2>
              <div className="grid grid-cols-7 gap-2">
                {PIPELINE_STAGES.map((stage) => (
                  <div key={stage.id} className="text-center">
                    <div className={`${stage.color} rounded-lg p-3 text-white mb-2`}>
                      <div className="text-xl font-bold">{dashboard.pipeline_stats?.[stage.id] || 0}</div>
                    </div>
                    <div className="text-gray-400 text-xs">{stage.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Follow-ups */}
            {dashboard.todays_followups?.length > 0 && (
              <div className="bg-yellow-600 bg-opacity-20 border border-yellow-600 rounded-xl p-6">
                <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Today's Follow-ups
                </h2>
                <div className="space-y-3">
                  {dashboard.todays_followups.map((fu) => {
                    const lead = leads.find(l => l.id === fu.lead_id);
                    return (
                      <div key={fu.id} className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <div className="text-white font-medium">{lead?.name || 'Unknown'}</div>
                          <div className="text-gray-400 text-sm">{fu.reminder_type} at {fu.reminder_time}</div>
                        </div>
                        <div className="flex space-x-2">
                          {lead && (
                            <button
                              onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}, this is from ASR Enterprises...`)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                            >
                              WhatsApp
                            </button>
                          )}
                          <button
                            onClick={() => markFollowupDone(fu.id)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Leads */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Recent Leads</h2>
              <div className="space-y-3">
                {dashboard.recent_leads?.map((lead) => (
                  <div key={lead.id} className="bg-gray-700 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">{lead.name}</div>
                      <div className="text-gray-400 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        PIPELINE_STAGES.find(s => s.id === lead.stage)?.color || 'bg-gray-600'
                      } text-white`}>
                        {lead.stage}
                      </span>
                      <button
                        onClick={() => { setSelectedLead(lead); setShowUpdateModal(true); }}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Contact</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Stage</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Next Follow-up</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
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
                        <span className={`px-2 py-1 rounded text-xs ${
                          PIPELINE_STAGES.find(s => s.id === lead.stage)?.color || 'bg-gray-600'
                        } text-white capitalize`}>
                          {lead.stage?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {lead.next_follow_up || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => sendWhatsApp(lead.phone, `Hi ${lead.name}, this is from ASR Enterprises regarding your solar inquiry...`)}
                            className="text-green-400 hover:text-green-300"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <a href={`tel:${lead.phone}`} className="text-blue-400 hover:text-blue-300" title="Call">
                            <Phone className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => { setSelectedLead(lead); setShowUpdateModal(true); }}
                            className="text-yellow-400 hover:text-yellow-300"
                            title="Update"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedLead(lead); setShowFollowupModal(true); }}
                            className="text-purple-400 hover:text-purple-300"
                            title="Set Follow-up"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No leads assigned yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Follow-ups Tab */}
        {activeTab === "followups" && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Date</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Time</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Lead</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Type</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Status</th>
                    <th className="text-left text-gray-300 px-4 py-3 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.map((fu) => {
                    const lead = leads.find(l => l.id === fu.lead_id);
                    return (
                      <tr key={fu.id} className="border-t border-gray-700">
                        <td className="px-4 py-3 text-white">{fu.reminder_date}</td>
                        <td className="px-4 py-3 text-gray-400">{fu.reminder_time}</td>
                        <td className="px-4 py-3 text-gray-300">{lead?.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 capitalize">{fu.reminder_type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            fu.status === 'completed' ? 'bg-green-600' :
                            fu.status === 'missed' ? 'bg-red-600' : 'bg-yellow-600'
                          } text-white`}>
                            {fu.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {fu.status === 'pending' && (
                            <button
                              onClick={() => markFollowupDone(fu.id)}
                              className="text-green-400 hover:text-green-300 text-sm"
                            >
                              Mark Done
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {followups.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No follow-ups scheduled
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Update Lead Modal */}
      {showUpdateModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Update Lead: {selectedLead.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Stage</label>
                <select
                  value={updateData.stage || selectedLead.stage}
                  onChange={(e) => setUpdateData({...updateData, stage: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Survey Done?</label>
                <select
                  value={updateData.survey_done ?? selectedLead.survey_done ?? false}
                  onChange={(e) => setUpdateData({...updateData, survey_done: e.target.value === 'true'})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Quoted Amount (₹)</label>
                <input
                  type="number"
                  value={updateData.quoted_amount || selectedLead.quoted_amount || ''}
                  onChange={(e) => setUpdateData({...updateData, quoted_amount: parseFloat(e.target.value)})}
                  placeholder="e.g., 250000"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Follow-up Notes</label>
                <textarea
                  value={updateData.follow_up_notes || selectedLead.follow_up_notes || ''}
                  onChange={(e) => setUpdateData({...updateData, follow_up_notes: e.target.value})}
                  placeholder="Add notes about conversation..."
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={updateLead}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => { setShowUpdateModal(false); setSelectedLead(null); setUpdateData({}); }}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Follow-up Modal */}
      {showFollowupModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Set Follow-up: {selectedLead.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Date</label>
                <input
                  type="date"
                  value={updateData.reminder_date || ''}
                  onChange={(e) => setUpdateData({...updateData, reminder_date: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Time</label>
                <input
                  type="time"
                  value={updateData.reminder_time || '10:00'}
                  onChange={(e) => setUpdateData({...updateData, reminder_time: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Type</label>
                <select
                  value={updateData.reminder_type || 'call'}
                  onChange={(e) => setUpdateData({...updateData, reminder_type: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="call">Phone Call</option>
                  <option value="visit">Site Visit</option>
                  <option value="quotation">Send Quotation</option>
                  <option value="payment">Payment Collection</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Notes</label>
                <textarea
                  value={updateData.notes || ''}
                  onChange={(e) => setUpdateData({...updateData, notes: e.target.value})}
                  placeholder="Reminder notes..."
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={createFollowup}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700"
              >
                Create Reminder
              </button>
              <button
                onClick={() => { setShowFollowupModal(false); setSelectedLead(null); setUpdateData({}); }}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
