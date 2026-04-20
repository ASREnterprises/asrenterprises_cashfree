"""
Test Suite for Admin Dashboard Features - Iteration 28
Testing: Admin Dashboard, Gallery Upload, CRM Leads, and related APIs
"""
import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

class TestDashboardWidgets:
    """Test Dashboard Widget APIs - these load stats for Admin Dashboard"""
    
    def test_dashboard_counts_widget(self):
        """Test /dashboard/widget/counts endpoint - shows leads/orders count"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widget/counts")
        print(f"Dashboard counts: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        # Should have total_leads and total_orders keys
        assert 'total_leads' in data or 'total_orders' in data or 'new_leads' in data
        print(f"Dashboard counts data: {data}")
        
    def test_dashboard_recent_leads_widget(self):
        """Test /dashboard/widget/recent-leads endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widget/recent-leads")
        print(f"Recent leads widget: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert 'recent_leads' in data
        print(f"Recent leads: {len(data.get('recent_leads', []))} leads")
        
    def test_dashboard_recent_orders_widget(self):
        """Test /dashboard/widget/recent-orders endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widget/recent-orders")
        print(f"Recent orders widget: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert 'recent_orders' in data
        print(f"Recent orders: {len(data.get('recent_orders', []))} orders")
        
    def test_dashboard_revenue_widget(self):
        """Test /dashboard/widget/revenue endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widget/revenue")
        print(f"Revenue widget: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        # Should have revenue info
        print(f"Revenue data: {data}")


class TestGalleryPhotosAPI:
    """Test Gallery Photo Management APIs"""
    
    def test_get_admin_photos(self):
        """Test GET /admin/photos - fetch all gallery photos for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/photos")
        print(f"Admin photos GET: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Gallery photos count: {len(data)}")
        return data
    
    def test_get_public_photos(self):
        """Test GET /photos - public gallery endpoint"""
        response = requests.get(f"{BASE_URL}/api/photos")
        print(f"Public photos GET: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Public photos count: {len(data)}")
    
    def test_add_photo_via_url(self):
        """Test POST /admin/photos - add photo via URL"""
        photo_data = {
            "title": "TEST_Photo_URL_Upload",
            "description": "Test photo uploaded via URL",
            "image_url": "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400",
            "location": "Patna, Bihar",
            "system_size": "5 kW",
            "category": "installation"
        }
        response = requests.post(f"{BASE_URL}/api/admin/photos", json=photo_data)
        print(f"Add photo via URL: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert data['title'] == "TEST_Photo_URL_Upload"
        print(f"Photo created with ID: {data['id']}")
        return data['id']
    
    def test_delete_photo(self):
        """Test DELETE /admin/photos/{id} - delete a test photo"""
        # First create a photo to delete
        photo_data = {
            "title": "TEST_Photo_To_Delete",
            "description": "This photo will be deleted",
            "image_url": "https://example.com/test.jpg",
            "location": "Test Location",
            "system_size": "3 kW",
            "category": "residential"
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/photos", json=photo_data)
        assert create_response.status_code == 200
        photo_id = create_response.json()['id']
        print(f"Created test photo with ID: {photo_id}")
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/admin/photos/{photo_id}")
        print(f"Delete photo: {delete_response.status_code}")
        assert delete_response.status_code == 200


class TestGalleryFileUpload:
    """Test Gallery File Upload Endpoint - Critical for mobile upload"""
    
    def test_gallery_upload_file_endpoint_exists(self):
        """Test that /gallery/upload-file endpoint exists"""
        # Try with empty form data to verify endpoint exists
        response = requests.post(f"{BASE_URL}/api/gallery/upload-file")
        print(f"Gallery upload-file endpoint check: {response.status_code}")
        # Should return 422 (validation error) not 404
        assert response.status_code in [422, 400, 200]
        print("✅ Endpoint /gallery/upload-file exists")
    
    def test_gallery_upload_file_with_image(self):
        """Test file upload with actual image data"""
        # Create a simple test image (1x1 PNG)
        import base64
        # 1x1 red PNG image
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        
        files = {
            'file': ('test_image.png', png_data, 'image/png')
        }
        data = {
            'title': 'TEST_Mobile_Upload',
            'description': 'Testing file upload from mobile',
            'location': 'Patna, Bihar',
            'system_size': '5 kW',
            'category': 'installation'
        }
        
        response = requests.post(f"{BASE_URL}/api/gallery/upload-file", files=files, data=data)
        print(f"Gallery file upload: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'No response body'}")
        
        assert response.status_code == 200
        result = response.json()
        assert 'success' in result
        assert result['success'] == True
        print(f"✅ File upload successful - Photo ID: {result.get('photo', {}).get('id')}")
        return result.get('photo', {}).get('id')


class TestCRMLeadsAPI:
    """Test CRM Leads Management APIs"""
    
    def test_crm_dashboard_stats(self):
        """Test /crm/widget/stats - CRM dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/crm/widget/stats")
        print(f"CRM widget stats: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        print(f"CRM stats: {data}")
        
    def test_crm_leads_list(self):
        """Test GET /crm/leads - list all CRM leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        print(f"CRM leads list: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"CRM leads count: {len(data)}")
        return data
    
    def test_create_crm_lead(self):
        """Test POST /crm/leads - create a new CRM lead"""
        lead_data = {
            "name": "TEST_CRM_Lead",
            "email": "test_crm@example.com",
            "phone": "9876543210",
            "district": "Patna",
            "address": "Test Address, Patna",
            "property_type": "residential",
            "monthly_bill": 3000,
            "roof_area": 500,
            "source": "manual"
        }
        response = requests.post(f"{BASE_URL}/api/crm/leads", json=lead_data)
        print(f"Create CRM lead: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        print(f"Created CRM lead with ID: {data['id']}")
        return data['id']
    
    def test_crm_followups(self):
        """Test GET /crm/followups - list follow-ups"""
        response = requests.get(f"{BASE_URL}/api/crm/followups")
        print(f"CRM followups: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        print(f"CRM followups count: {len(data)}")


class TestCRMTasksAPI:
    """Test CRM Tasks Management APIs"""
    
    def test_crm_tasks_list(self):
        """Test GET /crm/tasks - list all tasks"""
        response = requests.get(f"{BASE_URL}/api/crm/tasks")
        print(f"CRM tasks list: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"CRM tasks count: {len(data)}")


class TestStaffAccountsAPI:
    """Test Staff Accounts Management APIs"""
    
    def test_staff_accounts_list(self):
        """Test GET /admin/staff-accounts - list all staff"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        print(f"Staff accounts list: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Staff accounts count: {len(data)}")
        return data


class TestCRMMessagesAPI:
    """Test CRM Messages API"""
    
    def test_crm_messages_list(self):
        """Test GET /crm/messages - list messages"""
        response = requests.get(f"{BASE_URL}/api/crm/messages")
        print(f"CRM messages: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"CRM messages count: {len(data)}")


class TestReviewsAPI:
    """Test Customer Reviews/Testimonials API"""
    
    def test_reviews_list(self):
        """Test GET /reviews - list customer reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        print(f"Reviews list: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Reviews count: {len(data)}")


class TestShopStatsAPI:
    """Test Shop Stats API - used by Admin Dashboard"""
    
    def test_shop_stats(self):
        """Test GET /shop/stats - shop statistics"""
        response = requests.get(f"{BASE_URL}/api/shop/stats")
        print(f"Shop stats: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        print(f"Shop stats: {data}")


class TestDistrictsAPI:
    """Test Districts API"""
    
    def test_districts_list(self):
        """Test GET /districts - list Bihar districts"""
        response = requests.get(f"{BASE_URL}/api/districts")
        print(f"Districts: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert 'districts' in data
        assert len(data['districts']) > 0
        print(f"Districts count: {len(data['districts'])}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_photos(self):
        """Delete test photos created during testing"""
        # Get all photos and delete test ones
        response = requests.get(f"{BASE_URL}/api/admin/photos")
        if response.status_code == 200:
            photos = response.json()
            deleted = 0
            for photo in photos:
                if 'TEST_' in (photo.get('title') or ''):
                    requests.delete(f"{BASE_URL}/api/admin/photos/{photo['id']}")
                    deleted += 1
            print(f"Cleaned up {deleted} test photos")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
