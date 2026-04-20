import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Users, LogOut, ClipboardList, Star, Calendar, Newspaper, Shield, TrendingUp, Share2, LayoutDashboard, Loader2, RefreshCw, UserCog, ShoppingCart, Sun, MessageCircle } from "lucide-react";
import axios from "axios";
import { useAutoLogout } from "@/hooks/useAutoLogout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminDashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  
  // Auto-logout after 15 minutes of inactivity
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  useAutoLogout(isAuthenticated, onLogout, 'admin');
  
  // Widget states - each loads independently
  const [counts, setCounts] = useState(null);
  const [recentLeads, setRecentLeads] = useState(null);
  const [recentOrders, setRecentOrders] = useState(null);
  const [revenue, setRevenue] = useState(null);
  
  // Loading states for each widget
  const [countsLoading, setCountsLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // Load widgets in priority order (fast to slow)
  const fetchWidgets = useCallback(async () => {
    // Priority 1: Basic counts (fastest)
    axios.get(`${API}/dashboard/widget/counts`)
      .then(res => { setCounts(res.data); setCountsLoading(false); })
      .catch(err => { console.error("Counts error:", err); setCountsLoading(false); });
    
    // Priority 2: Recent leads
    axios.get(`${API}/dashboard/widget/recent-leads`)
      .then(res => { setRecentLeads(res.data.recent_leads); setLeadsLoading(false); })
      .catch(err => { console.error("Leads error:", err); setLeadsLoading(false); });
    
    // Priority 3: Recent orders
    axios.get(`${API}/dashboard/widget/recent-orders`)
      .then(res => { setRecentOrders(res.data.recent_orders); setOrdersLoading(false); })
      .catch(err => { console.error("Orders error:", err); setOrdersLoading(false); });
    
    // Priority 4: Revenue (heavier query)
    axios.get(`${API}/dashboard/widget/revenue`)
      .then(res => { setRevenue(res.data); setRevenueLoading(false); })
      .catch(err => { console.error("Revenue error:", err); setRevenueLoading(false); });
  }, []);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  const handleLogout = () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminUser");
    onLogout();
  };

  const refreshAll = () => {
    setCountsLoading(true);
    setLeadsLoading(true);
    setOrdersLoading(true);
    setRevenueLoading(true);
    fetchWidgets();
  };

  const modules = [
    {
      title: "CRM System",
      description: "Complete lead & sales management",
      icon: <LayoutDashboard className="w-10 h-10" />,
      link: "/admin/crm",
      color: "from-indigo-500 to-purple-600",
      count: "Full CRM"
    },
    {
      title: "WhatsApp API",
      description: "WhatsApp messaging & templates",
      icon: <MessageCircle className="w-10 h-10" />,
      link: "/admin/whatsapp-crm",
      color: "from-green-600 to-emerald-700",
      count: "Messaging"
    },
    {
      title: "Leads Management",
      description: "View and manage all customer inquiries",
      icon: <ClipboardList className="w-10 h-10" />,
      link: "/admin/leads",
      color: "from-green-500 to-emerald-600",
      count: `${counts?.total_leads || 0} Leads`
    },
    {
      title: "HR Management",
      description: "Employees, attendance & payroll",
      icon: <UserCog className="w-10 h-10" />,
      link: "/admin/hr",
      color: "from-orange-500 to-red-500",
      count: "Staff Portal"
    },
    {
      title: "Shop Management",
      description: "Products, orders & payments",
      icon: <ShoppingCart className="w-10 h-10" />,
      link: "/admin/shop",
      color: "from-teal-500 to-cyan-600",
      count: "Shop"
    },
    {
      title: "Customer Portal",
      description: "Manage customers & their solar data",
      icon: <Sun className="w-10 h-10" />,
      link: "/admin/customers",
      color: "from-amber-500 to-yellow-500",
      count: "Customers"
    },
    {
      title: "Solar Advisor",
      description: "Manage advisors, leads & commission payouts",
      icon: <Users className="w-10 h-10" />,
      link: "/admin/solar-advisors",
      color: "from-purple-600 to-pink-600",
      count: "Network"
    },
    {
      title: "Social Media",
      description: "Post to Facebook & Instagram",
      icon: <Share2 className="w-10 h-10" />,
      link: "/admin/social-media",
      color: "from-blue-500 to-indigo-600",
      count: "FB & IG"
    },
    {
      title: "Testimonials",
      description: "Generate & manage customer reviews",
      icon: <Star className="w-10 h-10" />,
      link: "/admin/testimonials",
      color: "from-yellow-500 to-amber-600",
      count: "Reviews"
    },
    {
      title: "Festival Posts",
      description: "Create festival wishes & announcements",
      icon: <Calendar className="w-10 h-10" />,
      link: "/admin/festivals",
      color: "from-pink-500 to-rose-600",
      count: "Post Wishes"
    },
    {
      title: "Security Centre",
      description: "Monitor website security & performance",
      icon: <Shield className="w-10 h-10" />,
      link: "/admin/security",
      color: "from-red-600 to-rose-700",
      count: "Protected"
    }
  ];

  // Role-based access control
  // Admin/Manager (department=admin, role=manager) gets restricted access
  const userRole = (localStorage.getItem("asrAdminRole") || "").toLowerCase();
  const [userDept, setUserDept] = useState((localStorage.getItem("asrAdminDepartment") || "").toLowerCase());
  const staffId = localStorage.getItem("asrAdminStaffId") || "";

  // Fallback: if we know it's a manager but department is empty (older session),
  // look it up from HR so role-based filter still applies without re-login.
  useEffect(() => {
    const fetchDept = async () => {
      if (userRole === "manager" && !userDept && staffId) {
        try {
          const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
          const res = await axios.get(`${BACKEND}/api/hr/employees`);
          const list = Array.isArray(res.data) ? res.data : (res.data.employees || []);
          const me = list.find((e) => e.employee_id === staffId);
          if (me?.department) {
            const d = String(me.department).toLowerCase();
            localStorage.setItem("asrAdminDepartment", d);
            setUserDept(d);
          }
        } catch (e) { /* non-blocking */ }
      }
    };
    fetchDept();
  }, [userRole, userDept, staffId]);

  const isAdminManager = userRole === "manager" && userDept === "admin";

  const ALLOWED_FOR_MANAGER = [
    "Leads Management",
    "Customer Portal",
    "Social Media",
    "Testimonials",
    "Festival Posts",
    "WhatsApp API",
    "Solar Advisor"
  ];

  const visibleModules = isAdminManager
    ? modules.filter(m => ALLOWED_FOR_MANAGER.includes(m.title))
    : modules;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/asr_logo_transparent.png" alt="ASR" className="h-14 w-14 object-contain" />
            <div>
              <h1 className="text-3xl font-extrabold text-[#0a355e] mb-1">Admin Dashboard</h1>
              <p className="text-gray-500">ASR ENTERPRISES Management Panel</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/"
              className="bg-white text-[#0a355e] px-5 py-2.5 rounded-lg font-semibold hover:bg-sky-50 transition border border-sky-200 shadow-sm"
            >
              View Website
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-red-600 transition flex items-center space-x-2 shadow-md"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Quick Stats - Loads immediately with skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <ClipboardList className="w-8 h-8 text-green-600" />
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Total</span>
            </div>
            {countsLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{counts?.total_leads || 0}</div>
                <div className="text-gray-500 text-sm">Total Leads</div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              {counts?.new_leads > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium animate-pulse">
                  {counts.new_leads} New!
                </span>
              )}
            </div>
            {countsLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{counts?.new_leads || 0}</div>
                <div className="text-gray-500 text-sm">New Leads</div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <UserCog className="w-8 h-8 text-amber-600" />
            </div>
            {countsLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{counts?.total_bookings || 0}</div>
                <div className="text-gray-500 text-sm">Service Bookings</div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-8 h-8 text-purple-600" />
              <button 
                onClick={refreshAll}
                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium hover:bg-purple-200 transition flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${countsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {revenueLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">₹{((revenue?.this_month_revenue || 0) / 1000).toFixed(0)}K</div>
                <div className="text-gray-500 text-sm">This Month</div>
              </>
            )}
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleModules.map((module, idx) => (
            <Link
              key={idx}
              to={module.link}
              className="group"
              data-testid={`module-${idx}`}
            >
              <div className={`bg-gradient-to-br ${module.color} rounded-xl p-6 text-white hover:shadow-2xl transition-all transform hover:-translate-y-1 h-full`}>
                <div className="mb-4 opacity-90">{module.icon}</div>
                <h2 className="text-xl font-bold mb-1">{module.title}</h2>
                <p className="text-white text-opacity-80 text-sm mb-3">{module.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium bg-white bg-opacity-20 px-3 py-1 rounded-full">{module.count}</span>
                  <span className="bg-white bg-opacity-20 p-2 rounded-lg group-hover:bg-opacity-30 transition">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* AI Status */}
        <div className="mt-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-full">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">AI Security Active</h3>
                <p className="text-green-100">Your website is protected with AI-powered security</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">100%</div>
              <div className="text-green-100 text-sm">Secure</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
