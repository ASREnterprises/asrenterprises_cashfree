"""
Critical System Monitor — Super Admin Only.

Surfaces OTP & Payment failures with EXACT reasons (not generic "Failed"),
exposes one-click recovery actions (Retry WA / Send Email / Auto-retry / Send
Reminder / Mark as Paid w/ OTP), runs system-health rate-limit checks, and
gives the owner a quick "test OTP" / "test payment link" sandbox.

Endpoints (all gated to Super Admin via guardian.require_super_admin):
  GET  /api/critical-monitor/health
  GET  /api/critical-monitor/failures/otp?limit=50
  GET  /api/critical-monitor/failures/payments?limit=50
  POST /api/critical-monitor/otp/retry            { audit_id, channel? }
  POST /api/critical-monitor/test-otp             { channel, recipient? }
  POST /api/critical-monitor/test-payment         { mobile, name?, email? }
  POST /api/critical-monitor/payment/retry-link   { invoice_id }
  POST /api/critical-monitor/payment/mark-paid    { invoice_id, action_token, amount? }

NOTE: Mark-paid REQUIRES a Dual-OTP `action_token` from /admin/secure-otp/verify.
"""
from __future__ import annotations

import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db_client import get_db
from routes.guardian import require_super_admin

router = APIRouter(prefix="/critical-monitor", tags=["Critical System Monitor"])
logger = logging.getLogger(__name__)
db = get_db()

# Apply Super-Admin gate to every endpoint on this router.
router.dependencies.append(Depends(require_super_admin))


# ──────────────────────────────────────────────────────────────────────────────
#  FAILURE REASON PARSER  — turn raw error strings into human diagnoses
# ──────────────────────────────────────────────────────────────────────────────
def parse_otp_failure(audit_row: Dict[str, Any]) -> Dict[str, str]:
    """Map technical error tags written by /admin/send-otp-smart into a
    plain-English reason + a fix hint the Super Admin can act on."""
    event = (audit_row.get("event") or "send").lower()
    if event == "verify":
        # Verify-event failures mean the user typed the wrong / expired code.
        return {"reason": "Wrong OTP entered or code already expired",
                "fix": "Ask user to request a fresh OTP; expired after 5 min / 3 attempts"}

    errors: List[str] = audit_row.get("errors") or []
    blob = " ".join(errors).lower()
    channels = audit_row.get("channels_tried") or []

    # Specific signature checks (highest priority first)
    if "not_configured" in blob:
        if "wa:" in blob:
            return {"reason": "WhatsApp API token / phone-id not configured",
                    "fix": "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in backend/.env"}
        if "em:" in blob:
            return {"reason": "Resend API key not configured",
                    "fix": "Set RESEND_API_KEY in backend/.env to enable email OTP"}
    if "wa_tpl_" in blob and ("404" in blob or "not found" in blob or "name" in blob):
        return {"reason": "Template not approved on Meta",
                "fix": "Approve `asr_otp` (or another OTP template) on Meta Business Manager → WABA"}
    if "132000" in blob or "parameters does not match" in blob:
        return {"reason": "Template variable count mismatch",
                "fix": "Template body expects different number of variables than backend sends"}
    if "131056" in blob:
        return {"reason": "Pair rate limit exceeded (Meta)",
                "fix": "Throttle outbound WhatsApp; wait a few minutes before retry"}
    if "131000" in blob or "outside 24" in blob:
        return {"reason": "Recipient outside 24h window",
                "fix": "User must initiate a chat first OR send via approved template only"}
    if "401" in blob and ("wa" in blob or "whatsapp" in blob):
        return {"reason": "Invalid / expired WhatsApp access token",
                "fix": "Refresh permanent token in Meta → Business Settings → System Users"}
    if "timeout" in blob:
        return {"reason": "Delivery timeout (10 seconds)",
                "fix": "Auto-fallback to Email already attempted; retry or check Meta API status"}
    if "domain" in blob and ("verified" in blob or "verification" in blob):
        return {"reason": "Resend sender domain not verified",
                "fix": "Verify asrenterprises.in DNS records on Resend dashboard"}
    if "resend" in blob and "401" in blob:
        return {"reason": "Invalid Resend API key",
                "fix": "Regenerate key on resend.com and update RESEND_API_KEY"}
    if "rate" in blob and "limit" in blob:
        return {"reason": "Rate limit exceeded",
                "fix": "Wait a few minutes; consider batching or upgrading plan"}
    if errors:
        return {"reason": errors[0][:140] if errors[0] else "Unknown API error",
                "fix": "Inspect backend.err.log for full stack trace"}
    if not channels:
        return {"reason": "No delivery channel attempted",
                "fix": "Backend never tried WhatsApp or Email — config likely missing"}
    return {"reason": "Unknown delivery failure",
            "fix": f"Channels tried: {', '.join(channels)}; check backend logs"}


def parse_payment_failure(order: Dict[str, Any]) -> Dict[str, str]:
    """Translate Cashfree/order-doc failure metadata into actionable reason."""
    raw = (order.get("failure_reason") or "").strip()
    pay_status = (order.get("payment_status") or "").lower()
    order_status = (order.get("status") or order.get("order_status") or "").lower()

    blob = (raw + " " + pay_status + " " + order_status).lower()
    if "timeout" in blob or "timed out" in blob:
        return {"reason": "Transaction timeout — customer did not complete payment",
                "fix": "Send a fresh payment link via WhatsApp / Email"}
    if "declin" in blob or "denied" in blob:
        return {"reason": "UPI/Bank declined the transaction",
                "fix": "Ask customer to retry with another UPI app or bank account"}
    if "insufficient" in blob:
        return {"reason": "Insufficient balance in customer account",
                "fix": "Customer to add funds and retry; resend link"}
    if "invalid" in blob and ("vpa" in blob or "upi" in blob or "account" in blob):
        return {"reason": "Invalid UPI ID / account details",
                "fix": "Double-check UPI VPA / bank a/c on cashfree dashboard"}
    if "gateway" in blob or "5xx" in blob or "internal" in blob:
        return {"reason": "Cashfree gateway error",
                "fix": "Retry; if recurring, contact Cashfree support with order_id"}
    if "expired" in blob or order_status == "expired":
        return {"reason": "Payment link expired",
                "fix": "Generate a new payment link and resend"}
    if pay_status == "pending":
        return {"reason": "Awaiting customer action (pending)",
                "fix": "Send reminder via WhatsApp; consider auto-cancel after 24h"}
    if raw:
        return {"reason": raw[:140], "fix": "See Cashfree dashboard for full transaction log"}
    return {"reason": "Unknown payment failure",
            "fix": "Pull cf_order_id from this row and inspect on cashfree.com"}


# ──────────────────────────────────────────────────────────────────────────────
#  HEALTH
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/health")
async def health_summary():
    """24h success / failure counts for OTP + Payments. Returns alerts when
    failure rate > 20% (per spec section 12)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    # OTP — only count "send" events (verifies don't reflect delivery)
    otp_send_filter = {"ts": {"$gte": cutoff}, "event": {"$ne": "verify"}}
    otp_total = await db.otp_audit.count_documents(otp_send_filter)
    otp_fail  = await db.otp_audit.count_documents({**otp_send_filter, "success": False})
    otp_ok    = otp_total - otp_fail
    otp_rate  = round((otp_ok / otp_total) * 100, 1) if otp_total else 100.0
    otp_fail_rate = round((otp_fail / otp_total) * 100, 1) if otp_total else 0.0

    # Payments — pending / failed in cashfree_orders
    pay_total = await db.cashfree_orders.count_documents({"created_at": {"$gte": cutoff}})
    pay_fail  = await db.cashfree_orders.count_documents({
        "created_at": {"$gte": cutoff},
        "payment_status": {"$nin": ["paid", "completed"]},
    })
    pay_ok = pay_total - pay_fail
    pay_rate = round((pay_ok / pay_total) * 100, 1) if pay_total else 100.0

    alerts: List[Dict[str, str]] = []
    if otp_total >= 5 and otp_fail_rate > 20.0:
        alerts.append({
            "severity": "critical",
            "topic": "OTP",
            "message": f"OTP failure rate {otp_fail_rate}% in the last 24h — investigate immediately",
        })
    if pay_total >= 3 and pay_fail and pay_fail >= pay_total * 0.5:
        alerts.append({
            "severity": "warning",
            "topic": "Payments",
            "message": f"{pay_fail} of {pay_total} payments failed/pending in 24h",
        })
    if not os.environ.get("RESEND_API_KEY"):
        alerts.append({"severity": "warning", "topic": "Email",
                       "message": "RESEND_API_KEY not configured — Email OTP will fail"})
    if not os.environ.get("WHATSAPP_ACCESS_TOKEN"):
        alerts.append({"severity": "critical", "topic": "WhatsApp",
                       "message": "WHATSAPP_ACCESS_TOKEN not configured — WA OTP will fail"})

    return {
        "window": "24h",
        "otp": {"total": otp_total, "success": otp_ok, "failed": otp_fail,
                "success_rate": otp_rate, "failure_rate": otp_fail_rate},
        "payment": {"total": pay_total, "success": pay_ok, "failed": pay_fail,
                    "success_rate": pay_rate},
        "alerts": alerts,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────────────────────────────────────────────────────────────────
#  OTP FAILURES
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/failures/otp")
async def list_otp_failures(limit: int = 50):
    limit = max(1, min(int(limit or 50), 200))
    cur = db.otp_audit.find(
        {"$or": [{"success": False}, {"event": "verify", "success": False}]},
        {"_id": 0},
    ).sort("ts", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    enriched: List[Dict[str, Any]] = []
    for r in rows:
        diag = parse_otp_failure(r)
        enriched.append({
            **r,
            "reason": diag["reason"],
            "fix_hint": diag["fix"],
        })
    return {"count": len(enriched), "items": enriched}


# ──────────────────────────────────────────────────────────────────────────────
#  PAYMENT FAILURES
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/failures/payments")
async def list_payment_failures(limit: int = 50):
    """Return Cashfree orders that failed / expired / are stuck pending > 30m."""
    limit = max(1, min(int(limit or 50), 200))
    thirty_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    cur = db.cashfree_orders.find(
        {"$or": [
            {"payment_status": {"$in": ["failed", "expired", "cancelled"]}},
            {"payment_status": "pending", "created_at": {"$lt": thirty_min_ago}},
        ]},
        {"_id": 0},
    ).sort("created_at", -1).limit(limit)
    rows = await cur.to_list(length=limit)

    enriched: List[Dict[str, Any]] = []
    for r in rows:
        diag = parse_payment_failure(r)
        enriched.append({
            "id": r.get("id") or r.get("cf_order_id") or r.get("order_id"),
            "cf_order_id": r.get("cf_order_id") or r.get("order_id"),
            "customer_name": r.get("customer_name") or "—",
            "customer_phone": r.get("customer_phone") or r.get("phone") or "—",
            "customer_email": r.get("customer_email") or r.get("email") or "",
            "amount": r.get("payment_amount_received") or r.get("amount") or 0,
            "payment_method": r.get("payment_method") or "UPI/Cashfree",
            "payment_status": r.get("payment_status") or "—",
            "purpose": r.get("payment_type") or r.get("booking_type") or "—",
            "created_at": r.get("created_at") or "",
            "reason": diag["reason"],
            "fix_hint": diag["fix"],
        })
    return {"count": len(enriched), "items": enriched}


# ──────────────────────────────────────────────────────────────────────────────
#  RECOVERY ACTIONS
# ──────────────────────────────────────────────────────────────────────────────
class OtpRetryReq(BaseModel):
    audit_id: Optional[str] = None
    channel: Optional[str] = "auto"   # whatsapp | email | auto


@router.post("/otp/retry")
async def retry_otp(body: OtpRetryReq, _admin=Depends(require_super_admin)):
    """Re-send an admin OTP via the chosen channel (auto = smart fallback)."""
    # Re-use the existing smart sender so retries go through the same audit path
    from server import admin_send_otp_smart  # type: ignore
    from fastapi import Request

    # Build a stub request (admin_send_otp_smart only needs client.host for IP)
    class _Stub:
        client = type("c", (), {"host": "127.0.0.1"})()
        scope = {"client": ("127.0.0.1", 0), "headers": []}
        headers: Dict[str, str] = {}

    payload = {"channel": (body.channel or "auto").lower(), "purpose": "manual_retry"}
    try:
        return await admin_send_otp_smart(_Stub(), payload)  # type: ignore
    except Exception as e:
        raise HTTPException(502, f"Retry failed: {e}")


class TestOtpReq(BaseModel):
    channel: str = Field(default="whatsapp")  # whatsapp | email | auto | both
    recipient: Optional[str] = None
    purpose: str = "test"


@router.post("/test-otp")
async def test_otp(body: TestOtpReq, admin=Depends(require_super_admin)):
    """Issue a no-op OTP just to verify deliverability. Result is written to
    `db.otp_audit` with purpose='test' so the audit trail proves it landed."""
    from server import admin_send_otp_smart  # type: ignore

    class _Stub:
        client = type("c", (), {"host": "127.0.0.1"})()
        scope = {"client": ("127.0.0.1", 0), "headers": []}
        headers: Dict[str, str] = {}

    payload = {"channel": body.channel.lower(), "purpose": body.purpose or "test"}
    try:
        result = await admin_send_otp_smart(_Stub(), payload)
        return {"ok": True, "delivery": result, "tested_by": admin.get("name")}
    except HTTPException as e:
        return {"ok": False, "error": e.detail}


class TestPaymentReq(BaseModel):
    mobile: str
    name: Optional[str] = "Test Customer"
    email: Optional[str] = ""
    amount: int = 1


@router.post("/test-payment")
async def test_payment_link(body: TestPaymentReq, _admin=Depends(require_super_admin)):
    """Create a ₹1 Cashfree order so Super Admin can verify the gateway works
    end-to-end. Returns the payment_session_id + checkout URL."""
    mobile = re.sub(r"\D", "", body.mobile)[-10:]
    if len(mobile) != 10:
        raise HTTPException(400, "Invalid 10-digit mobile")
    try:
        from routes.cashfree_orders import create_cashfree_order  # type: ignore
    except Exception:
        # Fallback path used by website checkout
        try:
            from server import _create_cashfree_order  # type: ignore
            create_cashfree_order = _create_cashfree_order  # type: ignore
        except Exception as e:
            raise HTTPException(500, f"Cashfree integration not available: {e}")

    test_order = {
        "customer_name": body.name or "Test Customer",
        "customer_phone": mobile,
        "customer_email": body.email or "test@asrenterprises.in",
        "amount": max(1, int(body.amount or 1)),
        "purpose": "critical_monitor_test",
        "payment_type": "test",
    }
    try:
        result = await create_cashfree_order(test_order)
        return {"ok": True, "order": result}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


class PaymentRetryReq(BaseModel):
    invoice_id: str
    channel: str = "both"  # whatsapp | email | both


@router.post("/payment/retry-link")
async def retry_payment_link(body: PaymentRetryReq, admin=Depends(require_super_admin)):
    """Re-fire WhatsApp + Email payment-reminder for an invoice that's still due."""
    inv = await db.invoices.find_one({"id": body.invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if (inv.get("payment_status") or "").lower() == "paid":
        raise HTTPException(400, "Invoice already paid")

    sent_via: List[str] = []
    errors: List[str] = []
    if body.channel in ("whatsapp", "both"):
        try:
            from routes.gst_reminders import send_invoice_reminder_now  # type: ignore
            r = await send_invoice_reminder_now(inv["id"])
            sent_via.append("whatsapp")
            sent_via.append(f"wa_result:{(r or {}).get('result', '?')}")
        except Exception as e:
            errors.append(f"wa:{str(e)[:120]}")
    if body.channel in ("email", "both"):
        try:
            from routes.gst_invoices import send_invoice_email  # type: ignore
            await send_invoice_email(inv["id"])
            sent_via.append("email")
        except Exception as e:
            errors.append(f"em:{str(e)[:120]}")

    await db.guardian_logs.insert_one({
        "id": str(uuid.uuid4()),
        "level": "info", "module": "critical_monitor",
        "message": f"payment retry-link invoice={inv.get('invoice_number')} via={','.join(sent_via)}",
        "actor": admin.get("name", "admin"),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": bool(sent_via), "sent_via": sent_via, "errors": errors}


class MarkPaidReq(BaseModel):
    invoice_id: str
    action_token: str
    amount: Optional[float] = None
    reference: str = "manual_super_admin"
    notes: str = "Marked paid via Critical Monitor"


@router.post("/payment/mark-paid")
async def mark_invoice_paid(body: MarkPaidReq, admin=Depends(require_super_admin)):
    """Force-mark an invoice as PAID. Requires a fresh Dual-OTP `action_token`
    minted by /api/admin/secure-otp/verify (5-min TTL, single-use)."""
    # Validate action_token
    from server import otp_storage  # type: ignore

    key = f"action_token:{body.action_token}"
    rec = otp_storage.get(key)
    if not rec or rec.get("purpose") not in ("payment_update", "secure_action", "mark_paid"):
        raise HTTPException(401, "Missing or invalid Dual-OTP action_token. Request a new code.")
    if time.time() - rec.get("timestamp", 0) > 300:
        otp_storage.pop(key, None)
        raise HTTPException(410, "Action token expired. Request a new code.")
    # Burn the token
    otp_storage.pop(key, None)

    inv = await db.invoices.find_one({"id": body.invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if (inv.get("payment_status") or "").lower() == "paid":
        return {"ok": True, "already": True, "message": "Invoice was already paid"}

    grand = float(inv.get("grand_total") or 0)
    paid_so_far = float(inv.get("amount_paid") or 0)
    bal = max(0.0, grand - paid_so_far)
    pay_amount = float(body.amount or bal)
    if pay_amount <= 0:
        raise HTTPException(400, "Nothing to pay")
    if pay_amount > bal + 0.01:
        raise HTTPException(400, f"Amount exceeds balance ({bal:.2f})")

    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "amount": round(pay_amount, 2),
        "payment_mode": "Manual (Super Admin)",
        "payment_date": now[:10],
        "reference": body.reference,
        "notes": body.notes,
        "recorded_by": admin.get("name", "super_admin"),
        "recorded_at": now,
    }
    new_paid = round(paid_so_far + pay_amount, 2)
    new_due = round(max(0.0, grand - new_paid), 2)
    new_status = "paid" if new_due <= 0.0 else "partial"

    await db.invoices.update_one(
        {"id": body.invoice_id},
        {"$set": {"amount_paid": new_paid, "due_amount": new_due,
                  "payment_status": new_status, "payment_mode_last": entry["payment_mode"],
                  "payment_date": entry["payment_date"]},
         "$push": {"payment_history": entry}},
    )
    await db.guardian_logs.insert_one({
        "id": str(uuid.uuid4()),
        "level": "warn", "module": "critical_monitor",
        "message": f"INVOICE FORCE-PAID inv={inv.get('invoice_number')} amount={pay_amount} by={admin.get('name')} ref={body.reference}",
        "actor": admin.get("name", "admin"),
        "ts": now,
    })
    return {"ok": True, "invoice_id": body.invoice_id, "payment_status": new_status,
            "amount_paid": new_paid, "due_amount": new_due, "entry": entry}
