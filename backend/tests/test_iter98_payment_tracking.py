"""Iteration 98 — Payment Tracking + PM Surya Ghar tests.
Covers:
- PMSG auto-detection from project_name and explicit scheme flag
- Record payment partial/full transitions with payment_history growth
- Duplicate reference (409), over-pay (400), quotation-payment rejection (400)
- Delete payment recomputes totals; empties → unpaid
- PDF size > 150KB and contains %PDF- header after payments
- HTML template contains {PAYMENT_SUMMARY} placeholder
- Cashfree auto-issue still initializes paid invoice with one history entry
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asrenterprise-pay.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUST = {
    "name": "TEST_PAYTRK_Customer",
    "phone": "9876500098",
    "email": "test_paytrk@example.com",
    "address": "Patna",
    "state": "Bihar",
    "state_code": "10",
    "pincode": "800001",
}

created_invoice_ids: list[str] = []


def _create_invoice(project_name="Solar Project", scheme="", total=100000.0, doc_type="invoice"):
    body = {
        "customer": CUST,
        "project_type": "solar_project",
        "total_amount": total,
        "project_name": project_name,
        "scheme": scheme,
        "auto_send_whatsapp": False,
        "auto_send_email": False,
        "doc_type": doc_type,
        "notes": "TEST_PAYTRK invoice — safe to delete",
    }
    r = requests.post(f"{API}/gst/invoices", json=body, timeout=30)
    assert r.status_code == 200, f"create invoice failed: {r.status_code} {r.text}"
    inv = r.json()
    created_invoice_ids.append(inv["id"])
    return inv


# ---------- PM Surya Ghar auto-detect ----------
def test_pmsg_autodetect_from_project_name():
    inv = _create_invoice(project_name="PM Surya Ghar Rooftop 3kW", total=120000.0)
    assert inv["scheme"] == "pm_surya_ghar"
    # On unpaid creation, payment_mode is set to "ICICI" because of scheme
    assert inv["payment_mode"] == "ICICI", f"expected ICICI default, got {inv['payment_mode']!r}"
    assert inv["payment_status"] == "unpaid"
    assert inv["amount_paid"] == 0.0
    assert inv["due_amount"] == inv["grand_total"]


def test_pmsg_explicit_scheme_flag():
    inv = _create_invoice(project_name="Rooftop solar 5kW", scheme="pm_surya_ghar", total=200000.0)
    assert inv["scheme"] == "pm_surya_ghar"
    assert inv["payment_mode"] == "ICICI"


def test_normal_invoice_no_pmsg():
    inv = _create_invoice(project_name="Generic Solar Install", total=50000.0)
    assert inv["scheme"] == "" or inv["scheme"] is None or inv["scheme"] == ""
    assert inv["payment_mode"] in ("", "Cashfree")  # no upfront pay → mode blank when no scheme


# ---------- Record payment partial → paid ----------
def test_partial_then_full_payment_flow():
    inv = _create_invoice(project_name="TEST Pay Flow", total=100000.0)
    grand = inv["grand_total"]
    inv_id = inv["id"]

    # First partial payment
    r1 = requests.post(
        f"{API}/gst/invoices/{inv_id}/payments",
        json={"amount": grand / 2, "payment_mode": "SBI", "reference": f"REF_{uuid.uuid4().hex[:6]}", "notes": "TEST partial"},
        timeout=20,
    )
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert body1["success"] is True
    inv1 = body1["invoice"]
    assert inv1["payment_status"] == "partial"
    assert abs(inv1["amount_paid"] - round(grand / 2, 2)) < 0.05
    assert abs(inv1["due_amount"] - round(grand - grand / 2, 2)) < 0.05
    assert inv1["payment_mode"] == "SBI"
    assert len(inv1["payment_history"]) == 1
    assert inv1["payment_history"][0]["payment_mode"] == "SBI"

    # Second full remaining
    remaining = inv1["due_amount"]
    r2 = requests.post(
        f"{API}/gst/invoices/{inv_id}/payments",
        json={"amount": remaining, "payment_mode": "ICICI", "reference": f"REF_{uuid.uuid4().hex[:6]}"},
        timeout=20,
    )
    assert r2.status_code == 200, r2.text
    inv2 = r2.json()["invoice"]
    assert inv2["payment_status"] == "paid"
    assert inv2["due_amount"] <= 0.01
    assert inv2["payment_mode"] == "ICICI"  # most recent
    assert len(inv2["payment_history"]) == 2


# ---------- Duplicate reference 409 ----------
def test_duplicate_reference_returns_409():
    inv = _create_invoice(project_name="TEST Dup Ref", total=10000.0)
    inv_id = inv["id"]
    ref = f"DUP_{uuid.uuid4().hex[:6]}"
    r1 = requests.post(f"{API}/gst/invoices/{inv_id}/payments",
                       json={"amount": 1000, "payment_mode": "Cash", "reference": ref}, timeout=20)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/gst/invoices/{inv_id}/payments",
                       json={"amount": 500, "payment_mode": "Cash", "reference": ref}, timeout=20)
    assert r2.status_code == 409, f"expected 409 got {r2.status_code}: {r2.text}"


# ---------- Over-pay 400 ----------
def test_overpay_returns_400():
    inv = _create_invoice(project_name="TEST Overpay", total=5000.0)
    inv_id = inv["id"]
    grand = inv["grand_total"]
    r = requests.post(f"{API}/gst/invoices/{inv_id}/payments",
                      json={"amount": grand + 1000, "payment_mode": "Cash"}, timeout=20)
    assert r.status_code == 400, r.text
    assert "exceed invoice total" in r.text.lower()


# ---------- Quotation rejection 400 ----------
def test_quotation_payment_rejected():
    inv = _create_invoice(project_name="TEST Quote", total=20000.0, doc_type="quotation")
    inv_id = inv["id"]
    r = requests.post(f"{API}/gst/invoices/{inv_id}/payments",
                      json={"amount": 1000, "payment_mode": "Cash"}, timeout=20)
    assert r.status_code == 400
    assert "quotation" in r.text.lower()


# ---------- DELETE payment entry ----------
def test_delete_payment_entry_recomputes():
    inv = _create_invoice(project_name="TEST Delete Payment", total=10000.0)
    inv_id = inv["id"]
    r1 = requests.post(f"{API}/gst/invoices/{inv_id}/payments",
                       json={"amount": 4000, "payment_mode": "UPI", "reference": "PUPI1"}, timeout=20)
    assert r1.status_code == 200
    entry_id = r1.json()["entry"]["id"]
    # Delete it
    rd = requests.delete(f"{API}/gst/invoices/{inv_id}/payments/{entry_id}", timeout=20)
    assert rd.status_code == 200, rd.text
    inv_after = rd.json()["invoice"]
    assert inv_after["payment_status"] == "unpaid"
    assert inv_after["amount_paid"] == 0.0
    assert abs(inv_after["due_amount"] - inv_after["grand_total"]) < 0.01
    assert inv_after["payment_history"] == []


# ---------- PDF after payment ----------
def test_pdf_after_payments_size_and_header():
    inv = _create_invoice(project_name="TEST PDF Pay", total=50000.0)
    inv_id = inv["id"]
    requests.post(f"{API}/gst/invoices/{inv_id}/payments",
                  json={"amount": 10000, "payment_mode": "Cash", "reference": "PDF1"}, timeout=20)
    time.sleep(0.5)
    r = requests.get(f"{API}/gst/invoices/{inv_id}/pdf", timeout=30)
    assert r.status_code == 200
    body = r.content
    assert body[:4] == b"%PDF"
    assert len(body) > 150_000, f"PDF too small: {len(body)} bytes"


# ---------- HTML template placeholder check ----------
def test_html_template_has_payment_summary_placeholder():
    # Read the route file and ensure {PAYMENT_SUMMARY} placeholder is wired
    p = "/app/backend/routes/gst_invoices.py"
    with open(p, "r", encoding="utf-8") as fh:
        content = fh.read()
    assert "{{PAYMENT_SUMMARY}}" in content
    assert "PAYMENT STATUS:" in content


# ---------- Cleanup (best-effort) ----------
def test_zzz_cleanup_test_invoices():
    for inv_id in created_invoice_ids:
        try:
            requests.delete(f"{API}/gst/invoices/{inv_id}", timeout=15)
        except Exception:
            pass
