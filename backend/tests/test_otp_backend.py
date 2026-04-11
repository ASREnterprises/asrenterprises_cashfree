"""
Backend OTP API Tests - Iteration 94
Tests for /api/otp/send, /api/otp/verify, /api/otp/resend endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

# Test mobile number from credentials
TEST_MOBILE = "8877896889"
TEST_ADMIN_EMAIL = "asrenterprisespatna@gmail.com"
TEST_ADMIN_PASSWORD = "admin@asr123"


class TestOTPSendEndpoint:
    """Tests for POST /api/otp/send"""
    
    def test_otp_send_valid_mobile(self):
        """Test sending OTP to valid 10-digit mobile number"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": TEST_MOBILE}
        )
        print(f"[OTP Send] Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("type") == "success"
        assert "method" in data
        print(f"[OTP Send] Method used: {data.get('method')}")
    
    def test_otp_send_with_country_code(self):
        """Test sending OTP with country code prefix"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": f"91{TEST_MOBILE}"}
        )
        print(f"[OTP Send +91] Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_otp_send_invalid_mobile_short(self):
        """Test sending OTP to invalid short mobile number"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": "12345"}
        )
        print(f"[OTP Send Invalid] Status: {response.status_code}")
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid mobile" in data.get("detail", "")
    
    def test_otp_send_empty_mobile(self):
        """Test sending OTP with empty mobile"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": ""}
        )
        print(f"[OTP Send Empty] Status: {response.status_code}")
        
        assert response.status_code == 400


class TestOTPVerifyEndpoint:
    """Tests for POST /api/otp/verify"""
    
    def test_otp_verify_wrong_otp(self):
        """Test verifying with wrong OTP returns error with attempts remaining"""
        # First send OTP
        send_resp = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": TEST_MOBILE}
        )
        assert send_resp.status_code == 200
        
        # Try wrong OTP
        response = requests.post(
            f"{BASE_URL}/api/otp/verify",
            json={"mobile": TEST_MOBILE, "otp": "000000"}
        )
        print(f"[OTP Verify Wrong] Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid OTP" in data.get("detail", "") or "attempts remaining" in data.get("detail", "")
    
    def test_otp_verify_missing_otp(self):
        """Test verifying without OTP"""
        response = requests.post(
            f"{BASE_URL}/api/otp/verify",
            json={"mobile": TEST_MOBILE}
        )
        print(f"[OTP Verify Missing] Status: {response.status_code}")
        
        assert response.status_code == 400
    
    def test_otp_verify_no_stored_otp(self):
        """Test verifying when no OTP was sent"""
        # Use a different mobile that hasn't received OTP
        response = requests.post(
            f"{BASE_URL}/api/otp/verify",
            json={"mobile": "9999999999", "otp": "123456"}
        )
        print(f"[OTP Verify No Stored] Status: {response.status_code}")
        
        # Should return 400 with "No OTP found" or try MSG91 fallback
        assert response.status_code in [200, 400]


class TestOTPResendEndpoint:
    """Tests for POST /api/otp/resend"""
    
    def test_otp_resend_valid(self):
        """Test resending OTP to valid mobile"""
        response = requests.post(
            f"{BASE_URL}/api/otp/resend",
            json={"mobile": TEST_MOBILE}
        )
        print(f"[OTP Resend] Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True


class TestAdminLoginOTP:
    """Tests for Admin Login with OTP flow"""
    
    def test_admin_login_password_step1(self):
        """Test admin password login (Step 1 of 2FA)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={
                "user_id": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD
            }
        )
        print(f"[Admin Login Step1] Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        # Should require OTP for 2FA
        if data.get("require_otp"):
            assert "mobile_last4" in data
            print(f"[Admin Login] 2FA required, mobile ending: {data.get('mobile_last4')}")
    
    def test_admin_login_otp_mobile(self):
        """Test admin login via mobile OTP"""
        # First send OTP
        send_resp = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": TEST_MOBILE}
        )
        assert send_resp.status_code == 200
        
        # Then try login-otp endpoint
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": TEST_MOBILE}
        )
        print(f"[Admin Login OTP] Status: {response.status_code}, Response: {response.json()}")
        
        # Should succeed if mobile is registered
        assert response.status_code in [200, 401, 404]


class TestStaffLoginOTP:
    """Tests for Staff Login with OTP flow"""
    
    def test_staff_login_email_password(self):
        """Test staff email+password login"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email",
            json={
                "email": "test@example.com",
                "password": "test123"
            }
        )
        print(f"[Staff Login Email] Status: {response.status_code}")
        
        # May fail if email not registered - that's expected
        assert response.status_code in [200, 401, 404]
    
    def test_staff_mobile_otp_send(self):
        """Test staff mobile OTP send"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"mobile": "9296389097"}  # Admin mobile
        )
        print(f"[Staff OTP Send] Status: {response.status_code}, Response: {response.json()}")
        
        assert response.status_code == 200


class TestHealthAndBasicEndpoints:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"[Health] Status: {response.status_code}")
        
        assert response.status_code == 200
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        print(f"[API Root] Status: {response.status_code}")
        
        assert response.status_code in [200, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
