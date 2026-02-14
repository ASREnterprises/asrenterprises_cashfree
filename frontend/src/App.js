import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import { 
  MessageSquare, Calculator, Users, TrendingUp, BarChart3, 
  Zap, Sun, Phone, Mail, MapPin, Menu, X, ChevronRight,
  Send, Loader2, CheckCircle, AlertCircle, Bot, User, Instagram, Facebook, Image, Award
} from "lucide-react";
import { WhatsAppChatPage } from "@/components/WhatsAppChat";
import { MarketingPage } from "@/components/Marketing";
import { AdsPage } from "@/components/Ads";
import { DashboardPage } from "@/components/Dashboard";
import { GalleryPage } from "@/components/Gallery";
import { ContactPage } from "@/components/Contact";
import { TestimonialsSection } from "@/components/Testimonials";
import { AIMarketingHub } from "@/components/AIMarketing";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminDashboard } from "@/components/AdminDashboard";
import { StaffManagement } from "@/components/StaffManagement";
import { PhotosManagement } from "@/components/PhotosManagement";
import { ReviewsManagement } from "@/components/ReviewsManagement";
import { FestivalsManagement } from "@/components/FestivalsManagement";
import { GovtNewsManagement } from "@/components/GovtNewsManagement";
import { SecurityCenter } from "@/components/SecurityCenter";
import { LeadsManagement } from "@/components/LeadsManagement";
import { AnalyticsPage } from "@/components/AnalyticsPage";
import { SocialMediaIntegration } from "@/components/SocialMediaIntegration";
import { CRMDashboard } from "@/components/CRMDashboard";
import { StaffLogin } from "@/components/StaffLogin";
import { StaffPortal } from "@/components/StaffPortal";
import { BusinessDashboard } from "@/components/BusinessDashboard";
import ReCAPTCHA from "react-google-recaptcha";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

// Bihar Districts
const BIHAR_DISTRICTS = [
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
  "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
  "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
  "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
  "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
  "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
];

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
};

// Solar Inquiry Form Component
const SolarInquiryForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    district: "",
    address: "",
    property_type: "residential",
    roof_type: "rcc",
    monthly_bill: "",
    roof_area: "",
    message: ""
  });
  const [honeypot, setHoneypot] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (honeypot) return; // Bot detected
    setLoading(true);
    setError("");
    
    try {
      await axios.post(`${API}/secure-lead`, {
        ...formData,
        monthly_bill: parseFloat(formData.monthly_bill) || null,
        roof_area: parseFloat(formData.roof_area) || null,
        recaptcha_token: recaptchaToken || "",
        website_url: honeypot
      });
      setSuccess(true);
      setFormData({
        name: "", email: "", phone: "", district: "", address: "",
        property_type: "residential", roof_type: "rcc", monthly_bill: "", roof_area: "", message: ""
      });
      setRecaptchaToken(null);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error submitting inquiry. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-[#0a1628] via-[#0f2240] to-[#0a1628] py-20" id="inquiry-form">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Get Free Solar Consultation</h2>
          <p className="text-lg text-gray-300">Fill the form below and our team will contact you within 24 hours</p>
        </div>

        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          {success && (
            <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Thank you! Your inquiry has been submitted. Our team will contact you soon.
            </div>
          )}
          
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot - hidden from users, bots will fill it */}
            <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
              <input type="text" name="website_url" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex="-1" autoComplete="off" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Enter your full name" required data-testid="inquiry-name" />
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Phone Number *</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="10-digit mobile number" required data-testid="inquiry-phone" />
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Email Address *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="your@email.com" required data-testid="inquiry-email" />
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">District (Bihar) *</label>
                <select value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required>
                  <option value="">Select your district</option>
                  {BIHAR_DISTRICTS.map((dist) => (<option key={dist} value={dist}>{dist}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Property Type *</label>
                <select value={formData.property_type} onChange={(e) => setFormData({...formData, property_type: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="agricultural">Agricultural</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Roof Type *</label>
                <select value={formData.roof_type} onChange={(e) => setFormData({...formData, roof_type: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option value="rcc">RCC (Concrete)</option>
                  <option value="tin">Tin/Metal Sheet</option>
                  <option value="asbestos">Asbestos</option>
                  <option value="tile">Tile</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Monthly Electricity Bill (₹)</label>
                <input type="number" value={formData.monthly_bill} onChange={(e) => setFormData({...formData, monthly_bill: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="e.g., 3000" />
              </div>
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Roof Area (sq ft)</label>
                <input type="number" value={formData.roof_area} onChange={(e) => setFormData({...formData, roof_area: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Approximate available roof area" />
              </div>
            </div>
            
            <div>
              <label className="block text-gray-300 font-semibold mb-2">Address</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                placeholder="Your complete address" />
            </div>
            
            <div>
              <label className="block text-gray-300 font-semibold mb-2">Additional Message</label>
              <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
                rows={3} placeholder="Any specific requirements or questions?" />
            </div>

            {RECAPTCHA_SITE_KEY && (
              <div className="flex justify-center">
                <ReCAPTCHA sitekey={RECAPTCHA_SITE_KEY} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} theme="dark" data-testid="recaptcha-widget" />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-lg font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center"
              data-testid="inquiry-submit-btn">
              {loading ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Submitting...</>) : (<><Send className="w-5 h-5 mr-2" />Submit Solar Inquiry</>)}
            </button>

            <p className="text-center text-gray-400 text-sm">
              By submitting, you agree to be contacted by ASR Enterprises for solar consultation.
            </p>
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

  // Razorpay Payment Link
  const RAZORPAY_PAYMENT_LINK = "https://razorpay.me/@asrenterprises9465";

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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-700">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Registration Successful!</h1>
          <p className="text-gray-400 mb-6">
            Thank you for registering with ASR Enterprises. Our team will contact you within 24 hours to schedule your solar consultation.
          </p>
          <div className="bg-green-500/10 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">Payment Received: ₹{registrationFee}</p>
            <p className="text-green-400 text-sm">This amount will be adjusted in your final bill</p>
          </div>
          <Link to="/" className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sun className="w-4 h-4" />
            <span>PM Surya Ghar Yojana Partner</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Book Your Solar Installation</h1>
          <p className="text-gray-400">Register now and get priority service from Bihar's trusted solar experts</p>
        </div>

        <div className="bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 border border-gray-700">
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl p-4 mb-6 text-white">
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
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your phone"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">District</label>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select District</option>
                  {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter your full address"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Property Type</label>
                <select
                  value={formData.property_type}
                  onChange={(e) => setFormData({...formData, property_type: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Monthly Bill (₹)</label>
                <input
                  type="number"
                  value={formData.monthly_bill}
                  onChange={(e) => setFormData({...formData, monthly_bill: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 3000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent h-24 resize-none"
                placeholder="Any specific requirements..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-4 rounded-lg font-bold text-lg hover:from-orange-600 hover:to-yellow-600 transition disabled:opacity-50 flex items-center justify-center space-x-2"
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
      icon: <Calculator className="w-12 h-12" />,
      title: "Solar Calculator",
      description: "Calculate costs, savings, and ROI with AI recommendations",
      color: "bg-yellow-500",
      link: "/calculator"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1b33] to-[#0a1628]">
      {/* Premium Navigation */}
      <nav className="bg-gradient-to-r from-[#0a1628] via-[#0f2240] to-[#0a1628] shadow-2xl sticky top-0 z-50 border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" 
                alt="ASR Enterprises Patna" 
                className="h-16 w-auto"
              />
              <div className="flex flex-col">
                <span className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 tracking-tight leading-tight">ASR ENTERPRISES</span>
                <span className="text-[10px] md:text-xs text-emerald-400 font-medium tracking-wide">Trusted Solar Rooftop Installation Experts in Bihar</span>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-6 items-center">
              <Link to="/" className="text-slate-300 hover:text-amber-400 transition font-medium">Home</Link>
              <Link to="/gallery" className="text-slate-300 hover:text-amber-400 transition font-medium">Gallery</Link>
              <Link to="/calculator" className="text-slate-300 hover:text-amber-400 transition font-medium">Calculator</Link>
              <Link to="/govt-schemes" className="text-slate-300 hover:text-amber-400 transition font-medium">Govt Schemes</Link>
              <Link to="/contact" className="text-slate-300 hover:text-amber-400 transition font-medium">Contact</Link>
              <a href="/admin/login" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-lg hover:from-amber-600 hover:to-orange-600 transition text-sm font-bold shadow-lg">Login</a>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-white"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-slate-800 border-t border-slate-700">
            <div className="px-4 py-2 space-y-2">
              <Link to="/" className="block py-2 text-slate-300 hover:text-amber-400">Home</Link>
              <Link to="/gallery" className="block py-2 text-slate-300 hover:text-amber-400">Gallery</Link>
              <Link to="/calculator" className="block py-2 text-slate-300 hover:text-amber-400">Calculator</Link>
              <Link to="/govt-schemes" className="block py-2 text-slate-300 hover:text-amber-400">Govt Schemes</Link>
              <Link to="/contact" className="block py-2 text-slate-300 hover:text-amber-400">Contact</Link>
              <a href="/admin/login" target="_blank" rel="noopener noreferrer" className="block py-2 text-amber-400 font-semibold">Login (Admin/Staff)</a>
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
              href="https://wa.me/918877896889?text=Happy%20Festive%20Season!%20I%20want%20to%20know%20about%20solar%20offers"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-600 transition text-sm"
            >
              Get Festive Offer
            </a>
          </div>
        </div>
      )}

      {/* Hero Section - Premium Corporate Design */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px'}}></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="text-center">
            {/* Premium Running Banner */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 py-3 rounded-xl mb-8 relative overflow-hidden shadow-2xl border border-amber-400/30">
              <a
                href="https://wa.me/918877896889?text=Hi!%20I%20saw%20your%20flash%20offer%20and%20I'm%20interested%20in%20solar%20installation!"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="animate-marquee whitespace-nowrap flex items-center">
                  <span className="mx-8 text-white font-bold text-sm md:text-base flex items-center">
                    3kW Solar System @ ₹1,32,000 (After ₹78,000 Govt Subsidy) - LIMITED TIME!
                  </span>
                  <span className="mx-8 text-amber-100 font-bold text-sm md:text-base flex items-center">
                    💰 Save ₹8,500/Month on Electricity Bills - 25 Year Warranty!
                  </span>
                  <span className="mx-8 text-white font-bold text-sm md:text-base flex items-center">
                    🛠️ 5 Year FREE Maintenance Included!
                  </span>
                  <span className="mx-8 text-amber-100 font-bold text-sm md:text-base flex items-center">
                    📞 Call Now: 8877896889 | WhatsApp for Instant Quote!
                  </span>
                  <span className="mx-8 text-white font-bold text-sm md:text-base flex items-center">
                    3kW Solar System @ ₹1,32,000 (After ₹78,000 Govt Subsidy) - LIMITED TIME!
                  </span>
                </div>
              </a>
            </div>

            {/* Corporate Tagline */}
            <p className="text-lg md:text-xl text-blue-200 italic mb-4 max-w-3xl mx-auto font-light tracking-wide">
              "Powering Bihar's Future with Clean, Affordable Solar Energy"
            </p>
            
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-full mb-8 border border-white/20">
              <Award className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium">MNRE Bihar Registered Vendor | GSTIN: 10CCFPK3447Q3ZD</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              <span className="text-white">Transform Your Energy Future with</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500">
                Solar Rooftop Solutions
              </span>
            </h1>
            
            <p className="text-xl text-blue-100 max-w-4xl mx-auto mb-6 leading-relaxed">
              ASR Enterprises is Bihar's trusted solar rooftop installation company, committed to delivering reliable and cost-effective renewable energy solutions. We specialize in design, supply, installation, and maintenance under government-approved schemes including <strong className="text-amber-400">PM Surya Ghar Yojana</strong>.
            </p>
            
            <p className="text-lg text-blue-200/80 max-w-3xl mx-auto mb-10">
              Our mission: Making solar energy <strong className="text-white">affordable and accessible</strong> across Bihar with customized solutions that deliver long-term savings and sustainable value.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/30 border border-amber-400/30"
                data-testid="book-now-btn"
              >
                <Zap className="w-5 h-5" />
                <span>Book Now @ ₹1,500</span>
              </button>
              <a
                href="tel:8877896889"
                className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition flex items-center justify-center space-x-2 border border-white/20"
                data-testid="call-now-btn"
              >
                <Phone className="w-5 h-5" />
                <span>Call Now: 8877896889</span>
              </a>
              <a
                href="https://wa.me/918877896889?text=Hi%20ASR%20Enterprises!%20I'm%20interested%20in%20solar%20rooftop%20installation."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-emerald-600 transition flex items-center justify-center space-x-2 shadow-lg"
                data-testid="whatsapp-btn"
              >
                <MessageSquare className="w-5 h-5" />
                <span>WhatsApp Us</span>
              </a>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
              <button
                onClick={() => document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition shadow-lg"
                data-testid="free-consultation-btn"
              >
                Request Free Consultation
              </button>
              <button
                onClick={() => navigate('/calculator')}
                className="bg-white/10 backdrop-blur-sm text-white border border-white/30 px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition"
                data-testid="try-calculator-btn"
              >
                Calculate Savings
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-white/90">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>25+ Happy Customers</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-white/90">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span>MNRE Registered</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-white/90">
                <CheckCircle className="w-4 h-4 text-amber-400" />
                <span>PM Surya Ghar Partner</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-white/90">
                <CheckCircle className="w-4 h-4 text-purple-400" />
                <span>Free Site Survey</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brands We Offer Section */}
      <div className="bg-[#0d1b33] py-12 border-y border-gray-700/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Top Solar Brands We Offer</h2>
            <p className="text-gray-400">Premium quality solar panels from India's leading manufacturers</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* TATA Power Solar */}
            <div className="bg-gray-800/60 border-2 border-gray-700/50 rounded-xl p-4 text-center hover:shadow-xl hover:border-blue-500/50 transition-all hover:-translate-y-1 group">
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/2ec9e58fd2abff0bdf30ff0421355525a7340de1ca2a28c48b166c013ee92e32.png" 
                  alt="TATA Power Solar" 
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-white text-sm">TATA Power Solar</h3>
              <p className="text-xs text-blue-400 mt-1 font-medium">Premium Quality</p>
            </div>
            
            {/* Adani Solar */}
            <div className="bg-gray-800/60 border-2 border-gray-700/50 rounded-xl p-4 text-center hover:shadow-xl hover:border-green-500/50 transition-all hover:-translate-y-1 group">
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/41dcb615eba9ab569f57551b6ff6382956917056e859b5e54978a7c236d87429.png" 
                  alt="Adani Solar" 
                  className="h-10 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-white text-sm">Adani Solar</h3>
              <p className="text-xs text-green-400 mt-1 font-medium">High Efficiency</p>
            </div>
            
            {/* Luminous Solar */}
            <div className="bg-gray-800/60 border-2 border-gray-700/50 rounded-xl p-4 text-center hover:shadow-xl hover:border-red-500/50 transition-all hover:-translate-y-1 group">
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/aec140fce213a04d665f5b8cb77d677357d947b90cf77e9b13525221364096d4.png" 
                  alt="Luminous Solar" 
                  className="h-10 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-white text-sm">Luminous Solar</h3>
              <p className="text-xs text-red-400 mt-1 font-medium">Trusted Brand</p>
            </div>
            
            {/* Loom Solar */}
            <div className="bg-gray-800/60 border-2 border-gray-700/50 rounded-xl p-4 text-center hover:shadow-xl hover:border-orange-500/50 transition-all hover:-translate-y-1 group">
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/cd17c9473d45036b2878ebac38a938b0d04b3405eeef23360c0c5176a762e138.png" 
                  alt="Loom Solar" 
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-white text-sm">Loom Solar</h3>
              <p className="text-xs text-orange-600 mt-1 font-medium">Made in India</p>
            </div>
            
            {/* Waaree Solar */}
            <div className="bg-gray-800/60 border-2 border-gray-700/50 rounded-xl p-4 text-center hover:shadow-xl hover:border-sky-500/50 transition-all hover:-translate-y-1 group">
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/7ec5409d65b483bfe009d1dc7e6a7ee6df1d67bb7a31a531ada18708020e63f7.png" 
                  alt="Waaree Solar" 
                  className="h-10 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-white text-sm">Waaree Solar</h3>
              <p className="text-xs text-sky-600 mt-1 font-medium">Industry Leader</p>
            </div>
            
            {/* Vikram Solar */}
            <div className="bg-gray-800/60 border-2 border-gray-700/50 rounded-xl p-4 text-center hover:shadow-xl hover:border-indigo-500/50 transition-all hover:-translate-y-1 group">
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src="https://static.prod-images.emergentagent.com/jobs/a0aa1b09-c7bd-44f8-9d6e-6ad61d4babe5/images/2bf4384279551841349eac5d02f7b1c15550a0b920a4eda5dca5b62f94302fb0.png" 
                  alt="Vikram Solar" 
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h3 className="font-bold text-white text-sm">Vikram Solar</h3>
              <p className="text-xs text-indigo-600 mt-1 font-medium">Global Standard</p>
            </div>
          </div>
          <div className="text-center mt-8">
            <p className="text-sm text-gray-400 bg-green-500/10 inline-block px-6 py-2 rounded-full">
              <CheckCircle className="w-4 h-4 inline mr-2 text-green-400" />
              All brands come with 25-year performance warranty
            </p>
          </div>
        </div>
      </div>

      {/* Government Benefits Section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">🏛️ Government Benefits for Solar Rooftop Installation</h2>
            <p className="text-orange-100 text-xl">PM Surya Ghar Yojana, MNRE Subsidies & Easy Bank EMI Available</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-gray-800/70 rounded-xl p-6 shadow-2xl border border-gray-700/50">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Award className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Up to ₹78,000 Subsidy</h3>
              <p className="text-gray-400 mb-4">
                Get <strong>₹30,000/kW subsidy for first 2 kW</strong> and ₹18,000/kW for additional capacity under PM Surya Ghar Yojana.
              </p>
              <ul className="text-sm text-gray-300 space-y-2 mb-4">
                <li>✓ 1 kW system: ₹30,000 subsidy</li>
                <li>✓ 2 kW system: ₹60,000 subsidy</li>
                <li>✓ 3 kW system: ₹78,000 subsidy (Maximum)</li>
              </ul>
              <div className="bg-green-500/10 p-3 rounded-lg">
                <p className="text-xs text-green-800 font-semibold">📋 ASR Enterprises handles complete subsidy documentation & approval!</p>
              </div>
            </div>

            <div className="bg-gray-800/70 rounded-xl p-6 shadow-2xl border border-gray-700/50">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Net Metering Benefits</h3>
              <p className="text-gray-400 mb-4">
                Sell excess solar power back to the grid and earn credits on your electricity bill.
              </p>
              <ul className="text-sm text-gray-300 space-y-2 mb-4">
                <li>✓ Reduce bills up to 90%</li>
                <li>✓ Earn from surplus energy</li>
                <li>✓ 25-year panel warranty</li>
                <li>✓ 5-year inverter warranty</li>
                <li>✓ Grid synchronization support</li>
              </ul>
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <p className="text-xs text-blue-800 font-semibold">⚡ Start saving from day one with net metering!</p>
              </div>
            </div>

            <div className="bg-gray-800/70 rounded-xl p-6 shadow-2xl border border-gray-700/50">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Tax Benefits & Easy EMI</h3>
              <p className="text-gray-400 mb-4">
                Enjoy depreciation benefits and easy financing options at low interest rates from leading banks.
              </p>
              <ul className="text-sm text-gray-300 space-y-2 mb-4">
                <li>✓ 80% accelerated depreciation</li>
                <li>✓ Low-interest bank loans (7-9%)</li>
                <li>✓ Easy EMI starting ₹3,000/month</li>
                <li>✓ 3-5 year payback period</li>
                <li>✓ Zero down payment options</li>
              </ul>
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <p className="text-xs text-purple-400 font-semibold">🏦 Partner with all major banks for easy financing</p>
              </div>
            </div>
          </div>

          {/* Additional Government Schemes */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-800/90 rounded-xl p-6 shadow-xl border border-gray-700/50">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <Award className="w-6 h-6 text-orange-600 mr-2" />
                MNRE Rooftop Solar Programme
              </h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ <strong>Grid-Connected Systems:</strong> Central Financial Assistance (CFA) up to 40%</li>
                <li>✓ <strong>Residential Sector:</strong> Priority for subsidy under PM Surya Ghar scheme</li>
                <li>✓ <strong>Commercial Sector:</strong> Accelerated depreciation benefits</li>
                <li>✓ <strong>Industrial Sector:</strong> Custom duty exemptions on solar equipment</li>
                <li>✓ <strong>Institutional Sector:</strong> Special rates and incentives</li>
              </ul>
            </div>

            <div className="bg-gray-800/90 rounded-xl p-6 shadow-xl border border-gray-700/50">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 text-green-400 mr-2" />
                Easy EMI Facilities Available
              </h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ <strong>Green Loans:</strong> Up to ₹10 Lakhs at competitive rates</li>
                <li>✓ <strong>Solar Financing:</strong> Tenure up to 10 years</li>
                <li>✓ <strong>Quick Approval:</strong> Loans approved in 48-72 hours</li>
                <li>✓ <strong>Government Schemes:</strong> PM Solar Panel financing available</li>
                <li>✓ <strong>Zero Processing Fee:</strong> Available for residential customers</li>
                <li>✓ <strong>Flexible Repayment:</strong> Monthly/Quarterly options</li>
                <li>✓ <strong>Interest Rates:</strong> Starting from 7% per annum</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <p className="text-white text-lg font-semibold mb-4">
              🎯 ASR Enterprises - Your One-Stop Solution for Residential & Commercial Solar Installations!
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/#inquiry-form"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-block bg-amber-500 text-white px-8 py-4 rounded-lg font-bold hover:bg-amber-600 transition shadow-lg cursor-pointer"
              >
                Apply for Subsidy Now →
              </Link>
              <a
                href="tel:8877896889"
                className="inline-block bg-green-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-green-700 transition shadow-lg"
              >
                Call for EMI Details →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Powerful AI Features for Your Solar Journey</h2>
          <p className="text-xl text-gray-400">Smart tools to help you make informed decisions</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              onClick={() => navigate(feature.link)}
              className="bg-gray-800/70 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-8 border border-gray-700/50"
              data-testid={`feature-card-${index}`}
            >
              <div className={`${feature.color} text-white w-16 h-16 rounded-lg flex items-center justify-center mb-6`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 mb-4">{feature.description}</p>
              <div className="flex items-center text-blue-400 font-semibold">
                <span>Explore</span>
                <ChevronRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-blue-100">AI Support</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">25+</div>
              <div className="text-blue-100">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100kW+</div>
              <div className="text-blue-100">Total Capacity Installed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="text-blue-100">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Solar Installation Inquiry Form */}
      <SolarInquiryForm />

      {/* Our Work Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Our Recent Solar Installations</h2>
          <p className="text-xl text-gray-400">Proudly serving Bihar with quality solar solutions</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300">
            <img
              src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/xgz3s4do_IMG-20250826-WA0065.jpg"
              alt="Solar Installation in Vaishali"
              className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-bold text-lg">Vaishali Solar Project</h3>
              <p className="text-sm text-gray-200">Residential Installation</p>
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300">
            <img
              src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/q85yfc91_IMG-20250826-WA0070.jpg"
              alt="Solar Installation in Chak Bhoj"
              className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-bold text-lg">Chak Bhoj Installation</h3>
              <p className="text-sm text-gray-200">Complete Solar Setup</p>
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300">
            <img
              src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/ftxdhwd0_IMG-20250826-WA0064.jpg"
              alt="Solar Panel System"
              className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-bold text-lg">Rooftop Solar System</h3>
              <p className="text-sm text-gray-200">High Efficiency Panels</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            to="/gallery"
            className="inline-flex items-center space-x-2 bg-yellow-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-yellow-700 transition"
            data-testid="view-gallery-btn"
          >
            <Image className="w-5 h-5" />
            <span>View Full Gallery</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Why Choose ASR Enterprises */}
      <div className="bg-gradient-to-br from-[#0a1628] to-[#0d1b33] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Residential & Commercial Services */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">We Install All Types of Solar Rooftop Systems</h2>
            <p className="text-xl text-gray-400">Residential & Commercial Solutions Across Bihar</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-gray-800/70 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition border-2 border-blue-500/30">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 w-16 h-16 rounded-full flex items-center justify-center mr-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white">Residential Solutions</h3>
              </div>
              <p className="text-gray-400 mb-4">Perfect solar rooftop systems for homes and apartments</p>
              <ul className="text-sm text-gray-300 space-y-3 mb-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>1-10 kW Systems:</strong> Ideal for houses, villas, and bungalows</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>On-Grid & Off-Grid:</strong> Choose based on your requirements</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>PM Surya Ghar Subsidy:</strong> Up to 40% subsidy available</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Easy EMI:</strong> Starting ₹3,000/month from banks</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Net Metering:</strong> Sell excess power back to grid</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Quick Installation:</strong> 3-5 days complete setup</span>
                </li>
              </ul>
              <div className="bg-blue-500/10 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-900">💡 Save 85-90% on electricity bills!</p>
              </div>
            </div>

            <div className="bg-gray-800/70 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition border-2 border-green-500/30">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-green-500 to-green-600 w-16 h-16 rounded-full flex items-center justify-center mr-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white">Commercial Solutions</h3>
              </div>
              <p className="text-gray-400 mb-4">High-capacity solar systems for businesses and industries</p>
              <ul className="text-sm text-gray-300 space-y-3 mb-6">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>10-100+ kW Systems:</strong> For factories, offices, hospitals, schools</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Industrial Scale:</strong> Custom solutions for large power requirements</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Tax Benefits:</strong> 80% accelerated depreciation available</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Bank Financing:</strong> Loans available up to ₹1 Crore at 7-9% interest</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>ROI:</strong> 3-4 years payback period with savings</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span><strong>Maintenance:</strong> AMC contracts with 24/7 support</span>
                </li>
              </ul>
              <div className="bg-green-500/10 p-4 rounded-lg">
                <p className="text-sm font-semibold text-green-400">📈 Reduce operational costs by 70%!</p>
              </div>
            </div>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Why Choose ASR Enterprises?</h2>
            <p className="text-xl text-gray-400">Your trusted partner for solar energy in Bihar</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg hover:shadow-2xl transition text-center border border-gray-700/50">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">MNRE Registered</h3>
              <p className="text-gray-400">Official MNRE Bihar vendor ensuring quality and compliance</p>
            </div>

            <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg hover:shadow-2xl transition text-center border border-gray-700/50">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">End-to-End Support</h3>
              <p className="text-gray-400">From site survey to after-sales service - we handle everything</p>
            </div>

            <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg hover:shadow-2xl transition text-center border border-gray-700/50">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Subsidy Guidance</h3>
              <p className="text-gray-400">Complete documentation and approval support for PM Surya Ghar</p>
            </div>

            <div className="bg-gray-800/70 rounded-xl p-6 shadow-lg hover:shadow-2xl transition text-center border border-gray-700/50">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Trusted Brands</h3>
              <p className="text-gray-400">High-quality panels with 25-year performance warranty</p>
            </div>
          </div>

          <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-700/50">
            <h3 className="text-3xl font-bold text-white text-center mb-8">Our Installation Process</h3>
            <div className="grid md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">1</div>
                <h4 className="font-bold text-white mb-2">Free Site Survey</h4>
                <p className="text-sm text-gray-400">Expert assessment of your property</p>
              </div>
              <div className="text-center">
                <div className="bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">2</div>
                <h4 className="font-bold text-white mb-2">System Design</h4>
                <p className="text-sm text-gray-400">Customized solar solution proposal</p>
              </div>
              <div className="text-center">
                <div className="bg-yellow-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">3</div>
                <h4 className="font-bold text-white mb-2">Subsidy Approval</h4>
                <p className="text-sm text-gray-400">Complete documentation support</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">4</div>
                <h4 className="font-bold text-white mb-2">Installation</h4>
                <p className="text-sm text-gray-400">Professional setup in 3-5 days</p>
              </div>
              <div className="text-center">
                <div className="bg-red-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">5</div>
                <h4 className="font-bold text-white mb-2">After-Sales</h4>
                <p className="text-sm text-gray-400">Ongoing maintenance & support</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI-Powered Special Offers & Promotions */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 py-16 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-yellow-400 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full filter blur-3xl animate-pulse"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Zap className="w-4 h-4" />
              <span>AI-POWERED SMART DEALS</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              Limited Time Offers Just For You!
            </h2>
            <p className="text-xl text-blue-200">Don't miss these exclusive deals - Calculated based on current market rates</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Offer 1 - Flash Sale */}
            <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl p-6 text-white transform hover:scale-105 transition-all duration-300 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-yellow-400 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                FLASH SALE
              </div>
              <div className="mb-4">
                <Sun className="w-12 h-12 text-yellow-300" />
              </div>
              <h3 className="text-2xl font-bold mb-2">3kW Solar System</h3>
              <div className="flex items-baseline space-x-2 mb-3">
                <span className="text-gray-300 line-through text-lg">₹2,10,000</span>
                <span className="text-4xl font-extrabold">₹1,32,000</span>
              </div>
              <p className="text-pink-100 text-sm mb-4">After ₹78,000 govt subsidy • Save ₹8,500/month on bills</p>
              <ul className="text-sm space-y-1 mb-4 text-pink-100">
                <li>✓ 25-year warranty included</li>
                <li>✓ 5-year FREE maintenance</li>
                <li>✓ MNRE approved panels</li>
              </ul>
              <a
                href="https://wa.me/918877896889?text=I'm%20interested%20in%20the%203kW%20Flash%20Sale%20offer!"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-red-600 text-white py-3 rounded-lg font-bold text-center hover:bg-red-700 transition"
              >
                Grab This Deal →
              </a>
            </div>

            {/* Offer 2 - Best Seller */}
            <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl p-6 text-white transform hover:scale-105 transition-all duration-300 shadow-2xl relative overflow-hidden border-4 border-yellow-400">
              <div className="absolute top-0 right-0 bg-yellow-400 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                BEST SELLER
              </div>
              <div className="mb-4">
                <Award className="w-12 h-12 text-yellow-300" />
              </div>
              <h3 className="text-2xl font-bold mb-2">5kW Solar System</h3>
              <div className="flex items-baseline space-x-2 mb-3">
                <span className="text-gray-300 line-through text-lg">₹3,40,000</span>
                <span className="text-4xl font-extrabold">₹2,62,000</span>
              </div>
              <p className="text-teal-100 text-sm mb-4">After ₹78,000 govt subsidy • Power your entire home!</p>
              <ul className="text-sm space-y-1 mb-4 text-teal-100">
                <li>✓ Premium TATA/Adani panels</li>
                <li>✓ 25-year performance warranty</li>
                <li>✓ 5-year FREE maintenance</li>
                <li>✓ Zero electricity bills guarantee</li>
              </ul>
              <a
                href="https://wa.me/918877896889?text=I'm%20interested%20in%20the%205kW%20Best%20Seller%20offer!"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-yellow-400 text-white py-3 rounded-lg font-bold text-center hover:bg-yellow-300 transition"
              >
                Most Popular Choice →
              </a>
            </div>

            {/* Offer 3 - Commercial */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white transform hover:scale-105 transition-all duration-300 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-yellow-400 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                COMMERCIAL
              </div>
              <div className="mb-4">
                <BarChart3 className="w-12 h-12 text-yellow-300" />
              </div>
              <h3 className="text-2xl font-bold mb-2">10kW+ Business Solar</h3>
              <div className="flex items-baseline space-x-2 mb-3">
                <span className="text-4xl font-extrabold">₹64-68/W</span>
              </div>
              <p className="text-blue-200 text-sm mb-4">Custom solutions • 80% tax depreciation benefit</p>
              <ul className="text-sm space-y-1 mb-4 text-blue-200">
                <li>✓ ROI in 3-4 years</li>
                <li>✓ Reduce opex by 70%</li>
                <li>✓ Bank financing at 7-9%</li>
                <li>✓ AMC contract included</li>
              </ul>
              <a
                href="https://wa.me/918877896889?text=I%20need%20a%20commercial%20solar%20solution%20for%20my%20business"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-center hover:bg-blue-700 transition"
              >
                Get Custom Quote →
              </a>
            </div>
          </div>

          {/* Urgency Banner */}
          <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-2xl p-6 text-center shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
              <div className="flex items-center space-x-3">
                <div className="bg-[#0f2240] rounded-full p-3">
                  <Zap className="w-8 h-8 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-xl">Electricity Prices Rising 8% Every Year!</p>
                  <p className="text-yellow-100 text-sm">Lock in FREE solar energy now before rates increase further</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-white bg-opacity-20 backdrop-blur rounded-lg px-4 py-2 text-center">
                  <p className="text-3xl font-bold text-white">₹78K</p>
                  <p className="text-xs text-yellow-100">Max Subsidy</p>
                </div>
                <a
                  href="tel:8877896889"
                  className="bg-amber-500 text-white px-8 py-4 rounded-lg font-bold hover:bg-amber-600 transition shadow-lg flex items-center space-x-2"
                >
                  <Phone className="w-5 h-5" />
                  <span>Call Now: 8877896889</span>
                </a>
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
            <div className="bg-gray-800/30 rounded-xl p-6 backdrop-blur-lg border border-gray-700/30">
              <div className="text-5xl font-bold mb-2">₹5,000</div>
              <p className="text-purple-100">Per successful referral</p>
            </div>
            <div className="bg-gray-800/30 rounded-xl p-6 backdrop-blur-lg border border-gray-700/30">
              <div className="text-5xl font-bold mb-2">FREE</div>
              <p className="text-purple-100">Training & Support</p>
            </div>
            <div className="bg-gray-800/30 rounded-xl p-6 backdrop-blur-lg border border-gray-700/30">
              <div className="text-5xl font-bold mb-2">10%</div>
              <p className="text-purple-100">Commission on deals</p>
            </div>
          </div>
          <Link
            to="/become-agent"
            className="inline-block bg-purple-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-purple-700 transition shadow-lg"
            data-testid="become-agent-btn"
          >
            Register as Solar Advisor →
          </Link>
        </div>
      </div>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" 
                  alt="ASR Enterprises Patna" 
                  className="h-12 w-auto"
                />
              </div>
              <h3 className="text-xl font-bold mb-2">ASR ENTERPRISES</h3>
              <p className="text-gray-400 text-sm mb-4">Leading solar energy solutions provider in Patna, Bihar</p>
              <p className="text-gray-400 text-xs mb-2">GSTIN: 10CCFPK3447Q3ZD</p>
              
              {/* Social Media Links */}
              <div className="flex space-x-4 mt-4">
                <a
                  href="https://instagram.com/asr_enterprises_patna"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-full hover:scale-110 transition-transform"
                  data-testid="instagram-link"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.facebook.com/share/1ALVBDkYKe/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 p-2 rounded-full hover:scale-110 transition-transform"
                  data-testid="facebook-link"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <div className="space-y-2 text-gray-400">
                <div><Link to="/" className="hover:text-white transition">Home</Link></div>
                <div><Link to="/gallery" className="hover:text-white transition">Our Work</Link></div>
                <div><Link to="/leads" className="hover:text-white transition">Lead Capture</Link></div>
                <div><Link to="/calculator" className="hover:text-white transition">Solar Calculator</Link></div>
                <div><Link to="/admin/dashboard" className="hover:text-white transition">Dashboard</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Services</h4>
              <div className="space-y-2 text-gray-400">
                <div><Link to="/chat" className="hover:text-white transition">WhatsApp Support</Link></div>
                <div><Link to="/calculator" className="hover:text-white transition">Solar Calculator</Link></div>
                <div><Link to="/gallery" className="hover:text-white transition">Our Work</Link></div>
                <div><Link to="/contact" className="hover:text-white transition">Get Quote</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contact Us</h4>
              <div className="space-y-3 text-gray-400 text-sm">
                <div className="flex items-start space-x-2">
                  <Phone className="w-4 h-4 mt-1 flex-shrink-0" />
                  <div>
                    <a href="tel:8877896889" className="hover:text-white transition">8877896889</a>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Mail className="w-4 h-4 mt-1 flex-shrink-0" />
                  <div>
                    <a href="mailto:asrenterprisespatna@gmail.com" className="hover:text-white transition break-all">asrenterprisespatna@gmail.com</a>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white mb-1">Office:</p>
                    <p>Shop no 10, AMAN SKS COMPLEX<br/>Khagaul Saguna Road<br/>Patna 801503, Bihar</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white mb-1">Registered:</p>
                    <p>Dawarikapuri, Khagaul<br/>Patna 801105, Bihar</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-yellow-400 pt-2">
                  <Instagram className="w-4 h-4" />
                  <span className="font-semibold">@asr_enterprises_patna</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p className="text-sm">© 2025 ASR ENTERPRISES. All rights reserved.</p>
            <p className="text-xs mt-2">GSTIN: 10CCFPK3447Q3ZD | Patna, Bihar</p>
            <p className="text-xs mt-1">Powered by AI | Follow us: @asr_enterprises_patna</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3">
        <a
          href="https://wa.me/918877896889?text=Hi%20ASR%20Enterprises!%20I'm%20interested%20in%20solar%20rooftop%20installation."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 transition-all hover:scale-110 group relative"
          data-testid="whatsapp-float-btn"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Chat on WhatsApp
          </span>
        </a>
        
        <a
          href="tel:8877896889"
          className="bg-blue-500 text-white p-4 rounded-full shadow-2xl hover:bg-blue-600 transition-all hover:scale-110 group relative"
          data-testid="call-float-btn"
        >
          <Phone className="w-6 h-6" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Call: 8877896889
          </span>
        </a>
        
        <a
          href="mailto:asrenterprisespatna@gmail.com?subject=Solar Inquiry&body=Hi ASR Enterprises, I'm interested in solar rooftop installation."
          className="bg-red-500 text-white p-4 rounded-full shadow-2xl hover:bg-red-600 transition-all hover:scale-110 group relative"
          data-testid="email-float-btn"
        >
          <Mail className="w-6 h-6" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            Email Us
          </span>
        </a>
      </div>
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
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/calculator" element={<SolarCalculatorPage />} />
        <Route path="/chat" element={<WhatsAppChatPage />} />
        <Route path="/register" element={<ServiceRegistration />} />
        <Route path="/registration-success" element={<ServiceRegistration />} />
        <Route path="/become-agent" element={<AgentRegistrationPage />} />
        <Route path="/govt-schemes" element={<PublicGovtNewsPage />} />
        
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
            <SocialMediaIntegration />
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
        <Route path="/admin/reviews" element={
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
      </Routes>
    </BrowserRouter>
  );
}

// Lead Capture Page
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const submitData = { ...formData };
      if (submitData.monthly_electricity_bill) {
        submitData.monthly_electricity_bill = parseFloat(submitData.monthly_electricity_bill);
      }

      const response = await axios.post(`${API}/leads`, submitData);
      setSuccess(true);
      setAiAnalysis(response.data);
      
      // Automatically open WhatsApp with lead details
      const whatsappMessage = `New Lead Inquiry:\nName: ${formData.name}\nPhone: ${formData.phone}\nLocation: ${formData.location}\nInterest: ${formData.interest}\nMonthly Bill: ₹${formData.monthly_electricity_bill || 'N/A'}`;
      
      // Open WhatsApp notification (for business owner)
      setTimeout(() => {
        window.open(`https://wa.me/918877896889?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
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
                  <div className="space-y-2 text-sm text-green-800">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                  data-testid="lead-email-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+91XXXXXXXXXX"
                  data-testid="lead-phone-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Location *</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tell us more about your requirements..."
                data-testid="lead-message-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
                  <span>Submit & Get AI Analysis</span>
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
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png"
                alt="ASR Enterprises"
                className="h-16 w-auto bg-[#0f2240] rounded-lg p-1"
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
                <div className="bg-white rounded-2xl shadow-2xl p-8" data-testid="calculation-results">
                  <h2 className="text-2xl font-bold text-white mb-6">Your Solar System</h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-blue-500/10 rounded-lg">
                      <span className="text-gray-300 font-semibold">Recommended Capacity</span>
                      <span className="text-2xl font-bold text-blue-400">{result.recommended_capacity_kw} kW</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                      <span className="text-gray-300 font-semibold">Estimated Cost</span>
                      <span className="text-2xl font-bold text-green-400">₹{result.estimated_cost.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                      <span className="text-gray-300 font-semibold">Monthly Savings</span>
                      <span className="text-2xl font-bold text-purple-400">₹{result.monthly_savings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                      <span className="text-gray-300 font-semibold">Annual Savings</span>
                      <span className="text-2xl font-bold text-orange-600">₹{result.annual_savings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                      <span className="text-gray-300 font-semibold">Payback Period</span>
                      <span className="text-2xl font-bold text-yellow-600">{result.payback_period_years} years</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                      <span className="text-gray-300 font-semibold">Panels Required</span>
                      <span className="text-2xl font-bold text-red-400">{result.panels_required}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-teal-50 rounded-lg">
                      <span className="text-gray-300 font-semibold">CO2 Offset/Year</span>
                      <span className="text-2xl font-bold text-teal-600">{result.co2_offset_kg_yearly} kg</span>
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
              <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
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
            <div className="bg-purple-50 rounded-xl p-4 mb-6">
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
              <h3 className="font-semibold text-green-800 mb-2">Bank Details (For Commission)</h3>
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
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <p className="text-gray-500">No news available at the moment.</p>
            <p className="text-gray-400 text-sm mt-2">Check back later for updates!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {news.map((item, index) => (
              <div key={item.id || index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
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