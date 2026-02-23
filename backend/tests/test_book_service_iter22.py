"""
Book Service API Tests - Iteration 22
Tests for the new Book Service payment flow with WhatsApp + Email notifications
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBookServiceConfig:
    """Tests for book service configuration endpoints"""
    
    def test_get_book_service_config(self):
        """GET /api/shop/book-service-config returns price and key_id"""
        response = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "price" in data, "Response should contain 'price'"
        assert "key_id" in data, "Response should contain 'key_id'"
        assert isinstance(data["price"], (int, float)), "Price should be a number"
        assert data["price"] > 0, "Price should be positive"
        print(f"PASS: Book service price = {data['price']}, key_id present = {bool(data['key_id'])}")
        
    def test_update_book_service_price(self):
        """PUT /api/shop/book-service-config updates service price"""
        new_price = 2000
        response = requests.put(f"{BASE_URL}/api/shop/book-service-config", json={"price": new_price})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "success"
        assert data.get("price") == new_price
        
        # Verify price was updated
        verify_res = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        verify_data = verify_res.json()
        assert verify_data["price"] == new_price, f"Price not updated: {verify_data['price']}"
        
        # Reset to default
        requests.put(f"{BASE_URL}/api/shop/book-service-config", json={"price": 1500})
        print(f"PASS: Price updated to {new_price} and reset to 1500")


class TestBookServiceCreate:
    """Tests for creating service bookings"""
    
    def test_book_service_success(self):
        """POST /api/shop/book-service creates booking with customer details"""
        test_data = {
            "customer_name": "TEST_BookingUser",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=test_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success"
        assert "booking" in data, "Response should contain 'booking'"
        assert "key_id" in data, "Response should contain 'key_id'"
        
        booking = data["booking"]
        assert "id" in booking, "Booking should have 'id'"
        assert "booking_number" in booking, "Booking should have 'booking_number'"
        assert booking["booking_number"].startswith("BSK-"), "Booking number should start with BSK-"
        assert booking["customer_name"] == test_data["customer_name"]
        assert booking["customer_phone"] == test_data["customer_phone"]
        assert booking["payment_status"] == "pending"
        assert "amount" in booking and booking["amount"] > 0
        
        print(f"PASS: Booking created - ID: {booking['id']}, Number: {booking['booking_number']}, Amount: {booking['amount']}")
        return booking["id"]
    
    def test_book_service_missing_name(self):
        """POST /api/shop/book-service returns 400 when name is missing"""
        test_data = {
            "customer_phone": "9876543210",
            "customer_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=test_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"PASS: Correctly returned 400 for missing name - {data['detail']}")
    
    def test_book_service_missing_phone(self):
        """POST /api/shop/book-service returns 400 when phone is missing"""
        test_data = {
            "customer_name": "Test User",
            "customer_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=test_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"PASS: Correctly returned 400 for missing phone - {data['detail']}")
    
    def test_book_service_optional_email(self):
        """POST /api/shop/book-service works without email"""
        test_data = {
            "customer_name": "TEST_NoEmail",
            "customer_phone": "9123456780"
        }
        
        response = requests.post(f"{BASE_URL}/api/shop/book-service", json=test_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "success"
        assert data["booking"]["customer_email"] == ""
        print(f"PASS: Booking created without email")


class TestBookServiceConfirm:
    """Tests for confirming service bookings after payment"""
    
    def test_confirm_booking_returns_whatsapp_urls(self):
        """POST /api/shop/book-service/{id}/confirm returns WhatsApp URLs"""
        # First create a booking
        create_response = requests.post(f"{BASE_URL}/api/shop/book-service", json={
            "customer_name": "TEST_ConfirmUser",
            "customer_phone": "9876543211",
            "customer_email": "confirm@test.com"
        })
        assert create_response.status_code == 200
        booking_id = create_response.json()["booking"]["id"]
        
        # Now confirm it
        confirm_response = requests.post(f"{BASE_URL}/api/shop/book-service/{booking_id}/confirm", json={
            "razorpay_payment_id": "pay_test_123456"
        })
        assert confirm_response.status_code == 200, f"Expected 200, got {confirm_response.status_code}: {confirm_response.text}"
        
        data = confirm_response.json()
        assert data.get("status") == "success"
        assert "booking_number" in data
        assert "customer_whatsapp_url" in data
        assert "admin_whatsapp_url" in data
        assert "email_sent" in data
        
        # Verify WhatsApp URLs are properly formatted
        assert "wa.me" in data["customer_whatsapp_url"], "Customer WhatsApp URL should contain wa.me"
        assert "wa.me" in data["admin_whatsapp_url"], "Admin WhatsApp URL should contain wa.me"
        
        print(f"PASS: Booking confirmed - Number: {data['booking_number']}")
        print(f"  - Customer WhatsApp URL: {data['customer_whatsapp_url'][:50]}...")
        print(f"  - Admin WhatsApp URL: {data['admin_whatsapp_url'][:50]}...")
        print(f"  - Email sent: {data['email_sent']}")
    
    def test_confirm_nonexistent_booking(self):
        """POST /api/shop/book-service/{id}/confirm returns 404 for invalid ID"""
        response = requests.post(f"{BASE_URL}/api/shop/book-service/invalid-uuid-123/confirm", json={
            "razorpay_payment_id": "pay_test_123456"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Correctly returned 404 for nonexistent booking")


class TestShopProducts:
    """Tests for shop product endpoints"""
    
    def test_get_products(self):
        """GET /api/shop/products returns products list"""
        response = requests.get(f"{BASE_URL}/api/shop/products")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Products endpoint returns {len(data)} products")
    
    def test_get_reviews_summary(self):
        """GET /api/shop/reviews/summary returns review summaries"""
        response = requests.get(f"{BASE_URL}/api/shop/reviews/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        print(f"PASS: Reviews summary endpoint returns {len(data)} product summaries")


class TestAdminBookServiceConfig:
    """Tests for admin book service price configuration"""
    
    def test_admin_can_update_price(self):
        """Admin can update service price via PUT"""
        # Get current price
        get_res = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        original_price = get_res.json()["price"]
        
        # Update to new price
        new_price = 2500
        update_res = requests.put(f"{BASE_URL}/api/shop/book-service-config", json={"price": new_price})
        assert update_res.status_code == 200
        assert update_res.json()["price"] == new_price
        
        # Verify update persisted
        verify_res = requests.get(f"{BASE_URL}/api/shop/book-service-config")
        assert verify_res.json()["price"] == new_price
        
        # Restore original price
        requests.put(f"{BASE_URL}/api/shop/book-service-config", json={"price": original_price})
        print(f"PASS: Admin can update price from {original_price} to {new_price} and back")


class TestHealthAndBasicEndpoints:
    """Basic health and sanity checks"""
    
    def test_api_health(self):
        """Health check endpoint"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        print("PASS: API health check")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
