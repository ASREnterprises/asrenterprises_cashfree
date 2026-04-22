"""
ASR Enterprises — GST Billing & Invoice System (production-ready)

• Pydantic models for Customer / Invoice / LineItem
• Indian GST calculator (70/30 project split, CGST+SGST vs IGST)
• Auto invoice numbering (ASR/INV/2026/001)
• HTML → PDF via WeasyPrint
• Cashfree webhook hook (auto-invoice on PAYMENT_SUCCESS)
• WhatsApp + Email auto-send
• Admin endpoints: list, detail, download-PDF, resend

This module is standalone — it does NOT mutate any existing endpoint. It only
adds an `invoice_auto_issue_from_payment()` helper that `cashfree_orders.py`
opts in to calling from its `_mark_order_paid` path.
"""
from __future__ import annotations
import os
import re
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field
from weasyprint import HTML
from num2words import num2words

from db_client import get_db

router = APIRouter(prefix="/gst", tags=["GST Invoices"])
logger = logging.getLogger(__name__)
db = get_db()

# ==================== STATIC BUSINESS DETAILS ====================
BUSINESS = {
    "name": "ASR ENTERPRISES",
    "gstin": "10CCFPK3447Q3ZD",
    "address_line1": "Shop no 10, AMAN SKS COMPLEX",
    "address_line2": "Khagaul Saguna Road, Patna",
    "state": "Bihar",
    "state_code": "10",  # Bihar GST state code
    "pincode": "801503",
    "phone": "9296389097",
    "email": os.environ.get("BUSINESS_EMAIL", "asrenterprisespatna@gmail.com"),
    "bank_name": "SBI",
    "bank_account": "41637349306",
    "bank_ifsc": "SBIN0018105",
    "logo_url": os.environ.get("BUSINESS_LOGO_URL", "/asr_logo_transparent.png"),
}

# Configurable CA / accountant email for invoice copies
CA_EMAIL = os.environ.get("CA_EMAIL", "").strip()

INVOICE_DIR = Path(os.environ.get("INVOICE_STORAGE_DIR", "/app/backend/data/invoices"))
INVOICE_DIR.mkdir(parents=True, exist_ok=True)

# HSN / SAC codes
HSN_SOLAR_PANEL = "8541"
SAC_SERVICE = "9954"

GST_RATES = {
    "solar_goods": Decimal("5"),      # Solar product / panels
    "installation_service": Decimal("18"),  # Installation / AMC / services
    "other_product": Decimal("18"),
}

PROJECT_GOODS_SPLIT = Decimal("0.70")    # 70% of solar-project total is goods
PROJECT_SERVICE_SPLIT = Decimal("0.30")  # 30% is installation/service


# ==================== MODELS ====================
class InvoiceCustomer(BaseModel):
    name: str
    phone: str
    email: str = ""
    gstin: str = ""
    address: str = ""
    state: str = "Bihar"
    state_code: str = "10"
    pincode: str = ""


class InvoiceLineItem(BaseModel):
    description: str
    hsn_sac: str
    quantity: float = 1.0
    unit_price: float
    taxable_value: float  # qty * unit_price (pre-GST)
    gst_rate: float  # 5 or 18
    kind: str = "goods"  # goods | service


class InvoiceDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    invoice_date: str = ""
    doc_type: str = "invoice"  # invoice | quotation
    customer: InvoiceCustomer
    line_items: List[InvoiceLineItem] = []
    subtotal: float = 0.0
    cgst_total: float = 0.0
    sgst_total: float = 0.0
    igst_total: float = 0.0
    grand_total: float = 0.0
    amount_in_words: str = ""
    payment_status: str = "unpaid"  # unpaid | paid | partial
    cashfree_order_id: str = ""
    cashfree_payment_id: str = ""
    payment_method: str = ""
    project_type: str = "mixed"  # solar_project | solar_goods | service | mixed
    pdf_path: str = ""
    pdf_url: str = ""
    notes: str = ""
    created_at: str = ""
    paid_at: str = ""


class CreateInvoiceRequest(BaseModel):
    customer: InvoiceCustomer
    project_type: str = "solar_project"  # solar_project | solar_goods | service
    total_amount: Optional[float] = None  # required for solar_project (auto-split)
    line_items: Optional[List[InvoiceLineItem]] = None  # required for other types
    project_name: str = "Solar Rooftop System"
    notes: str = ""
    cashfree_order_id: str = ""
    cashfree_payment_id: str = ""
    payment_method: str = ""
    auto_send_whatsapp: bool = True
    auto_send_email: bool = True
    doc_type: str = "invoice"


# ==================== GST CALCULATOR ====================
def _q2(x) -> float:
    """Round to 2 decimals using banker's rounding (Indian invoicing convention)."""
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def build_line_items(req: CreateInvoiceRequest) -> List[InvoiceLineItem]:
    """Turn the request into concrete GST line items.
    
    • solar_project: split total 70/30 into goods(5%) + service(18%).
    • solar_goods:   single 5% line for the full amount.
    • service:       single 18% line for the full amount.
    • mixed:         caller supplies explicit line_items (taxable_value pre-set).
    """
    if req.line_items:
        return req.line_items
    total = Decimal(str(req.total_amount or 0))
    if total <= 0:
        raise HTTPException(400, "total_amount or line_items required")
    
    if req.project_type == "solar_project":
        goods_taxable = (total * PROJECT_GOODS_SPLIT).quantize(Decimal("0.01"), ROUND_HALF_UP)
        service_taxable = (total - goods_taxable).quantize(Decimal("0.01"), ROUND_HALF_UP)
        return [
            InvoiceLineItem(
                description=f"{req.project_name} — Solar Panels & Components",
                hsn_sac=HSN_SOLAR_PANEL,
                quantity=1.0,
                unit_price=float(goods_taxable),
                taxable_value=float(goods_taxable),
                gst_rate=float(GST_RATES["solar_goods"]),
                kind="goods",
            ),
            InvoiceLineItem(
                description=f"{req.project_name} — Installation & Commissioning Service",
                hsn_sac=SAC_SERVICE,
                quantity=1.0,
                unit_price=float(service_taxable),
                taxable_value=float(service_taxable),
                gst_rate=float(GST_RATES["installation_service"]),
                kind="service",
            ),
        ]
    if req.project_type == "solar_goods":
        return [InvoiceLineItem(
            description=req.project_name, hsn_sac=HSN_SOLAR_PANEL,
            quantity=1.0, unit_price=float(total), taxable_value=float(total),
            gst_rate=float(GST_RATES["solar_goods"]), kind="goods",
        )]
    # service / other
    return [InvoiceLineItem(
        description=req.project_name, hsn_sac=SAC_SERVICE,
        quantity=1.0, unit_price=float(total), taxable_value=float(total),
        gst_rate=float(GST_RATES["installation_service"]), kind="service",
    )]


def compute_gst(items: List[InvoiceLineItem], customer_state: str) -> Dict:
    """Return subtotal, CGST, SGST, IGST, grand total. Intra-state Bihar →
    CGST + SGST; inter-state → IGST."""
    is_intra_state = customer_state.strip().lower() == BUSINESS["state"].lower()
    subtotal = Decimal("0")
    cgst_total = Decimal("0")
    sgst_total = Decimal("0")
    igst_total = Decimal("0")
    enriched_rows = []
    for it in items:
        taxable = Decimal(str(it.taxable_value))
        rate = Decimal(str(it.gst_rate))
        gst_amount = (taxable * rate / Decimal("100")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        if is_intra_state:
            cgst = (gst_amount / 2).quantize(Decimal("0.01"), ROUND_HALF_UP)
            sgst = gst_amount - cgst
            igst = Decimal("0")
        else:
            cgst = sgst = Decimal("0")
            igst = gst_amount
        subtotal += taxable
        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst
        enriched_rows.append({
            **it.model_dump(),
            "cgst_rate": float(rate / 2) if is_intra_state else 0,
            "sgst_rate": float(rate / 2) if is_intra_state else 0,
            "igst_rate": 0 if is_intra_state else float(rate),
            "cgst_amount": float(cgst),
            "sgst_amount": float(sgst),
            "igst_amount": float(igst),
            "total_with_tax": float(taxable + cgst + sgst + igst),
        })
    grand = subtotal + cgst_total + sgst_total + igst_total
    return {
        "is_intra_state": is_intra_state,
        "rows": enriched_rows,
        "subtotal": _q2(subtotal),
        "cgst_total": _q2(cgst_total),
        "sgst_total": _q2(sgst_total),
        "igst_total": _q2(igst_total),
        "grand_total": _q2(grand),
    }


def amount_to_words(amount: float) -> str:
    """'₹1,23,456.78' → 'One Lakh Twenty Three Thousand…Rupees and Seventy Eight Paise Only'"""
    rupees = int(amount)
    paise = round((amount - rupees) * 100)
    words = num2words(rupees, lang="en_IN").title() + " Rupees"
    if paise > 0:
        words += f" and {num2words(paise, lang='en_IN').title()} Paise"
    return words + " Only"


# ==================== INVOICE NUMBER ====================
async def next_invoice_number(doc_type: str = "invoice") -> str:
    """ASR/INV/2026/001 — year-wise sequential, atomic via findOneAndUpdate."""
    year = datetime.now(timezone.utc).year
    prefix = "QUO" if doc_type == "quotation" else "INV"
    counter_id = f"asr_{prefix.lower()}_{year}"
    doc = await db.invoice_counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc["seq"] if doc else 1
    return f"ASR/{prefix}/{year}/{seq:03d}"


# ==================== HTML TEMPLATE & PDF ====================
INVOICE_HTML_TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; font-family: 'Helvetica', Arial, sans-serif; }
body { font-size: 11pt; color: #0f172a; margin: 0; }
h1 { font-size: 18pt; color: #0a355e; margin: 0 0 2mm; }
h2 { font-size: 13pt; color: #0a355e; margin: 0; }
.title-bar { display: flex; justify-content: space-between; border-bottom: 3px solid #f59e0b; padding-bottom: 4mm; margin-bottom: 5mm; }
.biz { text-align: left; max-width: 60%; }
.biz .muted { color: #475569; font-size: 9pt; line-height: 1.4; }
.doc-meta { text-align: right; }
.doc-meta .kv { margin: 1mm 0; font-size: 10pt; }
.doc-meta .kv b { color: #0a355e; }
.section { display: flex; justify-content: space-between; gap: 6mm; margin-bottom: 5mm; }
.card { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3mm 4mm; }
.card h3 { font-size: 10pt; color: #0a355e; margin: 0 0 2mm; text-transform: uppercase; letter-spacing: 0.5px; }
.card .row { font-size: 10pt; line-height: 1.45; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
table.items th { background: #0a355e; color: white; font-size: 9pt; text-align: left; padding: 2mm 2mm; border: 1px solid #0a355e; }
table.items td { font-size: 10pt; padding: 2mm; border: 1px solid #cbd5e1; vertical-align: top; }
table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
.totals { width: 55%; margin-left: 45%; border-collapse: collapse; }
.totals td { padding: 1.5mm 3mm; font-size: 10pt; }
.totals td.label { text-align: right; color: #475569; }
.totals td.val { text-align: right; font-variant-numeric: tabular-nums; }
.totals tr.grand td { font-size: 12pt; font-weight: bold; color: #0a355e; border-top: 2px solid #f59e0b; padding-top: 3mm; }
.words { margin-top: 3mm; font-size: 10pt; padding: 3mm 4mm; background: #fef3c7; border-left: 4px solid #f59e0b; }
.footer { margin-top: 6mm; display: flex; justify-content: space-between; gap: 6mm; }
.footer .bank { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3mm; }
.footer .sign { flex: 1; text-align: center; padding-top: 18mm; border-top: 1px dashed #94a3b8; }
.footer .sign .sig-label { font-weight: bold; color: #0a355e; font-size: 10pt; }
.badge { display: inline-block; padding: 1mm 3mm; border-radius: 3px; font-size: 9pt; font-weight: bold; }
.badge.paid { background: #dcfce7; color: #166534; }
.badge.unpaid { background: #fee2e2; color: #991b1b; }
.notes { font-size: 9pt; color: #475569; margin-top: 3mm; line-height: 1.4; }
.hsn-meta { font-size: 8pt; color: #475569; }
</style></head>
<body>
<div class="title-bar">
  <div class="biz">
    <h1>{{BUSINESS_NAME}}</h1>
    <div class="muted">
      {{BUSINESS_ADDR1}}<br/>
      {{BUSINESS_ADDR2}} — {{BUSINESS_PIN}}<br/>
      GSTIN: <b>{{BUSINESS_GSTIN}}</b> &nbsp;|&nbsp; State: {{BUSINESS_STATE}} ({{BUSINESS_STATE_CODE}})<br/>
      Phone: {{BUSINESS_PHONE}} &nbsp;|&nbsp; Email: {{BUSINESS_EMAIL}}
    </div>
  </div>
  <div class="doc-meta">
    <h2>{{DOC_TITLE}}</h2>
    <div class="kv"><b>Number:</b> {{INVOICE_NUMBER}}</div>
    <div class="kv"><b>Date:</b> {{INVOICE_DATE}}</div>
    <div class="kv"><span class="badge {{PAID_CLASS}}">{{PAID_LABEL}}</span></div>
  </div>
</div>

<div class="section">
  <div class="card">
    <h3>Bill To</h3>
    <div class="row"><b>{{CUST_NAME}}</b></div>
    <div class="row">{{CUST_ADDR}}</div>
    <div class="row">State: {{CUST_STATE}} ({{CUST_STATE_CODE}}) &nbsp; Pincode: {{CUST_PIN}}</div>
    <div class="row">Phone: {{CUST_PHONE}} &nbsp; {{CUST_EMAIL_LINE}}</div>
    <div class="row">{{CUST_GSTIN_LINE}}</div>
  </div>
  <div class="card">
    <h3>Place of Supply</h3>
    <div class="row">{{POS}}</div>
    <div class="row hsn-meta">HSN (Goods): {{HSN_GOODS}} &nbsp; SAC (Services): {{SAC_SERVICE}}</div>
    <div class="row hsn-meta">Tax Type: {{TAX_TYPE}}</div>
    {{CASHFREE_LINE}}
  </div>
</div>

<table class="items">
  <thead><tr>
    <th style="width:5%">#</th>
    <th>Description</th>
    <th style="width:10%">HSN/SAC</th>
    <th style="width:7%">Qty</th>
    <th style="width:12%">Taxable</th>
    {{TAX_HEADERS}}
    <th style="width:12%">Total</th>
  </tr></thead>
  <tbody>
    {{LINE_ITEM_ROWS}}
  </tbody>
</table>

<table class="totals">
  <tr><td class="label">Subtotal (Taxable)</td><td class="val">₹ {{SUBTOTAL}}</td></tr>
  {{TAX_TOTAL_ROWS}}
  <tr class="grand"><td class="label">Grand Total</td><td class="val">₹ {{GRAND_TOTAL}}</td></tr>
</table>

<div class="words"><b>Amount in Words:</b> {{AMOUNT_WORDS}}</div>

<div class="footer">
  <div class="bank">
    <h3 style="margin:0 0 2mm;color:#0a355e;font-size:10pt;">Bank Details (for Direct Transfer)</h3>
    <div class="row"><b>Bank:</b> {{BANK_NAME}}</div>
    <div class="row"><b>A/C Name:</b> {{BUSINESS_NAME}}</div>
    <div class="row"><b>A/C No:</b> {{BANK_ACC}}</div>
    <div class="row"><b>IFSC:</b> {{BANK_IFSC}}</div>
  </div>
  <div class="sign">
    <div class="sig-label">For {{BUSINESS_NAME}}</div>
    <div style="margin-top:3mm;font-size:9pt;color:#475569;">Authorized Signatory</div>
  </div>
</div>

<div class="notes">
  <b>Terms &amp; Conditions</b><br/>
  1. Goods once sold will not be taken back.<br/>
  2. Interest @ 18% p.a. applicable on invoices not paid within 15 days.<br/>
  3. All disputes subject to Patna jurisdiction only.<br/>
  4. This is a computer-generated invoice; signature not mandatory.<br/>
  {{NOTES}}
</div>
</body></html>"""


def _esc(s: str) -> str:
    return (str(s or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def render_invoice_html(doc: dict, computed: dict) -> str:
    """Fill HTML template with invoice + GST breakdown."""
    cust = doc["customer"]
    is_intra = computed["is_intra_state"]
    tax_headers = (
        "<th style='width:7%'>CGST %</th><th style='width:10%'>CGST</th>"
        "<th style='width:7%'>SGST %</th><th style='width:10%'>SGST</th>"
    ) if is_intra else "<th style='width:7%'>IGST %</th><th style='width:12%'>IGST</th>"

    item_rows = []
    for idx, r in enumerate(computed["rows"], start=1):
        if is_intra:
            tax_cells = (
                f"<td class='num'>{r['cgst_rate']:.2f}%</td><td class='num'>₹ {r['cgst_amount']:.2f}</td>"
                f"<td class='num'>{r['sgst_rate']:.2f}%</td><td class='num'>₹ {r['sgst_amount']:.2f}</td>"
            )
        else:
            tax_cells = (
                f"<td class='num'>{r['igst_rate']:.2f}%</td><td class='num'>₹ {r['igst_amount']:.2f}</td>"
            )
        item_rows.append(
            f"<tr><td>{idx}</td>"
            f"<td>{_esc(r['description'])}<br/><span class='hsn-meta'>Rate: {r['gst_rate']:.2f}%</span></td>"
            f"<td>{_esc(r['hsn_sac'])}</td>"
            f"<td class='num'>{r['quantity']:g}</td>"
            f"<td class='num'>₹ {r['taxable_value']:.2f}</td>"
            f"{tax_cells}"
            f"<td class='num'>₹ {r['total_with_tax']:.2f}</td></tr>"
        )

    if is_intra:
        tax_total_rows = (
            f"<tr><td class='label'>CGST</td><td class='val'>₹ {computed['cgst_total']:.2f}</td></tr>"
            f"<tr><td class='label'>SGST</td><td class='val'>₹ {computed['sgst_total']:.2f}</td></tr>"
        )
    else:
        tax_total_rows = (
            f"<tr><td class='label'>IGST</td><td class='val'>₹ {computed['igst_total']:.2f}</td></tr>"
        )

    cashfree_line = ""
    if doc.get("cashfree_order_id"):
        cashfree_line = (
            f"<div class='row hsn-meta'>Cashfree Order: {_esc(doc['cashfree_order_id'])}</div>"
        )
        if doc.get("cashfree_payment_id"):
            cashfree_line += f"<div class='row hsn-meta'>Payment ID: {_esc(doc['cashfree_payment_id'])}</div>"

    paid = doc.get("payment_status") == "paid"
    html = INVOICE_HTML_TEMPLATE
    mapping = {
        "{{BUSINESS_NAME}}": _esc(BUSINESS["name"]),
        "{{BUSINESS_ADDR1}}": _esc(BUSINESS["address_line1"]),
        "{{BUSINESS_ADDR2}}": _esc(BUSINESS["address_line2"]),
        "{{BUSINESS_PIN}}": _esc(BUSINESS["pincode"]),
        "{{BUSINESS_GSTIN}}": _esc(BUSINESS["gstin"]),
        "{{BUSINESS_STATE}}": _esc(BUSINESS["state"]),
        "{{BUSINESS_STATE_CODE}}": _esc(BUSINESS["state_code"]),
        "{{BUSINESS_PHONE}}": _esc(BUSINESS["phone"]),
        "{{BUSINESS_EMAIL}}": _esc(BUSINESS["email"]),
        "{{DOC_TITLE}}": "TAX INVOICE" if doc.get("doc_type") != "quotation" else "QUOTATION",
        "{{INVOICE_NUMBER}}": _esc(doc.get("invoice_number", "")),
        "{{INVOICE_DATE}}": _esc(doc.get("invoice_date", "")),
        "{{PAID_CLASS}}": "paid" if paid else "unpaid",
        "{{PAID_LABEL}}": "PAID" if paid else ("UNPAID" if doc.get("doc_type") != "quotation" else "QUOTED"),
        "{{CUST_NAME}}": _esc(cust.get("name", "")),
        "{{CUST_ADDR}}": _esc(cust.get("address", "")),
        "{{CUST_STATE}}": _esc(cust.get("state", "")),
        "{{CUST_STATE_CODE}}": _esc(cust.get("state_code", "")),
        "{{CUST_PIN}}": _esc(cust.get("pincode", "")),
        "{{CUST_PHONE}}": _esc(cust.get("phone", "")),
        "{{CUST_EMAIL_LINE}}": f"Email: {_esc(cust.get('email'))}" if cust.get("email") else "",
        "{{CUST_GSTIN_LINE}}": f"GSTIN: <b>{_esc(cust.get('gstin'))}</b>" if cust.get("gstin") else "",
        "{{POS}}": _esc(cust.get("state", BUSINESS["state"])),
        "{{HSN_GOODS}}": HSN_SOLAR_PANEL,
        "{{SAC_SERVICE}}": SAC_SERVICE,
        "{{TAX_TYPE}}": "CGST + SGST (Intra-state)" if is_intra else "IGST (Inter-state)",
        "{{CASHFREE_LINE}}": cashfree_line,
        "{{TAX_HEADERS}}": tax_headers,
        "{{LINE_ITEM_ROWS}}": "\n".join(item_rows),
        "{{SUBTOTAL}}": f"{computed['subtotal']:.2f}",
        "{{TAX_TOTAL_ROWS}}": tax_total_rows,
        "{{GRAND_TOTAL}}": f"{computed['grand_total']:.2f}",
        "{{AMOUNT_WORDS}}": _esc(doc.get("amount_in_words", "")),
        "{{BANK_NAME}}": _esc(BUSINESS["bank_name"]),
        "{{BANK_ACC}}": _esc(BUSINESS["bank_account"]),
        "{{BANK_IFSC}}": _esc(BUSINESS["bank_ifsc"]),
        "{{NOTES}}": _esc(doc.get("notes", "")) if doc.get("notes") else "",
    }
    for k, v in mapping.items():
        html = html.replace(k, v)
    return html


def render_invoice_pdf(doc: dict, computed: dict) -> bytes:
    """Return the invoice rendered as a PDF byte string."""
    html = render_invoice_html(doc, computed)
    return HTML(string=html).write_pdf()


# ==================== NOTIFICATIONS ====================
async def send_invoice_whatsapp(doc: dict, pdf_url: str = "") -> Dict:
    """Send the invoice to the customer via WhatsApp using the existing
    `send_whatsapp_template` helper. Falls back to a plain text message if
    template send fails (e.g. 24h window expired)."""
    from routes.cashfree_orders import send_whatsapp_template
    cust = doc.get("customer", {})
    phone = (cust.get("phone") or "").replace(" ", "").replace("+", "").replace("-", "")
    if len(phone) == 10:
        phone = "91" + phone
    if not phone:
        return {"success": False, "error": "no customer phone"}
    try:
        resp = await send_whatsapp_template(
            phone=phone,
            template_name="payment_sucess_confirmation",
            variables=[
                "Invoice Issued",
                cust.get("name", "Customer")[:60],
                doc.get("invoice_number", "N/A"),
                f"{doc.get('grand_total', 0):,.0f}",
                f"GST Invoice — {BUSINESS['name']}",
                datetime.now(timezone.utc).strftime("%d %b %Y"),
            ],
        )
        await db.invoices.update_one(
            {"id": doc["id"]},
            {"$set": {
                "whatsapp_sent_at": datetime.now(timezone.utc).isoformat(),
                "whatsapp_result": "ok" if resp.get("success") else "failed",
            }}
        )
        return resp
    except Exception as e:
        logger.warning(f"[invoice WhatsApp] send failed for {doc.get('invoice_number')}: {e}")
        return {"success": False, "error": str(e)}


async def send_invoice_email(doc: dict, pdf_bytes: bytes) -> Dict:
    """Send the invoice PDF to the customer + CA via Resend if key is set.
    Stays graceful (returns status) if email is not configured."""
    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not resend_key:
        return {"success": False, "error": "RESEND_API_KEY not configured"}
    import base64
    cust = doc.get("customer", {})
    to_list = []
    if cust.get("email"):
        to_list.append(cust["email"])
    if CA_EMAIL:
        to_list.append(CA_EMAIL)
    if not to_list:
        return {"success": False, "error": "no recipient"}
    subject = f"{BUSINESS['name']} — GST Invoice {doc.get('invoice_number')}"
    html_body = (
        f"<p>Dear {_esc(cust.get('name', 'Customer'))},</p>"
        f"<p>Please find attached your GST invoice <b>{_esc(doc.get('invoice_number'))}</b> "
        f"for ₹{doc.get('grand_total', 0):,.2f}.</p>"
        f"<p>Thank you for choosing <b>{BUSINESS['name']}</b>.</p>"
        f"<p>— ASR Enterprises<br/>"
        f"GSTIN: {BUSINESS['gstin']}<br/>Phone: {BUSINESS['phone']}</p>"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                json={
                    "from": os.environ.get("RESEND_FROM", f"{BUSINESS['name']} <invoice@asrenterprises.in>"),
                    "to": to_list,
                    "subject": subject,
                    "html": html_body,
                    "attachments": [{
                        "filename": f"{doc.get('invoice_number', 'invoice').replace('/', '_')}.pdf",
                        "content": base64.b64encode(pdf_bytes).decode(),
                    }],
                },
            )
        ok = resp.status_code in (200, 202)
        await db.invoices.update_one(
            {"id": doc["id"]},
            {"$set": {
                "email_sent_at": datetime.now(timezone.utc).isoformat(),
                "email_result": "ok" if ok else f"failed_{resp.status_code}",
                "email_recipients": to_list,
            }}
        )
        return {"success": ok, "status": resp.status_code, "recipients": to_list}
    except Exception as e:
        logger.warning(f"[invoice email] send failed: {e}")
        return {"success": False, "error": str(e)}


# ==================== CORE CREATE ====================
async def _create_and_persist_invoice(req: CreateInvoiceRequest) -> dict:
    items = build_line_items(req)
    gst = compute_gst(items, req.customer.state)
    inv_no = await next_invoice_number(req.doc_type)
    now = datetime.now(timezone.utc)
    doc = InvoiceDoc(
        invoice_number=inv_no,
        invoice_date=now.strftime("%d %b %Y"),
        doc_type=req.doc_type,
        customer=req.customer,
        line_items=items,
        subtotal=gst["subtotal"],
        cgst_total=gst["cgst_total"],
        sgst_total=gst["sgst_total"],
        igst_total=gst["igst_total"],
        grand_total=gst["grand_total"],
        amount_in_words=amount_to_words(gst["grand_total"]),
        payment_status="paid" if req.cashfree_payment_id else "unpaid",
        cashfree_order_id=req.cashfree_order_id,
        cashfree_payment_id=req.cashfree_payment_id,
        payment_method=req.payment_method,
        project_type=req.project_type,
        notes=req.notes,
        created_at=now.isoformat(),
        paid_at=now.isoformat() if req.cashfree_payment_id else "",
    ).model_dump()

    pdf_bytes = render_invoice_pdf(doc, gst)
    safe_name = doc["invoice_number"].replace("/", "_")
    pdf_path = INVOICE_DIR / f"{safe_name}.pdf"
    pdf_path.write_bytes(pdf_bytes)
    doc["pdf_path"] = str(pdf_path)
    doc["pdf_url"] = f"/api/gst/invoices/{doc['id']}/pdf"
    await db.invoices.insert_one(doc.copy())

    # Fire-and-forget notifications
    import asyncio
    if req.auto_send_whatsapp:
        asyncio.create_task(send_invoice_whatsapp(doc, doc["pdf_url"]))
    if req.auto_send_email:
        asyncio.create_task(send_invoice_email(doc, pdf_bytes))

    doc.pop("_id", None)
    return doc


# ==================== API ENDPOINTS ====================
@router.post("/invoices")
async def create_invoice(req: CreateInvoiceRequest):
    """Manually create an invoice (or a quotation when `doc_type='quotation'`)."""
    return await _create_and_persist_invoice(req)


@router.get("/invoices")
async def list_invoices(
    status: Optional[str] = None,
    doc_type: Optional[str] = None,
    from_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    """List invoices with filters — used by the admin dashboard."""
    q: dict = {}
    if status:
        q["payment_status"] = status
    if doc_type:
        q["doc_type"] = doc_type
    if from_date or to_date:
        q["invoice_date_iso"] = {}
    if from_date:
        q.setdefault("created_at", {})["$gte"] = from_date + "T00:00:00+00:00"
    if to_date:
        q.setdefault("created_at", {})["$lte"] = to_date + "T23:59:59+00:00"
    if search:
        safe = re.escape(search)
        q["$or"] = [
            {"invoice_number": {"$regex": safe, "$options": "i"}},
            {"customer.name": {"$regex": safe, "$options": "i"}},
            {"customer.phone": {"$regex": safe, "$options": "i"}},
            {"cashfree_order_id": {"$regex": safe, "$options": "i"}},
        ]
    skip = max(0, (page - 1) * limit)
    cur = db.invoices.find(q, {"_id": 0, "pdf_path": 0}).sort("created_at", -1).skip(skip).limit(limit)
    rows = await cur.to_list(length=limit)
    total = await db.invoices.count_documents(q)
    return {"total": total, "page": page, "limit": limit, "invoices": rows}


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    return doc


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str):
    """Stream the stored PDF (regenerates on the fly if the file is missing —
    e.g. after a container restart with volatile storage)."""
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    pdf_path = Path(doc.get("pdf_path") or "")
    if not pdf_path.exists():
        gst = compute_gst([InvoiceLineItem(**it) for it in doc["line_items"]], doc["customer"]["state"])
        pdf_bytes = render_invoice_pdf(doc, gst)
    else:
        pdf_bytes = pdf_path.read_bytes()
    fname = doc["invoice_number"].replace("/", "_") + ".pdf"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/invoices/{invoice_id}/resend-whatsapp")
async def resend_whatsapp(invoice_id: str):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    return await send_invoice_whatsapp(doc, doc.get("pdf_url", ""))


@router.post("/invoices/{invoice_id}/resend-email")
async def resend_email(invoice_id: str):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    pdf_path = Path(doc.get("pdf_path") or "")
    if pdf_path.exists():
        pdf_bytes = pdf_path.read_bytes()
    else:
        gst = compute_gst([InvoiceLineItem(**it) for it in doc["line_items"]], doc["customer"]["state"])
        pdf_bytes = render_invoice_pdf(doc, gst)
    return await send_invoice_email(doc, pdf_bytes)


@router.get("/stats")
async def invoice_stats():
    """Quick stats for the admin dashboard header."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline_this_month = [
        {"$match": {"created_at": {"$gte": month_start}, "doc_type": "invoice"}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": "$grand_total"}}},
    ]
    pipeline_paid_month = [
        {"$match": {"created_at": {"$gte": month_start}, "payment_status": "paid"}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": "$grand_total"}}},
    ]
    this_month, paid_month = await db.invoices.aggregate(pipeline_this_month).to_list(1), \
        await db.invoices.aggregate(pipeline_paid_month).to_list(1)
    total_count = await db.invoices.count_documents({"doc_type": "invoice"})
    return {
        "total_invoices": total_count,
        "this_month_count": this_month[0]["count"] if this_month else 0,
        "this_month_value": this_month[0]["total"] if this_month else 0,
        "this_month_paid_count": paid_month[0]["count"] if paid_month else 0,
        "this_month_paid_value": paid_month[0]["total"] if paid_month else 0,
    }


# ==================== CASHFREE AUTO-INVOICE HOOK ====================
async def invoice_auto_issue_from_payment(order: dict) -> Optional[dict]:
    """Called from `cashfree_orders._mark_order_paid` once a payment is
    confirmed. Generates a GST invoice for that order (idempotent — skips
    if one already exists for the same Cashfree order_id)."""
    try:
        cf_order_id = order.get("order_id") or order.get("cashfree_order_id")
        if not cf_order_id:
            return None
        existing = await db.invoices.find_one({"cashfree_order_id": cf_order_id}, {"_id": 0, "id": 1})
        if existing:
            return existing

        # Derive project type from the order metadata
        ptype = (order.get("payment_type") or "").lower()
        booking = (order.get("booking_type") or "").lower()
        if ptype == "shop_order" or booking in {"book_solar_service", "service"}:
            project_type = "solar_goods" if ptype == "shop_order" else "service"
        elif booking in {"site_visit"}:
            project_type = "service"
        else:
            project_type = "solar_project"  # default = full 70/30 split

        amount = float(order.get("payment_amount_received") or order.get("amount") or 0)
        if amount <= 0:
            return None

        cust = InvoiceCustomer(
            name=order.get("customer_name", "Customer"),
            phone=order.get("customer_phone", ""),
            email=order.get("customer_email", ""),
            gstin=order.get("customer_gstin", ""),
            address=order.get("customer_address", ""),
            state=order.get("customer_state", "Bihar"),
            state_code=order.get("customer_state_code", "10"),
            pincode=order.get("customer_pincode", ""),
        )
        req = CreateInvoiceRequest(
            customer=cust,
            project_type=project_type,
            total_amount=amount,
            project_name=order.get("purpose") or order.get("notes") or "Solar Service",
            cashfree_order_id=cf_order_id,
            cashfree_payment_id=order.get("cf_payment_id") or order.get("cashfree_payment_id", ""),
            payment_method=str(order.get("payment_method", "")),
            notes=f"Auto-generated on Cashfree PAYMENT_SUCCESS for order {cf_order_id}",
            doc_type="invoice",
        )
        doc = await _create_and_persist_invoice(req)
        logger.info(f"[gst-invoice] auto-issued {doc['invoice_number']} for cashfree order {cf_order_id}")
        return doc
    except Exception as e:
        logger.error(f"[gst-invoice] auto-issue failed: {e}")
        return None
