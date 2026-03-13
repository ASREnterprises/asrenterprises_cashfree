import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  BarChart3, TrendingUp, Users, ClipboardList, MapPin, 
  Calendar, ArrowLeft, Loader2, RefreshCw, Star, Image, 
  MessageSquare
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get(`${API}/admin/analytics`);
      setAnalytics(res.data);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const stats = analytics || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin/dashboard"
              className="bg-gray-50 border border-gray-300 p-2 rounded-lg hover:bg-gray-600 transition"
            >
              <ArrowLeft className="w-5 h-5 text-[#0a355e]" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-[#0a355e] mb-1">Business Analytics</h1>
              <p className="text-gray-500">Track your business performance and growth</p>
            </div>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={refreshing}
            className="bg-purple-600 text-[#0a355e] px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center space-x-2 disabled:opacity-50"
            data-testid="refresh-analytics-btn"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-[#0a355e]">
            <ClipboardList className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_leads || 0}</div>
            <div className="text-green-200 text-sm">Total Leads</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-[#0a355e]">
            <Users className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.new_leads || 0}</div>
            <div className="text-blue-200 text-sm">New Leads</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-5 text-[#0a355e]">
            <Image className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_photos || 0}</div>
            <div className="text-yellow-200 text-sm">Work Photos</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-[#0a355e]">
            <Star className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_reviews || 0}</div>
            <div className="text-purple-200 text-sm">Reviews</div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-5 border border-sky-200">
            <MessageSquare className="w-6 h-6 text-green-400 mb-2" />
            <div className="text-2xl font-bold text-[#0a355e]">{stats.total_chats || 0}</div>
            <div className="text-gray-500 text-sm">Chat Sessions</div>
          </div>
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-5 border border-sky-200">
            <Calendar className="w-6 h-6 text-amber-400 mb-2" />
            <div className="text-2xl font-bold text-[#0a355e]">{stats.total_bookings || 0}</div>
            <div className="text-gray-500 text-sm">Service Bookings</div>
          </div>
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-5 border border-sky-200">
            <TrendingUp className="w-6 h-6 text-yellow-400 mb-2" />
            <div className="text-2xl font-bold text-[#0a355e]">{stats.high_score_leads || 0}</div>
            <div className="text-gray-500 text-sm">High Score Leads</div>
          </div>
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-5 border border-sky-200">
            <BarChart3 className="w-6 h-6 text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-[#0a355e]">{stats.total_campaigns || 0}</div>
            <div className="text-gray-500 text-sm">Marketing Campaigns</div>
          </div>
        </div>

        {/* Leads by District */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 border border-sky-200">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-green-400" />
              Leads by District
            </h2>
            {stats.leads_by_district && stats.leads_by_district.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {stats.leads_by_district.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-gray-600">{item._id || 'Unknown'}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 bg-gray-50 border border-gray-300 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${Math.min(100, (item.count / (stats.total_leads || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[#0a355e] font-semibold w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No district data available</p>
            )}
          </div>

          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 border border-sky-200">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
              Leads by Status
            </h2>
            {stats.leads_by_status && stats.leads_by_status.length > 0 ? (
              <div className="space-y-3">
                {stats.leads_by_status.map((item, idx) => {
                  const statusColors = {
                    new: 'bg-blue-500',
                    contacted: 'bg-yellow-500',
                    qualified: 'bg-green-500',
                    converted: 'bg-purple-500',
                    lost: 'bg-red-500'
                  };
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-600 capitalize">{item._id || 'Unknown'}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-gray-50 border border-gray-300 rounded-full h-2">
                          <div 
                            className={`${statusColors[item._id] || 'bg-gray-500'} h-2 rounded-full`} 
                            style={{ width: `${Math.min(100, (item.count / (stats.total_leads || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[#0a355e] font-semibold w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No status data available</p>
            )}
          </div>
        </div>

        {/* Leads by Property Type & Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 border border-sky-200">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-yellow-400" />
              Leads by Property Type
            </h2>
            {stats.leads_by_property_type && stats.leads_by_property_type.length > 0 ? (
              <div className="space-y-3">
                {stats.leads_by_property_type.map((item, idx) => {
                  const typeColors = {
                    residential: 'bg-blue-500',
                    commercial: 'bg-green-500',
                    industrial: 'bg-orange-500',
                    agricultural: 'bg-yellow-500'
                  };
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-600 capitalize">{item._id || 'Unknown'}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-gray-50 border border-gray-300 rounded-full h-2">
                          <div 
                            className={`${typeColors[item._id] || 'bg-gray-500'} h-2 rounded-full`} 
                            style={{ width: `${Math.min(100, (item.count / (stats.total_leads || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[#0a355e] font-semibold w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No property type data available</p>
            )}
          </div>

          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 border border-sky-200">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-purple-400" />
              Leads This Month
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{stats.leads_this_month || 0}</div>
                <div className="text-gray-500 text-sm">This Month</div>
              </div>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.leads_last_month || 0}</div>
                <div className="text-gray-500 text-sm">Last Month</div>
              </div>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">{stats.leads_this_week || 0}</div>
                <div className="text-gray-500 text-sm">This Week</div>
              </div>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats.avg_lead_score || 0}</div>
                <div className="text-gray-500 text-sm">Avg Lead Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 border border-sky-200">
          <h2 className="text-xl font-bold text-[#0a355e] mb-4 flex items-center">
            <ClipboardList className="w-5 h-5 mr-2 text-green-400" />
            Recent Leads
          </h2>
          {stats.recent_leads && stats.recent_leads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-500 text-sm border-b border-sky-200">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">District</th>
                    <th className="text-left py-3 px-4">Property</th>
                    <th className="text-left py-3 px-4">Score</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_leads.map((lead, idx) => (
                    <tr key={idx} className="border-b border-sky-200 hover:bg-gray-750">
                      <td className="py-3 px-4 text-[#0a355e]">{lead.name}</td>
                      <td className="py-3 px-4 text-gray-600">{lead.district || lead.location || '-'}</td>
                      <td className="py-3 px-4 text-gray-600 capitalize">{lead.property_type || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          (lead.lead_score || 0) >= 80 ? 'bg-green-600 text-[#0a355e]' :
                          (lead.lead_score || 0) >= 60 ? 'bg-yellow-600 text-[#0a355e]' :
                          'bg-gray-600 text-[#0a355e]'
                        }`}>
                          {lead.lead_score || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                          lead.status === 'new' ? 'bg-blue-600 text-[#0a355e]' :
                          lead.status === 'contacted' ? 'bg-yellow-600 text-[#0a355e]' :
                          lead.status === 'converted' ? 'bg-green-600 text-[#0a355e]' :
                          'bg-gray-600 text-[#0a355e]'
                        }`}>
                          {lead.status || 'new'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent leads available</p>
          )}
        </div>
      </div>
    </div>
  );
};
