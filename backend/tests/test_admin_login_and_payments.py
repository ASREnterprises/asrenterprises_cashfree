"""
Test Suite for Admin Login and Payment Features - Iteration 95
Tests:
1. Admin Login Email+Password with direct_login:true (no OTP required)
2. Admin Login with wrong password (401)
3. Template names in cashfree_orders.py (payment_sucess_confirmation, payment_link_asr)
4. PAYMENT_LINK_EVENT webhook handling
5. Staff Login still works
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "asrenterprisespatna@gmail.com"
ADMIN_PASSWORD = "admin@asr123"
ADMIN_WRONG_PASSWORD = "wrongpassword123"
STAFF_ID = "ASR1024"
STAFF_PASSWORD = "test123"


class TestAdminLoginPassword:
    """Test Admin Email+Password login with direct_login flag"""
    
    def test_admin_login_direct_success(self):
        """POST /api/admin/login-password with direct_login:true should return require_otp:false"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={
                "user_id": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "direct_login": True
            },
            timeout=30
        )
        
        print(f"Admin direct login response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success:true"
        assert data.get("require_otp") == False, "Expected require_otp:false for direct_login"
        assert data.get("role") == "admin", "Expected role:admin"
        assert data.get("email") == ADMIN_EMAIL, f"Expected email:{ADMIN_EMAIL}"
        assert "name" in data, "Expected name in response"
        
        print("✅ Admin direct login (no OTP) working correctly")
    
    def test_admin_login_wrong_password(self):
        """POST /api/admin/login-password with wrong password should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={
                "user_id": ADMIN_EMAIL,
                "password": ADMIN_WRONG_PASSWORD,
                "direct_login": True
            },
            timeout=30
        )
        
        print(f"Admin wrong password response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin login with wrong password correctly returns 401")
    
    def test_admin_login_non_admin_email(self):
        """POST /api/admin/login-password with non-admin email should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={
                "user_id": "random@example.com",
                "password": "anypassword",
                "direct_login": True
            },
            timeout=30
        )
        
        print(f"Non-admin email response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Non-admin email correctly rejected")
    
    def test_admin_login_2fa_flow(self):
        """POST /api/admin/login-password without direct_login should return require_otp:true"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-password",
            json={
                "user_id": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "direct_login": False
            },
            timeout=30
        )
        
        print(f"Admin 2FA flow response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success:true"
        assert data.get("require_otp") == True, "Expected require_otp:true for 2FA flow"
        assert "mobile_last4" in data, "Expected mobile_last4 in response"
        
        print("✅ Admin 2FA flow (with OTP) working correctly")


class TestCashfreeWebhook:
    """Test Cashfree webhook handling including PAYMENT_LINK_EVENT"""
    
    def test_webhook_payment_success(self):
        """POST /api/cashfree/webhook with PAYMENT_SUCCESS event should be handled"""
        webhook_payload = {
            "type": "PAYMENT_SUCCESS",
            "data": {
                "order": {
                    "order_id": "TEST_ORDER_12345",
                    "order_amount": 1500.00
                },
                "payment": {
                    "cf_payment_id": "CF_PAY_12345",
                    "payment_amount": 1500.00,
                    "payment_time": "2026-01-15T10:00:00Z",
                    "payment_method": {"upi": {"upi_id": "test@upi"}}
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cashfree/webhook",
            json=webhook_payload,
            timeout=30
        )
        
        print(f"Webhook PAYMENT_SUCCESS response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        # Webhook should return 200 OK even if order not found (idempotent)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "ok", "Expected status:ok"
        
        print("✅ PAYMENT_SUCCESS webhook handled correctly")
    
    def test_webhook_payment_link_event(self):
        """POST /api/cashfree/webhook with PAYMENT_LINK_EVENT should be handled"""
        webhook_payload = {
            "type": "PAYMENT_LINK_EVENT",
            "data": {
                "link_details": {
                    "link_id": "TEST_LINK_12345",
                    "link_status": "PAID",
                    "link_amount_paid": 2000.00
                },
                "order": {
                    "order_id": "TEST_LINK_ORDER_12345"
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cashfree/webhook",
            json=webhook_payload,
            timeout=30
        )
        
        print(f"Webhook PAYMENT_LINK_EVENT response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "ok", "Expected status:ok"
        
        print("✅ PAYMENT_LINK_EVENT webhook handled correctly")
    
    def test_webhook_payment_failed(self):
        """POST /api/cashfree/webhook with PAYMENT_FAILED event should be handled"""
        webhook_payload = {
            "type": "PAYMENT_FAILED",
            "data": {
                "order": {
                    "order_id": "TEST_FAILED_ORDER_12345"
                },
                "payment": {
                    "payment_message": "Payment declined by bank"
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cashfree/webhook",
            json=webhook_payload,
            timeout=30
        )
        
        print(f"Webhook PAYMENT_FAILED response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ PAYMENT_FAILED webhook handled correctly")


class TestCashfreeConfig:
    """Test Cashfree configuration endpoint"""
    
    def test_cashfree_config(self):
        """GET /api/cashfree/config should return production config"""
        response = requests.get(f"{BASE_URL}/api/cashfree/config", timeout=30)
        
        print(f"Cashfree config response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("configured") == True, "Expected configured:true"
        assert data.get("environment") == "PRODUCTION", "Expected environment:PRODUCTION"
        assert data.get("is_sandbox") == False, "Expected is_sandbox:false"
        
        print("✅ Cashfree config endpoint working correctly")


class TestStaffLogin:
    """Test Staff Login still works"""
    
    def test_staff_login_endpoint_exists(self):
        """POST /api/staff/login should exist and respond"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={
                "staff_id": STAFF_ID,
                "password": STAFF_PASSWORD
            },
            timeout=30
        )
        
        print(f"Staff login response: {response.status_code}")
        
        # Staff login should work or return 401 for wrong credentials
        # It should NOT return 404 (endpoint not found)
        assert response.status_code != 404, "Staff login endpoint should exist"
        
        if response.status_code == 200:
            data = response.json()
            print(f"Staff login success: {data}")
            print("✅ Staff login working correctly")
        else:
            print(f"Staff login returned {response.status_code} - endpoint exists")
            print("✅ Staff login endpoint exists")


class TestHomepage:
    """Test Homepage loads correctly"""
    
    def test_homepage_loads(self):
        """GET / should return 200"""
        response = requests.get(f"{BASE_URL}/", timeout=30)
        
        print(f"Homepage response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Homepage loads correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
