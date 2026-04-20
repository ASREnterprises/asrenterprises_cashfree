"""
Test Suite for ASR Solar CRM Admin Features - Iteration 8

Tests:
1. Mark as Paid endpoint for registrations
2. Edit and Delete leads with CRM sync
3. Agent Registration
4. Public Govt News
5. Solar Calculator
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

class TestMarkAsPaid:
    """Test Mark as Paid functionality for Razorpay payments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test registration for payment testing"""
        self.test_registration = None
        
    def test_save_registration_details(self):
        """Test saving registration details before payment"""
        response = requests.post(f"{BASE_URL}/api/registration/save-details", json={
            "customer": {
                "name": "TEST_Payment_User",
                "phone": "9876543210",
                "email": "testpayment@test.com",
                "district": "Patna",
                "address": "Test Address",
                "property_type": "residential",
                "monthly_bill": "3000"
            }
        })
        print(f"Registration save response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "registration_id" in data
        self.registration_id = data["registration_id"]
        print(f"Created registration: {self.registration_id}")
        return self.registration_id
        
    def test_get_registrations(self):
        """Test getting all registrations"""
        response = requests.get(f"{BASE_URL}/api/admin/registrations")
        print(f"Get registrations response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "registrations" in data
        print(f"Total registrations: {data.get('total', 0)}")
        
    def test_mark_registration_paid(self):
        """Test marking a registration as paid"""
        # First create a registration
        reg_response = requests.post(f"{BASE_URL}/api/registration/save-details", json={
            "customer": {
                "name": "TEST_MarkPaid_User",
                "phone": "9876543211",
                "email": "testmarkpaid@test.com",
                "district": "Gaya"
            }
        })
        assert reg_response.status_code == 200
        reg_id = reg_response.json().get("registration_id")
        
        # Now mark as paid
        response = requests.post(f"{BASE_URL}/api/admin/registrations/{reg_id}/mark-paid", json={
            "payment_id": "pay_test_123456",
            "amount": 1500
        })
        print(f"Mark paid response: {response.status_code}")
        print(f"Mark paid response body: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Successfully marked registration {reg_id} as paid")
        
    def test_get_registration_fee(self):
        """Test getting current registration fee"""
        response = requests.get(f"{BASE_URL}/api/registration/fee")
        print(f"Registration fee response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "fee" in data
        print(f"Current registration fee: ₹{data['fee']}")


class TestLeadsManagement:
    """Test Edit and Delete leads with CRM sync"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test lead"""
        self.test_lead_id = None
        
    def test_create_lead_for_edit_delete(self):
        """Create a test lead first"""
        response = requests.post(f"{BASE_URL}/api/leads", json={
            "name": "TEST_EditDelete_Lead",
            "email": "testeditdelete@test.com",
            "phone": "9876543212",
            "district": "Patna",
            "property_type": "residential",
            "roof_type": "rcc",
            "monthly_bill": 3500
        })
        print(f"Create lead response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        self.lead_id = data["id"]
        print(f"Created test lead: {self.lead_id}")
        return self.lead_id
        
    def test_edit_lead_via_admin(self):
        """Test editing a lead via admin endpoint"""
        # First create a lead
        create_resp = requests.post(f"{BASE_URL}/api/leads", json={
            "name": "TEST_AdminEdit_Lead",
            "email": "testadminedit@test.com",
            "phone": "9876543213",
            "district": "Muzaffarpur",
            "property_type": "commercial",
            "monthly_bill": 5000
        })
        assert create_resp.status_code == 200
        lead_id = create_resp.json()["id"]
        
        # Edit the lead
        edit_response = requests.put(f"{BASE_URL}/api/admin/leads/{lead_id}", json={
            "name": "TEST_AdminEdit_Lead_UPDATED",
            "status": "contacted",
            "notes": "Updated via admin endpoint"
        })
        print(f"Edit lead response: {edit_response.status_code}")
        print(f"Edit lead response body: {edit_response.text}")
        assert edit_response.status_code == 200
        data = edit_response.json()
        assert data.get("success") == True
        
        # Verify in main leads
        leads_resp = requests.get(f"{BASE_URL}/api/leads")
        leads = leads_resp.json()
        found = False
        for lead in leads:
            if lead["id"] == lead_id:
                assert lead["name"] == "TEST_AdminEdit_Lead_UPDATED"
                found = True
                break
        assert found, "Updated lead should be found in leads collection"
        print(f"Lead {lead_id} successfully edited and verified")
        
    def test_delete_lead_via_admin(self):
        """Test deleting a lead via admin endpoint"""
        # First create a lead
        create_resp = requests.post(f"{BASE_URL}/api/leads", json={
            "name": "TEST_AdminDelete_Lead",
            "email": "testadmindelete@test.com",
            "phone": "9876543214",
            "district": "Bhagalpur",
            "monthly_bill": 4000
        })
        assert create_resp.status_code == 200
        lead_id = create_resp.json()["id"]
        
        # Delete the lead
        delete_response = requests.delete(f"{BASE_URL}/api/admin/leads/{lead_id}")
        print(f"Delete lead response: {delete_response.status_code}")
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data.get("success") == True
        
        # Verify deleted
        leads_resp = requests.get(f"{BASE_URL}/api/leads")
        leads = leads_resp.json()
        for lead in leads:
            assert lead["id"] != lead_id, "Deleted lead should not exist"
        print(f"Lead {lead_id} successfully deleted")


class TestAgentRegistration:
    """Test Agent Registration form submission"""
    
    def test_register_new_agent(self):
        """Test registering a new agent"""
        response = requests.post(f"{BASE_URL}/api/agents/register", json={
            "name": "TEST_Agent_User",
            "phone": "9876543215",
            "email": "testagent@test.com",
            "district": "Patna",
            "address": "Test Agent Address",
            "aadhar_number": "123456789012",
            "pan_number": "ABCDE1234F",
            "bank_name": "Test Bank",
            "bank_account": "1234567890",
            "ifsc_code": "TEST0001234",
            "experience": "2 years in solar sales",
            "notes": "Test agent registration"
        })
        print(f"Agent registration response: {response.status_code}")
        print(f"Agent registration response body: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "agent_id" in data
        print(f"Agent registered successfully: {data['agent_id']}")
        
    def test_get_all_agents(self):
        """Test getting all registered agents"""
        response = requests.get(f"{BASE_URL}/api/admin/agents")
        print(f"Get agents response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        print(f"Total agents: {len(data['agents'])}")


class TestPublicGovtNews:
    """Test Public Government News/Schemes endpoint"""
    
    def test_get_public_govt_news(self):
        """Test getting public govt news"""
        response = requests.get(f"{BASE_URL}/api/public/govt-news")
        print(f"Public govt news response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Govt news items: {len(data)}")
        
    def test_get_admin_govt_news(self):
        """Test getting admin govt news"""
        response = requests.get(f"{BASE_URL}/api/govt-news")
        print(f"Admin govt news response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin govt news items: {len(data)}")


class TestSolarCalculator:
    """Test Solar Calculator functionality"""
    
    def test_solar_calculation(self):
        """Test solar calculator with valid inputs"""
        response = requests.post(f"{BASE_URL}/api/solar/calculate", json={
            "monthly_bill": 3500,
            "roof_area": 400,
            "location": "Patna",
            "electricity_rate": 7.5,
            "has_three_phase": False
        })
        print(f"Solar calculation response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify calculation results
        assert "recommended_capacity_kw" in data
        assert "estimated_cost" in data
        assert "monthly_savings" in data
        assert "annual_savings" in data
        assert "payback_period_years" in data
        assert "panels_required" in data
        assert "subsidy_info" in data
        
        print(f"Recommended capacity: {data['recommended_capacity_kw']} kW")
        print(f"Estimated cost: ₹{data['estimated_cost']}")
        print(f"Monthly savings: ₹{data['monthly_savings']}")
        print(f"Subsidy info: {data['subsidy_info']}")
        
    def test_solar_calculation_high_bill(self):
        """Test solar calculator with higher monthly bill"""
        response = requests.post(f"{BASE_URL}/api/solar/calculate", json={
            "monthly_bill": 8000,
            "roof_area": 1000,
            "location": "Gaya",
            "electricity_rate": 8.0,
            "has_three_phase": True
        })
        print(f"High bill solar calculation response: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data["recommended_capacity_kw"] > 0
        print(f"High bill system: {data['recommended_capacity_kw']} kW")


class TestExistingEndpoints:
    """Test existing endpoints are still working"""
    
    def test_districts_endpoint(self):
        """Test districts endpoint"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200
        data = response.json()
        assert "districts" in data
        assert "Patna" in data["districts"]
        print(f"Districts endpoint working: {len(data['districts'])} districts")
        
    def test_leads_list(self):
        """Test leads list endpoint"""
        response = requests.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Leads endpoint working: {len(data)} leads")
        
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data
        print(f"Dashboard stats working: {data['total_leads']} total leads")
        
    def test_crm_dashboard(self):
        """Test CRM dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data
        print(f"CRM dashboard working: {data['total_leads']} total leads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
