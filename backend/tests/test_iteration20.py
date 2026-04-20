"""
Backend API Tests for Iteration 20
Features: Book service config, Bihar districts, Product-specific delivery, Agent registration
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestBookServiceConfig:
    """Test book service configuration endpoints"""
    
    def test_get_book_service_config(self):
        """GET /api/shop/book-service-config returns price and razorpay key_id"""
        response = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        assert response.status_code == 200
        data = response.json()
        assert "price" in data, "Response should have price field"
        assert "key_id" in data, "Response should have key_id field"
        assert isinstance(data["price"], (int, float)), "Price should be numeric"
        assert data["key_id"].startswith("rzp_"), "Key ID should be Razorpay key"
        print(f"Book service config: price={data['price']}, key_id={data['key_id']}")

    def test_update_book_service_config(self):
        """PUT /api/shop/book-service-config updates the book service price"""
        new_price = 2000
        response = requests.put(
            f"{BASE_URL}/api/shop/book-service-config", 
            json={"price": new_price}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success" or data.get("price") == new_price
        
        # Verify the update persisted
        verify_response = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        verify_data = verify_response.json()
        assert verify_data["price"] == new_price, f"Price should be updated to {new_price}"
        print(f"Updated book service price to {new_price}")
        
        # Reset to default
        requests.put(f"{BASE_URL}/api/shop/book-service-config", json={"price": 1500})


class TestBiharDistricts:
    """Test Bihar districts endpoint"""
    
    def test_get_bihar_districts(self):
        """GET /api/shop/bihar-districts returns 37 districts with delivery fees"""
        response = requests.get(f"{BASE_URL}/api/shop/bihar-districts")
        assert response.status_code == 200
        data = response.json()
        
        assert "districts" in data, "Response should have districts field"
        assert "delivery_fees" in data, "Response should have delivery_fees field"
        
        districts = data["districts"]
        delivery_fees = data["delivery_fees"]
        
        assert len(districts) == 37, f"Should have 37 Bihar districts, got {len(districts)}"
        assert "Patna" in districts, "Patna should be in districts"
        assert "Gaya" in districts, "Gaya should be in districts"
        
        # Check delivery fees structure
        assert "Patna" in delivery_fees, "Patna should have delivery fee"
        assert delivery_fees["Patna"] == 50, f"Patna delivery fee should be 50, got {delivery_fees['Patna']}"
        print(f"Bihar districts: {len(districts)} districts with delivery fees configured")


class TestProductDeliveryCheck:
    """Test product-specific delivery check"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a product ID for testing"""
        response = requests.get(f"{BASE_URL}/api/shop/products")
        if response.status_code == 200 and response.json():
            self.product_id = response.json()[0]["id"]
        else:
            self.product_id = None
            pytest.skip("No products available for testing")
    
    def test_product_delivery_patna_pincode(self):
        """GET /api/shop/products/{id}/check-delivery/800001 returns deliverable=true for Patna"""
        if not self.product_id:
            pytest.skip("No product ID available")
        
        response = requests.get(f"{BASE_URL}/api/shop/products/{self.product_id}/check-delivery/800001")
        assert response.status_code == 200
        data = response.json()
        
        assert "deliverable" in data, "Response should have deliverable field"
        assert data["deliverable"] == True, "Should be deliverable to Patna"
        assert data.get("district") is not None, "Should return district info"
        print(f"Patna delivery check: deliverable={data['deliverable']}, district={data.get('district')}")

    def test_product_delivery_non_bihar_pincode(self):
        """GET /api/shop/products/{id}/check-delivery/110001 returns deliverable=false for non-Bihar"""
        if not self.product_id:
            pytest.skip("No product ID available")
        
        response = requests.get(f"{BASE_URL}/api/shop/products/{self.product_id}/check-delivery/110001")
        assert response.status_code == 200
        data = response.json()
        
        assert "deliverable" in data, "Response should have deliverable field"
        assert data["deliverable"] == False, "Should NOT be deliverable to Delhi"
        print(f"Non-Bihar delivery check: deliverable={data['deliverable']}, note={data.get('note')}")


class TestOrderDeletion:
    """Test order deletion functionality"""
    
    def test_delete_pending_order(self):
        """DELETE /api/shop/orders/{id} deletes a pending order"""
        # First create a test order
        order_data = {
            "customer_name": "TEST_DeleteOrder",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "items": [{"product_id": "test", "product_name": "Test Product", "price": 100, "quantity": 1}],
            "subtotal": 100,
            "delivery_charge": 0,
            "total": 100,
            "delivery_type": "pickup",
            "payment_method": "cod"
        }
        create_response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert create_response.status_code == 200
        order_id = create_response.json()["order"]["id"]
        
        # Delete the order
        delete_response = requests.delete(f"{BASE_URL}/api/shop/orders/{order_id}")
        assert delete_response.status_code == 200
        print(f"Successfully deleted order {order_id}")

    def test_delete_nonexistent_order(self):
        """DELETE /api/shop/orders/{id} returns 404 for nonexistent order"""
        response = requests.delete(f"{BASE_URL}/api/shop/orders/nonexistent-order-12345")
        assert response.status_code == 404
        print("Correctly returned 404 for nonexistent order")


class TestRazorpayConfig:
    """Test Razorpay configuration"""
    
    def test_get_razorpay_config(self):
        """GET /api/shop/razorpay-config returns correct key"""
        response = requests.get(f"{BASE_URL}/api/shop/razorpay-config")
        assert response.status_code == 200
        data = response.json()
        
        assert "key_id" in data, "Response should have key_id"
        assert data["key_id"].startswith("rzp_"), "Key should be Razorpay format"
        print(f"Razorpay config: key_id={data['key_id']}")


class TestServiceDescription:
    """Test AI service description generation"""
    
    def test_generate_service_description(self):
        """POST /api/generate-service-description returns generated=true"""
        response = requests.post(
            f"{BASE_URL}/api/generate-service-description",
            json={
                "service_name": "Solar Panel Cleaning",
                "service_type": "cleaning",
                "price": 1500
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "description" in data, "Response should have description"
        assert "generated" in data, "Response should have generated flag"
        assert len(data["description"]) > 50, "Description should be meaningful"
        print(f"Service description generated: {data['generated']}, length: {len(data['description'])}")


class TestAgentRegistration:
    """Test agent registration endpoint"""
    
    def test_register_agent(self):
        """POST /api/agents/register creates agent registration successfully"""
        unique_id = str(uuid.uuid4())[:8]
        agent_data = {
            "name": f"TEST_Agent_{unique_id}",
            "phone": "9876543210",
            "email": f"test.agent.{unique_id}@example.com",
            "district": "Patna",
            "experience": "2 years in sales"
        }
        
        response = requests.post(f"{BASE_URL}/api/agents/register", json=agent_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True, "Registration should be successful"
        assert "agent_id" in data, "Response should have agent_id"
        assert data["agent_id"].startswith("AGT"), "Agent ID should start with AGT"
        print(f"Agent registered: {data['agent_id']}, message: {data.get('message')}")


class TestDeliveryCheck:
    """Test general delivery check endpoint"""
    
    def test_delivery_check_patna(self):
        """GET /api/shop/check-delivery/800001 returns deliverable=true"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/800001")
        assert response.status_code == 200
        data = response.json()
        assert data.get("deliverable") == True
        print(f"Patna delivery: {data}")
    
    def test_delivery_check_gaya(self):
        """GET /api/shop/check-delivery/823001 returns deliverable=true for Gaya"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/823001")
        assert response.status_code == 200
        data = response.json()
        assert data.get("deliverable") == True
        print(f"Gaya delivery: {data}")
    
    def test_delivery_check_delhi(self):
        """GET /api/shop/check-delivery/110001 returns deliverable=false"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/110001")
        assert response.status_code == 200
        data = response.json()
        assert data.get("deliverable") == False
        print(f"Delhi delivery: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
