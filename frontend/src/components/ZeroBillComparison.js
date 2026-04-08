import { useState, useEffect, useRef } from "react";
import { TrendingUp, Zap, IndianRupee, ArrowRight, AlertCircle, CheckCircle, Sun } from "lucide-react";

// Cost projections over 25 years
const calculateCosts = (monthlyBill) => {
  const years = 25;
  const electricityInflation = 0.07; // 7% annual increase
  const solarMaintenancePerYear = 2000;
  
  // DISCOM costs over 25 years with inflation
  let discomTotal = 0;
  let discomYearly = [];
  let currentBill = monthlyBill;
  
  for (let year = 1; year <= years; year++) {
    const yearCost = currentBill * 12;
    discomTotal += yearCost;
    discomYearly.push({ year, cost: Math.round(discomTotal), yearly: Math.round(yearCost) });
    currentBill *= (1 + electricityInflation);
  }
  
  // Solar costs (one-time investment + maintenance)
  // Pricing: ₹70,000 per kW
  const systemSize = Math.max(2, Math.min(10, Math.ceil(monthlyBill / 1000)));
  const totalCost = systemSize * 70000;
  const subsidy = systemSize >= 3 ? 78000 : 60000;
  const netCost = totalCost - subsidy;
  
  let solarTotal = netCost;
  let solarYearly = [];
  
  for (let year = 1; year <= years; year++) {
    solarTotal = netCost + (solarMaintenancePerYear * year);
    solarYearly.push({ year, cost: Math.round(solarTotal), yearly: Math.round(solarMaintenancePerYear) });
  }
  
  // Find breakeven year
  let breakevenYear = 0;
  for (let i = 0; i < years; i++) {
    if (discomYearly[i].cost > solarYearly[i].cost && breakevenYear === 0) {
      breakevenYear = i + 1;
    }
  }
  
  return {
    discom: {
      total: Math.round(discomTotal),
      yearly: discomYearly,
      avgMonthly: Math.round(discomTotal / years / 12)
    },
    solar: {
      total: Math.round(solarTotal),
      yearly: solarYearly,
      initialCost: netCost,
      systemSize
    },
    savings: Math.round(discomTotal - solarTotal),
    breakevenYear
  };
};

export const ZeroBillComparison = ({ monthlyBill = 3000 }) => {
  const [costs, setCosts] = useState(null);
  const [hoveredYear, setHoveredYear] = useState(null);
  const [animatedDiscom, setAnimatedDiscom] = useState(0);
  const [animatedSolar, setAnimatedSolar] = useState(0);
  const chartRef = useRef(null);

  useEffect(() => {
    const calculated = calculateCosts(monthlyBill);
    setCosts(calculated);
    
    // Animate the totals
    const duration = 2000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedDiscom(Math.round(calculated.discom.total * easeOut));
      setAnimatedSolar(Math.round(calculated.solar.total * easeOut));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [monthlyBill]);

  if (!costs) return null;

  const maxCost = costs.discom.total;
  const formatLakh = (num) => {
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    return `₹${num.toLocaleString()}`;
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a355e] to-[#0c4270] p-6 text-white">
        <h3 className="text-xl md:text-2xl font-bold mb-2 flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-amber-400" />
          25-Year Cost Comparison
        </h3>
        <p className="text-blue-200 text-sm">See how much you'll save with solar vs DISCOM electricity</p>
      </div>

      <div className="p-6">
        {/* Main Comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* DISCOM Side */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-red-800">Without Solar</h4>
                  <p className="text-xs text-red-600">DISCOM Electricity</p>
                </div>
              </div>
              <span className="text-xs bg-red-200 text-red-700 px-2 py-1 rounded">+7% yearly hike</span>
            </div>
            
            <div className="text-center mb-4">
              <p className="text-sm text-red-600 mb-1">Total 25-Year Cost</p>
              <p className="text-4xl md:text-5xl font-bold text-red-600">
                {formatLakh(animatedDiscom)}
              </p>
            </div>

            <div className="bg-red-200/50 rounded-lg p-3 text-sm text-red-700">
              <p className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Your bill will reach ₹{Math.round(monthlyBill * Math.pow(1.07, 25)).toLocaleString()}/month in year 25!
              </p>
            </div>
          </div>

          {/* Solar Side */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-400 rounded-2xl p-6 relative">
            <div className="absolute -top-3 -right-3 bg-green-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
              RECOMMENDED
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Sun className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-green-800">With ASR Solar</h4>
                  <p className="text-xs text-green-600">{costs.solar.systemSize} kW System</p>
                </div>
              </div>
              <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded">One-time cost</span>
            </div>
            
            <div className="text-center mb-4">
              <p className="text-sm text-green-600 mb-1">Total 25-Year Cost</p>
              <p className="text-4xl md:text-5xl font-bold text-green-600">
                {formatLakh(animatedSolar)}
              </p>
            </div>

            <div className="bg-green-200/50 rounded-lg p-3 text-sm text-green-700">
              <p className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Break-even in just {costs.breakevenYear} years, then FREE electricity!
              </p>
            </div>
          </div>
        </div>

        {/* Savings Highlight */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white text-center mb-8">
          <p className="text-lg mb-2">Your Total Savings Over 25 Years</p>
          <p className="text-5xl md:text-6xl font-bold mb-2">
            {formatLakh(costs.savings)}
          </p>
          <p className="text-amber-100">
            That's {formatLakh(Math.round(costs.savings / 25))}/year or {formatLakh(Math.round(costs.savings / 25 / 12))}/month extra in your pocket!
          </p>
        </div>

        {/* Visual Chart */}
        <div className="bg-gray-50 rounded-2xl p-6" ref={chartRef}>
          <h4 className="font-bold text-gray-800 mb-4 text-center">Cost Growth Over 25 Years</h4>
          
          <div className="relative h-64 md:h-80">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-gray-500 pr-2 text-right">
              <span>{formatLakh(maxCost)}</span>
              <span>{formatLakh(maxCost * 0.75)}</span>
              <span>{formatLakh(maxCost * 0.5)}</span>
              <span>{formatLakh(maxCost * 0.25)}</span>
              <span>₹0</span>
            </div>
            
            {/* Chart Area */}
            <div className="absolute left-16 right-0 top-0 bottom-8 border-l border-b border-gray-300">
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map(pct => (
                <div 
                  key={pct} 
                  className="absolute w-full border-t border-gray-200 border-dashed"
                  style={{ bottom: `${pct * 100}%` }}
                />
              ))}
              
              {/* DISCOM Line (Red) */}
              <svg className="absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="0.5"
                  points={costs.discom.yearly.map((d, i) => 
                    `${(i / 24) * 100},${100 - (d.cost / maxCost) * 100}`
                  ).join(' ')}
                />
                {/* Area fill */}
                <polygon
                  fill="rgba(239, 68, 68, 0.1)"
                  points={`0,100 ${costs.discom.yearly.map((d, i) => 
                    `${(i / 24) * 100},${100 - (d.cost / maxCost) * 100}`
                  ).join(' ')} 100,100`}
                />
              </svg>
              
              {/* Solar Line (Green) - Flat after initial cost */}
              <svg className="absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="0.5"
                  points={costs.solar.yearly.map((d, i) => 
                    `${(i / 24) * 100},${100 - (d.cost / maxCost) * 100}`
                  ).join(' ')}
                />
                {/* Area fill */}
                <polygon
                  fill="rgba(34, 197, 94, 0.1)"
                  points={`0,100 ${costs.solar.yearly.map((d, i) => 
                    `${(i / 24) * 100},${100 - (d.cost / maxCost) * 100}`
                  ).join(' ')} 100,100`}
                />
              </svg>

              {/* Breakeven marker */}
              <div 
                className="absolute w-px h-full bg-amber-500 border-dashed"
                style={{ left: `${((costs.breakevenYear - 1) / 24) * 100}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Break-even Year {costs.breakevenYear}
                </div>
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="absolute left-16 right-0 bottom-0 h-8 flex justify-between items-center text-xs text-gray-500">
              <span>Year 1</span>
              <span>Year 5</span>
              <span>Year 10</span>
              <span>Year 15</span>
              <span>Year 20</span>
              <span>Year 25</span>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex justify-center space-x-6 mt-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
              <span className="text-gray-600">DISCOM Electricity</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span className="text-gray-600">ASR Solar</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <a
            href={`https://wa.me/918298389097?text=${encodeURIComponent(`Hi ASR! I just saw the 25-year comparison. My current bill is ₹${monthlyBill}/month. I want to save ${formatLakh(costs.savings)} over 25 years. Please schedule a FREE site survey!`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition shadow-xl"
          >
            <Zap className="w-5 h-5" />
            <span>Start Saving {formatLakh(costs.savings)} Today!</span>
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ZeroBillComparison;
