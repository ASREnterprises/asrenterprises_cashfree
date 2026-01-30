import { useState } from "react";
import { ChevronRight, X, Play, MapPin, Calendar, Award } from "lucide-react";
import { Link } from "react-router-dom";

export const GalleryPage = () => {
  const [selectedMedia, setSelectedMedia] = useState(null);

  const galleryItems = [
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

  const openModal = (item) => {
    setSelectedMedia(item);
  };

  const closeModal = () => {
    setSelectedMedia(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Back to Home</span>
          </Link>
          
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" 
                alt="ASR Enterprises Patna" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600">Solar Projects</span>
            </h1>
            <p className="text-xl text-gray-600 mb-2">Transforming Bihar with Clean Energy Solutions</p>
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <Award className="w-5 h-5" />
              <span className="font-semibold">Follow us: @asr_enterprises_patna</span>
            </div>
            <div className="text-gray-600 text-sm mt-2">
              <a href="tel:8877896889" className="hover:text-blue-600">📞 8877896889</a>
              <span className="mx-2">|</span>
              <a href="mailto:asrenterprisespatna@gmail.com" className="hover:text-blue-600">✉️ asrenterprisespatna@gmail.com</a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Banner */}
      <div className="bg-gradient-to-r from-yellow-600 to-orange-600 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-white text-center">
            <div>
              <div className="text-4xl font-bold mb-1">25+</div>
              <div className="text-yellow-100 text-sm">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">100kW+</div>
              <div className="text-yellow-100 text-sm">Total Capacity</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">MNRE</div>
              <div className="text-yellow-100 text-sm">Registered Vendor</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">5★</div>
              <div className="text-yellow-100 text-sm">Rated Service</div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleryItems.map((item, index) => (
            <div
              key={index}
              className="relative group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              onClick={() => openModal(item)}
              data-testid={`gallery-item-${index}`}
            >
              {/* Image/Video Thumbnail */}
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
                <img
                  src={item.type === "video" ? item.thumbnail : item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                
                {/* Play button for video */}
                {item.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                    <div className="bg-white rounded-full p-4 group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-yellow-600" fill="currentColor" />
                    </div>
                  </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                
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
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Go Solar?</h2>
          <p className="text-xl text-gray-600 mb-8">Join hundreds of satisfied customers in Bihar who have switched to clean energy</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/leads"
              className="bg-yellow-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-yellow-700 transition"
            >
              Get Free Consultation
            </Link>
            <Link
              to="/calculator"
              className="bg-white text-yellow-600 border-2 border-yellow-600 px-8 py-4 rounded-lg font-semibold hover:bg-yellow-50 transition"
            >
              Calculate Savings
            </Link>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
            onClick={closeModal}
            data-testid="close-modal-btn"
          >
            <X className="w-10 h-10" />
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
              />
            )}

            {/* Image Info */}
            <div className="bg-white rounded-b-lg p-6 mt-2">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedMedia.title}</h3>
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2" />
                <span>{selectedMedia.location}</span>
              </div>
              {selectedMedia.date && (
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-5 h-5 mr-2" />
                  <span>{selectedMedia.date}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
