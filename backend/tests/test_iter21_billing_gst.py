"""
Iter21 — P0 BILLING BUG FIX: GST-inclusive shop invoice generation.

Customer paid ₹152 for a Polycab cable (GST-inclusive @18%) but the
auto-generated invoice showed ₹159.60 (5% GST added on top, double-charge).
The fix backs-calculates taxable from the inclusive line price using each
product's per-product gst_rate.

Coverage:
 1. GET /api/shop/products returns per-product gst_rate / hsn_sac / is_gst_inclusive
 2. POST /api/shop/products accepts and stores gst_rate/hsn_sac/is_gst_inclusive
 3. PUT  /api/shop/products/{id} preserves gst_rate
 4. P0  invoice_auto_issue_from_payment for a 18%-inclusive ₹152 cable order
 5. P0  invoice_auto_issue_from_payment for a 5%-inclusive ₹1000 panel order
 6. P0  invoice_auto_issue_from_payment for a MIXED cart 5% + 18% (₹652 total)
 7. REGRESSION: project_type='service' still NON-inclusive (18% on top)
 8. REGRESSION: project_type='solar_project' still uses internal split with 5%/18%
"""
import os
import sys
import uuid
import asyncio
import requests
import pytest
from decimal import Decimal

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asrenterprise-pay.preview.emergentagent.com").rstrip("/")
ADMIN_HEADERS = {"x-staff-id": "ASR1001", "x-admin-name": "ABHIJEET KUMAR", "Content-Type": "application/json"}

# Make backend importable for in-process tests of the internal helper
sys.path.insert(0, "/app/backend")


# --------------------------- 1) GET /shop/products ---------------------------
class TestProductSchema:
    def test_products_have_gst_fields(self):
        r = requests.get(f"{BASE_URL}/api/shop/products", timeout=15)
        assert r.status_code == 200, r.text
        products = r.json()
        assert isinstance(products, list) and len(products) > 0, "no products in shop"

        solar_keywords = ("panel", "inverter", "battery", "mc4", "mounting")
        cable_keywords = ("cable", "polycab", "amc", "service")

        ok_5_count = 0
        ok_18_count = 0
        for p in products:
            assert "gst_rate" in p, f"missing gst_rate in {p.get('name')}"
            assert "hsn_sac" in p, f"missing hsn_sac in {p.get('name')}"
            assert "is_gst_inclusive" in p, f"missing is_gst_inclusive in {p.get('name')}"
            assert p["is_gst_inclusive"] is True, f"{p['name']} should be GST-inclusive"
            assert p["gst_rate"] in (5, 5.0, 18, 18.0), f"unexpected gst_rate on {p['name']}: {p['gst_rate']}"

            nm = (p.get("name") or "").lower()
            if any(k in nm for k in solar_keywords) and not any(k in nm for k in cable_keywords):
                if float(p["gst_rate"]) == 5.0:
                    ok_5_count += 1
            if any(k in nm for k in cable_keywords):
                if float(p["gst_rate"]) == 18.0:
                    ok_18_count += 1

        # At least one of each rate class should exist
        assert ok_5_count >= 1, "no 5%-rated solar products found"
        # cables/AMC may be 0 in seed data — only assert if any cable-named product exists
        cable_products = [p for p in products if any(k in (p.get("name") or "").lower() for k in cable_keywords)]
        if cable_products:
            assert ok_18_count >= 1, f"cable/AMC products exist but none at 18%: {[(p['name'], p['gst_rate']) for p in cable_products]}"


# --------------------------- 2&3) POST + PUT product CRUD ---------------------
class TestProductCRUD:
    created_id = None

    def test_create_product_with_gst_fields(self):
        payload = {
            "name": f"TEST_iter21_cable_{uuid.uuid4().hex[:6]}",
            "description": "Test cable",
            "category": "accessory",
            "price": 99.0,
            "stock": 10,
            "gst_rate": 18.0,
            "hsn_sac": "8544",
            "is_gst_inclusive": True,
        }
        r = requests.post(f"{BASE_URL}/api/shop/products", headers=ADMIN_HEADERS, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        prod = data.get("product") or data
        assert prod["gst_rate"] == 18.0
        assert prod["hsn_sac"] == "8544"
        assert prod["is_gst_inclusive"] is True
        TestProductCRUD.created_id = prod["id"]

        # Verify persistence
        g = requests.get(f"{BASE_URL}/api/shop/products/{prod['id']}", timeout=10)
        assert g.status_code == 200
        gp = g.json()
        assert gp["gst_rate"] == 18.0
        assert gp["hsn_sac"] == "8544"
        assert gp["is_gst_inclusive"] is True

    def test_update_preserves_gst_rate(self):
        assert TestProductCRUD.created_id, "create test must run first"
        pid = TestProductCRUD.created_id
        # Update an unrelated field — gst_rate must remain 18
        r = requests.put(
            f"{BASE_URL}/api/shop/products/{pid}",
            headers=ADMIN_HEADERS,
            json={"description": "updated description"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/shop/products/{pid}", timeout=10)
        assert g.status_code == 200
        gp = g.json()
        assert gp["gst_rate"] == 18.0, "PUT must not clobber gst_rate"
        assert gp["description"] == "updated description"

    def test_zz_cleanup(self):
        if TestProductCRUD.created_id:
            requests.delete(f"{BASE_URL}/api/shop/products/{TestProductCRUD.created_id}",
                            headers=ADMIN_HEADERS, timeout=10)


# ------------- 4-6) P0 BILLING BUG: invoice_auto_issue_from_payment ----------
@pytest.fixture(scope="module")
def invoice_helper():
    """Import the internal helper + db + compute_gst from the running backend module."""
    from routes.gst_invoices import invoice_auto_issue_from_payment, compute_gst, InvoiceLineItem
    from db_client import get_db
    return {
        "fn": invoice_auto_issue_from_payment,
        "compute_gst": compute_gst,
        "InvoiceLineItem": InvoiceLineItem,
        "db": get_db(),
    }


async def _run_shop_invoice_scenario(helper, *, items, total_amount):
    """Insert a fake shop order + invoke auto-issue + return the persisted invoice."""
    db = helper["db"]
    cf_id = f"TEST_iter21_{uuid.uuid4().hex[:10]}"
    order_id = f"TEST_iter21_ord_{uuid.uuid4().hex[:8]}"
    await db.orders.insert_one({
        "id": order_id,
        "order_number": order_id,
        "cashfree_order_id": cf_id,
        "items": items,
        "total_amount": total_amount,
        "status": "paid",
    })
    fake_payment = {
        "order_id": cf_id,
        "cashfree_order_id": cf_id,
        "shop_order_id": order_id,
        "payment_type": "shop_order",
        "payment_amount_received": total_amount,
        "amount": total_amount,
        "customer_name": "Test Customer",
        "customer_phone": "9999900000",
        "customer_state": "Bihar",
        "customer_state_code": "10",
    }
    inv = await helper["fn"](fake_payment)
    # Cleanup the test order; leave invoice for follow-up GET-by-id assertion
    await db.orders.delete_one({"id": order_id})
    return inv, cf_id


def test_p0_polycab_cable_152_18pct(invoice_helper):
    """₹152 GST-inclusive cable @18% → grand_total exactly 152.00 (NOT 159.60)."""
    items = [{
        "product_id": "TEST_polycab_cable",
        "product_name": "Polycab Solar Cable 4mm 100m",
        "quantity": 2,
        "unit_price": 76.0,
        "total_price": 152.0,
        "gst_rate": 18.0,
        "hsn_sac": "8544",
    }]
    inv, cf_id = asyncio.get_event_loop().run_until_complete(
        _run_shop_invoice_scenario(invoice_helper, items=items, total_amount=152.0)
    )
    assert inv is not None, "invoice_auto_issue_from_payment returned None"
    gt = round(float(inv["grand_total"]), 2)
    assert gt == 152.00, f"P0 BUG: expected grand_total=152.00, got {gt} (subtotal={inv.get('subtotal')}, cgst={inv.get('cgst_total')}, sgst={inv.get('sgst_total')})"
    sub = round(float(inv["subtotal"]), 2)
    assert abs(sub - 128.81) <= 0.02, f"expected subtotal≈128.81, got {sub}"
    gst_total = round(float(inv["cgst_total"]) + float(inv["sgst_total"]) + float(inv.get("igst_total", 0)), 2)
    assert abs(gst_total - 23.19) <= 0.02, f"expected total GST≈23.19, got {gst_total}"
    # Per-line gst_rate respected
    li = inv["line_items"][0]
    assert float(li["gst_rate"]) == 18.0
    # Note: compute_gst flips gst_inclusive to False AFTER back-calculating
    # so subsequent calls (e.g. PDF regenerate) don't double-process. The
    # taxable_value being 128.81 below proves the flag did its job.
    assert li.get("gst_inclusive") is False
    # taxable_value must have been overwritten with back-calculated number
    assert abs(float(li["taxable_value"]) - 128.81) <= 0.02, f"line taxable_value not back-calculated: {li['taxable_value']}"

    # Cleanup
    asyncio.get_event_loop().run_until_complete(
        invoice_helper["db"].invoices.delete_one({"cashfree_order_id": cf_id})
    )


def test_p0_solar_panel_1000_5pct(invoice_helper):
    """₹1000 GST-inclusive solar panel @5% → grand_total exactly 1000.00."""
    items = [{
        "product_id": "TEST_waaree_panel",
        "product_name": "Waaree Solar Panel 540W",
        "quantity": 1,
        "unit_price": 1000.0,
        "total_price": 1000.0,
        "gst_rate": 5.0,
        "hsn_sac": "8541",
    }]
    inv, cf_id = asyncio.get_event_loop().run_until_complete(
        _run_shop_invoice_scenario(invoice_helper, items=items, total_amount=1000.0)
    )
    assert inv is not None
    gt = round(float(inv["grand_total"]), 2)
    assert gt == 1000.00, f"expected 1000.00, got {gt}"
    sub = round(float(inv["subtotal"]), 2)
    assert abs(sub - 952.38) <= 0.02, f"expected subtotal≈952.38, got {sub}"
    gst_total = round(float(inv["cgst_total"]) + float(inv["sgst_total"]) + float(inv.get("igst_total", 0)), 2)
    assert abs(gst_total - 47.62) <= 0.02, f"expected GST≈47.62, got {gst_total}"
    asyncio.get_event_loop().run_until_complete(
        invoice_helper["db"].invoices.delete_one({"cashfree_order_id": cf_id})
    )


def test_p0_mixed_cart_5pct_and_18pct(invoice_helper):
    """Mixed: Panel ₹500 (5%, incl) + Cable ₹152 (18%, incl) → grand_total exactly 652.00."""
    items = [
        {
            "product_id": "TEST_panel_mix",
            "product_name": "Solar Panel 250W",
            "quantity": 1, "unit_price": 500.0, "total_price": 500.0,
            "gst_rate": 5.0, "hsn_sac": "8541",
        },
        {
            "product_id": "TEST_cable_mix",
            "product_name": "Polycab Cable 4mm",
            "quantity": 2, "unit_price": 76.0, "total_price": 152.0,
            "gst_rate": 18.0, "hsn_sac": "8544",
        },
    ]
    inv, cf_id = asyncio.get_event_loop().run_until_complete(
        _run_shop_invoice_scenario(invoice_helper, items=items, total_amount=652.0)
    )
    assert inv is not None
    gt = round(float(inv["grand_total"]), 2)
    assert gt == 652.00, f"expected mixed cart grand_total=652.00, got {gt}"
    # Verify per-line gst_rate preserved
    rates = sorted(float(li["gst_rate"]) for li in inv["line_items"])
    assert rates == [5.0, 18.0], f"per-line GST rates not respected: {rates}"
    # Subtotal = 500/1.05 + 152/1.18 = 476.19 + 128.81 = 605.00
    sub = round(float(inv["subtotal"]), 2)
    assert abs(sub - 605.00) <= 0.05, f"expected subtotal≈605.00, got {sub}"
    asyncio.get_event_loop().run_until_complete(
        invoice_helper["db"].invoices.delete_one({"cashfree_order_id": cf_id})
    )


# ------------------------- 7-8) Regression: non-shop flows --------------------
def test_regression_service_18pct_on_top(invoice_helper):
    """compute_gst with non-inclusive 18% service → GST added ON TOP."""
    Item = invoice_helper["InvoiceLineItem"]
    items = [Item(
        description="Solar Service Visit", hsn_sac="9954",
        quantity=1.0, unit_price=1000.0, taxable_value=1000.0,
        gst_rate=18.0, kind="service", gst_inclusive=False,
    )]
    out = invoice_helper["compute_gst"](items, "Bihar")
    assert round(out["subtotal"], 2) == 1000.00
    assert round(out["grand_total"], 2) == 1180.00, f"service regression: expected 1180, got {out['grand_total']}"
    assert round(out["cgst_total"] + out["sgst_total"], 2) == 180.00


def test_regression_solar_project_split(invoice_helper):
    """solar_project must still produce a 90/10 (or 70/30) goods+service split with 5%+18%."""
    from routes.gst_invoices import build_line_items, CreateInvoiceRequest, InvoiceCustomer
    req = CreateInvoiceRequest(
        customer=InvoiceCustomer(name="Cust", phone="9999900000", state="Bihar"),
        project_type="solar_project",
        total_amount=100000.0,
        project_name="Test EPC 5kW",
    )
    items = build_line_items(req)
    assert len(items) == 2, "solar_project must produce 2 line items (goods+service)"
    rates = sorted(it.gst_rate for it in items)
    assert rates == [5.0, 18.0], f"solar_project must mix 5% goods + 18% service, got {rates}"
    for it in items:
        assert it.gst_inclusive is False, "solar_project lines must be NON-inclusive (GST on top)"
    out = invoice_helper["compute_gst"](items, "Bihar")
    # Subtotal must equal the original total (no back-calc since non-inclusive)
    assert round(out["subtotal"], 2) == 100000.00
    # Grand total > subtotal (GST added on top, no regression to inclusive)
    assert out["grand_total"] > out["subtotal"], "solar_project regression: GST not added on top"
