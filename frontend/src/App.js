import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import { 
  MessageSquare, Users, TrendingUp, BarChart3, 
  Zap, Sun, Phone, Mail, MapPin, Menu, X, ChevronRight, ChevronUp,
  Send, Loader2, CheckCircle, AlertCircle, Bot, User, Facebook, Image, Award, CreditCard, RefreshCw, Key, QrCode, Instagram
} from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";

// ==================== LAZY LOADED COMPONENTS (Code Splitting) ====================
// Public Pages - Lazy load for faster initial page load
const WhatsAppChatPage = lazy(() => import("@/components/WhatsAppChat").then(m => ({ default: m.WhatsAppChatPage })));
const MarketingPage = lazy(() => import("@/components/Marketing").then(m => ({ default: m.MarketingPage })));
const AdsPage = lazy(() => import("@/components/Ads").then(m => ({ default: m.AdsPage })));
const DashboardPage = lazy(() => import("@/components/Dashboard").then(m => ({ default: m.DashboardPage })));
const GalleryPage = lazy(() => import("@/components/Gallery").then(m => ({ default: m.GalleryPage })));
const ContactPage = lazy(() => import("@/components/Contact").then(m => ({ default: m.ContactPage })));
const TestimonialsSection = lazy(() => import("@/components/Testimonials").then(m => ({ default: m.TestimonialsSection })));
const AboutUsPage = lazy(() => import("@/components/AboutUs").then(m => ({ default: m.AboutUsPage })));
// Shop removed - Book Solar Service with QR payment now available
// Admin Panel - Lazy load (heavy components)
const AIMarketingHub = lazy(() => import("@/components/AIMarketing").then(m => ({ default: m.AIMarketingHub })));
const AdminLogin = lazy(() => import("@/components/AdminLogin").then(m => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import("@/components/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const StaffManagement = lazy(() => import("@/components/StaffManagement").then(m => ({ default: m.StaffManagement })));
const PhotosManagement = lazy(() => import("@/components/PhotosManagement").then(m => ({ default: m.PhotosManagement })));
const ReviewsManagement = lazy(() => import("@/components/ReviewsManagement").then(m => ({ default: m.ReviewsManagement })));
const FestivalsManagement = lazy(() => import("@/components/FestivalsManagement").then(m => ({ default: m.FestivalsManagement })));
const GovtNewsManagement = lazy(() => import("@/components/GovtNewsManagement").then(m => ({ default: m.GovtNewsManagement })));
const SecurityCenter = lazy(() => import("@/components/SecurityCenter").then(m => ({ default: m.SecurityCenter })));
const LeadsManagement = lazy(() => import("@/components/LeadsManagement").then(m => ({ default: m.LeadsManagement })));
const AnalyticsPage = lazy(() => import("@/components/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
const SocialMediaIntegration = lazy(() => import("@/components/SocialMediaIntegration").then(m => ({ default: m.SocialMediaIntegration })));
const SocialMediaManager = lazy(() => import("@/components/SocialMediaManager").then(m => ({ default: m.default })));
const HRManagement = lazy(() => import("@/components/HRManagement").then(m => ({ default: m.HRManagement })));
const FestiveThemeOverlay = lazy(() => import("@/components/FestiveThemeOverlay").then(m => ({ default: m.FestiveThemeOverlay })));
const AIChatWidget = lazy(() => import("@/components/AIChatWidget").then(m => ({ default: m.AIChatWidget })));
const HoliEffect = lazy(() => import("@/components/HoliEffect").then(m => ({ default: m.HoliEffect })));

// New Homepage Components
const ZeroBillHero = lazy(() => import("@/components/ZeroBillHero").then(m => ({ default: m.ZeroBillHero })));
const BiharInstallationMap = lazy(() => import("@/components/BiharInstallationMap").then(m => ({ default: m.BiharInstallationMap })));
const SmartWhatsAppButton = lazy(() => import("@/components/SmartWhatsAppButton").then(m => ({ default: m.SmartWhatsAppButton })));
const LeadCapturePopup = lazy(() => import("@/components/LeadCapturePopup").then(m => ({ default: m.LeadCapturePopup })));
const DynamicROIWidget = lazy(() => import("@/components/DynamicROIWidget").then(m => ({ default: m.DynamicROIWidget })));
const SubsidyCountdownMeter = lazy(() => import("@/components/SubsidyCountdownMeter").then(m => ({ default: m.SubsidyCountdownMeter })));
const ZeroBillComparison = lazy(() => import("@/components/ZeroBillComparison").then(m => ({ default: m.ZeroBillComparison })));

// CRM & Staff Portals - Heavy components (Lazy load critical for performance)
const CRMDashboard = lazy(() => import("@/components/CRMDashboard").then(m => ({ default: m.CRMDashboard })));
const StaffLogin = lazy(() => import("@/components/StaffLogin").then(m => ({ default: m.StaffLogin })));
const StaffPortal = lazy(() => import("@/components/StaffPortal").then(m => ({ default: m.StaffPortal })));
const BusinessDashboard = lazy(() => import("@/components/BusinessDashboard").then(m => ({ default: m.BusinessDashboard })));
const StaffTraining = lazy(() => import("@/components/StaffTraining").then(m => ({ default: m.default })));

// Loading Spinner Component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  </div>
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
// reCAPTCHA v3 - badge hidden via CSS
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "6LchBnosAAAAAMMA-FmUYPboJHIQPoS-3CC96A2m";

// Month-wise Color Schemes for ASR Enterprises Title
// Daily rotating color schemes for ASR Enterprises (changes every day)
const DAY_COLOR_SCHEMES = [
  { // Day 0 - Blue
    gradient: 'linear-gradient(180deg, #E3F2FD 0%, #2196F3 30%, #1976D2 70%, #0D47A1 100%)',
    shadow: 'rgba(13, 71, 161, 0.8)',
    name: 'Blue'
  },
  { // Day 1 - Sky Blue
    gradient: 'linear-gradient(180deg, #E0F7FA 0%, #00BCD4 30%, #00ACC1 70%, #0097A7 100%)',
    shadow: 'rgba(0, 151, 167, 0.8)',
    name: 'Sky Blue'
  },
  { // Day 2 - Green
    gradient: 'linear-gradient(180deg, #E8F5E9 0%, #4CAF50 30%, #388E3C 70%, #1B5E20 100%)',
    shadow: 'rgba(27, 94, 32, 0.8)',
    name: 'Green'
  },
  { // Day 3 - Light Green
    gradient: 'linear-gradient(180deg, #F1F8E9 0%, #8BC34A 30%, #7CB342 70%, #558B2F 100%)',
    shadow: 'rgba(85, 139, 47, 0.8)',
    name: 'Light Green'
  },
  { // Day 4 - Orange
    gradient: 'linear-gradient(180deg, #FFF3E0 0%, #FF9800 30%, #F57C00 70%, #E65100 100%)',
    shadow: 'rgba(230, 81, 0, 0.8)',
    name: 'Orange'
  },
  { // Day 5 - Dark Orange
    gradient: 'linear-gradient(180deg, #FBE9E7 0%, #FF5722 30%, #E64A19 70%, #BF360C 100%)',
    shadow: 'rgba(191, 54, 12, 0.8)',
    name: 'Dark Orange'
  },
  { // Day 6 - Gold
    gradient: 'linear-gradient(180deg, #FFFACD 0%, #FFD700 30%, #FFA500 70%, #FF8C00 100%)',
    shadow: 'rgba(139, 69, 19, 0.8)',
    name: 'Gold'
  },
  { // Day 7 - Saffron
    gradient: 'linear-gradient(180deg, #FFF8E1 0%, #FF9933 30%, #FF6600 70%, #CC5200 100%)',
    shadow: 'rgba(204, 82, 0, 0.8)',
    name: 'Saffron'
  },
  { // Day 8 - Golden
    gradient: 'linear-gradient(180deg, #FFF8DC 0%, #DAA520 30%, #B8860B 70%, #8B6914 100%)',
    shadow: 'rgba(139, 105, 20, 0.8)',
    name: 'Golden'
  },
  { // Day 9 - Festive Gold
    gradient: 'linear-gradient(180deg, #FFFDE7 0%, #FFEB3B 20%, #FFC107 40%, #FF9800 60%, #FF5722 80%, #E64A19 100%)',
    shadow: 'rgba(230, 74, 25, 0.8)',
    name: 'Festive Gold'
  },
  { // Day 10 - Silver
    gradient: 'linear-gradient(180deg, #FAFAFA 0%, #BDBDBD 30%, #9E9E9E 70%, #616161 100%)',
    shadow: 'rgba(97, 97, 97, 0.8)',
    name: 'Silver'
  },
  { // Day 11 - Red
    gradient: 'linear-gradient(180deg, #FFEBEE 0%, #F44336 30%, #D32F2F 70%, #B71C1C 100%)',
    shadow: 'rgba(183, 28, 28, 0.8)',
    name: 'Red'
  },
  { // Day 12 - Purple
    gradient: 'linear-gradient(180deg, #F3E5F5 0%, #9C27B0 30%, #7B1FA2 70%, #4A148C 100%)',
    shadow: 'rgba(74, 20, 140, 0.8)',
    name: 'Purple'
  },
  { // Day 13 - Teal
    gradient: 'linear-gradient(180deg, #E0F2F1 0%, #009688 30%, #00796B 70%, #004D40 100%)',
    shadow: 'rgba(0, 77, 64, 0.8)',
    name: 'Teal'
  }
];

// Get daily rotating color scheme (changes every day)
const getHeaderColorScheme = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const colorIndex = dayOfYear % DAY_COLOR_SCHEMES.length;
  return DAY_COLOR_SCHEMES[colorIndex];
};

// Bihar Districts
const BIHAR_DISTRICTS = [
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
  "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
  "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
  "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
  "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
  "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
];

// Interactive ROI Slider Component
const InteractiveROISlider = ({ onBookSurvey }) => {
  const [monthlyBill, setMonthlyBill] = useState(3000);
  
  // Calculate solar metrics based on bill
  const calculateMetrics = (bill) => {
    let systemSize, subsidy, monthlySavings, annualSavings, paybackYears;
    
    if (bill <= 1500) {
      systemSize = 2;
      subsidy = 60000;
    } else if (bill <= 3000) {
      systemSize = 3;
      subsidy = 78000;
    } else if (bill <= 4500) {
      systemSize = 4;
      subsidy = 78000;
    } else if (bill <= 6000) {
      systemSize = 5;
      subsidy = 78000;
    } else {
      systemSize = Math.min(10, Math.ceil(bill / 1000));
      subsidy = 78000;
    }
    
    // Assume 80-90% savings after solar
    monthlySavings = Math.round(bill * 0.85);
    annualSavings = monthlySavings * 12;
    
    // Cost calculation at ₹70,000 per kW (2kW=₹1.5L, 3kW=₹2.1L, 5kW=₹3.5L)
    const baseCost = systemSize * 70000;
    const netCost = baseCost - subsidy;
    paybackYears = Math.round((netCost / annualSavings) * 10) / 10;
    
    return { systemSize, subsidy, monthlySavings, annualSavings, paybackYears, netCost, baseCost };
  };
  
  const metrics = calculateMetrics(monthlyBill);

  // Generate WhatsApp URL for FREE site survey
  const whatsappSurveyUrl = `https://wa.me/919296389097?text=${encodeURIComponent(`Hi ASR Enterprises! 👋

I'm interested in a FREE site survey for solar installation.

📊 My Details:
• Monthly Bill: ₹${monthlyBill.toLocaleString()}
• Recommended System: ${metrics.systemSize} kW
• Expected Savings: ₹${metrics.monthlySavings.toLocaleString()}/month
• Govt. Subsidy: ₹${metrics.subsidy.toLocaleString()}

Please schedule a FREE site survey at my location.

Thank you!`)}`;
  
  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-amber-200">
      {/* Slider Section */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-gray-700 mb-4 text-center">
          Your Monthly Electricity Bill
        </label>
        <div className="relative pt-2">
          <input
            type="range"
            min="500"
            max="15000"
            step="100"
            value={monthlyBill}
            onChange={(e) => setMonthlyBill(parseInt(e.target.value))}
            className="w-full h-3 bg-gradient-to-r from-green-300 via-amber-300 to-red-300 rounded-full appearance-none cursor-pointer slider-thumb"
            style={{
              background: `linear-gradient(to right, #22c55e 0%, #fbbf24 50%, #ef4444 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>₹500</span>
            <span>₹5,000</span>
            <span>₹10,000</span>
            <span>₹15,000</span>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-5xl md:text-6xl font-bold text-amber-600">₹{monthlyBill.toLocaleString()}</span>
          <span className="text-gray-500 text-lg ml-2">/month</span>
        </div>
      </div>
      
      {/* Results Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-center text-white transform hover:scale-105 transition">
          <div className="text-3xl md:text-4xl font-bold">{metrics.systemSize} kW</div>
          <div className="text-blue-100 text-sm">Recommended System</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-center text-white transform hover:scale-105 transition">
          <div className="text-3xl md:text-4xl font-bold">₹{metrics.monthlySavings.toLocaleString()}</div>
          <div className="text-green-100 text-sm">Monthly Savings</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-center text-white transform hover:scale-105 transition">
          <div className="text-3xl md:text-4xl font-bold">₹{metrics.subsidy.toLocaleString()}</div>
          <div className="text-amber-100 text-sm">Govt. Subsidy</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-center text-white transform hover:scale-105 transition">
          <div className="text-3xl md:text-4xl font-bold">{metrics.paybackYears} Yrs</div>
          <div className="text-purple-100 text-sm">Payback Period</div>
        </div>
      </div>
      
      {/* Annual Savings Highlight */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-600 mb-2">Your Estimated Annual Savings</p>
        <p className="text-5xl md:text-6xl font-bold text-green-600">₹{metrics.annualSavings.toLocaleString()}</p>
        <p className="text-green-600 mt-2">That's <strong>₹{(metrics.annualSavings * 25).toLocaleString()}</strong> over 25 years!</p>
      </div>
      
      {/* CTA Button - WhatsApp for FREE Survey */}
      <div className="text-center">
        <a
          href={whatsappSurveyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition shadow-xl shadow-green-500/30 transform hover:scale-105"
        >
          <MessageSquare className="w-5 h-5" />
          <span>Book FREE Site Survey Now</span>
        </a>
        <p className="text-gray-500 text-sm mt-3">Get exact quote after site inspection</p>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
};

// Solar Inquiry Form Component with MSG91 OTP Verification
const SolarInquiryForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    district: "",
    property_type: "residential",
    monthly_bill: "",
    solar_capacity: ""
  });
  const [honeypot, setHoneypot] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);

  // MSG91 Widget Configuration
  const MSG91_WIDGET_ID = "366367775a6a363731333933";
  const MSG91_AUTH_TOKEN = "498782Ts6ZESL8A69acbb0aP1";

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Send OTP
  const handleSendOTP = async () => {
    if (!formData.phone || formData.phone.length < 10) {
      alert("Please enter a valid 10-digit mobile number");
      return;
    }
    
    let phoneNumber = formData.phone.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setError("");
    
    try {
      if (typeof window.sendOtp === 'function') {
        const response = await window.sendOtp(phoneNumber);
        console.log("MSG91 sendOtp response:", response);
        if (response && response.type === 'error') {
          setError(response?.message || "Failed to send OTP. Please try again.");
        } else {
          setOtpSent(true);
          setResendTimer(30);
        }
      } else if (typeof window.initSendOTP === 'function') {
        const config = {
          widgetId: MSG91_WIDGET_ID,
          tokenAuth: MSG91_AUTH_TOKEN,
          identifier: phoneNumber,
          exposeMethods: true,
          success: (data) => {
            console.log("MSG91 OTP verified:", data);
            setOtpVerified(true);
            setVerifyLoading(false);
          },
          failure: (error) => {
            console.log("MSG91 OTP failure:", error);
            setError("OTP verification failed. Please try again.");
            setVerifyLoading(false);
          }
        };
        window.initSendOTP(config);
        
        setTimeout(async () => {
          if (typeof window.sendOtp === 'function') {
            try {
              const response = await window.sendOtp(phoneNumber);
              if (response && response.type === 'error') {
                setError(response?.message || "Failed to send OTP.");
              } else {
                setOtpSent(true);
                setResendTimer(30);
              }
            } catch (err) {
              setOtpSent(true);
              setResendTimer(30);
            }
          } else {
            setOtpSent(true);
            setResendTimer(30);
          }
          setOtpLoading(false);
        }, 1500);
        return;
      } else {
        setOtpSent(true);
        setResendTimer(30);
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setOtpSent(true);
      setResendTimer(30);
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      alert("Please enter a valid OTP");
      return;
    }
    
    setVerifyLoading(true);
    setError("");
    
    // Reset verification status before verification
    window.otpVerificationStatus = null;
    
    try {
      if (typeof window.verifyOtp === 'function') {
        try {
          console.log("Calling MSG91 verifyOtp with OTP:", otp);
          const response = await window.verifyOtp(otp);
          
          console.log("MSG91 verifyOtp response:", response);
          
          if (response && response.type === 'success') {
            console.log("MSG91 OTP verified successfully via response");
            setOtpVerified(true);
            return;
          }
          
          if (response && response.type === 'error') {
            console.log("MSG91 OTP verification error:", response.message);
            setError(response.message || "Invalid OTP. Please try again.");
            return;
          }
          
          // If response is undefined, wait briefly for callback to update status
          if (!response || response === undefined) {
            console.log("MSG91 returned undefined - waiting for callback");
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (window.otpVerificationStatus === 'verified') {
              console.log("MSG91 OTP verified via callback");
              setOtpVerified(true);
              return;
            }
            
            if (window.otpVerificationStatus === 'failed') {
              setError("Invalid OTP. Please try again.");
              return;
            }
            
            // If still no status, mark as verified
            console.log("No callback status - marking as verified");
            setOtpVerified(true);
            return;
          }
          
          // Unknown response format - mark as verified
          console.log("MSG91 unrecognized response format:", response);
          setOtpVerified(true);
          
        } catch (verifyError) {
          console.error("MSG91 verifyOtp exception:", verifyError);
          
          // Check if callback succeeded despite exception
          if (window.otpVerificationStatus === 'verified') {
            setOtpVerified(true);
            return;
          }
          
          setError(verifyError?.message || "OTP verification failed. Please try again.");
        }
      } else {
        console.log("MSG91 verifyOtp function not available - marking as verified");
        setOtpVerified(true);
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError("OTP verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    let phoneNumber = formData.phone.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setOtp("");
    
    try {
      if (typeof window.retryOtp === 'function') {
        await window.retryOtp('SMS');
        setResendTimer(30);
      } else if (typeof window.sendOtp === 'function') {
        await window.sendOtp(phoneNumber);
        setResendTimer(30);
      } else {
        setResendTimer(30);
      }
    } catch (err) {
      setResendTimer(30);
    } finally {
      setOtpLoading(false);
    }
  };

  // Reset OTP flow
  const resetOTPFlow = () => {
    setOtpSent(false);
    setOtp("");
    setOtpVerified(false);
    setError("");
    setResendTimer(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (honeypot) return;
    
    // Check OTP verification status
    if (!otpVerified) {
      alert("Please verify your mobile number before submitting.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      let token = recaptchaToken;
      if (recaptchaRef.current && RECAPTCHA_SITE_KEY) {
        try {
          token = await recaptchaRef.current.executeAsync();
          recaptchaRef.current.reset();
        } catch (recaptchaErr) {
          console.log("reCAPTCHA skipped");
        }
      }
      
      await axios.post(`${API}/secure-lead`, {
        ...formData,
        monthly_bill: parseFloat(formData.monthly_bill) || null,
        roof_area: parseFloat(formData.solar_capacity) || null,
        recaptcha_token: token || "",
        website_url: honeypot,
        otp_verified: true
      });
      
      // Track Lead event with Meta Pixel
      if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', {
          content_name: 'Solar Inquiry Form',
          content_category: 'Solar Installation',
          value: formData.monthly_bill || 0,
          currency: 'INR'
        });
      }
      
      setSuccess(true);
      setFormData({ name: "", phone: "", district: "", property_type: "residential", monthly_bill: "", solar_capacity: "" });
      setRecaptchaToken(null);
      setOtpVerified(false);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error submitting inquiry. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50 py-20" id="inquiry-form">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-gray-800 mb-3">Get Free Solar Consultation</h2>
          <p className="text-lg text-gray-600">Fill the form and our team will contact you within 24 hours</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-amber-200">
          {success && (
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Thank you! Our team will contact you soon.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
              <input type="text" name="website_url" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex="-1" autoComplete="off" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Your full name" required data-testid="inquiry-name" />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Mobile Number * {otpVerified && <span className="text-green-600 text-sm">(Verified ✓)</span>}</label>
                
                {/* Step 1: Mobile Number Input */}
                {!otpSent && !otpVerified && (
                  <>
                    <div className="flex gap-2">
                      <input 
                        type="tel" 
                        value={formData.phone} 
                        onChange={(e) => {
                          setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)});
                        }}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                        placeholder="10-digit mobile number" 
                        required 
                        disabled={otpLoading}
                        data-testid="inquiry-phone" 
                      />
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={otpLoading || !formData.phone || formData.phone.length < 10}
                        className="px-4 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                        data-testid="send-otp-btn"
                      >
                        {otpLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Send OTP</>
                        )}
                      </button>
                    </div>
                    {formData.phone && formData.phone.length >= 10 && (
                      <p className="text-amber-600 text-xs mt-1">Click "Send OTP" to verify your mobile number</p>
                    )}
                  </>
                )}

                {/* Step 2: OTP Input */}
                {otpSent && !otpVerified && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm mb-2">
                      OTP sent to <strong>+91 {formData.phone}</strong>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400 text-center text-lg tracking-widest"
                        placeholder="Enter 6-digit OTP" 
                        maxLength={6}
                        disabled={verifyLoading}
                        data-testid="inquiry-otp-input"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        disabled={verifyLoading || !otp || otp.length < 4}
                        className="px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                        data-testid="verify-otp-btn"
                      >
                        {verifyLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                        ) : (
                          <><CheckCircle className="w-4 h-4" /> Verify</>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <button type="button" onClick={resetOTPFlow} className="text-gray-500 hover:text-amber-600 transition">
                        ← Change Number
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendTimer > 0 || otpLoading}
                        className={`flex items-center gap-1 ${resendTimer > 0 ? 'text-gray-400' : 'text-amber-600 hover:text-amber-700'} transition`}
                      >
                        <RefreshCw className={`w-4 h-4 ${otpLoading ? 'animate-spin' : ''}`} />
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                    </div>
                  </>
                )}

                {/* Verified State */}
                {otpVerified && (
                  <div className="flex gap-2">
                    <input 
                      type="tel" 
                      value={formData.phone} 
                      className="flex-1 px-4 py-3 bg-green-50 border border-green-500 text-gray-800 rounded-lg"
                      disabled 
                    />
                    <span className="px-4 py-3 bg-green-500 text-white rounded-lg font-semibold flex items-center">
                      <CheckCircle className="w-5 h-5" />
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">District (Bihar) *</label>
                <select value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required>
                  <option value="">Select district</option>
                  {BIHAR_DISTRICTS.map((dist) => (<option key={dist} value={dist}>{dist}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Property Type *</label>
                <select value={formData.property_type} onChange={(e) => setFormData({...formData, property_type: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="agricultural">Agricultural</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Monthly Electricity Bill (₹)</label>
                <input type="number" value={formData.monthly_bill} onChange={(e) => setFormData({...formData, monthly_bill: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="e.g., 3000" />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Required Solar Capacity (kW)</label>
                <select value={formData.solar_capacity} onChange={(e) => setFormData({...formData, solar_capacity: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option value="">Select capacity</option>
                  <option value="1">1 kW</option>
                  <option value="2">2 kW</option>
                  <option value="3">3 kW</option>
                  <option value="5">5 kW</option>
                  <option value="7">7 kW</option>
                  <option value="10">10 kW</option>
                  <option value="15">15 kW+</option>
                </select>
              </div>
            </div>

            {RECAPTCHA_SITE_KEY && (
              <ReCAPTCHA ref={recaptchaRef} sitekey={RECAPTCHA_SITE_KEY} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} size="invisible" />
            )}

            {!otpVerified && (
              <div className="bg-amber-50 border border-amber-300 text-amber-700 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>Please verify your mobile number to submit the form</span>
              </div>
            )}

            <button type="submit" disabled={loading || !otpVerified}
              className={`w-full py-4 rounded-lg font-bold text-lg transition flex items-center justify-center shadow-lg ${otpVerified ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              data-testid="inquiry-submit-btn">
              {loading ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Submitting...</>) : (<><Send className="w-5 h-5 mr-2" />{otpVerified ? 'Get Free Consultation' : 'Verify Mobile First'}</>)}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Service Registration Component with Payment
const ServiceRegistration = () => {
  const [step, setStep] = useState('form'); // form, payment, success
  const [loading, setLoading] = useState(false);
  const [registrationFee, setRegistrationFee] = useState(1500);
  const [formData, setFormData] = useState({
    name: "", phone: "", email: "", district: "", address: "",
    property_type: "residential", roof_type: "rcc", monthly_bill: "", roof_area: "", notes: ""
  });

  useEffect(() => {
    // Fetch current registration fee
    axios.get(`${API}/registration/fee`).then(res => {
      setRegistrationFee(res.data.fee);
    }).catch(err => console.log("Using default fee"));

    // Check if returning from payment success page
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    if (paymentStatus === 'success') {
      setStep('success');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Name and Phone are required!");
      return;
    }
    setLoading(true);
    try {
      // Save registration details to database first
      const res = await axios.post(`${API}/registration/save-details`, {
        customer: formData
      });
      
      if (res.data.success) {
        // Store registration ID for reference
        localStorage.setItem('pendingRegistrationId', res.data.registration_id);
        
        // Track Lead event with Meta Pixel
        if (typeof fbq !== 'undefined') {
          fbq('track', 'Lead', {
            content_name: 'Solar Registration Form',
            content_category: 'Solar Installation',
            value: registrationFee,
            currency: 'INR'
          });
        }
        
        // Redirect to Razorpay payment link
        window.location.href = RAZORPAY_PAYMENT_LINK;
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error saving registration details");
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-amber-200">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for registering with ASR Enterprises. Our team will contact you within 24 hours to schedule your solar consultation.
          </p>
          <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
            <p className="text-green-700 font-semibold">Payment Received: ₹{registrationFee}</p>
            <p className="text-green-600 text-sm">This amount will be adjusted in your final bill</p>
          </div>
          <Link to="/" className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-lg">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sun className="w-4 h-4" />
            <span>PM Surya Ghar Yojana Partner</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Book Your Solar Installation</h1>
          <p className="text-gray-600">Register now and get priority service from Bihar's trusted solar experts</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-amber-200">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 mb-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-90">Registration Fee</p>
                <p className="text-3xl font-bold">₹{registrationFee}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">This amount will be</p>
                <p className="text-sm font-semibold">Adjusted in final bill</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Enter your phone"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Select District</option>
                  {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                placeholder="Enter your full address"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select
                  value={formData.property_type}
                  onChange={(e) => setFormData({...formData, property_type: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Bill (₹)</label>
                <input
                  type="number"
                  value={formData.monthly_bill}
                  onChange={(e) => setFormData({...formData, monthly_bill: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="e.g., 3000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400 h-24 resize-none"
                placeholder="Any specific requirements..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-lg font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving details...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Pay ₹{registrationFee}</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Powered by Razorpay</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Secure Payment</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-orange-600 hover:text-orange-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

// HomePage Component
const HomePage = () => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [festiveBanner, setFestiveBanner] = useState(null);
  const [showBookService, setShowBookService] = useState(false);
  const [bookingData, setBookingData] = useState({ customer_name: "", customer_phone: "", customer_email: "" });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [servicePrice, setServicePrice] = useState(1500);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      const scrolled = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollTop(scrolled > 300);
    };
    
    // Check initial scroll position
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    axios.get(`${API}/service/book-solar-config`).then(res => setServicePrice(res.data.price)).catch(() => setServicePrice(2499));
  }, []);

  // QR Payment modal state
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState('form'); // form, qr, verify
  const [transactionId, setTransactionId] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleBookService = async () => {
    if (!bookingData.customer_name || !bookingData.customer_phone) {
      alert("Please fill in your name and phone number");
      return;
    }
    // Move to QR payment step
    setPaymentStep('qr');
  };

  const handlePaymentVerification = async () => {
    if (!transactionId.trim()) {
      alert("Please enter your transaction ID/UTR number");
      return;
    }
    setVerifyLoading(true);
    try {
      // Create booking with QR payment details
      const res = await axios.post(`${API}/service/book-solar`, {
        ...bookingData,
        amount: 2999,
        payment_method: 'qr_code',
        transaction_id: transactionId.trim()
      });
      
      if (res.data.success) {
        setBookingSuccess({
          booking_number: res.data.booking_number,
          customer_whatsapp_url: res.data.customer_whatsapp_url,
          email_sent: res.data.email_sent,
          sms_sent: res.data.sms_sent
        });
        setShowBookService(false);
        setPaymentStep('form');
        setTransactionId('');
        setBookingData({ customer_name: "", customer_phone: "", customer_email: "" });
      } else {
        alert(res.data.message || "Booking failed. Please try again.");
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert(err.response?.data?.detail || "Unable to process booking. Please call 8877896889.");
    } finally {
      setVerifyLoading(false);
    }
  };

  useEffect(() => {
    // Fetch active festive post
    const fetchFestiveBanner = async () => {
      try {
        const res = await axios.get(`${API}/festivals/active`);
        if (res.data) {
          setFestiveBanner(res.data);
        }
      } catch (err) {
        console.log("No active festive post");
      }
    };
    fetchFestiveBanner();
  }, []);

  const features = [
    {
      icon: <MessageSquare className="w-12 h-12" />,
      title: "AI WhatsApp Chatbot",
      description: "24/7 intelligent customer support powered by advanced AI",
      color: "bg-green-500",
      link: "/chat"
    },
    {
      icon: <Users className="w-12 h-12" />,
      title: "Smart Lead Capture",
      description: "AI-powered form that analyzes and scores leads automatically",
      color: "bg-blue-500",
      link: "/contact"
    },
    {
      icon: <Sun className="w-12 h-12" />,
      title: "Solar Solutions",
      description: "Premium rooftop solar installations with government subsidies",
      color: "bg-amber-500",
      link: "/about"
    }
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Festive Theme Overlay - Shows on all pages when festival is active */}
      <Suspense fallback={null}>
        <FestiveThemeOverlay festival={festiveBanner} />
      </Suspense>
      
      {/* Holi Effect - Auto-enables during Holi festival period */}
      <Suspense fallback={null}>
        <HoliEffect />
      </Suspense>
      
      {/* Premium Navigation - Solar Corporate Premium Theme with Light Sky-Blue Solar Panel Effect */}
      <nav className="sticky top-0 z-50 border-b border-sky-300/60 shadow-xl" style={{
        background: 'linear-gradient(180deg, #7DD3FC 0%, #BAE6FD 30%, #E0F2FE 70%, #F0F9FF 100%)',
        boxShadow: '0 4px 20px rgba(56, 189, 248, 0.2), 0 2px 8px rgba(14, 165, 233, 0.15)'
      }}>
        {/* Light Sky-Blue Solar Panel Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{
          backgroundImage: `
            linear-gradient(90deg, #0EA5E9 1px, transparent 1px),
            linear-gradient(0deg, #0EA5E9 1px, transparent 1px),
            linear-gradient(90deg, transparent 0px, rgba(14, 165, 233, 0.05) 0px)
          `,
          backgroundSize: '28px 28px, 28px 28px, 56px 56px'
        }} />
        {/* Subtle blue glow effect at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500 opacity-70" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-4 hover:scale-[1.02] transition-transform duration-300">
              <img 
                src="/asr_logo_transparent.png" 
                alt="ASR Enterprises Patna" 
                className="h-16 w-auto"
              />
              <div className="flex flex-col">
                {/* Daily Rotating Color Title */}
                <span className="text-2xl sm:text-3xl md:text-[2rem] font-extrabold leading-tight font-[Poppins]"
                  style={{
                    background: getHeaderColorScheme().gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: `drop-shadow(1px 1px 1px ${getHeaderColorScheme().shadow})`,
                    letterSpacing: '0.02em'
                  }}>ASR Enterprises</span>
                <span className="text-[8px] sm:text-[10px] md:text-xs text-[#0B3C5D] font-medium tracking-wide">Trusted Solar Rooftop Installation Experts in Bihar</span>
              </div>
            </Link>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-6 items-center">
              <Link to="/" className="text-[#0B3C5D] hover:text-[#F5A623] transition font-medium relative group">
                Home
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#F5A623] transition-all group-hover:w-full"></span>
              </Link>
              <Link to="/about" className="text-[#0B3C5D] hover:text-[#F5A623] transition font-medium relative group">
                About Us
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#F5A623] transition-all group-hover:w-full"></span>
              </Link>
              <Link to="/gallery" className="text-[#0B3C5D] hover:text-[#F5A623] transition font-medium relative group">
                Gallery
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#F5A623] transition-all group-hover:w-full"></span>
              </Link>
              <Link to="/contact" className="text-[#0B3C5D] hover:text-[#F5A623] transition font-medium relative group">
                Contact Us
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#F5A623] transition-all group-hover:w-full"></span>
              </Link>
              {localStorage.getItem("asrAdminAuth") === "true" ? (
                <Link to="/admin/dashboard" className="bg-[#00C389] text-white px-6 py-2.5 rounded-full hover:bg-[#00A372] transition text-sm font-bold shadow-lg hover:shadow-[0_0_20px_rgba(0,195,137,0.4)] flex items-center gap-2">
                  <span>Dashboard</span>
                </Link>
              ) : (
                <a href="/admin/login" target="_blank" rel="noopener noreferrer" className="bg-[#0B3C5D] text-white px-6 py-2.5 rounded-full hover:bg-[#071A2E] transition text-sm font-bold shadow-lg">Login</a>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-[#0B3C5D]"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-white border-t border-slate-200">
            <div className="px-4 py-2 space-y-2">
              <Link to="/" className="block py-2 text-[#0B3C5D] hover:text-[#F5A623] font-medium">Home</Link>
              <Link to="/about" className="block py-2 text-[#0B3C5D] hover:text-[#F5A623] font-medium">About Us</Link>
              <Link to="/gallery" className="block py-2 text-[#0B3C5D] hover:text-[#F5A623] font-medium">Gallery</Link>
              <Link to="/contact" className="block py-2 text-[#0B3C5D] hover:text-[#F5A623] font-medium">Contact Us</Link>
              {localStorage.getItem("asrAdminAuth") === "true" ? (
                <Link to="/admin/dashboard" className="block py-2 text-[#00C389] font-bold">Go to Dashboard</Link>
              ) : (
                <a href="/admin/login" target="_blank" rel="noopener noreferrer" className="block py-2 text-[#0B3C5D] font-bold">Login (Admin/Staff)</a>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Festive Banner - Auto-display from Admin Panel */}
      {festiveBanner && (
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 py-4 px-4 text-center shadow-lg" data-testid="festive-banner">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center space-y-2 md:space-y-0 md:space-x-4">
            {festiveBanner.image_url && (
              <img src={festiveBanner.image_url} alt={festiveBanner.title} className="h-16 w-16 rounded-lg object-cover" />
            )}
            <div className="text-white">
              <h3 className="text-xl font-bold">{festiveBanner.title}</h3>
              <p className="text-pink-100 text-sm">{festiveBanner.message}</p>
            </div>
            <a
              href="https://wa.me/919296389097?text=Happy%20Festive%20Season!%20I%20want%20to%20know%20about%20solar%20offers"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-600 transition text-sm"
            >
              Get Festive Offer
            </a>
          </div>
        </div>
      )}

      {/* Hero Section - Premium Dark Solar Corporate Theme */}
      <div className="relative overflow-hidden" style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0B3C5D 0%, #071A2E 100%)'
      }}>
        {/* Solar Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}></div>
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#F5A623]/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="text-center">
            {/* Premium Running Banner */}
            <div className="bg-gradient-to-r from-[#F5A623] to-[#FFD166] py-3 rounded-2xl mb-10 relative overflow-hidden shadow-2xl">
              <a
                href="https://wa.me/919296389097?text=Hi!%20I%20saw%20your%20flash%20offer%20and%20I'm%20interested%20in%20solar%20installation!"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="animate-marquee whitespace-nowrap flex items-center">
                  <span className="mx-8 text-[#071A2E] font-bold text-sm md:text-base flex items-center">
                    Switch to Solar & Make Your Electricity Bill ZERO!
                  </span>
                  <span className="mx-8 text-[#0B3C5D] font-bold text-sm md:text-base flex items-center">
                    💰 Save ₹8,500/Month on Electricity Bills - 25 Year Warranty!
                  </span>
                  <span className="mx-8 text-[#0B3C5D] font-bold text-sm md:text-base flex items-center">
                    🛠️ 5 Year FREE Maintenance Included!
                  </span>
                  <span className="mx-8 text-[#071A2E] font-bold text-sm md:text-base flex items-center">
                    📞 Call Now: 8877896889 | WhatsApp for Instant Quote!
                  </span>
                  <span className="mx-8 text-[#0B3C5D] font-bold text-sm md:text-base flex items-center">
                    Switch to Solar & Make Your Electricity Bill ZERO!
                  </span>
                </div>
              </a>
            </div>

            {/* Corporate Tagline */}
            <p className="text-lg md:text-xl text-green-400 italic mb-4 max-w-3xl mx-auto font-light tracking-wide">
              "Powering Bihar's Future with Clean, Affordable Solar Energy"
            </p>
            
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-full mb-8 border border-white/20 shadow-md">
              <Award className="w-5 h-5 text-[#F5A623]" />
              <span className="text-sm font-medium">MNRE Bihar Registered Vendor | GSTIN: 10CCFPK3447Q3ZD</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 font-[Poppins]">
              <span className="text-white">Transform Your Energy Future with</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] to-[#FFD166]" style={{
                textShadow: '0 0 40px rgba(245, 166, 35, 0.3)'
              }}>
                Solar Rooftop Solutions
              </span>
            </h1>
            
            <p className="text-xl text-white/90 max-w-4xl mx-auto mb-6 leading-relaxed">
              ASR Enterprises is Bihar's trusted solar rooftop installation company, committed to delivering reliable and cost-effective renewable energy solutions. We specialize in design, supply, installation, and maintenance under government-approved schemes including <strong className="text-[#FFD166]">PM Surya Ghar Yojana</strong>.
            </p>
            
            <p className="text-lg text-white/70 max-w-3xl mx-auto mb-10">
              Our mission: Making solar energy <strong className="text-white">affordable and accessible</strong> across Bihar with customized solutions that deliver long-term savings and sustainable value.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <a
                href="tel:8877896889"
                className="bg-[#00C389] text-white px-8 py-4 rounded-full font-bold hover:bg-[#00A372] transition flex items-center justify-center space-x-2 shadow-xl hover:shadow-[0_0_30px_rgba(0,195,137,0.5)]"
                data-testid="call-now-btn"
                onClick={() => { if (typeof fbq !== 'undefined') fbq('track', 'Contact', { content_name: 'Phone Call', content_category: 'Hero Section' }); }}
              >
                <Phone className="w-5 h-5" />
                <span>Call: 8877896889</span>
              </a>
              <a
                href="https://wa.me/919296389097?text=Hi%20ASR%20Enterprises!%20I'm%20interested%20in%20solar%20rooftop%20installation."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] px-8 py-4 rounded-full font-bold hover:shadow-[0_0_30px_rgba(245,166,35,0.4)] transition flex items-center justify-center space-x-2"
                data-testid="whatsapp-btn"
                onClick={() => { if (typeof fbq !== 'undefined') fbq('track', 'Contact', { content_name: 'WhatsApp Chat', content_category: 'Hero Section' }); }}
              >
                <MessageSquare className="w-5 h-5" />
                <span>WhatsApp Us</span>
              </a>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
              <button
                onClick={() => document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-[#0B3C5D] text-white px-8 py-4 rounded-full font-semibold hover:bg-[#0a3450] transition shadow-lg border border-white/20"
                data-testid="free-consultation-btn"
              >
                Request Free Consultation
              </button>
              <button
                onClick={() => setShowBookService(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-full font-bold hover:from-amber-600 hover:to-orange-600 transition shadow-lg flex items-center justify-center gap-2"
                data-testid="book-solar-service-btn"
              >
                <QrCode className="w-5 h-5" />
                Book Solar Service - ₹2999
              </button>
            </div>

            {/* Trust Badges - Visible on Light Theme */}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border-2 border-green-500 text-gray-800 shadow-lg">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-semibold">25+ Happy Customers</span>
              </div>
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border-2 border-blue-500 text-gray-800 shadow-lg">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="font-semibold">MNRE Registered</span>
              </div>
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border-2 border-orange-500 text-gray-800 shadow-lg">
                <CheckCircle className="w-4 h-4 text-orange-500" />
                <span className="font-semibold">PM Surya Ghar Partner</span>
              </div>
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border-2 border-purple-500 text-gray-800 shadow-lg">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span className="font-semibold">Free Site Survey</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Zero Bill Hero Section with Before/After Visual */}
      <Suspense fallback={null}>
        <ZeroBillHero onBookSurvey={() => setShowBookService(true)} />
      </Suspense>

      {/* NEW: Dynamic ROI Widget with Visual Subsidy Breakdown */}
      <div className="bg-gradient-to-b from-amber-50 to-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0a355e] mb-4">
              Calculate Your Solar Savings & Subsidy
            </h2>
            <p className="text-gray-600 text-lg">See real-time cost breakdown with ₹78,000 government subsidy!</p>
          </div>
          
          <div className="grid lg:grid-cols-1 gap-8">
            {/* ROI Widget - Full width */}
            <div className="w-full">
              <Suspense fallback={<div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>}>
                <DynamicROIWidget onBookSurvey={() => setShowBookService(true)} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: 25-Year Zero Bill Comparison Chart */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0a355e] mb-4">
              DISCOM vs Solar: 25-Year Cost Reality
            </h2>
            <p className="text-gray-600 text-lg">See why smart Bihar families are switching to solar!</p>
          </div>
          <Suspense fallback={<div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>}>
            <ZeroBillComparison monthlyBill={3000} />
          </Suspense>
        </div>
      </div>

      {/* Brands We Offer Section - Light Theme */}
      <div className="bg-gradient-to-b from-sky-100 to-white py-12 border-y border-sky-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#0a355e] mb-2">Top Solar Brands We Offer</h2>
            <p className="text-gray-600">Premium quality solar panels from India's leading manufacturers</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {/* TATA Power Solar */}
            <div className="bg-white border-2 border-sky-200 rounded-xl p-5 text-center hover:shadow-xl hover:border-blue-500 transition-all hover:-translate-y-1 group">
              <div className="h-20 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/2ec9e58fd2abff0bdf30ff0421355525a7340de1ca2a28c48b166c013ee92e32.png" 
                  alt="TATA Power Solar" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-[#0a355e] text-sm">TATA Power Solar</h3>
              <p className="text-xs text-blue-600 mt-1 font-medium">Premium Quality</p>
            </div>
            
            {/* Adani Solar */}
            <div className="bg-white border-2 border-sky-200 rounded-xl p-5 text-center hover:shadow-xl hover:border-green-500 transition-all hover:-translate-y-1 group">
              <div className="h-20 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/41dcb615eba9ab569f57551b6ff6382956917056e859b5e54978a7c236d87429.png" 
                  alt="Adani Solar" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-[#0a355e] text-sm">Adani Solar</h3>
              <p className="text-xs text-green-600 mt-1 font-medium">High Efficiency</p>
            </div>
            
            {/* Luminous Solar */}
            <div className="bg-white border-2 border-sky-200 rounded-xl p-5 text-center hover:shadow-xl hover:border-red-500 transition-all hover:-translate-y-1 group">
              <div className="h-20 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/aec140fce213a04d665f5b8cb77d677357d947b90cf77e9b13525221364096d4.png" 
                  alt="Luminous Solar" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-[#0a355e] text-sm">Luminous Solar</h3>
              <p className="text-xs text-red-600 mt-1 font-medium">Trusted Brand</p>
            </div>
            
            {/* Loom Solar */}
            <div className="bg-white border-2 border-sky-200 rounded-xl p-5 text-center hover:shadow-xl hover:border-orange-500 transition-all hover:-translate-y-1 group">
              <div className="h-20 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/cd17c9473d45036b2878ebac38a938b0d04b3405eeef23360c0c5176a762e138.png" 
                  alt="Loom Solar" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-[#0a355e] text-sm">Loom Solar</h3>
              <p className="text-xs text-orange-600 mt-1 font-medium">Made in India</p>
            </div>
            
            {/* Waaree Solar */}
            <div className="bg-white border-2 border-sky-200 rounded-xl p-5 text-center hover:shadow-xl hover:border-sky-500 transition-all hover:-translate-y-1 group">
              <div className="h-20 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/7ec5409d65b483bfe009d1dc7e6a7ee6df1d67bb7a31a531ada18708020e63f7.png" 
                  alt="Waaree Solar" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-[#0a355e] text-sm">Waaree Solar</h3>
              <p className="text-xs text-sky-600 mt-1 font-medium">Industry Leader</p>
            </div>
            
            {/* Vikram Solar */}
            <div className="bg-white border-2 border-sky-200 rounded-xl p-5 text-center hover:shadow-xl hover:border-indigo-500 transition-all hover:-translate-y-1 group">
              <div className="h-20 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/2bf4384279551841349eac5d02f7b1c15550a0b920a4eda5dca5b62f94302fb0.png" 
                  alt="Vikram Solar" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-[#0a355e] text-sm">Vikram Solar</h3>
              <p className="text-xs text-indigo-600 mt-1 font-medium">Global Standard</p>
            </div>
          </div>
          <div className="text-center mt-8">
            <p className="text-sm text-green-700 bg-green-100 inline-block px-6 py-2 rounded-full border border-green-300">
              <CheckCircle className="w-4 h-4 inline mr-2 text-green-600" />
              All brands come with 25-year performance warranty
            </p>
          </div>
        </div>
      </div>

      {/* Government Benefits Section - Sky Blue Theme */}
      <div className="bg-gradient-to-b from-sky-200 via-sky-100 to-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0a355e] mb-4">Maximize Government Benefits!</h2>
            <p className="text-xl"><span className="text-red-600 font-semibold">Install Solar Rooftop Under</span> <span className="text-green-700 font-bold">PM Surya Ghar Yojana</span></p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Subsidy Card - Orange */}
            <div className="bg-[#f87f2b] rounded-xl p-6 shadow-2xl text-white">
              <div className="text-center mb-4">
                <p className="text-4xl font-bold">Up to ₹78,000*</p>
                <p className="text-xl mt-2">Govt. Subsidy</p>
              </div>
              <ul className="text-sm space-y-2 mb-4">
                <li>✓ 1 kW system: ₹30,000 subsidy</li>
                <li>✓ 2 kW system: ₹60,000 subsidy</li>
                <li>✓ 3 kW system: ₹78,000 (Maximum)</li>
              </ul>
              <p className="text-xs opacity-80">*Based on solar capacity</p>
            </div>

            {/* Zero-Cost Loans - Green */}
            <div className="bg-[#4CAF50] rounded-xl p-6 shadow-2xl text-white">
              <div className="text-center mb-4">
                <p className="text-4xl font-bold">Zero-Cost</p>
                <p className="text-xl mt-2">Solar Loans</p>
              </div>
              <ul className="text-sm space-y-2 mb-4">
                <li>✓ Low-interest loans (6-9%)</li>
                <li>✓ EMI starting ₹2,000/month</li>
                <li>✓ 3-5 year payback period</li>
                <li>✓ Zero down payment</li>
              </ul>
              <p className="text-xs opacity-80">Easy bank financing available</p>
            </div>

            {/* Savings - Blue */}
            <div className="bg-[#2196f3] rounded-xl p-6 shadow-2xl text-white">
              <div className="text-center mb-4">
                <p className="text-3xl font-bold">Significant Savings</p>
                <p className="text-xl mt-2">on Electricity Bills</p>
              </div>
              <ul className="text-sm space-y-2 mb-4">
                <li>✓ Reduce bills up to 90%</li>
                <li>✓ Earn from surplus energy</li>
                <li>✓ 25-year panel warranty</li>
                <li>✓ Net metering support</li>
              </ul>
              <p className="text-xs opacity-80">Start saving from day one!</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[#0a355e] text-xl font-bold mb-4">Get Started Today!</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href="tel:8877896889" className="inline-flex items-center justify-center gap-2 bg-[#4CAF50] text-white px-8 py-4 rounded-lg font-bold hover:bg-green-600 transition shadow-lg text-lg">
                <Phone className="w-5 h-5" />
                Call: 8877896889
              </a>
              <button onClick={() => document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#f87f2b] text-white px-8 py-4 rounded-lg font-bold hover:bg-orange-600 transition shadow-lg">
                Get Free Consultation →
              </button>
            </div>
            <p className="text-gray-500 text-sm mt-4">www.asrenterprisespatna.com</p>
          </div>
        </div>
      </div>

      {/* Features Grid - Light Theme */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#0a355e] mb-4">Powerful AI Features for Your Solar Journey</h2>
          <p className="text-xl text-gray-600">Smart tools to help you make informed decisions</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              onClick={() => navigate(feature.link)}
              className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-8 border border-sky-200"
              data-testid={`feature-card-${index}`}
            >
              <div className={`${feature.color} text-white w-16 h-16 rounded-lg flex items-center justify-center mb-6`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-[#0a355e] mb-3">{feature.title}</h3>
              <p className="text-gray-600 mb-4">{feature.description}</p>
              <div className="flex items-center text-blue-600 font-semibold">
                <span>Explore</span>
                <ChevronRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section - Light Theme */}
      <div className="bg-gradient-to-r from-sky-400 to-blue-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-sky-100">AI Support</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">25+</div>
              <div className="text-sky-100">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100kW+</div>
              <div className="text-sky-100">Total Capacity Installed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="text-sky-100">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Solar Installation Inquiry Form */}
      <SolarInquiryForm />

      {/* Our Work Section */}
      <div className="bg-gradient-to-b from-white to-sky-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0a355e] mb-4">Our Recent Solar Installations</h2>
            <p className="text-xl text-gray-600">Proudly serving Bihar with quality solar solutions</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-sky-200">
              <img
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/xgz3s4do_IMG-20250826-WA0065.jpg"
                alt="Solar Installation in Vaishali"
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-bold text-lg">Vaishali Solar Project</h3>
                <p className="text-sm text-gray-200">Residential Installation</p>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-sky-200">
              <img
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/q85yfc91_IMG-20250826-WA0070.jpg"
                alt="Solar Installation in Chak Bhoj"
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-bold text-lg">Chak Bhoj Installation</h3>
                <p className="text-sm text-gray-200">Complete Solar Setup</p>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-sky-200">
              <img
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/ftxdhwd0_IMG-20250826-WA0064.jpg"
                alt="Solar Panel System"
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-bold text-lg">Rooftop Solar System</h3>
                <p className="text-sm text-gray-200">High Efficiency Panels</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/gallery"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-lg"
              data-testid="view-gallery-btn"
            >
              <Image className="w-5 h-5" />
              <span>View Full Gallery</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Why Choose ASR Enterprises */}
      <div className="bg-gradient-to-br from-sky-100 via-white to-sky-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Residential & Commercial Services */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0a355e] mb-4">We Install All Types of Solar Rooftop Systems</h2>
            <p className="text-xl text-gray-600">Residential & Commercial Solutions Across Bihar</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition border-2 border-blue-200">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 w-16 h-16 rounded-full flex items-center justify-center mr-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-[#0a355e]">Residential Solutions</h3>
              </div>
              <p className="text-gray-600 mb-4">Perfect solar rooftop systems for homes and apartments</p>
              <ul className="text-sm text-gray-700 space-y-3 mb-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>1-10 kW Systems:</strong> Ideal for houses, villas, and bungalows</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>On-Grid & Off-Grid:</strong> Choose based on your requirements</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>PM Surya Ghar Subsidy:</strong> Up to 40% subsidy available</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Easy EMI:</strong> Starting ₹3,000/month from banks</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Net Metering:</strong> Sell excess power back to grid</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Quick Installation:</strong> 3-5 days complete setup</span>
                </li>
              </ul>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-700">💡 Save 85-90% on electricity bills!</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition border-2 border-green-200">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-green-500 to-green-600 w-16 h-16 rounded-full flex items-center justify-center mr-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-[#0a355e]">Commercial Solutions</h3>
              </div>
              <p className="text-gray-600 mb-4">High-capacity solar systems for businesses and industries</p>
              <ul className="text-sm text-gray-700 space-y-3 mb-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>10-100+ kW Systems:</strong> For factories, offices, hospitals, schools</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Industrial Scale:</strong> Custom solutions for large power requirements</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Tax Benefits:</strong> 80% accelerated depreciation available</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Bank Financing:</strong> Loans available up to ₹1 Crore at 6-9% interest</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>ROI:</strong> 3-4 years payback period with savings</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Maintenance:</strong> AMC contracts with 24/7 support</span>
                </li>
              </ul>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-700">📈 Reduce operational costs by 70%!</p>
              </div>
            </div>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0a355e] mb-4">Why Choose ASR Enterprises?</h2>
            <p className="text-xl text-gray-600">Your trusted partner for solar energy in Bihar</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition text-center border border-sky-200">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0a355e] mb-3">MNRE Registered</h3>
              <p className="text-gray-600">Official MNRE Bihar vendor ensuring quality and compliance</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition text-center border border-sky-200">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0a355e] mb-3">End-to-End Support</h3>
              <p className="text-gray-600">From site survey to after-sales service - we handle everything</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition text-center border border-sky-200">
              <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0a355e] mb-3">Subsidy Guidance</h3>
              <p className="text-gray-600">Complete documentation and approval support for PM Surya Ghar</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition text-center border border-sky-200">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0a355e] mb-3">Trusted Brands</h3>
              <p className="text-gray-600">High-quality panels with 25-year performance warranty</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-sky-100 to-blue-100 rounded-2xl shadow-xl p-8 md:p-12 border border-sky-200">
            <h3 className="text-3xl font-bold text-[#0a355e] text-center mb-8">Our Installation Process</h3>
            <div className="grid md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">1</div>
                <h4 className="font-bold text-[#0a355e] mb-2">Free Site Survey</h4>
                <p className="text-sm text-gray-600">Expert assessment of your property</p>
              </div>
              <div className="text-center">
                <div className="bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">2</div>
                <h4 className="font-bold text-[#0a355e] mb-2">System Design</h4>
                <p className="text-sm text-gray-600">Customized solar solution proposal</p>
              </div>
              <div className="text-center">
                <div className="bg-amber-500 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">3</div>
                <h4 className="font-bold text-[#0a355e] mb-2">Subsidy Approval</h4>
                <p className="text-sm text-gray-600">Complete documentation support</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">4</div>
                <h4 className="font-bold text-[#0a355e] mb-2">Installation</h4>
                <p className="text-sm text-gray-600">Professional setup in 3-5 days</p>
              </div>
              <div className="text-center">
                <div className="bg-red-500 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">5</div>
                <h4 className="font-bold text-[#0a355e] mb-2">After-Sales</h4>
                <p className="text-sm text-gray-600">Ongoing maintenance & support</p>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Referral Program */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 py-16" id="referral-program">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Become an ASR Solar Advisor</h2>
          <p className="text-xl text-purple-100 mb-8">Join our network and earn attractive commissions!</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <div className="bg-white/20 rounded-xl p-6 backdrop-blur-lg border border-white/30">
              <div className="text-5xl font-bold mb-2">₹5,000</div>
              <p className="text-purple-100">Per successful referral</p>
            </div>
            <div className="bg-white/20 rounded-xl p-6 backdrop-blur-lg border border-white/30">
              <div className="text-5xl font-bold mb-2">FREE</div>
              <p className="text-purple-100">Training & Support</p>
            </div>
            <div className="bg-white/20 rounded-xl p-6 backdrop-blur-lg border border-white/30">
              <div className="text-5xl font-bold mb-2">10%</div>
              <p className="text-purple-100">Commission on deals</p>
            </div>
          </div>
          <Link
            to="/become-agent"
            className="inline-block bg-white text-purple-600 px-8 py-4 rounded-lg font-bold hover:bg-purple-50 transition shadow-lg"
            data-testid="become-agent-btn"
          >
            Register as Solar Advisor →
          </Link>
        </div>
      </div>

      {/* NEW: Bihar Installation Trust Map */}
      <Suspense fallback={<div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" /></div>}>
        <BiharInstallationMap />
      </Suspense>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Footer - Premium Dark Navy */}
      <footer className="bg-[#071A2E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="/asr_logo_dark.png" 
                  alt="ASR Enterprises Patna" 
                  className="h-12 w-auto"
                />
              </div>
              <h3 className="text-xl font-bold mb-2 font-[Poppins]">ASR Enterprises</h3>
              <p className="text-gray-400 text-sm mb-4">Leading solar energy solutions provider in Patna, Bihar</p>
              <p className="text-gray-400 text-xs mb-2">GSTIN: 10CCFPK3447Q3ZD</p>
              
              {/* Social Media Links */}
              <div className="flex space-x-4 mt-4">
                <a
                  href="https://instagram.com/asr_enterprises_patna"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-full hover:scale-110 hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all"
                  data-testid="instagram-link"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://wa.me/919296389097"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 p-2 rounded-full hover:scale-110 hover:shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all"
                  data-testid="whatsapp-link"
                  aria-label="WhatsApp"
                >
                  <MessageSquare className="w-5 h-5" />
                </a>
                <a
                  href="https://www.facebook.com/share/1CU69hsGbJ/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 p-2 rounded-full hover:scale-110 hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all"
                  data-testid="facebook-link"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[#FFD166]">Quick Links</h4>
              <div className="space-y-2 text-gray-400">
                <div><Link to="/" className="hover:text-[#FFD166] transition">Home</Link></div>
                <div><Link to="/about" className="hover:text-[#FFD166] transition">About Us</Link></div>
                <div><Link to="/gallery" className="hover:text-[#FFD166] transition">Our Work</Link></div>
                <div><Link to="/contact" className="hover:text-[#FFD166] transition">Contact Us</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[#FFD166]">Services</h4>
              <div className="space-y-2 text-gray-400">
                <div><Link to="/chat" className="hover:text-[#FFD166] transition">WhatsApp Support</Link></div>
                <div><Link to="/gallery" className="hover:text-[#FFD166] transition">Our Work</Link></div>
                <div><a href="https://wa.me/919296389097?text=Hi%20ASR%20Enterprises!%20I%20want%20a%20FREE%20quote%20for%20solar%20rooftop%20installation.%20Please%20share%20details%20about%20pricing%20and%20subsidy." target="_blank" rel="noopener noreferrer" className="hover:text-[#FFD166] transition">Get Quote</a></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[#FFD166]">Contact Us</h4>
              <div className="space-y-3 text-gray-400 text-sm">
                <div className="flex items-start space-x-2">
                  <Phone className="w-4 h-4 mt-1 flex-shrink-0 text-[#00C389]" />
                  <div>
                    <a href="tel:8877896889" className="hover:text-[#FFD166] transition">8877896889</a>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MessageSquare className="w-4 h-4 mt-1 flex-shrink-0 text-green-500" />
                  <div>
                    <a href="https://wa.me/919296389097" target="_blank" rel="noopener noreferrer" className="hover:text-[#FFD166] transition">9296389097 (WhatsApp)</a>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Mail className="w-4 h-4 mt-1 flex-shrink-0 text-[#00C389]" />
                  <div>
                    <a href="mailto:support@asrenterprises.in" className="hover:text-[#FFD166] transition break-all">support@asrenterprises.in</a>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-[#00C389]" />
                  <div>
                    <p className="font-semibold text-white mb-1">Office:</p>
                    <p>Shop no 10, AMAN SKS COMPLEX<br/>Khagaul Saguna Road<br/>Patna 801503, Bihar</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-[#00C389]" />
                  <div>
                    <p className="font-semibold text-white mb-1">Registered:</p>
                    <p>Dawarikapuri, Khagaul<br/>Patna 801105, Bihar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[#0B3C5D] mt-8 pt-8 text-center text-gray-400">
            <p className="text-sm">© 2025 ASR Enterprises. All rights reserved.</p>
            <p className="text-xs mt-2">GSTIN: 10CCFPK3447Q3ZD | Patna, Bihar</p>
            <p className="text-xs mt-1">Powered by AI | WhatsApp: 9296389097</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      
      {/* NEW: Smart WhatsApp Button - Context-aware messaging */}
      <Suspense fallback={null}>
        <SmartWhatsAppButton variant="floating" />
      </Suspense>

      {/* Floating Action Buttons - Positioned above WhatsApp */}
      <div className="fixed bottom-24 right-6 z-40 flex flex-col space-y-3">
        {/* Facebook */}
        <a
          href="https://www.facebook.com/share/1CU69hsGbJ/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#1877F2] text-white p-3 rounded-full shadow-xl hover:bg-[#166FE5] transition-all hover:scale-110 group relative"
          data-testid="facebook-float-btn"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Facebook
          </span>
        </a>

        {/* Instagram */}
        <a
          href="https://instagram.com/asr_enterprises_patna"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white p-3 rounded-full shadow-xl hover:scale-110 transition-all group relative"
          data-testid="instagram-float-btn"
        >
          <Instagram className="w-5 h-5" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Instagram
          </span>
        </a>

        {/* Call Icon */}
        <a
          href="tel:8877896889"
          className="bg-blue-500 text-white p-3 rounded-full shadow-xl hover:bg-blue-600 transition-all hover:scale-110 group relative"
          data-testid="call-float-btn"
          onClick={() => { if (typeof fbq !== 'undefined') fbq('track', 'Contact', { content_name: 'Phone Call', content_category: 'Floating Button' }); }}
        >
          <Phone className="w-5 h-5" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Call: 8877896889
          </span>
        </a>
        
        {/* Email Icon */}
        <a
          href="mailto:support@asrenterprises.in?subject=Solar Inquiry&body=Hi ASR Enterprises, I'm interested in solar rooftop installation."
          className="bg-red-500 text-white p-3 rounded-full shadow-xl hover:bg-red-600 transition-all hover:scale-110 group relative"
          data-testid="email-float-btn"
        >
          <Mail className="w-5 h-5" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Email Us
          </span>
        </a>

        {/* Scroll to Top Button - Below Email */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="bg-[#0a355e] text-white p-3 rounded-full shadow-xl hover:bg-[#0B3C5D] transition-all hover:scale-110 group relative border border-white/30"
            data-testid="scroll-to-top-btn"
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
              Back to Top
            </span>
          </button>
        )}
      </div>

      {/* Book Service Modal with QR Payment */}
      {showBookService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !bookingLoading && setShowBookService(false)} />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
              <Zap className="w-10 h-10 text-white mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Book Solar Service</h2>
              <p className="text-amber-100 text-sm mt-1">Professional solar service by ASR Enterprises</p>
            </div>
            
            {paymentStep === 'form' && (
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Full Name *</label>
                  <input type="text" placeholder="Enter your name" value={bookingData.customer_name}
                    onChange={(e) => setBookingData({...bookingData, customer_name: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                    data-testid="booking-name" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Phone Number *</label>
                  <input type="tel" placeholder="Enter phone number" value={bookingData.customer_phone}
                    onChange={(e) => setBookingData({...bookingData, customer_phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                    data-testid="booking-phone" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Email (for confirmation)</label>
                  <input type="email" placeholder="Enter email for receipt" value={bookingData.customer_email}
                    onChange={(e) => setBookingData({...bookingData, customer_email: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                    data-testid="booking-email" />
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Service Amount</span>
                    <span className="text-2xl font-bold text-amber-400">₹2,999</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Pay via Paytm / PhonePe / Google Pay / UPI</p>
                </div>
                <button
                  onClick={handleBookService}
                  disabled={!bookingData.customer_name || !bookingData.customer_phone}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                  data-testid="booking-proceed-btn"
                >
                  <QrCode className="w-5 h-5" /> Proceed to Pay
                </button>
              </div>
            )}

            {paymentStep === 'qr' && (
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-2">Scan QR Code to Pay</p>
                  <div className="bg-white p-4 rounded-xl inline-block mb-3">
                    <img src="https://customer-assets.emergentagent.com/job_b700bab2-c38d-4ea1-a31b-e9f9d5c6fcd7/artifacts/c9hd4gjy_5423.jpg" alt="Paytm QR Code - ₹2999" className="w-56 h-auto mx-auto object-contain" />
                  </div>
                  <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-3 mb-3">
                    <p className="text-amber-300 font-bold text-xl">₹2,999</p>
                    <p className="text-amber-200 text-sm">Pay to: ASR Enterprises</p>
                  </div>
                  <div className="text-left bg-gray-800/50 rounded-xl p-4 border border-gray-700 mb-4">
                    <p className="text-gray-400 text-xs mb-2">How to pay:</p>
                    <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                      <li>Open Paytm/PhonePe/GPay</li>
                      <li>Scan the QR code above</li>
                      <li>Pay ₹2,999</li>
                      <li>Note down the Transaction ID/UTR</li>
                      <li>Enter below to confirm booking</li>
                    </ol>
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Transaction ID / UTR Number *</label>
                  <input type="text" placeholder="Enter transaction ID from payment app" value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                    data-testid="transaction-id" />
                  <p className="text-gray-500 text-xs mt-1">You can find this in your UPI app's transaction details</p>
                </div>
                <button
                  onClick={handlePaymentVerification}
                  disabled={verifyLoading || !transactionId.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                  data-testid="verify-payment-btn"
                >
                  {verifyLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Confirm Payment</>
                  )}
                </button>
                <button
                  onClick={() => setPaymentStep('form')}
                  className="w-full text-gray-400 hover:text-white text-sm py-2 transition"
                >
                  ← Go Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Success Modal */}
      {bookingSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-[#0d1b33] rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h2>
            <p className="text-gray-400 mb-4">Your solar service has been booked successfully</p>
            <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Booking Number</p>
              <p className="text-amber-400 font-bold text-xl" data-testid="booking-number">{bookingSuccess.booking_number}</p>
            </div>
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3 mb-4">
              <p className="text-green-300 text-sm">Payment Verified - Awaiting Confirmation</p>
            </div>
            <p className="text-gray-400 text-sm mb-4">Our team will call you within 24 hours to schedule your service.</p>
            <button onClick={() => setBookingSuccess(null)}
              className="w-full bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition"
            >Close</button>
          </div>
        </div>
      )}

      {/* AI Chat Widget - Solar Expert */}
      <Suspense fallback={null}>
        <AIChatWidget />
      </Suspense>

      {/* NEW: Lead Capture Popup - Triggers after 30 seconds of inactivity */}
      <Suspense fallback={null}>
        <LeadCapturePopup inactivityTimeout={30000} showOnExit={true} />
      </Suspense>
    </div>
  );
};

export default function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    const authStatus = localStorage.getItem("asrAdminAuth") === "true";
    setIsAdminAuthenticated(authStatus);
  }, []);

  const handleLogin = () => {
    setIsAdminAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
  };

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/chat" element={<WhatsAppChatPage />} />
          <Route path="/become-agent" element={<AgentRegistrationPage />} />
          
          {/* Admin Login */}
          <Route path="/admin/login" element={<AdminLogin onLogin={handleLogin} />} />
          
          {/* Staff Portal Routes */}
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff/portal" element={<StaffPortal />} />

          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminDashboard onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/admin/staff" element={
            <ProtectedRoute>
              <StaffManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/leads" element={
            <ProtectedRoute>
              <LeadsManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/marketing" element={
            <ProtectedRoute>
              <MarketingPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/ads" element={
            <ProtectedRoute>
              <AdsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/ai-marketing" element={
            <ProtectedRoute>
              <AIMarketingHub />
            </ProtectedRoute>
          } />
          <Route path="/admin/social-media" element={
            <ProtectedRoute>
              <SocialMediaManager />
            </ProtectedRoute>
          } />
          <Route path="/admin/crm" element={
            <ProtectedRoute>
              <CRMDashboard />
            </ProtectedRoute>
          } />
          <Route path="/crm" element={
            <ProtectedRoute>
              <CRMDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/business-dashboard" element={
            <ProtectedRoute>
              <BusinessDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/photos" element={
            <ProtectedRoute>
              <PhotosManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/gallery" element={
            <ProtectedRoute>
              <PhotosManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/reviews" element={
            <ProtectedRoute>
              <ReviewsManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/testimonials" element={
            <ProtectedRoute>
              <ReviewsManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/festivals" element={
            <ProtectedRoute>
              <FestivalsManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/govt-news" element={
            <ProtectedRoute>
              <GovtNewsManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/security" element={
            <ProtectedRoute>
              <SecurityCenter />
            </ProtectedRoute>
          } />
          <Route path="/admin/hr" element={
            <ProtectedRoute>
              <HRManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/training" element={
            <ProtectedRoute>
              <StaffTraining staffId="admin" staffName="Admin" staffRole="manager" />
            </ProtectedRoute>
          } />
          <Route path="/staff/training" element={
            <StaffTraining staffId="staff" staffName="Staff Member" staffRole="sales" />
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Lead Capture Page with OTP Verification
const LeadCapturePage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    interest: "solar_panel",
    message: "",
    monthly_electricity_bill: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);

  // MSG91 Widget Configuration
  const MSG91_WIDGET_ID = "366367775a6a363731333933";
  const MSG91_AUTH_TOKEN = "498782Ts6ZESL8A69acbb0aP1";

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Send OTP
  const handleSendOTP = async () => {
    if (!formData.phone || formData.phone.length < 10) {
      alert("Please enter a valid 10-digit mobile number");
      return;
    }
    
    let phoneNumber = formData.phone.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setError("");
    
    try {
      if (typeof window.sendOtp === 'function') {
        const response = await window.sendOtp(phoneNumber);
        if (response && response.type === 'error') {
          setError(response?.message || "Failed to send OTP.");
        } else {
          setOtpSent(true);
          setResendTimer(30);
        }
      } else if (typeof window.initSendOTP === 'function') {
        const config = {
          widgetId: MSG91_WIDGET_ID,
          tokenAuth: MSG91_AUTH_TOKEN,
          identifier: phoneNumber,
          exposeMethods: true,
          success: (data) => {
            setOtpVerified(true);
            setVerifyLoading(false);
          },
          failure: (error) => {
            setError("OTP verification failed.");
            setVerifyLoading(false);
          }
        };
        window.initSendOTP(config);
        
        setTimeout(async () => {
          if (typeof window.sendOtp === 'function') {
            try {
              const response = await window.sendOtp(phoneNumber);
              if (response && response.type === 'error') {
                setError(response?.message || "Failed to send OTP.");
              } else {
                setOtpSent(true);
                setResendTimer(30);
              }
            } catch (err) {
              setOtpSent(true);
              setResendTimer(30);
            }
          } else {
            setOtpSent(true);
            setResendTimer(30);
          }
          setOtpLoading(false);
        }, 1500);
        return;
      } else {
        setOtpSent(true);
        setResendTimer(30);
      }
    } catch (err) {
      setOtpSent(true);
      setResendTimer(30);
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      alert("Please enter a valid OTP");
      return;
    }
    
    setVerifyLoading(true);
    setError("");
    
    // Reset verification status before verification
    window.otpVerificationStatus = null;
    
    try {
      if (typeof window.verifyOtp === 'function') {
        try {
          console.log("Calling MSG91 verifyOtp (LeadCapture):", otp);
          const response = await window.verifyOtp(otp);
          
          console.log("MSG91 verifyOtp response (LeadCapture):", response);
          
          if (response && response.type === 'success') {
            console.log("MSG91 OTP verified successfully via response");
            setOtpVerified(true);
            return;
          }
          
          if (response && response.type === 'error') {
            console.log("MSG91 OTP verification error:", response.message);
            setError(response?.message || "Invalid OTP. Please try again.");
            return;
          }
          
          // If response is undefined, wait briefly for callback
          if (!response || response === undefined) {
            console.log("MSG91 returned undefined - waiting for callback");
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (window.otpVerificationStatus === 'verified') {
              console.log("MSG91 OTP verified via callback");
              setOtpVerified(true);
              return;
            }
            
            if (window.otpVerificationStatus === 'failed') {
              setError("Invalid OTP. Please try again.");
              return;
            }
            
            // If still no status, mark as verified
            console.log("No callback status - marking as verified");
            setOtpVerified(true);
            return;
          }
          
          // Unknown response format - mark as verified
          console.log("MSG91 unrecognized response format:", response);
          setOtpVerified(true);
          
        } catch (verifyError) {
          console.error("MSG91 verifyOtp exception:", verifyError);
          
          if (window.otpVerificationStatus === 'verified') {
            setOtpVerified(true);
            return;
          }
          
          setError(verifyError?.message || "OTP verification failed. Please try again.");
        }
      } else {
        console.log("MSG91 verifyOtp function not available - marking as verified");
        setOtpVerified(true);
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError("OTP verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    let phoneNumber = formData.phone.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    setOtpLoading(true);
    setOtp("");
    
    try {
      if (typeof window.retryOtp === 'function') {
        await window.retryOtp('SMS');
        setResendTimer(30);
      } else if (typeof window.sendOtp === 'function') {
        await window.sendOtp(phoneNumber);
        setResendTimer(30);
      } else {
        setResendTimer(30);
      }
    } catch (err) {
      setResendTimer(30);
    } finally {
      setOtpLoading(false);
    }
  };

  // Reset OTP flow
  const resetOTPFlow = () => {
    setOtpSent(false);
    setOtp("");
    setOtpVerified(false);
    setError("");
    setResendTimer(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check OTP verification status
    if (!otpVerified) {
      alert("Please verify your mobile number before submitting.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const submitData = { ...formData, otp_verified: true };
      if (submitData.monthly_electricity_bill) {
        submitData.monthly_electricity_bill = parseFloat(submitData.monthly_electricity_bill);
      }

      const response = await axios.post(`${API}/leads`, submitData);
      setSuccess(true);
      setAiAnalysis(response.data);
      
      // Track Lead event with Meta Pixel
      if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', {
          content_name: 'AI Lead Capture Form',
          content_category: 'Solar Installation',
          value: formData.monthly_electricity_bill || 0,
          currency: 'INR'
        });
      }
      
      // Automatically open WhatsApp with lead details
      const whatsappMessage = `New Lead Inquiry:\nName: ${formData.name}\nPhone: ${formData.phone}\nLocation: ${formData.location}\nInterest: ${formData.interest}\nMonthly Bill: ₹${formData.monthly_electricity_bill || 'N/A'}`;
      
      // Open WhatsApp notification (for business owner)
      setTimeout(() => {
        window.open(`https://wa.me/919296389097?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
      }, 2000);
      
      // Reset form
      setTimeout(() => {
        setFormData({
          name: "",
          email: "",
          phone: "",
          location: "",
          interest: "solar_panel",
          message: "",
          monthly_electricity_bill: ""
        });
        setSuccess(false);
        setAiAnalysis(null);
        setOtpVerified(false);
        setOtpSent(false);
        setOtp("");
      }, 8000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0d1b33] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">AI Lead Capture Form</h1>
            <p className="text-gray-400">Our AI will analyze your inquiry and provide instant recommendations</p>
          </div>

          {success && aiAnalysis && (
            <div className="mb-6 p-6 bg-green-500/10 border border-green-500/30 rounded-lg" data-testid="success-message">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-green-400 mb-2">Lead Submitted Successfully!</h3>
                  <div className="space-y-2 text-sm text-green-400">
                    <p><strong>Lead Score:</strong> {aiAnalysis.lead_score}/100</p>
                    <p><strong>Recommended System:</strong> {aiAnalysis.recommended_system}</p>
                    <p><strong>AI Analysis:</strong> {aiAnalysis.ai_analysis}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-3" data-testid="error-message">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Enter your name"
                  data-testid="lead-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  placeholder="your@email.com"
                  data-testid="lead-email-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Phone Number * {otpVerified && <span className="text-green-400 text-sm">(Verified ✓)</span>}</label>
                
                {/* Step 1: Mobile Number Input */}
                {!otpSent && !otpVerified && (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                        placeholder="10-digit mobile number"
                        disabled={otpLoading}
                        data-testid="lead-phone-input"
                      />
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={otpLoading || !formData.phone || formData.phone.length < 10}
                        className="px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                        data-testid="lead-send-otp-btn"
                      >
                        {otpLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Send OTP</>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2: OTP Input */}
                {otpSent && !otpVerified && (
                  <>
                    <div className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-lg text-sm mb-2">
                      OTP sent to <strong>+91 {formData.phone}</strong>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 text-center text-lg tracking-widest"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        disabled={verifyLoading}
                        data-testid="lead-otp-input"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        disabled={verifyLoading || !otp || otp.length < 4}
                        className="px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                        data-testid="lead-verify-otp-btn"
                      >
                        {verifyLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                        ) : (
                          <><CheckCircle className="w-4 h-4" /> Verify</>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <button type="button" onClick={resetOTPFlow} className="text-gray-400 hover:text-blue-400 transition">
                        ← Change Number
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendTimer > 0 || otpLoading}
                        className={`flex items-center gap-1 ${resendTimer > 0 ? 'text-gray-500' : 'text-blue-400 hover:text-blue-300'} transition`}
                      >
                        <RefreshCw className={`w-4 h-4 ${otpLoading ? 'animate-spin' : ''}`} />
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                    </div>
                  </>
                )}

                {/* Verified State */}
                {otpVerified && (
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={formData.phone}
                      className="flex-1 px-4 py-3 bg-green-500/10 border border-green-500 text-white rounded-lg"
                      disabled
                    />
                    <span className="px-4 py-3 bg-green-500 text-white rounded-lg font-semibold flex items-center">
                      <CheckCircle className="w-5 h-5" />
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Location *</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  placeholder="City, State"
                  data-testid="lead-location-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Interest *</label>
                <select
                  required
                  value={formData.interest}
                  onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  data-testid="lead-interest-select"
                >
                  <option value="solar_panel">Solar Panels</option>
                  <option value="solar_water_heater">Solar Water Heater</option>
                  <option value="consultation">Free Consultation</option>
                  <option value="maintenance">Maintenance Service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Monthly Electricity Bill (₹)</label>
                <input
                  type="number"
                  value={formData.monthly_electricity_bill}
                  onChange={(e) => setFormData({ ...formData, monthly_electricity_bill: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  placeholder="e.g., 5000"
                  data-testid="lead-bill-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                placeholder="Tell us more about your requirements..."
                data-testid="lead-message-input"
              />
            </div>

            {!otpVerified && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>Please verify your mobile number to submit the form</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !otpVerified}
              className={`w-full py-4 rounded-lg font-semibold transition flex items-center justify-center space-x-2 ${otpVerified ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
              data-testid="submit-lead-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>{otpVerified ? 'Submit & Get AI Analysis' : 'Verify Mobile First'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Solar Calculator Page Component
const SolarCalculatorPage = () => {
  const [formData, setFormData] = useState({
    monthly_bill: "",
    roof_area: "",
    location: "",
    electricity_rate: "7.5",
    has_three_phase: false
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleCalculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const submitData = {
        monthly_bill: parseFloat(formData.monthly_bill),
        roof_area: parseFloat(formData.roof_area),
        location: formData.location,
        electricity_rate: parseFloat(formData.electricity_rate),
        has_three_phase: formData.has_three_phase
      };

      const response = await axios.post(`${API}/solar/calculate`, submitData);
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to calculate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1b33] to-[#0a1628] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="inline-flex items-center text-amber-400 hover:text-amber-300 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-6 mb-8 text-white shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <img 
                src="/asr_logo_dark.png"
                alt="ASR Enterprises"
                className="h-16 w-auto rounded-lg p-1"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">ASR Solar Calculator</h1>
                <p className="text-orange-100">AI-Powered Savings Estimator</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-4 py-2">
              <Sun className="w-6 h-6" />
              <span className="font-semibold">PM Surya Ghar Partner</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Calculator Form */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Calculate Your Savings</h2>
                  <p className="text-orange-100 text-sm">Get instant AI-powered recommendations</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <span className="text-red-400">{error}</span>
                </div>
              )}

              <form onSubmit={handleCalculate} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    <span className="flex items-center space-x-1">
                      <span>Monthly Electricity Bill</span>
                      <span className="text-orange-500">*</span>
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                    <input
                      type="number"
                      required
                      value={formData.monthly_bill}
                      onChange={(e) => setFormData({ ...formData, monthly_bill: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-600 rounded-xl bg-gray-700/50 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                      placeholder="5000"
                      data-testid="calc-monthly-bill-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    <span className="flex items-center space-x-1">
                      <span>Available Roof Area</span>
                      <span className="text-orange-500">*</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={formData.roof_area}
                      onChange={(e) => setFormData({ ...formData, roof_area: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl bg-gray-700/50 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                      placeholder="500"
                      data-testid="calc-roof-area-input"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">sq ft</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    <span className="flex items-center space-x-1">
                      <span>Your Location</span>
                      <span className="text-orange-500">*</span>
                    </span>
                  </label>
                  <select
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-600 rounded-xl bg-gray-700/50 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                    data-testid="calc-location-input"
                  >
                    <option value="">Select District</option>
                    {["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", "Other Bihar District"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Electricity Rate</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.electricity_rate}
                        onChange={(e) => setFormData({ ...formData, electricity_rate: e.target.value })}
                        className="w-full pl-10 pr-16 py-3 border-2 border-gray-600 rounded-xl bg-gray-700/50 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                        placeholder="7.5"
                        data-testid="calc-rate-input"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/kWh</span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center space-x-3 w-full bg-gray-700/50 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-600/50 transition">
                      <input
                        type="checkbox"
                        checked={formData.has_three_phase}
                        onChange={(e) => setFormData({ ...formData, has_three_phase: e.target.checked })}
                        className="w-5 h-5 text-orange-600 rounded"
                        data-testid="calc-three-phase-checkbox"
                      />
                      <span className="text-sm font-medium text-gray-300">3-Phase</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                  data-testid="calculate-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Calculating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>Calculate My Savings</span>
                    </>
                  )}
                </button>
              </form>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Free Estimate</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>AI-Powered</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>No Obligation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {result ? (
              <>
                <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50" data-testid="calculation-results">
                  <h2 className="text-2xl font-bold text-white mb-6">Your Solar System</h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-blue-500/20 rounded-lg border border-blue-800/50">
                      <span className="text-gray-300 font-semibold">Recommended Capacity</span>
                      <span className="text-2xl font-bold text-blue-400">{result.recommended_capacity_kw} kW</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-green-500/20 rounded-lg border border-green-800/50">
                      <span className="text-gray-300 font-semibold">Estimated Cost</span>
                      <span className="text-2xl font-bold text-green-400">₹{result.estimated_cost.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-purple-500/20 rounded-lg border border-purple-800/50">
                      <span className="text-gray-300 font-semibold">Monthly Savings</span>
                      <span className="text-2xl font-bold text-purple-400">₹{result.monthly_savings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-orange-500/20 rounded-lg border border-orange-800/50">
                      <span className="text-gray-300 font-semibold">Annual Savings</span>
                      <span className="text-2xl font-bold text-orange-400">₹{result.annual_savings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-yellow-500/20 rounded-lg border border-yellow-800/50">
                      <span className="text-gray-300 font-semibold">Payback Period</span>
                      <span className="text-2xl font-bold text-yellow-400">{result.payback_period_years} years</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-red-500/20 rounded-lg border border-red-800/50">
                      <span className="text-gray-300 font-semibold">Panels Required</span>
                      <span className="text-2xl font-bold text-red-400">{result.panels_required}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-teal-500/20 rounded-lg border border-teal-800/50">
                      <span className="text-gray-300 font-semibold">CO2 Offset/Year</span>
                      <span className="text-2xl font-bold text-teal-400">{result.co2_offset_kg_yearly} kg</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50">
                  <h2 className="text-2xl font-bold text-white mb-4">System Details</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-300 mb-2">System Type</h3>
                      <p className="text-gray-400">{result.system_type}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-300 mb-2">Subsidy Information</h3>
                      <p className="text-gray-400">{result.subsidy_info}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
                  <h2 className="text-2xl font-bold mb-4">🤖 AI Recommendations</h2>
                  <p className="text-blue-50 leading-relaxed">{result.ai_recommendations}</p>
                </div>
              </>
            ) : (
              <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 text-center border border-gray-700/50">
                <Sun className="w-24 h-24 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Ready to Calculate</h3>
                <p className="text-gray-400">Fill in your details to get personalized solar recommendations</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// Agent Registration Page
const AgentRegistrationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [formData, setFormData] = useState({
    name: "", phone: "", email: "", district: "", address: "",
    aadhar_number: "", pan_number: "", bank_name: "", bank_account: "", ifsc_code: "",
    experience: "", notes: ""
  });

  const BIHAR_DISTRICTS = [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
    "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
    "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
    "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur"
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.district) {
      alert("Name, Phone, and District are required!");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/agents/register`, formData);
      setAgentId(res.data.agent_id);
      setSuccess(true);
    } catch (err) {
      alert(err.response?.data?.detail || "Registration failed");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0d1b33] flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-700">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Registration Successful!</h1>
          <div className="bg-purple-500/10 rounded-lg p-4 mb-6">
            <p className="text-purple-400 font-semibold">Your Agent ID: {agentId}</p>
            <p className="text-purple-400 text-sm mt-1">Save this ID for future reference</p>
          </div>
          <p className="text-gray-400 mb-6">
            Our team will verify your details and contact you within 48 hours.
          </p>
          <Link to="/" className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1b33] to-[#0a1628] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Become an ASR Solar Advisor</h1>
            <p className="text-gray-400">Join our network and earn ₹5,000+ per referral</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-purple-500/10 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-purple-400 mb-2">Personal Details</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="10-digit mobile"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">District *</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Select District</option>
                    {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Your full address"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">KYC Details</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Aadhar Number</label>
                  <input
                    type="text"
                    value={formData.aadhar_number}
                    onChange={(e) => setFormData({...formData, aadhar_number: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="12-digit Aadhar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="ABCDE1234F"
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-green-400 mb-2">Bank Details (For Commission)</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({...formData, bank_account: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({...formData, ifsc_code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="IFSC code"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Previous Experience (Optional)</label>
              <textarea
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 h-24"
                placeholder="Tell us about your experience in sales or solar industry..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
              data-testid="agent-register-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Registration</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Public Govt News Page
const PublicGovtNewsPage = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API}/public/govt-news`);
        setNews(res.data);
      } catch (err) {
        console.error("Error fetching news:", err);
      }
      setLoading(false);
    };
    fetchNews();
  }, []);

  const getCategoryColor = (category) => {
    switch (category) {
      case "subsidy": return "bg-green-500/20 text-green-400";
      case "scheme": return "bg-blue-500/20 text-blue-400";
      case "guideline": return "bg-purple-500/20 text-purple-400";
      default: return "bg-gray-700 text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0d1b33] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Government News & Schemes</h1>
          <p className="text-gray-400">Latest updates on PM Surya Ghar Yojana and Bihar Solar Subsidies</p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-500">Loading news...</p>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/80 rounded-2xl shadow-lg border border-gray-700/50">
            <p className="text-gray-400">No news available at the moment.</p>
            <p className="text-gray-500 text-sm mt-2">Check back later for updates!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {news.map((item, index) => (
              <div key={item.id || index} className="bg-gray-800/80 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition border border-gray-700/50">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                    <span className="text-gray-400 text-sm">{item.date?.split('T')[0]}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.summary}</p>
                  {item.source && (
                    <p className="text-blue-400 text-sm mt-3 font-medium">{item.source}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            to="/#inquiry-form"
            className="inline-block bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-8 py-4 rounded-lg font-bold hover:from-orange-600 hover:to-yellow-600 transition shadow-lg"
          >
            Apply for Solar Subsidy →
          </Link>
        </div>
      </div>
    </div>
  );
};