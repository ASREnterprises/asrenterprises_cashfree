"""
Public OTP endpoints for website customer verification.

Used by the Book-Solar-Service and Book-Site-Visit flows to verify a customer's
mobile number BEFORE initiating the Cashfree payment. Delivers the OTP via the
existing Meta WhatsApp Cloud API (no MSG91 dependency).

Endpoints (mounted under /api/public):
  POST /public/otp/send    { name, phone }        → { success, otp_id, expires_in }
  POST /public/otp/verify  { otp_id, phone, otp } → { success, verified_at }
"""
from __future__ import annotations

import logging
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db_client import get_db

router = APIRouter(prefix="/public/otp", tags=["Public OTP"])
logger = logging.getLogger(__name__)
db = get_db()

OTP_TTL_SECONDS = 300          # 5 minutes
OTP_SEND_COOLDOWN_SECONDS = 45  # Prevent spam — minimum gap between sends to same phone
MAX_OTP_VERIFY_ATTEMPTS = 5     # Per OTP record
MAX_OTP_SENDS_PER_HOUR = 6      # Per phone number

# In-memory counter — resets on restart but protects from burst spamming
_send_counters: Dict[str, list] = {}


class OtpSendRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    purpose: str = Field(default="booking")  # booking | site_visit | shop_order


class OtpVerifyRequest(BaseModel):
    otp_id: str
    phone: str
    otp: str = Field(..., min_length=4, max_length=8)


def _clean_phone(phone: str) -> str:
    """Return a 10-digit Indian mobile (no country code). Returns '' if invalid."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) == 10 and digits[0] in "6789":
        return digits
    return ""


def _e164(phone10: str) -> str:
    return f"91{phone10}" if phone10 else ""


def _check_rate_limit(phone10: str) -> Optional[str]:
    """Return error message if rate-limit exceeded, else None."""
    now = datetime.now(timezone.utc).timestamp()
    hour_ago = now - 3600
    timestamps = [t for t in _send_counters.get(phone10, []) if t > hour_ago]
    _send_counters[phone10] = timestamps
    if timestamps and (now - timestamps[-1]) < OTP_SEND_COOLDOWN_SECONDS:
        wait = int(OTP_SEND_COOLDOWN_SECONDS - (now - timestamps[-1]))
        return f"Please wait {wait}s before requesting another OTP."
    if len(timestamps) >= MAX_OTP_SENDS_PER_HOUR:
        return "Too many OTP requests. Please try again after an hour."
    return None


async def _send_otp_whatsapp(phone_e164: str, name: str, otp: str, purpose: str) -> Dict:
    """Deliver OTP via Meta WhatsApp Cloud API.

    Strategy:
      1. Try the approved `authentication_otp` / `otp_verification` / similar template.
      2. Fall back to a plain text message if the customer has an open 24h window.
      3. Return ok/failure detail either way — the UI shows the OTP input regardless
         so a slow/missed WhatsApp doesn't block a legit customer.
    """
    try:
        from routes.whatsapp import get_whatsapp_settings, send_whatsapp_template
        settings = await get_whatsapp_settings()
        token = (settings or {}).get("access_token", "").strip()
        phone_id = (settings or {}).get("phone_number_id", "").strip()
        if not token or not phone_id:
            return {"success": False, "error": "whatsapp not configured"}

        # Option 1: Use an OTP template if one is approved on the account.
        # Try the most common names; gracefully skip if none exist.
        for tpl_name in ["otp_verification", "authentication_otp", "website_otp", "customer_otp"]:
            try:
                result = await send_whatsapp_template(
                    phone=phone_e164,
                    template_name=tpl_name,
                    variables=[otp],
                )
                if result.get("success"):
                    return {"success": True, "channel": "whatsapp_template", "template": tpl_name}
            except Exception:
                continue

        # Option 2: Plain text message (requires a recent customer-initiated chat).
        friendly = (
            f"Dear {name},\n\nYour ASR Enterprises verification code is: *{otp}*\n"
            f"It expires in {OTP_TTL_SECONDS // 60} minutes.\n\n"
            f"Do not share this code with anyone.\n— ASR Enterprises Patna"
        )
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_e164,
                    "type": "text",
                    "text": {"body": friendly},
                },
            )
            if resp.status_code in (200, 201):
                return {"success": True, "channel": "whatsapp_text"}
            return {"success": False, "error": f"whatsapp_text_{resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        logger.warning(f"[public_otp] whatsapp send failed: {e}")
        return {"success": False, "error": str(e)}


@router.post("/send")
async def send_otp(req: OtpSendRequest):
    """Generate a 6-digit OTP, save it, deliver via WhatsApp."""
    phone10 = _clean_phone(req.phone)
    if not phone10:
        raise HTTPException(400, "Invalid 10-digit Indian mobile number")

    rate_err = _check_rate_limit(phone10)
    if rate_err:
        raise HTTPException(429, rate_err)

    otp_code = f"{random.randint(100000, 999999)}"
    otp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Invalidate any older unused OTPs for this phone/purpose so stale codes can't win races.
    await db.public_otps.update_many(
        {"phone": phone10, "verified": False, "superseded": {"$ne": True}},
        {"$set": {"superseded": True, "superseded_at": now.isoformat()}},
    )

    record = {
        "id": otp_id,
        "phone": phone10,
        "name": req.name.strip()[:100],
        "purpose": req.purpose,
        "otp_hash": _hash_otp(otp_code),
        "attempts": 0,
        "verified": False,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),
    }
    await db.public_otps.insert_one(record.copy())
    _send_counters.setdefault(phone10, []).append(now.timestamp())

    # Deliver — non-blocking failures still return success:true so the UI can
    # show the OTP input (customer may receive via WhatsApp on retry).
    delivery = await _send_otp_whatsapp(_e164(phone10), req.name, otp_code, req.purpose)
    await db.public_otps.update_one(
        {"id": otp_id},
        {"$set": {
            "delivery_status": "ok" if delivery.get("success") else "failed",
            "delivery_channel": delivery.get("channel", ""),
            "delivery_error": delivery.get("error", ""),
        }},
    )

    if delivery.get("success"):
        logger.info(f"[public_otp] sent to {phone10} via {delivery.get('channel')} for {req.purpose}")
    else:
        logger.warning(f"[public_otp] delivery issue to {phone10}: {delivery.get('error')}")

    return {
        "success": True,
        "otp_id": otp_id,
        "phone_masked": f"*****{phone10[-5:]}",
        "expires_in": OTP_TTL_SECONDS,
        "channel": delivery.get("channel", "unknown"),
        "delivered": delivery.get("success", False),
    }


@router.post("/verify")
async def verify_otp(req: OtpVerifyRequest):
    phone10 = _clean_phone(req.phone)
    if not phone10:
        raise HTTPException(400, "Invalid mobile number")

    rec = await db.public_otps.find_one({"id": req.otp_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "OTP session not found. Please request a new one.")
    if rec.get("phone") != phone10:
        raise HTTPException(400, "Phone number does not match the OTP session.")
    if rec.get("verified"):
        return {"success": True, "verified_at": rec.get("verified_at"), "phone": phone10}
    if rec.get("superseded"):
        raise HTTPException(410, "A newer OTP was requested. Please use the latest code.")

    # Expiry check
    try:
        expires_at = datetime.fromisoformat(rec["expires_at"])
    except Exception:
        raise HTTPException(500, "OTP record corrupted; request a new one.")
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(410, "OTP expired. Please request a new one.")

    # Attempt limit
    attempts = int(rec.get("attempts", 0))
    if attempts >= MAX_OTP_VERIFY_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Please request a new OTP.")

    # Compare
    if _hash_otp(req.otp.strip()) != rec.get("otp_hash"):
        await db.public_otps.update_one({"id": req.otp_id}, {"$inc": {"attempts": 1}})
        raise HTTPException(401, "Incorrect OTP. Please try again.")

    verified_at = datetime.now(timezone.utc).isoformat()
    await db.public_otps.update_one(
        {"id": req.otp_id},
        {"$set": {"verified": True, "verified_at": verified_at}},
    )
    return {"success": True, "verified_at": verified_at, "phone": phone10, "name": rec.get("name", "")}


def _hash_otp(otp: str) -> str:
    """Hash with a static secret so DB dumps never expose the live OTP."""
    import hashlib
    salt = os.environ.get("PUBLIC_OTP_SALT", "asr-public-otp-v1")
    return hashlib.sha256(f"{salt}:{otp}".encode()).hexdigest()


async def is_otp_verified(otp_id: str, phone: str) -> bool:
    """Helper usable from payment endpoints to cross-check that the phone was
    verified before creating a Cashfree order."""
    phone10 = _clean_phone(phone)
    if not phone10 or not otp_id:
        return False
    rec = await db.public_otps.find_one(
        {"id": otp_id, "phone": phone10, "verified": True},
        {"_id": 0, "verified_at": 1},
    )
    return bool(rec)
