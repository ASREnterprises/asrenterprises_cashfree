"""
Backend API Tests for GitHub Mobile App
Tests: Health check, Auth endpoints, User endpoints, Repo endpoints, Search endpoints
"""
import pytest
import requests


class TestHealthCheck:
    """Health check endpoint test"""

    def test_health_endpoint(self, api_client, base_url):
        """Test GET /api/health returns status ok"""
        response = api_client.get(f"{base_url}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        assert data["status"] == "ok", f"Expected status 'ok', got {data.get('status')}"
        print("✓ Health check passed")


class TestAuth:
    """Authentication endpoint tests"""

    def test_login_with_invalid_token(self, api_client, base_url, invalid_token):
        """Test POST /api/auth/login with invalid token returns 401"""
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"token": invalid_token}
        )
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail' field"
        print(f"✓ Login with invalid token correctly returns 401: {data.get('detail')}")

    def test_login_with_empty_token(self, api_client, base_url):
        """Test POST /api/auth/login with empty token"""
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"token": ""}
        )
        # Should return 401 or 422 (validation error)
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
        print(f"✓ Login with empty token returns {response.status_code}")

    def test_login_missing_token_field(self, api_client, base_url):
        """Test POST /api/auth/login without token field"""
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={}
        )
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        print("✓ Login without token field returns 422 validation error")


class TestUserEndpoints:
    """User-related endpoint tests (require auth)"""

    def test_user_profile_without_auth(self, api_client, base_url):
        """Test GET /api/user/profile without Authorization header"""
        response = api_client.get(f"{base_url}/api/user/profile")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ User profile without auth returns 422")

    def test_user_profile_with_invalid_token(self, api_client, base_url, invalid_token):
        """Test GET /api/user/profile with invalid token"""
        response = api_client.get(
            f"{base_url}/api/user/profile",
            headers={"Authorization": f"token {invalid_token}"}
        )
        # Should return 401 or error from GitHub API
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ User profile with invalid token returns {response.status_code}")

    def test_user_repos_without_auth(self, api_client, base_url):
        """Test GET /api/user/repos without Authorization header"""
        response = api_client.get(f"{base_url}/api/user/repos")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ User repos without auth returns 422")

    def test_user_repos_with_invalid_token(self, api_client, base_url, invalid_token):
        """Test GET /api/user/repos with invalid token"""
        response = api_client.get(
            f"{base_url}/api/user/repos",
            headers={"Authorization": f"token {invalid_token}"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ User repos with invalid token returns {response.status_code}")


class TestRepoEndpoints:
    """Repository endpoint tests (require auth)"""

    def test_get_repo_without_auth(self, api_client, base_url):
        """Test GET /api/repos/{owner}/{repo} without auth"""
        response = api_client.get(f"{base_url}/api/repos/facebook/react")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Get repo without auth returns 422")

    def test_get_repo_with_invalid_token(self, api_client, base_url, invalid_token):
        """Test GET /api/repos/{owner}/{repo} with invalid token"""
        response = api_client.get(
            f"{base_url}/api/repos/facebook/react",
            headers={"Authorization": f"token {invalid_token}"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Get repo with invalid token returns {response.status_code}")

    def test_get_contents_without_auth(self, api_client, base_url):
        """Test GET /api/repos/{owner}/{repo}/contents without auth"""
        response = api_client.get(f"{base_url}/api/repos/facebook/react/contents")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Get contents without auth returns 422")

    def test_get_readme_without_auth(self, api_client, base_url):
        """Test GET /api/repos/{owner}/{repo}/readme without auth"""
        response = api_client.get(f"{base_url}/api/repos/facebook/react/readme")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Get readme without auth returns 422")

    def test_get_commits_without_auth(self, api_client, base_url):
        """Test GET /api/repos/{owner}/{repo}/commits without auth"""
        response = api_client.get(f"{base_url}/api/repos/facebook/react/commits")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Get commits without auth returns 422")

    def test_get_issues_without_auth(self, api_client, base_url):
        """Test GET /api/repos/{owner}/{repo}/issues without auth"""
        response = api_client.get(f"{base_url}/api/repos/facebook/react/issues")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Get issues without auth returns 422")

    def test_get_pulls_without_auth(self, api_client, base_url):
        """Test GET /api/repos/{owner}/{repo}/pulls without auth"""
        response = api_client.get(f"{base_url}/api/repos/facebook/react/pulls")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Get pulls without auth returns 422")


class TestSearchEndpoints:
    """Search endpoint tests (require auth)"""

    def test_search_repos_without_auth(self, api_client, base_url):
        """Test GET /api/search/repos without auth"""
        response = api_client.get(f"{base_url}/api/search/repos?q=react")
        assert response.status_code == 422, f"Expected 422 for missing auth, got {response.status_code}"
        print("✓ Search repos without auth returns 422")

    def test_search_repos_with_invalid_token(self, api_client, base_url, invalid_token):
        """Test GET /api/search/repos with invalid token"""
        response = api_client.get(
            f"{base_url}/api/search/repos?q=react",
            headers={"Authorization": f"token {invalid_token}"}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✓ Search repos with invalid token returns {response.status_code}")

    def test_search_repos_missing_query(self, api_client, base_url, invalid_token):
        """Test GET /api/search/repos without query parameter"""
        response = api_client.get(
            f"{base_url}/api/search/repos",
            headers={"Authorization": f"token {invalid_token}"}
        )
        assert response.status_code == 422, f"Expected 422 for missing query, got {response.status_code}"
        print("✓ Search repos without query param returns 422")
