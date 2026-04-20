"""
Iteration 77 - CRM Features Testing
Tests for:
1. Running marquee header on homepage
2. GET /api/crm/leads - pagination structure
3. GET /api/crm/leads/trash - soft-deleted leads
4. POST /api/crm/leads/restore - restore leads from trash
5. POST /api/crm/leads/bulk-delete - soft-delete multiple leads
6. New Inquiries tab - WhatsApp leads only
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestCRMLeadsAPI:
    """Test CRM Leads API endpoints"""
    
    def test_get_leads_returns_pagination_structure(self):
        """GET /api/crm/leads should return leads with correct pagination structure"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check for leads array
        assert "leads" in data, "Response should contain 'leads' key"
        assert isinstance(data["leads"], list), "leads should be a list"
        
        # Check for pagination structure
        assert "pagination" in data, "Response should contain 'pagination' key"
        pagination = data["pagination"]
        
        # Verify pagination fields
        assert "current_page" in pagination, "pagination should have current_page"
        assert "total_pages" in pagination, "pagination should have total_pages"
        assert "total_count" in pagination, "pagination should have total_count"
        assert "per_page" in pagination, "pagination should have per_page"
        assert "has_next" in pagination, "pagination should have has_next"
        assert "has_prev" in pagination, "pagination should have has_prev"
        
        print(f"✅ GET /api/crm/leads - Pagination structure correct")
        print(f"   Total leads: {pagination['total_count']}, Page: {pagination['current_page']}/{pagination['total_pages']}")
    
    def test_get_leads_with_page_parameter(self):
        """GET /api/crm/leads with page parameter"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "leads" in data
        assert "pagination" in data
        assert data["pagination"]["current_page"] == 1
        print(f"✅ GET /api/crm/leads?page=1&limit=10 - Works correctly")


class TestTrashFeatures:
    """Test Trash/Soft-delete features"""
    
    def test_get_trash_endpoint(self):
        """GET /api/crm/leads/trash should return soft-deleted leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/trash")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check response structure
        assert "leads" in data, "Response should contain 'leads' key"
        assert isinstance(data["leads"], list), "leads should be a list"
        assert "total_count" in data, "Response should contain 'total_count'"
        assert "page" in data, "Response should contain 'page'"
        assert "per_page" in data, "Response should contain 'per_page'"
        
        print(f"✅ GET /api/crm/leads/trash - Returns {data['total_count']} trashed leads")
    
    def test_restore_leads_endpoint_empty_list(self):
        """POST /api/crm/leads/restore with empty list should return error"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/restore",
            json={"lead_ids": []}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == False or data.get("error"), "Should indicate failure for empty list"
        print(f"✅ POST /api/crm/leads/restore - Validates empty list correctly")
    
    def test_restore_leads_endpoint_with_ids(self):
        """POST /api/crm/leads/restore with valid IDs"""
        # Use a non-existent ID to test the endpoint works
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/restore",
            json={"lead_ids": ["test-non-existent-id"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert "restored_count" in data or "message" in data, "Response should contain result info"
        print(f"✅ POST /api/crm/leads/restore - Endpoint works correctly")


class TestBulkDeleteFeatures:
    """Test Bulk Delete (soft-delete) features"""
    
    def test_bulk_delete_empty_list(self):
        """POST /api/crm/leads/bulk-delete with empty list should return error"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-delete",
            json={"lead_ids": []}
        )
        # Should return 200 with error message or 400
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        if response.status_code == 200:
            assert data.get("success") == False or data.get("error"), "Should indicate failure for empty list"
        print(f"✅ POST /api/crm/leads/bulk-delete - Validates empty list correctly")
    
    def test_bulk_delete_with_ids(self):
        """POST /api/crm/leads/bulk-delete with valid IDs"""
        # Use a non-existent ID to test the endpoint works
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-delete",
            json={"lead_ids": ["test-non-existent-id"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert "deleted_count" in data or "message" in data, "Response should contain result info"
        print(f"✅ POST /api/crm/leads/bulk-delete - Endpoint works correctly")


class TestNewInquiriesTab:
    """Test New Inquiries tab - should only fetch WhatsApp leads"""
    
    def test_new_leads_whatsapp_only(self):
        """GET /api/crm/new-leads?source=whatsapp should only return WhatsApp leads"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads?source=whatsapp")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leads" in data, "Response should contain 'leads' key"
        assert "total_count" in data, "Response should contain 'total_count'"
        
        # Check that all returned leads are from WhatsApp sources
        whatsapp_sources = ["whatsapp", "whatsapp_direct", "whatsapp_reply", "whatsapp_button"]
        for lead in data["leads"]:
            source = lead.get("source", "")
            assert source in whatsapp_sources, f"Lead source '{source}' is not a WhatsApp source"
        
        print(f"✅ GET /api/crm/new-leads?source=whatsapp - Returns only WhatsApp leads ({data['total_count']} leads)")
    
    def test_new_leads_count_whatsapp(self):
        """GET /api/crm/new-leads/count?source=whatsapp should return count of WhatsApp leads"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads/count?source=whatsapp")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "count" in data, "Response should contain 'count' key"
        assert isinstance(data["count"], int), "count should be an integer"
        
        print(f"✅ GET /api/crm/new-leads/count?source=whatsapp - Returns count: {data['count']}")


class TestCRMDashboard:
    """Test CRM Dashboard endpoint"""
    
    def test_dashboard_endpoint(self):
        """GET /api/crm/dashboard should return dashboard data"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check for expected fields
        assert "total_leads" in data, "Dashboard should have total_leads"
        assert "pipeline_stats" in data, "Dashboard should have pipeline_stats"
        
        print(f"✅ GET /api/crm/dashboard - Returns dashboard data")
        print(f"   Total leads: {data.get('total_leads', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
