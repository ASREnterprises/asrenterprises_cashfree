"""
Iteration 100 — Customer Portal growth features.

Covers /api/customer/* endpoints:
  * invoices / upi / pdf / reminder
  * referral / referral track
  * documents
  * progress
  * service-requests (POST + GET)

Plus lightweight regression for /admin/login-password and /api/gst/*.
"""
import os
import re
import base64
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asrenterprise-pay.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
# The live backend uses "asr_dev" as effective db name (MONGO_URI env not set,
# so EFFECTIVE_DB_NAME falls through to the dev default). Override via
# TEST_DB_NAME if needed.
DB_NAME = os.environ.get("TEST_DB_NAME", "asr_dev")
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]

# Seeded test phone (prefix 912345 marks it for cleanup)
TEST_PHONE = "9123450001"
TEST_PHONE_PMSG = "9123450002"
TEST_PHONE_MISSING_CUST = "9123459999"  # valid format, no crm_customers row
INVALID_PHONES = ["12345", "0000000000", "5123450001", "abcdefghij"]


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/admin/login-password", json={
        "user_id": "asrenterprisespatna@gmail.com",
        "password": "Abhi@9745",
        "direct_login": True,
    })
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    # token may be returned as token/access_token, or set as cookie
    body = r.json()
    tok = body.get("token") or body.get("access_token")
    return tok


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    if admin_token:
        return {"Authorization": f"Bearer {admin_token}"}
    return {}


# ----------------------------------------------------------------------------
# Seed data — creates TWO customers + their invoices via admin APIs.
# Uses mobile='9123450001' (regular) and '9123450002' (PMSG) for 91-prefix tests.
# ----------------------------------------------------------------------------
@pytest.fixture(scope="session")
def seed(session, auth_headers):
    # Create CRM customers directly in MongoDB (no public create API)
    customers = []
    for mob, name in [(TEST_PHONE, "TEST Portal User"), (TEST_PHONE_PMSG, "TEST PMSG User")]:
        cid = str(uuid.uuid4())
        doc = {
            "id": cid,
            "name": name,
            "mobile": mob,
            "email": f"test_{mob}@test.com",
            "address": "Test Address, Patna",
            "state": "Bihar",
            "installation_status": "installed",
            "application_id": f"APP-TEST-{mob[-4:]}",
            "application_status": "approved",
            "subsidy_status": "credited",
            "subsidy_credited_date": "2026-01-15",
            "subsidy_amount": 78000,
            "installation_date": "2026-01-01",
            "panel_warranty_years": 25,
            "inverter_warranty_years": 10,
            "solar_brand": "Waaree",
            "inverter_brand": "Growatt",
            "net_metering_status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _db.crm_customers.update_one({"mobile": mob}, {"$set": doc}, upsert=True)
        customers.append(doc)

    # Create invoices via admin API
    invoices = []
    for mob, scheme in [(TEST_PHONE, ""), (TEST_PHONE_PMSG, "pm_surya_ghar")]:
        inv_body = {
            "customer": {"name": f"TEST Portal User {mob}", "phone": mob, "address": "Patna", "state": "Bihar"},
            "project_type": "solar_project",
            "total_amount": 200000,
            "scheme": scheme,
            "invoice_date": "2026-01-10",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = session.post(f"{API}/gst/invoices", json=inv_body, headers=auth_headers)
        assert r.status_code in (200, 201), f"invoice create {mob}: {r.status_code} {r.text[:250]}"
        invoices.append(r.json())

    # Create a second invoice for TEST_PHONE and mark it PAID via payment record
    paid_body = {
        "customer": {"name": "TEST Portal User", "phone": TEST_PHONE, "address": "Patna", "state": "Bihar"},
        "project_type": "solar_project",
        "total_amount": 1000,
        "invoice_date": "2026-01-12",
        "auto_send_whatsapp": False,
        "auto_send_email": False,
    }
    r = session.post(f"{API}/gst/invoices", json=paid_body, headers=auth_headers)
    assert r.status_code in (200, 201)
    paid_inv = r.json()
    grand = float(paid_inv["grand_total"])
    rp = session.post(
        f"{API}/gst/invoices/{paid_inv['id']}/payments",
        json={"amount": grand, "payment_mode": "upi", "payment_date": "2026-01-12", "reference": "TESTPAID", "notes": "TEST_ITER100"},
        headers=auth_headers,
    )
    assert rp.status_code in (200, 201), f"payment record: {rp.status_code} {rp.text[:200]}"

    data = {
        "customers": customers,
        "unpaid_regular": invoices[0],
        "unpaid_pmsg": invoices[1],
        "paid_regular": paid_inv,
    }
    yield data

    # Teardown — best-effort cleanup
    for inv in [invoices[0], invoices[1], paid_inv]:
        try:
            session.delete(f"{API}/gst/invoices/{inv['id']}", headers=auth_headers)
        except Exception:
            pass
    try:
        _db.crm_customers.delete_many({"mobile": {"$in": [TEST_PHONE, TEST_PHONE_PMSG]}})
        _db.referral_visits.delete_many({"code": {"$regex": "^TES"}})
    except Exception:
        pass


# ============================================================================
# Invoices endpoint
# ============================================================================
class TestCustomerInvoices:
    def test_valid_phone_returns_kpi_and_invoices(self, session, seed):
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE}")
        assert r.status_code == 200
        data = r.json()
        assert data["phone"] == TEST_PHONE
        assert "kpi" in data
        for k in ["total_cost", "total_paid", "total_due", "payment_status",
                  "invoices_count", "unpaid_count", "quotations_count"]:
            assert k in data["kpi"], f"missing kpi.{k}"
        # Should contain both invoices we seeded
        assert data["kpi"]["invoices_count"] >= 2
        # Paid invoice should appear in invoices[] and be reflected in totals
        assert data["kpi"]["total_paid"] > 0
        # No ObjectId leakage
        assert "_id" not in str(data)

    def test_91_prefix_stripped(self, session, seed):
        r = session.get(f"{API}/customer/invoices/91{TEST_PHONE}")
        assert r.status_code == 200
        assert r.json()["phone"] == TEST_PHONE

    @pytest.mark.parametrize("bad", INVALID_PHONES)
    def test_invalid_phone_400(self, session, bad):
        r = session.get(f"{API}/customer/invoices/{bad}")
        assert r.status_code == 400, f"{bad} → {r.status_code}"

    def test_quotations_excluded_from_financial_kpi(self, session, auth_headers, seed):
        # Create a quotation
        q_body = {
            "customer": {"name": "TEST Portal User", "phone": TEST_PHONE, "address": "Patna", "state": "Bihar"},
            "project_type": "solar_project",
            "total_amount": 500000,
            "doc_type": "quotation",
            "invoice_date": "2026-01-14",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = session.post(f"{API}/gst/invoices", json=q_body, headers=auth_headers)
        assert r.status_code in (200, 201)
        q = r.json()
        try:
            r2 = session.get(f"{API}/customer/invoices/{TEST_PHONE}")
            data = r2.json()
            assert data["kpi"]["quotations_count"] >= 1
            # Quotation amount (≥500000) should NOT be in total_cost
            assert data["kpi"]["total_cost"] < 500000, f"quotation leaked into kpi: {data['kpi']}"
        finally:
            session.delete(f"{API}/gst/invoices/{q['id']}", headers=auth_headers)


# ============================================================================
# UPI endpoint — PMSG vs non-PMSG bank routing
# ============================================================================
class TestCustomerInvoiceUPI:
    def test_non_pmsg_uses_sbi(self, session, seed):
        inv = seed["unpaid_regular"]
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE}/{inv['id']}/upi")
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["bank"] == "SBI"
        assert d["vpa"] == "abhirajput8763@ybl"
        assert d["upi_link"].startswith("upi://pay?")
        assert "abhirajput8763@ybl" in d["upi_link"]
        # amount present in link
        assert f"am={d['due_amount']}" in d["upi_link"] or re.search(r"am=\d", d["upi_link"])
        # QR
        assert d["qr_data_uri"].startswith("data:image/png;base64,")
        b64 = d["qr_data_uri"].split(",", 1)[1]
        assert len(base64.b64decode(b64)) > 1000

    def test_pmsg_uses_icici(self, session, seed):
        inv = seed["unpaid_pmsg"]
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE_PMSG}/{inv['id']}/upi")
        assert r.status_code == 200
        d = r.json()
        assert d["bank"] == "ICICI"
        assert d["vpa"] == "8877896889.ibz@icici"
        assert "8877896889.ibz@icici" in d["upi_link"]

    def test_paid_invoice_returns_failure(self, session, seed):
        inv = seed["paid_regular"]
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE}/{inv['id']}/upi")
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is False
        assert d["payment_status"] == "paid"
        assert "error" in d

    def test_wrong_phone_404(self, session, seed):
        inv = seed["unpaid_regular"]
        r = session.get(f"{API}/customer/invoices/9123450099/{inv['id']}/upi")
        assert r.status_code == 404

    def test_wrong_invoice_id_404(self, session):
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE}/{uuid.uuid4()}/upi")
        assert r.status_code == 404


# ============================================================================
# PDF endpoint
# ============================================================================
class TestCustomerInvoicePDF:
    def test_pdf_streamed(self, session, seed):
        inv = seed["unpaid_regular"]
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE}/{inv['id']}/pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert "filename=" in r.headers.get("content-disposition", "")
        assert r.content[:4] == b"%PDF"

    def test_pdf_cross_customer_blocked(self, session, seed):
        inv = seed["unpaid_regular"]
        r = session.get(f"{API}/customer/invoices/{TEST_PHONE_PMSG}/{inv['id']}/pdf")
        assert r.status_code == 404


# ============================================================================
# Customer reminder
# ============================================================================
class TestCustomerReminder:
    def test_reminder_appended(self, session, seed, auth_headers):
        inv = seed["unpaid_regular"]
        r = session.post(f"{API}/customer/invoices/{TEST_PHONE}/{inv['id']}/reminder")
        assert r.status_code == 200
        assert r.json().get("success") is True

        # Verify on the invoice via admin API
        r2 = session.get(f"{API}/gst/invoices/{inv['id']}", headers=auth_headers)
        assert r2.status_code == 200
        reminders = r2.json().get("reminders_sent") or []
        match = [x for x in reminders if x.get("source") == "customer_portal"]
        assert match, f"customer_portal reminder not appended: {reminders}"
        assert match[-1].get("day") == 0
        assert match[-1].get("result") == "customer_pinged"


# ============================================================================
# Referral
# ============================================================================
class TestReferral:
    def test_code_generated_and_stable(self, session, seed):
        r1 = session.get(f"{API}/customer/referral/{TEST_PHONE}")
        assert r1.status_code == 200
        d1 = r1.json()
        code = d1["code"]
        assert 6 <= len(code) <= 8, f"code length {len(code)}: {code}"
        assert code[-4:] == TEST_PHONE[-4:]
        assert re.match(r"^[A-Z]{3}\d{4}", code), f"bad code format: {code}"

        assert "?ref=" in d1["link"]
        assert "wa.me" in d1["whatsapp_share_link"]
        stats = d1["stats"]
        assert stats["reward_per_conversion"] == 1000
        for key in ["link_clicks", "referrals", "converted", "reward_earned"]:
            assert key in stats

        # Call again — same code
        r2 = session.get(f"{API}/customer/referral/{TEST_PHONE}")
        assert r2.json()["code"] == code

    def test_track_increments_clicks(self, session, seed):
        code = session.get(f"{API}/customer/referral/{TEST_PHONE}").json()["code"]
        before = session.get(f"{API}/customer/referral/{TEST_PHONE}").json()["stats"]["link_clicks"]
        rt = session.post(f"{API}/customer/referral/track/{code}")
        assert rt.status_code == 200
        rt2 = session.post(f"{API}/customer/referral/track/{code}")
        assert rt2.status_code == 200
        after = session.get(f"{API}/customer/referral/{TEST_PHONE}").json()["stats"]["link_clicks"]
        assert after == before + 2, f"clicks {before}→{after}"

    def test_missing_customer_returns_404(self, session):
        r = session.get(f"{API}/customer/referral/{TEST_PHONE_MISSING_CUST}")
        assert r.status_code == 404


# ============================================================================
# Documents
# ============================================================================
class TestDocuments:
    def test_returns_invoices_and_warranties(self, session, seed):
        r = session.get(f"{API}/customer/documents/{TEST_PHONE}")
        assert r.status_code == 200
        d = r.json()
        assert d["phone"] == TEST_PHONE
        docs = d["documents"]
        types = {x["type"] for x in docs}
        assert "invoice" in types
        assert "warranty" in types
        # At least one warranty entry referencing 25 years
        assert any("25 Years" in x["label"] for x in docs if x["type"] == "warranty")
        # Invoice url routes through the portal pdf endpoint
        inv_docs = [x for x in docs if x["type"] == "invoice"]
        for iv in inv_docs:
            assert f"/api/customer/invoices/{TEST_PHONE}/" in iv["url"]
            assert iv["url"].endswith("/pdf")


# ============================================================================
# Progress
# ============================================================================
class TestProgress:
    def test_progress_stages_and_indices(self, session, seed):
        r = session.get(f"{API}/customer/progress/{TEST_PHONE}")
        assert r.status_code == 200
        d = r.json()
        assert d["installation"]["stages"] == ["site_visit", "installation", "net_metering", "completed"]
        assert d["subsidy"]["stages"] == ["applied", "approved", "credited"]
        # subsidy credited → index 2
        assert d["subsidy"]["current_index"] == 2
        assert d["subsidy"]["current_label"].lower() == "credited"
        # Installation — should be >= 1 (installation_date set)
        assert d["installation"]["current_index"] >= 1


# ============================================================================
# Service requests
# ============================================================================
class TestServiceRequests:
    def test_create_and_appear_in_list(self, session, seed):
        r = session.post(
            f"{API}/customer/service-requests/{TEST_PHONE}",
            json={"type": "cleaning", "description": "Need panel cleaning before monsoon"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        req = d["request"]
        assert req["type"] == "cleaning"
        assert req["status"] == "open"
        assert req["source"] == "customer_portal"
        assert "id" in req and "created_at" in req

        # GET should contain it
        r2 = session.get(f"{API}/customer/service-requests/{TEST_PHONE}")
        assert r2.status_code == 200
        srs = r2.json()["service_requests"]
        assert any(s.get("id") == req["id"] for s in srs)

    def test_short_description_422(self, session, seed):
        r = session.post(
            f"{API}/customer/service-requests/{TEST_PHONE}",
            json={"type": "cleaning", "description": "hi"},
        )
        assert r.status_code == 422


# ============================================================================
# Regression — admin login still works
# ============================================================================
class TestAdminRegression:
    def test_admin_login_ok(self, session):
        r = session.post(f"{API}/admin/login-password", json={
            "user_id": "asrenterprisespatna@gmail.com",
            "password": "Abhi@9745",
            "direct_login": True,
        })
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        # Either token returned OR session cookie set, plus success flag
        assert body.get("message") == "Login successful!" or body.get("token") or body.get("access_token")
