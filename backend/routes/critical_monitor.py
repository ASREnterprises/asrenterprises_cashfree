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

from fastapi import APIRouter, Depends, HTTPException, Request
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
    plain-English reason + a fix hint the Super Admin can act on.

    Also classifies error_type:
      • 'user'   — user typed wrong code, expired, too many attempts
      • 'system' — anything to do with config/template/keys/gateway/timeout
    """
    event = (audit_row.get("event") or "send").lower()
    if event == "verify":
        # Verify-event failures mean the user typed the wrong / expired code.
        return {
            "reason": "Wrong OTP entered or code already expired",
            "error_type": "user",
            "suggestion": "User entered an incorrect OTP — possibly delay, typo, or confusion. Ask them to request a fresh code; codes expire after 5 minutes or 3 wrong attempts.",
            "fix": "Ask user to request a fresh OTP; expired after 5 min / 3 attempts",
        }

    errors: List[str] = audit_row.get("errors") or []
    blob = " ".join(errors).lower()
    channels = audit_row.get("channels_tried") or []

    # Specific signature checks (highest priority first)
    if "not_configured" in blob:
        if "wa:" in blob:
            return {"reason": "WhatsApp API token / phone-id not configured",
                    "error_type": "system",
                    "suggestion": "Backend cannot reach Meta — credentials are missing. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in /app/backend/.env then restart.",
                    "fix": "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in backend/.env"}
        if "em:" in blob:
            return {"reason": "Resend API key not configured",
                    "error_type": "system",
                    "suggestion": "Email OTP fallback is disabled because RESEND_API_KEY is empty. Generate a key at resend.com and add it to backend/.env.",
                    "fix": "Set RESEND_API_KEY in backend/.env to enable email OTP"}
    if "wa_tpl_" in blob and ("404" in blob or "not found" in blob or "name" in blob):
        return {"reason": "Template not approved on Meta",
                "error_type": "system",
                "suggestion": "WhatsApp template may not be approved in Meta — get `asr_otp` (or another OTP template) approved on Meta Business Manager.",
                "fix": "Approve `asr_otp` (or another OTP template) on Meta Business Manager → WABA"}
    if "132000" in blob or "parameters does not match" in blob:
        return {"reason": "Template variable count mismatch",
                "error_type": "system",
                "suggestion": "Approved template body expects a different number of {{1}} {{2}} placeholders than backend is sending. Re-sync templates or fix the variables array.",
                "fix": "Template body expects different number of variables than backend sends"}
    if "131056" in blob:
        return {"reason": "Pair rate limit exceeded (Meta)",
                "error_type": "system",
                "suggestion": "Meta is rate-limiting outbound messages to this customer. Wait a few minutes; consider batching campaigns to spread the load.",
                "fix": "Throttle outbound WhatsApp; wait a few minutes before retry"}
    if "131000" in blob or "outside 24" in blob:
        return {"reason": "Recipient outside 24h window",
                "error_type": "system",
                "suggestion": "Plain-text WhatsApp can only go to users who chatted with us in the last 24h. Use an approved template (asr_otp) instead.",
                "fix": "User must initiate a chat first OR send via approved template only"}
    if "401" in blob and ("wa" in blob or "whatsapp" in blob):
        return {"reason": "Invalid / expired WhatsApp access token",
                "error_type": "system",
                "suggestion": "Meta rejected the access token. Likely expired. Generate a fresh permanent token at Meta Business → System Users.",
                "fix": "Refresh permanent token in Meta → Business Settings → System Users"}
    if "timeout" in blob:
        return {"reason": "Delivery timeout (10 seconds)",
                "error_type": "system",
                "suggestion": "Meta API did not respond within 10s — likely a transient outage. Auto-fallback to Email already attempted; check Meta API status page.",
                "fix": "Auto-fallback to Email already attempted; retry or check Meta API status"}
    if "domain" in blob and ("verified" in blob or "verification" in blob):
        return {"reason": "Resend sender domain not verified",
                "error_type": "system",
                "suggestion": "Resend rejected the email because asrenterprises.in DNS records (SPF/DKIM/DMARC) are missing or wrong. Verify on the Resend dashboard.",
                "fix": "Verify asrenterprises.in DNS records on Resend dashboard"}
    if "resend" in blob and "401" in blob:
        return {"reason": "Invalid Resend API key",
                "error_type": "system",
                "suggestion": "Resend rejected the API key. Generate a new one and update RESEND_API_KEY in backend/.env.",
                "fix": "Regenerate key on resend.com and update RESEND_API_KEY"}
    if "rate" in blob and "limit" in blob:
        return {"reason": "Rate limit exceeded",
                "error_type": "system",
                "suggestion": "Either Meta or Resend throttled us. Cooldown for a few minutes; consider upgrading the plan if recurring.",
                "fix": "Wait a few minutes; consider batching or upgrading plan"}
    if errors:
        return {"reason": errors[0][:140] if errors[0] else "Unknown API error",
                "error_type": "system",
                "suggestion": "Inspect /var/log/supervisor/backend.err.log for the full stack trace; this looks like a generic API failure.",
                "fix": "Inspect backend.err.log for full stack trace"}
    if not channels:
        return {"reason": "No delivery channel attempted",
                "error_type": "system",
                "suggestion": "Backend never tried WhatsApp or Email — most likely WHATSAPP_ACCESS_TOKEN and RESEND_API_KEY are both missing.",
                "fix": "Backend never tried WhatsApp or Email — config likely missing"}
    return {"reason": "Unknown delivery failure",
            "error_type": "system",
            "suggestion": f"Channels tried: {', '.join(channels)}. No matched signature — check backend logs.",
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
            "error_type": diag.get("error_type", "system"),
            "suggestion": diag.get("suggestion", diag["fix"]),
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
    action_token: Optional[str] = None  # Required for retry per spec section 10


def _consume_action_token(token: Optional[str], allowed_purposes: tuple) -> None:
    """Verify a 5-min single-use action_token from /admin/secure-otp/verify.
    Raises HTTPException on mismatch. Burns the token on success."""
    from server import otp_storage  # type: ignore

    if not token:
        raise HTTPException(401, "Action token required. Verify Dual-OTP first.")
    key = f"action_token:{token}"
    rec = otp_storage.get(key)
    if not rec:
        raise HTTPException(401, "Invalid action token. Re-verify via Dual-OTP.")
    if time.time() - rec.get("timestamp", 0) > 300:
        otp_storage.pop(key, None)
        raise HTTPException(410, "Action token expired. Request a fresh code.")
    if (rec.get("purpose") or "").lower() not in allowed_purposes:
        raise HTTPException(403, f"Token purpose mismatch ({rec.get('purpose')}).")
    otp_storage.pop(key, None)


@router.post("/otp/retry")
async def retry_otp(body: OtpRetryReq, request: Request, _admin=Depends(require_super_admin)):
    """Re-send an admin OTP via the chosen channel (auto = smart fallback).
    REQUIRES a Dual-OTP action_token per spec section 10."""
    _consume_action_token(body.action_token,
                          ("secure_action", "otp_retry", "payment_update"))
    from server import admin_send_otp_smart  # type: ignore

    payload = {"channel": (body.channel or "auto").lower(), "purpose": "manual_retry"}
    try:
        return await admin_send_otp_smart(request, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Retry failed: {e}")


class TestOtpReq(BaseModel):
    channel: str = Field(default="whatsapp")  # whatsapp | email | auto | both
    recipient: Optional[str] = None
    purpose: str = "test"


@router.post("/test-otp")
async def test_otp(body: TestOtpReq, request: Request, admin=Depends(require_super_admin)):
    """Issue a no-op OTP just to verify deliverability. Result is written to
    `db.otp_audit` with purpose='test' so the audit trail proves it landed."""
    from server import admin_send_otp_smart  # type: ignore

    payload = {"channel": body.channel.lower(), "purpose": body.purpose or "test"}
    try:
        result = await admin_send_otp_smart(request, payload)
        return {"ok": True, "delivery": result, "tested_by": admin.get("name")}
    except HTTPException as e:
        return {"ok": False, "error": e.detail}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


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
        from routes.cashfree_orders import _create_cashfree_order_impl, CreateOrderRequest
    except Exception as e:
        raise HTTPException(500, f"Cashfree integration not available: {e}")

    try:
        payload = CreateOrderRequest(
            customer_name=body.name or "Test Customer",
            customer_phone=mobile,
            customer_email=body.email or "test@asrenterprises.in",
            amount=max(1, int(body.amount or 1)),
            booking_type="critical_monitor_test",
            payment_type="test",
        )
    except Exception as e:
        # If the model has different required fields, fall back to dict-style
        return {"ok": False, "error": f"Could not build CreateOrderRequest: {e}"}

    try:
        result = await _create_cashfree_order_impl(payload)
        return {"ok": True, "order": result}
    except HTTPException as e:
        return {"ok": False, "error": e.detail}
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
    _consume_action_token(body.action_token,
                          ("payment_update", "secure_action", "mark_paid"))

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



# ──────────────────────────────────────────────────────────────────────────────
#  TREND ANALYTICS
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/trend")
async def failure_trend(hours: int = 24):
    """Return hourly OTP-fail and Payment-fail counts for the last N hours.
    Used by the dashboard sparkline charts."""
    hours = max(1, min(int(hours or 24), 168))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # OTP fails per hour (event=send only)
    otp_cur = db.otp_audit.find(
        {"ts": {"$gte": cutoff.isoformat()}, "event": {"$ne": "verify"}, "success": False},
        {"_id": 0, "ts": 1},
    ).limit(2000)
    otp_rows = await otp_cur.to_list(length=2000)

    pay_cur = db.cashfree_orders.find(
        {"created_at": {"$gte": cutoff.isoformat()},
         "payment_status": {"$nin": ["paid", "completed"]}},
        {"_id": 0, "created_at": 1},
    ).limit(2000)
    pay_rows = await pay_cur.to_list(length=2000)

    # Bucket by hour
    def _bucketize(rows: List[Dict[str, Any]], ts_key: str) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for r in rows:
            iso = (r.get(ts_key) or "")[:13]  # YYYY-MM-DDTHH
            out[iso] = out.get(iso, 0) + 1
        return out

    otp_b = _bucketize(otp_rows, "ts")
    pay_b = _bucketize(pay_rows, "created_at")

    series_otp: List[Dict[str, Any]] = []
    series_pay: List[Dict[str, Any]] = []
    for h in range(hours, -1, -1):
        slot = (datetime.now(timezone.utc) - timedelta(hours=h)).strftime("%Y-%m-%dT%H")
        series_otp.append({"hour": slot, "value": otp_b.get(slot, 0)})
        series_pay.append({"hour": slot, "value": pay_b.get(slot, 0)})

    return {
        "window_hours": hours,
        "otp_failures": series_otp,
        "payment_failures": series_pay,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  AUTO-FIX  (one-click bulk recovery)
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/auto-fix")
async def auto_fix(request: Request, admin=Depends(require_super_admin)):
    """One-click recovery sweep:
      1. Re-issue an admin OTP via Smart channel (auto = WA → Email).
      2. Re-fire reminder for every unpaid invoice from the last 24h.
      3. Return a per-step result so the UI can render exactly what changed.
    Logged to guardian_logs for the audit trail."""
    summary: Dict[str, Any] = {"otp": None, "payments": [], "errors": []}

    # ── Step 1: Force a fresh admin OTP smart-send
    try:
        from server import admin_send_otp_smart  # type: ignore
        summary["otp"] = await admin_send_otp_smart(
            request, {"channel": "auto", "purpose": "auto_fix_sweep"},
        )
    except HTTPException as e:
        summary["errors"].append(f"otp:{e.detail}")
    except Exception as e:
        summary["errors"].append(f"otp:{str(e)[:140]}")

    # ── Step 2: Re-fire reminder for unpaid invoices created < 24h ago
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    cur = db.invoices.find(
        {"created_at": {"$gte": cutoff},
         "payment_status": {"$in": ["unpaid", "partial"]},
         "doc_type": {"$ne": "quotation"}},
        {"_id": 0, "id": 1, "invoice_number": 1, "customer.name": 1},
    ).limit(20)
    todo = await cur.to_list(length=20)
    for inv in todo:
        try:
            from routes.gst_reminders import send_invoice_reminder_now  # type: ignore
            r = await send_invoice_reminder_now(inv["id"])
            summary["payments"].append({"invoice_id": inv["id"],
                                         "invoice": inv.get("invoice_number"),
                                         "result": (r or {}).get("result", "ok")})
        except Exception as e:
            summary["payments"].append({"invoice_id": inv["id"],
                                         "invoice": inv.get("invoice_number"),
                                         "result": f"err:{str(e)[:120]}"})

    await db.guardian_logs.insert_one({
        "id": str(uuid.uuid4()),
        "level": "info", "module": "critical_monitor",
        "message": f"auto-fix sweep by {admin.get('name')} — payments_retried={len(summary['payments'])} errors={len(summary['errors'])}",
        "actor": admin.get("name", "admin"),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "summary": summary, "ts": datetime.now(timezone.utc).isoformat()}


# ──────────────────────────────────────────────────────────────────────────────
#  ENTRY GATE  (Dual-OTP token check before showing the page)
# ──────────────────────────────────────────────────────────────────────────────
class EntryGateReq(BaseModel):
    action_token: Optional[str] = None


@router.post("/entry/verify")
async def verify_entry(body: EntryGateReq, _admin=Depends(require_super_admin)):
    """Validate a Dual-OTP action_token (purpose=secure_action / monitor_entry)
    minted via /api/admin/secure-otp/verify. Lets the UI confirm Super Admin
    has just verified before rendering sensitive failure data."""
    from server import otp_storage  # type: ignore

    if not body.action_token:
        raise HTTPException(401, "Action token required.")
    key = f"action_token:{body.action_token}"
    rec = otp_storage.get(key)
    if not rec:
        raise HTTPException(401, "Invalid or expired token. Re-authenticate via Dual-OTP.")
    if time.time() - rec.get("timestamp", 0) > 300:
        otp_storage.pop(key, None)
        raise HTTPException(410, "Token expired. Request a fresh OTP.")
    purpose = (rec.get("purpose") or "").lower()
    if purpose not in ("secure_action", "monitor_entry", "payment_update"):
        raise HTTPException(403, f"Token purpose mismatch ({purpose}).")
    # Don't burn — entry is read-only, mark-paid will burn its own
    return {"ok": True, "purpose": purpose, "expires_at": rec.get("timestamp", 0) + 300}
