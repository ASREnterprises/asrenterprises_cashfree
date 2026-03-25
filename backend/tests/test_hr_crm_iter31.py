"""
Backend Tests for Iteration 31 - HR Routes Modularization & CRM Lead Counter Fix

Tests the following features:
1. CRM Dashboard Lead Counter - Verify Total Leads shows 43 (not 29)
2. HR Dashboard API - /api/hr/dashboard should return employee statistics
3. HR Employees API - /api/hr/employees should list all employees
4. HR Leaves API - /api/hr/leaves should return leave requests
5. HR Performance API - /api/hr/performance should return performance data
6. CRM Widget Stats - /api/crm/widget/stats should show correct lead counts
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestCRMLeadCounter:
    """Test CRM lead counter fix - should show 43 total leads"""
    
    def test_crm_widget_stats_returns_correct_total_leads(self):
        """CRM Widget Stats should return total_leads = 43 (combined from both collections)"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "total_leads" in data, "Response should contain 'total_leads' field"
        
        # Verify total_leads is 43 as specified in the fix
        assert data["total_leads"] == 43, f"Expected total_leads=43, got {data['total_leads']}"
        
        # Additional structure validations
        assert "new_leads" in data, "Response should contain 'new_leads' field"
        assert "qualified_leads" in data, "Response should contain 'qualified_leads' field"
        assert "converted_leads" in data, "Response should contain 'converted_leads' field"
        assert "active_staff" in data, "Response should contain 'active_staff' field"
        assert "pending_tasks" in data, "Response should contain 'pending_tasks' field"
        
        print(f"✓ CRM Widget Stats: total_leads={data['total_leads']}, new_leads={data['new_leads']}, active_staff={data['active_staff']}")
    
    def test_crm_widget_stats_returns_proper_types(self):
        """CRM Widget Stats should return proper integer types for all fields"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Type assertions
        assert isinstance(data["total_leads"], int), "total_leads should be integer"
        assert isinstance(data["new_leads"], int), "new_leads should be integer"
        assert isinstance(data["qualified_leads"], int), "qualified_leads should be integer"
        assert isinstance(data["converted_leads"], int), "converted_leads should be integer"
        assert isinstance(data["active_staff"], int), "active_staff should be integer"
        assert isinstance(data["pending_tasks"], int), "pending_tasks should be integer"
        
        print("✓ All CRM Widget Stats fields have proper integer types")


class TestHRDashboard:
    """Test HR Dashboard API - /api/hr/dashboard"""
    
    def test_hr_dashboard_returns_statistics(self):
        """HR Dashboard should return employee statistics"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        required_fields = [
            "total_employees", "active_employees", "on_probation", "on_notice",
            "departments", "recent_joinings", "pending_onboarding", 
            "total_monthly_salary", "pending_leave_requests"
        ]
        
        for field in required_fields:
            assert field in data, f"Response should contain '{field}' field"
        
        # Type validations
        assert isinstance(data["total_employees"], int), "total_employees should be integer"
        assert isinstance(data["active_employees"], int), "active_employees should be integer"
        assert isinstance(data["on_probation"], int), "on_probation should be integer"
        assert isinstance(data["on_notice"], int), "on_notice should be integer"
        assert isinstance(data["departments"], dict), "departments should be dictionary"
        assert isinstance(data["recent_joinings"], int), "recent_joinings should be integer"
        assert isinstance(data["pending_onboarding"], int), "pending_onboarding should be integer"
        assert isinstance(data["total_monthly_salary"], (int, float)), "total_monthly_salary should be numeric"
        assert isinstance(data["pending_leave_requests"], int), "pending_leave_requests should be integer"
        
        print(f"✓ HR Dashboard: total_employees={data['total_employees']}, active={data['active_employees']}, departments={data['departments']}")
    
    def test_hr_dashboard_has_department_breakdown(self):
        """HR Dashboard should include department breakdown"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        departments = data.get("departments", {})
        
        # Verify departments is a non-empty dict with valid counts
        assert len(departments) > 0, "Departments should not be empty"
        for dept_name, count in departments.items():
            assert isinstance(count, int), f"Department {dept_name} count should be integer"
            assert count >= 0, f"Department {dept_name} count should be non-negative"
        
        print(f"✓ HR Dashboard departments: {departments}")


class TestHREmployees:
    """Test HR Employees API - /api/hr/employees"""
    
    def test_hr_employees_list(self):
        """HR Employees endpoint should return list of employees"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        assert "employees" in data, "Response should contain 'employees' field"
        assert "total" in data, "Response should contain 'total' field"
        assert isinstance(data["employees"], list), "employees should be a list"
        assert isinstance(data["total"], int), "total should be integer"
        
        print(f"✓ HR Employees: total={data['total']}, returned={len(data['employees'])}")
    
    def test_hr_employees_have_required_fields(self):
        """Each employee should have required fields"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        assert response.status_code == 200
        
        data = response.json()
        employees = data.get("employees", [])
        
        if len(employees) > 0:
            employee = employees[0]
            required_fields = [
                "id", "employee_id", "name", "phone", "department", 
                "role", "status", "is_active", "joining_date"
            ]
            
            for field in required_fields:
                assert field in employee, f"Employee should have '{field}' field"
            
            print(f"✓ Employee fields validated: employee_id={employee.get('employee_id')}, name={employee.get('name')}")
        else:
            print("⚠ No employees in database to validate fields")
    
    def test_hr_employees_filter_by_department(self):
        """HR Employees should support department filter"""
        response = requests.get(f"{BASE_URL}/api/hr/employees?department=sales")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        employees = data.get("employees", [])
        
        # All returned employees should be in sales department
        for emp in employees:
            assert emp.get("department") == "sales", f"Employee {emp.get('employee_id')} should be in sales department"
        
        print(f"✓ HR Employees filter by department=sales: {len(employees)} employees")
    
    def test_hr_employees_filter_by_status(self):
        """HR Employees should support status filter"""
        response = requests.get(f"{BASE_URL}/api/hr/employees?status=active")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        employees = data.get("employees", [])
        
        # All returned employees should have active status
        for emp in employees:
            assert emp.get("status") == "active", f"Employee {emp.get('employee_id')} should have active status"
        
        print(f"✓ HR Employees filter by status=active: {len(employees)} employees")


class TestHRLeaves:
    """Test HR Leaves API - /api/hr/leaves"""
    
    def test_hr_leaves_list(self):
        """HR Leaves endpoint should return list of leave requests"""
        response = requests.get(f"{BASE_URL}/api/hr/leaves")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        assert "leaves" in data, "Response should contain 'leaves' field"
        assert isinstance(data["leaves"], list), "leaves should be a list"
        
        print(f"✓ HR Leaves: total={len(data['leaves'])} leave requests")
    
    def test_hr_leaves_have_required_fields(self):
        """Each leave request should have required fields"""
        response = requests.get(f"{BASE_URL}/api/hr/leaves")
        assert response.status_code == 200
        
        data = response.json()
        leaves = data.get("leaves", [])
        
        if len(leaves) > 0:
            leave = leaves[0]
            required_fields = [
                "id", "employee_id", "employee_name", "leave_type",
                "from_date", "to_date", "total_days", "status"
            ]
            
            for field in required_fields:
                assert field in leave, f"Leave request should have '{field}' field"
            
            # Validate leave_type is valid
            valid_leave_types = ["casual", "sick", "earned", "unpaid"]
            assert leave["leave_type"] in valid_leave_types, f"Invalid leave_type: {leave['leave_type']}"
            
            # Validate status is valid
            valid_statuses = ["pending", "approved", "rejected"]
            assert leave["status"] in valid_statuses, f"Invalid status: {leave['status']}"
            
            print(f"✓ Leave request fields validated: employee={leave.get('employee_name')}, type={leave.get('leave_type')}, status={leave.get('status')}")
        else:
            print("⚠ No leave requests in database to validate fields")
    
    def test_hr_leaves_filter_by_status(self):
        """HR Leaves should support status filter"""
        response = requests.get(f"{BASE_URL}/api/hr/leaves?status=pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        leaves = data.get("leaves", [])
        
        # All returned leaves should have pending status
        for leave in leaves:
            assert leave.get("status") == "pending", f"Leave {leave.get('id')} should have pending status"
        
        print(f"✓ HR Leaves filter by status=pending: {len(leaves)} leave requests")


class TestHRPerformance:
    """Test HR Performance API - /api/hr/performance"""
    
    def test_hr_performance_returns_data(self):
        """HR Performance endpoint should return performance data"""
        response = requests.get(f"{BASE_URL}/api/hr/performance")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        assert "performance" in data, "Response should contain 'performance' field"
        assert isinstance(data["performance"], list), "performance should be a list"
        
        print(f"✓ HR Performance: {len(data['performance'])} employee records")
    
    def test_hr_performance_data_structure(self):
        """Performance data should have required fields when available"""
        response = requests.get(f"{BASE_URL}/api/hr/performance")
        assert response.status_code == 200
        
        data = response.json()
        performance = data.get("performance", [])
        
        if len(performance) > 0:
            perf = performance[0]
            required_fields = [
                "employee_id", "name", "department", "leads_assigned",
                "leads_converted", "conversion_rate", "total_revenue"
            ]
            
            for field in required_fields:
                assert field in perf, f"Performance data should have '{field}' field"
            
            # Validate numeric types
            assert isinstance(perf["leads_assigned"], int), "leads_assigned should be integer"
            assert isinstance(perf["leads_converted"], int), "leads_converted should be integer"
            assert isinstance(perf["conversion_rate"], (int, float)), "conversion_rate should be numeric"
            assert isinstance(perf["total_revenue"], (int, float)), "total_revenue should be numeric"
            
            print(f"✓ Performance data validated: {perf.get('name')}, conversion_rate={perf.get('conversion_rate')}%")
        else:
            # This is expected when no active employees
            print("✓ HR Performance returns empty list (no active employees)")


class TestHRModularRoutes:
    """Test that HR routes are properly modularized from routes/hr.py"""
    
    def test_hr_dashboard_endpoint_accessible(self):
        """HR Dashboard from modular router should be accessible"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        assert response.status_code == 200, "HR Dashboard endpoint should be accessible"
        print("✓ HR Dashboard endpoint accessible from modular routes/hr.py")
    
    def test_hr_employees_endpoint_accessible(self):
        """HR Employees from modular router should be accessible"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        assert response.status_code == 200, "HR Employees endpoint should be accessible"
        print("✓ HR Employees endpoint accessible from modular routes/hr.py")
    
    def test_hr_leaves_endpoint_accessible(self):
        """HR Leaves from modular router should be accessible"""
        response = requests.get(f"{BASE_URL}/api/hr/leaves")
        assert response.status_code == 200, "HR Leaves endpoint should be accessible"
        print("✓ HR Leaves endpoint accessible from modular routes/hr.py")
    
    def test_hr_performance_endpoint_accessible(self):
        """HR Performance from modular router should be accessible"""
        response = requests.get(f"{BASE_URL}/api/hr/performance")
        assert response.status_code == 200, "HR Performance endpoint should be accessible"
        print("✓ HR Performance endpoint accessible from modular routes/hr.py")
    
    def test_hr_attendance_endpoint_accessible(self):
        """HR Attendance from modular router should be accessible"""
        response = requests.get(f"{BASE_URL}/api/hr/attendance")
        assert response.status_code == 200, "HR Attendance endpoint should be accessible"
        print("✓ HR Attendance endpoint accessible from modular routes/hr.py")


class TestCRMDashboard:
    """Test CRM Dashboard to verify lead counts from both collections"""
    
    def test_crm_dashboard_returns_data(self):
        """CRM Dashboard should return proper data structure"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Dashboard should have pipeline stats
        assert "pipeline_stats" in data or "total_leads" in data, "Dashboard should have pipeline_stats or total_leads"
        
        print(f"✓ CRM Dashboard accessible and returns data")
    
    def test_crm_leads_endpoint(self):
        """CRM Leads endpoint should return leads list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should be a list of leads
        assert isinstance(data, list), "CRM Leads should return a list"
        
        print(f"✓ CRM Leads: {len(data)} leads in database")


# Fixtures
@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
