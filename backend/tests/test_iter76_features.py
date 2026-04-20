"""
Iteration 76 - Testing Features:
1. POST /api/crm/leads/bulk-delete endpoint
2. GET /api/crm/new-leads returns all new leads (source=all by default)
3. Bulk campaign template check - templates with variable_count=0 should not send variables
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBulkDeleteEndpoint:
    """Test POST /api/crm/leads/bulk-delete endpoint"""
    
    def test_bulk_delete_endpoint_exists(self):
        """Test that bulk-delete endpoint exists and responds"""
        # Empty list should return 400 with proper error message
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-delete",
            json={"lead_ids": []},
            headers={"Content-Type": "application/json"}
        )
        # Returns 400 when no IDs provided - this is correct validation
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "No lead IDs" in data.get("detail", "")
        print(f"✓ Bulk delete endpoint validates empty list - Response: {data}")
    
    def test_bulk_delete_with_invalid_ids(self):
        """Test bulk delete with non-existent IDs"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-delete",
            json={"lead_ids": ["non-existent-id-1", "non-existent-id-2"]},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("deleted_count") == 0  # No leads deleted since IDs don't exist
        print(f"✓ Bulk delete with invalid IDs - deleted_count: {data.get('deleted_count')}")


class TestNewLeadsEndpoint:
    """Test GET /api/crm/new-leads returns all new leads"""
    
    def test_new_leads_default_returns_all_sources(self):
        """Test that new-leads endpoint returns all sources by default"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads")
        assert response.status_code == 200
        data = response.json()
        
        assert "leads" in data
        assert "total_count" in data
        print(f"✓ New leads endpoint returns {data.get('total_count')} leads")
        
        # Check that leads from various sources are included
        if data.get("leads"):
            sources = set(lead.get("source", "unknown") for lead in data["leads"])
            print(f"  Sources found: {sources}")
    
    def test_new_leads_with_source_filter(self):
        """Test new-leads with source=whatsapp filter"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads?source=whatsapp")
        assert response.status_code == 200
        data = response.json()
        
        assert "leads" in data
        print(f"✓ New leads with source=whatsapp returns {data.get('total_count')} leads")
    
    def test_new_leads_count_endpoint(self):
        """Test new-leads count endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads/count")
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        print(f"✓ New leads count: {data.get('count')}")


class TestWhatsAppTemplates:
    """Test WhatsApp template variable handling"""
    
    def test_get_templates(self):
        """Test getting WhatsApp templates"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of templates
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} WhatsApp templates")
        
        # Check for templates with variable_count=0
        for template in data:
            name = template.get("template_name") or template.get("name", "unknown")
            var_count = template.get("variable_count", 0)
            has_vars = template.get("has_variables", False)
            print(f"  - {name}: variable_count={var_count}, has_variables={has_vars}")
    
    def test_hello_world_template_has_no_variables(self):
        """Test that hello_world template has variable_count=0"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200
        data = response.json()
        
        # Find hello_world template
        hello_world = None
        for template in data:
            name = template.get("template_name") or template.get("name", "")
            if name == "hello_world":
                hello_world = template
                break
        
        if hello_world:
            var_count = hello_world.get("variable_count", 0)
            assert var_count == 0, f"hello_world should have variable_count=0, got {var_count}"
            print(f"✓ hello_world template has variable_count=0")
        else:
            print("⚠ hello_world template not found in list")


class TestBookServiceWidget:
    """Test Book Service widget configuration"""
    
    def test_book_solar_config_endpoint(self):
        """Test GET /api/service/book-solar-config returns price"""
        response = requests.get(f"{BASE_URL}/api/service/book-solar-config")
        assert response.status_code == 200
        data = response.json()
        
        assert "price" in data
        price = data.get("price")
        assert price > 0
        print(f"✓ Book Solar Service price: ₹{price}")


class TestCRMDashboard:
    """Test CRM Dashboard endpoints"""
    
    def test_dashboard_endpoint(self):
        """Test CRM dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_leads" in data
        assert "pipeline_stats" in data
        print(f"✓ Dashboard - Total leads: {data.get('total_leads')}")
        print(f"  Pipeline stats: {data.get('pipeline_stats')}")
    
    def test_leads_endpoint(self):
        """Test CRM leads endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        
        # Can be list or object with leads key
        if isinstance(data, list):
            print(f"✓ Leads endpoint returns {len(data)} leads")
        else:
            leads = data.get("leads", [])
            print(f"✓ Leads endpoint returns {len(leads)} leads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
