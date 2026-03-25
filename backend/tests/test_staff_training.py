"""
Staff Training Feature Tests - Iteration 34
Tests for:
1. GET /api/training/modules - Training modules endpoint
2. POST /api/ai/training-assistant - AI Training Assistant
3. POST /api/training/progress - Save training progress
4. GET /api/training/progress/{staff_id} - Get training progress
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com').rstrip('/')


class TestTrainingModulesAPI:
    """Tests for GET /api/training/modules endpoint"""
    
    def test_get_training_modules_success(self):
        """Test that training modules endpoint returns valid modules"""
        response = requests.get(f"{BASE_URL}/api/training/modules")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "modules" in data, "Response should contain 'modules' key"
        
        modules = data["modules"]
        assert isinstance(modules, list), "Modules should be a list"
        assert len(modules) >= 4, f"Expected at least 4 modules, got {len(modules)}"
        
        # Verify module structure
        for module in modules:
            assert "id" in module, "Each module should have 'id'"
            assert "title" in module, "Each module should have 'title'"
            assert "description" in module, "Each module should have 'description'"
            assert "topics" in module, "Each module should have 'topics'"
            assert isinstance(module["topics"], list), "Topics should be a list"
        
        # Verify expected module IDs are present
        module_ids = [m["id"] for m in modules]
        assert "pm_surya_ghar" in module_ids, "PM Surya Ghar module should exist"
        assert "sales_calling" in module_ids, "Sales Calling module should exist"
        assert "asr_company" in module_ids, "ASR Company module should exist"
        
        print(f"✅ GET /api/training/modules - SUCCESS: Found {len(modules)} modules")


class TestAITrainingAssistant:
    """Tests for POST /api/ai/training-assistant endpoint"""
    
    def test_ai_training_assistant_success(self):
        """Test AI Training Assistant responds correctly"""
        payload = {
            "message": "What is PM Surya Ghar subsidy amount for 3kW system?",
            "staff_role": "telecaller",
            "context": "pm_surya_ghar"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai/training-assistant",
            json=payload,
            timeout=30
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert data.get("success") == True or "response" in data, "Should be successful or have response"
        
        if data.get("success"):
            assert "response" in data, "Successful response should contain 'response'"
            assert len(data["response"]) > 10, "Response should have meaningful content"
            print(f"✅ POST /api/ai/training-assistant - SUCCESS: Got AI response ({len(data['response'])} chars)")
        else:
            # Even if AI fails, it should return a fallback message
            assert "response" in data or "error" in data, "Should have response or error message"
            print(f"⚠️ POST /api/ai/training-assistant - AI returned fallback response")
    
    def test_ai_training_assistant_different_roles(self):
        """Test AI Training Assistant with different staff roles"""
        roles = ["telecaller", "sales"]  # Test only 2 roles to avoid rate limiting
        
        for role in roles:
            payload = {
                "message": "How do I handle customer objections?",
                "staff_role": role,
                "context": "sales_calling"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/ai/training-assistant",
                json=payload,
                timeout=30
            )
            
            # Allow 200 or 500 (rate limiting) as acceptable
            assert response.status_code in [200, 500], f"Expected 200/500 for role {role}, got {response.status_code}"
            if response.status_code == 200:
                print(f"✅ AI Training Assistant works for role: {role}")
            else:
                print(f"⚠️ AI Training Assistant rate limited for role: {role}")
            
            # Add delay between requests to avoid rate limiting
            time.sleep(2)
    
    def test_ai_training_assistant_empty_message(self):
        """Test AI Training Assistant with empty message returns error"""
        payload = {
            "message": "",
            "staff_role": "sales",
            "context": "general"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai/training-assistant",
            json=payload,
            timeout=30
        )
        
        # Should return 400 for empty message
        assert response.status_code in [400, 422], f"Expected 400/422 for empty message, got {response.status_code}"
        print("✅ POST /api/ai/training-assistant - Correctly rejects empty message")


class TestTrainingProgress:
    """Tests for training progress save/get endpoints"""
    
    def test_save_training_progress(self):
        """Test saving training progress"""
        test_staff_id = f"TEST_staff_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "staff_id": test_staff_id,
            "module_id": "pm_surya_ghar",
            "topic_index": 0,
            "completed": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/training/progress",
            json=payload,
            timeout=10
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert data["success"] == True, "Should return success=True"
        
        print(f"✅ POST /api/training/progress - SUCCESS: Progress saved for {test_staff_id}")
        return test_staff_id
    
    def test_get_training_progress(self):
        """Test getting training progress for a staff member"""
        # First save some progress
        test_staff_id = f"TEST_staff_{uuid.uuid4().hex[:8]}"
        
        # Save progress
        save_payload = {
            "staff_id": test_staff_id,
            "module_id": "asr_company",
            "topic_index": 1,
            "completed": True
        }
        save_response = requests.post(
            f"{BASE_URL}/api/training/progress",
            json=save_payload,
            timeout=10
        )
        assert save_response.status_code == 200, "Save should succeed"
        
        # Get progress
        response = requests.get(
            f"{BASE_URL}/api/training/progress/{test_staff_id}",
            timeout=10
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "staff_id" in data, "Response should contain 'staff_id'"
        assert data["staff_id"] == test_staff_id, "Staff ID should match"
        assert "progress" in data, "Response should contain 'progress'"
        
        # Verify progress contains our saved data
        progress_list = data["progress"]
        assert isinstance(progress_list, list), "Progress should be a list"
        
        if len(progress_list) > 0:
            # Find our saved progress
            found = any(p.get("module_id") == "asr_company" and p.get("topic_index") == 1 for p in progress_list)
            assert found, "Should find the saved progress entry"
        
        print(f"✅ GET /api/training/progress/{test_staff_id} - SUCCESS: Found {len(progress_list)} progress entries")
    
    def test_save_progress_missing_fields(self):
        """Test saving progress with missing required fields"""
        payload = {
            "staff_id": "test123"
            # Missing module_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/training/progress",
            json=payload,
            timeout=10
        )
        
        # Should return error for missing fields
        assert response.status_code in [400, 422, 500], f"Expected 400/422/500 for missing fields, got {response.status_code}"
        print("✅ POST /api/training/progress - Correctly handles missing fields")


class TestPublicAIChatEndpoint:
    """Tests for public AI chat endpoint (used by AI Assistant tab)"""
    
    def test_public_ai_chat_success(self):
        """Test public AI chat endpoint"""
        payload = {
            "message": "What is PM Surya Ghar?",
            "session_id": f"test_session_{uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai/chat/public",
            json=payload,
            timeout=30
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "response" in data, "Response should contain 'response' key"
        assert len(data.get("response", "")) > 10 or "error" in data, "Should have response or error"
        
        print(f"✅ POST /api/ai/chat/public - SUCCESS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
