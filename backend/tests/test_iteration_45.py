"""
Iteration 45 Backend Tests
Testing new features:
1. Staff Email+Password login endpoint (/api/staff/login-email)
2. Training endpoints (/api/staff/{staff_id}/training, /api/staff/{staff_id}/training/{module_id}/complete)
3. Bulk lead assignment (/api/crm/leads/bulk-assign)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStaffEmailLogin:
    """Tests for Staff Email+Password login (No OTP required)"""
    
    def test_staff_login_email_endpoint_exists(self):
        """Test that /api/staff/login-email endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email",
            json={"email": "", "password": ""}
        )
        # Should get 401 for invalid credentials, not 404
        assert response.status_code in [401, 400, 429], f"Expected 401/400/429, got {response.status_code}"
        print(f"PASS: Staff login-email endpoint exists (status: {response.status_code})")
    
    def test_staff_login_email_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email",
            json={"email": "nonexistent@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Invalid credentials return 401")
    
    def test_staff_login_email_missing_fields(self):
        """Test login with missing fields"""
        # Test without email
        response = requests.post(
            f"{BASE_URL}/api/staff/login-email",
            json={"password": "test123"}
        )
        assert response.status_code in [400, 401, 422], f"Expected error for missing email"
        print("PASS: Missing email handled correctly")


class TestTrainingEndpoints:
    """Tests for Staff Training module endpoints"""
    
    def test_training_modules_endpoint_exists(self):
        """Test /api/staff/{staff_id}/training returns training modules"""
        # Use a test staff_id
        response = requests.get(f"{BASE_URL}/api/staff/ASR1001/training")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "modules" in data, "Response should contain 'modules' key"
        assert "progress" in data, "Response should contain 'progress' key"
        
        modules = data["modules"]
        assert isinstance(modules, list), "Modules should be a list"
        assert len(modules) > 0, "Should have at least one training module"
        
        # Verify module structure
        first_module = modules[0]
        assert "id" in first_module, "Module should have 'id'"
        assert "title" in first_module, "Module should have 'title'"
        assert "description" in first_module, "Module should have 'description'"
        
        print(f"PASS: Training endpoint returns {len(modules)} modules")
    
    def test_training_module_complete_endpoint(self):
        """Test marking training module as complete"""
        staff_id = "ASR_TEST_45"
        module_id = "solar_basics"
        
        response = requests.post(
            f"{BASE_URL}/api/staff/{staff_id}/training/{module_id}/complete"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        
        # Verify progress was saved
        progress_response = requests.get(f"{BASE_URL}/api/staff/{staff_id}/training")
        assert progress_response.status_code == 200
        
        progress_data = progress_response.json()
        assert module_id in progress_data.get("progress", {}), "Module should be marked in progress"
        assert progress_data["progress"][module_id] == True, "Module should be marked as complete"
        
        print(f"PASS: Training module {module_id} marked complete for {staff_id}")
    
    def test_training_modules_contain_expected_content(self):
        """Test that training modules have expected content for onboarding"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1001/training")
        assert response.status_code == 200
        
        data = response.json()
        modules = data.get("modules", [])
        
        # Check for expected module IDs
        module_ids = [m.get("id") for m in modules]
        
        # Verify mandatory modules exist
        assert "solar_basics" in module_ids, "Should have solar_basics module"
        assert "product_knowledge" in module_ids, "Should have product_knowledge module"
        assert "crm_training" in module_ids, "Should have crm_training module"
        
        print("PASS: Training modules contain expected onboarding content")


class TestBulkLeadAssignment:
    """Tests for Bulk Lead Assignment endpoint"""
    
    def test_bulk_assign_endpoint_exists(self):
        """Test /api/crm/leads/bulk-assign endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-assign",
            json={}
        )
        # Should get 400 for missing data, not 404
        assert response.status_code in [400, 422], f"Expected 400/422 for empty body, got {response.status_code}"
        print(f"PASS: Bulk assign endpoint exists (status: {response.status_code})")
    
    def test_bulk_assign_requires_lead_ids(self):
        """Test that bulk assign requires lead_ids"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-assign",
            json={"employee_id": "test123"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "No leads selected" in str(data), "Should indicate no leads selected"
        print("PASS: Bulk assign validates lead_ids")
    
    def test_bulk_assign_requires_employee_id(self):
        """Test that bulk assign requires employee_id"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-assign",
            json={"lead_ids": ["lead1", "lead2"]}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "Staff not selected" in str(data), "Should indicate staff not selected"
        print("PASS: Bulk assign validates employee_id")
    
    def test_bulk_assign_invalid_staff(self):
        """Test bulk assign with non-existent staff"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-assign",
            json={
                "lead_ids": ["test_lead_1", "test_lead_2"],
                "employee_id": "nonexistent_staff_id"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Bulk assign returns 404 for invalid staff")


class TestStaffLoginFormUI:
    """Tests for Staff Login UI - verifying 3 tabs exist"""
    
    def test_staff_accounts_list(self):
        """Get staff accounts to verify we have staff for testing"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        staff_list = response.json()
        assert isinstance(staff_list, list), "Should return a list"
        
        print(f"PASS: Found {len(staff_list)} staff accounts")
        
        # Check if any staff has email for email login test
        staff_with_email = [s for s in staff_list if s.get("email")]
        print(f"  Staff with email: {len(staff_with_email)}")


class TestCRMLeadsWithBulkSelect:
    """Test CRM leads list for bulk selection functionality"""
    
    def test_crm_leads_list(self):
        """Test CRM leads list endpoint"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        leads = response.json()
        assert isinstance(leads, list), "Should return a list"
        
        print(f"PASS: CRM leads list returns {len(leads)} leads")
        
        # Return lead IDs for bulk assign test
        return [l.get("id") for l in leads[:3]] if leads else []


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
