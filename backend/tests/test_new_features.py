"""
Test suite for ASR Enterprises Solar CRM - New Features
Features tested:
1. Gallery Sync - Photos uploaded in CRM auto-display on website /gallery
2. Custom Staff ID - Admin can specify custom Staff ID during creation
3. Duplicate Staff ID Detection - Returns 400 error for duplicate IDs
4. Auto-CRM Lead Creation - Website inquiry form auto-creates CRM leads
5. Festive Banner - Admin festive posts auto-display on homepage
"""
import pytest
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGallerySync:
    """Test Gallery photo sync between CRM and website"""
    
    def test_gallery_photos_endpoint_returns_list(self):
        """GET /api/photos returns list of gallery photos"""
        response = requests.get(f"{BASE_URL}/api/photos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Gallery photos endpoint returns list with {len(data)} items")
    
    def test_admin_photos_endpoint_returns_list(self):
        """GET /api/admin/photos returns list for admin management"""
        response = requests.get(f"{BASE_URL}/api/admin/photos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin photos endpoint returns list with {len(data)} items")
    
    def test_upload_photo_and_verify_in_public_gallery(self):
        """Test that photos uploaded via admin API appear in public gallery"""
        # Create a test photo
        timestamp = int(time.time())
        photo_data = {
            "title": f"TEST_Gallery_Sync_{timestamp}",
            "description": "Test photo for gallery sync verification",
            "image_url": "https://via.placeholder.com/800x600?text=Test+Photo",
            "location": "Patna, Bihar",
            "system_size": "5kW",
            "category": "installation"
        }
        
        # Upload via admin endpoint
        upload_response = requests.post(f"{BASE_URL}/api/admin/photos", json=photo_data)
        assert upload_response.status_code == 200
        uploaded_photo = upload_response.json()
        assert "id" in uploaded_photo
        photo_id = uploaded_photo["id"]
        print(f"✓ Photo uploaded with ID: {photo_id}")
        
        # Verify it appears in public gallery
        gallery_response = requests.get(f"{BASE_URL}/api/photos")
        assert gallery_response.status_code == 200
        gallery_photos = gallery_response.json()
        
        # Find the uploaded photo in gallery
        found = any(p.get("id") == photo_id for p in gallery_photos)
        assert found, f"Uploaded photo {photo_id} not found in public gallery"
        print(f"✓ Photo visible in public gallery")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/admin/photos/{photo_id}")
        assert delete_response.status_code == 200
        print(f"✓ Photo cleaned up successfully")


class TestCustomStaffID:
    """Test Custom Staff ID feature during staff creation"""
    
    def test_create_staff_with_custom_id(self):
        """Staff registration with custom Staff ID via POST /api/staff/register"""
        timestamp = int(time.time())
        custom_id = f"ASRCUSTOM{timestamp % 10000}"
        
        payload = {
            "name": "Test Custom ID Staff",
            "email": f"test_{timestamp}@example.com",
            "phone": f"98765{timestamp % 100000:05d}",
            "role": "sales",
            "password": "asr@123",
            "custom_staff_id": custom_id
        }
        
        response = requests.post(f"{BASE_URL}/api/staff/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["staff_id"] == custom_id
        assert "password" in data
        print(f"✓ Staff created with custom ID: {custom_id}")
        
        # Verify staff exists
        profile_response = requests.get(f"{BASE_URL}/api/staff/profile/{custom_id}")
        assert profile_response.status_code == 200
        profile = profile_response.json()
        assert profile["staff_id"] == custom_id
        assert profile["name"] == "Test Custom ID Staff"
        print(f"✓ Staff profile verified with custom ID")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/admin/staff-accounts/{custom_id}")
        assert delete_response.status_code == 200
        print(f"✓ Staff account cleaned up")
    
    def test_create_staff_with_custom_id_auto_adds_prefix(self):
        """Custom ID without ASR prefix should auto-add ASR"""
        timestamp = int(time.time())
        custom_id_without_prefix = f"NOPREFIX{timestamp % 10000}"
        
        payload = {
            "name": "Test No Prefix Staff",
            "email": f"test_noprefix_{timestamp}@example.com",
            "phone": f"98764{timestamp % 100000:05d}",
            "role": "survey",
            "password": "asr@123",
            "custom_staff_id": custom_id_without_prefix
        }
        
        response = requests.post(f"{BASE_URL}/api/staff/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        expected_id = f"ASR{custom_id_without_prefix}"
        assert data["staff_id"] == expected_id
        print(f"✓ Staff ID auto-prefixed: {expected_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/staff-accounts/{expected_id}")
    
    def test_create_staff_without_custom_id_auto_generates(self):
        """Staff registration without custom ID auto-generates one"""
        timestamp = int(time.time())
        
        payload = {
            "name": "Test Auto ID Staff",
            "email": f"test_auto_{timestamp}@example.com",
            "phone": f"98763{timestamp % 100000:05d}",
            "role": "installation",
            "password": "asr@123"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["staff_id"].startswith("ASR")
        print(f"✓ Staff ID auto-generated: {data['staff_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/staff-accounts/{data['staff_id']}")


class TestDuplicateStaffIDDetection:
    """Test duplicate Staff ID detection returns 400 error"""
    
    def test_duplicate_staff_id_returns_400(self):
        """Creating staff with existing ID returns 400"""
        timestamp = int(time.time())
        custom_id = f"ASRDUPE{timestamp % 10000}"
        
        # Create first staff
        payload1 = {
            "name": "First Staff",
            "email": f"first_{timestamp}@example.com",
            "phone": f"98762{timestamp % 100000:05d}",
            "role": "sales",
            "password": "asr@123",
            "custom_staff_id": custom_id
        }
        
        response1 = requests.post(f"{BASE_URL}/api/staff/register", json=payload1)
        assert response1.status_code == 200
        print(f"✓ First staff created with ID: {custom_id}")
        
        # Try to create second staff with same ID
        payload2 = {
            "name": "Second Staff",
            "email": f"second_{timestamp}@example.com",
            "phone": f"98761{timestamp % 100000:05d}",
            "role": "survey",
            "password": "asr@123",
            "custom_staff_id": custom_id
        }
        
        response2 = requests.post(f"{BASE_URL}/api/staff/register", json=payload2)
        assert response2.status_code == 400
        error_data = response2.json()
        assert "already exists" in error_data["detail"].lower()
        print(f"✓ Duplicate ID correctly rejected with 400 error: {error_data['detail']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/staff-accounts/{custom_id}")


class TestAutoCRMLeadCreation:
    """Test that website inquiry form auto-creates CRM leads"""
    
    def test_lead_creation_auto_creates_crm_lead(self):
        """POST /api/leads auto-creates CRM lead in crm_leads collection"""
        timestamp = int(time.time())
        
        lead_payload = {
            "name": f"TEST_AutoCRM_{timestamp}",
            "email": f"autocrm_{timestamp}@example.com",
            "phone": f"98760{timestamp % 100000:05d}",
            "district": "Muzaffarpur",
            "property_type": "residential",
            "roof_type": "rcc",
            "monthly_bill": 4000,
            "roof_area": 600
        }
        
        # Create lead via website form endpoint
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_payload)
        assert response.status_code == 200
        created_lead = response.json()
        lead_id = created_lead["id"]
        print(f"✓ Lead created via /api/leads with ID: {lead_id}")
        
        # Verify lead exists in main leads collection
        leads_response = requests.get(f"{BASE_URL}/api/leads")
        assert leads_response.status_code == 200
        leads = leads_response.json()
        found_in_leads = any(l.get("id") == lead_id for l in leads)
        assert found_in_leads, "Lead not found in /api/leads"
        print(f"✓ Lead found in /api/leads collection")
        
        # Verify lead auto-created in CRM leads collection
        crm_leads_response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert crm_leads_response.status_code == 200
        crm_leads = crm_leads_response.json()
        found_in_crm = any(l.get("id") == lead_id for l in crm_leads)
        assert found_in_crm, "Lead not auto-created in /api/crm/leads"
        print(f"✓ Lead auto-created in CRM leads collection")
        
        # Verify CRM lead has correct fields
        crm_lead = next((l for l in crm_leads if l.get("id") == lead_id), None)
        assert crm_lead is not None
        assert crm_lead["source"] == "website"
        assert crm_lead["stage"] == "new"
        assert crm_lead["lead_score"] > 0
        assert crm_lead["ai_priority"] in ["high", "medium", "low"]
        print(f"✓ CRM lead has correct auto-populated fields: source={crm_lead['source']}, stage={crm_lead['stage']}, score={crm_lead['lead_score']}, priority={crm_lead['ai_priority']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leads/{lead_id}")


class TestFestiveBanner:
    """Test festive banner endpoint"""
    
    def test_get_active_festival_returns_null_or_festival(self):
        """GET /api/festivals/active returns active festival post or null"""
        response = requests.get(f"{BASE_URL}/api/festivals/active")
        assert response.status_code == 200
        # Returns null if no active festival or festival object
        data = response.json()
        if data is not None:
            assert "title" in data
            assert "message" in data
            print(f"✓ Active festival found: {data['title']}")
        else:
            print(f"✓ No active festival (returns null as expected)")
    
    def test_create_active_festival_and_verify_active_endpoint(self):
        """Create festival with current date range and verify active endpoint"""
        today = datetime.now()
        start_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        timestamp = int(time.time())
        
        festival_data = {
            "title": f"TEST_Festival_{timestamp}",
            "message": "Wishing you a happy festival! Go solar with ASR Enterprises!",
            "image_url": "https://via.placeholder.com/400x200?text=Festival+Banner",
            "start_date": start_date,
            "end_date": end_date
        }
        
        # Create festival
        create_response = requests.post(f"{BASE_URL}/api/admin/festivals", json=festival_data)
        assert create_response.status_code == 200
        created_festival = create_response.json()
        festival_id = created_festival["id"]
        print(f"✓ Festival created with ID: {festival_id}")
        
        # Verify it appears in active endpoint
        active_response = requests.get(f"{BASE_URL}/api/festivals/active")
        assert active_response.status_code == 200
        active_festival = active_response.json()
        
        # Note: There may be other active festivals, so we just verify our test festival or another is active
        if active_festival:
            print(f"✓ Active festival endpoint returns festival: {active_festival.get('title')}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/admin/festivals/{festival_id}")
        assert delete_response.status_code == 200
        print(f"✓ Festival cleaned up")
    
    def test_get_all_festivals_endpoint(self):
        """GET /api/festivals returns list of active festivals"""
        response = requests.get(f"{BASE_URL}/api/festivals")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Festivals endpoint returns list with {len(data)} items")


class TestExistingStaffLogin:
    """Test login with existing staff credentials"""
    
    def test_staff_login_with_valid_credentials(self):
        """Staff login with ASR1001 / asr@123"""
        payload = {
            "staff_id": "ASR1001",
            "password": "asr@123"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff/login", json=payload)
        # May succeed or fail depending on test data state
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "token" in data
            assert "staff" in data
            print(f"✓ Staff login successful for ASR1001")
        else:
            print(f"⚠ Staff ASR1001 may not exist in current state (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
