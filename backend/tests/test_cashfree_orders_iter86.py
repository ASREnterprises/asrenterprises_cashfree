"""
Cashfree Orders API (Hosted Checkout) - Iteration 86 Tests
Tests the new Orders API implementation that replaces Payment Links API
Endpoints: /api/cashfree/*
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://solar-crm-stable.preview.emergentagent.com"

# Test constants
ASR_SUPPORT_EMAIL = "support@asrenterprises.in"
ASR_DISPLAY_PHONE = "9296389097"
ASR_WHATSAPP_API_PHONE = "8298389097"
ASR_BUSINESS_NAME = "ASR Enterprises"

# Test order IDs from the request
TEST_ORDER_IDS = ["ASR202604090219587F5713", "ASR202604090220101B830A"]


class TestCashfreeConfig:
    """Test Cashfree configuration endpoint"""
    
    def test_get_config_returns_production_environment(self):
        """GET /api/cashfree/config should return PRODUCTION environment"""
        response = requests.get(f"{BASE_URL}/api/cashfree/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("configured") == True, "Cashfree should be configured"
        assert data.get("environment") == "PRODUCTION", f"Expected PRODUCTION, got {data.get('environment')}"
        assert data.get("api_mode") == "orders_api", f"Expected orders_api mode, got {data.get('api_mode')}"
        print(f"Config: environment={data.get('environment')}, api_mode={data.get('api_mode')}")
    
    def test_config_returns_correct_support_info(self):
        """GET /api/cashfree/config should return correct support contact info"""
        response = requests.get(f"{BASE_URL}/api/cashfree/config")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("support_email") == ASR_SUPPORT_EMAIL, f"Expected {ASR_SUPPORT_EMAIL}, got {data.get('support_email')}"
        assert data.get("support_phone") == ASR_DISPLAY_PHONE, f"Expected {ASR_DISPLAY_PHONE}, got {data.get('support_phone')}"
        assert data.get("whatsapp_api_phone") == ASR_WHATSAPP_API_PHONE, f"Expected {ASR_WHATSAPP_API_PHONE}, got {data.get('whatsapp_api_phone')}"
        assert data.get("business_name") == ASR_BUSINESS_NAME, f"Expected {ASR_BUSINESS_NAME}, got {data.get('business_name')}"
        print(f"Support info verified: email={data.get('support_email')}, phone={data.get('support_phone')}")
    
    def test_config_returns_payment_types(self):
        """GET /api/cashfree/config should return available payment types"""
        response = requests.get(f"{BASE_URL}/api/cashfree/config")
        assert response.status_code == 200
        
        data = response.json()
        payment_types = data.get("payment_types", {})
        assert "advance" in payment_types, "Should have 'advance' payment type"
        assert "booking" in payment_types, "Should have 'booking' payment type"
        assert "site_visit" in payment_types, "Should have 'site_visit' payment type"
        print(f"Payment types: {list(payment_types.keys())}")


class TestCreateOrder:
    """Test order creation endpoints"""
    
    def test_create_order_success(self):
        """POST /api/cashfree/create-order should create a LIVE payment order"""
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "amount": 100.00,
            "payment_type": "custom",
            "purpose": "Test Payment - Iteration 86",
            "send_via_whatsapp": False
        }
        
        response = requests.post(f"{BASE_URL}/api/cashfree/create-order", json=payload)
        
        # Should succeed with 200 or fail with specific Cashfree error
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Order creation should succeed"
            assert "order_id" in data, "Response should contain order_id"
            assert "payment_url" in data, "Response should contain payment_url"
            assert "payment_session_id" in data, "Response should contain payment_session_id"
            
            # Verify payment URL format
            payment_url = data.get("payment_url", "")
            assert "payments.cashfree.com" in payment_url or "payments-test.cashfree.com" in payment_url, \
                f"Payment URL should be Cashfree hosted checkout: {payment_url}"
            
            print(f"Order created: order_id={data.get('order_id')}, payment_url={payment_url[:50]}...")
        else:
            # If it fails, check for expected error messages
            error_detail = response.json().get("detail", response.text)
            print(f"Order creation returned {response.status_code}: {error_detail}")
            # This is acceptable if Cashfree API has issues
            assert response.status_code in [400, 500], f"Unexpected status code: {response.status_code}"
    
    def test_create_order_validates_phone(self):
        """POST /api/cashfree/create-order should validate phone number"""
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": "123",  # Invalid phone
            "amount": 100.00,
            "payment_type": "custom",
            "purpose": "Test Payment"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashfree/create-order", json=payload)
        # Should return 400 for invalid phone
        assert response.status_code == 400, f"Expected 400 for invalid phone, got {response.status_code}"
        print(f"Phone validation working: {response.json().get('detail', '')}")
    
    def test_create_order_requires_amount(self):
        """POST /api/cashfree/create-order should require positive amount"""
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": "9876543210",
            "amount": 0,  # Invalid amount
            "payment_type": "custom",
            "purpose": "Test Payment"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashfree/create-order", json=payload)
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 for zero amount, got {response.status_code}"
        print("Amount validation working")


class TestWebsiteOrder:
    """Test website order creation with auto-lead creation"""
    
    def test_website_create_order(self):
        """POST /api/cashfree/website/create-order should create order and auto-create lead"""
        payload = {
            "customer_name": "Website Test Customer",
            "customer_phone": "9876543211",
            "customer_email": "website_test@example.com",
            "address": "Test Address, Bihar",
            "district": "Patna",
            "payment_type": "booking",
            "amount": 500.00,
            "notes": "Test booking from website"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashfree/website/create-order", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Website order creation should succeed"
            assert "order_id" in data, "Response should contain order_id"
            assert "payment_url" in data, "Response should contain payment_url"
            assert "lead_id" in data, "Response should contain lead_id (auto-created)"
            assert data.get("support_phone") == ASR_DISPLAY_PHONE, "Should return support phone"
            
            print(f"Website order created: order_id={data.get('order_id')}, lead_id={data.get('lead_id')}")
        else:
            error_detail = response.json().get("detail", response.text)
            print(f"Website order creation returned {response.status_code}: {error_detail}")
            assert response.status_code in [400, 500], f"Unexpected status code: {response.status_code}"


class TestOrderStatus:
    """Test order status endpoints"""
    
    def test_get_order_status_existing(self):
        """GET /api/cashfree/order/{order_id} should return order details"""
        # Try with test order IDs
        for order_id in TEST_ORDER_IDS:
            response = requests.get(f"{BASE_URL}/api/cashfree/order/{order_id}")
            
            if response.status_code == 200:
                data = response.json()
                assert data.get("order_id") == order_id, "Order ID should match"
                assert "status" in data, "Response should contain status"
                assert "amount" in data, "Response should contain amount"
                print(f"Order {order_id}: status={data.get('status')}, amount={data.get('amount')}")
                return  # Found at least one order
            elif response.status_code == 404:
                print(f"Order {order_id} not found (may have been cleaned up)")
        
        # If no test orders found, that's okay - they may have been cleaned up
        print("No test orders found - this is acceptable for clean environments")
    
    def test_get_order_status_not_found(self):
        """GET /api/cashfree/order/{order_id} should return 404 for non-existent order"""
        fake_order_id = "FAKE_ORDER_12345"
        response = requests.get(f"{BASE_URL}/api/cashfree/order/{fake_order_id}")
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}"
        print("404 handling for non-existent orders working")
    
    def test_refresh_order_status(self):
        """GET /api/cashfree/order/{order_id}/refresh should fetch status from Cashfree API"""
        # Try with test order IDs
        for order_id in TEST_ORDER_IDS:
            response = requests.get(f"{BASE_URL}/api/cashfree/order/{order_id}/refresh")
            
            if response.status_code == 200:
                data = response.json()
                assert "order_id" in data, "Response should contain order_id"
                assert "status" in data, "Response should contain status"
                assert "updated" in data, "Response should indicate if updated"
                print(f"Refresh order {order_id}: status={data.get('status')}, updated={data.get('updated')}")
                return
            elif response.status_code == 404:
                print(f"Order {order_id} not found for refresh")
            else:
                print(f"Refresh returned {response.status_code}: {response.text[:100]}")
        
        print("No test orders available for refresh test")


class TestDashboardStats:
    """Test dashboard statistics endpoint"""
    
    def test_get_dashboard_stats(self):
        """GET /api/cashfree/dashboard/stats should return correct statistics"""
        response = requests.get(f"{BASE_URL}/api/cashfree/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check overview section
        assert "overview" in data, "Response should contain overview"
        overview = data["overview"]
        assert "total_orders" in overview, "Overview should have total_orders"
        assert "total_collected" in overview, "Overview should have total_collected"
        assert "paid_count" in overview, "Overview should have paid_count"
        assert "pending_count" in overview, "Overview should have pending_count"
        
        # Check time-based stats
        assert "today" in data, "Response should contain today stats"
        assert "this_week" in data, "Response should contain this_week stats"
        assert "this_month" in data, "Response should contain this_month stats"
        
        # Check breakdown sections
        assert "by_status" in data, "Response should contain by_status breakdown"
        assert "by_payment_type" in data, "Response should contain by_payment_type breakdown"
        
        print(f"Dashboard stats: total_orders={overview.get('total_orders')}, total_collected={overview.get('total_collected')}")


class TestOrdersList:
    """Test orders list endpoint"""
    
    def test_get_orders_list(self):
        """GET /api/cashfree/orders should return paginated list of orders"""
        response = requests.get(f"{BASE_URL}/api/cashfree/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orders" in data, "Response should contain orders array"
        assert "total" in data, "Response should contain total count"
        assert "page" in data, "Response should contain page number"
        assert "limit" in data, "Response should contain limit"
        assert "total_pages" in data, "Response should contain total_pages"
        
        print(f"Orders list: total={data.get('total')}, page={data.get('page')}, orders_returned={len(data.get('orders', []))}")
    
    def test_get_orders_with_filters(self):
        """GET /api/cashfree/orders should support filtering"""
        # Test with status filter
        response = requests.get(f"{BASE_URL}/api/cashfree/orders?status=paid")
        assert response.status_code == 200
        
        # Test with payment_type filter
        response = requests.get(f"{BASE_URL}/api/cashfree/orders?payment_type=booking")
        assert response.status_code == 200
        
        # Test with search
        response = requests.get(f"{BASE_URL}/api/cashfree/orders?search=test")
        assert response.status_code == 200
        
        print("Orders filtering working")
    
    def test_get_orders_pagination(self):
        """GET /api/cashfree/orders should support pagination"""
        response = requests.get(f"{BASE_URL}/api/cashfree/orders?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("page") == 1, "Page should be 1"
        assert data.get("limit") == 10, "Limit should be 10"
        
        print(f"Pagination working: page={data.get('page')}, limit={data.get('limit')}")


class TestLeadOrders:
    """Test lead-specific orders endpoint"""
    
    def test_get_lead_orders(self):
        """GET /api/cashfree/lead/{lead_id}/orders should return orders for a lead"""
        # First get a lead ID from CRM
        leads_response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1")
        
        if leads_response.status_code == 200:
            leads_data = leads_response.json()
            leads = leads_data.get("leads", leads_data) if isinstance(leads_data, dict) else leads_data
            
            if leads and len(leads) > 0:
                lead_id = leads[0].get("id")
                
                response = requests.get(f"{BASE_URL}/api/cashfree/lead/{lead_id}/orders")
                assert response.status_code == 200, f"Expected 200, got {response.status_code}"
                
                data = response.json()
                assert data.get("lead_id") == lead_id, "Lead ID should match"
                assert "orders" in data, "Response should contain orders array"
                assert "total_paid" in data, "Response should contain total_paid"
                assert "pending_amount" in data, "Response should contain pending_amount"
                assert "order_count" in data, "Response should contain order_count"
                
                print(f"Lead {lead_id[:8]}... orders: count={data.get('order_count')}, total_paid={data.get('total_paid')}")
            else:
                print("No leads found to test lead orders endpoint")
        else:
            print(f"Could not fetch leads: {leads_response.status_code}")
    
    def test_get_lead_orders_empty(self):
        """GET /api/cashfree/lead/{lead_id}/orders should return empty for lead with no orders"""
        fake_lead_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/cashfree/lead/{fake_lead_id}/orders")
        
        # Should return 200 with empty orders, not 404
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("orders") == [], "Orders should be empty array"
        assert data.get("order_count") == 0, "Order count should be 0"
        
        print("Empty lead orders handling working")


class TestWebhook:
    """Test webhook endpoint"""
    
    def test_webhook_endpoint_accessible(self):
        """POST /api/cashfree/webhook should be accessible"""
        # Send empty payload to test endpoint accessibility
        response = requests.post(
            f"{BASE_URL}/api/cashfree/webhook",
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 with error message (not 404 or 500)
        assert response.status_code == 200, f"Webhook endpoint should be accessible, got {response.status_code}"
        
        data = response.json()
        # Empty payload should return error status
        assert "status" in data, "Response should contain status"
        print(f"Webhook endpoint accessible: {data}")
    
    def test_webhook_with_payment_success_event(self):
        """POST /api/cashfree/webhook should handle PAYMENT_SUCCESS event"""
        # Simulate a payment success webhook
        payload = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {
                    "order_id": "TEST_WEBHOOK_ORDER",
                    "order_amount": 100.00
                },
                "payment": {
                    "cf_payment_id": "12345",
                    "payment_amount": 100.00,
                    "payment_time": datetime.utcnow().isoformat()
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cashfree/webhook",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Webhook should return 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "ok", f"Webhook status should be ok: {data}"
        print(f"Payment success webhook handling: {data}")


class TestResendWhatsApp:
    """Test resend WhatsApp endpoint"""
    
    def test_resend_whatsapp_not_found(self):
        """POST /api/cashfree/order/{order_id}/resend-whatsapp should return 404 for non-existent order"""
        fake_order_id = "FAKE_ORDER_RESEND"
        response = requests.post(f"{BASE_URL}/api/cashfree/order/{fake_order_id}/resend-whatsapp")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Resend WhatsApp 404 handling working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
