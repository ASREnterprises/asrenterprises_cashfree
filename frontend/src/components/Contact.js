import { Phone, Mail, MapPin, Clock, Award, Instagram, Facebook, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export const ContactPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1b33] to-[#0a1628]">
      {/* Header */}
      <div className="bg-[#0a1628] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Company Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <img 
              src="/asr_logo_dark.png" 
              alt="ASR Enterprises Patna" 
              className="h-20 w-auto"
            />
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4">Contact Us</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Get in touch with Bihar's leading solar energy solutions provider
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Contact Information Card */}
          <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50">
            <h2 className="text-3xl font-bold text-white mb-6">Get In Touch</h2>
            
            <div className="space-y-6">
              {/* Phone */}
              <div className="flex items-start space-x-4 p-4 bg-blue-900/30 rounded-lg hover:bg-blue-500/20 transition border border-blue-800/50">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Phone</h3>
                  <a href="tel:8877896889" className="text-blue-400 hover:text-blue-300 text-lg font-medium">
                    8877896889
                  </a>
                  <p className="text-sm text-gray-400 mt-1">Available 9 AM - 7 PM</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start space-x-4 p-4 bg-green-900/30 rounded-lg hover:bg-green-500/20 transition border border-green-800/50">
                <div className="bg-green-500 p-3 rounded-lg">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Email</h3>
                  <a href="mailto:asrenterprisespatna@gmail.com" className="text-green-400 hover:text-green-300 font-medium break-all">
                    asrenterprisespatna@gmail.com
                  </a>
                  <p className="text-sm text-gray-400 mt-1">We'll respond within 24 hours</p>
                </div>
              </div>

              {/* Office Address */}
              <div className="flex items-start space-x-4 p-4 bg-yellow-900/30 rounded-lg hover:bg-yellow-500/20 transition border border-yellow-800/50">
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Office Address</h3>
                  <p className="text-gray-300">
                    Shop no 10, AMAN SKS COMPLEX<br />
                    Khagaul Saguna Road<br />
                    Patna 801503, Bihar
                  </p>
                </div>
              </div>

              {/* Registered Address */}
              <div className="flex items-start space-x-4 p-4 bg-purple-900/30 rounded-lg hover:bg-purple-500/20 transition border border-purple-800/50">
                <div className="bg-purple-500 p-3 rounded-lg">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Registered Office</h3>
                  <p className="text-gray-300 mb-2">
                    Dawarikapuri, Khagaul<br />
                    Patna 801105, Bihar
                  </p>
                  <p className="text-sm text-gray-400">
                    <strong>GSTIN:</strong> 10CCFPK3447Q3ZD
                  </p>
                </div>
              </div>

              {/* Business Hours */}
              <div className="flex items-start space-x-4 p-4 bg-orange-900/30 rounded-lg border border-orange-800/50">
                <div className="bg-orange-500 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Business Hours</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p><strong>Monday - Saturday:</strong> 9:00 AM - 7:00 PM</p>
                    <p><strong>Sunday:</strong> 10:00 AM - 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="font-semibold text-white mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a
                  href="https://instagram.com/asr_enterprises_patna"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:scale-105 transition-transform"
                >
                  <Instagram className="w-5 h-5" />
                  <span>@asr_enterprises_patna</span>
                </a>
                <a
                  href="https://www.facebook.com/share/1C6P7taueZ/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:scale-105 transition-transform"
                >
                  <Facebook className="w-5 h-5" />
                  <span>Facebook</span>
                </a>
              </div>
            </div>
          </div>

          {/* Map / Image Section */}
          <div className="space-y-6">
            {/* Company Info Card */}
            <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl shadow-2xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">ASR ENTERPRISES</h2>
              <p className="text-blue-100 mb-6 text-lg">
                Leading solar energy solutions provider in Patna, Bihar. Trusted by 25+ customers across the region.
              </p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <div className="text-3xl font-bold">25+</div>
                  <div className="text-blue-100 text-sm">Customers</div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <div className="text-3xl font-bold">100kW+</div>
                  <div className="text-blue-100 text-sm">Capacity</div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <div className="text-3xl font-bold">MNRE</div>
                  <div className="text-blue-100 text-sm">Registered</div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <div className="text-3xl font-bold">5★</div>
                  <div className="text-blue-100 text-sm">Rating</div>
                </div>
              </div>
            </div>

            {/* Services Card */}
            <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold text-white mb-4">Our Services</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Residential Solar Installations</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Commercial Solar Solutions</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Solar Water Heaters</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Maintenance & Support</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Free Consultation & Site Survey</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Government Subsidy Assistance</span>
                </li>
              </ul>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/calculator"
                  className="block w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold text-center hover:bg-yellow-700 transition"
                >
                  Calculate Solar Savings
                </Link>
                <Link
                  to="/leads"
                  className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-center hover:bg-blue-700 transition"
                >
                  Request Free Consultation
                </Link>
                <Link
                  to="/gallery"
                  className="block w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-center hover:bg-green-700 transition"
                >
                  View Our Projects
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="bg-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/50 md:p-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Why Choose ASR ENTERPRISES?</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-white mb-2">Certified & Licensed</h3>
              <p className="text-sm text-gray-400">GSTIN registered with quality certifications</p>
            </div>
            <div className="text-center">
              <div className="bg-green-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-white mb-2">25+ Projects</h3>
              <p className="text-sm text-gray-400">Growing track record across Bihar</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="font-bold text-white mb-2">Best Prices</h3>
              <p className="text-sm text-gray-400">Competitive rates with quality guarantee</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-white mb-2">24/7 Support</h3>
              <p className="text-sm text-gray-400">Always here for your solar needs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
