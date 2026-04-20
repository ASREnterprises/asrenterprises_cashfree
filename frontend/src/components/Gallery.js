import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight, X, Play, MapPin, Calendar, Award, Loader2, RefreshCw, Facebook, Star, Zap, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Cache reviews in memory
let reviewsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Testimonials Section Component (moved from homepage)
const CustomerTestimonials = () => {
  const [reviews, setReviews] = useState(reviewsCache || []);
  const [loading, setLoading] = useState(!reviewsCache);

  useEffect(() => {
    const fetchReviews = async () => {
      if (reviewsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        setReviews(reviewsCache);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${API}/reviews`);
        const data = res.data || [];
        reviewsCache = data;
        cacheTimestamp = Date.now();
        setReviews(data);
      } catch (err) {
        console.error("Failed to fetch reviews");
      }
      setLoading(false);
    };
    fetchReviews();
  }, []);

  const displayedReviews = reviews.slice(0, 6);

  if (loading) {
    return (
      <div className="bg-[#0d1b33] py-16">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }
  
  if (reviews.length === 0) return null;

  return (
    <div className="bg-[#0d1b33] py-16" data-testid="customer-testimonials-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-3">Customer Testimonials</h2>
          <p className="text-lg text-gray-400">Real reviews from happy solar customers across Bihar</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedReviews.map((review) => (
            <div key={review.id} className="bg-gray-800/70 rounded-xl p-6 border border-gray-700/50 hover:border-amber-500/50 transition-all group relative overflow-hidden" data-testid={`testimonial-${review.id}`}>
              {review.monthly_bill_before && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 to-emerald-900/95 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-10">
                  <div className="text-center p-6">
                    <p className="text-white/80 text-sm mb-4">Electricity Bill Transformation</p>
                    <div className="flex items-center justify-center space-x-6">
                      <div className="text-center">
                        <p className="text-red-400 text-xs mb-1">BEFORE Solar</p>
                        <p className="text-3xl font-bold text-red-400">₹{review.monthly_bill_before}</p>
                        <p className="text-red-300/70 text-xs">/month</p>
                      </div>
                      <div className="text-4xl text-white">→</div>
                      <div className="text-center">
                        <p className="text-green-400 text-xs mb-1">AFTER Solar</p>
                        <p className="text-3xl font-bold text-green-400">₹{review.monthly_bill_after || '0'}</p>
                        <p className="text-green-300/70 text-xs">/month</p>
                      </div>
                    </div>
                    <div className="mt-4 bg-white/10 rounded-lg px-4 py-2 inline-block">
                      <p className="text-amber-400 font-bold">Saving ₹{(parseInt(review.monthly_bill_before) - parseInt(review.monthly_bill_after || 0)).toLocaleString()}/month</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {review.customer_name?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{review.customer_name}</h4>
                    <div className="flex items-center text-gray-400 text-sm">
                      <MapPin className="w-3 h-3 mr-1" />
                      <span>{review.location}</span>
                    </div>
                  </div>
                </div>
                <Quote className="w-6 h-6 text-amber-500/40" />
              </div>
              
              <div className="flex items-center mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < (review.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                ))}
                {review.verified && <span className="ml-2 text-green-400 text-xs font-medium">Verified</span>}
              </div>
              
              <p className="text-gray-300 text-sm leading-relaxed mb-3">{review.review_text}</p>
              
              {(review.solar_capacity || review.system_installed) && (
                <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-gray-700/50">
                  <div className="flex items-center text-amber-400">
                    <Zap className="w-3 h-3 mr-1" />
                    <span>{review.solar_capacity ? `${review.solar_capacity} kW System` : review.system_installed}</span>
                  </div>
                  {review.monthly_bill_before && (
                    <span className="text-green-400 bg-green-900/30 px-2 py-1 rounded cursor-pointer">
                      Hover to see savings
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="text-center mt-10">
          <a href="https://www.google.com/search?q=ASR+Enterprises+Patna+Solar&hl=en#lrd=local" target="_blank" rel="noopener noreferrer" 
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition" data-testid="review-google-btn">
            <Star className="w-5 h-5" />
            <span>Review Us on Google</span>
          </a>
        </div>
      </div>
    </div>
  );
};

// Lazy loading image component
const LazyImage = ({ src, alt, className, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className}`} onClick={onClick}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
};

export const GalleryPage = () => {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [dynamicPhotos, setDynamicPhotos] = useState([]);
  const [facebookPhotos, setFacebookPhotos] = useState([]); // Facebook general posts
  const [latestWorkPhotos, setLatestWorkPhotos] = useState([]); // Admin-selected installation work
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('facebook'); // 'facebook' = Latest Installation Work, 'all' = Facebook Posts

  // Static gallery items (original photos)
  const staticGalleryItems = [
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
    fetchAllGalleryPhotos();
  }, []);

  const fetchAllGalleryPhotos = async () => {
    setLoading(true);
    try {
      // Fetch CRM photos, Facebook general posts, and admin-selected latest work in parallel
      const [crmRes, fbRes, latestRes] = await Promise.all([
        axios.get(`${API}/photos`).catch(() => ({ data: [] })),
        axios.get(`${API}/social/gallery/public?type=gallery&limit=50`).catch(() => ({ data: { items: [] } })),
        axios.get(`${API}/social/gallery/public?type=latest_work&limit=50`).catch(() => ({ data: { items: [] } }))
      ]);
      
      // Convert CRM photos to gallery format
      const crmPhotos = (crmRes.data || []).map(photo => ({
        type: "image",
        url: photo.image_url || photo.imageUrl,
        title: photo.title,
        location: photo.location || "Bihar, India",
        date: photo.timestamp ? new Date(photo.timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : undefined,
        systemSize: photo.system_size,
        source: "upload"
      }));
      setDynamicPhotos(crmPhotos);
      
      // Convert Facebook general posts to gallery format
      const fbPhotos = (fbRes.data?.items || []).map(item => ({
        type: item.media_type === 'video' ? 'video' : 'image',
        url: item.media_url,
        thumbnail: item.media_url,
        title: item.title || item.caption?.substring(0, 60) || "Facebook Post",
        location: item.location || "Bihar, India",
        date: item.created_time ? new Date(item.created_time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : undefined,
        permalink: item.permalink_url,
        source: "facebook"
      }));
      setFacebookPhotos(fbPhotos);
      
      // Convert admin-selected latest work posts to gallery format
      const latestPhotos = (latestRes.data?.items || []).map(item => ({
        type: item.media_type === 'video' ? 'video' : 'image',
        url: item.media_url,
        thumbnail: item.media_url,
        title: item.title || item.caption?.substring(0, 60) || "Solar Installation",
        location: item.location || "Bihar, India",
        date: item.created_time ? new Date(item.created_time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : undefined,
        permalink: item.permalink_url,
        source: "latest_work"
      }));
      setLatestWorkPhotos(latestPhotos);
    } catch (err) {
      console.error("Error fetching gallery photos:", err);
    }
    setLoading(false);
  };

  const fetchGalleryPhotos = fetchAllGalleryPhotos; // Alias for backward compatibility

  // Combine and filter gallery items based on active filter
  const getFilteredItems = () => {
    if (activeFilter === 'uploads') {
      return [...dynamicPhotos, ...staticGalleryItems];
    } else if (activeFilter === 'facebook') {
      // Latest Installation Work - admin selected posts
      return latestWorkPhotos;
    }
    // 'all' - Facebook Posts (general posts only)
    return facebookPhotos;
  };
  
  const galleryItems = getFilteredItems();

  const openModal = (item) => {
    setSelectedMedia(item);
  };

  const closeModal = () => {
    setSelectedMedia(null);
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header - Premium Solar Corporate Theme */}
      <div className="bg-white/95 backdrop-blur-md shadow-lg border-b border-[#0B3C5D]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-[#F5A623] hover:text-[#FFD166] mb-4 font-medium transition">
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
            <h1 className="text-5xl font-extrabold text-[#0B3C5D] mb-4 font-[Poppins]">
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] to-[#FFD166]">Solar Projects</span>
            </h1>
            <p className="text-xl text-gray-600 mb-2">Transforming Bihar with Clean Energy Solutions</p>
            <div className="flex items-center justify-center space-x-2 text-[#F5A623]">
              <Award className="w-5 h-5" />
              <span className="font-semibold">Follow us: @asr_enterprises_patna</span>
            </div>
            <div className="text-gray-500 text-sm mt-2">
              <a href="tel:9296389097" className="hover:text-[#00C389] transition">9296389097</a>
              <span className="mx-2">|</span>
              <a href="mailto:support@asrenterprises.in" className="hover:text-[#00C389] transition">support@asrenterprises.in</a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Banner - Premium Gold & Green Gradient */}
      <div className="py-8 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #F5A623 0%, #FFD166 30%, #00C389 100%)'
      }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.2) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[#071A2E] text-center">
            <div>
              <div className="text-4xl font-bold mb-1">25+</div>
              <div className="text-[#071A2E]/70 text-sm">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">100kW+</div>
              <div className="text-[#071A2E]/70 text-sm">Total Capacity</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">MNRE</div>
              <div className="text-[#071A2E]/70 text-sm">Registered Vendor</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-1">5 Star</div>
              <div className="text-[#071A2E]/70 text-sm">Rated Service</div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Filter Buttons and Refresh */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-xl p-1">
            <button 
              onClick={() => setActiveFilter('facebook')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                activeFilter === 'facebook' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-blue-600'
              }`}
              data-testid="filter-facebook-btn"
            >
              <Zap className="w-4 h-4" />
              Latest Installation Work ({latestWorkPhotos.length})
            </button>
            <button 
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                activeFilter === 'all' 
                  ? 'bg-white text-[#1877F2] shadow-sm' 
                  : 'text-gray-600 hover:text-[#1877F2]'
              }`}
              data-testid="filter-all-btn"
            >
              <Facebook className="w-4 h-4" />
              Facebook Posts ({facebookPhotos.length})
            </button>
          </div>

          {/* Refresh Button */}
          <button 
            onClick={fetchGalleryPhotos} 
            className="flex items-center space-x-2 text-gray-500 hover:text-[#F5A623] transition"
            disabled={loading}
            data-testid="refresh-gallery-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Context notice per tab */}
        {activeFilter === 'facebook' && latestWorkPhotos.length > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">
              Showing our latest <strong>solar installation projects</strong> from across Bihar.
            </p>
          </div>
        )}
        {activeFilter === 'all' && facebookPhotos.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <Facebook className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Showing latest posts from our <strong>Facebook Page</strong>. Follow us for more updates!
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#F5A623] animate-spin" />
          </div>
        ) : galleryItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No projects to display in this category.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((item, index) => (
              <div
                key={`${item.source || 'static'}-${index}`}
                className="premium-card relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 bg-white"
                onClick={() => openModal(item)}
                data-testid={`gallery-item-${index}`}
              >
                {/* Image/Video Thumbnail */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#F0F6FF]">
                  <img
                    src={item.type === "video" ? item.thumbnail : item.url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Solar+Installation'; }}
                  />
                  
                  {/* Facebook Source Badge */}
                  {item.source === 'facebook' && (
                    <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Facebook className="w-3 h-3" />
                      <span>Facebook</span>
                    </div>
                  )}
                  
                  {/* Play button for video */}
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                      <div className="bg-white rounded-full p-4 group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="w-8 h-8 text-[#F5A623]" fill="currentColor" />
                      </div>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071A2E] via-transparent to-transparent opacity-60"></div>
                  
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
                      <div className="text-xs text-[#FFD166] mt-1 font-semibold">
                        System: {item.systemSize}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section - Premium Dark Theme */}
        <div className="mt-16 rounded-3xl shadow-2xl p-8 md:p-12 text-center relative overflow-hidden" style={{
          background: 'radial-gradient(ellipse at 50% 0%, #0B3C5D 0%, #071A2E 100%)'
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-4 font-[Poppins]">Ready to Go Solar?</h2>
            <p className="text-xl text-gray-300 mb-8">Join hundreds of satisfied customers in Bihar who have switched to clean energy</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/#inquiry-form"
                className="btn-cta-green bg-[#00C389] text-white px-8 py-4 rounded-full font-bold hover:bg-[#00A372] transition shadow-lg hover:shadow-[0_0_20px_rgba(0,195,137,0.4)]"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/#inquiry-form';
                }}
              >
                Get Free Consultation
              </Link>
              <Link
                to="/contact"
                className="bg-transparent text-white border-2 border-white/30 px-8 py-4 rounded-full font-bold hover:bg-white/10 transition shadow-md"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Testimonials Section (moved from homepage) */}
      <CustomerTestimonials />

      {/* Modal - Premium Styling */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-[#071A2E]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-[#F5A623] transition bg-black/50 rounded-full p-2"
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
                className="w-full rounded-2xl shadow-2xl"
                data-testid="modal-video"
              >
                <source src={selectedMedia.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.title}
                className="w-full rounded-2xl shadow-2xl"
                data-testid="modal-image"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/800x600?text=Solar+Installation'; }}
              />
            )}

            {/* Image Info - Premium Card */}
            <div className="bg-white rounded-2xl p-6 mt-4 border border-gray-100 shadow-xl">
              <h3 className="text-2xl font-bold text-[#0B3C5D] mb-2 font-[Poppins]">{selectedMedia.title}</h3>
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2 text-[#00C389]" />
                <span>{selectedMedia.location}</span>
              </div>
              {selectedMedia.date && (
                <div className="flex items-center text-gray-600 mb-2">
                  <Calendar className="w-5 h-5 mr-2 text-[#00C389]" />
                  <span>{selectedMedia.date}</span>
                </div>
              )}
              {selectedMedia.systemSize && (
                <div className="text-[#F5A623] font-semibold">
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
