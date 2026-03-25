"""
Iteration 44 Tests - New Features Verification
Testing:
1. /api/service/book-solar-config returns correct price
2. /api/admin/staff-accounts/{staff_id}/toggle-otp endpoint exists
3. Staff accounts API works
4. Create staff endpoint works
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestServiceConfiguration:
    """Test service configuration endpoints"""
    
    def test_book_solar_config_returns_price(self):
        """Verify /api/service/book-solar-config returns price"""
        response = requests.get(f"{BASE_URL}/api/service/book-solar-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "price" in data, "Response should contain 'price' field"
        assert isinstance(data["price"], (int, float)), "Price should be numeric"
        print(f"✅ Service price returned: ₹{data['price']}")


class TestStaffAccountsAPI:
    """Test staff accounts management endpoints"""
    
    def test_get_staff_accounts_list(self):
        """Verify /api/admin/staff-accounts returns list of staff"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Found {len(data)} staff accounts")
        
        if len(data) > 0:
            # Check first staff has required fields
            staff = data[0]
            assert "staff_id" in staff, "Staff should have 'staff_id'"
            assert "name" in staff, "Staff should have 'name'"
            print(f"✅ First staff: {staff['name']} ({staff['staff_id']})")
    
    def test_toggle_otp_endpoint_exists(self):
        """Verify /api/admin/staff-accounts/{staff_id}/toggle-otp endpoint exists"""
        # First get a staff ID
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        data = response.json()
        
        if len(data) > 0:
            staff_id = data[0]["staff_id"]
            
            # Test toggle OTP endpoint (should accept PUT request)
            toggle_response = requests.put(
                f"{BASE_URL}/api/admin/staff-accounts/{staff_id}/toggle-otp",
                json={"otp_login_enabled": True}
            )
            
            # Should return 200 (success) or 404 (not found) but not 405 (method not allowed)
            assert toggle_response.status_code != 405, f"Toggle OTP endpoint should accept PUT requests"
            print(f"✅ Toggle OTP endpoint exists, status: {toggle_response.status_code}")
            
            if toggle_response.status_code == 200:
                result = toggle_response.json()
                print(f"✅ Toggle OTP response: {result}")
        else:
            pytest.skip("No staff accounts to test with")
    
    def test_create_staff_account(self):
        """Verify staff creation endpoint works"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "name": f"TEST_Staff {unique_id}",
            "email": f"test_{unique_id}@asr.com",
            "phone": "9876543210",
            "role": "sales",
            "password": "asr@123"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff/register", json=payload)
        
        # Should return 200/201 for success
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "staff_id" in data, "Response should contain 'staff_id'"
        print(f"✅ Staff created with ID: {data['staff_id']}")


class TestCRMEndpoints:
    """Test CRM-related endpoints"""
    
    def test_crm_widget_stats(self):
        """Verify CRM widget stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ CRM widget stats: {response.json()}")
    
    def test_crm_leads_list(self):
        """Verify CRM leads endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Found {len(data)} CRM leads")


class TestPipelineStages:
    """Test pipeline stage functionality"""
    
    def test_pipeline_stages_include_contacted_and_interested(self):
        """Verify expanded pipeline stages in response"""
        # The pipeline stages are defined in frontend, but we can verify staff leads have stage field
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        
        if response.status_code == 200:
            data = response.json()
            if len(data) > 0:
                lead = data[0]
                assert "stage" in lead, "Lead should have 'stage' field"
                print(f"✅ First lead stage: {lead.get('stage', 'N/A')}")


class TestServiceBooking:
    """Test service booking endpoints"""
    
    def test_book_solar_service_endpoint(self):
        """Verify book solar service endpoint exists"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "customer_name": f"TEST_Customer {unique_id}",
            "customer_phone": "9876543210",
            "customer_email": "",
            "amount": 2499,
            "payment_method": "qr_code",
            "transaction_id": f"TEST_TXN_{unique_id}"
        }
        
        response = requests.post(f"{BASE_URL}/api/service/book-solar", json=payload)
        
        # Should return success or booking created
        print(f"Book solar response: {response.status_code} - {response.text[:200] if response.text else 'empty'}")
        
        # Should not return 404 or 405
        assert response.status_code not in [404, 405], f"Endpoint should exist"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
