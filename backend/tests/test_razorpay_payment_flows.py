"""
Test Razorpay Payment Integration for ASR Enterprises
Focus: Verify Razorpay configuration, order creation, and payment flows
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRazorpayConfiguration:
    """Test Razorpay configuration and status endpoints"""
    
    def test_razorpay_status_endpoint(self):
        """Verify razorpay-status endpoint shows correct configuration"""
        response = requests.get(f"{BASE_URL}/api/shop/razorpay-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "key_id_set" in data, "Missing key_id_set field"
        assert "secret_set" in data, "Missing secret_set field"
        assert "client_initialized" in data, "Missing client_initialized field"
        
        # Verify all configurations are set
        assert data["key_id_set"] == True, f"key_id_set is {data['key_id_set']}, expected True"
        assert data["secret_set"] == True, f"secret_set is {data['secret_set']}, expected True"
        assert data["client_initialized"] == True, f"client_initialized is {data['client_initialized']}, expected True"
        
        # Verify key prefix matches new credentials (rzp_live_SK301HQRh9RYf7)
        if data.get("key_id_prefix"):
            assert data["key_id_prefix"].startswith("rzp_live_SK301"), f"Key prefix {data['key_id_prefix']} doesn't match expected"
        
        print(f"✓ Razorpay status: key_id={data['key_id_set']}, secret={data['secret_set']}, client={data['client_initialized']}")
        print(f"✓ Key prefix: {data.get('key_id_prefix', 'N/A')}")
    
    def test_razorpay_config_endpoint(self):
        """Verify razorpay-config returns key_id for frontend"""
        response = requests.get(f"{BASE_URL}/api/shop/razorpay-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "key_id" in data, "Missing key_id field"
        assert "configured" in data, "Missing configured field"
        
        # Verify configuration
        assert data["configured"] == True, f"configured is {data['configured']}, expected True"
        assert data["key_id"].startswith("rzp_"), f"key_id should start with 'rzp_', got {data['key_id']}"
        
        print(f"✓ Razorpay config: key_id={data['key_id']}, configured={data['configured']}")


class TestBookServiceRazorpayFlow:
    """Test Book Solar Service with Razorpay payment"""
    
    def test_book_service_creates_razorpay_order(self):
        """POST /api/shop/book-service should create Razorpay order and return razorpay_order_id"""
        payload = {
            "customer_name": "TEST_Razorpay_User",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "status" in data, "Missing status field"
        assert data["status"] == "success", f"Expected success, got {data['status']}"
        
        assert "booking" in data, "Missing booking object"
        assert "key_id" in data, "Missing key_id"
        assert "razorpay_order_id" in data, "Missing razorpay_order_id"
        
        # Verify razorpay_order_id format
        order_id = data["razorpay_order_id"]
        assert order_id is not None, "razorpay_order_id is None"
        assert order_id.startswith("order_"), f"razorpay_order_id should start with 'order_', got {order_id}"
        assert len(order_id) > 15, f"razorpay_order_id should be longer than 15 chars, got {len(order_id)}"
        
        # Verify key_id
        key_id = data["key_id"]
        assert key_id is not None, "key_id is None"
        assert key_id.startswith("rzp_"), f"key_id should start with 'rzp_', got {key_id}"
        
        # Verify booking details
        booking = data["booking"]
        assert booking["customer_name"] == "TEST_Razorpay_User"
        assert booking["payment_status"] == "pending"
        assert booking["amount"] >= 1000, f"Amount should be >= 1000, got {booking['amount']}"
        
        print(f"✓ Book service created Razorpay order: {order_id}")
        print(f"✓ Key ID: {key_id}")
        print(f"✓ Amount: ₹{booking['amount']}")
        print(f"✓ Booking number: {booking['booking_number']}")


class TestShopOrdersRazorpayFlow:
    """Test Shop Orders with Razorpay payment"""
    
    @pytest.fixture
    def sample_cart_items(self):
        """Get sample products for cart"""
        response = requests.get(f"{BASE_URL}/api/shop/products")
        products = response.json()
        if products:
            product = products[0]
            return [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 1,
                "price": product.get("sale_price") or product["price"],
                "image": product.get("images", [""])[0] if product.get("images") else ""
            }]
        return [{
            "product_id": "test-product-1",
            "product_name": "Test Solar Panel",
            "quantity": 1,
            "price": 5000,
            "image": ""
        }]
    
    def test_shop_order_razorpay_payment_creates_order_id(self, sample_cart_items):
        """POST /api/shop/orders with payment_method=razorpay should return razorpay_order_id"""
        items = sample_cart_items
        subtotal = sum(item["price"] * item["quantity"] for item in items)
        
        payload = {
            "customer_name": "TEST_Shop_User",
            "customer_phone": "9876543211",
            "customer_email": "shop@example.com",
            "items": items,
            "subtotal": subtotal,
            "delivery_charge": 0,
            "total": subtotal,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "razorpay",
            "notes": "Test order for Razorpay"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "status" in data, "Missing status field"
        assert data["status"] == "success", f"Expected success, got {data['status']}"
        
        assert "order_number" in data, "Missing order_number"
        assert "razorpay_order_id" in data, "Missing razorpay_order_id"
        assert "key_id" in data, "Missing key_id"
        
        # Verify razorpay_order_id format
        order_id = data["razorpay_order_id"]
        assert order_id is not None, "razorpay_order_id is None"
        assert order_id.startswith("order_"), f"razorpay_order_id should start with 'order_', got {order_id}"
        
        # Verify key_id
        key_id = data["key_id"]
        assert key_id is not None, "key_id is None"
        assert key_id.startswith("rzp_"), f"key_id should start with 'rzp_', got {key_id}"
        
        print(f"✓ Shop order created with Razorpay order: {order_id}")
        print(f"✓ Order number: {data['order_number']}")
        print(f"✓ Key ID: {key_id}")
    
    def test_shop_order_cod_no_razorpay_order(self, sample_cart_items):
        """POST /api/shop/orders with payment_method=cod should NOT create razorpay_order_id"""
        items = sample_cart_items
        subtotal = sum(item["price"] * item["quantity"] for item in items)
        
        payload = {
            "customer_name": "TEST_COD_User",
            "customer_phone": "9876543212",
            "customer_email": "cod@example.com",
            "items": items,
            "subtotal": subtotal,
            "delivery_charge": 0,
            "total": subtotal,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "cod",
            "notes": "COD order - no Razorpay"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        
        # Verify COD order doesn't have razorpay_order_id
        assert data.get("razorpay_order_id") is None, f"COD order should not have razorpay_order_id, got {data.get('razorpay_order_id')}"
        assert data.get("key_id") is None, f"COD order should not have key_id, got {data.get('key_id')}"
        
        print(f"✓ COD order created without Razorpay: {data['order_number']}")


class TestRazorpayCredentialsMatch:
    """Verify the Razorpay credentials match the user-provided values"""
    
    def test_credentials_match_user_provided(self):
        """Verify key_id matches rzp_live_SK301HQRh9RYf7"""
        response = requests.get(f"{BASE_URL}/api/shop/razorpay-config")
        assert response.status_code == 200
        
        data = response.json()
        key_id = data.get("key_id", "")
        
        # Check if key matches the new credentials
        expected_key = "rzp_live_SK301HQRh9RYf7"
        assert key_id == expected_key, f"Expected key_id '{expected_key}', got '{key_id}'"
        
        print(f"✓ Razorpay key_id matches user-provided credentials: {key_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
