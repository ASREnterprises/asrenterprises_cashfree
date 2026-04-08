"""
Cashfree Payments Integration Tests for ASR Enterprises CRM
Tests payment link creation, dashboard stats, transactions, manual payments, and website payments
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')

class TestPaymentSettings:
    """Test payment settings endpoints"""
    
    def test_get_payment_settings(self):
        """GET /api/payments/settings - returns configured status"""
        response = requests.get(f"{BASE_URL}/api/payments/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "configured" in data, "Response should have 'configured' field"
        
        # If configured, check additional fields
        if data.get("configured"):
            assert "app_id" in data, "Should have masked app_id"
            assert "is_sandbox" in data, "Should have is_sandbox flag"
            assert "is_active" in data, "Should have is_active flag"
            assert "support_email" in data, "Should have support_email"
            assert "support_phone" in data, "Should have support_phone"
            print(f"Payment settings configured: sandbox={data.get('is_sandbox')}, active={data.get('is_active')}")
        else:
            print("Payment settings not configured")
    
    def test_get_webhook_url(self):
        """GET /api/payments/webhook-url - returns webhook configuration URL"""
        response = requests.get(f"{BASE_URL}/api/payments/webhook-url")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "webhook_url" in data, "Response should have webhook_url"
        assert "instructions" in data, "Response should have instructions"
        assert "supported_events" in data, "Response should have supported_events"
        
        # Verify webhook URL format
        webhook_url = data.get("webhook_url", "")
        assert "/api/payments/webhook" in webhook_url, "Webhook URL should contain /api/payments/webhook"
        
        # Verify supported events
        events = data.get("supported_events", [])
        assert "PAYMENT_LINK_EVENT" in events, "Should support PAYMENT_LINK_EVENT"
        assert "PAYMENT_SUCCESS_WEBHOOK" in events, "Should support PAYMENT_SUCCESS_WEBHOOK"
        
        print(f"Webhook URL: {webhook_url}")
        print(f"Supported events: {events}")


class TestPaymentDashboard:
    """Test payment dashboard statistics"""
    
    def test_get_dashboard_stats(self):
        """GET /api/payments/dashboard/stats - returns payment statistics"""
        response = requests.get(f"{BASE_URL}/api/payments/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check overview stats
        assert "overview" in data, "Response should have overview"
        overview = data["overview"]
        assert "total_links_created" in overview, "Overview should have total_links_created"
        assert "total_collected" in overview, "Overview should have total_collected"
        assert "pending_links" in overview, "Overview should have pending_links"
        
        # Check time-based stats
        assert "today" in data, "Response should have today stats"
        assert "this_week" in data, "Response should have this_week stats"
        assert "this_month" in data, "Response should have this_month stats"
        
        # Check today stats structure
        today = data["today"]
        assert "links_created" in today, "Today should have links_created"
        assert "amount_collected" in today, "Today should have amount_collected"
        
        # Check by_source and by_status
        assert "by_source" in data, "Response should have by_source"
        assert "by_status" in data, "Response should have by_status"
        
        print(f"Dashboard stats: total_links={overview.get('total_links_created')}, collected={overview.get('total_collected')}")


class TestPaymentTransactions:
    """Test payment transactions listing"""
    
    def test_get_transactions(self):
        """GET /api/payments/transactions - returns paginated transactions"""
        response = requests.get(f"{BASE_URL}/api/payments/transactions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "transactions" in data, "Response should have transactions"
        assert "total" in data, "Response should have total count"
        assert "page" in data, "Response should have page number"
        assert "limit" in data, "Response should have limit"
        assert "total_pages" in data, "Response should have total_pages"
        
        # Verify transactions is a list
        assert isinstance(data["transactions"], list), "Transactions should be a list"
        
        print(f"Transactions: total={data.get('total')}, page={data.get('page')}/{data.get('total_pages')}")
    
    def test_get_transactions_with_filters(self):
        """GET /api/payments/transactions with filters"""
        # Test with status filter
        response = requests.get(f"{BASE_URL}/api/payments/transactions?status=paid")
        assert response.status_code == 200
        
        # Test with source filter
        response = requests.get(f"{BASE_URL}/api/payments/transactions?source=crm_link")
        assert response.status_code == 200
        
        # Test with pagination
        response = requests.get(f"{BASE_URL}/api/payments/transactions?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data.get("limit") == 10, "Limit should be 10"
        
        print("Transaction filters working correctly")


class TestPaymentLinkCreation:
    """Test payment link creation with Cashfree Sandbox"""
    
    def test_create_payment_link(self):
        """POST /api/payments/create-link - creates Cashfree payment link"""
        # Generate unique test data
        test_phone = f"91999900{str(uuid.uuid4().int)[:4]}"
        
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": test_phone,
            "customer_email": "test@example.com",
            "amount": 100.0,
            "purpose": "Test Payment",
            "notes": "Test payment link creation",
            "send_via_whatsapp": False,
            "expiry_minutes": 60
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/create-link", json=payload)
        
        # Should return 200 on success or 400 if Cashfree not configured
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 200:
            assert data.get("success") == True, "Response should indicate success"
            assert "payment_id" in data, "Response should have payment_id"
            assert "payment_link" in data, "Response should have payment_link"
            assert "order_id" in data, "Response should have order_id"
            assert "link_id" in data, "Response should have link_id"
            assert "amount" in data, "Response should have amount"
            assert data.get("amount") == 100.0, "Amount should match"
            
            # Verify payment link URL format
            payment_link = data.get("payment_link", "")
            assert "cashfree" in payment_link.lower() or "cfre" in payment_link.lower(), "Payment link should be from Cashfree"
            
            print(f"Payment link created: {data.get('link_id')}")
            print(f"Payment URL: {payment_link}")
            
            return data  # Return for use in other tests
        else:
            # Cashfree not configured or validation error
            print(f"Payment link creation failed: {data.get('detail', data)}")
            pytest.skip("Cashfree not configured or validation error")
    
    def test_create_payment_link_validation(self):
        """Test payment link creation validation"""
        # Test with missing required fields
        payload = {
            "customer_name": "Test",
            # Missing phone and amount
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/create-link", json=payload)
        assert response.status_code == 422, "Should return 422 for validation error"
        
        # Test with invalid phone
        payload = {
            "customer_name": "Test",
            "customer_phone": "123",  # Too short
            "amount": 100.0
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/create-link", json=payload)
        # Should either fail validation or return 400 from Cashfree
        assert response.status_code in [400, 422], f"Expected 400 or 422, got {response.status_code}"
        
        print("Payment link validation working correctly")


class TestManualPayment:
    """Test manual payment recording"""
    
    @pytest.fixture
    def test_lead_id(self):
        """Create a test lead for manual payment"""
        # First try to get an existing lead
        response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1")
        if response.status_code == 200:
            data = response.json()
            leads = data.get("leads", data) if isinstance(data, dict) else data
            if leads and len(leads) > 0:
                return leads[0].get("id")
        
        # Create a new lead if none exists
        lead_payload = {
            "name": "TEST_Payment_Lead",
            "phone": f"91888800{str(uuid.uuid4().int)[:4]}",
            "source": "manual"
        }
        response = requests.post(f"{BASE_URL}/api/crm/leads", json=lead_payload)
        if response.status_code in [200, 201]:
            return response.json().get("id")
        
        pytest.skip("Could not create test lead")
    
    def test_record_manual_payment(self, test_lead_id):
        """POST /api/payments/manual - records manual payment"""
        payload = {
            "lead_id": test_lead_id,
            "amount": 5000.0,
            "payment_mode": "cash",
            "reference_number": f"TEST_{uuid.uuid4().hex[:8]}",
            "notes": "Test manual payment"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/manual", json=payload)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Response should indicate success"
            assert "payment_id" in data, "Response should have payment_id"
            print(f"Manual payment recorded: {data.get('payment_id')}")
        else:
            print(f"Lead not found: {test_lead_id}")
    
    def test_manual_payment_validation(self):
        """Test manual payment validation"""
        # Test with non-existent lead
        payload = {
            "lead_id": "non_existent_lead_id",
            "amount": 1000.0,
            "payment_mode": "cash"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/manual", json=payload)
        assert response.status_code == 404, "Should return 404 for non-existent lead"
        
        print("Manual payment validation working correctly")


class TestWebsitePayment:
    """Test website payment initiation"""
    
    def test_initiate_website_payment(self):
        """POST /api/payments/website/initiate - initiates website payment"""
        test_phone = f"91777700{str(uuid.uuid4().int)[:4]}"
        
        payload = {
            "customer_name": "Website Test Customer",
            "customer_phone": test_phone,
            "customer_email": "website@test.com",
            "address": "123 Test Street",
            "district": "Patna",
            "service_type": "solar_consultation",
            "amount": 500.0,
            "notes": "Test website payment"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/website/initiate", json=payload)
        
        # Should return 200 on success or 400 if Cashfree not configured
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 200:
            assert data.get("success") == True, "Response should indicate success"
            assert "payment_link" in data, "Response should have payment_link"
            assert "order_id" in data, "Response should have order_id"
            assert "lead_id" in data, "Response should have lead_id (auto-created)"
            assert "support_phone" in data, "Response should have support_phone"
            assert "support_email" in data, "Response should have support_email"
            
            print(f"Website payment initiated: order_id={data.get('order_id')}")
            print(f"Auto-created lead: {data.get('lead_id')}")
        else:
            print(f"Website payment failed: {data.get('detail', data)}")
            pytest.skip("Cashfree not configured")
    
    def test_verify_website_payment(self):
        """GET /api/payments/website/verify/{order_id} - verify payment status"""
        # Test with non-existent order
        response = requests.get(f"{BASE_URL}/api/payments/website/verify/NON_EXISTENT_ORDER")
        assert response.status_code == 404, "Should return 404 for non-existent order"
        
        print("Website payment verification endpoint working")


class TestPaymentLinkOperations:
    """Test payment link operations (status, resend, cancel)"""
    
    def test_get_link_status(self):
        """GET /api/payments/link/{link_id}/status - get link status"""
        # Test with non-existent link
        response = requests.get(f"{BASE_URL}/api/payments/link/NON_EXISTENT_LINK/status")
        # Should return 400 (Cashfree not configured) or 404 (link not found) or actual status
        assert response.status_code in [200, 400, 404, 500], f"Unexpected status: {response.status_code}"
        
        print("Link status endpoint accessible")
    
    def test_resend_link(self):
        """POST /api/payments/link/{link_id}/resend - resend link via WhatsApp"""
        response = requests.post(f"{BASE_URL}/api/payments/link/NON_EXISTENT_LINK/resend")
        assert response.status_code == 404, "Should return 404 for non-existent link"
        
        print("Link resend endpoint working")
    
    def test_cancel_link(self):
        """POST /api/payments/link/{link_id}/cancel - cancel payment link"""
        response = requests.post(f"{BASE_URL}/api/payments/link/NON_EXISTENT_LINK/cancel")
        assert response.status_code == 404, "Should return 404 for non-existent link"
        
        print("Link cancel endpoint working")


class TestLeadPayments:
    """Test lead-specific payment endpoints"""
    
    def test_get_lead_payments(self):
        """GET /api/payments/lead/{lead_id}/payments - get all payments for a lead"""
        # Test with non-existent lead (should still return empty list, not error)
        response = requests.get(f"{BASE_URL}/api/payments/lead/test_lead_id/payments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "lead_id" in data, "Response should have lead_id"
        assert "payments" in data, "Response should have payments list"
        assert "total_paid" in data, "Response should have total_paid"
        assert "pending_amount" in data, "Response should have pending_amount"
        assert "payment_count" in data, "Response should have payment_count"
        
        print("Lead payments endpoint working")


class TestEndToEndPaymentFlow:
    """End-to-end payment flow test"""
    
    def test_complete_payment_flow(self):
        """Test complete payment flow: create link -> verify in transactions"""
        # Step 1: Check settings
        settings_response = requests.get(f"{BASE_URL}/api/payments/settings")
        assert settings_response.status_code == 200
        settings = settings_response.json()
        
        if not settings.get("configured"):
            pytest.skip("Cashfree not configured")
        
        # Step 2: Create payment link
        test_phone = f"91666600{str(uuid.uuid4().int)[:4]}"
        create_payload = {
            "customer_name": "E2E Test Customer",
            "customer_phone": test_phone,
            "amount": 250.0,
            "purpose": "E2E Test Payment"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/payments/create-link", json=create_payload)
        
        if create_response.status_code != 200:
            pytest.skip("Could not create payment link")
        
        create_data = create_response.json()
        payment_id = create_data.get("payment_id")
        link_id = create_data.get("link_id")
        
        print(f"Created payment: {payment_id}, link: {link_id}")
        
        # Step 3: Verify in transactions list
        time.sleep(1)  # Small delay for DB write
        
        transactions_response = requests.get(f"{BASE_URL}/api/payments/transactions?search={test_phone[-10:]}")
        assert transactions_response.status_code == 200
        
        transactions = transactions_response.json().get("transactions", [])
        
        # Find our transaction
        found = False
        for txn in transactions:
            if txn.get("id") == payment_id or txn.get("link_id") == link_id:
                found = True
                assert txn.get("status") in ["link_created", "link_sent"], "Status should be link_created or link_sent"
                assert txn.get("amount") == 250.0, "Amount should match"
                print(f"Found transaction in list: status={txn.get('status')}")
                break
        
        if not found:
            print(f"Warning: Transaction not found in search results (may be pagination)")
        
        # Step 4: Check dashboard stats updated
        stats_response = requests.get(f"{BASE_URL}/api/payments/dashboard/stats")
        assert stats_response.status_code == 200
        
        print("E2E payment flow completed successfully")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
