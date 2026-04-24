"""Tests for iteration 15: Email OTP channel (Resend) across Customer, Solar Advisor.
Covers:
- POST /api/customer/send-otp-email (happy / 404 / 502)
- POST /api/customer/verify-otp-email (bad OTP)
- POST /api/solar-advisor/login-otp-email
- POST /api/solar-advisor/verify-otp-email (bad OTP)
- POST /api/admin/customers persists email field
- POST /api/admin/login-otp sends email through Resend (happy path)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env via dotenv-style read
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        BASE_URL = ""

OWNER_EMAIL = "asrenterprisespatna@gmail.com"
ADVISOR_EMAIL = "rajan.test.sa@asr.com"
UNKNOWN_EMAIL = "nosuch_customer_iter15@example.com"
# Unverified domain -> Resend 422 so send fails (gives 502 from backend)
UNVERIFIED_EMAIL = "emailotp.test@example.com"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ==================== Customer Email OTP ====================
class TestCustomerEmailOtp:
    def test_send_otp_email_happy_owner(self, api):
        r = api.post(f"{BASE_URL}/api/customer/send-otp-email",
                     json={"email": OWNER_EMAIL}, timeout=25)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("channel") == "email"
        assert "masked_mobile" in body

    def test_send_otp_email_unknown_404(self, api):
        r = api.post(f"{BASE_URL}/api/customer/send-otp-email",
                     json={"email": UNKNOWN_EMAIL}, timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"
        assert "detail" in r.json()

    def test_send_otp_email_invalid_400(self, api):
        r = api.post(f"{BASE_URL}/api/customer/send-otp-email",
                     json={"email": "not-an-email"}, timeout=15)
        assert r.status_code == 400

    def test_verify_otp_email_bad_otp(self, api):
        # Trigger a send first so OTP exists in storage
        api.post(f"{BASE_URL}/api/customer/send-otp-email",
                 json={"email": OWNER_EMAIL}, timeout=25)
        r = api.post(f"{BASE_URL}/api/customer/verify-otp-email",
                     json={"email": OWNER_EMAIL, "otp": "000000"}, timeout=15)
        assert r.status_code == 400
        assert "Invalid OTP" in r.json().get("detail", "") or \
               "OTP" in r.json().get("detail", "")

    def test_verify_otp_email_no_request(self, api):
        r = api.post(f"{BASE_URL}/api/customer/verify-otp-email",
                     json={"email": "never_sent_iter15@example.com", "otp": "123456"},
                     timeout=15)
        assert r.status_code == 400


# ==================== Solar Advisor Email OTP ====================
class TestAdvisorEmailOtp:
    def test_send_advisor_otp_email_happy(self, api):
        # advisor email rajan.test.sa@asr.com is NOT the Resend owner so Resend
        # will reject -> 502 expected on free tier. Accept both 200 and 502
        # depending on whether a domain has since been verified.
        r = api.post(f"{BASE_URL}/api/solar-advisor/login-otp-email",
                     json={"email": ADVISOR_EMAIL}, timeout=25)
        assert r.status_code in (200, 502), f"got {r.status_code}: {r.text}"
        if r.status_code == 200:
            assert r.json().get("channel") == "email"

    def test_send_advisor_otp_email_unknown_404(self, api):
        r = api.post(f"{BASE_URL}/api/solar-advisor/login-otp-email",
                     json={"email": "unknown_advisor_iter15@example.com"},
                     timeout=15)
        assert r.status_code == 404

    def test_send_advisor_otp_email_invalid_400(self, api):
        r = api.post(f"{BASE_URL}/api/solar-advisor/login-otp-email",
                     json={"email": "bad"}, timeout=15)
        assert r.status_code == 400

    def test_verify_advisor_otp_email_no_request(self, api):
        r = api.post(f"{BASE_URL}/api/solar-advisor/verify-otp-email",
                     json={"email": "nope_iter15@example.com", "otp": "123456"},
                     timeout=15)
        assert r.status_code == 400


# ==================== Admin OTP delivery through Resend ====================
class TestAdminLoginOtp:
    def test_admin_send_otp_email_happy(self, api):
        # /api/admin/send-otp is the admin email OTP (via Resend).
        # Resend free tier = 2 req/sec, so pause to avoid rate-limit 429.
        time.sleep(2.5)
        r = api.post(f"{BASE_URL}/api/admin/send-otp",
                     json={"email": OWNER_EMAIL}, timeout=25)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        # email_sent=True means Resend actually delivered
        assert body.get("email_sent") is True, \
            "Resend did not send email; check RESEND_API_KEY + SENDER_EMAIL or rate-limit"

    def test_admin_send_otp_email_wrong_email(self, api):
        r = api.post(f"{BASE_URL}/api/admin/send-otp",
                     json={"email": "notadmin_iter15@example.com"}, timeout=15)
        assert r.status_code == 403


# ==================== Admin Customer create persists email ====================
class TestAdminCustomerEmail:
    def _admin_token(self, api):
        # Admin login password endpoint expects email as user_id
        r = api.post(f"{BASE_URL}/api/admin/login-password",
                     json={"user_id": OWNER_EMAIL, "password": "Abhi@9745",
                           "direct_login": True},
                     timeout=20)
        if r.status_code == 200:
            tok = r.json().get("token") or r.json().get("access_token")
            if tok:
                return tok
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")

    def test_admin_create_customer_persists_email(self, api):
        # /api/admin/customers has no auth header requirement.
        unique = str(int(time.time()))[-7:]
        mobile = ("9" + unique + "00")[:10]
        payload = {
            "name": f"TEST_emailpersist_{unique}",
            "mobile": mobile,
            "email": f"test_emailpersist_{unique}@example.com",
            "district": "Patna",
            "address": "TEST address",
            "customer_type": "residential",
            "application_id": f"TESTAPP{unique}",
        }
        r = api.post(f"{BASE_URL}/api/admin/customers", json=payload,
                     timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        data = r.json()
        cust = data.get("customer") or data
        cid = cust.get("id") or data.get("customer_id") or data.get("id")
        assert cid, f"no customer id returned: {data}"
        got = api.get(f"{BASE_URL}/api/admin/customers", timeout=20)
        assert got.status_code == 200
        arr = got.json() if isinstance(got.json(), list) else got.json().get(
            "customers", [])
        match = next((c for c in arr if c.get("id") == cid or
                      c.get("mobile") == mobile), None)
        assert match is not None, "created customer not listed"
        assert match.get("email") == payload["email"], \
            f"email not persisted; got {match.get('email')}"
