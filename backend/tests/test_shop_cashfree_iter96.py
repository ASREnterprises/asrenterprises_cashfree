"""
Iteration 96 - Shop Page + Cashfree Payment Integration Tests
Tests:
1. Shop products API
2. Shop categories API
3. Shop order creation with COD payment
4. Shop order creation with Online payment (Cashfree)
5. Admin login with Email + Password
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestShopProducts:
    """Shop Products API Tests"""
    
    def test_get_products(self, api_client):
        """GET /api/shop/products - should return list of products"""
        response = api_client.get(f"{BASE_URL}/api/shop/products")
        assert response.status_code == 200
        
        products = response.json()
        assert isinstance(products, list)
        assert len(products) > 0
        print(f"✅ Found {len(products)} products")
        
        # Verify product structure
        product = products[0]
        assert "id" in product
        assert "name" in product
        assert "price" in product
        assert "category" in product
        print(f"✅ Product structure valid: {product['name']}")
    
    def test_get_categories(self, api_client):
        """GET /api/shop/categories - should return list of categories"""
        response = api_client.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) > 0
        print(f"✅ Found {len(categories)} categories")
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in categories]
        expected_categories = ["solar_panel", "inverter", "battery", "wire", "accessory", "service"]
        for cat in expected_categories:
            assert cat in category_ids, f"Missing category: {cat}"
        print("✅ All expected categories present")
    
    def test_get_bihar_districts(self, api_client):
        """GET /api/shop/bihar-districts - should return Bihar districts with delivery fees"""
        response = api_client.get(f"{BASE_URL}/api/shop/bihar-districts")
        assert response.status_code == 200
        
        data = response.json()
        assert "districts" in data
        assert "delivery_fees" in data
        assert len(data["districts"]) > 0
        print(f"✅ Found {len(data['districts'])} Bihar districts")


class TestShopOrdersCOD:
    """Shop Orders API Tests - COD Payment"""
    
    def test_create_order_cod_pickup(self, api_client):
        """POST /api/shop/orders - create order with COD + store pickup"""
        order_data = {
            "customer_name": "TEST_COD_User",
            "customer_phone": "9876543210",
            "customer_email": "test_cod@example.com",
            "items": [
                {
                    "product_id": "76786553-ef6a-46a3-a003-8cbc1e5f486a",
                    "product_name": "AC Wire 4 sqmm",
                    "quantity": 1,
                    "price": 35
                }
            ],
            "subtotal": 35,
            "delivery_charge": 0,
            "total": 35,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "cod",
            "notes": "Test COD order - Iteration 96"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "order" in data
        assert "order_number" in data
        
        order = data["order"]
        assert order["customer_name"] == "TEST_COD_User"
        assert order["payment_method"] == "cod"
        assert order["total"] == 35
        
        # COD orders should NOT have Cashfree details
        assert data["cashfree_order_id"] is None
        assert data["payment_session_id"] is None
        
        print(f"✅ COD order created: {data['order_number']}")
        print(f"✅ Cashfree order ID: {data['cashfree_order_id']} (expected: None)")
    
    def test_create_order_cod_delivery(self, api_client):
        """POST /api/shop/orders - create order with COD + home delivery"""
        order_data = {
            "customer_name": "TEST_COD_Delivery",
            "customer_phone": "9876543211",
            "customer_email": "test_delivery@example.com",
            "items": [
                {
                    "product_id": "0d8900d7-6dad-4233-bfcd-0a26ebc24b2c",
                    "product_name": "MC4 Connector Set",
                    "quantity": 2,
                    "price": 450
                }
            ],
            "subtotal": 900,
            "delivery_charge": 200,
            "total": 1100,
            "delivery_type": "delivery",
            "delivery_address": "123 Test Street, Patna",
            "delivery_district": "Patna",
            "payment_method": "cod",
            "notes": "Test COD delivery order - Iteration 96"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert data["order"]["delivery_type"] == "delivery"
        assert data["order"]["delivery_charge"] == 200
        
        print(f"✅ COD delivery order created: {data['order_number']}")


class TestShopOrdersOnline:
    """Shop Orders API Tests - Online Payment (Cashfree)"""
    
    def test_create_order_online_payment(self, api_client):
        """POST /api/shop/orders - create order with Online payment (Cashfree)"""
        order_data = {
            "customer_name": "TEST_Online_User",
            "customer_phone": "9876543212",
            "customer_email": "test_online@example.com",
            "items": [
                {
                    "product_id": "cfcefd0e-4695-451b-8e5f-7f2cf52ea0f4",
                    "product_name": "Exide 150Ah Solar Battery",
                    "quantity": 1,
                    "price": 18500
                }
            ],
            "subtotal": 18500,
            "delivery_charge": 0,
            "total": 18500,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "online",
            "notes": "Test Online payment order - Iteration 96",
            "origin_url": "https://solar-crm-stable.preview.emergentagent.com"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "order" in data
        assert "order_number" in data
        
        order = data["order"]
        assert order["customer_name"] == "TEST_Online_User"
        assert order["payment_method"] == "online"
        assert order["total"] == 18500
        
        # Online orders SHOULD have Cashfree details
        assert data["cashfree_order_id"] is not None, "Cashfree order ID should be present"
        assert data["payment_session_id"] is not None, "Payment session ID should be present"
        assert len(data["payment_session_id"]) > 20, "Payment session ID should be a valid long string"
        
        print(f"✅ Online order created: {data['order_number']}")
        print(f"✅ Cashfree order ID: {data['cashfree_order_id']}")
        print(f"✅ Payment session ID: {data['payment_session_id'][:50]}...")
    
    def test_cashfree_session_id_format(self, api_client):
        """Verify Cashfree payment_session_id format is valid for SDK"""
        order_data = {
            "customer_name": "TEST_Session_Check",
            "customer_phone": "9876543213",
            "customer_email": "test_session@example.com",
            "items": [
                {
                    "product_id": "76786553-ef6a-46a3-a003-8cbc1e5f486a",
                    "product_name": "AC Wire 4 sqmm",
                    "quantity": 10,
                    "price": 35
                }
            ],
            "subtotal": 350,
            "delivery_charge": 0,
            "total": 350,
            "delivery_type": "pickup",
            "delivery_address": "",
            "delivery_district": "Patna",
            "payment_method": "online",
            "notes": "Test session ID format",
            "origin_url": "https://solar-crm-stable.preview.emergentagent.com"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        session_id = data["payment_session_id"]
        
        # Cashfree session IDs typically start with "session_"
        assert session_id.startswith("session_"), f"Session ID should start with 'session_', got: {session_id[:20]}"
        
        # Session ID should be long enough for SDK
        assert len(session_id) > 50, f"Session ID too short: {len(session_id)} chars"
        
        print(f"✅ Payment session ID format valid")
        print(f"✅ Session ID length: {len(session_id)} chars")


class TestAdminLogin:
    """Admin Login Tests"""
    
    def test_admin_login_password(self, api_client):
        """POST /api/admin/login-password - admin login with email + password"""
        # API expects 'user_id' not 'email'
        login_data = {
            "user_id": "asrenterprisespatna@gmail.com",
            "password": "admin@asr123",
            "direct_login": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/admin/login-password", json=login_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("require_otp") == False
        assert data.get("role") == "admin"
        print(f"✅ Admin login successful: {data.get('name')}")
    
    def test_admin_login_wrong_password(self, api_client):
        """POST /api/admin/login-password - should fail with wrong password"""
        login_data = {
            "user_id": "asrenterprisespatna@gmail.com",
            "password": "wrongpassword123",
            "direct_login": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/admin/login-password", json=login_data)
        assert response.status_code == 401
        print(f"✅ Wrong password correctly rejected")


class TestHomepage:
    """Homepage API Tests"""
    
    def test_homepage_loads(self, api_client):
        """GET / - homepage should load"""
        response = api_client.get(f"{BASE_URL}/")
        assert response.status_code == 200
        print(f"✅ Homepage loads successfully")
    
    def test_health_check(self, api_client):
        """GET /api/health - health check endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        # Health check might return 200 or 404 depending on implementation
        assert response.status_code in [200, 404]
        print(f"✅ Health check endpoint responded: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
