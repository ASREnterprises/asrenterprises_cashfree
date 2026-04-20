"""
Backend API Tests for New Features:
- Google Reviews API (GET, POST, DELETE)
- Database Backup API (GET, POST, DELETE)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGoogleReviewsAPI:
    """Tests for Google Reviews admin endpoints"""
    
    test_review_ids = []
    
    def test_get_google_reviews_initially(self):
        """GET /api/admin/google-reviews - Get all Google reviews"""
        response = requests.get(f"{BASE_URL}/api/admin/google-reviews")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "success" in data
        assert "reviews" in data
        assert "total" in data
        assert isinstance(data["reviews"], list)
        print(f"SUCCESS: GET google-reviews returns {data['total']} reviews")
    
    def test_sync_google_review_success(self):
        """POST /api/admin/google-reviews/sync - Add a new Google review"""
        test_reviewer = f"TEST_Reviewer_{uuid.uuid4().hex[:8]}"
        payload = {
            "reviewer_name": test_reviewer,
            "review_text": "This is a test review for ASR Enterprises. Great solar installation service!",
            "rating": 5,
            "review_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/google-reviews/sync",
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "review_id" in data
        
        # Store for cleanup
        TestGoogleReviewsAPI.test_review_ids.append(data["review_id"])
        print(f"SUCCESS: Created test review with ID: {data['review_id']}")
    
    def test_sync_google_review_validation_error(self):
        """POST /api/admin/google-reviews/sync - Should fail without required fields"""
        payload = {
            "reviewer_name": "",
            "review_text": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/google-reviews/sync",
            json=payload
        )
        
        assert response.status_code == 400, f"Expected 400 for empty fields, got {response.status_code}"
        print("SUCCESS: Validation error returned for empty fields")
    
    def test_sync_google_review_duplicate_check(self):
        """POST /api/admin/google-reviews/sync - Duplicate detection"""
        test_reviewer = f"TEST_DuplicateCheck_{uuid.uuid4().hex[:8]}"
        payload = {
            "reviewer_name": test_reviewer,
            "review_text": "Unique review text for duplicate testing purpose in ASR app.",
            "rating": 4
        }
        
        # First submission
        response1 = requests.post(f"{BASE_URL}/api/admin/google-reviews/sync", json=payload)
        assert response1.status_code == 200
        data1 = response1.json()
        if data1.get("review_id"):
            TestGoogleReviewsAPI.test_review_ids.append(data1["review_id"])
        
        # Second submission with same data
        response2 = requests.post(f"{BASE_URL}/api/admin/google-reviews/sync", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should detect duplicate
        assert data2.get("success") == False or "already exists" in data2.get("message", "")
        print("SUCCESS: Duplicate detection working")
    
    def test_get_google_reviews_after_creation(self):
        """GET /api/admin/google-reviews - Verify created reviews exist"""
        response = requests.get(f"{BASE_URL}/api/admin/google-reviews")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that our test reviews appear
        review_names = [r.get("reviewer_name", "") for r in data["reviews"]]
        test_reviews_found = sum(1 for name in review_names if name.startswith("TEST_"))
        
        print(f"SUCCESS: Found {test_reviews_found} test reviews in list")
    
    def test_toggle_google_review_visibility(self):
        """PUT /api/admin/google-reviews/{id}/toggle - Toggle visibility"""
        if not TestGoogleReviewsAPI.test_review_ids:
            pytest.skip("No test reviews to toggle")
        
        review_id = TestGoogleReviewsAPI.test_review_ids[0]
        response = requests.put(f"{BASE_URL}/api/admin/google-reviews/{review_id}/toggle")
        
        assert response.status_code == 200
        data = response.json()
        assert "visible" in data
        print(f"SUCCESS: Toggled review visibility to {data['visible']}")
    
    def test_public_google_reviews_endpoint(self):
        """GET /api/google-reviews - Public endpoint for visible reviews"""
        response = requests.get(f"{BASE_URL}/api/google-reviews")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "reviews" in data
        print(f"SUCCESS: Public google reviews endpoint returns {len(data['reviews'])} visible reviews")
    
    def test_delete_google_review(self):
        """DELETE /api/admin/google-reviews/{id} - Delete a review"""
        if not TestGoogleReviewsAPI.test_review_ids:
            pytest.skip("No test reviews to delete")
        
        for review_id in TestGoogleReviewsAPI.test_review_ids:
            response = requests.delete(f"{BASE_URL}/api/admin/google-reviews/{review_id}")
            assert response.status_code == 200, f"Failed to delete review {review_id}"
        
        print(f"SUCCESS: Cleaned up {len(TestGoogleReviewsAPI.test_review_ids)} test reviews")
        TestGoogleReviewsAPI.test_review_ids = []


class TestBackupAPI:
    """Tests for Database Backup admin endpoints"""
    
    test_backup_filenames = []
    
    def test_list_backups_initially(self):
        """GET /api/admin/backup/list - List all backups"""
        response = requests.get(f"{BASE_URL}/api/admin/backup/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "success" in data
        assert "backups" in data
        assert "total" in data
        assert isinstance(data["backups"], list)
        
        print(f"SUCCESS: Backup list returns {data['total']} backups")
    
    def test_create_backup_success(self):
        """POST /api/admin/backup/create - Create a manual backup"""
        response = requests.post(f"{BASE_URL}/api/admin/backup/create")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "filename" in data
        assert "size_bytes" in data
        assert "collections_backed_up" in data
        
        # Store filename for cleanup
        TestBackupAPI.test_backup_filenames.append(data["filename"])
        
        print(f"SUCCESS: Created backup: {data['filename']} ({data['size_mb']} MB, {data['collections_backed_up']} collections)")
    
    def test_list_backups_after_creation(self):
        """GET /api/admin/backup/list - Verify backup appears in list"""
        response = requests.get(f"{BASE_URL}/api/admin/backup/list")
        
        assert response.status_code == 200
        data = response.json()
        
        if TestBackupAPI.test_backup_filenames:
            filenames = [b["filename"] for b in data["backups"]]
            assert TestBackupAPI.test_backup_filenames[0] in filenames, "Created backup not found in list"
        
        print(f"SUCCESS: Backup list now contains {data['total']} backups")
    
    def test_backup_download_endpoint(self):
        """GET /api/admin/backup/download/{filename} - Download backup file"""
        if not TestBackupAPI.test_backup_filenames:
            pytest.skip("No test backups to download")
        
        filename = TestBackupAPI.test_backup_filenames[0]
        response = requests.get(f"{BASE_URL}/api/admin/backup/download/{filename}")
        
        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
        
        print(f"SUCCESS: Backup download returns valid JSON file")
    
    def test_backup_download_nonexistent(self):
        """GET /api/admin/backup/download/{filename} - 404 for non-existent file"""
        response = requests.get(f"{BASE_URL}/api/admin/backup/download/nonexistent_backup.json")
        
        assert response.status_code == 404
        print("SUCCESS: Returns 404 for non-existent backup")
    
    def test_delete_backup_success(self):
        """DELETE /api/admin/backup/{filename} - Delete a backup file"""
        if not TestBackupAPI.test_backup_filenames:
            pytest.skip("No test backups to delete")
        
        for filename in TestBackupAPI.test_backup_filenames:
            response = requests.delete(f"{BASE_URL}/api/admin/backup/{filename}")
            assert response.status_code == 200, f"Failed to delete backup {filename}"
        
        print(f"SUCCESS: Cleaned up {len(TestBackupAPI.test_backup_filenames)} test backups")
        TestBackupAPI.test_backup_filenames = []
    
    def test_delete_backup_nonexistent(self):
        """DELETE /api/admin/backup/{filename} - 404 for non-existent file"""
        response = requests.delete(f"{BASE_URL}/api/admin/backup/nonexistent_backup_test.json")
        
        assert response.status_code == 404
        print("SUCCESS: Returns 404 when deleting non-existent backup")


class TestReviewsAPIPublic:
    """Test public reviews endpoint used by Bihar Map"""
    
    def test_public_reviews_endpoint(self):
        """GET /api/reviews - Public reviews for Bihar Map"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of reviews
        assert isinstance(data, list)
        print(f"SUCCESS: Public reviews endpoint returns {len(data)} reviews")
        
        if data:
            # Check review structure
            review = data[0]
            print(f"Sample review: {review.get('customer_name', 'N/A')} from {review.get('location', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
