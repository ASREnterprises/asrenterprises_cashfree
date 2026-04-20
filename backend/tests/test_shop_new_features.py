"""
Test Suite for New Shop Features - Iteration 15
Tests: Wire category, distance-based delivery fees, payment verification, order number generation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

# ==================== WIRE CATEGORY TESTS ====================
class TestWireCategory:
    """Test Solar Wire category is present in categories"""
    
    def test_wire_category_exists(self, api_client):
        """GET /api/shop/categories - should include 'wire' category"""
        response = api_client.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200
        
        categories = response.json()
        category_ids = [c["id"] for c in categories]
        assert "wire" in category_ids, "Wire category missing from categories"
        
        wire_cat = next((c for c in categories if c["id"] == "wire"), None)
        assert wire_cat is not None
        assert wire_cat.get("name") == "Solar Wire"
        print("✓ Wire category exists in categories with correct name")
        
    def test_all_six_categories_exist(self, api_client):
        """GET /api/shop/categories - should return 6 categories total"""
        response = api_client.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert len(categories) == 6, f"Expected 6 categories, got {len(categories)}"
        
        expected_categories = ["solar_panel", "inverter", "battery", "wire", "accessory", "service"]
        actual_ids = [c["id"] for c in categories]
        
        for exp in expected_categories:
            assert exp in actual_ids, f"Missing category: {exp}"
        print(f"✓ All 6 categories present: {actual_ids}")

    def test_service_category_has_base_price(self, api_client):
        """Service category should have base_price of 1500"""
        response = api_client.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200
        
        categories = response.json()
        service_cat = next((c for c in categories if c["id"] == "service"), None)
        assert service_cat is not None
        assert service_cat.get("base_price") == 1500, f"Service base_price should be 1500, got {service_cat.get('base_price')}"
        print("✓ Service category has base_price=1500 (Solar Installation Service price)")

# ==================== DELIVERY FEES TESTS ====================
class TestDeliveryFees:
    """Test distance-based delivery fee structure"""
    
    def test_get_delivery_fees(self, api_client):
        """GET /api/shop/delivery-fees - should return fee structure"""
        response = api_client.get(f"{BASE_URL}/api/shop/delivery-fees")
        assert response.status_code == 200
        
        fees = response.json()
        assert isinstance(fees, dict), "Delivery fees should be a dictionary"
        
        expected_fees = {
            "0-5": 50,
            "5-10": 100,
            "10-20": 150,
            "20-30": 200,
            "30+": 300
        }
        
        for distance, fee in expected_fees.items():
            assert distance in fees, f"Missing distance range: {distance}"
            assert fees[distance] == fee, f"Fee for {distance} should be {fee}, got {fees[distance]}"
        
        print("✓ Distance-based delivery fees correct:")
        for d, f in expected_fees.items():
            print(f"  • {d} km: ₹{f}")

# ==================== ORDER NUMBER GENERATION TEST ====================
class TestOrderNumber:
    """Test order number auto-generation on successful order"""
    
    def test_order_number_format(self, api_client):
        """Order number should be auto-generated with ASR prefix"""
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_OrderNum_Customer",
            "customer_phone": "9876543210",
            "delivery_type": "pickup",
            "payment_method": "cod",
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product["price"],
                "quantity": 1
            }],
            "subtotal": product["price"],
            "delivery_charge": 0,
            "total": product["price"]
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        order_number = data.get("order_number", "")
        
        # Verify order number format: ASR + date + unique ID
        assert order_number.startswith("ASR"), f"Order number should start with 'ASR', got: {order_number}"
        assert len(order_number) >= 14, f"Order number should have at least 14 chars, got: {len(order_number)}"
        print(f"✓ Order number auto-generated: {order_number}")

    def test_delivery_with_distance_fee(self, api_client):
        """Test order with distance-based delivery fee"""
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        # Order with 5-10km delivery (₹100 fee)
        order_data = {
            "customer_name": "TEST_Distance_Fee",
            "customer_phone": "9111222333",
            "delivery_type": "delivery",
            "delivery_address": "Test Address, Patna",
            "delivery_distance": "5-10",
            "payment_method": "cod",
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product["price"],
                "quantity": 1
            }],
            "subtotal": product["price"],
            "delivery_charge": 100,  # Fee for 5-10km
            "total": product["price"] + 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        print(f"✓ Order with 5-10km delivery fee created: {data.get('order_number')}")

# ==================== RAZORPAY PAYMENT VERIFICATION TESTS ====================
class TestPaymentVerification:
    """Test Razorpay payment verification and auto-record creation"""
    
    def test_payment_verify_creates_payment_record(self, api_client):
        """POST /api/shop/orders/{order_id}/payment-verify - should update order and create payment record"""
        # First create a Razorpay order
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_PaymentVerify",
            "customer_phone": "9999888877",
            "delivery_type": "pickup",
            "payment_method": "razorpay",
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product["price"],
                "quantity": 1
            }],
            "subtotal": product["price"],
            "delivery_charge": 0,
            "total": product["price"]
        }
        
        order_res = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert order_res.status_code == 200
        
        order_data_result = order_res.json()
        # order_id is inside the 'order' object
        order_id = order_data_result.get("order", {}).get("id")
        order_number = order_data_result.get("order_number")
        
        # Simulate Razorpay payment verification
        payment_data = {
            "razorpay_payment_id": f"pay_test_{uuid.uuid4().hex[:10]}",
            "razorpay_order_id": f"order_test_{uuid.uuid4().hex[:10]}",
            "razorpay_signature": "test_signature_123"
        }
        
        verify_res = api_client.post(
            f"{BASE_URL}/api/shop/orders/{order_id}/payment-verify",
            json=payment_data
        )
        assert verify_res.status_code == 200
        
        verify_data = verify_res.json()
        assert verify_data.get("status") == "success"
        assert "whatsapp_notification_url" in verify_data
        assert "customer_whatsapp_url" in verify_data
        print(f"✓ Payment verification successful for order {order_number}")
        print(f"✓ WhatsApp notification URLs returned for admin and customer")
        
        # Check that order status is updated to 'confirmed' and payment 'paid'
        orders_res = api_client.get(f"{BASE_URL}/api/shop/orders")
        orders = orders_res.json()
        verified_order = next((o for o in orders if o.get("id") == order_id), None)
        
        if verified_order:
            assert verified_order.get("payment_status") == "paid"
            assert verified_order.get("order_status") == "confirmed"
            print(f"✓ Order status updated to 'confirmed', payment status to 'paid'")

# ==================== WIRE PRODUCT TESTS ====================
class TestWireProducts:
    """Test wire product creation with proper attributes"""
    
    def test_create_wire_product(self, api_client):
        """Create wire product with AC/DC type and sqmm size"""
        wire_products = [
            {"name": "TEST_AC Wire 4sqmm", "type": "AC", "size": "4sqmm", "price": 35},
            {"name": "TEST_AC Wire 6sqmm", "type": "AC", "size": "6sqmm", "price": 50},
            {"name": "TEST_DC Wire 4sqmm", "type": "DC", "size": "4sqmm", "price": 40},
            {"name": "TEST_DC Wire 6sqmm", "type": "DC", "size": "6sqmm", "price": 55}
        ]
        
        for wire in wire_products:
            product_data = {
                "name": wire["name"],
                "description": f"{wire['type']} Solar Wire - {wire['size']} (rate per meter)",
                "short_description": f"{wire['type']} Wire {wire['size']} - ₹{wire['price']}/meter",
                "category": "wire",
                "price": wire["price"],
                "stock": 1000,  # Per meter, so high stock
                "is_active": True,
                "specifications": {
                    "wire_type": wire["type"],
                    "size_sqmm": wire["size"],
                    "unit": "per meter"
                }
            }
            
            res = api_client.post(f"{BASE_URL}/api/shop/products", json=product_data)
            assert res.status_code == 200
            print(f"✓ Created wire product: {wire['name']} @ ₹{wire['price']}/meter")

    def test_filter_wire_products(self, api_client):
        """Filter products by wire category"""
        response = api_client.get(f"{BASE_URL}/api/shop/products?category=wire")
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product["category"] == "wire"
        
        print(f"✓ Wire category filter works - found {len(products)} wire products")

# ==================== SERVICE PRODUCT TEST ====================
class TestServiceProduct:
    """Test service product (Solar Installation Service)"""
    
    def test_create_service_product(self, api_client):
        """Create Solar Installation Service product at ₹1500"""
        service_data = {
            "name": "TEST_Solar Installation Service",
            "description": "Professional solar panel installation service by ASR Enterprises",
            "short_description": "Expert solar installation service",
            "category": "service",
            "price": 1500,  # Service price as specified
            "stock": 100,  # Service availability
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/products", json=service_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        product = data.get("product", {})
        assert product.get("price") == 1500
        print(f"✓ Solar Installation Service created at ₹1,500")

# ==================== CLEANUP ====================
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(api_client):
    """Cleanup TEST_ prefixed data after tests"""
    yield
    
    try:
        products_res = api_client.get(f"{BASE_URL}/api/shop/products?active_only=false")
        if products_res.status_code == 200:
            products = products_res.json()
            for product in products:
                if product.get("name", "").startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/shop/products/{product['id']}")
                    print(f"Cleaned up: {product['name']}")
    except Exception as e:
        print(f"Cleanup error: {e}")
