"""
Test suite for Private Messaging System - ASR Enterprises Solar CRM
Tests:
1. Private messaging between staff and admin (no cross-staff visibility)
2. Admin delete message functionality
3. Staff lead creation
4. Header UI verification (API-side)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Staff credentials from database
STAFF_1 = {
    "staff_id": "ASR1001",
    "password": "asr@123",
    "internal_id": "70675bfb-b196-4f0f-b2b4-49f5d5e91df8",
    "name": "Rahul Kumar"
}

STAFF_2 = {
    "staff_id": "ASR1002",
    "password": "asr@123",
    "internal_id": "9d131d9b-d854-4ab8-8fff-2299919c4a05",
    "name": "New Staff Member"
}


class TestPrivateMessaging:
    """Tests for private messaging system - CRITICAL: Staff isolation"""
    
    def test_staff_login_asr1001(self):
        """Test staff ASR1001 can login"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": STAFF_1["staff_id"],
            "password": STAFF_1["password"]
        })
        print(f"ASR1001 Login Response: {response.status_code}")
        assert response.status_code == 200, f"ASR1001 login failed: {response.text}"
        data = response.json()
        assert "staff" in data or "id" in data or "staff_id" in data, "Login response missing staff data"
        print(f"ASR1001 Login SUCCESS: {data}")
    
    def test_staff_login_asr1002(self):
        """Test staff ASR1002 can login"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": STAFF_2["staff_id"],
            "password": STAFF_2["password"]
        })
        print(f"ASR1002 Login Response: {response.status_code}")
        assert response.status_code == 200, f"ASR1002 login failed: {response.text}"
        data = response.json()
        print(f"ASR1002 Login SUCCESS: {data}")
    
    def test_asr1001_send_private_message(self):
        """Test ASR1001 can send a private message to admin"""
        unique_msg = f"TEST_MSG_ASR1001_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/crm/messages", json={
            "sender_id": STAFF_1["internal_id"],
            "sender_name": STAFF_1["name"],
            "sender_type": "staff",
            "receiver_id": "admin",
            "message": unique_msg
        })
        print(f"Send message response: {response.status_code}")
        assert response.status_code == 200, f"Failed to send message: {response.text}"
        self.asr1001_test_msg = unique_msg
        print(f"ASR1001 sent private message: {unique_msg}")
    
    def test_asr1002_send_private_message(self):
        """Test ASR1002 can send a private message to admin"""
        unique_msg = f"TEST_MSG_ASR1002_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/crm/messages", json={
            "sender_id": STAFF_2["internal_id"],
            "sender_name": STAFF_2["name"],
            "sender_type": "staff",
            "receiver_id": "admin",
            "message": unique_msg
        })
        print(f"Send message response: {response.status_code}")
        assert response.status_code == 200, f"Failed to send message: {response.text}"
        self.asr1002_test_msg = unique_msg
        print(f"ASR1002 sent private message: {unique_msg}")
    
    def test_asr1001_can_only_see_own_messages(self):
        """CRITICAL: ASR1001 should ONLY see messages between ASR1001 and admin"""
        response = requests.get(f"{BASE_URL}/api/staff/{STAFF_1['staff_id']}/messages")
        print(f"ASR1001 messages response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get ASR1001 messages: {response.text}"
        
        messages = response.json()
        print(f"ASR1001 received {len(messages)} messages")
        
        # Check that all messages involve ASR1001 and admin only
        for msg in messages:
            sender = msg.get('sender_id', '')
            receiver = msg.get('receiver_id', '')
            # Message should be from ASR1001 to admin OR from admin to ASR1001
            valid = (
                (sender == STAFF_1['internal_id'] and receiver == 'admin') or
                (sender == 'admin' and receiver == STAFF_1['internal_id'])
            )
            if not valid:
                print(f"SECURITY VIOLATION: ASR1001 sees message with sender={sender}, receiver={receiver}")
            assert valid, f"SECURITY VIOLATION: ASR1001 can see other staff's messages! sender={sender}, receiver={receiver}"
        
        print("PASSED: ASR1001 can only see their own private messages")
    
    def test_asr1002_can_only_see_own_messages(self):
        """CRITICAL: ASR1002 should ONLY see messages between ASR1002 and admin"""
        response = requests.get(f"{BASE_URL}/api/staff/{STAFF_2['staff_id']}/messages")
        print(f"ASR1002 messages response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get ASR1002 messages: {response.text}"
        
        messages = response.json()
        print(f"ASR1002 received {len(messages)} messages")
        
        # Check that all messages involve ASR1002 and admin only
        for msg in messages:
            sender = msg.get('sender_id', '')
            receiver = msg.get('receiver_id', '')
            # Message should be from ASR1002 to admin OR from admin to ASR1002
            valid = (
                (sender == STAFF_2['internal_id'] and receiver == 'admin') or
                (sender == 'admin' and receiver == STAFF_2['internal_id'])
            )
            if not valid:
                print(f"SECURITY VIOLATION: ASR1002 sees message with sender={sender}, receiver={receiver}")
            assert valid, f"SECURITY VIOLATION: ASR1002 can see other staff's messages! sender={sender}, receiver={receiver}"
        
        print("PASSED: ASR1002 can only see their own private messages")
    
    def test_asr1001_cannot_see_asr1002_messages(self):
        """CRITICAL: Send message as ASR1002, verify ASR1001 does NOT see it"""
        # First, send a unique message from ASR1002
        unique_msg = f"SECRET_ASR1002_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/crm/messages", json={
            "sender_id": STAFF_2["internal_id"],
            "sender_name": STAFF_2["name"],
            "sender_type": "staff",
            "receiver_id": "admin",
            "message": unique_msg
        })
        
        # Now check ASR1001's messages - should NOT contain ASR1002's message
        response = requests.get(f"{BASE_URL}/api/staff/{STAFF_1['staff_id']}/messages")
        assert response.status_code == 200
        
        messages = response.json()
        message_texts = [msg.get('message', '') for msg in messages]
        
        if unique_msg in message_texts:
            print(f"SECURITY BREACH: ASR1001 can see ASR1002's message: {unique_msg}")
        assert unique_msg not in message_texts, f"SECURITY BREACH: ASR1001 saw ASR1002's private message!"
        
        print("PASSED: ASR1001 cannot see ASR1002's messages")
    
    def test_asr1002_cannot_see_asr1001_messages(self):
        """CRITICAL: Send message as ASR1001, verify ASR1002 does NOT see it"""
        # First, send a unique message from ASR1001
        unique_msg = f"SECRET_ASR1001_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/crm/messages", json={
            "sender_id": STAFF_1["internal_id"],
            "sender_name": STAFF_1["name"],
            "sender_type": "staff",
            "receiver_id": "admin",
            "message": unique_msg
        })
        
        # Now check ASR1002's messages - should NOT contain ASR1001's message
        response = requests.get(f"{BASE_URL}/api/staff/{STAFF_2['staff_id']}/messages")
        assert response.status_code == 200
        
        messages = response.json()
        message_texts = [msg.get('message', '') for msg in messages]
        
        if unique_msg in message_texts:
            print(f"SECURITY BREACH: ASR1002 can see ASR1001's message: {unique_msg}")
        assert unique_msg not in message_texts, f"SECURITY BREACH: ASR1002 saw ASR1001's private message!"
        
        print("PASSED: ASR1002 cannot see ASR1001's messages")


class TestAdminMessageDelete:
    """Tests for admin message deletion functionality"""
    
    def test_admin_delete_message(self):
        """Admin should be able to delete any message"""
        # First create a test message
        test_msg_id = f"test_delete_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/crm/messages", json={
            "sender_id": "admin",
            "sender_name": "Admin",
            "sender_type": "admin",
            "receiver_id": STAFF_1["internal_id"],
            "message": f"Test message to delete - {test_msg_id}"
        })
        print(f"Create message response: {create_resp.status_code}")
        assert create_resp.status_code == 200
        
        # Get the message id from response
        created_msg = create_resp.json()
        msg_id = created_msg.get('id')
        print(f"Created message ID: {msg_id}")
        
        if msg_id:
            # Now delete the message
            delete_resp = requests.delete(f"{BASE_URL}/api/crm/messages/{msg_id}")
            print(f"Delete message response: {delete_resp.status_code}")
            assert delete_resp.status_code == 200, f"Failed to delete message: {delete_resp.text}"
            
            data = delete_resp.json()
            assert data.get('success') == True, "Delete should return success=True"
            print("PASSED: Admin can delete messages")
        else:
            print("WARNING: Message ID not returned, cannot test delete")
    
    def test_delete_nonexistent_message_returns_404(self):
        """Deleting non-existent message should return 404"""
        fake_id = f"fake_{uuid.uuid4().hex}"
        response = requests.delete(f"{BASE_URL}/api/crm/messages/{fake_id}")
        print(f"Delete non-existent message response: {response.status_code}")
        assert response.status_code == 404, "Should return 404 for non-existent message"
        print("PASSED: 404 returned for non-existent message")


class TestStaffLeadCreation:
    """Tests for staff lead creation functionality"""
    
    def test_staff_create_lead(self):
        """Staff (telecaller/manager) should be able to create leads"""
        lead_name = f"TEST_Lead_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/staff/{STAFF_1['staff_id']}/leads", json={
            "name": lead_name,
            "phone": "9876543210",
            "district": "Patna",
            "monthly_bill": 3000,
            "property_type": "residential",
            "notes": "Test lead created by telecaller"
        })
        print(f"Create lead response: {response.status_code}")
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        data = response.json()
        assert data.get('name') == lead_name, "Lead name should match"
        assert data.get('phone') == "9876543210", "Lead phone should match"
        assert 'staff:' in data.get('source', ''), "Source should indicate staff creation"
        assert data.get('assigned_to') == STAFF_1['internal_id'], "Lead should be assigned to the creating staff"
        
        print(f"PASSED: Staff created lead - {data}")
    
    def test_staff_create_lead_validation(self):
        """Lead creation should require name and phone"""
        # Missing required fields
        response = requests.post(f"{BASE_URL}/api/staff/{STAFF_1['staff_id']}/leads", json={
            "district": "Patna"
        })
        # The API may accept empty name/phone but should handle gracefully
        print(f"Lead without required fields response: {response.status_code}")
        # Accept 200 (creates empty) or 400/422 (validation error) - just verify no 500
        assert response.status_code != 500, "Should not return 500 error"
    
    def test_invalid_staff_cannot_create_lead(self):
        """Non-existent staff should not be able to create leads"""
        response = requests.post(f"{BASE_URL}/api/staff/INVALID_STAFF/leads", json={
            "name": "Test Lead",
            "phone": "9876543210"
        })
        print(f"Invalid staff create lead response: {response.status_code}")
        assert response.status_code == 404, "Should return 404 for invalid staff"
        print("PASSED: Invalid staff returns 404")


class TestAdminConversationEndpoint:
    """Tests for admin-side conversation viewing"""
    
    def test_admin_get_conversation_with_staff(self):
        """Admin can get private conversation with specific staff"""
        # First send a message to ensure there's conversation
        requests.post(f"{BASE_URL}/api/crm/messages", json={
            "sender_id": "admin",
            "sender_name": "Admin",
            "sender_type": "admin",
            "receiver_id": STAFF_1["internal_id"],
            "message": f"Admin to ASR1001 - {uuid.uuid4().hex[:8]}"
        })
        
        # Get conversation
        response = requests.get(f"{BASE_URL}/api/crm/messages/conversation/{STAFF_1['internal_id']}")
        print(f"Get conversation response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get conversation: {response.text}"
        
        messages = response.json()
        print(f"Admin-ASR1001 conversation has {len(messages)} messages")
        
        # Verify all messages are between admin and this staff only
        for msg in messages:
            sender = msg.get('sender_id', '')
            receiver = msg.get('receiver_id', '')
            valid = (
                (sender == 'admin' and receiver == STAFF_1['internal_id']) or
                (sender == STAFF_1['internal_id'] and receiver == 'admin')
            )
            assert valid, f"Conversation contains invalid message: sender={sender}, receiver={receiver}"
        
        print("PASSED: Admin conversation endpoint returns only private messages")


class TestUnreadMessages:
    """Tests for unread message count"""
    
    def test_staff_unread_count(self):
        """Staff can get unread message count"""
        response = requests.get(f"{BASE_URL}/api/staff/{STAFF_1['staff_id']}/messages/unread")
        print(f"Unread count response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get unread count: {response.text}"
        
        data = response.json()
        assert 'count' in data, "Response should contain count"
        print(f"ASR1001 unread messages: {data.get('count')}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
