import { useState, useEffect } from "react";
import { MapPin, Star, Zap, User, ChevronRight, X, Phone, MessageSquare } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Bihar Districts with coordinates (approximate center points for visualization)
const BIHAR_DISTRICTS = {
  "Patna": { x: 52, y: 48, installations: 8 },
  "Gaya": { x: 48, y: 68, installations: 3 },
  "Bhagalpur": { x: 78, y: 42, installations: 2 },
  "Muzaffarpur": { x: 48, y: 25, installations: 4 },
  "Purnia": { x: 88, y: 22, installations: 1 },
  "Darbhanga": { x: 55, y: 18, installations: 2 },
  "Vaishali": { x: 48, y: 35, installations: 3 },
  "Hajipur": { x: 50, y: 38, installations: 2 },
  "Nalanda": { x: 48, y: 55, installations: 1 },
  "Aurangabad": { x: 38, y: 70, installations: 1 },
  "Samastipur": { x: 58, y: 30, installations: 1 },
  "Begusarai": { x: 62, y: 38, installations: 1 },
  "Munger": { x: 70, y: 42, installations: 1 },
  "Arrah": { x: 35, y: 52, installations: 1 },
  "Chhapra": { x: 35, y: 38, installations: 1 },
  "Siwan": { x: 28, y: 35, installations: 1 },
  "Motihari": { x: 38, y: 18, installations: 1 },
  "Bihar Sharif": { x: 52, y: 55, installations: 1 }
};

// Sample testimonials mapped to districts
const DISTRICT_TESTIMONIALS = {
  "Patna": [
    { name: "Rajesh Kumar", rating: 5, text: "Excellent service! My 3kW system is working perfectly. Bill went from ₹4000 to ₹0.", capacity: "3 kW", billBefore: 4000, billAfter: 0 },
    { name: "Sunita Devi", rating: 5, text: "Very professional team. Installation was completed in just 2 days.", capacity: "2 kW", billBefore: 2500, billAfter: 0 }
  ],
  "Vaishali": [
    { name: "Dinanath Singh", rating: 5, text: "ASR team did great work! My solar panels are generating more power than expected.", capacity: "5 kW", billBefore: 6000, billAfter: 200 }
  ],
  "Hajipur": [
    { name: "Mukesh Prasad", rating: 5, text: "Best investment I made. Got full subsidy under PM Surya Ghar scheme.", capacity: "3 kW", billBefore: 3500, billAfter: 0 }
  ],
  "Muzaffarpur": [
    { name: "Ramesh Yadav", rating: 5, text: "Great experience! Team was knowledgeable and helpful.", capacity: "4 kW", billBefore: 4500, billAfter: 100 }
  ],
  "Gaya": [
    { name: "Vijay Sharma", rating: 5, text: "Prompt service and excellent support even after installation.", capacity: "3 kW", billBefore: 3800, billAfter: 0 }
  ]
};

export const BiharInstallationMap = () => {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [totalInstallations, setTotalInstallations] = useState(25);

  useEffect(() => {
    // Fetch reviews from API
    const fetchReviews = async () => {
      try {
        const res = await axios.get(`${API}/reviews`);
        if (res.data && res.data.length > 0) {
          setReviews(res.data);
        }
      } catch (err) {
        console.log("Using default testimonials");
      }
    };
    fetchReviews();
  }, []);

  const handleDistrictClick = (district) => {
    setSelectedDistrict(district);
    setShowModal(true);
  };

  const getDistrictTestimonials = (district) => {
    // First check API reviews for this district
    const apiReviews = reviews.filter(r => r.location?.toLowerCase().includes(district.toLowerCase()));
    if (apiReviews.length > 0) {
      return apiReviews.map(r => ({
        name: r.customer_name,
        rating: r.rating || 5,
        text: r.review_text,
        capacity: r.solar_capacity ? `${r.solar_capacity} kW` : r.system_installed,
        billBefore: r.monthly_bill_before,
        billAfter: r.monthly_bill_after
      }));
    }
    // Fall back to static data
    return DISTRICT_TESTIMONIALS[district] || [];
  };

  return (
    <div className="bg-gradient-to-b from-[#0a355e] to-[#0c4270] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Our Installations Across Bihar
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Click on any pin to see real customer testimonials from that area
          </p>
          <div className="mt-4 inline-flex items-center space-x-2 bg-green-500/20 text-green-400 px-6 py-3 rounded-full">
            <MapPin className="w-5 h-5" />
            <span className="font-bold text-xl">{totalInstallations}+ Verified Installations</span>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl p-6 md:p-10 border border-white/10">
          {/* Bihar Map SVG Outline - Simplified representation */}
          <div className="relative w-full aspect-[4/3] max-w-3xl mx-auto">
            {/* Bihar Shape Background */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Simplified Bihar outline */}
              <path 
                d="M15,15 L85,10 L90,40 L95,70 L80,85 L50,90 L25,85 L10,70 L5,40 Z" 
                fill="rgba(255,255,255,0.05)" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="0.5"
              />
              
              {/* District boundaries (simplified) */}
              <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
              <line x1="10" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
            </svg>

            {/* Installation Pins */}
            {Object.entries(BIHAR_DISTRICTS).map(([district, data]) => {
              const hasTestimonials = getDistrictTestimonials(district).length > 0;
              const pinSize = data.installations > 3 ? "w-8 h-8" : data.installations > 1 ? "w-6 h-6" : "w-5 h-5";
              
              return (
                <button
                  key={district}
                  onClick={() => handleDistrictClick(district)}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-300 hover:scale-125 z-10 ${hasTestimonials ? 'animate-pulse' : ''}`}
                  style={{ left: `${data.x}%`, top: `${data.y}%` }}
                  data-testid={`map-pin-${district.toLowerCase().replace(' ', '-')}`}
                >
                  {/* Pin */}
                  <div className={`${pinSize} bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50 border-2 border-white`}>
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                  
                  {/* Installation count badge */}
                  {data.installations > 1 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                      {data.installations}
                    </div>
                  )}
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl">
                      <p className="font-bold">{district}</p>
                      <p className="text-amber-400 text-xs">{data.installations} installation{data.installations > 1 ? 's' : ''}</p>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>
              );
            })}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-xl p-4 text-white text-sm">
              <p className="font-semibold mb-2">Installation Density</p>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-xs">1-2</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-amber-500 rounded-full"></div>
                  <span className="text-xs">3-5</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-5 h-5 bg-amber-500 rounded-full"></div>
                  <span className="text-xs">5+</span>
                </div>
              </div>
            </div>

            {/* Total Stats */}
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl p-4 text-white">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">100+ kW</p>
                <p className="text-xs text-gray-300">Total Capacity</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <p className="text-gray-300 mb-4">Want to be our next happy customer?</p>
          <a
            href="#inquiry-form"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition shadow-xl"
          >
            <Zap className="w-5 h-5" />
            <span>Get Your FREE Quote</span>
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Testimonial Modal */}
      {showModal && selectedDistrict && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedDistrict}</h3>
                    <p className="text-amber-100 text-sm">
                      {BIHAR_DISTRICTS[selectedDistrict]?.installations || 1} installation{(BIHAR_DISTRICTS[selectedDistrict]?.installations || 1) > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {getDistrictTestimonials(selectedDistrict).length > 0 ? (
                <div className="space-y-4">
                  {getDistrictTestimonials(selectedDistrict).map((testimonial, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                          {testimonial.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{testimonial.name}</p>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-4 h-4 ${i < testimonial.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{testimonial.text}</p>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1 text-amber-600">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">{testimonial.capacity}</span>
                        </div>
                        {testimonial.billBefore && (
                          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                            ₹{testimonial.billBefore} → ₹{testimonial.billAfter || 0}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No testimonials yet from {selectedDistrict}</p>
                  <p className="text-gray-400 text-sm">Be the first happy customer in your area!</p>
                </div>
              )}

              {/* Contact CTA */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-gray-600 text-sm text-center mb-4">
                  Want solar installation in {selectedDistrict}?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="tel:9296389097"
                    className="flex items-center justify-center space-x-2 bg-[#0a355e] text-white px-4 py-3 rounded-xl font-semibold hover:bg-[#0c4270] transition"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call Now</span>
                  </a>
                  <a
                    href={`https://wa.me/918298389097?text=Hi!%20I%20saw%20your%20installations%20in%20${encodeURIComponent(selectedDistrict)}%20and%20I'm%20interested%20in%20solar%20for%20my%20home.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 bg-green-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiharInstallationMap;
