import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, UserPlus, FileText, Calendar, TrendingUp, Clock, CheckCircle, XCircle, Edit, Trash2, Eye, Download, ChevronDown, ChevronUp, Search, Filter, RefreshCw, Building2, Briefcase, IndianRupee, Phone, Mail, MapPin, AlertCircle, Award, BarChart3, UserCheck, ClipboardList } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEPARTMENTS = [
  { value: "sales", label: "Sales" },
  { value: "technical", label: "Technical" },
  { value: "admin", label: "Admin" },
  { value: "marketing", label: "Marketing" },
  { value: "support", label: "Support" }
];

const ROLES = [
  { value: "sales", label: "Sales Executive" },
  { value: "manager", label: "Manager" },
  { value: "telecaller", label: "Telecaller" },
  { value: "technician", label: "Technician" },
  { value: "admin", label: "Admin" }
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" }
];

const STATUSES = [
  { value: "active", label: "Active", color: "bg-green-500" },
  { value: "probation", label: "Probation", color: "bg-yellow-500" },
  { value: "notice_period", label: "Notice Period", color: "bg-orange-500" },
  { value: "resigned", label: "Resigned", color: "bg-gray-500" },
  { value: "terminated", label: "Terminated", color: "bg-red-500" }
];

export const HRManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "male",
    address: "",
    city: "",
    pincode: "",
    department: "sales",
    designation: "",
    role: "sales",
    employment_type: "full_time",
    joining_date: new Date().toISOString().split("T")[0],
    base_salary: "",
    allowances: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    pan_number: "",
    aadhar_number: "",
    bank_name: "",
    bank_account_number: "",
    bank_ifsc: ""
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hr/dashboard`);
      setDashboard(res.data);
    } catch (err) {
      console.error("Error fetching HR dashboard:", err);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterDept) params.append("department", filterDept);
      if (filterStatus) params.append("status", filterStatus);
      const res = await axios.get(`${API}/hr/employees?${params}`);
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  }, [filterDept, filterStatus]);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hr/leaves`);
      setLeaves(res.data.leaves || []);
    } catch (err) {
      console.error("Error fetching leaves:", err);
    }
  }, []);

  const fetchPerformance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hr/performance`);
      setPerformance(res.data.performance || []);
    } catch (err) {
      console.error("Error fetching performance:", err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchEmployees()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchEmployees]);

  useEffect(() => {
    if (activeTab === "leaves") fetchLeaves();
    if (activeTab === "performance") fetchPerformance();
  }, [activeTab, fetchLeaves, fetchPerformance]);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.phone) {
      alert("Name and Phone are required!");
      return;
    }
    try {
      const payload = { ...newEmployee };
      if (payload.base_salary) payload.base_salary = parseFloat(payload.base_salary);
      if (payload.allowances) payload.allowances = parseFloat(payload.allowances);
      
      const res = await axios.post(`${API}/hr/employees`, payload);
      alert(`Employee created successfully!\nEmployee ID: ${res.data.employee.employee_id}`);
      setShowAddForm(false);
      setNewEmployee({
        name: "", email: "", phone: "", date_of_birth: "", gender: "male",
        address: "", city: "", pincode: "", department: "sales", designation: "",
        role: "sales", employment_type: "full_time",
        joining_date: new Date().toISOString().split("T")[0],
        base_salary: "", allowances: "", emergency_contact_name: "",
        emergency_contact_phone: "", emergency_contact_relation: "",
        pan_number: "", aadhar_number: "", bank_name: "",
        bank_account_number: "", bank_ifsc: ""
      });
      fetchEmployees();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || "Error creating employee");
    }
  };

  const handleUpdateOnboarding = async (employeeId, field, value) => {
    try {
      await axios.put(`${API}/hr/employees/${employeeId}/onboarding`, { [field]: value });
      fetchEmployees();
    } catch (err) {
      alert("Error updating onboarding status");
    }
  };

  const handleLeaveAction = async (leaveId, status, approvedBy = "Admin") => {
    try {
      await axios.put(`${API}/hr/leaves/${leaveId}`, { status, approved_by: approvedBy });
      fetchLeaves();
      alert(`Leave ${status}`);
    } catch (err) {
      alert("Error updating leave request");
    }
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmMsg = `Are you sure you want to PERMANENTLY DELETE employee "${employee.name}" (${employee.employee_id})?\n\nThis will:\n- Delete all employee data\n- Remove from CRM Teams\n- Delete attendance records\n- Delete leave requests\n\nThis action CANNOT be undone!`;
    
    if (window.confirm(confirmMsg)) {
      try {
        await axios.delete(`${API}/hr/employees/${employee.employee_id}/permanent`);
        alert(`Employee ${employee.employee_id} has been permanently deleted.`);
        setShowDetailsModal(null);
        fetchEmployees();
        fetchDashboard();
      } catch (err) {
        alert(err.response?.data?.detail || "Error deleting employee");
      }
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.phone?.includes(searchTerm);
    return matchesSearch;
  });

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "employees", label: "Employees", icon: <Users className="w-4 h-4" /> },
    { id: "recruitment", label: "Recruitment", icon: <UserCheck className="w-4 h-4" /> },
    { id: "onboarding", label: "Onboarding", icon: <CheckCircle className="w-4 h-4" /> },
    { id: "leaves", label: "Leaves", icon: <Calendar className="w-4 h-4" /> },
    { id: "performance", label: "Performance", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "reports", label: "Reports", icon: <FileText className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/admin/dashboard")} 
              className="p-2 bg-white rounded-lg shadow hover:bg-sky-50 transition"
              data-testid="hr-back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-[#0a355e]" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#0a355e]">HR Management</h1>
              <p className="text-gray-500 text-sm">Employee management, onboarding, performance & more</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition flex items-center space-x-2"
            data-testid="add-employee-btn"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-sky-200 mb-6 overflow-x-auto">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                data-testid={`hr-tab-${tab.id}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-sky-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Total Employees</p>
                    <p className="text-3xl font-bold text-[#0a355e]">{dashboard?.total_employees || 0}</p>
                  </div>
                  <Users className="w-10 h-10 text-blue-500 opacity-50" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Active</p>
                    <p className="text-3xl font-bold text-green-600">{dashboard?.active_employees || 0}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">On Probation</p>
                    <p className="text-3xl font-bold text-yellow-600">{dashboard?.on_probation || 0}</p>
                  </div>
                  <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Pending Onboarding</p>
                    <p className="text-3xl font-bold text-orange-600">{dashboard?.pending_onboarding || 0}</p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-orange-500 opacity-50" />
                </div>
              </div>
            </div>

            {/* Department & Salary */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-sky-200">
                <h3 className="font-semibold text-[#0a355e] mb-4 flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-blue-500" />
                  Department Breakdown
                </h3>
                <div className="space-y-3">
                  {dashboard?.departments && Object.entries(dashboard.departments).map(([dept, count]) => (
                    <div key={dept} className="flex items-center justify-between">
                      <span className="capitalize text-gray-700">{dept}</span>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-sky-200">
                <h3 className="font-semibold text-[#0a355e] mb-4 flex items-center">
                  <IndianRupee className="w-5 h-5 mr-2 text-green-500" />
                  Salary Overview
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-gray-700">Monthly Payroll</span>
                    <span className="text-xl font-bold text-green-600">₹{(dashboard?.total_monthly_salary || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Recent Joinings (30 days)</span>
                    <span className="text-xl font-bold text-blue-600">{dashboard?.recent_joinings || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">Pending Leave Requests</span>
                    <span className="text-xl font-bold text-yellow-600">{dashboard?.pending_leave_requests || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl p-4 shadow-lg border border-sky-200 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    data-testid="hr-search-input"
                  />
                </div>
              </div>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button onClick={() => { fetchEmployees(); fetchDashboard(); }} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Employees Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">Loading employees...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-sky-200">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-500 mb-2">No Employees Found</h3>
                <p className="text-gray-400 mb-4">Add your first employee to get started</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
                >
                  Add Employee
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map(emp => (
                  <div key={emp.id} className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden hover:shadow-xl transition">
                    <div className={`h-2 ${STATUSES.find(s => s.value === emp.status)?.color || 'bg-gray-500'}`}></div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                            {emp.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-[#0a355e]">{emp.name}</h3>
                            <p className="text-cyan-600 text-sm font-mono">{emp.employee_id}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full text-white ${STATUSES.find(s => s.value === emp.status)?.color || 'bg-gray-500'}`}>
                          {emp.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-600">
                          <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="capitalize">{emp.designation || emp.role}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="capitalize">{emp.department}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{emp.phone}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          <span>Joined: {emp.joining_date}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex space-x-4 text-xs">
                          <div className="text-center">
                            <p className="font-bold text-blue-600">{emp.leads_assigned || 0}</p>
                            <p className="text-gray-500">Assigned</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-green-600">{emp.leads_converted || 0}</p>
                            <p className="text-gray-500">Converted</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-yellow-600">₹{((emp.total_revenue || 0) / 1000).toFixed(0)}K</p>
                            <p className="text-gray-500">Revenue</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setShowDetailsModal(emp)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                            title="Delete Employee"
                            data-testid={`delete-emp-${emp.employee_id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onboarding Tab */}
        {activeTab === "onboarding" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-lg border border-sky-200">
              <h3 className="font-semibold text-[#0a355e] mb-4">Pending Onboarding Tasks</h3>
              {employees.filter(e => !e.onboarding_completed).length === 0 ? (
                <p className="text-gray-500 text-center py-8">All employees have completed onboarding!</p>
              ) : (
                <div className="space-y-4">
                  {employees.filter(e => !e.onboarding_completed).map(emp => (
                    <div key={emp.id} className="border rounded-xl p-4 bg-gradient-to-r from-yellow-50 to-orange-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                            {emp.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#0a355e]">{emp.name}</h4>
                            <p className="text-sm text-gray-500">{emp.employee_id} | Joined: {emp.joining_date}</p>
                          </div>
                        </div>
                        <span className="text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                          {Object.values(emp.onboarding_checklist || {}).filter(Boolean).length} / 6 Complete
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          { key: "documents_submitted", label: "Documents Submitted" },
                          { key: "id_card_created", label: "ID Card Created" },
                          { key: "bank_details_added", label: "Bank Details Added" },
                          { key: "system_access_given", label: "System Access Given" },
                          { key: "training_completed", label: "Training Completed" },
                          { key: "reporting_manager_assigned", label: "Manager Assigned" }
                        ].map(item => (
                          <label key={item.key} className="flex items-center space-x-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={emp.onboarding_checklist?.[item.key] || false}
                              onChange={(e) => handleUpdateOnboarding(emp.employee_id, item.key, e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm text-gray-700">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leave Management Tab */}
        {activeTab === "leaves" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-[#0a355e]">Leave Requests</h3>
                <span className="text-sm text-gray-500">
                  {leaves.filter(l => l.status === "pending").length} pending
                </span>
              </div>
              {leaves.length === 0 ? (
                <div className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No leave requests</p>
                </div>
              ) : (
                <div className="divide-y">
                  {leaves.map(leave => (
                    <div key={leave.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {leave.employee_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-[#0a355e]">{leave.employee_name}</p>
                            <p className="text-sm text-gray-500">{leave.employee_id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium capitalize">{leave.leave_type} Leave</p>
                          <p className="text-sm text-gray-500">{leave.from_date} to {leave.to_date}</p>
                          <p className="text-xs text-gray-400">{leave.total_days} day(s)</p>
                        </div>
                      </div>
                      {leave.reason && (
                        <p className="mt-2 text-sm text-gray-600 bg-gray-100 p-2 rounded">{leave.reason}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`px-3 py-1 text-xs rounded-full ${
                          leave.status === "approved" ? "bg-green-100 text-green-700" :
                          leave.status === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {leave.status}
                        </span>
                        {leave.status === "pending" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleLeaveAction(leave.id, "approved")}
                              className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 flex items-center space-x-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleLeaveAction(leave.id, "rejected")}
                              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 flex items-center space-x-1"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === "performance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg border border-sky-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-[#0a355e]">Employee Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Department</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Leads Assigned</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Converted</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Conversion %</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Revenue</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {performance.map(perf => (
                      <tr key={perf.employee_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                              {perf.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#0a355e]">{perf.name}</p>
                              <p className="text-xs text-gray-500">{perf.employee_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-600">{perf.department}</td>
                        <td className="px-4 py-3 text-center font-medium text-blue-600">{perf.leads_assigned}</td>
                        <td className="px-4 py-3 text-center font-medium text-green-600">{perf.leads_converted}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            perf.conversion_rate >= 50 ? "bg-green-100 text-green-700" :
                            perf.conversion_rate >= 25 ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {perf.conversion_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-amber-600">₹{(perf.total_revenue / 1000).toFixed(0)}K</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium">{perf.performance_rating || "-"}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-5 shadow-lg border border-sky-200">
              <h3 className="font-semibold text-[#0a355e] mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-500" />
                Quick Reports
              </h3>
              <div className="space-y-3">
                <button className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 transition flex items-center justify-between">
                  <span>Employee Directory</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
                <button className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 transition flex items-center justify-between">
                  <span>Salary Report</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
                <button className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 transition flex items-center justify-between">
                  <span>Attendance Summary</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
                <button className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 transition flex items-center justify-between">
                  <span>Leave Balance Report</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-lg border border-sky-200">
              <h3 className="font-semibold text-[#0a355e] mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                Performance Insights
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Top Performer</p>
                  <p className="font-bold text-green-700">
                    {performance.sort((a, b) => b.total_revenue - a.total_revenue)[0]?.name || "N/A"}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Highest Conversion Rate</p>
                  <p className="font-bold text-blue-700">
                    {performance.sort((a, b) => b.conversion_rate - a.conversion_rate)[0]?.name || "N/A"}
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Revenue Generated</p>
                  <p className="font-bold text-amber-700">
                    ₹{(performance.reduce((sum, p) => sum + (p.total_revenue || 0), 0) / 100000).toFixed(2)} Lakhs
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Employee Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white p-5 border-b flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-[#0a355e]">Add New Employee</h2>
                <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleCreateEmployee} className="p-5 space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-blue-500" />
                    Personal Information
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter full name"
                        data-testid="emp-name-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                      <input
                        type="tel"
                        required
                        value={newEmployee.phone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="10-digit phone"
                        data-testid="emp-phone-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={newEmployee.date_of_birth}
                        onChange={(e) => setNewEmployee({ ...newEmployee, date_of_birth: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        value={newEmployee.gender}
                        onChange={(e) => setNewEmployee({ ...newEmployee, gender: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-green-500" />
                    Address
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={newEmployee.address}
                        onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Full address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={newEmployee.city}
                        onChange={(e) => setNewEmployee({ ...newEmployee, city: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={newEmployee.pincode}
                        onChange={(e) => setNewEmployee({ ...newEmployee, pincode: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Pincode"
                      />
                    </div>
                  </div>
                </div>

                {/* Employment Details */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3 flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-purple-500" />
                    Employment Details
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                      <select
                        value={newEmployee.department}
                        onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        data-testid="emp-department-select"
                      >
                        {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <select
                        value={newEmployee.role}
                        onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                      <input
                        type="text"
                        value={newEmployee.designation}
                        onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Senior Sales Executive"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                      <select
                        value={newEmployee.employment_type}
                        onChange={(e) => setNewEmployee({ ...newEmployee, employment_type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date *</label>
                      <input
                        type="date"
                        required
                        value={newEmployee.joining_date}
                        onChange={(e) => setNewEmployee({ ...newEmployee, joining_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Salary & Compensation */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3 flex items-center">
                    <IndianRupee className="w-5 h-5 mr-2 text-green-500" />
                    Salary & Compensation
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Salary (Monthly)</label>
                      <input
                        type="number"
                        value={newEmployee.base_salary}
                        onChange={(e) => setNewEmployee({ ...newEmployee, base_salary: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="₹ Monthly salary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Allowances</label>
                      <input
                        type="number"
                        value={newEmployee.allowances}
                        onChange={(e) => setNewEmployee({ ...newEmployee, allowances: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="₹ Total allowances"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3 flex items-center">
                    <Phone className="w-5 h-5 mr-2 text-red-500" />
                    Emergency Contact
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={newEmployee.emergency_contact_name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, emergency_contact_name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Emergency contact name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        value={newEmployee.emergency_contact_phone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, emergency_contact_phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                      <input
                        type="text"
                        value={newEmployee.emergency_contact_relation}
                        onChange={(e) => setNewEmployee({ ...newEmployee, emergency_contact_relation: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Father, Spouse"
                      />
                    </div>
                  </div>
                </div>

                {/* Documents & ID */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-orange-500" />
                    Documents & Bank Details
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                      <input
                        type="text"
                        value={newEmployee.pan_number}
                        onChange={(e) => setNewEmployee({ ...newEmployee, pan_number: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
                      <input
                        type="text"
                        value={newEmployee.aadhar_number}
                        onChange={(e) => setNewEmployee({ ...newEmployee, aadhar_number: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="12-digit Aadhar"
                        maxLength={12}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={newEmployee.bank_name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, bank_name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Bank name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={newEmployee.bank_account_number}
                        onChange={(e) => setNewEmployee({ ...newEmployee, bank_account_number: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={newEmployee.bank_ifsc}
                        onChange={(e) => setNewEmployee({ ...newEmployee, bank_ifsc: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="IFSC Code"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 font-semibold"
                    data-testid="submit-employee-btn"
                  >
                    Create Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Employee Details Modal */}
        {showDetailsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-cyan-500 p-5 text-white flex items-center justify-between z-10 rounded-t-2xl">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                    {showDetailsModal.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{showDetailsModal.name}</h2>
                    <p className="opacity-80">{showDetailsModal.employee_id} | {showDetailsModal.designation || showDetailsModal.role}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(null)} className="p-2 hover:bg-white/20 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="font-medium text-gray-700">Status</span>
                  <span className={`px-3 py-1 rounded-full text-white text-sm ${STATUSES.find(s => s.value === showDetailsModal.status)?.color || 'bg-gray-500'}`}>
                    {showDetailsModal.status}
                  </span>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{showDetailsModal.phone || "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{showDetailsModal.email || "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 col-span-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{[showDetailsModal.address, showDetailsModal.city, showDetailsModal.pincode].filter(Boolean).join(", ") || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Employment Details */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3">Employment Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Department:</span>
                      <span className="ml-2 capitalize font-medium">{showDetailsModal.department}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Role:</span>
                      <span className="ml-2 capitalize font-medium">{showDetailsModal.role}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Joining Date:</span>
                      <span className="ml-2 font-medium">{showDetailsModal.joining_date}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Employment Type:</span>
                      <span className="ml-2 capitalize font-medium">{showDetailsModal.employment_type?.replace("_", " ")}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3">Performance</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{showDetailsModal.leads_assigned || 0}</p>
                      <p className="text-xs text-gray-500">Assigned</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{showDetailsModal.leads_converted || 0}</p>
                      <p className="text-xs text-gray-500">Converted</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-600">₹{((showDetailsModal.total_revenue || 0) / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-gray-500">Revenue</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{showDetailsModal.performance_rating || "-"}</p>
                      <p className="text-xs text-gray-500">Rating</p>
                    </div>
                  </div>
                </div>

                {/* Leave Balance */}
                <div>
                  <h3 className="font-semibold text-[#0a355e] mb-3">Leave Balance</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${((showDetailsModal.leaves_remaining || 18) / (showDetailsModal.total_leaves || 18)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {showDetailsModal.leaves_remaining || 18} / {showDetailsModal.total_leaves || 18} days
                    </span>
                  </div>
                </div>

                {/* Emergency Contact */}
                {showDetailsModal.emergency_contact_name && (
                  <div>
                    <h3 className="font-semibold text-[#0a355e] mb-3">Emergency Contact</h3>
                    <div className="p-3 bg-red-50 rounded-lg text-sm">
                      <p><strong>{showDetailsModal.emergency_contact_name}</strong> ({showDetailsModal.emergency_contact_relation})</p>
                      <p className="text-gray-600">{showDetailsModal.emergency_contact_phone}</p>
                    </div>
                  </div>
                )}

                {/* Delete Employee Button */}
                <div className="pt-4 border-t">
                  <button
                    onClick={() => handleDeleteEmployee(showDetailsModal)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition"
                    data-testid="delete-employee-btn"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Delete Employee Permanently</span>
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">This will permanently remove all employee data</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRManagement;
