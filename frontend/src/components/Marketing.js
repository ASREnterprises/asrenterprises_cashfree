import { useState, useEffect } from "react";
import axios from "axios";
import { TrendingUp, Plus, Loader2, ChevronRight, Mail, MessageSquare, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MarketingPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    target_audience: "",
    message_template: "",
    channel: "email"
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API}/marketing/campaigns`);
      setCampaigns(response.data);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/marketing/campaigns`, formData);
      setFormData({
        name: "",
        target_audience: "",
        message_template: "",
        channel: "email"
      });
      setShowForm(false);
      fetchCampaigns();
    } catch (error) {
      console.error("Error creating campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case "email": return <Mail className="w-5 h-5" />;
      case "sms": return <Smartphone className="w-5 h-5" />;
      case "whatsapp": return <MessageSquare className="w-5 h-5" />;
      default: return <Mail className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Marketing Automation</h1>
              <p className="text-gray-600">Create and optimize campaigns with AI</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center space-x-2"
              data-testid="create-campaign-btn"
            >
              <Plus className="w-5 h-5" />
              <span>New Campaign</span>
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Campaign</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Summer Solar Sale"
                    data-testid="campaign-name-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Channel *</label>
                  <select
                    required
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    data-testid="campaign-channel-select"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Target Audience *</label>
                <input
                  type="text"
                  required
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Residential customers in Patna with high electricity bills"
                  data-testid="campaign-audience-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message Template *</label>
                <textarea
                  required
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Your message here... AI will optimize it for better engagement!"
                  data-testid="campaign-message-input"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                  data-testid="submit-campaign-btn"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating & Optimizing with AI...</span>
                    </span>
                  ) : (
                    "Create Campaign"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Campaigns List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition" data-testid="campaign-card">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${
                  campaign.channel === 'email' ? 'bg-blue-100 text-blue-600' :
                  campaign.channel === 'sms' ? 'bg-green-100 text-green-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {getChannelIcon(campaign.channel)}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                  campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                  campaign.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {campaign.status}
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{campaign.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{campaign.target_audience}</p>

              {campaign.ai_optimized_message && (
                <div className="bg-purple-50 p-3 rounded-lg mb-4">
                  <p className="text-xs font-semibold text-purple-700 mb-1">🤖 AI Optimized Message:</p>
                  <p className="text-sm text-gray-700">{campaign.ai_optimized_message}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="font-bold text-gray-900">{campaign.sent_count}</div>
                  <div className="text-gray-500 text-xs">Sent</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900">{campaign.open_rate.toFixed(1)}%</div>
                  <div className="text-gray-500 text-xs">Open Rate</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900">{campaign.click_rate.toFixed(1)}%</div>
                  <div className="text-gray-500 text-xs">Click Rate</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {campaigns.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <TrendingUp className="w-20 h-20 text-purple-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Campaigns Yet</h3>
            <p className="text-gray-600 mb-6">Create your first AI-optimized marketing campaign</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              Create Campaign
            </button>
          </div>
        )}
      </div>
    </div>
  );
};