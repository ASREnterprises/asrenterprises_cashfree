import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Edit, Calendar, Sparkles } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FestivalsManagement = () => {
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    image_url: "",
    start_date: "",
    end_date: ""
  });

  useEffect(() => {
    fetchFestivals();
  }, []);

  const fetchFestivals = async () => {
    try {
      const res = await axios.get(`${API}/festivals`);
      setFestivals(res.data);
    } catch (err) {
      console.error("Error fetching festivals:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`${API}/admin/festivals/${editingId}`, formData);
      } else {
        await axios.post(`${API}/admin/festivals`, formData);
      }
      setFormData({ title: "", message: "", image_url: "", start_date: "", end_date: "" });
      setShowForm(false);
      setEditingId(null);
      fetchFestivals();
    } catch (err) {
      alert("Error saving festival post");
    }
    setLoading(false);
  };

  const handleEdit = (festival) => {
    setFormData({
      title: festival.title,
      message: festival.message,
      image_url: festival.image_url || "",
      start_date: festival.start_date,
      end_date: festival.end_date
    });
    setEditingId(festival.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this festival post?")) {
      try {
        await axios.delete(`${API}/admin/festivals/${id}`);
        fetchFestivals();
      } catch (err) {
        alert("Error deleting festival");
      }
    }
  };

  const upcomingFestivals = [
    { name: "Republic Day", date: "2026-01-26" },
    { name: "Holi", date: "2026-03-17" },
    { name: "Eid ul-Fitr", date: "2026-03-31" },
    { name: "Independence Day", date: "2026-08-15" },
    { name: "Diwali", date: "2026-10-20" },
    { name: "Christmas", date: "2026-12-25" },
    { name: "New Year", date: "2027-01-01" }
  ];

  return (
    <div className="min-h-screen bg-white shadow-lg py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold text-[#0a355e]">Festival Posts Management</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ title: "", message: "", image_url: "", start_date: "", end_date: "" }); }}
            className="bg-pink-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-pink-700"
          >
            <Plus className="w-5 h-5" />
            <span>Create Post</span>
          </button>
        </div>

        {/* Quick Festival Templates */}
        <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-[#0a355e] mb-4 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />
            Quick Festival Templates
          </h2>
          <div className="flex flex-wrap gap-2">
            {upcomingFestivals.map((fest, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setFormData({
                    title: `Happy ${fest.name}!`,
                    message: `ASR ENTERPRISES wishes you and your family a very Happy ${fest.name}! May this ${fest.name} bring prosperity and happiness to your home. Go solar, go green!`,
                    image_url: "",
                    start_date: fest.date,
                    end_date: fest.date
                  });
                  setShowForm(true);
                  setEditingId(null);
                }}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg text-sm hover:bg-gray-600 transition"
              >
                {fest.name}
              </button>
            ))}
          </div>
        </div>

        {showForm && (
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">
              {editingId ? "Edit Festival Post" : "Create Festival Post"}
            </h2>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Festival Title (e.g., Happy Diwali!)"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <input
                type="url"
                placeholder="Image URL (optional)"
                value={formData.image_url}
                onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              />
              <div>
                <label className="text-gray-500 text-sm mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg w-full"
                  required
                />
              </div>
              <div>
                <label className="text-gray-500 text-sm mb-1 block">End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg w-full"
                  required
                />
              </div>
              <textarea
                placeholder="Festival Message"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg md:col-span-2"
                rows={3}
                required
              />
              <div className="md:col-span-2 flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex-1"
                >
                  {loading ? "Saving..." : editingId ? "Update Post" : "Create Post"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="bg-gray-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {festivals.map((festival) => (
            <div key={festival.id} className="bg-gradient-to-br from-pink-600 to-purple-700 rounded-xl p-6 text-[#0a355e]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{festival.title}</h3>
                  <div className="flex items-center text-pink-200 text-sm mt-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    {festival.start_date} to {festival.end_date}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(festival)}
                    className="bg-white bg-opacity-20 p-2 rounded-lg hover:bg-opacity-30"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(festival.id)}
                    className="bg-white bg-opacity-20 p-2 rounded-lg hover:bg-opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-pink-100">{festival.message}</p>
              {festival.is_active && (
                <span className="inline-block mt-4 bg-green-500 text-[#0a355e] text-xs px-2 py-1 rounded">Active</span>
              )}
            </div>
          ))}
        </div>

        {festivals.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No festival posts created yet. Use templates above or click "Create Post".</p>
          </div>
        )}
      </div>
    </div>
  );
};
