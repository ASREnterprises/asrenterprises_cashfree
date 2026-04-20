"""
Backend API Tests for ASR Enterprises Shop E-Commerce Features - Iteration 18
Tests: Razorpay config, AI service description, products CRUD, categories, delivery fees, orders
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

class TestRazorpayConfig:
    """Test Razorpay configuration endpoint"""
    
    def test_get_razorpay_config_returns_correct_key(self, api_client):
        """Test that GET /api/shop/razorpay-config returns the correct live key"""
        response = api_client.get(f"{BASE_URL}/api/shop/razorpay-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "key_id" in data, "Response should contain 'key_id'"
        assert data["key_id"] == "rzp_live_SJIqziW7w31a3U", f"Expected 'rzp_live_SJIqziW7w31a3U', got '{data['key_id']}'"
        print(f"✓ Razorpay key_id: {data['key_id']}")


class TestAIServiceDescription:
    """Test AI service description generation endpoint"""
    
    def test_generate_service_description_installation(self, api_client):
        """Test POST /api/generate-service-description generates AI descriptions"""
        payload = {
            "service_name": "Solar Installation Service",
            "service_type": "installation",
            "price": 1500
        }
        response = api_client.post(f"{BASE_URL}/api/generate-service-description", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "description" in data, "Response should contain 'description'"
        assert isinstance(data["description"], str), "Description should be a string"
        assert len(data["description"]) > 50, f"Description too short: {len(data['description'])} chars"
        # Check if generated flag exists (True = AI, False = fallback template)
        assert "generated" in data, "Response should contain 'generated' flag"
        print(f"✓ Service description generated: {data['generated']}")
        print(f"  Description preview: {data['description'][:100]}...")

    def test_generate_service_description_maintenance(self, api_client):
        """Test service description for maintenance type"""
        payload = {
            "service_name": "Solar Maintenance Service",
            "service_type": "maintenance",
            "price": 2000
        }
        response = api_client.post(f"{BASE_URL}/api/generate-service-description", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "description" in data
        print(f"✓ Maintenance description generated")


class TestShopCategories:
    """Test shop categories endpoint"""
    
    def test_get_all_categories(self, api_client):
        """Test GET /api/shop/categories returns all 6 categories including wire and service"""
        response = api_client.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Extract category IDs
        category_ids = [cat.get("id") for cat in data]
        print(f"✓ Categories found: {category_ids}")
        
        # Check for required categories
        required_categories = ["solar_panel", "inverter", "battery", "wire", "accessory", "service"]
        for cat in required_categories:
            assert cat in category_ids, f"Missing category: {cat}"
        
        print(f"✓ All 6 required categories present")


class TestDeliveryFees:
    """Test delivery fees endpoint"""
    
    def test_get_delivery_fees(self, api_client):
        """Test GET /api/shop/delivery-fees returns distance-based fee structure"""
        response = api_client.get(f"{BASE_URL}/api/shop/delivery-fees")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict"
        
        # Check expected distance ranges
        expected_ranges = ["0-5", "5-10", "10-20", "20-30", "30+"]
        for range_key in expected_ranges:
            assert range_key in data, f"Missing delivery fee range: {range_key}"
            assert isinstance(data[range_key], (int, float)), f"Fee for {range_key} should be numeric"
        
        print(f"✓ Delivery fees: {data}")


class TestShopProducts:
    """Test shop products CRUD endpoints"""
    
    @pytest.fixture
    def test_wire_product_data(self):
        """Test data for wire product"""
        return {
            "name": f"TEST_DC Wire 4sqmm (per meter)",
            "description": "Test DC wire for solar installations",
            "category": "wire",
            "price": 45,
            "stock": 1000,
            "is_active": True,
            "wire_type": "DC",
            "wire_size": "4sqmm"
        }
    
    @pytest.fixture
    def test_service_product_data(self):
        """Test data for service product"""
        return {
            "name": f"TEST_Solar Installation Service",
            "description": "Professional solar installation service",
            "category": "service",
            "price": 1500,
            "stock": 999,
            "is_active": True,
            "service_type": "installation"
        }
    
    def test_get_all_products(self, api_client):
        """Test GET /api/shop/products returns products list"""
        response = api_client.get(f"{BASE_URL}/api/shop/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} products")
    
    def test_create_wire_product(self, api_client, test_wire_product_data):
        """Test POST /api/shop/products creates a wire product"""
        response = api_client.post(f"{BASE_URL}/api/shop/products", json=test_wire_product_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success, got: {data}"
        
        product = data.get("product", {})
        assert product.get("category") == "wire", f"Expected category 'wire', got '{product.get('category')}'"
        assert product.get("price") == 45, f"Expected price 45, got {product.get('price')}"
        
        print(f"✓ Wire product created: {product.get('id')}")
        return product.get("id")
    
    def test_create_service_product(self, api_client, test_service_product_data):
        """Test POST /api/shop/products creates a service product"""
        response = api_client.post(f"{BASE_URL}/api/shop/products", json=test_service_product_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success, got: {data}"
        
        product = data.get("product", {})
        assert product.get("category") == "service", f"Expected category 'service', got '{product.get('category')}'"
        assert product.get("price") == 1500, f"Expected price 1500, got {product.get('price')}"
        
        print(f"✓ Service product created: {product.get('id')}")
        return product.get("id")
    
    def test_get_products_by_wire_category(self, api_client):
        """Test filtering products by wire category"""
        response = api_client.get(f"{BASE_URL}/api/shop/products?category=wire&active_only=false")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Found {len(data)} wire products")
    
    def test_get_products_by_service_category(self, api_client):
        """Test filtering products by service category"""
        response = api_client.get(f"{BASE_URL}/api/shop/products?category=service&active_only=false")
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Found {len(data)} service products")


class TestShopOrders:
    """Test shop orders endpoints"""
    
    @pytest.fixture
    def test_order_data_cod(self):
        """Test order with COD payment"""
        return {
            "customer_name": "TEST_Customer COD",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "items": [
                {"product_id": "test-product-1", "product_name": "Test Product", "quantity": 1, "price": 1000}
            ],
            "subtotal": 1000,
            "delivery_charge": 50,
            "total": 1050,
            "delivery_type": "delivery",
            "delivery_address": "Test Address, Patna",
            "delivery_district": "Patna",
            "payment_method": "cod"
        }
    
    @pytest.fixture
    def test_order_data_razorpay(self):
        """Test order with Razorpay payment"""
        return {
            "customer_name": "TEST_Customer Razorpay",
            "customer_phone": "9876543211",
            "items": [
                {"product_id": "test-product-2", "product_name": "Test Product 2", "quantity": 2, "price": 500}
            ],
            "subtotal": 1000,
            "delivery_charge": 0,
            "total": 1000,
            "delivery_type": "pickup",
            "payment_method": "razorpay"
        }
    
    def test_create_order_cod(self, api_client, test_order_data_cod):
        """Test POST /api/shop/orders creates an order with COD payment"""
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=test_order_data_cod)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "order_number" in data, "Response should contain order_number"
        assert data.get("order", {}).get("payment_method") == "cod", "Payment method should be COD"
        
        print(f"✓ COD Order created: {data.get('order_number')}")
        return data.get("order", {}).get("id")
    
    def test_create_order_razorpay(self, api_client, test_order_data_razorpay):
        """Test POST /api/shop/orders creates an order with Razorpay payment"""
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=test_order_data_razorpay)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "order_number" in data, "Response should contain order_number"
        assert data.get("order", {}).get("payment_method") == "razorpay", "Payment method should be razorpay"
        
        print(f"✓ Razorpay Order created: {data.get('order_number')}")
    
    def test_get_orders_list(self, api_client):
        """Test GET /api/shop/orders returns orders list"""
        response = api_client.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} orders")


class TestShopStats:
    """Test shop statistics endpoint"""
    
    def test_get_shop_stats(self, api_client):
        """Test GET /api/shop/stats returns shop statistics"""
        response = api_client.get(f"{BASE_URL}/api/shop/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict"
        
        # Check expected fields
        expected_fields = ["total_products", "total_orders", "pending_orders", "total_revenue"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Shop stats: {data}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_products(self, api_client):
        """Remove TEST_ prefixed products"""
        response = api_client.get(f"{BASE_URL}/api/shop/products?active_only=false")
        if response.status_code == 200:
            products = response.json()
            test_products = [p for p in products if p.get("name", "").startswith("TEST_")]
            for product in test_products:
                api_client.delete(f"{BASE_URL}/api/shop/products/{product['id']}")
            print(f"✓ Cleaned up {len(test_products)} test products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
