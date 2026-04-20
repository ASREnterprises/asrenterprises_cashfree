"""
Test Suite for WhatsApp and Facebook Webhook Integration
Tests auto-lead creation from social media messages

Endpoints Tested:
- GET /api/webhook/whatsapp - WhatsApp webhook verification
- POST /api/webhook/whatsapp - WhatsApp message webhook (auto-lead creation)
- GET /api/webhook/facebook - Facebook webhook verification
- POST /api/webhook/facebook - Facebook message webhook (auto-lead creation)
- GET /api/webhook/status - Webhook configuration status
- GET /api/webhook/recent-social-leads - Recent leads from social media
"""

import pytest
import requests
import os
import json
import uuid
from datetime import datetime

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WEBHOOK_VERIFY_TOKEN = "asr_solar_verify_2024"


class TestWebhookStatus:
    """Test webhook status and configuration endpoint"""
    
    def test_webhook_status_endpoint(self):
        """Test GET /api/webhook/status returns configuration info"""
        response = requests.get(f"{BASE_URL}/api/webhook/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify WhatsApp config structure
        assert "whatsapp" in data, "WhatsApp config missing"
        whatsapp = data["whatsapp"]
        assert "configured" in whatsapp
        assert "webhook_url" in whatsapp
        assert whatsapp["webhook_url"] == "/api/webhook/whatsapp"
        assert "verify_token" in whatsapp
        assert whatsapp["verify_token"] == WEBHOOK_VERIFY_TOKEN
        
        # Verify Facebook config structure
        assert "facebook" in data, "Facebook config missing"
        facebook = data["facebook"]
        assert "configured" in facebook
        assert "webhook_url" in facebook
        assert facebook["webhook_url"] == "/api/webhook/facebook"
        assert "verify_token" in facebook
        assert facebook["verify_token"] == WEBHOOK_VERIFY_TOKEN
        
        # Verify instructions are provided
        assert "instructions" in data
        print(f"✓ Webhook status endpoint working. WhatsApp configured: {whatsapp['configured']}, Facebook configured: {facebook['configured']}")


class TestWhatsAppWebhook:
    """Test WhatsApp Business API webhook endpoints"""
    
    def test_whatsapp_verification_success(self):
        """Test WhatsApp webhook verification with valid token"""
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
            "hub.challenge": "test_challenge_123"
        }
        response = requests.get(f"{BASE_URL}/api/webhook/whatsapp", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.text == "test_challenge_123", f"Expected challenge echo, got {response.text}"
        print("✓ WhatsApp webhook verification SUCCESS with valid token")
    
    def test_whatsapp_verification_invalid_token(self):
        """Test WhatsApp webhook verification with invalid token returns 403"""
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "test_challenge_123"
        }
        response = requests.get(f"{BASE_URL}/api/webhook/whatsapp", params=params)
        assert response.status_code == 403, f"Expected 403 for invalid token, got {response.status_code}"
        print("✓ WhatsApp webhook verification REJECTED invalid token (403)")
    
    def test_whatsapp_verification_missing_mode(self):
        """Test WhatsApp webhook verification with missing mode returns 403"""
        params = {
            "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
            "hub.challenge": "test_challenge_123"
        }
        response = requests.get(f"{BASE_URL}/api/webhook/whatsapp", params=params)
        assert response.status_code == 403, f"Expected 403 for missing mode, got {response.status_code}"
        print("✓ WhatsApp webhook verification REJECTED missing mode (403)")
    
    def test_whatsapp_message_creates_lead(self):
        """Test POST WhatsApp webhook creates a new lead"""
        unique_id = str(uuid.uuid4())[:8]
        sender_phone = f"919876{unique_id[:6]}"
        
        # Simulate WhatsApp Cloud API webhook payload
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456789",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "display_phone_number": "15551234567",
                            "phone_number_id": "123456789"
                        },
                        "contacts": [{
                            "profile": {"name": f"TEST_WhatsApp_User_{unique_id}"},
                            "wa_id": sender_phone
                        }],
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.{unique_id}",
                            "timestamp": str(int(datetime.now().timestamp())),
                            "type": "text",
                            "text": {"body": "Hi, I am interested in solar panel installation for my home in Patna"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/whatsapp",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got {data}"
        assert data.get("processed") == 1, f"Expected 1 message processed, got {data.get('processed')}"
        
        # Verify lead was created
        results = data.get("results", [])
        assert len(results) == 1, f"Expected 1 result, got {len(results)}"
        assert results[0].get("action") == "created", f"Expected 'created' action, got {results[0]}"
        assert "lead_id" in results[0], "lead_id should be in results"
        
        print(f"✓ WhatsApp message created lead: {results[0].get('lead_id')}")
        return results[0].get("lead_id"), sender_phone
    
    def test_whatsapp_message_updates_existing_lead(self):
        """Test POST WhatsApp webhook updates existing lead on repeat message"""
        unique_id = str(uuid.uuid4())[:8]
        sender_phone = f"919877{unique_id[:6]}"
        
        # First message - create lead
        payload1 = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456789",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "contacts": [{
                            "profile": {"name": f"TEST_Repeat_User_{unique_id}"},
                            "wa_id": sender_phone
                        }],
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.first_{unique_id}",
                            "timestamp": str(int(datetime.now().timestamp())),
                            "type": "text",
                            "text": {"body": "Initial inquiry about solar panels"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        
        response1 = requests.post(f"{BASE_URL}/api/webhook/whatsapp", json=payload1)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["results"][0]["action"] == "created"
        lead_id = data1["results"][0]["lead_id"]
        
        # Second message from same user - should update
        payload2 = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456789",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "contacts": [{
                            "profile": {"name": f"TEST_Repeat_User_{unique_id}"},
                            "wa_id": sender_phone
                        }],
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.second_{unique_id}",
                            "timestamp": str(int(datetime.now().timestamp())),
                            "type": "text",
                            "text": {"body": "Follow up - what is the cost for 5kW system?"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        
        response2 = requests.post(f"{BASE_URL}/api/webhook/whatsapp", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["results"][0]["action"] == "updated", f"Expected 'updated', got {data2['results'][0]['action']}"
        assert data2["results"][0]["lead_id"] == lead_id, "Same lead should be updated"
        
        print(f"✓ WhatsApp repeat message updated existing lead: {lead_id}")
    
    def test_whatsapp_image_message(self):
        """Test WhatsApp image message creates lead"""
        unique_id = str(uuid.uuid4())[:8]
        sender_phone = f"919878{unique_id[:6]}"
        
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456789",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "contacts": [{
                            "profile": {"name": f"TEST_Image_User_{unique_id}"},
                            "wa_id": sender_phone
                        }],
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.img_{unique_id}",
                            "timestamp": str(int(datetime.now().timestamp())),
                            "type": "image",
                            "image": {
                                "id": "img123",
                                "caption": "My rooftop - is it suitable for solar?"
                            }
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/whatsapp", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["results"][0]["action"] == "created"
        print(f"✓ WhatsApp image message created lead")
    
    def test_whatsapp_ignores_non_whatsapp_object(self):
        """Test WhatsApp webhook ignores non-whatsapp objects"""
        payload = {
            "object": "instagram",
            "entry": []
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/whatsapp", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ignored"
        assert data.get("reason") == "not whatsapp_business_account"
        print("✓ WhatsApp webhook correctly ignores non-whatsapp objects")


class TestFacebookWebhook:
    """Test Facebook Messenger webhook endpoints"""
    
    def test_facebook_verification_success(self):
        """Test Facebook webhook verification with valid token"""
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
            "hub.challenge": "fb_challenge_456"
        }
        response = requests.get(f"{BASE_URL}/api/webhook/facebook", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.text == "fb_challenge_456", f"Expected challenge echo, got {response.text}"
        print("✓ Facebook webhook verification SUCCESS with valid token")
    
    def test_facebook_verification_invalid_token(self):
        """Test Facebook webhook verification with invalid token returns 403"""
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": "invalid_token",
            "hub.challenge": "fb_challenge_456"
        }
        response = requests.get(f"{BASE_URL}/api/webhook/facebook", params=params)
        assert response.status_code == 403, f"Expected 403 for invalid token, got {response.status_code}"
        print("✓ Facebook webhook verification REJECTED invalid token (403)")
    
    def test_facebook_message_creates_lead(self):
        """Test POST Facebook webhook creates a new lead"""
        unique_id = str(uuid.uuid4())[:8]
        sender_id = f"fb_user_{unique_id}"
        
        # Simulate Facebook Messenger webhook payload
        payload = {
            "object": "page",
            "entry": [{
                "id": "page_123456",
                "time": int(datetime.now().timestamp() * 1000),
                "messaging": [{
                    "sender": {"id": sender_id},
                    "recipient": {"id": "page_123456"},
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "message": {
                        "mid": f"mid.{unique_id}",
                        "text": "I saw your solar panel ad. Can you give me a quote for 3kW system?"
                    }
                }]
            }]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/facebook",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got {data}"
        assert data.get("processed") == 1, f"Expected 1 message processed, got {data.get('processed')}"
        
        results = data.get("results", [])
        assert len(results) == 1
        assert results[0].get("action") == "created"
        assert "lead_id" in results[0]
        
        print(f"✓ Facebook message created lead: {results[0].get('lead_id')}")
        return results[0].get("lead_id"), sender_id
    
    def test_facebook_message_updates_existing_lead(self):
        """Test POST Facebook webhook updates existing lead on repeat message"""
        unique_id = str(uuid.uuid4())[:8]
        sender_id = f"fb_repeat_{unique_id}"
        
        # First message
        payload1 = {
            "object": "page",
            "entry": [{
                "id": "page_123456",
                "time": int(datetime.now().timestamp() * 1000),
                "messaging": [{
                    "sender": {"id": sender_id},
                    "recipient": {"id": "page_123456"},
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "message": {
                        "mid": f"mid.first_{unique_id}",
                        "text": "Hello, interested in solar installation"
                    }
                }]
            }]
        }
        
        response1 = requests.post(f"{BASE_URL}/api/webhook/facebook", json=payload1)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["results"][0]["action"] == "created"
        lead_id = data1["results"][0]["lead_id"]
        
        # Second message - should update
        payload2 = {
            "object": "page",
            "entry": [{
                "id": "page_123456",
                "time": int(datetime.now().timestamp() * 1000),
                "messaging": [{
                    "sender": {"id": sender_id},
                    "recipient": {"id": "page_123456"},
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "message": {
                        "mid": f"mid.second_{unique_id}",
                        "text": "What is the price for 5kW system?"
                    }
                }]
            }]
        }
        
        response2 = requests.post(f"{BASE_URL}/api/webhook/facebook", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["results"][0]["action"] == "updated"
        assert data2["results"][0]["lead_id"] == lead_id
        
        print(f"✓ Facebook repeat message updated existing lead: {lead_id}")
    
    def test_facebook_attachment_message(self):
        """Test Facebook attachment message creates lead"""
        unique_id = str(uuid.uuid4())[:8]
        sender_id = f"fb_attach_{unique_id}"
        
        payload = {
            "object": "page",
            "entry": [{
                "id": "page_123456",
                "time": int(datetime.now().timestamp() * 1000),
                "messaging": [{
                    "sender": {"id": sender_id},
                    "recipient": {"id": "page_123456"},
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "message": {
                        "mid": f"mid.attach_{unique_id}",
                        "attachments": [{
                            "type": "image",
                            "payload": {"url": "https://example.com/rooftop.jpg"}
                        }]
                    }
                }]
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/facebook", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["results"][0]["action"] == "created"
        print("✓ Facebook attachment message created lead")
    
    def test_facebook_ignores_echo_messages(self):
        """Test Facebook webhook ignores echo messages (sent by page itself)"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "object": "page",
            "entry": [{
                "id": "page_123456",
                "time": int(datetime.now().timestamp() * 1000),
                "messaging": [{
                    "sender": {"id": "page_123456"},  # Same as page ID
                    "recipient": {"id": "user_123"},
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "message": {
                        "mid": f"mid.echo_{unique_id}",
                        "text": "Thanks for contacting us!",
                        "is_echo": True
                    }
                }]
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/facebook", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should process 0 messages since it's an echo
        assert data["processed"] == 0, f"Echo messages should not be processed, got {data['processed']}"
        print("✓ Facebook webhook correctly ignores echo messages")
    
    def test_facebook_ignores_non_page_object(self):
        """Test Facebook webhook ignores non-page objects"""
        payload = {
            "object": "user",
            "entry": []
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/facebook", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ignored"
        assert data.get("reason") == "not page object"
        print("✓ Facebook webhook correctly ignores non-page objects")


class TestRecentSocialLeads:
    """Test recent social leads endpoint"""
    
    def test_recent_social_leads_endpoint(self):
        """Test GET /api/webhook/recent-social-leads returns social media leads"""
        response = requests.get(f"{BASE_URL}/api/webhook/recent-social-leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total" in data
        assert "leads" in data
        assert "by_source" in data
        assert "whatsapp" in data["by_source"]
        assert "facebook" in data["by_source"]
        
        # Verify leads have correct source
        for lead in data["leads"]:
            assert lead.get("source") in ["whatsapp", "facebook"], f"Lead source should be whatsapp or facebook, got {lead.get('source')}"
        
        print(f"✓ Recent social leads: {data['total']} total ({data['by_source']['whatsapp']} WhatsApp, {data['by_source']['facebook']} Facebook)")
    
    def test_social_leads_have_correct_fields(self):
        """Test social leads have all required CRM fields"""
        response = requests.get(f"{BASE_URL}/api/webhook/recent-social-leads")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["leads"]:
            lead = data["leads"][0]
            # Check required fields
            required_fields = ["id", "name", "source", "stage", "lead_score", "timestamp"]
            for field in required_fields:
                assert field in lead, f"Lead missing required field: {field}"
            
            # Verify source is correctly marked
            assert lead["source"] in ["whatsapp", "facebook"]
            print(f"✓ Social lead has all required fields. Source: {lead['source']}")
        else:
            print("✓ No social leads yet (empty list)")


class TestLeadSourceVerification:
    """Verify lead source is correctly marked"""
    
    def test_whatsapp_lead_source_marked_correctly(self):
        """Test WhatsApp leads have source='whatsapp'"""
        unique_id = str(uuid.uuid4())[:8]
        sender_phone = f"919879{unique_id[:6]}"
        
        # Create WhatsApp lead
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456789",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "contacts": [{
                            "profile": {"name": f"TEST_Source_WA_{unique_id}"},
                            "wa_id": sender_phone
                        }],
                        "messages": [{
                            "from": sender_phone,
                            "id": f"wamid.source_{unique_id}",
                            "timestamp": str(int(datetime.now().timestamp())),
                            "type": "text",
                            "text": {"body": "Test message for source verification"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/whatsapp", json=payload)
        assert response.status_code == 200
        lead_id = response.json()["results"][0]["lead_id"]
        
        # Verify in CRM leads
        crm_response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert crm_response.status_code == 200
        crm_leads = crm_response.json()
        
        created_lead = next((l for l in crm_leads if l.get("id") == lead_id), None)
        assert created_lead is not None, f"Lead {lead_id} not found in CRM"
        assert created_lead.get("source") == "whatsapp", f"Expected source 'whatsapp', got {created_lead.get('source')}"
        
        print(f"✓ WhatsApp lead source correctly marked as 'whatsapp'")
    
    def test_facebook_lead_source_marked_correctly(self):
        """Test Facebook leads have source='facebook'"""
        unique_id = str(uuid.uuid4())[:8]
        sender_id = f"fb_source_{unique_id}"
        
        # Create Facebook lead
        payload = {
            "object": "page",
            "entry": [{
                "id": "page_123456",
                "time": int(datetime.now().timestamp() * 1000),
                "messaging": [{
                    "sender": {"id": sender_id},
                    "recipient": {"id": "page_123456"},
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "message": {
                        "mid": f"mid.source_{unique_id}",
                        "text": "Test message for Facebook source verification"
                    }
                }]
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/webhook/facebook", json=payload)
        assert response.status_code == 200
        lead_id = response.json()["results"][0]["lead_id"]
        
        # Verify in CRM leads
        crm_response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert crm_response.status_code == 200
        crm_leads = crm_response.json()
        
        created_lead = next((l for l in crm_leads if l.get("id") == lead_id), None)
        assert created_lead is not None, f"Lead {lead_id} not found in CRM"
        assert created_lead.get("source") == "facebook", f"Expected source 'facebook', got {created_lead.get('source')}"
        
        print(f"✓ Facebook lead source correctly marked as 'facebook'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
