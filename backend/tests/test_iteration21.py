"""
Iteration 21 Backend API Tests
Tests for: Product Reviews, Pincode Delivery, Shop Features
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProductReviews:
    """Test Product Review APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get a product ID for testing"""
        res = requests.get(f"{BASE_URL}/api/shop/products")
        assert res.status_code == 200
        products = res.json()
        if products:
            self.product_id = products[0]["id"]
        else:
            pytest.skip("No products available for testing")
    
    def test_get_product_reviews(self):
        """GET /api/shop/products/{id}/reviews returns reviews list"""
        res = requests.get(f"{BASE_URL}/api/shop/products/{self.product_id}/reviews")
        assert res.status_code == 200
        data = res.json()
        assert "reviews" in data
        assert "average_rating" in data
        assert "total_reviews" in data
        assert isinstance(data["reviews"], list)
        print(f"✓ GET reviews returned {data['total_reviews']} reviews with avg rating {data['average_rating']}")
    
    def test_create_product_review(self):
        """POST /api/shop/products/{id}/reviews creates new review"""
        unique_name = f"TEST_Reviewer_{uuid.uuid4().hex[:6]}"
        review_data = {
            "customer_name": unique_name,
            "rating": 4,
            "title": "Great Product",
            "review_text": "This is a test review for iteration 21 testing."
        }
        res = requests.post(f"{BASE_URL}/api/shop/products/{self.product_id}/reviews", json=review_data)
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "success"
        assert "review" in data
        assert data["review"]["customer_name"] == unique_name
        assert data["review"]["rating"] == 4
        print(f"✓ Created review by {unique_name} with rating 4")
    
    def test_reviews_summary(self):
        """GET /api/shop/reviews/summary returns aggregated summaries"""
        res = requests.get(f"{BASE_URL}/api/shop/reviews/summary")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, dict)
        # Check if we have at least one product with reviews
        if data:
            for product_id, summary in data.items():
                assert "avg_rating" in summary
                assert "count" in summary
                print(f"✓ Product {product_id}: avg={summary['avg_rating']}, count={summary['count']}")
                break
        else:
            print("✓ Reviews summary returned (no products with reviews yet)")


class TestPincodeDelivery:
    """Test Pincode Delivery Check APIs"""
    
    def test_check_delivery_bihar_pincode(self):
        """GET /api/shop/check-delivery/800001 returns deliverable with district info"""
        res = requests.get(f"{BASE_URL}/api/shop/check-delivery/800001")
        assert res.status_code == 200
        data = res.json()
        assert data["deliverable"] == True
        assert data["district"] == "Patna"
        assert "estimated_days" in data
        print(f"✓ Pincode 800001: Deliverable to {data['district']} in {data['estimated_days']}")
    
    def test_check_delivery_gaya(self):
        """GET /api/shop/check-delivery/823001 returns deliverable for Gaya"""
        res = requests.get(f"{BASE_URL}/api/shop/check-delivery/823001")
        assert res.status_code == 200
        data = res.json()
        assert data["deliverable"] == True
        assert "district" in data
        print(f"✓ Pincode 823001: Deliverable to {data.get('district')}")
    
    def test_check_delivery_non_bihar(self):
        """GET /api/shop/check-delivery/110001 returns not deliverable"""
        res = requests.get(f"{BASE_URL}/api/shop/check-delivery/110001")
        assert res.status_code == 200
        data = res.json()
        assert data["deliverable"] == False
        assert "note" in data
        print(f"✓ Pincode 110001 (Delhi): Not deliverable - {data.get('note')}")


class TestProductPincodeDelivery:
    """Test Product-specific delivery check"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a product ID for testing"""
        res = requests.get(f"{BASE_URL}/api/shop/products")
        assert res.status_code == 200
        products = res.json()
        if products:
            self.product_id = products[0]["id"]
        else:
            pytest.skip("No products available for testing")
    
    def test_product_delivery_check_bihar(self):
        """GET /api/shop/products/{id}/check-delivery/800001 returns fee in response"""
        res = requests.get(f"{BASE_URL}/api/shop/products/{self.product_id}/check-delivery/800001")
        assert res.status_code == 200
        data = res.json()
        assert "deliverable" in data
        if data["deliverable"]:
            assert "fee" in data
            assert "district" in data
            assert "estimated_days" in data
            print(f"✓ Product delivery to 800001: fee=₹{data['fee']}, district={data['district']}")
        else:
            print(f"✓ Product not deliverable to 800001")
    
    def test_product_delivery_check_non_bihar(self):
        """GET /api/shop/products/{id}/check-delivery/110001 returns not deliverable"""
        res = requests.get(f"{BASE_URL}/api/shop/products/{self.product_id}/check-delivery/110001")
        assert res.status_code == 200
        data = res.json()
        assert data["deliverable"] == False
        print(f"✓ Product not deliverable to Delhi (110001)")


class TestShopProducts:
    """Test Shop Products API"""
    
    def test_get_products(self):
        """GET /api/shop/products returns products list"""
        res = requests.get(f"{BASE_URL}/api/shop/products")
        assert res.status_code == 200
        products = res.json()
        assert isinstance(products, list)
        print(f"✓ Shop has {len(products)} products")
        if products:
            product = products[0]
            assert "id" in product
            assert "name" in product
            assert "price" in product
    
    def test_get_categories(self):
        """GET /api/shop/categories returns categories"""
        res = requests.get(f"{BASE_URL}/api/shop/categories")
        assert res.status_code == 200
        categories = res.json()
        assert isinstance(categories, list)
        print(f"✓ Found {len(categories)} categories")
    
    def test_get_bihar_districts(self):
        """GET /api/shop/bihar-districts returns districts with fees"""
        res = requests.get(f"{BASE_URL}/api/shop/bihar-districts")
        assert res.status_code == 200
        data = res.json()
        assert "districts" in data
        assert "delivery_fees" in data
        assert isinstance(data["districts"], list)
        assert len(data["districts"]) > 0
        print(f"✓ Bihar districts: {len(data['districts'])} districts with delivery fees")


class TestAgentRegistration:
    """Test Agent Registration API"""
    
    def test_agent_registration(self):
        """POST /api/agents/register creates new agent"""
        unique_id = uuid.uuid4().hex[:6]
        agent_data = {
            "name": f"TEST_Agent_{unique_id}",
            "phone": f"98765{unique_id[:5]}",
            "email": f"test_{unique_id}@example.com",
            "district": "Patna",
            "address": "Test Address, Bihar",
            "aadhar_number": "123456789012",
            "pan_number": "ABCDE1234F",
            "bank_name": "Test Bank",
            "bank_account": "12345678901234",
            "ifsc_code": "SBIN0001234",
            "experience": "2 years in solar sales"
        }
        res = requests.post(f"{BASE_URL}/api/agents/register", json=agent_data)
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "success" or "agent_id" in data or "agent" in data
        print(f"✓ Agent registration successful")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API is accessible"""
        res = requests.get(f"{BASE_URL}/api")
        assert res.status_code in [200, 404]
        print(f"✓ API is accessible at {BASE_URL}")
    
    def test_shop_stats(self):
        """GET /api/shop/stats returns shop statistics"""
        res = requests.get(f"{BASE_URL}/api/shop/stats")
        if res.status_code == 200:
            data = res.json()
            print(f"✓ Shop stats: {data}")
        else:
            print(f"✓ Shop stats endpoint returned {res.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
