import { useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Users, Clock, Calendar, MapPin, Award, TrendingUp, 
  CheckCircle, XCircle, AlertCircle, FileText, DollarSign, 
  Camera, Upload, RefreshCw, Star, Target, Zap, UserCheck,
  Navigation, Building, Phone, Mail, Edit, Trash2, Plus,
  Download, Eye, Timer, Gift, Medal, Crown, ChevronRight
} from "lucide-react";
import useAutoLogout from "../hooks/useAutoLogout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== EMPLOYEE SELF-SERVICE PORTAL ====================
const EmployeeSelfService = memo(({ employee, onUpdate }) => {
  const [activeSection, setActiveSection] = useState("profile");
  const [leaveBalance, setLeaveBalance] = useState({ casual: 12, sick: 6, earned: 15 });
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployeeData();
  }, [employee?.id]);

  const fetchEmployeeData = async () => {
    if (!employee?.id) return;
    try {
      const [balanceRes, payslipRes] = await Promise.all([
        axios.get(`${API}/hr/employee/${employee.id}/leave-balance`).catch(() => ({ data: leaveBalance })),
        axios.get(`${API}/hr/employee/${employee.id}/payslips`).catch(() => ({ data: [] }))
      ]);
      setLeaveBalance(balanceRes.data);
      setPayslips(payslipRes.data);
    } catch (err) {
      console.error("Error fetching employee data:", err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* ESS Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {employee?.name?.charAt(0) || "E"}
            </div>
            <div>
              <h2 className="text-xl font-bold">{employee?.name || "Employee"}</h2>
              <p className="text-indigo-200">{employee?.designation || "Staff"}</p>
              <p className="text-indigo-200 text-sm">{employee?.department || "Operations"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">Employee ID</p>
            <p className="font-mono font-bold">{employee?.employee_id || "ASR001"}</p>
          </div>
        </div>
      </div>

      {/* ESS Navigation */}
      <div className="flex border-b overflow-x-auto">
        {[
          { id: "profile", label: "My Profile", icon: <UserCheck className="w-4 h-4" /> },
          { id: "leave", label: "Leave", icon: <Calendar className="w-4 h-4" /> },
          { id: "attendance", label: "Attendance", icon: <Clock className="w-4 h-4" /> },
          { id: "payslips", label: "Payslips", icon: <FileText className="w-4 h-4" /> },
          { id: "expenses", label: "Expenses", icon: <DollarSign className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
              activeSection === tab.id 
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50" 
                : "text-gray-600 hover:text-indigo-600"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ESS Content */}
      <div className="p-6">
        {activeSection === "profile" && (
          <div className="space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center">
              <UserCheck className="w-5 h-5 mr-2 text-indigo-600" />
              Personal Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-semibold text-gray-800">{employee?.name || "N/A"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-semibold text-gray-800">{employee?.email || "N/A"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-semibold text-gray-800">{employee?.phone || "N/A"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Date of Joining</p>
                <p className="font-semibold text-gray-800">{employee?.joining_date || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === "leave" && (
          <div className="space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
              Leave Balance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{leaveBalance.casual}</p>
                <p className="text-sm text-blue-700">Casual Leave</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{leaveBalance.sick}</p>
                <p className="text-sm text-green-700">Sick Leave</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">{leaveBalance.earned}</p>
                <p className="text-sm text-purple-700">Earned Leave</p>
              </div>
            </div>
            
            <button className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Apply for Leave</span>
            </button>
          </div>
        )}

        {activeSection === "payslips" && (
          <div className="space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Salary Payslips
            </h3>
            <div className="space-y-3">
              {payslips.length > 0 ? payslips.map((slip, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="font-semibold text-gray-800">{slip.month}</p>
                    <p className="text-sm text-gray-500">Gross: ₹{slip.gross?.toLocaleString()}</p>
                  </div>
                  <button className="text-indigo-600 hover:text-indigo-800">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-8">No payslips available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== GEO-FENCING ATTENDANCE ====================
const GeoAttendance = memo(({ staffId }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);

  // ASR Enterprises Office Location (Patna)
  const OFFICE_LOCATION = { lat: 25.5941, lng: 85.1376 };
  const GEO_FENCE_RADIUS = 500; // meters

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const markAttendance = async (type) => {
    setLoading(true);
    setStatus(null);
    
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      
      const distance = calculateDistance(loc.lat, loc.lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
      const isWithinGeofence = distance <= GEO_FENCE_RADIUS;
      
      const attendanceData = {
        staff_id: staffId,
        type: type, // "check_in" or "check_out"
        timestamp: new Date().toISOString(),
        location: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy
        },
        distance_from_office: Math.round(distance),
        within_geofence: isWithinGeofence,
        device_info: navigator.userAgent
      };

      const res = await axios.post(`${API}/hr/attendance/mark`, attendanceData);
      
      setStatus({
        success: true,
        message: isWithinGeofence 
          ? `${type === 'check_in' ? 'Check-in' : 'Check-out'} successful!` 
          : `${type === 'check_in' ? 'Check-in' : 'Check-out'} recorded (Outside office: ${Math.round(distance)}m away)`,
        isWithinGeofence,
        distance: Math.round(distance)
      });
      
      setTodayAttendance(res.data);
      
    } catch (err) {
      setStatus({
        success: false,
        message: err.message || "Failed to mark attendance"
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white">
        <h3 className="text-lg font-bold flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          Geo-Fencing Attendance
        </h3>
        <p className="text-green-100 text-sm">Mark attendance from office location</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Display */}
        {status && (
          <div className={`rounded-lg p-4 ${status.success ? (status.isWithinGeofence ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200') : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center space-x-2">
              {status.success ? (
                status.isWithinGeofence ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <p className={`font-medium ${status.success ? (status.isWithinGeofence ? 'text-green-700' : 'text-yellow-700') : 'text-red-700'}`}>
                {status.message}
              </p>
            </div>
            {status.distance && (
              <p className="text-sm text-gray-600 mt-2">
                Distance from office: {status.distance}m (Allowed: {GEO_FENCE_RADIUS}m)
              </p>
            )}
          </div>
        )}

        {/* Location Info */}
        {location && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="text-gray-600">
              <strong>Your Location:</strong> {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
            <p className="text-gray-600">
              <strong>Accuracy:</strong> ±{Math.round(location.accuracy)}m
            </p>
          </div>
        )}

        {/* Today's Attendance */}
        {todayAttendance && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">Today's Record</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Check-in</p>
                <p className="font-semibold text-gray-800">{todayAttendance.check_in || "Not marked"}</p>
              </div>
              <div>
                <p className="text-gray-600">Check-out</p>
                <p className="font-semibold text-gray-800">{todayAttendance.check_out || "Not marked"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => markAttendance("check_in")}
            disabled={loading}
            className="bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
            <span>Check In</span>
          </button>
          <button
            onClick={() => markAttendance("check_out")}
            disabled={loading}
            className="bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
            <span>Check Out</span>
          </button>
        </div>

        {/* Office Location Info */}
        <div className="text-center text-sm text-gray-500">
          <p>📍 Office: Shop 10, Aman SKS Complex, Khagaul, Patna</p>
          <p>Geo-fence radius: {GEO_FENCE_RADIUS}m</p>
        </div>
      </div>
    </div>
  );
});

// ==================== STAFF GAMIFICATION LEADERBOARD ====================
const StaffLeaderboard = memo(({ staffList }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeframe, setTimeframe] = useState("month");

  useEffect(() => {
    // Calculate scores based on staff activities
    const scored = (staffList || []).map(staff => ({
      ...staff,
      score: calculateStaffScore(staff),
      badges: getStaffBadges(staff)
    })).sort((a, b) => b.score - a.score);
    
    setLeaderboard(scored);
  }, [staffList, timeframe]);

  const calculateStaffScore = (staff) => {
    let score = 0;
    // Points for different activities
    score += (staff.leads_closed || 0) * 50;      // 50 points per closed lead
    score += (staff.surveys_completed || 0) * 20; // 20 points per survey
    score += (staff.photos_uploaded || 0) * 10;   // 10 points per photo
    score += (staff.reviews_received || 0) * 30;  // 30 points per 5-star review
    score += (staff.fast_responses || 0) * 15;    // 15 points for responding within 2 hours
    return score;
  };

  const getStaffBadges = (staff) => {
    const badges = [];
    if ((staff.leads_closed || 0) >= 10) badges.push({ icon: "🏆", label: "Top Closer" });
    if ((staff.fast_responses || 0) >= 20) badges.push({ icon: "⚡", label: "Speed Demon" });
    if ((staff.reviews_received || 0) >= 5) badges.push({ icon: "⭐", label: "Customer Favorite" });
    if ((staff.photos_uploaded || 0) >= 50) badges.push({ icon: "📸", label: "Photo Pro" });
    return badges;
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center font-bold text-gray-500">#{rank}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center">
              <Award className="w-5 h-5 mr-2" />
              Staff Leaderboard
            </h3>
            <p className="text-amber-100 text-sm">Compete, achieve, and earn rewards!</p>
          </div>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1 text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Points Guide */}
      <div className="bg-amber-50 p-4 border-b">
        <p className="text-sm font-medium text-amber-800 mb-2">How to Earn Points:</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-amber-700">
          <span>🎯 Close Lead: 50pts</span>
          <span>📋 Survey: 20pts</span>
          <span>📸 Photo: 10pts</span>
          <span>⭐ 5-Star Review: 30pts</span>
          <span>⚡ Fast Response: 15pts</span>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="divide-y">
        {leaderboard.slice(0, 10).map((staff, idx) => (
          <div 
            key={staff.id} 
            className={`p-4 flex items-center justify-between ${idx < 3 ? 'bg-gradient-to-r from-amber-50 to-transparent' : ''}`}
          >
            <div className="flex items-center space-x-4">
              {getRankIcon(idx + 1)}
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                {staff.name?.charAt(0) || "S"}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{staff.name}</p>
                <div className="flex space-x-1">
                  {staff.badges?.map((badge, i) => (
                    <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded" title={badge.label}>
                      {badge.icon}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-600">{staff.score}</p>
              <p className="text-xs text-gray-500">points</p>
            </div>
          </div>
        ))}
        
        {leaderboard.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No staff data available</p>
          </div>
        )}
      </div>

      {/* Rewards Section */}
      <div className="bg-gray-50 p-4 border-t">
        <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
          <Gift className="w-4 h-4 mr-2 text-pink-500" />
          Monthly Rewards
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-yellow-100 rounded-lg p-2">
            <Crown className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-yellow-800 font-medium">1st: ₹5,000</p>
          </div>
          <div className="bg-gray-100 rounded-lg p-2">
            <Medal className="w-5 h-5 mx-auto text-gray-500 mb-1" />
            <p className="text-gray-700 font-medium">2nd: ₹3,000</p>
          </div>
          <div className="bg-amber-100 rounded-lg p-2">
            <Medal className="w-5 h-5 mx-auto text-amber-600 mb-1" />
            <p className="text-amber-800 font-medium">3rd: ₹2,000</p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ==================== AI TASK ASSIGNMENT ====================
const AITaskAssignment = memo(({ leads, staff }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);

  const runAIAssignment = async () => {
    setLoading(true);
    try {
      // AI-powered task assignment based on workload and location
      const res = await axios.post(`${API}/hr/ai/assign-tasks`, {
        leads: leads?.filter(l => l.stage === 'new'),
        staff: staff
      });
      setAssignments(res.data.assignments || []);
    } catch (err) {
      // Fallback: Simple round-robin assignment
      const newLeads = leads?.filter(l => l.stage === 'new') || [];
      const activeStaff = staff?.filter(s => s.status === 'active') || [];
      
      if (activeStaff.length > 0) {
        const assigned = newLeads.map((lead, idx) => ({
          lead_id: lead.id,
          lead_name: lead.name,
          lead_district: lead.district,
          staff_id: activeStaff[idx % activeStaff.length].id,
          staff_name: activeStaff[idx % activeStaff.length].name,
          reason: "Round-robin assignment",
          priority: lead.ai_priority || "medium"
        }));
        setAssignments(assigned);
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              AI Task Assignment
            </h3>
            <p className="text-blue-100 text-sm">Auto-assign leads based on workload & location</p>
          </div>
          <button
            onClick={runAIAssignment}
            disabled={loading}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center space-x-2 transition"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>Run AI Assignment</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {assignments.length > 0 ? (
          <div className="space-y-3">
            {assignments.map((a, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{a.lead_name}</p>
                  <p className="text-sm text-gray-500">{a.lead_district} • {a.priority} priority</p>
                </div>
                <div className="flex items-center space-x-2">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{a.staff_name}</p>
                    <p className="text-xs text-gray-500">{a.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Click "Run AI Assignment" to auto-assign leads</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== MAIN HR DASHBOARD ====================
export const HRDashboard = () => {
  useAutoLogout();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, attRes, leadsRes] = await Promise.all([
        axios.get(`${API}/hr/employees`).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/attendance/today`).catch(() => ({ data: [] })),
        axios.get(`${API}/crm/leads`).catch(() => ({ data: [] }))
      ]);
      setEmployees(empRes.data || []);
      setAttendance(attRes.data || []);
      setLeads(leadsRes.data || []);
    } catch (err) {
      console.error("Error fetching HR data:", err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/admin/dashboard" className="text-gray-600 hover:text-blue-600">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">HR Management</h1>
                <p className="text-gray-500 text-sm">Employee Self-Service & Operations</p>
              </div>
            </div>
            <button 
              onClick={fetchData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {[
              { id: "overview", label: "Overview", icon: <TrendingUp className="w-4 h-4" /> },
              { id: "self-service", label: "Self-Service", icon: <UserCheck className="w-4 h-4" /> },
              { id: "attendance", label: "Geo-Attendance", icon: <MapPin className="w-4 h-4" /> },
              { id: "leaderboard", label: "Leaderboard", icon: <Award className="w-4 h-4" /> },
              { id: "ai-tasks", label: "AI Tasks", icon: <Zap className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-lg border">
                <Users className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-3xl font-bold text-gray-800">{employees.length}</p>
                <p className="text-gray-500 text-sm">Total Employees</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg border">
                <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
                <p className="text-3xl font-bold text-gray-800">{attendance.filter(a => a.check_in).length}</p>
                <p className="text-gray-500 text-sm">Present Today</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg border">
                <Target className="w-8 h-8 text-amber-600 mb-2" />
                <p className="text-3xl font-bold text-gray-800">{leads.filter(l => l.stage === 'new').length}</p>
                <p className="text-gray-500 text-sm">Unassigned Leads</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg border">
                <Award className="w-8 h-8 text-purple-600 mb-2" />
                <p className="text-3xl font-bold text-gray-800">{leads.filter(l => l.stage === 'completed').length}</p>
                <p className="text-gray-500 text-sm">Completed This Month</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <StaffLeaderboard staffList={employees} />
              <AITaskAssignment leads={leads} staff={employees} />
            </div>
          </div>
        )}

        {activeTab === "self-service" && (
          <EmployeeSelfService 
            employee={currentEmployee || employees[0]} 
            onUpdate={fetchData}
          />
        )}

        {activeTab === "attendance" && (
          <div className="grid md:grid-cols-2 gap-6">
            <GeoAttendance staffId={currentEmployee?.id || "STF001"} />
            
            {/* Today's Attendance List */}
            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <h3 className="text-lg font-bold">Today's Attendance</h3>
                <p className="text-purple-100 text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {attendance.length > 0 ? attendance.map((a, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${a.within_geofence ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="font-semibold text-gray-800">{a.staff_name}</p>
                        <p className="text-xs text-gray-500">{a.within_geofence ? 'In Office' : 'Remote'}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-green-600">{a.check_in || '-'}</p>
                      <p className="text-red-600">{a.check_out || '-'}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No attendance records for today</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <StaffLeaderboard staffList={employees} />
        )}

        {activeTab === "ai-tasks" && (
          <AITaskAssignment leads={leads} staff={employees} />
        )}
      </div>
    </div>
  );
};

export default HRDashboard;
