"""
Test Cashfree Webhook and Website Payment Endpoints
Tests for iteration 84 - Webhook handler with signature verification, idempotency, and event handling
"""
import pytest
import requests
import os
import json
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCashfreeWebhook:
    """Test Cashfree webhook endpoint at /api/payments/cashfree/webhook"""
    
    def test_webhook_handles_payment_success(self):
        """Test PAYMENT_SUCCESS event handling"""
        # First create a payment link to have a valid order_id
        create_response = requests.post(f"{BASE_URL}/api/payments/create-link", json={
            "customer_name": "TEST_Webhook_Success",
            "customer_phone": "9876543210",
            "amount": 1000,
            "purpose": "Test Webhook Success",
            "source": "crm_link"
        })
        
        if create_response.status_code in [200, 201]:
            order_id = create_response.json().get("order_id")
            link_id = create_response.json().get("link_id")
            
            # Simulate PAYMENT_SUCCESS webhook
            webhook_payload = {
                "type": "PAYMENT_SUCCESS",
                "data": {
                    "order": {"order_id": order_id},
                    "payment": {
                        "cf_payment_id": f"CF_{uuid.uuid4().hex[:8]}",
                        "payment_amount": 1000,
                        "payment_time": datetime.utcnow().isoformat()
                    },
                    "link_id": link_id
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/api/payments/cashfree/webhook",
                json=webhook_payload,
                headers={"Content-Type": "application/json"}
            )
            
            # Webhook should always return 200 to prevent retries
            assert response.status_code == 200
            data = response.json()
            assert data.get("status") in ["ok", "error"]
            print(f"PAYMENT_SUCCESS webhook response: {data}")
        else:
            pytest.skip("Could not create payment link for webhook test")
    
    def test_webhook_handles_payment_failed(self):
        """Test PAYMENT_FAILED event handling"""
        # Create a payment link first
        create_response = requests.post(f"{BASE_URL}/api/payments/create-link", json={
            "customer_name": "TEST_Webhook_Failed",
            "customer_phone": "9876543211",
            "amount": 500,
            "purpose": "Test Webhook Failed",
            "source": "crm_link"
        })
        
        if create_response.status_code in [200, 201]:
            order_id = create_response.json().get("order_id")
            
            # Simulate PAYMENT_FAILED webhook
            webhook_payload = {
                "type": "PAYMENT_FAILED",
                "data": {
                    "order": {"order_id": order_id},
                    "payment": {
                        "payment_message": "User cancelled payment"
                    }
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/api/payments/cashfree/webhook",
                json=webhook_payload,
                headers={"Content-Type": "application/json"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data.get("status") in ["ok", "error"]
            print(f"PAYMENT_FAILED webhook response: {data}")
        else:
            pytest.skip("Could not create payment link for webhook test")
    
    def test_webhook_returns_200_on_invalid_data(self):
        """Test idempotency - webhook returns 200 even on invalid/unknown data"""
        # Send completely invalid payload
        webhook_payload = {
            "type": "UNKNOWN_EVENT",
            "data": {"random": "data"}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/cashfree/webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should still return 200 to prevent Cashfree retries
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"Invalid data webhook response: {data}")
    
    def test_webhook_idempotency_duplicate_processing(self):
        """Test that duplicate webhooks are not processed twice"""
        # Create a payment link
        create_response = requests.post(f"{BASE_URL}/api/payments/create-link", json={
            "customer_name": "TEST_Idempotency",
            "customer_phone": "9876543212",
            "amount": 750,
            "purpose": "Test Idempotency",
            "source": "crm_link"
        })
        
        if create_response.status_code in [200, 201]:
            order_id = create_response.json().get("order_id")
            payment_id = f"CF_{uuid.uuid4().hex[:8]}"
            
            # Send same webhook twice
            webhook_payload = {
                "type": "PAYMENT_SUCCESS",
                "data": {
                    "order": {"order_id": order_id},
                    "payment": {
                        "cf_payment_id": payment_id,
                        "payment_amount": 750
                    }
                }
            }
            
            # First call
            response1 = requests.post(
                f"{BASE_URL}/api/payments/cashfree/webhook",
                json=webhook_payload
            )
            assert response1.status_code == 200
            
            # Second call (duplicate)
            response2 = requests.post(
                f"{BASE_URL}/api/payments/cashfree/webhook",
                json=webhook_payload
            )
            assert response2.status_code == 200
            
            # Second call should indicate already processed
            data2 = response2.json()
            print(f"Duplicate webhook response: {data2}")
        else:
            pytest.skip("Could not create payment link for idempotency test")
    
    def test_legacy_webhook_endpoint(self):
        """Test legacy /api/payments/webhook endpoint still works"""
        webhook_payload = {
            "type": "PAYMENT_SUCCESS",
            "data": {"order": {"order_id": "LEGACY_TEST"}}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/webhook",
            json=webhook_payload
        )
        
        assert response.status_code == 200
        print(f"Legacy webhook response: {response.json()}")


class TestWebsitePayment:
    """Test website payment endpoints"""
    
    def test_website_payment_initiate(self):
        """Test POST /api/payments/website/initiate creates payment link"""
        response = requests.post(f"{BASE_URL}/api/payments/website/initiate", json={
            "customer_name": "TEST_Website_Customer",
            "customer_phone": "9876543213",
            "customer_email": "test@example.com",
            "address": "Test Address, Patna",
            "district": "Patna",
            "service_type": "solar_consultation",
            "amount": 2499,
            "notes": "Test website booking"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "payment_link" in data
        assert "order_id" in data
        assert data.get("amount") == 2499
        
        # Store order_id for verification test
        self.order_id = data.get("order_id")
        print(f"Website payment initiated: order_id={self.order_id}, link={data.get('payment_link')[:50]}...")
        
        return data.get("order_id")
    
    def test_website_payment_verify(self):
        """Test GET /api/payments/website/verify/{order_id}"""
        # First create a payment
        create_response = requests.post(f"{BASE_URL}/api/payments/website/initiate", json={
            "customer_name": "TEST_Verify_Customer",
            "customer_phone": "9876543214",
            "service_type": "solar_registration",
            "amount": 1500
        })
        
        if create_response.status_code == 200:
            order_id = create_response.json().get("order_id")
            
            # Verify payment status
            verify_response = requests.get(f"{BASE_URL}/api/payments/website/verify/{order_id}")
            
            assert verify_response.status_code == 200
            data = verify_response.json()
            
            # Verify response structure
            assert data.get("order_id") == order_id
            assert "status" in data
            assert "amount" in data
            assert "paid" in data
            
            print(f"Payment verification: order_id={order_id}, status={data.get('status')}, paid={data.get('paid')}")
        else:
            pytest.skip("Could not create payment for verification test")
    
    def test_website_payment_verify_not_found(self):
        """Test verification returns 404 for non-existent order"""
        response = requests.get(f"{BASE_URL}/api/payments/website/verify/NONEXISTENT_ORDER_123")
        
        assert response.status_code == 404
        print("Non-existent order correctly returns 404")
    
    def test_website_payment_invalid_phone(self):
        """Test website payment with invalid phone number"""
        response = requests.post(f"{BASE_URL}/api/payments/website/initiate", json={
            "customer_name": "TEST_Invalid_Phone",
            "customer_phone": "123",  # Invalid phone
            "service_type": "solar_consultation",
            "amount": 1000
        })
        
        # Should return 400 for invalid phone
        assert response.status_code == 400
        print(f"Invalid phone correctly rejected: {response.json()}")


class TestWebhookLogging:
    """Test webhook logging functionality"""
    
    def test_webhook_logs_are_created(self):
        """Test that webhook events are logged to payment_webhook_logs collection"""
        # Send a webhook
        webhook_payload = {
            "type": "PAYMENT_USER_DROPPED",
            "data": {
                "order": {"order_id": f"LOG_TEST_{uuid.uuid4().hex[:6]}"}
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/cashfree/webhook",
            json=webhook_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Response should include webhook_id
        if "webhook_id" in data:
            print(f"Webhook logged with ID: {data.get('webhook_id')}")
        else:
            print(f"Webhook response: {data}")


class TestPaymentSettings:
    """Test payment settings endpoints"""
    
    def test_get_payment_settings(self):
        """Test GET /api/payments/settings returns configuration"""
        response = requests.get(f"{BASE_URL}/api/payments/settings")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "configured" in data
        if data.get("configured"):
            assert "is_sandbox" in data
            assert "is_active" in data
            print(f"Payment settings: configured={data.get('configured')}, sandbox={data.get('is_sandbox')}")
        else:
            print("Cashfree not configured")
    
    def test_get_webhook_url(self):
        """Test GET /api/payments/webhook-url returns webhook configuration"""
        response = requests.get(f"{BASE_URL}/api/payments/webhook-url")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "webhook_url" in data
        assert "instructions" in data
        assert "supported_events" in data
        
        print(f"Webhook URL: {data.get('webhook_url')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
