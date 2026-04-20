import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Users, ClipboardList, TrendingUp, Calendar, 
  Phone, Mail, MapPin, DollarSign, CheckCircle, Clock, 
  AlertCircle, Sparkles, RefreshCw, Plus, Search, Filter,
  UserPlus, PhoneCall, FileText, Wrench, CreditCard, BarChart3,
  Send, ChevronRight, ChevronUp, Edit, Trash2, Eye, MessageSquare, Key, Copy,
  Image, Upload, Camera, ListTodo, MessageCircle, Activity, Zap, FileSpreadsheet, Download, Star, Shield, Loader2,
  User, X, History, Inbox, Save, Settings, Megaphone, Wallet
} from "lucide-react";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { AdminAIAssistant } from "@/components/AdminAIAssistant";
import { WhatsAppModule, SendWhatsAppModal, BulkCampaignModal } from "@/components/WhatsAppCRM";
import { WhatsAppInbox } from "@/components/WhatsAppInbox";
import { SocialMediaManager } from "@/components/SocialMediaManager";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== LEAD MANAGEMENT SECTION (Contains Trash) ====================
const LeadManagementSection = memo(({ 
  trashedLeads, fetchTrashedLeads, restoreLeads, permanentlyDeleteLeads
}) => {
  useEffect(() => {
    fetchTrashedLeads();
  }, [fetchTrashedLeads]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Inbox className="w-6 h-6 sm:w-7 sm:h-7" />
              Lead Management
            </h2>
            <p className="text-indigo-100 mt-1 text-sm">
              Manage deleted leads - Restore or permanently delete
            </p>
          </div>
          <button 
            onClick={fetchTrashedLeads}
            className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Trash Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-800">Trash ({trashedLeads.length} deleted leads)</h3>
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Deleted leads are kept for 30 days before permanent removal. You can restore them anytime.
        </div>
        
        {trashedLeads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
            <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">Trash is Empty</h3>
            <p className="text-gray-500">No deleted leads</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {trashedLeads.map((lead) => (
                <div key={lead.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                      {(lead.name || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{lead.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{lead.phone}</p>
                      <p className="text-xs text-gray-400">Deleted: {lead.deleted_at ? new Date(lead.deleted_at).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => restoreLeads([lead.id])}
                      className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Permanently delete this lead? This cannot be undone.')) {
                          permanentlyDeleteLeads([lead.id]);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== HR MANAGEMENT SECTION (Contains Team + Tasks) ====================
const HRManagementSection = memo(({ 
  staffAccounts, tasks, tasksLoading, fetchStaff, fetchTasks, 
  handleCreateStaff, handleDeleteStaff, ownerInfo
}) => {
  const [subTab, setSubTab] = useState("team");
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', phone: '', staff_id: '', email: '', password: '', designation: 'Sales Executive' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
  
  useEffect(() => {
    if (subTab === "team") fetchStaff();
    if (subTab === "tasks") fetchTasks();
  }, [subTab, fetchStaff, fetchTasks]);

  const createTask = async () => {
    if (!taskForm.title) return alert("Task title required");
    try {
      await axios.post(`${API}/crm/tasks`, taskForm);
      fetchTasks();
      setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
    } catch (err) { alert("Error creating task"); }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await axios.patch(`${API}/crm/tasks/${taskId}`, { status });
      fetchTasks();
    } catch (err) { alert("Error updating task"); }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/crm/tasks/${taskId}`);
      fetchTasks();
    } catch (err) { alert("Error deleting task"); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 sm:w-7 sm:h-7" />
              HR Management
            </h2>
            <p className="text-purple-100 mt-1 text-sm">
              Manage team members and assign tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSubTab("team")}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                subTab === "team" ? "bg-white text-purple-600" : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <Users className="w-4 h-4" />
              Team ({staffAccounts.length})
            </button>
            <button
              onClick={() => setSubTab("tasks")}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                subTab === "tasks" ? "bg-white text-purple-600" : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Tasks ({tasks.length})
            </button>
          </div>
        </div>
      </div>

      {/* Team SubTab */}
      {subTab === "team" && (
        <div className="space-y-4">
          {/* Owner Card */}
          {ownerInfo && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {ownerInfo.name ? ownerInfo.name[0].toUpperCase() : 'O'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-800 text-lg">{ownerInfo.name}</h3>
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded">OWNER</span>
                    </div>
                    <p className="text-gray-600 text-sm">{ownerInfo.designation || 'Owner & MD'}</p>
                    <p className="text-gray-500 text-xs">{ownerInfo.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">PROTECTED</span>
                </div>
              </div>
            </div>
          )}

          {/* Add Staff Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddStaff(!showAddStaff)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add Staff
            </button>
          </div>

          {/* Add Staff Form */}
          {showAddStaff && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <h4 className="font-semibold text-gray-800">Add New Staff Member</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <input type="text" placeholder="Full Name *" value={newStaff.name} onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
                <input type="tel" placeholder="Phone *" value={newStaff.phone} onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
                <input type="text" placeholder="Staff ID (e.g., ASR1002)" value={newStaff.staff_id} onChange={(e) => setNewStaff({...newStaff, staff_id: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
                <input type="email" placeholder="Email" value={newStaff.email} onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
                <input type="password" placeholder="Password" value={newStaff.password} onChange={(e) => setNewStaff({...newStaff, password: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
                <select value={newStaff.designation} onChange={(e) => setNewStaff({...newStaff, designation: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2">
                  <option>Sales Executive</option>
                  <option>Site Engineer</option>
                  <option>Technician</option>
                  <option>Manager</option>
                </select>
              </div>
              <button onClick={() => { handleCreateStaff(newStaff); setShowAddStaff(false); setNewStaff({ name: '', phone: '', staff_id: '', email: '', password: '', designation: 'Sales Executive' }); }} className="px-4 py-2 bg-green-600 text-white rounded-lg">Create Staff</button>
            </div>
          )}

          {/* Staff List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {staffAccounts.filter(s => !s.is_owner).length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-700">No Staff Added</h3>
                <p className="text-gray-500 text-sm">Add team members to assign leads and tasks</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {staffAccounts.filter(s => !s.is_owner).map((staff) => (
                  <div key={staff.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                        {staff.name ? staff.name[0].toUpperCase() : 'S'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{staff.name}</p>
                        <p className="text-sm text-gray-500">{staff.staff_id} • {staff.designation || 'Staff'}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteStaff(staff.staff_id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks SubTab */}
      {subTab === "tasks" && (
        <div className="space-y-4">
          {/* Create Task Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h4 className="font-semibold text-gray-800">Create New Task</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Task Title *" value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
              <select value={taskForm.assigned_to} onChange={(e) => setTaskForm({...taskForm, assigned_to: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2">
                <option value="">Assign To (Optional)</option>
                {staffAccounts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2" />
            </div>
            <textarea placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2" rows={2} />
            <button onClick={createTask} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Create Task</button>
          </div>

          {/* Tasks List */}
          {tasksLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-purple-500 animate-spin" /></div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ListTodo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-700">No Tasks</h3>
              <p className="text-gray-500 text-sm">Create tasks to track team activities</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {tasks.map((task) => (
                  <div key={task.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{task.priority}</span>
                        </div>
                        {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                          {task.assigned_to_name && <span>Assigned to: {task.assigned_to_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button onClick={() => deleteTask(task.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ==================== SECURITY CENTRE SECTION (Contains Backups) ====================
const SecurityCentreSection = memo(({ backups, fetchBackups, createBackup, downloadBackup, backupsLoading }) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
              Security Centre
            </h2>
            <p className="text-red-100 mt-1 text-sm">
              Manage backups and security settings
            </p>
          </div>
        </div>
      </div>

      {/* Backups Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-800">Database Backups</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchBackups} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-4 h-4 ${backupsLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={createBackup} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Backup
            </button>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700">No Backups Yet</h3>
            <p className="text-gray-500 text-sm">Create your first backup to secure your data</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {backups.map((backup) => (
                <div key={backup.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{backup.filename || backup.id}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(backup.created_at).toLocaleString()} • {backup.size_mb ? `${backup.size_mb} MB` : 'Size unknown'}
                    </p>
                  </div>
                  <button onClick={() => downloadBackup(backup.id)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Note:</strong> Backups are automatically created daily. Manual backups are recommended before major changes.
        </div>
      </div>
    </div>
  );
});

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

// Google Reviews Tab Component
const GoogleReviewsTab = memo(() => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncForm, setSyncForm] = useState({ reviewer_name: '', review_text: '', rating: 5, review_date: '' });

  const fetchReviews = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/google-reviews`);
      setReviews(res.data?.reviews || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const syncReview = async () => {
    if (!syncForm.reviewer_name || !syncForm.review_text) {
      alert("Reviewer name and review text required");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/admin/google-reviews/sync`, syncForm);
      setSyncForm({ reviewer_name: '', review_text: '', rating: 5, review_date: '' });
      fetchReviews();
      alert("Review synced successfully!");
    } catch (err) { alert(err.response?.data?.message || "Error syncing review"); }
    setLoading(false);
  };

  const deleteReview = async (id) => {
    if (!window.confirm('Delete this Google review?')) return;
    try {
      await axios.delete(`${API}/admin/google-reviews/${id}`);
      fetchReviews();
    } catch (err) { alert("Error deleting review"); }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Star className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Google Business Reviews</h3>
            <p className="text-blue-100 text-sm">
              Manually sync your Google Business Profile reviews here. Copy reviews from your 
              <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="underline ml-1">Google Business Profile</a> 
              and paste them below to display on your website.
            </p>
            <p className="text-blue-200 text-xs mt-2">Place ID: ChIJAR33l2BX7TkRJ4CYdw8Hkps</p>
          </div>
        </div>
      </div>

      {/* Add Review Form */}
      <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#0a355e] mb-4 flex items-center">
          <Plus className="w-5 h-5 mr-2" />
          Add Google Review
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input 
            type="text" 
            placeholder="Reviewer Name *" 
            value={syncForm.reviewer_name} 
            onChange={(e) => setSyncForm({...syncForm, reviewer_name: e.target.value})}
            className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
            data-testid="google-review-name"
          />
          <input 
            type="date" 
            value={syncForm.review_date} 
            onChange={(e) => setSyncForm({...syncForm, review_date: e.target.value})}
            className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
          />
          <textarea 
            placeholder="Review Text *" 
            value={syncForm.review_text} 
            onChange={(e) => setSyncForm({...syncForm, review_text: e.target.value})}
            className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg md:col-span-2 min-h-24"
            data-testid="google-review-text"
          />
          <select 
            value={syncForm.rating} 
            onChange={(e) => setSyncForm({...syncForm, rating: parseInt(e.target.value)})}
            className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
          >
            <option value={5}>5 Stars</option>
            <option value={4}>4 Stars</option>
            <option value={3}>3 Stars</option>
            <option value={2}>2 Stars</option>
            <option value={1}>1 Star</option>
          </select>
          <button 
            onClick={syncReview} 
            disabled={loading}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
            data-testid="sync-google-review-btn"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            <span>{loading ? 'Syncing...' : 'Sync Review'}</span>
          </button>
        </div>
      </div>

      {/* Synced Reviews List */}
      <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#0a355e] mb-4">Synced Google Reviews ({reviews.length})</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {reviews.map((r) => (
            <div key={r.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-bold text-[#0a355e]">{r.reviewer_name}</span>
                  <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded">Google</span>
                  {r.verified && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <div className="flex mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                  ))}
                </div>
                <p className="text-gray-600 text-sm">{r.review_text}</p>
                <p className="text-gray-400 text-xs mt-2">Synced: {new Date(r.synced_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => deleteReview(r.id)} className="text-red-400 hover:text-red-600 p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {reviews.length === 0 && (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No Google reviews synced yet</p>
              <p className="text-gray-400 text-sm">Add reviews from your Google Business Profile above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Service Price Config Component
const ServicePriceConfig = memo(() => {
  const [solarPrice, setSolarPrice] = useState(2499);
  const [siteVisitPrice, setSiteVisitPrice] = useState(500);
  const [solarLoading, setSolarLoading] = useState(false);
  const [visitLoading, setVisitLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [siteVisitBookings, setSiteVisitBookings] = useState([]);
  const [activeBookingTab, setActiveBookingTab] = useState("solar");

  const fetchConfigs = useCallback(async () => {
    try {
      const [solarRes, visitRes] = await Promise.all([
        axios.get(`${API}/service/book-solar-config`),
        axios.get(`${API}/service/site-visit-config`)
      ]);
      setSolarPrice(solarRes.data?.price || 2499);
      setSiteVisitPrice(visitRes.data?.price || 500);
    } catch (err) { console.error(err); }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      const [solarRes, visitRes] = await Promise.all([
        axios.get(`${API}/service/bookings`),
        axios.get(`${API}/service/site-visit-bookings`).catch(() => ({ data: { bookings: [] } }))
      ]);
      // Only show confirmed/paid bookings
      const allSolar = solarRes.data?.bookings || [];
      setBookings(allSolar.filter(b => ["verified", "confirmed", "paid"].includes(b.payment_status)));
      setSiteVisitBookings(visitRes.data?.bookings || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchBookings();
  }, [fetchConfigs, fetchBookings]);

  const updateSolarPrice = async () => {
    setSolarLoading(true);
    try {
      await axios.put(`${API}/service/book-solar-config`, { price: parseFloat(solarPrice) });
      alert("Book Solar Service price updated!");
      fetchConfigs();
    } catch (err) { alert("Error updating price"); }
    setSolarLoading(false);
  };

  const updateSiteVisitPrice = async () => {
    setVisitLoading(true);
    try {
      await axios.put(`${API}/service/site-visit-config`, { price: parseFloat(siteVisitPrice) });
      alert("Site Visit price updated!");
      fetchConfigs();
    } catch (err) { alert("Error updating price"); }
    setVisitLoading(false);
  };

  const updateBookingStatus = async (id, status, paymentStatus) => {
    try {
      await axios.put(`${API}/service/bookings/${id}/status`, { status, payment_status: paymentStatus });
      alert("Booking updated!");
      fetchBookings();
    } catch (err) { alert("Error updating booking"); }
  };

  const renderBookingsTable = (list, emptyMsg) => (
    list.length === 0 ? (
      <div className="p-8 text-center text-gray-500">{emptyMsg}</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Booking #</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Payment</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b, i) => (
              <tr key={b.id || i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-[#0a355e]">{b.booking_number || b.booking_id || "-"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{b.customer_name}</div>
                  <div className="text-xs text-gray-500">{b.customer_phone}</div>
                </td>
                <td className="px-4 py-3 font-bold text-green-600">₹{(b.price || b.amount || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {b.payment_status || "paid"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {b.created_at ? new Date(b.created_at).toLocaleDateString("en-IN") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      {/* Price Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Book Solar Service Price */}
        <div className="bg-white rounded-xl shadow-lg border border-amber-200 overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
            <h3 className="font-bold text-[#0a355e] flex items-center text-sm">
              <CreditCard className="w-4 h-4 mr-2 text-amber-500" />
              Book Solar Service Price
            </h3>
            <p className="text-gray-500 text-xs mt-1">Price shown on website for solar service booking</p>
          </div>
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={solarPrice}
                  onChange={(e) => setSolarPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-lg font-bold text-[#0a355e]"
                />
              </div>
              <button
                onClick={updateSolarPrice}
                disabled={solarLoading}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-1 mt-5"
              >
                {solarLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Current: <strong className="text-amber-600">₹{solarPrice}</strong></p>
          </div>
        </div>

        {/* Site Visit Price */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-sky-50">
            <h3 className="font-bold text-[#0a355e] flex items-center text-sm">
              <CreditCard className="w-4 h-4 mr-2 text-blue-500" />
              Book Site Visit Price
            </h3>
            <p className="text-gray-500 text-xs mt-1">Price charged for a site visit booking</p>
          </div>
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={siteVisitPrice}
                  onChange={(e) => setSiteVisitPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-bold text-[#0a355e]"
                />
              </div>
              <button
                onClick={updateSiteVisitPrice}
                disabled={visitLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold text-sm hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-1 mt-5"
              >
                {visitLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Current: <strong className="text-blue-600">₹{siteVisitPrice}</strong></p>
          </div>
        </div>
      </div>

      {/* Paid Bookings - only after successful payment */}
      <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#0a355e] flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-green-500" />
              Confirmed Orders (After Successful Payment)
            </h3>
            <p className="text-gray-500 text-sm mt-1">Only orders confirmed after payment verification appear here</p>
          </div>
          <button onClick={fetchBookings} className="px-3 py-1.5 bg-green-100 text-green-600 rounded-lg text-sm flex items-center space-x-1">
            <RefreshCw className="w-4 h-4" /><span>Refresh</span>
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: "solar", label: `Solar Service (${bookings.length})` },
            { id: "sitevisit", label: `Site Visits (${siteVisitBookings.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveBookingTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${activeBookingTab === t.id ? "border-green-500 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeBookingTab === "solar"
          ? renderBookingsTable(bookings, "No confirmed solar service orders yet. Orders appear here after payment is verified.")
          : renderBookingsTable(siteVisitBookings, "No confirmed site visit orders yet. Orders appear here after payment is completed.")}
      </div>
    </div>
  );
});

// Bookings Manager Component - Mobile Friendly
const BookingsManager = memo(() => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/service/bookings`);
      setBookings(res.data?.bookings || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateBookingStatus = async (id, status, paymentStatus) => {
    try {
      await axios.put(`${API}/service/bookings/${id}/status`, {
        status: status,
        payment_status: paymentStatus
      });
      fetchBookings();
    } catch (err) { alert("Error updating booking"); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              Solar Service Bookings
            </h2>
            <p className="text-amber-100 text-sm mt-1">{bookings.length} total bookings</p>
          </div>
          <button 
            onClick={fetchBookings} 
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-sky-200 p-8 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-700 mb-2">No Bookings Yet</h3>
          <p className="text-gray-500 text-sm">Bookings from the Book Solar Service widget will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Booking</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Transaction ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#0a355e]">{b.booking_number}</div>
                      <div className="text-xs text-gray-500">{new Date(b.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.customer_name}</div>
                      <div className="text-xs text-gray-500">{b.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-600">₹{(b.price || b.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{b.transaction_id || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        b.payment_status === 'verified' ? 'bg-green-100 text-green-700' :
                        b.payment_status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {b.payment_status === 'pending_verification' ? 'Pending' : b.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => updateBookingStatus(b.id, 'confirmed', 'verified')}
                          className="px-2 py-1 bg-green-100 text-green-600 rounded text-xs hover:bg-green-200"
                        >✓ Verify</button>
                        <button
                          onClick={() => updateBookingStatus(b.id, 'cancelled', 'rejected')}
                          className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                        >✗ Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {bookings.map((b) => (
              <div key={b.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-[#0a355e]">{b.booking_number}</div>
                    <div className="text-xs text-gray-500">{new Date(b.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    b.payment_status === 'verified' ? 'bg-green-100 text-green-700' :
                    b.payment_status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {b.payment_status === 'pending_verification' ? 'Pending' : b.payment_status}
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <p><strong>{b.customer_name}</strong></p>
                  <p className="text-gray-500">{b.customer_phone}</p>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-green-600">₹{b.amount}</span>
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{b.transaction_id || '-'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateBookingStatus(b.id, 'confirmed', 'verified')}
                    className="flex-1 px-3 py-2 bg-green-100 text-green-600 rounded text-sm font-medium hover:bg-green-200"
                  >✓ Verify</button>
                  <button
                    onClick={() => updateBookingStatus(b.id, 'cancelled', 'rejected')}
                    className="flex-1 px-3 py-2 bg-red-100 text-red-600 rounded text-sm font-medium hover:bg-red-200"
                  >✗ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Backups Tab Component
const BackupsTab = memo(() => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/backup/list`);
      setBackups(res.data?.backups || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await axios.post(`${API}/admin/backup/create`);
      alert(`Backup created: ${res.data.filename} (${res.data.size_mb} MB)`);
      fetchBackups();
    } catch (err) { alert("Error creating backup: " + err.message); }
    setCreating(false);
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`Delete backup ${filename}?`)) return;
    try {
      await axios.delete(`${API}/admin/backup/${filename}`);
      fetchBackups();
    } catch (err) { alert("Error deleting backup"); }
  };

  const downloadBackup = (filename) => {
    // Open backup download URL
    window.open(`${API}/admin/backup/download/${filename}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Database Backups</h3>
            <p className="text-green-100 text-sm">
              Create manual backups of your entire database including leads, orders, testimonials, and settings.
              Automated weekly backups are recommended for data safety.
            </p>
          </div>
        </div>
      </div>

      {/* Create Backup */}
      <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#0a355e] mb-1">Create Manual Backup</h3>
            <p className="text-gray-500 text-sm">Backup all collections: Leads, Orders, Testimonials, Staff, etc.</p>
          </div>
          <button 
            onClick={createBackup} 
            disabled={creating}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 flex items-center space-x-2"
            data-testid="create-backup-btn"
          >
            {creating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
            <span>{creating ? 'Creating...' : 'Create Backup Now'}</span>
          </button>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#0a355e] mb-4">Available Backups ({backups.length})</h3>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {backups.map((backup) => (
              <div key={backup.filename} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span className="font-semibold text-[#0a355e]">{backup.filename}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{backup.size_mb} MB</span>
                    <span>{new Date(backup.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => downloadBackup(backup.filename)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => deleteBackup(backup.filename)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {backups.length === 0 && (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No backups created yet</p>
                <p className="text-gray-400 text-sm">Create your first backup above</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const PIPELINE_STAGES = [
  { id: "new", label: "New Lead", color: "bg-blue-500" },
  { id: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { id: "site_visit", label: "Site Visit", color: "bg-purple-500" },
  { id: "quotation", label: "Quotation", color: "bg-orange-500" },
  { id: "negotiation", label: "Negotiation", color: "bg-cyan-500" },
  { id: "converted", label: "Converted", color: "bg-teal-500" },
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
  const navigate = useNavigate();
  
  // Auto-logout after 15 minutes of inactivity
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  useAutoLogout(isAuthenticated, () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminEmail");
    localStorage.removeItem("asrAdminRole");
  }, 'admin');

  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsPagination, setLeadsPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 250,
    has_next: false,
    has_prev: false
  });
  const [leadsSearch, setLeadsSearch] = useState('');
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState(null); // Filter leads by staff
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false); // Separate loading for leads
  const [selectedLead, setSelectedLead] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  
  // New Leads Management System
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [showNewLeadsOnly, setShowNewLeadsOnly] = useState(false);
  const [trashedLeads, setTrashedLeads] = useState([]);
  const [showTrashTab, setShowTrashTab] = useState(false);
  
  // DB persistence status
  const [dbStatus, setDbStatus] = useState(null);

  // WhatsApp Cloud API Integration state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppModalLead, setWhatsAppModalLead] = useState(null);
  const [showBulkCampaignModal, setShowBulkCampaignModal] = useState(false);
  const [selectedLeadsForCampaign, setSelectedLeadsForCampaign] = useState([]);
  const [showLeadWhatsAppHistory, setShowLeadWhatsAppHistory] = useState(false);
  const [leadWhatsAppMessages, setLeadWhatsAppMessages] = useState([]);
  const [openWhatsAppChatLeadId, setOpenWhatsAppChatLeadId] = useState(null);
  
  // Scroll to top state
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Site Settings State
  const [siteSettings, setSiteSettings] = useState({
    marquee_text: "☀Get up to ₹78,000 Subsidy under PM Surya Ghar Yojana Call Now: 8877896889 WhatsApp for Quote",
    marquee_enabled: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  
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

  // Auto-sync leads every 30 seconds when enabled
  useEffect(() => {
    if (!autoSyncEnabled) return;
    
    const syncInterval = setInterval(() => {
      if (activeTab === "leads") {
        fetchLeads(leadsPagination.current_page, leadsSearch);
      } else if (activeTab === "dashboard") {
        fetchDashboardData();
      }
      setLastSyncTime(new Date());
    }, 30000); // 30 seconds
    
    return () => clearInterval(syncInterval);
  }, [autoSyncEnabled, activeTab, leadsPagination.current_page, leadsSearch]);
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
  const [bulkImportMode, setBulkImportMode] = useState('file'); // 'file' or 'paste'
  const [bulkPasteText, setBulkPasteText] = useState('');
  
  // Smart Import State
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [smartImportStep, setSmartImportStep] = useState('upload');
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [smartImportResult, setSmartImportResult] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [smartImporting, setSmartImporting] = useState(false);
  const [selectedSmartFile, setSelectedSmartFile] = useState(null);
  const [leadType, setLeadType] = useState('auto');
  const smartFileInputRef = useRef(null);
  
  // Quick Add Lead State
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickLeadForm, setQuickLeadForm] = useState({ name: '', phone: '', district: '', source: 'manual' });
  
  // Bulk Lead Assignment State
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignStaffId, setBulkAssignStaffId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  
  // Multiple Photo Upload State  
  const [photoFiles, setPhotoFiles] = useState([]);
  
  // Registration Fee State
  const [registrationFee, setRegistrationFee] = useState(1500);
  const [newRegistrationFee, setNewRegistrationFee] = useState('');
  const [registrations, setRegistrations] = useState([]);

  useEffect(() => { 
    // Load essential data on mount
    fetchDashboardData();
    fetchLeads(); // Also load leads for dashboard stats
    fetchStaff(); // Load staff for assignment dropdowns
    fetchDistricts(); 
    fetchGalleryPhotos(); // Load gallery photos for admin
    fetchSiteSettings(); // Load site settings for marquee editor
    // Check DB persistence mode
    axios.get(`${API}/admin/database/status`).then(r => setDbStatus(r.data)).catch(() => {});
  }, []);
  
  // Periodically refresh new leads count
  useEffect(() => {
    const interval = setInterval(fetchNewLeadsCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);
  
  // Auto-sync New Inquiries every 15 seconds when on new_leads tab
  useEffect(() => {
    if (activeTab === "new_leads" && autoSyncEnabled) {
      const interval = setInterval(() => {
        fetchNewLeads();
        setLastSyncTime(new Date());
      }, 15000); // Every 15 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab, autoSyncEnabled]);
  
  // Load tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === "leads") fetchLeads();
    if (activeTab === "lead_management") fetchTrashedLeads();
    if (activeTab === "hr_management") { fetchTasks(); fetchStaff(); }
    if (activeTab === "messages") fetchMessages();
    if (activeTab === "site_settings") fetchSiteSettings();
  }, [activeTab]);
  
  const fetchNewLeadsCount = async () => {
    try {
      // Fetch count for WhatsApp leads only
      const res = await axios.get(`${API}/crm/new-leads/count?source=whatsapp`);
      setNewLeadsCount(res.data.count || 0);
    } catch (err) {
      console.error("New leads count error:", err);
    }
  };
  
  const fetchNewLeads = async () => {
    setLeadsLoading(true);
    try {
      // Only fetch WhatsApp leads for New Inquiries
      const res = await axios.get(`${API}/crm/new-leads?source=whatsapp&limit=100`);
      setLeads(res.data.leads || []);
      setLeadsPagination({
        ...leadsPagination,
        total_count: res.data.total_count || 0
      });
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("New leads fetch error:", err);
    }
    setLeadsLoading(false);
  };
  
  const fetchTrashedLeads = async () => {
    try {
      const res = await axios.get(`${API}/crm/leads/trash?limit=100`);
      setTrashedLeads(res.data.leads || []);
    } catch (err) {
      console.error("Trashed leads fetch error:", err);
    }
  };
  
  const restoreLeads = async (leadIds) => {
    try {
      await axios.post(`${API}/crm/leads/restore`, { lead_ids: leadIds });
      fetchTrashedLeads();
      fetchLeads();
      fetchNewLeadsCount();
    } catch (err) {
      console.error("Restore error:", err);
      alert("Error restoring leads");
    }
  };
  
  const markLeadContacted = async (leadId) => {
    try {
      await axios.post(`${API}/crm/leads/${leadId}/mark-contacted`);
      // Refresh data
      fetchNewLeadsCount();
      if (activeTab === "new_leads") {
        fetchNewLeads();
      } else {
        fetchLeads();
      }
    } catch (err) {
      console.error("Mark contacted error:", err);
    }
  };
  
  const bulkMarkContacted = async () => {
    if (selectedLeadIds.length === 0) return;
    try {
      await axios.post(`${API}/crm/leads/bulk-mark-contacted`, { lead_ids: selectedLeadIds });
      setSelectedLeadIds([]);
      fetchNewLeadsCount();
      if (activeTab === "new_leads") {
        fetchNewLeads();
      } else {
        fetchLeads();
      }
    } catch (err) {
      console.error("Bulk mark contacted error:", err);
    }
  };
  
  const bulkDeleteLeads = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!window.confirm(`Move ${selectedLeadIds.length} leads to Trash? They will be auto-deleted after 30 days if not restored.`)) return;
    
    try {
      const res = await axios.post(`${API}/crm/leads/bulk-delete`, { lead_ids: selectedLeadIds });
      if (res.data.success) {
        setSelectedLeadIds([]);
        fetchNewLeadsCount();
        fetchTrashedLeads();
        if (activeTab === "new_leads") {
          fetchNewLeads();
        } else {
          fetchLeads();
        }
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Error deleting leads");
    }
  };
  
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Use the full dashboard endpoint that includes pipeline_stats
      const res = await axios.get(`${API}/crm/dashboard`);
      const data = res.data;
      if (!data.total_leads && leads.length > 0) {
        data.total_leads = leads.length;
      }
      setDashboardData(data);
    } catch (err) { 
      console.error("Dashboard error:", err);
      // Fallback - create dashboard from leads
      setDashboardData({
        total_leads: leads.length,
        pipeline_stats: {
          new: leads.filter(l => l.stage === 'new').length,
          contacted: leads.filter(l => l.stage === 'contacted').length,
          site_visit: leads.filter(l => l.stage === 'site_visit').length,
          quotation: leads.filter(l => l.stage === 'quotation').length,
          negotiation: leads.filter(l => l.stage === 'negotiation').length,
          converted: leads.filter(l => l.stage === 'converted').length,
          completed: leads.filter(l => l.stage === 'completed').length,
          lost: leads.filter(l => l.stage === 'lost').length,
        },
        recent_leads: leads.slice(0, 10),
        total_revenue: 0
      });
    }
    setLoading(false);
  };
  
  // Site Settings Functions
  const fetchSiteSettings = async () => {
    try {
      const res = await axios.get(`${API}/site-settings`);
      if (res.data) {
        setSiteSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error("Error fetching site settings:", err);
    }
  };
  
  const saveSiteSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.post(`${API}/site-settings`, siteSettings);
      alert("Site settings saved successfully!");
    } catch (err) {
      alert("Error saving settings: " + (err.response?.data?.detail || err.message));
    }
    setSavingSettings(false);
  };
  
  const fetchLeads = async (page = 1, search = '') => {
    // Show loading indicator
    setLeadsLoading(true);
    
    try {
      // Use 250 leads per page as requested by user
      const params = new URLSearchParams({ page, limit: 250 });
      if (filterStage) params.append('stage', filterStage);
      if (search) params.append('search', search);
      
      const res = await axios.get(`${API}/crm/leads?${params}`);
      
      // Handle both old (array) and new (object with pagination) response formats
      if (Array.isArray(res.data)) {
        setLeads(res.data);
        setLeadsPagination({ 
          current_page: 1, 
          total_pages: Math.ceil(res.data.length / 250), 
          total_count: res.data.length, 
          per_page: 250, 
          has_next: false, 
          has_prev: false 
        });
      } else {
        const newLeads = res.data.leads || [];
        setLeads(newLeads);
        setLeadsPagination(res.data.pagination || { 
          current_page: page, 
          total_pages: 1, 
          total_count: newLeads.length, 
          per_page: 250, 
          has_next: false, 
          has_prev: page > 1 
        });
      }
    } catch (err) { 
      console.error("Leads error:", err);
      // Keep existing data on error
    } finally {
      setLeadsLoading(false);
    }
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

  // Bulk Assign Leads to Staff
  const bulkAssignLeads = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Please select at least one lead");
      return;
    }
    if (!bulkAssignStaffId) {
      alert("Please select a staff member");
      return;
    }
    
    setBulkAssigning(true);
    try {
      const response = await axios.post(`${API}/crm/leads/bulk-assign`, {
        lead_ids: selectedLeadIds,
        employee_id: bulkAssignStaffId,
        assigned_by: "admin"
      });
      
      const assignedCount = selectedLeadIds.length;
      
      // Reset state BEFORE fetchAllData to prevent issues
      setSelectedLeadIds([]);
      setBulkAssignStaffId('');
      setShowBulkAssignModal(false);
      
      // Refresh data
      await fetchAllData();
      
      alert(`✅ ${assignedCount} leads assigned successfully!`);
    } catch (err) {
      console.error("Bulk assign error:", err);
      alert(err.response?.data?.detail || "Error assigning leads. Please try again.");
    } finally {
      setBulkAssigning(false);
    }
  };

  // Toggle lead selection for bulk assign
  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  // Select/Deselect all visible leads on current page
  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
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
        fetchAllData();
      } catch (err) {
        alert(err.response?.data?.detail || "Import failed");
      }
      setBulkImporting(false);
    } else {
      // Manual paste mode
      if (!bulkPasteText.trim()) { alert("Please paste phone numbers"); return; }
      setBulkImporting(true);
      try {
        const res = await axios.post(`${API}/crm/leads/bulk-import-manual`, {
          phones: bulkPasteText
        });
        setBulkImportResult(res.data);
        fetchAllData();
      } catch (err) {
        alert(err.response?.data?.detail || "Import failed");
      }
      setBulkImporting(false);
    }
  };

  // Smart Import Handlers
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
        setExtractedLeads(res.data.preview_data.map((lead, idx) => ({
          ...lead,
          _selected: true,
          _index: idx
        })));
        setSmartImportStep('preview');
      } else {
        alert("No leads found in the file. Please check the file format.");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error extracting data from file");
    }
    setExtracting(false);
  };

  const handleToggleSmartLeadSelection = (index) => {
    setExtractedLeads(prev => prev.map((lead, idx) => 
      idx === index ? { ...lead, _selected: !lead._selected } : lead
    ));
  };

  const handleEditSmartLead = (index, field, value) => {
    setExtractedLeads(prev => prev.map((lead, idx) => 
      idx === index ? { ...lead, [field]: value } : lead
    ));
  };

  const handleConfirmSmartImport = async () => {
    const selectedLeads = extractedLeads.filter(l => l._selected);
    if (selectedLeads.length === 0) {
      alert("Please select at least one lead to import");
      return;
    }
    
    setSmartImporting(true);
    try {
      const res = await axios.post(`${API}/crm/leads/confirm-import`, {
        leads: selectedLeads.map(({ _selected, _index, ...lead }) => lead),
        lead_type: leadType
      });
      
      setSmartImportResult(res.data);
      setSmartImportStep('result');
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error importing leads");
    }
    setSmartImporting(false);
  };

  const resetSmartImport = () => {
    setSmartImportStep('upload');
    setExtractedLeads([]);
    setSmartImportResult(null);
    setSelectedSmartFile(null);
    setLeadType('auto');
    if (smartFileInputRef.current) smartFileInputRef.current.value = '';
  };

  const closeSmartImportModal = () => {
    resetSmartImport();
    setShowSmartImportModal(false);
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

  // Open WhatsApp CRM for a lead - switch to WhatsApp tab
  const sendWhatsApp = (phone, message, lead = null) => {
    if (lead) {
      // Open WhatsApp inbox with this lead's conversation
      setOpenWhatsAppChatLeadId(lead.id);
      setActiveTab('whatsapp');
    } else {
      // Just switch to WhatsApp tab
      setActiveTab('whatsapp');
    }
  };

  const forwardLeadToStaffWhatsApp = async (lead, staff) => {
    const msg = `🔔 *New Lead Assigned*\n\n👤 Name: ${lead.name}\n📞 Phone: ${lead.phone}\n📍 District: ${lead.district}\n💰 Monthly Bill: ₹${lead.monthly_bill}\n🏠 Property: ${lead.property_type}\n\n_Please contact within 24 hours_\n\n- ASR Enterprises Admin`;
    sendWhatsApp(staff.phone, msg);
  };

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

  // Open WhatsApp Chat directly from Lead
  const openWhatsAppChatFromLead = (leadId) => {
    setOpenWhatsAppChatLeadId(leadId);
    setActiveTab('whatsapp');
  };

  const handleBulkCampaign = () => {
    const selectedIds = leads.filter(l => l.selected).map(l => l.id);
    if (selectedIds.length === 0) {
      alert('Please select leads first by checking the checkboxes');
      return;
    }
    setSelectedLeadsForCampaign(selectedIds);
    setShowBulkCampaignModal(true);
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
      {/* Header - Mobile Friendly */}
      <div className="bg-white shadow-lg border-b border-sky-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link to="/admin/dashboard" className="text-gray-600 hover:text-[#0a355e]"><ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" /></Link>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-[#0a355e]">ASR CRM</h1>
                <p className="text-gray-500 text-xs sm:text-sm hidden sm:block">Manage leads & operations</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={fetchAllData} className="bg-blue-500 text-white px-3 py-2 rounded-lg flex items-center space-x-1 text-sm">
                <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DB Persistence Status Banner */}
      {dbStatus && !dbStatus.is_persistent && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-base">⚠️</span>
            <span className="font-medium">In-Memory Database Active</span>
            <span className="text-amber-600 hidden sm:inline">— Data may be lost on server restart. Set MONGO_URI secret to enable MongoDB Atlas.</span>
          </div>
          <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono">
            {dbStatus.collections?.crm_leads ?? 0} leads · {dbStatus.collections?.cashfree_orders ?? 0} payments
          </span>
        </div>
      )}
      {dbStatus && dbStatus.is_persistent && dbStatus.db_mode === 'mongodb_atlas' && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-700">
            <span>✅</span>
            <span className="font-medium">MongoDB Atlas Active — All data is fully persistent</span>
          </div>
          <span className="text-emerald-600 font-mono">
            {dbStatus.collections?.crm_leads ?? 0} leads · {dbStatus.collections?.cashfree_orders ?? 0} payments · {dbStatus.collections?.whatsapp_messages ?? 0} messages
          </span>
        </div>
      )}

      {/* Navigation - Scrollable on Mobile */}
      <div className="bg-white shadow-sm border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-hide">
            {[
              { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
              { id: "leads", label: "All Leads", icon: <ClipboardList className="w-4 h-4" /> },
              { id: "cashfree_payments", label: "Cashfree Payments", icon: <Wallet className="w-4 h-4" /> },
              { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-4 h-4" /> },
              { id: "hr_management", label: "HR Management", icon: <Users className="w-4 h-4" /> },
              { id: "service_config", label: "Service Price", icon: <CreditCard className="w-4 h-4" /> },
              { id: "site_settings", label: "Site Settings", icon: <Settings className="w-4 h-4" /> },
              { id: "credentials", label: "Credentials", icon: <Key className="w-4 h-4" /> }
            ].map((tab) => (
              <button key={tab.id} onClick={() => { 
                setActiveTab(tab.id); 
              }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap relative ${
                  activeTab === tab.id 
                    ? tab.id === "whatsapp" ? "bg-green-600 text-white" 
                    : tab.id === "cashfree_payments" ? "bg-emerald-600 text-white"
                    : tab.id === "hr_management" ? "bg-purple-600 text-white"
                    : "bg-blue-600 text-white" 
                    : "text-gray-600 hover:bg-gray-50 border border-gray-300"
                }`}>
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
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
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">
                  {loading
                    ? <span className="inline-block w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                    : (dashboardData.total_leads || leads.length || 0)}
                </div>
                <div className="text-blue-100 text-sm">Total Leads</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
                <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">
                  {loading
                    ? <span className="inline-block w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                    : (dashboardData.pipeline_stats?.completed || leads.filter(l => l.stage === 'completed').length || 0)}
                </div>
                <div className="text-green-100 text-sm">Completed</div>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white">
                <Users className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">{staffAccounts.length}</div>
                <div className="text-amber-100 text-sm">Staff Members</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-5 text-white">
                <DollarSign className="w-8 h-8 mb-2 opacity-80" />
                <div className="text-3xl font-bold">₹{((dashboardData.total_revenue || 0) / 1000).toFixed(0)}K</div>
                <div className="text-purple-100 text-sm">Revenue</div>
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

            {/* Quick Modules */}
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-[#0a355e] mb-4">Quick Modules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Social Media Manager Card */}
                <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl p-5 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <Activity className="w-8 h-8 opacity-80" />
                    <div>
                      <h3 className="font-bold text-lg">Social Media Manager</h3>
                      <p className="text-pink-100 text-sm">Manage Facebook & Instagram posts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('social')}
                    className="w-full mt-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    data-testid="manage-social-btn"
                  >
                    Manage Social
                  </button>
                </div>

                {/* WhatsApp CRM Card */}
                <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-xl p-5 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageSquare className="w-8 h-8 opacity-80" />
                    <div>
                      <h3 className="font-bold text-lg">WhatsApp CRM</h3>
                      <p className="text-green-100 text-sm">Campaigns & conversations</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('whatsapp')}
                    className="w-full mt-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Open WhatsApp
                  </button>
                </div>

                {/* Team Management Card */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="w-8 h-8 opacity-80" />
                    <div>
                      <h3 className="font-bold text-lg">Team Management</h3>
                      <p className="text-blue-100 text-sm">{staffAccounts.length} active staff members</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('team')}
                    className="w-full mt-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Manage Team
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Leads Tab - Original leads functionality */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center space-x-3">
                <select value={filterStage} onChange={(e) => { setFilterStage(e.target.value); fetchLeads(1, leadsSearch); }} className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg">
                  <option value="">All Stages</option>
                  {PIPELINE_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search name/phone..."
                    value={leadsSearch}
                    onChange={(e) => setLeadsSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchLeads(1, leadsSearch)}
                    className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-2 rounded-lg pl-9 w-48"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
                <button onClick={() => fetchLeads(1, leadsSearch)} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200" title="Refresh leads">
                  <RefreshCw className="w-4 h-4" />
                </button>
                {/* Auto-Sync Toggle */}
                <button 
                  onClick={() => setAutoSyncEnabled(!autoSyncEnabled)} 
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 transition ${autoSyncEnabled ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-300'}`}
                  title={autoSyncEnabled ? 'Auto-sync ON (every 30s)' : 'Auto-sync OFF'}
                >
                  <RefreshCw className={`w-4 h-4 ${autoSyncEnabled ? 'animate-spin' : ''}`} style={autoSyncEnabled ? { animationDuration: '3s' } : {}} />
                  <span className="hidden sm:inline">{autoSyncEnabled ? 'Sync ON' : 'Sync OFF'}</span>
                </button>
                {selectedLeadIds.length > 0 && (
                  <button 
                    onClick={() => setShowBulkAssignModal(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 hover:from-indigo-600 hover:to-purple-600 transition"
                    data-testid="bulk-assign-btn"
                  >
                    <Users className="w-4 h-4" />
                    <span>Bulk Assign ({selectedLeadIds.length})</span>
                  </button>
                )}
                {selectedLeadIds.length > 0 && (
                  <button 
                    onClick={bulkDeleteLeads}
                    className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 hover:from-red-600 hover:to-red-700 transition"
                    data-testid="bulk-delete-all-leads-btn"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete ({selectedLeadIds.length})</span>
                  </button>
                )}
                {selectedLeadIds.length > 0 && (
                  <button 
                    onClick={() => { setSelectedLeadsForCampaign(selectedLeadIds); setShowBulkCampaignModal(true); }}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 hover:from-green-600 hover:to-green-700 transition"
                    data-testid="bulk-whatsapp-btn"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp Campaign ({selectedLeadIds.length})</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Staff Filter Dropdown */}
                <select
                  value={selectedStaffFilter || ''}
                  onChange={(e) => setSelectedStaffFilter(e.target.value || null)}
                  className="bg-white border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg text-sm"
                >
                  <option value="">All Staff</option>
                  <option value="unassigned">Unassigned</option>
                  {staffAccounts.filter(s => s.is_active && s.leads_assigned > 0).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.leads_assigned})</option>
                  ))}
                </select>
                {selectedStaffFilter && (
                  <button 
                    onClick={() => setSelectedStaffFilter(null)}
                    className="bg-gray-200 text-gray-600 px-2 py-2 rounded-lg text-sm"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                )}
                <button onClick={() => setShowQuickAddModal(true)} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-green-700 transition" data-testid="quick-add-btn">
                  <Plus className="w-4 h-4" /><span className="hidden sm:inline">Quick Add</span><span className="sm:hidden">+</span>
                </button>
                <button onClick={() => setShowAddLeadModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-blue-700 transition" data-testid="add-lead-btn">
                  <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Full Form</span>
                </button>
                <button onClick={() => setShowSmartImportModal(true)} className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-purple-600 hover:to-purple-700 transition" data-testid="smart-import-btn">
                  <FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">Smart Import</span>
                </button>
                <button onClick={() => setShowBulkImportModal(true)} className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:bg-orange-700 transition" data-testid="bulk-import-btn">
                  <Upload className="w-4 h-4" /><span className="hidden sm:inline">Import</span>
                </button>
                <button onClick={fetchSocialLeads} className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-green-600 hover:to-teal-600 transition" data-testid="fetch-social-btn">
                  <Download className="w-4 h-4" /><span className="hidden md:inline">Fetch Social</span>
                </button>
                <button onClick={autoAssignAllLeads} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 hover:from-purple-700 hover:to-pink-700 transition" data-testid="auto-assign-all-btn">
                  <Zap className="w-4 h-4" /><span className="hidden md:inline">AI Auto-Assign</span>
                </button>
              </div>
            </div>
            
            {/* Staff Leads Summary - Quick View */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#0a355e] mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Staff Leads Distribution
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedStaffFilter('unassigned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedStaffFilter === 'unassigned' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                >
                  Unassigned ({leads.filter(l => !l.assigned_to).length})
                </button>
                {staffAccounts.filter(s => s.is_active && !['ASR1001','ASR1002'].includes(s.staff_id) && !['ABHIJEET KUMAR','ANAMIKA'].includes(s.name?.toUpperCase?.())).map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => setSelectedStaffFilter(staff.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedStaffFilter === staff.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'}`}
                  >
                    {staff.name.split(' ')[0]} ({staff.leads_assigned || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Pagination Info & Controls - Top */}
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{leads.length}</span> of <span className="font-semibold">{leadsPagination.total_count}</span> leads
                {leadsPagination.total_pages > 1 && (
                  <span className="ml-2">(Page {leadsPagination.current_page} of {leadsPagination.total_pages})</span>
                )}
              </div>
              {leadsPagination.total_pages > 1 && (
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => fetchLeads(leadsPagination.current_page - 1, leadsSearch)}
                    disabled={!leadsPagination.has_prev}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    ← Prev
                  </button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, leadsPagination.total_pages) }, (_, i) => {
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
                          onClick={() => fetchLeads(pageNum, leadsSearch)}
                          className={`px-3 py-1 rounded-lg text-sm ${leadsPagination.current_page === pageNum ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => fetchLeads(leadsPagination.current_page + 1, leadsSearch)}
                    disabled={!leadsPagination.has_next}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left text-gray-600 px-3 py-3 text-sm w-10">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.length > 0 && selectedLeadIds.length === leads.length}
                          onChange={toggleSelectAllLeads}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Lead</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Contact</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Source</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Stage</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Assign To</th>
                      <th className="text-left text-gray-600 px-4 py-3 text-sm">Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {leadsLoading ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-16 text-center">
                        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 font-medium text-lg">Loading leads...</p>
                        <p className="text-gray-400 text-sm mt-2">Please wait while we fetch your data</p>
                      </td>
                    </tr>
                  ) : leads.filter(lead => {
                    // Apply staff filter
                    if (selectedStaffFilter === 'unassigned') return !lead.assigned_to;
                    if (selectedStaffFilter) return lead.assigned_to === selectedStaffFilter;
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center">
                        <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">{selectedStaffFilter ? 'No leads match this filter' : 'No leads found'}</p>
                        <p className="text-gray-400 text-sm mt-1">{selectedStaffFilter ? 'Try selecting a different staff member' : 'Add new leads using the buttons above'}</p>
                        {selectedStaffFilter && (
                          <button onClick={() => setSelectedStaffFilter(null)} className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Show All Leads</button>
                        )}
                      </td>
                    </tr>
                  ) : leads.filter(lead => {
                    // Apply staff filter
                    if (selectedStaffFilter === 'unassigned') return !lead.assigned_to;
                    if (selectedStaffFilter) return lead.assigned_to === selectedStaffFilter;
                    return true;
                  }).map((lead) => (
                    <tr key={lead.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedLeadIds.includes(lead.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="text-[#0a355e] font-medium">{lead.name}</div>
                          {lead.is_new && (
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded animate-pulse">NEW</span>
                          )}
                        </div>
                        <div className="text-gray-600 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          lead.source === 'whatsapp' ? 'bg-green-500 text-white' : 
                          lead.source === 'facebook' ? 'bg-blue-500 text-white' : 
                          lead.source === 'website' ? 'bg-purple-500 text-white' : 
                          lead.source === 'registration' ? 'bg-orange-500 text-white' : 'bg-gray-500 text-white'
                        }`}>
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
                          {staffAccounts.filter(s => !['ASR1001','ASR1002'].includes(s.staff_id) && !['ABHIJEET KUMAR','ANAMIKA'].includes(s.name?.toUpperCase?.())).map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => openWhatsAppChatFromLead(lead.id)} className="text-emerald-500 hover:text-emerald-600" title="Open WhatsApp Chat" data-testid="whatsapp-chat-btn"><Inbox className="w-4 h-4" /></button>
                          <button onClick={() => openWhatsAppTemplateModal(lead)} className="text-green-500 hover:text-green-600" title="Send WhatsApp Template" data-testid="whatsapp-template-btn"><MessageSquare className="w-4 h-4" /></button>
                          <button onClick={() => fetchLeadWhatsAppHistory(lead.id)} className="text-cyan-500 hover:text-cyan-600" title="WhatsApp History" data-testid="whatsapp-history-btn"><History className="w-4 h-4" /></button>
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

            {/* Pagination Controls - Bottom */}
            {leadsPagination.total_pages > 1 && (
              <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  Page <span className="font-semibold">{leadsPagination.current_page}</span> of <span className="font-semibold">{leadsPagination.total_pages}</span>
                  <span className="ml-2 text-gray-500">({leadsPagination.total_count} total leads)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => fetchLeads(1, leadsSearch)}
                    disabled={leadsPagination.current_page === 1}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    First
                  </button>
                  <button 
                    onClick={() => fetchLeads(leadsPagination.current_page - 1, leadsSearch)}
                    disabled={!leadsPagination.has_prev}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                    {leadsPagination.current_page}
                  </span>
                  <button 
                    onClick={() => fetchLeads(leadsPagination.current_page + 1, leadsSearch)}
                    disabled={!leadsPagination.has_next}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next →
                  </button>
                  <button 
                    onClick={() => fetchLeads(leadsPagination.total_pages, leadsSearch)}
                    disabled={leadsPagination.current_page === leadsPagination.total_pages}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🆕 New Leads Tab - Priority Inbox for Fresh Inquiries */}
        {activeTab === "new_leads" && (
          <div className="space-y-4">
            {/* Header - Mobile Friendly */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 sm:p-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Inbox className="w-6 h-6 sm:w-7 sm:h-7" />
                    WhatsApp Inquiries
                  </h2>
                  <p className="text-green-100 mt-1 text-sm">
                    {newLeadsCount} fresh WhatsApp messages waiting
                    {lastSyncTime && <span className="ml-2 text-xs opacity-75">• Synced {new Date(lastSyncTime).toLocaleTimeString()}</span>}
                  </p>
                </div>
                {/* Action Buttons - Always visible on mobile */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Auto Sync Toggle */}
                  <button 
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition ${
                      autoSyncEnabled ? 'bg-white/30 text-white' : 'bg-white/10 text-white/70'
                    }`}
                    data-testid="auto-sync-toggle"
                    title={autoSyncEnabled ? "Auto-sync ON (every 15s)" : "Auto-sync OFF"}
                  >
                    <RefreshCw className={`w-4 h-4 ${autoSyncEnabled ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Auto</span>
                  </button>
                  {selectedLeadIds.length > 0 && (
                    <>
                      <button 
                        onClick={bulkMarkContacted}
                        className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
                        data-testid="bulk-mark-contacted-btn"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="hidden xs:inline">Mark</span> ({selectedLeadIds.length})
                      </button>
                      <button 
                        onClick={() => setShowBulkAssignModal(true)}
                        className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
                        data-testid="bulk-assign-new-btn"
                      >
                        <Users className="w-4 h-4" />
                        <span className="hidden xs:inline">Assign</span> ({selectedLeadIds.length})
                      </button>
                      <button 
                        onClick={bulkDeleteLeads}
                        className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
                        data-testid="bulk-delete-btn"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden xs:inline">Delete</span> ({selectedLeadIds.length})
                      </button>
                    </>
                  )}
                  <button 
                    onClick={fetchNewLeads}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
                    data-testid="refresh-new-leads-btn"
                  >
                    <RefreshCw className={`w-4 h-4 ${leadsLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* New Leads List */}
            {leadsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg border border-sky-200 p-8 sm:p-12 text-center">
                <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">All Caught Up!</h3>
                <p className="text-gray-500 text-sm sm:text-base">No new WhatsApp inquiries. Great job staying on top!</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
                {/* Select All Header */}
                <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.length === leads.length && leads.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadIds(leads.map(l => l.id));
                        } else {
                          setSelectedLeadIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-600">
                      Select All ({leads.length})
                    </span>
                  </label>
                </div>
                
                {/* Leads Table - Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left w-10"></th>
                        <th className="px-4 py-3 text-left">Lead</th>
                        <th className="px-4 py-3 text-left">Contact</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Source</th>
                        <th className="px-4 py-3 text-left">Stage</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-green-50/50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeadIds([...selectedLeadIds, lead.id]);
                                } else {
                                  setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-green-600"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">NEW</span>
                              <span className="font-medium text-gray-900">{lead.name || 'Unknown'}</span>
                              {lead.ai_priority === 'high' && <span className="text-xs">🔥</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">{lead.phone}</div>
                            {lead.email && <div className="text-xs text-gray-400">{lead.email}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{lead.district || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full capitalize">
                              {lead.source || 'whatsapp'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              lead.stage === 'new' ? 'bg-blue-100 text-blue-700' :
                              lead.stage === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {lead.stage || 'new'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {lead.timestamp ? new Date(lead.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Quick assign modal trigger
                                  setSelectedLeadIds([lead.id]);
                                  setShowBulkAssignModal(true);
                                }}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                                data-testid={`assign-lead-${lead.id}`}
                              >
                                <UserPlus className="w-3 h-3" /> Assign
                              </button>
                              <a
                                href={`tel:+91${lead.phone?.replace(/\D/g, '').slice(-10)}`}
                                className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                                title="Call"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                              <button
                                onClick={() => markLeadContacted(lead.id)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-medium"
                              >
                                Done
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Leads Cards - Mobile */}
                <div className="md:hidden divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <div 
                      key={lead.id} 
                      className="p-3 hover:bg-green-50/50 transition cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                      data-testid={`new-lead-${lead.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedLeadIds([...selectedLeadIds, lead.id]);
                            } else {
                              setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                            }
                          }}
                          className="w-4 h-4 mt-1 rounded border-gray-300 text-green-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">NEW</span>
                            <span className="font-semibold text-gray-900 text-sm truncate">{lead.name || 'Unknown'}</span>
                            {lead.ai_priority === 'high' && <span className="text-xs">🔥</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                            {lead.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.district}</span>}
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded capitalize">{lead.source || 'whatsapp'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeadIds([lead.id]);
                                setShowBulkAssignModal(true);
                              }}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                              data-testid={`assign-lead-mobile-${lead.id}`}
                            >
                              <UserPlus className="w-3 h-3" /> Assign
                            </button>
                            <a
                              href={`tel:+91${lead.phone?.replace(/\D/g, '').slice(-10)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" /> Call
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); markLeadContacted(lead.id); }}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" /> Done
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trash Tab - Soft Deleted Leads */}
        {activeTab === "trash" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl p-4 sm:p-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Trash2 className="w-6 h-6 sm:w-7 sm:h-7" />
                    Trash (Deleted Leads)
                  </h2>
                  <p className="text-gray-300 mt-1 text-sm">
                    {trashedLeads.length} deleted leads • Auto-deleted after 30 days
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedLeadIds.length > 0 && (
                    <button 
                      onClick={() => restoreLeads(selectedLeadIds)}
                      className="bg-green-500/80 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
                      data-testid="restore-selected-btn"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Restore ({selectedLeadIds.length})
                    </button>
                  )}
                  <button 
                    onClick={fetchTrashedLeads}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
                    data-testid="refresh-trash-btn"
                  >
                    <RefreshCw className={`w-4 h-4 ${leadsLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Trashed Leads List */}
            {trashedLeads.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg border border-sky-200 p-8 sm:p-12 text-center">
                <Trash2 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Trash is Empty</h3>
                <p className="text-gray-500 text-sm sm:text-base">No deleted leads. Deleted leads are kept for 30 days before permanent removal.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
                {/* Select All Header */}
                <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.length === trashedLeads.length && trashedLeads.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadIds(trashedLeads.map(l => l.id));
                        } else {
                          setSelectedLeadIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-600">
                      Select All ({trashedLeads.length})
                    </span>
                  </label>
                </div>
                
                {/* Trashed Leads Table - Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left w-10"></th>
                        <th className="px-4 py-3 text-left">Lead</th>
                        <th className="px-4 py-3 text-left">Contact</th>
                        <th className="px-4 py-3 text-left">Source</th>
                        <th className="px-4 py-3 text-left">Deleted On</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {trashedLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeadIds([...selectedLeadIds, lead.id]);
                                } else {
                                  setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-gray-600"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-700 line-through opacity-75">{lead.name || 'Unknown'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-500">{lead.phone}</div>
                            {lead.email && <div className="text-xs text-gray-400">{lead.email}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                              {lead.source || 'manual'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {lead.deleted_at ? new Date(lead.deleted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => restoreLeads([lead.id])}
                              className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs font-medium flex items-center gap-1"
                              data-testid={`restore-lead-${lead.id}`}
                            >
                              <RefreshCw className="w-3 h-3" /> Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Trashed Leads Cards - Mobile */}
                <div className="md:hidden divide-y divide-gray-100">
                  {trashedLeads.map((lead) => (
                    <div key={lead.id} className="p-3 hover:bg-gray-50/50 transition">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeadIds([...selectedLeadIds, lead.id]);
                            } else {
                              setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                            }
                          }}
                          className="w-4 h-4 mt-1 rounded border-gray-300 text-gray-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="font-semibold text-gray-700 text-sm line-through opacity-75 truncate">{lead.name || 'Unknown'}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{lead.source || 'manual'}</span>
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            Deleted: {lead.deleted_at ? new Date(lead.deleted_at).toLocaleDateString('en-IN') : '-'}
                          </div>
                          <button
                            onClick={() => restoreLeads([lead.id])}
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs font-medium flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp CRM Tab */}
        {activeTab === "whatsapp" && (
          openWhatsAppChatLeadId ? (
            <WhatsAppInbox onOpenFromLead={openWhatsAppChatLeadId} />
          ) : (
            <WhatsAppModule />
          )
        )}

        {/* Social Media Manager Tab */}
        {activeTab === "social" && (
          <SocialMediaManager />
        )}

        {/* Cashfree Payments Tab */}
        {activeTab === "cashfree_payments" && (
          <PaymentsDashboard leads={leads} />
        )}

        {/* HR Management Tab - Combines Tasks and Team */}
        {activeTab === "hr_management" && (
          <HRManagementSection
            staffAccounts={staffAccounts}
            tasks={tasks}
            tasksLoading={false}
            fetchStaff={fetchStaff}
            fetchTasks={fetchTasks}
            handleCreateStaff={async (staffData) => {
              try {
                await axios.post(`${API}/admin/staff-accounts`, staffData);
                fetchStaff();
              } catch (err) { alert(err.response?.data?.detail || "Error creating staff"); }
            }}
            handleDeleteStaff={async (staffId) => {
              if (!window.confirm('Delete this staff member?')) return;
              try {
                await axios.delete(`${API}/admin/staff-accounts/${staffId}`);
                fetchStaff();
              } catch (err) { alert(err.response?.data?.detail || "Error deleting staff"); }
            }}
            ownerInfo={staffAccounts.find(s => s.is_owner)}
          />
        )}

        {/* Tasks Tab (Legacy - Redirect to HR) */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowTaskModal(true)} className="bg-green-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2">
                <Plus className="w-4 h-4" /><span>Assign Task</span>
              </button>
            </div>
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
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
              </div>
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
            
            {/* Owner Card - ABHIJEET KUMAR */}
            <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-xl p-5 shadow-lg border-2 border-amber-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-amber-600 font-bold text-2xl shadow-md">
                    AK
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xl">ABHIJEET KUMAR</span>
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">OWNER</span>
                    </div>
                    <div className="text-amber-100 text-sm font-mono">ASR1001</div>
                    <div className="text-amber-100 text-sm">Owner & Managing Director</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/80 text-xs mb-1">PROTECTED ACCOUNT</div>
                  <div className="bg-white/20 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Super Admin
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-amber-400/50">
                <div className="text-amber-100 text-xs">
                  First employee and owner of ASR ENTERPRISES. Full control of website and CRM. Cannot be deleted.
                </div>
              </div>
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
                  {/* Quick View Leads Button */}
                  {staff.leads_assigned > 0 && (
                    <button 
                      onClick={() => {
                        // Filter leads by this staff's ID and switch to leads tab
                        setSelectedStaffFilter(staff.id);
                        setActiveTab("leads");
                      }}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 rounded-lg text-sm font-medium mb-3 flex items-center justify-center space-x-2 hover:shadow-lg transition"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>View {staff.leads_assigned} Leads</span>
                    </button>
                  )}
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
                      // PROTECTION: Cannot delete owner account
                      if (staff.staff_id === "ASR1001" || staff.is_owner) {
                        alert("Cannot delete owner account. ABHIJEET KUMAR (ASR1001) is the owner and has permanent access.");
                        return;
                      }
                      if(window.confirm(`Delete staff member "${staff.name}" (${staff.staff_id})? This cannot be undone.`)) {
                        try {
                          await axios.delete(`${API}/admin/staff-accounts/${staff.staff_id}`);
                          alert('Staff deleted!');
                          fetchAllData();
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Error deleting staff');
                        }
                      }
                    }} className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center space-x-1 ${
                      staff.staff_id === "ASR1001" || staff.is_owner 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`} disabled={staff.staff_id === "ASR1001" || staff.is_owner}>
                      <Trash2 className="w-3 h-3" /><span>{staff.staff_id === "ASR1001" ? 'Protected' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Price Config Tab */}
        {activeTab === "service_config" && (
          <ServicePriceConfig />
        )}

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <BookingsManager />
        )}

        {/* Credentials Management Tab */}
        {activeTab === "credentials" && (
          <div className="space-y-6">
            {/* Owner Credentials - ABHIJEET KUMAR */}
            <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-xl p-5 shadow-lg border-2 border-amber-400">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-amber-600 font-bold text-2xl shadow-md">AK</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">ABHIJEET KUMAR</span>
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">OWNER</span>
                    </div>
                    <div className="text-amber-100 text-sm font-mono">ASR1001 - Super Admin</div>
                    <div className="text-amber-100 text-sm">asrenterprisespatna@gmail.com | 8877896889</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Full Access
                  </div>
                  <div className="bg-white/20 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                    <Key className="w-3 h-3" /> Protected
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-400/50 text-amber-100 text-xs">
                Owner and first employee of ASR ENTERPRISES. Cannot be deleted or removed. Has full control of website and CRM.
              </div>
            </div>

            {/* Admin Credentials */}
            <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
                <h3 className="font-bold text-[#0a355e] flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-amber-500" />
                  Admin Account
                </h3>
                <p className="text-gray-500 text-sm mt-1">Primary admin login for ABHIJEET KUMAR</p>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl">AK</div>
                    <div>
                      <div className="font-bold text-[#0a355e]">ABHIJEET KUMAR (Owner)</div>
                      <div className="text-gray-500 text-sm">Mobile: 8877896889 | Email: asrenterprisespatna@gmail.com</div>
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
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-[#0a355e] flex items-center">
                    <Users className="w-5 h-5 mr-2 text-blue-500" />
                    Staff Credentials
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">Manage staff login access</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowStaffModal(true)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2"
                    data-testid="create-staff-btn"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Staff</span>
                  </button>
                  <button
                    onClick={() => fetchAllData()}
                    className="bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-sm hover:bg-blue-200 transition flex items-center space-x-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
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
                      <div key={staff.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                              {staff.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-[#0a355e]">{staff.name}</div>
                              <div className="text-gray-500 text-sm flex items-center flex-wrap gap-2">
                                <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-xs">{staff.staff_id}</span>
                                <span className="capitalize text-xs">{staff.role}</span>
                                <span className="text-xs">{staff.phone}</span>
                              </div>
                              {staff.email && <div className="text-gray-400 text-xs mt-0.5">{staff.email}</div>}
                            </div>
                          </div>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${staff.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {staff.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${staff.otp_login_enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                              {staff.otp_login_enabled ? 'OTP Enabled' : 'OTP Disabled'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200">
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
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                          >
                            <Key className="w-3 h-3" />
                            <span>Generate Password</span>
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
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Set Password</span>
                          </button>
                          <button
                            onClick={async () => {
                              const enable = !staff.otp_login_enabled;
                              try {
                                await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/toggle-otp`, { otp_login_enabled: enable });
                                fetchAllData();
                                alert(`Mobile OTP login ${enable ? 'enabled' : 'disabled'} for ${staff.name}`);
                              } catch (err) {
                                alert('Error updating OTP settings');
                              }
                            }}
                            className={`${staff.otp_login_enabled ? 'bg-gray-500 hover:bg-gray-600' : 'bg-purple-500 hover:bg-purple-600'} text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition`}
                          >
                            <Phone className="w-3 h-3" />
                            <span>{staff.otp_login_enabled ? 'Disable OTP' : 'Enable OTP'}</span>
                          </button>
                          <button
                            onClick={async () => {
                              const newStatus = !staff.is_active;
                              if (window.confirm(`${newStatus ? 'Activate' : 'Deactivate'} login access for ${staff.name}?`)) {
                                try {
                                  await axios.put(`${API}/admin/staff-accounts/${staff.staff_id}/toggle-status`, { is_active: newStatus });
                                  fetchAllData();
                                  alert(`Login access ${newStatus ? 'activated' : 'deactivated'}`);
                                } catch (err) {
                                  alert('Error updating access');
                                }
                              }
                            }}
                            className={`${staff.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition`}
                          >
                            {staff.is_active ? <Trash2 className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            <span>{staff.is_active ? 'Deactivate' : 'Activate'}</span>
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

        {/* AI Assistant Tab */}
        {activeTab === "ai_assistant" && (
          <div className="space-y-4">
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0a355e] font-bold flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-purple-500" />
                  <span>AI Assistant</span>
                </h3>
                <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full">
                  Powered by Gemini AI
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Your intelligent assistant for generating quotes, WhatsApp replies, and lead analysis. 
                Ask anything about solar business!
              </p>
              <AdminAIAssistant />
            </div>
          </div>
        )}

        {/* Google Reviews Tab */}
        {activeTab === "google_reviews" && (
          <div className="space-y-6">
            <GoogleReviewsTab />
          </div>
        )}

        {/* Site Settings Tab */}
        {activeTab === "site_settings" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="w-7 h-7" />
                Site Settings
              </h2>
              <p className="text-purple-200 mt-1">Manage website appearance and content</p>
            </div>
            
            {/* Marquee Settings */}
            <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                <div className="text-white">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Megaphone className="w-5 h-5" />
                    Running Marquee Header
                  </h3>
                  <p className="text-amber-100 text-sm">This text scrolls across the top of your website</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-white text-sm">Enabled</span>
                  <input
                    type="checkbox"
                    checked={siteSettings.marquee_enabled}
                    onChange={(e) => setSiteSettings({ ...siteSettings, marquee_enabled: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                </label>
              </div>
              <div className="p-6 space-y-4">
                {/* Preview */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Live Preview:</label>
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 py-2 overflow-hidden rounded-lg">
                    <div className="animate-marquee whitespace-nowrap flex items-center">
                      <span className="mx-8 text-white font-semibold text-sm flex items-center gap-2">
                        <span className="text-yellow-200">☀</span>
                        {siteSettings.marquee_text || "Enter your marquee text above"}
                      </span>
                      <span className="mx-8 text-white font-semibold text-sm flex items-center gap-2">
                        <span className="text-yellow-200">☀</span>
                        {siteSettings.marquee_text || "Enter your marquee text above"}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Text Input */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Marquee Text:</label>
                  <textarea
                    value={siteSettings.marquee_text}
                    onChange={(e) => setSiteSettings({ ...siteSettings, marquee_text: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                    rows={3}
                    placeholder="Enter the scrolling announcement text..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: Include call-to-action like phone numbers, offers, or promotions
                  </p>
                </div>
                
                {/* Quick Templates */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Quick Templates:</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "☀Get up to ₹78,000 Subsidy under PM Surya Ghar Yojana Call Now: 8877896889 WhatsApp for Quote",
                      "🔥 Limited Time Offer! Get FREE Installation on 3kW+ Solar Systems. Call: 8877896889",
                      "💡 Switch to Solar & Save 90% on Electricity Bills! Contact ASR Enterprises Today",
                      "🌞 Bihar's #1 Solar Company | 10,000+ Happy Customers | Call: 8877896889"
                    ].map((template, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSiteSettings({ ...siteSettings, marquee_text: template })}
                        className="text-xs bg-gray-100 hover:bg-orange-100 text-gray-700 px-3 py-2 rounded-lg transition border border-gray-200 hover:border-orange-300"
                      >
                        {template.slice(0, 40)}...
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={saveSiteSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 shadow-md"
                  >
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Marquee Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backups Tab */}
        {activeTab === "backups" && (
          <div className="space-y-6">
            <BackupsTab />
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
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
              </div>
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

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span>Bulk Assign Leads</span>
            </h2>
            
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <p className="text-purple-700 font-medium">{selectedLeadIds.length} leads selected</p>
              <p className="text-purple-600 text-sm">All selected leads will be assigned to the chosen staff member</p>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-600 text-sm font-medium mb-2">Select Staff Member</label>
              <select
                value={bulkAssignStaffId}
                onChange={(e) => setBulkAssignStaffId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">-- Select Staff --</option>
                {staffAccounts.filter(s => s.is_active && !['ASR1001','ASR1002'].includes(s.staff_id) && !['ABHIJEET KUMAR','ANAMIKA'].includes(s.name?.toUpperCase?.())).map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.staff_id}) - {staff.leads_assigned || 0} leads
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => { setShowBulkAssignModal(false); setBulkAssignStaffId(''); }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={bulkAssignLeads}
                disabled={bulkAssigning || !bulkAssignStaffId}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-3 rounded-xl font-bold hover:from-purple-600 hover:to-indigo-600 transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {bulkAssigning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Assigning...</span></>
                ) : (
                  <><CheckCircle className="w-4 h-4" /><span>Assign {selectedLeadIds.length} Leads</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-orange-400" />
              <span>Bulk Import Leads (For Calling)</span>
            </h2>
            
            {!bulkImportResult ? (
              <div className="space-y-4">
                {/* Mode Tabs */}
                <div className="flex border-b border-gray-200">
                  <button 
                    onClick={() => setBulkImportMode('file')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${bulkImportMode === 'file' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                    Upload File
                  </button>
                  <button 
                    onClick={() => setBulkImportMode('paste')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${bulkImportMode === 'paste' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    <ClipboardList className="w-4 h-4 inline mr-1" />
                    Paste Numbers
                  </button>
                </div>

                {bulkImportMode === 'file' ? (
                  <>
                    <div className="border-2 border-dashed border-sky-200 rounded-lg p-6 text-center">
                      <input 
                        type="file" 
                        ref={bulkFileInputRef}
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => setBulkImportFile(e.target.files[0])}
                        className="hidden" 
                      />
                      <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <button 
                        onClick={() => bulkFileInputRef.current?.click()} 
                        className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium mb-2 hover:bg-orange-700"
                      >
                        Select CSV or Excel File
                      </button>
                      {bulkImportFile && (
                        <p className="text-green-600 text-sm mt-2 font-medium">{bulkImportFile.name}</p>
                      )}
                      <div className="text-gray-500 text-xs mt-3 space-y-1">
                        <p className="font-semibold text-green-600">Only phone number column required!</p>
                        <p>Supports: CSV, Excel (.xlsx, .xls)</p>
                        <p>Column names: phone, mobile, contact, number</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={downloadCSVTemplate} 
                      className="w-full bg-gray-50 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm flex items-center justify-center space-x-2 hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV Template</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                      <p className="font-semibold mb-1">Paste phone numbers below:</p>
                      <p>• One number per line, OR</p>
                      <p>• Comma-separated, OR</p>
                      <p>• Space-separated</p>
                    </div>
                    <textarea
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder="9876543210&#10;9123456789&#10;8765432109&#10;&#10;Or paste comma-separated:&#10;9876543210, 9123456789, 8765432109"
                      className="w-full h-48 border border-gray-300 rounded-lg p-3 text-sm font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Count: {bulkPasteText.split(/[\n,;\s]+/).filter(p => p.trim()).length} numbers</span>
                      <button 
                        onClick={() => setBulkPasteText('')}
                        className="text-red-500 hover:text-red-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 mt-4">
                  <button 
                    onClick={handleBulkImport} 
                    disabled={(bulkImportMode === 'file' ? !bulkImportFile : !bulkPasteText.trim()) || bulkImporting}
                    className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center space-x-2 hover:bg-orange-700"
                  >
                    {bulkImporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <span>{bulkImporting ? "Importing..." : "Import Leads"}</span>
                  </button>
                  <button 
                    onClick={() => { setShowBulkImportModal(false); setBulkImportFile(null); setBulkImportResult(null); setBulkPasteText(''); setBulkImportMode('file'); }} 
                    className="px-6 py-3 bg-gray-50 border border-gray-300 text-[#0a355e] rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${bulkImportResult.imported_count > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-lg font-semibold text-[#0a355e] mb-2">{bulkImportResult.message}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-green-600 font-medium">Imported: {bulkImportResult.imported_count}</span>
                    {bulkImportResult.duplicate_count > 0 && (
                      <span className="text-yellow-600 font-medium">Duplicates: {bulkImportResult.duplicate_count}</span>
                    )}
                    {bulkImportResult.error_count > 0 && (
                      <span className="text-red-600 font-medium">Errors: {bulkImportResult.error_count}</span>
                    )}
                  </div>
                  {bulkImportResult.phone_column_used && (
                    <p className="text-xs text-gray-500 mt-2">Phone column detected: {bulkImportResult.phone_column_used}</p>
                  )}
                </div>
                
                {bulkImportResult.duplicates?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-yellow-700 text-sm font-semibold mb-2">Skipped Duplicates ({bulkImportResult.duplicate_count}):</p>
                    {bulkImportResult.duplicates.slice(0, 5).map((dup, i) => (
                      <p key={i} className="text-gray-600 text-xs">#{dup.row}: {dup.phone}</p>
                    ))}
                    {bulkImportResult.duplicates.length > 5 && (
                      <p className="text-gray-500 text-xs mt-1">... and {bulkImportResult.duplicate_count - 5} more</p>
                    )}
                  </div>
                )}
                
                {bulkImportResult.errors?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-red-600 text-sm font-semibold mb-2">Errors ({bulkImportResult.error_count}):</p>
                    {bulkImportResult.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-gray-600 text-xs">#{err.row}: {err.error || err.input}</p>
                    ))}
                    {bulkImportResult.error_count > 10 && (
                      <p className="text-gray-500 text-xs mt-1">... and {bulkImportResult.error_count - 10} more</p>
                    )}
                  </div>
                )}

                <button 
                  onClick={() => { setShowBulkImportModal(false); setBulkImportFile(null); setBulkImportResult(null); setBulkPasteText(''); setBulkImportMode('file'); }} 
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Import Modal */}
      {showSmartImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0a355e]">Smart Import Leads</h2>
                <p className="text-gray-500 text-sm">AI-powered import from multiple file formats</p>
              </div>
              <button onClick={closeSmartImportModal} className="text-gray-400 hover:text-gray-600">
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            {/* Step: Upload */}
            {smartImportStep === 'upload' && (
              <div className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <FileSpreadsheet className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <span className="text-green-700 text-sm font-medium">CSV / Excel</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <FileText className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <span className="text-red-700 text-sm font-medium">PDF</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <Image className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <span className="text-blue-700 text-sm font-medium">Images</span>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <span className="text-purple-700 text-sm font-medium">AI Extract</span>
                  </div>
                </div>

                <input
                  ref={smartFileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleSmartFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={() => smartFileInputRef.current?.click()}
                  disabled={extracting}
                  className="w-full border-2 border-dashed border-purple-300 rounded-xl p-12 text-center hover:border-purple-500 hover:bg-purple-50 transition disabled:opacity-50"
                >
                  {extracting ? (
                    <>
                      <RefreshCw className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-spin" />
                      <span className="text-purple-700 font-medium text-lg">Extracting data with AI...</span>
                      <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                      <span className="text-gray-700 font-medium text-lg">Click to select file</span>
                      <p className="text-gray-500 text-sm mt-2">
                        Supports: CSV, Excel (.xlsx), PDF, Images (JPG, PNG)
                      </p>
                    </>
                  )}
                </button>

                <div className="mt-6 bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Supported Data Fields:</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Name', 'Phone', 'Email', 'District', 'Address', 'Property Type', 'Business Type', 'Monthly Bill', 'Notes'].map(field => (
                      <span key={field} className="bg-white px-3 py-1 rounded-full text-sm text-gray-600 border">{field}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {smartImportStep === 'preview' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-600">
                      {selectedSmartFile?.name} - <strong>{extractedLeads.length}</strong> leads found
                    </span>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                      {extractedLeads.filter(l => l._selected).length} selected
                    </span>
                  </div>
                  <button
                    onClick={resetSmartImport}
                    className="text-gray-500 hover:text-gray-700 text-sm flex items-center space-x-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Upload different file</span>
                  </button>
                </div>

                {/* Lead Type Selection */}
                <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-green-50 rounded-xl border border-orange-200">
                  <h4 className="font-semibold text-gray-700 mb-3">Select Lead Destination:</h4>
                  <div className="flex flex-wrap gap-3">
                    <label className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${leadType === 'auto' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="crmLeadType" value="auto" checked={leadType === 'auto'} onChange={(e) => setLeadType(e.target.value)} className="text-purple-600" />
                      <div>
                        <span className="font-medium text-gray-700">Auto Detect</span>
                        <p className="text-xs text-gray-500">AI classifies based on data</p>
                      </div>
                    </label>
                    <label className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${leadType === 'residential' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="crmLeadType" value="residential" checked={leadType === 'residential'} onChange={(e) => setLeadType(e.target.value)} className="text-orange-600" />
                      <div>
                        <span className="font-medium text-orange-700">Residential Solar Customer</span>
                        <p className="text-xs text-gray-500">Home / Household customers</p>
                      </div>
                    </label>
                    <label className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${leadType === 'commercial' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="crmLeadType" value="commercial" checked={leadType === 'commercial'} onChange={(e) => setLeadType(e.target.value)} className="text-green-600" />
                      <div>
                        <span className="font-medium text-green-700">Commercial Solar Customer</span>
                        <p className="text-xs text-gray-500">Business / Industrial customers</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-xl">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="p-3 text-left text-xs font-semibold text-gray-600">
                          <input
                            type="checkbox"
                            checked={extractedLeads.every(l => l._selected)}
                            onChange={(e) => setExtractedLeads(prev => prev.map(l => ({ ...l, _selected: e.target.checked })))}
                            className="rounded"
                          />
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-600">Name</th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-600">Phone</th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-600">District</th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-600">Property</th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-600">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedLeads.map((lead, idx) => (
                        <tr key={idx} className={`border-t ${!lead._selected ? 'opacity-50 bg-gray-50' : ''}`}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={lead._selected}
                              onChange={() => handleToggleSmartLeadSelection(idx)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={lead.name || ''}
                              onChange={(e) => handleEditSmartLead(idx, 'name', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                              placeholder="Name"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={lead.phone || ''}
                              onChange={(e) => handleEditSmartLead(idx, 'phone', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                              placeholder="Phone"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={lead.district || ''}
                              onChange={(e) => handleEditSmartLead(idx, 'district', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                              placeholder="District"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={lead.property_type || 'residential'}
                              onChange={(e) => handleEditSmartLead(idx, 'property_type', e.target.value)}
                              className="bg-transparent text-sm"
                            >
                              <option value="residential">Residential</option>
                              <option value="commercial">Commercial</option>
                              <option value="industrial">Industrial</option>
                              <option value="agricultural">Agricultural</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={lead.monthly_bill || ''}
                              onChange={(e) => handleEditSmartLead(idx, 'monthly_bill', e.target.value)}
                              className="w-20 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                              placeholder="₹"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end space-x-3">
                  <button onClick={resetSmartImport} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={handleConfirmSmartImport}
                    disabled={smartImporting || extractedLeads.filter(l => l._selected).length === 0}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center space-x-2"
                  >
                    {smartImporting ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /><span>Importing...</span></>
                    ) : (
                      <><CheckCircle className="w-5 h-5" /><span>Import {extractedLeads.filter(l => l._selected).length} Leads</span></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Result */}
            {smartImportStep === 'result' && smartImportResult && (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${smartImportResult.imported_count > 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  {smartImportResult.imported_count > 0 ? (
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  ) : (
                    <AlertCircle className="w-10 h-10 text-yellow-600" />
                  )}
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {smartImportResult.imported_count > 0 ? 'Import Successful!' : 'No Leads Imported'}
                </h3>
                
                <p className="text-gray-600 mb-6">{smartImportResult.message}</p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{smartImportResult.imported_count}</div>
                    <div className="text-green-700 text-sm">Imported</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{smartImportResult.duplicate_count}</div>
                    <div className="text-yellow-700 text-sm">Duplicates</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{smartImportResult.error_count}</div>
                    <div className="text-red-700 text-sm">Errors</div>
                  </div>
                </div>

                {(smartImportResult.residential_count > 0 || smartImportResult.commercial_count > 0) && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{smartImportResult.residential_count || 0}</div>
                      <div className="text-orange-700 text-sm">Residential Solar</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{smartImportResult.commercial_count || 0}</div>
                      <div className="text-green-700 text-sm">Commercial Solar</div>
                    </div>
                  </div>
                )}

                <button onClick={closeSmartImportModal} className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 bg-[#0a355e] text-white p-4 rounded-full shadow-xl hover:bg-[#0B3C5D] transition-all hover:scale-110 border border-white/30"
          data-testid="crm-scroll-to-top"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}

      {/* WhatsApp Send Template Modal */}
      <SendWhatsAppModal 
        isOpen={showWhatsAppModal} 
        onClose={() => { setShowWhatsAppModal(false); setWhatsAppModalLead(null); }}
        lead={whatsAppModalLead}
        onSent={() => { fetchAllData(); }}
      />

      {/* WhatsApp Bulk Campaign Modal */}
      <BulkCampaignModal 
        isOpen={showBulkCampaignModal}
        onClose={() => { setShowBulkCampaignModal(false); setSelectedLeadsForCampaign([]); }}
        selectedLeads={selectedLeadsForCampaign}
        onCampaignStarted={() => { 
          setSelectedLeadIds([]);
          setSelectedLeadsForCampaign([]);
          fetchAllData(); 
        }}
      />

      {/* WhatsApp Lead History Modal */}
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
    </div>
  );
};
