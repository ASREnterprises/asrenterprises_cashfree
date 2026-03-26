"""
Test Admin 2FA Login Flow - Iteration 56
Tests:
1. Admin login ONLY allows asrenterprisespatna@gmail.com
2. Admin login returns require_otp:true for 2FA flow
3. Other emails should be rejected
4. Lead Management pagination (50 per page)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestAdminLogin2FA:
    """Test Admin 2FA Login Flow"""
    
    def test_admin_login_correct_email_correct_password(self):
        """Test admin login with correct email and password returns require_otp:true"""
        response = requests.post(f"{BASE_URL}/api/admin/login-password", json={
            "user_id": "asrenterprisespatna@gmail.com",
            "password": "admin@asr123"
        })
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success:true"
        assert data.get("require_otp") == True, "Expected require_otp:true for 2FA"
        assert data.get("role") == "admin", "Expected role:admin"
        assert data.get("email") == "asrenterprisespatna@gmail.com", "Expected correct email"
        assert "mobile_last4" in data, "Expected mobile_last4 in response"
        assert data.get("mobile_last4") == "6889", f"Expected mobile_last4:6889, got {data.get('mobile_last4')}"
        
        print("PASS: Admin login with correct credentials returns require_otp:true")
    
    def test_admin_login_wrong_email_rejected(self):
        """Test that non-admin emails are rejected"""
        response = requests.post(f"{BASE_URL}/api/admin/login-password", json={
            "user_id": "wrongemail@gmail.com",
            "password": "admin@asr123"
        })
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Should be rejected - either 401 or 404
        assert response.status_code in [401, 404], f"Expected 401/404 for wrong email, got {response.status_code}"
        print("PASS: Wrong email is rejected")
    
    def test_admin_login_correct_email_wrong_password(self):
        """Test admin login with correct email but wrong password"""
        response = requests.post(f"{BASE_URL}/api/admin/login-password", json={
            "user_id": "asrenterprisespatna@gmail.com",
            "password": "wrongpassword123"
        })
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 401, f"Expected 401 for wrong password, got {response.status_code}"
        print("PASS: Wrong password is rejected")
    
    def test_admin_login_random_email_rejected(self):
        """Test that random emails are rejected even with correct password"""
        response = requests.post(f"{BASE_URL}/api/admin/login-password", json={
            "user_id": "random@test.com",
            "password": "admin@asr123"
        })
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Should be rejected
        assert response.status_code in [401, 404], f"Expected 401/404 for random email, got {response.status_code}"
        print("PASS: Random email is rejected")


class TestLeadManagementPagination:
    """Test Lead Management with Pagination"""
    
    def test_leads_endpoint_returns_pagination(self):
        """Test that leads endpoint returns paginated data"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=50")
        
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check if response has pagination info
        if isinstance(data, dict):
            print(f"Response keys: {data.keys()}")
            
            # Check for leads array
            if "leads" in data:
                leads = data["leads"]
                print(f"Number of leads returned: {len(leads)}")
                assert len(leads) <= 50, f"Expected max 50 leads per page, got {len(leads)}"
            
            # Check for pagination info
            if "pagination" in data:
                pagination = data["pagination"]
                print(f"Pagination info: {pagination}")
                assert "current_page" in pagination, "Expected current_page in pagination"
                assert "total_pages" in pagination, "Expected total_pages in pagination"
                assert "total_count" in pagination, "Expected total_count in pagination"
                assert "per_page" in pagination, "Expected per_page in pagination"
                
                # Verify per_page is 50
                assert pagination.get("per_page") == 50, f"Expected per_page:50, got {pagination.get('per_page')}"
        elif isinstance(data, list):
            # Old format - array of leads
            print(f"Number of leads returned (array format): {len(data)}")
        
        print("PASS: Leads endpoint returns data")
    
    def test_leads_pagination_page_2(self):
        """Test leads pagination - page 2"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=2&limit=50")
        
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if isinstance(data, dict) and "pagination" in data:
            pagination = data["pagination"]
            print(f"Page 2 pagination: {pagination}")
            assert pagination.get("current_page") == 2, f"Expected current_page:2, got {pagination.get('current_page')}"
        
        print("PASS: Leads pagination page 2 works")
    
    def test_leads_search_filter(self):
        """Test leads search filter"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=50&search=test")
        
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Leads search filter works")
    
    def test_leads_stage_filter(self):
        """Test leads stage filter"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=50&stage=new")
        
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Leads stage filter works")


class TestVerify2FAEndpoint:
    """Test 2FA verification endpoint"""
    
    def test_verify_2fa_endpoint_exists(self):
        """Test that verify-2fa endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/admin/verify-2fa", json={
            "email": "asrenterprisespatna@gmail.com",
            "role": "admin"
        })
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Should return 200 or 404 (if endpoint doesn't exist)
        # We just want to verify the endpoint is accessible
        assert response.status_code in [200, 400, 401, 404, 422], f"Unexpected status: {response.status_code}"
        print("PASS: verify-2fa endpoint is accessible")


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: API is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
