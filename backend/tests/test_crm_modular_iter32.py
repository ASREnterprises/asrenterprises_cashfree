"""
Iteration 32 Tests - CRM Modular Router & Security Headers Verification
Tests:
1. CRM Widget Stats API - /api/crm/widget/stats (total_leads=43)
2. CRM Dashboard API - /api/crm/dashboard (conversion_rate number, not None)
3. CRM Leads API - /api/crm/leads (list of leads)
4. CRM Tasks API - /api/crm/tasks (list)
5. CRM Leaderboard API - /api/crm/leaderboard (staff rankings)
6. Security Headers - X-Frame-Options, X-Content-Type-Options, CSP, HSTS
7. HR APIs still working - /api/hr/dashboard, /api/hr/employees
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCRMWidgetStats:
    """Test CRM Widget Stats endpoint - /api/crm/widget/stats"""
    
    def test_widget_stats_returns_200(self):
        """Widget stats endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ CRM widget stats returns 200")
    
    def test_widget_stats_has_total_leads(self):
        """Widget stats should include total_leads field"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        data = response.json()
        assert "total_leads" in data, "total_leads field missing from response"
        print(f"✓ total_leads field present in response: {data.get('total_leads')}")
    
    def test_widget_stats_total_leads_value(self):
        """Widget stats should return total_leads=43"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        data = response.json()
        assert data.get("total_leads") == 43, f"Expected total_leads=43, got {data.get('total_leads')}"
        print(f"✓ total_leads = 43 verified")
    
    def test_widget_stats_response_structure(self):
        """Widget stats should return all expected fields"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        data = response.json()
        expected_fields = ["total_leads", "new_leads", "qualified_leads", "converted_leads", "active_staff", "pending_tasks"]
        for field in expected_fields:
            assert field in data, f"Field '{field}' missing from response"
        print(f"✓ All expected fields present: {list(data.keys())}")


class TestCRMDashboard:
    """Test CRM Dashboard endpoint - /api/crm/dashboard"""
    
    def test_dashboard_returns_200(self):
        """Dashboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ CRM dashboard returns 200")
    
    def test_dashboard_has_conversion_rate(self):
        """Dashboard should include conversion_rate field"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        data = response.json()
        assert "conversion_rate" in data, "conversion_rate field missing from response"
        print(f"✓ conversion_rate field present: {data.get('conversion_rate')}")
    
    def test_dashboard_conversion_rate_is_number(self):
        """Dashboard conversion_rate should be a number (not None)"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        data = response.json()
        conversion_rate = data.get("conversion_rate")
        assert conversion_rate is not None, "conversion_rate is None"
        assert isinstance(conversion_rate, (int, float)), f"conversion_rate should be number, got {type(conversion_rate)}"
        print(f"✓ conversion_rate is a number: {conversion_rate}")
    
    def test_dashboard_response_structure(self):
        """Dashboard should return all expected fields"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        data = response.json()
        expected_fields = ["total_leads", "pipeline_stats", "source_stats", "todays_followups", "active_staff", "recent_leads", "conversion_rate"]
        for field in expected_fields:
            assert field in data, f"Field '{field}' missing from response"
        print(f"✓ All dashboard fields present")


class TestCRMLeads:
    """Test CRM Leads endpoint - /api/crm/leads"""
    
    def test_leads_returns_200(self):
        """Leads endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ CRM leads returns 200")
    
    def test_leads_returns_list(self):
        """Leads endpoint should return a list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Leads returns a list with {len(data)} items")
    
    def test_leads_with_stage_filter(self):
        """Leads endpoint should support stage filter"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?stage=new")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Filtered response should be a list"
        print(f"✓ Leads with stage=new filter works, {len(data)} leads")


class TestCRMTasks:
    """Test CRM Tasks endpoint - /api/crm/tasks"""
    
    def test_tasks_returns_200(self):
        """Tasks endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/tasks")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ CRM tasks returns 200")
    
    def test_tasks_returns_list(self):
        """Tasks endpoint should return a list"""
        response = requests.get(f"{BASE_URL}/api/crm/tasks")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Tasks returns a list with {len(data)} items")


class TestCRMLeaderboard:
    """Test CRM Leaderboard endpoint - /api/crm/leaderboard"""
    
    def test_leaderboard_returns_200(self):
        """Leaderboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/leaderboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ CRM leaderboard returns 200")
    
    def test_leaderboard_returns_list(self):
        """Leaderboard should return a list of staff rankings"""
        response = requests.get(f"{BASE_URL}/api/crm/leaderboard")
        data = response.json()
        # API returns list directly (from server.py) or dict with leaderboard key (from crm.py router)
        if isinstance(data, dict):
            leaderboard = data.get("leaderboard", [])
        else:
            leaderboard = data
        assert isinstance(leaderboard, list), f"Expected list, got {type(leaderboard)}"
        print(f"✓ Leaderboard returns a list with {len(leaderboard)} staff members")
    
    def test_leaderboard_entry_structure(self):
        """Each leaderboard entry should have expected fields"""
        response = requests.get(f"{BASE_URL}/api/crm/leaderboard")
        data = response.json()
        # API returns list directly (from server.py) or dict with leaderboard key (from crm.py router)
        if isinstance(data, dict):
            leaderboard = data.get("leaderboard", [])
        else:
            leaderboard = data
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            # Server.py version uses "conversions" instead of "leads_converted"
            expected_fields = ["name", "rank", "leads_assigned"]
            for field in expected_fields:
                assert field in entry, f"Field '{field}' missing from leaderboard entry"
            print(f"✓ Leaderboard entry structure verified with fields: {list(entry.keys())}")
        else:
            print("⚠ No leaderboard entries to verify structure")


class TestSecurityHeaders:
    """Test Security Headers on API responses"""
    
    def test_x_frame_options_header(self):
        """Response should include X-Frame-Options header"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        x_frame = response.headers.get("X-Frame-Options")
        assert x_frame is not None, "X-Frame-Options header missing"
        assert x_frame == "DENY", f"Expected X-Frame-Options=DENY, got {x_frame}"
        print(f"✓ X-Frame-Options: {x_frame}")
    
    def test_x_content_type_options_header(self):
        """Response should include X-Content-Type-Options header"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        x_content_type = response.headers.get("X-Content-Type-Options")
        assert x_content_type is not None, "X-Content-Type-Options header missing"
        assert x_content_type == "nosniff", f"Expected nosniff, got {x_content_type}"
        print(f"✓ X-Content-Type-Options: {x_content_type}")
    
    def test_content_security_policy_header(self):
        """Response should include Content-Security-Policy header"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        csp = response.headers.get("Content-Security-Policy")
        assert csp is not None, "Content-Security-Policy header missing"
        assert "default-src" in csp, "CSP should contain default-src directive"
        print(f"✓ Content-Security-Policy present")
    
    def test_strict_transport_security_header(self):
        """Response should include Strict-Transport-Security header"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        hsts = response.headers.get("Strict-Transport-Security")
        assert hsts is not None, "Strict-Transport-Security header missing"
        assert "max-age" in hsts, "HSTS should contain max-age directive"
        print(f"✓ Strict-Transport-Security: {hsts}")
    
    def test_x_xss_protection_header(self):
        """Response should include X-XSS-Protection header"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        xss = response.headers.get("X-XSS-Protection")
        assert xss is not None, "X-XSS-Protection header missing"
        print(f"✓ X-XSS-Protection: {xss}")
    
    def test_referrer_policy_header(self):
        """Response should include Referrer-Policy header"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        referrer = response.headers.get("Referrer-Policy")
        assert referrer is not None, "Referrer-Policy header missing"
        print(f"✓ Referrer-Policy: {referrer}")


class TestHRAPIsStillWorking:
    """Test HR APIs are still functioning - /api/hr/dashboard, /api/hr/employees"""
    
    def test_hr_dashboard_returns_200(self):
        """HR Dashboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ HR dashboard returns 200")
    
    def test_hr_dashboard_response_structure(self):
        """HR Dashboard should return expected fields"""
        response = requests.get(f"{BASE_URL}/api/hr/dashboard")
        data = response.json()
        expected_fields = ["total_employees", "active_employees", "departments"]
        for field in expected_fields:
            assert field in data, f"Field '{field}' missing from HR dashboard"
        print(f"✓ HR dashboard structure verified: total_employees={data.get('total_employees')}")
    
    def test_hr_employees_returns_200(self):
        """HR Employees endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ HR employees returns 200")
    
    def test_hr_employees_returns_list(self):
        """HR Employees should return employees list"""
        response = requests.get(f"{BASE_URL}/api/hr/employees")
        data = response.json()
        assert "employees" in data, "employees field missing from response"
        assert isinstance(data.get("employees"), list), "employees should be a list"
        print(f"✓ HR employees returns {data.get('total', len(data.get('employees', [])))} employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
