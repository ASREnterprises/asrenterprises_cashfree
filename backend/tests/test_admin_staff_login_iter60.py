"""
Test Admin/Staff OTP Login Restrictions and Staff Leads Pagination
Iteration 60 - Testing:
1. Admin OTP login ONLY allows 8877896889, rejects other numbers
2. Staff OTP login ONLY allows registered staff mobile numbers
3. Staff leads API returns paginated response with 150 per page
4. Staff leads response includes pagination object
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from requirements
ADMIN_MOBILE = "8877896889"
INVALID_MOBILE = "9123456789"
TEST_STAFF_MOBILE = "9876543211"  # ASR1002


class TestAdminOTPLogin:
    """Test Admin OTP login restrictions - only 8877896889 allowed"""
    
    def test_admin_login_with_valid_mobile(self):
        """Admin login with registered mobile 8877896889 should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": ADMIN_MOBILE, "login_type": "admin"}
        )
        
        print(f"Admin valid login response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("role") == "admin"
        assert data.get("email") == "asrenterprisespatna@gmail.com"
        print("✓ Admin login with 8877896889 successful")
    
    def test_admin_login_with_invalid_mobile_rejected(self):
        """Admin login with non-registered mobile should be rejected with 'Invalid details'"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": INVALID_MOBILE, "login_type": "admin"}
        )
        
        print(f"Admin invalid login response: {response.status_code} - {response.text}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "Invalid details" in data.get("detail", "") or "Invalid" in data.get("detail", "")
        print(f"✓ Admin login with {INVALID_MOBILE} correctly rejected")
    
    def test_admin_login_with_random_mobile_rejected(self):
        """Admin login with random mobile number should be rejected"""
        random_mobile = "9999888877"
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": random_mobile, "login_type": "admin"}
        )
        
        print(f"Admin random mobile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "Invalid" in data.get("detail", "")
        print(f"✓ Admin login with random mobile {random_mobile} correctly rejected")
    
    def test_admin_login_with_country_code_prefix(self):
        """Admin login with +91 prefix should work for valid mobile"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": f"+91{ADMIN_MOBILE}", "login_type": "admin"}
        )
        
        print(f"Admin +91 prefix response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Admin login with +91 prefix works correctly")


class TestStaffOTPLogin:
    """Test Staff OTP login restrictions - only registered staff mobiles allowed"""
    
    def test_staff_login_with_unregistered_mobile_rejected(self):
        """Staff login with unregistered mobile should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": INVALID_MOBILE, "login_type": "staff"}
        )
        
        print(f"Staff unregistered mobile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "Invalid login" in data.get("detail", "") or "not registered" in data.get("detail", "")
        print(f"✓ Staff login with unregistered mobile {INVALID_MOBILE} correctly rejected")
    
    def test_staff_login_with_random_mobile_rejected(self):
        """Staff login with random mobile should be rejected with proper message"""
        random_mobile = "7777666655"
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": random_mobile, "login_type": "staff"}
        )
        
        print(f"Staff random mobile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        # Should mention "Invalid login" or "not registered"
        detail = data.get("detail", "")
        assert "Invalid" in detail or "not registered" in detail
        print(f"✓ Staff login with random mobile {random_mobile} correctly rejected")
    
    def test_staff_login_with_admin_mobile_works(self):
        """Staff login with admin mobile should work (admin can access staff portal)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": ADMIN_MOBILE, "login_type": "staff"}
        )
        
        print(f"Staff login with admin mobile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Admin mobile can access staff portal")


class TestStaffLeadsPagination:
    """Test Staff leads API pagination - 150 per page with pagination object"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a valid staff ID for testing"""
        # First get list of staff accounts
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        if response.status_code == 200:
            staff_list = response.json()
            if staff_list and len(staff_list) > 0:
                self.staff_id = staff_list[0].get("staff_id", "ASR1001")
            else:
                self.staff_id = "ASR1001"
        else:
            self.staff_id = "ASR1001"
        print(f"Using staff_id: {self.staff_id}")
    
    def test_staff_leads_returns_paginated_response(self):
        """Staff leads API should return paginated response with leads array and pagination object"""
        response = requests.get(f"{BASE_URL}/api/staff/{self.staff_id}/leads")
        
        print(f"Staff leads response: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip("Staff not found - skipping pagination test")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check response structure
        assert "leads" in data, "Response should contain 'leads' array"
        assert "pagination" in data, "Response should contain 'pagination' object"
        
        print(f"✓ Staff leads returns paginated response structure")
        print(f"  - leads count: {len(data['leads'])}")
        print(f"  - pagination: {data['pagination']}")
    
    def test_staff_leads_pagination_object_structure(self):
        """Pagination object should have required fields"""
        response = requests.get(f"{BASE_URL}/api/staff/{self.staff_id}/leads")
        
        if response.status_code == 404:
            pytest.skip("Staff not found - skipping pagination test")
        
        assert response.status_code == 200
        data = response.json()
        pagination = data.get("pagination", {})
        
        # Check all required pagination fields
        required_fields = ["current_page", "total_pages", "total_count", "per_page", "has_next", "has_prev"]
        for field in required_fields:
            assert field in pagination, f"Pagination should contain '{field}'"
        
        print(f"✓ Pagination object has all required fields: {required_fields}")
        print(f"  - current_page: {pagination.get('current_page')}")
        print(f"  - total_pages: {pagination.get('total_pages')}")
        print(f"  - total_count: {pagination.get('total_count')}")
        print(f"  - per_page: {pagination.get('per_page')}")
        print(f"  - has_next: {pagination.get('has_next')}")
        print(f"  - has_prev: {pagination.get('has_prev')}")
    
    def test_staff_leads_default_limit_is_150(self):
        """Default pagination limit should be 150 per page"""
        response = requests.get(f"{BASE_URL}/api/staff/{self.staff_id}/leads")
        
        if response.status_code == 404:
            pytest.skip("Staff not found - skipping pagination test")
        
        assert response.status_code == 200
        data = response.json()
        pagination = data.get("pagination", {})
        
        # Check per_page is 150
        assert pagination.get("per_page") == 150, f"Expected per_page=150, got {pagination.get('per_page')}"
        print(f"✓ Default pagination limit is 150 per page")
    
    def test_staff_leads_page_1_has_no_prev(self):
        """Page 1 should have has_prev=False"""
        response = requests.get(f"{BASE_URL}/api/staff/{self.staff_id}/leads?page=1")
        
        if response.status_code == 404:
            pytest.skip("Staff not found - skipping pagination test")
        
        assert response.status_code == 200
        data = response.json()
        pagination = data.get("pagination", {})
        
        assert pagination.get("has_prev") == False, "Page 1 should have has_prev=False"
        assert pagination.get("current_page") == 1, "Current page should be 1"
        print(f"✓ Page 1 correctly has has_prev=False")
    
    def test_staff_leads_custom_limit_parameter(self):
        """API should accept custom limit parameter"""
        response = requests.get(f"{BASE_URL}/api/staff/{self.staff_id}/leads?page=1&limit=50")
        
        if response.status_code == 404:
            pytest.skip("Staff not found - skipping pagination test")
        
        assert response.status_code == 200
        data = response.json()
        pagination = data.get("pagination", {})
        
        # When custom limit is passed, per_page should reflect it
        assert pagination.get("per_page") == 50, f"Expected per_page=50, got {pagination.get('per_page')}"
        print(f"✓ Custom limit parameter works correctly")


class TestLoginValidation:
    """Test login input validation"""
    
    def test_admin_login_empty_mobile_rejected(self):
        """Empty mobile should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": "", "login_type": "admin"}
        )
        
        print(f"Empty mobile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Empty mobile correctly rejected")
    
    def test_admin_login_short_mobile_rejected(self):
        """Short mobile number should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login-otp",
            json={"mobile": "12345", "login_type": "admin"}
        )
        
        print(f"Short mobile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Short mobile number correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
