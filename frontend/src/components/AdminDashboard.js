import { Link } from "react-router-dom";
import { Users, FileText, LogOut, BarChart3, Settings, Calendar } from "lucide-react";

export const AdminDashboard = ({ onLogout }) => {
  const handleLogout = () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminUser");
    onLogout();
  };

  const modules = [
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
      description: "Create quotes with TATA, Adani, Loom, Luminous, Waaree",
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
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition flex items-center space-x-2"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
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
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">12</div>
            <div className="text-sm text-gray-600">This Month</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">₹45L</div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {modules.map((module, idx) => (
            <Link
              key={idx}
              to={module.link}
              className="group"
              data-testid={`module-${idx}`}
            >
              <div className={`bg-gradient-to-br ${module.color} rounded-2xl shadow-2xl p-8 text-white hover:shadow-3xl transition-all transform hover:-translate-y-2`}>
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

        {/* Brand Information */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Solar Brands We Offer</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {["TATA Power Solar", "Adani Solar", "Loom Solar", "Luminous Solar", "Waaree Solar"].map((brand) => (
              <div key={brand} className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 text-center">
                <div className="font-bold text-gray-900 text-sm">{brand}</div>
                <div className="text-xs text-gray-600 mt-1">Premium Quality</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
