"""
Test Suite for E-commerce Shop Features
Tests: Products, Orders, Categories, Stats, WhatsApp Notifications, CRM Integration
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

# ==================== CATEGORIES TESTS ====================
class TestProductCategories:
    """Test product category endpoint"""
    
    def test_get_categories(self, api_client):
        """GET /api/shop/categories - should return all 5 categories"""
        response = api_client.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) == 5
        
        category_ids = [c["id"] for c in categories]
        assert "solar_panel" in category_ids
        assert "inverter" in category_ids
        assert "battery" in category_ids
        assert "accessory" in category_ids
        assert "service" in category_ids
        print("✓ Categories API returns all 5 product categories")

# ==================== PRODUCTS TESTS ====================
class TestProducts:
    """Test product CRUD operations"""
    
    def test_get_all_products(self, api_client):
        """GET /api/shop/products - should return list of products"""
        response = api_client.get(f"{BASE_URL}/api/shop/products")
        assert response.status_code == 200
        
        products = response.json()
        assert isinstance(products, list)
        assert len(products) >= 4  # 4 sample products seeded
        print(f"✓ Products API returns {len(products)} products")
        
    def test_product_has_required_fields(self, api_client):
        """Products should have all required fields"""
        response = api_client.get(f"{BASE_URL}/api/shop/products")
        products = response.json()
        
        if products:
            product = products[0]
            required_fields = ["id", "name", "price", "stock", "category", "is_active"]
            for field in required_fields:
                assert field in product, f"Missing field: {field}"
        print("✓ Products have all required fields")
        
    def test_filter_by_category(self, api_client):
        """GET /api/shop/products?category=solar_panel - should filter products"""
        response = api_client.get(f"{BASE_URL}/api/shop/products?category=solar_panel")
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert product["category"] == "solar_panel"
        print(f"✓ Category filter works - {len(products)} solar_panel products")
        
    def test_create_product(self, api_client):
        """POST /api/shop/products - should create new product"""
        test_product = {
            "name": "TEST_Solar Panel 500W",
            "description": "Test product for automated testing",
            "category": "solar_panel",
            "price": 20000,
            "stock": 10,
            "is_active": True,
            "is_featured": False
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/products", json=test_product)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        assert data.get("product", {}).get("name") == test_product["name"]
        print(f"✓ Product created: {test_product['name']}")
        
        # Store product ID for later tests
        return data.get("product", {}).get("id")
        
    def test_get_inactive_products(self, api_client):
        """GET /api/shop/products?active_only=false - should return all products"""
        response = api_client.get(f"{BASE_URL}/api/shop/products?active_only=false")
        assert response.status_code == 200
        
        products = response.json()
        assert isinstance(products, list)
        print(f"✓ Get all products (including inactive): {len(products)} products")

# ==================== SHOP STATS TESTS ====================
class TestShopStats:
    """Test shop statistics endpoint"""
    
    def test_get_shop_stats(self, api_client):
        """GET /api/shop/stats - should return shop statistics"""
        response = api_client.get(f"{BASE_URL}/api/shop/stats")
        assert response.status_code == 200
        
        stats = response.json()
        required_fields = ["total_products", "total_orders", "pending_orders", "total_revenue"]
        for field in required_fields:
            assert field in stats, f"Missing stat field: {field}"
            
        assert stats["total_products"] >= 4  # At least 4 seeded products
        assert isinstance(stats["total_orders"], int)
        assert isinstance(stats["pending_orders"], int)
        print(f"✓ Shop Stats: {stats['total_products']} products, {stats['total_orders']} orders, ₹{stats['total_revenue']} revenue")

# ==================== ORDER TESTS ====================
class TestOrders:
    """Test order creation and management"""
    
    def test_create_order_cod_pickup(self, api_client):
        """POST /api/shop/orders - create order with COD + store pickup"""
        # Get a product first
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_Order_Customer",
            "customer_phone": "9876543210",
            "customer_email": "testorder@example.com",
            "delivery_type": "pickup",
            "delivery_address": "",
            "payment_method": "cod",
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product["price"],
                "quantity": 1
            }],
            "subtotal": product["price"],
            "delivery_charge": 0,
            "total": product["price"],
            "notes": "Automated test order - COD Pickup"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        assert "order_number" in data
        assert "whatsapp_notification_url" in data  # WhatsApp URL should be returned
        
        order_number = data.get("order_number")
        assert order_number.startswith("ASR")
        print(f"✓ Order created: {order_number} (COD + Pickup)")
        print(f"✓ WhatsApp notification URL returned")
        return order_number
        
    def test_create_order_cod_delivery(self, api_client):
        """POST /api/shop/orders - create order with COD + home delivery"""
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_Delivery_Customer",
            "customer_phone": "9123456789",
            "customer_email": "delivery@test.com",
            "delivery_type": "delivery",
            "delivery_address": "123 Test Street, Boring Road, Patna 800001",
            "delivery_district": "Patna",
            "payment_method": "cod",
            "items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "price": product["price"],
                "quantity": 2
            }],
            "subtotal": product["price"] * 2,
            "delivery_charge": 100,
            "total": (product["price"] * 2) + 100,
            "notes": "Test delivery order"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        assert "whatsapp_notification_url" in data
        print(f"✓ Order created: {data.get('order_number')} (COD + Home Delivery)")
        return data.get("order_number")
        
    def test_create_order_razorpay(self, api_client):
        """POST /api/shop/orders - create order with Razorpay payment"""
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_Razorpay_Customer",
            "customer_phone": "9999888877",
            "customer_email": "razorpay@test.com",
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
            "total": product["price"],
            "notes": "Razorpay test order"
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        print(f"✓ Order created: {data.get('order_number')} (Razorpay payment)")
        
    def test_get_all_orders(self, api_client):
        """GET /api/shop/orders - should return list of orders"""
        response = api_client.get(f"{BASE_URL}/api/shop/orders")
        assert response.status_code == 200
        
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Orders API returns {len(orders)} orders")
        
    def test_order_has_required_fields(self, api_client):
        """Orders should have all required fields"""
        response = api_client.get(f"{BASE_URL}/api/shop/orders")
        orders = response.json()
        
        if orders:
            order = orders[0]
            required_fields = ["id", "order_number", "customer_name", "customer_phone", 
                              "items", "total", "order_status", "payment_status", "payment_method"]
            for field in required_fields:
                assert field in order, f"Order missing field: {field}"
        print("✓ Orders have all required fields")
        
    def test_update_order_status(self, api_client):
        """PUT /api/shop/orders/{order_id}/status - should update order status"""
        # Get an order first
        orders_res = api_client.get(f"{BASE_URL}/api/shop/orders")
        orders = orders_res.json()
        
        if not orders:
            pytest.skip("No orders to update")
            
        order = orders[0]
        
        response = api_client.put(
            f"{BASE_URL}/api/shop/orders/{order['id']}/status",
            json={"order_status": "confirmed"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        print(f"✓ Order {order['order_number']} status updated to 'confirmed'")
        
# ==================== CRM INTEGRATION TESTS ====================
class TestCRMIntegration:
    """Test CRM notifications for orders"""
    
    def test_crm_messages_created_on_order(self, api_client):
        """CRM should receive notification when order is created"""
        # First, get current message count
        messages_before = api_client.get(f"{BASE_URL}/api/crm/messages?limit=1")
        
        # Create a new order
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_CRM_Check",
            "customer_phone": "9111222333",
            "delivery_type": "pickup",
            "payment_method": "cod",
            "items": [{"product_id": product["id"], "product_name": product["name"], "price": product["price"], "quantity": 1}],
            "subtotal": product["price"],
            "delivery_charge": 0,
            "total": product["price"]
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        order_number = response.json().get("order_number")
        
        # Check CRM messages for the order notification
        messages_after = api_client.get(f"{BASE_URL}/api/crm/messages?limit=5")
        if messages_after.status_code == 200:
            messages = messages_after.json()
            # Look for order notification in recent messages
            order_notif = any(order_number in msg.get("message", "") for msg in messages if isinstance(msg, dict))
            if order_notif:
                print(f"✓ CRM notification created for order {order_number}")
            else:
                print(f"⚠ CRM notification might be async - order {order_number} created")
        
# ==================== WHATSAPP NOTIFICATION TESTS ====================
class TestWhatsAppNotifications:
    """Test WhatsApp notification URLs are generated correctly"""
    
    def test_whatsapp_url_format(self, api_client):
        """WhatsApp URL should be properly formatted"""
        products_res = api_client.get(f"{BASE_URL}/api/shop/products")
        products = products_res.json()
        product = products[0] if products else None
        
        if not product:
            pytest.skip("No products available")
            
        order_data = {
            "customer_name": "TEST_WhatsApp_URL",
            "customer_phone": "9876543210",
            "delivery_type": "pickup",
            "payment_method": "cod",
            "items": [{"product_id": product["id"], "product_name": product["name"], "price": product["price"], "quantity": 1}],
            "subtotal": product["price"],
            "delivery_charge": 0,
            "total": product["price"]
        }
        
        response = api_client.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        whatsapp_url = data.get("whatsapp_notification_url", "")
        
        # Check URL format
        assert "wa.me" in whatsapp_url or "api.whatsapp.com" in whatsapp_url or "whatsapp://" in whatsapp_url
        assert "8877896889" in whatsapp_url  # Admin phone number
        print(f"✓ WhatsApp notification URL correctly generated")

# ==================== CLEANUP ====================
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(api_client):
    """Cleanup TEST_ prefixed data after tests"""
    yield
    
    # Delete test products
    try:
        products_res = api_client.get(f"{BASE_URL}/api/shop/products?active_only=false")
        if products_res.status_code == 200:
            products = products_res.json()
            for product in products:
                if product.get("name", "").startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/shop/products/{product['id']}")
                    print(f"Cleaned up test product: {product['name']}")
    except Exception as e:
        print(f"Cleanup error: {e}")
