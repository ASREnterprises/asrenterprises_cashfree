"""
CRM and Staff Portal API Tests - Iteration 55
Tests for: Admin CRM Dashboard, Staff Portal, Lead Management
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

# Test staff credentials
TEST_STAFF_ID = "ASR1024"
TEST_STAFF_INTERNAL_ID = "3fa43420-e9d3-4d41-a6dc-0fb3b5c6749b"


class TestCRMDashboard:
    """Admin CRM Dashboard API Tests"""
    
    def test_crm_widget_stats(self):
        """Test CRM widget stats endpoint returns correct data"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_leads" in data
        assert "new_leads" in data
        assert "active_staff" in data
        assert data["total_leads"] >= 0
        print(f"CRM Stats: {data['total_leads']} total leads, {data['active_staff']} active staff")
    
    def test_crm_dashboard(self):
        """Test CRM dashboard endpoint returns comprehensive data"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_leads" in data
        assert "pipeline_stats" in data
        assert "recent_leads" in data
        print(f"Dashboard: {data['total_leads']} leads, pipeline: {data['pipeline_stats']}")
    
    def test_crm_leads_list(self):
        """Test CRM leads list endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        
        data = response.json()
        # Handle both array and paginated response
        if isinstance(data, list):
            leads = data
        else:
            leads = data.get("leads", [])
        
        assert isinstance(leads, list)
        print(f"Leads list: {len(leads)} leads returned")
        
        # Verify lead structure if leads exist
        if leads:
            lead = leads[0]
            assert "id" in lead
            assert "name" in lead
            assert "phone" in lead
            assert "stage" in lead
    
    def test_crm_leads_filter_by_stage(self):
        """Test CRM leads filtering by stage"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?stage=new")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, list):
            leads = data
        else:
            leads = data.get("leads", [])
        
        # All returned leads should have stage 'new'
        for lead in leads:
            assert lead.get("stage") == "new", f"Lead {lead.get('id')} has stage {lead.get('stage')}, expected 'new'"
        print(f"Filtered leads: {len(leads)} leads with stage 'new'")
    
    def test_crm_pipeline_widget(self):
        """Test CRM pipeline widget endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/pipeline")
        assert response.status_code == 200
        
        data = response.json()
        # API returns pipeline_stages array instead of pipeline dict
        assert "pipeline_stages" in data or "pipeline" in data
        
        if "pipeline_stages" in data:
            stages = data["pipeline_stages"]
            assert isinstance(stages, list)
            stage_ids = [s.get("_id") for s in stages if s.get("_id")]
            print(f"Pipeline widget stages: {stage_ids}")
        else:
            pipeline = data["pipeline"]
            print(f"Pipeline widget: {pipeline}")


class TestStaffPortal:
    """Staff Portal API Tests"""
    
    def test_staff_dashboard(self):
        """Test staff dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "staff" in data
        assert "total_assigned" in data
        assert "pipeline_stats" in data
        
        staff = data["staff"]
        assert staff["staff_id"] == TEST_STAFF_ID
        print(f"Staff dashboard: {data['total_assigned']} assigned leads")
    
    def test_staff_leads(self):
        """Test staff assigned leads endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/leads")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        print(f"Staff leads: {len(leads)} assigned leads")
        
        # Verify all leads are assigned to this staff
        for lead in leads:
            assert lead.get("assigned_to") == TEST_STAFF_INTERNAL_ID, \
                f"Lead {lead.get('id')} assigned to {lead.get('assigned_to')}, expected {TEST_STAFF_INTERNAL_ID}"
    
    def test_staff_followups(self):
        """Test staff followups endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/followups")
        assert response.status_code == 200
        
        followups = response.json()
        assert isinstance(followups, list)
        print(f"Staff followups: {len(followups)} followups")
    
    def test_staff_tasks_today(self):
        """Test staff today's tasks endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/tasks/today")
        assert response.status_code == 200
        
        tasks = response.json()
        assert isinstance(tasks, list)
        print(f"Staff tasks today: {len(tasks)} tasks")
    
    def test_staff_messages(self):
        """Test staff messages endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/messages")
        assert response.status_code == 200
        
        messages = response.json()
        assert isinstance(messages, list)
        print(f"Staff messages: {len(messages)} messages")
    
    def test_staff_notifications(self):
        """Test staff notifications endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/notifications")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"Staff notifications: {data['unread_count']} unread")


class TestLeadManagement:
    """Lead Management API Tests"""
    
    def test_staff_update_lead_stage(self):
        """Test staff can update lead stage"""
        # First get a lead assigned to this staff
        response = requests.get(f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/leads")
        assert response.status_code == 200
        
        leads = response.json()
        if not leads:
            pytest.skip("No leads assigned to test staff")
        
        lead = leads[0]
        lead_id = lead["id"]
        current_stage = lead.get("stage", "new")
        
        # Update to a different stage
        new_stage = "contacted" if current_stage != "contacted" else "site_visit"
        
        response = requests.put(
            f"{BASE_URL}/api/staff/{TEST_STAFF_ID}/leads/{lead_id}",
            json={"stage": new_stage}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"Lead {lead_id} stage updated from {current_stage} to {new_stage}")
    
    def test_admin_assign_lead(self):
        """Test admin can assign lead to staff"""
        # Get a lead that's not assigned
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, list):
            leads = data
        else:
            leads = data.get("leads", [])
        
        # Find an unassigned lead or use any lead
        lead = None
        for l in leads:
            if not l.get("assigned_to"):
                lead = l
                break
        
        if not lead and leads:
            lead = leads[0]  # Use first lead if all are assigned
        
        if not lead:
            pytest.skip("No leads available for assignment test")
        
        lead_id = lead["id"]
        
        # Assign to test staff
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/{lead_id}/assign",
            json={"employee_id": TEST_STAFF_INTERNAL_ID, "assigned_by": "admin"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"Lead {lead_id} assigned to staff {TEST_STAFF_ID}")


class TestCRMTasks:
    """CRM Tasks API Tests"""
    
    def test_get_tasks(self):
        """Test get all CRM tasks"""
        response = requests.get(f"{BASE_URL}/api/crm/tasks")
        assert response.status_code == 200
        
        tasks = response.json()
        assert isinstance(tasks, list)
        print(f"CRM tasks: {len(tasks)} tasks")
    
    def test_get_followups(self):
        """Test get all CRM followups"""
        response = requests.get(f"{BASE_URL}/api/crm/followups")
        assert response.status_code == 200
        
        followups = response.json()
        assert isinstance(followups, list)
        print(f"CRM followups: {len(followups)} followups")


class TestAdminStaffAccounts:
    """Admin Staff Accounts API Tests"""
    
    def test_get_staff_accounts(self):
        """Test get all staff accounts"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        
        staff = response.json()
        assert isinstance(staff, list)
        assert len(staff) > 0, "No staff accounts found"
        
        # Verify test staff exists
        test_staff = next((s for s in staff if s.get("staff_id") == TEST_STAFF_ID), None)
        assert test_staff is not None, f"Test staff {TEST_STAFF_ID} not found"
        print(f"Staff accounts: {len(staff)} accounts, test staff found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
