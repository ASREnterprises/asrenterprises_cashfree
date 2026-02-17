import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Users, LogOut, ClipboardList, Image, Star, Calendar, Newspaper, Shield, TrendingUp, Share2, LayoutDashboard } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminDashboard = ({ onLogout }) => {
  const [stats, setStats] = useState({
    total_leads: 0,
    new_leads: 0,
    total_photos: 0,
    total_reviews: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminUser");
    onLogout();
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
      title: "Leads Management",
      description: "View and manage all customer inquiries",
      icon: <ClipboardList className="w-10 h-10" />,
      link: "/admin/leads",
      color: "from-green-500 to-emerald-600",
      count: `${stats.total_leads || 0} Leads`
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
      title: "Govt News & Schemes",
      description: "AI auto-updates Bihar solar schemes",
      icon: <Newspaper className="w-10 h-10" />,
      link: "/admin/govt-news",
      color: "from-indigo-500 to-purple-600",
      count: "AI Updates"
    },
    {
      title: "Security Center",
      description: "Monitor website security status",
      icon: <Shield className="w-10 h-10" />,
      link: "/admin/security",
      color: "from-red-500 to-pink-600",
      count: "Protected"
    },
    {
      title: "Analytics",
      description: "View business performance reports",
      icon: <TrendingUp className="w-10 h-10" />,
      link: "/admin/analytics",
      color: "from-purple-500 to-pink-500",
      count: "View Stats"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">ASR ENTERPRISES Management Panel</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-600 transition"
            >
              View Website
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-red-700 transition flex items-center space-x-2"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-white">
            <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_leads || 0}</div>
            <div className="text-green-200 text-sm">Total Leads</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
            <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.new_leads || 0}</div>
            <div className="text-blue-200 text-sm">New Leads</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-5 text-white">
            <Image className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_photos || 0}</div>
            <div className="text-yellow-200 text-sm">Work Photos</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white">
            <Star className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_reviews || 0}</div>
            <div className="text-purple-200 text-sm">Reviews</div>
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
        <div className="mt-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="w-10 h-10" />
              <div>
                <h3 className="text-xl font-bold">AI Security Active</h3>
                <p className="text-green-200">Your website is protected with AI-powered security</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">100%</div>
              <div className="text-green-200 text-sm">Secure</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
