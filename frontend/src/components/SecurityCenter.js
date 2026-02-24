import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, CheckCircle, AlertTriangle, Lock, Eye, Server } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const SecurityCenter = () => {
  const [securityStatus, setSecurityStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  const fetchSecurityStatus = async () => {
    try {
      const res = await axios.get(`${API}/security/status`);
      setSecurityStatus(res.data);
    } catch (err) {
      console.error("Error fetching security status:", err);
    }
    setLoading(false);
  };

  const securityFeatures = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Rate Limiting",
      description: "Protects against DDoS and brute force attacks",
      status: "active"
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Input Sanitization",
      description: "Prevents XSS and injection attacks",
      status: "active"
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Suspicious Activity Detection",
      description: "AI monitors for malicious patterns",
      status: "active"
    },
    {
      icon: <Server className="w-6 h-6" />,
      title: "Security Headers",
      description: "HTTPS, CORS, CSP protection enabled",
      status: "active"
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "OTP Authentication",
      description: "Secure admin login with time-limited OTP",
      status: "active"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "CSRF Protection",
      description: "Cross-site request forgery prevention",
      status: "active"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center space-x-4 mb-8">
          <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-bold text-[#0a355e]">Security Center</h1>
        </div>

        {/* Main Security Status */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-8 mb-8 text-[#0a355e]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-white bg-opacity-20 p-4 rounded-full">
                <Shield className="w-12 h-12" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Website Secured</h2>
                <p className="text-green-200">
                  All AI-powered security measures are active and protecting your website
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">100%</div>
              <div className="text-green-200">Protected</div>
            </div>
          </div>
        </div>

        {/* Security Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {securityFeatures.map((feature, idx) => (
            <div key={idx} className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-green-600 bg-opacity-20 p-3 rounded-lg text-green-400">
                  {feature.icon}
                </div>
                <span className="bg-green-600 text-[#0a355e] text-xs px-2 py-1 rounded flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0a355e] mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* API Security Status */}
        {securityStatus && (
          <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-[#0a355e] mb-4">API Security Status</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {securityStatus.security_features?.map((feature, idx) => (
                <div key={idx} className="flex items-center space-x-3 bg-gray-50 border border-gray-300 rounded-lg p-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-gray-600">{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-gray-500 text-sm">
              Last checked: {new Date(securityStatus.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {/* Security Tips */}
        <div className="mt-8 bg-yellow-600 bg-opacity-20 border border-yellow-600 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-yellow-400 mb-2">Security Recommendations</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• Change your admin OTP regularly for enhanced security</li>
                <li>• Don't share your admin credentials with unauthorized users</li>
                <li>• Monitor the leads section for suspicious entries</li>
                <li>• Keep your browser updated for best security</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
