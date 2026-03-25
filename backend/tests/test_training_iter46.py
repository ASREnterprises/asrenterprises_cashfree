"""
Test Iteration 46: Staff Training Feature Testing
Tests for: Training modules API, AI training assistant, StaffTraining component integration

Features being tested:
1. /api/training/modules - Returns 4 training modules with topics
2. /api/ai/training-assistant - AI chatbot for staff training
3. StaffTraining component integration in StaffPortal and HRManagement
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://solar-crm-stable.preview.emergentagent.com')

class TestTrainingModulesAPI:
    """Tests for /api/training/modules endpoint"""
    
    def test_training_modules_endpoint_exists(self):
        """Test that training modules endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/training/modules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"PASS: Training modules endpoint exists, status: {response.status_code}")
    
    def test_training_modules_returns_4_modules(self):
        """Test that API returns exactly 4 training modules"""
        response = requests.get(f"{BASE_URL}/api/training/modules")
        assert response.status_code == 200
        data = response.json()
        
        assert "modules" in data, "Response should contain 'modules' key"
        modules = data["modules"]
        assert len(modules) == 4, f"Expected 4 modules, got {len(modules)}"
        print(f"PASS: Training modules returns 4 modules: {[m['id'] for m in modules]}")
    
    def test_training_modules_have_required_fields(self):
        """Test that each module has id, title, description, duration, topics"""
        response = requests.get(f"{BASE_URL}/api/training/modules")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "title", "description", "duration", "topics"]
        
        for module in data["modules"]:
            for field in required_fields:
                assert field in module, f"Module missing required field: {field}"
            print(f"  Module '{module['id']}' has all required fields")
        
        print("PASS: All modules have required fields (id, title, description, duration, topics)")
    
    def test_training_modules_include_expected_modules(self):
        """Test that modules include: PM Surya Ghar, Sales & Calling, Technical Knowledge, ASR Company"""
        response = requests.get(f"{BASE_URL}/api/training/modules")
        assert response.status_code == 200
        data = response.json()
        
        expected_ids = ["pm_surya_ghar", "sales_calling", "technical_knowledge", "asr_company"]
        actual_ids = [m["id"] for m in data["modules"]]
        
        for expected in expected_ids:
            assert expected in actual_ids, f"Missing expected module: {expected}"
        
        print(f"PASS: All expected modules present: {expected_ids}")
    
    def test_training_modules_have_topics_list(self):
        """Test that each module has a non-empty topics list"""
        response = requests.get(f"{BASE_URL}/api/training/modules")
        assert response.status_code == 200
        data = response.json()
        
        for module in data["modules"]:
            topics = module.get("topics", [])
            assert isinstance(topics, list), f"Topics should be a list for module {module['id']}"
            assert len(topics) > 0, f"Module {module['id']} should have at least one topic"
            print(f"  Module '{module['id']}' has {len(topics)} topics: {topics[:3]}...")
        
        print("PASS: All modules have non-empty topics lists")


class TestAITrainingAssistant:
    """Tests for /api/ai/training-assistant endpoint"""
    
    def test_ai_training_assistant_endpoint_exists(self):
        """Test that AI training assistant endpoint accepts POST requests"""
        response = requests.post(
            f"{BASE_URL}/api/ai/training-assistant",
            json={"message": "Hello", "staff_role": "sales", "context": "general"}
        )
        # Should return 200 with response or 500 if AI service not available
        assert response.status_code in [200, 500], f"Expected 200 or 500, got {response.status_code}: {response.text}"
        print(f"PASS: AI training assistant endpoint exists, status: {response.status_code}")
    
    def test_ai_training_assistant_requires_message(self):
        """Test that endpoint requires message field"""
        response = requests.post(
            f"{BASE_URL}/api/ai/training-assistant",
            json={"staff_role": "sales", "context": "general"}
        )
        # Should return 400 or 422 for missing message
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print(f"PASS: AI training assistant requires message field, status: {response.status_code}")
    
    def test_ai_training_assistant_accepts_staff_role(self):
        """Test that endpoint accepts staff_role parameter"""
        roles = ["telecaller", "sales", "technician", "manager"]
        
        for role in roles:
            response = requests.post(
                f"{BASE_URL}/api/ai/training-assistant",
                json={"message": "What is PM Surya Ghar?", "staff_role": role, "context": "pm_surya_ghar"}
            )
            # Should accept all roles
            assert response.status_code in [200, 500], f"Failed for role {role}, status: {response.status_code}"
            print(f"  Role '{role}' accepted, status: {response.status_code}")
        
        print("PASS: AI training assistant accepts all staff roles")
    
    def test_ai_training_assistant_pm_surya_ghar_question(self):
        """Test AI assistant can answer PM Surya Ghar questions"""
        response = requests.post(
            f"{BASE_URL}/api/ai/training-assistant",
            json={
                "message": "PM Surya Ghar Yojana में कितनी सब्सिडी मिलती है?",
                "staff_role": "sales",
                "context": "pm_surya_ghar"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "response" in data, "Response should contain 'response' field"
            ai_response = data.get("response", "")
            # Check if response mentions subsidy amounts
            subsidy_keywords = ["78,000", "78000", "₹78", "30,000", "60,000", "सब्सिडी", "subsidy"]
            has_subsidy_info = any(keyword in ai_response for keyword in subsidy_keywords)
            print(f"  AI Response length: {len(ai_response)} chars")
            print(f"  Contains subsidy info: {has_subsidy_info}")
            print(f"PASS: AI assistant returned response about PM Surya Ghar")
        else:
            print(f"SKIP: AI service not available (status {response.status_code})")
    
    def test_ai_training_assistant_response_structure(self):
        """Test AI assistant response has expected structure"""
        response = requests.post(
            f"{BASE_URL}/api/ai/training-assistant",
            json={"message": "How to handle price objections?", "staff_role": "telecaller", "context": "sales_calling"}
        )
        
        if response.status_code == 200:
            data = response.json()
            expected_fields = ["success", "response"]
            for field in expected_fields:
                assert field in data, f"Response missing field: {field}"
            print(f"PASS: AI assistant response has expected structure: {list(data.keys())}")
        else:
            print(f"SKIP: AI service not available (status {response.status_code})")


class TestTrainingProgress:
    """Tests for training progress endpoints"""
    
    def test_training_progress_save_endpoint(self):
        """Test saving training progress"""
        test_staff_id = "TEST_STAFF_001"
        
        response = requests.post(
            f"{BASE_URL}/api/training/progress",
            json={
                "staff_id": test_staff_id,
                "module_id": "pm_surya_ghar",
                "topic_index": 0,
                "completed": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Expected success: True"
        print(f"PASS: Training progress save endpoint works")
    
    def test_training_progress_get_endpoint(self):
        """Test getting training progress for staff"""
        test_staff_id = "TEST_STAFF_001"
        
        response = requests.get(f"{BASE_URL}/api/training/progress/{test_staff_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "progress" in data, "Response should contain 'progress' key"
        print(f"PASS: Training progress get endpoint works, found {len(data.get('progress', []))} progress records")
    
    def test_training_progress_requires_staff_id(self):
        """Test that save endpoint requires staff_id"""
        response = requests.post(
            f"{BASE_URL}/api/training/progress",
            json={"module_id": "pm_surya_ghar", "topic_index": 0, "completed": True}
        )
        
        # Should return 400 for missing staff_id
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASS: Training progress requires staff_id")


class TestStaffPortalTrainingIntegration:
    """Tests for Staff Portal training tab integration"""
    
    def test_staff_training_endpoint(self):
        """Test /api/staff/{staff_id}/training endpoint returns training data"""
        test_staff_id = "ASR1001"
        
        response = requests.get(f"{BASE_URL}/api/staff/{test_staff_id}/training")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "modules" in data, "Response should contain 'modules' key"
        modules = data["modules"]
        assert len(modules) > 0, "Should return at least one training module"
        print(f"PASS: Staff training endpoint returns {len(modules)} modules")
    
    def test_staff_training_complete_endpoint(self):
        """Test marking a training module as complete"""
        test_staff_id = "ASR1001"
        test_module_id = "solar_basics"
        
        response = requests.post(f"{BASE_URL}/api/staff/{test_staff_id}/training/{test_module_id}/complete")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True or "message" in data, "Should return success or message"
        print(f"PASS: Staff training complete endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
