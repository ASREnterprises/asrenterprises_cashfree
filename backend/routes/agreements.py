"""
Solar Agreement generator for PM Surya Ghar Yojana customers.

Trigger: `auto_generate_for_quotation` is called from `_create_and_persist_invoice`
whenever a NEW quotation is created with `scheme == "pm_surya_ghar"`.
Produces a fully-rendered PDF (WeasyPrint) with transparent stamp + signature
overlays on pages 1, 2, 3, and 5, stores the record in `db.agreements`, and
pushes the agreement id onto `customer.agreement_ids[]` so it surfaces
in the Customer Portal → Documents tab.

Endpoints (mounted under /api/agreements):
  GET    /customer/{phone}           → list agreements for a customer
  GET    /{agreement_id}              → fetch a single agreement (with signed URL)
  GET    /{agreement_id}/pdf          → stream the PDF
  POST   /{agreement_id}/send-whatsapp → send the PDF to the customer on WhatsApp
  POST   /generate                    → manual generation (admin override)
"""
from __future__ import annotations

import base64
import io
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from weasyprint import HTML, CSS  # type: ignore
# Use PyPDF2 (already pinned in requirements.txt) rather than pypdf.
from PyPDF2 import PdfReader, PdfWriter                              # type: ignore

from db_client import get_db

router = APIRouter(prefix="/agreements", tags=["Solar Agreement"])
logger = logging.getLogger(__name__)
db = get_db()

AGREEMENT_DIR = Path("/app/backend/agreements")
AGREEMENT_DIR.mkdir(parents=True, exist_ok=True)

STAMP_PATH = Path("/app/backend/data/signature_stamp.png")
# 0-indexed: pages 1, 2, 3 + last (signature) page of the PDF.
# The signature/agreement terms are always finalised on the last page, so
# stamping that one guarantees the seal lands next to the signature block
# regardless of how the dynamic content paginates.
OVERLAY_FIRST_PAGES = {0, 1, 2}
STAMP_ON_LAST_PAGE = True

DEFAULT_PAYMENT_TERMS = (
    "Advance 25% at booking · 50% at material delivery · 20% at installation · "
    "5% after net-metering approval by DISCOM."
)


# ---------- HTML template ----------
# EXACT text per user spec. Variables: {customer_name, customer_address,
# day, month, year, payment_terms}. Do not edit copy.
_TEMPLATE = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 22mm 20mm 28mm 20mm; }
  body { font-family: "DejaVu Serif", "Times New Roman", serif; color:#111; font-size:11pt; line-height:1.45; }
  h1 { text-align:center; font-size:14pt; margin: 0 0 10px; }
  h2 { text-align:center; font-size:12pt; margin: 10px 0 14px; font-weight: 600; }
  .center { text-align:center; }
  .sub { font-size:10.5pt; text-align:center; color:#333; }
  .hr { height:1px; background:#ccc; margin:12px 0; }
  p { margin: 6px 0 8px; text-align: justify; }
  ol { padding-left: 22px; }
  ol li { margin: 4px 0 6px; text-align: justify; }
  .sig-row { margin-top: 46px; display: flex; justify-content: space-between; gap: 40px; }
  .sig-box { flex:1; }
  .sig-box p { margin: 3px 0; }
  .disclaimer { margin-top: 28px; font-size: 10pt; font-style: italic; color: #555; }
  .page-break { page-break-before: always; }
</style></head><body>

<h2>Guidelines for PM-Surya Ghar: Muft Bijli Yojana<br/>
<span style="font-weight:400">Central Financial Assistance to Residential Consumers</span></h2>

<p class="center"><strong>Annexure 2</strong></p>
<h1>Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS)
project under PM- Surya Ghar: Muft Bijli Yojana</h1>

<p>This agreement is executed on <strong>{day}</strong> (Day)
<strong>{month}</strong> (Month) <strong>{year}</strong> (Year) for design, supply, installation,
commissioning and 5 year comprehensive maintenance of RTS project/system along with warranty
under PM Surya Ghar: Muft Bijli Yojana</p>

<p><strong>Between</strong></p>
<p><strong>{customer_name}</strong> having address <strong>{customer_address}</strong>
(here in after referred to as first Party, i.e./consumer/consumer/purchaser/owner of system).</p>

<p><strong>And</strong></p>
<p><strong>ASR ENTERPRISES</strong> having registered office at Dwarikapuri Khagaul Patna Bihar 801105
(Here in after referred to as second Party i.e. Vendor/contractor /System Integrator).</p>

<p><strong>Whereas</strong></p>
<p>First party wishes to install a Grid Connected Rooftop Solar Plant on the roof top of the residential
building of the Consumer under PM Surya Ghar: Muft Bijli Yojana.</p>

<p><strong>And whereas</strong></p>
<p>Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected
rooftop Solar plant and that second party is willing to design, supply, install, test, commission and carry
out Operation &amp; Maintenance of the Rooftop Solar plant for 5 year period.</p>

<p>On this day, the First Party and Second Party agree to the following:</p>

<p><strong>The First Party here by undertakes to perform the following activities:</strong></p>
<p>Submission of online application at national Portal for installation of RTS project/system, Submission of
application for net-metering and system inspection and upload of the relevant documents on the
National portal of the scheme</p>

<ol>
  <li>Provide secure storage of the material of RTS plant delivered at the premises till handover of the system.</li>
  <li>Provide access to the roof top during installation of plant, operation &amp; maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</li>
  <li>Provide electricity during plant installation and water for cleaning of panels.</li>
  <li>Report any malfunctioning of the plant to the vendor during the warranty period.</li>
  <li>Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work/customization required depending upon the building condition.</li>
</ol>

<p><strong>The Second Party here by undertakes to perform the following activities:</strong></p>
<ol>
  <li>The vendor must follow all standards and safety guidelines prescribed under state regulation and technical standards prescribed by MNRE for RTS project, failing which the vendor is liable for blacklisting from participation in the govt. Project/ scheme and other penal action in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the vendor.</li>
  <li><strong>Site Survey:</strong> Site visit, survey and development of detailed project report for installation of RTS system. This also includes feasibility study of roof, strength of roof and shadow free area. If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the vendor shall prepare an estimate and can raise separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the vendor.</li>
  <li><strong>Design &amp; Engineering:</strong> Design of plant along with drawings and selection of components s per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.
    <p><strong>Module and Inverter:</strong> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labeling (solar modules), quality control orders and standards &amp; labeling (inverters) etc., shall also be complied.</p>
    <p><strong>Procurement &amp; Supply:</strong> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</p>
    <p><strong>Installation &amp; Civil work:</strong> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</p>
    <p><strong>Documentation (Technical Catalogue/Warranty Certificates/BIS certificates/other test reports etc):</strong> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty Card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</p>
  </li>
  <li><strong>Project completion report (PCR):</strong> Assisting the consumer in filling and uploading of signed documents (Consumer &amp; Vendor) on the national portal.</li>
  <li><strong>Warranty:</strong> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from manufacturer.</li>
  <li><strong>NET meter &amp; Grid Connectivity:</strong> Net meter supply/procurement, testing and approvals shall be In the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</li>
  <li><strong>Testing and Commissioning:</strong> The vendor shall be present at the time of testing and commissioning by the DISCOM.</li>
  <li><strong>Operation &amp; Maintenance:</strong> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</li>
  <li><strong>Insurance:</strong> Any insurance cost pertaining to material transfer/storage before Commissioning of the system shall be in the scope of the vendor.</li>
  <li><strong>Applicable Standard:</strong> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMS.</li>
  <li><strong>Project/system cost &amp; payment terms:</strong> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</li>
  <li><strong>Dispute:</strong> In-case of any dispute between consumer and vendor (in supply/installation/maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to any dispute arising between vendor and consumer.</li>
  <li><strong>Subsidy / Project Related Documents:</strong> Vendor must provide all the documents to consumer and help in uploading the same to National Portal for smooth release of subsidy.</li>
  <li><strong>Performance of Plant:</strong> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or Its authorized agency. Vendor must provide</li>
  <li><strong>Mutually Agreed Terms of Payment:</strong> {payment_terms}</li>
</ol>

<div class="page-break"></div>

<div class="sig-row">
  <div class="sig-box">
    <p><strong>First Party</strong></p>
    <p>Name: <strong>{customer_name}</strong></p>
    <p>Address: {customer_address}</p>
    <p style="margin-top:40px">Sign ________________________</p>
    <p>Date ________________________</p>
  </div>
  <div class="sig-box">
    <p><strong>Second Party</strong></p>
    <p>Name : <strong>ASR ENTERPRISES</strong></p>
    <p>Address : Dwarikapuri Khagaul Patna Bihar 801105</p>
    <p style="margin-top:40px">Sign ________________________</p>
    <p>Date ________________________</p>
  </div>
</div>

<p class="disclaimer">Disclaimer : This agreement is between vendor and consumer and any dispute related
to the same shall not involve any third party including MNRE and Distribution Utilities.</p>

</body></html>
"""


# ---------- PDF helpers ----------
def _render_html_to_pdf_bytes(html: str) -> bytes:
    """Render our templated HTML into raw PDF bytes via WeasyPrint."""
    return HTML(string=html).write_pdf()


def _build_stamp_overlay_pdf(target_bytes: bytes) -> bytes:
    """Produce a one-page-per-target-page overlay PDF that stamps the
    signature image at the bottom-right of pages 0,1,2,4 (= 1,2,3,5).

    Uses reportlab to draw the PNG at native aspect ratio, sized ~65mm wide.
    """
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm

    source = PdfReader(io.BytesIO(target_bytes))
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    stamp_exists = STAMP_PATH.exists()
    if not stamp_exists:
        logger.warning("[agreement] signature stamp PNG missing at %s — overlay will be empty.", STAMP_PATH)

    w, h = A4   # points
    # Stamp target: 65mm wide, keep aspect
    target_w = 65 * mm

    for idx in range(len(source.pages)):
        is_last = idx == len(source.pages) - 1
        should_stamp = stamp_exists and (
            idx in OVERLAY_FIRST_PAGES or (STAMP_ON_LAST_PAGE and is_last)
        )
        if should_stamp:
            try:
                from PIL import Image
                img = Image.open(STAMP_PATH)
                iw, ih = img.size
                aspect = ih / iw
                target_h = target_w * aspect
                # Bottom-right, leaving 18mm margin, above footer text
                x = w - target_w - (20 * mm)
                y = 22 * mm
                c.drawImage(
                    str(STAMP_PATH), x, y, width=target_w, height=target_h,
                    preserveAspectRatio=True, mask="auto",
                )
                # Small "Authorized Signatory" caption
                c.setFont("Helvetica-Oblique", 7)
                c.setFillGray(0.4)
                c.drawString(x, y - 3 * mm, "Authorised Signatory — Abhijeet Kumar, ASR Enterprises")
            except Exception as e:
                logger.warning(f"[agreement] overlay draw failed on page {idx}: {e}")
        c.showPage()
    c.save()

    # Merge overlay with source
    overlay_reader = PdfReader(io.BytesIO(buf.getvalue()))
    writer = PdfWriter()
    for idx, page in enumerate(source.pages):
        if idx < len(overlay_reader.pages):
            page.merge_page(overlay_reader.pages[idx])
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _build_agreement_pdf(*, customer_name: str, customer_address: str,
                         payment_terms: str = DEFAULT_PAYMENT_TERMS) -> bytes:
    now = datetime.now(timezone.utc).astimezone()
    # Use str.replace (NOT str.format) because the template contains CSS braces
    # like "@page { size: A4; ... }" that would blow up str.format with
    # KeyError: ' size'.
    import html as _html_mod

    def _esc(val: str) -> str:
        return _html_mod.escape((val or "—").strip())

    html = (
        _TEMPLATE
        .replace("{customer_name}", _esc(customer_name))
        .replace("{customer_address}", _esc(customer_address))
        .replace("{payment_terms}", _esc(payment_terms or DEFAULT_PAYMENT_TERMS))
        .replace("{day}", now.strftime("%d"))
        .replace("{month}", now.strftime("%B"))
        .replace("{year}", now.strftime("%Y"))
    )
    pdf_bytes = _render_html_to_pdf_bytes(html)
    try:
        pdf_bytes = _build_stamp_overlay_pdf(pdf_bytes)
    except Exception as e:
        logger.warning(f"[agreement] stamp overlay skipped: {e}")
    return pdf_bytes


# ---------- Auto-trigger (called from gst_invoices.py) ----------
async def auto_generate_for_quotation(quote_doc: Dict) -> Optional[Dict]:
    """Generate a Solar Agreement PDF for a freshly-created quotation.

    Returns the agreement record (or None on error). Runs best-effort so it
    never fails the upstream quotation creation.
    """
    try:
        if (quote_doc.get("doc_type") or "") != "quotation":
            return None
        if (quote_doc.get("scheme") or "").lower() != "pm_surya_ghar":
            return None
        cust = quote_doc.get("customer") or {}
        customer_phone = (cust.get("phone") or "").strip()
        if not customer_phone:
            return None

        # Pull address from linked customer doc if available, else from quote
        customer = await db.customers.find_one(
            {"mobile": customer_phone[-10:]},
            {"_id": 0, "address": 1, "district": 1, "name": 1, "id": 1},
        )
        address_bits = [cust.get("address") or (customer or {}).get("address") or ""]
        district = (customer or {}).get("district") or ""
        if district and district not in (address_bits[0] or ""):
            address_bits.append(district)
        full_address = ", ".join(b for b in address_bits if b).strip(", ")
        name = cust.get("name") or (customer or {}).get("name") or "Customer"

        payment_terms = DEFAULT_PAYMENT_TERMS
        # Prefer quotation notes when they carry an explicit payment schedule
        notes = (quote_doc.get("notes") or "").strip()
        if "Terms of Payment" in notes or "payment" in notes.lower():
            payment_terms = notes[:600]

        pdf_bytes = _build_agreement_pdf(
            customer_name=name, customer_address=full_address, payment_terms=payment_terms,
        )

        agreement_id = str(uuid.uuid4())
        safe_inv = (quote_doc.get("invoice_number") or "").replace("/", "_")
        filename = f"agreement_{safe_inv or agreement_id}.pdf"
        pdf_path = AGREEMENT_DIR / filename
        pdf_path.write_bytes(pdf_bytes)

        record = {
            "id": agreement_id,
            "customer_phone": customer_phone[-10:],
            "customer_id": (customer or {}).get("id", ""),
            "customer_name": name,
            "customer_address": full_address,
            "quotation_id": quote_doc.get("id"),
            "quotation_number": quote_doc.get("invoice_number"),
            "scheme": "pm_surya_ghar",
            "payment_terms": payment_terms,
            "pdf_path": str(pdf_path),
            "file_size": len(pdf_bytes),
            "status": "generated",
            "whatsapp_sent_at": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.agreements.insert_one(record)
        record.pop("_id", None)

        # Link to customer so it surfaces in the Customer Portal Documents tab
        if customer and customer.get("id"):
            await db.customers.update_one(
                {"id": customer["id"]},
                {"$addToSet": {"agreement_ids": agreement_id}},
            )
        logger.info(f"[agreement] generated {filename} for {name} ({customer_phone[-10:]})")
        return record
    except Exception as e:
        logger.error(f"[agreement] auto-generation failed: {e}", exc_info=True)
        return None


# ---------- Endpoints ----------
@router.get("")
async def list_agreements(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    """Admin: paginated list of all Solar Agreements (not in trash)."""
    import re as _re
    q: Dict = {}
    if search:
        safe = _re.escape(search)
        q["$or"] = [
            {"customer_name": {"$regex": safe, "$options": "i"}},
            {"customer_phone": {"$regex": safe, "$options": "i"}},
            {"quotation_number": {"$regex": safe, "$options": "i"}},
        ]
    skip = max(0, (page - 1) * limit)
    total = await db.agreements.count_documents(q)
    cur = db.agreements.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cur.to_list(length=limit)
    return {"total": total, "page": page, "limit": limit, "agreements": items}


@router.delete("/{agreement_id}")
async def delete_agreement(agreement_id: str):
    """Soft-delete the agreement into the 30-day Trash. PDF file preserved on disk."""
    doc = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Agreement not found")
    try:
        from routes.trash import move_to_trash
        entry = await move_to_trash("agreements", doc, deleted_by="admin")
    except Exception as e:
        logger.error(f"[agreement] move to trash failed: {e}")
        raise HTTPException(500, f"Failed to move to trash: {e}")
    await db.agreements.delete_one({"id": agreement_id})
    # Unlink from customer.agreement_ids so the Customer Portal hides it
    try:
        await db.customers.update_many(
            {"agreement_ids": agreement_id},
            {"$pull": {"agreement_ids": agreement_id}},
        )
    except Exception:
        pass
    return {"success": True, "moved_to_trash": True, "trash_id": entry["id"]}


@router.get("/customer/{phone}")
async def list_customer_agreements(phone: str):
    """All Solar Agreements for a customer (most-recent first)."""
    import re
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        raise HTTPException(400, "Invalid mobile number")
    items = await db.agreements.find(
        {"customer_phone": digits}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    return {"total": len(items), "agreements": items}


@router.get("/{agreement_id}")
async def get_agreement(agreement_id: str):
    doc = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Agreement not found")
    return doc


@router.get("/{agreement_id}/pdf")
async def agreement_pdf(agreement_id: str):
    doc = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Agreement not found")
    p = Path(doc.get("pdf_path") or "")
    if not p.exists():
        raise HTTPException(404, "Agreement PDF file missing on disk")
    return FileResponse(str(p), media_type="application/pdf", filename=p.name)


class GenerateRequest(BaseModel):
    quotation_id: str


@router.post("/generate")
async def generate_manually(payload: GenerateRequest):
    """Admin can manually (re-)generate the Agreement from a quotation id."""
    quote = await db.invoices.find_one({"id": payload.quotation_id}, {"_id": 0})
    if not quote:
        raise HTTPException(404, "Quotation not found")
    if (quote.get("scheme") or "").lower() != "pm_surya_ghar":
        raise HTTPException(400, "Agreement can only be generated for PM Surya Ghar quotations")
    # Force doc_type to quotation for the auto helper
    quote["doc_type"] = "quotation"
    record = await auto_generate_for_quotation(quote)
    if not record:
        raise HTTPException(500, "Agreement generation failed")
    return {"success": True, "agreement": record}


class WhatsAppSendResponse(BaseModel):
    success: bool
    whatsapp_sent_at: str = ""
    error: str = ""


@router.post("/{agreement_id}/send-whatsapp", response_model=WhatsAppSendResponse)
async def send_agreement_whatsapp(agreement_id: str):
    """Send the generated Agreement PDF to the customer on WhatsApp.

    Uses the Meta Graph API wired up in routes/whatsapp.py. Falls back to
    logging + returning the error message if the token isn't configured.
    """
    doc = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Agreement not found")

    pdf_path = Path(doc.get("pdf_path") or "")
    if not pdf_path.exists():
        raise HTTPException(400, "Agreement PDF file missing — please regenerate")

    phone = doc.get("customer_phone") or ""
    if len(phone) == 10:
        phone = "91" + phone

    # Build the fixed message per spec
    customer_name = (doc.get("customer_name") or "").strip() or "Customer"
    text = (
        f"Hello {customer_name}, your Solar Agreement under PM Surya Ghar Yojana is ready. "
        f"Please check the attached document. - ASR Enterprises"
    )

    try:
        from routes.whatsapp import get_whatsapp_settings, _is_opted_out
    except Exception:
        get_whatsapp_settings = None
        _is_opted_out = None

    if get_whatsapp_settings is None:
        raise HTTPException(503, "WhatsApp send helper not available on this instance")

    # Respect opt-out
    try:
        if _is_opted_out and await _is_opted_out(phone):
            return WhatsAppSendResponse(success=False, error="Customer has opted out of WhatsApp")
    except Exception:
        pass

    try:
        settings = await get_whatsapp_settings()
        token = (settings or {}).get("access_token", "").strip()
        phone_id = (settings or {}).get("phone_number_id", "").strip()
        if not token or not phone_id:
            raise HTTPException(503, "WhatsApp is not configured (access_token / phone_number_id missing).")

        import httpx

        async with httpx.AsyncClient(timeout=45.0) as client:
            # 1) Upload PDF to /media
            pdf_bytes = pdf_path.read_bytes()
            up = await client.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/media",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": (pdf_path.name, pdf_bytes, "application/pdf")},
                data={"messaging_product": "whatsapp", "type": "application/pdf"},
            )
            if up.status_code not in (200, 201):
                logger.warning(f"[agreement] media upload failed ({up.status_code}): {up.text[:200]}")
                return WhatsAppSendResponse(success=False, error=f"Media upload failed ({up.status_code})")
            media_id = up.json().get("id", "")
            if not media_id:
                return WhatsAppSendResponse(success=False, error="No media_id returned from Meta")

            # 2) Send document message with caption
            send = await client.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp", "to": phone, "type": "document",
                    "document": {"id": media_id, "caption": text, "filename": pdf_path.name},
                },
            )
            if send.status_code not in (200, 201):
                logger.warning(f"[agreement] send failed ({send.status_code}): {send.text[:200]}")
                return WhatsAppSendResponse(success=False, error=f"Send failed ({send.status_code})")

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.agreements.update_one(
            {"id": agreement_id},
            {"$set": {"whatsapp_sent_at": now_iso, "status": "sent"}},
        )
        return WhatsAppSendResponse(success=True, whatsapp_sent_at=now_iso)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[agreement] WhatsApp send error: {e}", exc_info=True)
        return WhatsAppSendResponse(success=False, error=str(e))
