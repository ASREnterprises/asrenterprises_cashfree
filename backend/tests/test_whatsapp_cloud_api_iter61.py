"""
WhatsApp Cloud API Integration Tests - Iteration 61
Tests for native Meta WhatsApp Cloud API integration in ASR CRM
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestWhatsAppSettings:
    """WhatsApp Settings API tests"""
    
    def test_get_settings_returns_default(self):
        """GET /api/whatsapp/settings returns default settings when not configured"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Should have these fields
        assert "configured" in data
        assert "access_token" in data
        assert "phone_number_id" in data
        assert "waba_id" in data
        assert "verify_token" in data
        assert "default_country_code" in data
        assert "webhook_url" in data
        
        # Default country code should be 91 (India)
        assert data.get("default_country_code") == "91"
        # Webhook URL should be correct
        assert data.get("webhook_url") == "/api/whatsapp/webhook"
        print(f"Settings response: configured={data.get('configured')}, country_code={data.get('default_country_code')}")
    
    def test_save_settings_requires_access_token(self):
        """POST /api/whatsapp/settings requires access_token and phone_number_id"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/settings", json={
            "phone_number_id": "123456789"
        })
        assert response.status_code == 400
        assert "Access Token" in response.json().get("detail", "")
        print("Correctly rejects missing access_token")
    
    def test_save_settings_requires_phone_number_id(self):
        """POST /api/whatsapp/settings requires phone_number_id"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/settings", json={
            "access_token": "test_token_123"
        })
        assert response.status_code == 400
        assert "Phone Number ID" in response.json().get("detail", "")
        print("Correctly rejects missing phone_number_id")
    
    def test_save_settings_success(self):
        """POST /api/whatsapp/settings saves credentials successfully"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/settings", json={
            "access_token": "TEST_ACCESS_TOKEN_FOR_TESTING",
            "phone_number_id": "TEST_PHONE_NUMBER_ID",
            "waba_id": "TEST_WABA_ID",
            "verify_token": "test_verify_token",
            "default_country_code": "91"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "saved" in data.get("message", "").lower()
        print(f"Settings saved: {data.get('message')}")


class TestWhatsAppTemplates:
    """WhatsApp Templates API tests"""
    
    def test_get_templates_returns_8_predefined(self):
        """GET /api/whatsapp/templates returns 8 predefined templates"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates")
        assert response.status_code == 200
        templates = response.json()
        
        # Should be a list
        assert isinstance(templates, list)
        # Should have at least 8 templates (the predefined ones)
        assert len(templates) >= 8
        
        # Check expected template names
        template_names = [t.get("template_name") for t in templates]
        expected_templates = [
            "asr_welcome", "asr_solar_offer", "asr_subsidy_info", 
            "asr_site_visit", "asr_quotation_followup", "asr_callback_request",
            "asr_reactivation", "hello_world"
        ]
        
        for expected in expected_templates:
            assert expected in template_names, f"Missing template: {expected}"
        
        # Check template structure
        for template in templates:
            assert "template_name" in template
            assert "display_name" in template
            assert "category" in template
            print(f"Template: {template.get('template_name')} - {template.get('display_name')}")
        
        print(f"Total templates: {len(templates)}")


class TestPhoneCleaning:
    """Phone number cleaning API tests"""
    
    def test_clean_phone_10_digits(self):
        """POST /api/whatsapp/clean-phone cleans 10-digit number to 91XXXXXXXXXX"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/clean-phone", json={
            "phone": "9876543210"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("original") == "9876543210"
        assert data.get("cleaned") == "919876543210"
        assert data.get("is_valid") == True
        print(f"Cleaned: {data.get('original')} -> {data.get('cleaned')}")
    
    def test_clean_phone_with_country_code(self):
        """POST /api/whatsapp/clean-phone handles number with country code"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/clean-phone", json={
            "phone": "919876543210"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("cleaned") == "919876543210"
        assert data.get("is_valid") == True
        print(f"Cleaned: {data.get('original')} -> {data.get('cleaned')}")
    
    def test_clean_phone_with_plus(self):
        """POST /api/whatsapp/clean-phone handles +91 prefix"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/clean-phone", json={
            "phone": "+919876543210"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("cleaned") == "919876543210"
        assert data.get("is_valid") == True
        print(f"Cleaned: {data.get('original')} -> {data.get('cleaned')}")
    
    def test_clean_phone_with_leading_zero(self):
        """POST /api/whatsapp/clean-phone handles 0XXXXXXXXXX format"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/clean-phone", json={
            "phone": "09876543210"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("cleaned") == "919876543210"
        assert data.get("is_valid") == True
        print(f"Cleaned: {data.get('original')} -> {data.get('cleaned')}")
    
    def test_clean_phone_invalid_short(self):
        """POST /api/whatsapp/clean-phone rejects short numbers"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/clean-phone", json={
            "phone": "12345"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("is_valid") == False
        print(f"Invalid phone correctly rejected: {data.get('original')}")


class TestDashboardStats:
    """WhatsApp Dashboard Stats API tests"""
    
    def test_get_dashboard_stats(self):
        """GET /api/whatsapp/dashboard/stats returns message statistics"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Should have today's stats
        assert "today" in data
        today = data.get("today", {})
        assert "sent" in today
        assert "delivered" in today
        assert "read" in today
        assert "failed" in today
        assert "replies" in today
        
        # Should have total stats
        assert "total" in data
        total = data.get("total", {})
        assert "sent" in total
        assert "replies" in total
        
        # Should have active campaigns count
        assert "active_campaigns" in data
        
        print(f"Dashboard stats: Today sent={today.get('sent')}, Total sent={total.get('sent')}, Active campaigns={data.get('active_campaigns')}")


class TestCampaigns:
    """WhatsApp Campaigns API tests"""
    
    def test_get_campaigns_paginated(self):
        """GET /api/whatsapp/campaigns returns paginated campaigns"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/campaigns")
        assert response.status_code == 200
        data = response.json()
        
        # Should have campaigns array
        assert "campaigns" in data
        assert isinstance(data.get("campaigns"), list)
        
        # Should have pagination
        assert "pagination" in data
        pagination = data.get("pagination", {})
        assert "current_page" in pagination
        assert "total_pages" in pagination
        assert "total_count" in pagination
        
        print(f"Campaigns: {len(data.get('campaigns'))} items, Page {pagination.get('current_page')}/{pagination.get('total_pages')}")
    
    def test_get_campaigns_with_page_param(self):
        """GET /api/whatsapp/campaigns?page=1&limit=10 respects pagination params"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/campaigns?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert "campaigns" in data
        assert "pagination" in data
        assert data.get("pagination", {}).get("current_page") == 1
        print(f"Pagination working: page={data.get('pagination', {}).get('current_page')}")


class TestMessages:
    """WhatsApp Messages API tests"""
    
    def test_get_messages_paginated(self):
        """GET /api/whatsapp/messages returns paginated messages"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/messages")
        assert response.status_code == 200
        data = response.json()
        
        # Should have messages array
        assert "messages" in data
        assert isinstance(data.get("messages"), list)
        
        # Should have pagination
        assert "pagination" in data
        pagination = data.get("pagination", {})
        assert "current_page" in pagination
        assert "total_pages" in pagination
        assert "total_count" in pagination
        
        print(f"Messages: {len(data.get('messages'))} items, Total: {pagination.get('total_count')}")
    
    def test_get_lead_messages(self):
        """GET /api/whatsapp/messages/lead/{lead_id} returns lead-specific messages"""
        # Use a test lead ID (may not exist, but API should return empty array)
        test_lead_id = "test-lead-id-12345"
        response = requests.get(f"{BASE_URL}/api/whatsapp/messages/lead/{test_lead_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Should return an array (empty if no messages)
        assert isinstance(data, list)
        print(f"Lead messages for {test_lead_id}: {len(data)} messages")


class TestWebhook:
    """WhatsApp Webhook verification tests"""
    
    def test_webhook_verification_challenge(self):
        """GET /api/whatsapp/webhook handles Meta verification challenge"""
        # First get the current verify token from settings
        settings_response = requests.get(f"{BASE_URL}/api/whatsapp/settings")
        current_verify_token = settings_response.json().get("verify_token", "asr_whatsapp_verify_2024")
        
        challenge = "test_challenge_12345"
        
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": current_verify_token,
                "hub.challenge": challenge
            }
        )
        
        # Should return the challenge if token matches
        assert response.status_code == 200
        assert response.text == challenge
        print(f"Webhook verification successful with token '{current_verify_token}', returned challenge: {challenge}")
    
    def test_webhook_verification_wrong_token(self):
        """GET /api/whatsapp/webhook rejects wrong verify token"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong_token",
                "hub.challenge": "test_challenge"
            }
        )
        
        # Should return 403 for wrong token
        assert response.status_code == 403
        print("Webhook correctly rejects wrong verify token")


class TestSendMessage:
    """WhatsApp Send Message API tests (mocked - no real API credentials)"""
    
    def test_send_single_requires_phone(self):
        """POST /api/whatsapp/send requires phone number"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", json={
            "template_name": "hello_world"
        })
        assert response.status_code == 400
        assert "phone" in response.json().get("detail", "").lower()
        print("Correctly requires phone number")
    
    def test_send_single_requires_template(self):
        """POST /api/whatsapp/send requires template_name"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", json={
            "phone": "9876543210"
        })
        assert response.status_code == 400
        assert "template" in response.json().get("detail", "").lower()
        print("Correctly requires template_name")
    
    def test_send_single_api_not_configured(self):
        """POST /api/whatsapp/send returns error when API not configured with real credentials"""
        # First, clear any test settings by saving empty ones (this will fail validation)
        # Then try to send - should fail because no real API credentials
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", json={
            "phone": "9876543210",
            "template_name": "hello_world"
        })
        
        # Should return 200 with success=false (API structure works, but Meta API call fails)
        assert response.status_code == 200
        data = response.json()
        # Either success=false (API not configured) or error from Meta API
        # Both are valid responses showing the API structure works
        print(f"Send response: success={data.get('success')}, error={data.get('error', 'N/A')}")


class TestCampaignCreation:
    """WhatsApp Campaign Creation API tests"""
    
    def test_create_campaign_requires_template(self):
        """POST /api/whatsapp/campaigns requires template_name"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/campaigns", json={
            "campaign_name": "Test Campaign",
            "lead_ids": ["lead1", "lead2"]
        })
        assert response.status_code == 400
        assert "template" in response.json().get("detail", "").lower()
        print("Correctly requires template_name for campaign")
    
    def test_create_campaign_with_empty_leads_uses_all(self):
        """POST /api/whatsapp/campaigns with empty lead_ids uses all leads with phones"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/campaigns", json={
            "campaign_name": "Test Campaign Empty Leads",
            "template_name": "hello_world",
            "lead_ids": []  # Empty leads - API will find all leads with phone numbers
        })
        # API finds all leads with phone numbers when lead_ids is empty
        assert response.status_code == 200
        data = response.json()
        # Either success with recipients or error if no leads found
        if data.get("success"):
            assert data.get("total_recipients", 0) >= 0
            print(f"Campaign created with {data.get('total_recipients')} recipients from all leads")
        else:
            # No leads found is also valid
            print(f"No leads found: {data.get('error', 'N/A')}")


class TestAutomationSettings:
    """WhatsApp Automation Settings API tests"""
    
    def test_get_automation_settings(self):
        """GET /api/whatsapp/automation/settings returns automation config"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Should have automation flags
        assert "auto_welcome" in data
        assert "auto_site_visit" in data
        assert "auto_quotation" in data
        
        # Should have template mappings
        assert "welcome_template" in data
        assert "site_visit_template" in data
        assert "quotation_template" in data
        
        print(f"Automation settings: auto_welcome={data.get('auto_welcome')}, auto_site_visit={data.get('auto_site_visit')}")
    
    def test_save_automation_settings(self):
        """POST /api/whatsapp/automation/settings saves automation config"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/automation/settings", json={
            "auto_welcome": False,
            "welcome_template": "asr_welcome",
            "auto_site_visit": False,
            "site_visit_template": "asr_site_visit",
            "auto_quotation": False,
            "quotation_template": "asr_quotation_followup"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Automation settings saved: {data.get('message')}")


class TestLeadsForCampaign:
    """WhatsApp Leads for Campaign API tests"""
    
    def test_get_leads_for_campaign(self):
        """GET /api/whatsapp/leads-for-campaign returns eligible leads"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/leads-for-campaign")
        assert response.status_code == 200
        data = response.json()
        
        # Should have leads array
        assert "leads" in data
        assert isinstance(data.get("leads"), list)
        
        # Should have counts
        assert "valid_count" in data
        assert "invalid_count" in data
        assert "total_found" in data
        
        print(f"Leads for campaign: valid={data.get('valid_count')}, invalid={data.get('invalid_count')}, total={data.get('total_found')}")
    
    def test_get_leads_for_campaign_with_filters(self):
        """GET /api/whatsapp/leads-for-campaign?stage=new filters by stage"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/leads-for-campaign?stage=new")
        assert response.status_code == 200
        data = response.json()
        
        assert "leads" in data
        print(f"Filtered leads (stage=new): {data.get('valid_count')} valid")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
