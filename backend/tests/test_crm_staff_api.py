"""
Comprehensive API tests for CRM Dashboard and Staff Portal
Tests: Lead management, Staff management, Lead assignment, Staff portal APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCRMDashboardAPIs:
    """CRM Dashboard API tests"""
    
    def test_crm_dashboard_stats(self):
        """Test CRM dashboard statistics endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data
        assert "pipeline_stats" in data
        assert isinstance(data["total_leads"], int)
        print(f"✓ Dashboard stats: {data['total_leads']} total leads")
    
    def test_crm_leads_list(self):
        """Test CRM leads list endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        assert "pagination" in data
        assert isinstance(data["leads"], list)
        print(f"✓ Leads list: {len(data['leads'])} leads returned")
    
    def test_crm_leads_search(self):
        """Test CRM leads search functionality"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?search=Test&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        print(f"✓ Search results: {len(data['leads'])} leads found")
    
    def test_crm_leads_filter_by_stage(self):
        """Test CRM leads filter by stage"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?stage=new&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        # Verify all returned leads have stage 'new'
        for lead in data["leads"]:
            assert lead.get("stage") == "new", f"Lead {lead.get('id')} has stage {lead.get('stage')}, expected 'new'"
        print(f"✓ Stage filter: {len(data['leads'])} new leads")
    
    def test_crm_leads_pagination(self):
        """Test CRM leads pagination"""
        # Get first page
        response1 = requests.get(f"{BASE_URL}/api/crm/leads?limit=5&skip=0")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page
        response2 = requests.get(f"{BASE_URL}/api/crm/leads?limit=5&skip=5")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Verify different leads on different pages
        if len(data1["leads"]) > 0 and len(data2["leads"]) > 0:
            assert data1["leads"][0]["id"] != data2["leads"][0]["id"]
        print("✓ Pagination working correctly")


class TestStaffManagementAPIs:
    """Staff management API tests"""
    
    def test_staff_accounts_list(self):
        """Test staff accounts list endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            staff = data[0]
            assert "id" in staff
            assert "staff_id" in staff
            assert "name" in staff
        print(f"✓ Staff accounts: {len(data)} staff members")
    
    def test_staff_account_has_required_fields(self):
        """Test staff account has all required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            staff = data[0]
            required_fields = ["id", "staff_id", "name", "email", "role", "is_active"]
            for field in required_fields:
                assert field in staff, f"Missing field: {field}"
        print("✓ Staff accounts have all required fields")


class TestLeadAssignmentAPIs:
    """Lead assignment API tests"""
    
    def test_lead_assignment(self):
        """Test lead assignment to staff"""
        # Get a lead
        leads_response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1")
        assert leads_response.status_code == 200
        leads_data = leads_response.json()
        
        if len(leads_data.get("leads", [])) == 0:
            pytest.skip("No leads available for testing")
        
        lead_id = leads_data["leads"][0]["id"]
        
        # Get a staff member
        staff_response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert staff_response.status_code == 200
        staff_data = staff_response.json()
        
        if len(staff_data) == 0:
            pytest.skip("No staff available for testing")
        
        staff_internal_id = staff_data[0]["id"]
        
        # Assign lead to staff
        assign_response = requests.post(
            f"{BASE_URL}/api/crm/leads/{lead_id}/assign",
            json={"employee_id": staff_internal_id, "assigned_by": "admin"}
        )
        assert assign_response.status_code == 200
        assign_data = assign_response.json()
        assert assign_data.get("success") == True
        print(f"✓ Lead {lead_id} assigned to staff {staff_internal_id}")
    
    def test_lead_stage_update(self):
        """Test lead stage update"""
        # Get a lead
        leads_response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1")
        assert leads_response.status_code == 200
        leads_data = leads_response.json()
        
        if len(leads_data.get("leads", [])) == 0:
            pytest.skip("No leads available for testing")
        
        lead_id = leads_data["leads"][0]["id"]
        
        # Update stage
        update_response = requests.put(
            f"{BASE_URL}/api/crm/leads/{lead_id}",
            json={"stage": "contacted"}
        )
        assert update_response.status_code == 200
        print(f"✓ Lead {lead_id} stage updated to 'contacted'")


class TestStaffPortalAPIs:
    """Staff Portal API tests"""
    
    def test_staff_login_initiates_otp(self):
        """Test staff login initiates OTP flow"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"staff_id": "ASR1002", "password": "asr@123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("requires_otp") == True
        print("✓ Staff login initiates OTP flow")
    
    def test_staff_dashboard(self):
        """Test staff dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1002/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "staff" in data
        assert "pipeline_stats" in data
        assert "total_assigned" in data
        print(f"✓ Staff dashboard: {data['total_assigned']} assigned leads")
    
    def test_staff_leads_list(self):
        """Test staff leads list endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1002/leads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Staff leads: {len(data)} leads assigned")
    
    def test_staff_update_lead_status(self):
        """Test staff can update lead status"""
        # First get staff's leads
        leads_response = requests.get(f"{BASE_URL}/api/staff/ASR1002/leads")
        assert leads_response.status_code == 200
        leads = leads_response.json()
        
        if len(leads) == 0:
            pytest.skip("No leads assigned to staff for testing")
        
        lead_id = leads[0]["id"]
        
        # Update lead status
        update_response = requests.put(
            f"{BASE_URL}/api/staff/ASR1002/leads/{lead_id}",
            json={"stage": "contacted"}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data.get("success") == True
        print(f"✓ Staff updated lead {lead_id} status")


class TestWebsiteAPIs:
    """Website API tests"""
    
    def test_gallery_endpoint(self):
        """Test gallery endpoint"""
        response = requests.get(f"{BASE_URL}/api/gallery")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)
        print("✓ Gallery endpoint working")
    
    def test_reviews_endpoint(self):
        """Test reviews endpoint"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Reviews endpoint: {len(data)} reviews")
    
    def test_contact_form_submission(self):
        """Test contact form submission"""
        response = requests.post(
            f"{BASE_URL}/api/leads",
            json={
                "name": "TEST_Contact_Form",
                "phone": "9999999999",
                "email": "test@test.com",
                "source": "website"
            }
        )
        # Should return 200 or 201
        assert response.status_code in [200, 201]
        print("✓ Contact form submission working")


class TestPipelineStages:
    """Test pipeline stages consistency"""
    
    def test_valid_pipeline_stages(self):
        """Test that all leads have valid pipeline stages"""
        valid_stages = ["new", "contacted", "site_visit", "quotation", "negotiation", "converted", "completed", "lost"]
        
        response = requests.get(f"{BASE_URL}/api/crm/leads?limit=100")
        assert response.status_code == 200
        data = response.json()
        
        for lead in data.get("leads", []):
            stage = lead.get("stage")
            assert stage in valid_stages, f"Invalid stage '{stage}' for lead {lead.get('id')}"
        
        print(f"✓ All {len(data.get('leads', []))} leads have valid pipeline stages")
    
    def test_dashboard_pipeline_stats_match_leads(self):
        """Test that dashboard pipeline stats match actual lead counts"""
        # Get dashboard stats
        dashboard_response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        
        # Get all leads
        leads_response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1000")
        assert leads_response.status_code == 200
        leads_data = leads_response.json()
        
        # Count leads by stage
        stage_counts = {}
        for lead in leads_data.get("leads", []):
            stage = lead.get("stage", "unknown")
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
        
        # Compare with dashboard stats
        pipeline_stats = dashboard_data.get("pipeline_stats", {})
        for stage, count in stage_counts.items():
            dashboard_count = pipeline_stats.get(stage, 0)
            assert dashboard_count == count, f"Stage '{stage}': dashboard shows {dashboard_count}, actual is {count}"
        
        print("✓ Dashboard pipeline stats match actual lead counts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
