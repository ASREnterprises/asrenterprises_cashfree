import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Image, MapPin, Upload } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PhotosManagement = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    location: "",
    system_size: "",
    category: "installation"
  });

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const res = await axios.get(`${API}/photos`);
      setPhotos(res.data);
    } catch (err) {
      console.error("Error fetching photos:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/admin/photos`, formData);
      setFormData({ title: "", description: "", image_url: "", location: "", system_size: "", category: "installation" });
      setShowForm(false);
      fetchPhotos();
    } catch (err) {
      alert("Error uploading photo");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this photo?")) {
      try {
        await axios.delete(`${API}/admin/photos/${id}`);
        fetchPhotos();
      } catch (err) {
        alert("Error deleting photo");
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
            <h1 className="text-3xl font-bold text-[#0a355e]">Work Photos Management</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-[#0a355e] px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Photo</span>
          </button>
        </div>

        {showForm && (
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">Upload New Photo</h2>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Photo Title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
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
              <input
                type="url"
                placeholder="Image URL"
                value={formData.image_url}
                onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="System Size (e.g., 5 kW)"
                value={formData.system_size}
                onChange={(e) => setFormData({...formData, system_size: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              />
              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg md:col-span-2"
                rows={3}
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
              >
                <option value="installation">Installation</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Uploading..." : "Upload Photo"}
              </button>
            </form>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white shadow-lg border border-sky-200 rounded-xl overflow-hidden">
              <img
                src={photo.image_url}
                alt={photo.title}
                className="w-full h-48 object-cover"
                onError={(e) => e.target.src = "https://via.placeholder.com/400x300?text=Solar+Installation"}
              />
              <div className="p-4">
                <h3 className="text-lg font-bold text-[#0a355e] mb-1">{photo.title}</h3>
                <div className="flex items-center text-gray-500 text-sm mb-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  {photo.location}
                </div>
                <p className="text-gray-500 text-sm mb-3">{photo.description}</p>
                <div className="flex items-center justify-between">
                  <span className="bg-blue-600 text-[#0a355e] text-xs px-2 py-1 rounded">{photo.system_size || "Solar System"}</span>
                  <button
                    onClick={() => handleDelete(photo.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <div className="text-center py-16">
            <Image className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No photos uploaded yet. Click "Add Photo" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
