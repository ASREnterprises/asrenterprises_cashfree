import { Link } from "react-router-dom";
import { Shield, Users, Sun, ChevronRight, ArrowLeft, Briefcase } from "lucide-react";

export const LoginSelector = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #FFFDF4 0%, #EEF9FF 50%, #F0FFF4 100%)" }}>
      <div className="w-full max-w-sm">
        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-[#073B4C] text-sm mb-8 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {/* Logo & Heading */}
        <div className="text-center mb-8">
          <img src="/asr_logo_transparent.png" alt="ASR Enterprises" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-[#073B4C]">ASR Enterprises</h1>
          <p className="text-slate-400 text-sm mt-1">Choose your account type to continue</p>
        </div>

        {/* Login Options */}
        <div className="space-y-3">
          <Link
            to="/admin/login"
            className="flex items-center gap-4 w-full bg-gradient-to-r from-[#073B4C] to-[#0369A1] text-white px-5 py-4 rounded-2xl hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-base">Admin Login</div>
              <div className="text-sky-200 text-xs mt-0.5">Owner & administrator access</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/staff/login"
            className="flex items-center gap-4 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-4 rounded-2xl hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-base">Staff Login</div>
              <div className="text-emerald-200 text-xs mt-0.5">Sales team & field staff access</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/advisor/login"
            className="flex items-center gap-4 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-4 rounded-2xl hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-base">Solar Advisor Login</div>
              <div className="text-purple-200 text-xs mt-0.5">Manage leads, customers & commission</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/customer/login"
            className="flex items-center gap-4 w-full bg-gradient-to-r from-[#F6A600] to-[#FBBF24] text-[#073B4C] px-5 py-4 rounded-2xl hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 bg-white/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sun className="w-6 h-6 text-[#073B4C]" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-base">Customer Login</div>
              <div className="text-amber-800 text-xs mt-0.5">Track your solar installation & subsidy</div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#073B4C]/40 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Need help? Contact Us at{" "}
          <a href="mailto:support@asrenterprises.in" className="text-[#0369A1] font-semibold hover:underline">support@asrenterprises.in</a>
        </p>
      </div>
    </div>
  );
};

export default LoginSelector;
