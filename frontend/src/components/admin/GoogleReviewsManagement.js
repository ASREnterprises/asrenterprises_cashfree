import { useState, useEffect } from "react";
import { Star, Plus, Trash2, Eye, EyeOff, RefreshCw, Upload, ExternalLink, Copy, CheckCircle, X, Loader2 } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Google Business Place ID for ASR Enterprises
const GOOGLE_PLACE_ID = "ChIJAR33l2BX7TkRJ4CYdw8Hkps";
const GOOGLE_MAPS_URL = `https://www.google.com/maps/place/?q=place_id:${GOOGLE_PLACE_ID}`;
const GOOGLE_REVIEWS_URL = `https://search.google.com/local/reviews?placeid=${GOOGLE_PLACE_ID}`;

export const GoogleReviewsManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({
    reviewer_name: "",
    review_text: "",
    rating: 5,
    review_date: ""
  });
  const [bulkText, setBulkText] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API}/admin/google-reviews`);
      setReviews(res.data.reviews || []);
    } catch (error) {
      console.error("Fetch reviews error:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleAddReview = async () => {
    if (!newReview.reviewer_name || !newReview.review_text) {
      alert("Please enter reviewer name and review text");
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/admin/google-reviews/sync`, newReview);
      if (res.data.success) {
        alert("Review added successfully!");
        setShowAddModal(false);
        setNewReview({ reviewer_name: "", review_text: "", rating: 5, review_date: "" });
        fetchReviews();
      } else {
        alert(res.data.message || "Failed to add review");
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Error adding review");
    }
    setSubmitting(false);
  };

  const handleBulkSync = async () => {
    if (!bulkText.trim()) {
      alert("Please paste review data");
      return;
    }

    // Parse bulk text - expect format: Name | Rating | Review text (one per line)
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const reviewsToSync = [];

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        reviewsToSync.push({
          reviewer_name: parts[0],
          rating: parseInt(parts[1]) || 5,
          review_text: parts.slice(2).join('|').trim() || parts[1]
        });
      }
    }

    if (reviewsToSync.length === 0) {
      alert("No valid reviews found. Use format: Name | Rating | Review text");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/admin/google-reviews/bulk-sync`, { reviews: reviewsToSync });
      alert(`Synced ${res.data.synced} reviews, ${res.data.skipped} skipped`);
      setShowBulkModal(false);
      setBulkText("");
      fetchReviews();
    } catch (error) {
      alert(error.response?.data?.detail || "Error syncing reviews");
    }
    setSubmitting(false);
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Delete this review?")) return;
    
    try {
      await axios.delete(`${API}/admin/google-reviews/${reviewId}`);
      fetchReviews();
    } catch (error) {
      alert("Error deleting review");
    }
  };

  const handleToggleVisibility = async (reviewId) => {
    try {
      await axios.put(`${API}/admin/google-reviews/${reviewId}/toggle`);
      fetchReviews();
    } catch (error) {
      alert("Error updating visibility");
    }
  };

  const copyInstructions = () => {
    const text = `How to copy reviews from Google:
1. Go to Google Maps and search "ASR Enterprises Patna"
2. Click on "Reviews" tab
3. For each review, copy: Reviewer Name | Star Rating | Review Text
4. Paste in bulk sync with format: Name | 5 | Great service...`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
              <Star className="w-6 h-6 text-amber-500" />
              <span>Google Reviews Management</span>
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Manually sync reviews from your Google Business Profile
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchReviews}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center space-x-2 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Sync</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center space-x-2 hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              <span>Add Review</span>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
          <ExternalLink className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-800 text-sm">
              <strong>How to sync:</strong> Go to your{" "}
              <a 
                href="https://www.google.com/maps/search/ASR+Enterprises+Patna" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                Google Business Profile
              </a>
              , copy reviews, and paste them here using "Bulk Sync".
            </p>
          </div>
          <button
            onClick={copyInstructions}
            className="px-3 py-1 bg-amber-200 text-amber-800 rounded text-sm flex items-center space-x-1"
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied!" : "Copy Guide"}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-amber-600">{reviews.length}</div>
          <div className="text-gray-500 text-sm">Total Reviews</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">
            {reviews.filter(r => r.visible).length}
          </div>
          <div className="text-gray-500 text-sm">Visible</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">
            {reviews.length > 0 
              ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
              : "0"}
          </div>
          <div className="text-gray-500 text-sm">Avg Rating</div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No reviews synced yet. Add reviews from Google!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviews.map((review) => (
              <div 
                key={review.id} 
                className={`p-4 flex items-start space-x-4 ${!review.visible ? 'bg-gray-50 opacity-60' : ''}`}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {review.reviewer_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-800">{review.reviewer_name}</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    {review.verified && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Google Verified</span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{review.review_text}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {review.review_date || "Recently"} • Synced {new Date(review.synced_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleToggleVisibility(review.id)}
                    className={`p-2 rounded-lg ${review.visible ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                    title={review.visible ? "Hide review" : "Show review"}
                  >
                    {review.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Review Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Add Google Review</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Name *</label>
                <input
                  type="text"
                  value={newReview.reviewer_name}
                  onChange={(e) => setNewReview({...newReview, reviewer_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="e.g., Rahul Kumar"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewReview({...newReview, rating: star})}
                      className="p-1"
                    >
                      <Star 
                        className={`w-8 h-8 ${star <= newReview.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} 
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Text *</label>
                <textarea
                  value={newReview.review_text}
                  onChange={(e) => setNewReview({...newReview, review_text: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  rows={4}
                  placeholder="Paste the review text from Google..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Date (optional)</label>
                <input
                  type="date"
                  value={newReview.review_date}
                  onChange={(e) => setNewReview({...newReview, review_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddReview}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                <span>{submitting ? "Adding..." : "Add Review"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Sync Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Bulk Sync Google Reviews</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm">
                <strong>Format:</strong> One review per line: <code className="bg-blue-100 px-1 rounded">Name | Rating | Review text</code>
              </p>
              <p className="text-blue-600 text-xs mt-1">
                Example: Rahul Kumar | 5 | Excellent service! Very happy with installation.
              </p>
            </div>
            
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              rows={10}
              placeholder="Paste reviews here...&#10;Rahul Kumar | 5 | Great service!&#10;Priya Singh | 5 | Very professional team."
            />
            
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSync}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span>{submitting ? "Syncing..." : "Sync Reviews"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleReviewsManagement;
