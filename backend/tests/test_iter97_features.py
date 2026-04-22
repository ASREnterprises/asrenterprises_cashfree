"""
Iteration 97 — Feature Tests
Covers:
1. Public OTP send/verify (/api/public/otp/send, /verify)
2. Cashfree website order OTP gating
3. Shop order delete
4. Invoice delete
5. Invoice PDF contains embedded logo (size > 100KB)
6. Auto-invoice (on payment) triggers WhatsApp helper — side-effect check
"""
import os
import hashlib
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Read from frontend .env as fallback
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "asr_dev")
PUBLIC_OTP_SALT = os.environ.get("PUBLIC_OTP_SALT", "asr-public-otp-v1")

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]

# Test phone that is unlikely to collide with real users
TEST_PHONE = "9876500097"


def _recover_otp_from_hash(target_hash: str) -> str:
    """Brute-force recover the 6-digit OTP from sha256(salt:code)."""
    for i in range(100000, 1000000):
        h = hashlib.sha256(f"{PUBLIC_OTP_SALT}:{i}".encode()).hexdigest()
        if h == target_hash:
            return str(i)
    return ""


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    # pre-clean
    _db.public_otps.delete_many({"phone": TEST_PHONE})
    _db.orders.delete_many({"customer_phone": TEST_PHONE})
    _db.invoices.delete_many({"customer.phone": {"$in": [TEST_PHONE, f"91{TEST_PHONE}"]}})
    _db.cashfree_orders.delete_many({"customer_phone": TEST_PHONE})
    yield
    # post-clean
    _db.public_otps.delete_many({"phone": TEST_PHONE})
    _db.orders.delete_many({"customer_phone": TEST_PHONE})
    _db.invoices.delete_many({"customer.phone": {"$in": [TEST_PHONE, f"91{TEST_PHONE}"]}})
    _db.cashfree_orders.delete_many({"customer_phone": TEST_PHONE})


# ==================== TASK 1: Public OTP ====================
class TestPublicOtp:
    otp_id_shared = None
    otp_code_shared = None

    def test_send_otp_success(self, api):
        # Wait for any prior cooldown from manual testing
        r = api.post(f"{BASE_URL}/api/public/otp/send", json={
            "name": "TEST_Customer",
            "phone": TEST_PHONE,
            "purpose": "booking",
        })
        # 429 can happen if a prior run sent within 45s; allow retry after wait
        if r.status_code == 429:
            time.sleep(46)
            r = api.post(f"{BASE_URL}/api/public/otp/send", json={
                "name": "TEST_Customer", "phone": TEST_PHONE, "purpose": "booking",
            })
        assert r.status_code == 200, f"send_otp: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("otp_id")
        assert "channel" in data
        assert "delivered" in data
        TestPublicOtp.otp_id_shared = data["otp_id"]

        # Recover OTP from DB for verify step
        rec = _db.public_otps.find_one({"id": data["otp_id"]})
        assert rec, "OTP DB record not found"
        code = _recover_otp_from_hash(rec["otp_hash"])
        assert code, "Could not recover OTP from hash"
        TestPublicOtp.otp_code_shared = code

    def test_verify_otp_wrong_code(self, api):
        assert TestPublicOtp.otp_id_shared, "need previous test to pass"
        r = api.post(f"{BASE_URL}/api/public/otp/verify", json={
            "otp_id": TestPublicOtp.otp_id_shared,
            "phone": TEST_PHONE,
            "otp": "000000" if TestPublicOtp.otp_code_shared != "000000" else "111111",
        })
        assert r.status_code == 401, f"Expected 401 got {r.status_code}: {r.text}"

    def test_verify_otp_correct(self, api):
        assert TestPublicOtp.otp_code_shared
        r = api.post(f"{BASE_URL}/api/public/otp/verify", json={
            "otp_id": TestPublicOtp.otp_id_shared,
            "phone": TEST_PHONE,
            "otp": TestPublicOtp.otp_code_shared,
        })
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("verified_at")


# ==================== TASK 2: Cashfree OTP gating ====================
class TestCashfreeGating:
    def test_website_order_without_otp_id_rejected(self, api):
        r = api.post(f"{BASE_URL}/api/cashfree/website/create-order", json={
            "customer_name": "TEST_Customer",
            "customer_phone": TEST_PHONE,
            "customer_email": "test@example.com",
            "amount": 500,
            "service_type": "site_visit",
        })
        assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "verified" in detail.lower() or "otp" in detail.lower()

    def test_website_order_with_bogus_otp_id_rejected(self, api):
        r = api.post(f"{BASE_URL}/api/cashfree/website/create-order", json={
            "customer_name": "TEST_Customer",
            "customer_phone": TEST_PHONE,
            "customer_email": "test@example.com",
            "amount": 500,
            "service_type": "site_visit",
            "otp_id": "not-a-real-id",
        })
        assert r.status_code == 400

    def test_website_order_with_verified_otp_succeeds_gate(self, api):
        """Once the mobile is verified, the 400 OTP gate must go away.
        The call may still fail downstream on Cashfree (503 if live keys unset)
        — that's fine, we only assert the OTP gate is no longer the blocker."""
        import time as _t
        _t.sleep(46)  # cooldown
        s = api.post(f"{BASE_URL}/api/public/otp/send", json={
            "name": "TEST_Customer", "phone": TEST_PHONE, "purpose": "booking",
        })
        assert s.status_code == 200, s.text
        otp_id = s.json()["otp_id"]
        rec = _db.public_otps.find_one({"id": otp_id})
        code = _recover_otp_from_hash(rec["otp_hash"])
        v = api.post(f"{BASE_URL}/api/public/otp/verify", json={
            "otp_id": otp_id, "phone": TEST_PHONE, "otp": code,
        })
        assert v.status_code == 200, v.text
        r = api.post(f"{BASE_URL}/api/cashfree/website/create-order", json={
            "customer_name": "TEST_Customer",
            "customer_phone": TEST_PHONE,
            "customer_email": "test@example.com",
            "amount": 500,
            "service_type": "site_visit",
            "otp_id": otp_id,
        })
        # Must NOT be 400 with "not verified" message. Any other outcome is OK
        if r.status_code == 400:
            assert "verified" not in r.json().get("detail", "").lower(), \
                f"OTP gate still blocking: {r.text}"


# ==================== TASK 3: Shop order delete ====================
class TestShopOrderDelete:
    def test_create_and_delete_shop_order(self, api):
        # Create a COD order so we don't hit Cashfree
        payload = {
            "customer_name": "TEST_DeleteMe",
            "customer_phone": TEST_PHONE,
            "customer_email": "test@example.com",
            "items": [{"product_id": "p1", "name": "Cable", "price": 100, "quantity": 1}],
            "subtotal": 100,
            "delivery_charge": 0,
            "total": 100,
            "delivery_type": "pickup",
            "payment_method": "cod",
            "notes": "TEST_delete",
        }
        r = api.post(f"{BASE_URL}/api/shop/orders", json=payload)
        assert r.status_code in (200, 201), f"create: {r.status_code} {r.text[:300]}"
        order = r.json().get("order") or r.json()
        order_id = order.get("id") or order.get("order_id")
        assert order_id, f"no id in {r.json()}"

        # Delete
        d = api.delete(f"{BASE_URL}/api/shop/orders/{order_id}")
        assert d.status_code == 200, f"delete: {d.status_code} {d.text}"
        assert d.json().get("status") == "success"

        # Verify it's gone — use list
        g = api.get(f"{BASE_URL}/api/shop/orders/{order_id}")
        assert g.status_code == 404


# ==================== TASK 4 + 5: Invoice delete + PDF logo ====================
class TestInvoiceDeleteAndPdf:
    invoice_id = None

    def test_create_invoice(self, api):
        payload = {
            "customer": {
                "name": "TEST_InvoiceCustomer",
                "phone": TEST_PHONE,
                "email": "test@example.com",
                "state": "Bihar",
                "state_code": "10",
                "address": "Patna",
            },
            "project_type": "solar_project",
            "total_amount": 50000,
            "project_name": "TEST 3kW Solar Rooftop",
            "notes": "TEST_invoice",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = api.post(f"{BASE_URL}/api/gst/invoices", json=payload)
        assert r.status_code == 200, f"create invoice: {r.status_code} {r.text[:400]}"
        doc = r.json()
        assert doc.get("id")
        assert doc.get("invoice_number")
        assert doc.get("grand_total", 0) > 0
        TestInvoiceDeleteAndPdf.invoice_id = doc["id"]

    def test_pdf_has_logo_and_header(self, api):
        assert TestInvoiceDeleteAndPdf.invoice_id
        r = api.get(f"{BASE_URL}/api/gst/invoices/{TestInvoiceDeleteAndPdf.invoice_id}/pdf")
        assert r.status_code == 200
        content = r.content
        assert content[:4] == b"%PDF", f"PDF header wrong: {content[:10]}"
        # Embedded logo bumps size > 100KB per PRD
        assert len(content) > 100_000, f"PDF too small ({len(content)} bytes) — logo probably missing"

    def test_delete_invoice(self, api):
        assert TestInvoiceDeleteAndPdf.invoice_id
        d = api.delete(f"{BASE_URL}/api/gst/invoices/{TestInvoiceDeleteAndPdf.invoice_id}")
        assert d.status_code == 200, f"{d.status_code} {d.text}"
        g = api.get(f"{BASE_URL}/api/gst/invoices/{TestInvoiceDeleteAndPdf.invoice_id}")
        assert g.status_code == 404


# ==================== TASK 5: Auto-invoice on payment ====================
class TestAutoInvoiceOnPayment:
    def test_invoice_auto_issue_helper_exists(self):
        """Smoke test — ensure invoice_auto_issue_from_payment is importable and the
        _send_invoice_pdf_as_whatsapp_doc helper exists. Real live delivery cannot
        be tested in the preview env."""
        import importlib, sys
        sys.path.insert(0, "/app/backend")
        mod = importlib.import_module("routes.gst_invoices")
        assert hasattr(mod, "invoice_auto_issue_from_payment")
        assert hasattr(mod, "_send_invoice_pdf_as_whatsapp_doc")
        assert callable(mod.invoice_auto_issue_from_payment)
        assert callable(mod._send_invoice_pdf_as_whatsapp_doc)

    def test_logo_embedded_in_template(self):
        import importlib, sys
        sys.path.insert(0, "/app/backend")
        mod = importlib.import_module("routes.gst_invoices")
        assert getattr(mod, "LOGO_DATA_URI", "").startswith("data:image/png;base64,")
        assert len(mod.LOGO_DATA_URI) > 2000, "Logo data-uri unexpectedly short"


# ==================== TASK 6: Staff login works ====================
class TestStaffLogins:
    def test_rimjhim_login(self, api):
        r = api.post(f"{BASE_URL}/api/staff/login-email", json={
            "email": "rimjhim.asr@asrenterprises.in",
            "password": "rimjhim@123",
        })
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        data = r.json()
        staff = data.get("staff") or data.get("user") or data
        sid = staff.get("staff_id") or data.get("staff_id")
        assert sid == "ASR1003", f"Expected ASR1003, got {sid}"

    def test_anamika_login(self, api):
        r = api.post(f"{BASE_URL}/api/staff/login-email", json={
            "email": "anamikarathod1905@gmail.com",
            "password": "anamika@123",
        })
        assert r.status_code == 200
        data = r.json()
        staff = data.get("staff") or data.get("user") or data
        sid = staff.get("staff_id") or data.get("staff_id")
        assert sid == "ASR1002"
