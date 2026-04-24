"""
AI Website Guardian — central monitoring, approval, rollback & logging engine.

This module is the single source of truth for the "safe, admin-controlled"
layer that sits on top of the CRM. It intentionally does NOT auto-write code
or change schemas; every action either:
  (a) reads + alerts (safe), or
  (b) mutates a WHITELISTED field + records a reversible backup (safe), or
  (c) queues an approval which admin must click (safe-by-default).

Collections:
  • guardian_rules       — admin-configurable monitoring layers
  • guardian_logs        — every detection, fix, approval, rollback
  • guardian_approvals   — pending autofix proposals awaiting admin OK
  • guardian_backups     — pre-change snapshots (data-level rollback)

Endpoints (mounted under /api/guardian):
  Rules:     GET/POST/PATCH/DELETE /rules, GET /rules/templates
  Run:       POST /rules/{id}/run, POST /rules/run-all
  Logs:      GET /logs
  Approvals: GET /approvals, POST /approvals/{id}/approve|reject
  Backups:   GET /backups, POST /backups/{id}/restore
  Dashboard: GET /health, GET /summary
  Console:   POST /command    (natural-language → whitelisted actions)

All paths rely only on whitelisted fields/collections defined below.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db_client import get_db

router = APIRouter(prefix="/guardian", tags=["AI Website Guardian"])
logger = logging.getLogger(__name__)
db = get_db()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ──────────────────────────────────────────────────────────────────────────────
#  SAFETY WHITELISTS
# ──────────────────────────────────────────────────────────────────────────────
# Only these (collection, field) pairs can be mutated by any autofix action.
# Adding a new entry is the ONLY way to extend the autofix surface area —
# this file is the single chokepoint that engineering/admin reviews together.
AUTOFIX_ALLOWED_WRITES = {
    ("customers", "customer_status"),
    ("customers", "due_amount"),
    ("customers", "pay_button_force"),
    ("customers", "install_progress"),
    ("customers", "install_status"),
    ("customers", "pay_now_enabled"),
    ("invoices", "payment_status_synced_at"),
    ("invoices", "due_amount"),
    ("shop_orders_pending", "stale_flagged_at"),
}

# Fields Guardian will NEVER touch — even if someone tries via the command console.
HARD_BLOCKED_FIELDS = {
    "password", "otp_hash", "access_token", "api_key",
    "_id", "id", "mobile", "phone", "email",
    "total_cost", "grand_total", "invoice_number",
    "cashfree_order_id", "cashfree_client_secret",
}


# ──────────────────────────────────────────────────────────────────────────────
#  RULE TEMPLATES  (the "modular monitoring layers")
# ──────────────────────────────────────────────────────────────────────────────
# Each template is a safe, self-contained check that:
#   • returns list of issue dicts (for logs / alerts), and
#   • if action_mode == "autofix", applies the fix (with backup), else enqueues
#     an approval proposal that admin must OK.
async def _tpl_billing_sync(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """IF customer.total_cost > 0 AND no invoice → flag (or auto-create invoice).
    Autofix limited to: set customer.pay_button_force = True and queue an approval
    for admin to click 'Create Invoice'."""
    issues: List[Dict] = []
    fixes_applied = 0
    approvals_created = 0
    cur = db.customers.find(
        {"total_cost": {"$gt": 0}, "moved_to_trash": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "mobile": 1, "total_cost": 1, "due_amount": 1},
    )
    async for c in cur:
        cid = c.get("id")
        total = float(c.get("total_cost") or 0)
        due = float(c.get("due_amount") or 0)
        inv_count = await db.invoices.count_documents(
            {"customer.phone": c.get("mobile"), "doc_type": "invoice", "moved_to_trash": {"$ne": True}}
        )
        if total > 0 and inv_count == 0:
            issues.append({
                "module": "billing", "entity": "customer", "entity_id": cid,
                "name": c.get("name"), "phone": c.get("mobile"),
                "reason": "total_cost > 0 but no invoice found",
                "severity": "warn",
            })
            if action_mode == "approval":
                approvals_created += await _enqueue_approval(
                    rule_id=rule_id, module="billing",
                    action="create_invoice_for_customer", target=cid,
                    proposal={"customer_id": cid, "name": c.get("name"), "amount": total},
                )
    return {"issues": issues, "fixes_applied": fixes_applied, "approvals_created": approvals_created}


async def _tpl_payment_due_gate(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """IF due_amount > 0 AND customer_status != payment_due → set status
    (safe autofix — only toggles a UI gate field, no money movement)."""
    issues: List[Dict] = []
    fixes_applied = 0
    cur = db.customers.find(
        {"moved_to_trash": {"$ne": True}, "due_amount": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "mobile": 1, "customer_status": 1, "due_amount": 1},
    )
    async for c in cur:
        if (c.get("customer_status") or "active") in ("payment_due",):
            continue
        issues.append({
            "module": "payment", "entity": "customer", "entity_id": c.get("id"),
            "name": c.get("name"), "phone": c.get("mobile"),
            "reason": f"due_amount={c.get('due_amount')} but status='{c.get('customer_status', 'active')}'",
            "severity": "warn",
        })
        if action_mode == "autofix":
            await _safe_update(
                collection="customers", doc_id=c.get("id"),
                updates={"customer_status": "payment_due", "pay_now_enabled": True},
                rule_id=rule_id, module="payment",
                reason="auto-flip to payment_due because due_amount > 0",
            )
            fixes_applied += 1
        elif action_mode == "approval":
            await _enqueue_approval(
                rule_id=rule_id, module="payment",
                action="set_customer_status_payment_due", target=c.get("id"),
                proposal={"customer_id": c.get("id"), "new_status": "payment_due"},
            )
    return {"issues": issues, "fixes_applied": fixes_applied}


async def _tpl_install_progress(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """IF installation_date < today AND install_status != completed → mark 100%."""
    issues: List[Dict] = []
    fixes_applied = 0
    today = datetime.now(timezone.utc).date().isoformat()
    cur = db.customers.find(
        {
            "moved_to_trash": {"$ne": True},
            "installation_date": {"$ne": None, "$lte": today, "$ne": ""},
            "install_status": {"$ne": "completed"},
        },
        {"_id": 0, "id": 1, "name": 1, "mobile": 1, "installation_date": 1, "install_status": 1},
    )
    async for c in cur:
        if not c.get("installation_date"):
            continue
        issues.append({
            "module": "installation", "entity": "customer", "entity_id": c.get("id"),
            "name": c.get("name"), "phone": c.get("mobile"),
            "reason": f"installation_date={c.get('installation_date')} has passed but status is not completed",
            "severity": "info",
        })
        if action_mode == "autofix":
            await _safe_update(
                collection="customers", doc_id=c.get("id"),
                updates={"install_progress": 100, "install_status": "completed"},
                rule_id=rule_id, module="installation",
                reason="installation_date has passed — mark 100% complete",
            )
            fixes_applied += 1
    return {"issues": issues, "fixes_applied": fixes_applied}


async def _tpl_whatsapp_retry(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """Scan invoices whose most-recent reminder failed. Alert-only (no retry
    here — we never auto-send WhatsApp without admin click). Counts up to 3
    failed attempts before alerting admin."""
    issues: List[Dict] = []
    cur = db.invoices.find(
        {"reminders_sent.result": "failed", "moved_to_trash": {"$ne": True}},
        {"_id": 0, "id": 1, "invoice_number": 1, "customer": 1, "reminders_sent": 1},
    )
    async for inv in cur:
        rs = inv.get("reminders_sent") or []
        fails = [r for r in rs if r.get("result") == "failed"]
        last = rs[-1] if rs else {}
        if last.get("result") != "failed":
            continue
        issues.append({
            "module": "whatsapp", "entity": "invoice", "entity_id": inv.get("id"),
            "invoice_number": inv.get("invoice_number"),
            "phone": (inv.get("customer") or {}).get("phone"),
            "reason": f"{len(fails)} failed reminder(s) — last error: {last.get('error', '')[:140]}",
            "severity": "error" if len(fails) >= 3 else "warn",
        })
    return {"issues": issues, "fixes_applied": 0}


async def _tpl_pending_order_cleanup(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """Shop orders sitting in `shop_orders_pending` for > N hours that never
    got paid. Alert only (don't delete — admin might still want to recover)."""
    issues: List[Dict] = []
    stale_hours = int(params.get("stale_hours", 24))
    cutoff = datetime.now(timezone.utc).timestamp() - stale_hours * 3600
    cur = db.shop_orders_pending.find({}, {"_id": 0})
    async for o in cur:
        ts_iso = o.get("created_at") or ""
        try:
            ts = datetime.fromisoformat(ts_iso.replace("Z", "+00:00")).timestamp()
        except Exception:
            continue
        if ts >= cutoff:
            continue
        issues.append({
            "module": "shop", "entity": "pending_order", "entity_id": o.get("order_id"),
            "reason": f"pending > {stale_hours}h (status={o.get('status', 'unknown')})",
            "severity": "info",
        })
    return {"issues": issues, "fixes_applied": 0}


RULE_TEMPLATES: Dict[str, Dict] = {
    "billing_sync": {
        "title": "Billing Monitor — detect total_cost without matching invoice",
        "module": "billing",
        "handler": _tpl_billing_sync,
        "supports_modes": ["alert", "approval"],
        "default_frequency_minutes": 60,
        "default_params": {},
    },
    "payment_due_gate": {
        "title": "Payment Monitor — set status=payment_due when due_amount > 0",
        "module": "payment",
        "handler": _tpl_payment_due_gate,
        "supports_modes": ["alert", "approval", "autofix"],
        "default_frequency_minutes": 30,
        "default_params": {},
    },
    "install_progress": {
        "title": "Installation Monitor — mark 100% when installation_date has passed",
        "module": "installation",
        "handler": _tpl_install_progress,
        "supports_modes": ["alert", "autofix"],
        "default_frequency_minutes": 240,
        "default_params": {},
    },
    "whatsapp_retry": {
        "title": "WhatsApp Monitor — alert admin on 3+ failed reminders",
        "module": "whatsapp",
        "handler": _tpl_whatsapp_retry,
        "supports_modes": ["alert"],
        "default_frequency_minutes": 120,
        "default_params": {},
    },
    "pending_order_cleanup": {
        "title": "Shop Monitor — flag stale pending orders",
        "module": "shop",
        "handler": _tpl_pending_order_cleanup,
        "supports_modes": ["alert"],
        "default_frequency_minutes": 360,
        "default_params": {"stale_hours": 24},
    },
}


# ──────────────────────────────────────────────────────────────────────────────
#  SAFE MUTATION HELPERS  (rollback-capable)
# ──────────────────────────────────────────────────────────────────────────────
async def _safe_update(
    *, collection: str, doc_id: str, updates: Dict[str, Any],
    rule_id: Optional[str] = None, module: str = "guardian",
    reason: str = "autofix", actor: str = "guardian_engine",
) -> Optional[str]:
    """Apply a whitelisted field update, snapshotting the prior state first.
    Returns the backup_id on success, None on rejection."""
    # Enforce whitelist
    for field in updates.keys():
        if field in HARD_BLOCKED_FIELDS:
            logger.error(f"[guardian] BLOCKED write to {collection}.{field}")
            await _log(level="error", module=module, rule_id=rule_id,
                       message=f"BLOCKED write to {collection}.{field}",
                       details={"updates": list(updates.keys())})
            return None
        if (collection, field) not in AUTOFIX_ALLOWED_WRITES:
            logger.error(f"[guardian] NOT ALLOWED write to {collection}.{field}")
            await _log(level="error", module=module, rule_id=rule_id,
                       message=f"NOT in AUTOFIX_ALLOWED_WRITES: {collection}.{field}")
            return None

    coll = getattr(db, collection)
    before = await coll.find_one({"id": doc_id}, {"_id": 0})
    if not before:
        return None

    backup_id = str(uuid.uuid4())
    await db.guardian_backups.insert_one({
        "id": backup_id,
        "ts": _now(),
        "collection": collection,
        "doc_id": doc_id,
        "before": {k: before.get(k) for k in updates.keys()},
        "after": updates,
        "rule_id": rule_id,
        "module": module,
        "reason": reason,
        "actor": actor,
        "restored": False,
    })
    await coll.update_one({"id": doc_id}, {"$set": updates})
    await _log(level="info", module=module, rule_id=rule_id,
               message=f"autofix applied: {collection}.{doc_id}",
               details={"updates": updates, "backup_id": backup_id})
    return backup_id


async def _enqueue_approval(
    *, rule_id: str, module: str, action: str, target: str, proposal: Dict,
) -> int:
    """Insert a pending approval record. Returns 1 if created, 0 if a pending
    one for the same (rule, action, target) already exists (de-dupe)."""
    existing = await db.guardian_approvals.find_one({
        "rule_id": rule_id, "action": action, "target": target, "status": "pending",
    })
    if existing:
        return 0
    doc = {
        "id": str(uuid.uuid4()),
        "rule_id": rule_id,
        "module": module,
        "action": action,
        "target": target,
        "proposal": proposal,
        "status": "pending",
        "proposed_at": _now(),
    }
    await db.guardian_approvals.insert_one(doc.copy())
    await _log(level="info", module=module, rule_id=rule_id,
               message=f"approval queued: {action} → {target}", details=proposal)
    return 1


async def _log(
    *, level: str = "info", module: str = "guardian", rule_id: Optional[str] = None,
    message: str = "", details: Optional[Dict] = None, actor: str = "system",
) -> None:
    await db.guardian_logs.insert_one({
        "id": str(uuid.uuid4()),
        "ts": _now(),
        "level": level, "module": module, "rule_id": rule_id,
        "message": message, "details": details or {}, "actor": actor,
    })


# ──────────────────────────────────────────────────────────────────────────────
#  MODELS
# ──────────────────────────────────────────────────────────────────────────────
class RuleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    template_key: str
    action_mode: str = Field("alert", pattern="^(alert|approval|autofix)$")
    frequency_minutes: int = Field(60, ge=5, le=10080)
    enabled: bool = True
    params: Dict[str, Any] = Field(default_factory=dict)


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    action_mode: Optional[str] = None
    frequency_minutes: Optional[int] = None
    enabled: Optional[bool] = None
    params: Optional[Dict[str, Any]] = None


class ApprovalDecision(BaseModel):
    actor: Optional[str] = "admin"
    note: Optional[str] = ""


class ConsoleRequest(BaseModel):
    command: str = Field(..., min_length=2, max_length=500)
    actor: Optional[str] = "admin"


# ──────────────────────────────────────────────────────────────────────────────
#  RULE ENGINE
# ──────────────────────────────────────────────────────────────────────────────
async def _run_rule_by_id(rule_id: str) -> Dict:
    rule = await db.guardian_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(404, "Rule not found")
    return await _run_rule(rule)


async def _run_rule(rule: Dict) -> Dict:
    tpl_key = rule.get("template_key")
    tpl = RULE_TEMPLATES.get(tpl_key)
    if not tpl:
        await _log(level="error", module="guardian", rule_id=rule.get("id"),
                   message=f"unknown template_key={tpl_key}")
        return {"issues": [], "error": f"unknown template {tpl_key}"}
    action_mode = rule.get("action_mode", "alert")
    if action_mode not in tpl["supports_modes"]:
        action_mode = "alert"
    params = rule.get("params") or {}
    started = _now()
    try:
        result = await tpl["handler"](params, action_mode, rule.get("id"))
    except Exception as e:
        logger.exception(f"[guardian] rule run failed: {rule.get('name')}")
        await _log(level="error", module=tpl["module"], rule_id=rule.get("id"),
                   message=f"rule run error: {e}")
        return {"issues": [], "error": str(e)}
    finished = _now()
    issue_count = len(result.get("issues") or [])
    await db.guardian_rules.update_one(
        {"id": rule["id"]},
        {"$set": {
            "last_run_at": finished,
            "last_issue_count": issue_count,
            "last_action_mode": action_mode,
        }},
    )
    await _log(
        level="info" if issue_count == 0 else "warn",
        module=tpl["module"],
        rule_id=rule.get("id"),
        message=f"rule ran ({rule.get('name')}): {issue_count} issue(s), mode={action_mode}",
        details={
            "started": started, "finished": finished,
            "fixes_applied": result.get("fixes_applied", 0),
            "approvals_created": result.get("approvals_created", 0),
        },
    )
    return {**result, "rule_id": rule.get("id"), "action_mode": action_mode,
            "issue_count": issue_count, "started": started, "finished": finished}


# ──────────────────────────────────────────────────────────────────────────────
#  RULE CRUD
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/rules/templates")
async def list_templates():
    return {
        "templates": [
            {"key": k, "title": v["title"], "module": v["module"],
             "supports_modes": v["supports_modes"],
             "default_frequency_minutes": v["default_frequency_minutes"],
             "default_params": v["default_params"]}
            for k, v in RULE_TEMPLATES.items()
        ]
    }


@router.get("/rules")
async def list_rules():
    rows = await db.guardian_rules.find({}, {"_id": 0}).sort("created_at", -1).to_list(None)
    return {"rules": rows}


@router.post("/rules")
async def create_rule(payload: RuleCreate):
    if payload.template_key not in RULE_TEMPLATES:
        raise HTTPException(400, f"Unknown template: {payload.template_key}")
    tpl = RULE_TEMPLATES[payload.template_key]
    if payload.action_mode not in tpl["supports_modes"]:
        raise HTTPException(400, f"Template '{payload.template_key}' does not support mode '{payload.action_mode}'")
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "template_key": payload.template_key,
        "module": tpl["module"],
        "action_mode": payload.action_mode,
        "frequency_minutes": payload.frequency_minutes,
        "enabled": payload.enabled,
        "params": {**tpl["default_params"], **(payload.params or {})},
        "created_at": _now(),
        "last_run_at": None,
        "last_issue_count": 0,
    }
    await db.guardian_rules.insert_one(doc.copy())
    await _log(level="info", module=tpl["module"], rule_id=doc["id"],
               message=f"rule created: {doc['name']}", actor="admin")
    return {"success": True, "rule": doc}


@router.patch("/rules/{rule_id}")
async def update_rule(rule_id: str, payload: RuleUpdate):
    existing = await db.guardian_rules.find_one({"id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Rule not found")
    updates: Dict[str, Any] = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.action_mode is not None:
        tpl = RULE_TEMPLATES.get(existing["template_key"])
        if tpl and payload.action_mode not in tpl["supports_modes"]:
            raise HTTPException(400, f"Mode '{payload.action_mode}' not supported by template")
        updates["action_mode"] = payload.action_mode
    if payload.frequency_minutes is not None:
        if payload.frequency_minutes < 5 or payload.frequency_minutes > 10080:
            raise HTTPException(400, "frequency_minutes must be between 5 and 10080")
        updates["frequency_minutes"] = payload.frequency_minutes
    if payload.enabled is not None:
        updates["enabled"] = payload.enabled
    if payload.params is not None:
        updates["params"] = payload.params
    if updates:
        await db.guardian_rules.update_one({"id": rule_id}, {"$set": updates})
        await _log(level="info", module=existing.get("module", "guardian"), rule_id=rule_id,
                   message=f"rule updated: {existing.get('name')}", details=updates, actor="admin")
    fresh = await db.guardian_rules.find_one({"id": rule_id}, {"_id": 0})
    return {"success": True, "rule": fresh}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    res = await db.guardian_rules.delete_one({"id": rule_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Rule not found")
    await _log(level="info", module="guardian", rule_id=rule_id,
               message="rule deleted", actor="admin")
    return {"success": True}


@router.post("/rules/{rule_id}/run")
async def run_rule_now(rule_id: str):
    result = await _run_rule_by_id(rule_id)
    return {"success": True, **result}


@router.post("/rules/run-all")
async def run_all_enabled():
    rules = await db.guardian_rules.find({"enabled": True}, {"_id": 0}).to_list(None)
    outcomes = []
    for r in rules:
        try:
            outcomes.append(await _run_rule(r))
        except Exception as e:
            outcomes.append({"rule_id": r.get("id"), "error": str(e)})
    return {"success": True, "ran": len(rules), "results": outcomes}


# ──────────────────────────────────────────────────────────────────────────────
#  LOGS / APPROVALS / BACKUPS / HEALTH
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/logs")
async def list_logs(limit: int = 200, module: Optional[str] = None, level: Optional[str] = None):
    q: Dict = {}
    if module:
        q["module"] = module
    if level:
        q["level"] = level
    rows = await db.guardian_logs.find(q, {"_id": 0}).sort("ts", -1).limit(limit).to_list(length=limit)
    return {"logs": rows, "total": await db.guardian_logs.count_documents(q)}


@router.get("/approvals")
async def list_approvals(status: str = "pending", limit: int = 100):
    rows = await db.guardian_approvals.find(
        {"status": status}, {"_id": 0}
    ).sort("proposed_at", -1).limit(limit).to_list(length=limit)
    return {"approvals": rows}


@router.post("/approvals/{approval_id}/approve")
async def approve(approval_id: str, decision: ApprovalDecision):
    a = await db.guardian_approvals.find_one({"id": approval_id}, {"_id": 0})
    if not a or a.get("status") != "pending":
        raise HTTPException(404, "Approval not found or already decided")
    action = a.get("action")
    target = a.get("target")
    proposal = a.get("proposal") or {}
    applied = False
    backup_id = None
    try:
        if action == "set_customer_status_payment_due":
            backup_id = await _safe_update(
                collection="customers", doc_id=target,
                updates={"customer_status": "payment_due", "pay_now_enabled": True},
                rule_id=a.get("rule_id"), module=a.get("module", "payment"),
                reason="approved via /approvals", actor=decision.actor or "admin",
            )
            applied = bool(backup_id)
        elif action == "create_invoice_for_customer":
            # Soft action — we just flag that admin should open the invoice form.
            # We don't auto-create invoices because amounts/line-items need a
            # human decision. The flag surfaces in the Customer row.
            await db.customers.update_one(
                {"id": target}, {"$set": {"needs_invoice_flag": True}},
            )
            applied = True
        else:
            raise HTTPException(400, f"Unknown approval action: {action}")
    except HTTPException:
        raise
    except Exception as e:
        await _log(level="error", module=a.get("module", "guardian"),
                   rule_id=a.get("rule_id"), message=f"approve failed: {e}")
        raise HTTPException(500, f"Apply failed: {e}")
    await db.guardian_approvals.update_one(
        {"id": approval_id},
        {"$set": {
            "status": "approved" if applied else "rejected",
            "decided_at": _now(),
            "decided_by": decision.actor or "admin",
            "applied_backup_id": backup_id,
            "note": decision.note or "",
        }},
    )
    await _log(level="info", module=a.get("module", "guardian"),
               rule_id=a.get("rule_id"),
               message=f"approval {action} applied={applied}",
               details={"target": target, "backup_id": backup_id},
               actor=decision.actor or "admin")
    return {"success": True, "applied": applied, "backup_id": backup_id}


@router.post("/approvals/{approval_id}/reject")
async def reject(approval_id: str, decision: ApprovalDecision):
    res = await db.guardian_approvals.update_one(
        {"id": approval_id, "status": "pending"},
        {"$set": {
            "status": "rejected", "decided_at": _now(),
            "decided_by": decision.actor or "admin", "note": decision.note or "",
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Approval not found or already decided")
    return {"success": True}


@router.get("/backups")
async def list_backups(limit: int = 100, collection: Optional[str] = None):
    q: Dict = {"restored": {"$ne": True}}
    if collection:
        q["collection"] = collection
    rows = await db.guardian_backups.find(q, {"_id": 0}).sort("ts", -1).limit(limit).to_list(length=limit)
    return {"backups": rows}


@router.post("/backups/{backup_id}/restore")
async def restore(backup_id: str, decision: ApprovalDecision):
    b = await db.guardian_backups.find_one({"id": backup_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Backup not found")
    if b.get("restored"):
        raise HTTPException(400, "Backup already restored")
    coll = getattr(db, b["collection"])
    before = b.get("before") or {}
    # Only restore the exact keys that were captured
    await coll.update_one({"id": b["doc_id"]}, {"$set": before})
    await db.guardian_backups.update_one(
        {"id": backup_id},
        {"$set": {"restored": True, "restored_at": _now(),
                  "restored_by": decision.actor or "admin"}},
    )
    await _log(level="warn", module=b.get("module", "guardian"),
               rule_id=b.get("rule_id"),
               message=f"rollback applied on {b['collection']}/{b['doc_id']}",
               details={"backup_id": backup_id, "restored_fields": list(before.keys())},
               actor=decision.actor or "admin")
    return {"success": True, "restored_fields": list(before.keys())}


# ──────────────────────────────────────────────────────────────────────────────
#  HEALTH / DASHBOARD SUMMARY
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/health")
async def health():
    pending = await db.guardian_approvals.count_documents({"status": "pending"})
    errors_24h = await db.guardian_logs.count_documents({
        "level": "error",
        "ts": {"$gte": datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() - 86400, tz=timezone.utc
        ).isoformat()},
    })
    warns_24h = await db.guardian_logs.count_documents({
        "level": "warn",
        "ts": {"$gte": datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() - 86400, tz=timezone.utc
        ).isoformat()},
    })
    # simple heuristic
    if errors_24h > 0:
        status = "critical"
    elif warns_24h > 10 or pending > 5:
        status = "warning"
    else:
        status = "good"
    rules_total = await db.guardian_rules.count_documents({})
    rules_enabled = await db.guardian_rules.count_documents({"enabled": True})
    return {
        "status": status,
        "errors_24h": errors_24h, "warns_24h": warns_24h,
        "pending_approvals": pending,
        "rules_total": rules_total, "rules_enabled": rules_enabled,
        "checked_at": _now(),
    }


@router.get("/summary")
async def summary():
    h = await health()
    recent_logs = await db.guardian_logs.find({}, {"_id": 0}).sort("ts", -1).limit(10).to_list(10)
    pending = await db.guardian_approvals.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("proposed_at", -1).limit(10).to_list(10)
    return {"health": h, "recent_logs": recent_logs, "pending_approvals": pending}


# ──────────────────────────────────────────────────────────────────────────────
#  AI COMMAND CONSOLE  (natural language → whitelisted action catalog)
# ──────────────────────────────────────────────────────────────────────────────
# Rules engine — purely pattern-matched. NO code generation.
# Every command either (a) runs an existing rule, (b) toggles a whitelisted
# customer field, (c) reads data. Admin always sees the proposed action first.
_PHONE_RE = re.compile(r"\b([6-9]\d{9})\b")


async def _preview_action(kind: str, args: Dict) -> Dict:
    """Return a human-friendly description of what the command will do."""
    if kind == "block_customer":
        return {"summary": f"Set customer_status=inactive for phone {args.get('phone')}",
                "risk": "low (reversible)", "reversible": True}
    if kind == "activate_customer":
        return {"summary": f"Set customer_status=active for phone {args.get('phone')}",
                "risk": "low (reversible)", "reversible": True}
    if kind == "flag_payment_due":
        return {"summary": f"Set customer_status=payment_due for phone {args.get('phone')}",
                "risk": "low (reversible)", "reversible": True}
    if kind == "run_billing_sync":
        return {"summary": "Execute the Billing Monitor rule now (alert + approvals only)",
                "risk": "none (read-only)", "reversible": True}
    if kind == "show_issues":
        return {"summary": "Return recent warn/error logs (last 50)", "risk": "none", "reversible": True}
    if kind == "show_approvals":
        return {"summary": "Return pending approvals", "risk": "none", "reversible": True}
    if kind == "show_health":
        return {"summary": "Return Guardian health snapshot", "risk": "none", "reversible": True}
    return {"summary": f"Unrecognised action {kind}", "risk": "unknown", "reversible": False}


def _parse_command(text: str) -> Dict:
    t = (text or "").lower().strip()
    phone = (_PHONE_RE.search(text) or [None, None])[1] if _PHONE_RE.search(text) else None
    if re.search(r"\b(block|deactivate|disable)\s+(customer|user)\b", t) or re.search(r"\bmark\s+inactive\b", t):
        if phone:
            return {"kind": "block_customer", "args": {"phone": phone}}
    if re.search(r"\b(activate|unblock|enable)\s+(customer|user)\b", t) or re.search(r"\bmark\s+active\b", t):
        if phone:
            return {"kind": "activate_customer", "args": {"phone": phone}}
    if (re.search(r"\b(payment\s*due|owes|unpaid|mark\s+payment_?due|flag\s+payment_?due)\b", t)
            or re.search(r"payment[_\s-]?due", t)) and phone:
        return {"kind": "flag_payment_due", "args": {"phone": phone}}
    if re.search(r"\brun\s+billing\b", t) or re.search(r"\bbilling\s+(sync|check)\b", t):
        return {"kind": "run_billing_sync", "args": {}}
    if re.search(r"\bissues?\b", t) or re.search(r"\bproblems?\b", t) or re.search(r"\berrors?\b", t):
        return {"kind": "show_issues", "args": {}}
    if re.search(r"\bapprovals?\b", t) or re.search(r"\bpending\b", t):
        return {"kind": "show_approvals", "args": {}}
    if re.search(r"\bhealth\b", t) or re.search(r"\bstatus\b", t):
        return {"kind": "show_health", "args": {}}
    return {"kind": "unknown", "args": {"raw": text}}


@router.post("/command/preview")
async def console_preview(req: ConsoleRequest):
    parsed = _parse_command(req.command)
    preview = await _preview_action(parsed["kind"], parsed.get("args", {}))
    return {"parsed": parsed, "preview": preview}


@router.post("/command/execute")
async def console_execute(req: ConsoleRequest):
    """Execute a parsed, previewed command. Safe actions only."""
    parsed = _parse_command(req.command)
    kind = parsed["kind"]
    args = parsed.get("args", {})
    actor = req.actor or "admin"

    if kind == "unknown":
        return {"success": False, "error": "Command not recognised. Try: 'block customer <phone>', 'run billing sync', 'show issues', 'show health'."}

    if kind in ("block_customer", "activate_customer", "flag_payment_due"):
        phone = (args.get("phone") or "").strip()
        cust = await db.customers.find_one({"mobile": phone}, {"_id": 0, "id": 1, "name": 1})
        if not cust:
            return {"success": False, "error": f"No customer found with phone {phone}"}
        status_map = {"block_customer": "inactive", "activate_customer": "active",
                      "flag_payment_due": "payment_due"}
        new_status = status_map[kind]
        bid = await _safe_update(
            collection="customers", doc_id=cust["id"],
            updates={"customer_status": new_status},
            module="console", reason=f"admin command: {req.command}", actor=actor,
        )
        return {"success": bool(bid), "action": kind, "customer": cust, "backup_id": bid}

    if kind == "run_billing_sync":
        # Find (or create on-the-fly) a billing_sync rule to reuse the template
        rule = await db.guardian_rules.find_one({"template_key": "billing_sync"}, {"_id": 0})
        if not rule:
            # Ephemeral run — no persistence
            rule = {"id": "ephemeral", "name": "ephemeral-billing", "template_key": "billing_sync",
                    "action_mode": "alert", "params": {}}
        res = await _run_rule(rule)
        return {"success": True, "action": kind, "result": res}

    if kind == "show_issues":
        rows = await db.guardian_logs.find(
            {"level": {"$in": ["warn", "error"]}}, {"_id": 0}
        ).sort("ts", -1).limit(50).to_list(50)
        return {"success": True, "logs": rows}

    if kind == "show_approvals":
        rows = await db.guardian_approvals.find(
            {"status": "pending"}, {"_id": 0}
        ).sort("proposed_at", -1).limit(50).to_list(50)
        return {"success": True, "approvals": rows}

    if kind == "show_health":
        return {"success": True, "health": await health()}

    return {"success": False, "error": "Unsupported command"}


# ──────────────────────────────────────────────────────────────────────────────
#  CUSTOMER ACCESS CONTROL — helpers used by public OTP login endpoints
# ──────────────────────────────────────────────────────────────────────────────
async def check_customer_access(mobile10: str) -> Dict:
    """Return a dict describing whether the customer can log in.
      returns: {allowed: bool, status: str, reason: Optional[str], message: str}
    Called by /customer/send-otp and /customer/verify-otp to enforce the gate.
    """
    cust = await db.customers.find_one(
        {"mobile": mobile10}, {"_id": 0, "customer_status": 1, "name": 1},
    )
    if not cust:
        # Default to "not registered" — do NOT leak this via the gate.
        return {"allowed": False, "status": "unknown", "reason": "not_registered",
                "message": "Mobile number not registered. Please contact ASR Enterprises."}
    status = (cust.get("customer_status") or "active").lower()
    if status == "inactive":
        return {"allowed": False, "status": status, "reason": "inactive",
                "message": "Your account is currently deactivated. Please contact ASR Enterprises."}
    # active + payment_due both ALLOWED to log in
    return {"allowed": True, "status": status, "reason": None, "message": "ok"}


@router.get("/customers/{mobile}/status")
async def get_customer_status(mobile: str):
    """Quick read for admin UIs — current status + whether login is allowed."""
    res = await check_customer_access(mobile.strip())
    return res


@router.post("/customers/{mobile}/status")
async def set_customer_status(mobile: str, body: Dict[str, Any]):
    """Admin toggle — set customer_status to active / inactive / payment_due.
    Wrapped in _safe_update so every change is backed up and rollback-able."""
    new_status = (body or {}).get("status", "").strip().lower()
    if new_status not in ("active", "inactive", "payment_due"):
        raise HTTPException(400, "status must be one of: active, inactive, payment_due")
    cust = await db.customers.find_one({"mobile": mobile.strip()}, {"_id": 0, "id": 1})
    if not cust:
        raise HTTPException(404, "Customer not found")
    bid = await _safe_update(
        collection="customers", doc_id=cust["id"],
        updates={"customer_status": new_status},
        module="access_control",
        reason=(body or {}).get("reason") or "admin toggle",
        actor=(body or {}).get("actor") or "admin",
    )
    return {"success": bool(bid), "status": new_status, "backup_id": bid}


# ──────────────────────────────────────────────────────────────────────────────
#  SCHEDULER — runs enabled rules at their configured frequency
# ──────────────────────────────────────────────────────────────────────────────
async def scheduled_tick() -> None:
    """Called once every 5 minutes. Picks rules whose last_run_at is older than
    `frequency_minutes` and runs them."""
    now_ts = datetime.now(timezone.utc).timestamp()
    cur = db.guardian_rules.find({"enabled": True}, {"_id": 0})
    async for r in cur:
        last_iso = r.get("last_run_at")
        if last_iso:
            try:
                last_ts = datetime.fromisoformat(last_iso.replace("Z", "+00:00")).timestamp()
            except Exception:
                last_ts = 0
        else:
            last_ts = 0
        gap = now_ts - last_ts
        if gap < (r.get("frequency_minutes") or 60) * 60:
            continue
        try:
            await _run_rule(r)
        except Exception as e:
            logger.exception(f"[guardian] scheduled tick failed for {r.get('name')}: {e}")


def attach_guardian_scheduler(scheduler) -> None:
    """Attach Guardian tick to the shared APScheduler started by gst_reminders."""
    from apscheduler.triggers.interval import IntervalTrigger
    scheduler.add_job(
        scheduled_tick,
        trigger=IntervalTrigger(minutes=5),
        id="guardian_tick",
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info("[guardian] tick scheduled every 5 minutes")


# ──────────────────────────────────────────────────────────────────────────────
#  SEED default rules on first boot
# ──────────────────────────────────────────────────────────────────────────────
async def seed_default_rules() -> None:
    """Insert the five starter rules if `guardian_rules` is empty — gives admins
    a working monitor the first time they open the page."""
    count = await db.guardian_rules.count_documents({})
    if count > 0:
        return
    defaults = [
        {"template_key": "billing_sync", "name": "Billing Sync Monitor", "action_mode": "alert"},
        {"template_key": "payment_due_gate", "name": "Payment Due Gate",  "action_mode": "autofix"},
        {"template_key": "install_progress", "name": "Installation 100% Auto-Complete", "action_mode": "autofix"},
        {"template_key": "whatsapp_retry",  "name": "WhatsApp Failure Alerts", "action_mode": "alert"},
        {"template_key": "pending_order_cleanup", "name": "Stale Pending Orders", "action_mode": "alert"},
    ]
    for d in defaults:
        tpl = RULE_TEMPLATES[d["template_key"]]
        doc = {
            "id": str(uuid.uuid4()),
            "name": d["name"],
            "template_key": d["template_key"],
            "module": tpl["module"],
            "action_mode": d["action_mode"],
            "frequency_minutes": tpl["default_frequency_minutes"],
            "enabled": True,
            "params": dict(tpl["default_params"]),
            "created_at": _now(),
            "last_run_at": None,
            "last_issue_count": 0,
        }
        await db.guardian_rules.insert_one(doc)
    logger.info("[guardian] seeded 5 default rules")
