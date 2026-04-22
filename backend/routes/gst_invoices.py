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

# PM Surya Ghar Yojana: ICICI bank details used exclusively for PMSG invoices/quotations
PMSG_BANK = {
    "bank_name": "ICICI BANK LIMITED — Sumitra Sadan Branch",
    "bank_account": "040405011759",
    "bank_ifsc": "ICIC0000404",
    "account_holder": "ASR ENTERPRISES",
}

# Configurable CA / accountant email for invoice copies
CA_EMAIL = os.environ.get("CA_EMAIL", "").strip()

INVOICE_DIR = Path(os.environ.get("INVOICE_STORAGE_DIR", "/app/backend/data/invoices"))
INVOICE_DIR.mkdir(parents=True, exist_ok=True)

# Logo: embed as base64 so WeasyPrint can render without network access.
_LOGO_PATH = Path("/app/frontend/public/asr_logo_transparent.png")
LOGO_DATA_URI = ""
if _LOGO_PATH.exists():
    import base64 as _b64
    LOGO_DATA_URI = "data:image/png;base64," + _b64.b64encode(_LOGO_PATH.read_bytes()).decode()

# Authorized signatory stamp (transparent PNG) — shown above the signature line on PDFs
_STAMP_PATH = Path("/app/backend/data/signature_stamp.png")
STAMP_DATA_URI = ""
if _STAMP_PATH.exists():
    import base64 as _b64  # noqa: F811
    STAMP_DATA_URI = "data:image/png;base64," + _b64.b64encode(_STAMP_PATH.read_bytes()).decode()

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


class PaymentEntry(BaseModel):
    """A single payment installment recorded against an invoice."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float = Field(..., gt=0)
    payment_mode: str = "Cashfree"    # SBI | ICICI | Cashfree | Cash | UPI | Cheque | Other
    payment_date: str = ""            # ISO date (yyyy-mm-dd); defaults to today if omitted
    reference: str = ""               # UTR / txn id / cheque no (optional)
    notes: str = ""
    recorded_by: str = ""             # staff id / name
    recorded_at: str = ""             # ISO datetime


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
    payment_status: str = "unpaid"  # unpaid | partial | paid
    # --- Payment tracking fields (added 2026-04-22) ---
    amount_paid: float = 0.0         # Running total of all recorded payments
    due_amount: float = 0.0          # grand_total - amount_paid (never negative)
    payment_mode: str = ""           # Last payment mode (SBI/ICICI/Cashfree/...)
    payment_date: str = ""           # Date of last payment (ISO yyyy-mm-dd)
    scheme: str = ""                 # "pm_surya_ghar" | "" (empty = normal) — drives defaults
    payment_history: List[PaymentEntry] = []  # Per-installment log
    # --- Existing ---
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
    scheme: str = ""  # "pm_surya_ghar" → default payment_mode ICICI


class RecordPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    payment_mode: str = "Cashfree"
    payment_date: Optional[str] = None  # ISO yyyy-mm-dd; today if blank
    reference: str = ""
    notes: str = ""
    recorded_by: str = ""


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
.biz { text-align: left; max-width: 60%; display: flex; gap: 4mm; align-items: flex-start; }
.biz .logo { width: 22mm; height: 22mm; object-fit: contain; flex-shrink: 0; }
.biz .info { flex: 1; }
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
.footer .sign { flex: 1; text-align: center; padding-top: 12mm; border-top: 1px dashed #94a3b8; }
.footer .sign .sig-label { font-weight: bold; color: #0a355e; font-size: 10pt; }
.footer .sign .stamp { display: block; margin: 2mm auto 0; width: 34mm; height: auto; opacity: 0.95; }
.badge { display: inline-block; padding: 1mm 3mm; border-radius: 3px; font-size: 9pt; font-weight: bold; }
.badge.paid { background: #dcfce7; color: #166534; }
.badge.partial { background: #fef3c7; color: #92400e; }
.badge.unpaid { background: #fee2e2; color: #991b1b; }
.badge.quotation { background: #dbeafe; color: #1e3a8a; }
.notes { font-size: 9pt; color: #475569; margin-top: 3mm; line-height: 1.4; }
.hsn-meta { font-size: 8pt; color: #475569; }
</style></head>
<body>
<div class="title-bar">
  <div class="biz">
    {{LOGO_IMG}}
    <div class="info">
    <h1>{{BUSINESS_NAME}}</h1>
    <div class="muted">
      {{BUSINESS_ADDR1}}<br/>
      {{BUSINESS_ADDR2}} — {{BUSINESS_PIN}}<br/>
      GSTIN: <b>{{BUSINESS_GSTIN}}</b> &nbsp;|&nbsp; State: {{BUSINESS_STATE}} ({{BUSINESS_STATE_CODE}})<br/>
      Phone: {{BUSINESS_PHONE}} &nbsp;|&nbsp; Email: {{BUSINESS_EMAIL}}
    </div>
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

{{PAYMENT_SUMMARY}}

<div class="footer">
  <div class="bank">
    <h3 style="margin:0 0 2mm;color:#0a355e;font-size:10pt;">{{BANK_HEADING}}</h3>
    <div class="row"><b>Bank:</b> {{BANK_NAME}}</div>
    <div class="row"><b>A/C Name:</b> {{BANK_HOLDER}}</div>
    <div class="row"><b>A/C No:</b> {{BANK_ACC}}</div>
    <div class="row"><b>IFSC:</b> {{BANK_IFSC}}</div>
  </div>
  <div class="sign">
    <div class="sig-label">For {{BUSINESS_NAME}}</div>
    {{STAMP_IMG}}
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

    pstatus = (doc.get("payment_status") or "unpaid").lower()
    amount_paid = float(doc.get("amount_paid") or 0)
    due_amount = float(doc.get("due_amount") or max(0.0, float(doc.get("grand_total") or 0) - amount_paid))
    last_mode = doc.get("payment_mode") or ""
    last_date = doc.get("payment_date") or ""

    # Payment summary block (shown on invoices only, not quotations)
    payment_summary_html = ""
    if doc.get("doc_type") != "quotation":
        status_label = {"paid": "PAID IN FULL", "partial": "PARTIALLY PAID", "unpaid": "UNPAID"}.get(pstatus, pstatus.upper())
        status_color = {"paid": "#065f46", "partial": "#92400e", "unpaid": "#991b1b"}.get(pstatus, "#1f2937")
        status_bg = {"paid": "#d1fae5", "partial": "#fef3c7", "unpaid": "#fee2e2"}.get(pstatus, "#f3f4f6")
        extra_rows = ""
        if last_mode:
            extra_rows += f"<tr><td class='label'>Payment Mode</td><td class='val'>{_esc(last_mode)}</td></tr>"
        if last_date:
            extra_rows += f"<tr><td class='label'>Last Payment Date</td><td class='val'>{_esc(last_date)}</td></tr>"
        payment_summary_html = (
            f"<div class='pay-summary' style='margin-top:4mm;border:1.2px solid {status_color};border-radius:2mm;padding:3mm;background:{status_bg};'>"
            f"<div style='font-weight:700;color:{status_color};font-size:10pt;margin-bottom:2mm;'>PAYMENT STATUS: {status_label}</div>"
            f"<table style='width:100%;font-size:9pt;'>"
            f"<tr><td class='label'>Amount Paid</td><td class='val'><b>₹ {amount_paid:,.2f}</b></td></tr>"
            f"<tr><td class='label'>Amount Due</td><td class='val' style='color:{status_color};'><b>₹ {due_amount:,.2f}</b></td></tr>"
            f"{extra_rows}"
            f"</table></div>"
        )

        # Payment history table (only if there are entries)
        history = doc.get("payment_history") or []
        if history:
            rows = "".join(
                f"<tr><td>{i+1}</td><td>{_esc(p.get('payment_date', ''))}</td>"
                f"<td>{_esc(p.get('payment_mode', ''))}</td>"
                f"<td>{_esc(p.get('reference', '')) or '—'}</td>"
                f"<td class='num'>₹ {float(p.get('amount') or 0):,.2f}</td></tr>"
                for i, p in enumerate(history)
            )
            payment_summary_html += (
                "<div class='pay-history' style='margin-top:3mm;'>"
                "<div style='font-weight:700;font-size:9pt;margin-bottom:1.5mm;'>Payment History</div>"
                "<table class='items' style='font-size:8.5pt;'>"
                "<thead><tr><th>#</th><th>Date</th><th>Mode</th><th>Reference</th><th class='num'>Amount</th></tr></thead>"
                f"<tbody>{rows}</tbody></table></div>"
            )

    html = INVOICE_HTML_TEMPLATE
    mapping = {
        "{{LOGO_IMG}}": f'<img src="{LOGO_DATA_URI}" class="logo" alt="ASR Enterprises"/>' if LOGO_DATA_URI else '',
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
        "{{PAID_CLASS}}": pstatus if doc.get("doc_type") != "quotation" else "quotation",
        "{{PAID_LABEL}}": (
            "PAID" if pstatus == "paid"
            else ("PARTIAL" if pstatus == "partial"
                  else ("UNPAID" if doc.get("doc_type") != "quotation" else "QUOTED"))
        ),
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
        "{{PAYMENT_SUMMARY}}": payment_summary_html,
        # Bank details: PM Surya Ghar invoices/quotations use the dedicated ICICI
        # account so homeowner subsidy payments route correctly; everyone else
        # defaults to the regular SBI operating account.
        "{{BANK_HEADING}}": (
            "ICICI Bank — PM Surya Ghar Yojana"
            if (doc.get("scheme") or "").lower() == "pm_surya_ghar"
            else "Bank Details (for Direct Transfer)"
        ),
        "{{BANK_NAME}}": _esc(
            PMSG_BANK["bank_name"] if (doc.get("scheme") or "").lower() == "pm_surya_ghar"
            else BUSINESS["bank_name"]
        ),
        "{{BANK_ACC}}": _esc(
            PMSG_BANK["bank_account"] if (doc.get("scheme") or "").lower() == "pm_surya_ghar"
            else BUSINESS["bank_account"]
        ),
        "{{BANK_IFSC}}": _esc(
            PMSG_BANK["bank_ifsc"] if (doc.get("scheme") or "").lower() == "pm_surya_ghar"
            else BUSINESS["bank_ifsc"]
        ),
        "{{BANK_HOLDER}}": _esc(
            PMSG_BANK["account_holder"] if (doc.get("scheme") or "").lower() == "pm_surya_ghar"
            else BUSINESS["name"]
        ),
        "{{STAMP_IMG}}": (
            f'<img src="{STAMP_DATA_URI}" class="stamp" alt="ASR Enterprises Patna — Seal & Signature"/>'
            if STAMP_DATA_URI else ""
        ),
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
    """Send the invoice to the customer via WhatsApp.

    Two-step delivery:
      1) Upload the PDF to Meta's media endpoint → get a media_id
      2) Send a WhatsApp document message with that media_id + caption

    Falls back to the approved template text message if the document path fails
    (e.g. 24h window expired, media upload rejected)."""
    cust = doc.get("customer", {})
    phone = (cust.get("phone") or "").replace(" ", "").replace("+", "").replace("-", "")
    if len(phone) == 10:
        phone = "91" + phone
    if not phone:
        return {"success": False, "error": "no customer phone"}

    # --- Step 1 & 2: try the PDF document message path ---
    doc_result = await _send_invoice_pdf_as_whatsapp_doc(doc, phone)
    if doc_result.get("success"):
        await db.invoices.update_one(
            {"id": doc["id"]},
            {"$set": {
                "whatsapp_sent_at": datetime.now(timezone.utc).isoformat(),
                "whatsapp_result": "document_sent",
                "whatsapp_media_id": doc_result.get("media_id", ""),
            }}
        )
        return doc_result

    # --- Fallback: approved template text message ---
    from routes.whatsapp import send_whatsapp_template
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
                "whatsapp_result": "template_fallback_ok" if resp.get("success") else "template_fallback_failed",
                "whatsapp_doc_error": doc_result.get("error", ""),
            }}
        )
        return resp
    except Exception as e:
        logger.warning(f"[invoice WhatsApp] both doc + template failed for {doc.get('invoice_number')}: {e}")
        return {"success": False, "error": str(e), "doc_error": doc_result.get("error", "")}


async def _send_invoice_pdf_as_whatsapp_doc(doc: dict, phone_e164: str) -> Dict:
    """Upload invoice PDF to Meta Cloud API → send as WhatsApp document message."""
    try:
        from routes.whatsapp import get_whatsapp_settings
        settings = await get_whatsapp_settings()
        token = (settings or {}).get("access_token", "").strip()
        phone_id = (settings or {}).get("phone_number_id", "").strip()
        if not token or not phone_id:
            return {"success": False, "error": "whatsapp settings missing"}

        pdf_path = Path(doc.get("pdf_path") or "")
        if pdf_path.exists():
            pdf_bytes = pdf_path.read_bytes()
        else:
            gst = compute_gst([InvoiceLineItem(**it) for it in doc["line_items"]], doc["customer"]["state"])
            pdf_bytes = render_invoice_pdf(doc, gst)

        safe_name = (doc.get("invoice_number") or "invoice").replace("/", "_") + ".pdf"

        async with httpx.AsyncClient(timeout=30.0) as client:
            upload_resp = await client.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/media",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": (safe_name, pdf_bytes, "application/pdf")},
                data={"messaging_product": "whatsapp", "type": "application/pdf"},
            )
            if upload_resp.status_code not in (200, 201):
                return {"success": False, "error": f"media_upload_{upload_resp.status_code}: {upload_resp.text[:200]}"}
            media_id = upload_resp.json().get("id", "")
            if not media_id:
                return {"success": False, "error": "no media_id in upload response"}

            caption = (
                f"ASR Enterprises — GST Invoice {doc.get('invoice_number')}\n"
                f"Amount: ₹ {doc.get('grand_total', 0):,.2f}\n"
                f"Status: {'PAID' if doc.get('payment_status') == 'paid' else 'UNPAID'}"
            )
            send_resp = await client.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_e164,
                    "type": "document",
                    "document": {"id": media_id, "filename": safe_name, "caption": caption},
                },
            )
            if send_resp.status_code not in (200, 201):
                return {"success": False, "error": f"send_{send_resp.status_code}: {send_resp.text[:200]}", "media_id": media_id}
            return {"success": True, "media_id": media_id, "status": send_resp.status_code}
    except Exception as e:
        logger.warning(f"[invoice WhatsApp doc] unexpected error: {e}")
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

    # --- Payment-tracking initial state ---
    # A full Cashfree payment at creation time means fully paid upfront.
    # PM Surya Ghar invoices default to ICICI as the expected payment rail.
    is_paid_upfront = bool(req.cashfree_payment_id)
    scheme = (req.scheme or "").strip().lower()
    # Auto-detect PM Surya Ghar from project name or notes for convenience
    if not scheme:
        hint = f"{req.project_name or ''} {req.notes or ''}".lower()
        if "pm surya ghar" in hint or "pmsurya" in hint or "surya ghar" in hint:
            scheme = "pm_surya_ghar"
    default_mode = "ICICI" if scheme == "pm_surya_ghar" else (req.payment_method or "Cashfree")
    grand = gst["grand_total"]
    amount_paid = grand if is_paid_upfront else 0.0
    due = max(0.0, grand - amount_paid)
    status = "paid" if amount_paid >= grand and grand > 0 else ("partial" if amount_paid > 0 else "unpaid")

    payment_history: List[dict] = []
    if is_paid_upfront:
        payment_history.append(PaymentEntry(
            amount=grand,
            payment_mode="Cashfree",
            payment_date=now.strftime("%Y-%m-%d"),
            reference=req.cashfree_payment_id,
            notes="Auto-recorded from Cashfree PAYMENT_SUCCESS",
            recorded_by="system:cashfree",
            recorded_at=now.isoformat(),
        ).model_dump())

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
        grand_total=grand,
        amount_in_words=amount_to_words(grand),
        payment_status=status,
        amount_paid=_q2(amount_paid),
        due_amount=_q2(due),
        payment_mode=default_mode if is_paid_upfront else ("" if not scheme else "ICICI"),
        payment_date=now.strftime("%Y-%m-%d") if is_paid_upfront else "",
        scheme=scheme,
        payment_history=[PaymentEntry(**p) for p in payment_history],
        cashfree_order_id=req.cashfree_order_id,
        cashfree_payment_id=req.cashfree_payment_id,
        payment_method=req.payment_method,
        project_type=req.project_type,
        notes=req.notes,
        created_at=now.isoformat(),
        paid_at=now.isoformat() if is_paid_upfront else "",
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


@router.post("/invoices/{invoice_id}/payments")
async def record_payment(invoice_id: str, payload: RecordPaymentRequest):
    """Record a new payment against the invoice. Updates amount_paid / due_amount
    / payment_status / payment_mode / payment_date + appends to payment_history.

    Idempotent by (invoice_id, reference) when reference is provided — repeat
    webhooks or double-click submissions won't double-count."""
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    if doc.get("doc_type") == "quotation":
        raise HTTPException(400, "Cannot record payment on a quotation. Convert it to an invoice first.")

    # Duplicate-reference guard (only when reference is non-empty)
    ref = (payload.reference or "").strip()
    if ref:
        for p in doc.get("payment_history", []) or []:
            if (p or {}).get("reference") == ref:
                raise HTTPException(409, f"A payment with reference '{ref}' has already been recorded.")

    grand = float(doc.get("grand_total") or 0)
    already = float(doc.get("amount_paid") or 0)
    new_paid = _q2(already + float(payload.amount))
    if new_paid > grand + 0.01:
        raise HTTPException(400, f"Payment of ₹{payload.amount:.2f} would exceed invoice total. Remaining due: ₹{max(0, grand - already):.2f}.")

    due = _q2(max(0.0, grand - new_paid))
    new_status = "paid" if due <= 0.01 else "partial"

    now = datetime.now(timezone.utc)
    pay_date = (payload.payment_date or now.strftime("%Y-%m-%d")).strip()
    entry = PaymentEntry(
        amount=_q2(payload.amount),
        payment_mode=payload.payment_mode or "Cashfree",
        payment_date=pay_date,
        reference=ref,
        notes=payload.notes or "",
        recorded_by=payload.recorded_by or "",
        recorded_at=now.isoformat(),
    ).model_dump()

    update = {
        "$set": {
            "amount_paid": new_paid,
            "due_amount": due,
            "payment_status": new_status,
            "payment_mode": entry["payment_mode"],
            "payment_date": pay_date,
            "paid_at": now.isoformat() if new_status == "paid" else doc.get("paid_at", ""),
        },
        "$push": {"payment_history": entry},
    }
    await db.invoices.update_one({"id": invoice_id}, update)

    # Regenerate the PDF so it reflects the updated payment status.
    try:
        refreshed = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
        if refreshed:
            gst = compute_gst([InvoiceLineItem(**it) for it in refreshed["line_items"]], refreshed["customer"]["state"])
            pdf_bytes = render_invoice_pdf(refreshed, gst)
            safe_name = refreshed["invoice_number"].replace("/", "_")
            pdf_path = INVOICE_DIR / f"{safe_name}.pdf"
            pdf_path.write_bytes(pdf_bytes)
    except Exception as e:
        logger.warning(f"[gst-invoice] payment recorded but PDF regen failed for {invoice_id}: {e}")

    logger.info(f"[gst-invoice] payment of ₹{payload.amount:.2f} recorded on {doc.get('invoice_number')} → status={new_status}, due=₹{due:.2f}")

    refreshed = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return {"success": True, "invoice": refreshed, "entry": entry}


@router.delete("/invoices/{invoice_id}/payments/{entry_id}")
async def delete_payment_entry(invoice_id: str, entry_id: str):
    """Remove a single payment entry (e.g., recorded in error) and recompute totals."""
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    history = [p for p in (doc.get("payment_history") or []) if (p or {}).get("id") != entry_id]
    if len(history) == len(doc.get("payment_history") or []):
        raise HTTPException(404, "Payment entry not found on this invoice")

    total_paid = _q2(sum(float(p.get("amount") or 0) for p in history))
    grand = float(doc.get("grand_total") or 0)
    due = _q2(max(0.0, grand - total_paid))
    status = "paid" if (grand > 0 and due <= 0.01) else ("partial" if total_paid > 0 else "unpaid")

    # Fall back to the last remaining entry's mode/date, or blank.
    last = history[-1] if history else {}
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "payment_history": history,
            "amount_paid": total_paid,
            "due_amount": due,
            "payment_status": status,
            "payment_mode": last.get("payment_mode", "") if history else "",
            "payment_date": last.get("payment_date", "") if history else "",
            "paid_at": doc.get("paid_at", "") if status == "paid" else "",
        }},
    )

    refreshed = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return {"success": True, "invoice": refreshed}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    """Hard-delete an invoice or quotation. Removes the DB record AND the PDF file.
    Used by the Admin Dashboard to prune test/duplicate/cancelled documents."""
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    # Delete PDF file from disk (best-effort)
    pdf_path = doc.get("pdf_path") or ""
    if pdf_path:
        try:
            p = Path(pdf_path)
            if p.exists():
                p.unlink()
        except Exception as e:
            logger.warning(f"[gst-invoice] could not remove PDF file {pdf_path}: {e}")
    await db.invoices.delete_one({"id": invoice_id})
    logger.info(f"[gst-invoice] deleted {doc.get('doc_type', 'invoice')} {doc.get('invoice_number')}")
    return {"success": True, "deleted_id": invoice_id, "invoice_number": doc.get("invoice_number")}


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

        # Skip Site Visit ₹500 booking tokens — these are lead-generation
        # deposits, not GST-taxable sales.
        ptype = (order.get("payment_type") or "").lower()
        booking = (order.get("booking_type") or "").lower()
        amount_check = float(order.get("payment_amount_received") or order.get("amount") or 0)
        if ptype == "site_visit" or booking == "site_visit":
            logger.info(f"[gst-invoice] skipping site-visit token {cf_order_id} (₹{amount_check})")
            return None

        existing = await db.invoices.find_one({"cashfree_order_id": cf_order_id}, {"_id": 0, "id": 1})
        if existing:
            return existing

        # Derive project type from the order metadata
        if ptype == "shop_order":
            project_type = "solar_goods"   # shop sales default to 5% goods
        elif booking == "book_solar_service" or ptype in {"book_solar_service", "service", "booking"}:
            project_type = "service"       # paid service bookings = 18% SAC
        else:
            project_type = "solar_project"  # full 70/30 split (default for EPC projects)

        amount = amount_check
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
