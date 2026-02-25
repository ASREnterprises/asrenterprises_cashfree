import { useEffect, useState, useMemo } from 'react';

// Festival-specific theme configurations
const FESTIVAL_THEMES = {
  diwali: {
    particles: ['🪔', '✨', '🎆', '🌟', '💫'],
    colors: ['#FFD700', '#FF6B35', '#FFA500', '#FFEB3B'],
    gradient: 'from-amber-500/10 via-orange-500/5 to-yellow-500/10',
    borderColor: 'border-amber-400/30',
    glowColor: 'shadow-amber-500/20'
  },
  holi: {
    particles: ['🎨', '💜', '💙', '💚', '💛', '🧡', '❤️'],
    colors: ['#FF1493', '#00FF00', '#FFFF00', '#FF6600', '#9400D3'],
    gradient: 'from-pink-500/10 via-purple-500/5 to-yellow-500/10',
    borderColor: 'border-pink-400/30',
    glowColor: 'shadow-pink-500/20'
  },
  christmas: {
    particles: ['🎄', '⭐', '❄️', '🎁', '🔔'],
    colors: ['#FF0000', '#00FF00', '#FFFFFF', '#FFD700'],
    gradient: 'from-red-500/10 via-green-500/5 to-white/10',
    borderColor: 'border-red-400/30',
    glowColor: 'shadow-red-500/20'
  },
  newyear: {
    particles: ['🎉', '🥳', '✨', '🎆', '🎊', '2026'],
    colors: ['#FFD700', '#C0C0C0', '#FFFFFF'],
    gradient: 'from-yellow-500/10 via-slate-500/5 to-white/10',
    borderColor: 'border-yellow-400/30',
    glowColor: 'shadow-yellow-500/20'
  },
  independence: {
    particles: ['🇮🇳', '🧡', '⚪', '💚', '✨'],
    colors: ['#FF9933', '#FFFFFF', '#138808'],
    gradient: 'from-orange-500/10 via-white/5 to-green-500/10',
    borderColor: 'border-orange-400/30',
    glowColor: 'shadow-orange-500/20'
  },
  republic: {
    particles: ['🇮🇳', '🏛️', '⚖️', '✨', '🌟'],
    colors: ['#FF9933', '#FFFFFF', '#138808'],
    gradient: 'from-orange-500/10 via-white/5 to-green-500/10',
    borderColor: 'border-green-400/30',
    glowColor: 'shadow-green-500/20'
  },
  eid: {
    particles: ['🌙', '⭐', '✨', '🕌', '🤲'],
    colors: ['#4CAF50', '#FFD700', '#FFFFFF'],
    gradient: 'from-green-500/10 via-yellow-500/5 to-white/10',
    borderColor: 'border-green-400/30',
    glowColor: 'shadow-green-500/20'
  },
  default: {
    particles: ['✨', '🌟', '💫', '⭐'],
    colors: ['#FFD700', '#FFA500', '#FF6B35'],
    gradient: 'from-amber-500/10 via-orange-500/5 to-yellow-500/10',
    borderColor: 'border-amber-400/30',
    glowColor: 'shadow-amber-500/20'
  }
};

// Get theme based on festival name
const getTheme = (festivalName) => {
  const name = (festivalName || '').toLowerCase();
  if (name.includes('diwali') || name.includes('deepavali')) return FESTIVAL_THEMES.diwali;
  if (name.includes('holi')) return FESTIVAL_THEMES.holi;
  if (name.includes('christmas') || name.includes('xmas')) return FESTIVAL_THEMES.christmas;
  if (name.includes('new year') || name.includes('newyear')) return FESTIVAL_THEMES.newyear;
  if (name.includes('independence')) return FESTIVAL_THEMES.independence;
  if (name.includes('republic')) return FESTIVAL_THEMES.republic;
  if (name.includes('eid')) return FESTIVAL_THEMES.eid;
  return FESTIVAL_THEMES.default;
};

// Floating particle component
const FloatingParticle = ({ emoji, style, animationDuration }) => (
  <div
    className="fixed pointer-events-none select-none z-40 animate-float opacity-60"
    style={{
      ...style,
      animation: `float ${animationDuration}s ease-in-out infinite`,
      fontSize: `${Math.random() * 20 + 15}px`
    }}
  >
    {emoji}
  </div>
);

export const FestiveThemeOverlay = ({ festival }) => {
  const [particles, setParticles] = useState([]);
  
  const theme = useMemo(() => getTheme(festival?.title), [festival?.title]);
  
  useEffect(() => {
    if (!festival) return;
    
    // Generate random particles
    const newParticles = [];
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
      const emoji = theme.particles[Math.floor(Math.random() * theme.particles.length)];
      newParticles.push({
        id: i,
        emoji,
        style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`
        },
        animationDuration: Math.random() * 4 + 3
      });
    }
    
    setParticles(newParticles);
  }, [festival, theme.particles]);
  
  if (!festival) return null;
  
  return (
    <>
      {/* Global CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
          50% { transform: translateY(-20px) rotate(10deg); opacity: 0.9; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
          50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); }
        }
        .festive-border {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .festive-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `}</style>
      
      {/* Corner decorations */}
      <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none z-30 opacity-50">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} rounded-br-full`}></div>
      </div>
      <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none z-30 opacity-50">
        <div className={`absolute inset-0 bg-gradient-to-bl ${theme.gradient} rounded-bl-full`}></div>
      </div>
      <div className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none z-30 opacity-50">
        <div className={`absolute inset-0 bg-gradient-to-tr ${theme.gradient} rounded-tr-full`}></div>
      </div>
      <div className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none z-30 opacity-50">
        <div className={`absolute inset-0 bg-gradient-to-tl ${theme.gradient} rounded-tl-full`}></div>
      </div>
      
      {/* Floating particles */}
      {particles.map(particle => (
        <FloatingParticle
          key={particle.id}
          emoji={particle.emoji}
          style={particle.style}
          animationDuration={particle.animationDuration}
        />
      ))}
      
      {/* Top banner strip */}
      <div className={`fixed top-20 left-0 right-0 z-40 pointer-events-none`}>
        <div className={`h-1 bg-gradient-to-r ${theme.gradient} festive-shimmer`}></div>
      </div>
    </>
  );
};

export default FestiveThemeOverlay;
