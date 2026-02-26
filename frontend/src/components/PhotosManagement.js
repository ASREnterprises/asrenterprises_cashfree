import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Image, MapPin, Upload, Camera, X, ChevronDown, Loader2 } from "lucide-react";
import axios from "axios";
import { useAutoLogout } from "@/hooks/useAutoLogout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PhotosManagement = () => {
  const navigate = useNavigate();
  
  // Auto-logout after 15 minutes of inactivity
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  useAutoLogout(isAuthenticated, () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminEmail");
    localStorage.removeItem("asrAdminRole");
  }, 'admin');

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // "file" or "url"
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    location: "",
    system_size: "",
    category: "installation"
  });

  useEffect(() => {
    fetchPhotos(1);
  }, []);

  const fetchPhotos = async (pageNum, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    
    try {
      const res = await axios.get(`${API}/admin/photos?page=${pageNum}&limit=12`);
      const data = res.data;
      
      // Handle both old (array) and new (paginated object) response formats
      if (Array.isArray(data)) {
        setPhotos(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        if (append) {
          setPhotos(prev => [...prev, ...(data.photos || [])]);
        } else {
          setPhotos(data.photos || []);
        }
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
        setPage(data.page || pageNum);
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (page < totalPages) {
      fetchPhotos(page + 1, true);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.location) {
      alert("Please fill in title and location");
      return;
    }

    if (uploadMode === "file" && !selectedFile) {
      alert("Please select a file to upload");
      return;
    }

    if (uploadMode === "url" && !formData.image_url) {
      alert("Please enter an image URL");
      return;
    }

    setUploading(true);
    
    try {
      if (uploadMode === "file" && selectedFile) {
        // File upload
        const uploadData = new FormData();
        uploadData.append("file", selectedFile);
        uploadData.append("title", formData.title);
        uploadData.append("description", formData.description);
        uploadData.append("location", formData.location);
        uploadData.append("system_size", formData.system_size);
        uploadData.append("category", formData.category);
        
        await axios.post(`${API}/gallery/upload-file`, uploadData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        // URL upload
        await axios.post(`${API}/admin/photos`, formData);
      }
      
      // Reset form
      setFormData({ title: "", description: "", image_url: "", location: "", system_size: "", category: "installation" });
      setSelectedFile(null);
      setPreview("");
      setShowForm(false);
      // Reset pagination and fetch fresh
      setPage(1);
      fetchPhotos(1);
      alert("Photo uploaded successfully!");
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.detail || "Error uploading photo");
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this photo?")) {
      try {
        await axios.delete(`${API}/admin/photos/${id}`);
        // Reset pagination and fetch fresh
        setPage(1);
        fetchPhotos(1);
      } catch (err) {
        alert("Error deleting photo");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0a355e]">Gallery Management</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-blue-600 hover:to-blue-700 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Photo</span>
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl p-6 mb-8 shadow-lg border border-sky-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#0a355e]">Upload New Photo</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Upload Mode Toggle */}
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition ${
                  uploadMode === "file" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Upload File</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("url")}
                className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition ${
                  uploadMode === "url" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Image className="w-4 h-4" />
                <span>Paste URL</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File Upload Section */}
              {uploadMode === "file" && (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  {preview ? (
                    <div className="relative inline-block">
                      <img src={preview} alt="Preview" className="max-h-48 rounded-lg mx-auto" />
                      <button
                        type="button"
                        onClick={() => { setSelectedFile(null); setPreview(""); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center w-full py-8"
                      >
                        <Upload className="w-12 h-12 text-gray-400 mb-2" />
                        <span className="text-gray-500">Tap to select image from gallery or camera</span>
                        <span className="text-sm text-gray-400 mt-1">Supports JPG, PNG, WebP</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* URL Input */}
              {uploadMode === "url" && (
                <input
                  type="url"
                  placeholder="Paste image URL here"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                />
              )}

              {/* Form Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Photo Title *"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="Location (e.g., Patna, Bihar) *"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
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
              </div>
              
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
                rows={2}
              />

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Upload Photo</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Photos Grid */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-sky-200">
            <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500">Loading photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-sky-200">
            <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-500 mb-2">No Photos Yet</h3>
            <p className="text-gray-400 mb-4">Upload your first work photo to showcase your installations</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
            >
              Upload Photo
            </button>
          </div>
        ) : (
          <>
            {/* Photo count info */}
            <div className="mb-4 text-sm text-gray-500">
              Showing {photos.length} of {total} photos
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {photos.map((photo) => (
                <div key={photo.id} className="bg-white rounded-xl overflow-hidden shadow-lg border border-sky-200 hover:shadow-xl transition">
                  <img
                    src={photo.image_url}
                    alt={photo.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                    onError={(e) => e.target.src = "https://via.placeholder.com/400x300?text=Solar+Installation"}
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-[#0a355e] mb-1">{photo.title}</h3>
                    {photo.location && (
                      <p className="text-sm text-gray-500 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" /> {photo.location}
                      </p>
                    )}
                    {photo.system_size && (
                      <p className="text-sm text-blue-600 mt-1">{photo.system_size}</p>
                    )}
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="mt-3 text-red-500 hover:text-red-700 flex items-center text-sm"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Load More Button */}
            {page < totalPages && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2 mx-auto"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-5 h-5" />
                      <span>Load More Photos ({total - photos.length} remaining)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
