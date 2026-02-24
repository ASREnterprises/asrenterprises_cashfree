import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Trash2, Newspaper, Sparkles, ExternalLink } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const GovtNewsManagement = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/govt-news`);
      setNews(res.data);
    } catch (err) {
      console.error("Error fetching news:", err);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${API}/admin/govt-news/refresh`);
      await fetchNews();
      alert("AI has updated the latest government news!");
    } catch (err) {
      alert("Error refreshing news");
    }
    setRefreshing(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this news item?")) {
      try {
        await axios.delete(`${API}/admin/govt-news/${id}`);
        fetchNews();
      } catch (err) {
        alert("Error deleting news");
      }
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "subsidy": return "bg-green-600";
      case "scheme": return "bg-blue-600";
      case "guideline": return "bg-purple-600";
      default: return "bg-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-white shadow-lg py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold text-[#0a355e]">Government News & Schemes</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
          >
            <Sparkles className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "AI Fetching..." : "AI Auto-Update"}</span>
          </button>
        </div>

        {/* AI Info Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 mb-8 text-[#0a355e]">
          <div className="flex items-center space-x-4">
            <Sparkles className="w-10 h-10" />
            <div>
              <h2 className="text-xl font-bold">AI-Powered News Updates</h2>
              <p className="text-indigo-200">
                Click "AI Auto-Update" to fetch latest PM Surya Ghar Yojana news and Bihar solar scheme updates using AI.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <RefreshCw className="w-12 h-12 text-gray-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500">Loading news...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item) => (
              <div key={item.id} className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`${getCategoryColor(item.category)} text-[#0a355e] text-xs px-2 py-1 rounded`}>
                        {item.category?.toUpperCase()}
                      </span>
                      <span className="text-gray-500 text-sm">{item.source}</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#0a355e] mb-2">{item.title}</h3>
                    <p className="text-gray-500">{item.summary}</p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-400 hover:text-blue-300 mt-3 text-sm"
                      >
                        Read More <ExternalLink className="w-4 h-4 ml-1" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-400 hover:text-red-300 ml-4"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && news.length === 0 && (
          <div className="text-center py-16">
            <Newspaper className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No government news available.</p>
            <button
              onClick={handleRefresh}
              className="bg-indigo-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700"
            >
              Fetch Latest News with AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
