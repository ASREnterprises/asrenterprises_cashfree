"""
Test iteration 13 features:
1. Contact page logo shows without white background (/asr_logo_dark.png)
2. Gallery page logo shows without white background (/asr_logo_dark.png)
3. Admin dashboard does NOT show 'Social Media Hub' card
4. AI testimonial generation creates unique content via /api/crm/generate-testimonial
5. Google Review button links to working Google search URL
6. Homepage testimonials section displays customer reviews
"""

import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestAITestimonialGeneration:
    """Test AI-powered testimonial generation via /api/crm/generate-testimonial"""
    
    def test_generate_testimonial_basic(self):
        """Test basic testimonial generation"""
        payload = {
            "name": f"TEST_Customer_{random.randint(1000, 9999)}",
            "address": "Patna, Bihar",
            "solar_capacity": "5",
            "bill_before": "4000",
            "bill_after": "200",
            "rating": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/crm/generate-testimonial", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert "customer_name" in data, "Response should contain customer_name"
        assert "review_text" in data, "Response should contain review_text"
        assert data["customer_name"] == payload["name"], "Customer name should match"
        assert data["is_testimonial"] == True, "is_testimonial should be True"
        assert len(data["review_text"]) > 20, "Testimonial text should be substantial"
        print(f"Generated testimonial: {data['review_text'][:100]}...")
    
    def test_generate_testimonial_with_different_ratings(self):
        """Test testimonial generation with different ratings"""
        for rating in [3, 4, 5]:
            payload = {
                "name": f"TEST_Rating{rating}_{random.randint(100, 999)}",
                "address": "Muzaffarpur, Bihar",
                "solar_capacity": "3",
                "bill_before": "2500",
                "bill_after": "100",
                "rating": rating
            }
            
            response = requests.post(f"{BASE_URL}/api/crm/generate-testimonial", json=payload)
            assert response.status_code == 200, f"Rating {rating} testimonial failed"
            
            data = response.json()
            assert data["rating"] == rating, f"Rating should be {rating}"
            print(f"Rating {rating} testimonial generated successfully")


class TestReviewsEndpoint:
    """Test reviews endpoint for homepage testimonials"""
    
    def test_get_reviews(self):
        """Test GET /api/reviews returns list of reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Reviews should be a list"
        print(f"Found {len(data)} reviews")
        
        if len(data) > 0:
            review = data[0]
            assert "id" in review, "Review should have id"
            assert "customer_name" in review, "Review should have customer_name"
            assert "review_text" in review, "Review should have review_text"
            assert "rating" in review, "Review should have rating"
            print(f"First review: {review.get('customer_name', 'Unknown')} - {review.get('review_text', '')[:50]}...")
    
    def test_reviews_contain_testimonials(self):
        """Test that generated testimonials appear in reviews"""
        # First create a unique testimonial
        unique_name = f"TEST_Unique_{random.randint(10000, 99999)}"
        payload = {
            "name": unique_name,
            "address": "Gaya, Bihar",
            "solar_capacity": "4",
            "bill_before": "3000",
            "bill_after": "150",
            "rating": 5
        }
        
        create_response = requests.post(f"{BASE_URL}/api/crm/generate-testimonial", json=payload)
        assert create_response.status_code == 200, "Failed to create testimonial"
        
        # Now fetch reviews
        reviews_response = requests.get(f"{BASE_URL}/api/reviews")
        assert reviews_response.status_code == 200, "Failed to get reviews"
        
        reviews = reviews_response.json()
        found = any(r.get("customer_name") == unique_name for r in reviews)
        assert found, f"Created testimonial for {unique_name} should appear in reviews"
        print(f"Testimonial for {unique_name} found in reviews")


class TestAdminOTPLogin:
    """Test admin OTP login flow"""
    
    def test_send_otp(self):
        """Test sending OTP to admin email"""
        response = requests.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "asrenterprisespatna@gmail.com"
        })
        assert response.status_code == 200, f"Send OTP failed: {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Send OTP should succeed"
        print("OTP sent successfully")
    
    def test_verify_otp(self):
        """Test verifying OTP for admin login"""
        # First send OTP
        requests.post(f"{BASE_URL}/api/admin/send-otp", json={
            "email": "asrenterprisespatna@gmail.com"
        })
        
        # Verify with test OTP
        response = requests.post(f"{BASE_URL}/api/admin/verify-otp", json={
            "email": "asrenterprisespatna@gmail.com",
            "otp": "131993"
        })
        assert response.status_code == 200, f"Verify OTP failed: {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Verify OTP should succeed"
        assert data.get("role") == "admin", "Role should be admin"
        print("Admin login verified successfully")


class TestDashboardStats:
    """Test dashboard stats endpoint"""
    
    def test_get_dashboard_stats(self):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total_leads" in data, "Stats should contain total_leads"
        assert "total_photos" in data, "Stats should contain total_photos"
        assert "total_reviews" in data, "Stats should contain total_reviews"
        print(f"Dashboard stats: leads={data.get('total_leads')}, photos={data.get('total_photos')}, reviews={data.get('total_reviews')}")


class TestPhotosEndpoint:
    """Test photos endpoint for gallery page"""
    
    def test_get_photos(self):
        """Test GET /api/photos returns gallery photos"""
        response = requests.get(f"{BASE_URL}/api/photos")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Photos should be a list"
        print(f"Found {len(data)} gallery photos")


class TestHealthAndConnectivity:
    """Basic health and connectivity tests"""
    
    def test_homepage_loads(self):
        """Test that the frontend homepage loads"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Homepage should load, got {response.status_code}"
        assert "ASR" in response.text or "solar" in response.text.lower(), "Page should contain solar business content"
        print("Homepage loads successfully")
    
    def test_contact_page_loads(self):
        """Test that Contact page loads"""
        response = requests.get(f"{BASE_URL}/contact")
        assert response.status_code == 200, f"Contact page should load, got {response.status_code}"
        print("Contact page loads successfully")
    
    def test_gallery_page_loads(self):
        """Test that Gallery page loads"""
        response = requests.get(f"{BASE_URL}/gallery")
        assert response.status_code == 200, f"Gallery page should load, got {response.status_code}"
        print("Gallery page loads successfully")
    
    def test_districts_endpoint(self):
        """Test GET /api/districts returns Bihar districts"""
        response = requests.get(f"{BASE_URL}/api/districts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "districts" in data, "Response should contain districts"
        assert len(data["districts"]) > 20, "Should have many Bihar districts"
        assert "Patna" in data["districts"], "Patna should be in districts list"
        print(f"Found {len(data['districts'])} Bihar districts")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
