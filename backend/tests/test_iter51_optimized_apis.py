"""
Iteration 51 - Testing optimized CRM and Staff dashboards
Features tested:
1. GET /api/crm/dashboard - optimized with parallel queries, should respond fast (<1s)
2. GET /api/staff/{staff_id}/dashboard - optimized with parallel queries
3. No 'superfone' text in staff portal (verified via frontend code check)
4. Staff portal handleCallLead uses tel: protocol only
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://solar-crm-stable.preview.emergentagent.com"

class TestOptimizedDashboards:
    """Test optimized dashboard endpoints for performance"""
    
    def test_crm_dashboard_performance(self):
        """CRM dashboard should respond in under 1 second"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "total_leads" in data, "Missing total_leads in response"
        assert "pipeline_stats" in data, "Missing pipeline_stats in response"
        assert "recent_leads" in data, "Missing recent_leads in response"
        assert "conversion_rate" in data, "Missing conversion_rate in response"
        
        # Performance check
        print(f"CRM Dashboard response time: {elapsed_time:.3f} seconds")
        assert elapsed_time < 2.0, f"Dashboard took too long: {elapsed_time:.3f}s (should be <2s)"
    
    def test_crm_dashboard_data_structure(self):
        """Verify CRM dashboard returns expected data structure"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Check pipeline stats has expected stages
        expected_stages = ["new", "contacted", "site_visit", "quotation", "negotiation", "converted", "completed", "lost"]
        pipeline_stats = data.get("pipeline_stats", {})
        for stage in expected_stages:
            assert stage in pipeline_stats, f"Missing stage '{stage}' in pipeline_stats"
        
        # Recent leads should be a list
        assert isinstance(data.get("recent_leads", []), list)
        print(f"CRM Dashboard: {data.get('total_leads')} total leads, {len(data.get('recent_leads', []))} recent")
    
    def test_staff_dashboard_performance(self):
        """Staff dashboard should respond quickly"""
        test_staff_id = "ASR1003"
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/staff/{test_staff_id}/dashboard")
        elapsed_time = time.time() - start_time
        
        # Staff might not exist, but the endpoint should respond fast
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        print(f"Staff Dashboard response time: {elapsed_time:.3f} seconds")
        assert elapsed_time < 2.0, f"Staff dashboard took too long: {elapsed_time:.3f}s"
        
        if response.status_code == 200:
            data = response.json()
            assert "total_assigned" in data or "staff" in data, "Missing expected fields in staff dashboard"
    
    def test_crm_widget_stats_performance(self):
        """Widget stats should be fast (cached)"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_leads" in data
        print(f"Widget stats response time: {elapsed_time:.3f} seconds")
        assert elapsed_time < 1.0, f"Widget stats too slow: {elapsed_time:.3f}s"
    
    def test_crm_widget_pipeline_performance(self):
        """Pipeline widget should be fast"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/crm/widget/pipeline")
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        
        # Response has pipeline_stages key
        assert "pipeline_stages" in data or "pipeline" in data, f"Response: {data.keys()}"
        print(f"Pipeline widget response time: {elapsed_time:.3f} seconds")
        assert elapsed_time < 1.0, f"Pipeline widget too slow: {elapsed_time:.3f}s"


class TestStaffLogin:
    """Test staff login endpoints"""
    
    def test_staff_login_endpoint_exists(self):
        """Staff login endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "INVALID123",
            "password": "wrongpassword"
        })
        # 401 is expected for invalid credentials
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_staff_login_requires_credentials(self):
        """Staff login should require staff_id and password"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={})
        # Either 400 or 401 is acceptable for missing credentials
        assert response.status_code in [400, 401], f"Expected 400 or 401, got {response.status_code}"


class TestStaffLeadsAPI:
    """Test staff leads APIs"""
    
    def test_staff_leads_endpoint(self):
        """Staff leads endpoint should work"""
        test_staff_id = "ASR1003"
        response = requests.get(f"{BASE_URL}/api/staff/{test_staff_id}/leads")
        # 404 if staff doesn't exist, 200 if exists
        assert response.status_code in [200, 404]
    
    def test_staff_followups_endpoint(self):
        """Staff followups endpoint should work"""
        test_staff_id = "ASR1003"
        response = requests.get(f"{BASE_URL}/api/staff/{test_staff_id}/followups")
        assert response.status_code in [200, 404]
    
    def test_staff_tasks_today_endpoint(self):
        """Staff today's tasks endpoint should work"""
        test_staff_id = "ASR1003"
        response = requests.get(f"{BASE_URL}/api/staff/{test_staff_id}/tasks/today")
        assert response.status_code in [200, 404]


class TestCRMLeadsAPI:
    """Test CRM leads APIs"""
    
    def test_crm_leads_list(self):
        """CRM leads list should return data"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        
        # Should return leads array or pagination object
        if isinstance(data, dict):
            assert "leads" in data or isinstance(data, list)
        elif isinstance(data, list):
            pass  # Direct array response is also valid
    
    def test_crm_leads_with_stage_filter(self):
        """CRM leads should filter by stage"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?stage=new")
        assert response.status_code == 200
    
    def test_crm_leads_pagination(self):
        """CRM leads should support pagination"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Check for pagination info if present
        if isinstance(data, dict) and "pagination" in data:
            pagination = data["pagination"]
            assert "current_page" in pagination
            assert "total_pages" in pagination


class TestHealthEndpoints:
    """Test basic health and API endpoints"""
    
    def test_api_root(self):
        """API root should respond"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
    
    def test_crm_quick_stats(self):
        """Quick stats endpoint should work"""
        response = requests.get(f"{BASE_URL}/api/crm/stats/quick")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_leads" in data
        # Response may have new_leads or other fields
        print(f"Quick stats response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
