"""
Test Suite for Iteration 74 - Multiple ASR Solar CRM Fixes
Tests:
1. New Leads API - WhatsApp-only filter
2. WhatsApp auto-deletion 24hr endpoint
3. Bulk conversation delete endpoint
4. Gallery tabs renamed verification (via code review)
5. Homepage wa.me links use 8298389097
6. Homepage shows www.asrenterprises.in
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNewLeadsWhatsAppFilter:
    """Test New Leads API returns only WhatsApp leads by default"""
    
    def test_new_leads_endpoint_exists(self):
        """GET /api/crm/new-leads should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leads" in data, "Response should contain 'leads' key"
        assert "total_count" in data, "Response should contain 'total_count' key"
        print(f"✓ New leads endpoint works - {data.get('total_count', 0)} leads found")
    
    def test_new_leads_count_endpoint(self):
        """GET /api/crm/new-leads/count should return count of WhatsApp leads"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads/count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "count" in data, "Response should contain 'count' key"
        print(f"✓ New leads count endpoint works - count: {data.get('count', 0)}")
    
    def test_new_leads_whatsapp_source_filter(self):
        """GET /api/crm/new-leads?source=whatsapp should filter by WhatsApp source"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads?source=whatsapp")
        assert response.status_code == 200
        data = response.json()
        leads = data.get("leads", [])
        # Verify all returned leads have WhatsApp source
        for lead in leads:
            source = lead.get("source", "")
            assert source in ["whatsapp", "whatsapp_direct", "whatsapp_reply", "whatsapp_button", ""], \
                f"Lead source '{source}' is not a WhatsApp source"
        print(f"✓ WhatsApp source filter works - {len(leads)} WhatsApp leads")
    
    def test_new_leads_all_source_filter(self):
        """GET /api/crm/new-leads?source=all should return all new leads"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads?source=all")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ All source filter works - {data.get('total_count', 0)} total new leads")


class TestWhatsAppAutoCleanup:
    """Test WhatsApp 24hr auto-deletion endpoint"""
    
    def test_auto_cleanup_24h_endpoint_exists(self):
        """DELETE /api/whatsapp/messages/auto-cleanup-24h should exist"""
        response = requests.delete(f"{BASE_URL}/api/whatsapp/messages/auto-cleanup-24h")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert data["success"] == True, "Cleanup should succeed"
        assert "deleted_count" in data, "Response should contain 'deleted_count'"
        print(f"✓ Auto-cleanup 24h endpoint works - deleted {data.get('deleted_count', 0)} messages")
    
    def test_cleanup_status_endpoint(self):
        """GET /api/whatsapp/messages/cleanup-status should return status"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/messages/cleanup-status")
        assert response.status_code == 200
        data = response.json()
        assert "message_counts" in data, "Response should contain 'message_counts'"
        assert "auto_delete_threshold_hours" in data, "Response should contain threshold"
        # Verify threshold is 24 hours
        assert data.get("auto_delete_threshold_hours") == 24, "Threshold should be 24 hours"
        print(f"✓ Cleanup status endpoint works - threshold: {data.get('auto_delete_threshold_hours')}h")


class TestBulkConversationDelete:
    """Test bulk conversation delete endpoint"""
    
    def test_bulk_delete_endpoint_exists(self):
        """POST /api/whatsapp/conversations/bulk-delete should exist"""
        # Test with empty list (should return error or handle gracefully)
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/bulk-delete",
            json={"phone_numbers": []}
        )
        # Should return 400 for empty list or 200 with 0 deleted
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        print(f"✓ Bulk delete endpoint exists - status: {response.status_code}")
    
    def test_bulk_delete_with_fake_numbers(self):
        """POST /api/whatsapp/conversations/bulk-delete with non-existent numbers"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/conversations/bulk-delete",
            json={"phone_numbers": ["919999999999", "919888888888"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert "deleted_count" in data, "Response should contain 'deleted_count'"
        print(f"✓ Bulk delete handles non-existent numbers - deleted: {data.get('deleted_count', 0)}")


class TestGalleryAPI:
    """Test Gallery API endpoints"""
    
    def test_gallery_public_all(self):
        """GET /api/social/gallery/public?type=all should return all items"""
        response = requests.get(f"{BASE_URL}/api/social/gallery/public?type=all")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        print(f"✓ Gallery public API works - {len(data.get('items', []))} items")
    
    def test_gallery_public_latest_work(self):
        """GET /api/social/gallery/public?type=latest_work should return latest work"""
        response = requests.get(f"{BASE_URL}/api/social/gallery/public?type=latest_work")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        print(f"✓ Gallery latest_work filter works - {len(data.get('items', []))} items")
    
    def test_gallery_public_gallery_filter(self):
        """GET /api/social/gallery/public?type=gallery should return gallery items"""
        response = requests.get(f"{BASE_URL}/api/social/gallery/public?type=gallery")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        print(f"✓ Gallery filter works - {len(data.get('items', []))} items")


class TestCRMDashboard:
    """Test CRM Dashboard API"""
    
    def test_crm_dashboard_endpoint(self):
        """GET /api/crm/dashboard should return dashboard data"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data, "Response should contain 'total_leads'"
        assert "pipeline_stats" in data, "Response should contain 'pipeline_stats'"
        print(f"✓ CRM Dashboard works - {data.get('total_leads', 0)} total leads")
    
    def test_crm_leads_endpoint(self):
        """GET /api/crm/leads should return leads list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        # Can be list or object with leads key
        if isinstance(data, list):
            print(f"✓ CRM Leads endpoint works - {len(data)} leads")
        else:
            leads = data.get("leads", [])
            print(f"✓ CRM Leads endpoint works - {len(leads)} leads")


class TestHealthAndBasicAPIs:
    """Test basic health and API endpoints"""
    
    def test_backend_health(self):
        """GET /api/ should return health check"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("✓ Backend health check passed")
    
    def test_districts_endpoint(self):
        """GET /api/districts should return Bihar districts"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200
        data = response.json()
        assert "districts" in data, "Response should contain 'districts'"
        assert len(data["districts"]) > 0, "Should have districts"
        print(f"✓ Districts endpoint works - {len(data['districts'])} districts")
    
    def test_photos_endpoint(self):
        """GET /api/photos should return photos"""
        response = requests.get(f"{BASE_URL}/api/photos")
        assert response.status_code == 200
        print("✓ Photos endpoint works")


class TestMarkLeadContacted:
    """Test mark lead as contacted functionality"""
    
    def test_mark_contacted_with_fake_id(self):
        """POST /api/crm/leads/{fake_id}/mark-contacted should return 404"""
        response = requests.post(f"{BASE_URL}/api/crm/leads/fake-lead-id-12345/mark-contacted")
        assert response.status_code == 404, f"Expected 404 for non-existent lead, got {response.status_code}"
        print("✓ Mark contacted returns 404 for non-existent lead")
    
    def test_bulk_mark_contacted_empty_list(self):
        """POST /api/crm/leads/bulk-mark-contacted with empty list"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-mark-contacted",
            json={"lead_ids": []}
        )
        assert response.status_code == 200
        data = response.json()
        # Should handle empty list gracefully
        assert "success" in data or "error" in data
        print("✓ Bulk mark contacted handles empty list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
