"""
Backend API Tests - Iteration 11
Testing: Banner text, inquiry form, testimonials, reviews API

Test Credentials:
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

# ===== FIXTURES =====
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

# ===== HEALTH CHECK =====
class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_districts(self, api_client):
        """Test districts API returns Bihar districts"""
        response = api_client.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200
        data = response.json()
        assert "districts" in data
        assert "Patna" in data["districts"]
        print("SUCCESS: Districts API working")

# ===== SECURE LEAD ENDPOINT =====
class TestSecureLead:
    """Test POST /api/secure-lead - Inquiry form submission"""
    
    def test_secure_lead_with_6_fields(self, api_client):
        """Test inquiry form with exactly 6 fields (no email required)"""
        payload = {
            "name": f"TEST_Inquiry_{uuid.uuid4().hex[:6]}",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 3500,
            "roof_area": 5,  # Maps to solar_capacity
            "recaptcha_token": "",
            "website_url": ""  # Honeypot field - must be empty
        }
        response = api_client.post(f"{BASE_URL}/api/secure-lead", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "lead" in data
        assert data["lead"]["name"] == payload["name"]
        assert data["lead"]["phone"] == "9876543210"
        assert data["lead"]["district"] == "Patna"
        print(f"SUCCESS: Lead created with ID: {data['lead']['id']}")
    
    def test_secure_lead_honeypot_blocks_spam(self, api_client):
        """Test honeypot field blocks spam submissions"""
        payload = {
            "name": "SpamBot Test",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "website_url": "http://spam.com"  # Honeypot filled = spam
        }
        response = api_client.post(f"{BASE_URL}/api/secure-lead", json=payload)
        assert response.status_code == 400
        assert "rejected" in response.json().get("detail", "").lower()
        print("SUCCESS: Honeypot blocked spam submission")

# ===== REVIEWS/TESTIMONIALS ENDPOINTS =====
class TestTestimonials:
    """Test testimonials endpoints"""
    
    def test_get_reviews(self, api_client):
        """Test GET /api/reviews returns testimonials from database"""
        response = api_client.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/reviews returned {len(data)} testimonials")
        
        # Check if Rajesh Kumar testimonial exists
        names = [r.get("customer_name", "") for r in data]
        print(f"  Testimonials found: {names}")
    
    def test_generate_testimonial(self, api_client):
        """Test POST /api/crm/generate-testimonial creates auto-generated testimonial"""
        payload = {
            "name": f"TEST_Customer_{uuid.uuid4().hex[:6]}",
            "address": "Test Address, Bihar",
            "solar_capacity": "5",
            "bill_before": "4000",
            "bill_after": "200",
            "rating": 5
        }
        response = api_client.post(f"{BASE_URL}/api/crm/generate-testimonial", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["customer_name"] == payload["name"]
        assert data["location"] == payload["address"]
        assert data["solar_capacity"] == payload["solar_capacity"]
        assert data["monthly_bill_before"] == payload["bill_before"]
        assert data["monthly_bill_after"] == payload["bill_after"]
        assert data["rating"] == payload["rating"]
        assert data["is_testimonial"] == True
        
        # Verify auto-generated text
        assert "solar system installed by ASR Enterprises" in data["review_text"]
        assert payload["address"] in data["review_text"]
        
        print(f"SUCCESS: Generated testimonial ID: {data['id']}")
        print(f"  Auto-generated text: {data['review_text'][:100]}...")
        
        return data["id"]
    
    def test_testimonial_appears_in_reviews(self, api_client):
        """Test that generated testimonials appear in GET /api/reviews"""
        # First create a testimonial
        test_name = f"TEST_Live_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": test_name,
            "address": "Live Test Location",
            "solar_capacity": "3",
            "bill_before": "3000",
            "bill_after": "0",
            "rating": 5
        }
        create_response = api_client.post(f"{BASE_URL}/api/crm/generate-testimonial", json=payload)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]
        
        # Now fetch all reviews
        reviews_response = api_client.get(f"{BASE_URL}/api/reviews")
        assert reviews_response.status_code == 200
        reviews = reviews_response.json()
        
        # Check if our testimonial is in the list
        found = any(r.get("id") == created_id for r in reviews)
        assert found, f"Created testimonial {created_id} not found in reviews list"
        print(f"SUCCESS: Testimonial {created_id} found in /api/reviews")

# ===== CRM DASHBOARD =====
class TestCRMDashboard:
    """Test CRM Dashboard API"""
    
    def test_crm_dashboard_stats(self, api_client):
        """Test CRM dashboard returns pipeline stats"""
        response = api_client.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_leads" in data
        assert "pipeline_stats" in data
        print(f"SUCCESS: CRM Dashboard - {data['total_leads']} total leads")
    
    def test_crm_leads_list(self, api_client):
        """Test CRM leads list endpoint"""
        response = api_client.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: CRM Leads - {len(data)} leads returned")

# ===== ADMIN AUTHENTICATION =====
class TestAdminAuth:
    """Test admin authentication flow"""
    
    def test_admin_send_otp(self, api_client):
        """Test admin OTP sending"""
        response = api_client.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "asrenterprisespatna@gmail.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("SUCCESS: Admin OTP sent")
    
    def test_admin_verify_otp(self, api_client):
        """Test admin OTP verification with fallback OTP"""
        # First send OTP
        api_client.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "asrenterprisespatna@gmail.com"
        })
        
        # Verify with fallback OTP
        response = api_client.post(f"{BASE_URL}/api/admin/verify-otp", json={
            "email": "asrenterprisespatna@gmail.com",
            "otp": "131993"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["role"] == "admin"
        print("SUCCESS: Admin login verified")

# ===== STAFF LOGIN =====
class TestStaffLogin:
    """Test staff login flow"""
    
    def test_staff_login_requires_2fa(self, api_client):
        """Test staff login returns requires_otp for 2FA"""
        response = api_client.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("requires_otp") == True
        print("SUCCESS: Staff login requires 2FA OTP")
    
    def test_staff_2fa_verification(self, api_client):
        """Test staff 2FA OTP verification"""
        # First login to get requires_otp
        login_response = api_client.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        assert login_response.json().get("requires_otp") == True
        
        # Verify 2FA with fallback OTP
        response = api_client.post(f"{BASE_URL}/api/staff/verify-2fa", json={
            "staff_id": "ASR1001",
            "otp": "131993"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data or data.get("success") == True
        print("SUCCESS: Staff 2FA verified")

# ===== CLEANUP =====
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after tests"""
    yield
    # Note: Test data will be cleaned up by admin or left for manual review
    print("Test cleanup - TEST_ prefixed data may remain in database")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
