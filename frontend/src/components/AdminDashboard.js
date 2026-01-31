import { Link } from "react-router-dom";
import { Users, FileText, LogOut, BarChart3, Calendar, TrendingUp, ClipboardList } from "lucide-react";

export const AdminDashboard = ({ onLogout }) => {
  const handleLogout = () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminUser");
    onLogout();
  };

  const modules = [
    {
      title: "Leads Management",
      description: "View and manage all customer leads",
      icon: <ClipboardList className="w-12 h-12" />,
      link: "/leads",
      color: "from-green-500 to-emerald-600",
      count: "View Leads"
    },
    {
      title: "Staff Management",
      description: "Manage team members and reporting structure",
      icon: <Users className="w-12 h-12" />,
      link: "/admin/staff",
      color: "from-blue-500 to-blue-600",
      count: "Manage Team"
    },
    {
      title: "Solar Quotations",
      description: "Generate quotations for customers",
      icon: <FileText className="w-12 h-12" />,
      link: "/admin/quotations",
      color: "from-yellow-500 to-orange-500",
      count: "Generate Quotes"
    },
    {
      title: "Analytics",
      description: "View business performance and reports",
      icon: <BarChart3 className="w-12 h-12" />,
      link: "/dashboard",
      color: "from-purple-500 to-pink-500",
      count: "View Stats"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-5xl font-extrabold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-xl text-gray-600">ASR ENTERPRISES Management Panel</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              View Website
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition flex items-center space-x-2"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <ClipboardList className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">25+</div>
            <div className="text-sm text-gray-600">Total Leads</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">8</div>
            <div className="text-sm text-gray-600">Team Members</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">45</div>
            <div className="text-sm text-gray-600">Quotations</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">₹45L</div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((module, idx) => (
            <Link
              key={idx}
              to={module.link}
              className="group"
              data-testid={`module-${idx}`}
            >
              <div className={`bg-gradient-to-br ${module.color} rounded-2xl shadow-2xl p-8 text-white hover:shadow-3xl transition-all transform hover:-translate-y-2 h-full`}>
                <div className="mb-6">{module.icon}</div>
                <h2 className="text-2xl font-bold mb-2">{module.title}</h2>
                <p className="text-white text-opacity-90 mb-4">{module.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{module.count}</span>
                  <span className="bg-white bg-opacity-20 p-2 rounded-lg group-hover:bg-opacity-30 transition">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
