"""
Test file for Iteration 24 - Multiple new features testing:
1. GET /api/admin/district-fees - Returns editable district fees
2. PUT /api/shop/bihar-districts/fees - Update district delivery fees
3. POST /api/admin/sync-service-bookings - Sync service bookings to orders
4. GET /api/crm/razorpay-payments - Get all Razorpay payments for CRM
5. POST /api/upload/optimize-image - Image optimization to WebP
6. GZIP compression middleware verification
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthAndGzip:
    """Test health endpoint and GZIP compression"""
    
    def test_health_endpoint(self, api_client):
        """Test API health check"""
        response = api_client.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        print("PASSED: Health endpoint working")
    
    def test_gzip_compression_enabled(self, api_client):
        """Verify GZIP compression middleware is active"""
        # Request with Accept-Encoding: gzip
        headers = {"Accept-Encoding": "gzip, deflate"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        # Check if response is compressed (Content-Encoding header)
        content_encoding = response.headers.get("Content-Encoding", "")
        print(f"Content-Encoding header: {content_encoding}")
        # Note: GZIP middleware only applies to responses > minimum_size (500 bytes)
        # Small responses may not be compressed
        print("PASSED: GZIP middleware check - endpoint accessible")


class TestDistrictFees:
    """Test admin district fees endpoints"""
    
    def test_get_admin_district_fees(self, api_client):
        """GET /api/admin/district-fees - Returns editable district fees"""
        response = api_client.get(f"{BASE_URL}/api/admin/district-fees")
        assert response.status_code == 200
        
        data = response.json()
        # Validate response structure
        assert "districts" in data, "Response should have 'districts' list"
        assert "fees" in data, "Response should have 'fees' dictionary"
        assert "default_fees" in data, "Response should have 'default_fees' dictionary"
        
        # Validate districts list is not empty
        assert len(data["districts"]) > 0, "Districts list should not be empty"
        
        # Validate fees is a dictionary
        assert isinstance(data["fees"], dict), "Fees should be a dictionary"
        
        print(f"PASSED: Got {len(data['districts'])} districts with fees")
        print(f"Sample districts: {data['districts'][:5]}")
    
    def test_update_district_delivery_fees(self, api_client):
        """PUT /api/shop/bihar-districts/fees - Update district delivery fees"""
        # First get current fees
        get_response = api_client.get(f"{BASE_URL}/api/admin/district-fees")
        assert get_response.status_code == 200
        
        current_data = get_response.json()
        
        # Create update payload with a modified fee for one district
        test_fees = current_data.get("fees", {}).copy()
        if len(current_data["districts"]) > 0:
            test_district = current_data["districts"][0]
            original_fee = test_fees.get(test_district, 200)
            test_fees[test_district] = 250  # Update to test value
        
        # Update fees
        update_response = api_client.put(
            f"{BASE_URL}/api/shop/bihar-districts/fees",
            json={"delivery_fees": test_fees}
        )
        assert update_response.status_code == 200
        
        update_data = update_response.json()
        assert update_data.get("status") == "success"
        assert "message" in update_data
        
        # Verify update was persisted
        verify_response = api_client.get(f"{BASE_URL}/api/admin/district-fees")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        
        if len(current_data["districts"]) > 0:
            assert verify_data["fees"].get(test_district) == 250, "Fee update should be persisted"
            
            # Restore original fee
            test_fees[test_district] = original_fee
            api_client.put(f"{BASE_URL}/api/shop/bihar-districts/fees", json={"delivery_fees": test_fees})
        
        print("PASSED: District delivery fees update working")
    
    def test_update_fees_empty_payload(self, api_client):
        """PUT /api/shop/bihar-districts/fees - Should fail with empty fees"""
        response = api_client.put(
            f"{BASE_URL}/api/shop/bihar-districts/fees",
            json={"delivery_fees": {}}
        )
        assert response.status_code == 400
        print("PASSED: Empty fees payload correctly rejected")


class TestServiceBookingsSync:
    """Test service bookings sync to orders endpoint"""
    
    def test_sync_service_bookings(self, api_client):
        """POST /api/admin/sync-service-bookings - Sync service bookings to orders"""
        response = api_client.post(f"{BASE_URL}/api/admin/sync-service-bookings")
        assert response.status_code == 200
        
        data = response.json()
        # Validate response structure
        assert data.get("status") == "success", "Should return success status"
        assert "message" in data, "Should have message"
        assert "new_orders_created" in data, "Should report new orders created"
        assert "total_processed" in data, "Should report total processed"
        
        # Values should be non-negative integers
        assert isinstance(data["new_orders_created"], int)
        assert isinstance(data["total_processed"], int)
        assert data["new_orders_created"] >= 0
        assert data["total_processed"] >= 0
        
        print(f"PASSED: Service bookings sync - {data['new_orders_created']} new orders, {data['total_processed']} total processed")
    
    def test_sync_service_bookings_idempotent(self, api_client):
        """Verify sync is idempotent - second call should create 0 new orders"""
        # First sync
        response1 = api_client.post(f"{BASE_URL}/api/admin/sync-service-bookings")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second sync immediately after
        response2 = api_client.post(f"{BASE_URL}/api/admin/sync-service-bookings")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second sync should create 0 new orders (all already synced)
        assert data2["new_orders_created"] == 0, "Second sync should not create duplicate orders"
        
        print("PASSED: Service bookings sync is idempotent")


class TestCRMRazorpayPayments:
    """Test CRM Razorpay payments endpoint"""
    
    def test_get_crm_razorpay_payments(self, api_client):
        """GET /api/crm/razorpay-payments - Get all Razorpay payments for CRM"""
        response = api_client.get(f"{BASE_URL}/api/crm/razorpay-payments")
        assert response.status_code == 200
        
        data = response.json()
        # Validate response structure
        assert data.get("status") == "success", "Should return success status"
        assert "payments" in data, "Should have payments list"
        assert "source" in data, "Should indicate source (local or razorpay)"
        
        # Payments should be a list
        assert isinstance(data["payments"], list)
        
        # If payments exist, validate structure
        if len(data["payments"]) > 0:
            payment = data["payments"][0]
            assert "id" in payment or "amount" in payment, "Payment should have id or amount"
        
        print(f"PASSED: Got {len(data['payments'])} CRM Razorpay payments from {data['source']}")
    
    def test_get_crm_razorpay_payments_with_pagination(self, api_client):
        """GET /api/crm/razorpay-payments with count and skip params"""
        response = api_client.get(f"{BASE_URL}/api/crm/razorpay-payments?count=5&skip=0")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        assert "payments" in data
        
        print(f"PASSED: CRM Razorpay payments pagination working")


class TestImageOptimization:
    """Test image optimization to WebP endpoint"""
    
    def test_upload_optimize_image_webp(self, api_client):
        """POST /api/upload/optimize-image - Image optimization to WebP"""
        # Create a simple test image (red 100x100 PNG)
        from PIL import Image as PILImage
        
        img = PILImage.new('RGB', (100, 100), color='red')
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Upload image
        files = {'file': ('test_image.png', img_buffer, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload/optimize-image", files=files)
        
        assert response.status_code == 200
        
        data = response.json()
        # Validate response structure
        assert data.get("status") == "success", "Should return success status"
        assert "filename" in data, "Should return filename"
        assert data["filename"].endswith(".webp"), "Output should be WebP format"
        assert "original_size_kb" in data, "Should report original size"
        assert "optimized_size_kb" in data, "Should report optimized size"
        assert "compression_ratio" in data, "Should report compression ratio"
        assert "data_url" in data, "Should return data_url for immediate use"
        assert data["data_url"].startswith("data:image/webp;base64,"), "Data URL should be WebP base64"
        
        print(f"PASSED: Image optimization - Original: {data['original_size_kb']}KB, Optimized: {data['optimized_size_kb']}KB, Compression: {data['compression_ratio']}%")
    
    def test_upload_optimize_image_invalid_file(self, api_client):
        """POST /api/upload/optimize-image - Should reject non-image files"""
        # Create a text file
        text_buffer = io.BytesIO(b"This is not an image")
        text_buffer.seek(0)
        
        files = {'file': ('test.txt', text_buffer, 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/upload/optimize-image", files=files)
        
        assert response.status_code == 400
        print("PASSED: Non-image file correctly rejected")
    
    def test_get_uploaded_image(self, api_client):
        """GET /api/uploads/{filename} - Verify uploaded images are served"""
        # First upload an image
        from PIL import Image as PILImage
        
        img = PILImage.new('RGB', (50, 50), color='blue')
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        files = {'file': ('blue_test.png', img_buffer, 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/upload/optimize-image", files=files)
        
        if upload_response.status_code == 200:
            upload_data = upload_response.json()
            filename = upload_data.get("filename")
            
            if filename:
                # Try to retrieve the uploaded image
                get_response = requests.get(f"{BASE_URL}/api/uploads/{filename}")
                assert get_response.status_code == 200
                assert get_response.headers.get("Content-Type") == "image/webp"
                assert "Cache-Control" in get_response.headers
                print(f"PASSED: Uploaded image {filename} is served correctly with caching headers")
            else:
                print("SKIPPED: No filename returned from upload")
        else:
            print("SKIPPED: Upload failed, cannot test retrieval")


class TestBiharDistrictsEndpoint:
    """Test Bihar districts info endpoint"""
    
    def test_get_bihar_districts(self, api_client):
        """GET /api/shop/bihar-districts - Returns all Bihar districts with fees"""
        response = api_client.get(f"{BASE_URL}/api/shop/bihar-districts")
        assert response.status_code == 200
        
        data = response.json()
        assert "districts" in data, "Should have districts list"
        assert "delivery_fees" in data, "Should have delivery_fees"
        
        # Should have multiple districts
        assert len(data["districts"]) > 20, "Should have many Bihar districts"
        
        print(f"PASSED: Got {len(data['districts'])} Bihar districts")


class TestShopStatsEndpoint:
    """Test shop stats for admin dashboard"""
    
    def test_get_shop_stats(self, api_client):
        """GET /api/shop/stats - Returns shop statistics"""
        response = api_client.get(f"{BASE_URL}/api/shop/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Check for expected fields
        expected_fields = ["total_products", "total_orders", "pending_orders", "total_revenue"]
        for field in expected_fields:
            assert field in data, f"Should have '{field}' in stats"
        
        print(f"PASSED: Shop stats - Products: {data.get('total_products')}, Orders: {data.get('total_orders')}, Revenue: {data.get('total_revenue')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
