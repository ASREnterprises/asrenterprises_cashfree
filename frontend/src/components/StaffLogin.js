import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { User, Lock, LogIn, Loader2, ArrowLeft } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const StaffLogin = () => {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/staff/login`, {
        staff_id: staffId.toUpperCase(),
        password: password
      });

      if (res.data.success) {
        // Store staff session
        localStorage.setItem("asrStaffAuth", "true");
        localStorage.setItem("asrStaffData", JSON.stringify(res.data.staff));
        localStorage.setItem("asrStaffToken", res.data.token);
        navigate("/staff/portal");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid Staff ID or Password");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Back Link */}
        <Link to="/" className="flex items-center text-gray-400 hover:text-white mb-6 transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        {/* Login Card */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="bg-white rounded-xl p-3 inline-block mb-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" 
                alt="ASR Enterprises" 
                className="h-14 w-auto"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Staff Portal</h1>
            <p className="text-gray-400 mt-2">ASR Enterprises CRM</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Staff ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                  placeholder="ASR1001"
                  className="w-full bg-gray-700 text-white pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                  required
                  data-testid="staff-id-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-gray-700 text-white pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                  data-testid="staff-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !staffId || !password}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition flex items-center justify-center space-x-2 disabled:opacity-50"
              data-testid="staff-login-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Login to Portal</span>
                </>
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Contact admin if you forgot your credentials
            </p>
          </div>

          {/* Admin Link */}
          <div className="mt-6 pt-6 border-t border-gray-700 text-center">
            <Link 
              to="/admin/login" 
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Admin Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
