"""
One-shot migration (2026-04-26):
- Wipe `db.invoices`, `db.agreements`, on-disk PDFs.
- Rebuild invoices using the CURRENT GST policy:
    • PMSG / residential customer → PMSG flat 5% GST
    • everyone else               → 90/10 Full EPC split (6.3%)
  Two source paths are tried in order, per phone number:
    1. `db.customers` with `total_cost > 0`   (preferred; admin-curated)
    2. Pre-wipe snapshot of the existing invoice's grand_total (legacy)
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

    # Snapshot legacy invoices BEFORE wiping so we can rebuild any whose
    # customer record doesn't carry `total_cost` (rare on prod). Keyed by
    # normalized phone — first invoice per phone wins.
    snapshot: dict = {}
    async for inv in db.invoices.find(
        {"doc_type": {"$ne": "quotation"}},
        {"_id": 0, "customer": 1, "grand_total": 1, "amount_paid": 1,
         "scheme": 1, "invoice_date": 1, "created_at": 1, "notes": 1,
         "_project_name": 1, "line_items": 1},
    ):
        cust = inv.get("customer") or {}
        phone = (cust.get("phone") or "").strip()
        if not phone or phone in snapshot:
            continue
        snapshot[phone] = {
            "name": cust.get("name") or "",
            "address": cust.get("address") or "",
            "state": cust.get("state") or "Bihar",
            "state_code": cust.get("state_code") or "10",
            "email": cust.get("email") or "",
            "grand_total": float(inv.get("grand_total") or 0),
            "amount_paid": float(inv.get("amount_paid") or 0),
            "scheme": (inv.get("scheme") or "").lower(),
            "invoice_date": inv.get("invoice_date") or "",
            "created_at": inv.get("created_at") or "",
            "project_name": inv.get("_project_name") or "",
            "notes": inv.get("notes") or "",
        }

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
        "legacy_snapshot": snapshot,
    }


async def regenerate(db, snapshot: dict | None = None) -> dict:
    snapshot = snapshot or {}
    consumed_phones: set = set()  # phones already rebuilt from db.customers

    cursor = db.customers.find({}, {"_id": 0})
    rebuilt = 0
    skipped = 0
    failed = 0
    failures: list[str] = []

    async for cust in cursor:
        mobile = (cust.get("mobile") or "").strip()
        total = float(cust.get("total_cost") or 0)
        # Fallback: if customer.total_cost is empty but we have a legacy invoice
        # snapshot for this phone, use the invoice's old grand_total.
        snap = snapshot.get(mobile) or {}
        if total <= 0 and snap.get("grand_total", 0) > 0:
            total = float(snap["grand_total"])
        if total <= 0 or not mobile:
            skipped += 1
            continue
        consumed_phones.add(mobile)

        is_pmsg = (cust.get("customer_type") or "").lower() == "residential"
        # Strong second signal: legacy invoice already had scheme=pm_surya_ghar.
        if not is_pmsg and snap.get("scheme") == "pm_surya_ghar":
            is_pmsg = True
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
                    name=cust.get("name") or snap.get("name") or "Customer",
                    phone=mobile,
                    email=(cust.get("email") or snap.get("email") or "").strip(),
                    address=(cust.get("address") or snap.get("address") or "").strip(),
                    state=(cust.get("state") or snap.get("state") or "Bihar"),
                    state_code="10",
                ),
                project_type=project_type,
                total_amount=pre_gst,
                target_grand_total=total,    # exact match
                project_name=proj_name,
                notes=notes,
                doc_type="invoice",
                scheme=scheme,
                auto_send_whatsapp=False,
                auto_send_email=False,
            )
            inv = await _create_and_persist_invoice(req)

            paid = float(cust.get("amount_paid") or snap.get("amount_paid") or 0)
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

            await db.customers.update_one(
                {"id": cust["id"]},
                {"$addToSet": {"invoice_ids": inv["id"]}},
            )
            rebuilt += 1
        except Exception as e:
            failed += 1
            failures.append(f"{cust.get('name') or '?'} ({mobile}): {e}")

    # Phase 2: regenerate any phones present ONLY in legacy snapshot (no
    # matching customers row). These typically come from older invoice
    # generation flows that pre-date the customer-portal sync.
    orphans_rebuilt = 0
    for phone, snap in snapshot.items():
        if phone in consumed_phones:
            continue
        total = float(snap.get("grand_total") or 0)
        if total <= 0:
            continue
        is_pmsg = snap.get("scheme") == "pm_surya_ghar"
        if is_pmsg:
            project_type, scheme, rate = "solar_project_flat_5", "pm_surya_ghar", 0.05
        else:
            project_type, scheme, rate = "solar_project", "", 0.063
        pre_gst = round(total / (1 + rate), 2)
        try:
            req = CreateInvoiceRequest(
                customer=InvoiceCustomer(
                    name=snap.get("name") or "Customer",
                    phone=phone,
                    email=snap.get("email") or "",
                    address=snap.get("address") or "",
                    state=snap.get("state") or "Bihar",
                    state_code=snap.get("state_code") or "10",
                ),
                project_type=project_type,
                total_amount=pre_gst,
                target_grand_total=total,
                project_name=snap.get("project_name") or "Solar Rooftop System",
                notes="Regenerated 2026-04-26 from legacy invoice snapshot.",
                doc_type="invoice",
                scheme=scheme,
                auto_send_whatsapp=False,
                auto_send_email=False,
            )
            inv = await _create_and_persist_invoice(req)
            paid = float(snap.get("amount_paid") or 0)
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
                    "payment_mode": "ICICI" if is_pmsg else "SBI",
                    "payment_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "reference": "BACKFILL-REGEN-2026-04-26",
                    "notes": "Regenerated from legacy invoice snapshot",
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
            orphans_rebuilt += 1
        except Exception as e:
            failed += 1
            failures.append(f"orphan {snap.get('name') or '?'} ({phone}): {e}")

    return {
        "rebuilt_from_customers": rebuilt,
        "rebuilt_from_legacy_snapshot": orphans_rebuilt,
        "skipped_no_total_cost": skipped,
        "failed": failed,
        "failures": failures,
    }


async def main():
    db = get_db()
    print("=== ASR Invoice Regeneration (2026-04-26) ===")
    print(f"DB: {os.environ.get('DB_NAME')}")
    wiped = await wipe(db)
    snapshot = wiped.pop("legacy_snapshot", {})
    print("WIPED:", wiped, f"| legacy phones snapshotted: {len(snapshot)}")
    rebuilt = await regenerate(db, snapshot)
    print("REGEN:", rebuilt)


if __name__ == "__main__":
    asyncio.run(main())
