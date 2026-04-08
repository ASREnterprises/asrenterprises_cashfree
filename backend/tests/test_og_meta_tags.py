"""
Test OG Meta Tags and Social Media Link Preview Setup
Tests for: og:title, og:description, og:image, twitter:card, twitter:image, canonical URL
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOGMetaTags:
    """Test Open Graph and Twitter Card meta tags for social media link preview"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - fetch homepage HTML once"""
        self.response = requests.get(f"{BASE_URL}/")
        self.html = self.response.text
    
    def test_homepage_returns_200(self):
        """Homepage should return 200 status code"""
        assert self.response.status_code == 200, f"Homepage returned {self.response.status_code}"
        print("✓ Homepage returns 200 status code")
    
    def test_og_title_present(self):
        """og:title meta tag should be present with correct content"""
        pattern = r'<meta\s+property="og:title"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "og:title meta tag not found"
        og_title = match.group(1)
        assert "ASR Enterprises" in og_title, f"og:title should contain 'ASR Enterprises', got: {og_title}"
        assert "Rooftop Solar Solutions" in og_title or "Solar" in og_title, f"og:title should mention solar, got: {og_title}"
        print(f"✓ og:title present: {og_title}")
    
    def test_og_description_present(self):
        """og:description meta tag should be present"""
        pattern = r'<meta\s+property="og:description"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "og:description meta tag not found"
        og_description = match.group(1)
        assert len(og_description) > 20, f"og:description too short: {og_description}"
        print(f"✓ og:description present: {og_description[:60]}...")
    
    def test_og_image_present_with_correct_url(self):
        """og:image meta tag should point to https://www.asrenterprises.in/og-homepage.jpg"""
        pattern = r'<meta\s+property="og:image"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "og:image meta tag not found"
        og_image = match.group(1)
        assert og_image == "https://www.asrenterprises.in/og-homepage.jpg", f"og:image should be 'https://www.asrenterprises.in/og-homepage.jpg', got: {og_image}"
        print(f"✓ og:image present: {og_image}")
    
    def test_twitter_card_present(self):
        """twitter:card meta tag should be set to summary_large_image"""
        pattern = r'<meta\s+name="twitter:card"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "twitter:card meta tag not found"
        twitter_card = match.group(1)
        assert twitter_card == "summary_large_image", f"twitter:card should be 'summary_large_image', got: {twitter_card}"
        print(f"✓ twitter:card present: {twitter_card}")
    
    def test_twitter_image_present(self):
        """twitter:image meta tag should be present"""
        pattern = r'<meta\s+name="twitter:image"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "twitter:image meta tag not found"
        twitter_image = match.group(1)
        assert "og-homepage.jpg" in twitter_image or "asrenterprises" in twitter_image, f"twitter:image should reference the OG image, got: {twitter_image}"
        print(f"✓ twitter:image present: {twitter_image}")
    
    def test_canonical_url_present(self):
        """Canonical URL should point to https://www.asrenterprises.in/"""
        pattern = r'<link\s+rel="canonical"\s+href="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "Canonical URL not found"
        canonical = match.group(1)
        assert canonical == "https://www.asrenterprises.in/", f"Canonical URL should be 'https://www.asrenterprises.in/', got: {canonical}"
        print(f"✓ Canonical URL present: {canonical}")
    
    def test_og_image_dimensions(self):
        """og:image:width and og:image:height should be 1200x630"""
        width_pattern = r'<meta\s+property="og:image:width"\s+content="(\d+)"'
        height_pattern = r'<meta\s+property="og:image:height"\s+content="(\d+)"'
        
        width_match = re.search(width_pattern, self.html)
        height_match = re.search(height_pattern, self.html)
        
        assert width_match, "og:image:width not found"
        assert height_match, "og:image:height not found"
        
        width = int(width_match.group(1))
        height = int(height_match.group(1))
        
        assert width == 1200, f"og:image:width should be 1200, got: {width}"
        assert height == 630, f"og:image:height should be 630, got: {height}"
        print(f"✓ og:image dimensions: {width}x{height}")


class TestOGImageAccessibility:
    """Test that OG image is accessible"""
    
    def test_og_image_accessible_at_preview_url(self):
        """OG image should be accessible at the preview URL"""
        response = requests.get(f"{BASE_URL}/og-homepage.jpg")
        assert response.status_code == 200, f"OG image not accessible at {BASE_URL}/og-homepage.jpg, got status {response.status_code}"
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        assert 'image' in content_type, f"OG image should have image content type, got: {content_type}"
        
        # Check file size (should be > 10KB for a proper image)
        content_length = len(response.content)
        assert content_length > 10000, f"OG image seems too small ({content_length} bytes), might be broken"
        
        print(f"✓ OG image accessible at {BASE_URL}/og-homepage.jpg ({content_length} bytes)")
    
    def test_og_image_is_valid_image(self):
        """OG image should be a valid image (JPEG or PNG)"""
        response = requests.get(f"{BASE_URL}/og-homepage.jpg")
        assert response.status_code == 200
        
        # Check for valid image magic bytes (JPEG or PNG)
        content = response.content
        is_jpeg = content[:2] == b'\xff\xd8'  # JPEG magic bytes
        is_png = content[:8] == b'\x89PNG\r\n\x1a\n'  # PNG magic bytes
        
        assert is_jpeg or is_png, "OG image is not a valid JPEG or PNG file"
        
        image_type = "JPEG" if is_jpeg else "PNG"
        print(f"✓ OG image is a valid {image_type} file (Note: file has .jpg extension but is {image_type})")


class TestAdditionalMetaTags:
    """Test additional meta tags for SEO and social sharing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - fetch homepage HTML once"""
        self.response = requests.get(f"{BASE_URL}/")
        self.html = self.response.text
    
    def test_og_type_present(self):
        """og:type should be 'website'"""
        pattern = r'<meta\s+property="og:type"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "og:type meta tag not found"
        og_type = match.group(1)
        assert og_type == "website", f"og:type should be 'website', got: {og_type}"
        print(f"✓ og:type present: {og_type}")
    
    def test_og_url_present(self):
        """og:url should be present"""
        pattern = r'<meta\s+property="og:url"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "og:url meta tag not found"
        og_url = match.group(1)
        assert "asrenterprises" in og_url, f"og:url should contain 'asrenterprises', got: {og_url}"
        print(f"✓ og:url present: {og_url}")
    
    def test_og_site_name_present(self):
        """og:site_name should be 'ASR Enterprises'"""
        pattern = r'<meta\s+property="og:site_name"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "og:site_name meta tag not found"
        site_name = match.group(1)
        assert "ASR Enterprises" in site_name, f"og:site_name should contain 'ASR Enterprises', got: {site_name}"
        print(f"✓ og:site_name present: {site_name}")
    
    def test_twitter_title_present(self):
        """twitter:title should be present"""
        pattern = r'<meta\s+name="twitter:title"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "twitter:title meta tag not found"
        twitter_title = match.group(1)
        assert "ASR Enterprises" in twitter_title, f"twitter:title should contain 'ASR Enterprises', got: {twitter_title}"
        print(f"✓ twitter:title present: {twitter_title}")
    
    def test_twitter_description_present(self):
        """twitter:description should be present"""
        pattern = r'<meta\s+name="twitter:description"\s+content="([^"]+)"'
        match = re.search(pattern, self.html)
        assert match, "twitter:description meta tag not found"
        twitter_desc = match.group(1)
        assert len(twitter_desc) > 20, f"twitter:description too short: {twitter_desc}"
        print(f"✓ twitter:description present: {twitter_desc[:60]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
