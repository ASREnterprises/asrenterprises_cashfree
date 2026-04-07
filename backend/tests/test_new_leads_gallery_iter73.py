"""
Test New Leads Management System and Facebook Gallery Sync Features
Iteration 73 - Testing:
1. Facebook Gallery API - /api/social/gallery/public?type=all
2. New Leads Count API - /api/crm/new-leads/count
3. New Leads List API - /api/crm/new-leads
4. Mark Lead Contacted API - /api/crm/leads/{lead_id}/mark-contacted
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_backend_health(self):
        """Test backend is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print(f"✓ Backend health check passed: {response.json()}")


class TestFacebookGallerySync:
    """Test Facebook Gallery Sync APIs for website gallery"""
    
    def test_gallery_public_endpoint_all(self):
        """Test /api/social/gallery/public?type=all returns synced posts"""
        response = requests.get(f"{BASE_URL}/api/social/gallery/public?type=all&limit=50")
        assert response.status_code == 200
        data = response.json()
        
        # Should return items array and count
        assert "items" in data
        assert "count" in data
        assert isinstance(data["items"], list)
        print(f"✓ Gallery public endpoint returned {data['count']} items")
        
        # Check item structure if items exist
        if data["items"]:
            item = data["items"][0]
            # Items should have media_url and source fields
            assert "media_url" in item or "id" in item
            print(f"✓ First gallery item: {item.get('title', item.get('id', 'Unknown'))}")
    
    def test_gallery_public_endpoint_gallery_type(self):
        """Test /api/social/gallery/public?type=gallery filter"""
        response = requests.get(f"{BASE_URL}/api/social/gallery/public?type=gallery")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"✓ Gallery type filter returned {data.get('count', len(data['items']))} items")
    
    def test_gallery_public_endpoint_latest_work(self):
        """Test /api/social/gallery/public?type=latest_work filter"""
        response = requests.get(f"{BASE_URL}/api/social/gallery/public?type=latest_work")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"✓ Latest work filter returned {data.get('count', len(data['items']))} items")
    
    def test_gallery_admin_endpoint(self):
        """Test /api/social/gallery admin endpoint"""
        response = requests.get(f"{BASE_URL}/api/social/gallery?page=1&limit=20")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "pagination" in data
        print(f"✓ Admin gallery endpoint returned {data['pagination'].get('total_count', 0)} total items")


class TestNewLeadsManagement:
    """Test New Leads Management System APIs"""
    
    def test_new_leads_count_endpoint(self):
        """Test /api/crm/new-leads/count returns count of new leads"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads/count")
        assert response.status_code == 200
        data = response.json()
        
        # Should return count field
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"✓ New leads count: {data['count']}")
    
    def test_new_leads_list_endpoint(self):
        """Test /api/crm/new-leads returns leads with is_new=True"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads?limit=50")
        assert response.status_code == 200
        data = response.json()
        
        # Should return leads array and pagination info
        assert "leads" in data
        assert "total_count" in data
        assert isinstance(data["leads"], list)
        print(f"✓ New leads list returned {len(data['leads'])} leads (total: {data['total_count']})")
        
        # Verify all returned leads have is_new=True
        for lead in data["leads"]:
            assert lead.get("is_new") == True, f"Lead {lead.get('id')} should have is_new=True"
        
        if data["leads"]:
            print(f"✓ All {len(data['leads'])} leads have is_new=True flag")
    
    def test_new_leads_pagination(self):
        """Test new leads endpoint pagination"""
        response = requests.get(f"{BASE_URL}/api/crm/new-leads?limit=10&page=1")
        assert response.status_code == 200
        data = response.json()
        
        assert "page" in data
        assert "per_page" in data
        assert "has_more" in data
        print(f"✓ Pagination working: page={data['page']}, per_page={data['per_page']}, has_more={data['has_more']}")


class TestMarkLeadContacted:
    """Test Mark Lead Contacted functionality"""
    
    @pytest.fixture
    def test_lead_id(self):
        """Create a test lead and return its ID"""
        lead_data = {
            "name": f"TEST_NewLead_{uuid.uuid4().hex[:8]}",
            "phone": f"98765{uuid.uuid4().hex[:5]}",
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "district": "Patna",
            "source": "test",
            "property_type": "residential",
            "monthly_bill": 3000
        }
        
        response = requests.post(f"{BASE_URL}/api/crm/leads", json=lead_data)
        if response.status_code in [200, 201]:
            data = response.json()
            lead_id = data.get("id")
            print(f"✓ Created test lead: {lead_id}")
            return lead_id
        else:
            pytest.skip(f"Could not create test lead: {response.status_code}")
    
    def test_mark_lead_contacted(self, test_lead_id):
        """Test /api/crm/leads/{lead_id}/mark-contacted removes NEW badge"""
        if not test_lead_id:
            pytest.skip("No test lead available")
        
        # Mark the lead as contacted
        response = requests.post(f"{BASE_URL}/api/crm/leads/{test_lead_id}/mark-contacted")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "message" in data
        print(f"✓ Mark contacted response: {data['message']}")
        
        # Verify the lead is no longer in new leads list
        new_leads_response = requests.get(f"{BASE_URL}/api/crm/new-leads?limit=100")
        assert new_leads_response.status_code == 200
        new_leads_data = new_leads_response.json()
        
        # Check that our test lead is not in the new leads list
        new_lead_ids = [lead.get("id") for lead in new_leads_data.get("leads", [])]
        assert test_lead_id not in new_lead_ids, "Lead should not be in new leads after marking contacted"
        print(f"✓ Lead {test_lead_id} removed from new leads list after marking contacted")
    
    def test_mark_nonexistent_lead_contacted(self):
        """Test marking a non-existent lead returns 404"""
        fake_id = f"nonexistent_{uuid.uuid4().hex}"
        response = requests.post(f"{BASE_URL}/api/crm/leads/{fake_id}/mark-contacted")
        assert response.status_code == 404
        print(f"✓ Non-existent lead returns 404 as expected")


class TestBulkMarkContacted:
    """Test Bulk Mark Leads Contacted functionality"""
    
    def test_bulk_mark_contacted_empty_list(self):
        """Test bulk mark contacted with empty list"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-mark-contacted",
            json={"lead_ids": []}
        )
        assert response.status_code == 200
        data = response.json()
        # Should handle empty list gracefully
        assert "success" in data or "error" in data
        print(f"✓ Bulk mark contacted handles empty list: {data}")


class TestCRMDashboard:
    """Test CRM Dashboard endpoints"""
    
    def test_crm_dashboard(self):
        """Test /api/crm/dashboard returns comprehensive data"""
        response = requests.get(f"{BASE_URL}/api/crm/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Should have key dashboard fields
        assert "total_leads" in data
        assert "pipeline_stats" in data
        print(f"✓ CRM Dashboard: {data['total_leads']} total leads")
        
        # Check pipeline stats structure
        pipeline = data.get("pipeline_stats", {})
        expected_stages = ["new", "contacted", "site_visit", "quotation", "negotiation", "converted", "completed", "lost"]
        for stage in expected_stages:
            assert stage in pipeline, f"Missing pipeline stage: {stage}"
        print(f"✓ Pipeline stats: {pipeline}")
    
    def test_crm_leads_list(self):
        """Test /api/crm/leads returns leads list"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        
        # API may return list directly or paginated object
        if isinstance(data, list):
            leads = data
        else:
            # Paginated response
            assert "leads" in data
            leads = data.get("leads", [])
        
        print(f"✓ CRM leads list returned {len(leads)} leads")
        
        # Check lead structure if leads exist
        if leads:
            lead = leads[0]
            assert "id" in lead
            assert "name" in lead
            assert "phone" in lead
            print(f"✓ Lead structure verified: {lead.get('name')}")


class TestSocialMediaSettings:
    """Test Social Media Settings endpoints"""
    
    def test_social_settings(self):
        """Test /api/social/settings returns settings"""
        response = requests.get(f"{BASE_URL}/api/social/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Should have Facebook connection status
        assert "facebook_connected" in data
        assert "instagram_connected" in data
        print(f"✓ Social settings: FB connected={data['facebook_connected']}, IG connected={data['instagram_connected']}")
    
    def test_social_dashboard_stats(self):
        """Test /api/social/dashboard/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/social/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_posts" in data
        assert "facebook_connected" in data
        print(f"✓ Social dashboard stats: {data['total_posts']} total posts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
