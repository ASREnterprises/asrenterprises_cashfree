import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Users, LogOut, ClipboardList, Image, Star, Calendar, Newspaper, Shield, TrendingUp, Share2, LayoutDashboard, ShoppingBag, Loader2, RefreshCw } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminDashboard = ({ onLogout }) => {
  // Widget states - each loads independently
  const [counts, setCounts] = useState(null);
  const [recentLeads, setRecentLeads] = useState(null);
  const [recentOrders, setRecentOrders] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [shopStats, setShopStats] = useState(null);
  
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
    
    // Shop stats (separate)
    axios.get(`${API}/shop/stats`)
      .then(res => setShopStats(res.data))
      .catch(err => console.error("Shop stats error:", err));
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
      title: "Shop Management",
      description: "Products, orders & payments",
      icon: <ShoppingBag className="w-10 h-10" />,
      link: "/admin/shop",
      color: "from-amber-500 to-orange-600",
      count: `${counts?.total_orders || shopStats?.total_orders || 0} Orders`
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
      title: "Festival Posts",
      description: "Create festival wishes & announcements",
      icon: <Calendar className="w-10 h-10" />,
      link: "/admin/festivals",
      color: "from-pink-500 to-rose-600",
      count: "Post Wishes"
    },
    {
      title: "Security Center",
      description: "Monitor website security status",
      icon: <Shield className="w-10 h-10" />,
      link: "/admin/security",
      color: "from-red-500 to-pink-600",
      count: "Protected"
    }
  ];

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
            {detailedLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{stats?.total_leads || 0}</div>
                <div className="text-gray-500 text-sm">Total Leads</div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              {quickStats?.new_leads > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium animate-pulse">
                  {quickStats.new_leads} New!
                </span>
              )}
            </div>
            {quickLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{quickStats?.new_leads || stats?.new_leads || 0}</div>
                <div className="text-gray-500 text-sm">New Leads</div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="w-8 h-8 text-amber-600" />
              {quickStats?.pending_orders > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                  {quickStats.pending_orders} Pending
                </span>
              )}
            </div>
            {detailedLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{shopStats?.total_orders || 0}</div>
                <div className="text-gray-500 text-sm">Total Orders</div>
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
                <RefreshCw className={`w-3 h-3 ${(quickLoading || detailedLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {detailedLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#0a355e]">{stats?.total_reviews || 0}</div>
                <div className="text-gray-500 text-sm">Reviews</div>
              </>
            )}
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module, idx) => (
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
