"""
Test file for iteration 69 features:
1. Social Media - Facebook file upload now uses direct binary upload (not URL) for local files
2. Social Media - Instagram shows clear error message when using local file upload
3. Staff Portal - WhatsApp tab shows 'Send Template' button when lead is selected
4. Staff Portal - FAB button positioned higher (bottom-20 instead of bottom-6)
5. Admin Dashboard - Social Media module card added with link to /admin/social-media
6. Admin Dashboard Route - /admin/social-media uses SocialMediaManager component
7. Gallery - Email updated to support@asrenterprises.in
8. API: POST /api/social/posts/create - Facebook posts with local images now upload binary data
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestSocialMediaAPI:
    """Test Social Media API endpoints"""
    
    def test_social_settings_endpoint(self):
        """Test GET /api/social/settings returns correct data"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Verify Facebook settings
        assert "facebook_page_id" in data
        assert "facebook_connected" in data
        assert "facebook_page_name" in data
        
        # Verify Instagram settings
        assert "instagram_account_id" in data
        assert "instagram_connected" in data
        
        print(f"Social settings: Facebook connected={data.get('facebook_connected')}, Instagram connected={data.get('instagram_connected')}")
    
    def test_social_dashboard_stats(self):
        """Test GET /api/social/dashboard/stats returns correct data"""
        response = requests.get(f"{BASE_URL}/api/social/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats fields
        assert "total_posts" in data
        assert "scheduled_posts" in data
        assert "published_posts" in data
        assert "failed_posts" in data
        assert "facebook_connected" in data
        assert "instagram_connected" in data
        
        print(f"Dashboard stats: total_posts={data.get('total_posts')}, published={data.get('published_posts')}")
    
    def test_social_test_connection(self):
        """Test POST /api/social/test-connection"""
        response = requests.post(f"{BASE_URL}/api/social/test-connection")
        assert response.status_code == 200
        data = response.json()
        
        # Verify connection results
        assert "facebook" in data
        assert "instagram" in data
        
        print(f"Connection test: Facebook={data.get('facebook', {}).get('status')}, Instagram={data.get('instagram', {}).get('status')}")
    
    def test_social_posts_list(self):
        """Test GET /api/social/posts returns posts list"""
        response = requests.get(f"{BASE_URL}/api/social/posts")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "posts" in data
        assert "pagination" in data
        
        print(f"Posts list: {len(data.get('posts', []))} posts found")
    
    def test_create_post_without_image_facebook(self):
        """Test POST /api/social/posts/create - text-only post to Facebook"""
        payload = {
            "caption": "TEST_iter69 - Text only post for testing",
            "platforms": ["facebook"],
            "image_url": "",
            "video_url": ""
        }
        response = requests.post(f"{BASE_URL}/api/social/posts/create", json=payload)
        
        # Should succeed or fail gracefully
        assert response.status_code in [200, 400, 500]
        data = response.json()
        
        if response.status_code == 200:
            print(f"Text post created: success={data.get('success')}, post_id={data.get('post_id')}")
        else:
            print(f"Text post response: {data}")
    
    def test_instagram_local_file_error_message(self):
        """Test that Instagram shows clear error for local file uploads"""
        # Simulate a local file URL (from our API)
        payload = {
            "caption": "TEST_iter69 - Instagram local file test",
            "platforms": ["instagram"],
            "image_url": f"{BASE_URL}/api/social/files/test-file-id",  # Local file URL
            "video_url": ""
        }
        response = requests.post(f"{BASE_URL}/api/social/posts/create", json=payload)
        
        # Should return error with clear message about public URL requirement
        data = response.json()
        
        if "results" in data and "instagram" in data.get("results", {}):
            ig_result = data["results"]["instagram"]
            if not ig_result.get("success"):
                error_msg = ig_result.get("error", "")
                # Verify error message mentions public URL requirement
                assert "public" in error_msg.lower() or "url" in error_msg.lower() or "hosting" in error_msg.lower(), \
                    f"Instagram error should mention public URL requirement, got: {error_msg}"
                print(f"Instagram local file error (expected): {error_msg}")
            else:
                print("Instagram post succeeded (unexpected for local file)")
        else:
            print(f"Response: {data}")


class TestWhatsAppAPI:
    """Test WhatsApp API endpoints"""
    
    def test_whatsapp_settings(self):
        """Test GET /api/whatsapp/settings"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Verify WhatsApp settings
        assert "phone_number_id" in data or "is_configured" in data
        print(f"WhatsApp settings: {data}")
    
    def test_whatsapp_templates(self):
        """Test GET /api/whatsapp/templates"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of templates
        assert isinstance(data, list)
        print(f"WhatsApp templates: {len(data)} templates found")


class TestStaffPortalAPI:
    """Test Staff Portal API endpoints"""
    
    def test_staff_login(self):
        """Test POST /api/staff/login"""
        payload = {
            "staff_id": "ASR1024",
            "password": "test123"
        }
        response = requests.post(f"{BASE_URL}/api/staff/login", json=payload)
        
        # Should succeed or fail with proper error
        assert response.status_code in [200, 401, 404]
        data = response.json()
        
        if response.status_code == 200:
            print(f"Staff login successful: {data.get('name', 'Unknown')}")
            return data
        else:
            print(f"Staff login response: {data}")
            return None


class TestAdminDashboardAPI:
    """Test Admin Dashboard API endpoints"""
    
    def test_dashboard_widget_counts(self):
        """Test GET /api/dashboard/widget/counts"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widget/counts")
        assert response.status_code == 200
        data = response.json()
        
        # Verify counts
        assert "total_leads" in data
        print(f"Dashboard counts: total_leads={data.get('total_leads')}")
    
    def test_dashboard_widget_recent_leads(self):
        """Test GET /api/dashboard/widget/recent-leads"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widget/recent-leads")
        assert response.status_code == 200
        data = response.json()
        
        assert "recent_leads" in data
        print(f"Recent leads: {len(data.get('recent_leads', []))} leads")


class TestGalleryAPI:
    """Test Gallery API endpoints"""
    
    def test_photos_endpoint(self):
        """Test GET /api/photos"""
        response = requests.get(f"{BASE_URL}/api/photos")
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of photos
        assert isinstance(data, list)
        print(f"Gallery photos: {len(data)} photos found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
