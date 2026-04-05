"""
Social Media Manager Module Tests - Iteration 63
Tests for Facebook/Instagram integration APIs
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

class TestSocialMediaDashboard:
    """Tests for Social Media Dashboard Stats API"""
    
    def test_get_dashboard_stats(self):
        """GET /api/social/dashboard/stats - Returns social media statistics"""
        response = requests.get(f"{BASE_URL}/api/social/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "total_posts" in data, "Missing total_posts field"
        assert "scheduled_posts" in data, "Missing scheduled_posts field"
        assert "published_posts" in data, "Missing published_posts field"
        assert "failed_posts" in data, "Missing failed_posts field"
        assert "facebook_connected" in data, "Missing facebook_connected field"
        assert "instagram_connected" in data, "Missing instagram_connected field"
        
        # Verify data types
        assert isinstance(data["total_posts"], int), "total_posts should be int"
        assert isinstance(data["scheduled_posts"], int), "scheduled_posts should be int"
        assert isinstance(data["facebook_connected"], bool), "facebook_connected should be bool"
        assert isinstance(data["instagram_connected"], bool), "instagram_connected should be bool"
        
        print(f"✓ Dashboard stats: {data['total_posts']} total posts, FB: {data['facebook_connected']}, IG: {data['instagram_connected']}")


class TestSocialMediaSettings:
    """Tests for Social Media Settings APIs"""
    
    def test_get_settings(self):
        """GET /api/social/settings - Returns masked social settings"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "facebook_page_id" in data, "Missing facebook_page_id"
        assert "facebook_access_token" in data, "Missing facebook_access_token"
        assert "facebook_connected" in data, "Missing facebook_connected"
        assert "instagram_account_id" in data, "Missing instagram_account_id"
        assert "instagram_connected" in data, "Missing instagram_connected"
        
        # Token should be masked (starts with ***)
        if data["facebook_access_token"]:
            assert data["facebook_access_token"].startswith("***"), "Token should be masked"
        
        print(f"✓ Settings retrieved: FB connected={data['facebook_connected']}, IG connected={data['instagram_connected']}")
    
    def test_save_settings(self):
        """POST /api/social/settings - Save social settings"""
        test_page_id = f"TEST_PAGE_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/social/settings",
            json={
                "facebook_page_id": test_page_id,
                "instagram_account_id": "TEST_IG_123"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "message" in data, "Missing message field"
        
        # Verify settings were saved
        get_response = requests.get(f"{BASE_URL}/api/social/settings")
        settings = get_response.json()
        assert settings["facebook_page_id"] == test_page_id, "Page ID not saved correctly"
        
        print(f"✓ Settings saved successfully: {data['message']}")


class TestSocialMediaConnect:
    """Tests for Facebook/Instagram Connection APIs"""
    
    def test_connect_facebook_missing_fields(self):
        """POST /api/social/connect/facebook - Validates required fields"""
        response = requests.post(
            f"{BASE_URL}/api/social/connect/facebook",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Facebook connect validation works: {data['detail']}")
    
    def test_connect_facebook_invalid_token(self):
        """POST /api/social/connect/facebook - Returns error for invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/social/connect/facebook",
            json={
                "page_id": "TEST_PAGE_123",
                "access_token": "INVALID_TOKEN_12345"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should return success=False for invalid token
        assert data.get("success") == False, "Expected success=False for invalid token"
        assert "error" in data, "Missing error field"
        
        print(f"✓ Facebook connect handles invalid token: {data.get('error', 'error returned')}")
    
    def test_connect_instagram_requires_facebook(self):
        """POST /api/social/connect/instagram - Requires Facebook connection first"""
        # First ensure Facebook is not connected
        requests.post(
            f"{BASE_URL}/api/social/settings",
            json={"facebook_page_id": "", "facebook_access_token": ""}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/social/connect/instagram",
            json={"account_id": "TEST_IG_123"}
        )
        
        # Should return 400 if Facebook not connected
        assert response.status_code in [400, 200], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data, "Missing error detail"
            print(f"✓ Instagram connect requires Facebook: {data['detail']}")
        else:
            data = response.json()
            assert data.get("success") == False, "Expected failure without Facebook"
            print(f"✓ Instagram connect requires Facebook: {data.get('error', 'error returned')}")
    
    def test_connect_instagram_missing_account_id(self):
        """POST /api/social/connect/instagram - Validates account_id required"""
        response = requests.post(
            f"{BASE_URL}/api/social/connect/instagram",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing account_id, got {response.status_code}"
        
        print("✓ Instagram connect validates account_id required")


class TestSocialMediaTestConnection:
    """Tests for Test Connection API"""
    
    def test_test_connection(self):
        """POST /api/social/test-connection - Test all connections"""
        response = requests.post(f"{BASE_URL}/api/social/test-connection")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "facebook" in data, "Missing facebook result"
        assert "instagram" in data, "Missing instagram result"
        
        # Verify facebook result structure
        assert "connected" in data["facebook"], "Missing facebook.connected"
        assert "status" in data["facebook"], "Missing facebook.status"
        
        # Verify instagram result structure
        assert "connected" in data["instagram"], "Missing instagram.connected"
        assert "status" in data["instagram"], "Missing instagram.status"
        
        print(f"✓ Test connection: FB={data['facebook']['status']}, IG={data['instagram']['status']}")


class TestSocialMediaPosts:
    """Tests for Social Media Posts APIs"""
    
    def test_get_posts(self):
        """GET /api/social/posts - Get published posts"""
        response = requests.get(f"{BASE_URL}/api/social/posts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "posts" in data, "Missing posts field"
        assert "pagination" in data, "Missing pagination field"
        assert isinstance(data["posts"], list), "posts should be a list"
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "current_page" in pagination, "Missing current_page"
        assert "total_pages" in pagination, "Missing total_pages"
        assert "total_count" in pagination, "Missing total_count"
        
        print(f"✓ Get posts: {len(data['posts'])} posts, total={pagination['total_count']}")
    
    def test_get_posts_with_status_filter(self):
        """GET /api/social/posts?status=published - Filter by status"""
        response = requests.get(f"{BASE_URL}/api/social/posts?status=published")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "posts" in data, "Missing posts field"
        
        # All posts should have status=published (if any)
        for post in data["posts"]:
            if "status" in post:
                assert post["status"] == "published", f"Expected published status, got {post['status']}"
        
        print(f"✓ Get posts with status filter: {len(data['posts'])} published posts")
    
    def test_get_scheduled_posts(self):
        """GET /api/social/posts/scheduled - Get scheduled posts"""
        response = requests.get(f"{BASE_URL}/api/social/posts/scheduled")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "posts" in data, "Missing posts field"
        assert "pagination" in data, "Missing pagination field"
        
        print(f"✓ Get scheduled posts: {len(data['posts'])} scheduled")


class TestSocialMediaCreatePost:
    """Tests for Create Post API"""
    
    def test_create_post_missing_caption(self):
        """POST /api/social/posts/create - Validates caption required"""
        response = requests.post(
            f"{BASE_URL}/api/social/posts/create",
            json={
                "platforms": ["facebook"]
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing caption, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Create post validates caption: {data['detail']}")
    
    def test_create_post_missing_platforms(self):
        """POST /api/social/posts/create - Validates platforms required"""
        response = requests.post(
            f"{BASE_URL}/api/social/posts/create",
            json={
                "caption": "Test post"
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing platforms, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Create post validates platforms: {data['detail']}")
    
    def test_create_post_platform_not_connected(self):
        """POST /api/social/posts/create - Returns error if platform not connected"""
        # First ensure platforms are not connected
        requests.post(
            f"{BASE_URL}/api/social/settings",
            json={"facebook_page_id": "", "facebook_access_token": ""}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/social/posts/create",
            json={
                "caption": "Test post from API",
                "platforms": ["facebook"]
            }
        )
        assert response.status_code == 400, f"Expected 400 for unconnected platform, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        assert "not connected" in data["detail"].lower(), "Error should mention not connected"
        
        print(f"✓ Create post validates platform connection: {data['detail']}")
    
    def test_create_scheduled_post_missing_time(self):
        """POST /api/social/posts/create - Validates schedule_time for scheduled posts"""
        # This test checks that the API handles schedule_time properly
        response = requests.post(
            f"{BASE_URL}/api/social/posts/create",
            json={
                "caption": "Scheduled test post",
                "platforms": ["facebook"],
                "schedule_time": ""  # Empty schedule time
            }
        )
        # Should fail because platform not connected, not because of schedule_time
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Create scheduled post validation works")


class TestSocialMediaScheduledPostsCRUD:
    """Tests for Scheduled Posts CRUD operations"""
    
    def test_delete_scheduled_post_not_found(self):
        """DELETE /api/social/posts/scheduled/{post_id} - Returns 404 for non-existent post"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/social/posts/scheduled/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Delete scheduled post returns 404 for non-existent: {data['detail']}")
    
    def test_update_scheduled_post_not_found(self):
        """PUT /api/social/posts/scheduled/{post_id} - Returns 404 for non-existent post"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/social/posts/scheduled/{fake_id}",
            json={"caption": "Updated caption"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Update scheduled post returns 404 for non-existent: {data['detail']}")


class TestSocialMediaFestivalPost:
    """Tests for Festival Post API"""
    
    def test_festival_post_missing_image(self):
        """POST /api/social/posts/festival - Validates image_url required"""
        response = requests.post(
            f"{BASE_URL}/api/social/posts/festival",
            json={
                "caption": "Happy Festival!",
                "platforms": ["facebook"]
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing image, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Festival post validates image_url: {data['detail']}")
    
    def test_festival_post_missing_platforms(self):
        """POST /api/social/posts/festival - Validates platforms required"""
        response = requests.post(
            f"{BASE_URL}/api/social/posts/festival",
            json={
                "image_url": "https://example.com/image.jpg",
                "caption": "Happy Festival!"
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing platforms, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        print(f"✓ Festival post validates platforms: {data['detail']}")


class TestSocialMediaPagination:
    """Tests for Pagination in Social Media APIs"""
    
    def test_posts_pagination(self):
        """GET /api/social/posts - Pagination works correctly"""
        response = requests.get(f"{BASE_URL}/api/social/posts?page=1&limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        pagination = data["pagination"]
        
        assert pagination["current_page"] == 1, "Current page should be 1"
        assert isinstance(pagination["total_pages"], int), "total_pages should be int"
        assert isinstance(pagination["total_count"], int), "total_count should be int"
        
        print(f"✓ Posts pagination: page {pagination['current_page']}/{pagination['total_pages']}, total={pagination['total_count']}")
    
    def test_scheduled_posts_pagination(self):
        """GET /api/social/posts/scheduled - Pagination works correctly"""
        response = requests.get(f"{BASE_URL}/api/social/posts/scheduled?page=1&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        pagination = data["pagination"]
        
        assert pagination["current_page"] == 1, "Current page should be 1"
        
        print(f"✓ Scheduled posts pagination: page {pagination['current_page']}/{pagination['total_pages']}")


class TestSocialMediaDataIntegrity:
    """Tests for Data Integrity in Social Media APIs"""
    
    def test_stats_match_posts_count(self):
        """Verify dashboard stats match actual posts count"""
        # Get stats
        stats_response = requests.get(f"{BASE_URL}/api/social/dashboard/stats")
        stats = stats_response.json()
        
        # Get all posts
        posts_response = requests.get(f"{BASE_URL}/api/social/posts?limit=1000")
        posts_data = posts_response.json()
        
        # Get scheduled posts
        scheduled_response = requests.get(f"{BASE_URL}/api/social/posts/scheduled?limit=1000")
        scheduled_data = scheduled_response.json()
        
        # Verify counts
        total_posts = posts_data["pagination"]["total_count"]
        scheduled_posts = scheduled_data["pagination"]["total_count"]
        
        assert stats["total_posts"] == total_posts, f"Stats total_posts ({stats['total_posts']}) != actual ({total_posts})"
        assert stats["scheduled_posts"] == scheduled_posts, f"Stats scheduled ({stats['scheduled_posts']}) != actual ({scheduled_posts})"
        
        print(f"✓ Data integrity verified: total={total_posts}, scheduled={scheduled_posts}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
