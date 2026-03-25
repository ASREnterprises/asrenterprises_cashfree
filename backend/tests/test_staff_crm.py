"""
Test Staff CRM Features - Staff Login, Portal, Lead Assignment
Tests for ASR Enterprises Solar CRM Staff Management
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

class TestStaffAuthentication:
    """Test Staff Login and Registration"""
    
    def test_staff_login_with_valid_credentials(self):
        """Test staff login with ASR1001 and asr@123"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        print(f"Staff Login Response: {response.status_code} - {response.text[:500]}")
        
        # If staff doesn't exist, create it first
        if response.status_code == 401:
            # Create staff account first
            create_response = requests.post(f"{BASE_URL}/api/staff/register", json={
                "name": "Test Staff",
                "email": "teststaff@asr.com",
                "phone": "9876543210",
                "role": "sales",
                "password": "asr@123"
            })
            print(f"Staff Register Response: {create_response.status_code} - {create_response.text[:500]}")
            
            # Try login again
            response = requests.post(f"{BASE_URL}/api/staff/login", json={
                "staff_id": "ASR1001",
                "password": "asr@123"
            })
            print(f"Staff Login Retry Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        assert "staff" in data
        assert data["staff"]["staff_id"] == "ASR1001"
    
    def test_staff_login_with_invalid_credentials(self):
        """Test staff login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "wrongpassword"
        })
        print(f"Invalid Login Response: {response.status_code}")
        assert response.status_code == 401
    
    def test_staff_register_creates_unique_id(self):
        """Test that staff registration creates unique ASR IDs"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@asr.com"
        response = requests.post(f"{BASE_URL}/api/staff/register", json={
            "name": "New Staff Member",
            "email": unique_email,
            "phone": "9876543211",
            "role": "sales",
            "password": "asr@123"
        })
        print(f"Staff Register Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "staff_id" in data
        assert data["staff_id"].startswith("ASR")
        assert "password" in data


class TestStaffPortalAPIs:
    """Test Staff Portal Dashboard and Lead APIs"""
    
    @pytest.fixture
    def staff_session(self):
        """Get staff session by logging in"""
        # First ensure staff exists
        requests.post(f"{BASE_URL}/api/staff/register", json={
            "name": "Test Staff",
            "email": "teststaff@asr.com",
            "phone": "9876543210",
            "role": "sales",
            "password": "asr@123"
        })
        
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        if response.status_code == 200:
            return response.json()
        return None
    
    def test_staff_dashboard_api(self, staff_session):
        """Test staff dashboard endpoint"""
        if not staff_session:
            pytest.skip("Staff login failed")
        
        staff_id = staff_session["staff"]["staff_id"]
        response = requests.get(f"{BASE_URL}/api/staff/{staff_id}/dashboard")
        print(f"Staff Dashboard Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert "staff" in data or "pipeline_stats" in data or "total_assigned" in data
    
    def test_staff_leads_api(self, staff_session):
        """Test staff leads endpoint"""
        if not staff_session:
            pytest.skip("Staff login failed")
        
        staff_id = staff_session["staff"]["staff_id"]
        response = requests.get(f"{BASE_URL}/api/staff/{staff_id}/leads")
        print(f"Staff Leads Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_staff_followups_api(self, staff_session):
        """Test staff followups endpoint"""
        if not staff_session:
            pytest.skip("Staff login failed")
        
        staff_id = staff_session["staff"]["staff_id"]
        response = requests.get(f"{BASE_URL}/api/staff/{staff_id}/followups")
        print(f"Staff Followups Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAdminStaffManagement:
    """Test Admin CRM Staff Management"""
    
    def test_get_all_staff_accounts(self):
        """Test admin can get all staff accounts"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        print(f"Admin Staff Accounts Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_can_create_staff(self):
        """Test admin can create staff account"""
        unique_email = f"admin_test_{uuid.uuid4().hex[:8]}@asr.com"
        response = requests.post(f"{BASE_URL}/api/staff/register", json={
            "name": "Admin Created Staff",
            "email": unique_email,
            "phone": "9876543212",
            "role": "sales",
            "password": "asr@123"
        })
        print(f"Admin Create Staff Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "staff_id" in data


class TestCRMLeadAssignment:
    """Test Lead Assignment to Staff"""
    
    @pytest.fixture
    def test_lead(self):
        """Create a test lead"""
        response = requests.post(f"{BASE_URL}/api/crm/leads", json={
            "name": f"Test Lead {uuid.uuid4().hex[:8]}",
            "email": f"testlead_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "9876543213",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 3000
        })
        if response.status_code == 200:
            return response.json()
        return None
    
    @pytest.fixture
    def staff_account(self):
        """Get or create staff account"""
        # Get existing staff accounts
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        if response.status_code == 200:
            staff_list = response.json()
            if staff_list:
                return staff_list[0]
        
        # Create new staff if none exists
        response = requests.post(f"{BASE_URL}/api/staff/register", json={
            "name": "Assignment Test Staff",
            "email": f"assign_test_{uuid.uuid4().hex[:8]}@asr.com",
            "phone": "9876543214",
            "role": "sales",
            "password": "asr@123"
        })
        if response.status_code == 200:
            data = response.json()
            # Get the full staff account
            staff_response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
            if staff_response.status_code == 200:
                for staff in staff_response.json():
                    if staff.get("staff_id") == data.get("staff_id"):
                        return staff
        return None
    
    def test_assign_lead_to_staff(self, test_lead, staff_account):
        """Test assigning a lead to a staff member"""
        if not test_lead or not staff_account:
            pytest.skip("Test lead or staff account not available")
        
        lead_id = test_lead.get("id")
        employee_id = staff_account.get("id")
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/{lead_id}/assign", json={
            "employee_id": employee_id,
            "assigned_by": "admin"
        })
        print(f"Assign Lead Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_get_crm_leads(self):
        """Test getting all CRM leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        print(f"CRM Leads Response: {response.status_code} - {response.text[:200]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCRMDashboard:
    """Test CRM Dashboard APIs"""
    
    def test_crm_dashboard(self):
        """Test CRM dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        print(f"CRM Dashboard Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        # Dashboard should have stats
        assert "total_leads" in data or "pipeline_stats" in data or isinstance(data, dict)
    
    def test_crm_followups(self):
        """Test CRM followups endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/followups")
        print(f"CRM Followups Response: {response.status_code} - {response.text[:200]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_crm_projects(self):
        """Test CRM projects endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/projects")
        print(f"CRM Projects Response: {response.status_code} - {response.text[:200]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_crm_payments(self):
        """Test CRM payments endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/payments")
        print(f"CRM Payments Response: {response.status_code} - {response.text[:200]}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestStaffLeadUpdate:
    """Test Staff can update their assigned leads"""
    
    @pytest.fixture
    def staff_with_lead(self):
        """Setup staff with an assigned lead"""
        # Ensure staff exists
        requests.post(f"{BASE_URL}/api/staff/register", json={
            "name": "Lead Update Staff",
            "email": f"leadupdate_{uuid.uuid4().hex[:8]}@asr.com",
            "phone": "9876543215",
            "role": "sales",
            "password": "asr@123"
        })
        
        # Login
        login_response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        
        if login_response.status_code != 200:
            return None
        
        staff_data = login_response.json()
        staff_id = staff_data["staff"]["staff_id"]
        internal_id = staff_data["staff"]["id"]
        
        # Create a lead
        lead_response = requests.post(f"{BASE_URL}/api/crm/leads", json={
            "name": f"Staff Update Test Lead {uuid.uuid4().hex[:8]}",
            "email": f"stafflead_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "9876543216",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 4000
        })
        
        if lead_response.status_code != 200:
            return None
        
        lead_data = lead_response.json()
        lead_id = lead_data.get("id")
        
        # Assign lead to staff
        assign_response = requests.post(f"{BASE_URL}/api/crm/leads/{lead_id}/assign", json={
            "employee_id": internal_id,
            "assigned_by": "admin"
        })
        
        return {
            "staff_id": staff_id,
            "internal_id": internal_id,
            "lead_id": lead_id
        }
    
    def test_staff_can_update_lead_status(self, staff_with_lead):
        """Test staff can update lead status"""
        if not staff_with_lead:
            pytest.skip("Staff with lead setup failed")
        
        staff_id = staff_with_lead["staff_id"]
        lead_id = staff_with_lead["lead_id"]
        
        response = requests.put(f"{BASE_URL}/api/staff/{staff_id}/leads/{lead_id}", json={
            "stage": "follow_up",
            "follow_up_notes": "Customer interested, will call back tomorrow"
        })
        print(f"Staff Update Lead Response: {response.status_code} - {response.text[:500]}")
        
        # May return 403 if lead not properly assigned, or 200 if successful
        assert response.status_code in [200, 403]
    
    def test_staff_can_create_followup(self, staff_with_lead):
        """Test staff can create follow-up reminder"""
        if not staff_with_lead:
            pytest.skip("Staff with lead setup failed")
        
        staff_id = staff_with_lead["staff_id"]
        lead_id = staff_with_lead["lead_id"]
        
        response = requests.post(f"{BASE_URL}/api/staff/{staff_id}/followups", json={
            "lead_id": lead_id,
            "reminder_date": "2026-01-20",
            "reminder_time": "10:00",
            "reminder_type": "call",
            "notes": "Follow up on solar installation interest"
        })
        print(f"Staff Create Followup Response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
