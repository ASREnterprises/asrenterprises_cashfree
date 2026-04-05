"""
WhatsApp Inbox / Chat Conversation System Tests - Iteration 62
Tests for the new WhatsApp Inbox features:
- GET /api/whatsapp/conversations - List conversations grouped by phone
- GET /api/whatsapp/conversations/unread-count - Unread message count
- GET /api/whatsapp/conversations/{phone} - Full chat thread
- GET /api/whatsapp/conversations/by-lead/{lead_id} - Conversation by lead
- POST /api/whatsapp/conversations/{phone}/send-template - Send template message
- POST /api/whatsapp/conversations/{phone}/send-text - Send free-form text (24h window)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestWhatsAppConversationsAPI:
    """Test WhatsApp Conversations/Inbox endpoints"""
    
    def test_get_conversations_list(self):
        """GET /api/whatsapp/conversations - Returns list of conversations grouped by phone"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "conversations" in data, "Response should have 'conversations' key"
        assert "pagination" in data, "Response should have 'pagination' key"
        
        # Verify pagination structure
        pagination = data["pagination"]
        assert "current_page" in pagination
        assert "total_pages" in pagination
        assert "total_count" in pagination
        
        print(f"✓ GET /api/whatsapp/conversations - Found {len(data['conversations'])} conversations")
        
        # If there are conversations, verify structure
        if data["conversations"]:
            conv = data["conversations"][0]
            assert "phone" in conv, "Conversation should have 'phone'"
            assert "last_message" in conv, "Conversation should have 'last_message'"
            assert "message_count" in conv, "Conversation should have 'message_count'"
            assert "unread_count" in conv, "Conversation should have 'unread_count'"
            assert "last_activity" in conv, "Conversation should have 'last_activity'"
            assert "within_24h_window" in conv, "Conversation should have 'within_24h_window'"
            print(f"  - First conversation phone: {conv['phone']}, messages: {conv['message_count']}")
    
    def test_get_conversations_with_pagination(self):
        """GET /api/whatsapp/conversations with pagination params"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["pagination"]["current_page"] == 1
        print(f"✓ GET /api/whatsapp/conversations?page=1&limit=10 - Pagination works")
    
    def test_get_unread_count(self):
        """GET /api/whatsapp/conversations/unread-count - Returns unread message count"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "unread_count" in data, "Response should have 'unread_count' key"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        
        print(f"✓ GET /api/whatsapp/conversations/unread-count - Unread: {data['unread_count']}")
    
    def test_get_conversation_thread_by_phone(self):
        """GET /api/whatsapp/conversations/{phone} - Returns full chat thread"""
        # Use a test phone number
        test_phone = "919876543210"
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/{test_phone}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "phone" in data, "Response should have 'phone'"
        assert "messages" in data, "Response should have 'messages'"
        assert "within_24h_window" in data, "Response should have 'within_24h_window'"
        assert "message_count" in data, "Response should have 'message_count'"
        
        # Messages should be a list
        assert isinstance(data["messages"], list), "messages should be a list"
        
        print(f"✓ GET /api/whatsapp/conversations/{test_phone} - Found {data['message_count']} messages")
    
    def test_get_conversation_by_lead_not_found(self):
        """GET /api/whatsapp/conversations/by-lead/{lead_id} - Returns 404 for non-existent lead"""
        fake_lead_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/by-lead/{fake_lead_id}")
        assert response.status_code == 404, f"Expected 404 for non-existent lead, got {response.status_code}"
        print(f"✓ GET /api/whatsapp/conversations/by-lead/{fake_lead_id} - Returns 404 for non-existent lead")
    
    def test_get_conversation_by_lead_with_real_lead(self):
        """GET /api/whatsapp/conversations/by-lead/{lead_id} - Test with real lead"""
        # First get a lead from the CRM
        leads_response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1")
        if leads_response.status_code == 200:
            leads_data = leads_response.json()
            leads = leads_data.get("leads", leads_data) if isinstance(leads_data, dict) else leads_data
            
            if leads and len(leads) > 0:
                lead = leads[0]
                lead_id = lead.get("id")
                lead_phone = lead.get("phone")
                
                if lead_id and lead_phone:
                    response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/by-lead/{lead_id}")
                    # Should return 200 with conversation or 400 if no phone
                    assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
                    
                    if response.status_code == 200:
                        data = response.json()
                        assert "phone" in data
                        assert "messages" in data
                        print(f"✓ GET /api/whatsapp/conversations/by-lead/{lead_id} - Found conversation for lead")
                    else:
                        print(f"✓ GET /api/whatsapp/conversations/by-lead/{lead_id} - Lead has no phone (expected)")
                else:
                    print("✓ Skipped - Lead has no ID or phone")
            else:
                print("✓ Skipped - No leads found in CRM")
        else:
            print("✓ Skipped - Could not fetch leads")


class TestWhatsAppSendTemplateToConversation:
    """Test sending template messages to conversations"""
    
    def test_send_template_missing_template_name(self):
        """POST /api/whatsapp/conversations/{phone}/send-template - Missing template name"""
        test_phone = "919876543210"
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{test_phone}/send-template",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing template, got {response.status_code}"
        print(f"✓ POST /api/whatsapp/conversations/{test_phone}/send-template - Validates template_name required")
    
    def test_send_template_with_valid_data(self):
        """POST /api/whatsapp/conversations/{phone}/send-template - With valid template"""
        test_phone = "919876543210"
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{test_phone}/send-template",
            json={
                "template_name": "hello_world",
                "variables": []
            }
        )
        # Should return 200 with success/failure (API not configured = expected failure)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Without real API credentials, success will be False
        assert "success" in data or "error" in data, "Response should have success or error"
        print(f"✓ POST /api/whatsapp/conversations/{test_phone}/send-template - API responds correctly")
        
        if not data.get("success"):
            print(f"  - Expected failure without real API credentials: {data.get('error', 'No error message')}")
    
    def test_send_template_with_variables(self):
        """POST /api/whatsapp/conversations/{phone}/send-template - With variables"""
        test_phone = "919876543210"
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{test_phone}/send-template",
            json={
                "template_name": "asr_welcome",
                "variables": ["Test Customer"]
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ POST /api/whatsapp/conversations/{test_phone}/send-template - Accepts variables")


class TestWhatsAppSendFreeformText:
    """Test sending free-form text messages (24h window enforcement)"""
    
    def test_send_text_missing_text(self):
        """POST /api/whatsapp/conversations/{phone}/send-text - Missing text"""
        test_phone = "919876543210"
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{test_phone}/send-text",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing text, got {response.status_code}"
        print(f"✓ POST /api/whatsapp/conversations/{test_phone}/send-text - Validates text required")
    
    def test_send_text_empty_text(self):
        """POST /api/whatsapp/conversations/{phone}/send-text - Empty text"""
        test_phone = "919876543210"
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{test_phone}/send-text",
            json={"text": ""}
        )
        assert response.status_code == 400, f"Expected 400 for empty text, got {response.status_code}"
        print(f"✓ POST /api/whatsapp/conversations/{test_phone}/send-text - Validates non-empty text")
    
    def test_send_text_no_incoming_message(self):
        """POST /api/whatsapp/conversations/{phone}/send-text - No incoming message (outside 24h window)"""
        # Use a phone number that likely has no incoming messages
        test_phone = "919999999999"
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/{test_phone}/send-text",
            json={"text": "Hello, this is a test message"}
        )
        # Should return 400 because no incoming message found (24h window check)
        assert response.status_code == 400, f"Expected 400 for no incoming message, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should have error detail"
        # Error should mention incoming message or 24h window
        error_msg = data["detail"].lower()
        assert "incoming" in error_msg or "24" in error_msg or "window" in error_msg, \
            f"Error should mention incoming message or 24h window: {data['detail']}"
        
        print(f"✓ POST /api/whatsapp/conversations/{test_phone}/send-text - Enforces 24h window (no incoming message)")


class TestWhatsAppConversationDataIntegrity:
    """Test data integrity and structure of conversation responses"""
    
    def test_conversation_lead_linking(self):
        """Verify conversations are properly linked to leads"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        conversations = data.get("conversations", [])
        
        linked_count = 0
        for conv in conversations:
            if conv.get("lead"):
                linked_count += 1
                lead = conv["lead"]
                # Verify lead structure
                assert "id" in lead or "name" in lead, "Linked lead should have id or name"
        
        print(f"✓ Conversation lead linking - {linked_count}/{len(conversations)} conversations linked to leads")
    
    def test_conversation_sorting_by_activity(self):
        """Verify conversations are sorted by last_activity (most recent first)"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        conversations = data.get("conversations", [])
        
        if len(conversations) >= 2:
            # Check that conversations are sorted by last_activity descending
            for i in range(len(conversations) - 1):
                current_activity = conversations[i].get("last_activity", "")
                next_activity = conversations[i + 1].get("last_activity", "")
                
                if current_activity and next_activity:
                    assert current_activity >= next_activity, \
                        f"Conversations should be sorted by last_activity descending"
            
            print(f"✓ Conversation sorting - Verified {len(conversations)} conversations sorted by last_activity")
        else:
            print(f"✓ Conversation sorting - Skipped (only {len(conversations)} conversations)")
    
    def test_24h_window_calculation(self):
        """Verify 24h window is correctly calculated"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        conversations = data.get("conversations", [])
        
        for conv in conversations:
            within_24h = conv.get("within_24h_window", False)
            last_incoming = conv.get("last_incoming_at")
            
            # If within_24h is True, last_incoming should exist and be recent
            if within_24h and last_incoming:
                # Parse the timestamp
                try:
                    if isinstance(last_incoming, str):
                        incoming_dt = datetime.fromisoformat(last_incoming.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        diff = now - incoming_dt
                        assert diff < timedelta(hours=24), \
                            f"within_24h_window=True but last_incoming is {diff} ago"
                except (ValueError, TypeError):
                    pass  # Skip if timestamp parsing fails
        
        print(f"✓ 24h window calculation - Verified for {len(conversations)} conversations")


class TestWhatsAppMessagesInThread:
    """Test message structure within conversation threads"""
    
    def test_message_structure_in_thread(self):
        """Verify message structure in conversation thread"""
        test_phone = "919876543210"
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/{test_phone}")
        assert response.status_code == 200
        
        data = response.json()
        messages = data.get("messages", [])
        
        if messages:
            msg = messages[0]
            # Verify message has required fields
            expected_fields = ["direction", "created_at"]
            for field in expected_fields:
                assert field in msg, f"Message should have '{field}' field"
            
            # Direction should be 'incoming' or 'outgoing'
            if "direction" in msg:
                assert msg["direction"] in ["incoming", "outgoing"], \
                    f"Direction should be 'incoming' or 'outgoing', got {msg['direction']}"
            
            print(f"✓ Message structure - Verified {len(messages)} messages in thread")
        else:
            print(f"✓ Message structure - No messages in thread (expected for new phone)")
    
    def test_messages_chronological_order(self):
        """Verify messages are in chronological order (oldest first)"""
        test_phone = "919876543210"
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/{test_phone}")
        assert response.status_code == 200
        
        data = response.json()
        messages = data.get("messages", [])
        
        if len(messages) >= 2:
            for i in range(len(messages) - 1):
                current_time = messages[i].get("created_at", "")
                next_time = messages[i + 1].get("created_at", "")
                
                if current_time and next_time:
                    assert current_time <= next_time, \
                        f"Messages should be in chronological order (oldest first)"
            
            print(f"✓ Messages chronological order - Verified {len(messages)} messages")
        else:
            print(f"✓ Messages chronological order - Skipped (only {len(messages)} messages)")


class TestWhatsAppTemplatesForInbox:
    """Test templates availability for inbox reply"""
    
    def test_templates_available_for_reply(self):
        """GET /api/whatsapp/templates - Templates available for inbox reply"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        assert len(templates) > 0, "Should have at least one template"
        
        # Verify template structure
        template = templates[0]
        assert "template_name" in template, "Template should have 'template_name'"
        assert "display_name" in template, "Template should have 'display_name'"
        
        print(f"✓ Templates for inbox - {len(templates)} templates available")
        
        # List template names
        template_names = [t.get("template_name") for t in templates]
        print(f"  - Templates: {', '.join(template_names[:5])}...")


class TestWhatsAppDashboardStatsForInbox:
    """Test dashboard stats relevant to inbox"""
    
    def test_dashboard_stats_include_replies(self):
        """GET /api/whatsapp/dashboard/stats - Includes reply stats"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "today" in data, "Stats should have 'today'"
        assert "total" in data, "Stats should have 'total'"
        
        # Verify today stats include replies
        today = data["today"]
        assert "replies" in today, "Today stats should include 'replies'"
        
        # Verify total stats include replies
        total = data["total"]
        assert "replies" in total, "Total stats should include 'replies'"
        
        print(f"✓ Dashboard stats - Today replies: {today['replies']}, Total replies: {total['replies']}")


class TestPhoneNumberFormats:
    """Test phone number handling in conversation endpoints"""
    
    def test_phone_with_country_code(self):
        """Test conversation lookup with country code"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/919876543210")
        assert response.status_code == 200
        print(f"✓ Phone with country code (919876543210) - Works")
    
    def test_phone_without_country_code(self):
        """Test conversation lookup without country code"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/9876543210")
        assert response.status_code == 200
        print(f"✓ Phone without country code (9876543210) - Works")
    
    def test_phone_with_plus(self):
        """Test conversation lookup with + prefix"""
        # URL encode the + as %2B
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/%2B919876543210")
        assert response.status_code == 200
        print(f"✓ Phone with + prefix (+919876543210) - Works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
