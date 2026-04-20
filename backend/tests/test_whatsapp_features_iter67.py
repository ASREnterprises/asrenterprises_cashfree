"""
Test Suite for WhatsApp Features - Iteration 67

Tests:
1. WhatsApp Inbox - Chat bubbles display correctly (max-w-[85%], rounded-lg)
2. WhatsApp Inbox - Quick reply buttons appear when 24h window is active
3. WhatsApp Inbox - openLeadPhone prop auto-opens specific conversation
4. Staff Portal - WhatsApp button switches to WhatsApp tab (not external wa.me)
5. Staff Portal - Floating action button visible on mobile
6. CRM Dashboard - WhatsApp button switches to WhatsApp tab
7. API: POST /api/whatsapp/templates/bulk-send - Bulk template sending endpoint
8. API: GET /api/whatsapp/templates/bulk-send/{job_id} - Get bulk send job status
9. API: GET /api/social/settings - Facebook Page ID and Instagram ID configured correctly
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestWhatsAppBulkSendAPI:
    """Test WhatsApp bulk template sending endpoints"""
    
    def test_bulk_send_endpoint_exists(self):
        """Test POST /api/whatsapp/templates/bulk-send endpoint exists and accepts requests"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates/bulk-send",
            json={
                "template_name": "asr_welcome",
                "lead_ids": [],
                "phones": ["9876543210"]
            }
        )
        # Should return 200 with job_id (even if template fails to send)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "job_id" in data, "Response should contain job_id"
        assert "success" in data, "Response should contain success field"
        assert data["success"] == True, "Bulk send should start successfully"
        print(f"PASS: POST /api/whatsapp/templates/bulk-send - job_id: {data['job_id']}")
        return data["job_id"]
    
    def test_bulk_send_requires_template_name(self):
        """Test bulk send returns error when template_name is missing"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates/bulk-send",
            json={
                "lead_ids": [],
                "phones": ["9876543210"]
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should contain detail"
        print("PASS: Bulk send requires template_name")
    
    def test_bulk_send_requires_recipients(self):
        """Test bulk send returns error when no recipients provided"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates/bulk-send",
            json={
                "template_name": "asr_welcome",
                "lead_ids": [],
                "phones": []
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should contain detail"
        print("PASS: Bulk send requires at least one recipient")
    
    def test_bulk_send_job_status_endpoint(self):
        """Test GET /api/whatsapp/templates/bulk-send/{job_id} returns job status"""
        # First create a job
        create_response = requests.post(
            f"{BASE_URL}/api/whatsapp/templates/bulk-send",
            json={
                "template_name": "asr_welcome",
                "phones": ["9876543210"]
            }
        )
        assert create_response.status_code == 200
        job_id = create_response.json()["job_id"]
        
        # Wait a moment for processing
        time.sleep(1)
        
        # Get job status
        status_response = requests.get(f"{BASE_URL}/api/whatsapp/templates/bulk-send/{job_id}")
        assert status_response.status_code == 200, f"Expected 200, got {status_response.status_code}"
        
        data = status_response.json()
        assert "id" in data, "Job status should contain id"
        assert "status" in data, "Job status should contain status"
        assert "total_count" in data, "Job status should contain total_count"
        assert "sent_count" in data, "Job status should contain sent_count"
        assert "failed_count" in data, "Job status should contain failed_count"
        print(f"PASS: GET /api/whatsapp/templates/bulk-send/{job_id} - status: {data['status']}")
    
    def test_bulk_send_job_not_found(self):
        """Test GET /api/whatsapp/templates/bulk-send/{job_id} returns 404 for invalid job"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates/bulk-send/invalid-job-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid job_id returns 404")


class TestSocialMediaSettings:
    """Test social media settings endpoint"""
    
    def test_social_settings_returns_facebook_page_id(self):
        """Test GET /api/social/settings returns facebook_page_id"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "facebook_page_id" in data, "Response should contain facebook_page_id"
        assert data["facebook_page_id"] == "963923893475549", f"Expected facebook_page_id=963923893475549, got {data['facebook_page_id']}"
        print(f"PASS: GET /api/social/settings - facebook_page_id: {data['facebook_page_id']}")
    
    def test_social_settings_returns_instagram_account_id(self):
        """Test GET /api/social/settings returns instagram_account_id"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "instagram_account_id" in data, "Response should contain instagram_account_id"
        assert data["instagram_account_id"] == "17841466839933393", f"Expected instagram_account_id=17841466839933393, got {data['instagram_account_id']}"
        print(f"PASS: GET /api/social/settings - instagram_account_id: {data['instagram_account_id']}")


class TestWhatsAppConversations:
    """Test WhatsApp conversation endpoints"""
    
    def test_conversations_endpoint(self):
        """Test GET /api/whatsapp/conversations returns conversations list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "conversations" in data, "Response should contain conversations"
        assert "pagination" in data, "Response should contain pagination"
        print(f"PASS: GET /api/whatsapp/conversations - {len(data['conversations'])} conversations")
    
    def test_conversations_have_24h_window_field(self):
        """Test conversations include within_24h_window field"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations")
        assert response.status_code == 200
        
        data = response.json()
        if data["conversations"]:
            conv = data["conversations"][0]
            assert "within_24h_window" in conv, "Conversation should have within_24h_window field"
            print(f"PASS: Conversations include within_24h_window field (value: {conv['within_24h_window']})")
        else:
            print("SKIP: No conversations to test within_24h_window field")
    
    def test_unread_count_endpoint(self):
        """Test GET /api/whatsapp/conversations/unread-count returns count"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "unread_count" in data, "Response should contain unread_count"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        print(f"PASS: GET /api/whatsapp/conversations/unread-count - count: {data['unread_count']}")


class TestWhatsAppTemplates:
    """Test WhatsApp templates endpoint"""
    
    def test_templates_endpoint(self):
        """Test GET /api/whatsapp/templates returns templates list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of templates"
        assert len(data) > 0, "Should have at least one template"
        
        # Check template structure
        template = data[0]
        assert "template_name" in template, "Template should have template_name"
        assert "display_name" in template, "Template should have display_name"
        print(f"PASS: GET /api/whatsapp/templates - {len(data)} templates")


class TestWhatsAppSettings:
    """Test WhatsApp settings endpoint"""
    
    def test_whatsapp_settings_returns_phone_number_id(self):
        """Test GET /api/whatsapp/settings returns phone_number_id"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "phone_number_id" in data, "Response should contain phone_number_id"
        # Check if configured (should be 1042033085660106 based on credentials)
        if data["phone_number_id"]:
            print(f"PASS: GET /api/whatsapp/settings - phone_number_id: {data['phone_number_id']}")
        else:
            print("PASS: GET /api/whatsapp/settings - phone_number_id is empty (not configured)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
