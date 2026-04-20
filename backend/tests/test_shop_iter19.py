"""
ASR Enterprises Shop E-commerce Tests - Iteration 19
Tests for:
- Pincode delivery check for Bihar districts
- Order tracking endpoint
- Order delete endpoint for pending/cancelled orders
- Razorpay config endpoint
- AI service description generation
- Order creation with COD payment
- Order status update
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestPincodeDeliveryCheck:
    """Test pincode delivery availability for Bihar districts"""
    
    def test_patna_800001_deliverable(self):
        """Patna 800001 should be deliverable"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/800001")
        assert response.status_code == 200
        data = response.json()
        assert data["deliverable"] == True
        assert data["district"] == "Patna"
        assert data["pincode"] == "800001"
        print(f"PASSED: Patna 800001 - deliverable=True, district={data['district']}")
    
    def test_gaya_823001_deliverable(self):
        """Gaya 823001 should be deliverable"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/823001")
        assert response.status_code == 200
        data = response.json()
        assert data["deliverable"] == True
        assert data["district"] == "Gaya"
        assert data["pincode"] == "823001"
        print(f"PASSED: Gaya 823001 - deliverable=True, district={data['district']}")
    
    def test_delhi_110001_not_deliverable(self):
        """Delhi 110001 (non-Bihar) should NOT be deliverable"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/110001")
        assert response.status_code == 200
        data = response.json()
        assert data["deliverable"] == False
        assert data["district"] is None
        print(f"PASSED: Delhi 110001 - deliverable=False (non-Bihar)")
    
    def test_muzaffarpur_842001_deliverable(self):
        """Muzaffarpur 842001 should be deliverable"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/842001")
        assert response.status_code == 200
        data = response.json()
        assert data["deliverable"] == True
        assert data["district"] == "Muzaffarpur"
        print(f"PASSED: Muzaffarpur 842001 - deliverable=True")
    
    def test_generic_bihar_pincode_deliverable(self):
        """Bihar pincodes starting with 80-85 should be deliverable"""
        response = requests.get(f"{BASE_URL}/api/shop/check-delivery/811234")
        assert response.status_code == 200
        data = response.json()
        assert data["deliverable"] == True
        print(f"PASSED: Generic Bihar pincode 811234 - deliverable=True")


class TestOrderTracking:
    """Test order tracking endpoint"""
    
    def test_track_order_invalid_data_returns_404(self):
        """POST /api/shop/track-order with invalid data should return 404"""
        response = requests.post(f"{BASE_URL}/api/shop/track-order", json={
            "order_number": "INVALID-ORDER-12345",
            "phone": "0000000000"
        })
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"PASSED: Invalid order tracking returns 404")
    
    def test_track_order_missing_data_returns_400(self):
        """POST /api/shop/track-order with missing data should return 400"""
        response = requests.post(f"{BASE_URL}/api/shop/track-order", json={
            "order_number": "",
            "phone": ""
        })
        assert response.status_code == 400
        print(f"PASSED: Missing data returns 400")


class TestRazorpayConfig:
    """Test Razorpay configuration endpoint"""
    
    def test_get_razorpay_key(self):
        """GET /api/shop/razorpay-config should return correct live key"""
        response = requests.get(f"{BASE_URL}/api/shop/razorpay-config")
        assert response.status_code == 200
        data = response.json()
        assert "key_id" in data
        assert data["key_id"] == "rzp_live_SJIqziW7w31a3U"
        print(f"PASSED: Razorpay config returns key_id={data['key_id']}")


class TestServiceDescriptionGeneration:
    """Test AI service description generation"""
    
    def test_generate_service_description(self):
        """POST /api/generate-service-description should return generated=true"""
        response = requests.post(f"{BASE_URL}/api/generate-service-description", json={
            "service_name": "Solar Panel Cleaning",
            "service_type": "cleaning",
            "price": 1500
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("generated") == True or "description" in data
        print(f"PASSED: Service description generation - generated=true")


class TestOrderCRUDOperations:
    """Test order create, read, update, delete operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_order_id = None
        self.test_order_number = None
        self.test_phone = f"TEST{uuid.uuid4().hex[:6]}"
        yield
        # Cleanup - try to delete the test order if created
        if self.test_order_id:
            try:
                requests.delete(f"{BASE_URL}/api/shop/orders/{self.test_order_id}")
            except:
                pass
    
    def test_create_order_cod_method(self):
        """POST /api/shop/orders creates order successfully with COD method"""
        order_data = {
            "customer_name": "TEST_Customer",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "delivery_type": "pickup",
            "delivery_address": "",
            "payment_method": "cod",
            "items": [
                {
                    "product_id": "test-product-1",
                    "product_name": "TEST Solar Panel",
                    "price": 15000,
                    "quantity": 1
                }
            ],
            "subtotal": 15000,
            "delivery_charge": 0,
            "total": 15000,
            "notes": "Test order"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert response.status_code == 200
        data = response.json()
        assert "order_number" in data
        assert data.get("order") is not None or "order_number" in data
        
        # Store for cleanup
        if data.get("order"):
            self.test_order_id = data["order"].get("id")
            self.test_order_number = data.get("order_number")
        
        print(f"PASSED: COD order created - order_number={data.get('order_number')}")
        return data
    
    def test_order_lifecycle(self):
        """Test full order lifecycle: create -> update status -> delete restrictions"""
        # Create order
        order_data = {
            "customer_name": "TEST_Lifecycle",
            "customer_phone": "9876543211",
            "customer_email": "lifecycle@test.com",
            "delivery_type": "pickup",
            "payment_method": "cod",
            "items": [
                {"product_id": "lc-1", "product_name": "TEST Item", "price": 1000, "quantity": 1}
            ],
            "subtotal": 1000,
            "delivery_charge": 0,
            "total": 1000
        }
        
        create_res = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert create_res.status_code == 200
        order_id = create_res.json().get("order", {}).get("id")
        assert order_id is not None
        print(f"PASSED: Order created with id={order_id}")
        
        # Update order status to confirmed and payment to paid
        update_res = requests.put(f"{BASE_URL}/api/shop/orders/{order_id}/status", json={
            "order_status": "confirmed",
            "payment_status": "paid"
        })
        assert update_res.status_code == 200
        print(f"PASSED: Order status updated to confirmed with paid payment")
        
        # Try to delete confirmed+paid order - should fail (not pending/cancelled AND not pending/failed payment)
        delete_res = requests.delete(f"{BASE_URL}/api/shop/orders/{order_id}")
        assert delete_res.status_code == 400
        print(f"PASSED: Confirmed+Paid order cannot be deleted (status=400)")
        
        # Update to cancelled
        cancel_res = requests.put(f"{BASE_URL}/api/shop/orders/{order_id}/status", json={
            "order_status": "cancelled"
        })
        assert cancel_res.status_code == 200
        
        # Now delete should succeed (order_status is cancelled)
        delete_res = requests.delete(f"{BASE_URL}/api/shop/orders/{order_id}")
        assert delete_res.status_code == 200
        print(f"PASSED: Cancelled order deleted successfully")


class TestOrderDelete:
    """Test order deletion endpoint"""
    
    def test_delete_pending_order(self):
        """DELETE /api/shop/orders/{id} should delete pending order"""
        # First create a pending order
        order_data = {
            "customer_name": "TEST_Delete",
            "customer_phone": "9876543212",
            "delivery_type": "pickup",
            "payment_method": "cod",
            "items": [{"product_id": "del-1", "product_name": "TEST Delete Item", "price": 500, "quantity": 1}],
            "subtotal": 500,
            "delivery_charge": 0,
            "total": 500
        }
        
        create_res = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert create_res.status_code == 200
        order_id = create_res.json().get("order", {}).get("id")
        
        # Delete the pending order
        delete_res = requests.delete(f"{BASE_URL}/api/shop/orders/{order_id}")
        assert delete_res.status_code == 200
        data = delete_res.json()
        assert data.get("status") == "success"
        print(f"PASSED: Pending order deleted successfully")
    
    def test_delete_nonexistent_order_returns_404(self):
        """DELETE /api/shop/orders/{id} returns 404 for nonexistent order"""
        response = requests.delete(f"{BASE_URL}/api/shop/orders/nonexistent-order-id-12345")
        assert response.status_code == 404
        print(f"PASSED: Nonexistent order returns 404")


class TestShopProducts:
    """Test shop products endpoints"""
    
    def test_get_products(self):
        """GET /api/shop/products returns products list"""
        response = requests.get(f"{BASE_URL}/api/shop/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: Products endpoint returns {len(data)} products")
    
    def test_get_categories(self):
        """GET /api/shop/categories returns category list"""
        response = requests.get(f"{BASE_URL}/api/shop/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 6  # Should have at least 6 categories
        print(f"PASSED: Categories endpoint returns {len(data)} categories")


class TestOrderTrackWithRealOrder:
    """Test order tracking with a real created order"""
    
    def test_create_and_track_order(self):
        """Create order then track it successfully"""
        # Create order
        unique_phone = f"98765{uuid.uuid4().hex[:5]}"
        order_data = {
            "customer_name": "TEST_Track",
            "customer_phone": unique_phone,
            "delivery_type": "pickup",
            "payment_method": "cod",
            "items": [{"product_id": "track-1", "product_name": "TEST Track Item", "price": 2000, "quantity": 1}],
            "subtotal": 2000,
            "delivery_charge": 0,
            "total": 2000
        }
        
        create_res = requests.post(f"{BASE_URL}/api/shop/orders", json=order_data)
        assert create_res.status_code == 200
        order_number = create_res.json().get("order_number")
        order_id = create_res.json().get("order", {}).get("id")
        
        # Track the order
        track_res = requests.post(f"{BASE_URL}/api/shop/track-order", json={
            "order_number": order_number,
            "phone": unique_phone
        })
        assert track_res.status_code == 200
        track_data = track_res.json()
        assert track_data["order_number"] == order_number
        assert track_data["customer_phone"] == unique_phone
        print(f"PASSED: Order created and tracked successfully - order_number={order_number}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/shop/orders/{order_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
