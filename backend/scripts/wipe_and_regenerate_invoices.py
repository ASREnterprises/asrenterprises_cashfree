"""
One-shot migration (2026-04-26):
- Wipe `db.invoices`, `db.agreements`, on-disk PDFs.
- Rebuild invoices from `db.customers` (those with total_cost > 0) using the
  CURRENT GST policy:
    • residential / customer_type=residential → PMSG flat 5% GST
    • everyone else                          → 90/10 Full EPC split (6.3%)
- DO NOT auto-send to customer / CA — admin will send manually from CRM.
- Solar Hub Cashfree shop_order invoices are NOT regenerated here (those
  invoices live alongside the order_id and are auto-issued ONLY on
  Cashfree PAYMENT_SUCCESS — that path is separate and untouched).

Run:
    cd /app/backend && python -m scripts.wipe_and_regenerate_invoices
"""
import asyncio
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db_client import get_db  # noqa: E402
from routes.gst_invoices import (  # noqa: E402
    _create_and_persist_invoice,
    CreateInvoiceRequest,
    InvoiceCustomer,
)

PDF_DIR = Path("/app/backend/invoices")
AGREEMENT_DIR = Path("/app/backend/agreements")


async def wipe(db) -> dict:
    inv_count = await db.invoices.count_documents({})
    agr_count = await db.agreements.count_documents({})

    await db.invoices.delete_many({})
    await db.agreements.delete_many({})
    # Reset auto-numbering counters so new invoices start at 001
    counter_count = await db.invoice_counters.count_documents({})
    await db.invoice_counters.delete_many({})
    # Legacy fallback collection (older schema)
    await db.counters.delete_many({"_id": {"$in": ["invoice_number", "quotation_number"]}})

    # Wipe PDFs on disk (best-effort, ignore missing directories)
    for d in (PDF_DIR, AGREEMENT_DIR):
        if d.exists():
            for p in d.iterdir():
                try:
                    if p.is_file():
                        p.unlink()
                except Exception:
                    pass

    # Clear linked customer fields
    await db.customers.update_many(
        {},
        {"$set": {"invoice_ids": [], "agreement_ids": []}},
    )

    return {
        "invoices_deleted": inv_count,
        "agreements_deleted": agr_count,
        "counters_reset": counter_count,
    }


async def regenerate(db) -> dict:
    cursor = db.customers.find({}, {"_id": 0})
    rebuilt = 0
    skipped = 0
    failed = 0
    failures: list[str] = []

    async for cust in cursor:
        total = float(cust.get("total_cost") or 0)
        mobile = (cust.get("mobile") or "").strip()
        if total <= 0 or not mobile:
            skipped += 1
            continue

        is_pmsg = (cust.get("customer_type") or "").lower() == "residential"
        if is_pmsg:
            project_type = "solar_project_flat_5"
            scheme = "pm_surya_ghar"
            rate = 0.05
        else:
            project_type = "solar_project"
            scheme = ""
            rate = 0.063

        pre_gst = round(total / (1 + rate), 2)

        sys_kw = cust.get("system_capacity_kw") or ""
        app_id = (cust.get("application_id") or "").strip()
        proj_name_bits = []
        if sys_kw:
            proj_name_bits.append(f"{sys_kw} kW")
        proj_name_bits.append("Solar Rooftop System")
        if is_pmsg:
            proj_name_bits.append("(PM Surya Ghar Yojana)")
        proj_name = " ".join(proj_name_bits).strip()

        notes_bits = ["Regenerated 2026-04-26 (PMSG flat 5% policy)."]
        if is_pmsg:
            notes_bits.append("Scheme: PM Surya Ghar Muft Bijli Yojana")
            if app_id:
                notes_bits.append(f"PMSG Application No: {app_id}")
        notes = " | ".join(notes_bits)

        try:
            req = CreateInvoiceRequest(
                customer=InvoiceCustomer(
                    name=cust.get("name") or "Customer",
                    phone=mobile,
                    email=(cust.get("email") or "").strip(),
                    address=(cust.get("address") or "").strip(),
                    state=(cust.get("state") or "Bihar"),
                    state_code="10",
                ),
                project_type=project_type,
                total_amount=pre_gst,
                target_grand_total=total,    # exact match to admin-entered total_cost
                project_name=proj_name,
                notes=notes,
                doc_type="invoice",
                scheme=scheme,
                # Manual send only — admin/CA push from CRM.
                auto_send_whatsapp=False,
                auto_send_email=False,
            )
            inv = await _create_and_persist_invoice(req)

            # Back-fill amount_paid + payment status to match the customer doc
            paid = float(cust.get("amount_paid") or 0)
            grand = float(inv.get("grand_total") or 0)
            if paid > 0 and grand > 0:
                paid_clamped = min(paid, grand)
                new_due = max(0.0, round(grand - paid_clamped, 2))
                new_status = "paid" if paid_clamped + 0.01 >= grand else "partial"
                from datetime import datetime, timezone
                import uuid as _uuid
                entry = {
                    "id": str(_uuid.uuid4()),
                    "amount": paid_clamped,
                    "payment_mode": "ICICI" if is_pmsg else (cust.get("payment_mode") or "SBI"),
                    "payment_date": (
                        cust.get("installation_date")
                        or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    ),
                    "reference": "BACKFILL-REGEN-2026-04-26",
                    "notes": "Regenerated from customer record (PMSG flat 5% policy)",
                    "recorded_by": "system:regen",
                    "recorded_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.invoices.update_one(
                    {"id": inv["id"]},
                    {"$set": {
                        "amount_paid": paid_clamped,
                        "due_amount": new_due,
                        "payment_status": new_status,
                    }, "$push": {"payment_history": entry}},
                )

            # Link invoice id back onto customer
            await db.customers.update_one(
                {"id": cust["id"]},
                {"$addToSet": {"invoice_ids": inv["id"]}},
            )
            rebuilt += 1
        except Exception as e:
            failed += 1
            failures.append(f"{cust.get('name') or '?'} ({mobile}): {e}")

    return {
        "rebuilt": rebuilt,
        "skipped_no_total_cost": skipped,
        "failed": failed,
        "failures": failures,
    }


async def main():
    db = get_db()
    print("=== ASR Invoice Regeneration (2026-04-26) ===")
    print(f"DB: {os.environ.get('DB_NAME')}")
    wiped = await wipe(db)
    print("WIPED:", wiped)
    rebuilt = await regenerate(db)
    print("REGEN:", rebuilt)


if __name__ == "__main__":
    asyncio.run(main())
