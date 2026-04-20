import { useEffect, useState, useCallback } from 'react';

// Holi festival dates configuration
// Holi 2026: March 3 (Holika Dahan) to March 4 (Main Holi)
// Effect starts March 3 at 12:00 AM and ends March 5 at 12:00 AM
const HOLI_CONFIG = {
  2026: { main: new Date(2026, 2, 4), start: new Date(2026, 2, 3, 0, 0), end: new Date(2026, 2, 5, 0, 0) },
  2027: { main: new Date(2027, 2, 23), start: new Date(2027, 2, 22, 0, 0), end: new Date(2027, 2, 24, 0, 0) },
  2028: { main: new Date(2028, 2, 12), start: new Date(2028, 2, 11, 0, 0), end: new Date(2028, 2, 13, 0, 0) }
};

// Vibrant Holi colors
const HOLI_COLORS = [
  '#FF1493', // Deep Pink
  '#FF6B6B', // Coral Red
  '#FFD93D', // Bright Yellow
  '#6BCB77', // Fresh Green
  '#4D96FF', // Sky Blue
  '#9B59B6', // Purple
  '#FF8C00', // Deep Orange
  '#00CED1', // Dark Turquoise
  '#FF69B4', // Hot Pink
  '#32CD32', // Lime Green
];

// Check if current date is within Holi period
const isHoliPeriod = () => {
  const today = new Date();
  const year = today.getFullYear();
  const config = HOLI_CONFIG[year];
  
  if (!config) return false;
  
  return today >= config.start && today <= config.end;
};

// Get days until Holi
const getDaysUntilHoli = () => {
  const today = new Date();
  const year = today.getFullYear();
  const config = HOLI_CONFIG[year] || HOLI_CONFIG[year + 1];
  
  if (!config) return null;
  
  const diff = config.main - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Color Splash Component
const ColorSplash = ({ color, style, size }) => (
  <div
    className="absolute rounded-full blur-sm animate-pulse"
    style={{
      ...style,
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      opacity: 0.6,
    }}
  />
);

// Floating Color Powder Particle
const ColorParticle = ({ color, delay, duration, startX, startY }) => {
  return (
    <div
      className="fixed pointer-events-none z-30"
      style={{
        left: startX,
        top: startY,
        animation: `holiFloat ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: Math.random() * 12 + 6 + 'px',
          height: Math.random() * 12 + 6 + 'px',
          background: color,
          boxShadow: `0 0 10px ${color}, 0 0 20px ${color}40`,
          opacity: 0.7,
        }}
      />
    </div>
  );
};

// Water Balloon Splash Effect
const WaterBalloon = ({ color, position }) => (
  <div
    className="absolute pointer-events-none"
    style={{
      ...position,
      width: '100px',
      height: '100px',
    }}
  >
    <div
      className="w-full h-full rounded-full animate-ping"
      style={{
        background: `radial-gradient(circle, ${color}60 0%, ${color}20 50%, transparent 70%)`,
      }}
    />
  </div>
);

export const HoliEffect = () => {
  const [isActive, setIsActive] = useState(false);
  const [particles, setParticles] = useState([]);
  const [splashes, setSplashes] = useState([]);
  const [showBanner, setShowBanner] = useState(true);
  
  // Check if Holi period is active
  useEffect(() => {
    const active = isHoliPeriod();
    setIsActive(active);
    
    // Check if user dismissed banner this session
    const dismissed = sessionStorage.getItem('holi_banner_dismissed');
    if (dismissed) setShowBanner(false);
  }, []);
  
  // Generate floating particles
  useEffect(() => {
    if (!isActive) return;
    
    const newParticles = [];
    for (let i = 0; i < 25; i++) {
      newParticles.push({
        id: i,
        color: HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)],
        delay: Math.random() * 5,
        duration: 8 + Math.random() * 6,
        startX: Math.random() * 100 + 'vw',
        startY: Math.random() * 100 + 'vh',
      });
    }
    setParticles(newParticles);
  }, [isActive]);
  
  // Generate random color splashes
  useEffect(() => {
    if (!isActive) return;
    
    const newSplashes = [];
    for (let i = 0; i < 8; i++) {
      newSplashes.push({
        id: i,
        color: HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)],
        style: {
          left: Math.random() * 90 + '%',
          top: Math.random() * 90 + '%',
        },
        size: Math.random() * 100 + 50 + 'px',
      });
    }
    setSplashes(newSplashes);
  }, [isActive]);
  
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    sessionStorage.setItem('holi_banner_dismissed', 'true');
  }, []);
  
  if (!isActive) return null;
  
  const daysUntil = getDaysUntilHoli();
  
  return (
    <>
      {/* CSS Keyframes */}
      <style>{`
        @keyframes holiFloat {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 0.7;
          }
          25% {
            transform: translateY(-30px) translateX(20px) rotate(90deg);
            opacity: 0.9;
          }
          50% {
            transform: translateY(-50px) translateX(-20px) rotate(180deg);
            opacity: 0.5;
          }
          75% {
            transform: translateY(-20px) translateX(30px) rotate(270deg);
            opacity: 0.8;
          }
        }
        
        @keyframes holiPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        @keyframes colorWave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      
      {/* Floating Color Particles */}
      {particles.map((particle) => (
        <ColorParticle key={particle.id} {...particle} />
      ))}
      
      {/* Corner Color Splashes */}
      <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
        {splashes.map((splash) => (
          <ColorSplash key={splash.id} {...splash} />
        ))}
        
        {/* Top-left corner decoration */}
        <div 
          className="absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl opacity-30"
          style={{ background: 'linear-gradient(135deg, #FF1493, #FFD93D)' }}
        />
        
        {/* Bottom-right corner decoration */}
        <div 
          className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-30"
          style={{ background: 'linear-gradient(135deg, #6BCB77, #4D96FF)' }}
        />
        
        {/* Top-right corner decoration */}
        <div 
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl opacity-25"
          style={{ background: 'linear-gradient(135deg, #9B59B6, #FF6B6B)' }}
        />
      </div>
      
      {/* Holi Banner */}
      {showBanner && (
        <div 
          className="fixed top-20 left-0 right-0 z-50 mx-4 md:mx-auto md:max-w-2xl"
          style={{
            background: 'linear-gradient(90deg, #FF1493, #FFD93D, #6BCB77, #4D96FF, #9B59B6, #FF1493)',
            backgroundSize: '300% 100%',
            animation: 'colorWave 4s ease infinite',
          }}
        >
          <div className="relative bg-white/95 backdrop-blur-sm m-1 rounded-xl p-4 flex items-center justify-between">
            {/* Shimmer effect */}
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
              <div 
                className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ animation: 'shimmer 2s infinite' }}
              />
            </div>
            
            <div className="flex items-center gap-3 z-10">
              <div className="text-3xl">🎨</div>
              <div>
                <p className="font-bold text-transparent bg-clip-text" style={{
                  background: 'linear-gradient(90deg, #FF1493, #9B59B6)',
                  WebkitBackgroundClip: 'text',
                }}>
                  {daysUntil > 1 ? `Happy Holi! ${daysUntil} days to go!` : 
                   daysUntil === 1 ? "Happy Holi! Tomorrow is Holi!" : 
                   "🎉 Happy Holi! Celebrate with Colors! 🎉"}
                </p>
                <p className="text-sm text-gray-600">
                  {daysUntil <= 0 ? "Wishing you & your family a vibrant, colorful Holi!" : "Wishing you a colorful & prosperous solar journey!"}
                </p>
              </div>
            </div>
            
            <button
              onClick={dismissBanner}
              className="z-10 p-2 hover:bg-gray-100 rounded-full transition"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Rainbow Border Effect on Page Edges */}
      <div 
        className="fixed top-0 left-0 w-1 h-full z-30 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #FF1493, #FFD93D, #6BCB77, #4D96FF, #9B59B6, #FF6B6B)',
          opacity: 0.6,
        }}
      />
      <div 
        className="fixed top-0 right-0 w-1 h-full z-30 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #9B59B6, #4D96FF, #6BCB77, #FFD93D, #FF1493, #FF6B6B)',
          opacity: 0.6,
        }}
      />
    </>
  );
};

export default HoliEffect;
