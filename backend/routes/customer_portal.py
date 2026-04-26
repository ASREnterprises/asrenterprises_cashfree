"""
Customer-facing Billing & Portal endpoints.

All endpoints require the customer's mobile number (10-digit) — lightweight
read access, never mutates billing data directly. Designed for the
CustomerPortal React component at /customer/portal.

Endpoints (mounted under /api/customer):
  GET  /invoices/{phone}        → all invoices + KPI summary for that number
  GET  /invoices/{phone}/{id}/upi     → per-invoice UPI link + QR PNG base64
  GET  /invoices/{phone}/{id}/pdf     → invoice PDF stream
  POST /invoices/{phone}/{id}/reminder → customer-initiated "remind me" log
  GET  /referral/{phone}        → referral link + stats for this customer
  POST /referral/{phone}/track  → log a visit (public)
  GET  /documents/{phone}       → list invoice/warranty/certificate downloads
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone, date
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from db_client import get_db

router = APIRouter(prefix="/customer", tags=["Customer Portal"])
logger = logging.getLogger(__name__)
db = get_db()


# ---- 5-year Free Installation Warranty (ASR standard) ----
INSTALLATION_WARRANTY_YEARS = 5


def _parse_install_date(value) -> Optional[date]:
    """Accept ISO strings, date-only strings, or datetime objects."""
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        s = str(value).strip()
        # Handle 'YYYY-MM-DD' and full ISO datetime
        if "T" in s:
            s = s.split("T", 1)[0]
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _compute_warranty(install_date_value) -> Dict:
    """Return {expired, remaining_years, remaining_months, remaining_label,
    total_years, install_date, expires_on}. Accepts str or date."""
    d = _parse_install_date(install_date_value)
    total = INSTALLATION_WARRANTY_YEARS
    if not d:
        return {
            "has_installation_date": False,
            "total_years": total,
            "expired": False,
            "remaining_years": 0,
            "remaining_months": 0,
            "remaining_label": "Awaiting installation",
            "install_date": "",
            "expires_on": "",
        }
    today = date.today()
    try:
        expires = d.replace(year=d.year + total)
    except ValueError:
        # 29-Feb edge — fall back to 28-Feb
        expires = d.replace(year=d.year + total, day=28)
    delta_days = (expires - today).days
    expired = delta_days <= 0
    if expired:
        return {
            "has_installation_date": True,
            "total_years": total,
            "expired": True,
            "remaining_years": 0,
            "remaining_months": 0,
            "remaining_label": "Warranty Expired",
            "install_date": d.isoformat(),
            "expires_on": expires.isoformat(),
        }
    years = delta_days // 365
    months = (delta_days % 365) // 30
    label_parts = []
    if years:
        label_parts.append(f"{years} Year{'s' if years != 1 else ''}")
    if months:
        label_parts.append(f"{months} Month{'s' if months != 1 else ''}")
    if not label_parts:
        label_parts.append(f"{delta_days} Days")
    return {
        "has_installation_date": True,
        "total_years": total,
        "expired": False,
        "remaining_years": years,
        "remaining_months": months,
        "remaining_label": " ".join(label_parts),
        "install_date": d.isoformat(),
        "expires_on": expires.isoformat(),
    }


def _clean_phone(phone: str) -> str:
    """Return a 10-digit Indian mobile (no country code). '' if invalid."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) == 10 and digits[0] in "6789":
        return digits
    return ""


def _public_invoice(inv: dict) -> dict:
    """Strip internal fields & shape for the customer UI."""
    grand = float(inv.get("grand_total") or 0)
    paid = float(inv.get("amount_paid") or 0)
    due = float(inv.get("due_amount") or max(0.0, grand - paid))
    return {
        "id": inv.get("id"),
        "invoice_number": inv.get("invoice_number"),
        "invoice_date": inv.get("invoice_date"),
        "doc_type": inv.get("doc_type", "invoice"),
        "project_type": inv.get("project_type", ""),
        "scheme": inv.get("scheme", ""),
        "total_amount": grand,
        "amount_paid": paid,
        "due_amount": due,
        "payment_status": inv.get("payment_status") or "unpaid",
        "payment_mode": inv.get("payment_mode", ""),
        "payment_date": inv.get("payment_date", ""),
        "status": inv.get("status", "active"),
        "line_items_count": len(inv.get("line_items") or []),
        "created_at": inv.get("created_at"),
        "paid_at": inv.get("paid_at", ""),
        "reminder_count": len(inv.get("reminders_sent") or []),
        "last_reminder_at": (
            (inv.get("reminders_sent") or [{}])[-1].get("sent_at", "")
            if inv.get("reminders_sent") else ""
        ),
    }


# ==================== INVOICES ====================
async def _ensure_invoice_for_customer(cust: dict) -> Optional[dict]:
    """Self-healing: if a customer has `total_cost > 0` but no invoice in
    `db.invoices`, auto-create one on-the-fly so the Billing tab always has
    something to show. Runs best-effort; never blocks the portal load."""
    mobile = cust.get("mobile") or ""
    total = float(cust.get("total_cost") or 0)
    if total <= 0 or not mobile:
        return None
    existing = await db.invoices.find_one(
        {"customer.phone": mobile, "doc_type": "invoice"},
        {"_id": 0, "id": 1}
    )
    if existing:
        return None
    try:
        from routes.gst_invoices import (
            _create_and_persist_invoice,
            CreateInvoiceRequest,
            InvoiceCustomer,
        )
        is_pmsg = (cust.get("customer_type") or "").lower() == "residential"
        # PM Surya Ghar Yojana invoices ALWAYS use flat 5% GST.
        # Non-PMSG (commercial) customers keep the 90/10 Full EPC split (6.3%).
        if is_pmsg:
            project_type_for_invoice = "solar_project_flat_5"
            WEIGHTED_RATE = 0.05  # flat 5%
        else:
            project_type_for_invoice = "solar_project"
            WEIGHTED_RATE = 0.90 * 0.05 + 0.10 * 0.18  # 6.3%
        pre_gst_total = round(total / (1 + WEIGHTED_RATE), 2)
        req = CreateInvoiceRequest(
            customer=InvoiceCustomer(
                name=cust.get("name") or "Customer",
                phone=mobile,
                address=cust.get("address") or "",
                state="Bihar",
                state_code="10",
            ),
            project_type=project_type_for_invoice,
            total_amount=pre_gst_total,
            project_name=(
                f"{cust.get('system_capacity_kw') or ''} kW Solar Rooftop System"
                + (" (PM Surya Ghar Yojana)" if is_pmsg else "")
            ).strip(),
            notes=(
                f"Auto-generated (backfill). Application ID: {cust.get('application_id') or '—'}"
                if is_pmsg else "Auto-generated (backfill)."
            ),
            auto_send_whatsapp=False,
            auto_send_email=False,
            doc_type="invoice",
            scheme="pm_surya_ghar" if is_pmsg else "",
        )
        inv = await _create_and_persist_invoice(req)

        # Back-fill initial payment so grand/paid/due stay consistent with the customer doc
        paid = float(cust.get("amount_paid") or 0)
        if paid > 0 and inv.get("grand_total"):
            grand = float(inv["grand_total"])
            paid_clamped = min(paid, grand)
            new_due = max(0.0, round(grand - paid_clamped, 2))
            new_status = "paid" if paid_clamped + 0.01 >= grand else "partial"
            entry = {
                "id": str(uuid.uuid4()),
                "amount": round(paid_clamped, 2),
                "payment_mode": cust.get("payment_mode") or ("ICICI" if is_pmsg else "SBI"),
                "payment_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "reference": "",
                "notes": "Backfilled from customer record on portal load",
                "recorded_by": "system:portal-backfill",
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.invoices.update_one(
                {"id": inv["id"]},
                {
                    "$set": {
                        "amount_paid": round(paid_clamped, 2),
                        "due_amount": new_due,
                        "payment_status": new_status,
                        "payment_date": entry["payment_date"],
                        "payment_mode": entry["payment_mode"],
                        "paid_at": datetime.now(timezone.utc).isoformat() if new_status == "paid" else "",
                    },
                    "$push": {"payment_history": entry},
                },
            )
            inv["amount_paid"] = round(paid_clamped, 2)
            inv["due_amount"] = new_due
            inv["payment_status"] = new_status

        await db.customers.update_one(
            {"mobile": mobile},
            {"$addToSet": {"invoice_ids": inv["id"]}},
        )
        logger.info(f"[portal] backfilled invoice for legacy customer {mobile}")
        return inv
    except Exception as e:
        logger.warning(f"[portal] backfill invoice failed for {mobile}: {e}")
        return None


@router.get("/invoices/{phone}")
async def customer_invoices(phone: str):
    """All invoices + quick KPI for the customer's dashboard.

    Source-of-truth hierarchy for the KPI:
      1) Customer doc's `total_cost / amount_paid / due_amount` when set
      2) Sum of invoices otherwise

    Self-heals legacy customers (total_cost > 0 but no invoice) by
    auto-generating the missing invoice so the UI always has one to render.
    """
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")

    cust = await db.customers.find_one({"mobile": clean}, {"_id": 0}) or {}

    # Self-heal: create an invoice if the customer has a total_cost but none on file
    await _ensure_invoice_for_customer(cust)

    cursor = db.invoices.find(
        {"customer.phone": clean},
        {"_id": 0}
    ).sort("created_at", -1)
    items = [_public_invoice(i) async for i in cursor]
    invoices = [i for i in items if i["doc_type"] == "invoice"]
    quotations = [i for i in items if i["doc_type"] == "quotation"]

    # Prefer the customer-doc financials (admin-entered, GST-inclusive) over
    # pure invoice aggregation so legacy customers never see ₹0 again.
    cust_total = float(cust.get("total_cost") or 0)
    cust_paid = float(cust.get("amount_paid") or 0)
    cust_due = float(cust.get("due_amount") if cust.get("due_amount") is not None
                     else max(0.0, cust_total - cust_paid))

    inv_total = sum(i["total_amount"] for i in invoices)
    inv_paid = sum(i["amount_paid"] for i in invoices)
    inv_due = sum(i["due_amount"] for i in invoices)

    total_cost = cust_total if cust_total > 0 else inv_total
    total_paid = cust_paid if cust_total > 0 else inv_paid
    total_due = cust_due if cust_total > 0 else inv_due

    unpaid_count = sum(1 for i in invoices if i["payment_status"] != "paid")
    if total_cost <= 0:
        status = "none"
    elif total_due <= 0.01:
        status = "paid"
    elif total_paid > 0:
        status = "partial"
    else:
        status = "unpaid"

    return {
        "phone": clean,
        "kpi": {
            "total_cost": round(total_cost, 2),
            "total_paid": round(total_paid, 2),
            "total_due": round(total_due, 2),
            "payment_status": status,
            "invoices_count": len(invoices),
            "unpaid_count": unpaid_count if total_due > 0 else 0,
            "quotations_count": len(quotations),
            "customer_name": cust.get("name", ""),
            "customer_type": cust.get("customer_type", ""),
            "payment_mode": cust.get("payment_mode") or ("ICICI" if (cust.get("customer_type") or "").lower() == "residential" else "SBI"),
        },
        "invoices": invoices,
        "quotations": quotations,
    }


@router.get("/invoices/{phone}/{invoice_id}/upi")
async def customer_invoice_upi(phone: str, invoice_id: str):
    """Return UPI link + QR PNG (base64) for the "Pay Now" button."""
    from routes.gst_invoices import get_upi_for_invoice, build_upi_link, render_qr_png_bytes
    import base64

    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    inv = await db.invoices.find_one({"id": invoice_id, "customer.phone": clean}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found for this phone")
    if inv.get("payment_status") == "paid":
        return {"success": False, "error": "This invoice is fully paid.", "payment_status": "paid"}

    amount = float(inv.get("due_amount") or 0)
    if amount <= 0:
        amount = float(inv.get("grand_total") or 0)
    upi = get_upi_for_invoice(inv)
    link = build_upi_link(inv, amount)
    qr_png = render_qr_png_bytes(link, box=10, border=3)
    qr_b64 = base64.b64encode(qr_png).decode()
    return {
        "success": True,
        "invoice_number": inv.get("invoice_number"),
        "due_amount": round(amount, 2),
        "upi_link": link,
        "qr_data_uri": f"data:image/png;base64,{qr_b64}",
        "bank": upi["bank"],
        "vpa": upi["vpa"],
        "scheme": inv.get("scheme", ""),
    }


@router.get("/invoices/{phone}/{invoice_id}/pdf")
async def customer_invoice_pdf(phone: str, invoice_id: str):
    """Stream the invoice PDF. Scoped to the customer's phone so nobody can
    pull someone else's PDF by guessing ids."""
    from routes.gst_invoices import render_invoice_pdf, compute_gst, InvoiceLineItem, INVOICE_DIR
    from pathlib import Path

    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    inv = await db.invoices.find_one({"id": invoice_id, "customer.phone": clean}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found for this phone")

    pdf_path = Path(inv.get("pdf_path") or "")
    if pdf_path.exists():
        pdf_bytes = pdf_path.read_bytes()
    else:
        gst = compute_gst([InvoiceLineItem(**it) for it in inv["line_items"]], inv["customer"]["state"])
        pdf_bytes = render_invoice_pdf(inv, gst)
        try:
            safe = (inv.get("invoice_number") or inv["id"]).replace("/", "_")
            (INVOICE_DIR / f"{safe}.pdf").write_bytes(pdf_bytes)
        except Exception:
            pass
    filename = (inv.get("invoice_number") or "invoice").replace("/", "_") + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/invoices/{phone}/{invoice_id}/reminder")
async def customer_request_reminder(phone: str, invoice_id: str):
    """Customer-initiated 'remind me later' — logs intent only; does NOT spam
    the owner. A silent record that helps prioritise follow-up calls."""
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    inv = await db.invoices.find_one({"id": invoice_id, "customer.phone": clean}, {"_id": 0, "id": 1})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$push": {"reminders_sent": {
            "day": 0,  # 0 = customer-requested
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "result": "customer_pinged",
            "channel": "self",
            "manual": True,
            "source": "customer_portal",
        }}}
    )
    return {"success": True}


# ==================== REFERRAL ====================
@router.get("/referral/{phone}")
async def customer_referral(phone: str):
    """Return the customer's referral code + stats. Code is generated once
    and stored in the `crm_customers` collection for permanence.

    Reward (baseline): ₹1,000 cashback / service credit per successful
    install. Real payout is handled manually by the admin after verification.
    """
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    cust = await db.customers.find_one({"mobile": clean}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer profile not found. Please register first.")
    code = cust.get("referral_code")
    if not code:
        # Generate a 6-char code — first 3 of name (A-Z only) + last 4 of phone
        import re as _re
        name_part = (_re.sub(r"[^A-Z]", "", (cust.get("name") or "").upper()) + "XXX")[:3]
        code = f"{name_part}{clean[-4:]}"
        # Avoid collision
        if await db.customers.find_one({"referral_code": code, "mobile": {"$ne": clean}}, {"_id": 0}):
            code = code + uuid.uuid4().hex[:2].upper()
        await db.customers.update_one({"mobile": clean}, {"$set": {"referral_code": code}})

    # Count how many referrals this customer has brought in
    referred = await db.customers.count_documents({"referred_by_code": code})
    converted = await db.customers.count_documents({"referred_by_code": code, "application_status": {"$in": ["approved", "installed", "commissioned"]}})
    visits = await db.referral_visits.count_documents({"code": code})

    # Build shareable link using the website's frontend URL
    import os
    frontend_url = os.environ.get("FRONTEND_PUBLIC_URL", "https://asrenterprises.in").rstrip("/")
    link = f"{frontend_url}/?ref={code}"
    wa_text = (
        f"Hi! I've installed rooftop solar with ASR Enterprises Patna and I'm loving my zero-bill home. "
        f"You should try them — use my referral code *{code}* or book a free site visit here: {link}"
    )
    return {
        "code": code,
        "link": link,
        "whatsapp_share_link": f"https://wa.me/?text={_url_quote(wa_text)}",
        "stats": {
            "link_clicks": visits,
            "referrals": referred,
            "converted": converted,
            "reward_per_conversion": 1000,
            "reward_earned": converted * 1000,
        },
    }


@router.post("/referral/track/{code}")
async def track_referral_click(code: str):
    """Public: increment the click counter. Called from the homepage when a
    URL has `?ref=` in it."""
    now = datetime.now(timezone.utc).isoformat()
    await db.referral_visits.insert_one({"code": code.strip().upper()[:12], "visited_at": now})
    return {"ok": True}


def _url_quote(text: str) -> str:
    from urllib.parse import quote
    return quote(text, safe="")


# ==================== DOCUMENTS ====================
@router.get("/documents/{phone}")
async def customer_documents(phone: str):
    """List everything the customer can download — invoices, warranty cards,
    certificates, subsidy proof etc. Warranty/certificate documents live on the
    crm_customers doc under `documents[]` (added by admin via the CRM)."""
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    cust = await db.customers.find_one({"mobile": clean}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer profile not found.")

    # Invoices
    invoices = await db.invoices.find(
        {"customer.phone": clean, "doc_type": "invoice"},
        {"_id": 0, "id": 1, "invoice_number": 1, "invoice_date": 1, "grand_total": 1, "payment_status": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(None)

    documents = [
        {
            "type": "invoice",
            "label": f"Tax Invoice {i.get('invoice_number')}",
            "date": i.get("invoice_date") or i.get("created_at", "")[:10],
            "url": f"/api/customer/invoices/{clean}/{i['id']}/pdf",
            "meta": f"₹ {float(i.get('grand_total') or 0):,.2f} · {(i.get('payment_status') or 'unpaid').upper()}",
        }
        for i in invoices
    ]

    # Admin-attached documents (warranty cards, net-metering certs, inspection reports...)
    for d in (cust.get("documents") or []):
        documents.append({
            "type": d.get("type", "other"),
            "label": d.get("label") or d.get("name") or "Document",
            "date": d.get("date") or d.get("uploaded_at", "")[:10],
            "url": d.get("url"),
            "meta": d.get("description", ""),
        })

    # Synthetic entries for warranty data stored directly on the customer doc
    if cust.get("panel_warranty_years"):
        documents.append({
            "type": "warranty",
            "label": f"Panel Warranty — {cust.get('panel_warranty_years')} Years",
            "date": cust.get("installation_date", "")[:10] if cust.get("installation_date") else "",
            "url": "",
            "meta": f"Brand: {cust.get('solar_brand') or 'N/A'}",
        })
    if cust.get("inverter_warranty_years"):
        documents.append({
            "type": "warranty",
            "label": f"Inverter Warranty — {cust.get('inverter_warranty_years')} Years",
            "date": cust.get("installation_date", "")[:10] if cust.get("installation_date") else "",
            "url": "",
            "meta": f"Brand: {cust.get('inverter_brand') or 'N/A'}",
        })

    # Solar Agreements (PM Surya Ghar Yojana) — auto-generated on quotation create
    agreements = await db.agreements.find(
        {"customer_phone": clean}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    for a in agreements:
        # Include regenerated_at (or created_at) as a cache-buster so browsers
        # / WhatsApp viewers never serve a stale PDF after the template is
        # updated on the backend.
        v = a.get("regenerated_at") or a.get("created_at") or ""
        url = f"/api/agreements/{a['id']}/pdf"
        if v:
            url = f"{url}?v={v}"
        documents.append({
            "type": "agreement",
            "label": f"Solar Agreement — PM Surya Ghar Yojana (Quote {a.get('quotation_number', '')})".strip(" ()"),
            "date": (a.get("created_at") or "")[:10],
            "url": url,
            "meta": f"Scheme: PM Surya Ghar · {a.get('status', 'generated').title()}",
        })

    return {"phone": clean, "documents": documents}


# ==================== SERVICE REQUEST (simplified read) ====================
@router.get("/service-requests/{phone}")
async def customer_service_requests(phone: str):
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    cust = await db.customers.find_one({"mobile": clean}, {"_id": 0, "service_requests": 1})
    if not cust:
        return {"service_requests": []}
    return {"service_requests": cust.get("service_requests") or []}


# ==================== PROGRESS TRACKERS ====================
@router.get("/progress/{phone}")
async def customer_progress(phone: str):
    """Installation + subsidy progress trackers, derived from the customer doc."""
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    cust = await db.customers.find_one({"mobile": clean}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer profile not found")

    install_status = (cust.get("installation_status") or "").lower()
    app_status = (cust.get("application_status") or "").lower()
    nm_status = (cust.get("net_metering_status") or "").lower()

    # Installation stages
    install_stages = ["site_visit", "installation", "net_metering", "completed"]
    install_idx = -1
    if cust.get("site_visit_done") or install_status in ("site_visited", "site_visit_done"):
        install_idx = 0
    if cust.get("installation_date") or install_status == "installed":
        install_idx = max(install_idx, 1)
    if nm_status in ("approved", "active", "commissioned", "operational"):
        install_idx = max(install_idx, 2)
    if install_status in ("completed", "commissioned"):
        install_idx = 3
    # If the customer has an invoice marked paid for a solar_project, bump to "Installation" at minimum
    any_solar_paid = await db.invoices.find_one(
        {"customer.phone": clean, "doc_type": "invoice", "payment_status": "paid", "project_type": "solar_project"},
        {"_id": 0, "id": 1}
    )
    if any_solar_paid and install_idx < 1:
        install_idx = 1

    # Most important override: if an installation_date is recorded, treat the
    # installation as fully complete (100%) regardless of partial status flags.
    # Admins backdate installations — the date being set is the reliable signal.
    if cust.get("installation_date"):
        install_idx = 3

    # Subsidy stages
    subsidy_stages = ["applied", "approved", "credited"]
    subsidy_idx = -1
    if cust.get("application_id") or app_status in ("applied", "submitted", "under_review"):
        subsidy_idx = 0
    if app_status in ("approved", "sanctioned"):
        subsidy_idx = 1
    if (cust.get("subsidy_status") or "").lower() == "credited" or cust.get("subsidy_credited_date"):
        subsidy_idx = 2

    return {
        "installation": {
            "stages": install_stages,
            "current_index": install_idx,
            "current_label": install_stages[install_idx].replace("_", " ").title() if install_idx >= 0 else "Not Started",
            "installation_date": cust.get("installation_date", ""),
            "progress_percent": int(round(((install_idx + 1) / len(install_stages)) * 100)) if install_idx >= 0 else 0,
        },
        "subsidy": {
            "stages": subsidy_stages,
            "current_index": subsidy_idx,
            "current_label": subsidy_stages[subsidy_idx].title() if subsidy_idx >= 0 else "Not Applied",
            "application_id": cust.get("application_id", ""),
            "subsidy_amount": cust.get("subsidy_amount", 0),
            "credited_date": cust.get("subsidy_credited_date", ""),
        },
        "warranty": _compute_warranty(cust.get("installation_date")),
    }


# ==================== SERVICE REQUEST (pass-through, matches existing /customer/service-request body) ====================
class ServiceRequestBody(BaseModel):
    type: str = Field(..., min_length=2, max_length=40)  # cleaning | maintenance | repair | other
    description: str = Field(..., min_length=5, max_length=1000)


@router.post("/service-requests/{phone}")
async def create_service_request(phone: str, payload: ServiceRequestBody):
    """Create a new service request on the customer's CRM record.
    Complements the legacy /customer/service-request endpoint — this one is
    REST-style and returns the created entry."""
    clean = _clean_phone(phone)
    if not clean:
        raise HTTPException(400, "Invalid mobile number")
    cust = await db.customers.find_one({"mobile": clean}, {"_id": 0, "id": 1})
    if not cust:
        raise HTTPException(404, "Customer profile not found.")
    entry = {
        "id": str(uuid.uuid4()),
        "type": payload.type.strip().lower(),
        "description": payload.description.strip(),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "customer_portal",
    }
    await db.customers.update_one({"mobile": clean}, {"$push": {"service_requests": entry}})
    logger.info(f"[customer-portal] service request {entry['type']} filed by {clean}")
    return {"success": True, "request": entry}
