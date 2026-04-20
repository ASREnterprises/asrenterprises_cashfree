import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, TrendingUp, Users, Target, AlertTriangle, Trophy,
  DollarSign, PieChart, Clock, Zap, Phone, MessageSquare,
  Calendar, RefreshCw, ChevronRight, Award, Star, Crown,
  BarChart3, Activity, Lightbulb, ArrowUpRight, ArrowDownRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const BusinessDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("digest");
  const [digest, setDigest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [overdue, setOverdue] = useState(null);
  const [insights, setInsights] = useState(null);
  const [commissions, setCommissions] = useState(null);
  const [targetInput, setTargetInput] = useState("");

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [digestRes, leaderRes, revenueRes, analyticsRes, overdueRes, insightsRes, commissionsRes] = await Promise.all([
        axios.get(`${API}/crm/daily-digest`).catch(() => ({ data: null })),
        axios.get(`${API}/crm/leaderboard`).catch(() => ({ data: [] })),
        axios.get(`${API}/crm/revenue-dashboard`).catch(() => ({ data: null })),
        axios.get(`${API}/crm/lead-analytics`).catch(() => ({ data: null })),
        axios.get(`${API}/crm/overdue-leads`).catch(() => ({ data: null })),
        axios.get(`${API}/crm/insights`).catch(() => ({ data: null })),
        axios.get(`${API}/crm/commissions`).catch(() => ({ data: null }))
      ]);
      setDigest(digestRes.data);
      setLeaderboard(leaderRes.data || []);
      setRevenue(revenueRes.data);
      setAnalytics(analyticsRes.data);
      setOverdue(overdueRes.data);
      setInsights(insightsRes.data);
      setCommissions(commissionsRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  };

  const setMonthlyTarget = async () => {
    if (!targetInput) return;
    try {
      await axios.post(`${API}/crm/set-target`, { monthly_revenue_target: parseInt(targetInput) });
      alert("Target updated!");
      fetchAllData();
    } catch (err) {
      alert("Error setting target");
    }
  };

  const openWhatsApp = (url) => window.open(url, '_blank');

  const tabs = [
    { id: "digest", label: "Daily Digest", icon: Calendar },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "analytics", label: "Lead Analytics", icon: PieChart },
    { id: "overdue", label: "Overdue Alerts", icon: AlertTriangle },
    { id: "insights", label: "AI Insights", icon: Lightbulb },
    { id: "commissions", label: "Commissions", icon: Award }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/admin/crm" className="text-white/80 hover:text-white">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">Business Intelligence</h1>
                <p className="text-orange-100">ASR Enterprises - Performance Dashboard</p>
              </div>
            </div>
            <button onClick={fetchAllData} className="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" /><span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 flex items-center space-x-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "bg-orange-600 text-white rounded-t-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
                {tab.id === "overdue" && overdue?.summary?.total_overdue > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{overdue.summary.total_overdue}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Daily Digest */}
        {activeTab === "digest" && digest && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-6 text-white">
              <h2 className="text-2xl font-bold">{digest.greeting}! 👋</h2>
              <p className="text-orange-100">{digest.day}, {digest.date}</p>
              {digest.ai_tip && (
                <div className="mt-4 bg-white/20 rounded-lg p-3">
                  <p className="text-sm">{digest.ai_tip}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">New Leads</span>
                  {digest.summary.leads_change > 0 ? (
                    <span className="text-green-400 flex items-center text-xs"><ArrowUpRight className="w-3 h-3" />+{digest.summary.leads_change}</span>
                  ) : digest.summary.leads_change < 0 ? (
                    <span className="text-red-400 flex items-center text-xs"><ArrowDownRight className="w-3 h-3" />{digest.summary.leads_change}</span>
                  ) : null}
                </div>
                <p className="text-3xl font-bold text-white">{digest.summary.new_leads}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Today's Revenue</span>
                  {digest.summary.revenue_change > 0 && (
                    <span className="text-green-400 flex items-center text-xs"><ArrowUpRight className="w-3 h-3" />+₹{digest.summary.revenue_change.toLocaleString()}</span>
                  )}
                </div>
                <p className="text-3xl font-bold text-green-400">₹{digest.summary.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <span className="text-gray-400 text-sm">Follow-ups Today</span>
                <p className="text-3xl font-bold text-blue-400">{digest.summary.followups_scheduled}</p>
                <p className="text-xs text-gray-500">{digest.summary.followups_completed} completed</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <span className="text-gray-400 text-sm">Overdue Leads</span>
                <p className="text-3xl font-bold text-red-400">{digest.total_overdue}</p>
                <p className="text-xs text-gray-500">Need attention</p>
              </div>
            </div>

            {/* Hot Leads */}
            {digest.hot_leads?.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Zap className="w-5 h-5 text-yellow-400 mr-2" />Hot Leads to Focus</h3>
                <div className="space-y-3">
                  {digest.hot_leads.map((lead, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                      <div>
                        <p className="text-white font-medium">{lead.name}</p>
                        <p className="text-gray-400 text-sm">{lead.district} • ₹{lead.monthly_bill}/mo • Score: {lead.lead_score}</p>
                      </div>
                      <div className="flex space-x-2">
                        <a href={`tel:${lead.phone}`} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Phone className="w-4 h-4" /></a>
                        <button onClick={() => openWhatsApp(`https://wa.me/91${lead.phone}?text=Hello ${lead.name}, this is ASR Enterprises...`)} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700"><MessageSquare className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center"><Trophy className="w-6 h-6 text-yellow-400 mr-2" />Staff Performance Leaderboard</h2>
            
            {/* Top 3 Podium */}
            {leaderboard.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* 2nd Place */}
                <div className="bg-gradient-to-b from-gray-600 to-gray-700 rounded-xl p-4 text-center mt-8">
                  <div className="w-16 h-16 bg-gray-500 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">🥈</div>
                  <p className="text-white font-bold">{leaderboard[1]?.name}</p>
                  <p className="text-gray-300 text-sm">{leaderboard[1]?.conversions} conversions</p>
                  <p className="text-green-400 font-bold">₹{leaderboard[1]?.total_revenue?.toLocaleString()}</p>
                </div>
                {/* 1st Place */}
                <div className="bg-gradient-to-b from-yellow-500 to-orange-600 rounded-xl p-4 text-center">
                  <Crown className="w-8 h-8 text-yellow-300 mx-auto mb-2" />
                  <div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto mb-2 flex items-center justify-center text-3xl">🥇</div>
                  <p className="text-white font-bold text-lg">{leaderboard[0]?.name}</p>
                  <p className="text-yellow-100 text-sm">{leaderboard[0]?.conversions} conversions</p>
                  <p className="text-white font-bold text-xl">₹{leaderboard[0]?.total_revenue?.toLocaleString()}</p>
                  <p className="text-yellow-200 text-xs mt-1">🏆 Top Performer</p>
                </div>
                {/* 3rd Place */}
                <div className="bg-gradient-to-b from-orange-700 to-orange-800 rounded-xl p-4 text-center mt-12">
                  <div className="w-14 h-14 bg-orange-600 rounded-full mx-auto mb-2 flex items-center justify-center text-xl">🥉</div>
                  <p className="text-white font-bold">{leaderboard[2]?.name}</p>
                  <p className="text-orange-200 text-sm">{leaderboard[2]?.conversions} conversions</p>
                  <p className="text-green-400 font-bold">₹{leaderboard[2]?.total_revenue?.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Full Table */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3">Rank</th>
                    <th className="text-left text-gray-300 px-4 py-3">Staff</th>
                    <th className="text-left text-gray-300 px-4 py-3">Leads</th>
                    <th className="text-left text-gray-300 px-4 py-3">Conversions</th>
                    <th className="text-left text-gray-300 px-4 py-3">Revenue</th>
                    <th className="text-left text-gray-300 px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((staff) => (
                    <tr key={staff.staff_id} className="border-t border-gray-700">
                      <td className="px-4 py-3">
                        <span className={`text-xl ${staff.rank <= 3 ? 'text-2xl' : 'text-gray-400'}`}>
                          {staff.rank === 1 ? '🥇' : staff.rank === 2 ? '🥈' : staff.rank === 3 ? '🥉' : `#${staff.rank}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{staff.name}</p>
                        <p className="text-gray-400 text-sm">{staff.staff_id} • {staff.role}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{staff.leads_assigned}</td>
                      <td className="px-4 py-3">
                        <span className="text-green-400 font-bold">{staff.conversions}</span>
                        <span className="text-gray-500 text-sm ml-1">({staff.conversion_rate}%)</span>
                      </td>
                      <td className="px-4 py-3 text-green-400 font-bold">₹{staff.total_revenue?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="bg-orange-600 text-white px-2 py-1 rounded text-sm font-bold">{staff.performance_score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revenue Dashboard */}
        {activeTab === "revenue" && revenue && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 text-white">
                <p className="text-green-100 text-sm">This Month's Revenue</p>
                <p className="text-4xl font-bold">₹{revenue.monthly_revenue?.toLocaleString()}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Target: ₹{revenue.monthly_target?.toLocaleString()}</span>
                    <span>{revenue.target_progress}%</span>
                  </div>
                  <div className="bg-green-800 rounded-full h-2">
                    <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${Math.min(revenue.target_progress, 100)}%` }}></div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-6">
                <p className="text-gray-400 text-sm">Total Revenue (All Time)</p>
                <p className="text-3xl font-bold text-white">₹{revenue.total_revenue?.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6">
                <p className="text-gray-400 text-sm">Pipeline Value</p>
                <p className="text-3xl font-bold text-blue-400">₹{revenue.pipeline_value?.toLocaleString()}</p>
                <p className="text-gray-500 text-xs">Potential revenue from active leads</p>
              </div>
            </div>

            {/* Set Target */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-3 flex items-center"><Target className="w-5 h-5 text-orange-400 mr-2" />Set Monthly Target</h3>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="Enter target amount"
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg flex-1"
                />
                <button onClick={setMonthlyTarget} className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700">Set Target</button>
              </div>
            </div>

            {/* Revenue by Type */}
            {revenue.revenue_by_type && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-bold mb-3">Revenue by Payment Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(revenue.revenue_by_type).map(([type, data]) => (
                    <div key={type} className="bg-gray-700 rounded-lg p-3">
                      <p className="text-gray-400 text-sm capitalize">{type}</p>
                      <p className="text-white font-bold">₹{data.amount?.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{data.count} payments</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lead Analytics */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Total Leads</p>
                <p className="text-3xl font-bold text-white">{analytics.total_leads}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">This Month</p>
                <p className="text-3xl font-bold text-blue-400">{analytics.this_month}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Conversion Rate</p>
                <p className="text-3xl font-bold text-green-400">{analytics.funnel?.conversion_rate}%</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Avg Lead Score</p>
                <p className="text-3xl font-bold text-orange-400">{analytics.avg_lead_score}</p>
              </div>
            </div>

            {/* Funnel */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-4">Conversion Funnel</h3>
              <div className="flex items-center justify-between">
                {[
                  { label: "Total", value: analytics.funnel?.total, color: "bg-gray-600" },
                  { label: "Contacted", value: analytics.funnel?.contacted, color: "bg-blue-600" },
                  { label: "Surveyed", value: analytics.funnel?.surveyed, color: "bg-yellow-600" },
                  { label: "Quoted", value: analytics.funnel?.quoted, color: "bg-orange-600" },
                  { label: "Won", value: analytics.funnel?.won, color: "bg-green-600" }
                ].map((stage, i) => (
                  <div key={i} className="text-center flex-1">
                    <div className={`${stage.color} mx-auto rounded-lg p-3 mb-2`} style={{ width: `${Math.max(40, 100 - i * 15)}%` }}>
                      <p className="text-white font-bold text-xl">{stage.value}</p>
                    </div>
                    <p className="text-gray-400 text-sm">{stage.label}</p>
                    {i < 4 && <ChevronRight className="w-4 h-4 text-gray-600 mx-auto mt-1" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Districts */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-3">Top Districts</h3>
              <div className="space-y-2">
                {analytics.by_district?.map((item, i) => (
                  <div key={i} className="flex items-center">
                    <span className="text-gray-400 w-24">{item.district}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-4 mx-3">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 rounded-full h-4" 
                        style={{ width: `${(item.count / analytics.total_leads * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Overdue Alerts */}
        {activeTab === "overdue" && overdue && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-4">
                <p className="text-red-400 text-sm">Critical (5+ days)</p>
                <p className="text-3xl font-bold text-red-400">{overdue.critical?.length || 0}</p>
              </div>
              <div className="bg-orange-900/50 border border-orange-500 rounded-xl p-4">
                <p className="text-orange-400 text-sm">72+ Hours</p>
                <p className="text-3xl font-bold text-orange-400">{overdue.overdue_72h?.length || 0}</p>
              </div>
              <div className="bg-yellow-900/50 border border-yellow-500 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">48+ Hours</p>
                <p className="text-3xl font-bold text-yellow-400">{overdue.overdue_48h?.length || 0}</p>
              </div>
              <div className="bg-blue-900/50 border border-blue-500 rounded-xl p-4">
                <p className="text-blue-400 text-sm">24+ Hours</p>
                <p className="text-3xl font-bold text-blue-400">{overdue.overdue_24h?.length || 0}</p>
              </div>
            </div>

            {/* Critical Leads */}
            {overdue.critical?.length > 0 && (
              <div className="bg-red-900/30 border border-red-500 rounded-xl p-4">
                <h3 className="text-red-400 font-bold mb-3 flex items-center"><AlertTriangle className="w-5 h-5 mr-2" />Critical - Contact Immediately!</h3>
                <div className="space-y-2">
                  {overdue.critical.map((lead, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                      <div>
                        <p className="text-white font-medium">{lead.name}</p>
                        <p className="text-gray-400 text-sm">{lead.district} • {lead.days_since_update} days overdue</p>
                      </div>
                      <div className="flex space-x-2">
                        <a href={`tel:${lead.phone}`} className="bg-red-600 text-white p-2 rounded-lg"><Phone className="w-4 h-4" /></a>
                        <button onClick={() => openWhatsApp(lead.whatsapp_url)} className="bg-green-600 text-white p-2 rounded-lg"><MessageSquare className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {overdue.summary?.total_overdue === 0 && (
              <div className="bg-green-900/30 border border-green-500 rounded-xl p-6 text-center">
                <p className="text-green-400 text-xl">✅ All leads are up to date!</p>
              </div>
            )}
          </div>
        )}

        {/* AI Insights */}
        {activeTab === "insights" && insights && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Conversion Rate</p>
                <p className="text-3xl font-bold text-green-400">{insights.key_metrics?.conversion_rate}%</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Avg Deal Value</p>
                <p className="text-3xl font-bold text-blue-400">₹{insights.key_metrics?.avg_deal_value?.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Top District</p>
                <p className="text-xl font-bold text-orange-400">{insights.key_metrics?.top_district}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Best Source</p>
                <p className="text-xl font-bold text-purple-400 capitalize">{insights.key_metrics?.top_source}</p>
              </div>
            </div>

            {insights.insights?.map((insight, i) => (
              <div key={i} className={`rounded-xl p-4 border ${
                insight.type === 'warning' ? 'bg-yellow-900/30 border-yellow-500' :
                insight.type === 'success' ? 'bg-green-900/30 border-green-500' :
                'bg-blue-900/30 border-blue-500'
              }`}>
                <h3 className={`font-bold mb-2 ${
                  insight.type === 'warning' ? 'text-yellow-400' :
                  insight.type === 'success' ? 'text-green-400' : 'text-blue-400'
                }`}>{insight.title}</h3>
                <p className="text-gray-300">{insight.message}</p>
                <p className="text-gray-500 text-sm mt-2">💡 Action: {insight.action}</p>
              </div>
            ))}
          </div>
        )}

        {/* Commissions */}
        {activeTab === "commissions" && commissions && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl p-6 text-white">
              <p className="text-green-100">Total Commission Payable</p>
              <p className="text-4xl font-bold">₹{commissions.total_commission_payable?.toLocaleString()}</p>
            </div>

            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left text-gray-300 px-4 py-3">Staff</th>
                    <th className="text-left text-gray-300 px-4 py-3">Role</th>
                    <th className="text-left text-gray-300 px-4 py-3">Revenue</th>
                    <th className="text-left text-gray-300 px-4 py-3">Rate</th>
                    <th className="text-left text-gray-300 px-4 py-3">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.commissions?.map((c, i) => (
                    <tr key={i} className="border-t border-gray-700">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{c.name}</p>
                        <p className="text-gray-400 text-sm">{c.staff_id}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{c.role}</td>
                      <td className="px-4 py-3 text-gray-300">₹{c.revenue_generated?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-blue-400">{c.commission_rate}</td>
                      <td className="px-4 py-3 text-green-400 font-bold">₹{c.commission_earned?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
