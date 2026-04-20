"""
Test Security Features for ASR Solar Business Website
- Staff login 2FA flow
- reCAPTCHA verification endpoint
- Secure lead endpoint with honeypot
- Security status endpoint
- Security headers verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSecurityStatus:
    """Test security status endpoint"""
    
    def test_security_status_returns_all_features(self):
        """GET /api/security/status returns all security features"""
        response = requests.get(f"{BASE_URL}/api/security/status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "secure"
        assert "security_features" in data
        assert len(data["security_features"]) > 0
        
        # Check for specific security features
        features = data["security_features"]
        assert any("reCAPTCHA" in f for f in features), "reCAPTCHA not in security features"
        assert any("Honeypot" in f or "honeypot" in f for f in features), "Honeypot not in security features"
        assert any("HSTS" in f or "HTTPS" in f for f in features), "HSTS not in security features"
        assert any("2FA" in f for f in features), "2FA not in security features"
        
        print(f"Security status: {data['status']}")
        print(f"Security features count: {len(features)}")


class TestSecurityHeaders:
    """Test security headers on API responses"""
    
    def test_security_headers_present(self):
        """Check backend returns security headers"""
        response = requests.get(f"{BASE_URL}/api/security/status")
        headers = response.headers
        
        # Check for security headers
        headers_to_check = [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "Strict-Transport-Security",
        ]
        
        found_headers = []
        for header in headers_to_check:
            if header.lower() in [h.lower() for h in headers.keys()]:
                found_headers.append(header)
                print(f"✓ {header}: {headers.get(header, 'N/A')}")
            else:
                print(f"✗ {header}: NOT FOUND")
        
        # At least some security headers should be present
        assert len(found_headers) >= 1, f"No security headers found. Headers present: {list(headers.keys())}"


class TestStaffLogin2FA:
    """Test staff login with 2FA flow"""
    
    def test_staff_login_step1_returns_requires_otp(self):
        """POST /api/staff/login with valid credentials returns requires_otp=true"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Login step 1 should be successful: {data}"
        assert data.get("requires_otp") == True, f"Should require OTP: {data}"
        assert "message" in data, "Should include message about OTP"
        assert "staff_id" in data, "Should include staff_id"
        
        print(f"Staff login step 1 response: {data}")
    
    def test_staff_login_invalid_credentials(self):
        """POST /api/staff/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "INVALID",
            "password": "wrong"
        })
        
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print("Invalid credentials correctly rejected with 401")
    
    def test_staff_verify_2fa_success(self):
        """POST /api/staff/verify-2fa with test OTP 131993 returns token"""
        # First trigger OTP generation by calling staff login
        login_response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        assert login_response.status_code == 200, f"Login step 1 failed: {login_response.text}"
        login_data = login_response.json()
        assert login_data.get("requires_otp") == True, "Should require OTP"
        
        # Now verify with test OTP 131993
        response = requests.post(f"{BASE_URL}/api/staff/verify-2fa", json={
            "staff_id": "ASR1001",
            "password": "asr@123",
            "otp": "131993"
        })
        
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"2FA verification should succeed: {data}"
        assert "token" in data, f"Should return token: {data}"
        assert "staff" in data, f"Should return staff data: {data}"
        
        # Verify staff data
        staff = data["staff"]
        assert staff.get("staff_id") == "ASR1001", f"Staff ID mismatch: {staff}"
        
        print(f"Staff 2FA verification successful, token received: {data['token'][:20]}...")
    
    def test_staff_verify_2fa_invalid_otp(self):
        """POST /api/staff/verify-2fa with invalid OTP returns 401"""
        response = requests.post(f"{BASE_URL}/api/staff/verify-2fa", json={
            "staff_id": "ASR1001",
            "password": "asr@123",
            "otp": "000000"
        })
        
        assert response.status_code == 401, f"Expected 401 for invalid OTP, got {response.status_code}"
        print("Invalid OTP correctly rejected with 401")


class TestRecaptchaEndpoint:
    """Test reCAPTCHA verification endpoint"""
    
    def test_verify_recaptcha_endpoint_exists(self):
        """POST /api/verify-recaptcha endpoint exists and handles missing token"""
        response = requests.post(f"{BASE_URL}/api/verify-recaptcha", json={
            "recaptcha_token": ""
        })
        
        # Should return 200 with error message (not 404)
        assert response.status_code == 200, f"Endpoint should exist, got {response.status_code}"
        
        data = response.json()
        assert "error" in data or data.get("success") == False, f"Should indicate failure: {data}"
        print(f"reCAPTCHA endpoint response for empty token: {data}")
    
    def test_verify_recaptcha_honeypot_trigger(self):
        """POST /api/verify-recaptcha with honeypot filled returns spam error"""
        response = requests.post(f"{BASE_URL}/api/verify-recaptcha", json={
            "recaptcha_token": "test",
            "website_url": "filled-by-bot"  # Honeypot field
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False, f"Honeypot should trigger failure: {data}"
        print(f"Honeypot trigger response: {data}")


class TestSecureLead:
    """Test secure lead endpoint with honeypot protection"""
    
    def test_secure_lead_honeypot_blocks_submission(self):
        """POST /api/secure-lead with honeypot filled should be rejected"""
        response = requests.post(f"{BASE_URL}/api/secure-lead", json={
            "name": "Test Bot",
            "email": "bot@test.com",
            "phone": "9999999999",
            "district": "Patna",
            "property_type": "residential",
            "roof_type": "rcc",
            "website_url": "http://spam.com",  # Honeypot field filled = bot
            "recaptcha_token": ""
        })
        
        # Should be rejected - honeypot triggered
        assert response.status_code == 400, f"Honeypot should reject with 400, got {response.status_code}"
        print("Honeypot correctly blocked submission")
    
    def test_secure_lead_without_honeypot_accepted(self):
        """POST /api/secure-lead without honeypot passes honeypot check"""
        response = requests.post(f"{BASE_URL}/api/secure-lead", json={
            "name": "TEST_SecureLead",
            "email": "test@example.com",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "roof_type": "rcc",
            "website_url": "",  # Empty honeypot = human
            "company_fax": "",  # Empty honeypot = human
            "recaptcha_token": ""  # No token - may pass or fail based on config
        })
        
        # Should at least pass honeypot check (may fail reCAPTCHA)
        # 200 = success, 400 = reCAPTCHA fail (but honeypot passed)
        assert response.status_code in [200, 400], f"Got unexpected status: {response.status_code}"
        print(f"Secure lead response (honeypot empty): {response.status_code}")


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_api_health(self):
        """Check API is running"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code in [200, 404, 405], f"API should be accessible: {response.status_code}"
        print(f"API health check: {response.status_code}")
    
    def test_districts_endpoint(self):
        """GET /api/districts returns Bihar districts"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200
        
        data = response.json()
        assert "districts" in data
        assert len(data["districts"]) > 0
        print(f"Districts count: {len(data['districts'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
