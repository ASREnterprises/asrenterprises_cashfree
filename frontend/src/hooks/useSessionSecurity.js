// useSessionSecurity.js - Production-level session security hook
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ADMIN_PROTECTED_ROUTES = ['/admin/dashboard', '/admin/crm', '/admin/staff', '/admin/payments'];
const STAFF_PROTECTED_ROUTES = ['/staff/portal', '/staff/leads'];
const PAYMENT_ROUTES = ['/payment', '/book-service'];

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

export const useSessionSecurity = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  
  // Check if user is authenticated
  const isAdminAuthenticated = () => {
    const auth = localStorage.getItem('asrAdminAuth');
    const lastActivity = localStorage.getItem('asrAdminLastActivity');
    
    if (auth !== 'true') return false;
    
    // Check session timeout
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity);
      if (elapsed > SESSION_TIMEOUT) {
        logoutAdmin();
        return false;
      }
    }
    
    return true;
  };
  
  const isStaffAuthenticated = () => {
    const auth = localStorage.getItem('asrStaffAuth');
    const staffData = localStorage.getItem('asrStaffData');
    
    if (auth !== 'true' || !staffData) return false;
    
    try {
      const data = JSON.parse(staffData);
      return !!data.staff_id;
    } catch {
      return false;
    }
  };
  
  // Logout functions
  const logoutAdmin = useCallback(() => {
    console.log('[SessionSecurity] Logging out admin');
    localStorage.removeItem('asrAdminAuth');
    localStorage.removeItem('asrAdminEmail');
    localStorage.removeItem('asrAdminRole');
    localStorage.removeItem('asrAdminName');
    localStorage.removeItem('asrAdminLastActivity');
    sessionStorage.clear();
    navigate('/admin/login', { replace: true });
  }, [navigate]);
  
  const logoutStaff = useCallback(() => {
    console.log('[SessionSecurity] Logging out staff');
    localStorage.removeItem('asrStaffAuth');
    localStorage.removeItem('asrStaffData');
    sessionStorage.clear();
    navigate('/staff/login', { replace: true });
  }, [navigate]);
  
  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (localStorage.getItem('asrAdminAuth') === 'true') {
      localStorage.setItem('asrAdminLastActivity', Date.now().toString());
    }
  }, []);
  
  // Protect routes on navigation
  useEffect(() => {
    const path = location.pathname;
    
    // Check admin protected routes
    if (ADMIN_PROTECTED_ROUTES.some(route => path.startsWith(route))) {
      if (!isAdminAuthenticated()) {
        console.log('[SessionSecurity] Unauthorized access to admin route:', path);
        navigate('/admin/login', { replace: true });
        return;
      }
      updateActivity();
    }
    
    // Check staff protected routes
    if (STAFF_PROTECTED_ROUTES.some(route => path.startsWith(route))) {
      if (!isStaffAuthenticated()) {
        console.log('[SessionSecurity] Unauthorized access to staff route:', path);
        navigate('/staff/login', { replace: true });
        return;
      }
    }
  }, [location.pathname, navigate, updateActivity]);
  
  // Handle back button spam - logout on suspicious navigation
  useEffect(() => {
    let backPressCount = 0;
    let backPressTimer = null;
    
    const handlePopState = () => {
      backPressCount++;
      
      // If user presses back more than 3 times in 2 seconds, log them out
      if (backPressCount >= 3) {
        const path = location.pathname;
        
        if (ADMIN_PROTECTED_ROUTES.some(route => path.startsWith(route))) {
          console.log('[SessionSecurity] Back button spam detected - logging out admin');
          logoutAdmin();
          return;
        }
        
        if (STAFF_PROTECTED_ROUTES.some(route => path.startsWith(route))) {
          console.log('[SessionSecurity] Back button spam detected - logging out staff');
          logoutStaff();
          return;
        }
      }
      
      // Reset counter after 2 seconds
      if (backPressTimer) clearTimeout(backPressTimer);
      backPressTimer = setTimeout(() => {
        backPressCount = 0;
      }, 2000);
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (backPressTimer) clearTimeout(backPressTimer);
    };
  }, [location.pathname, logoutAdmin, logoutStaff]);
  
  // Activity listeners for session timeout
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });
    
    // Check session timeout every minute
    const intervalId = setInterval(() => {
      if (localStorage.getItem('asrAdminAuth') === 'true') {
        const lastActivity = parseInt(localStorage.getItem('asrAdminLastActivity') || '0');
        if (Date.now() - lastActivity > SESSION_TIMEOUT) {
          console.log('[SessionSecurity] Session timeout - logging out');
          logoutAdmin();
        }
      }
    }, 60000);
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
    };
  }, [updateActivity, logoutAdmin]);
  
  return {
    isAdminAuthenticated,
    isStaffAuthenticated,
    logoutAdmin,
    logoutStaff,
    updateActivity
  };
};

// Hook to prevent back navigation after payment
export const usePaymentProtection = (paymentCompleted) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (paymentCompleted) {
      // Push a dummy state to prevent going back
      window.history.pushState(null, '', window.location.href);
      
      const handlePopState = () => {
        // Push again to prevent going back
        window.history.pushState(null, '', window.location.href);
        console.log('[PaymentProtection] Back navigation blocked after payment');
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [paymentCompleted]);
};

// Check if payment already completed for an order
export const isPaymentCompleted = (orderId) => {
  const completedPayments = JSON.parse(localStorage.getItem('completedPayments') || '[]');
  return completedPayments.includes(orderId);
};

// Mark payment as completed
export const markPaymentCompleted = (orderId) => {
  const completedPayments = JSON.parse(localStorage.getItem('completedPayments') || '[]');
  if (!completedPayments.includes(orderId)) {
    completedPayments.push(orderId);
    localStorage.setItem('completedPayments', JSON.stringify(completedPayments));
  }
};

export default useSessionSecurity;
