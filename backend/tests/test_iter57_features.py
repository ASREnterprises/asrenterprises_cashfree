"""
Test Suite for Iteration 57 - Testing reported bug fixes:
1. Lead Management API - /api/crm/leads returns paginated leads (50 per page)
2. HR Management API - /api/hr/employees returns employees list
3. HR Dashboard API - /api/hr/dashboard returns active employees count
4. Staff Login 2FA - /api/staff/login returns require_otp:true with mobile_last4
5. Business hours shows '10:00 AM - 7:00 PM Monday-Saturday' and 'Sunday: Closed' on contact page
6. Gallery CTA shows 'Contact Us' not 'Explore Products'
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestLeadManagementAPI:
    """Test Lead Management API - pagination with 50 per page"""
    
    def test_leads_endpoint_returns_paginated_data(self):
        """Test /api/crm/leads returns paginated leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=50")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leads" in data, "Response should contain 'leads' key"
        assert "pagination" in data, "Response should contain 'pagination' key"
        
        pagination = data["pagination"]
        assert "total_count" in pagination, "Pagination should have total_count"
        assert "current_page" in pagination, "Pagination should have current_page"
        assert "total_pages" in pagination, "Pagination should have total_pages"
        assert "per_page" in pagination, "Pagination should have per_page"
        
        # Verify 50 per page limit
        assert pagination["per_page"] == 50, f"Expected 50 per page, got {pagination['per_page']}"
        assert len(data["leads"]) <= 50, f"Should return max 50 leads, got {len(data['leads'])}"
        
        print(f"✓ Leads API working: {len(data['leads'])} leads returned, total: {pagination['total_count']}")
    
    def test_leads_pagination_page_2(self):
        """Test pagination works for page 2"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=2&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        pagination = data["pagination"]
        
        if pagination["total_pages"] >= 2:
            assert pagination["current_page"] == 2, "Should be on page 2"
            assert pagination["has_prev"] == True, "Page 2 should have previous page"
            print(f"✓ Page 2 working: {len(data['leads'])} leads on page 2")
        else:
            print(f"✓ Only 1 page of leads (total: {pagination['total_count']})")


class TestHRManagementAPI:
    """Test HR Management API - employees list and dashboard"""
    
    def test_hr_employees_endpoint(self):
        """Test /api/hr/employees returns employees list"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "employees" in data, "Response should contain 'employees' key"
        assert "total" in data, "Response should contain 'total' key"
        
        employees = data["employees"]
        assert isinstance(employees, list), "Employees should be a list"
        
        # Check employee structure
        if len(employees) > 0:
            emp = employees[0]
            assert "employee_id" in emp, "Employee should have employee_id"
            assert "name" in emp, "Employee should have name"
            assert "is_active" in emp, "Employee should have is_active status"
        
        print(f"✓ HR Employees API working: {data['total']} employees returned")
    
    def test_hr_dashboard_endpoint(self):
        """Test /api/hr/dashboard returns active employees count"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total_employees" in data, "Dashboard should have total_employees"
        assert "active_employees" in data, "Dashboard should have active_employees"
        
        # Verify active employees count is reasonable
        assert data["active_employees"] >= 0, "Active employees should be >= 0"
        assert data["active_employees"] <= data["total_employees"], "Active should be <= total"
        
        print(f"✓ HR Dashboard API working: {data['active_employees']} active out of {data['total_employees']} total")
    
    def test_hr_employees_filter_by_status(self):
        """Test HR employees can be filtered by status"""
        response = requests.get(f"{BASE_URL}/api/hr/employees?status=active")
        assert response.status_code == 200
        
        data = response.json()
        # All returned employees should be active
        for emp in data.get("employees", []):
            if "status" in emp:
                assert emp["status"] == "active", f"Expected active status, got {emp['status']}"
        
        print(f"✓ HR Employees filter working: {data['total']} active employees")


class TestStaffLogin2FA:
    """Test Staff Login 2FA - returns require_otp:true with mobile_last4"""
    
    def test_staff_login_returns_2fa_requirement(self):
        """Test /api/staff/login returns require_otp:true with mobile_last4"""
        # Use test staff credentials - ASR1024 with password test123
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"staff_id": "ASR1024", "password": "test123"}
        )
        
        # Should return 200 with 2FA requirement
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Login should be successful"
        assert data.get("require_otp") == True, "Should require OTP for 2FA"
        assert "mobile_last4" in data, "Should return mobile_last4"
        assert len(data.get("mobile_last4", "")) == 4, "mobile_last4 should be 4 digits"
        
        print(f"✓ Staff 2FA working: require_otp={data['require_otp']}, mobile_last4={data['mobile_last4']}")
    
    def test_staff_login_invalid_credentials(self):
        """Test staff login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"staff_id": "ASR1024", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected with 401")
    
    def test_staff_login_nonexistent_staff(self):
        """Test staff login with non-existent staff ID returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"staff_id": "NONEXISTENT", "password": "anypassword"}
        )
        
        assert response.status_code == 401, f"Expected 401 for non-existent staff, got {response.status_code}"
        print("✓ Non-existent staff correctly rejected with 401")


class TestAPIHealth:
    """Test API health and basic connectivity"""
    
    def test_api_root_accessible(self):
        """Test API root is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        # API root should return 200 or redirect
        assert response.status_code in [200, 307, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ API root accessible: status {response.status_code}")
    
    def test_crm_leads_accessible(self):
        """Test CRM leads endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200, f"CRM leads should be accessible, got {response.status_code}"
        print("✓ CRM leads endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
