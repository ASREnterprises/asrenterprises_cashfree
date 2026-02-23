import { Link } from "react-router-dom";
import { 
  ChevronRight, Sun, Target, Eye, CheckCircle, Users, Award, 
  Shield, Zap, Phone, Mail, MapPin, Sparkles, Leaf, Building2, Home
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
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-sky-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-sky-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/" className="inline-flex items-center text-amber-600 hover:text-amber-500 transition">
            <ChevronRight className="w-5 h-5 rotate-180 mr-1" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <img 
                src="/asr_logo_dark.png" 
                alt="ASR Enterprises" 
                className="h-24 w-auto"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">ASR Enterprises</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Powering Bihar's Future with Clean, Affordable Solar Energy
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Company Introduction */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-gray-700/50 mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Who We Are</h2>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  <span className="text-amber-400 font-semibold">ASR Enterprises</span> is a professionally managed solar energy solutions company committed to accelerating the adoption of clean and sustainable power across residential, commercial, and industrial sectors.
                </p>
                <p>
                  Based in <span className="text-amber-400 font-semibold">Patna, Bihar</span>, we specialize in delivering high-performance rooftop solar systems designed to reduce energy costs, enhance power reliability, and support environmental responsibility.
                </p>
                <p>
                  With a strong focus on quality, innovation, and customer satisfaction, we provide comprehensive end-to-end services including energy assessment, customized system design, government subsidy guidance, professional installation, and dedicated after-sales support.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-6 text-center border border-amber-500/30">
                <Home className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h4 className="text-2xl font-bold text-white">Residential</h4>
                <p className="text-gray-400 text-sm">Home Solar Solutions</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl p-6 text-center border border-blue-500/30">
                <Building2 className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <h4 className="text-2xl font-bold text-white">Commercial</h4>
                <p className="text-gray-400 text-sm">Business Solutions</p>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl p-6 text-center border border-green-500/30">
                <Leaf className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <h4 className="text-2xl font-bold text-white">Eco-Friendly</h4>
                <p className="text-gray-400 text-sm">Sustainable Power</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl p-6 text-center border border-purple-500/30">
                <Award className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <h4 className="text-2xl font-bold text-white">MNRE</h4>
                <p className="text-gray-400 text-sm">Registered Vendor</p>
              </div>
            </div>
          </div>
        </div>

        {/* Our Belief */}
        <div className="text-center mb-16 py-12 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-3xl border border-amber-500/20">
          <Sun className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-2xl md:text-3xl text-white font-light max-w-4xl mx-auto px-4 italic">
            "At ASR Enterprises, we believe solar energy is not just an alternative — 
            <span className="text-amber-400 font-semibold"> it is the future of smart energy management.</span>"
          </p>
          <p className="text-gray-400 mt-4 max-w-3xl mx-auto px-4">
            Our team is driven by a vision to empower customers with energy independence while contributing to a cleaner, greener, and more sustainable nation.
          </p>
        </div>

        {/* Vision & Mission */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Vision */}
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-3xl p-8 border border-amber-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl mb-6 shadow-xl">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">Our Vision</h3>
              <p className="text-gray-300 leading-relaxed text-lg">
                To become a <span className="text-amber-400 font-semibold">leading and most trusted</span> solar energy solutions provider in Bihar and across India by promoting clean, affordable, and sustainable power for every home and business.
              </p>
            </div>
          </div>

          {/* Mission */}
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-3xl p-8 border border-blue-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-6 shadow-xl">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">Our Mission</h3>
              <ul className="space-y-3">
                {missions.map((mission, index) => (
                  <li key={index} className="flex items-start text-gray-300">
                    <CheckCircle className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
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
            <h2 className="text-4xl font-bold text-white mb-4">Why Choose Us?</h2>
            <p className="text-gray-400 text-lg">Experience the ASR Enterprises difference</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseUs.map((item, index) => (
              <div 
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-amber-500/50 transition-all duration-300 hover:transform hover:scale-105 group"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl mb-4 shadow-lg group-hover:shadow-xl transition-shadow`}>
                  <span className="text-white">{item.icon}</span>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                <p className="text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-gray-700/50 mb-16">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Our Core Values</h2>
          <p className="text-gray-300 text-center max-w-4xl mx-auto leading-relaxed text-lg">
            Through <span className="text-amber-400 font-semibold">transparent processes</span>, 
            <span className="text-amber-400 font-semibold"> ethical business practices</span>, and a 
            <span className="text-amber-400 font-semibold"> customer-centric approach</span>, we continue to build lasting relationships and position ourselves as a reliable partner in India's renewable energy transformation.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-10 shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Go Solar?</h2>
          <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have made the switch to clean, affordable solar energy with ASR Enterprises.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center bg-white text-orange-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition shadow-lg"
            >
              <Phone className="w-5 h-5 mr-2" />
              Contact Us Today
            </Link>
            <Link 
              to="/calculator" 
              className="inline-flex items-center justify-center bg-orange-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-orange-700 transition border-2 border-white/30"
            >
              <Zap className="w-5 h-5 mr-2" />
              Calculate Your Savings
            </Link>
          </div>
        </div>

      </div>

      {/* Contact Info Bar */}
      <div className="bg-gray-900/80 border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="flex items-center justify-center space-x-3">
              <Phone className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-gray-400 text-sm">Call Us</p>
                <a href="tel:8877896889" className="text-white font-semibold hover:text-amber-400 transition">8877896889</a>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <Mail className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-gray-400 text-sm">Email Us</p>
                <a href="mailto:asrenterprisespatna@gmail.com" className="text-white font-semibold hover:text-amber-400 transition">asrenterprisespatna@gmail.com</a>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <MapPin className="w-6 h-6 text-amber-400" />
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
