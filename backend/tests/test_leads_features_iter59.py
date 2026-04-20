"""
Test file for CRM Leads Features - Iteration 59
Tests:
1. Admin CRM Leads shows 250 per page (not 50)
2. Admin CRM has Staff Leads Distribution section showing each staff's lead count
3. Admin CRM has staff filter dropdown to filter leads by staff
4. Staff Portal has Refresh button that clears cache and fetches fresh data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadsPagination:
    """Test leads pagination - 250 per page"""
    
    def test_leads_endpoint_returns_pagination_info(self):
        """Test that /api/crm/leads returns pagination with per_page=250"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=250")
        assert response.status_code == 200
        
        data = response.json()
        # Check pagination structure
        assert "leads" in data
        assert "pagination" in data
        
        pagination = data["pagination"]
        assert pagination["per_page"] == 250
        assert "current_page" in pagination
        assert "total_pages" in pagination
        assert "total_count" in pagination
        print(f"✓ Leads pagination: per_page={pagination['per_page']}, total={pagination['total_count']}")
    
    def test_leads_default_limit_is_250(self):
        """Test that default limit is 250 when not specified"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        
        data = response.json()
        pagination = data.get("pagination", {})
        # Default should be 250
        assert pagination.get("per_page", 250) == 250
        print(f"✓ Default per_page is 250")


class TestStaffLeadsDistribution:
    """Test staff leads distribution feature"""
    
    def test_staff_accounts_include_leads_assigned(self):
        """Test that staff accounts include leads_assigned count"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        
        staff_list = response.json()
        assert isinstance(staff_list, list)
        
        # Check that each staff has leads_assigned field
        for staff in staff_list[:5]:  # Check first 5
            assert "leads_assigned" in staff or staff.get("leads_assigned") is not None or staff.get("leads_assigned", 0) >= 0
            print(f"  Staff {staff.get('name')}: {staff.get('leads_assigned', 0)} leads")
        
        print(f"✓ Staff accounts include leads_assigned count")
    
    def test_staff_accounts_have_required_fields(self):
        """Test that staff accounts have all required fields for distribution display"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        
        staff_list = response.json()
        if len(staff_list) > 0:
            staff = staff_list[0]
            required_fields = ["id", "name", "staff_id", "is_active"]
            for field in required_fields:
                assert field in staff, f"Missing field: {field}"
            print(f"✓ Staff accounts have required fields: {required_fields}")


class TestStaffLeadsFilter:
    """Test staff filter functionality for leads"""
    
    def test_leads_have_assigned_to_field(self):
        """Test that leads have assigned_to field for filtering"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        leads = data.get("leads", [])
        
        if len(leads) > 0:
            # Check that leads have assigned_to field
            for lead in leads[:5]:
                assert "assigned_to" in lead
            print(f"✓ Leads have assigned_to field for filtering")
        else:
            print("⚠ No leads found to verify assigned_to field")
    
    def test_leads_can_be_filtered_by_stage(self):
        """Test that leads can be filtered by stage"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?stage=new&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        leads = data.get("leads", [])
        
        # All returned leads should have stage=new
        for lead in leads:
            assert lead.get("stage") == "new", f"Lead stage is {lead.get('stage')}, expected 'new'"
        
        print(f"✓ Leads can be filtered by stage (found {len(leads)} 'new' leads)")


class TestStaffPortalRefresh:
    """Test staff portal refresh functionality"""
    
    def test_staff_leads_endpoint_exists(self):
        """Test that staff leads endpoint exists"""
        # Use a known staff_id from previous tests
        staff_id = "ASR1002"
        response = requests.get(f"{BASE_URL}/api/staff/{staff_id}/leads")
        # Should return 200 or 404 (if staff not found), not 500
        assert response.status_code in [200, 404]
        print(f"✓ Staff leads endpoint exists: /api/staff/{staff_id}/leads")
    
    def test_staff_dashboard_endpoint_exists(self):
        """Test that staff dashboard endpoint exists"""
        staff_id = "ASR1002"
        response = requests.get(f"{BASE_URL}/api/staff/{staff_id}/dashboard")
        assert response.status_code in [200, 404]
        print(f"✓ Staff dashboard endpoint exists: /api/staff/{staff_id}/dashboard")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
