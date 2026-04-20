import { useState, useEffect } from "react";
import axios from "axios";
import { Users, MessageSquare, Calendar, TrendingUp, ChevronRight, Award, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200&q=80')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundBlendMode: "overlay"
    }}>
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 bg-white px-4 py-2 rounded-lg shadow">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 bg-white inline-block px-6 py-3 rounded-lg shadow-lg">Dashboard</h1>
          <p className="text-gray-600 bg-white inline-block px-4 py-2 rounded-lg shadow mt-2">Overview of all your AI-powered features</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6" data-testid="total-leads-stat">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats?.total_leads || 0}</div>
            <div className="text-sm text-gray-600">Total Leads</div>
            <div className="text-xs text-green-600 font-semibold mt-2">
              {stats?.high_score_leads || 0} high-quality leads
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6" data-testid="total-chats-stat">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats?.total_chats || 0}</div>
            <div className="text-sm text-gray-600">WhatsApp Chats</div>
            <div className="text-xs text-blue-600 font-semibold mt-2">
              AI-powered conversations
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6" data-testid="total-calculations-stat">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats?.total_bookings || 0}</div>
            <div className="text-sm text-gray-600">Service Bookings</div>
            <div className="text-xs text-amber-600 font-semibold mt-2">
              Solar service requests
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6" data-testid="total-campaigns-stat">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats?.total_campaigns || 0}</div>
            <div className="text-sm text-gray-600">Active Campaigns</div>
            <div className="text-xs text-orange-600 font-semibold mt-2">
              AI-optimized messaging
            </div>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Leads</h2>
            <Link to="/leads" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center space-x-1">
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {stats?.recent_leads && stats.recent_leads.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_leads.map((lead) => (
                <div key={lead.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition" data-testid="recent-lead-item">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-bold text-gray-900">{lead.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        lead.lead_score >= 80 ? 'bg-green-100 text-green-700' :
                        lead.lead_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        Score: {lead.lead_score}/100
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Email:</strong> {lead.email}</p>
                      <p><strong>Phone:</strong> {lead.phone}</p>
                      <p><strong>Location:</strong> {lead.location}</p>
                      <p><strong>Interest:</strong> {lead.interest}</p>
                      {lead.recommended_system && (
                        <p className="text-blue-600"><strong>Recommended:</strong> {lead.recommended_system}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(lead.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No leads yet. Start capturing leads!</p>
              <Link to="/leads" className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
                Go to Lead Capture
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Link to="/leads" className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1">
            <Users className="w-8 h-8 mb-3" />
            <h3 className="font-bold mb-1">Capture Leads</h3>
            <p className="text-sm text-blue-100">AI-powered lead forms</p>
          </Link>

          <a href="https://wa.me/918298389097" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1">
            <Calendar className="w-8 h-8 mb-3" />
            <h3 className="font-bold mb-1">Book Service</h3>
            <p className="text-sm text-amber-100">Schedule solar consultation</p>
          </a>

          <Link to="/marketing" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1">
            <TrendingUp className="w-8 h-8 mb-3" />
            <h3 className="font-bold mb-1">Marketing</h3>
            <p className="text-sm text-purple-100">AI campaign automation</p>
          </Link>

          <Link to="/chat" className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1">
            <MessageSquare className="w-8 h-8 mb-3" />
            <h3 className="font-bold mb-1">WhatsApp Bot</h3>
            <p className="text-sm text-green-100">24/7 AI support</p>
          </Link>
        </div>
      </div>
    </div>
  );
};
