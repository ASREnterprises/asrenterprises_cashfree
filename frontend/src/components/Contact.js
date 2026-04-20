import { Phone, Mail, MapPin, Clock, Award, Facebook, ChevronRight, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

export const ContactPage = () => {
  return (
    <div className="min-h-screen bg-[#F7FAFC]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header - Premium Solar Corporate Theme */}
      <div className="bg-white/95 backdrop-blur-md shadow-lg border-b border-[#0B3C5D]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-[#F5A623] hover:text-[#FFD166] mb-4 font-medium transition">
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Company Header - Premium Light Hero */}
        <div className="text-center mb-16 py-16 -mt-16 -mx-4 sm:-mx-6 lg:-mx-8 px-4 relative overflow-hidden" style={{
          background: 'radial-gradient(circle at 20% 0%, rgba(253,230,138,0.85), transparent 30%), radial-gradient(circle at 80% 5%, rgba(187,247,208,0.78), transparent 32%), linear-gradient(135deg, #FFFBEB 0%, #F8FEFF 50%, #ECFDF5 100%)'
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(16,185,129,0.14) 1px, transparent 1px),
              linear-gradient(0deg, rgba(245,158,11,0.12) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}></div>
          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <img 
                src="/asr_logo_transparent.png" 
                alt="ASR Enterprises Patna" 
                className="h-20 w-auto"
              />
            </div>
            <h1 className="text-5xl font-extrabold text-[#0F3B2E] mb-4 font-[Poppins]">Contact Us</h1>
            <p className="text-xl text-slate-700 max-w-3xl mx-auto">
              Get in touch with Bihar's leading solar energy solutions provider
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Contact Information Card - Premium Glassmorphism */}
          <div className="glass-card bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50">
            <h2 className="text-3xl font-bold text-[#0B3C5D] mb-6 font-[Poppins]">Get In Touch</h2>
            
            <div className="space-y-6">
              {/* Phone */}
              <div className="flex items-start space-x-4 p-4 rounded-2xl transition hover:shadow-lg" style={{
                background: 'linear-gradient(135deg, rgba(0,195,137,0.08) 0%, rgba(0,195,137,0.15) 100%)',
                border: '1px solid rgba(0,195,137,0.2)'
              }}>
                <div className="bg-[#00C389] p-3 rounded-xl shadow-lg">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0B3C5D] mb-1">Phone</h3>
                  <a href="tel:9296389097" className="text-[#00C389] hover:text-[#00A372] text-lg font-medium transition">
                    9296389097
                  </a>
                  <p className="text-sm text-gray-500 mt-1">Available 9 AM - 7 PM</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start space-x-4 p-4 rounded-2xl transition hover:shadow-lg" style={{
                background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.15) 100%)',
                border: '1px solid rgba(245,166,35,0.2)'
              }}>
                <div className="bg-gradient-to-r from-[#F5A623] to-[#FFD166] p-3 rounded-xl shadow-lg">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0B3C5D] mb-1">Email</h3>
                  <a href="mailto:support@asrenterprises.in" className="text-[#F5A623] hover:text-[#FFD166] font-medium break-all transition">
                    support@asrenterprises.in
                  </a>
                  <p className="text-sm text-gray-500 mt-1">We'll respond within 24 hours</p>
                </div>
              </div>

              {/* Office Address */}
              <div className="flex items-start space-x-4 p-4 rounded-2xl transition hover:shadow-lg" style={{
                background: 'linear-gradient(135deg, rgba(11,60,93,0.05) 0%, rgba(11,60,93,0.12) 100%)',
                border: '1px solid rgba(11,60,93,0.15)'
              }}>
                <div className="bg-[#0B3C5D] p-3 rounded-xl shadow-lg">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0B3C5D] mb-1">Office Address</h3>
                  <p className="text-gray-700">
                    Shop no 10, AMAN SKS COMPLEX<br />
                    Khagaul Saguna Road<br />
                    Patna 801503, Bihar
                  </p>
                </div>
              </div>

              {/* Registered Address */}
              <div className="flex items-start space-x-4 p-4 rounded-2xl transition hover:shadow-lg" style={{
                background: 'linear-gradient(135deg, rgba(245,166,35,0.05) 0%, rgba(255,209,102,0.12) 100%)',
                border: '1px solid rgba(245,166,35,0.2)'
              }}>
                <div className="bg-gradient-to-r from-[#F5A623] to-[#FFD166] p-3 rounded-xl shadow-lg">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0B3C5D] mb-1">Registered Office</h3>
                  <p className="text-gray-700 mb-2">
                    Dawarikapuri, Khagaul<br />
                    Patna 801105, Bihar
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>GSTIN:</strong> 10CCFPK3447Q3ZD
                  </p>
                </div>
              </div>

              {/* Business Hours */}
              <div className="flex items-start space-x-4 p-4 rounded-2xl" style={{
                background: 'linear-gradient(135deg, rgba(0,195,137,0.05) 0%, rgba(0,195,137,0.12) 100%)',
                border: '1px solid rgba(0,195,137,0.2)'
              }}>
                <div className="bg-[#00C389] p-3 rounded-xl shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0B3C5D] mb-2">Business Hours</h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p><strong>Monday - Saturday:</strong> 10:00 AM - 7:00 PM</p>
                    <p><strong>Sunday:</strong> Closed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="font-semibold text-[#0B3C5D] mb-4 font-[Poppins]">Follow Us</h3>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://instagram.com/asr_enterprises_patna"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg"
                >
                  <Instagram className="w-5 h-5" />
                  <span className="text-sm font-medium">@asr_enterprises_patna</span>
                </a>
                <a
                  href="https://www.facebook.com/share/1CU69hsGbJ/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-[#0B3C5D] text-white px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg"
                >
                  <Facebook className="w-5 h-5" />
                  <span className="text-sm font-medium">Facebook</span>
                </a>
                <a
                  href="https://wa.me/918298389097"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg"
                >
                  <Phone className="w-5 h-5" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Map / Image Section */}
          <div className="space-y-6">
            {/* Company Info Card - Premium Light Theme */}
            <div className="rounded-3xl shadow-2xl p-8 text-[#0F3B2E] relative overflow-hidden border border-emerald-100" style={{
              background: 'linear-gradient(135deg, #FFFBEB 0%, #ECFDF5 52%, #E0F2FE 100%)'
            }}>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `
                  linear-gradient(90deg, rgba(16,185,129,0.12) 1px, transparent 1px),
                  linear-gradient(0deg, rgba(245,158,11,0.10) 1px, transparent 1px)
                `,
                backgroundSize: '30px 30px'
              }}></div>
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-4 font-[Poppins]">ASR ENTERPRISES</h2>
                <p className="text-slate-600 mb-6 text-lg">
                  Leading solar energy solutions provider in Patna, Bihar. Trusted by 25+ customers across the region.
                </p>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white/75 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100">
                    <div className="text-3xl font-bold text-[#FFD166]">25+</div>
                    <div className="text-slate-500 text-sm">Customers</div>
                  </div>
                  <div className="bg-white/75 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100">
                    <div className="text-3xl font-bold text-[#00C389]">100kW+</div>
                    <div className="text-slate-500 text-sm">Capacity</div>
                  </div>
                  <div className="bg-white/75 backdrop-blur-sm rounded-2xl p-4 border border-amber-100">
                    <div className="text-3xl font-bold text-[#FFD166]">MNRE</div>
                    <div className="text-slate-500 text-sm">Registered</div>
                  </div>
                  <div className="bg-white/75 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100">
                    <div className="text-3xl font-bold text-[#00C389]">5 Star</div>
                    <div className="text-slate-500 text-sm">Rating</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Services Card - Premium Glassmorphism */}
            <div className="glass-card bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/50">
              <h3 className="text-2xl font-bold text-[#0B3C5D] mb-4 font-[Poppins]">Our Services</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C389] rounded-full"></div>
                  <span>Residential Solar Installations</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C389] rounded-full"></div>
                  <span>Commercial Solar Solutions</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C389] rounded-full"></div>
                  <span>Solar Water Heaters</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C389] rounded-full"></div>
                  <span>Maintenance & Support</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C389] rounded-full"></div>
                  <span>Free Consultation & Site Survey</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C389] rounded-full"></div>
                  <span>Government Subsidy Assistance</span>
                </li>
              </ul>
            </div>

            {/* Quick Actions - Premium Theme */}
            <div className="rounded-3xl shadow-xl p-8" style={{
              background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(255,209,102,0.15) 100%)',
              border: '1px solid rgba(245,166,35,0.3)'
            }}>
              <h3 className="text-2xl font-bold text-[#0B3C5D] mb-4 font-[Poppins]">Quick Actions</h3>
              <div className="space-y-3">
                <a
                  href="https://wa.me/918298389097?text=Hi%20ASR%20Enterprises!%20I'm%20interested%20in%20solar%20installation."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] py-3 rounded-full font-bold text-center hover:shadow-lg transition shadow-md"
                >
                  WhatsApp Inquiry
                </a>
                <Link
                  to="/#inquiry-form"
                  className="block w-full bg-[#00C389] text-white py-3 rounded-full font-bold text-center hover:bg-[#00A372] transition shadow-md hover:shadow-[0_0_15px_rgba(0,195,137,0.3)]"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = '/#inquiry-form';
                  }}
                >
                  Request Free Consultation
                </Link>
                <Link
                  to="/gallery"
                  className="block w-full bg-[#0B3C5D] text-white py-3 rounded-full font-bold text-center hover:bg-[#071A2E] transition shadow-md"
                >
                  View Our Projects
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Why Choose Us - Premium Dark Section */}
        <div className="rounded-3xl shadow-2xl p-8 md:p-12 relative overflow-hidden" style={{
          background: 'radial-gradient(ellipse at 50% 100%, #0B3C5D 0%, #071A2E 100%)'
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white text-center mb-8 font-[Poppins]">Why Choose ASR ENTERPRISES?</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="bg-[#F5A623]/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-[#F5A623]" />
                </div>
                <h3 className="font-bold text-white mb-2">Certified & Licensed</h3>
                <p className="text-sm text-gray-300">GSTIN registered with quality certifications</p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="bg-[#00C389]/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-[#00C389]" />
                </div>
                <h3 className="font-bold text-white mb-2">25+ Projects</h3>
                <p className="text-sm text-gray-300">Growing track record across Bihar</p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="bg-[#FFD166]/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-[#FFD166]" />
                </div>
                <h3 className="font-bold text-white mb-2">Best Prices</h3>
                <p className="text-sm text-gray-300">Competitive rates with quality guarantee</p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="bg-[#F5A623]/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-[#F5A623]" />
                </div>
                <h3 className="font-bold text-white mb-2">24/7 Support</h3>
                <p className="text-sm text-gray-300">Always here for your solar needs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
