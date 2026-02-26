import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export const useAutoLogout = (isAuthenticated, logoutCallback, userType = 'admin') => {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

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
    
    if (isAuthenticated) {
      timeoutRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, handleLogout, userType]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check for stored last activity on mount
    const storageKey = userType === 'admin' ? 'asrAdminLastActivity' : 'asrStaffLastActivity';
    const storedLastActivity = localStorage.getItem(storageKey);
    
    if (storedLastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(storedLastActivity);
      if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
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
