import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  MessageSquare, Calculator, Users, TrendingUp, BarChart3, 
  Zap, Sun, Phone, Mail, MapPin, Menu, X, ChevronRight,
  Send, Loader2, CheckCircle, AlertCircle, Bot, User, Instagram, Facebook, Image
} from "lucide-react";
import { WhatsAppChatPage } from "@/components/WhatsAppChat";
import { MarketingPage } from "@/components/Marketing";
import { AdsPage } from "@/components/Ads";
import { DashboardPage } from "@/components/Dashboard";
import { GalleryPage } from "@/components/Gallery";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// HomePage Component
const HomePage = () => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
      link: "/leads"
    },
    {
      icon: <Calculator className="w-12 h-12" />,
      title: "Solar Calculator",
      description: "Calculate costs, savings, and ROI with AI recommendations",
      color: "bg-yellow-500",
      link: "/calculator"
    },
    {
      icon: <TrendingUp className="w-12 h-12" />,
      title: "Marketing Automation",
      description: "AI-optimized campaigns across email, SMS, and WhatsApp",
      color: "bg-purple-500",
      link: "/marketing"
    },
    {
      icon: <BarChart3 className="w-12 h-12" />,
      title: "Ads Optimization",
      description: "AI insights for Google & Facebook ad performance",
      color: "bg-red-500",
      link: "/ads"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Sun className="w-8 h-8 text-yellow-500" />
              <span className="text-xl font-bold text-gray-800">ASR Enterprises</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-6">
              <Link to="/" className="text-gray-700 hover:text-blue-600 transition">Home</Link>
              <Link to="/gallery" className="text-gray-700 hover:text-blue-600 transition">Gallery</Link>
              <Link to="/leads" className="text-gray-700 hover:text-blue-600 transition">Leads</Link>
              <Link to="/calculator" className="text-gray-700 hover:text-blue-600 transition">Calculator</Link>
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600 transition">Dashboard</Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-2 space-y-2">
              <Link to="/" className="block py-2 text-gray-700">Home</Link>
              <Link to="/gallery" className="block py-2 text-gray-700">Gallery</Link>
              <Link to="/leads" className="block py-2 text-gray-700">Leads</Link>
              <Link to="/calculator" className="block py-2 text-gray-700">Calculator</Link>
              <Link to="/dashboard" className="block py-2 text-gray-700">Dashboard</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6">
              <Zap className="w-5 h-5" />
              <span className="text-sm font-semibold">AI-Powered Solar Solutions</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
              Transform Your Business with
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-600">
                5 AI-Powered Features
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
              Revolutionize your solar energy business with cutting-edge AI technology. 
              From intelligent chatbots to automated marketing - everything you need in one platform.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => navigate('/leads')}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                data-testid="get-started-btn"
              >
                <span>Get Started</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/calculator')}
                className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition"
                data-testid="try-calculator-btn"
              >
                Try Solar Calculator
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">5 Powerful AI Features</h2>
          <p className="text-xl text-gray-600">Everything you need to scale your solar business</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              onClick={() => navigate(feature.link)}
              className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-8"
              data-testid={`feature-card-${index}`}
            >
              <div className={`${feature.color} text-white w-16 h-16 rounded-lg flex items-center justify-center mb-6`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 mb-4">{feature.description}</p>
              <div className="flex items-center text-blue-600 font-semibold">
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
              <div className="text-4xl font-bold mb-2">100+</div>
              <div className="text-blue-100">Projects Completed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">5X</div>
              <div className="text-blue-100">Lead Quality</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">200+</div>
              <div className="text-blue-100">Happy Customers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Our Work Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Recent Solar Installations</h2>
          <p className="text-xl text-gray-600">Proudly serving Bihar with quality solar solutions</p>
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sun className="w-8 h-8 text-yellow-500" />
                <span className="text-xl font-bold">ASR Enterprises</span>
              </div>
              <p className="text-gray-400">Leading solar energy solutions in Patna, Bihar</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <div className="space-y-2 text-gray-400">
                <div><Link to="/leads" className="hover:text-white transition">Lead Capture</Link></div>
                <div><Link to="/calculator" className="hover:text-white transition">Solar Calculator</Link></div>
                <div><Link to="/dashboard" className="hover:text-white transition">Dashboard</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contact</h4>
              <div className="space-y-2 text-gray-400">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>+91-XXXXXXXXXX</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>info@asrenterprises.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Patna, Bihar</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2025 ASR Enterprises. All rights reserved. Powered by AI.</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <button
        onClick={() => navigate('/chat')}
        className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 transition-all hover:scale-110 z-50"
        data-testid="whatsapp-float-btn"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leads" element={<LeadCapturePage />} />
        <Route path="/calculator" element={<SolarCalculatorPage />} />
        <Route path="/chat" element={<WhatsAppChatPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
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
      }, 5000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Lead Capture Form</h1>
            <p className="text-gray-600">Our AI will analyze your inquiry and provide instant recommendations</p>
          </div>

          {success && aiAnalysis && (
            <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg" data-testid="success-message">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-green-900 mb-2">Lead Submitted Successfully!</h3>
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
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3" data-testid="error-message">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Interest *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Electricity Bill (₹)</label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Calculator Form */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                <Calculator className="w-8 h-8 text-yellow-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Solar Calculator</h1>
              <p className="text-gray-600">Get instant cost estimates and AI recommendations</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            )}

            <form onSubmit={handleCalculate} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Electricity Bill (₹) *</label>
                <input
                  type="number"
                  required
                  value={formData.monthly_bill}
                  onChange={(e) => setFormData({ ...formData, monthly_bill: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="e.g., 5000"
                  data-testid="calc-monthly-bill-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Available Roof Area (sq ft) *</label>
                <input
                  type="number"
                  required
                  value={formData.roof_area}
                  onChange={(e) => setFormData({ ...formData, roof_area: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="e.g., 500"
                  data-testid="calc-roof-area-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location *</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="City, State"
                  data-testid="calc-location-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Electricity Rate (₹/kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.electricity_rate}
                  onChange={(e) => setFormData({ ...formData, electricity_rate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="7.5"
                  data-testid="calc-rate-input"
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.has_three_phase}
                  onChange={(e) => setFormData({ ...formData, has_three_phase: e.target.checked })}
                  className="w-5 h-5 text-yellow-600"
                  data-testid="calc-three-phase-checkbox"
                />
                <label className="text-sm font-semibold text-gray-700">I have three-phase connection</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-600 text-white py-4 rounded-lg font-semibold hover:bg-yellow-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                data-testid="calculate-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="w-5 h-5" />
                    <span>Calculate with AI</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {result ? (
              <>
                <div className="bg-white rounded-2xl shadow-2xl p-8" data-testid="calculation-results">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Solar System</h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">Recommended Capacity</span>
                      <span className="text-2xl font-bold text-blue-600">{result.recommended_capacity_kw} kW</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">Estimated Cost</span>
                      <span className="text-2xl font-bold text-green-600">₹{result.estimated_cost.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">Monthly Savings</span>
                      <span className="text-2xl font-bold text-purple-600">₹{result.monthly_savings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">Annual Savings</span>
                      <span className="text-2xl font-bold text-orange-600">₹{result.annual_savings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">Payback Period</span>
                      <span className="text-2xl font-bold text-yellow-600">{result.payback_period_years} years</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">Panels Required</span>
                      <span className="text-2xl font-bold text-red-600">{result.panels_required}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-teal-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">CO2 Offset/Year</span>
                      <span className="text-2xl font-bold text-teal-600">{result.co2_offset_kg_yearly} kg</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-2xl p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">System Details</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">System Type</h3>
                      <p className="text-gray-600">{result.system_type}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Subsidy Information</h3>
                      <p className="text-gray-600">{result.subsidy_info}</p>
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
                <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Calculate</h3>
                <p className="text-gray-600">Fill in your details to get personalized solar recommendations</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};