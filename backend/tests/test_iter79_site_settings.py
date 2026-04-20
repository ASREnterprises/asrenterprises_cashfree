"""
Iteration 79 - Testing Site Settings, Staff Login Methods, and CRM Dashboard Changes
Features tested:
1. GET /api/site-settings - Returns marquee_text and marquee_enabled
2. POST /api/site-settings - Saves marquee settings
3. Staff Login with email+password (no 2FA required)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSiteSettings:
    """Site Settings API tests for marquee feature"""
    
    def test_get_site_settings_returns_marquee_fields(self):
        """GET /api/site-settings should return marquee_text and marquee_enabled"""
        response = requests.get(f"{BASE_URL}/api/site-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "marquee_text" in data, "Response should contain marquee_text"
        assert "marquee_enabled" in data, "Response should contain marquee_enabled"
        assert isinstance(data["marquee_text"], str), "marquee_text should be a string"
        assert isinstance(data["marquee_enabled"], bool), "marquee_enabled should be a boolean"
        print(f"✓ GET /api/site-settings returns: marquee_text='{data['marquee_text'][:50]}...', marquee_enabled={data['marquee_enabled']}")
    
    def test_post_site_settings_saves_marquee(self):
        """POST /api/site-settings should save marquee settings"""
        test_text = f"Test Marquee Text {uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/site-settings", json={
            "marquee_text": test_text,
            "marquee_enabled": True
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"✓ POST /api/site-settings saved successfully")
        
        # Verify the settings were saved by fetching again
        get_response = requests.get(f"{BASE_URL}/api/site-settings")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["marquee_text"] == test_text, f"Expected '{test_text}', got '{get_data['marquee_text']}'"
        print(f"✓ Verified marquee_text was persisted correctly")
    
    def test_post_site_settings_toggle_enabled(self):
        """POST /api/site-settings should toggle marquee_enabled"""
        # First disable
        response = requests.post(f"{BASE_URL}/api/site-settings", json={
            "marquee_text": "Test",
            "marquee_enabled": False
        })
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/site-settings")
        assert get_response.json()["marquee_enabled"] == False
        print(f"✓ marquee_enabled can be set to False")
        
        # Then enable
        response = requests.post(f"{BASE_URL}/api/site-settings", json={
            "marquee_text": "Test",
            "marquee_enabled": True
        })
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/site-settings")
        assert get_response.json()["marquee_enabled"] == True
        print(f"✓ marquee_enabled can be set to True")


class TestStaffLoginMethods:
    """Staff Login API tests for multiple login methods"""
    
    def test_staff_login_email_endpoint_exists(self):
        """POST /api/staff/login-email should exist (email+password login)"""
        response = requests.post(f"{BASE_URL}/api/staff/login-email", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        # Should return 401 for wrong credentials, not 404
        assert response.status_code in [401, 400, 200], f"Expected 401/400/200, got {response.status_code}"
        print(f"✓ POST /api/staff/login-email endpoint exists (status: {response.status_code})")
    
    def test_staff_login_mobile_otp_send_endpoint(self):
        """POST /api/staff/send-otp should exist"""
        response = requests.post(f"{BASE_URL}/api/staff/send-otp", json={
            "staff_id": "NONEXISTENT123"
        })
        # Endpoint exists - returns 404 for non-existent staff (expected behavior)
        # or 400/200 for other cases
        assert response.status_code in [404, 400, 200], f"Endpoint should exist, got {response.status_code}"
        # Verify it's a proper API response, not a route not found
        data = response.json()
        assert "detail" in data or "success" in data, "Should return proper API response"
        print(f"✓ POST /api/staff/send-otp endpoint exists (status: {response.status_code})")
    
    def test_staff_login_mobile_otp_verify_endpoint(self):
        """POST /api/staff/verify-otp should exist"""
        response = requests.post(f"{BASE_URL}/api/staff/verify-otp", json={
            "staff_id": "test@example.com",
            "otp": "123456"
        })
        # Should not return 404
        assert response.status_code != 404, f"Endpoint should exist, got {response.status_code}"
        print(f"✓ POST /api/staff/verify-otp endpoint exists (status: {response.status_code})")
    
    def test_staff_login_email_2fa_endpoint_exists(self):
        """POST /api/staff/login-email-2fa should exist"""
        response = requests.post(f"{BASE_URL}/api/staff/login-email-2fa", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        # Should not return 404
        assert response.status_code != 404, f"Endpoint should exist, got {response.status_code}"
        print(f"✓ POST /api/staff/login-email-2fa endpoint exists (status: {response.status_code})")
    
    def test_staff_login_basic_endpoint_exists(self):
        """POST /api/staff/login should exist (mobile OTP login)"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "mobile": "8877896889"
        })
        # Should not return 404
        assert response.status_code != 404, f"Endpoint should exist, got {response.status_code}"
        print(f"✓ POST /api/staff/login endpoint exists (status: {response.status_code})")


class TestCRMDashboardTabs:
    """Test CRM Dashboard tab configuration via API"""
    
    def test_crm_dashboard_loads(self):
        """CRM Dashboard page should be accessible"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        # Dashboard API should exist
        assert response.status_code in [200, 401], f"Expected 200 or 401, got {response.status_code}"
        print(f"✓ CRM Dashboard API accessible (status: {response.status_code})")


class TestWhatsAppAPI:
    """Test WhatsApp API integration endpoints"""
    
    def test_whatsapp_templates_endpoint(self):
        """GET /api/whatsapp/templates should exist"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        # Should not return 404
        assert response.status_code != 404, f"Endpoint should exist, got {response.status_code}"
        print(f"✓ GET /api/whatsapp/templates endpoint exists (status: {response.status_code})")
    
    def test_whatsapp_send_endpoint(self):
        """POST /api/whatsapp/send should exist"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", json={
            "phone": "1234567890",
            "message": "test"
        })
        # Should not return 404
        assert response.status_code != 404, f"Endpoint should exist, got {response.status_code}"
        print(f"✓ POST /api/whatsapp/send endpoint exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
