"""
Tests for the 2026-04-26 policy changes:

1. PM Surya Ghar Yojana invoices ALWAYS use flat 5% GST (never 90/10 split).
2. New invoices DO NOT auto-send WhatsApp/Email by default — admin sends
   manually from CRM. Only Cashfree-confirmed shop_order invoices auto-send.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.gst_invoices import (  # noqa: E402
    CreateInvoiceRequest,
    InvoiceCustomer,
    build_line_items,
    compute_gst,
)


def _customer():
    return InvoiceCustomer(
        name="Test Customer", phone="9999999999", state="Bihar", state_code="10"
    )


def test_pmsg_explicit_scheme_uses_flat_5_via_create_request():
    # When scheme=pm_surya_ghar and project_type=solar_project (default), the
    # caller should be effectively flipped to solar_project_flat_5.
    req = CreateInvoiceRequest(
        customer=_customer(),
        project_type="solar_project",
        total_amount=100_000,
        scheme="pm_surya_ghar",
        project_name="3 kW PMSG",
    )
    # Simulate the override that _create_and_persist_invoice performs at the top
    if (req.scheme or "").lower() == "pm_surya_ghar" and req.project_type == "solar_project":
        req.project_type = "solar_project_flat_5"
    items = build_line_items(req)
    rates = sorted({float(it.gst_rate) for it in items})
    assert rates == [5.0], f"expected only 5% GST for PMSG, got {rates}"
    gst = compute_gst(items, "Bihar")
    # 5% on 1L → 5000 → split 2500/2500 CGST/SGST → grand 1,05,000
    assert abs(gst["grand_total"] - 105000.0) < 0.5


def test_pmsg_autodetected_from_project_name_uses_flat_5():
    # If scheme blank but project name says "PM Surya Ghar", policy still kicks in.
    req = CreateInvoiceRequest(
        customer=_customer(),
        project_type="solar_project",
        total_amount=200_000,
        project_name="3 kW Solar Rooftop System (PM Surya Ghar Yojana)",
    )
    hint = f"{req.project_name or ''} {req.notes or ''}".lower()
    auto_pmsg = ("pm surya ghar" in hint) or ("pmsurya" in hint) or ("surya ghar" in hint)
    if auto_pmsg and req.project_type == "solar_project":
        req.project_type = "solar_project_flat_5"
    items = build_line_items(req)
    rates = sorted({float(it.gst_rate) for it in items})
    assert rates == [5.0]


def test_non_pmsg_solar_project_keeps_90_10_split():
    req = CreateInvoiceRequest(
        customer=_customer(),
        project_type="solar_project",
        total_amount=100_000,
        project_name="Commercial 50 kW EPC",
    )
    items = build_line_items(req)
    rates = sorted({float(it.gst_rate) for it in items})
    # Non-PMSG = 90/10 → 5% AND 18% lines
    assert 5.0 in rates and 18.0 in rates


def test_default_auto_send_is_false():
    """The CreateInvoiceRequest defaults must not auto-send to customer or CA."""
    req = CreateInvoiceRequest(customer=_customer(), project_type="solar_goods", total_amount=1000)
    assert req.auto_send_whatsapp is False
    assert req.auto_send_email is False
