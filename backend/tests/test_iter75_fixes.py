"""
Iteration 75 - ASR Solar CRM Multiple Fixes Testing
Tests:
1. GET /api/service/book-solar-config - returns dynamic price
2. GET /api/crm/new-leads - only returns WhatsApp leads
3. GET /api/service/bookings - endpoint exists
4. CRM Dashboard navigation has Bookings tab, no Social Media tab (UI test)
5. Homepage has Book Service flashing widget button (UI test)
6. Social Media Manager has Back button (UI test)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBookSolarServiceConfig:
    """Test Book Solar Service price configuration endpoint"""
    
    def test_get_book_solar_config_returns_price(self):
        """GET /api/service/book-solar-config should return dynamic price"""
        response = requests.get(f"{BASE_URL}/api/service/book-solar-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "price" in data, "Response should contain 'price' field"
        assert isinstance(data["price"], (int, float)), "Price should be a number"
        assert data["price"] > 0, "Price should be positive"
        print(f"✅ Book Solar Service price: ₹{data['price']}")


class TestNewLeadsEndpoint:
    """Test New Leads Inbox endpoint - should only return WhatsApp leads"""
    
    def test_new_leads_endpoint_exists(self):
        """GET /api/crm/new-leads should exist and return data"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leads" in data, "Response should contain 'leads' field"
        assert "total_count" in data, "Response should contain 'total_count' field"
        print(f"✅ New leads endpoint working - {data['total_count']} total new leads")
    
    def test_new_leads_default_whatsapp_filter(self):
        """GET /api/crm/new-leads should filter WhatsApp leads by default"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads")
        assert response.status_code == 200
        
        data = response.json()
        leads = data.get("leads", [])
        
        # If there are leads, verify they are from WhatsApp sources
        whatsapp_sources = ["whatsapp", "whatsapp_direct", "whatsapp_reply", "whatsapp_button"]
        for lead in leads:
            source = lead.get("source", "")
            assert source in whatsapp_sources or source == "", \
                f"Lead source '{source}' should be WhatsApp-related"
        
        print(f"✅ New leads filter working - {len(leads)} WhatsApp leads returned")
    
    def test_new_leads_count_endpoint(self):
        """GET /api/crm/new-leads/count should return count"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads/count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "count" in data, "Response should contain 'count' field"
        assert isinstance(data["count"], int), "Count should be an integer"
        print(f"✅ New leads count: {data['count']}")


class TestServiceBookingsEndpoint:
    """Test Service Bookings endpoint"""
    
    def test_bookings_endpoint_exists(self):
        """GET /api/service/bookings should exist"""
        response = requests.get(f"{BASE_URL}/api/service/bookings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "bookings" in data, "Response should contain 'bookings' field"
        assert "count" in data, "Response should contain 'count' field"
        print(f"✅ Service bookings endpoint working - {data['count']} bookings")


class TestCRMDashboardEndpoint:
    """Test CRM Dashboard endpoint"""
    
    def test_crm_dashboard_endpoint(self):
        """GET /api/crm/dashboard should return dashboard data"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Dashboard should have some stats
        print(f"✅ CRM Dashboard endpoint working")


class TestHealthEndpoint:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """GET /api/health should return OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Health endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
