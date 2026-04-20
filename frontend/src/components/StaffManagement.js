import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Edit, Users, Sparkles, CheckCircle, Clock, Calendar, TrendingUp } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "staff",
    reportingTo: "",
    joiningDate: "",
    status: "active"
  });
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: ""
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API}/admin/staff`);
      setStaff(res.data);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/admin/staff`, formData);
      setFormData({ name: "", email: "", phone: "", role: "staff", reportingTo: "", joiningDate: "", status: "active" });
      setShowForm(false);
      fetchStaff();
    } catch (err) {
      alert("Error adding staff");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this staff member?")) {
      try {
        await axios.delete(`${API}/admin/staff/${id}`);
        fetchStaff();
      } catch (err) {
        alert("Error deleting staff");
      }
    }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      await axios.post(`${API}/admin/staff/${selectedStaff.id}/task`, taskData);
      setTaskData({ title: "", description: "", priority: "medium", due_date: "" });
      setShowTaskForm(false);
      fetchStaff();
      alert("Task assigned successfully!");
    } catch (err) {
      alert("Error assigning task");
    }
  };

  const handleAIAnalysis = async (staffMember) => {
    setAnalyzing(staffMember.id);
    try {
      const res = await axios.post(`${API}/admin/staff/${staffMember.id}/ai-analysis`);
      alert(`AI Analysis for ${staffMember.name}:\n\n${res.data.analysis}`);
      fetchStaff();
    } catch (err) {
      alert("Error running AI analysis");
    }
    setAnalyzing(null);
  };

  const handleMarkAttendance = async (staffId, status) => {
    try {
      await axios.post(`${API}/admin/staff/${staffId}/attendance`, { status });
      alert(`Attendance marked as ${status}`);
    } catch (err) {
      alert("Error marking attendance");
    }
  };

  return (
    <div className="min-h-screen bg-white shadow-lg py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold text-[#0a355e]">AI Staff Management</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Staff</span>
          </button>
        </div>

        {/* AI Features Banner */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl p-6 mb-8 text-[#0a355e]">
          <div className="flex items-center space-x-4">
            <Sparkles className="w-10 h-10" />
            <div>
              <h2 className="text-xl font-bold">AI-Powered Staff Management</h2>
              <p className="text-cyan-200">
                Automatic performance analysis, task tracking, attendance monitoring, and smart recommendations
              </p>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Add New Staff Member</h2>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              >
                <option value="staff">Staff</option>
                <option value="technician">Technician</option>
                <option value="sales">Sales Executive</option>
                <option value="manager">Manager</option>
              </select>
              <input
                type="text"
                placeholder="Reporting To"
                value={formData.reportingTo}
                onChange={(e) => setFormData({...formData, reportingTo: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              />
              <input
                type="date"
                value={formData.joiningDate}
                onChange={(e) => setFormData({...formData, joiningDate: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 md:col-span-2"
              >
                {loading ? "Adding..." : "Add Staff Member"}
              </button>
            </form>
          </div>
        )}

        {/* Task Assignment Modal */}
        {showTaskForm && selectedStaff && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-[#0a355e] mb-4">Assign Task to {selectedStaff.name}</h2>
              <form onSubmit={handleAssignTask} className="space-y-4">
                <input
                  type="text"
                  placeholder="Task Title"
                  value={taskData.title}
                  onChange={(e) => setTaskData({...taskData, title: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg w-full"
                  required
                />
                <textarea
                  placeholder="Task Description"
                  value={taskData.description}
                  onChange={(e) => setTaskData({...taskData, description: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg w-full"
                  rows={3}
                />
                <select
                  value={taskData.priority}
                  onChange={(e) => setTaskData({...taskData, priority: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg w-full"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="date"
                  value={taskData.due_date}
                  onChange={(e) => setTaskData({...taskData, due_date: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg w-full"
                />
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="bg-green-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-green-700 flex-1"
                  >
                    Assign Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTaskForm(false)}
                    className="bg-gray-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Staff Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((member) => (
            <div key={member.id} className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-[#0a355e] font-bold text-xl">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0a355e]">{member.name}</h3>
                    <span className="text-cyan-400 text-sm capitalize">{member.role}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(member.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <span className="w-24">Phone:</span>
                  <span className="text-gray-600">{member.phone}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-24">Email:</span>
                  <span className="text-gray-600 truncate">{member.email}</span>
                </div>
                {member.reportingTo && (
                  <div className="flex items-center">
                    <span className="w-24">Reports To:</span>
                    <span className="text-gray-600">{member.reportingTo}</span>
                  </div>
                )}
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 text-center">
                  <div className="text-green-400 font-bold">{member.tasks_completed || 0}</div>
                  <div className="text-xs text-gray-500">Completed</div>
                </div>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 text-center">
                  <div className="text-yellow-400 font-bold">{member.tasks_pending || 0}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-2 text-center">
                  <div className="text-blue-400 font-bold">{member.performance_score || 80}%</div>
                  <div className="text-xs text-gray-500">Score</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <button
                    onClick={() => { setSelectedStaff(member); setShowTaskForm(true); }}
                    className="flex-1 bg-blue-600 text-[#0a355e] py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center space-x-1"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Assign Task</span>
                  </button>
                  <button
                    onClick={() => handleMarkAttendance(member.id, "present")}
                    className="flex-1 bg-green-600 text-[#0a355e] py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center space-x-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Present</span>
                  </button>
                </div>
                <button
                  onClick={() => handleAIAnalysis(member)}
                  disabled={analyzing === member.id}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-[#0a355e] py-2 rounded-lg text-sm font-medium hover:from-purple-700 hover:to-pink-700 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${analyzing === member.id ? "animate-spin" : ""}`} />
                  <span>{analyzing === member.id ? "Analyzing..." : "AI Performance Analysis"}</span>
                </button>
              </div>

              {member.ai_performance_insights && (
                <div className="mt-4 bg-purple-600 bg-opacity-20 border border-purple-600 rounded-lg p-3">
                  <div className="text-purple-400 text-xs font-semibold mb-1">AI Insights:</div>
                  <p className="text-gray-600 text-xs">{member.ai_performance_insights.substring(0, 150)}...</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {staff.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No staff members added yet. Click "Add Staff" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
