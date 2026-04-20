"""
Iteration 42 - Backend API Tests
Testing:
1. Service Book Solar Config endpoint
2. Admin login endpoints
3. HR Management endpoints
4. Basic health and configuration checks
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestHealthAndConfig:
    """Basic health and configuration tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"Health endpoint status: {response.status_code}")
        assert response.status_code == 200
        print("✅ Health endpoint working")
    
    def test_book_solar_config_endpoint(self):
        """Test /api/service/book-solar-config returns service price"""
        response = requests.get(f"{BASE_URL}/api/service/book-solar-config")
        print(f"Book Solar Config status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "price" in data
        print(f"✅ Book Solar Service price: ₹{data['price']}")
        # Default should be 2499
        assert isinstance(data['price'], (int, float))


class TestAdminLogin:
    """Admin login endpoint tests"""
    
    def test_admin_login_password_endpoint_exists(self):
        """Test admin password login endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/admin/login-password", json={
            "user_id": "test@test.com",
            "password": "wrongpassword"
        })
        print(f"Admin login password endpoint status: {response.status_code}")
        # Should return 401 for invalid credentials, not 404
        assert response.status_code in [401, 400, 403, 422]
        print("✅ Admin password login endpoint exists")
    
    def test_admin_login_otp_endpoint_exists(self):
        """Test admin OTP login endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/admin/login-otp", json={
            "mobile": "1234567890"
        })
        print(f"Admin OTP login endpoint status: {response.status_code}")
        # Should return 400/401/403 for invalid/unregistered mobile, not 404
        assert response.status_code in [400, 401, 403, 422]
        print("✅ Admin OTP login endpoint exists")


class TestStaffLogin:
    """Staff login endpoint tests"""
    
    def test_staff_login_endpoint_exists(self):
        """Test staff password login endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR9999",
            "password": "wrongpassword"
        })
        print(f"Staff login endpoint status: {response.status_code}")
        # Should return error for invalid credentials, not 404
        assert response.status_code in [400, 401, 403, 422]
        print("✅ Staff login endpoint exists")


class TestHREndpoints:
    """HR Management endpoint tests"""
    
    def test_hr_dashboard_endpoint(self):
        """Test HR dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        print(f"HR Dashboard status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ HR Dashboard data keys: {list(data.keys())}")
    
    def test_hr_employees_list_endpoint(self):
        """Test HR employees list endpoint"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        print(f"HR Employees status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "employees" in data
        print(f"✅ HR Employees count: {len(data.get('employees', []))}")


class TestCRMEndpoints:
    """CRM endpoint tests"""
    
    def test_crm_leads_endpoint(self):
        """Test CRM leads endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        print(f"CRM Leads status: {response.status_code}")
        # May require auth but shouldn't be 404
        assert response.status_code in [200, 401, 403]
        print(f"✅ CRM Leads endpoint exists (status: {response.status_code})")
    
    def test_crm_dashboard_endpoint(self):
        """Test CRM dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        print(f"CRM Dashboard status: {response.status_code}")
        # May require auth but shouldn't be 404
        assert response.status_code in [200, 401, 403]
        print(f"✅ CRM Dashboard endpoint exists (status: {response.status_code})")


class TestPublicEndpoints:
    """Public website endpoint tests"""
    
    def test_leads_public_endpoint(self):
        """Test public leads endpoint (for form submissions)"""
        response = requests.post(f"{BASE_URL}/api/secure-lead", json={
            "name": "Test User",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential"
        })
        print(f"Secure Lead endpoint status: {response.status_code}")
        # Should accept valid lead or return validation error
        assert response.status_code in [200, 201, 400, 422, 429]
        print(f"✅ Public lead submission endpoint working")
    
    def test_reviews_public_endpoint(self):
        """Test public reviews endpoint"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        print(f"Reviews endpoint status: {response.status_code}")
        assert response.status_code == 200
        print(f"✅ Public reviews endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
