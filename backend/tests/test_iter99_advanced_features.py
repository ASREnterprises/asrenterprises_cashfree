"""Iteration 99 — F1 Convert / F2 Reminders / F3 Dashboard / F4 UPI / F5 PDF QR."""
import io
import os
import sys
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asrenterprise-pay.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TEST_PHONE = "9876500099"
TEST_PREFIX = "TEST_ITER99_"

sys.path.insert(0, "/app/backend")

# ============================================================
# Helpers / fixtures
# ============================================================

def _make_quotation(name_suffix: str, total: float = 10000.0, scheme: str = "") -> dict:
    payload = {
        "customer": {
            "name": f"{TEST_PREFIX}{name_suffix}",
            "phone": TEST_PHONE,
            "email": "iter99@test.local",
            "address": "Patna, Bihar",
            "state": "Bihar",
            "state_code": "10",
            "pincode": "800001",
        },
        "project_type": "solar_project",
        "total_amount": total,
        "project_name": "PM Surya Ghar Rooftop" if scheme == "pm_surya_ghar" else "Test Solar Project",
        "doc_type": "quotation",
        "scheme": scheme,
        "auto_send_whatsapp": False,
        "auto_send_email": False,
    }
    r = requests.post(f"{API}/gst/invoices", json=payload, timeout=60)
    assert r.status_code == 200, f"create quote failed: {r.status_code} {r.text[:300]}"
    return r.json()


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    yield
    # Best-effort cleanup
    try:
        r = requests.get(f"{API}/gst/invoices", params={"limit": 500}, timeout=30)
        if r.status_code == 200:
            for inv in (r.json() or []):
                cust_name = ((inv.get("customer") or {}).get("name") or "")
                if cust_name.startswith(TEST_PREFIX):
                    requests.delete(f"{API}/gst/invoices/{inv['id']}", timeout=15)
    except Exception as e:
        print(f"cleanup warning: {e}")


# ============================================================
# F4 — UPI strict routing (pure functions)
# ============================================================

class TestF4UpiStrict:
    def test_pmsg_routes_to_icici(self):
        from routes.gst_invoices import get_upi_for_invoice, build_upi_link, UPI_CONFIG
        upi = get_upi_for_invoice({"scheme": "pm_surya_ghar"})
        assert upi["vpa"] == "8877896889.ibz@icici"
        assert upi["bank"] == "ICICI"
        assert UPI_CONFIG["icici"]["vpa"] == "8877896889.ibz@icici"

    def test_non_pmsg_routes_to_sbi(self):
        from routes.gst_invoices import get_upi_for_invoice
        for scheme in ["", None, "regular", "discom"]:
            upi = get_upi_for_invoice({"scheme": scheme})
            assert upi["vpa"] == "abhirajput8763@ybl", f"scheme={scheme!r}"
            assert upi["bank"] == "SBI"

    def test_pmsg_strict_never_falls_to_sbi(self):
        # Even if other fields are messed with, scheme drives UPI
        from routes.gst_invoices import get_upi_for_invoice
        doc = {"scheme": "PM_SURYA_GHAR", "payment_mode": "SBI", "due_amount": 0}
        assert get_upi_for_invoice(doc)["vpa"] == "8877896889.ibz@icici"

    def test_build_upi_link_format(self):
        from routes.gst_invoices import build_upi_link
        link = build_upi_link({"scheme": "pm_surya_ghar", "invoice_number": "ASR/INV/T/1", "due_amount": 1234.56})
        assert link.startswith("upi://pay?pa=8877896889.ibz@icici")
        assert "pn=ASR%20ENTERPRISES" in link
        assert "am=1234.56" in link
        assert "cu=INR" in link
        assert "tn=Invoice%20ASR%2FINV%2FT%2F1" in link

    def test_build_upi_link_sbi(self):
        from routes.gst_invoices import build_upi_link
        link = build_upi_link({"scheme": "", "invoice_number": "ASR/INV/T/2", "due_amount": 500.0})
        assert "pa=abhirajput8763@ybl" in link
        assert "am=500.00" in link


# ============================================================
# F1 — Quotation → Invoice conversion
# ============================================================

class TestF1Convert:
    def test_convert_with_zero_received(self):
        q = _make_quotation("Convert0", total=10000.0)
        gt = float(q["grand_total"])
        r = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        inv = r.json()["invoice"]
        assert inv["payment_status"] == "unpaid"
        assert inv["amount_paid"] == 0.0
        assert abs(inv["due_amount"] - gt) < 0.01
        assert inv["doc_type"] == "invoice"
        assert inv["converted_from_quotation_id"] == q["id"]
        assert inv["payment_mode"] == "SBI"  # default for non-PMSG

    def test_convert_partial(self):
        q = _make_quotation("ConvertHalf", total=10000.0)
        gt = float(q["grand_total"])
        half = round(gt / 2, 2)
        r = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": half}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        inv = r.json()["invoice"]
        assert inv["payment_status"] == "partial"
        assert abs(inv["amount_paid"] - half) < 0.01
        assert abs(inv["due_amount"] - (gt - half)) < 0.01
        assert len(inv["payment_history"]) == 1

    def test_convert_full(self):
        q = _make_quotation("ConvertFull", total=10000.0)
        gt = float(q["grand_total"])
        r = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": gt}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        inv = r.json()["invoice"]
        assert inv["payment_status"] == "paid"
        assert abs(inv["amount_paid"] - gt) < 0.01
        assert inv["due_amount"] == 0.0

    def test_convert_marks_source_and_blocks_double_convert(self):
        q = _make_quotation("ConvertSource", total=5000.0)
        r1 = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=60)
        assert r1.status_code == 200
        new_inv_id = r1.json()["invoice"]["id"]

        # Source quotation should now be 'converted' with link
        src = requests.get(f"{API}/gst/invoices/{q['id']}", timeout=30).json()
        assert src["status"] == "converted"
        assert src["converted_to_invoice_id"] == new_inv_id

        # Re-convert should 409
        r2 = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=30)
        assert r2.status_code == 409
        assert "already converted" in r2.text.lower()

    def test_convert_invoice_returns_400(self):
        # Create an invoice (not quotation) and try to convert
        payload = {
            "customer": {"name": f"{TEST_PREFIX}NotQuote", "phone": TEST_PHONE, "email": "x@x.com",
                         "address": "Patna", "state": "Bihar", "state_code": "10", "pincode": "800001"},
            "project_type": "solar_project", "total_amount": 1000, "doc_type": "invoice",
            "auto_send_whatsapp": False, "auto_send_email": False,
        }
        r = requests.post(f"{API}/gst/invoices", json=payload, timeout=60)
        assert r.status_code == 200
        inv_id = r.json()["id"]
        r2 = requests.post(f"{API}/gst/quotations/{inv_id}/convert", json={"amount_received": 0}, timeout=30)
        assert r2.status_code == 400
        assert "quotation" in r2.text.lower()

    def test_convert_overpay_returns_400(self):
        q = _make_quotation("OverPay", total=5000.0)
        r = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 99999}, timeout=30)
        assert r.status_code == 400
        assert "exceed" in r.text.lower() or "cannot exceed" in r.text.lower()

    def test_convert_pmsg_defaults_to_icici(self):
        q = _make_quotation("PmsgDefault", total=8000.0, scheme="pm_surya_ghar")
        r = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        inv = r.json()["invoice"]
        assert inv["payment_mode"] == "ICICI", f"PMSG should default to ICICI, got {inv['payment_mode']}"
        assert inv["scheme"] == "pm_surya_ghar"

    def test_convert_explicit_mode_overrides(self):
        q = _make_quotation("ExplicitMode", total=5000.0)
        r = requests.post(f"{API}/gst/quotations/{q['id']}/convert",
                          json={"amount_received": 5000, "payment_mode": "Cash"}, timeout=60)
        assert r.status_code == 200
        inv = r.json()["invoice"]
        assert inv["payment_mode"] == "Cash"


# ============================================================
# F2 — Reminders
# ============================================================

class TestF2Reminders:
    def test_status_endpoint(self):
        r = requests.get(f"{API}/gst/reminders/status", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["running"] is True
        assert data["schedule_days"] == [1, 3, 7, 14, 21, 28, 35, 42, 49, 56]
        assert data["next_run"], "next_run should be ISO string"
        assert "T" in data["next_run"]

    def test_send_one_off_to_unpaid(self):
        q = _make_quotation("Reminder1", total=5000.0)
        conv = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=60)
        inv_id = conv.json()["invoice"]["id"]

        r = requests.post(f"{API}/gst/reminders/invoices/{inv_id}/send", timeout=60)
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        assert "result" in body and "entry" in body
        entry = body["entry"]
        assert "day" in entry and "sent_at" in entry and "result" in entry
        assert entry["manual"] is True
        assert "due_amount_at_send" in entry

        # Confirm appended in invoice doc
        live = requests.get(f"{API}/gst/invoices/{inv_id}", timeout=30).json()
        assert isinstance(live.get("reminders_sent"), list)
        assert len(live["reminders_sent"]) >= 1

    def test_send_to_paid_invoice_returns_400(self):
        q = _make_quotation("ReminderPaid", total=2000.0)
        gt = float(q["grand_total"])
        conv = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": gt}, timeout=60)
        inv_id = conv.json()["invoice"]["id"]
        r = requests.post(f"{API}/gst/reminders/invoices/{inv_id}/send", timeout=30)
        assert r.status_code == 400
        assert "paid" in r.text.lower()

    def test_run_now(self):
        r = requests.post(f"{API}/gst/reminders/run-now", timeout=120)
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        assert body["success"] is True
        result = body["result"]
        for k in ("processed", "sent", "errors", "started_at", "finished_at"):
            assert k in result, f"missing {k}"


# ============================================================
# F3 — Dashboard
# ============================================================

class TestF3Dashboard:
    def test_dashboard_shape(self):
        r = requests.get(f"{API}/gst/dashboard", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) >= {"kpi", "monthly_revenue", "overdue", "recent"}
        kpi = data["kpi"]
        for k in ("total_revenue", "total_due", "total_invoices", "paid_count",
                  "partial_count", "unpaid_count", "this_month_count"):
            assert k in kpi, f"kpi missing {k}"
        assert isinstance(data["monthly_revenue"], list)
        assert len(data["monthly_revenue"]) == 6
        for m in data["monthly_revenue"]:
            assert {"label", "revenue", "count"} <= set(m.keys())
        assert isinstance(data["overdue"], list)
        assert isinstance(data["recent"], list)

    def test_dashboard_no_mongo_objectid_leak(self):
        r = requests.get(f"{API}/gst/dashboard", timeout=30)
        assert "_id" not in r.text or '"_id"' not in r.text


# ============================================================
# F5 — PDF QR block
# ============================================================

class TestF5PdfQr:
    def _pdf_text(self, pdf_bytes):
        try:
            import pdfplumber
        except ImportError:
            pytest.skip("pdfplumber not installed")
        text_all = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for p in pdf.pages:
                text_all.append(p.extract_text() or "")
        return "\n".join(text_all)

    def test_pmsg_unpaid_pdf_has_icici_block(self):
        q = _make_quotation("PdfPmsg", total=3000.0, scheme="pm_surya_ghar")
        conv = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=60)
        inv_id = conv.json()["invoice"]["id"]
        r = requests.get(f"{API}/gst/invoices/{inv_id}/pdf", timeout=60)
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"
        text = self._pdf_text(r.content)
        assert "Scan" in text and "Pay" in text, "Missing 'Scan & Pay' marker"
        assert "ICICI" in text, "Missing ICICI bank label"
        assert "8877896889.ibz@icici" in text, "Missing ICICI VPA"

    def test_non_pmsg_unpaid_pdf_has_sbi_block(self):
        q = _make_quotation("PdfSbi", total=3000.0)
        conv = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": 0}, timeout=60)
        inv_id = conv.json()["invoice"]["id"]
        r = requests.get(f"{API}/gst/invoices/{inv_id}/pdf", timeout=60)
        assert r.status_code == 200
        text = self._pdf_text(r.content)
        assert "SBI" in text
        assert "abhirajput8763@ybl" in text

    def test_paid_pdf_shows_paid_in_full(self):
        q = _make_quotation("PdfPaid", total=2500.0)
        gt = float(q["grand_total"])
        conv = requests.post(f"{API}/gst/quotations/{q['id']}/convert", json={"amount_received": gt}, timeout=60)
        inv_id = conv.json()["invoice"]["id"]
        r = requests.get(f"{API}/gst/invoices/{inv_id}/pdf", timeout=60)
        assert r.status_code == 200
        text = self._pdf_text(r.content)
        assert "PAID" in text.upper()


# ============================================================
# Regression — Auth + critical flows still work
# ============================================================

class TestRegression:
    def test_super_admin_login(self):
        r = requests.post(f"{API}/admin/login-password",
                          json={"user_id": "asrenterprisespatna@gmail.com", "password": "Abhi@9745",
                                "direct_login": True}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("success") is True

    def test_anamika_login(self):
        r = requests.post(f"{API}/staff/login-email",
                          json={"email": "anamikarathod1905@gmail.com", "password": "anamika@123"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("success") is True

    def test_reminders_router_wired(self):
        r = requests.get(f"{API}/gst/reminders/status", timeout=10)
        assert r.status_code == 200

    def test_dashboard_router_wired(self):
        r = requests.get(f"{API}/gst/dashboard", timeout=10)
        assert r.status_code == 200
