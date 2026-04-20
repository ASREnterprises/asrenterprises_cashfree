import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart3, Plus, Loader2, ChevronRight, TrendingUp, DollarSign, MousePointerClick, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdsPage = () => {
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/ads/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const addMockData = async () => {
    setLoading(true);
    try {
      // Create mock ad data
      const mockData = {
        platform: Math.random() > 0.5 ? "google" : "facebook",
        campaign_name: `Solar Campaign ${Math.floor(Math.random() * 100)}`,
        impressions: Math.floor(Math.random() * 50000) + 10000,
        clicks: Math.floor(Math.random() * 2000) + 500,
        conversions: Math.floor(Math.random() * 50) + 10,
        cost: Math.floor(Math.random() * 20000) + 5000,
        ctr: 0,
        cpc: 0,
        conversion_rate: 0
      };

      mockData.ctr = (mockData.clicks / mockData.impressions * 100);
      mockData.cpc = mockData.cost / mockData.clicks;
      mockData.conversion_rate = (mockData.conversions / mockData.clicks * 100);

      await axios.post(`${API}/ads/analytics`, mockData);
      fetchAnalytics();
      setShowForm(false);
    } catch (error) {
      console.error("Error adding analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalStats = analytics.reduce((acc, item) => ({
    impressions: acc.impressions + item.impressions,
    clicks: acc.clicks + item.clicks,
    conversions: acc.conversions + item.conversions,
    cost: acc.cost + item.cost
  }), { impressions: 0, clicks: 0, conversions: 0, cost: 0 });

  const avgCTR = totalStats.impressions > 0 ? (totalStats.clicks / totalStats.impressions * 100) : 0;
  const avgCPC = totalStats.clicks > 0 ? (totalStats.cost / totalStats.clicks) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Ads Optimization</h1>
              <p className="text-gray-600">Google & Facebook ads analytics with AI insights</p>
            </div>
            <button
              onClick={addMockData}
              disabled={loading}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center space-x-2 disabled:opacity-50"
              data-testid="add-mock-data-btn"
            >
              <Plus className="w-5 h-5" />
              <span>Add Mock Data</span>
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {analytics.length > 0 && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <Eye className="w-8 h-8 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{totalStats.impressions.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Impressions</div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <MousePointerClick className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{totalStats.clicks.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Clicks</div>
              <div className="text-xs text-green-600 font-semibold mt-1">CTR: {avgCTR.toFixed(2)}%</div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{totalStats.conversions}</div>
              <div className="text-sm text-gray-600">Total Conversions</div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">₹{totalStats.cost.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Spend</div>
              <div className="text-xs text-red-600 font-semibold mt-1">CPC: ₹{avgCPC.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Analytics Cards */}
        <div className="space-y-6">
          {analytics.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-lg p-8" data-testid="analytics-card">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      item.platform === 'google' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {item.platform === 'google' ? 'Google Ads' : 'Facebook Ads'}
                    </span>
                    <h3 className="text-2xl font-bold text-gray-900">{item.campaign_name}</h3>
                  </div>
                  <p className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-5 gap-6 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{item.impressions.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Impressions</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{item.clicks.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Clicks</div>
                  <div className="text-xs text-green-600 font-semibold mt-1">{item.ctr.toFixed(2)}% CTR</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{item.conversions}</div>
                  <div className="text-sm text-gray-600 mt-1">Conversions</div>
                  <div className="text-xs text-purple-600 font-semibold mt-1">{item.conversion_rate.toFixed(2)}%</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">₹{item.cost.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Cost</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">₹{item.cpc.toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">CPC</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span>AI Insights</span>
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.ai_insights}</p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span>AI Recommendations</span>
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.ai_recommendations}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {analytics.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <BarChart3 className="w-20 h-20 text-red-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Analytics Data Yet</h3>
            <p className="text-gray-600 mb-6">Add mock data to see AI-powered insights and recommendations</p>
            <button
              onClick={addMockData}
              disabled={loading}
              className="bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </span>
              ) : (
                "Generate Mock Data"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};