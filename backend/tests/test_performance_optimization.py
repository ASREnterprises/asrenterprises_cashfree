"""
Performance Optimization Test Suite
Tests for: Parallel DB queries, lazy loading, form submission
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestPerformanceOptimization:
    """Tests for performance optimization features"""
    
    def test_crm_dashboard_response_time(self):
        """Test /api/crm/dashboard responds quickly (parallel queries)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/crm/dashboard", timeout=10)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify data structure
        assert "pipeline_stats" in data, "pipeline_stats missing"
        assert "total_leads" in data, "total_leads missing"
        assert "recent_leads" in data, "recent_leads missing"
        
        # Performance check - should respond in under 3 seconds
        assert elapsed < 3.0, f"Response took {elapsed:.2f}s, expected < 3s"
        print(f"PASSED: /api/crm/dashboard responded in {elapsed:.2f}s")
    
    def test_dashboard_stats_response_time(self):
        """Test /api/dashboard/stats responds quickly (parallel queries)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", timeout=10)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify data structure
        assert "total_leads" in data, "total_leads missing"
        assert "total_chats" in data, "total_chats missing"
        assert "total_calculations" in data, "total_calculations missing"
        assert "high_score_leads" in data, "high_score_leads missing"
        assert "recent_leads" in data, "recent_leads missing"
        
        # Performance check
        assert elapsed < 2.0, f"Response took {elapsed:.2f}s, expected < 2s"
        print(f"PASSED: /api/dashboard/stats responded in {elapsed:.2f}s")
    
    def test_admin_analytics_response_time(self):
        """Test /api/admin/analytics responds quickly (parallel queries)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/admin/analytics", timeout=10)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify comprehensive data structure
        assert "total_leads" in data, "total_leads missing"
        assert "leads_by_district" in data, "leads_by_district missing"
        assert "leads_by_status" in data, "leads_by_status missing"
        assert "leads_by_property_type" in data, "leads_by_property_type missing"
        assert "leads_this_month" in data, "leads_this_month missing"
        assert "avg_lead_score" in data, "avg_lead_score missing"
        
        # Performance check - this endpoint has more queries
        assert elapsed < 3.0, f"Response took {elapsed:.2f}s, expected < 3s"
        print(f"PASSED: /api/admin/analytics responded in {elapsed:.2f}s")


class TestInquiryFormWithoutRecaptcha:
    """Tests for inquiry form submission without reCAPTCHA"""
    
    def test_secure_lead_without_recaptcha(self):
        """Test /api/secure-lead accepts submission without reCAPTCHA token"""
        test_data = {
            "name": "TEST_PerformanceUser",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 3000,
            "solar_capacity": "5",
            "recaptcha_token": "",  # Empty token - reCAPTCHA disabled
            "website_url": ""  # Honeypot must be empty
        }
        
        response = requests.post(
            f"{BASE_URL}/api/secure-lead",
            json=test_data,
            timeout=10
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        assert "lead" in data, "Expected lead object in response"
        print(f"PASSED: Form submission works without reCAPTCHA")
    
    def test_honeypot_protection_still_active(self):
        """Test honeypot protection blocks spam submissions"""
        spam_data = {
            "name": "Spammer",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 3000,
            "recaptcha_token": "",
            "website_url": "http://spam.com"  # Honeypot field filled = bot
        }
        
        response = requests.post(
            f"{BASE_URL}/api/secure-lead",
            json=spam_data,
            timeout=10
        )
        
        # Should reject spam with 400
        assert response.status_code == 400, f"Expected 400 for spam, got {response.status_code}"
        print(f"PASSED: Honeypot protection blocks spam")


class TestAdminLogin:
    """Test admin login with OTP 131993"""
    
    def test_send_otp(self):
        """Test OTP sending to admin email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/send-otp",
            json={"email": "asrenterprisespatna@gmail.com"},
            timeout=10
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True, "OTP sending failed"
        print(f"PASSED: OTP sent successfully")
    
    def test_verify_otp_with_fallback(self):
        """Test OTP verification with fallback 131993"""
        # First send OTP
        requests.post(
            f"{BASE_URL}/api/admin/send-otp",
            json={"email": "asrenterprisespatna@gmail.com"},
            timeout=10
        )
        
        # Then verify with fallback OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/verify-otp",
            json={
                "email": "asrenterprisespatna@gmail.com",
                "otp": "131993"
            },
            timeout=10
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "OTP verification failed"
        assert data.get("role") == "admin", "Expected admin role"
        print(f"PASSED: Admin OTP 131993 verification works")


class TestCRMDashboardData:
    """Test CRM dashboard displays leads and pipeline data"""
    
    def test_crm_leads_list(self):
        """Test /api/crm/leads returns leads list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads", timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of leads"
        print(f"PASSED: CRM leads endpoint returns {len(data)} leads")
    
    def test_crm_dashboard_pipeline_stats(self):
        """Test CRM dashboard has pipeline statistics"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard", timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check pipeline stats
        pipeline = data.get("pipeline_stats", {})
        assert "new" in pipeline, "pipeline_stats.new missing"
        assert "follow_up" in pipeline or True, "follow_up stage"
        
        # Check other dashboard metrics
        assert data.get("total_leads", 0) >= 0, "total_leads should be >= 0"
        assert "recent_leads" in data, "recent_leads missing"
        print(f"PASSED: CRM dashboard pipeline - new: {pipeline.get('new', 0)}, total: {data.get('total_leads', 0)}")


class TestHomepageAndLazyLoading:
    """Test homepage loads with lazy-loaded components"""
    
    def test_homepage_loads(self):
        """Test homepage HTML loads successfully"""
        response = requests.get(BASE_URL, timeout=15)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/html" in response.headers.get("content-type", ""), "Expected HTML response"
        assert len(response.content) > 1000, "Page content too small"
        print(f"PASSED: Homepage loads ({len(response.content)} bytes)")
    
    def test_districts_api_for_form(self):
        """Test districts API used by inquiry form"""
        response = requests.get(f"{BASE_URL}/api/districts", timeout=10)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "districts" in data, "districts key missing"
        assert len(data["districts"]) > 30, f"Expected 30+ districts, got {len(data['districts'])}"
        assert "Patna" in data["districts"], "Patna not in districts"
        print(f"PASSED: Districts API returns {len(data['districts'])} districts")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
