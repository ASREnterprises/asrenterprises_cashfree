import { useState, useEffect, useRef } from "react";
import { X, Sun, Zap, Phone, Send, Loader2, CheckCircle, Gift, Clock } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Bihar Districts for dropdown
const BIHAR_DISTRICTS = [
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
  "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
  "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
  "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
  "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
  "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
];

export const LeadCapturePopup = ({ 
  inactivityTimeout = 30000, // 30 seconds default
  onClose,
  showOnExit = true 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    district: "",
    monthly_bill: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const inactivityTimer = useRef(null);
  const hasShown = useRef(false);
  const lastActivity = useRef(Date.now());

  // Check if popup was already shown in this session
  useEffect(() => {
    const popupShown = sessionStorage.getItem('leadPopupShown');
    if (popupShown) {
      hasShown.current = true;
    }
  }, []);

  // Reset inactivity timer on user activity
  const resetTimer = () => {
    lastActivity.current = Date.now();
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    // Only set new timer if popup hasn't been shown
    if (!hasShown.current && !isVisible) {
      inactivityTimer.current = setTimeout(() => {
        triggerPopup('inactivity');
      }, inactivityTimeout);
    }
  };

  // Trigger popup with tracking
  const triggerPopup = (trigger) => {
    if (hasShown.current) return;
    
    hasShown.current = true;
    sessionStorage.setItem('leadPopupShown', 'true');
    setIsVisible(true);
    
    // Track popup trigger
    console.log(`Lead popup triggered by: ${trigger}`);
  };

  // Handle exit intent (mouse leaving viewport)
  const handleMouseLeave = (e) => {
    if (e.clientY < 10 && showOnExit && !hasShown.current) {
      triggerPopup('exit_intent');
    }
  };

  useEffect(() => {
    // Set up activity listeners
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Exit intent detection
    if (showOnExit) {
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    // Start initial timer
    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      if (showOnExit) {
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [inactivityTimeout, showOnExit]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      setError("Please enter your name and phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(`${API}/secure-lead`, {
        name: formData.name,
        phone: formData.phone,
        district: formData.district,
        monthly_bill: formData.monthly_bill ? parseFloat(formData.monthly_bill) : null,
        property_type: "residential",
        source: "popup_inactivity",
        recaptcha_token: ""
      });
      
      setSuccess(true);
      
      // Close popup after delay
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please call us at 9296389097");
    }
    
    setLoading(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden transform animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 text-white relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition"
            data-testid="popup-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <div className="flex items-center space-x-2 mb-2">
              <Gift className="w-6 h-6 text-amber-200" />
              <span className="text-amber-100 text-sm font-medium">Limited Time Offer</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Wait! Don't Miss Out</h2>
            <p className="text-amber-100">
              Get <strong className="text-white">₹78,000 Government Subsidy</strong> on solar installation!
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Thank You!</h3>
              <p className="text-gray-600">Our team will call you within 2 hours.</p>
              <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                <span>9 AM - 6 PM, Mon-Sat</span>
              </div>
            </div>
          ) : (
            <>
              {/* Value proposition */}
              <div className="flex items-center space-x-4 mb-6 p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">FREE Site Survey Worth ₹2,000</p>
                  <p className="text-sm text-gray-600">+ Detailed savings report</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name *"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                    data-testid="popup-name-input"
                  />
                </div>
                
                <div>
                  <input
                    type="tel"
                    placeholder="Mobile Number *"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                    data-testid="popup-phone-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition text-gray-700"
                    data-testid="popup-district-select"
                  >
                    <option value="">District</option>
                    {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  
                  <input
                    type="number"
                    placeholder="Monthly Bill ₹"
                    value={formData.monthly_bill}
                    onChange={(e) => setFormData({...formData, monthly_bill: e.target.value})}
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                    data-testid="popup-bill-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg"
                  data-testid="popup-submit-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-5 h-5" />
                      <span>Claim FREE Survey</span>
                    </>
                  )}
                </button>
              </form>

              {/* Trust indicators */}
              <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  MNRE Registered
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  No Spam Calls
                </span>
              </div>

              {/* Alternative CTA */}
              <div className="mt-4 text-center">
                <p className="text-gray-500 text-sm mb-2">Prefer to call?</p>
                <a 
                  href="tel:9296389097" 
                  className="inline-flex items-center space-x-2 text-amber-600 font-semibold hover:text-amber-700"
                >
                  <Phone className="w-4 h-4" />
                  <span>9296389097</span>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadCapturePopup;
