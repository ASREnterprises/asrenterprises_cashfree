"""
Business Intelligence API Tests for ASR Enterprises Solar CRM
Tests the new BI features: Leaderboard, Revenue Dashboard, Lead Analytics, 
Overdue Alerts, Timeline, Commissions, Daily Digest, Insights
"""
import pytest
import requests
import os
from datetime import datetime

# Use production URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check"""
    
    def test_districts_endpoint(self):
        """Verify backend is reachable"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert "districts" in data
        assert len(data["districts"]) > 0
        print(f"✅ Health check passed. {len(data['districts'])} districts available")


class TestStaffLeaderboard:
    """GET /api/crm/leaderboard - Staff performance rankings"""
    
    def test_leaderboard_returns_200(self):
        """Leaderboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/leaderboard")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Leaderboard endpoint returned 200")
    
    def test_leaderboard_structure(self):
        """Verify leaderboard response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list (could be empty if no staff)
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✅ Leaderboard returned {len(data)} staff members")
        
        # If there are staff members, verify structure
        if len(data) > 0:
            staff = data[0]
            required_fields = ['staff_id', 'name', 'rank', 'conversions', 'performance_score']
            for field in required_fields:
                assert field in staff, f"Missing field: {field}"
            
            # Verify rank is 1 for first item (sorted by performance)
            assert staff['rank'] == 1, f"First item should have rank 1, got {staff['rank']}"
            print(f"✅ Top performer: {staff.get('name')} with score {staff.get('performance_score')}")


class TestRevenueDashboard:
    """GET /api/crm/revenue-dashboard - Revenue analytics"""
    
    def test_revenue_dashboard_returns_200(self):
        """Revenue dashboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/revenue-dashboard")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Revenue dashboard endpoint returned 200")
    
    def test_revenue_dashboard_structure(self):
        """Verify revenue dashboard response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/revenue-dashboard")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            'monthly_revenue', 'monthly_target', 'target_progress',
            'total_revenue', 'pipeline_value'
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify numeric values
        assert isinstance(data['monthly_revenue'], (int, float))
        assert isinstance(data['target_progress'], (int, float))
        print(f"✅ Monthly revenue: ₹{data['monthly_revenue']:,}")
        print(f"✅ Target progress: {data['target_progress']}%")
        print(f"✅ Pipeline value: ₹{data['pipeline_value']:,}")


class TestSetTarget:
    """POST /api/crm/set-target - Set monthly revenue target"""
    
    def test_set_target_success(self):
        """Setting monthly target should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/crm/set-target",
            json={"monthly_revenue_target": 1500000}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("target") == 1500000
        print(f"✅ Target set to ₹1,500,000")
    
    def test_verify_target_updated(self):
        """Verify target is reflected in dashboard"""
        # Set a unique target
        target_value = 2000000
        set_response = requests.post(
            f"{BASE_URL}/api/crm/set-target",
            json={"monthly_revenue_target": target_value}
        )
        assert set_response.status_code == 200
        
        # Verify in dashboard
        dashboard_response = requests.get(f"{BASE_URL}/api/crm/revenue-dashboard")
        assert dashboard_response.status_code == 200
        data = dashboard_response.json()
        assert data['monthly_target'] == target_value, f"Target not updated: {data['monthly_target']}"
        print(f"✅ Target update verified in dashboard")


class TestLeadAnalytics:
    """GET /api/crm/lead-analytics - Lead analytics data"""
    
    def test_lead_analytics_returns_200(self):
        """Lead analytics endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/lead-analytics")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Lead analytics endpoint returned 200")
    
    def test_lead_analytics_structure(self):
        """Verify lead analytics response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/lead-analytics")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['total_leads', 'this_month', 'by_source', 'by_district', 'funnel']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify funnel structure
        funnel = data['funnel']
        funnel_fields = ['total', 'contacted', 'surveyed', 'quoted', 'won', 'conversion_rate']
        for field in funnel_fields:
            assert field in funnel, f"Missing funnel field: {field}"
        
        print(f"✅ Total leads: {data['total_leads']}")
        print(f"✅ This month: {data['this_month']}")
        print(f"✅ Conversion rate: {funnel['conversion_rate']}%")


class TestOverdueLeads:
    """GET /api/crm/overdue-leads - Overdue lead alerts"""
    
    def test_overdue_leads_returns_200(self):
        """Overdue leads endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/overdue-leads")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Overdue leads endpoint returned 200")
    
    def test_overdue_leads_structure(self):
        """Verify overdue leads response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/overdue-leads")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['critical', 'overdue_72h', 'overdue_48h', 'overdue_24h', 'summary']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify all are lists
        assert isinstance(data['critical'], list)
        assert isinstance(data['overdue_72h'], list)
        assert isinstance(data['overdue_48h'], list)
        assert isinstance(data['overdue_24h'], list)
        
        # Verify summary
        summary = data['summary']
        assert 'total_overdue' in summary
        print(f"✅ Total overdue leads: {summary['total_overdue']}")
        print(f"✅ Critical (5+ days): {len(data['critical'])}")


class TestLeadTimeline:
    """GET /api/crm/leads/{lead_id}/timeline - Customer journey timeline"""
    
    def test_timeline_invalid_lead_404(self):
        """Timeline for non-existent lead should return 404"""
        response = requests.get(f"{BASE_URL}/api/crm/leads/invalid-lead-id/timeline")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ Timeline correctly returns 404 for invalid lead")
    
    def test_timeline_valid_lead(self):
        """Get timeline for a valid lead (if exists)"""
        # First get a lead
        leads_response = requests.get(f"{BASE_URL}/api/crm/leads")
        if leads_response.status_code == 200 and len(leads_response.json()) > 0:
            lead = leads_response.json()[0]
            lead_id = lead.get('id')
            
            # Get timeline
            response = requests.get(f"{BASE_URL}/api/crm/leads/{lead_id}/timeline")
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            required_fields = ['lead', 'timeline', 'summary']
            for field in required_fields:
                assert field in data, f"Missing field: {field}"
            
            assert isinstance(data['timeline'], list)
            print(f"✅ Timeline for lead {lead_id}: {len(data['timeline'])} events")
        else:
            print(f"⚠️ No leads available for timeline test - skipping")


class TestCommissions:
    """GET /api/crm/commissions - Staff commission report"""
    
    def test_commissions_returns_200(self):
        """Commissions endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/commissions")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Commissions endpoint returned 200")
    
    def test_commissions_structure(self):
        """Verify commissions response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/commissions")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['commissions', 'total_commission_payable', 'commission_rates']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        assert isinstance(data['commissions'], list)
        assert isinstance(data['total_commission_payable'], (int, float))
        
        # Verify commission rates structure
        rates = data['commission_rates']
        assert 'sales' in rates or len(rates) == 0
        
        print(f"✅ Total commission payable: ₹{data['total_commission_payable']:,}")
        print(f"✅ Staff with commissions: {len(data['commissions'])}")


class TestDailyDigest:
    """GET /api/crm/daily-digest - Daily business summary"""
    
    def test_daily_digest_returns_200(self):
        """Daily digest endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/daily-digest")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Daily digest endpoint returned 200")
    
    def test_daily_digest_structure(self):
        """Verify daily digest response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/daily-digest")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['date', 'day', 'greeting', 'summary', 'hot_leads', 'ai_tip']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify summary structure
        summary = data['summary']
        summary_fields = ['new_leads', 'revenue', 'followups_scheduled', 'followups_completed']
        for field in summary_fields:
            assert field in summary, f"Missing summary field: {field}"
        
        # Verify AI tip is present
        assert data['ai_tip'] is not None and len(str(data['ai_tip'])) > 0, "AI tip should not be empty"
        
        print(f"✅ Date: {data['date']} ({data['day']})")
        print(f"✅ Greeting: {data['greeting']}")
        print(f"✅ New leads today: {summary['new_leads']}")
        print(f"✅ AI Tip: {data['ai_tip'][:60]}...")


class TestBusinessInsights:
    """GET /api/crm/insights - AI-powered business insights"""
    
    def test_insights_returns_200(self):
        """Insights endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crm/insights")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Insights endpoint returned 200")
    
    def test_insights_structure(self):
        """Verify insights response structure"""
        response = requests.get(f"{BASE_URL}/api/crm/insights")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ['insights', 'key_metrics']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify insights is a list
        assert isinstance(data['insights'], list)
        
        # Verify key_metrics structure
        metrics = data['key_metrics']
        metric_fields = ['conversion_rate', 'total_leads']
        for field in metric_fields:
            assert field in metrics, f"Missing metric field: {field}"
        
        print(f"✅ Insights count: {len(data['insights'])}")
        print(f"✅ Conversion rate: {metrics['conversion_rate']}%")
        print(f"✅ Total leads: {metrics['total_leads']}")
        
        # Print insights
        for insight in data['insights']:
            print(f"  - [{insight.get('type')}] {insight.get('title')}")


class TestBusinessDashboardIntegration:
    """Integration tests for Business Dashboard frontend component"""
    
    def test_all_endpoints_accessible(self):
        """All dashboard endpoints should be accessible"""
        endpoints = [
            '/api/crm/daily-digest',
            '/api/crm/leaderboard',
            '/api/crm/revenue-dashboard',
            '/api/crm/lead-analytics',
            '/api/crm/overdue-leads',
            '/api/crm/insights',
            '/api/crm/commissions'
        ]
        
        results = {}
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            results[endpoint] = response.status_code
            assert response.status_code == 200, f"Endpoint {endpoint} failed with {response.status_code}"
        
        print(f"✅ All {len(endpoints)} BI endpoints accessible")
        for endpoint, status in results.items():
            print(f"  - {endpoint}: {status}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
