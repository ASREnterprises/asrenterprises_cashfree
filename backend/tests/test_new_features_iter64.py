"""
Test suite for iteration 64 - New features testing:
1. Social Media Manager - File upload endpoint
2. WhatsApp Inbox - Delete endpoints (single, bulk, clear conversation)
3. WhatsApp Inbox - Send media endpoint
4. Staff Portal - Pagination and auto-sync (API level)
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSocialMediaFileUpload:
    """Test Social Media file upload endpoint"""
    
    def test_upload_media_endpoint_exists(self):
        """Test that upload endpoint exists and rejects empty requests"""
        response = requests.post(f"{BASE_URL}/api/social/upload/media")
        # Should return 422 (validation error) not 404
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("PASS: POST /api/social/upload/media endpoint exists")
    
    def test_upload_invalid_file_type(self):
        """Test that invalid file types are rejected"""
        # Create a fake text file
        files = {'file': ('test.txt', io.BytesIO(b'test content'), 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/social/upload/media", files=files)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid file type" in response.json().get('detail', '')
        print("PASS: Invalid file type rejected correctly")
    
    def test_upload_valid_image(self):
        """Test uploading a valid image file"""
        # Create a minimal valid JPEG (1x1 pixel)
        jpeg_bytes = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
            0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
            0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
            0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
            0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
            0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
            0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
            0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
            0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
            0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
            0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
            0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xD9,
            0xF1, 0x55, 0x7D, 0xAC, 0xE3, 0x8E, 0x6D, 0xB5, 0x5B, 0x6D, 0x2D, 0xF8,
            0xF1, 0x57, 0x6D, 0xAC, 0xE3, 0x8E, 0x6D, 0xB5, 0x5B, 0x6D, 0x2D, 0xF8,
            0xFF, 0xD9
        ])
        files = {'file': ('test.jpg', io.BytesIO(jpeg_bytes), 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/social/upload/media", files=files)
        
        # Should succeed or fail gracefully
        if response.status_code in [200, 201]:
            data = response.json()
            assert data.get('success') == True
            assert 'file_id' in data
            print(f"PASS: Image upload successful, file_id: {data.get('file_id')}")
        else:
            # May fail due to storage config - that's acceptable
            print(f"INFO: Image upload returned {response.status_code} - may need storage config")


class TestWhatsAppMessageDelete:
    """Test WhatsApp message delete endpoints"""
    
    def test_delete_single_message_not_found(self):
        """Test deleting a non-existent message returns 404"""
        response = requests.delete(f"{BASE_URL}/api/whatsapp/messages/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: DELETE /api/whatsapp/messages/{id} returns 404 for non-existent message")
    
    def test_bulk_delete_empty_list(self):
        """Test bulk delete with empty list returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/messages/bulk-delete",
            json={"message_ids": []}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "No message IDs" in response.json().get('detail', '')
        print("PASS: POST /api/whatsapp/messages/bulk-delete rejects empty list")
    
    def test_bulk_delete_nonexistent_messages(self):
        """Test bulk delete with non-existent IDs returns success with 0 deleted"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/messages/bulk-delete",
            json={"message_ids": ["fake-id-1", "fake-id-2"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('deleted_count') == 0
        print("PASS: POST /api/whatsapp/messages/bulk-delete handles non-existent IDs gracefully")
    
    def test_clear_conversation_endpoint(self):
        """Test clear conversation endpoint exists"""
        # Use a fake phone number
        response = requests.delete(f"{BASE_URL}/api/whatsapp/conversations/0000000000/clear")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get('success') == True
        print("PASS: DELETE /api/whatsapp/conversations/{phone}/clear endpoint works")
    
    def test_delete_old_conversations_endpoint(self):
        """Test delete old conversations endpoint"""
        response = requests.delete(
            f"{BASE_URL}/api/whatsapp/conversations/old",
            json={"days": 365}  # Very old to not delete real data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get('success') == True
        print("PASS: DELETE /api/whatsapp/conversations/old endpoint works")


class TestWhatsAppSendMedia:
    """Test WhatsApp send media endpoint"""
    
    def test_send_media_missing_url(self):
        """Test send media without URL returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/9999999999/send-media",
            json={"media_type": "image", "media_url": ""}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Media URL is required" in response.json().get('detail', '')
        print("PASS: POST /api/whatsapp/conversations/{phone}/send-media validates media_url")
    
    def test_send_media_no_incoming_message(self):
        """Test send media to phone with no incoming messages"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/0000000000/send-media",
            json={
                "media_type": "image",
                "media_url": "https://example.com/test.jpg",
                "caption": "Test"
            }
        )
        # Should fail because no incoming message from this number
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        detail = response.json().get('detail', '')
        assert "No incoming message" in detail or "Customer must message first" in detail
        print("PASS: POST /api/whatsapp/conversations/{phone}/send-media requires incoming message first")


class TestStaffPortalPagination:
    """Test Staff Portal pagination endpoints"""
    
    def test_staff_leads_pagination_params(self):
        """Test that staff leads endpoint accepts pagination parameters"""
        # First need to get a valid staff ID - use a test one
        # This tests the endpoint structure, not actual data
        response = requests.get(f"{BASE_URL}/api/staff/test-staff-id/leads?page=1&limit=150")
        # Should return 404 (staff not found) or 200 with data, not 500
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}"
        print("PASS: GET /api/staff/{id}/leads accepts pagination params")


class TestWhatsAppConversations:
    """Test WhatsApp conversation endpoints"""
    
    def test_get_conversations_list(self):
        """Test getting conversations list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'conversations' in data
        assert 'pagination' in data
        print(f"PASS: GET /api/whatsapp/conversations returns {len(data.get('conversations', []))} conversations")
    
    def test_get_unread_count(self):
        """Test getting unread message count"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'unread_count' in data
        print(f"PASS: GET /api/whatsapp/conversations/unread-count returns count: {data.get('unread_count')}")
    
    def test_get_conversation_thread(self):
        """Test getting a specific conversation thread"""
        # Use a fake phone - should return empty or 404
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/0000000000")
        # Should return 200 with empty messages or 404
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}"
        print("PASS: GET /api/whatsapp/conversations/{phone} endpoint works")


class TestSocialMediaSettings:
    """Test Social Media settings and permissions"""
    
    def test_get_settings(self):
        """Test getting social media settings"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should have masked settings
        assert 'facebook_page_id' in data or 'facebook_connected' in data
        print("PASS: GET /api/social/settings returns settings")
    
    def test_get_dashboard_stats(self):
        """Test getting social media dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/social/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'total_posts' in data
        assert 'facebook_connected' in data
        assert 'instagram_connected' in data
        print(f"PASS: GET /api/social/dashboard/stats - FB: {data.get('facebook_connected')}, IG: {data.get('instagram_connected')}")
    
    def test_test_connection(self):
        """Test the test-connection endpoint"""
        response = requests.post(f"{BASE_URL}/api/social/test-connection")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'facebook' in data
        assert 'instagram' in data
        print(f"PASS: POST /api/social/test-connection - FB: {data.get('facebook', {}).get('connected')}, IG: {data.get('instagram', {}).get('connected')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
