"""Tests for ASR1002 (Anamika) admin-manager access.

Verifies:
1. The seeded HR + CRM staff records exist with department=admin, role=manager.
2. /api/admin/login-otp with Anamika's mobile returns role=manager AND
   department=admin so the frontend routes her to the Admin Dashboard.
3. The owner mobile still returns role=admin.
4. A fresh non-admin staff returns a non-admin role.
5. The frontend routing rule (role==admin OR role==manager+dept==admin) and
   the AdminDashboard manager whitelist match the documented spec.
"""
import os
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", f"asr_test_{os.getpid()}")
os.environ.setdefault("USE_IN_MEMORY_MONGO", "true")
os.environ.setdefault(
    "MONGO_SNAPSHOT_PATH",
    str(Path(__file__).resolve().parent / "_snap_anamika.json"),
)
# Use a unique snapshot path so this test never reads/writes the dev snapshot.
snap = Path(os.environ["MONGO_SNAPSHOT_PATH"])
if snap.exists():
    snap.unlink()

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
    # cleanup snapshot file the test produced
    if snap.exists():
        snap.unlink()


def test_anamika_seeded_in_hr(client):
    res = client.get("/api/hr/employees")
    assert res.status_code == 200
    employees = res.json().get("employees", [])
    anamika = next((e for e in employees if e.get("employee_id") == "ASR1002"), None)
    assert anamika is not None, "Anamika ASR1002 must be auto-seeded"
    assert anamika["name"] == "Anamika"
    assert anamika["department"] == "admin"
    assert anamika["role"] == "manager"
    assert anamika["is_active"] is True


def test_anamika_login_otp_returns_admin_manager(client):
    res = client.post(
        "/api/admin/login-otp",
        json={"mobile": "9999900002", "login_type": "staff"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["staff_id"] == "ASR1002"
    assert body["role"] == "manager"
    assert body["department"] == "admin"


def test_owner_login_otp_returns_admin(client):
    res = client.post(
        "/api/admin/login-otp",
        json={"mobile": "8877896889", "login_type": "staff"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["role"] == "admin"
    assert body["staff_id"] == "ASR1001"


def test_unregistered_mobile_rejected(client):
    res = client.post(
        "/api/admin/login-otp",
        json={"mobile": "9999999999", "login_type": "staff"},
    )
    assert res.status_code == 401


def test_admin_login_email_locked_to_owner(client):
    # Anamika's email must not be allowed through the admin password endpoint
    res = client.post(
        "/api/admin/login-password",
        json={"user_id": "analnikarathod1905@gmail.com", "password": "anamika@123"},
    )
    assert res.status_code == 401


def test_anamika_staff_email_login_succeeds(client):
    res = client.post(
        "/api/staff/login-email",
        json={"email": "analnikarathod1905@gmail.com", "password": "anamika@123"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["staff"]["staff_id"] == "ASR1002"
    assert body["staff"]["role"] == "manager"
    assert body["staff"]["department"] == "admin"


def test_settings_tab_hidden_for_admin_manager_in_whatsapp_and_social():
    """WhatsAppCRM and SocialMediaManager must hide the Settings tab when
    role==manager and department==admin (Anamika)."""
    base = Path(__file__).resolve().parents[2] / "frontend" / "src" / "components"
    for fname in ("WhatsAppCRM.js", "SocialMediaManager.js"):
        src = (base / fname).read_text(encoding="utf-8")
        assert "asrAdminRole" in src and "asrAdminDepartment" in src, (
            f"{fname} must read role/department from localStorage to gate Settings"
        )
        assert re.search(
            r"isAdminManager\s*&&\s*t\.id\s*===\s*['\"]settings['\"]",
            src,
        ), f"{fname} must filter the 'settings' tab for admin-managers"


def test_frontend_admin_manager_whitelist():
    """AdminDashboard must show only the requested modules for an
    Admin-Department Manager (Anamika) and hide ASR CRM, Shop Management,
    HR Management and Security Center."""
    path = Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "AdminDashboard.js"
    src = path.read_text(encoding="utf-8")
    m = re.search(r"ALLOWED_FOR_MANAGER\s*=\s*\[(.*?)\]", src, re.S)
    assert m, "ALLOWED_FOR_MANAGER list missing"
    items = {s.strip().strip('"').strip("'") for s in m.group(1).split(",") if s.strip()}

    must_have = {
        "Leads Management",
        "Customer Portal",
        "Social Media",
        "Gallery",
        "Testimonials",
        "Festival Posts",
        "WhatsApp API",
        "Solar Advisors",
    }
    must_not_have = {"CRM System", "Shop Management", "HR Management", "Security Center"}

    assert must_have.issubset(items), f"Missing modules: {must_have - items}"
    assert not (items & must_not_have), f"Forbidden modules present: {items & must_not_have}"


def test_frontend_staff_login_redirects_admin_manager_to_dashboard():
    """StaffLogin.js must route role==admin OR role==manager+dept==admin
    to /admin/dashboard, otherwise to /staff/portal."""
    path = Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "StaffLogin.js"
    src = path.read_text(encoding="utf-8")
    # The decisive predicate must exist
    assert re.search(
        r'role\s*===\s*"admin".*role\s*===\s*"manager".*dept\s*===\s*"admin"',
        src,
        re.S,
    ), "Admin-manager redirect rule missing in StaffLogin.js"
    # Admin auth keys must be set when redirecting to admin dashboard
    assert 'localStorage.setItem("asrAdminAuth", "true")' in src
    assert 'localStorage.setItem("asrAdminRole"' in src
    assert 'localStorage.setItem("asrAdminDepartment"' in src
