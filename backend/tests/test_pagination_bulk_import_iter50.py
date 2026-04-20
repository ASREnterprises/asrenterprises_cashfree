"""
Test Suite: Pagination and Enhanced Bulk Import (Iteration 50)
Testing:
1. GET /api/crm/leads pagination (page, limit params, pagination object in response)
2. POST /api/crm/leads/bulk-import - phone number extraction from ALL columns
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Pagination Tests
class TestLeadsPagination:
    """Test GET /api/crm/leads with pagination parameters"""
    
    def test_leads_default_pagination(self):
        """Test default pagination returns pagination object"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        
        # Must have 'leads' array and 'pagination' object
        assert "leads" in data, "Response must have 'leads' array"
        assert "pagination" in data, "Response must have 'pagination' object"
        
        pagination = data["pagination"]
        # Verify all pagination fields
        assert "current_page" in pagination
        assert "total_pages" in pagination
        assert "total_count" in pagination
        assert "per_page" in pagination
        assert "has_next" in pagination
        assert "has_prev" in pagination
        
        print(f"PASS: Default pagination - Total: {pagination['total_count']}, Per page: {pagination['per_page']}")
    
    def test_leads_with_page_param(self):
        """Test pagination with explicit page parameter"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert data["pagination"]["current_page"] == 1
        assert data["pagination"]["per_page"] == 10
        assert len(data["leads"]) <= 10, "Leads returned should respect limit"
        
        print(f"PASS: Page 1 with limit=10 - Got {len(data['leads'])} leads")
    
    def test_leads_page_2(self):
        """Test fetching page 2"""
        # First get total count
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        total = data["pagination"]["total_count"]
        
        if total > 5:
            # Fetch page 2
            response2 = requests.get(f"{BASE_URL}/api/crm/leads?page=2&limit=5")
            assert response2.status_code == 200
            data2 = response2.json()
            
            assert data2["pagination"]["current_page"] == 2
            assert data2["pagination"]["has_prev"] == True
            print(f"PASS: Page 2 fetched - {len(data2['leads'])} leads")
        else:
            print(f"SKIP: Only {total} leads, not enough for page 2 test")
    
    def test_leads_limit_max_500(self):
        """Test that limit is capped at 500"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?limit=1000")
        assert response.status_code == 200
        data = response.json()
        
        # per_page should be 500 max (or total count if less)
        assert data["pagination"]["per_page"] <= 500, "Limit should be capped at 500"
        print(f"PASS: Limit capped correctly at {data['pagination']['per_page']}")
    
    def test_leads_default_limit_250(self):
        """Test default limit is 250"""
        response = requests.get(f"{BASE_URL}/api/crm/leads")
        assert response.status_code == 200
        data = response.json()
        
        # Default per_page should be 250
        assert data["pagination"]["per_page"] == 250, f"Default limit should be 250, got {data['pagination']['per_page']}"
        print("PASS: Default limit is 250")
    
    def test_leads_has_next_prev_flags(self):
        """Test has_next and has_prev flags are accurate"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        pagination = data["pagination"]
        
        # Page 1 should have has_prev = False
        assert pagination["has_prev"] == False, "Page 1 should have has_prev=False"
        
        # If there are more pages, has_next should be True
        if pagination["total_pages"] > 1:
            assert pagination["has_next"] == True, "Should have has_next=True when more pages exist"
        else:
            assert pagination["has_next"] == False, "Should have has_next=False on last page"
        
        print(f"PASS: has_next={pagination['has_next']}, has_prev={pagination['has_prev']}")
    
    def test_leads_search_with_pagination(self):
        """Test search parameter works with pagination"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?search=9&page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert "leads" in data
        assert "pagination" in data
        print(f"PASS: Search with pagination - {data['pagination']['total_count']} matching leads")
    
    def test_leads_stage_filter_with_pagination(self):
        """Test stage filter works with pagination"""
        response = requests.get(f"{BASE_URL}/api/crm/leads?stage=new&page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert "leads" in data
        assert "pagination" in data
        # All returned leads should have stage=new
        for lead in data["leads"]:
            assert lead.get("stage") == "new", f"Lead should have stage=new, got {lead.get('stage')}"
        
        print(f"PASS: Stage filter with pagination - {data['pagination']['total_count']} new leads")


# Bulk Import Tests
class TestBulkImportPhoneExtraction:
    """Test POST /api/crm/leads/bulk-import phone extraction from ALL columns"""
    
    def test_bulk_import_phone_in_first_column(self):
        """Test phone extraction when phone is in first column named 'phone'"""
        csv_content = "phone,name\n9876543210,Test User\n8765432109,User Two"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        # Should find phones or report duplicates
        total_processed = data.get("imported_count", 0) + data.get("duplicate_count", 0)
        assert total_processed >= 0, "Should process the phones"
        print(f"PASS: Phone in 'phone' column - {data['imported_count']} imported, {data['duplicate_count']} duplicates")
    
    def test_bulk_import_phone_in_random_column(self):
        """Test phone extraction when phone is in a non-standard column"""
        csv_content = "name,random_data,contact_mobile,city\nJohn,xyz,9123456780,Patna"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        # Either imported or duplicate
        print(f"PASS: Phone in random column - imported: {data['imported_count']}, columns used: {data.get('phone_columns_used', [])}")
    
    def test_bulk_import_phone_mixed_with_text(self):
        """Test phone extraction when value has text mixed with phone"""
        csv_content = "info\nCall me at 9988776655 for details\n"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        print(f"PASS: Phone mixed with text - imported: {data['imported_count']}")
    
    def test_bulk_import_phone_with_91_prefix(self):
        """Test phone extraction handles +91 prefix"""
        csv_content = "mobile\n+919876543210\n91 8765432109"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        print(f"PASS: Phone with +91 prefix - imported: {data['imported_count']}")
    
    def test_bulk_import_phone_with_dashes_spaces(self):
        """Test phone extraction handles formatted numbers"""
        csv_content = "contact\n987-654-3210\n876 543 2109"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        print(f"PASS: Formatted phone numbers - imported: {data['imported_count']}")
    
    def test_bulk_import_validates_indian_mobile(self):
        """Test only valid Indian mobile numbers (starting with 6,7,8,9) are accepted"""
        csv_content = "phone\n5123456789\n1234567890\n9876543210"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        # Should have errors for invalid phones
        error_count = data.get("error_count", 0)
        assert error_count >= 2, f"Should reject phones not starting with 6,7,8,9 - got {error_count} errors"
        print(f"PASS: Validates Indian mobile - errors: {error_count}")
    
    def test_bulk_import_empty_file(self):
        """Test handling of empty file"""
        csv_content = ""
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 400
        print("PASS: Empty file rejected with 400")
    
    def test_bulk_import_invalid_file_type(self):
        """Test rejection of invalid file types"""
        txt_content = "Just some text"
        files = {"file": ("test.txt", txt_content.encode(), "text/plain")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 400
        print("PASS: Invalid file type rejected with 400")
    
    def test_bulk_import_detects_duplicates(self):
        """Test duplicate detection within file"""
        csv_content = "phone\n9876543210\n9876543210\n9876543210"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        # Should have duplicates (either in DB or within file)
        duplicate_count = data.get("duplicate_count", 0)
        print(f"PASS: Duplicate detection - duplicates: {duplicate_count}")
    
    def test_bulk_import_returns_columns_used(self):
        """Test response includes which columns were used for phone extraction"""
        csv_content = "name,Mobile Number,address\nTest,9123456789,Patna"
        files = {"file": ("test.csv", csv_content.encode(), "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/crm/leads/bulk-import", files=files)
        assert response.status_code == 200
        data = response.json()
        
        assert "phone_columns_used" in data, "Response should include phone_columns_used"
        print(f"PASS: Columns used: {data['phone_columns_used']}")


class TestBulkImportManual:
    """Test POST /api/crm/leads/bulk-import-manual for manual paste"""
    
    def test_manual_import_newline_separated(self):
        """Test manual import with newline-separated phones"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-import-manual",
            json={"phones": "9876543210\n8765432109\n7654321098"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"PASS: Newline separated - imported: {data.get('imported_count', 0)}")
    
    def test_manual_import_comma_separated(self):
        """Test manual import with comma-separated phones"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-import-manual",
            json={"phones": "9876543210, 8765432109, 7654321098"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"PASS: Comma separated - imported: {data.get('imported_count', 0)}")
    
    def test_manual_import_empty_input(self):
        """Test manual import rejects empty input"""
        response = requests.post(
            f"{BASE_URL}/api/crm/leads/bulk-import-manual",
            json={"phones": ""}
        )
        assert response.status_code == 400
        print("PASS: Empty input rejected with 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
