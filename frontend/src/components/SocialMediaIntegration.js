import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Facebook, Instagram, MessageSquare, Link2, 
  Sparkles, Send, RefreshCw, CheckCircle, AlertCircle,
  Image, FileText, TrendingUp, Clock, Loader2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const SocialMediaIntegration = () => {
  const [accounts, setAccounts] = useState([
    { id: 1, platform: "facebook", name: "ASR Enterprises", connected: true, followers: 250 },
    { id: 2, platform: "instagram", name: "@asr_enterprises_patna", connected: true, followers: 180 },
    { id: 3, platform: "whatsapp", name: "Business Account", connected: true, contacts: 500 },
    { id: 4, platform: "google_business", name: "Google My Business", connected: false, reviews: 15 }
  ]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["facebook", "instagram"]);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API}/admin/social-posts`);
      setPosts(res.data || []);
    } catch (err) {
      console.log("No posts yet");
    }
  };

  const generateAIPost = async (type) => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/admin/social-posts/generate`, { type });
      setAiSuggestions(res.data.suggestions || []);
      if (res.data.suggestions?.length > 0) {
        setPostContent(res.data.suggestions[0]);
      }
    } catch (err) {
      // Generate fallback content
      const fallbackContent = {
        promotion: "🌞 Switch to Solar with ASR Enterprises! Get up to ₹78,000 govt subsidy under PM Surya Ghar Yojana. 25-year warranty + 5 years FREE maintenance! 📞 Call: 9296389097 | 💬 WhatsApp: 9296389097 #SolarPower #BiharSolar #PMSuryaGhar",
        project: "✨ Another successful installation in Bihar! Our team just completed a 5kW rooftop solar system. Save 90% on electricity bills! Contact us for a FREE site survey. 📞 Call: 9296389097 | 💬 WhatsApp: 9296389097 #SolarInstallation #CleanEnergy",
        festival: "🎉 Wishing everyone a prosperous day! From all of us at ASR Enterprises - Bihar's trusted solar partner. 🌞 Go solar, save money, protect the environment! #GreenEnergy #SolarBihar",
        scheme: "📢 Important Update! PM Surya Ghar Muft Bijli Yojana offers up to ₹78,000 subsidy for rooftop solar. Don't miss this opportunity! ASR Enterprises can help you apply. 📞 Call: 9296389097 | 💬 WhatsApp: 9296389097 #GovtScheme #SolarSubsidy"
      };
      setPostContent(fallbackContent[type] || fallbackContent.promotion);
    }
    setGenerating(false);
  };

  const createPost = async () => {
    if (!postContent.trim()) {
      alert("Please enter post content");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/admin/social-posts`, {
        content: postContent,
        platforms: selectedPlatforms,
        status: "scheduled"
      });
      setPostContent("");
      setShowCreatePost(false);
      fetchPosts();
      alert("Post scheduled successfully!");
    } catch (err) {
      alert("Error creating post");
    }
    setLoading(false);
  };

  const togglePlatform = (platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case "facebook": return <Facebook className="w-5 h-5" />;
      case "instagram": return <Instagram className="w-5 h-5" />;
      case "whatsapp": return <MessageSquare className="w-5 h-5" />;
      case "google_business": return <Link2 className="w-5 h-5" />;
      default: return <Link2 className="w-5 h-5" />;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform) {
      case "facebook": return "from-blue-600 to-blue-700";
      case "instagram": return "from-pink-500 to-purple-600";
      case "whatsapp": return "from-green-500 to-green-600";
      case "google_business": return "from-red-500 to-yellow-500";
      default: return "from-gray-500 to-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin/dashboard"
              className="bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-1">AI Social Media Hub</h1>
              <p className="text-gray-400">Manage & auto-post to all your social platforms</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreatePost(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition flex items-center space-x-2"
            data-testid="create-post-btn"
          >
            <Sparkles className="w-5 h-5" />
            <span>Create AI Post</span>
          </button>
        </div>

        {/* Connected Accounts */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Connected Accounts</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`bg-gradient-to-br ${getPlatformColor(account.platform)} rounded-xl p-5 text-white relative overflow-hidden`}
              >
                <div className="absolute top-2 right-2">
                  {account.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-300" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-300" />
                  )}
                </div>
                <div className="flex items-center space-x-3 mb-3">
                  {getPlatformIcon(account.platform)}
                  <span className="font-bold capitalize">{account.platform.replace("_", " ")}</span>
                </div>
                <p className="text-sm text-white text-opacity-90 mb-2">{account.name}</p>
                <div className="text-2xl font-bold">
                  {account.followers || account.contacts || account.reviews || 0}
                </div>
                <div className="text-xs text-white text-opacity-70">
                  {account.followers ? "Followers" : account.contacts ? "Contacts" : "Reviews"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Post Generator Modal */}
        {showCreatePost && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <span>AI Post Generator</span>
                </h2>
                <button
                  onClick={() => setShowCreatePost(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* AI Generation Buttons */}
              <div className="mb-6">
                <p className="text-gray-400 mb-3">Generate AI content for:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => generateAIPost("promotion")}
                    disabled={generating}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition flex items-center justify-center space-x-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Promotion</span>
                  </button>
                  <button
                    onClick={() => generateAIPost("project")}
                    disabled={generating}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition flex items-center justify-center space-x-2"
                  >
                    <Image className="w-4 h-4" />
                    <span>Project</span>
                  </button>
                  <button
                    onClick={() => generateAIPost("festival")}
                    disabled={generating}
                    className="bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-medium hover:from-pink-600 hover:to-purple-600 transition flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Festival</span>
                  </button>
                  <button
                    onClick={() => generateAIPost("scheme")}
                    disabled={generating}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Govt Scheme</span>
                  </button>
                </div>
              </div>

              {/* Post Content */}
              <div className="mb-6">
                <label className="block text-gray-400 mb-2">Post Content</label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Write your post or click above to generate AI content..."
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg resize-none h-40 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                {generating && (
                  <div className="flex items-center space-x-2 mt-2 text-purple-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating AI content...</span>
                  </div>
                )}
              </div>

              {/* Platform Selection */}
              <div className="mb-6">
                <label className="block text-gray-400 mb-3">Post to platforms:</label>
                <div className="flex flex-wrap gap-3">
                  {["facebook", "instagram", "whatsapp"].map((platform) => (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition ${
                        selectedPlatforms.includes(platform)
                          ? "border-purple-500 bg-purple-500 bg-opacity-20 text-white"
                          : "border-gray-600 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {getPlatformIcon(platform)}
                      <span className="capitalize">{platform}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={createPost}
                  disabled={loading || !postContent.trim()}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span>{loading ? "Scheduling..." : "Schedule Post"}</span>
                </button>
                <button
                  onClick={() => setShowCreatePost(false)}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Posts */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Recent Posts</h2>
            <button
              onClick={fetchPosts}
              className="text-gray-400 hover:text-white flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex space-x-2">
                      {post.platforms?.map((platform) => (
                        <span
                          key={platform}
                          className={`bg-gradient-to-r ${getPlatformColor(platform)} p-1 rounded`}
                        >
                          {getPlatformIcon(platform)}
                        </span>
                      ))}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      post.status === "published" ? "bg-green-600 text-white" :
                      post.status === "scheduled" ? "bg-yellow-600 text-white" :
                      "bg-gray-600 text-white"
                    }`}>
                      {post.status || "draft"}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{post.content}</p>
                  <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{post.created_at || "Just now"}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No posts yet. Create your first AI-powered post!</p>
            </div>
          )}
        </div>

        {/* Auto-Post Info */}
        <div className="mt-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
          <div className="flex items-center space-x-4">
            <Sparkles className="w-10 h-10" />
            <div>
              <h3 className="text-xl font-bold">Auto-Post Feature</h3>
              <p className="text-purple-200">
                When you upload new work photos or add customer reviews, AI will automatically 
                suggest social media posts. Enable notifications to post instantly!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
