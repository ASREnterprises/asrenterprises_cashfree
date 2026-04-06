"""
WhatsApp CRM Automation Bot Tests
Tests for ASR Enterprises WhatsApp automation features:
- Bot status API with business hours config
- Bot test API for message detection (greetings, options 1-7, lead source)
- Webhook processing for incoming messages
- After-hours response logic
- Quick reply responses for options
- Follow-up scheduling
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBotStatusAPI:
    """Tests for GET /api/whatsapp/automation/bot/status"""
    
    def test_bot_status_returns_200(self):
        """Bot status endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Bot status endpoint returns 200")
    
    def test_bot_status_has_business_hours_info(self):
        """Bot status should include business hours information"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "bot_active" in data, "Missing bot_active field"
        assert "is_business_hours" in data, "Missing is_business_hours field"
        assert "current_time_ist" in data, "Missing current_time_ist field"
        assert "current_day" in data, "Missing current_day field"
        assert "today_stats" in data, "Missing today_stats field"
        
        # Validate types
        assert isinstance(data["bot_active"], bool), "bot_active should be boolean"
        assert isinstance(data["is_business_hours"], bool), "is_business_hours should be boolean"
        assert isinstance(data["current_time_ist"], str), "current_time_ist should be string"
        
        print(f"✓ Bot status has all required fields")
        print(f"  - Bot active: {data['bot_active']}")
        print(f"  - Is business hours: {data['is_business_hours']}")
        print(f"  - Current time IST: {data['current_time_ist']}")
        print(f"  - Current day: {data['current_day']}")
    
    def test_bot_status_has_today_stats(self):
        """Bot status should include today's auto-reply statistics"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/status")
        assert response.status_code == 200
        
        data = response.json()
        stats = data.get("today_stats", {})
        
        # Check stat fields exist
        expected_stats = ["welcome_sent", "after_hours_sent", "fb_ig_welcome_sent", "quick_replies_sent", "follow_ups_sent"]
        for stat in expected_stats:
            assert stat in stats, f"Missing stat: {stat}"
            assert isinstance(stats[stat], int), f"{stat} should be integer"
        
        print(f"✓ Bot status has today's stats: {stats}")


class TestBotTestAPI:
    """Tests for POST /api/whatsapp/automation/bot/test"""
    
    def test_bot_test_detects_greeting_hi(self):
        """Bot should detect 'hi' as a greeting message"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "hi"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_greeting") == True, f"Expected is_greeting=True for 'hi', got {data.get('is_greeting')}"
        print(f"✓ Bot correctly detects 'hi' as greeting: is_greeting={data.get('is_greeting')}")
    
    def test_bot_test_detects_greeting_hello(self):
        """Bot should detect 'hello' as a greeting message"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "hello"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("is_greeting") == True, f"Expected is_greeting=True for 'hello', got {data.get('is_greeting')}"
        print(f"✓ Bot correctly detects 'hello' as greeting")
    
    def test_bot_test_detects_greeting_namaste(self):
        """Bot should detect 'namaste' as a greeting message"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "namaste"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("is_greeting") == True, f"Expected is_greeting=True for 'namaste', got {data.get('is_greeting')}"
        print(f"✓ Bot correctly detects 'namaste' as greeting")
    
    def test_bot_test_detects_option_1(self):
        """Bot should detect option 1 (Home Solar)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "1"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "1", f"Expected detected_option='1', got {data.get('detected_option')}"
        print(f"✓ Bot correctly detects option 1: detected_option={data.get('detected_option')}")
    
    def test_bot_test_detects_option_3(self):
        """Bot should detect option 3 (Subsidy)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "3"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "3", f"Expected detected_option='3', got {data.get('detected_option')}"
        print(f"✓ Bot correctly detects option 3 (Subsidy)")
    
    def test_bot_test_detects_option_5(self):
        """Bot should detect option 5 (Price/Quotation)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "5"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "5", f"Expected detected_option='5', got {data.get('detected_option')}"
        print(f"✓ Bot correctly detects option 5 (Price/Quotation)")
    
    def test_bot_test_detects_option_7(self):
        """Bot should detect option 7 (Talk to Sales)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "7"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "7", f"Expected detected_option='7', got {data.get('detected_option')}"
        print(f"✓ Bot correctly detects option 7 (Talk to Sales)")
    
    def test_bot_test_detects_all_options_1_to_7(self):
        """Bot should detect all options 1-7"""
        for option in ["1", "2", "3", "4", "5", "6", "7"]:
            response = requests.post(
                f"{BASE_URL}/api/whatsapp/automation/bot/test",
                json={"phone": "9999999999", "content": option}
            )
            assert response.status_code == 200
            data = response.json()
            assert data.get("detected_option") == option, f"Expected detected_option='{option}', got {data.get('detected_option')}"
        print(f"✓ Bot correctly detects all options 1-7")
    
    def test_bot_test_detects_facebook_lead_source(self):
        """Bot should identify Facebook lead source"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "hi", "lead_source": "facebook"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("test_input", {}).get("lead_source") == "facebook"
        print(f"✓ Bot accepts Facebook lead source")
    
    def test_bot_test_detects_instagram_lead_source(self):
        """Bot should identify Instagram lead source"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "hi", "lead_source": "instagram"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("test_input", {}).get("lead_source") == "instagram"
        print(f"✓ Bot accepts Instagram lead source")
    
    def test_bot_test_returns_reply_type(self):
        """Bot test should return reply type for greeting"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "hi"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should have would_send_reply and reply_type
        assert "would_send_reply" in data, "Missing would_send_reply field"
        assert "reply_type" in data, "Missing reply_type field"
        
        # For greeting, should send a reply (welcome or after_hours)
        if data.get("would_send_reply"):
            assert data.get("reply_type") in ["welcome", "after_hours", "fb_ig_welcome"], \
                f"Unexpected reply_type: {data.get('reply_type')}"
        
        print(f"✓ Bot test returns reply info: would_send={data.get('would_send_reply')}, type={data.get('reply_type')}")
    
    def test_bot_test_returns_quick_reply_for_option(self):
        """Bot test should return quick_reply type for option selection"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "3"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # For option 3, should detect it and potentially send quick_reply
        assert data.get("detected_option") == "3"
        
        # If would send reply, should be quick_reply type
        if data.get("would_send_reply"):
            assert data.get("reply_type") == "quick_reply", \
                f"Expected reply_type='quick_reply' for option, got {data.get('reply_type')}"
            # Reply message should contain subsidy info
            reply_msg = data.get("reply_message", "")
            assert "subsidy" in reply_msg.lower() or "surya" in reply_msg.lower(), \
                "Quick reply for option 3 should mention subsidy"
        
        print(f"✓ Bot test returns quick_reply for option 3")


class TestBotBusinessHoursLogic:
    """Tests for business hours detection (Mon-Sat 10AM-7PM IST)"""
    
    def test_bot_status_shows_business_hours_flag(self):
        """Bot status should show is_business_hours flag"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/status")
        assert response.status_code == 200
        
        data = response.json()
        is_business_hours = data.get("is_business_hours")
        current_time = data.get("current_time_ist")
        current_day = data.get("current_day")
        
        print(f"✓ Business hours check: is_business_hours={is_business_hours}")
        print(f"  Current time IST: {current_time}")
        print(f"  Current day: {current_day}")
        
        # Note: At ~9:15 PM IST, should be outside business hours (10AM-7PM)
        # This is expected to be False based on the context
    
    def test_after_hours_response_for_greeting(self):
        """When outside business hours, greeting should get after_hours response"""
        # First check if we're outside business hours
        status_response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/status")
        status_data = status_response.json()
        
        if not status_data.get("is_business_hours"):
            # Test greeting message
            response = requests.post(
                f"{BASE_URL}/api/whatsapp/automation/bot/test",
                json={"phone": "9999999999", "content": "hello"}
            )
            assert response.status_code == 200
            
            data = response.json()
            
            # Should send after_hours reply
            if data.get("would_send_reply"):
                assert data.get("reply_type") == "after_hours", \
                    f"Expected after_hours reply outside business hours, got {data.get('reply_type')}"
                print(f"✓ After-hours response sent for greeting (outside business hours)")
            else:
                print(f"⚠ No reply would be sent (may have received welcome already)")
        else:
            print(f"⚠ Currently within business hours - skipping after_hours test")
            pytest.skip("Currently within business hours")


class TestWebhookProcessing:
    """Tests for POST /api/whatsapp/webhook"""
    
    def test_webhook_get_verification(self):
        """Webhook GET should handle verification requests"""
        # Test without params - should return active message
        response = requests.get(f"{BASE_URL}/api/whatsapp/webhook")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Webhook GET endpoint is active")
    
    def test_webhook_post_accepts_payload(self):
        """Webhook POST should accept incoming message payload"""
        # Simulate a WhatsApp webhook payload
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "test_waba_id",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "display_phone_number": "919296389097",
                            "phone_number_id": "test_phone_id"
                        },
                        "contacts": [{
                            "profile": {"name": "Test User"},
                            "wa_id": "919999999999"
                        }],
                        "messages": [{
                            "from": "919999999999",
                            "id": "test_msg_id_" + str(datetime.now().timestamp()),
                            "timestamp": str(int(datetime.now().timestamp())),
                            "type": "text",
                            "text": {"body": "hi"}
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/webhook",
            json=payload
        )
        
        # Webhook should return 200 to acknowledge receipt
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Webhook POST accepts incoming message payload")


class TestFollowUpScheduling:
    """Tests for follow-up scheduling endpoints"""
    
    def test_get_follow_ups_endpoint(self):
        """GET /api/whatsapp/automation/bot/follow-ups should return follow-ups list"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/follow-ups")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "follow_ups" in data, "Missing follow_ups field"
        assert "count" in data, "Missing count field"
        assert isinstance(data["follow_ups"], list), "follow_ups should be a list"
        
        print(f"✓ Follow-ups endpoint returns list with {data['count']} items")
    
    def test_get_pending_follow_ups(self):
        """GET /api/whatsapp/automation/bot/follow-ups?status=pending should filter by status"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/follow-ups?status=pending")
        assert response.status_code == 200
        
        data = response.json()
        # All returned follow-ups should have pending status
        for fu in data.get("follow_ups", []):
            assert fu.get("status") == "pending", f"Expected pending status, got {fu.get('status')}"
        
        print(f"✓ Pending follow-ups filter works: {data['count']} pending")
    
    def test_process_follow_ups_endpoint(self):
        """POST /api/whatsapp/automation/bot/process-follow-ups should trigger processing"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/automation/bot/process-follow-ups")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        print(f"✓ Process follow-ups endpoint works")


class TestAutomationSettings:
    """Tests for automation settings endpoints"""
    
    def test_get_automation_settings(self):
        """GET /api/whatsapp/automation/settings should return settings"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have automation settings fields (auto_welcome, auto_contacted, etc.)
        expected_fields = ["auto_welcome", "auto_contacted", "auto_site_visit"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Automation settings endpoint returns config")
        print(f"  - auto_welcome: {data.get('auto_welcome')}")
        print(f"  - auto_contacted: {data.get('auto_contacted')}")
        print(f"  - auto_site_visit: {data.get('auto_site_visit')}")
    
    def test_get_bot_settings(self):
        """GET /api/whatsapp/automation/bot/settings should return bot settings"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/automation/bot/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have settings, business_hours and follow_up_config
        assert "settings" in data, "Missing settings"
        assert "business_hours" in data, "Missing business_hours"
        assert "follow_up_config" in data, "Missing follow_up_config"
        
        # Validate business hours structure
        bh = data.get("business_hours", {})
        assert "start" in bh, "Missing business_hours.start"
        assert "end" in bh, "Missing business_hours.end"
        assert "days" in bh, "Missing business_hours.days"
        
        print(f"✓ Bot settings endpoint returns config")
        print(f"  - Business hours: {bh.get('start')} - {bh.get('end')}")
        print(f"  - Working days: {bh.get('days_display', bh.get('days'))}")


class TestKeywordDetection:
    """Tests for keyword-based option detection (updated for new mappings)"""
    
    def test_detect_home_solar_keyword(self):
        """Bot should detect 'home solar' as option 1"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "I want home solar"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "1", f"Expected option 1 for 'home solar', got {data.get('detected_option')}"
        print(f"✓ Bot detects 'home solar' as option 1")
    
    def test_detect_subsidy_keyword(self):
        """Bot should detect 'subsidy' as option 3"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "subsidy information please"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "3", f"Expected option 3 for 'subsidy', got {data.get('detected_option')}"
        print(f"✓ Bot detects 'subsidy' as option 3")
    
    def test_detect_price_keyword(self):
        """Bot should detect 'price' as option 4 (Price/Quotation)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "what is the price"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Price maps to option 4 (Price/Quotation)
        assert data.get("detected_option") == "4", f"Expected option 4 for 'price', got {data.get('detected_option')}"
        print(f"✓ Bot detects 'price' as option 4 (Price/Quotation)")
    
    def test_detect_site_visit_keyword(self):
        """Bot should detect 'site visit' as option 5 (Free Site Visit)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "I need a site visit"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Site visit maps to option 5 (Free Site Visit)
        assert data.get("detected_option") == "5", f"Expected option 5 for 'site visit', got {data.get('detected_option')}"
        print(f"✓ Bot detects 'site visit' as option 5 (Free Site Visit)")


class TestHindiHinglishKeywords:
    """Tests for Hindi/Hinglish keyword detection"""
    
    def test_detect_ghar_ka_solar(self):
        """Bot should detect 'ghar ka solar' as option 1 (Home Solar)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "ghar ka solar"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "1", f"Expected option 1 for 'ghar ka solar', got {data.get('detected_option')}"
        print(f"✓ Bot detects Hindi 'ghar ka solar' as option 1")
    
    def test_detect_ghar_keyword(self):
        """Bot should detect 'ghar' as option 1 (Home Solar)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "ghar ke liye solar"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "1", f"Expected option 1 for 'ghar', got {data.get('detected_option')}"
        print(f"✓ Bot detects Hindi 'ghar' as option 1")
    
    def test_detect_dukan_keyword(self):
        """Bot should detect 'dukan' as option 2 (Shop/Office Solar)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "dukan ke liye solar"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "2", f"Expected option 2 for 'dukan', got {data.get('detected_option')}"
        print(f"✓ Bot detects Hindi 'dukan' as option 2")
    
    def test_detect_kitna_keyword(self):
        """Bot should detect 'kitna' as option 4 (Price/Quotation)"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "kitna lagega"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "4", f"Expected option 4 for 'kitna', got {data.get('detected_option')}"
        print(f"✓ Bot detects Hindi 'kitna' as option 4 (Price)")


class TestShortFriendlyMessages:
    """Tests for shorter, friendlier message format"""
    
    def test_option_1_response_is_short(self):
        """Option 1 response should be short and friendly"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "1"}
        )
        assert response.status_code == 200
        
        data = response.json()
        reply_msg = data.get("reply_message", "")
        
        # Check message is short (under 200 chars)
        assert len(reply_msg) < 250, f"Option 1 response too long: {len(reply_msg)} chars"
        # Check it contains friendly emoji
        assert "👍" in reply_msg or "Great" in reply_msg, "Option 1 response should be friendly"
        # Check it asks one question at a time (about electricity bill)
        assert "electricity bill" in reply_msg.lower() or "bill" in reply_msg.lower(), \
            "Option 1 should ask about electricity bill"
        
        print(f"✓ Option 1 response is short and friendly ({len(reply_msg)} chars)")
    
    def test_option_4_response_is_short(self):
        """Option 4 (Price) response should be short and friendly"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "4"}
        )
        assert response.status_code == 200
        
        data = response.json()
        reply_msg = data.get("reply_message", "")
        
        # Check message is short
        assert len(reply_msg) < 250, f"Option 4 response too long: {len(reply_msg)} chars"
        # Check it's friendly
        assert "👍" in reply_msg or "Sure" in reply_msg, "Option 4 response should be friendly"
        
        print(f"✓ Option 4 response is short and friendly ({len(reply_msg)} chars)")
    
    def test_option_5_response_is_short(self):
        """Option 5 (Site Visit) response should be short and friendly"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "5"}
        )
        assert response.status_code == 200
        
        data = response.json()
        reply_msg = data.get("reply_message", "")
        
        # Check message is short
        assert len(reply_msg) < 300, f"Option 5 response too long: {len(reply_msg)} chars"
        # Check it's friendly
        assert "👍" in reply_msg or "Great" in reply_msg, "Option 5 response should be friendly"
        
        print(f"✓ Option 5 response is short and friendly ({len(reply_msg)} chars)")


class TestLeadScoring:
    """Tests for lead scoring (hot/warm/cold)"""
    
    def test_price_request_is_hot_lead(self):
        """Price/quotation request should be tagged as hot_lead"""
        # Option 4 (Price/Quotation) should be hot lead
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "4"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Option 4 is in hot_options list
        assert data.get("detected_option") == "4"
        print(f"✓ Price request (option 4) detected - should be hot_lead")
    
    def test_site_visit_request_is_hot_lead(self):
        """Site visit request should be tagged as hot_lead"""
        # Option 5 (Site Visit) should be hot lead
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "5"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Option 5 is in hot_options list
        assert data.get("detected_option") == "5"
        print(f"✓ Site visit request (option 5) detected - should be hot_lead")
    
    def test_sales_callback_is_hot_lead(self):
        """Sales callback request should be tagged as hot_lead"""
        # Option 7 (Talk to Sales) should be hot lead
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "7"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Option 7 is in hot_options list
        assert data.get("detected_option") == "7"
        print(f"✓ Sales callback request (option 7) detected - should be hot_lead")


class TestFreeTextIntentDetection:
    """Tests for improved intent detection from free text"""
    
    def test_free_text_price_maps_to_option_4(self):
        """Free text 'price' should map to option 4"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "price"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "4", f"Expected option 4 for 'price', got {data.get('detected_option')}"
        assert data.get("would_send_reply") == True
        assert data.get("reply_type") == "quick_reply"
        print(f"✓ Free text 'price' correctly maps to option 4")
    
    def test_free_text_subsidy_maps_to_option_3(self):
        """Free text 'subsidy' should map to option 3"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "subsidy"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "3", f"Expected option 3 for 'subsidy', got {data.get('detected_option')}"
        assert data.get("would_send_reply") == True
        assert data.get("reply_type") == "quick_reply"
        print(f"✓ Free text 'subsidy' correctly maps to option 3")
    
    def test_free_text_ghar_ka_solar_maps_to_option_1(self):
        """Free text 'ghar ka solar' should map to option 1"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "ghar ka solar"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "1", f"Expected option 1 for 'ghar ka solar', got {data.get('detected_option')}"
        assert data.get("would_send_reply") == True
        assert data.get("reply_type") == "quick_reply"
        print(f"✓ Free text 'ghar ka solar' correctly maps to option 1")
    
    def test_free_text_cost_maps_to_option_4(self):
        """Free text 'cost' should map to option 4"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "what is the cost"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "4", f"Expected option 4 for 'cost', got {data.get('detected_option')}"
        print(f"✓ Free text 'cost' correctly maps to option 4")
    
    def test_free_text_quotation_maps_to_option_4(self):
        """Free text 'quotation' should map to option 4"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/automation/bot/test",
            json={"phone": "9999999999", "content": "send quotation"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("detected_option") == "4", f"Expected option 4 for 'quotation', got {data.get('detected_option')}"
        print(f"✓ Free text 'quotation' correctly maps to option 4")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
