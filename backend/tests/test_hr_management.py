"""
HR Management Module Tests
Tests for: HR Dashboard, Employees CRUD, Onboarding, Leave Management, Performance, Reports
Auto-sync with CRM Staff accounts
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test employee data prefix
TEST_PREFIX = "TEST_"


class TestHRDashboard:
    """HR Dashboard endpoint tests"""
    
    def test_hr_dashboard_returns_stats(self):
        """Test GET /api/hr/dashboard returns employee statistics"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        # Check all expected fields exist
        assert "total_employees" in data
        assert "active_employees" in data
        assert "on_probation" in data
        assert "departments" in data
        assert "recent_joinings" in data
        assert "pending_onboarding" in data
        assert "total_monthly_salary" in data
        assert "pending_leave_requests" in data
        print(f"HR Dashboard: {data['total_employees']} employees, {data['active_employees']} active")


class TestHREmployeesCRUD:
    """HR Employees CRUD operations"""
    
    def test_get_employees_list(self):
        """Test GET /api/hr/employees returns employee list"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        assert response.status_code == 200
        
        data = response.json()
        assert "employees" in data
        assert "total" in data
        assert isinstance(data["employees"], list)
        print(f"Found {data['total']} HR employees")
    
    def test_get_employees_filter_by_department(self):
        """Test GET /api/hr/employees with department filter"""
        response = requests.get(f"{BASE_URL}/api/hr/employees?department=sales")
        assert response.status_code == 200
        
        data = response.json()
        for emp in data["employees"]:
            assert emp.get("department") == "sales"
        print(f"Found {data['total']} sales department employees")
    
    def test_create_employee_auto_id_generation(self):
        """Test POST /api/hr/employees creates employee with auto ID generation"""
        unique_id = str(uuid.uuid4())[:6]
        employee_data = {
            "name": f"{TEST_PREFIX}John Doe {unique_id}",
            "email": f"test_{unique_id}@example.com",
            "phone": "9876543210",
            "department": "sales",
            "role": "sales",
            "designation": "Sales Executive",
            "employment_type": "full_time",
            "joining_date": datetime.now().strftime("%Y-%m-%d"),
            "base_salary": 25000,
            "allowances": 5000
        }
        
        response = requests.post(f"{BASE_URL}/api/hr/employees", json=employee_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "employee" in data
        
        employee = data["employee"]
        assert employee["employee_id"].startswith("ASR")
        assert employee["name"] == employee_data["name"]
        assert employee["department"] == "sales"
        assert employee["status"] == "probation"  # Default status
        assert "onboarding_checklist" in employee
        assert employee["onboarding_completed"] == False
        
        print(f"Created employee: {employee['employee_id']} - {employee['name']}")
        return employee["employee_id"]
    
    def test_create_employee_syncs_with_crm(self):
        """Test POST /api/hr/employees creates corresponding CRM staff account"""
        unique_id = str(uuid.uuid4())[:6]
        employee_data = {
            "name": f"{TEST_PREFIX}CRM Sync {unique_id}",
            "email": f"crmsync_{unique_id}@example.com",
            "phone": "9876543211",
            "department": "technical",
            "role": "technician",
            "designation": "Technician"
        }
        
        response = requests.post(f"{BASE_URL}/api/hr/employees", json=employee_data)
        assert response.status_code == 200
        
        employee_id = response.json()["employee"]["employee_id"]
        
        # Verify CRM staff account was created via admin endpoint
        crm_response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert crm_response.status_code == 200
        
        staff_list = crm_response.json()
        staff_ids = [s.get("staff_id") for s in staff_list]
        
        assert employee_id in staff_ids, f"Employee {employee_id} should be in CRM staff accounts"
        print(f"Employee {employee_id} synced with CRM staff accounts")
    
    def test_get_single_employee(self):
        """Test GET /api/hr/employees/{employee_id} returns employee details"""
        # First create an employee
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Single Get {unique_id}",
            "phone": "9876543212",
            "department": "admin"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        # Now get the employee
        response = requests.get(f"{BASE_URL}/api/hr/employees/{employee_id}")
        assert response.status_code == 200
        
        employee = response.json()
        assert employee["employee_id"] == employee_id
        assert f"{TEST_PREFIX}Single Get" in employee["name"]
        print(f"Retrieved employee: {employee_id}")
    
    def test_get_nonexistent_employee_returns_404(self):
        """Test GET /api/hr/employees/{employee_id} returns 404 for invalid ID"""
        response = requests.get(f"{BASE_URL}/api/hr/employees/INVALID999")
        assert response.status_code == 404


class TestHROnboarding:
    """HR Onboarding checklist tests"""
    
    def test_update_onboarding_checklist(self):
        """Test PUT /api/hr/employees/{id}/onboarding updates checklist"""
        # Create employee first
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Onboard Test {unique_id}",
            "phone": "9876543213",
            "department": "marketing"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        # Update onboarding checklist
        update_data = {"documents_submitted": True, "id_card_created": True}
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}/onboarding",
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["onboarding_completed"] == False  # Not all items completed
        
        print(f"Updated onboarding for {employee_id}")
    
    def test_complete_all_onboarding_marks_complete(self):
        """Test completing all onboarding items marks onboarding_completed=True"""
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Full Onboard {unique_id}",
            "phone": "9876543214",
            "department": "support"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        # Complete all checklist items
        complete_data = {
            "documents_submitted": True,
            "id_card_created": True,
            "bank_details_added": True,
            "system_access_given": True,
            "training_completed": True,
            "reporting_manager_assigned": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}/onboarding",
            json=complete_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["onboarding_completed"] == True
        print(f"Employee {employee_id} onboarding completed")


class TestHRLeaveManagement:
    """HR Leave Management tests"""
    
    def test_get_leaves_list(self):
        """Test GET /api/hr/leaves returns leave requests"""
        response = requests.get(f"{BASE_URL}/api/hr/leaves")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaves" in data
        print(f"Found {len(data['leaves'])} leave requests")
    
    def test_create_leave_request(self):
        """Test POST /api/hr/leaves creates leave request"""
        # Create employee first
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Leave Test {unique_id}",
            "phone": "9876543215",
            "department": "sales"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        # Create leave request
        leave_data = {
            "employee_id": employee_id,
            "leave_type": "casual",
            "from_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "to_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "reason": f"{TEST_PREFIX}Family function"
        }
        
        response = requests.post(f"{BASE_URL}/api/hr/leaves", json=leave_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "leave" in data
        assert data["leave"]["status"] == "pending"
        assert data["leave"]["total_days"] == 3
        
        print(f"Created leave request for {employee_id}: {data['leave']['total_days']} days")
        return data["leave"]["id"]
    
    def test_approve_leave_request(self):
        """Test PUT /api/hr/leaves/{id} approves leave"""
        # Create employee and leave
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Approve Leave {unique_id}",
            "phone": "9876543216",
            "department": "technical"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        leave_response = requests.post(f"{BASE_URL}/api/hr/leaves", json={
            "employee_id": employee_id,
            "leave_type": "sick",
            "from_date": datetime.now().strftime("%Y-%m-%d"),
            "to_date": datetime.now().strftime("%Y-%m-%d"),
            "reason": f"{TEST_PREFIX}Medical appointment"
        })
        leave_id = leave_response.json()["leave"]["id"]
        
        # Approve the leave
        response = requests.put(
            f"{BASE_URL}/api/hr/leaves/{leave_id}",
            json={"status": "approved", "approved_by": "Admin"}
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"Approved leave request {leave_id}")
    
    def test_reject_leave_request(self):
        """Test PUT /api/hr/leaves/{id} rejects leave"""
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Reject Leave {unique_id}",
            "phone": "9876543217",
            "department": "admin"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        leave_response = requests.post(f"{BASE_URL}/api/hr/leaves", json={
            "employee_id": employee_id,
            "leave_type": "earned",
            "from_date": datetime.now().strftime("%Y-%m-%d"),
            "to_date": (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d"),
            "reason": f"{TEST_PREFIX}Extended vacation"
        })
        leave_id = leave_response.json()["leave"]["id"]
        
        # Reject the leave
        response = requests.put(
            f"{BASE_URL}/api/hr/leaves/{leave_id}",
            json={"status": "rejected", "approved_by": "Manager"}
        )
        
        assert response.status_code == 200
        print(f"Rejected leave request {leave_id}")


class TestHRPerformance:
    """HR Performance tracking tests"""
    
    def test_get_performance_data(self):
        """Test GET /api/hr/performance returns performance data"""
        response = requests.get(f"{BASE_URL}/api/hr/performance")
        assert response.status_code == 200
        
        data = response.json()
        assert "performance" in data
        
        # Check performance data structure
        for perf in data["performance"]:
            assert "employee_id" in perf
            assert "name" in perf
            assert "leads_assigned" in perf
            assert "leads_converted" in perf
            assert "conversion_rate" in perf
        
        print(f"Found performance data for {len(data['performance'])} employees")
    
    def test_update_employee_performance(self):
        """Test PUT /api/hr/employees/{id}/performance updates rating"""
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Perf Update {unique_id}",
            "phone": "9876543218",
            "department": "sales"
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        # Update performance
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}/performance",
            json={"performance_rating": 4.5, "notes": f"{TEST_PREFIX}Good performance"}
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"Updated performance for {employee_id}")


class TestHRReports:
    """HR Reports tests"""
    
    def test_get_hr_summary_report(self):
        """Test GET /api/hr/reports/summary returns summary report"""
        response = requests.get(f"{BASE_URL}/api/hr/reports/summary")
        assert response.status_code == 200
        
        data = response.json()
        # Check report fields (actual field names from API)
        assert "status_breakdown" in data
        assert "department_breakdown" in data
        assert "total_monthly_salary" in data
        assert "average_salary" in data
        assert "tenure_analysis" in data
        
        print(f"HR Summary: Total salary={data.get('total_monthly_salary')}, Avg={data.get('average_salary')}")


class TestHREmployeeUpdate:
    """HR Employee update tests"""
    
    def test_update_employee_details(self):
        """Test PUT /api/hr/employees/{id} updates employee"""
        unique_id = str(uuid.uuid4())[:6]
        create_response = requests.post(f"{BASE_URL}/api/hr/employees", json={
            "name": f"{TEST_PREFIX}Update Test {unique_id}",
            "phone": "9876543219",
            "department": "sales",
            "base_salary": 20000
        })
        employee_id = create_response.json()["employee"]["employee_id"]
        
        # Update employee
        update_data = {
            "base_salary": 30000,
            "designation": "Senior Sales Executive",
            "status": "active"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}",
            json=update_data
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/hr/employees/{employee_id}")
        updated = get_response.json()
        assert updated["base_salary"] == 30000
        assert updated["status"] == "active"
        
        print(f"Updated employee {employee_id} salary to 30000, status to active")


class TestHRCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_employees(self):
        """Remove TEST_ prefixed employees"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        
        if response.status_code == 200:
            employees = response.json().get("employees", [])
            cleaned = 0
            
            for emp in employees:
                if emp.get("name", "").startswith(TEST_PREFIX):
                    employee_id = emp.get("employee_id")
                    # Soft delete (mark as terminated)
                    requests.delete(f"{BASE_URL}/api/hr/employees/{employee_id}")
                    cleaned += 1
            
            print(f"Cleaned up {cleaned} test employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
