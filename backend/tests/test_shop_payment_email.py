"""
Backend Tests for Shop Checkout Flow with Payment Verification and Email Notifications
Test iteration 22 - Testing the new email notification feature for shop orders

Features being tested:
1. Create shop order with customer email
2. Verify Razorpay payment via /api/shop/orders/{order_id}/payment-verify
3. Verify response includes 'email_sent' field
4. Verify WhatsApp notification URLs are returned correctly
"""

import pytest
import requests
import os
import uuid

# Get BASE_URL from environment - NO DEFAULT
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")
BASE_URL = BASE_URL.rstrip('/')


class TestShopOrderCreation:
    """Test shop order creation flow"""
    
    def test_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "status" in data
        print(f"✓ API health check passed")
    
    def test_create_order_with_email(self):
        """Create a shop order with customer email for online payment"""
        # First get products to use in order
        products_response = requests.get(f"{BASE_URL}/api/shop/products")
        assert products_response.status_code == 200
        products = products_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available for testing")
        
        test_product = products[0]
        print(f"✓ Using product: {test_product.get('name', 'Unknown')}")
        
        # Create order with customer email and razorpay payment
        order_data = {
            "customer_name": "TEST_Email_Customer",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "items": [{
                "product_id": test_product.get("id"),
                "product_name": test_product.get("name"),
                "quantity": 1,
                "price": test_product.get("sale_price") or test_product.get("price", 1000),
                "image": test_product.get("images", [""])[0] if test_product.get("images") else ""
            }],
            "subtotal": test_product.get("sale_price") or test_product.get("price", 1000),
            "delivery_charge": 0,
            "total": test_product.get("sale_price") or test_product.get("price", 1000),
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": "Test order for email notification"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        data = response.json()
        
        # Verify order creation response
        assert data.get("status") == "success"
        assert "order" in data
        assert "order_number" in data
        assert "whatsapp_notification_url" in data
        assert "customer_whatsapp_url" in data
        
        order = data.get("order", {})
        assert order.get("customer_email") == "test@example.com"
        assert order.get("payment_method") == "razorpay"
        
        print(f"✓ Order created successfully: #{data.get('order_number')}")
        print(f"✓ Order ID: {order.get('id')}")
        print(f"✓ Customer email in order: {order.get('customer_email')}")
        
        # Store order ID for payment verification test
        self.__class__.order_id = order.get("id")
        self.__class__.order_number = data.get("order_number")
    
    def test_create_order_without_email(self):
        """Create a shop order without customer email"""
        products_response = requests.get(f"{BASE_URL}/api/shop/products")
        assert products_response.status_code == 200
        products = products_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available for testing")
        
        test_product = products[0]
        
        order_data = {
            "customer_name": "TEST_NoEmail_Customer",
            "customer_phone": "9876543211",
            "customer_email": "",  # No email
            "items": [{
                "product_id": test_product.get("id"),
                "product_name": test_product.get("name"),
                "quantity": 1,
                "price": test_product.get("sale_price") or test_product.get("price", 1000),
                "image": ""
            }],
            "subtotal": test_product.get("sale_price") or test_product.get("price", 1000),
            "delivery_charge": 0,
            "total": test_product.get("sale_price") or test_product.get("price", 1000),
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": "Test order without email"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "success"
        order = data.get("order", {})
        assert order.get("customer_email") == ""
        
        # Store for test_payment_verify_without_email
        self.__class__.order_id_no_email = order.get("id")
        print(f"✓ Order without email created: #{data.get('order_number')}")


class TestPaymentVerification:
    """Test payment verification endpoint with email notification"""
    
    def test_payment_verify_with_email(self):
        """Verify payment and check email_sent field when customer has email"""
        # First create an order with email
        products_response = requests.get(f"{BASE_URL}/api/shop/products")
        assert products_response.status_code == 200
        products = products_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available for testing")
        
        test_product = products[0]
        
        order_data = {
            "customer_name": "TEST_PaymentVerify_Customer",
            "customer_phone": "9876543212",
            "customer_email": "test@example.com",
            "items": [{
                "product_id": test_product.get("id"),
                "product_name": test_product.get("name"),
                "quantity": 1,
                "price": 1000,
                "image": ""
            }],
            "subtotal": 1000,
            "delivery_charge": 0,
            "total": 1000,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": "Test order for payment verification"
        }
        
        order_response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert order_response.status_code == 200
        order_data_resp = order_response.json()
        order_id = order_data_resp.get("order", {}).get("id")
        order_number = order_data_resp.get("order_number")
        
        print(f"✓ Created order for payment test: #{order_number}")
        
        # Verify payment
        payment_data = {
            "razorpay_payment_id": f"pay_test_{uuid.uuid4().hex[:12]}",
            "razorpay_order_id": f"order_test_{uuid.uuid4().hex[:12]}",
            "razorpay_signature": "test_signature_for_testing"
        }
        
        verify_response = requests.post(
            f"{BASE_URL}/api/shop/orders/{order_id}/payment-verify",
            json=payment_data
        )
        
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        # Verify response structure
        assert data.get("status") == "success"
        assert data.get("message") == "Payment verified"
        assert "whatsapp_notification_url" in data
        assert "customer_whatsapp_url" in data
        
        # CRITICAL: Check email_sent field is present
        assert "email_sent" in data, "email_sent field missing from response"
        
        # email_sent should be True if Resend API is configured, False otherwise
        # In test environment, it depends on RESEND_API_KEY configuration
        email_sent = data.get("email_sent")
        assert isinstance(email_sent, bool), "email_sent should be boolean"
        
        print(f"✓ Payment verification successful")
        print(f"✓ Response includes email_sent: {email_sent}")
        print(f"✓ WhatsApp notification URL present: {len(data.get('whatsapp_notification_url', '')) > 0}")
        print(f"✓ Customer WhatsApp URL present: {len(data.get('customer_whatsapp_url', '')) > 0}")
        
        # Verify WhatsApp URLs have correct format
        whatsapp_url = data.get("whatsapp_notification_url", "")
        assert "wa.me" in whatsapp_url, "WhatsApp URL should contain wa.me"
        
        customer_whatsapp_url = data.get("customer_whatsapp_url", "")
        assert "wa.me" in customer_whatsapp_url, "Customer WhatsApp URL should contain wa.me"
    
    def test_payment_verify_without_email(self):
        """Verify payment when customer has no email - email_sent should be False"""
        products_response = requests.get(f"{BASE_URL}/api/shop/products")
        assert products_response.status_code == 200
        products = products_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available for testing")
        
        test_product = products[0]
        
        order_data = {
            "customer_name": "TEST_NoEmailPayment_Customer",
            "customer_phone": "9876543213",
            "customer_email": "",  # No email
            "items": [{
                "product_id": test_product.get("id"),
                "product_name": test_product.get("name"),
                "quantity": 1,
                "price": 500,
                "image": ""
            }],
            "subtotal": 500,
            "delivery_charge": 0,
            "total": 500,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": "Test order without email"
        }
        
        order_response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert order_response.status_code == 200
        order_id = order_response.json().get("order", {}).get("id")
        
        # Verify payment
        payment_data = {
            "razorpay_payment_id": f"pay_noemail_{uuid.uuid4().hex[:12]}",
            "razorpay_order_id": f"order_noemail_{uuid.uuid4().hex[:12]}",
            "razorpay_signature": "test_signature"
        }
        
        verify_response = requests.post(
            f"{BASE_URL}/api/shop/orders/{order_id}/payment-verify",
            json=payment_data
        )
        
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert "email_sent" in data
        # When no email is provided, email_sent should be False
        assert data.get("email_sent") == False, "email_sent should be False when no customer email"
        
        print(f"✓ Payment verified without email - email_sent correctly False")
    
    def test_payment_verify_nonexistent_order(self):
        """Verify payment for non-existent order returns 404"""
        fake_order_id = str(uuid.uuid4())
        
        payment_data = {
            "razorpay_payment_id": "pay_fake_123",
            "razorpay_order_id": "order_fake_123",
            "razorpay_signature": "fake_signature"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/shop/orders/{fake_order_id}/payment-verify",
            json=payment_data
        )
        
        assert response.status_code == 404
        print(f"✓ Non-existent order returns 404 as expected")


class TestWhatsAppNotifications:
    """Test WhatsApp notification URL generation"""
    
    def test_whatsapp_urls_format(self):
        """Verify WhatsApp URLs are correctly formatted"""
        products_response = requests.get(f"{BASE_URL}/api/shop/products")
        assert products_response.status_code == 200
        products = products_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available for testing")
        
        test_product = products[0]
        
        order_data = {
            "customer_name": "TEST_WhatsApp_Customer",
            "customer_phone": "9876543214",
            "customer_email": "whatsapp_test@example.com",
            "items": [{
                "product_id": test_product.get("id"),
                "product_name": test_product.get("name"),
                "quantity": 2,
                "price": 1500,
                "image": ""
            }],
            "subtotal": 3000,
            "delivery_charge": 100,
            "total": 3100,
            "delivery_type": "delivery",
            "delivery_address": "123 Test Address, Bihar",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": ""
        }
        
        order_response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert order_response.status_code == 200
        order_data_resp = order_response.json()
        
        # Verify WhatsApp URLs in order creation response
        whatsapp_url = order_data_resp.get("whatsapp_notification_url", "")
        customer_url = order_data_resp.get("customer_whatsapp_url", "")
        
        assert "wa.me" in whatsapp_url
        assert "91" in whatsapp_url  # Should include India country code
        assert "8877896889" in whatsapp_url  # Admin phone number
        
        assert "wa.me" in customer_url
        assert "919876543214" in customer_url  # Customer phone with country code
        
        # Now verify payment and check WhatsApp URLs
        order_id = order_data_resp.get("order", {}).get("id")
        
        payment_data = {
            "razorpay_payment_id": f"pay_wa_test_{uuid.uuid4().hex[:10]}",
            "razorpay_order_id": f"order_wa_test_{uuid.uuid4().hex[:10]}",
            "razorpay_signature": "test_sig"
        }
        
        verify_response = requests.post(
            f"{BASE_URL}/api/shop/orders/{order_id}/payment-verify",
            json=payment_data
        )
        
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        
        # Check WhatsApp URLs in payment verify response
        assert "whatsapp_notification_url" in verify_data
        assert "customer_whatsapp_url" in verify_data
        assert "wa.me" in verify_data.get("whatsapp_notification_url", "")
        assert "wa.me" in verify_data.get("customer_whatsapp_url", "")
        
        print(f"✓ WhatsApp URLs correctly formatted in both order and payment responses")


class TestRazorpayConfig:
    """Test Razorpay configuration endpoint"""
    
    def test_razorpay_config(self):
        """Verify Razorpay config endpoint returns key_id"""
        response = requests.get(f"{BASE_URL}/api/shop/razorpay-config")
        assert response.status_code == 200
        data = response.json()
        
        assert "key_id" in data
        # Key should exist but we don't check its value for security
        print(f"✓ Razorpay config endpoint working, key_id present")


class TestOrderTracking:
    """Test order tracking functionality"""
    
    def test_track_order(self):
        """Verify order can be tracked after payment"""
        # Create and pay for an order
        products_response = requests.get(f"{BASE_URL}/api/shop/products")
        products = products_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available")
        
        test_product = products[0]
        
        order_data = {
            "customer_name": "TEST_Track_Customer",
            "customer_phone": "9876543215",
            "customer_email": "track@example.com",
            "items": [{
                "product_id": test_product.get("id"),
                "product_name": test_product.get("name"),
                "quantity": 1,
                "price": 1000,
                "image": ""
            }],
            "subtotal": 1000,
            "delivery_charge": 0,
            "total": 1000,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": ""
        }
        
        order_response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert order_response.status_code == 200
        order_data_resp = order_response.json()
        order_id = order_data_resp.get("order", {}).get("id")
        order_number = order_data_resp.get("order_number")
        
        # Verify payment
        payment_data = {
            "razorpay_payment_id": f"pay_track_{uuid.uuid4().hex[:10]}",
            "razorpay_order_id": f"order_track_{uuid.uuid4().hex[:10]}",
            "razorpay_signature": "test_sig"
        }
        
        verify_response = requests.post(
            f"{BASE_URL}/api/shop/orders/{order_id}/payment-verify",
            json=payment_data
        )
        assert verify_response.status_code == 200
        
        # Track the order
        track_response = requests.get(f"{BASE_URL}/api/shop/orders/track/{order_number}")
        assert track_response.status_code == 200
        track_data = track_response.json()
        
        assert track_data.get("order_number") == order_number
        assert track_data.get("payment_status") == "paid"
        assert track_data.get("order_status") == "confirmed"
        
        print(f"✓ Order tracking working - Status: {track_data.get('order_status')}, Payment: {track_data.get('payment_status')}")


# Cleanup - delete test orders after tests
@pytest.fixture(scope="module", autouse=True)
def cleanup():
    """Cleanup test data after all tests"""
    yield
    # Note: In production, we would delete TEST_ prefixed orders
    # For now, leaving test orders for debugging purposes
    print("\n✓ Test cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
