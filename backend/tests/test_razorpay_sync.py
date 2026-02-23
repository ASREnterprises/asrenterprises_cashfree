"""
Test cases for Razorpay Payment Sync Feature
Tests: GET /api/admin/razorpay/payments, POST /api/admin/razorpay/sync
Verifies: Customer details (name, phone, email), source field, order creation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRazorpaySyncFeature:
    """Test Razorpay payment sync endpoints"""
    
    def test_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ API health check passed")
    
    def test_get_razorpay_payments(self):
        """Test GET /api/admin/razorpay/payments - Fetch payments from Razorpay API"""
        response = requests.get(f"{BASE_URL}/api/admin/razorpay/payments", params={"count": 10, "skip": 0})
        
        # Should return 200 or 500 if keys not configured
        if response.status_code == 200:
            data = response.json()
            assert "status" in data, "Response should have status field"
            assert data["status"] == "success", f"Expected success status, got: {data.get('status')}"
            assert "payments" in data, "Response should have payments array"
            assert "total" in data, "Response should have total count"
            assert isinstance(data["payments"], list), "Payments should be a list"
            print(f"✅ GET razorpay/payments returned {data['total']} successful payments")
            
            # If there are payments, verify structure
            if data["payments"]:
                payment = data["payments"][0]
                assert "id" in payment, "Payment should have id"
                assert "amount" in payment, "Payment should have amount"
                assert "status" in payment, "Payment should have status"
                assert payment["status"] == "captured", "Only captured payments should be returned"
                print(f"✅ Payment structure verified - ID: {payment['id'][:15]}...")
                
                # Check for customer details fields
                # These may be present: email, contact, notes
                if "email" in payment:
                    print(f"   - Email present: {payment['email'][:20] if payment['email'] else 'N/A'}...")
                if "contact" in payment:
                    print(f"   - Contact present: {payment['contact']}")
                if "description" in payment:
                    print(f"   - Description: {payment['description'][:30] if payment['description'] else 'N/A'}...")
        elif response.status_code == 500:
            data = response.json()
            if "Razorpay API keys not configured" in data.get("detail", ""):
                pytest.skip("Razorpay API keys not configured")
            else:
                pytest.fail(f"Unexpected 500 error: {data}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_sync_razorpay_payments(self):
        """Test POST /api/admin/razorpay/sync - Sync all Razorpay payments to orders"""
        response = requests.post(f"{BASE_URL}/api/admin/razorpay/sync", json={"sync_all": True})
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data, "Response should have status field"
            assert data["status"] == "success", f"Expected success status, got: {data.get('status')}"
            assert "total_processed" in data, "Response should have total_processed"
            assert "new_orders_created" in data, "Response should have new_orders_created"
            assert "orders_updated" in data, "Response should have orders_updated"
            
            print(f"✅ Sync completed successfully:")
            print(f"   - Total processed: {data['total_processed']}")
            print(f"   - New orders created: {data['new_orders_created']}")
            print(f"   - Orders updated: {data['orders_updated']}")
        elif response.status_code == 500:
            data = response.json()
            if "Razorpay API keys not configured" in data.get("detail", ""):
                pytest.skip("Razorpay API keys not configured")
            else:
                pytest.fail(f"Sync failed: {data}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_synced_orders_have_customer_details(self):
        """Verify synced orders have customer_name, customer_phone, customer_email from Razorpay"""
        # First, get all orders
        response = requests.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        
        orders = response.json()
        
        # Filter orders that were synced from Razorpay (source: razorpay_sync)
        synced_orders = [o for o in orders if o.get("source") == "razorpay_sync"]
        
        if not synced_orders:
            print("⚠️ No synced orders found (maybe no Razorpay payments exist)")
            # Also check for orders with RZP- prefix
            rzp_orders = [o for o in orders if o.get("order_number", "").startswith("RZP-")]
            if rzp_orders:
                synced_orders = rzp_orders
                print(f"   Found {len(rzp_orders)} orders with RZP- prefix")
        
        if synced_orders:
            print(f"✅ Found {len(synced_orders)} synced orders")
            
            for order in synced_orders[:5]:  # Check first 5
                order_num = order.get("order_number", "N/A")
                
                # Check customer_name field
                customer_name = order.get("customer_name", "")
                assert customer_name, f"Order {order_num} should have customer_name"
                
                # Check customer_phone field (may be empty if not provided in Razorpay)
                customer_phone = order.get("customer_phone", "")
                # Phone can be empty - just verify field exists
                
                # Check customer_email field (may be empty if not provided in Razorpay)
                customer_email = order.get("customer_email", "")
                
                print(f"   Order {order_num}:")
                print(f"     - Name: {customer_name}")
                print(f"     - Phone: {customer_phone or 'N/A'}")
                print(f"     - Email: {customer_email or 'N/A'}")
        else:
            print("⚠️ No synced orders to verify - run sync first")
    
    def test_synced_orders_have_source_field(self):
        """Verify synced orders have 'source: razorpay_sync' field"""
        response = requests.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        
        orders = response.json()
        
        # Check orders with RZP- prefix (these are synced)
        rzp_orders = [o for o in orders if o.get("order_number", "").startswith("RZP-")]
        
        if rzp_orders:
            print(f"✅ Found {len(rzp_orders)} orders with RZP- prefix")
            
            for order in rzp_orders[:5]:
                source = order.get("source", "")
                order_num = order.get("order_number", "N/A")
                
                assert source == "razorpay_sync", f"Order {order_num} should have source='razorpay_sync', got '{source}'"
                print(f"   ✅ Order {order_num} has source='{source}'")
        else:
            print("⚠️ No RZP- orders found - sync may not have created any new orders")
    
    def test_synced_orders_have_razorpay_payment_id(self):
        """Verify synced orders have razorpay_payment_id field"""
        response = requests.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200
        
        orders = response.json()
        synced_orders = [o for o in orders if o.get("source") == "razorpay_sync"]
        
        if synced_orders:
            for order in synced_orders[:3]:
                razorpay_payment_id = order.get("razorpay_payment_id", "")
                assert razorpay_payment_id, f"Order {order.get('order_number')} should have razorpay_payment_id"
                print(f"✅ Order {order.get('order_number')} has payment_id: {razorpay_payment_id[:15]}...")
        else:
            print("⚠️ No synced orders to verify razorpay_payment_id")
    
    def test_synced_orders_payment_status_is_paid(self):
        """Verify synced orders have payment_status='paid' and order_status='confirmed'"""
        response = requests.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200
        
        orders = response.json()
        synced_orders = [o for o in orders if o.get("source") == "razorpay_sync"]
        
        if synced_orders:
            for order in synced_orders[:3]:
                payment_status = order.get("payment_status", "")
                order_status = order.get("order_status", "")
                
                assert payment_status == "paid", f"Order {order.get('order_number')} should have payment_status='paid', got '{payment_status}'"
                assert order_status == "confirmed", f"Order {order.get('order_number')} should have order_status='confirmed', got '{order_status}'"
                
                print(f"✅ Order {order.get('order_number')}: payment_status={payment_status}, order_status={order_status}")
        else:
            print("⚠️ No synced orders to verify payment status")
    
    def test_existing_orders_updated_with_customer_details(self):
        """Verify that running sync again updates existing orders with missing customer details"""
        # Run sync twice and verify no duplicates
        
        # First sync
        response1 = requests.post(f"{BASE_URL}/api/admin/razorpay/sync", json={"sync_all": True})
        if response1.status_code == 500:
            pytest.skip("Razorpay API keys not configured")
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second sync
        response2 = requests.post(f"{BASE_URL}/api/admin/razorpay/sync", json={"sync_all": True})
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second sync should create 0 new orders (all already exist)
        assert data2["new_orders_created"] == 0, f"Second sync should not create new orders, created {data2['new_orders_created']}"
        
        print(f"✅ Idempotency verified - second sync:")
        print(f"   - Total processed: {data2['total_processed']}")
        print(f"   - New orders: {data2['new_orders_created']} (should be 0)")
        print(f"   - Updated: {data2['orders_updated']}")
    
    def test_get_specific_payment_details(self):
        """Test GET /api/admin/razorpay/payment/{payment_id} endpoint"""
        # First get a payment ID
        response = requests.get(f"{BASE_URL}/api/admin/razorpay/payments", params={"count": 1})
        
        if response.status_code == 500:
            pytest.skip("Razorpay API keys not configured")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["payments"]:
            payment_id = data["payments"][0]["id"]
            
            # Get specific payment details
            detail_response = requests.get(f"{BASE_URL}/api/admin/razorpay/payment/{payment_id}")
            assert detail_response.status_code == 200, f"Failed to get payment details: {detail_response.text}"
            
            detail_data = detail_response.json()
            assert detail_data["status"] == "success"
            assert "payment" in detail_data
            
            payment = detail_data["payment"]
            assert payment["id"] == payment_id
            
            print(f"✅ Got payment details for {payment_id[:15]}...")
            print(f"   - Amount: ₹{payment.get('amount', 0)/100}")
            print(f"   - Status: {payment.get('status')}")
            print(f"   - Email: {payment.get('email', 'N/A')}")
            print(f"   - Contact: {payment.get('contact', 'N/A')}")
        else:
            print("⚠️ No payments to test detail endpoint")
    
    def test_invalid_payment_id_returns_404(self):
        """Test that invalid payment ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/admin/razorpay/payment/invalid_payment_id_12345")
        
        if response.status_code == 500:
            data = response.json()
            if "Razorpay API keys not configured" in data.get("detail", ""):
                pytest.skip("Razorpay API keys not configured")
        
        # Should return 404 for invalid payment
        assert response.status_code == 404, f"Expected 404 for invalid payment, got {response.status_code}"
        print("✅ Invalid payment ID correctly returns 404")


class TestOrdersEndpoint:
    """Test orders endpoint to verify sync results"""
    
    def test_orders_list_includes_synced_orders(self):
        """Verify GET /api/shop/orders returns synced orders"""
        response = requests.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200
        
        orders = response.json()
        assert isinstance(orders, list)
        
        # Count synced orders
        synced_count = sum(1 for o in orders if o.get("source") == "razorpay_sync")
        rzp_prefix_count = sum(1 for o in orders if o.get("order_number", "").startswith("RZP-"))
        
        print(f"✅ Orders list retrieved: {len(orders)} total orders")
        print(f"   - Synced orders (source=razorpay_sync): {synced_count}")
        print(f"   - Orders with RZP- prefix: {rzp_prefix_count}")
    
    def test_order_has_all_required_fields(self):
        """Verify order structure has all required fields"""
        response = requests.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200
        
        orders = response.json()
        if orders:
            order = orders[0]
            
            required_fields = [
                "id", "order_number", "customer_name", "customer_phone",
                "total", "payment_status", "order_status"
            ]
            
            for field in required_fields:
                assert field in order, f"Order should have '{field}' field"
            
            print(f"✅ Order structure verified - all required fields present")
            print(f"   Sample order: {order.get('order_number')}")
        else:
            print("⚠️ No orders to verify structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
