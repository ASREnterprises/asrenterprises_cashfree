"""
Backend API Tests for ASR Enterprises Solar Admin Panel
Tests: Admin Login, Analytics, Social Media Hub, Staff Management, Dashboard
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-lead-capture-1.preview.emergentagent.com')

class TestHealthAndBasicEndpoints:
    """Test basic health and API endpoints"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root passed: {data}")
    
    def test_districts_endpoint(self):
        """Test districts endpoint"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200
        data = response.json()
        assert "districts" in data
        assert len(data["districts"]) > 0
        assert "Patna" in data["districts"]
        print(f"✓ Districts endpoint passed: {len(data['districts'])} districts")


class TestAdminOTPLogin:
    """Test Admin OTP Login Flow with mock OTP 131993"""
    
    def test_send_otp_valid_admin_email(self):
        """Test sending OTP to valid admin email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/send-otp",
            json={"email": "asrenterprisespatna@gmail.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Send OTP passed: {data}")
    
    def test_send_otp_invalid_email(self):
        """Test sending OTP to non-admin email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/send-otp",
            json={"email": "random@example.com"}
        )
        assert response.status_code == 403
        print(f"✓ Invalid email rejected correctly")
    
    def test_verify_otp_with_mock_otp(self):
        """Test OTP verification with mock OTP 131993"""
        # First send OTP
        requests.post(
            f"{BASE_URL}/api/admin/send-otp",
            json={"email": "asrenterprisespatna@gmail.com"}
        )
        
        # Verify with mock OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/verify-otp",
            json={
                "email": "asrenterprisespatna@gmail.com",
                "otp": "131993"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["role"] == "admin"
        assert data["email"] == "asrenterprisespatna@gmail.com"
        print(f"✓ OTP verification passed: {data}")
    
    def test_verify_otp_with_wrong_otp(self):
        """Test OTP verification with wrong OTP should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verify-otp",
            json={
                "email": "asrenterprisespatna@gmail.com",
                "otp": "000000"
            }
        )
        assert response.status_code == 401
        print(f"✓ Wrong OTP rejected correctly")


class TestAnalyticsEndpoint:
    """Test Analytics API endpoint"""
    
    def test_get_analytics(self):
        """Test analytics endpoint returns proper data structure"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        required_fields = [
            "total_leads", "new_leads", "total_chats", "total_calculations",
            "total_campaigns", "high_score_leads", "total_photos", "total_reviews",
            "leads_by_district", "leads_by_status", "leads_by_property_type",
            "leads_this_month", "leads_last_month", "leads_this_week",
            "avg_lead_score", "recent_leads"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify data types
        assert isinstance(data["total_leads"], int)
        assert isinstance(data["leads_by_district"], list)
        assert isinstance(data["leads_by_status"], list)
        assert isinstance(data["recent_leads"], list)
        
        print(f"✓ Analytics endpoint passed:")
        print(f"  - Total leads: {data['total_leads']}")
        print(f"  - New leads: {data['new_leads']}")
        print(f"  - Districts breakdown: {len(data['leads_by_district'])} districts")
        print(f"  - Status breakdown: {len(data['leads_by_status'])} statuses")


class TestDashboardStats:
    """Test Dashboard Stats endpoint"""
    
    def test_get_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "total_leads", "new_leads", "total_photos", "total_reviews",
            "total_chats", "total_calculations", "total_campaigns",
            "high_score_leads", "recent_leads"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Dashboard stats passed:")
        print(f"  - Total leads: {data['total_leads']}")
        print(f"  - Total photos: {data['total_photos']}")
        print(f"  - Total reviews: {data['total_reviews']}")


class TestSocialMediaHub:
    """Test Social Media Hub API endpoints"""
    
    def test_get_social_posts(self):
        """Test getting social posts"""
        response = requests.get(f"{BASE_URL}/api/admin/social-posts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get social posts passed: {len(data)} posts")
    
    def test_create_social_post(self):
        """Test creating a social post"""
        post_data = {
            "content": "TEST_Post: Solar energy is the future! Contact ASR Enterprises for installation.",
            "platforms": ["facebook", "instagram"],
            "status": "scheduled"
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/social-posts",
            json=post_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["content"] == post_data["content"]
        assert data["platforms"] == post_data["platforms"]
        assert data["status"] == post_data["status"]
        print(f"✓ Create social post passed: {data['id']}")
        return data["id"]
    
    def test_generate_ai_social_post_promotion(self):
        """Test AI social post generation - promotion type"""
        response = requests.post(
            f"{BASE_URL}/api/admin/social-posts/generate",
            json={"type": "promotion"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "suggestions" in data
        assert len(data["suggestions"]) > 0
        print(f"✓ AI post generation (promotion) passed: {data['suggestions'][0][:50]}...")
    
    def test_generate_ai_social_post_project(self):
        """Test AI social post generation - project type"""
        response = requests.post(
            f"{BASE_URL}/api/admin/social-posts/generate",
            json={"type": "project"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "suggestions" in data
        print(f"✓ AI post generation (project) passed")
    
    def test_generate_ai_social_post_festival(self):
        """Test AI social post generation - festival type"""
        response = requests.post(
            f"{BASE_URL}/api/admin/social-posts/generate",
            json={"type": "festival"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ AI post generation (festival) passed")
    
    def test_generate_ai_social_post_scheme(self):
        """Test AI social post generation - scheme type"""
        response = requests.post(
            f"{BASE_URL}/api/admin/social-posts/generate",
            json={"type": "scheme"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ AI post generation (scheme) passed")


class TestStaffManagement:
    """Test Staff Management API endpoints"""
    
    def test_get_staff(self):
        """Test getting staff list"""
        response = requests.get(f"{BASE_URL}/api/admin/staff")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get staff passed: {len(data)} staff members")
    
    def test_create_staff(self):
        """Test creating a staff member"""
        staff_data = {
            "name": "TEST_Staff Member",
            "email": "test_staff@example.com",
            "phone": "9876543210",
            "role": "technician",
            "reportingTo": "Manager",
            "joiningDate": "2025-01-01",
            "status": "active"
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/staff",
            json=staff_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == staff_data["name"]
        assert data["role"] == staff_data["role"]
        print(f"✓ Create staff passed: {data['id']}")
        return data["id"]
    
    def test_update_staff(self):
        """Test updating a staff member"""
        # First create a staff member
        staff_data = {
            "name": "TEST_Update Staff",
            "email": "test_update@example.com",
            "phone": "9876543211",
            "role": "technician",
            "reportingTo": "Manager",
            "joiningDate": "2025-01-01",
            "status": "active"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/admin/staff",
            json=staff_data
        )
        staff_id = create_response.json()["id"]
        
        # Update the staff member
        update_data = {"status": "inactive"}
        response = requests.put(
            f"{BASE_URL}/api/admin/staff/{staff_id}",
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Update staff passed")
    
    def test_delete_staff(self):
        """Test deleting a staff member"""
        # First create a staff member
        staff_data = {
            "name": "TEST_Delete Staff",
            "email": "test_delete@example.com",
            "phone": "9876543212",
            "role": "technician",
            "reportingTo": "Manager",
            "joiningDate": "2025-01-01",
            "status": "active"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/admin/staff",
            json=staff_data
        )
        staff_id = create_response.json()["id"]
        
        # Delete the staff member
        response = requests.delete(f"{BASE_URL}/api/admin/staff/{staff_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Delete staff passed")


class TestSecurityEndpoints:
    """Test Security related endpoints"""
    
    def test_security_status(self):
        """Test security status endpoint"""
        response = requests.get(f"{BASE_URL}/api/security/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "secure"
        assert "security_features" in data
        assert len(data["security_features"]) > 0
        print(f"✓ Security status passed: {len(data['security_features'])} features active")


class TestLeadsEndpoints:
    """Test Leads Management endpoints"""
    
    def test_get_leads(self):
        """Test getting leads list"""
        response = requests.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get leads passed: {len(data)} leads")
    
    def test_create_lead(self):
        """Test creating a lead"""
        lead_data = {
            "name": "TEST Lead Customer",
            "email": "testlead@example.com",
            "phone": "9876543213",
            "district": "Patna",
            "address": "Test Address",
            "property_type": "residential",
            "roof_type": "rcc",
            "monthly_bill": 3000,
            "roof_area": 500,
            "message": "Test inquiry"
        }
        response = requests.post(
            f"{BASE_URL}/api/leads",
            json=lead_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == lead_data["name"]
        assert data["district"] == lead_data["district"]
        # Verify AI analysis fields
        assert "lead_score" in data
        assert "recommended_system" in data
        print(f"✓ Create lead passed: {data['id']}, Score: {data.get('lead_score')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
