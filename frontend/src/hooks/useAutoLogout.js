import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Admin timeout: 15 minutes, Staff timeout: 1 hour (for field work flexibility)
const ADMIN_INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const STAFF_INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour for staff

export const useAutoLogout = (isAuthenticated, logoutCallback, userType = 'admin') => {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  
  // Use different timeout based on user type - memoized to avoid dependency issues
  const INACTIVITY_TIMEOUT = userType === 'staff' ? STAFF_INACTIVITY_TIMEOUT : ADMIN_INACTIVITY_TIMEOUT;

  const handleLogout = useCallback(() => {
    // Clear all auth data
    if (userType === 'admin') {
      localStorage.removeItem('asrAdminAuth');
      localStorage.removeItem('asrAdminEmail');
      localStorage.removeItem('asrAdminRole');
      localStorage.removeItem('asrAdminLastActivity');
    } else if (userType === 'staff') {
      localStorage.removeItem('asrStaffAuth');
      localStorage.removeItem('asrStaffId');
      localStorage.removeItem('asrStaffName');
      localStorage.removeItem('asrStaffLastActivity');
    }
    
    // Call the logout callback if provided
    if (logoutCallback) {
      logoutCallback();
    }
    
    // Show alert and redirect
    alert('Your session has expired due to inactivity. Please login again.');
    navigate(userType === 'admin' ? '/admin/login' : '/staff/login');
  }, [navigate, logoutCallback, userType]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    const storageKey = userType === 'admin' ? 'asrAdminLastActivity' : 'asrStaffLastActivity';
    localStorage.setItem(storageKey, Date.now().toString());
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const timeout = userType === 'staff' ? STAFF_INACTIVITY_TIMEOUT : ADMIN_INACTIVITY_TIMEOUT;
    if (isAuthenticated) {
      timeoutRef.current = setTimeout(handleLogout, timeout);
    }
  }, [isAuthenticated, handleLogout, userType]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check for stored last activity on mount
    const storageKey = userType === 'admin' ? 'asrAdminLastActivity' : 'asrStaffLastActivity';
    const storedLastActivity = localStorage.getItem(storageKey);
    const timeout = userType === 'staff' ? STAFF_INACTIVITY_TIMEOUT : ADMIN_INACTIVITY_TIMEOUT;
    
    if (storedLastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(storedLastActivity);
      if (timeSinceLastActivity > timeout) {
        handleLogout();
        return;
      }
    }

    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Initial timer setup
    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated, resetTimer, handleLogout, userType]);

  return { resetTimer };
};

export default useAutoLogout;
