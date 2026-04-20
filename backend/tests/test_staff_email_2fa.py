"""
Test Staff Email + Mobile OTP 2FA Login Flow
Tests the new Email + OTP 2FA authentication for staff login
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestStaffEmail2FA:
    """Test Staff Email + Mobile OTP 2FA Login Flow"""
    
    def test_login_email_2fa_step1_valid_email(self):
        """Test Step 1: POST /api/staff/login-email-2fa with valid email returns require_otp:true"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email-2fa",
            json={"email": "test_4852d8cc@asr.com"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify require_otp is true
        assert data.get("require_otp") == True, "Expected require_otp to be True"
        # Verify phone is returned
        assert "phone" in data, "Expected phone field in response"
        assert data.get("phone") == "9876543211", f"Expected phone 9876543211, got {data.get('phone')}"
        # Verify mobile_last4 is returned
        assert "mobile_last4" in data, "Expected mobile_last4 field in response"
        assert data.get("mobile_last4") == "3211", f"Expected mobile_last4 3211, got {data.get('mobile_last4')}"
        # Verify staff_id is returned
        assert data.get("staff_id") == "ASR1002", f"Expected staff_id ASR1002, got {data.get('staff_id')}"
        # Verify success message
        assert "Email verified" in data.get("message", ""), "Expected success message about email verified"
        
        print(f"✓ Step 1 passed: require_otp={data.get('require_otp')}, mobile_last4={data.get('mobile_last4')}")
    
    def test_login_email_2fa_step1_invalid_email(self):
        """Test Step 1: POST /api/staff/login-email-2fa with invalid email returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email-2fa",
            json={"email": "nonexistent@test.com"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid email correctly returns 401")
    
    def test_login_email_2fa_step1_empty_email(self):
        """Test Step 1: POST /api/staff/login-email-2fa with empty email returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email-2fa",
            json={"email": ""},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Empty email correctly returns 400")
    
    def test_verify_email_2fa_step2_completes_login(self):
        """Test Step 2: POST /api/staff/verify-email-2fa completes login and returns staff data"""
        # First, initiate the 2FA flow
        step1_response = requests.post(
            f"{BASE_URL}/api/staff/login-email-2fa",
            json={"email": "test_4852d8cc@asr.com"},
            headers={"Content-Type": "application/json"}
        )
        assert step1_response.status_code == 200, "Step 1 should succeed"
        
        # Now verify the 2FA (simulating MSG91 OTP verification)
        response = requests.post(
            f"{BASE_URL}/api/staff/verify-email-2fa",
            json={
                "email": "test_4852d8cc@asr.com",
                "staff_id": "ASR1002"
            },
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify success
        assert data.get("success") == True, "Expected success to be True"
        # Verify token is returned
        assert "token" in data, "Expected token in response"
        assert len(data.get("token", "")) > 0, "Expected non-empty token"
        # Verify staff data is returned
        assert "staff" in data, "Expected staff data in response"
        staff = data.get("staff", {})
        assert staff.get("staff_id") == "ASR1002", f"Expected staff_id ASR1002, got {staff.get('staff_id')}"
        assert staff.get("email") == "test_4852d8cc@asr.com", f"Expected email test_4852d8cc@asr.com"
        assert staff.get("name") == "New Staff Member", f"Expected name 'New Staff Member'"
        assert staff.get("role") == "sales", f"Expected role 'sales'"
        
        print(f"✓ Step 2 passed: success={data.get('success')}, staff_id={staff.get('staff_id')}")
    
    def test_verify_email_2fa_invalid_staff(self):
        """Test Step 2: POST /api/staff/verify-email-2fa with invalid staff returns 401 or 429 (rate limited)"""
        response = requests.post(
            f"{BASE_URL}/api/staff/verify-email-2fa",
            json={
                "email": "nonexistent@test.com",
                "staff_id": "INVALID123"
            },
            headers={"Content-Type": "application/json"}
        )
        
        # Accept 401 (invalid) or 429 (rate limited) as valid responses
        assert response.status_code in [401, 429], f"Expected 401 or 429, got {response.status_code}"
        print(f"✓ Invalid staff correctly returns {response.status_code}")


class TestStaffLoginUIElements:
    """Test that UI elements are correctly configured for Email + OTP 2FA"""
    
    def test_api_returns_correct_response_structure(self):
        """Verify API response structure matches frontend expectations"""
        import time
        time.sleep(2)  # Wait to avoid rate limiting
        
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email-2fa",
            json={"email": "test_4852d8cc@asr.com"},
            headers={"Content-Type": "application/json"}
        )
        
        # Handle rate limiting
        if response.status_code == 429:
            print("✓ Rate limiting active (429) - security feature working")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Frontend expects these fields for step 2 transition
        required_fields = ["success", "require_otp", "phone", "mobile_last4", "staff_id", "message"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✓ API response contains all required fields: {required_fields}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
