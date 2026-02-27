import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Users, TrendingUp, Zap, CheckCircle } from "lucide-react";

// Simulated Bihar PM Surya Ghar quota data
const BIHAR_QUOTA = {
  totalSlots: 10000,  // Total subsidized installations for Bihar
  usedSlots: 7842,    // Already claimed
  monthlyRate: 250,   // Average monthly claims
  deadline: "2026-03-31"  // Scheme end date
};

export const SubsidyCountdownMeter = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [slotsRemaining, setSlotsRemaining] = useState(BIHAR_QUOTA.totalSlots - BIHAR_QUOTA.usedSlots);
  const [isUrgent, setIsUrgent] = useState(false);

  // Calculate percentage used
  const percentUsed = Math.round((BIHAR_QUOTA.usedSlots / BIHAR_QUOTA.totalSlots) * 100);
  
  // Simulate real-time slot reduction
  useEffect(() => {
    const interval = setInterval(() => {
      // Random decrease to simulate real activity (1 slot every 30-60 seconds)
      if (Math.random() > 0.7) {
        setSlotsRemaining(prev => Math.max(0, prev - 1));
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Countdown to scheme deadline
  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadline = new Date(BIHAR_QUOTA.deadline);
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Check urgency level
  useEffect(() => {
    setIsUrgent(slotsRemaining < 2500 || timeLeft.days < 30);
  }, [slotsRemaining, timeLeft.days]);

  return (
    <div className={`rounded-2xl p-6 ${isUrgent ? 'bg-gradient-to-r from-red-600 to-orange-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'} text-white shadow-2xl`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {isUrgent ? (
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          ) : (
            <Clock className="w-6 h-6" />
          )}
          <h3 className="text-lg font-bold">PM Surya Ghar Subsidy Meter</h3>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${isUrgent ? 'bg-red-800' : 'bg-amber-600'}`}>
          {isUrgent ? 'LIMITED SLOTS!' : 'Live Updates'}
        </span>
      </div>

      {/* Slots Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Bihar Subsidy Quota</span>
          <span className="font-bold">{slotsRemaining.toLocaleString()} slots left</span>
        </div>
        <div className="h-4 bg-white/30 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${isUrgent ? 'bg-red-400' : 'bg-white'}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1 opacity-80">
          <span>{BIHAR_QUOTA.usedSlots.toLocaleString()} claimed</span>
          <span>{BIHAR_QUOTA.totalSlots.toLocaleString()} total</span>
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="bg-white/20 rounded-xl p-4 mb-4">
        <p className="text-sm text-center mb-3 opacity-90">Scheme Deadline Countdown</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-white/20 rounded-lg p-2">
            <div className="text-2xl md:text-3xl font-bold">{timeLeft.days}</div>
            <div className="text-xs opacity-80">Days</div>
          </div>
          <div className="bg-white/20 rounded-lg p-2">
            <div className="text-2xl md:text-3xl font-bold">{timeLeft.hours}</div>
            <div className="text-xs opacity-80">Hours</div>
          </div>
          <div className="bg-white/20 rounded-lg p-2">
            <div className="text-2xl md:text-3xl font-bold">{timeLeft.minutes}</div>
            <div className="text-xs opacity-80">Mins</div>
          </div>
          <div className="bg-white/20 rounded-lg p-2">
            <div className="text-2xl md:text-3xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</div>
            <div className="text-xs opacity-80">Secs</div>
          </div>
        </div>
      </div>

      {/* Urgency Message */}
      <div className={`text-center p-3 rounded-lg ${isUrgent ? 'bg-red-800/50' : 'bg-amber-600/50'}`}>
        {isUrgent ? (
          <p className="text-sm font-medium">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Only {slotsRemaining.toLocaleString()} subsidized slots remaining! Book NOW before it's too late!
          </p>
        ) : (
          <p className="text-sm">
            <Users className="w-4 h-4 inline mr-1" />
            ~{BIHAR_QUOTA.monthlyRate} families are booking every month. Don't miss out!
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
        <div className="bg-white/10 rounded-lg p-2">
          <Zap className="w-4 h-4 mx-auto mb-1" />
          <span>₹78,000 Max</span>
        </div>
        <div className="bg-white/10 rounded-lg p-2">
          <CheckCircle className="w-4 h-4 mx-auto mb-1" />
          <span>Govt. Verified</span>
        </div>
        <div className="bg-white/10 rounded-lg p-2">
          <TrendingUp className="w-4 h-4 mx-auto mb-1" />
          <span>30% Subsidy</span>
        </div>
      </div>
    </div>
  );
};

export default SubsidyCountdownMeter;
