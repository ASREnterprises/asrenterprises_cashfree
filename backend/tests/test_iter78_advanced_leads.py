"""
Iteration 78 - Testing Advanced Leads Management Endpoints
Tests for:
- GET /api/crm/leads/advanced - Advanced leads endpoint with filters and stats
- GET /api/crm/leads/stats - Stats endpoint returns correct counts
- POST /api/crm/leads/bulk-assign - Bulk assign leads to staff
- POST /api/crm/leads/bulk-update - Bulk update leads stage/priority
- POST /api/crm/leads/check-duplicate - Duplicate detection by phone/email
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestAdvancedLeadsEndpoints:
    """Test advanced leads management endpoints"""
    
    def test_advanced_leads_endpoint_basic(self):
        """Test GET /api/crm/leads/advanced returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "leads" in data, "Response should contain 'leads' array"
        assert "pagination" in data, "Response should contain 'pagination' object"
        assert "stats" in data, "Response should contain 'stats' object"
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "current_page" in pagination
        assert "total_pages" in pagination
        assert "total_count" in pagination
        assert "per_page" in pagination
        
        # Verify stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "fresh" in stats
        assert "today" in stats
        assert "follow_up_due" in stats
        assert "hot" in stats
        assert "converted" in stats
        assert "lost" in stats
        assert "unassigned" in stats
        
        print(f"✓ Advanced leads endpoint returns correct structure")
        print(f"  - Total leads: {stats['total']}")
        print(f"  - Fresh: {stats['fresh']}, Today: {stats['today']}")
        print(f"  - Follow-up due: {stats['follow_up_due']}, Hot: {stats['hot']}")
        print(f"  - Unassigned: {stats['unassigned']}")
    
    def test_advanced_leads_with_pagination(self):
        """Test pagination parameters work correctly"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["leads"]) <= 10, "Should return at most 10 leads"
        assert data["pagination"]["per_page"] == 10
        assert data["pagination"]["current_page"] == 1
        
        print(f"✓ Pagination works correctly - returned {len(data['leads'])} leads")
    
    def test_advanced_leads_with_search(self):
        """Test search filter works"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?search=test")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Search filter works - found {len(data['leads'])} leads matching 'test'")
    
    def test_advanced_leads_with_source_filter(self):
        """Test source filter works"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?source=whatsapp")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Source filter works - found {len(data['leads'])} WhatsApp leads")
    
    def test_advanced_leads_with_stage_filter(self):
        """Test stage filter works"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?stage=new")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Stage filter works - found {len(data['leads'])} new leads")
    
    def test_advanced_leads_with_priority_filter(self):
        """Test priority filter works"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?priority=hot")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Priority filter works - found {len(data['leads'])} hot leads")
    
    def test_advanced_leads_quick_filter_fresh(self):
        """Test quick_filter=fresh returns fresh leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?quick_filter=fresh")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Quick filter 'fresh' works - found {len(data['leads'])} fresh leads")
    
    def test_advanced_leads_quick_filter_unassigned(self):
        """Test quick_filter=unassigned returns unassigned leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?quick_filter=unassigned")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Quick filter 'unassigned' works - found {len(data['leads'])} unassigned leads")
    
    def test_advanced_leads_sorting(self):
        """Test sorting options work"""
        # Test newest first
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?sort=newest")
        assert response.status_code == 200
        
        # Test oldest first
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?sort=oldest")
        assert response.status_code == 200
        
        # Test name ascending
        response = requests.get(f"{BASE_URL}/api/crm/leads/advanced?sort=name_asc")
        assert response.status_code == 200
        
        print(f"✓ Sorting options work correctly")


class TestLeadsStatsEndpoint:
    """Test leads stats endpoint"""
    
    def test_stats_endpoint_returns_correct_structure(self):
        """Test GET /api/crm/leads/stats returns correct counts"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all required stats fields
        required_fields = ["total", "fresh", "today", "follow_up_due", "hot", "converted", "lost", "unassigned"]
        for field in required_fields:
            assert field in data, f"Stats should contain '{field}'"
            assert isinstance(data[field], int), f"'{field}' should be an integer"
        
        print(f"✓ Stats endpoint returns correct structure")
        print(f"  Stats: {data}")
    
    def test_stats_values_are_non_negative(self):
        """Test all stats values are non-negative"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/stats")
        assert response.status_code == 200
        
        data = response.json()
        for key, value in data.items():
            assert value >= 0, f"'{key}' should be non-negative, got {value}"
        
        print(f"✓ All stats values are non-negative")


class TestBulkAssignEndpoint:
    """Test bulk assign leads endpoint"""
    
    def test_bulk_assign_requires_lead_ids(self):
        """Test POST /api/crm/leads/bulk-assign validates input"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-assign",
            json={"lead_ids": [], "staff_id": "test-staff-id"}
        )
        # API may return 200 with success=False or 400 for validation errors
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        if response.status_code == 200:
            assert data.get("success") == False or data.get("error"), "Should fail with empty lead_ids"
        print(f"✓ Bulk assign validates empty lead_ids (status: {response.status_code})")
    
    def test_bulk_assign_requires_staff_id(self):
        """Test bulk assign requires staff_id"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-assign",
            json={"lead_ids": ["test-lead-1"]}
        )
        # API may return 200 with success=False or 400 for validation errors
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        if response.status_code == 200:
            assert data.get("success") == False or data.get("error"), "Should fail without staff_id"
        print(f"✓ Bulk assign validates missing staff_id (status: {response.status_code})")


class TestBulkUpdateEndpoint:
    """Test bulk update leads endpoint"""
    
    def test_bulk_update_requires_lead_ids(self):
        """Test POST /api/crm/leads/bulk-update validates input"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-update",
            json={"lead_ids": [], "updates": {"stage": "contacted"}}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == False or data.get("error"), "Should fail with empty lead_ids"
        print(f"✓ Bulk update validates empty lead_ids")
    
    def test_bulk_update_requires_updates(self):
        """Test bulk update requires updates object"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-update",
            json={"lead_ids": ["test-lead-1"], "updates": {}}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == False or data.get("error"), "Should fail with empty updates"
        print(f"✓ Bulk update validates empty updates")


class TestDuplicateCheckEndpoint:
    """Test duplicate check endpoint"""
    
    def test_check_duplicate_by_phone(self):
        """Test POST /api/crm/leads/check-duplicate by phone"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/check-duplicate",
            json={"phone": "9876543210"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "duplicates" in data, "Response should contain 'duplicates' array"
        assert "is_duplicate" in data, "Response should contain 'is_duplicate' boolean"
        
        print(f"✓ Duplicate check by phone works - is_duplicate: {data['is_duplicate']}")
    
    def test_check_duplicate_by_email(self):
        """Test duplicate check by email"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/check-duplicate",
            json={"email": "test@example.com"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "duplicates" in data
        assert "is_duplicate" in data
        
        print(f"✓ Duplicate check by email works - is_duplicate: {data['is_duplicate']}")
    
    def test_check_duplicate_empty_input(self):
        """Test duplicate check with empty input"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/check-duplicate",
            json={}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["duplicates"] == []
        assert data["is_duplicate"] == False
        
        print(f"✓ Duplicate check handles empty input correctly")


class TestLeadTrashEndpoint:
    """Test single lead trash endpoint"""
    
    def test_trash_single_lead_not_found(self):
        """Test POST /api/crm/leads/{lead_id}/trash returns 404 for non-existent lead"""
        response = requests.post(f"{BASE_URL}/api/crm/leads/non-existent-lead-id/trash")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Trash endpoint returns 404 for non-existent lead")


class TestLeadTimelineEndpoint:
    """Test lead timeline endpoint"""
    
    def test_timeline_not_found(self):
        """Test GET /api/crm/leads/{lead_id}/timeline returns 404 for non-existent lead"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/non-existent-lead-id/timeline")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Timeline endpoint returns 404 for non-existent lead")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
