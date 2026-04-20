import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Star, MapPin, User } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ReviewsManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    location: "",
    rating: 5,
    review_text: "",
    system_installed: "",
    photo_url: ""
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API}/reviews`);
      setReviews(res.data);
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/admin/reviews`, formData);
      setFormData({ customer_name: "", location: "", rating: 5, review_text: "", system_installed: "", photo_url: "" });
      setShowForm(false);
      fetchReviews();
    } catch (err) {
      alert("Error adding review");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this review?")) {
      try {
        await axios.delete(`${API}/admin/reviews/${id}`);
        fetchReviews();
      } catch (err) {
        alert("Error deleting review");
      }
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
            <h1 className="text-3xl font-bold text-[#0a355e]">Customer Reviews Management</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-yellow-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-yellow-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Review</span>
          </button>
        </div>

        {showForm && (
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Add Customer Review</h2>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Customer Name"
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Location (e.g., Patna, Bihar)"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <select
                value={formData.rating}
                onChange={(e) => setFormData({...formData, rating: parseInt(e.target.value)})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              >
                <option value={5}>5 Stars - Excellent</option>
                <option value={4}>4 Stars - Very Good</option>
                <option value={3}>3 Stars - Good</option>
                <option value={2}>2 Stars - Fair</option>
                <option value={1}>1 Star - Poor</option>
              </select>
              <input
                type="text"
                placeholder="System Installed (e.g., 3 kW TATA Solar)"
                value={formData.system_installed}
                onChange={(e) => setFormData({...formData, system_installed: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              />
              <textarea
                placeholder="Review Text"
                value={formData.review_text}
                onChange={(e) => setFormData({...formData, review_text: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg md:col-span-2"
                rows={3}
                required
              />
              <input
                type="url"
                placeholder="Customer Photo URL (optional)"
                value={formData.photo_url}
                onChange={(e) => setFormData({...formData, photo_url: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add Review"}
              </button>
            </form>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-[#0a355e] font-bold text-xl">
                    {review.customer_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0a355e]">{review.customer_name}</h3>
                    <div className="flex items-center text-gray-500 text-sm">
                      <MapPin className="w-3 h-3 mr-1" />
                      {review.location}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(review.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
                  />
                ))}
              </div>
              <p className="text-gray-600 mb-3">"{review.review_text}"</p>
              {review.system_installed && (
                <span className="bg-blue-600 text-[#0a355e] text-xs px-2 py-1 rounded">{review.system_installed}</span>
              )}
            </div>
          ))}
        </div>

        {reviews.length === 0 && (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No reviews added yet. Click "Add Review" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
