import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Sun, LogIn, LogOut, Shield, User, Phone, Mail, MapPin,
  Users, IndianRupee, CheckCircle, Clock, AlertCircle,
  Plus, X, Edit2, Key, ChevronRight, TrendingUp, Eye, EyeOff,
  Search, Download, RefreshCw, Award, Briefcase, Lock,
} from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND}/api`;

const ADV_KEY = "asrAdvisorAuth";
const ADV_TOKEN_KEY = "asrAdvisorToken";

// ========== Helper: storage ==========
const saveAdvisorSession = (advisor, token) => {
  localStorage.setItem(ADV_KEY, JSON.stringify({
    agent_id: advisor.agent_id,
    name: advisor.name,
    phone: advisor.phone,
    email: advisor.email,
    loggedAt: Date.now(),
  }));
  if (token) localStorage.setItem(ADV_TOKEN_KEY, token);
};
const getAdvisorSession = () => {
  try { return JSON.parse(localStorage.getItem(ADV_KEY) || "null"); }
  catch { return null; }
};
const getAdvisorToken = () => localStorage.getItem(ADV_TOKEN_KEY) || "";
const clearAdvisorSession = () => {
  localStorage.removeItem(ADV_KEY);
  localStorage.removeItem(ADV_TOKEN_KEY);
};
const authHeaders = () => ({ headers: { "X-Advisor-Token": getAdvisorToken() } });

// ========== LOGIN PAGE ==========
export const SolarAdvisorLogin = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("password"); // password | otp
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getAdvisorSession()) navigate("/advisor/dashboard");
  }, [navigate]);

  const submitPassword = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/solar-advisor/login`, { user_id: userId, password });
      if (res.data.success) {
        saveAdvisorSession(res.data.advisor, res.data.token);
        navigate("/advisor/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  const sendOtp = async () => {
    setError(""); setLoading(true);
    try {
      await axios.post(`${API}/solar-advisor/login-otp`, { user_id: userId });
      setOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/solar-advisor/verify-otp`, { user_id: userId, otp });
      if (res.data.success) {
        saveAdvisorSession(res.data.advisor, res.data.token);
        navigate("/advisor/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "OTP verification failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-purple-200 hover:text-white mb-4 inline-flex items-center">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back to Login
        </Link>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-3 mb-4 justify-center">
              <img src="/asr_logo_transparent.png" alt="ASR Enterprises" className="h-12 w-auto" />
              <div className="text-left">
                <div className="font-extrabold text-lg text-gray-800">ASR Enterprises</div>
                <div className="text-xs text-purple-600">Solar Advisor Portal</div>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Solar Advisor Login</h1>
            <p className="text-gray-500 text-sm mt-1">Access your earnings & customers</p>
          </div>

          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => { setMode("password"); setError(""); setOtpSent(false); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === "password" ? "bg-white text-purple-700 shadow" : "text-gray-600"}`}>
              Password
            </button>
            <button onClick={() => { setMode("otp"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === "otp" ? "bg-white text-purple-700 shadow" : "text-gray-600"}`}>
              OTP
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile or Email</label>
                <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} required
                  placeholder="10-digit mobile or email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="advisor-login-userid" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Default = your mobile number"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    data-testid="advisor-login-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">First login? Use your mobile number as the password.</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="advisor-login-submit">
                {loading ? "Signing in..." : <><LogIn className="w-4 h-4" /> Login</>}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registered Mobile</label>
                <input type="tel" value={userId} onChange={(e) => setUserId(e.target.value)} required
                  placeholder="10-digit mobile" disabled={otpSent}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100" />
              </div>
              {!otpSent ? (
                <button type="button" onClick={sendOtp} disabled={loading || !userId}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50">
                  {loading ? "Sending..." : "Send OTP"}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                    <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required
                      placeholder="6-digit OTP" maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-xl tracking-widest" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50">
                    {loading ? "Verifying..." : "Verify & Login"}
                  </button>
                  <button type="button" onClick={() => setOtpSent(false)} className="w-full text-sm text-gray-500 hover:text-purple-700">
                    Change mobile
                  </button>
                </>
              )}
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm">
            <span className="text-gray-600">Not yet a Solar Advisor? </span>
            <Link to="/become-agent" className="text-purple-600 hover:text-purple-800 font-semibold">
              Register Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== ADVISOR DASHBOARD ==========
export const SolarAdvisorDashboard = () => {
  const navigate = useNavigate();
  const session = getAdvisorSession();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        axios.get(`${API}/solar-advisor/${session.agent_id}/dashboard`, authHeaders()),
        axios.get(`${API}/solar-advisor/${session.agent_id}/customers`, authHeaders()),
      ]);
      setData(d.data);
      setCustomers(c.data.customers || []);
    } catch (err) {
      console.error("dashboard load failed", err);
      if (err.response?.status === 401) {
        clearAdvisorSession();
        navigate("/advisor/login");
      }
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => {
    if (!session) { navigate("/advisor/login"); return; }
    fetchAll();
  }, [session, navigate, fetchAll]);

  const logout = () => { clearAdvisorSession(); navigate("/advisor/login"); };

  if (!session) return null;
  const stats = data?.stats || {};
  const advisor = data?.advisor || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <Sun className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">{session.name || "Solar Advisor"}</div>
              <div className="text-xs text-purple-100">ID: {session.agent_id} • {advisor.status || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowChangePw(true)}
              className="bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
              <Key className="w-4 h-4" /> Password
            </button>
            <button onClick={fetchAll}
              className="bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={logout}
              className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>

      {advisor.must_reset_password && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-2 text-sm text-center">
          <Lock className="w-4 h-4 inline mr-1" /> You're using the default password (your mobile). Please
          <button onClick={() => setShowChangePw(true)} className="underline font-semibold ml-1">change it now</button>.
        </div>
      )}

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Customers" value={stats.total_customers || 0} color="bg-blue-500" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Converted" value={stats.converted || 0} color="bg-green-500" />
        <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Pending Commission" value={`₹${(stats.pending_commission || 0).toLocaleString("en-IN")}`} color="bg-orange-500" />
        <StatCard icon={<Award className="w-5 h-5" />} label="Paid Commission" value={`₹${(stats.paid_commission || 0).toLocaleString("en-IN")}`} color="bg-purple-600" />
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-2 border-b border-gray-200 mb-4 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "customers", label: `My Customers (${customers.length})` },
            { id: "commission", label: "Commission Tracker" },
            { id: "profile", label: "Profile & Bank" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${tab === t.id ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <Loader /> : (
          <>
            {tab === "overview" && (
              <div className="space-y-4">
                <button onClick={() => setShowOnboard(true)}
                  className="w-full md:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2"
                  data-testid="advisor-onboard-btn">
                  <Plus className="w-5 h-5" /> Onboard New Customer
                </button>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="font-semibold mb-3 text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Lead Funnel</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(stats.by_status || {}).map(([k, v]) => (
                      <div key={k} className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-800">{v}</div>
                        <div className="text-xs text-gray-500 capitalize">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="font-semibold mb-3 text-gray-800">Recent Customers</div>
                  <CustomerList customers={customers.slice(0, 5)} />
                </div>
              </div>
            )}

            {tab === "customers" && (
              <div>
                <div className="flex justify-end mb-3">
                  <button onClick={() => setShowOnboard(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Onboard Customer
                  </button>
                </div>
                <CustomerList customers={customers} />
              </div>
            )}

            {tab === "commission" && (
              <CommissionPanel customers={customers} commissionPercent={advisor.commission_percent || 5} />
            )}

            {tab === "profile" && (
              <ProfilePanel advisor={advisor} />
            )}
          </>
        )}
      </div>

      {showOnboard && (
        <OnboardCustomerModal agentId={session.agent_id} onClose={() => setShowOnboard(false)} onSuccess={() => { setShowOnboard(false); fetchAll(); }} />
      )}
      {showChangePw && (
        <ChangePasswordModal agentId={session.agent_id} onClose={() => setShowChangePw(false)} onSuccess={() => { setShowChangePw(false); fetchAll(); }} />
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className={`w-10 h-10 ${color} text-white rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-xl font-bold text-gray-800 mt-1">{value}</div>
  </div>
);

const Loader = () => (
  <div className="text-center py-12 text-gray-500">
    <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" /> Loading…
  </div>
);

const CustomerList = ({ customers }) => {
  if (!customers || customers.length === 0) {
    return <div className="text-center py-10 text-gray-500 text-sm">No customers yet. Onboard your first customer to start earning.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-gray-700">
          <tr>
            <th className="text-left p-2">Customer</th>
            <th className="text-left p-2">Call</th>
            <th className="text-left p-2 hidden md:table-cell">Provider / CA</th>
            <th className="text-left p-2 hidden lg:table-cell">Capacity</th>
            <th className="text-left p-2 hidden md:table-cell">Type</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Login</th>
            <th className="text-left p-2">Commission</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} className="border-b border-gray-100 hover:bg-slate-50">
              <td className="p-2">
                <div className="font-semibold text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-500">{c.email || "—"}</div>
              </td>
              <td className="p-2">
                <a href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition">
                  <Phone className="w-3 h-3" /> {c.phone}
                </a>
              </td>
              <td className="p-2 hidden md:table-cell text-xs">
                {c.electricity_provider ? <span className="font-semibold text-blue-700">{c.electricity_provider}</span> : <span className="text-gray-400">—</span>}
                {c.ca_no ? <div className="text-gray-500 font-mono">CA: {c.ca_no}</div> : null}
              </td>
              <td className="p-2 hidden lg:table-cell">{c.required_capacity_kw ? `${c.required_capacity_kw} kW` : "—"}</td>
              <td className="p-2 hidden md:table-cell capitalize">{c.customer_type || c.property_type || "—"}</td>
              <td className="p-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  c.status === "converted" ? "bg-green-100 text-green-700" :
                  c.status === "qualified" ? "bg-blue-100 text-blue-700" :
                  c.status === "lost" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-700"
                }`}>{c.status || "new"}</span>
              </td>
              <td className="p-2">
                {c.customer_can_login ? (
                  <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</span>
                ) : (
                  <span className="text-gray-400 text-xs">Lead</span>
                )}
              </td>
              <td className="p-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  c.commission_status === "paid" ? "bg-green-100 text-green-700" :
                  c.commission_status === "approved" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{c.commission_status || "pending"}</span>
                {c.commission_amount > 0 && <div className="text-xs text-gray-600">₹{c.commission_amount}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CommissionPanel = ({ customers, commissionPercent }) => {
  const earned = customers.filter(c => c.commission_amount > 0);
  const totalPending = earned.filter(c => c.commission_status !== "paid").reduce((s, c) => s + (c.commission_amount || 0), 0);
  const totalPaid = earned.filter(c => c.commission_status === "paid").reduce((s, c) => s + (c.commission_amount || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500">Your Commission Rate</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{commissionPercent}%</div>
          <div className="text-xs text-gray-500 mt-1">of every converted deal</div>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
          <div className="text-xs text-orange-700">Pending Payout</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">₹{totalPending.toLocaleString("en-IN")}</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="text-xs text-green-700">Paid Till Date</div>
          <div className="text-2xl font-bold text-green-700 mt-1">₹{totalPaid.toLocaleString("en-IN")}</div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="font-semibold mb-3">Commission History</div>
        {earned.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">No commission entries yet. Your earnings appear once admin marks deals as converted.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="text-left p-2">Customer</th><th className="text-left p-2">Amount</th><th className="text-left p-2">Status</th>
            </tr></thead>
            <tbody>
              {earned.map(c => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2 font-semibold">₹{c.commission_amount}</td>
                  <td className="p-2 capitalize">{c.commission_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const ProfilePanel = ({ advisor }) => (
  <div className="grid md:grid-cols-2 gap-4">
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Personal</div>
      <Field label="Name" value={advisor.name} />
      <Field label="Mobile" value={advisor.phone || advisor.mobile} />
      <Field label="Email" value={advisor.email} />
      <Field label="District" value={advisor.district} />
      <Field label="Address" value={advisor.address} />
      <Field label="Aadhar" value={advisor.aadhar_number} />
      <Field label="PAN" value={advisor.pan_number} />
    </div>
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="font-semibold mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Bank (Commission Payout)</div>
      <Field label="Bank Name" value={advisor.bank_details?.bank_name} />
      <Field label="Account Number" value={advisor.bank_details?.account_number} />
      <Field label="IFSC Code" value={advisor.bank_details?.ifsc_code} />
      <p className="text-xs text-gray-500 mt-3">To update bank details, please contact admin.</p>
    </div>
  </div>
);

const Field = ({ label, value }) => (
  <div className="py-1.5 border-b border-gray-100 last:border-0 flex justify-between gap-3">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm text-gray-800 font-medium text-right">{value || "—"}</span>
  </div>
);

const OnboardCustomerModal = ({ agentId, onClose, onSuccess }) => {
  const [f, setF] = useState({
    customer_name: "", customer_mobile: "", customer_email: "",
    address: "", district: "", pincode: "",
    ca_no: "", electricity_provider: "",
    required_capacity_kw: "", customer_type: "residential",
    monthly_bill: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const payload = {
        ...f,
        required_capacity_kw: f.required_capacity_kw ? parseFloat(f.required_capacity_kw) : null,
        monthly_bill: f.monthly_bill ? parseFloat(f.monthly_bill) : null,
      };
      await axios.post(`${API}/solar-advisor/${agentId}/onboard-customer`, payload, authHeaders());
      onSuccess();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed to onboard"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Onboard New Customer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Customer Name *" v={f.customer_name} on={(v) => setF({ ...f, customer_name: v })} required />
          <Input label="Mobile *" v={f.customer_mobile} on={(v) => setF({ ...f, customer_mobile: v })} required type="tel" />
          <Input label="Email" v={f.customer_email} on={(v) => setF({ ...f, customer_email: v })} type="email" />
          <Input label="District *" v={f.district} on={(v) => setF({ ...f, district: v })} required />
          <Input label="Pincode" v={f.pincode} on={(v) => setF({ ...f, pincode: v })} />
          <Input label="CA No. (Electricity Bill)" v={f.ca_no} on={(v) => setF({ ...f, ca_no: v })} placeholder="Consumer Account Number" />
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Electricity Provider *</label>
            <select value={f.electricity_provider} onChange={(e) => setF({ ...f, electricity_provider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
              <option value="">Select Provider</option>
              <option value="SBPDCL">SBPDCL (South Bihar)</option>
              <option value="NBPDCL">NBPDCL (North Bihar)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Type *</label>
            <select value={f.customer_type} onChange={(e) => setF({ ...f, customer_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <Input label="Required Capacity (kW)" v={f.required_capacity_kw} on={(v) => setF({ ...f, required_capacity_kw: v })} type="number" step="0.1" />
          <Input label="Monthly Bill (₹)" v={f.monthly_bill} on={(v) => setF({ ...f, monthly_bill: v })} type="number" />
        </div>
        <Input label="Full Address *" v={f.address} on={(v) => setF({ ...f, address: v })} required />
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">
          {loading ? "Submitting..." : "Onboard Customer"}
        </button>
      </form>
    </Modal>
  );
};

const ChangePasswordModal = ({ agentId, onClose, onSuccess }) => {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (newPw !== confirm) { setErr("Passwords don't match"); return; }
    if (newPw.length < 4) { setErr("Use at least 4 characters"); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/solar-advisor/${agentId}/change-password`,
        { old_password: oldPw, new_password: newPw }, authHeaders());
      onSuccess();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed to update"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Change Password" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
        <Input label="Old Password" v={oldPw} on={setOldPw} type="password" />
        <Input label="New Password *" v={newPw} on={setNewPw} type="password" required />
        <Input label="Confirm New Password *" v={confirm} on={setConfirm} type="password" required />
        <button type="submit" disabled={loading}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">
          {loading ? "Saving..." : "Update Password"}
        </button>
      </form>
    </Modal>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const Input = ({ label, v, on, type = "text", required = false, step }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    <input type={type} value={v} onChange={(e) => on(e.target.value)} required={required} step={step}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
  </div>
);

// ========== ADMIN: SOLAR ADVISOR MANAGEMENT ==========
export const AdminSolarAdvisors = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("advisors"); // advisors | leads
  const [advisors, setAdvisors] = useState([]);
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, l] = await Promise.all([
        axios.get(`${API}/admin/agents`),
        axios.get(`${API}/admin/solar-advisor-leads`),
      ]);
      setAdvisors(a.data.agents || []);
      setLeads(l.data.leads || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (agent_id, status) => {
    if (!window.confirm(`Set advisor status to "${status}"?`)) return;
    await axios.put(`${API}/admin/agents/${agent_id}/status`, { status });
    load();
  };

  const removeAdvisor = async (agent_id) => {
    if (!window.confirm("Permanently delete this Solar Advisor?")) return;
    await axios.delete(`${API}/admin/agents/${agent_id}`);
    load();
  };

  const filtered = advisors.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (a.name || "").toLowerCase().includes(s) ||
           (a.phone || "").includes(s) ||
           (a.agent_id || "").toLowerCase().includes(s) ||
           (a.email || "").toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const rows = [["Agent ID", "Name", "Mobile", "Email", "District", "Status", "Customers", "Pending ₹", "Paid ₹"]];
    advisors.forEach(a => rows.push([a.agent_id, a.name, a.phone, a.email, a.district, a.status, a.customers_onboarded || 0, a.pending_commission || 0, a.paid_commission || 0]));
    const csv = rows.map(r => r.map(x => `"${(x ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "solar_advisors.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700">
              <ChevronRight className="w-4 h-4 rotate-180" /> Dashboard
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sun className="w-5 h-5 text-purple-600" /> Solar Advisors
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm flex items-center gap-1">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={load} className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-2 border-t border-gray-100">
          {[
            { id: "advisors", label: `Advisors (${advisors.length})` },
            { id: "leads", label: `Advisor Leads (${leads.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === t.id ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? <Loader /> : (
          <>
            {tab === "advisors" && (
              <>
                <div className="mb-3 relative max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search by name, mobile, ID, email"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left p-3">Advisor</th>
                        <th className="text-left p-3">Contact</th>
                        <th className="text-left p-3">District</th>
                        <th className="text-left p-3">Customers</th>
                        <th className="text-left p-3">Commission</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(a => (
                        <tr key={a.agent_id} className="border-t border-gray-100 hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-semibold">{a.name}</div>
                            <div className="text-xs text-gray-500">{a.agent_id}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div>{a.phone}</div>
                            <div className="text-gray-500">{a.email}</div>
                          </td>
                          <td className="p-3">{a.district}</td>
                          <td className="p-3">{a.customers_onboarded || 0}</td>
                          <td className="p-3 text-xs">
                            <div className="text-orange-600">Pending: ₹{a.pending_commission || 0}</div>
                            <div className="text-green-600">Paid: ₹{a.paid_commission || 0}</div>
                          </td>
                          <td className="p-3">
                            <select value={a.status || "pending"} onChange={(e) => updateStatus(a.agent_id, e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1">
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="suspended">Suspended</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button onClick={() => setEditing(a)} title="Edit" className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setPwTarget(a)} title="Set Password" className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeAdvisor(a.agent_id)} title="Delete" className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-500">No advisors yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "leads" && (
              <AdvisorLeadsTable leads={leads} reload={load} />
            )}
          </>
        )}
      </div>

      {editing && <EditAdvisorModal advisor={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); load(); }} />}
      {pwTarget && <SetPasswordModal advisor={pwTarget} onClose={() => setPwTarget(null)} onSuccess={() => setPwTarget(null)} />}
    </div>
  );
};

const AdvisorLeadsTable = ({ leads, reload }) => {
  const updateCommission = async (lead_id, commission_status, commission_amount) => {
    await axios.put(`${API}/admin/solar-advisor-leads/${lead_id}/commission`, { commission_status, commission_amount });
    reload();
  };
  if (!leads || leads.length === 0)
    return <div className="bg-white rounded-xl border p-10 text-center text-gray-500">No customer leads from solar advisors yet.</div>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="text-left p-3">Customer</th>
            <th className="text-left p-3">Call</th>
            <th className="text-left p-3 hidden md:table-cell">Provider / CA</th>
            <th className="text-left p-3 hidden lg:table-cell">Address</th>
            <th className="text-left p-3">Capacity</th>
            <th className="text-left p-3">Type</th>
            <th className="text-left p-3">Advisor</th>
            <th className="text-left p-3">Commission</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id} className="border-t border-gray-100 hover:bg-slate-50">
              <td className="p-3 font-semibold">{l.name}</td>
              <td className="p-3">
                <a href={`tel:${l.phone}`}
                  className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full transition">
                  <Phone className="w-3 h-3" /> {l.phone}
                </a>
                {l.email && <div className="text-xs text-gray-400 mt-0.5">{l.email}</div>}
              </td>
              <td className="p-3 hidden md:table-cell text-xs">
                {l.electricity_provider ? <span className="font-semibold text-blue-700">{l.electricity_provider}</span> : <span className="text-gray-400">—</span>}
                {l.ca_no ? <div className="text-gray-500 font-mono">CA: {l.ca_no}</div> : null}
              </td>
              <td className="p-3 hidden lg:table-cell text-xs">{[l.address, l.district, l.pincode].filter(Boolean).join(", ") || "—"}</td>
              <td className="p-3">{l.required_capacity_kw ? `${l.required_capacity_kw} kW` : "—"}</td>
              <td className="p-3 capitalize">{l.customer_type || l.property_type}</td>
              <td className="p-3 text-xs">
                <div className="font-semibold">{l.advisor_name}</div>
                <div className="text-gray-500">{l.advisor_id}</div>
              </td>
              <td className="p-3">
                <div className="flex flex-col gap-1">
                  <select value={l.commission_status || "pending"} onChange={(e) => updateCommission(l.id, e.target.value, l.commission_amount || 0)}
                    className="text-xs border border-gray-300 rounded px-1 py-0.5">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                  </select>
                  <input type="number" defaultValue={l.commission_amount || 0}
                    onBlur={(e) => updateCommission(l.id, l.commission_status || "pending", parseFloat(e.target.value || 0))}
                    className="text-xs border border-gray-300 rounded px-1 py-0.5 w-20" placeholder="₹" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const EditAdvisorModal = ({ advisor, onClose, onSuccess }) => {
  const [f, setF] = useState({
    name: advisor.name || "", phone: advisor.phone || "", email: advisor.email || "",
    district: advisor.district || "", address: advisor.address || "", pincode: advisor.pincode || "",
    aadhar_number: advisor.aadhar_number || "", pan_number: advisor.pan_number || "",
    commission_percent: advisor.commission_percent || 5,
    bank_name: advisor.bank_details?.bank_name || "",
    account_number: advisor.bank_details?.account_number || "",
    ifsc_code: advisor.bank_details?.ifsc_code || "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      await axios.put(`${API}/admin/agents/${advisor.agent_id}`, f);
      onSuccess();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed to update"); }
    finally { setLoading(false); }
  };
  return (
    <Modal title={`Edit ${advisor.name} (${advisor.agent_id})`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Name" v={f.name} on={(v) => setF({ ...f, name: v })} required />
          <Input label="Mobile" v={f.phone} on={(v) => setF({ ...f, phone: v })} required />
          <Input label="Email" v={f.email} on={(v) => setF({ ...f, email: v })} type="email" />
          <Input label="District" v={f.district} on={(v) => setF({ ...f, district: v })} />
          <Input label="Pincode" v={f.pincode} on={(v) => setF({ ...f, pincode: v })} />
          <Input label="Commission %" v={f.commission_percent} on={(v) => setF({ ...f, commission_percent: v })} type="number" step="0.1" />
          <Input label="Aadhar" v={f.aadhar_number} on={(v) => setF({ ...f, aadhar_number: v })} />
          <Input label="PAN" v={f.pan_number} on={(v) => setF({ ...f, pan_number: v })} />
        </div>
        <Input label="Address" v={f.address} on={(v) => setF({ ...f, address: v })} />
        <div className="border-t pt-3 mt-3">
          <div className="font-semibold text-sm mb-2">Bank Details</div>
          <div className="grid md:grid-cols-3 gap-3">
            <Input label="Bank" v={f.bank_name} on={(v) => setF({ ...f, bank_name: v })} />
            <Input label="Account" v={f.account_number} on={(v) => setF({ ...f, account_number: v })} />
            <Input label="IFSC" v={f.ifsc_code} on={(v) => setF({ ...f, ifsc_code: v })} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </Modal>
  );
};

const SetPasswordModal = ({ advisor, onClose, onSuccess }) => {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      await axios.post(`${API}/admin/agents/${advisor.agent_id}/set-password`, { password: pw });
      setDone(true);
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };
  return (
    <Modal title={`Set Password — ${advisor.name}`} onClose={onClose}>
      {done ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-semibold">Password updated!</p>
          <p className="text-sm text-gray-600 mt-1">Share new password with the advisor: <code className="bg-gray-100 px-2 py-0.5 rounded">{pw}</code></p>
          <button onClick={onSuccess} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg">Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{err}</div>}
          <Input label="New Password" v={pw} on={setPw} required />
          <p className="text-xs text-gray-500">Minimum 4 characters. Tell the advisor to change it after login.</p>
          <button type="submit" disabled={loading || pw.length < 4} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">
            {loading ? "Saving..." : "Set Password"}
          </button>
        </form>
      )}
    </Modal>
  );
};
