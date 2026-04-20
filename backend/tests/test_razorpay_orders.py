"""
Test Razorpay Orders API integration
Verifies that book-service and shop/orders endpoints create Razorpay orders correctly
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRazorpayServiceBooking:
    """Test /api/shop/book-service endpoint creates Razorpay order"""
    
    def test_book_service_returns_razorpay_order_id(self):
        """Book service should return razorpay_order_id for payment"""
        # Create test booking request
        booking_data = {
            "customer_name": "TEST_RazorpayOrderTest",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=booking_data)
        
        # Should return 200
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Data assertions - verify Razorpay order was created
        assert data.get("status") == "success", f"Expected success status, got: {data}"
        assert "razorpay_order_id" in data, f"Missing razorpay_order_id in response: {data}"
        assert data["razorpay_order_id"] is not None, "razorpay_order_id should not be None"
        assert data["razorpay_order_id"].startswith("order_"), f"Invalid order_id format: {data['razorpay_order_id']}"
        
        # Verify key_id is returned
        assert "key_id" in data, f"Missing key_id in response: {data}"
        assert data["key_id"] is not None, "key_id should not be None"
        assert data["key_id"].startswith("rzp_"), f"Invalid key_id format: {data['key_id']}"
        
        # Verify booking details
        assert "booking" in data, f"Missing booking in response: {data}"
        booking = data["booking"]
        assert booking["customer_name"] == booking_data["customer_name"]
        assert booking["customer_phone"] == booking_data["customer_phone"]
        assert "booking_number" in booking
        assert booking["booking_number"].startswith("BSK-")
        assert "amount" in booking
        assert booking["amount"] > 0
        
        print(f"✅ Book service returns valid Razorpay order_id: {data['razorpay_order_id']}")
        print(f"   Key ID: {data['key_id']}")
        print(f"   Booking: {booking['booking_number']}, Amount: ₹{booking['amount']}")
    
    def test_book_service_validation(self):
        """Book service should validate required fields"""
        # Missing required fields
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json={"customer_name": ""})
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"
        
        print("✅ Book service validates required fields correctly")


class TestRazorpayShopOrders:
    """Test /api/shop/orders endpoint creates Razorpay order for Razorpay payment method"""
    
    def get_test_product(self):
        """Get a test product for order"""
        response = requests.get(f"{BASE_URL}/api/shop/products")
        if response.status_code == 200:
            products = response.json()
            if products:
                return products[0]
        return None
    
    def test_shop_order_with_razorpay_returns_order_id(self):
        """Shop order with razorpay payment should return razorpay_order_id"""
        # Get a product first
        product = self.get_test_product()
        if not product:
            pytest.skip("No products available for testing")
        
        # Create order with Razorpay payment
        order_data = {
            "customer_name": "TEST_ShopRazorpayOrder",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "delivery_type": "pickup",
            "payment_method": "razorpay",  # Key: using Razorpay payment
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product.get("sale_price") or product["price"],
                "quantity": 1,
                "image": product.get("images", [""])[0] if product.get("images") else ""
            }],
            "subtotal": product.get("sale_price") or product["price"],
            "delivery_charge": 0,
            "total": product.get("sale_price") or product["price"]
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        
        # Should return 200
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Data assertions - verify Razorpay order was created
        assert data.get("status") == "success", f"Expected success status, got: {data}"
        assert "razorpay_order_id" in data, f"Missing razorpay_order_id in response: {data}"
        assert data["razorpay_order_id"] is not None, "razorpay_order_id should not be None"
        assert data["razorpay_order_id"].startswith("order_"), f"Invalid order_id format: {data['razorpay_order_id']}"
        
        # Verify key_id is returned for Razorpay payment
        assert "key_id" in data, f"Missing key_id in response: {data}"
        assert data["key_id"] is not None, "key_id should not be None"
        assert data["key_id"].startswith("rzp_"), f"Invalid key_id format: {data['key_id']}"
        
        # Verify order number
        assert "order_number" in data, f"Missing order_number in response: {data}"
        assert data["order_number"].startswith("ASR")
        
        print(f"✅ Shop order (Razorpay) returns valid order_id: {data['razorpay_order_id']}")
        print(f"   Key ID: {data['key_id']}")
        print(f"   Order: {data['order_number']}, Total: ₹{order_data['total']}")
    
    def test_shop_order_with_cod_no_razorpay_order(self):
        """Shop order with COD payment should NOT create razorpay_order_id"""
        # Get a product first
        product = self.get_test_product()
        if not product:
            pytest.skip("No products available for testing")
        
        # Create order with COD payment
        order_data = {
            "customer_name": "TEST_ShopCODOrder",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "delivery_type": "pickup",
            "payment_method": "cod",  # Key: using COD payment
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product.get("sale_price") or product["price"],
                "quantity": 1,
                "image": product.get("images", [""])[0] if product.get("images") else ""
            }],
            "subtotal": product.get("sale_price") or product["price"],
            "delivery_charge": 0,
            "total": product.get("sale_price") or product["price"]
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        
        # Should return 200
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Data assertions - razorpay_order_id should be None for COD
        assert data.get("status") == "success", f"Expected success status, got: {data}"
        assert data.get("razorpay_order_id") is None, f"COD order should not have razorpay_order_id: {data}"
        assert data.get("key_id") is None, f"COD order should not have key_id: {data}"
        
        # Verify order number is still returned
        assert "order_number" in data, f"Missing order_number in response: {data}"
        assert data["order_number"].startswith("ASR")
        
        print(f"✅ Shop order (COD) correctly has no Razorpay order_id")
        print(f"   Order: {data['order_number']}")


class TestRazorpayConfiguration:
    """Test Razorpay is properly configured"""
    
    def test_book_service_config_endpoint(self):
        """Book service config should return price"""
        response = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "price" in data, f"Missing price in config: {data}"
        assert data["price"] > 0, f"Price should be positive: {data}"
        
        print(f"✅ Book service config: ₹{data['price']}")
    
    def test_razorpay_client_is_initialized(self):
        """Verify Razorpay client works by creating a booking"""
        # If book-service returns 500 with "Payment gateway not configured", Razorpay isn't set up
        booking_data = {
            "customer_name": "TEST_ConfigCheck",
            "customer_phone": "9876543210"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=booking_data)
        
        # Should NOT return 500 with "Payment gateway not configured"
        if response.status_code == 500:
            data = response.json()
            assert "Payment gateway not configured" not in str(data), "Razorpay client is not configured!"
        
        # If we get here with 200, Razorpay is configured
        assert response.status_code == 200, f"Unexpected error: {response.status_code}: {response.text}"
        print("✅ Razorpay client is properly initialized")


class TestRazorpayOrderVerification:
    """Test that Razorpay orders are valid format"""
    
    def test_razorpay_order_id_format(self):
        """Verify Razorpay order ID follows expected format"""
        booking_data = {
            "customer_name": "TEST_OrderFormat",
            "customer_phone": "9876543210"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=booking_data)
        assert response.status_code == 200
        
        data = response.json()
        order_id = data.get("razorpay_order_id", "")
        
        # Razorpay order IDs are in format: order_XXXXXXXXXXXXX
        # They are 25+ characters long and start with "order_"
        assert order_id.startswith("order_"), f"Order ID should start with 'order_': {order_id}"
        assert len(order_id) >= 20, f"Order ID seems too short: {order_id}"
        
        # Check it contains only valid characters (alphanumeric and underscore)
        import re
        assert re.match(r'^order_[a-zA-Z0-9]+$', order_id), f"Invalid characters in order ID: {order_id}"
        
        print(f"✅ Razorpay order ID format is valid: {order_id}")


@pytest.fixture(scope="module")
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after tests complete"""
    yield
    # Cleanup logic would go here if needed
    print("\n🧹 Test data cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
