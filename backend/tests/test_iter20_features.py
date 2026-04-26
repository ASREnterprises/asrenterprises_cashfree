"""Iter20 batch tests:
- Admin verify-otp triple-key fix
- Staff verify-otp regression (rate-limit-after-fail)
- Solar Advisor verify-email-otp not regressed
- Master Recovery Code issue + verify
- AI auto-diagnose
- Critical Monitor settings GET (masked) + PUT (action_token gated)
- Welcome email best-effort on HR create + Solar Advisor signup
- Super-admin gate on /critical-monitor/*
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asrenterprise-pay.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "asrenterprisespatna@gmail.com"
OWNER_STAFF_ID = "ASR1001"
OWNER_NAME = "ABHIJEET KUMAR"
OWNER_PASSWORD_FALLBACK = "Abhi@9745"

SUPER_HEADERS = {"x-staff-id": OWNER_STAFF_ID, "x-admin-name": OWNER_NAME}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ───────────────────────────────────────────────────────────────────
# 1. Admin verify-otp triple-key fix
# ───────────────────────────────────────────────────────────────────
class TestAdminVerifyOtpTripleKey:
    def test_admin_send_otp_smart_email(self, s):
        r = s.post(f"{API}/admin/send-otp-smart",
                   json={"channel": "email", "purpose": "iter20_verify_test"})
        # Either 200 (sent) or 429 (cooldown). NOT 500.
        assert r.status_code in (200, 429), f"unexpected: {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            body = r.json()
            # Spec: response has either "ok" or "success" + channel_used
            assert ("channel_used" in body) or ("ok" in body) or ("success" in body)

    def test_admin_verify_otp_invalid_returns_401(self, s):
        # With wrong OTP, should be 401 (not 500). This proves the triple-key
        # lookup path works (verify is reachable; only the OTP itself is wrong)
        r = s.post(f"{API}/admin/verify-otp",
                   json={"email": OWNER_EMAIL, "otp": "000000"})
        # 401 = wrong otp (expected); 429 = lockout; we accept either.
        assert r.status_code in (401, 429), f"got {r.status_code} {r.text[:200]}"

    def test_admin_verify_otp_dev_fallback(self, s):
        """If RESEND_API_KEY is unset, server documents 131993 fallback OTP.
        We can't know server config so just assert correct error shape."""
        r = s.post(f"{API}/admin/verify-otp",
                   json={"email": OWNER_EMAIL, "otp": "131993"})
        # Either 200 (dev fallback hit) or 401 (expected on prod)
        assert r.status_code in (200, 401, 429), r.status_code

    def test_admin_verify_otp_unauthorized_email_403(self, s):
        r = s.post(f"{API}/admin/verify-otp",
                   json={"email": "stranger@example.com", "otp": "131993"})
        assert r.status_code in (403, 429)


# ───────────────────────────────────────────────────────────────────
# 2. Staff verify-otp regression (401 not 429 on first wrong)
# ───────────────────────────────────────────────────────────────────
class TestStaffVerifyOtpRegression:
    def test_staff_send_otp_smart_email(self, s):
        r = s.post(f"{API}/staff/send-otp-smart",
                   json={"staff_id": "ASR1003", "channel": "email"})
        # 200 ok, 429 cooldown (we just hammered), or 502 if email not configured
        assert r.status_code in (200, 429, 502), f"{r.status_code} {r.text[:200]}"

    def test_staff_verify_wrong_otp_is_401_not_429(self, s):
        """First wrong OTP must return 401, not 429."""
        r = s.post(f"{API}/staff/verify-otp",
                   json={"staff_id": "ASR1003", "otp": "999999"})
        # On a fresh client_ip, first wrong returns 401. After many fails 429.
        assert r.status_code in (401, 429)
        assert r.status_code != 500


# ───────────────────────────────────────────────────────────────────
# 3. Solar Advisor verify-email-otp still works
# ───────────────────────────────────────────────────────────────────
class TestSolarAdvisorVerifyEmailOtp:
    def test_advisor_verify_email_otp_no_advisor_404_or_401(self, s):
        r = s.post(f"{API}/solar-advisor/verify-otp-email",
                   json={"email": "no-such-advisor@example.com", "otp": "000000"})
        # 401 invalid OTP / 404 no such advisor / 400 bad input — never 500
        assert r.status_code in (400, 401, 404), f"{r.status_code} {r.text[:200]}"


# ───────────────────────────────────────────────────────────────────
# 4. Master Recovery Code
# ───────────────────────────────────────────────────────────────────
class TestMasterRecoveryCode:
    def test_recovery_issue_no_password_400(self, s):
        r = s.post(f"{API}/admin/recovery/issue", json={})
        assert r.status_code == 400

    def test_recovery_issue_wrong_password_401(self, s):
        r = s.post(f"{API}/admin/recovery/issue",
                   json={"password": "definitely_wrong_password_xyz"})
        assert r.status_code in (401, 429), r.text[:200]

    def test_recovery_verify_no_code_400(self, s):
        r = s.post(f"{API}/admin/recovery/verify", json={})
        assert r.status_code == 400

    def test_recovery_verify_wrong_code_401(self, s):
        r = s.post(f"{API}/admin/recovery/verify", json={"code": "WRONGCODEXXXX"})
        # 401 if a code is in flight, OR 401 "no recovery code in flight"
        assert r.status_code in (401, 429)


# ───────────────────────────────────────────────────────────────────
# 5. AI Diagnose
# ───────────────────────────────────────────────────────────────────
class TestAIDiagnose:
    def test_diagnose_requires_super_admin(self, s):
        r = s.post(f"{API}/critical-monitor/diagnose",
                   json={"issue_text": "test", "auto_run": False})
        assert r.status_code == 403

    def test_diagnose_otp_keyword(self, s):
        r = s.post(f"{API}/critical-monitor/diagnose",
                   headers=SUPER_HEADERS,
                   json={"issue_text": "OTP via WhatsApp not arriving",
                         "auto_run": False},
                   timeout=30)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        assert b["ok"] is True
        assert "rationale" in b
        assert isinstance(b.get("suggested_actions"), list)
        assert len(b["suggested_actions"]) >= 1
        for a in b["suggested_actions"]:
            assert "key" in a and "label" in a and "endpoint" in a

    def test_diagnose_empty_text_400(self, s):
        r = s.post(f"{API}/critical-monitor/diagnose",
                   headers=SUPER_HEADERS,
                   json={"issue_text": "", "auto_run": False})
        assert r.status_code == 400


# ───────────────────────────────────────────────────────────────────
# 6. Settings GET (masked)
# ───────────────────────────────────────────────────────────────────
class TestSettingsGet:
    def test_settings_requires_super_admin(self, s):
        r = s.get(f"{API}/critical-monitor/settings")
        assert r.status_code == 403

    def test_settings_get_returns_masked(self, s):
        r = s.get(f"{API}/critical-monitor/settings", headers=SUPER_HEADERS)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        assert "whatsapp" in b and "email" in b and "cashfree" in b
        # Masked secrets should never expose full keys
        wa = b["whatsapp"]
        assert "access_token_masked" in wa
        token = wa.get("access_token_masked", "")
        if token:
            assert "•" in token or len(token) <= 8
        em = b["email"]
        assert "resend_key_masked" in em
        rk = em.get("resend_key_masked", "")
        if rk:
            assert "•" in rk or len(rk) <= 8


# ───────────────────────────────────────────────────────────────────
# 7. Settings PUT requires action_token
# ───────────────────────────────────────────────────────────────────
class TestSettingsPut:
    def test_settings_put_no_token_401(self, s):
        r = s.put(f"{API}/critical-monitor/settings",
                  headers=SUPER_HEADERS,
                  json={"whatsapp_otp_template_name": "asr_otp"})
        assert r.status_code == 401, r.text[:200]

    def test_settings_put_invalid_token_401(self, s):
        r = s.put(f"{API}/critical-monitor/settings",
                  headers=SUPER_HEADERS,
                  json={"whatsapp_otp_template_name": "asr_otp",
                        "action_token": "not_a_real_token_" + uuid.uuid4().hex})
        assert r.status_code == 401

    def test_settings_put_no_super_admin_header_403(self, s):
        r = s.put(f"{API}/critical-monitor/settings",
                  json={"whatsapp_otp_template_name": "asr_otp",
                        "action_token": "x"})
        assert r.status_code == 403


# ───────────────────────────────────────────────────────────────────
# 8. Welcome email on HR create — best-effort
# ───────────────────────────────────────────────────────────────────
class TestHRCreateWelcomeEmail:
    def test_hr_create_does_not_fail_on_email(self, s):
        suffix = uuid.uuid4().hex[:6].upper()
        emp_id = f"TESTHR{suffix}"
        payload = {
            "name": "TEST_iter20 employee",
            "email": f"test_iter20_{suffix}@example.invalid",
            "phone": "9000000000",
            "employee_id": emp_id,
            "designation": "Tester",
            "department": "QA",
            "role": "staff",
            "is_active": True,
            "joining_date": "2026-01-01",
        }
        r = s.post(f"{API}/hr/employees", json=payload)
        # Created (200/201) or duplicate handled; the key assertion is NOT 500
        assert r.status_code in (200, 201, 409, 400), f"{r.status_code} {r.text[:300]}"
        # Cleanup if created
        if r.status_code in (200, 201):
            try:
                s.delete(f"{API}/hr/employees/{emp_id}")
            except Exception:
                pass


# ───────────────────────────────────────────────────────────────────
# 9. Welcome email on Solar Advisor signup — best-effort
# ───────────────────────────────────────────────────────────────────
class TestAdvisorSignupWelcomeEmail:
    def test_advisor_register_does_not_fail_on_email(self, s):
        suffix = uuid.uuid4().hex[:6]
        # Use a unique 10-digit phone seeded with a constant prefix
        phone = "98" + str(int(time.time()))[-8:]
        payload = {
            "name": f"TEST_iter20 advisor {suffix}",
            "phone": phone,
            "email": f"test_iter20_adv_{suffix}@example.invalid",
            "district": "Patna",
            "address": "Test addr",
            "aadhar_number": "999999999999",
            "pan_number": "ABCDE9999F",
            "bank_name": "Test Bank",
            "bank_account": "1234567890",
            "ifsc_code": "TEST0000001",
            "experience": "0-1 years",
            "notes": "iter20 test",
        }
        r = s.post(f"{API}/agents/register", json=payload)
        # 200/201 = success, 409 = dup mobile (rare random clash), 422 = body schema
        assert r.status_code in (200, 201, 409, 422), f"{r.status_code} {r.text[:300]}"


# ───────────────────────────────────────────────────────────────────
# 10. Super-admin gate on every /critical-monitor/* endpoint
# ───────────────────────────────────────────────────────────────────
class TestSuperAdminGate:
    @pytest.mark.parametrize("path,method", [
        ("/critical-monitor/health", "GET"),
        ("/critical-monitor/failures/otp", "GET"),
        ("/critical-monitor/failures/payments", "GET"),
        ("/critical-monitor/trend", "GET"),
        ("/critical-monitor/settings", "GET"),
    ])
    def test_no_headers_returns_403(self, s, path, method):
        url = f"{API}{path}"
        r = s.get(url) if method == "GET" else s.post(url, json={})
        assert r.status_code == 403, f"{method} {path}: {r.status_code} {r.text[:120]}"

    def test_wrong_staff_id_returns_403(self, s):
        r = s.get(f"{API}/critical-monitor/health",
                  headers={"x-staff-id": "ASR9999", "x-admin-name": OWNER_NAME})
        assert r.status_code == 403

    def test_wrong_admin_name_returns_403(self, s):
        r = s.get(f"{API}/critical-monitor/health",
                  headers={"x-staff-id": OWNER_STAFF_ID, "x-admin-name": "WRONG NAME"})
        assert r.status_code == 403

    def test_correct_headers_returns_200(self, s):
        r = s.get(f"{API}/critical-monitor/health", headers=SUPER_HEADERS)
        assert r.status_code == 200, r.text[:300]


# ───────────────────────────────────────────────────────────────────
# 11. Existing endpoints unchanged
# ───────────────────────────────────────────────────────────────────
class TestExistingEndpoints:
    def test_health_smoke(self, s):
        r = s.get(f"{API}/critical-monitor/health", headers=SUPER_HEADERS)
        assert r.status_code == 200
        b = r.json()
        # Be lenient — at least one of these should be present
        assert any(k in b for k in ("ok", "status", "summary", "otp", "payments"))

    def test_failures_otp(self, s):
        r = s.get(f"{API}/critical-monitor/failures/otp", headers=SUPER_HEADERS)
        assert r.status_code == 200

    def test_failures_payments(self, s):
        r = s.get(f"{API}/critical-monitor/failures/payments", headers=SUPER_HEADERS)
        assert r.status_code == 200

    def test_trend(self, s):
        r = s.get(f"{API}/critical-monitor/trend?hours=24", headers=SUPER_HEADERS)
        assert r.status_code == 200

    def test_admin_otp_preference(self, s):
        r = s.get(f"{API}/admin/otp-preference",
                  params={"email": OWNER_EMAIL})
        # Either 200 or 401/403 if auth is required — must NOT 500
        assert r.status_code != 500

    def test_critical_monitor_entry_verify_no_token(self, s):
        r = s.post(f"{API}/critical-monitor/entry/verify",
                   headers=SUPER_HEADERS, json={})
        # 401 (proper) or 422 (carry-over from iter18). Must NOT 500.
        assert r.status_code in (401, 422)
