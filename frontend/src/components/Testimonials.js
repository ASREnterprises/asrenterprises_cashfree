import { useState, useEffect } from "react";
import { Star, MapPin, Zap, Quote } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const TestimonialsSection = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await axios.get(`${API}/reviews`);
        setReviews(res.data || []);
      } catch (err) {
        console.error("Failed to fetch reviews");
      }
      setLoading(false);
    };
    fetchReviews();
  }, []);

  if (loading) return null;
  if (reviews.length === 0) return null;

  return (
    <div className="bg-[#0d1b33] py-16" data-testid="testimonials-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-3">What Our Customers Say</h2>
          <p className="text-lg text-gray-400">Real reviews from happy solar customers across Bihar</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.slice(0, 6).map((review) => (
            <div key={review.id} className="bg-gray-800/70 rounded-xl p-6 border border-gray-700/50 hover:border-amber-500/30 transition-all" data-testid={`review-${review.id}`}>
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
                <div className="flex items-center text-amber-400 text-xs mt-3 pt-3 border-t border-gray-700/50">
                  <Zap className="w-3 h-3 mr-1" />
                  <span>{review.solar_capacity ? `${review.solar_capacity} kW System` : review.system_installed}</span>
                  {review.monthly_bill_before && (
                    <span className="ml-2 text-green-400">| Bill: ₹{review.monthly_bill_before} → ₹{review.monthly_bill_after || '0'}</span>
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
