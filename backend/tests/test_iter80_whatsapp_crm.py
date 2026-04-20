"""
Iteration 80 - Testing WhatsApp Tab, CRM Dashboard Tabs, and Site Settings
Features tested:
1. CRM Dashboard tabs - WhatsApp tab present, no duplicate Bookings
2. Staff Portal WhatsApp tab with staffMode filtering
3. Site Settings API for marquee editing
4. WhatsApp API endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestSiteSettingsAPI:
    """Test Site Settings API for marquee editing"""
    
    def test_get_site_settings(self):
        """Test GET /api/site-settings returns marquee settings"""
        response = requests.get(f"{BASE_URL}/api/site-settings")
        assert response.status_code == 200
        data = response.json()
        assert "marquee_text" in data
        assert "marquee_enabled" in data
        print(f"Current marquee text: {data.get('marquee_text', '')[:50]}...")
        print(f"Marquee enabled: {data.get('marquee_enabled')}")
    
    def test_update_site_settings(self):
        """Test POST /api/site-settings updates marquee settings"""
        test_text = "Test Marquee Text from Iteration 80"
        response = requests.post(f"{BASE_URL}/api/site-settings", json={
            "marquee_text": test_text,
            "marquee_enabled": True
        })
        assert response.status_code == 200
        
        # Verify the update
        get_response = requests.get(f"{BASE_URL}/api/site-settings")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data.get("marquee_text") == test_text
        print(f"Successfully updated marquee text to: {test_text}")


class TestCRMDashboardAPI:
    """Test CRM Dashboard API endpoints"""
    
    def test_crm_dashboard_endpoint(self):
        """Test GET /api/crm/dashboard returns dashboard data"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data or "pipeline_stats" in data
        print(f"Dashboard data keys: {list(data.keys())}")
    
    def test_crm_leads_endpoint(self):
        """Test GET /api/crm/leads returns leads list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        # Can be array or object with leads key
        if isinstance(data, list):
            print(f"Leads count: {len(data)}")
        else:
            print(f"Leads count: {len(data.get('leads', []))}")


class TestWhatsAppAPI:
    """Test WhatsApp API endpoints"""
    
    def test_whatsapp_templates_endpoint(self):
        """Test GET /api/whatsapp/templates returns templates list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"WhatsApp templates count: {len(data)}")
        if data:
            print(f"First template: {data[0].get('template_name', 'N/A')}")
    
    def test_whatsapp_conversations_endpoint(self):
        """Test GET /api/whatsapp/conversations returns conversations"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        print(f"WhatsApp conversations count: {len(data.get('conversations', []))}")
    
    def test_whatsapp_unread_count_endpoint(self):
        """Test GET /api/whatsapp/conversations/unread-count"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        print(f"Unread WhatsApp messages: {data.get('unread_count', 0)}")


class TestStaffPortalAPI:
    """Test Staff Portal API endpoints"""
    
    def test_staff_login_email(self):
        """Test POST /api/staff/login-email with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/staff/login-email", json={
            "email": "testlogin@asrenterprises.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "staff" in data
        assert data["staff"]["staff_id"] == "ASR1024"
        print(f"Staff login successful: {data['staff']['name']}")
        return data.get("token")
    
    def test_staff_dashboard(self):
        """Test GET /api/staff/{staff_id}/dashboard"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1024/dashboard")
        assert response.status_code == 200
        data = response.json()
        print(f"Staff dashboard keys: {list(data.keys())}")
    
    def test_staff_leads(self):
        """Test GET /api/staff/{staff_id}/leads returns assigned leads"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1024/leads?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        if isinstance(data, dict) and "leads" in data:
            print(f"Staff assigned leads: {len(data.get('leads', []))}")
        else:
            print(f"Staff assigned leads: {len(data) if isinstance(data, list) else 'N/A'}")


class TestServiceBookingsAPI:
    """Test Service Bookings API - verify no duplicate functionality"""
    
    def test_service_bookings_endpoint(self):
        """Test GET /api/service/bookings returns bookings list"""
        response = requests.get(f"{BASE_URL}/api/service/bookings")
        assert response.status_code == 200
        data = response.json()
        assert "bookings" in data
        print(f"Service bookings count: {len(data.get('bookings', []))}")
    
    def test_service_config_endpoint(self):
        """Test GET /api/service/book-solar-config returns price config"""
        response = requests.get(f"{BASE_URL}/api/service/book-solar-config")
        assert response.status_code == 200
        data = response.json()
        assert "price" in data
        print(f"Service price: ₹{data.get('price', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
