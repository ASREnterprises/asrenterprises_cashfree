import { useState, useEffect } from "react";
import { Zap, ArrowRight, CheckCircle, TrendingDown, Sun, MessageSquare } from "lucide-react";

export const ZeroBillHero = ({ onBookSurvey, servicePrice = 2999 }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showServicePulse, setShowServicePulse] = useState(true);

  // Before/After bill values
  const beforeBill = 5000;
  const afterBill = 0;
  const savings = beforeBill - afterBill;

  // WhatsApp URL for FREE site survey
  const whatsappSurveyUrl = `https://wa.me/918298389097?text=${encodeURIComponent(`Hi ASR Enterprises! 👋

I want to make my electricity bill ZERO like shown on your website!

📊 My Current Situation:
• Monthly Bill: Around ₹5,000
• Looking for: Solar Rooftop Installation
• Interested in: PM Surya Ghar ₹78,000 Subsidy

Please schedule a FREE site survey at my location.

Thank you!`)}`;

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#FFFDF4] via-[#F7FBFF] to-[#EEF9FF] py-12 md:py-16 border-y border-sky-100">
      <div className="absolute inset-0 solar-panel-grid opacity-30"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Book Solar Service - Flashing Banner */}
        <div 
          onClick={onBookSurvey}
          className="mb-8 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 sm:p-6 shadow-2xl transform hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
          style={{
            boxShadow: '0 18px 45px rgba(246, 166, 0, 0.22), 0 10px 30px rgba(3, 105, 161, 0.12)'
          }}
          data-testid="book-service-hero-banner"
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-white/20 to-amber-400/0 animate-shimmer" 
               style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s infinite' }} />
          
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                  Book Solar Service
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                </h3>
                <p className="text-amber-100 text-sm sm:text-base">Expert installation & consultation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl sm:text-4xl font-extrabold text-white">₹{servicePrice.toLocaleString()}</div>
                <div className="text-amber-100 text-xs sm:text-sm">Click to Book Now</div>
              </div>
              <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-pulse" />
            </div>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-white/85 text-[#B77900] px-4 py-2 rounded-full text-sm font-medium mb-4 border border-amber-200 shadow-sm">
              <Sun className="w-4 h-4" />
              <span>PM Surya Ghar Yojana Partner</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#073B4C] mb-4 leading-tight font-[Poppins]">
              Make Your Electricity Bill{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C389] to-[#34D399]">
                ZERO!
              </span>
            </h2>
            
            <p className="text-lg md:text-xl text-slate-700 mb-6 max-w-xl">
              Switch to solar and save up to <strong className="text-amber-700">₹{(savings * 12).toLocaleString()}/year</strong>. 
              Join 25+ happy customers across Bihar who now enjoy <strong className="text-[#00C389]">zero electricity bills</strong>.
            </p>

            {/* Quick Stats - Premium Glass Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white/85 backdrop-blur-sm rounded-2xl p-4 text-center border border-emerald-100 shadow-lg">
                <div className="text-2xl md:text-3xl font-bold text-[#00C389]">₹78K</div>
                <div className="text-xs text-slate-500">Govt Subsidy</div>
              </div>
              <div className="bg-white/85 backdrop-blur-sm rounded-2xl p-4 text-center border border-amber-100 shadow-lg">
                <div className="text-2xl md:text-3xl font-bold text-[#FFD166]">3.5</div>
                <div className="text-xs text-slate-500">Yr Payback</div>
              </div>
              <div className="bg-white/85 backdrop-blur-sm rounded-2xl p-4 text-center border border-sky-100 shadow-lg">
                <div className="text-2xl md:text-3xl font-bold text-[#60A5FA]">25</div>
                <div className="text-xs text-slate-500">Yr Warranty</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href={whatsappSurveyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-[#F5A623] to-[#FFD166] text-[#071A2E] px-8 py-4 rounded-full font-bold text-lg hover:shadow-[0_0_30px_rgba(245,166,35,0.4)] transition flex items-center justify-center space-x-2 shadow-xl"
                data-testid="hero-book-survey-btn"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Get Free Consultation</span>
              </a>
            </div>
          </div>

          {/* Right: Before/After Bill Comparison Slider */}
          <div className="relative">
            <div 
              className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize shadow-2xl border-4 border-white/20"
              onMouseMove={handleMouseMove}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchMove={handleTouchMove}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              data-testid="before-after-slider"
            >
              {/* BEFORE - Left Side (Red/Old Bill) */}
              <div 
                className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-red-900"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center w-full max-w-xs">
                    <p className="text-red-200 text-sm font-medium mb-2">BEFORE Solar</p>
                    <div className="bg-white rounded-xl p-4 mb-4">
                      <img src="/electricity-bill-icon.png" alt="Bill" className="w-16 h-16 mx-auto mb-2 opacity-80" onError={(e) => e.target.style.display = 'none'} />
                      <p className="text-gray-500 text-xs">Monthly Electricity Bill</p>
                    </div>
                    <div className="text-5xl md:text-6xl font-bold text-white mb-2">
                      ₹{beforeBill.toLocaleString()}
                    </div>
                    <p className="text-red-200 text-sm">/month</p>
                    <div className="mt-4 bg-red-500/30 rounded-lg px-4 py-2">
                      <p className="text-sm">Annual Cost: <strong>₹{(beforeBill * 12).toLocaleString()}</strong></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AFTER - Right Side (Green/Zero Bill) */}
              <div 
                className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-600 to-green-800"
                style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center w-full max-w-xs">
                    <p className="text-green-200 text-sm font-medium mb-2">AFTER Solar</p>
                    <div className="bg-white rounded-xl p-4 mb-4">
                      <Sun className="w-16 h-16 mx-auto mb-2 text-amber-500" />
                      <p className="text-gray-500 text-xs">Solar Powered Home</p>
                    </div>
                    <div className="text-5xl md:text-6xl font-bold text-white mb-2">
                      ₹{afterBill}
                    </div>
                    <p className="text-green-200 text-sm">/month</p>
                    <div className="mt-4 bg-green-500/30 rounded-lg px-4 py-2">
                      <p className="text-sm">You Save: <strong>₹{(savings * 12).toLocaleString()}/year</strong></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider Handle */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center">
                  <div className="flex space-x-1">
                    <ArrowRight className="w-4 h-4 text-gray-600 rotate-180" />
                    <ArrowRight className="w-4 h-4 text-gray-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Slider Instructions */}
            <p className="text-center text-slate-600 text-sm mt-4">
              <span className="inline-flex items-center space-x-1">
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span>Drag slider to compare</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </p>

            {/* Trust Badge */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full px-6 py-2 shadow-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-semibold text-gray-700">25+ Verified Installations</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZeroBillHero;
