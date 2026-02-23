import { useState, useEffect } from "react";
import { ChevronRight, X, Play, MapPin, Calendar, Award, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const GalleryPage = () => {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [dynamicPhotos, setDynamicPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Static gallery items (original photos)
  const staticGalleryItems = [
    {
      type: "video",
      url: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/6t8numer_VID-20260130-WA0022.mp4",
      thumbnail: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/xgz3s4do_IMG-20250826-WA0065.jpg",
      title: "Solar Installation Process",
      location: "Bihar, India"
    },
    {
      type: "image",
      url: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/xgz3s4do_IMG-20250826-WA0065.jpg",
      title: "Rooftop Solar Installation - Vaishali",
      location: "Vaishali, Bihar, India",
      date: "August 2025"
    },
    {
      type: "image",
      url: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/q85yfc91_IMG-20250826-WA0070.jpg",
      title: "Solar Panel Setup - Chak Bhoj",
      location: "Chak Bhoj Urf Sahabuddin, Bihar",
      date: "August 2025"
    },
    {
      type: "image",
      url: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/ftxdhwd0_IMG-20250826-WA0064.jpg",
      title: "Complete Solar System - Vaishali",
      location: "Vaishali, Bihar, India",
      date: "August 2025"
    },
    {
      type: "image",
      url: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/oog1cnfw_IMG-20250826-WA0068.jpg",
      title: "Solar Inverter Installation",
      location: "Vaishali, Bihar, India",
      date: "August 2025"
    },
    {
      type: "image",
      url: "https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/l7dcgwqq_IMG-20250826-WA0069.jpg",
      title: "Professional Solar Setup",
      location: "Vaishali, Bihar, India",
      date: "August 2025"
    }
  ];

  useEffect(() => {
    fetchGalleryPhotos();
  }, []);

  const fetchGalleryPhotos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/photos`);
      // Convert backend photos to gallery format
      const crmPhotos = (res.data || []).map(photo => ({
        type: "image",
        url: photo.image_url || photo.imageUrl,
        title: photo.title,
        location: photo.location || "Bihar, India",
        date: photo.timestamp ? new Date(photo.timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : undefined,
        systemSize: photo.system_size
      }));
      setDynamicPhotos(crmPhotos);
    } catch (err) {
      console.error("Error fetching gallery photos:", err);
    }
    setLoading(false);
  };

  // Combine dynamic CRM photos with static ones (CRM photos first)
  const galleryItems = [...dynamicPhotos, ...staticGalleryItems];

  const openModal = (item) => {
    setSelectedMedia(item);
  };

  const closeModal = () => {
    setSelectedMedia(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-sky-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-amber-600 hover:text-amber-500 mb-4">
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Back to Home</span>
          </Link>
          
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/asr_logo_transparent.png" 
                alt="ASR Enterprises Patna" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-5xl font-extrabold text-[#0a355e] mb-4">
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">Solar Projects</span>
            </h1>
            <p className="text-xl text-gray-600 mb-2">Transforming Bihar with Clean Energy Solutions</p>
            <div className="flex items-center justify-center space-x-2 text-amber-600">
              <Award className="w-5 h-5" />
              <span className="font-semibold">Follow us: @asr_enterprises_patna</span>
            </div>
            <div className="text-gray-500 text-sm mt-2">
              <a href="tel:8877896889" className="hover:text-amber-600">📞 8877896889</a>
              <span className="mx-2">|</span>
              <a href="mailto:asrenterprisespatna@gmail.com" className="hover:text-amber-600">✉️ asrenterprisespatna@gmail.com</a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-white text-center">
            <div>
              <div className="text-4xl font-bold mb-1">25+</div>
              <div className="text-amber-100 text-sm">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">100kW+</div>
              <div className="text-amber-100 text-sm">Total Capacity</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">MNRE</div>
              <div className="text-amber-100 text-sm">Registered Vendor</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">5★</div>
              <div className="text-amber-100 text-sm">Rated Service</div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Refresh Button */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={fetchGalleryPhotos} 
            className="flex items-center space-x-2 text-gray-500 hover:text-amber-600 transition"
            disabled={loading}
            data-testid="refresh-gallery-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((item, index) => (
              <div
                key={index}
                className="relative group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-sky-200 bg-white"
                onClick={() => openModal(item)}
                data-testid={`gallery-item-${index}`}
              >
                {/* Image/Video Thumbnail */}
                <div className="relative aspect-[4/3] overflow-hidden bg-sky-50">
                  <img
                    src={item.type === "video" ? item.thumbnail : item.url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Solar+Installation'; }}
                  />
                  
                  {/* Play button for video */}
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                      <div className="bg-white rounded-full p-4 group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="w-8 h-8 text-amber-600" fill="currentColor" />
                      </div>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-50"></div>
                  
                  {/* Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                    <div className="flex items-center text-sm text-gray-200">
                      <MapPin className="w-4 h-4 mr-1" />
                      <span>{item.location}</span>
                    </div>
                    {item.date && (
                      <div className="flex items-center text-sm text-gray-200 mt-1">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span>{item.date}</span>
                      </div>
                    )}
                    {item.systemSize && (
                      <div className="text-xs text-amber-400 mt-1 font-semibold">
                        System: {item.systemSize}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-br from-sky-100 to-blue-100 rounded-2xl shadow-xl p-8 md:p-12 text-center border border-sky-200">
          <h2 className="text-3xl font-bold text-[#0a355e] mb-4">Ready to Go Solar?</h2>
          <p className="text-xl text-gray-600 mb-8">Join hundreds of satisfied customers in Bihar who have switched to clean energy</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/leads"
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-lg"
            >
              Get Free Consultation
            </Link>
            <Link
              to="/calculator"
              className="bg-white text-amber-600 border-2 border-amber-500 px-8 py-4 rounded-lg font-semibold hover:bg-amber-50 transition shadow-md"
            >
              Calculate Savings
            </Link>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition bg-black/50 rounded-full p-2"
            onClick={closeModal}
            data-testid="close-modal-btn"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            {selectedMedia.type === "video" ? (
              <video
                controls
                autoPlay
                className="w-full rounded-lg shadow-2xl"
                data-testid="modal-video"
              >
                <source src={selectedMedia.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.title}
                className="w-full rounded-lg shadow-2xl"
                data-testid="modal-image"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/800x600?text=Solar+Installation'; }}
              />
            )}

            {/* Image Info */}
            <div className="bg-white rounded-b-lg p-6 mt-2 border border-sky-200">
              <h3 className="text-2xl font-bold text-[#0a355e] mb-2">{selectedMedia.title}</h3>
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2 text-amber-600" />
                <span>{selectedMedia.location}</span>
              </div>
              {selectedMedia.date && (
                <div className="flex items-center text-gray-600 mb-2">
                  <Calendar className="w-5 h-5 mr-2 text-amber-600" />
                  <span>{selectedMedia.date}</span>
                </div>
              )}
              {selectedMedia.systemSize && (
                <div className="text-amber-600 font-semibold">
                  System Size: {selectedMedia.systemSize}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
