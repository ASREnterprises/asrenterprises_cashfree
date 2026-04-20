"""
Iteration 81 - Owner Protection Tests
Tests for ABHIJEET KUMAR (ASR1001) owner account protection:
1. GET /api/owner-info returns correct owner details
2. DELETE /api/admin/staff-accounts/ASR1001 returns 403 (cannot delete owner)
3. Owner account has is_owner=true and can_delete=false
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOwnerInfo:
    """Test owner-info endpoint returns ABHIJEET KUMAR details"""
    
    def test_owner_info_endpoint_returns_200(self):
        """GET /api/owner-info should return 200"""
        response = requests.get(f"{BASE_URL}/api/owner-info")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /api/owner-info returned 200")
    
    def test_owner_info_returns_abhijeet_kumar(self):
        """Owner info should return ABHIJEET KUMAR as name"""
        response = requests.get(f"{BASE_URL}/api/owner-info")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("name") == "ABHIJEET KUMAR", f"Expected name 'ABHIJEET KUMAR', got '{data.get('name')}'"
        print(f"✅ Owner name is ABHIJEET KUMAR")
    
    def test_owner_info_returns_staff_id_asr1001(self):
        """Owner info should return staff_id ASR1001"""
        response = requests.get(f"{BASE_URL}/api/owner-info")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("staff_id") == "ASR1001", f"Expected staff_id 'ASR1001', got '{data.get('staff_id')}'"
        print(f"✅ Owner staff_id is ASR1001")
    
    def test_owner_info_has_is_owner_true(self):
        """Owner info should have is_owner=true"""
        response = requests.get(f"{BASE_URL}/api/owner-info")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("is_owner") == True, f"Expected is_owner=True, got {data.get('is_owner')}"
        print(f"✅ Owner has is_owner=True")
    
    def test_owner_info_has_role_super_admin(self):
        """Owner info should have role super_admin"""
        response = requests.get(f"{BASE_URL}/api/owner-info")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("role") == "super_admin", f"Expected role 'super_admin', got '{data.get('role')}'"
        print(f"✅ Owner role is super_admin")


class TestOwnerDeleteProtection:
    """Test that owner account ASR1001 cannot be deleted"""
    
    def test_delete_owner_returns_403(self):
        """DELETE /api/admin/staff-accounts/ASR1001 should return 403"""
        response = requests.delete(f"{BASE_URL}/api/admin/staff-accounts/ASR1001")
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"
        print(f"✅ DELETE /api/admin/staff-accounts/ASR1001 returned 403 (protected)")
    
    def test_delete_owner_error_message(self):
        """Delete owner should return appropriate error message"""
        response = requests.delete(f"{BASE_URL}/api/admin/staff-accounts/ASR1001")
        assert response.status_code == 403
        data = response.json()
        
        # Check error message contains relevant info
        detail = data.get("detail", "")
        assert "owner" in detail.lower() or "cannot delete" in detail.lower() or "ABHIJEET" in detail, \
            f"Expected error message about owner protection, got: {detail}"
        print(f"✅ Delete owner error message: {detail}")


class TestStaffAccountsList:
    """Test staff accounts list includes owner with protection flags"""
    
    def test_staff_accounts_list_returns_200(self):
        """GET /api/admin/staff-accounts should return 200"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /api/admin/staff-accounts returned 200")
    
    def test_staff_accounts_includes_owner(self):
        """Staff accounts should include ASR1001 owner"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        data = response.json()
        
        # Find owner account
        owner = None
        for staff in data:
            if staff.get("staff_id") == "ASR1001":
                owner = staff
                break
        
        assert owner is not None, "Owner account ASR1001 not found in staff list"
        assert owner.get("name") == "ABHIJEET KUMAR", f"Owner name mismatch: {owner.get('name')}"
        print(f"✅ Owner ASR1001 found in staff accounts list")
    
    def test_owner_has_protection_flags(self):
        """Owner account should have is_owner=true and can_delete=false"""
        response = requests.get(f"{BASE_URL}/api/admin/staff-accounts")
        assert response.status_code == 200
        data = response.json()
        
        # Find owner account
        owner = None
        for staff in data:
            if staff.get("staff_id") == "ASR1001":
                owner = staff
                break
        
        assert owner is not None, "Owner account not found"
        assert owner.get("is_owner") == True, f"Expected is_owner=True, got {owner.get('is_owner')}"
        assert owner.get("can_delete") == False, f"Expected can_delete=False, got {owner.get('can_delete')}"
        print(f"✅ Owner has protection flags: is_owner=True, can_delete=False")


class TestWhatsAppTabPresence:
    """Test WhatsApp tab related endpoints work"""
    
    def test_whatsapp_conversations_endpoint(self):
        """GET /api/whatsapp/conversations should return 200"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /api/whatsapp/conversations returned 200")
    
    def test_whatsapp_unread_count_endpoint(self):
        """GET /api/whatsapp/conversations/unread-count should return 200"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/conversations/unread-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /api/whatsapp/conversations/unread-count returned 200")


class TestCRMDashboard:
    """Test CRM Dashboard endpoints"""
    
    def test_crm_dashboard_endpoint(self):
        """GET /api/crm/dashboard should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /api/crm/dashboard returned 200")
    
    def test_crm_leads_endpoint(self):
        """GET /api/crm/leads should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ GET /api/crm/leads returned 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
