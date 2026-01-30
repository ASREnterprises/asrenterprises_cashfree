import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Zap, TrendingUp, Globe, Send, Calendar, BarChart3, 
  CheckCircle, Loader2, Instagram, Facebook, Linkedin,
  Mail, MessageSquare, Search, Target, ChevronRight, Play, Pause
} from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AIMarketingHub = () => {
  const [automationStatus, setAutomationStatus] = useState({
    socialMedia: false,
    adCampaigns: false,
    leadGen: false,
    seo: false
  });
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState([]);
  const [stats, setStats] = useState({
    postsGenerated: 0,
    adsCreated: 0,
    leadsGenerated: 0,
    platformsActive: 0
  });

  const startAutomation = async (type) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/ai-marketing/start`, { type });
      setAutomationStatus(prev => ({ ...prev, [type]: true }));
      setStats(response.data.stats);
      if (response.data.content) {
        setGeneratedContent(prev => [...prev, ...response.data.content]);
      }
    } catch (error) {
      console.error("Error starting automation:", error);
    } finally {
      setLoading(false);
    }
  };

  const stopAutomation = (type) => {
    setAutomationStatus(prev => ({ ...prev, [type]: false }));
  };

  const automationFeatures = [
    {
      id: "socialMedia",
      name: "Auto Social Media Posts",
      description: "AI generates and posts content on Facebook, Instagram, LinkedIn automatically",
      icon: <Instagram className="w-8 h-8" />,
      color: "from-purple-500 to-pink-500",
      platforms: ["Facebook", "Instagram", "LinkedIn"],
      features: [
        "Daily posts about solar benefits",
        "Customer testimonials sharing",
        "Government scheme updates",
        "Before/After installation photos",
        "Energy savings tips"
      ]
    },
    {
      id: "adCampaigns",
      name: "Auto Ad Campaigns",
      description: "AI creates and manages Google & Facebook ads targeting Bihar customers",
      icon: <Target className="w-8 h-8" />,
      color: "from-blue-500 to-cyan-500",
      platforms: ["Google Ads", "Facebook Ads"],
      features: [
        "Targeted ads for Bihar region",
        "Budget optimization",
        "A/B testing automatically",
        "ROI-focused campaigns",
        "Real-time optimization"
      ]
    },
    {
      id: "leadGen",
      name: "Auto Lead Generation",
      description: "AI identifies and engages potential customers automatically",
      icon: <Users className="w-8 h-8" />,
      color: "from-green-500 to-teal-500",
      platforms: ["WhatsApp", "Email", "SMS"],
      features: [
        "AI chatbot engagement",
        "Automated follow-ups",
        "Lead scoring & qualification",
        "Personalized messaging",
        "Instant quote generation"
      ]
    },
    {
      id: "seo",
      name: "Auto SEO & Content",
      description: "AI optimizes website and creates blog content for search rankings",
      icon: <Search className="w-8 h-8" />,
      color: "from-yellow-500 to-orange-500",
      platforms: ["Google Search", "Blog", "Website"],
      features: [
        "Keyword optimization",
        "Blog post generation",
        "Local SEO (Bihar)",
        "Meta tags optimization",
        "Content calendar"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full mb-6 shadow-lg">
            <Zap className="w-5 h-5" />
            <span className="font-semibold">AI-Powered Marketing Automation</span>
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
            Automatic Lead Generation & Advertising
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Let AI handle your marketing 24/7 - Generate leads, create content, and advertise ASR Enterprises across all platforms automatically
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-purple-600" />
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">Today</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.postsGenerated}</div>
            <div className="text-sm text-gray-600">Posts Generated</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8 text-blue-600" />
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">Active</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.adsCreated}</div>
            <div className="text-sm text-gray-600">Ads Running</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">New</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.leadsGenerated}</div>
            <div className="text-sm text-gray-600">Leads Generated</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Globe className="w-8 h-8 text-orange-600" />
              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">Live</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.platformsActive}</div>
            <div className="text-sm text-gray-600">Platforms Active</div>
          </div>
        </div>

        {/* Automation Features */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {automationFeatures.map((feature) => (
            <div
              key={feature.id}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition"
            >
              <div className={`bg-gradient-to-r ${feature.color} p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-white bg-opacity-20 p-3 rounded-lg backdrop-blur">
                    {feature.icon}
                  </div>
                  <button
                    onClick={() => automationStatus[feature.id] ? stopAutomation(feature.id) : startAutomation(feature.id)}
                    disabled={loading}
                    className={`${
                      automationStatus[feature.id] 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    } px-6 py-2 rounded-lg font-semibold transition flex items-center space-x-2 disabled:opacity-50`}
                    data-testid={`toggle-${feature.id}`}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : automationStatus[feature.id] ? (
                      <>
                        <Pause className="w-5 h-5" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        <span>Start</span>
                      </>
                    )}
                  </button>
                </div>
                <h3 className="text-2xl font-bold mb-2">{feature.name}</h3>
                <p className="text-white text-opacity-90">{feature.description}</p>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Globe className="w-5 h-5 mr-2 text-gray-600" />
                    Platforms:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {feature.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">AI Features:</h4>
                  <ul className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {automationStatus[feature.id] && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold">Automation Active - Running 24/7</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Generated Content Preview */}
        {generatedContent.length > 0 && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
              <Zap className="w-8 h-8 text-yellow-500 mr-3" />
              AI-Generated Content (Last 24 Hours)
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {generatedContent.slice(0, 6).map((content, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      content.platform === 'Facebook' ? 'bg-blue-100 text-blue-700' :
                      content.platform === 'Instagram' ? 'bg-purple-100 text-purple-700' :
                      content.platform === 'Google' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {content.platform}
                    </span>
                    <span className="text-xs text-gray-500">{content.time}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{content.text}</p>
                  {content.status === 'published' && (
                    <div className="mt-3 flex items-center text-xs text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      <span>Published Successfully</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-8 md:p-12 text-white mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">How AI Marketing Automation Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-white bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="font-bold mb-2">AI Content Creation</h3>
              <p className="text-sm text-indigo-100">AI generates posts, ads, and messages tailored for Bihar customers</p>
            </div>
            <div className="text-center">
              <div className="bg-white bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="font-bold mb-2">Auto Publishing</h3>
              <p className="text-sm text-indigo-100">Content automatically posts to all platforms at optimal times</p>
            </div>
            <div className="text-center">
              <div className="bg-white bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="font-bold mb-2">Lead Capture</h3>
              <p className="text-sm text-indigo-100">AI chatbot engages visitors and captures qualified leads</p>
            </div>
            <div className="text-center">
              <div className="bg-white bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur">
                <span className="text-2xl font-bold">4</span>
              </div>
              <h3 className="font-bold mb-2">Notifications</h3>
              <p className="text-sm text-indigo-100">You get instant WhatsApp alerts for every new lead</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Benefits of AI Marketing Automation</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">24/7 Marketing</h3>
              <p className="text-gray-600">AI works round the clock promoting your business even while you sleep</p>
            </div>
            <div className="text-center p-6">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">More Leads</h3>
              <p className="text-gray-600">Generate 10x more qualified leads automatically with AI targeting</p>
            </div>
            <div className="text-center p-6">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Save Time & Money</h3>
              <p className="text-gray-600">No need to hire marketing team - AI does everything automatically</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Import Users icon
import { Users } from "lucide-react";
