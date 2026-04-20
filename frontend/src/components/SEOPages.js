/**
 * Hyper-Local SEO Pages for ASR Enterprises
 * Solar installation service pages for Patna and nearby districts/cities
 */
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Sun, MapPin, Phone, MessageCircle, CheckCircle, Star, Users, 
  Award, Zap, ArrowRight, Home, Building2, Factory, ChevronRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== SEO DATA FOR LOCATIONS ====================
const LOCATIONS = {
  patna: {
    name: "Patna",
    type: "city",
    state: "Bihar",
    title: "Best Solar Panel Installation in Patna | ASR Enterprises",
    description: "ASR Enterprises offers premium solar panel installation services in Patna, Bihar. Get up to ₹78,000 government subsidy under PM Surya Ghar Yojana. Free site survey, MNRE registered installer.",
    keywords: "solar panel Patna, solar installation Patna, rooftop solar Patna, PM Surya Ghar Patna, solar subsidy Bihar, best solar company Patna",
    nearby: ["Danapur", "Hajipur", "Patna City", "Kankarbagh", "Boring Road", "Bailey Road", "Rajendra Nagar", "Gardanibagh"],
    popularAreas: ["Kankarbagh", "Boring Road", "Bailey Road", "Rajendra Nagar", "Ashok Rajpath", "Patliputra Colony", "Anisabad", "Kadamkuan"],
    pinCodes: ["800001", "800002", "800003", "800004", "800005", "800006", "800007", "800008", "800009", "800010"],
    installationCount: 50,
    avgRating: 4.8
  },
  hajipur: {
    name: "Hajipur",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Hajipur | ASR Enterprises",
    description: "Professional solar panel installation services in Hajipur, Vaishali district. Get government subsidy up to ₹78,000. Free site visit. MNRE approved solar installer.",
    keywords: "solar panel Hajipur, solar installation Hajipur, rooftop solar Vaishali, PM Surya Ghar Hajipur",
    nearby: ["Patna", "Muzaffarpur", "Mahua", "Lalganj", "Jandaha"],
    popularAreas: ["Station Road", "Gandhi Chowk", "Mahnar Road", "Raghopur"],
    pinCodes: ["844101", "844102"],
    installationCount: 15,
    avgRating: 4.7
  },
  muzaffarpur: {
    name: "Muzaffarpur",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Muzaffarpur | ASR Enterprises",
    description: "Leading solar installer in Muzaffarpur. Get PM Surya Ghar Yojana subsidy. Premium solar panels with 25-year warranty. Free consultation.",
    keywords: "solar panel Muzaffarpur, solar installation Muzaffarpur, rooftop solar Muzaffarpur, solar company Muzaffarpur",
    nearby: ["Hajipur", "Sitamarhi", "Vaishali", "Samastipur", "Motihari"],
    popularAreas: ["Mithanpura", "Saraiyaganj", "Juran Chapra", "Brahmpura"],
    pinCodes: ["842001", "842002"],
    installationCount: 12,
    avgRating: 4.6
  },
  gaya: {
    name: "Gaya",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Gaya | ASR Enterprises",
    description: "Trusted solar panel installer in Gaya, Bihar. Government approved under PM Surya Ghar. Up to ₹78,000 subsidy available. Call now for free site survey.",
    keywords: "solar panel Gaya, solar installation Gaya, rooftop solar Gaya, PM Surya Ghar Gaya",
    nearby: ["Bodh Gaya", "Nawada", "Aurangabad", "Jehanabad"],
    popularAreas: ["GB Road", "Swarajpuri Road", "Delha", "Ramshila"],
    pinCodes: ["823001", "823002"],
    installationCount: 8,
    avgRating: 4.5
  },
  bhagalpur: {
    name: "Bhagalpur",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Bhagalpur | ASR Enterprises",
    description: "Expert solar installation in Bhagalpur. MNRE registered installer. Get maximum government subsidy. 25-year panel warranty.",
    keywords: "solar panel Bhagalpur, solar installation Bhagalpur, rooftop solar Bhagalpur",
    nearby: ["Kahalgaon", "Naugachia", "Banka", "Munger"],
    popularAreas: ["Khalifabagh", "Tilkamanjhi", "Adampur", "Sabour"],
    pinCodes: ["812001", "812002"],
    installationCount: 6,
    avgRating: 4.6
  },
  darbhanga: {
    name: "Darbhanga",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Darbhanga | ASR Enterprises",
    description: "Premium solar panel installation in Darbhanga. Avail PM Surya Ghar Yojana benefits. Free consultation and site survey.",
    keywords: "solar panel Darbhanga, solar installation Darbhanga, rooftop solar Darbhanga",
    nearby: ["Madhubani", "Samastipur", "Begusarai", "Muzaffarpur"],
    popularAreas: ["Laheriasarai", "Benta", "Donar", "Baheri"],
    pinCodes: ["846001", "846002", "846003"],
    installationCount: 10,
    avgRating: 4.7
  },
  nalanda: {
    name: "Nalanda",
    type: "district",
    state: "Bihar",
    title: "Solar Panel Installation in Nalanda District | ASR Enterprises",
    description: "Solar installation services across Nalanda district including Bihar Sharif, Rajgir. Government subsidy available.",
    keywords: "solar panel Nalanda, solar installation Bihar Sharif, rooftop solar Rajgir",
    nearby: ["Patna", "Gaya", "Nawada", "Jehanabad"],
    popularAreas: ["Bihar Sharif", "Rajgir", "Hilsa", "Ekangarsarai"],
    pinCodes: ["803101", "803116"],
    installationCount: 7,
    avgRating: 4.5
  },
  vaishali: {
    name: "Vaishali",
    type: "district",
    state: "Bihar",
    title: "Solar Panel Installation in Vaishali District | ASR Enterprises",
    description: "Complete solar solutions in Vaishali district. Includes Hajipur, Mahua, Raghopur. PM Surya Ghar registered.",
    keywords: "solar panel Vaishali, solar installation Vaishali district, rooftop solar Hajipur",
    nearby: ["Patna", "Muzaffarpur", "Samastipur", "Saran"],
    popularAreas: ["Hajipur", "Mahua", "Lalganj", "Raghopur", "Jandaha"],
    pinCodes: ["844101", "844102", "844111"],
    installationCount: 18,
    avgRating: 4.8
  },
  begusarai: {
    name: "Begusarai",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Begusarai | ASR Enterprises",
    description: "Reliable solar panel installation in Begusarai. Get government subsidy under PM Surya Ghar. Quality panels, professional service.",
    keywords: "solar panel Begusarai, solar installation Begusarai, rooftop solar Begusarai",
    nearby: ["Samastipur", "Khagaria", "Munger", "Lakhisarai"],
    popularAreas: ["Barauni", "Teghra", "Bachhwara", "Matihani"],
    pinCodes: ["851101", "851129"],
    installationCount: 5,
    avgRating: 4.6
  },
  samastipur: {
    name: "Samastipur",
    type: "city",
    state: "Bihar",
    title: "Solar Panel Installation in Samastipur | ASR Enterprises",
    description: "Expert solar installation services in Samastipur. MNRE approved. Maximum subsidy benefits. Free site survey.",
    keywords: "solar panel Samastipur, solar installation Samastipur, rooftop solar Samastipur",
    nearby: ["Darbhanga", "Begusarai", "Muzaffarpur", "Vaishali"],
    popularAreas: ["Patori", "Kalyanpur", "Rosera", "Dalsinghsarai"],
    pinCodes: ["848101", "848102"],
    installationCount: 8,
    avgRating: 4.5
  }
};

// ==================== SCHEMA MARKUP GENERATOR ====================
const generateLocalBusinessSchema = (location) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": `ASR Enterprises - Solar Installation ${location.name}`,
  "image": "https://asrenterprises.in/logo.png",
  "url": `https://asrenterprises.in/solar/${location.name.toLowerCase()}`,
  "telephone": "+919296389097",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": location.name,
    "addressRegion": location.state,
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 25.5941,
    "longitude": 85.1376
  },
  "priceRange": "₹₹",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": location.avgRating,
    "reviewCount": location.installationCount * 2
  },
  "areaServed": [location.name, ...location.nearby]
});

// ==================== LOCATION PAGE COMPONENT ====================
export const LocationPage = () => {
  const { location } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", phone: "", district: "" });
  const [loading, setLoading] = useState(false);
  
  const locationData = LOCATIONS[location?.toLowerCase()];
  
  useEffect(() => {
    if (!locationData) {
      navigate("/solar");
    }
    window.scrollTo(0, 0);
  }, [location, locationData, navigate]);
  
  if (!locationData) {
    return null;
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await fetch(`${API}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: `seo_${location}`,
          district: formData.district || locationData.name
        })
      });
      
      // Redirect to WhatsApp
      const message = `Hello, I'm interested in solar installation in ${locationData.name}. My name is ${formData.name} and phone is ${formData.phone}.`;
      window.open(`https://wa.me/918298389097?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{locationData.title}</title>
        <meta name="description" content={locationData.description} />
        <meta name="keywords" content={locationData.keywords} />
        <meta property="og:title" content={locationData.title} />
        <meta property="og:description" content={locationData.description} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`https://asrenterprises.in/solar/${location}`} />
        <script type="application/ld+json">
          {JSON.stringify(generateLocalBusinessSchema(locationData))}
        </script>
      </Helmet>
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0a355e] to-[#1a4a7e] text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-amber-400 mb-4">
            <MapPin className="w-5 h-5" />
            <span className="text-sm font-medium">{locationData.name}, {locationData.state}</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Solar Panel Installation in {locationData.name}
          </h1>
          
          <p className="text-lg text-gray-300 mb-6 max-w-2xl">
            {locationData.description}
          </p>
          
          <div className="flex flex-wrap gap-4 mb-8">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <Star className="w-4 h-4 text-amber-400" />
              <span>{locationData.avgRating} Rating</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <Users className="w-4 h-4 text-green-400" />
              <span>{locationData.installationCount}+ Installations</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <Award className="w-4 h-4 text-blue-400" />
              <span>MNRE Registered</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <a 
              href="tel:9296389097"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition"
            >
              <Phone className="w-5 h-5" />
              Call Now: 9296389097
            </a>
            <a 
              href={`https://wa.me/918298389097?text=${encodeURIComponent(`Hi, I need solar installation in ${locationData.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0a355e] px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-100 transition"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Enquiry
            </a>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Services Section */}
            <section className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-[#0a355e] mb-6 flex items-center gap-2">
                <Sun className="w-6 h-6 text-amber-500" />
                Solar Services in {locationData.name}
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { icon: Home, title: "Residential Solar", desc: "1-10 kW systems for homes" },
                  { icon: Building2, title: "Commercial Solar", desc: "10-100 kW for businesses" },
                  { icon: Factory, title: "Industrial Solar", desc: "Large scale installations" },
                  { icon: Zap, title: "On-Grid Systems", desc: "Net metering with BSPHCL" }
                ].map((service, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <service.icon className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{service.title}</h3>
                      <p className="text-sm text-gray-500">{service.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            
            {/* Subsidy Info */}
            <section className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
              <h2 className="text-2xl font-bold mb-4">
                PM Surya Ghar Yojana Subsidy in {locationData.name}
              </h2>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold">₹30,000</p>
                  <p className="text-sm opacity-90">per kW (up to 2 kW)</p>
                </div>
                <div className="bg-white/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold">₹18,000</p>
                  <p className="text-sm opacity-90">per kW (2-3 kW)</p>
                </div>
                <div className="bg-white/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold">₹78,000</p>
                  <p className="text-sm opacity-90">Maximum Subsidy</p>
                </div>
              </div>
              
              <p className="text-sm opacity-90">
                * Subsidy directly credited to your bank account after installation verification by BSPHCL
              </p>
            </section>
            
            {/* Service Areas */}
            <section className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-[#0a355e] mb-4">
                Areas We Serve in {locationData.name}
              </h2>
              
              <div className="flex flex-wrap gap-2 mb-6">
                {locationData.popularAreas.map((area, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {area}
                  </span>
                ))}
              </div>
              
              <h3 className="font-semibold text-gray-800 mb-2">Nearby Cities & Districts</h3>
              <div className="flex flex-wrap gap-2">
                {locationData.nearby.map((place, i) => (
                  <Link 
                    key={i}
                    to={`/solar/${place.toLowerCase().replace(/\s+/g, '-')}`}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition"
                  >
                    {place}
                  </Link>
                ))}
              </div>
            </section>
            
            {/* Why Choose Us */}
            <section className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-[#0a355e] mb-6">
                Why Choose ASR Enterprises in {locationData.name}?
              </h2>
              
              <div className="space-y-4">
                {[
                  "MNRE & BSPHCL Registered Installer",
                  "25+ Years Panel Warranty",
                  "Free Site Survey & Consultation",
                  "PM Surya Ghar Yojana Documentation Support",
                  "Post-Installation Service & Maintenance",
                  "Transparent Pricing - No Hidden Costs",
                  "Expert Installation Team",
                  "Net Metering Setup Assistance"
                ].map((point, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{point}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          
          {/* Right Sidebar - Enquiry Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-lg sticky top-4">
              <h3 className="text-xl font-bold text-[#0a355e] mb-4">
                Get Free Quote for {locationData.name}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Your Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter your name"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter phone number"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Area/Locality</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="">Select Area</option>
                    {locationData.popularAreas.map((area, i) => (
                      <option key={i} value={area}>{area}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition flex items-center justify-center gap-2"
                >
                  {loading ? "Submitting..." : (
                    <>
                      Get Free Quote
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center mb-3">Or contact us directly</p>
                <div className="space-y-2">
                  <a 
                    href="tel:9296389097"
                    className="flex items-center justify-center gap-2 w-full py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition"
                  >
                    <Phone className="w-4 h-4" />
                    9296389097
                  </a>
                  <a 
                    href={`https://wa.me/918298389097?text=${encodeURIComponent(`Hi, I need solar in ${locationData.name}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Other Locations */}
      <section className="bg-[#0a355e] text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Solar Installation Services Across Bihar
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Object.entries(LOCATIONS).map(([slug, loc]) => (
              <Link
                key={slug}
                to={`/solar/${slug}`}
                className={`px-4 py-2 rounded-lg text-center transition ${
                  slug === location 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {loc.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
      
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-gray-600">
          <Link to="/" className="hover:text-amber-600">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/solar" className="hover:text-amber-600">Solar Services</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-800 font-medium">{locationData.name}</span>
        </div>
      </div>
    </div>
  );
};

// ==================== SOLAR SERVICES LANDING PAGE ====================
export const SolarServicesPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Solar Panel Installation Services in Bihar | ASR Enterprises</title>
        <meta name="description" content="ASR Enterprises provides professional solar panel installation services across Bihar. PM Surya Ghar Yojana registered. Free site survey, best prices, 25-year warranty." />
        <meta name="keywords" content="solar panel Bihar, solar installation Bihar, rooftop solar Bihar, PM Surya Ghar Bihar, solar company Bihar" />
      </Helmet>
      
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0a355e] to-[#1a4a7e] text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Solar Panel Installation in Bihar
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            ASR Enterprises - Your Trusted MNRE Registered Solar Installer. 
            Get up to ₹78,000 Government Subsidy under PM Surya Ghar Yojana.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="tel:9296389097"
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 transition"
            >
              <Phone className="w-5 h-5" />
              Call: 9296389097
            </a>
            <a 
              href="https://wa.me/918298389097?text=Hi, I need solar installation in Bihar"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0a355e] px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-gray-100 transition"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Enquiry
            </a>
          </div>
        </div>
      </div>
      
      {/* Locations Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-[#0a355e] mb-8 text-center">
          Select Your City/District
        </h2>
        
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(LOCATIONS).map(([slug, loc]) => (
            <Link
              key={slug}
              to={`/solar/${slug}`}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition border border-gray-200 hover:border-amber-400 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-800 group-hover:text-amber-600 transition">
                  {loc.name}
                </h3>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400" />
                  {loc.avgRating}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-green-500" />
                  {loc.installationCount}+
                </span>
              </div>
              
              <div className="mt-3 flex items-center gap-1 text-amber-600 text-sm font-medium">
                View Details <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* CTA */}
      <div className="bg-amber-500 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Don't see your location? We still serve you!
          </h2>
          <p className="text-white/90 mb-6">
            ASR Enterprises covers all districts of Bihar. Contact us for solar installation anywhere in Bihar.
          </p>
          <Link
            to="/#inquiry-form"
            className="inline-flex items-center gap-2 bg-white text-amber-600 px-8 py-4 rounded-full font-bold hover:bg-gray-100 transition"
          >
            Get Free Consultation
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LocationPage;
