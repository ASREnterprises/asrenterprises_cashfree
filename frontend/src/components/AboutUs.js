import { Link } from "react-router-dom";
import { 
  ChevronRight, Sun, Target, Eye, CheckCircle, Users, Award, 
  Shield, Zap, Phone, Mail, MapPin, Sparkles, Leaf, Building2, Home, Instagram, Facebook, MessageSquare
} from "lucide-react";

export const AboutUsPage = () => {
  const whyChooseUs = [
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Complete End-to-End Service",
      description: "From site survey to installation and subsidy assistance — everything under one roof.",
      color: "from-amber-500 to-orange-500"
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "High-Quality Solar Products",
      description: "We use trusted brands and premium components for long life and maximum efficiency.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Government Subsidy Support",
      description: "Full guidance for rooftop solar subsidy schemes to maximize customer savings.",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Experienced Professional Team",
      description: "Skilled technicians ensuring safe, fast, and reliable installation.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      title: "Transparent Pricing",
      description: "No hidden charges — clear quotations and honest consultation.",
      color: "from-teal-500 to-cyan-500"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Strong After-Sales Support",
      description: "Dedicated service assistance for maintenance, monitoring, and performance.",
      color: "from-orange-500 to-red-500"
    }
  ];

  const missions = [
    "To help customers significantly reduce electricity costs through efficient solar solutions.",
    "To deliver high-quality rooftop solar systems using reliable and certified components.",
    "To simplify government subsidy and approval processes for customers.",
    "To ensure professional installation, transparent pricing, and long-term service support.",
    "To contribute towards a greener environment and energy-independent future."
  ];

  return (
    <div className="min-h-screen bg-[#F7FAFC]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header - Premium Solar Corporate Theme */}
      <div className="bg-white/95 backdrop-blur-md border-b border-[#0B3C5D]/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/" className="inline-flex items-center text-[#F5A623] hover:text-[#FFD166] transition font-medium">
            <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      {/* Hero Section - Premium Dark Theme */}
      <div className="relative py-20 overflow-hidden" style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0B3C5D 0%, #071A2E 100%)'
      }}>
        {/* Solar Grid Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#F5A623]/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <img 
                src="/asr_logo_transparent.png" 
                alt="ASR Enterprises" 
                className="h-24 w-auto"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4 font-[Poppins]">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] to-[#FFD166]">ASR Enterprises</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Powering Bihar's Future with Clean, Affordable Solar Energy
            </p>
            {/* MNRE Badge */}
            <div className="mt-8 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-3">
              <Award className="w-5 h-5 text-[#F5A623]" />
              <span className="text-white font-medium">MNRE Registered Solar Vendor</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Company Introduction - Glassmorphism Card */}
        <div className="glass-card bg-white/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/50 shadow-2xl mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[#0B3C5D] mb-6 font-[Poppins]">Who We Are</h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <span className="text-[#F5A623] font-semibold">ASR Enterprises</span> is a professionally managed solar energy solutions company committed to accelerating the adoption of clean and sustainable power across residential, commercial, and industrial sectors.
                </p>
                <p>
                  Based in <span className="text-[#F5A623] font-semibold">Patna, Bihar</span>, we specialize in delivering high-performance rooftop solar systems designed to reduce energy costs, enhance power reliability, and support environmental responsibility.
                </p>
                <p>
                  With a strong focus on quality, innovation, and customer satisfaction, we provide comprehensive end-to-end services including energy assessment, customized system design, government subsidy guidance, professional installation, and dedicated after-sales support.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="premium-card bg-gradient-to-br from-[#F5A623]/10 to-[#FFD166]/10 rounded-2xl p-6 text-center border border-[#F5A623]/30 hover:shadow-lg transition">
                <Home className="w-10 h-10 text-[#F5A623] mx-auto mb-3" />
                <h4 className="text-xl font-bold text-[#0B3C5D]">Residential</h4>
                <p className="text-gray-600 text-sm">Home Solar Solutions</p>
              </div>
              <div className="premium-card bg-gradient-to-br from-[#0B3C5D]/10 to-[#0B3C5D]/5 rounded-2xl p-6 text-center border border-[#0B3C5D]/30 hover:shadow-lg transition">
                <Building2 className="w-10 h-10 text-[#0B3C5D] mx-auto mb-3" />
                <h4 className="text-xl font-bold text-[#0B3C5D]">Commercial</h4>
                <p className="text-gray-600 text-sm">Business Solutions</p>
              </div>
              <div className="premium-card bg-gradient-to-br from-[#00C389]/10 to-[#00C389]/5 rounded-2xl p-6 text-center border border-[#00C389]/30 hover:shadow-lg transition">
                <Leaf className="w-10 h-10 text-[#00C389] mx-auto mb-3" />
                <h4 className="text-xl font-bold text-[#0B3C5D]">Eco-Friendly</h4>
                <p className="text-gray-600 text-sm">Sustainable Power</p>
              </div>
              <div className="premium-card bg-gradient-to-br from-[#F5A623]/10 to-[#FFD166]/10 rounded-2xl p-6 text-center border border-[#F5A623]/30 hover:shadow-lg transition">
                <Award className="w-10 h-10 text-[#F5A623] mx-auto mb-3" />
                <h4 className="text-xl font-bold text-[#0B3C5D]">MNRE</h4>
                <p className="text-gray-600 text-sm">Registered Vendor</p>
              </div>
            </div>
          </div>
        </div>

        {/* Our Belief - Premium Gold Section */}
        <div className="text-center mb-16 py-12 px-6 rounded-3xl border border-[#F5A623]/30" style={{
          background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(255,209,102,0.12) 50%, rgba(245,166,35,0.08) 100%)'
        }}>
          <Sun className="w-12 h-12 text-[#F5A623] mx-auto mb-4" />
          <p className="text-2xl md:text-3xl text-[#0B3C5D] font-light max-w-4xl mx-auto italic font-[Poppins]">
            "At ASR Enterprises, we believe solar energy is not just an alternative — 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] to-[#FFD166] font-semibold"> it is the future of smart energy management.</span>"
          </p>
          <p className="text-gray-600 mt-4 max-w-3xl mx-auto">
            Our team is driven by a vision to empower customers with energy independence while contributing to a cleaner, greener, and more sustainable nation.
          </p>
        </div>

        {/* Vision & Mission */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Vision */}
          <div className="premium-card rounded-3xl p-8 relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(255,209,102,0.15) 100%)',
            border: '1px solid rgba(245,166,35,0.3)'
          }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#F5A623]/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#F5A623] to-[#FFD166] rounded-2xl mb-6 shadow-xl">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-[#0B3C5D] mb-4 font-[Poppins]">Our Vision</h3>
              <p className="text-gray-700 leading-relaxed text-lg">
                To become a <span className="text-[#F5A623] font-semibold">leading and most trusted</span> solar energy solutions provider in Bihar and across India by promoting clean, affordable, and sustainable power for every home and business.
              </p>
            </div>
          </div>

          {/* Mission */}
          <div className="premium-card rounded-3xl p-8 relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(11,60,93,0.05) 0%, rgba(11,60,93,0.12) 100%)',
            border: '1px solid rgba(11,60,93,0.2)'
          }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#0B3C5D]/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#0B3C5D] to-[#071A2E] rounded-2xl mb-6 shadow-xl">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-[#0B3C5D] mb-4 font-[Poppins]">Our Mission</h3>
              <ul className="space-y-3">
                {missions.map((mission, index) => (
                  <li key={index} className="flex items-start text-gray-700">
                    <CheckCircle className="w-5 h-5 text-[#00C389] mr-3 mt-0.5 flex-shrink-0" />
                    <span>{mission}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0B3C5D] mb-4 font-[Poppins]">Why Choose Us?</h2>
            <p className="text-gray-600 text-lg">Experience the ASR Enterprises difference</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.map((item, index) => (
              <div 
                key={index}
                className="premium-card bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#F5A623]/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-xl group"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl mb-4 shadow-lg group-hover:shadow-xl transition-shadow`}>
                  <span className="text-white">{item.icon}</span>
                </div>
                <h4 className="text-xl font-bold text-[#0B3C5D] mb-2 font-[Poppins]">{item.title}</h4>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="glass-card bg-white/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/50 shadow-2xl mb-16">
          <h2 className="text-3xl font-bold text-[#0B3C5D] mb-6 text-center font-[Poppins]">Our Core Values</h2>
          <p className="text-gray-700 text-center max-w-4xl mx-auto leading-relaxed text-lg">
            Through <span className="text-[#F5A623] font-semibold">transparent processes</span>, 
            <span className="text-[#F5A623] font-semibold"> ethical business practices</span>, and a 
            <span className="text-[#F5A623] font-semibold"> customer-centric approach</span>, we continue to build lasting relationships and position ourselves as a reliable partner in India's renewable energy transformation.
          </p>
        </div>

        {/* CTA - Premium Gold to Dark Blue Gradient */}
        <div className="text-center rounded-3xl p-10 shadow-2xl relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, #F5A623 0%, #FFD166 30%, #00C389 100%)'
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px),
              linear-gradient(0deg, rgba(255,255,255,0.2) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-[#071A2E] mb-4 font-[Poppins]">Ready to Go Solar?</h2>
            <p className="text-[#071A2E]/80 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers who have made the switch to clean, affordable solar energy with ASR Enterprises.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/contact" 
                className="inline-flex items-center justify-center bg-[#0B3C5D] text-white px-8 py-4 rounded-full font-bold hover:bg-[#071A2E] transition shadow-lg hover:shadow-[0_0_20px_rgba(11,60,93,0.4)]"
              >
                <Phone className="w-5 h-5 mr-2" />
                Contact Us Today
              </Link>
              <a 
                href="https://wa.me/918298389097?text=Hi%20ASR%20Enterprises!%20I'm%20interested%20in%20booking%20a%20solar%20service."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-white text-[#0B3C5D] px-8 py-4 rounded-full font-bold hover:bg-gray-100 transition border-2 border-[#0B3C5D]/20 shadow-lg"
              >
                <Zap className="w-5 h-5 mr-2" />
                Book Solar Service
              </a>
            </div>
            
            {/* Social Media Links */}
            <div className="flex justify-center space-x-4 mt-8">
              <a
                href="https://instagram.com/asr_enterprises_patna"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                aria-label="Instagram"
              >
                <Instagram className="w-6 h-6" />
              </a>
              <a
                href="https://wa.me/918298389097"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 text-white p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                aria-label="WhatsApp"
              >
                <MessageSquare className="w-6 h-6" />
              </a>
              <a
                href="https://www.facebook.com/share/1CU69hsGbJ/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                aria-label="Facebook"
              >
                <Facebook className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Contact Info Bar - Premium Dark Theme */}
      <div className="bg-[#071A2E] border-t border-[#0B3C5D]/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="flex items-center justify-center space-x-3">
              <Phone className="w-6 h-6 text-[#00C389]" />
              <div>
                <p className="text-gray-400 text-sm">Call Us</p>
                <a href="tel:9296389097" className="text-white font-semibold hover:text-[#F5A623] transition">9296389097</a>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <Mail className="w-6 h-6 text-[#00C389]" />
              <div>
                <p className="text-gray-400 text-sm">Email Us</p>
                <a href="mailto:support@asrenterprises.in" className="text-white font-semibold hover:text-[#F5A623] transition">support@asrenterprises.in</a>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <MapPin className="w-6 h-6 text-[#00C389]" />
              <div>
                <p className="text-gray-400 text-sm">Location</p>
                <span className="text-white font-semibold">Patna, Bihar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
