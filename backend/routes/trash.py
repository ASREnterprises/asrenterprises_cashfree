"""
Soft-Delete Trash module.

Any DELETE across GST Invoices / Customers / Shop Orders / Solar Advisors
moves the doc into `db.trash` instead of destroying it. Items sit there for
30 days and can be restored, then are permanently purged by a daily
APScheduler job.

Trash document shape:
  {
    id:              str   (UUID for the trash entry itself)
    source_collection: str (invoices | customers | orders | agents)
    original_id:     str   (the original doc's `id` field)
    label:           str   (human-friendly name — invoice #, customer name, etc.)
    subtitle:        str   (secondary line of info)
    data:            dict  (the full original document, minus _id)
    deleted_at:      ISO str
    deleted_by:      str
    expires_at:      ISO str
  }

Public endpoints (mounted under /api/trash):
  GET    /            → paginated trash list, optional source filter
  POST   /{trash_id}/restore  → restore original doc
  DELETE /{trash_id}  → permanent purge
  POST   /purge-expired       → admin manual trigger; same work the scheduler does
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db_client import get_db

router = APIRouter(prefix="/trash", tags=["Trash"])
logger = logging.getLogger(__name__)
db = get_db()


TRASH_TTL_DAYS = 30
SOURCE_LABELS = {
    "invoices": "Invoices & Quotations",
    "customers": "Customers",
    "orders": "Shop Orders",
    "agents": "Solar Advisors",
    "agreements": "Solar Agreements",
    "crm_leads": "CRM Leads",
}


def _label_for_doc(source: str, doc: Dict) -> Dict[str, str]:
    """Build a friendly label/subtitle pair so the Trash UI doesn't need to
    peek inside each collection's schema."""
    if source == "invoices":
        return {
            "label": f"{doc.get('doc_type', 'invoice').title()} #{doc.get('invoice_number', '—')}",
            "subtitle": f"{(doc.get('customer') or {}).get('name', 'Unknown')} · ₹{doc.get('grand_total', 0):,.0f}",
        }
    if source == "customers":
        return {
            "label": doc.get("name", "Unnamed Customer"),
            "subtitle": f"{doc.get('mobile', '—')} · {doc.get('scheme', doc.get('customer_type', '—'))}",
        }
    if source == "orders":
        return {
            "label": f"Order #{doc.get('order_number', doc.get('id', '—'))}",
            "subtitle": f"{doc.get('customer_name', 'Unknown')} · ₹{doc.get('total', 0):,.0f}",
        }
    if source == "agents":
        return {
            "label": doc.get("name", "Unnamed Advisor"),
            "subtitle": f"{doc.get('agent_id', '—')} · {doc.get('phone', '—')}",
        }
    if source == "agreements":
        return {
            "label": f"Solar Agreement — {doc.get('quotation_number', '—')}",
            "subtitle": f"{doc.get('customer_name', '—')} · {doc.get('customer_phone', '—')}",
        }
    if source == "crm_leads":
        reason = doc.get("trashed_reason") or ""
        tag = f" · {reason}" if reason else ""
        return {
            "label": doc.get("name", "—") or f"Lead {(doc.get('phone') or '')[-4:]}",
            "subtitle": f"{doc.get('phone', '—')} · {doc.get('source', 'manual')}{tag}",
        }
    return {"label": doc.get("name") or doc.get("id", "—"), "subtitle": ""}


async def move_to_trash(source: str, doc: Dict, deleted_by: str = "admin") -> Dict:
    """Move a doc into the trash collection. Returns the trash entry."""
    if source not in SOURCE_LABELS:
        raise HTTPException(400, f"Invalid trash source '{source}'")

    clean = {k: v for k, v in doc.items() if k != "_id"}
    now = datetime.now(timezone.utc)
    label_info = _label_for_doc(source, clean)
    entry = {
        "id": str(uuid.uuid4()),
        "source_collection": source,
        "original_id": clean.get("id") or str(uuid.uuid4()),
        "label": label_info["label"],
        "subtitle": label_info["subtitle"],
        "data": clean,
        "deleted_at": now.isoformat(),
        "deleted_by": deleted_by,
        "expires_at": (now + timedelta(days=TRASH_TTL_DAYS)).isoformat(),
    }
    await db.trash.insert_one(entry)
    logger.info(f"[trash] moved {source}/{entry['original_id']} → {entry['id']}")
    entry.pop("_id", None)
    return entry


@router.get("")
async def list_trash(
    source: Optional[str] = Query(default=None, description="Filter by source collection"),
    limit: int = Query(default=100, ge=1, le=500),
    page: int = Query(default=1, ge=1),
):
    """List trashed items. Optionally filter by source (invoices/customers/orders/agents)."""
    q = {}
    if source:
        if source not in SOURCE_LABELS:
            raise HTTPException(400, f"Invalid source '{source}'")
        q["source_collection"] = source
    total = await db.trash.count_documents(q)
    cursor = db.trash.find(q, {"_id": 0}).sort("deleted_at", -1).skip((page - 1) * limit).limit(limit)
    items = await cursor.to_list(limit)
    # Attach a `days_remaining` for the UI so we don't parse dates in the client
    now = datetime.now(timezone.utc)
    for it in items:
        try:
            exp = datetime.fromisoformat(it["expires_at"].replace("Z", "+00:00"))
            it["days_remaining"] = max(0, (exp - now).days)
        except Exception:
            it["days_remaining"] = TRASH_TTL_DAYS
    # Counts per source for the tab chips
    counts = {s: await db.trash.count_documents({"source_collection": s}) for s in SOURCE_LABELS}
    return {
        "total": total,
        "items": items,
        "counts": counts,
        "ttl_days": TRASH_TTL_DAYS,
        "sources": SOURCE_LABELS,
    }


class RestoreResponse(BaseModel):
    success: bool
    restored_id: str
    source: str


@router.post("/{trash_id}/restore", response_model=RestoreResponse)
async def restore_item(trash_id: str):
    """Move a trashed doc back into its source collection."""
    entry = await db.trash.find_one({"id": trash_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Trash item not found")
    source = entry["source_collection"]
    if source not in SOURCE_LABELS:
        raise HTTPException(400, f"Invalid source '{source}' on trash entry")

    data = entry.get("data", {})
    data.pop("_id", None)
    original_id = data.get("id") or entry.get("original_id")

    # Insert back — use upsert in case an item with the same id happens to exist
    await db[source].update_one(
        {"id": original_id},
        {"$set": data},
        upsert=True,
    )
    await db.trash.delete_one({"id": trash_id})
    logger.info(f"[trash] restored {source}/{original_id} from trash {trash_id}")
    return RestoreResponse(success=True, restored_id=original_id, source=source)


@router.delete("/{trash_id}")
async def purge_item(trash_id: str):
    """Permanently delete a trashed item (skip the 30-day wait)."""
    res = await db.trash.delete_one({"id": trash_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Trash item not found")
    logger.info(f"[trash] permanently purged {trash_id}")
    return {"success": True, "purged_id": trash_id}


@router.post("/purge-expired")
async def purge_expired():
    """Delete everything in trash whose `expires_at` is in the past.
    Called by the daily APScheduler job; also exposed for manual admin use.
    """
    return await _purge_expired_impl()


async def _purge_expired_impl() -> Dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.trash.delete_many({"expires_at": {"$lte": now_iso}})
    logger.info(f"[trash] daily purge removed {res.deleted_count} expired items")
    return {"success": True, "purged": res.deleted_count, "as_of": now_iso}
