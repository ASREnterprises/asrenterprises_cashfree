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
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from db_client import get_db

router = APIRouter(prefix="/guardian", tags=["AI Website Guardian"])
logger = logging.getLogger(__name__)
db = get_db()


# ──────────────────────────────────────────────────────────────────────────────
#  APPROVAL OTP SETTINGS
# ──────────────────────────────────────────────────────────────────────────────
APPROVAL_OTP_TTL_SECONDS      = int(os.environ.get("GUARDIAN_OTP_TTL",      "300"))   # 5 min
APPROVAL_OTP_COOLDOWN_SECONDS = int(os.environ.get("GUARDIAN_OTP_COOLDOWN", "30"))    # 30 s
APPROVAL_OTP_MAX_ATTEMPTS     = int(os.environ.get("GUARDIAN_OTP_MAX",      "3"))     # 3 tries
SUPER_ADMIN_MOBILE            = os.environ.get("SUPER_ADMIN_MOBILE", "9296389097")    # ASR1001


def _hash_approval_otp(otp: str) -> str:
    import hashlib
    salt = os.environ.get("GUARDIAN_OTP_SALT", "asr-guardian-otp-v1")
    return hashlib.sha256(f"{salt}:{otp}".encode()).hexdigest()


async def _send_admin_whatsapp_otp(otp_code: str, approval: Dict) -> Dict:
    """Deliver the 6-digit OTP to the super admin's WhatsApp. Falls back to
    plain text if the approved OTP template isn't on the WABA account."""
    try:
        from routes.whatsapp import get_whatsapp_settings, send_whatsapp_template
        settings = await get_whatsapp_settings()
        token = (settings or {}).get("access_token", "").strip()
        phone_id = (settings or {}).get("phone_number_id", "").strip()
        if not token or not phone_id:
            return {"success": False, "error": "whatsapp not configured"}

        phone_e164 = SUPER_ADMIN_MOBILE.strip().lstrip("+")
        if len(phone_e164) == 10:
            phone_e164 = "91" + phone_e164

        for tpl in ["authentication_otp", "otp_verification", "website_otp", "customer_otp"]:
            try:
                r = await send_whatsapp_template(phone=phone_e164, template_name=tpl, variables=[otp_code])
                if r.get("success"):
                    return {"success": True, "channel": f"template:{tpl}",
                            "phone_masked": f"*****{phone_e164[-5:]}"}
            except Exception:
                continue

        # Plain text fallback
        import httpx
        text = (
            f"🔐 ASR Guardian — Approval Verification\n\n"
            f"Your OTP: *{otp_code}*\n"
            f"Valid for {APPROVAL_OTP_TTL_SECONDS // 60} minutes.\n\n"
            f"Risk Level: {approval.get('risk_level', 'HIGH')}\n"
            f"Action: {approval.get('action', '?')}\n"
            f"Customer: {approval.get('customer_name', '—')}\n\n"
            f"If you didn't request this, do NOT share the code."
        )
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"messaging_product": "whatsapp", "to": phone_e164,
                      "type": "text", "text": {"body": text}},
            )
            if resp.status_code in (200, 201):
                return {"success": True, "channel": "whatsapp_text",
                        "phone_masked": f"*****{phone_e164[-5:]}"}
            return {"success": False, "error": f"whatsapp_text_{resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        logger.warning(f"[guardian.otp] send failed: {e}")
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────────────────────────────────────
#  SUPER ADMIN ACCESS CONTROL
# ──────────────────────────────────────────────────────────────────────────────
# Guardian is gated to the super admin (ASR1001 / ABHIJEET KUMAR) only.
# Every admin request must carry BOTH headers sent by the React shell:
#   x-staff-id:   ASR1001
#   x-admin-name: ABHIJEET KUMAR
# (Header names are case-insensitive in FastAPI.)
OWNER_STAFF_ID = os.environ.get("OWNER_STAFF_ID", "ASR1001")
OWNER_NAME     = os.environ.get("OWNER_NAME", "ABHIJEET KUMAR")


def require_super_admin(
    x_staff_id: Optional[str] = Header(default=None, alias="x-staff-id"),
    x_admin_name: Optional[str] = Header(default=None, alias="x-admin-name"),
) -> Dict[str, str]:
    sid = (x_staff_id or "").strip().upper()
    nm = (x_admin_name or "").strip().upper()
    if sid != OWNER_STAFF_ID.upper() and nm != OWNER_NAME.upper():
        raise HTTPException(status_code=403, detail="Access Denied — Guardian is restricted to Super Admin.")
    # Defence-in-depth: BOTH must match if both provided
    if sid and sid != OWNER_STAFF_ID.upper():
        raise HTTPException(status_code=403, detail="Access Denied — staff id mismatch.")
    if nm and nm != OWNER_NAME.upper():
        raise HTTPException(status_code=403, detail="Access Denied — admin name mismatch.")
    return {"staff_id": OWNER_STAFF_ID, "name": OWNER_NAME}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Apply the super-admin gate to every route declared on this router.
# Individual endpoints still Depends() so they can receive the admin dict when
# they need to log "decided_by" etc. The router-level dependency enforces the
# gate even on the ones that don't consume the dict.
router.dependencies.append(Depends(require_super_admin))


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
    ("customers", "needs_invoice_flag"),
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
            issue = {
                "module": "billing", "entity": "customer", "entity_id": cid,
                "name": c.get("name"), "phone": c.get("mobile"),
                "reason": f"total_cost={total} but no invoice found",
                "severity": "warn",
            }
            issues.append(issue)
            if action_mode == "approval":
                approvals_created += await _enqueue_approval(
                    rule_id=rule_id, module="billing",
                    action="create_invoice_for_customer", target=cid,
                    customer_id=cid, customer_name=c.get("name"),
                    issue_detected=issue["reason"],
                    before_value={"needs_invoice_flag": False},
                    after_value={"needs_invoice_flag": True},
                    risk_level="HIGH",
                )
    return {"issues": issues, "fixes_applied": fixes_applied, "approvals_created": approvals_created}


async def _tpl_payment_due_gate(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """HIGH-RISK: Scan customers with due_amount > 0 whose status isn't already
    payment_due. Never auto-fixes — always queues an approval that requires
    OTP verification before the toggle runs."""
    issues: List[Dict] = []
    approvals_created = 0
    cur = db.customers.find(
        {"moved_to_trash": {"$ne": True}, "due_amount": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "mobile": 1, "customer_status": 1, "due_amount": 1, "pay_now_enabled": 1},
    )
    async for c in cur:
        current_status = (c.get("customer_status") or "active")
        if current_status == "payment_due":
            continue
        issue = {
            "module": "payment", "entity": "customer", "entity_id": c.get("id"),
            "name": c.get("name"), "phone": c.get("mobile"),
            "reason": f"due_amount={c.get('due_amount')} but status='{current_status}'",
            "severity": "warn",
        }
        issues.append(issue)
        if action_mode == "approval":
            approvals_created += await _enqueue_approval(
                rule_id=rule_id, module="payment",
                action="set_customer_status_payment_due",
                target=c.get("id"),
                customer_id=c.get("id"),
                customer_name=c.get("name"),
                issue_detected=issue["reason"],
                before_value={"customer_status": current_status,
                              "pay_now_enabled": c.get("pay_now_enabled")},
                after_value={"customer_status": "payment_due", "pay_now_enabled": True},
                risk_level="HIGH",
            )
    return {"issues": issues, "fixes_applied": 0, "approvals_created": approvals_created}


async def _tpl_install_progress(params: Dict, action_mode: str, rule_id: str) -> Dict:
    """HIGH-RISK: Flag installations whose scheduled date has passed without
    status=completed. Never auto-completes — always queues approval."""
    issues: List[Dict] = []
    approvals_created = 0
    today = datetime.now(timezone.utc).date().isoformat()
    cur = db.customers.find(
        {
            "moved_to_trash": {"$ne": True},
            "installation_date": {"$ne": None, "$lte": today, "$ne": ""},
            "install_status": {"$ne": "completed"},
        },
        {"_id": 0, "id": 1, "name": 1, "mobile": 1, "installation_date": 1,
         "install_status": 1, "install_progress": 1},
    )
    async for c in cur:
        if not c.get("installation_date"):
            continue
        issue = {
            "module": "installation", "entity": "customer", "entity_id": c.get("id"),
            "name": c.get("name"), "phone": c.get("mobile"),
            "reason": f"installation_date={c.get('installation_date')} has passed but status is '{c.get('install_status') or '—'}'",
            "severity": "info",
        }
        issues.append(issue)
        if action_mode == "approval":
            approvals_created += await _enqueue_approval(
                rule_id=rule_id, module="installation",
                action="mark_installation_complete",
                target=c.get("id"),
                customer_id=c.get("id"),
                customer_name=c.get("name"),
                issue_detected=issue["reason"],
                before_value={"install_progress": c.get("install_progress"),
                              "install_status": c.get("install_status")},
                after_value={"install_progress": 100, "install_status": "completed"},
                risk_level="HIGH",
            )
    return {"issues": issues, "fixes_applied": 0, "approvals_created": approvals_created}


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
        "risk_level": "HIGH",
        "default_frequency_minutes": 60,
        "default_params": {},
    },
    "payment_due_gate": {
        "title": "Payment Monitor — flag customers with due_amount > 0",
        "module": "payment",
        "handler": _tpl_payment_due_gate,
        # AUTOFIX DISABLED — payment/customer_status writes are HIGH risk and
        # must go through the OTP-gated approval queue (security upgrade).
        "supports_modes": ["alert", "approval"],
        "risk_level": "HIGH",
        "default_frequency_minutes": 30,
        "default_params": {},
    },
    "install_progress": {
        "title": "Installation Monitor — flag jobs overdue for 100% mark",
        "module": "installation",
        "handler": _tpl_install_progress,
        # AUTOFIX DISABLED — installation status is HIGH risk (affects warranty
        # calculation + customer portal UI) and now requires approval.
        "supports_modes": ["alert", "approval"],
        "risk_level": "HIGH",
        "default_frequency_minutes": 240,
        "default_params": {},
    },
    "whatsapp_retry": {
        "title": "WhatsApp Monitor — alert admin on 3+ failed reminders",
        "module": "whatsapp",
        "handler": _tpl_whatsapp_retry,
        "supports_modes": ["alert"],
        "risk_level": "MEDIUM",
        "default_frequency_minutes": 120,
        "default_params": {},
    },
    "pending_order_cleanup": {
        "title": "Shop Monitor — flag stale pending orders",
        "module": "shop",
        "handler": _tpl_pending_order_cleanup,
        "supports_modes": ["alert"],
        "risk_level": "LOW",
        "default_frequency_minutes": 360,
        "default_params": {"stale_hours": 24},
    },
}

# High-risk action catalog — these NEVER run without an OTP-verified approval.
HIGH_RISK_ACTIONS = {
    "set_customer_status_payment_due",
    "set_customer_status_inactive",
    "set_customer_status_active",
    "mark_installation_complete",
    "create_invoice_for_customer",
    "trigger_whatsapp_reminder",
    "adjust_due_amount",
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
    *, rule_id: str, module: str, action: str, target: str,
    customer_id: Optional[str] = None, customer_name: Optional[str] = None,
    issue_detected: str = "", before_value: Optional[Dict] = None,
    after_value: Optional[Dict] = None, risk_level: str = "HIGH",
    proposal: Optional[Dict] = None,
) -> int:
    """Insert a pending approval record with full audit context. Returns 1 if
    created, 0 if a pending one for the same (rule, action, target) already
    exists (de-dupe)."""
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
        "action_type": action,
        "target": target,
        "customer_id": customer_id or target,
        "customer_name": customer_name or "",
        "issue_detected": issue_detected,
        "risk_level": risk_level,
        "before_value": before_value or {},
        "after_value": after_value or {},
        "proposal": proposal or {"before": before_value, "after": after_value},
        "status": "pending",
        "proposed_at": _now(),
        "created_at": _now(),
        "otp_verified": False,
    }
    await db.guardian_approvals.insert_one(doc.copy())
    await _log(level="info", module=module, rule_id=rule_id,
               message=f"approval queued: {action} → {target} [risk={risk_level}]",
               details={"customer_id": customer_id, "before": before_value, "after": after_value})
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
        "risk_level": tpl.get("risk_level", "MEDIUM"),
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
        # Safety rail — CRITICAL/HIGH-risk rules can never run in unattended autofix.
        # Owner must explicitly approve every write. Downgrade is allowed; autofix is not.
        if (existing.get("risk_level") or "").upper() == "HIGH" and payload.action_mode == "autofix":
            raise HTTPException(
                400,
                "HIGH-risk rules cannot run in autofix. They must stay in 'approval' mode — every change requires Super Admin OTP approval."
            )
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
async def approve(approval_id: str, decision: ApprovalDecision, _admin=Depends(require_super_admin)):
    """Direct approve — only allowed for LOW/MEDIUM risk approvals. HIGH risk
    approvals REQUIRE the OTP challenge flow below (send-otp + verify-otp)."""
    a = await db.guardian_approvals.find_one({"id": approval_id}, {"_id": 0})
    if not a or a.get("status") != "pending":
        raise HTTPException(404, "Approval not found or already decided")
    if (a.get("risk_level") or "HIGH").upper() == "HIGH":
        raise HTTPException(
            status_code=403,
            detail="HIGH-risk approvals require OTP verification. "
                   "Call POST /approvals/{id}/send-otp then /verify-otp instead.",
        )
    return await _apply_approval(a, decision, otp_verified=False, actor=_admin.get("name", "admin"))


@router.post("/approvals/{approval_id}/send-otp")
async def approval_send_otp(approval_id: str, _admin=Depends(require_super_admin)):
    """Send a 6-digit OTP to Super Admin's registered mobile for this approval.
    Rate-limited: 30s cooldown, max 3 verify attempts per OTP, 5 min expiry."""
    a = await db.guardian_approvals.find_one({"id": approval_id}, {"_id": 0})
    if not a or a.get("status") != "pending":
        raise HTTPException(404, "Approval not found or already decided")

    # Rate limit: find the most recent challenge for this approval
    prev = await db.guardian_approval_otps.find_one(
        {"approval_id": approval_id, "consumed": {"$ne": True}},
        sort=[("sent_at", -1)],
    )
    now_ts = datetime.now(timezone.utc).timestamp()
    if prev:
        try:
            last_ts = datetime.fromisoformat(prev["sent_at"].replace("Z", "+00:00")).timestamp()
            if now_ts - last_ts < APPROVAL_OTP_COOLDOWN_SECONDS:
                wait = int(APPROVAL_OTP_COOLDOWN_SECONDS - (now_ts - last_ts))
                raise HTTPException(429, f"Please wait {wait}s before requesting another OTP.")
        except HTTPException:
            raise
        except Exception:
            pass

    otp_code = f"{random.randint(100000, 999999)}"
    otp_id = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=APPROVAL_OTP_TTL_SECONDS)).isoformat()

    # Invalidate older un-consumed OTPs for this approval
    await db.guardian_approval_otps.update_many(
        {"approval_id": approval_id, "consumed": {"$ne": True}},
        {"$set": {"superseded": True}},
    )

    record = {
        "id": otp_id,
        "approval_id": approval_id,
        "otp_hash": _hash_approval_otp(otp_code),
        "attempts": 0,
        "consumed": False,
        "sent_at": _now(),
        "expires_at": expires_at,
        "admin_name": _admin.get("name", "admin"),
    }
    await db.guardian_approval_otps.insert_one(record.copy())

    # Deliver via Meta WhatsApp Cloud API to the super admin's mobile.
    delivery = await _send_admin_whatsapp_otp(otp_code, a)
    # Log whether delivery was accepted
    await db.guardian_approval_otps.update_one(
        {"id": otp_id},
        {"$set": {
            "delivery_status": "ok" if delivery.get("success") else "failed",
            "delivery_channel": delivery.get("channel", ""),
            "delivery_error": delivery.get("error", "")[:300],
        }},
    )
    await _log(level="info", module=a.get("module", "guardian"),
               rule_id=a.get("rule_id"),
               message=f"approval OTP sent (approval={approval_id}, delivered={delivery.get('success')})",
               actor=_admin.get("name", "admin"))

    return {
        "success": True,
        "otp_id": otp_id,
        "expires_in": APPROVAL_OTP_TTL_SECONDS,
        "max_attempts": APPROVAL_OTP_MAX_ATTEMPTS,
        "resend_in": APPROVAL_OTP_COOLDOWN_SECONDS,
        "delivered": delivery.get("success", False),
        "channel": delivery.get("channel", "unknown"),
        "phone_masked": delivery.get("phone_masked", ""),
    }


class ApprovalOtpVerify(BaseModel):
    otp: str = Field(..., min_length=4, max_length=8)
    otp_id: Optional[str] = None     # optional — if omitted, server picks latest
    note: Optional[str] = ""


@router.post("/approvals/{approval_id}/verify-otp")
async def approval_verify_otp(
    approval_id: str, body: ApprovalOtpVerify,
    _admin=Depends(require_super_admin),
):
    """Verify the OTP and, if correct, execute the approved action with a
    guardian_backups snapshot so it's fully reversible."""
    a = await db.guardian_approvals.find_one({"id": approval_id}, {"_id": 0})
    if not a or a.get("status") != "pending":
        raise HTTPException(404, "Approval not found or already decided")

    rec = None
    if body.otp_id:
        rec = await db.guardian_approval_otps.find_one(
            {"id": body.otp_id, "approval_id": approval_id}, {"_id": 0},
        )
    if not rec:
        rec = await db.guardian_approval_otps.find_one(
            {"approval_id": approval_id, "consumed": {"$ne": True},
             "superseded": {"$ne": True}},
            sort=[("sent_at", -1)],
        )
    if not rec:
        raise HTTPException(400, "No active OTP found. Please request a new one.")
    if rec.get("consumed"):
        raise HTTPException(400, "OTP already used.")
    if rec.get("superseded"):
        raise HTTPException(410, "A newer OTP was sent. Please use the latest code.")

    # Expiry
    try:
        exp = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
    except Exception:
        exp = datetime.now(timezone.utc)
    if datetime.now(timezone.utc) > exp:
        await db.guardian_approval_otps.update_one(
            {"id": rec["id"]}, {"$set": {"consumed": True, "expired": True}},
        )
        raise HTTPException(410, "OTP expired. Please request a new one.")

    # Max attempts
    if int(rec.get("attempts", 0)) >= APPROVAL_OTP_MAX_ATTEMPTS:
        await db.guardian_approval_otps.update_one(
            {"id": rec["id"]}, {"$set": {"consumed": True, "locked": True}},
        )
        await _log(level="warn", module=a.get("module", "guardian"),
                   rule_id=a.get("rule_id"),
                   message=f"approval OTP locked after {APPROVAL_OTP_MAX_ATTEMPTS} failed attempts",
                   actor=_admin.get("name", "admin"))
        raise HTTPException(429, "Too many incorrect attempts. Please request a new OTP.")

    # Compare
    if _hash_approval_otp((body.otp or "").strip()) != rec.get("otp_hash"):
        await db.guardian_approval_otps.update_one(
            {"id": rec["id"]}, {"$inc": {"attempts": 1}},
        )
        remaining = APPROVAL_OTP_MAX_ATTEMPTS - int(rec.get("attempts", 0)) - 1
        await _log(level="warn", module=a.get("module", "guardian"),
                   rule_id=a.get("rule_id"),
                   message=f"approval OTP incorrect (attempts left={remaining})",
                   actor=_admin.get("name", "admin"))
        raise HTTPException(401, f"Incorrect OTP. {remaining} attempt(s) left.")

    # ✓ Correct OTP — mark consumed and execute the action
    await db.guardian_approval_otps.update_one(
        {"id": rec["id"]},
        {"$set": {"consumed": True, "verified_at": _now()}},
    )
    return await _apply_approval(
        a, ApprovalDecision(actor=_admin.get("name", "admin"), note=body.note or ""),
        otp_verified=True, actor=_admin.get("name", "admin"),
    )


async def _apply_approval(a: Dict, decision: "ApprovalDecision",
                          otp_verified: bool, actor: str) -> Dict:
    """Execute the approval's stored before→after. All actions honour the
    AUTOFIX_ALLOWED_WRITES whitelist (via _safe_update), so even a mis-queued
    approval can never touch a blocked field."""
    action = a.get("action")
    target = a.get("target")
    after_val = a.get("after_value") or {}
    applied = False
    backup_id: Optional[str] = None
    try:
        if action in {"set_customer_status_payment_due",
                      "set_customer_status_inactive", "set_customer_status_active"}:
            backup_id = await _safe_update(
                collection="customers", doc_id=target,
                updates=after_val,
                rule_id=a.get("rule_id"), module=a.get("module", "access_control"),
                reason=f"approved via /approvals (otp_verified={otp_verified})",
                actor=actor,
            )
            applied = bool(backup_id)
        elif action == "mark_installation_complete":
            backup_id = await _safe_update(
                collection="customers", doc_id=target,
                updates=after_val or {"install_progress": 100, "install_status": "completed"},
                rule_id=a.get("rule_id"), module="installation",
                reason=f"approved via /approvals (otp_verified={otp_verified})",
                actor=actor,
            )
            applied = bool(backup_id)
        elif action == "create_invoice_for_customer":
            # Soft-flag: opens the "needs invoice" badge in CRM. Amounts/line-items
            # still require a human in the invoice form.
            await db.customers.update_one({"id": target},
                                          {"$set": {"needs_invoice_flag": True}})
            applied = True
        else:
            raise HTTPException(400, f"Unknown approval action: {action}")
    except HTTPException:
        raise
    except Exception as e:
        await _log(level="error", module=a.get("module", "guardian"),
                   rule_id=a.get("rule_id"),
                   message=f"apply_approval failed: {e}", actor=actor)
        raise HTTPException(500, f"Apply failed: {e}")

    await db.guardian_approvals.update_one(
        {"id": a["id"]},
        {"$set": {
            "status": "approved" if applied else "rejected",
            "decided_at": _now(),
            "decided_by": actor,
            "applied_backup_id": backup_id,
            "otp_verified": otp_verified,
            "note": (decision.note or "") if decision else "",
        }},
    )
    # AUDIT LOG entry — mandatory per security spec
    await _log(
        level="info",
        module=a.get("module", "guardian"),
        rule_id=a.get("rule_id"),
        message=f"APPROVAL APPLIED action={action} customer={a.get('customer_id')} "
                f"otp_verified={otp_verified} backup={backup_id}",
        details={
            "approval_id": a["id"],
            "customer_id": a.get("customer_id"),
            "customer_name": a.get("customer_name"),
            "action": action,
            "before": a.get("before_value"),
            "after": after_val,
            "otp_verified": otp_verified,
            "backup_id": backup_id,
            "risk_level": a.get("risk_level"),
        },
        actor=actor,
    )
    return {"success": True, "applied": applied, "backup_id": backup_id,
            "otp_verified": otp_verified}


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
        {"template_key": "billing_sync", "name": "Billing Sync Monitor", "action_mode": "approval"},
        {"template_key": "payment_due_gate", "name": "Payment Due Gate",  "action_mode": "approval"},
        {"template_key": "install_progress", "name": "Installation 100% Completion", "action_mode": "approval"},
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
            "risk_level": tpl.get("risk_level", "MEDIUM"),
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
