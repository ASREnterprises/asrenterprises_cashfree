import { useState, useEffect, useRef } from "react";
import { Zap, Sun, TrendingUp, ArrowRight, CheckCircle, IndianRupee, Calculator, Gift, Calendar, Leaf, MessageSquare } from "lucide-react";

// Update WhatsApp context when user interacts
const updateWhatsAppContext = (data) => {
  if (typeof window !== 'undefined' && window.updateWhatsAppContext) {
    window.updateWhatsAppContext(data);
  }
};

export const DynamicROIWidget = ({ onBookSurvey, className = "" }) => {
  const [monthlyBill, setMonthlyBill] = useState(3000);
  const [selectedCapacity, setSelectedCapacity] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevBillRef = useRef(3000);

  // Generate WhatsApp URL for FREE site survey
  const getWhatsAppSurveyUrl = () => {
    const config = getSystemConfig(monthlyBill);
    const message = `Hi ASR Enterprises! 👋

I'm interested in a FREE site survey for solar installation.

📊 My Details:
• Monthly Bill: ₹${monthlyBill.toLocaleString()}
• Recommended System: ${config.capacity} kW
• Expected Savings: ₹${Math.round(monthlyBill * 0.90).toLocaleString()}/month

Please schedule a FREE site survey at my location.

Thank you!`;
    return `https://wa.me/918298389097?text=${encodeURIComponent(message)}`;
  };

  // Solar system configurations for different bill ranges
  // Pricing: ₹70,000 per kW (2kW=₹1.5L, 3kW=₹2.1L, 5kW=₹3.5L)
  const getSystemConfig = (bill) => {
    if (bill <= 1500) return { capacity: 2, baseCost: 150000, subsidy: 60000 };
    if (bill <= 2500) return { capacity: 2, baseCost: 150000, subsidy: 60000 };
    if (bill <= 3500) return { capacity: 3, baseCost: 210000, subsidy: 78000 };
    if (bill <= 5000) return { capacity: 4, baseCost: 280000, subsidy: 78000 };
    if (bill <= 7000) return { capacity: 5, baseCost: 350000, subsidy: 78000 };
    if (bill <= 10000) return { capacity: 7, baseCost: 490000, subsidy: 78000 };
    return { capacity: 10, baseCost: 700000, subsidy: 78000 };
  };

  const config = getSystemConfig(monthlyBill);
  const netCost = config.baseCost - config.subsidy;
  const monthlySavings = Math.round(monthlyBill * 0.90); // 90% savings
  const annualSavings = monthlySavings * 12;
  const paybackYears = Math.round((netCost / annualSavings) * 10) / 10;
  const twentyFiveYearSavings = annualSavings * 25;
  const co2Offset = Math.round(config.capacity * 1.5 * 1000); // kg per year

  // Animation when values change
  useEffect(() => {
    if (prevBillRef.current !== monthlyBill) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      prevBillRef.current = monthlyBill;
      
      // Update WhatsApp context
      updateWhatsAppContext({ 
        billAmount: monthlyBill,
        lastViewedCapacity: config.capacity,
        calculatorUsed: true
      });
      
      return () => clearTimeout(timer);
    }
  }, [monthlyBill, config.capacity]);

  const formatCurrency = (amount) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a355e] via-[#0c4270] to-[#0a355e] p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Live ROI Calculator</h3>
              <p className="text-blue-200 text-sm">See your savings in real-time</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-amber-400 font-bold text-lg">PM Surya Ghar</p>
            <p className="text-blue-200 text-xs">Govt. Subsidy Scheme</p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* Bill Slider */}
        <div className="mb-8">
          <label className="block text-gray-700 font-semibold mb-4 text-center text-lg">
            What's your monthly electricity bill?
          </label>
          
          <div className="relative px-2">
            {/* Slider track with gradient */}
            <div className="relative h-4 bg-gradient-to-r from-green-400 via-amber-400 to-red-400 rounded-full shadow-inner">
              {/* Slider fill */}
              <div 
                className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-300"
                style={{ width: `${((monthlyBill - 500) / 14500) * 100}%` }}
              />
            </div>
            
            <input
              type="range"
              min="500"
              max="15000"
              step="100"
              value={monthlyBill}
              onChange={(e) => setMonthlyBill(parseInt(e.target.value))}
              className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer"
              data-testid="roi-slider"
            />
            
            {/* Slider thumb indicator */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg border-4 border-amber-500 transition-all duration-300 pointer-events-none flex items-center justify-center"
              style={{ left: `calc(${((monthlyBill - 500) / 14500) * 100}% - 16px)` }}
            >
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
            </div>
          </div>
          
          {/* Slider labels */}
          <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
            <span>₹500</span>
            <span>₹5,000</span>
            <span>₹10,000</span>
            <span>₹15,000</span>
          </div>

          {/* Current Bill Display */}
          <div className="text-center mt-6">
            <div className={`inline-block bg-gradient-to-br from-amber-50 to-orange-50 px-8 py-4 rounded-2xl border-2 border-amber-300 transition-transform duration-300 ${isAnimating ? 'scale-105' : ''}`}>
              <p className="text-sm text-gray-600 mb-1">Your Current Bill</p>
              <p className="text-5xl md:text-6xl font-bold text-amber-600">
                ₹{monthlyBill.toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm mt-1">/month</p>
            </div>
          </div>
        </div>

        {/* Visual Cost Breakdown */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-6">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <IndianRupee className="w-5 h-5 text-amber-600" />
            <span>Cost Breakdown</span>
          </h4>
          
          <div className="space-y-4">
            {/* Total Cost Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Total System Cost</span>
                <span className="font-semibold text-gray-800">{formatCurrency(config.baseCost)}</span>
              </div>
              <div className="h-8 bg-gray-300 rounded-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500 flex items-center px-3">
                  <span className="text-white text-xs font-medium">{config.capacity} kW System</span>
                </div>
              </div>
            </div>

            {/* Subsidy Bar (highlighted) */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-600 font-medium flex items-center">
                  <Gift className="w-4 h-4 mr-1" />
                  Govt. Subsidy (PM Surya Ghar)
                </span>
                <span className="font-bold text-green-600">- {formatCurrency(config.subsidy)}</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-lg relative overflow-hidden">
                <div 
                  className="absolute h-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center px-3 transition-all duration-500"
                  style={{ width: `${(config.subsidy / config.baseCost) * 100}%` }}
                >
                  <span className="text-white text-xs font-bold">SUBSIDY</span>
                </div>
              </div>
            </div>

            {/* Net Cost */}
            <div className="pt-2 border-t-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold text-lg">Your Net Investment</span>
                <span className={`text-2xl font-bold text-amber-600 transition-all duration-300 ${isAnimating ? 'scale-110' : ''}`}>
                  {formatCurrency(netCost)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-center text-white transform transition-all duration-300 ${isAnimating ? 'scale-105' : ''}`}>
            <Sun className="w-6 h-6 mx-auto mb-2 opacity-80" />
            <div className="text-2xl md:text-3xl font-bold">{config.capacity} kW</div>
            <div className="text-blue-100 text-xs">System Size</div>
          </div>
          
          <div className={`bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-4 text-center text-white transform transition-all duration-300 ${isAnimating ? 'scale-105' : ''}`}>
            <TrendingUp className="w-6 h-6 mx-auto mb-2 opacity-80" />
            <div className="text-2xl md:text-3xl font-bold">₹{monthlySavings.toLocaleString()}</div>
            <div className="text-green-100 text-xs">Monthly Savings</div>
          </div>
          
          <div className={`bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-center text-white transform transition-all duration-300 ${isAnimating ? 'scale-105' : ''}`}>
            <Calendar className="w-6 h-6 mx-auto mb-2 opacity-80" />
            <div className="text-2xl md:text-3xl font-bold">{paybackYears}</div>
            <div className="text-purple-100 text-xs">Years Payback</div>
          </div>
          
          <div className={`bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-4 text-center text-white transform transition-all duration-300 ${isAnimating ? 'scale-105' : ''}`}>
            <Leaf className="w-6 h-6 mx-auto mb-2 opacity-80" />
            <div className="text-2xl md:text-3xl font-bold">{(co2Offset / 1000).toFixed(1)}T</div>
            <div className="text-teal-100 text-xs">CO₂ Saved/Year</div>
          </div>
        </div>

        {/* 25-Year Savings Highlight */}
        <div className={`bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border-2 border-green-300 rounded-2xl p-6 mb-6 text-center transition-all duration-300 ${isAnimating ? 'ring-4 ring-green-200' : ''}`}>
          <p className="text-green-700 mb-2">Your Lifetime Savings (25 Years)</p>
          <p className="text-4xl md:text-5xl font-bold text-green-600">
            {formatCurrency(twentyFiveYearSavings)}
          </p>
          <p className="text-green-600 mt-2 text-sm">
            That's <strong>₹{Math.round(annualSavings / 12).toLocaleString()}</strong> back in your pocket every month!
          </p>
        </div>

        {/* Payback Visualization */}
        <div className="mb-6">
          <h4 className="font-bold text-gray-800 mb-3 text-center">Your Investment Timeline</h4>
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            {/* Investment period */}
            <div 
              className="absolute h-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center transition-all duration-500"
              style={{ width: `${Math.min((paybackYears / 25) * 100, 100)}%` }}
            >
              <span className="text-[10px] text-white font-bold">{paybackYears}yr</span>
            </div>
            {/* Free electricity period */}
            <div 
              className="absolute h-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center transition-all duration-500"
              style={{ left: `${(paybackYears / 25) * 100}%`, width: `${100 - (paybackYears / 25) * 100}%` }}
            >
              <span className="text-[10px] text-white font-bold">FREE Power!</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Year 0</span>
            <span>Year {paybackYears} (Breakeven)</span>
            <span>Year 25</span>
          </div>
        </div>

        {/* Quick Capacity Selector */}
        <div className="mb-6">
          <p className="text-center text-gray-600 text-sm mb-3">Or select a system directly:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[2, 3, 5, 7, 10].map((kw) => (
              <button
                key={kw}
                onClick={() => {
                  const billForKW = kw === 2 ? 1500 : kw === 3 ? 3000 : kw === 5 ? 5000 : kw === 7 ? 7000 : 12000;
                  setMonthlyBill(billForKW);
                  setSelectedCapacity(kw);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  config.capacity === kw 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-amber-100'
                }`}
              >
                {kw} kW
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href={getWhatsAppSurveyUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition shadow-xl shadow-green-500/30 transform hover:scale-105 flex items-center justify-center space-x-2 mx-auto"
            data-testid="roi-book-survey-btn"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Book FREE Site Survey</span>
            <ArrowRight className="w-5 h-5" />
          </a>
          <p className="text-gray-500 text-sm mt-3">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            Get exact quote after FREE site inspection
          </p>
        </div>
      </div>
    </div>
  );
};

export default DynamicROIWidget;
