"""
Test file for ASR Enterprises Solar CRM - New Features
Testing: WhatsApp Integration, AI Auto-Assign, Follow-up Reminders, Notifications, OTP Login
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200
        data = response.json()
        assert "districts" in data
        print(f"✅ API health check passed - {len(data['districts'])} districts available")

class TestStaffOTPLogin:
    """Staff OTP Login flow tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure test staff exists"""
        # Check if ASR1001 exists
        response = requests.get(f"{BASE_URL}/api/staff/profile/ASR1001")
        if response.status_code == 404:
            # Create test staff
            requests.post(f"{BASE_URL}/api/staff/register", json={
                "name": "Test Staff",
                "email": "test@asr.com",
                "phone": "9876543210",
                "role": "sales",
                "password": "asr@123",
                "custom_staff_id": "ASR1001"
            })
    
    def test_staff_send_otp(self):
        """Test POST /api/staff/send-otp - Staff OTP request"""
        response = requests.post(f"{BASE_URL}/api/staff/send-otp", json={
            "staff_id": "ASR1001"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "email_sent" in data
        # RESEND_API_KEY not configured - email_sent should be False
        print(f"✅ Staff OTP send: success={data['success']}, email_sent={data.get('email_sent')}, message={data.get('message')}")
    
    def test_staff_send_otp_invalid_id(self):
        """Test OTP request with invalid staff ID"""
        response = requests.post(f"{BASE_URL}/api/staff/send-otp", json={
            "staff_id": "INVALID999"
        })
        assert response.status_code == 404
        print("✅ Invalid staff ID correctly returns 404")
    
    def test_staff_verify_otp_fallback(self):
        """Test POST /api/staff/verify-otp with fallback OTP 131993"""
        # First send OTP
        requests.post(f"{BASE_URL}/api/staff/send-otp", json={"staff_id": "ASR1001"})
        
        # Verify with fallback OTP (131993 works when RESEND_API_KEY not configured)
        response = requests.post(f"{BASE_URL}/api/staff/verify-otp", json={
            "staff_id": "ASR1001",
            "otp": "131993"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "staff" in data
        assert "token" in data
        print(f"✅ Staff OTP verify with fallback (131993): Logged in as {data['staff'].get('name')}")
    
    def test_staff_verify_otp_invalid(self):
        """Test OTP verification with wrong OTP"""
        requests.post(f"{BASE_URL}/api/staff/send-otp", json={"staff_id": "ASR1001"})
        
        response = requests.post(f"{BASE_URL}/api/staff/verify-otp", json={
            "staff_id": "ASR1001",
            "otp": "000000"
        })
        assert response.status_code == 401
        print("✅ Invalid OTP correctly returns 401")

class TestAdminOTPLogin:
    """Admin OTP Login tests"""
    
    def test_admin_send_otp(self):
        """Test POST /api/admin/send-otp"""
        response = requests.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "asrenterprisespatna@gmail.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "email_sent" in data
        print(f"✅ Admin OTP send: success={data['success']}, email_sent={data.get('email_sent')}")
    
    def test_admin_send_otp_unauthorized_email(self):
        """Test OTP request with unauthorized email"""
        response = requests.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "unauthorized@example.com"
        })
        assert response.status_code == 403
        print("✅ Unauthorized email correctly returns 403")
    
    def test_admin_verify_otp_fallback(self):
        """Test admin OTP verification with fallback 131993"""
        requests.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "asrenterprisespatna@gmail.com"
        })
        
        response = requests.post(f"{BASE_URL}/api/admin/verify-otp", json={
            "email": "asrenterprisespatna@gmail.com",
            "otp": "131993"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("role") == "admin"
        print(f"✅ Admin OTP verify with fallback (131993): role={data.get('role')}")

class TestAIAutoAssignment:
    """AI Auto Lead Assignment tests"""
    
    @pytest.fixture
    def test_lead_id(self):
        """Create a test lead and return its ID"""
        lead_data = {
            "name": "TEST_AutoAssign Lead",
            "email": "test_autoassign@test.com",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 3000,
            "address": "Test Address",
            "source": "website"
        }
        response = requests.post(f"{BASE_URL}/api/crm/leads", json=lead_data)
        if response.status_code == 200:
            lead_id = response.json().get("id")
            # Unassign the lead for testing
            requests.put(f"{BASE_URL}/api/crm/leads/{lead_id}", json={"assigned_to": None})
            yield lead_id
            # Cleanup
            requests.delete(f"{BASE_URL}/api/crm/leads/{lead_id}")
        else:
            pytest.skip("Could not create test lead")
    
    def test_auto_assign_single_lead(self, test_lead_id):
        """Test POST /api/crm/leads/{lead_id}/auto-assign"""
        response = requests.post(f"{BASE_URL}/api/crm/leads/{test_lead_id}/auto-assign")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("success"):
            assert "assigned_to" in data
            assert "assigned_name" in data
            assert "assignment_reason" in data
            assert "whatsapp_notification_url" in data
            print(f"✅ Auto-assign: {data['assigned_name']} ({data['assignment_reason']})")
            print(f"   WhatsApp URL starts with: {data['whatsapp_notification_url'][:50]}...")
        else:
            # May already be assigned or no staff available
            print(f"⚠️ Auto-assign returned: {data.get('message')}")
    
    def test_auto_assign_already_assigned(self):
        """Test auto-assign on already assigned lead returns appropriate message"""
        # Get a lead that's already assigned
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        leads = response.json()
        assigned_leads = [l for l in leads if l.get("assigned_to")]
        
        if assigned_leads:
            lead_id = assigned_leads[0].get("id")
            response = requests.post(f"{BASE_URL}/api/crm/leads/{lead_id}/auto-assign")
            data = response.json()
            assert data.get("success") == False or data.get("message") == "Lead already assigned"
            print(f"✅ Already assigned lead handled correctly: {data.get('message')}")
        else:
            pytest.skip("No assigned leads to test")
    
    def test_bulk_auto_assign_all(self):
        """Test POST /api/crm/leads/auto-assign-all"""
        response = requests.post(f"{BASE_URL}/api/crm/leads/auto-assign-all")
        assert response.status_code == 200
        data = response.json()
        assert "total_processed" in data
        assert "successful" in data
        print(f"✅ Bulk auto-assign: Processed {data['total_processed']}, Successful {data['successful']}")
        if data.get("results"):
            for r in data["results"][:3]:  # Show first 3 results
                print(f"   - {r.get('name')}: {r.get('assignment_reason', 'N/A') if r.get('success') else r.get('message', 'failed')}")

class TestWhatsAppQuoteIntegration:
    """WhatsApp Quote URL generation tests"""
    
    @pytest.fixture
    def existing_lead_id(self):
        """Get an existing lead ID or create one"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        if response.status_code == 200:
            leads = response.json()
            if leads:
                return leads[0].get("id")
        # Create one if none exists
        lead_data = {
            "name": "TEST_WhatsApp Lead",
            "email": "test_whatsapp@test.com",
            "phone": "9876543210",
            "district": "Patna",
            "property_type": "residential",
            "monthly_bill": 4000
        }
        response = requests.post(f"{BASE_URL}/api/crm/leads", json=lead_data)
        return response.json().get("id")
    
    def test_send_quote_whatsapp(self, existing_lead_id):
        """Test POST /api/crm/leads/{lead_id}/send-quote-whatsapp"""
        quote_data = {
            "system_size": "5kW",
            "total_cost": 350000,
            "subsidy": 78000,
            "final_cost": 272000,
            "monthly_savings": 4500
        }
        response = requests.post(f"{BASE_URL}/api/crm/leads/{existing_lead_id}/send-quote-whatsapp", json=quote_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "whatsapp_url" in data
        whatsapp_url = data["whatsapp_url"]
        assert whatsapp_url.startswith("https://wa.me/")
        assert "text=" in whatsapp_url
        print(f"✅ WhatsApp Quote URL generated: {whatsapp_url[:80]}...")
    
    def test_send_quote_invalid_lead(self):
        """Test quote generation for non-existent lead"""
        response = requests.post(f"{BASE_URL}/api/crm/leads/invalid-id-12345/send-quote-whatsapp", json={
            "system_size": "3kW",
            "total_cost": 210000
        })
        assert response.status_code == 404
        print("✅ Invalid lead ID returns 404")

class TestNotificationsSystem:
    """In-app Notifications tests"""
    
    def test_get_staff_notifications(self):
        """Test GET /api/staff/{staff_id}/notifications"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1001/notifications")
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"✅ Notifications retrieved: {len(data['notifications'])} total, {data['unread_count']} unread")
        if data['notifications']:
            notif = data['notifications'][0]
            print(f"   Latest: {notif.get('title')} ({notif.get('type')})")
    
    def test_mark_notification_read(self):
        """Test PUT /api/staff/{staff_id}/notifications/{id}/read"""
        # Get notifications first
        response = requests.get(f"{BASE_URL}/api/staff/ASR1001/notifications")
        data = response.json()
        
        if data['notifications']:
            notif_id = data['notifications'][0].get("id")
            response = requests.put(f"{BASE_URL}/api/staff/ASR1001/notifications/{notif_id}/read")
            assert response.status_code == 200
            assert response.json().get("success") == True
            print(f"✅ Notification marked as read: {notif_id}")
        else:
            print("⚠️ No notifications to mark as read")
    
    def test_mark_all_notifications_read(self):
        """Test PUT /api/staff/{staff_id}/notifications/read-all"""
        response = requests.put(f"{BASE_URL}/api/staff/ASR1001/notifications/read-all")
        assert response.status_code == 200
        assert response.json().get("success") == True
        print("✅ All notifications marked as read")

class TestFollowUpSystem:
    """Follow-up Reminders tests"""
    
    @pytest.fixture
    def test_followup_data(self):
        """Get lead and staff IDs for followup test"""
        # Get a lead
        leads_res = requests.get(f"{BASE_URL}/api/crm/leads")
        leads = leads_res.json() if leads_res.status_code == 200 else []
        
        # Get staff
        staff_res = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        staff = staff_res.json() if staff_res.status_code == 200 else []
        
        if leads and staff:
            return {
                "lead_id": leads[0].get("id"),
                "employee_id": staff[0].get("id")
            }
        pytest.skip("Need at least one lead and one staff member")
    
    def test_create_followup(self, test_followup_data):
        """Test POST /api/crm/followups - creates follow-up with notification"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        followup_data = {
            "lead_id": test_followup_data["lead_id"],
            "employee_id": test_followup_data["employee_id"],
            "reminder_date": tomorrow,
            "reminder_time": "11:00",
            "reminder_type": "call",
            "notes": "TEST_Followup - Test call reminder"
        }
        response = requests.post(f"{BASE_URL}/api/crm/followups", json=followup_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get("id") is not None
        assert data.get("lead_id") == test_followup_data["lead_id"]
        print(f"✅ Follow-up created: {data.get('id')} for {tomorrow} at 11:00")
    
    def test_get_todays_followups(self):
        """Test GET /api/crm/followups/today - with WhatsApp URLs"""
        response = requests.get(f"{BASE_URL}/api/crm/followups/today")
        assert response.status_code == 200
        data = response.json()
        # Response can be empty list if no followups today
        print(f"✅ Today's followups: {len(data)} found")
        if data:
            fu = data[0]
            print(f"   First followup has whatsapp URLs: staff={bool(fu.get('staff_whatsapp_url'))}, customer={bool(fu.get('customer_whatsapp_url'))}")
    
    def test_get_all_followups(self):
        """Test GET /api/crm/followups"""
        response = requests.get(f"{BASE_URL}/api/crm/followups")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ All followups retrieved: {len(data)}")

class TestCRMDashboardFeatures:
    """CRM Dashboard related endpoint tests"""
    
    def test_crm_dashboard(self):
        """Test GET /api/crm/dashboard"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data
        assert "pipeline_stats" in data
        print(f"✅ CRM Dashboard: {data.get('total_leads')} leads, Pipeline: {data.get('pipeline_stats')}")
    
    def test_staff_accounts_list(self):
        """Test GET /api/admin/staff-accounts"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Staff accounts: {len(data)} found")
        if data:
            print(f"   First staff: {data[0].get('staff_id')} - {data[0].get('name')}")
    
    def test_crm_leads_list(self):
        """Test GET /api/crm/leads"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ CRM Leads: {len(data)} found")
        if data:
            # Check for assigned status
            assigned = sum(1 for l in data if l.get("assigned_to"))
            print(f"   Assigned: {assigned}, Unassigned: {len(data) - assigned}")

class TestStaffPasswordLogin:
    """Staff password-based login tests"""
    
    def test_staff_login_success(self):
        """Test POST /api/staff/login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "asr@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        assert "staff" in data
        print(f"✅ Staff login successful: {data['staff'].get('name')} (token: {data['token'][:20]}...)")
    
    def test_staff_login_invalid(self):
        """Test staff login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1001",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid password correctly returns 401")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
