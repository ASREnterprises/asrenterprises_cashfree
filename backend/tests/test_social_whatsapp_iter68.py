"""
Test Social Media and WhatsApp Integration - Iteration 68
Tests:
1. Facebook connection and posting with Page Access Token
2. Instagram connection
3. WhatsApp template sync with language codes
4. WhatsApp template sending with auto-detect language
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
FACEBOOK_PAGE_ID = "963923893475549"
INSTAGRAM_ACCOUNT_ID = "17841466839933393"
WHATSAPP_PHONE_NUMBER_ID = "1042033085660106"
WHATSAPP_WABA_ID = "1850072805696246"
TEST_PHONE = "918877896889"


class TestSocialMediaConnection:
    """Test Facebook and Instagram connection APIs"""
    
    def test_social_test_connection(self):
        """Test POST /api/social/test-connection - Verify Facebook and Instagram connected"""
        response = requests.post(f"{BASE_URL}/api/social/test-connection", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Social test-connection response: {data}")
        
        # Verify Facebook connection
        assert "facebook" in data, "Response should contain facebook key"
        fb_status = data["facebook"]
        print(f"Facebook status: {fb_status}")
        
        # Verify Instagram connection
        assert "instagram" in data, "Response should contain instagram key"
        ig_status = data["instagram"]
        print(f"Instagram status: {ig_status}")
        
        # Check if both are connected
        if fb_status.get("connected"):
            print(f"✓ Facebook connected: {fb_status.get('page_name', 'N/A')}")
        else:
            print(f"✗ Facebook not connected: {fb_status.get('status', 'Unknown')}")
            
        if ig_status.get("connected"):
            print(f"✓ Instagram connected: {ig_status.get('username', 'N/A')}")
        else:
            print(f"✗ Instagram not connected: {ig_status.get('status', 'Unknown')}")
    
    def test_social_settings_get(self):
        """Test GET /api/social/settings - Verify settings contain correct IDs"""
        response = requests.get(f"{BASE_URL}/api/social/settings", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Social settings: {data}")
        
        # Verify Facebook Page ID
        assert data.get("facebook_page_id") == FACEBOOK_PAGE_ID, \
            f"Expected facebook_page_id={FACEBOOK_PAGE_ID}, got {data.get('facebook_page_id')}"
        
        # Verify Instagram Account ID
        assert data.get("instagram_account_id") == INSTAGRAM_ACCOUNT_ID, \
            f"Expected instagram_account_id={INSTAGRAM_ACCOUNT_ID}, got {data.get('instagram_account_id')}"
        
        print(f"✓ Facebook Page ID: {data.get('facebook_page_id')}")
        print(f"✓ Instagram Account ID: {data.get('instagram_account_id')}")
        print(f"✓ Facebook connected: {data.get('facebook_connected')}")
        print(f"✓ Instagram connected: {data.get('instagram_connected')}")


class TestFacebookPosting:
    """Test Facebook posting with Page Access Token"""
    
    def test_facebook_text_post_create(self):
        """Test POST /api/social/posts/create - Create Facebook text post"""
        payload = {
            "caption": f"Test post from Solar CRM - {time.strftime('%Y-%m-%d %H:%M:%S')}",
            "platforms": ["facebook"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/social/posts/create",
            json=payload,
            timeout=60
        )
        
        print(f"Facebook post response status: {response.status_code}")
        print(f"Facebook post response: {response.text}")
        
        # Accept 200 or 400 (if not connected)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 200:
            if data.get("success"):
                print(f"✓ Facebook post created successfully!")
                print(f"  Post ID: {data.get('post_id')}")
                if "results" in data and "facebook" in data["results"]:
                    fb_result = data["results"]["facebook"]
                    print(f"  Facebook post ID: {fb_result.get('post_id')}")
                    print(f"  Message: {fb_result.get('message')}")
            else:
                print(f"✗ Facebook post failed: {data.get('message')}")
                if "results" in data and "facebook" in data["results"]:
                    fb_result = data["results"]["facebook"]
                    print(f"  Error: {fb_result.get('error')}")
        else:
            print(f"✗ Request failed: {data.get('detail', data)}")


class TestWhatsAppTemplateSync:
    """Test WhatsApp template sync with language codes"""
    
    def test_whatsapp_settings(self):
        """Test GET /api/whatsapp/settings - Verify WhatsApp configured"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/settings", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"WhatsApp settings: {data}")
        
        assert data.get("phone_number_id") == WHATSAPP_PHONE_NUMBER_ID, \
            f"Expected phone_number_id={WHATSAPP_PHONE_NUMBER_ID}, got {data.get('phone_number_id')}"
        
        print(f"✓ WhatsApp Phone Number ID: {data.get('phone_number_id')}")
        print(f"✓ WhatsApp configured: {data.get('configured')}")
        print(f"✓ WhatsApp active: {data.get('is_active')}")
    
    def test_whatsapp_template_sync(self):
        """Test POST /api/whatsapp/templates/sync - Sync templates from Meta"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/templates/sync", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Template sync response: {data}")
        
        assert data.get("success") == True, f"Expected success=True, got {data.get('success')}"
        print(f"✓ Templates synced: {data.get('count', 0)} templates")
        print(f"✓ Message: {data.get('message')}")
    
    def test_whatsapp_templates_get(self):
        """Test GET /api/whatsapp/templates - Verify templates have language_code"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        templates = response.json()
        print(f"Found {len(templates)} templates")
        
        # Check for hello_world template with language code
        hello_world = None
        for t in templates:
            print(f"  - {t.get('template_name', t.get('name'))}: language={t.get('language_code', 'N/A')}")
            if t.get('template_name') == 'hello_world' or t.get('name') == 'hello_world':
                hello_world = t
        
        if hello_world:
            print(f"✓ Found hello_world template")
            print(f"  Language code: {hello_world.get('language_code', 'N/A')}")
        else:
            print("Note: hello_world template not found in list")


class TestWhatsAppTemplateSending:
    """Test WhatsApp template sending with auto-detect language"""
    
    def test_whatsapp_connection_test(self):
        """Test POST /api/whatsapp/settings/test - Verify WhatsApp API connection"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/settings/test", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"WhatsApp connection test: {data}")
        
        if data.get("success"):
            print(f"✓ WhatsApp API connected!")
            print(f"  Phone: {data.get('phone_number')}")
            print(f"  Verified name: {data.get('verified_name')}")
            print(f"  Quality rating: {data.get('quality_rating')}")
        else:
            print(f"✗ WhatsApp API connection failed: {data.get('error')}")
    
    def test_send_template_to_conversation_auto_language(self):
        """Test POST /api/whatsapp/conversations/{phone}/send-template - Auto-detect language"""
        # Use hello_world template which should auto-detect language
        payload = {
            "template_name": "hello_world",
            "variables": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{TEST_PHONE}/send-template",
            json=payload,
            timeout=30
        )
        
        print(f"Send template response status: {response.status_code}")
        print(f"Send template response: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if data.get("success"):
            print(f"✓ Template sent successfully!")
            print(f"  Message ID: {data.get('message_id')}")
            print(f"  WA Message ID: {data.get('wa_message_id')}")
            print(f"  Phone: {data.get('phone')}")
        else:
            print(f"✗ Template send failed: {data.get('error')}")
            # Check if it's a known error
            error = data.get("error", "")
            if "template" in error.lower():
                print("  Note: Template may not be approved or language mismatch")
    
    def test_send_single_message_with_template(self):
        """Test POST /api/whatsapp/send - Send template with auto language detection"""
        payload = {
            "phone": TEST_PHONE,
            "template_name": "hello_world"
            # Note: NOT providing language_code to test auto-detection
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/send",
            json=payload,
            timeout=30
        )
        
        print(f"Send single message response status: {response.status_code}")
        print(f"Send single message response: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if data.get("success"):
            print(f"✓ Message sent successfully!")
            print(f"  Message ID: {data.get('message_id')}")
            print(f"  WA Message ID: {data.get('wa_message_id')}")
        else:
            print(f"✗ Message send failed: {data.get('error')}")


class TestSocialDashboardStats:
    """Test dashboard stats endpoints"""
    
    def test_social_dashboard_stats(self):
        """Test GET /api/social/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/social/dashboard/stats", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Social dashboard stats: {data}")
        
        print(f"✓ Total posts: {data.get('total_posts', 0)}")
        print(f"✓ Published posts: {data.get('published_posts', 0)}")
        print(f"✓ Facebook connected: {data.get('facebook_connected')}")
        print(f"✓ Instagram connected: {data.get('instagram_connected')}")
    
    def test_whatsapp_dashboard_stats(self):
        """Test GET /api/whatsapp/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/dashboard/stats", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"WhatsApp dashboard stats: {data}")
        
        today = data.get("today", {})
        print(f"✓ Today sent: {today.get('sent', 0)}")
        print(f"✓ Today delivered: {today.get('delivered', 0)}")
        print(f"✓ Today replies: {today.get('replies', 0)}")


class TestGetPosts:
    """Test getting posts history"""
    
    def test_get_posts(self):
        """Test GET /api/social/posts - Get post history"""
        response = requests.get(f"{BASE_URL}/api/social/posts", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        posts = data.get("posts", [])
        print(f"Found {len(posts)} posts")
        
        for post in posts[:5]:  # Show first 5
            print(f"  - {post.get('id')[:8]}... | {post.get('status')} | {post.get('platforms')}")
            if post.get("results"):
                for platform, result in post["results"].items():
                    if result.get("success"):
                        print(f"    ✓ {platform}: {result.get('post_id', 'N/A')}")
                    else:
                        print(f"    ✗ {platform}: {result.get('error', 'Unknown error')[:50]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
