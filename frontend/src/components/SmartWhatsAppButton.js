import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL || "";

// Log WhatsApp click to CRM
const logWhatsAppClick = async (context, source = 'website') => {
  try {
    await axios.post(`${API}/api/whatsapp/website-click`, {
      source: source,
      context: context,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    });
  } catch (err) {
    console.log("WhatsApp click logging skipped:", err.message);
  }
};

// Context tracking for smart WhatsApp messages
const useUserContext = () => {
  const [context, setContext] = useState({
    lastViewedCapacity: null,
    lastViewedProduct: null,
    currentPage: '/',
    timeOnSite: 0,
    calculatorUsed: false,
    billAmount: null,
    district: null
  });

  useEffect(() => {
    // Track page views
    const updatePage = () => {
      setContext(prev => ({ ...prev, currentPage: window.location.pathname }));
    };
    updatePage();

    // Track time on site
    const startTime = Date.now();
    const interval = setInterval(() => {
      setContext(prev => ({ 
        ...prev, 
        timeOnSite: Math.floor((Date.now() - startTime) / 1000) 
      }));
    }, 10000);

    // Listen for custom events from other components
    const handleContextUpdate = (e) => {
      setContext(prev => ({ ...prev, ...e.detail }));
    };
    
    window.addEventListener('updateUserContext', handleContextUpdate);
    window.addEventListener('popstate', updatePage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('updateUserContext', handleContextUpdate);
      window.removeEventListener('popstate', updatePage);
    };
  }, []);

  return context;
};

// Generate contextual WhatsApp message
const generateContextualMessage = (context) => {
  const { lastViewedCapacity, lastViewedProduct, currentPage, billAmount, district, calculatorUsed } = context;

  // Priority: Specific capacity > Bill amount > Product > Page > Generic
  if (lastViewedCapacity) {
    return `Hi ASR Enterprises! I just checked your ${lastViewedCapacity}kW system ROI on the website.${district ? ` I'm from ${district}.` : ''} Can we discuss the subsidy and installation for my home?`;
  }

  if (billAmount) {
    return `Hi ASR! My monthly electricity bill is around ₹${billAmount}. I'd like to know what solar system you recommend and the government subsidy I can get.`;
  }

  if (calculatorUsed) {
    return `Hi ASR Enterprises! I used your solar calculator on the website. Can you help me understand the exact cost and subsidy for my home?`;
  }

  if (lastViewedProduct) {
    return `Hi! I'm interested in the ${lastViewedProduct} from your website. Can you provide more details and pricing?`;
  }

  // Page-specific messages
  switch (currentPage) {
    case '/shop':
      return `Hi ASR! I'm browsing your solar products online. Can you help me choose the right system for my needs?`;
    case '/calculator':
      return `Hi! I was using your solar calculator. Can you help me get an accurate quote for my home?`;
    case '/gallery':
      return `Hi ASR Enterprises! I saw your installation gallery. Can you do a similar installation at my place?`;
    case '/about':
      return `Hi! I read about ASR Enterprises and I'm interested in solar installation. Can we discuss?`;
    case '/contact':
      return `Hi! I'm reaching out from your website contact page. I'd like to know more about solar installation.`;
    default:
      return `Hi ASR Enterprises! I'm interested in solar rooftop installation under PM Surya Ghar scheme. Can you help?`;
  }
};

export const SmartWhatsAppButton = ({ variant = 'floating', className = '' }) => {
  const context = useUserContext();
  const [showTooltip, setShowTooltip] = useState(false);

  const whatsappNumber = "918298389097";
  const message = generateContextualMessage(context);
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

  // Expose function to update context from other components
  useEffect(() => {
    window.updateWhatsAppContext = (updates) => {
      window.dispatchEvent(new CustomEvent('updateUserContext', { detail: updates }));
    };
  }, []);

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-30 print:hidden">
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-3 animate-fade-in">
            <div className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm max-w-xs shadow-xl">
              <p className="font-medium">Chat with us on WhatsApp!</p>
              <p className="text-gray-400 text-xs mt-1">Instant response • Expert advice</p>
            </div>
            <div className="absolute top-full right-6 border-8 border-transparent border-t-gray-900" />
          </div>
        )}
        
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center space-x-3 bg-gradient-to-r from-green-500 to-green-600 text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => { 
            logWhatsAppClick(context, 'smart_floating_button');
            if (typeof fbq !== 'undefined') fbq('track', 'Contact', { content_name: 'WhatsApp Chat', content_category: 'Smart Floating Button' }); 
          }}
          data-testid="smart-whatsapp-btn"
        >
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full" />
          </div>
          <span className="font-semibold hidden sm:block">WhatsApp Us</span>
        </a>
      </div>
    );
  }

  // Inline button variant
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center space-x-2 bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition ${className}`}
      onClick={() => { 
        logWhatsAppClick(context, 'inline_button');
        if (typeof fbq !== 'undefined') fbq('track', 'Contact', { content_name: 'WhatsApp Chat', content_category: 'Inline Button' }); 
      }}
      data-testid="smart-whatsapp-inline-btn"
    >
      <MessageSquare className="w-5 h-5" />
      <span>WhatsApp Us</span>
    </a>
  );
};

// Hook for other components to update the WhatsApp context
export const useWhatsAppContext = () => {
  const updateContext = (updates) => {
    if (typeof window !== 'undefined' && window.updateWhatsAppContext) {
      window.updateWhatsAppContext(updates);
    }
  };

  return { updateContext };
};

export default SmartWhatsAppButton;
