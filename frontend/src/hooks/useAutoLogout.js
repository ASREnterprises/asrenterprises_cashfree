import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Admin: 60 min, Staff: 60 min, Customer: 30 min.
// Bumped from 10/30/15 — short admin window was triggering on browser
// back-button (no activity events fire during a back-nav restore), causing
// the perceived "logged out on back button" complaints.
const ADMIN_INACTIVITY_TIMEOUT    = 60 * 60 * 1000;
const STAFF_INACTIVITY_TIMEOUT    = 60 * 60 * 1000;
const CUSTOMER_INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const getTimeout = (userType) => {
  if (userType === 'staff')    return STAFF_INACTIVITY_TIMEOUT;
  if (userType === 'customer') return CUSTOMER_INACTIVITY_TIMEOUT;
  return ADMIN_INACTIVITY_TIMEOUT;
};

const getStorageKey = (userType) => {
  if (userType === 'staff')    return 'asrStaffLastActivity';
  if (userType === 'customer') return 'asrCustomerLastActivity';
  return 'asrAdminLastActivity';
};

const clearAuthData = (userType) => {
  if (userType === 'admin') {
    localStorage.removeItem('asrAdminAuth');
    localStorage.removeItem('asrAdminEmail');
    localStorage.removeItem('asrAdminRole');
    localStorage.removeItem('asrAdminLastActivity');
  } else if (userType === 'staff') {
    localStorage.removeItem('asrStaffAuth');
    localStorage.removeItem('asrStaffId');
    localStorage.removeItem('asrStaffName');
    localStorage.removeItem('asrStaffData');
    localStorage.removeItem('asrStaffLastActivity');
  } else if (userType === 'customer') {
    sessionStorage.removeItem('asrCustomerData');
    sessionStorage.removeItem('asrCustomerPortalSettings');
    sessionStorage.removeItem('asrCustomerMobile');
    localStorage.removeItem('asrCustomerLastActivity');
  }
};

export const useAutoLogout = (isAuthenticated, logoutCallback, userType = 'admin') => {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const INACTIVITY_TIMEOUT = getTimeout(userType);

  const handleLogout = useCallback(() => {
    clearAuthData(userType);
    if (logoutCallback) logoutCallback();
    const minutes = INACTIVITY_TIMEOUT / 60000;
    alert(`Your session has expired after ${minutes} minutes of inactivity. Please login again.`);
    if (userType === 'staff')    navigate('/staff/login');
    else if (userType === 'customer') navigate('/customer/login');
    else navigate('/admin/login');
  }, [navigate, logoutCallback, userType, INACTIVITY_TIMEOUT]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    const storageKey = getStorageKey(userType);
    localStorage.setItem(storageKey, Date.now().toString());

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (isAuthenticated) {
      timeoutRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, handleLogout, userType, INACTIVITY_TIMEOUT]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const storageKey = getStorageKey(userType);
    const storedLastActivity = localStorage.getItem(storageKey);

    if (storedLastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(storedLastActivity);
      if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
        handleLogout();
        return;
      }
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, resetTimer, { passive: true }));

    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, resetTimer, handleLogout, userType, INACTIVITY_TIMEOUT]);

  return { resetTimer };
};

export default useAutoLogout;
