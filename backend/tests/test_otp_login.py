"""
Test Suite: Admin/Staff OTP and Password Login APIs
Tests the login-otp endpoint and related authentication flows
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

# Test Credentials
ADMIN_EMAIL = "asrenterprisespatna@gmail.com"
ADMIN_PASSWORD = "admin@asr123"  # Default admin password
ADMIN_MOBILE = "8877896889"


class TestAdminOTPLogin:
    """Tests for Admin Mobile OTP Login API"""

    def test_admin_otp_login_success(self):
        """Test: POST /api/admin/login-otp with valid registered mobile returns success"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": ADMIN_MOBILE},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert data.get("role") == "admin", f"Expected role='admin', got '{data.get('role')}'"
        assert data.get("email") == ADMIN_EMAIL, f"Expected admin email"
        assert data.get("name") == "Admin", f"Expected name='Admin'"
        print(f"✓ Admin OTP Login successful - role: {data.get('role')}, email: {data.get('email')}")

    def test_admin_otp_login_with_country_code(self):
        """Test: Login-otp handles 91 country code prefix correctly"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": f"91{ADMIN_MOBILE}"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True, "Country code should be stripped automatically"
        print(f"✓ OTP Login with 91 prefix works correctly")

    def test_admin_otp_login_unregistered_mobile(self):
        """Test: Unregistered mobile returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": "9999999999"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "not registered" in data.get("detail", "").lower(), "Should indicate mobile not registered"
        print(f"✓ Unregistered mobile correctly rejected")

    def test_admin_otp_login_invalid_format(self):
        """Test: Invalid mobile number format returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": "123"},  # Too short
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Invalid mobile format correctly rejected")

    def test_admin_otp_login_empty_mobile(self):
        """Test: Empty mobile returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": ""},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Empty mobile correctly rejected")


class TestAdminPasswordLogin:
    """Tests for Admin Password Login API"""

    def test_admin_password_login_success(self):
        """Test: POST /api/admin/login-password with valid credentials returns success"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={"user_id": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert data.get("role") == "admin", f"Expected role='admin', got '{data.get('role')}'"
        assert data.get("email") == ADMIN_EMAIL, f"Expected admin email"
        print(f"✓ Admin Password Login successful - role: {data.get('role')}")

    def test_admin_password_login_invalid_password(self):
        """Test: Wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={"user_id": ADMIN_EMAIL, "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "invalid credentials" in data.get("detail", "").lower()
        print(f"✓ Wrong password correctly rejected")

    def test_admin_password_login_invalid_email(self):
        """Test: Wrong email returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={"user_id": "wrong@email.com", "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Wrong email correctly rejected")


class TestStaffLogin:
    """Tests for Staff Login API"""

    def test_staff_login_endpoint_exists(self):
        """Test: Staff login endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"staff_id": "ASR0001", "password": "testpass"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 for invalid credentials, not 404
        assert response.status_code != 404, "Staff login endpoint should exist"
        print(f"✓ Staff login endpoint exists - status: {response.status_code}")


class TestAPIRoot:
    """Test that API endpoints are accessible"""

    def test_admin_endpoints_accessible(self):
        """Test: Admin endpoints are properly routed"""
        # Test that the admin API root responds (even with 422/400 for missing body)
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={}  # Empty body should return 400
        )
        # 400 means endpoint exists but validation failed - which is expected
        # 429 means rate limit hit - also acceptable as endpoint exists
        assert response.status_code in [400, 429], f"Expected 400/429 for empty mobile, got {response.status_code}"
        print(f"✓ Admin API endpoints are accessible (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
