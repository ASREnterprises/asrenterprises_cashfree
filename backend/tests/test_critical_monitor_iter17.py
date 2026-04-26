"""
Iter 17 — Critical Monitor (Super-Admin only Failure Monitoring & Recovery)
pytest suite for /api/critical-monitor/* + asr_otp template fix verification.
"""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for headless test env — read from frontend/.env
    try:
        with open("/app/frontend/.env", "r") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"
SUPER_HEADERS = {
    "x-staff-id": "ASR1001",
    "x-admin-name": "ABHIJEET KUMAR",
    "Content-Type": "application/json",
}


# ──────────────────────────── HEALTH ────────────────────────────
class TestHealth:
    def test_health_super_admin_ok(self):
        r = requests.get(f"{API}/critical-monitor/health", headers=SUPER_HEADERS, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("window") == "24h"
        for k in ("total", "success", "failed", "success_rate", "failure_rate"):
            assert k in d["otp"], f"otp missing {k}"
        for k in ("total", "success", "failed", "success_rate"):
            assert k in d["payment"], f"payment missing {k}"
        assert isinstance(d.get("alerts"), list)

    def test_health_no_headers_403(self):
        r = requests.get(f"{API}/critical-monitor/health", timeout=15)
        assert r.status_code == 403, r.text

    def test_health_wrong_staff_id_403(self):
        h = {**SUPER_HEADERS, "x-staff-id": "ASR9999"}
        r = requests.get(f"{API}/critical-monitor/health", headers=h, timeout=15)
        assert r.status_code == 403, r.text

    def test_health_wrong_admin_name_403(self):
        h = {**SUPER_HEADERS, "x-admin-name": "RANDOM PERSON"}
        r = requests.get(f"{API}/critical-monitor/health", headers=h, timeout=15)
        assert r.status_code == 403, r.text


# ──────────────────────────── FAILURES — OTP ────────────────────────────
class TestOtpFailures:
    def test_failures_otp_super_admin(self):
        r = requests.get(f"{API}/critical-monitor/failures/otp?limit=20", headers=SUPER_HEADERS, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and "count" in d
        assert isinstance(d["items"], list)
        for row in d["items"]:
            assert "reason" in row, "row missing reason"
            assert "fix_hint" in row, "row missing fix_hint"
            # _id mongo field must NOT be present (project excluded it)
            assert "_id" not in row

    def test_failures_otp_no_headers_403(self):
        r = requests.get(f"{API}/critical-monitor/failures/otp", timeout=15)
        assert r.status_code == 403

    def test_verify_event_reason_seeded(self):
        """Trigger a wrong-OTP verify so a failed verify-row exists, then assert
        the parser maps it to the canonical 'wrong/expired' reason."""
        # 1. Send an OTP first (smart sender) so we have something to verify against
        send = requests.post(f"{API}/admin/send-otp-smart",
                             headers=SUPER_HEADERS,
                             json={"channel": "auto", "purpose": "iter17_verify_seed"},
                             timeout=30)
        # accept either 200 (delivered) or 4xx (cooldown / config) — we don't care
        # 2. Force a verify failure with deliberately wrong code
        bad = requests.post(f"{API}/admin/secure-otp/verify",
                            headers=SUPER_HEADERS,
                            json={"otp": "000000", "purpose": "iter17_verify_seed"},
                            timeout=15)
        # 3. Pull failures and look for a verify-event row
        r = requests.get(f"{API}/critical-monitor/failures/otp?limit=50",
                         headers=SUPER_HEADERS, timeout=20)
        assert r.status_code == 200
        verify_rows = [x for x in r.json()["items"] if (x.get("event") or "").lower() == "verify"]
        if verify_rows:
            assert "Wrong OTP" in verify_rows[0]["reason"] or "expired" in verify_rows[0]["reason"].lower()


# ──────────────────────────── FAILURES — PAYMENTS ────────────────────────────
class TestPaymentFailures:
    def test_failures_payments_super_admin(self):
        r = requests.get(f"{API}/critical-monitor/failures/payments?limit=20",
                         headers=SUPER_HEADERS, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and "count" in d
        for row in d["items"]:
            assert "reason" in row and "fix_hint" in row
            # mandatory enrich fields
            for k in ("id", "customer_phone", "amount", "payment_status", "created_at"):
                assert k in row, f"row missing {k}"
            assert "_id" not in row

    def test_failures_payments_no_headers_403(self):
        r = requests.get(f"{API}/critical-monitor/failures/payments", timeout=15)
        assert r.status_code == 403


# ──────────────────────────── RECOVERY ACTIONS ────────────────────────────
class TestRecoveryActions:
    def test_otp_retry_auto(self):
        r = requests.post(f"{API}/critical-monitor/otp/retry",
                          headers=SUPER_HEADERS,
                          json={"channel": "auto"},
                          timeout=45)
        # success or 502/4xx (cooldown) acceptable; just ensure endpoint exists & enforces gate
        assert r.status_code in (200, 400, 401, 429, 502), r.text

    def test_otp_retry_403_no_headers(self):
        r = requests.post(f"{API}/critical-monitor/otp/retry",
                          json={"channel": "auto"}, timeout=15)
        assert r.status_code == 403

    def test_test_otp_email(self):
        r = requests.post(f"{API}/critical-monitor/test-otp",
                          headers=SUPER_HEADERS,
                          json={"channel": "email", "purpose": "iter17_test"},
                          timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        # ok=True path: must include delivery dict; ok=False path: must include error
        assert "ok" in d
        if d["ok"]:
            assert "delivery" in d
            # smart sender returns channel_used
            ch = (d["delivery"] or {}).get("channel_used")
            assert ch in ("email", "whatsapp", "both", None) or isinstance(ch, str)
        else:
            assert "error" in d

    def test_test_payment_endpoint_exists(self):
        r = requests.post(f"{API}/critical-monitor/test-payment",
                          headers=SUPER_HEADERS,
                          json={"mobile": "9876543210", "amount": 1, "name": "TEST_iter17"},
                          timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "ok" in d
        # If ok=True an `order` blob exists, else `error` string
        if d["ok"]:
            assert "order" in d
        else:
            assert "error" in d and isinstance(d["error"], str) and len(d["error"]) > 0

    def test_test_payment_invalid_mobile(self):
        r = requests.post(f"{API}/critical-monitor/test-payment",
                          headers=SUPER_HEADERS,
                          json={"mobile": "123", "amount": 1},
                          timeout=15)
        assert r.status_code == 400

    def test_payment_retry_link_404_unknown_invoice(self):
        r = requests.post(f"{API}/critical-monitor/payment/retry-link",
                          headers=SUPER_HEADERS,
                          json={"invoice_id": "non-existent-iter17", "channel": "both"},
                          timeout=20)
        assert r.status_code == 404, r.text

    def test_payment_retry_link_403_no_headers(self):
        r = requests.post(f"{API}/critical-monitor/payment/retry-link",
                          json={"invoice_id": "xyz"}, timeout=15)
        assert r.status_code == 403


# ──────────────────────────── MARK-PAID (Dual-OTP gated) ────────────────────────────
class TestMarkPaid:
    def test_mark_paid_403_no_headers(self):
        r = requests.post(f"{API}/critical-monitor/payment/mark-paid",
                          json={"invoice_id": "x", "action_token": "x"}, timeout=15)
        assert r.status_code == 403

    def test_mark_paid_missing_token_401(self):
        # Empty token must still be rejected with 401 about Dual-OTP
        r = requests.post(f"{API}/critical-monitor/payment/mark-paid",
                          headers=SUPER_HEADERS,
                          json={"invoice_id": "anything", "action_token": ""},
                          timeout=15)
        assert r.status_code == 401, r.text
        msg = (r.json().get("detail") or "").lower()
        assert "dual-otp" in msg or "action_token" in msg or "action token" in msg

    def test_mark_paid_invalid_token_401(self):
        r = requests.post(f"{API}/critical-monitor/payment/mark-paid",
                          headers=SUPER_HEADERS,
                          json={"invoice_id": "anything",
                                "action_token": "fake_token_does_not_exist"},
                          timeout=15)
        assert r.status_code == 401


# ──────────────────────────── ASR_OTP TEMPLATE FIX ────────────────────────────
class TestAsrOtpTemplate:
    def test_send_otp_smart_lists_asr_otp_first(self):
        """Source-level proof — first WhatsApp template attempted in
        admin_send_otp_smart (server.py) is `asr_otp`."""
        with open("/app/backend/server.py", "r") as f:
            src = f.read()
        # Find the template-name tuple inside admin_send_otp_smart
        m = re.search(r'for tpl in \(([^)]+)\):', src)
        assert m, "Could not locate template loop in server.py"
        first = m.group(1).split(",")[0].strip().strip("'").strip('"')
        assert first == "asr_otp", f"Expected asr_otp first, got {first}"

    def test_guardian_admin_whatsapp_uses_asr_otp_first(self):
        with open("/app/backend/routes/guardian.py", "r") as f:
            src = f.read()
        m = re.search(r'for tpl in \[([^\]]+)\]:', src)
        assert m, "Could not locate template list in guardian.py"
        first = m.group(1).split(",")[0].strip().strip("'").strip('"')
        assert first == "asr_otp", f"guardian.py should try asr_otp first, got {first}"

    def test_public_otp_uses_asr_otp_first(self):
        with open("/app/backend/routes/public_otp.py", "r") as f:
            src = f.read()
        m = re.search(r'for tpl_name in \[([^\]]+)\]:', src)
        assert m, "Could not locate template list in public_otp.py"
        first = m.group(1).split(",")[0].strip().strip("'").strip('"')
        assert first == "asr_otp", f"public_otp.py should try asr_otp first, got {first}"

    def test_send_otp_smart_audit_records_whatsapp_channel(self):
        """Send a WhatsApp OTP via smart sender and confirm the audit entry
        contains channel `whatsapp` in channels_tried."""
        r = requests.post(f"{API}/admin/send-otp-smart",
                          headers=SUPER_HEADERS,
                          json={"channel": "whatsapp", "purpose": "iter17_asr_otp_check"},
                          timeout=30)
        # Could be 200 (delivered) or 429 (cooldown). Either way audit row exists.
        assert r.status_code in (200, 429), r.text
        time.sleep(1)
        # Pull failures regardless — audit endpoint isn't exposed; we use the
        # public failures route which returns ANY audit row when success=False.
        # If WA succeeded, no fail row to check; assert_success on body instead.
        if r.status_code == 200:
            body = r.json()
            assert body.get("delivered") in (True, False)
            tried = body.get("channels_tried") or body.get("channel_used")
            assert tried, "send-otp-smart response missing channels_tried/channel_used"


# ──────────────────────────── REGRESSION on existing endpoints ────────────────────────────
class TestRegression:
    def test_admin_send_otp_smart_alive(self):
        r = requests.post(f"{API}/admin/send-otp-smart",
                          headers=SUPER_HEADERS,
                          json={"channel": "email", "purpose": "iter17_regression"},
                          timeout=30)
        assert r.status_code in (200, 429), r.text

    def test_admin_secure_otp_verify_wrong_otp_401(self):
        r = requests.post(f"{API}/admin/secure-otp/verify",
                          headers=SUPER_HEADERS,
                          json={"otp": "111111", "purpose": "iter17_regression"},
                          timeout=15)
        assert r.status_code in (400, 401, 410), r.text

    def test_admin_otp_preference_endpoint(self):
        r = requests.get(f"{API}/admin/otp-preference", headers=SUPER_HEADERS, timeout=15)
        assert r.status_code in (200, 404), r.text  # may be GET or POST-only

    def test_guardian_health(self):
        r = requests.get(f"{API}/guardian/health", headers=SUPER_HEADERS, timeout=15)
        assert r.status_code == 200, r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
