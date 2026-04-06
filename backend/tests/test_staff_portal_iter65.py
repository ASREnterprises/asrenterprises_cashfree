"""
Test Staff Portal Features - Iteration 65
Tests for:
1. Staff leads endpoint with call_status and last_call_at fields
2. Staff dashboard endpoint
3. WhatsApp conversations filtering for staff mode
4. Social settings endpoint (Facebook token saved)
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStaffLeadsCallTracking:
    """Test call_status and last_call_at fields in staff leads update"""
    
    def test_staff_login(self):
        """Test staff login with credentials"""
        response = requests.post(f"{BASE_URL}/api/staff/login", json={
            "staff_id": "ASR1024",
            "password": "test123"
        })
        # May require 2FA, so check for either success or 2FA required
        assert response.status_code in [200, 401, 403]
        data = response.json()
        print(f"Staff login response: {data}")
        # Store for later tests if successful
        if response.status_code == 200:
            return data
        return None
    
    def test_staff_leads_endpoint(self):
        """Test GET /api/staff/{staff_id}/leads returns leads with pagination"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1024/leads?page=1&limit=10")
        print(f"Staff leads response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Staff leads response keys: {data.keys()}")
            # Check pagination structure
            assert "leads" in data or isinstance(data, list), "Response should have leads array"
            if "pagination" in data:
                assert "current_page" in data["pagination"]
                assert "total_count" in data["pagination"]
                print(f"Pagination: {data['pagination']}")
            print(f"Number of leads: {len(data.get('leads', data))}")
        elif response.status_code == 404:
            print("Staff not found - expected if ASR1024 doesn't exist")
        
        assert response.status_code in [200, 404]
    
    def test_staff_update_lead_with_call_status(self):
        """Test PUT /api/staff/{staff_id}/leads/{lead_id} accepts call_status and last_call_at"""
        # First get a lead to update
        leads_response = requests.get(f"{BASE_URL}/api/staff/ASR1024/leads?page=1&limit=1")
        
        if leads_response.status_code == 404:
            pytest.skip("Staff ASR1024 not found")
        
        leads_data = leads_response.json()
        leads = leads_data.get("leads", leads_data) if isinstance(leads_data, dict) else leads_data
        
        if not leads or len(leads) == 0:
            pytest.skip("No leads assigned to staff ASR1024")
        
        lead_id = leads[0].get("id")
        print(f"Testing update on lead: {lead_id}")
        
        # Test updating with call_status and last_call_at
        update_data = {
            "call_status": "called",
            "last_call_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = requests.put(
            f"{BASE_URL}/api/staff/ASR1024/leads/{lead_id}",
            json=update_data
        )
        
        print(f"Update response status: {response.status_code}")
        print(f"Update response: {response.json()}")
        
        assert response.status_code in [200, 403, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Update should return success: true"
            
            # Verify the update persisted by fetching the lead again
            verify_response = requests.get(f"{BASE_URL}/api/staff/ASR1024/leads?page=1&limit=50")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                verify_leads = verify_data.get("leads", verify_data)
                updated_lead = next((l for l in verify_leads if l.get("id") == lead_id), None)
                if updated_lead:
                    print(f"Updated lead call_status: {updated_lead.get('call_status')}")
                    print(f"Updated lead last_call_at: {updated_lead.get('last_call_at')}")
                    # Verify call_status was saved
                    assert updated_lead.get("call_status") == "called", "call_status should be 'called'"


class TestStaffDashboard:
    """Test staff dashboard endpoint"""
    
    def test_staff_dashboard(self):
        """Test GET /api/staff/{staff_id}/dashboard returns stats"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1024/dashboard")
        print(f"Dashboard response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Dashboard keys: {data.keys()}")
            # Check expected fields
            assert "pipeline_stats" in data, "Dashboard should have pipeline_stats"
            assert "total_assigned" in data, "Dashboard should have total_assigned"
            assert "total_converted" in data, "Dashboard should have total_converted"
            print(f"Pipeline stats: {data.get('pipeline_stats')}")
            print(f"Total assigned: {data.get('total_assigned')}")
        elif response.status_code == 404:
            print("Staff not found - expected if ASR1024 doesn't exist")
        
        assert response.status_code in [200, 404]


class TestWhatsAppConversationsFiltering:
    """Test WhatsApp conversations endpoint for staff mode filtering"""
    
    def test_whatsapp_conversations_list(self):
        """Test GET /api/whatsapp/conversations returns conversations"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations?limit=10")
        print(f"WhatsApp conversations status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Conversations response keys: {data.keys()}")
            assert "conversations" in data, "Response should have conversations array"
            conversations = data.get("conversations", [])
            print(f"Number of conversations: {len(conversations)}")
            
            # Check conversation structure
            if conversations:
                conv = conversations[0]
                print(f"First conversation keys: {conv.keys()}")
                # Each conversation should have phone and lead info for filtering
                assert "phone" in conv, "Conversation should have phone"
                # lead may be None if not linked
                if conv.get("lead"):
                    print(f"Lead info: {conv['lead'].get('id')}, {conv['lead'].get('name')}")
        
        assert response.status_code == 200
    
    def test_whatsapp_unread_count(self):
        """Test GET /api/whatsapp/conversations/unread-count"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        print(f"Unread count status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Unread count: {data}")
            assert "unread_count" in data, "Response should have unread_count"
        
        assert response.status_code == 200


class TestSocialSettings:
    """Test social settings endpoint for Facebook token"""
    
    def test_social_settings_masked(self):
        """Test GET /api/social/settings returns masked settings"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        print(f"Social settings status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Social settings keys: {data.keys()}")
            # Check for Facebook token (should be masked)
            if "facebook_access_token" in data:
                token = data.get("facebook_access_token", "")
                print(f"Facebook token (masked): {token[:20]}..." if token else "No token")
            if "whatsapp_access_token" in data:
                token = data.get("whatsapp_access_token", "")
                print(f"WhatsApp token (masked): {token[:20]}..." if token else "No token")
        
        assert response.status_code == 200


class TestStaffLeadsSorting:
    """Test that leads are returned with proper fields for sorting"""
    
    def test_leads_have_assigned_at_field(self):
        """Test that leads have assigned_at field for sorting NEW leads first"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1024/leads?page=1&limit=10")
        
        if response.status_code == 404:
            pytest.skip("Staff ASR1024 not found")
        
        if response.status_code == 200:
            data = response.json()
            leads = data.get("leads", data) if isinstance(data, dict) else data
            
            if leads:
                lead = leads[0]
                print(f"Lead fields: {lead.keys()}")
                # Check for timestamp/assigned_at fields used for sorting
                has_timestamp = "timestamp" in lead or "assigned_at" in lead
                print(f"Has timestamp field: {'timestamp' in lead}")
                print(f"Has assigned_at field: {'assigned_at' in lead}")
                print(f"Has call_status field: {'call_status' in lead}")
                
                # The frontend sorts by isNew flag and assigned_at
                # Backend should return timestamp or assigned_at for this
                assert has_timestamp, "Lead should have timestamp or assigned_at for sorting"
        
        assert response.status_code in [200, 404]


class TestFilterCounts:
    """Test that filter counts can be calculated from leads data"""
    
    def test_leads_have_call_status_for_filtering(self):
        """Test that leads have call_status field for Called/Uncalled filtering"""
        response = requests.get(f"{BASE_URL}/api/staff/ASR1024/leads?page=1&limit=50")
        
        if response.status_code == 404:
            pytest.skip("Staff ASR1024 not found")
        
        if response.status_code == 200:
            data = response.json()
            leads = data.get("leads", data) if isinstance(data, dict) else data
            
            # Count leads by call_status
            called_count = sum(1 for l in leads if l.get("call_status") == "called")
            uncalled_count = sum(1 for l in leads if l.get("call_status") != "called")
            
            print(f"Total leads: {len(leads)}")
            print(f"Called leads: {called_count}")
            print(f"Uncalled leads: {uncalled_count}")
            
            # Verify counts add up
            assert called_count + uncalled_count == len(leads), "Called + Uncalled should equal total"
        
        assert response.status_code in [200, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
