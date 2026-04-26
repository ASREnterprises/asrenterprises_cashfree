"""Iteration 16 — Dual OTP (WhatsApp + Email) Smart Fallback regression tests.

Covers:
- /api/admin/otp-preference        (GET/PUT, validation)
- /api/admin/send-otp-smart        (channel=email | whatsapp | both | auto)
- /api/admin/secure-otp/verify     (wrong otp -> 401)
- /api/admin/otp-audit             (send + verify events written)
- Legacy /api/admin/send-otp + /api/admin/verify-otp (must NOT regress
  after the rename verify_otp -> verify_login_otp).
- Staff /api/staff/send-otp legacy (still works after rename).
- Guardian /approvals/{id}/send-otp helper module imports cleanly.
"""

import os
import time
import pytest
import requests

def _read_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v.rstrip("/")
    # Fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return ""

BASE_URL = _read_backend_url()
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN_EMAIL = "asrenterprisespatna@gmail.com"
ADMIN_MOBILE = "8877896889"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _post(sess, path, payload, timeout=20):
    return sess.post(f"{BASE_URL}{path}", json=payload, timeout=timeout)


def _get(sess, path, timeout=20):
    return sess.get(f"{BASE_URL}{path}", timeout=timeout)


# ============================================================
# 1. OTP PREFERENCE — GET/PUT
# ============================================================
class TestOtpPreference:
    def test_get_preference_returns_channel_and_updated_at(self, s):
        r = _get(s, "/api/admin/otp-preference")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "channel" in data and "updated_at" in data
        assert data["channel"] in ("whatsapp", "email", "auto", "both")

    def test_put_preference_accepts_all_four_valid_channels(self, s):
        for ch in ("whatsapp", "email", "auto", "both"):
            r = _post.__self__ if False else None  # noqa
            r = s.put(f"{BASE_URL}/api/admin/otp-preference",
                      json={"channel": ch}, timeout=15)
            assert r.status_code == 200, f"PUT {ch} -> {r.status_code} {r.text}"
            body = r.json()
            assert body["channel"] == ch
            assert body["updated_at"]

        # Verify persistence: read back the LAST one ("both")
        g = _get(s, "/api/admin/otp-preference").json()
        assert g["channel"] == "both"

    def test_put_preference_rejects_bogus_value(self, s):
        r = s.put(f"{BASE_URL}/api/admin/otp-preference",
                  json={"channel": "carrier-pigeon"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_put_preference_rejects_empty_value(self, s):
        r = s.put(f"{BASE_URL}/api/admin/otp-preference",
                  json={"channel": ""}, timeout=15)
        assert r.status_code == 400

    def test_put_preference_resets_to_auto_for_other_tests(self, s):
        r = s.put(f"{BASE_URL}/api/admin/otp-preference",
                  json={"channel": "auto"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["channel"] == "auto"


# ============================================================
# 2. SECURE-OTP VERIFY — negative path (no cooldown impact)
# ============================================================
class TestSecureOtpVerifyWrong:
    def test_wrong_otp_returns_401_with_required_message(self, s):
        r = _post(s, "/api/admin/secure-otp/verify",
                  {"otp": "000000", "actor": ADMIN_EMAIL,
                   "purpose": "iter16_test_wrong_otp"})
        assert r.status_code == 401, r.text
        body = r.json()
        # FastAPI default error key is "detail"
        msg = (body.get("detail") or body.get("error")
               or body.get("message") or "")
        assert "Invalid or expired OTP" in msg, (
            f"Expected canonical 'Invalid or expired OTP' message, got: {msg}"
        )

    def test_missing_otp_returns_400(self, s):
        r = _post(s, "/api/admin/secure-otp/verify",
                  {"actor": ADMIN_EMAIL})
        assert r.status_code == 400, r.text


# ============================================================
# 3. OTP AUDIT
# ============================================================
class TestOtpAudit:
    def test_audit_returns_list_with_required_keys(self, s):
        r = _get(s, "/api/admin/otp-audit?limit=10")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "items" in data
        assert isinstance(data["items"], list)
        # Should have at least the verify event from previous test class
        # (and all the historical sends) — the requested goal is to confirm
        # audit collection has both 'send' and 'verify' shapes available.
        if data["items"]:
            first = data["items"][0]
            for k in ("actor", "ip", "ts", "success"):
                assert k in first, f"audit entry missing {k}: {first}"

    def test_audit_contains_verify_event_after_negative_test(self, s):
        # The previous test class issued an `otp=000000` verify which
        # should have been logged with success=False, event='verify'.
        r = _get(s, "/api/admin/otp-audit?limit=20").json()
        verify_events = [
            x for x in r.get("items", [])
            if x.get("event") == "verify"
        ]
        assert len(verify_events) >= 1, (
            f"No 'verify' events in audit. items={r.get('items')[:3]}"
        )
        last_verify = verify_events[0]
        assert last_verify["actor"] == ADMIN_EMAIL
        assert last_verify["success"] is False
        assert "ip" in last_verify and "ts" in last_verify

    def test_audit_limit_param_bounds(self, s):
        r = _get(s, "/api/admin/otp-audit?limit=1")
        assert r.status_code == 200
        assert len(r.json()["items"]) <= 1


# ============================================================
# 4. SEND-OTP-SMART — sleep between calls to clear 60s cooldown
# ============================================================
class TestSendOtpSmart:
    """These hit a real cooldown keyed on admin:<email>. Run sequentially
    with sleeps to avoid 429."""

    @staticmethod
    def _wait_cooldown():
        # Backend OTP_COOLDOWN_SECONDS=60. Wait 65s to be safe.
        time.sleep(65)

    def test_a_email_channel_returns_full_envelope(self, s):
        r = _post(s, "/api/admin/send-otp-smart",
                  {"channel": "email", "purpose": "iter16_email"}, timeout=30)
        # Accept 200 (delivered) or 429 (cooldown left over from prior runs)
        if r.status_code == 429:
            pytest.skip(f"Cooldown active from previous run: {r.text}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d.get("channel_used") == "email"
        assert d.get("smart_fallback") is False
        assert "email" in d.get("channels_tried", [])
        assert d.get("masked_recipient")
        assert d.get("expires_in") == 300
        assert d.get("max_attempts") == 3
        assert d.get("resend_in") == 30

    def test_b_whatsapp_channel_either_succeeds_or_502(self, s):
        # Need cooldown wait after the email test above
        TestSendOtpSmart._wait_cooldown()
        r = _post(s, "/api/admin/send-otp-smart",
                  {"channel": "whatsapp", "purpose": "iter16_wa"}, timeout=40)
        if r.status_code == 429:
            pytest.skip(f"Cooldown still active: {r.text}")
        # Per spec: accept either 200 with smart_fallback=true,
        # OR 502 channel-exhaustion if Meta token isn't live.
        if r.status_code == 200:
            d = r.json()
            assert d.get("success") is True
            tried = d.get("channels_tried", [])
            assert "whatsapp" in tried, f"channels_tried missing whatsapp: {tried}"
            # If WA succeeded, fallback wouldn't fire — that's fine too.
            if d.get("channel_used") == "email":
                assert d.get("smart_fallback") is True
        elif r.status_code == 502:
            # Channel exhaustion is acceptable in this preview env.
            body = r.json()
            assert "Could not send OTP" in str(body)
        else:
            pytest.fail(f"Unexpected status {r.status_code}: {r.text}")

    def test_c_audit_records_whatsapp_attempt(self, s):
        # The previous test should have logged channels_tried:[whatsapp,...]
        r = _get(s, "/api/admin/otp-audit?limit=5").json()
        sends_with_wa = [
            x for x in r.get("items", [])
            if "whatsapp" in (x.get("channels_tried") or [])
        ]
        assert len(sends_with_wa) >= 1, (
            "Expected at least one audit row with whatsapp in channels_tried"
        )

    def test_d_both_channel_attempts_both(self, s):
        TestSendOtpSmart._wait_cooldown()
        r = _post(s, "/api/admin/send-otp-smart",
                  {"channel": "both", "purpose": "iter16_both"}, timeout=40)
        if r.status_code == 429:
            pytest.skip(f"Cooldown still active: {r.text}")
        if r.status_code == 502:
            # Still verify audit recorded both channels
            audit = _get(s, "/api/admin/otp-audit?limit=3").json()
            tried = audit["items"][0].get("channels_tried", []) if audit["items"] else []
            assert "email" in tried and "whatsapp" in tried, (
                f"channels_tried in audit must include both. got={tried}"
            )
            return
        assert r.status_code == 200, r.text
        d = r.json()
        tried = d.get("channels_tried", [])
        assert "whatsapp" in tried and "email" in tried, (
            f"channel=both must try both. tried={tried}"
        )


# ============================================================
# 5. LEGACY ENDPOINTS — must NOT regress after verify_otp rename
# ============================================================
class TestLegacyEndpointsNotRegressed:
    def test_legacy_admin_verify_otp_wrong_returns_4xx(self, s):
        # /admin/verify-otp uses verify_login_otp internally (renamed). It
        # should still respond cleanly (not crash 500) for a wrong code.
        r = _post(s, "/api/admin/verify-otp",
                  {"mobile": ADMIN_MOBILE, "otp": "000000"}, timeout=15)
        assert r.status_code in (400, 401, 403, 422, 429), (
            f"Legacy verify-otp returned {r.status_code}: {r.text[:200]}"
        )
        # Most importantly: NOT a 500 (would indicate the rename broke it)
        assert r.status_code != 500

    def test_legacy_staff_verify_otp_wrong_returns_4xx(self, s):
        r = _post(s, "/api/staff/verify-otp",
                  {"staff_id": "ASR1002", "otp": "000000"}, timeout=15)
        assert r.status_code in (400, 401, 403, 404, 422, 429)
        assert r.status_code != 500

    def test_legacy_admin_send_otp_responds_cleanly(self, s):
        # Won't actually deliver because of cooldown / rate limit, but the
        # route must respond without throwing 500.
        r = _post(s, "/api/admin/send-otp",
                  {"email": ADMIN_EMAIL}, timeout=20)
        assert r.status_code in (200, 400, 401, 403, 404, 422, 429), r.text
        assert r.status_code != 500

    def test_legacy_staff_send_otp_responds_cleanly(self, s):
        r = _post(s, "/api/staff/send-otp",
                  {"staff_id": "ASR1002"}, timeout=20)
        assert r.status_code in (200, 400, 401, 403, 404, 422, 429), r.text
        assert r.status_code != 500


# ============================================================
# 6. GUARDIAN APPROVAL OTP — sanity (ensure module loads)
# ============================================================
class TestGuardianStillImportable:
    def test_guardian_routes_module_loads(self, s):
        # We can't run a full approval flow without an admin session, but we
        # can hit any guardian route and confirm we get a 4xx (auth) and not
        # a 500 (which would indicate `verify_otp` rename broke imports).
        r = s.get(f"{BASE_URL}/api/guardian/approvals", timeout=15)
        assert r.status_code in (200, 401, 403, 404, 405, 422), r.text
        assert r.status_code != 500
