"""
Test WhatsApp Inbox Features - Iteration 66
Tests:
1. WhatsApp Inbox - 48-hour auto-cleanup
2. API: GET /api/whatsapp/messages/cleanup-status
3. API: DELETE /api/whatsapp/messages/auto-cleanup-48h
4. API: GET /api/whatsapp/settings - Returns phone_number_id
5. API: GET /api/social/settings - Returns facebook_page_id and instagram_account_id
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestWhatsAppCleanupAPIs:
    """Test WhatsApp message cleanup and settings APIs"""
    
    def test_whatsapp_cleanup_status(self):
        """Test GET /api/whatsapp/messages/cleanup-status returns message counts by age"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/messages/cleanup-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "message_counts" in data, "Response should contain message_counts"
        assert "auto_delete_enabled" in data, "Response should contain auto_delete_enabled"
        assert "auto_delete_threshold_hours" in data, "Response should contain auto_delete_threshold_hours"
        
        # Verify message_counts structure
        counts = data["message_counts"]
        assert "within_24h" in counts, "message_counts should have within_24h"
        assert "24h_to_48h" in counts, "message_counts should have 24h_to_48h"
        assert "older_than_48h" in counts, "message_counts should have older_than_48h"
        assert "total" in counts, "message_counts should have total"
        
        # Verify auto_delete settings
        assert data["auto_delete_enabled"] == True, "auto_delete_enabled should be True"
        assert data["auto_delete_threshold_hours"] == 48, "auto_delete_threshold_hours should be 48"
        
        print(f"PASS: Cleanup status API returns correct structure")
        print(f"  - Messages within 24h: {counts['within_24h']}")
        print(f"  - Messages 24h-48h: {counts['24h_to_48h']}")
        print(f"  - Messages older than 48h: {counts['older_than_48h']}")
        print(f"  - Total messages: {counts['total']}")
    
    def test_whatsapp_auto_cleanup_48h_endpoint(self):
        """Test DELETE /api/whatsapp/messages/auto-cleanup-48h endpoint exists and works"""
        response = requests.delete(f"{BASE_URL}/api/whatsapp/messages/auto-cleanup-48h")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "success" in data, "Response should contain success"
        assert "deleted_count" in data, "Response should contain deleted_count"
        assert "message" in data, "Response should contain message"
        assert "cutoff_time" in data, "Response should contain cutoff_time"
        
        assert data["success"] == True, "success should be True"
        assert isinstance(data["deleted_count"], int), "deleted_count should be an integer"
        
        print(f"PASS: Auto-cleanup 48h endpoint works")
        print(f"  - Deleted count: {data['deleted_count']}")
        print(f"  - Cutoff time: {data['cutoff_time']}")
    
    def test_whatsapp_settings_returns_phone_number_id(self):
        """Test GET /api/whatsapp/settings returns phone_number_id=1042033085660106"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "phone_number_id" in data, "Response should contain phone_number_id"
        
        # Verify expected phone_number_id
        expected_phone_id = "1042033085660106"
        actual_phone_id = data.get("phone_number_id", "")
        
        assert actual_phone_id == expected_phone_id, f"Expected phone_number_id={expected_phone_id}, got {actual_phone_id}"
        
        print(f"PASS: WhatsApp settings returns correct phone_number_id")
        print(f"  - phone_number_id: {actual_phone_id}")
    
    def test_social_settings_returns_facebook_instagram_ids(self):
        """Test GET /api/social/settings returns facebook_page_id and instagram_account_id"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "facebook_page_id" in data, "Response should contain facebook_page_id"
        assert "instagram_account_id" in data, "Response should contain instagram_account_id"
        
        # Verify expected IDs
        expected_fb_id = "963923893475549"
        expected_ig_id = "17841466839933393"
        
        actual_fb_id = data.get("facebook_page_id", "")
        actual_ig_id = data.get("instagram_account_id", "")
        
        assert actual_fb_id == expected_fb_id, f"Expected facebook_page_id={expected_fb_id}, got {actual_fb_id}"
        assert actual_ig_id == expected_ig_id, f"Expected instagram_account_id={expected_ig_id}, got {actual_ig_id}"
        
        print(f"PASS: Social settings returns correct Facebook/Instagram IDs")
        print(f"  - facebook_page_id: {actual_fb_id}")
        print(f"  - instagram_account_id: {actual_ig_id}")


class TestWhatsAppConversationsAPI:
    """Test WhatsApp conversations API with auto-cleanup"""
    
    def test_conversations_endpoint_works(self):
        """Test GET /api/whatsapp/conversations returns conversations list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "conversations" in data, "Response should contain conversations"
        assert "pagination" in data, "Response should contain pagination"
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "current_page" in pagination, "pagination should have current_page"
        assert "total_pages" in pagination, "pagination should have total_pages"
        assert "total_count" in pagination, "pagination should have total_count"
        
        print(f"PASS: Conversations endpoint works")
        print(f"  - Total conversations: {pagination['total_count']}")
        print(f"  - Conversations returned: {len(data['conversations'])}")
    
    def test_conversations_unread_count(self):
        """Test GET /api/whatsapp/conversations/unread-count"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "unread_count" in data, "Response should contain unread_count"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        
        print(f"PASS: Unread count endpoint works")
        print(f"  - Unread count: {data['unread_count']}")


class TestWhatsAppTemplates:
    """Test WhatsApp templates API"""
    
    def test_templates_endpoint(self):
        """Test GET /api/whatsapp/templates returns templates list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should return a list of templates
        assert isinstance(data, list), "Response should be a list of templates"
        
        if len(data) > 0:
            template = data[0]
            assert "template_name" in template, "Template should have template_name"
            assert "display_name" in template, "Template should have display_name"
        
        print(f"PASS: Templates endpoint works")
        print(f"  - Templates count: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
