"""
Cashfree Orders API (Hosted Checkout) - Production Live Payments
ASR Enterprises - Complete Payment System
This replaces Payment Links API with the fully activated Orders API
"""
import os
import re
import uuid
import hmac
import httpx
import hashlib
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, Request, Query
from security import limiter, RATE_LIMIT_PAYMENT, RATE_LIMIT_SENSITIVE, require_admin_token as _shared_require_admin_token
from pydantic import BaseModel, Field
from db_client import AsyncIOMotorClient, get_db
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cashfree", tags=["Cashfree Orders"])

# MongoDB connection - uses EFFECTIVE_DB_NAME from db_client (Atlas-aware)
# Shared client so writes are visible across all routes (e.g. CRM Cashfree Payments view).
db = get_db()
client = db.client

# ==================== CONSTANTS ====================
CASHFREE_API_VERSION = "2023-08-01"

# ========== PRODUCTION CREDENTIALS (from environment) ==========
# Credentials MUST be supplied via environment variables / Replit Secrets:
#   CASHFREE_API_KEY     -> Cashfree App ID (x-client-id)
#   CASHFREE_SECRET_KEY  -> Cashfree Secret Key (x-client-secret)
# Never hardcode live keys in source. The app will fail fast on first
# Cashfree call if these are missing, surfacing a clear configuration error.
CASHFREE_PRODUCTION_APP_ID = os.environ.get("CASHFREE_API_KEY", "")
CASHFREE_PRODUCTION_SECRET_KEY = os.environ.get("CASHFREE_SECRET_KEY", "")
CASHFREE_IS_SANDBOX = os.environ.get("CASHFREE_IS_SANDBOX", "false").lower() == "true"

# Cashfree API URLs
CASHFREE_PRODUCTION_API_URL = "https://api.cashfree.com/pg"
CASHFREE_SANDBOX_API_URL = "https://sandbox.cashfree.com/pg"

# ASR Contact Info - PRODUCTION VALUES (DO NOT OVERRIDE)
ASR_SUPPORT_EMAIL = "support@asrenterprises.in"
ASR_DISPLAY_PHONE = "9296389097"
ASR_WHATSAPP_API_PHONE = "8298389097"
ASR_BUSINESS_NAME = "ASR Enterprises"
# HARDCODED PRODUCTION DOMAIN - Critical for webhooks and return URLs
ASR_WEBSITE = "https://asrenterprises.in"

# Payment Types
PAYMENT_TYPES = {
    "advance": "Advance Payment",
    "site_visit": "Site Visit Payment",
    "booking": "Booking Token Amount",
    "consultation": "Consultation Fee",
    "installation": "Installation Payment",
    "custom": "Custom Payment"
}

# Payment Status
ORDER_STATUSES = {
    "ACTIVE": "active",
    "PAID": "paid",
    "EXPIRED": "expired",
    "CANCELLED": "cancelled",
    "PENDING": "pending",
    "FAILED": "failed"
}

# Lead stage mapping after payment
PAYMENT_STAGE_MAPPING = {
    "site_visit": "site_visit",
    "booking": "converted",
    "consultation": "contacted",
    "installation": "installation_scheduled",
    "advance": "converted"
}

# ==================== PYDANTIC MODELS ====================

class CreateOrderRequest(BaseModel):
    lead_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    amount: float = Field(..., gt=0)
    payment_type: str = Field(default="custom")
    purpose: str = Field(default="Solar Service Payment")
    notes: Optional[str] = None
    send_via_whatsapp: bool = Field(default=False)
    created_by_staff_id: Optional[str] = None
    return_url: Optional[str] = None
    origin_url: Optional[str] = None  # For cross-origin checkout (preview vs production)

class WebsiteOrderRequest(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    payment_type: str = Field(default="booking")
    amount: float = Field(..., gt=0)
    notes: Optional[str] = None
    origin_url: Optional[str] = None  # For cross-origin checkout (preview vs production)

# ==================== HELPER FUNCTIONS ====================

def clean_phone_number(phone: str) -> str:
    """Clean and format phone number to 10-digit format"""
    if not phone:
        return ""
    cleaned = re.sub(r'\D', '', str(phone))
    if cleaned.startswith("91") and len(cleaned) == 12:
        return cleaned[2:]  # Return 10 digits
    if len(cleaned) == 10:
        return cleaned
    return cleaned[-10:] if len(cleaned) > 10 else cleaned

def clean_phone_with_country(phone: str) -> str:
    """Clean phone number with country code for WhatsApp"""
    cleaned = clean_phone_number(phone)
    return f"91{cleaned}" if cleaned else ""

def generate_order_id() -> str:
    """Generate unique order ID for Cashfree"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"ASR{timestamp}{random_suffix}"

async def get_cashfree_config() -> Optional[Dict]:
    """
    Get Cashfree API settings - ALWAYS returns HARDCODED PRODUCTION credentials.
    This ensures the payment gateway ALWAYS works regardless of database/env settings.
    """
    # ALWAYS use hardcoded production credentials - NO OVERRIDES ALLOWED
    logger.info("Using HARDCODED PRODUCTION Cashfree credentials")
    
    return {
        "app_id": CASHFREE_PRODUCTION_APP_ID,
        "secret_key": CASHFREE_PRODUCTION_SECRET_KEY,
        "is_sandbox": CASHFREE_IS_SANDBOX,  # Always False (PRODUCTION)
        "webhook_secret": "",
        "is_active": True
    }

def get_cashfree_api_url(is_sandbox: bool = False) -> str:
    """Get Cashfree API base URL based on env-driven sandbox flag."""
    if CASHFREE_IS_SANDBOX or is_sandbox:
        return CASHFREE_SANDBOX_API_URL
    return CASHFREE_PRODUCTION_API_URL

def _require_cashfree_creds() -> None:
    """Fail fast with a clear 503 if Cashfree credentials aren't configured.

    All Cashfree API call sites must invoke this before building headers so
    we never silently send empty credentials. No values are ever logged.
    """
    if not CASHFREE_PRODUCTION_APP_ID or not CASHFREE_PRODUCTION_SECRET_KEY:
        logger.error(
            "Cashfree credentials missing: "
            "set CASHFREE_API_KEY and CASHFREE_SECRET_KEY in environment."
        )
        raise HTTPException(
            status_code=503,
            detail="Missing environment configuration: CASHFREE_API_KEY / CASHFREE_SECRET_KEY",
        )

def get_cashfree_headers(config: Dict) -> Dict:
    """Get headers for Cashfree API requests (env-only credentials)."""
    _require_cashfree_creds()
    return {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_PRODUCTION_APP_ID,
        "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
        "x-api-version": CASHFREE_API_VERSION,
    }

def verify_webhook_signature(timestamp: str, raw_body: str, signature: str, secret: str) -> bool:
    """Verify Cashfree webhook signature"""
    if not secret or not signature:
        return True  # Allow if no secret configured
    
    try:
        message = timestamp + raw_body
        expected = base64.b64encode(
            hmac.new(
                secret.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).digest()
        ).decode('utf-8')
        return hmac.compare_digest(signature, expected)
    except Exception as e:
        logger.error(f"Webhook signature verification error: {e}")
        return False

async def send_payment_whatsapp(phone: str, customer_name: str, amount: float, 
                                 payment_url: str, purpose: str, msg_type: str = "payment_request",
                                 order_id: str = ""):
    """
    Send payment notification via WhatsApp API.
    Uses Meta-approved template for outbound messages outside 24hr window.
    
    PRODUCTION-READY FEATURES:
    - Idempotency: Prevents duplicate messages for same order
    - Detailed logging: All attempts logged to database
    - Status tracking: Success/failure saved with error details
    - Template-based: Uses approved 'payment_sucess_confirmation' template
    
    Template Variables (as per user's approved template):
      - {{1}} = Order Status (e.g., "Confirmed")
      - {{2}} = Customer Name
      - {{3}} = Order ID
      - {{4}} = Amount
      - {{5}} = Payment Purpose
      - {{6}} = Payment Date
    """
    try:
        # IDEMPOTENCY CHECK: Don't send duplicate payment success messages
        if msg_type == "payment_success" and order_id:
            already_sent = await check_whatsapp_already_sent(order_id, "payment_success")
            if already_sent:
                logger.info(f"[WhatsApp] SKIP - Already sent for order {order_id} (idempotency)")
                return True  # Return True as message was already sent successfully before
        
        # Use the central env-merging helper so production WHATSAPP_ACCESS_TOKEN /
        # WHATSAPP_PHONE_NUMBER_ID env vars are honored even when the DB
        # whatsapp_settings doc is empty or stale. This was the actual cause of
        # webhook-confirmations silently returning whatsapp_sent=False.
        from routes.whatsapp import get_whatsapp_settings
        wa_settings = await get_whatsapp_settings()
        if not wa_settings:
            logger.warning(
                f"[WhatsApp] NOT CONFIGURED - no access_token from env or DB. "
                f"Set WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID. Order: {order_id}"
            )
            await log_whatsapp_attempt(order_id, phone, msg_type, "failed", "WhatsApp not configured (env+DB both empty)")
            return False

        access_token = wa_settings.get("access_token")
        phone_number_id = wa_settings.get("phone_number_id")
        cred_source = "env" if os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip() else "db"

        if not access_token or not phone_number_id:
            logger.warning(f"[WhatsApp] Incomplete credentials (source={cred_source}). Order: {order_id}")
            await log_whatsapp_attempt(order_id, phone, msg_type, "failed", "Missing phone_number_id or access_token")
            return False

        cleaned_phone = clean_phone_with_country(phone)
        if not cleaned_phone:
            logger.warning(f"[WhatsApp] Invalid phone: {phone}, Order: {order_id}")
            await log_whatsapp_attempt(order_id, phone, msg_type, "failed", "Invalid phone number")
            return False

        logger.info(
            f"[WhatsApp] TRIGGERED - order={order_id}, phone={cleaned_phone}, "
            f"type={msg_type}, cred_source={cred_source}"
        )
        
        # Get current date/time in IST
        from datetime import datetime, timezone, timedelta
        ist_offset = timedelta(hours=5, minutes=30)
        ist_now = datetime.now(timezone.utc) + ist_offset
        payment_date = ist_now.strftime("%d %B %Y, %I:%M %p IST")
        
        wa_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # PAYMENT SUCCESS - Use approved template
        if msg_type == "payment_success":
            # Template: payment_sucess_confirmation (note: typo in original template name)
            # 6 body parameters matching user's approved template
            
            template_payload = {
                "messaging_product": "whatsapp",
                "to": cleaned_phone,
                "type": "template",
                "template": {
                    "name": "payment_sucess_confirmation",  # User's approved template name
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": "Confirmed"},  # {{1}} Order Status
                                {"type": "text", "text": (customer_name[:60] if customer_name else "Customer")},  # {{2}} customer_name
                                {"type": "text", "text": (order_id or "N/A")},  # {{3}} order_id
                                {"type": "text", "text": f"{amount:,.0f}"},  # {{4}} amount
                                {"type": "text", "text": (purpose[:100] if purpose else "Solar Service Payment")},  # {{5}} payment_purpose
                                {"type": "text", "text": payment_date}  # {{6}} payment_date
                            ]
                        }
                    ]
                }
            }
            
            logger.info(f"[WhatsApp] Sending template 'payment_sucess_confirmation' to {cleaned_phone}")
            logger.info(f"[WhatsApp] Params - Order: {order_id}, Name: {customer_name}, Amount: ₹{amount:,.0f}")
            
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                response = await http_client.post(wa_url, json=template_payload, headers=headers)
                response_text = response.text
                
                if response.status_code in [200, 201]:
                    response_data = response.json()
                    wa_message_id = response_data.get("messages", [{}])[0].get("id", "")
                    
                    # Log successful message with full details
                    await db.whatsapp_messages.insert_one({
                        "id": str(uuid.uuid4()),
                        "wa_message_id": wa_message_id,
                        "phone": cleaned_phone,
                        "customer_name": customer_name,
                        "direction": "outgoing",
                        "type": "payment_success_template",
                        "template_name": "payment_sucess_confirmation",
                        "order_id": order_id,
                        "amount": amount,
                        "purpose": purpose,
                        "status": "sent",
                        "delivery_status": "submitted",
                        "meta_response": response_data,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    logger.info(f"[WhatsApp] ✅ SUCCESS - Order: {order_id}, Phone: {cleaned_phone}, MsgID: {wa_message_id}")
                    return True
                else:
                    # Parse error details
                    error_detail = "Unknown error"
                    error_code = None
                    try:
                        error_json = response.json()
                        error_obj = error_json.get("error", {})
                        error_detail = error_obj.get("message", response_text)
                        error_code = error_obj.get("code")
                    except Exception:
                        error_detail = response_text
                    
                    logger.error(f"[WhatsApp] ❌ FAILED - Order: {order_id}, HTTP: {response.status_code}, Code: {error_code}, Error: {error_detail}")
                    
                    # Log failed attempt with error details
                    await db.whatsapp_messages.insert_one({
                        "id": str(uuid.uuid4()),
                        "phone": cleaned_phone,
                        "customer_name": customer_name,
                        "direction": "outgoing",
                        "type": "payment_success_template",
                        "template_name": "payment_sucess_confirmation",
                        "order_id": order_id,
                        "amount": amount,
                        "status": "failed",
                        "error_code": error_code,
                        "error_message": error_detail,
                        "http_status": response.status_code,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    # Try fallback text message (only works within 24-hour conversation window)
                    logger.info("[WhatsApp] Trying fallback text message (requires 24hr window)...")
                    
                    fallback_message = f"""✅ *Payment Received Successfully*

Dear {customer_name},

Thank you for your payment to ASR ENTERPRISES.

Order ID: {order_id}
Amount Paid: ₹{amount:,.0f}
Purpose: {purpose}
Date: {payment_date}

Your payment has been received successfully.
Our team will contact you shortly for the next steps.

Support: {ASR_DISPLAY_PHONE}
Website: {ASR_WEBSITE}

Thank you for choosing ASR ENTERPRISES.
ASR ENTERPRISES | Patna"""
                    
                    text_payload = {
                        "messaging_product": "whatsapp",
                        "to": cleaned_phone,
                        "type": "text",
                        "text": {"body": fallback_message}
                    }
                    
                    response2 = await http_client.post(wa_url, json=text_payload, headers=headers)
                    if response2.status_code in [200, 201]:
                        resp2_data = response2.json()
                        fallback_msg_id = resp2_data.get("messages", [{}])[0].get("id", "")
                        
                        # Log fallback success
                        await db.whatsapp_messages.insert_one({
                            "id": str(uuid.uuid4()),
                            "wa_message_id": fallback_msg_id,
                            "phone": cleaned_phone,
                            "direction": "outgoing",
                            "type": "payment_success_fallback",
                            "order_id": order_id,
                            "content": fallback_message,
                            "status": "sent",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        
                        logger.info(f"[WhatsApp] ✅ Fallback text sent to {cleaned_phone}")
                        return True
                    else:
                        logger.error(f"[WhatsApp] ❌ Fallback also failed: {response2.text}")
                        return False
        
        # For non-payment-success types - try template first, fallback to text
        if msg_type in ["payment_request", "payment_reminder"]:
            # Use approved template: payment_link_asr
            # Template: "Hello {{1}}, Your payment..."
            # Variables: {{1}} = customer_name, {{2}} = amount, {{3}} = purpose, {{4}} = payment_url
            
            template_name = "payment_link_asr"  # User's approved template
            try:
                payment_template_payload = {
                    "messaging_product": "whatsapp",
                    "to": cleaned_phone,
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": "en"},
                        "components": [
                            {
                                "type": "body",
                                "parameters": [
                                    {"type": "text", "text": (customer_name[:60] if customer_name else "Customer")},  # {{1}}
                                    {"type": "text", "text": f"{amount:,.0f}"},  # {{2}}
                                    {"type": "text", "text": (purpose[:100] if purpose else "Payment")},  # {{3}}
                                    {"type": "text", "text": payment_url}  # {{4}}
                                ]
                            }
                        ]
                    }
                }
                
                async with httpx.AsyncClient(timeout=30.0) as http_client:
                    response = await http_client.post(wa_url, json=payment_template_payload, headers=headers)
                    
                    if response.status_code in [200, 201]:
                        response_data = response.json()
                        wa_message_id = response_data.get("messages", [{}])[0].get("id", "")
                        
                        await db.whatsapp_messages.insert_one({
                            "id": str(uuid.uuid4()),
                            "wa_message_id": wa_message_id,
                            "phone": cleaned_phone,
                            "direction": "outgoing",
                            "type": "payment_request_template",
                            "template_name": template_name,
                            "order_id": order_id,
                            "amount": amount,
                            "status": "sent",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        
                        logger.info(f"[WhatsApp] ✅ Payment request template sent to {cleaned_phone}")
                        return True
                    else:
                        # Template not approved or doesn't exist - fall back to text
                        logger.warning(f"[WhatsApp] Template '{template_name}' failed, using text fallback")
            except Exception as e:
                logger.warning(f"[WhatsApp] Template error: {e}, using text fallback")
            
            # Fallback: Text message (only works in 24hr window)
            message = f"""Dear {customer_name},

Your payment request from *{ASR_BUSINESS_NAME}* is ready.

*Purpose:* {purpose}
*Amount:* ₹{amount:,.0f}

Pay securely here:
{payment_url}

Need help? Call {ASR_DISPLAY_PHONE}

{ASR_BUSINESS_NAME}
{ASR_WEBSITE}"""
        
        elif msg_type == "payment_reminder":
            message = f"""Dear {customer_name},

Reminder: Your payment of ₹{amount:,.0f} for *{purpose}* is pending.

Pay here: {payment_url}

Questions? Call {ASR_DISPLAY_PHONE}

{ASR_BUSINESS_NAME}"""
        
        else:
            message = f"""Dear {customer_name},

Update from {ASR_BUSINESS_NAME}:
{purpose}

Amount: ₹{amount:,.0f}

Contact: {ASR_DISPLAY_PHONE}
{ASR_WEBSITE}"""
        
        payload = {
            "messaging_product": "whatsapp",
            "to": cleaned_phone,
            "type": "text",
            "text": {"body": message}
        }
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(wa_url, json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                response_data = response.json()
                wa_message_id = response_data.get("messages", [{}])[0].get("id", "")
                
                await db.whatsapp_messages.insert_one({
                    "id": str(uuid.uuid4()),
                    "wa_message_id": wa_message_id,
                    "phone": cleaned_phone,
                    "direction": "outgoing",
                    "type": msg_type,
                    "order_id": order_id,
                    "content": message,
                    "status": "sent",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                logger.info(f"[WhatsApp] ✅ {msg_type} sent to {cleaned_phone}")
                return True
            else:
                # Log detailed error
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", {}).get("message", response.text)
                except Exception:
                    pass
                
                logger.error(f"[WhatsApp] ❌ {msg_type} failed: HTTP {response.status_code} - {error_detail}")
                
                # Log failed message to database
                await db.whatsapp_messages.insert_one({
                    "id": str(uuid.uuid4()),
                    "phone": cleaned_phone,
                    "direction": "outgoing",
                    "type": msg_type,
                    "order_id": order_id,
                    "status": "failed",
                    "error_message": error_detail,
                    "http_status": response.status_code,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                return False
                
    except Exception as e:
        logger.error(f"[WhatsApp] Exception: {e}")
        import traceback
        logger.error(traceback.format_exc())
        await log_whatsapp_attempt(order_id, phone, msg_type, "error", str(e))
        return False


async def retry_failed_whatsapp_messages():
    """
    Retry sending failed payment-related WhatsApp messages.

    Looks for any whatsapp_messages row whose status is "failed" and has been
    retried fewer than 3 times. For each row we re-fire the original template
    via send_whatsapp_template. On success we record status="sent" + the new
    wa_message_id; on failure we bump retry_count so the next pass will try
    again (or stop, after 3 attempts).

    Backoff: we only retry rows whose `last_retry` is older than (2**retry_count)
    minutes, giving 1, 2, 4 minute spacing.
    """
    from routes.whatsapp import send_whatsapp_template  # local import — avoid cycle at import time
    now = datetime.now(timezone.utc)
    try:
        candidates = await db.whatsapp_messages.find({
            "status": "failed",
            "direction": "outgoing",
            "retry_count": {"$lt": 3},
        }).to_list(50)

        retried = 0
        for msg in candidates:
            retry_count = msg.get("retry_count", 0)
            # Exponential backoff between retries
            last_try_str = msg.get("last_retry") or msg.get("created_at")
            try:
                last_try = datetime.fromisoformat(last_try_str.replace("Z", "+00:00"))
                wait_minutes = 2 ** retry_count
                if (now - last_try).total_seconds() < wait_minutes * 60:
                    continue
            except Exception:
                pass  # if we can't parse, just retry

            template_name = msg.get("template_name")
            phone = msg.get("phone")
            variables = msg.get("variables") or []
            order_id = msg.get("order_id")

            if not template_name or not phone:
                # Row was logged by send_payment_whatsapp's text-fallback path
                # (no template captured). If it has an order_id, the cashfree
                # reconcile loop will re-run send_payment_confirmations from
                # scratch, so we leave retry_count alone here. We only hard
                # skip rows with neither template nor order context.
                if not order_id:
                    await db.whatsapp_messages.update_one(
                        {"id": msg.get("id")},
                        {"$set": {"retry_count": 3,
                                  "last_retry": now.isoformat(),
                                  "retry_skipped": "no template_name and no order_id"}},
                    )
                else:
                    await db.whatsapp_messages.update_one(
                        {"id": msg.get("id")},
                        {"$set": {"retry_deferred_to_reconcile": True,
                                  "last_retry_check": now.isoformat()}},
                    )
                continue

            logger.info(f"[WhatsApp-Retry] msg={msg.get('id')} attempt={retry_count + 1} template={template_name} phone=****{phone[-4:]}")
            try:
                result = await send_whatsapp_template(
                    phone=phone,
                    template_name=template_name,
                    variables=variables,
                    lead_id=msg.get("lead_id"),
                )
            except Exception as e:
                result = {"success": False, "error": str(e)}

            update = {
                "retry_count": retry_count + 1,
                "last_retry": now.isoformat(),
            }
            if result.get("success"):
                update["status"] = "sent"
                update["wa_message_id"] = result.get("wa_message_id")
                update["retried_to_success_at"] = now.isoformat()
                logger.info(f"[WhatsApp-Retry] ✅ recovered msg={msg.get('id')}")
            else:
                update["last_error"] = result.get("error")
                logger.warning(f"[WhatsApp-Retry] ✗ msg={msg.get('id')} still failing: {result.get('error')}")

            await db.whatsapp_messages.update_one({"id": msg.get("id")}, {"$set": update})
            retried += 1

        return retried
    except Exception as e:
        logger.error(f"[WhatsApp-Retry] loop error: {e}")
        return 0


async def whatsapp_retry_loop(interval_seconds: int = 60):
    """Background task: continuously retry failed WhatsApp messages."""
    import asyncio
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            count = await retry_failed_whatsapp_messages()
            if count:
                logger.info(f"[WhatsApp-Retry] processed {count} failed messages this pass")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[WhatsApp-Retry] loop error: {e}")


# ==================== ADMIN ALERT ====================
async def send_admin_payment_alert(order: Dict, amount: float):
    """Notify the business owner on every successful Cashfree payment.

    Uses the same Meta-approved template ('payment_sucess_confirmation') as the
    customer confirmation, but addressed to the owner's phone (ASR1001 record
    or env ADMIN_ALERT_PHONE override). Failures here NEVER block the webhook.
    """
    try:
        from routes.whatsapp import send_whatsapp_template
        admin_phone = os.environ.get("ADMIN_ALERT_PHONE")
        if not admin_phone:
            owner = await db.crm_staff_accounts.find_one({"staff_id": "ASR1001"}, {"_id": 0})
            admin_phone = (owner or {}).get("phone") or (owner or {}).get("mobile")
        if not admin_phone:
            logger.info("[AdminAlert] no admin phone configured — skipping")
            return False

        # Atomic claim — insert a sentinel row keyed on (order_id, type). If
        # the insert fails because the row already exists, another caller is
        # already handling (or has handled) this alert and we exit.
        order_id = order.get("order_id")
        claim_id = str(uuid.uuid4())
        try:
            await db.whatsapp_messages.insert_one({
                "id": claim_id,
                "order_id": order_id,
                "type": "admin_payment_alert",
                "status": "in_flight",
                "phone": admin_phone,
                "direction": "outgoing",
                "claimed_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            # Likely already exists / claimed by sibling caller — bail out.
            return True

        # Belt-and-braces: also check for a previously SENT alert (older rows
        # before atomic-claim was added).
        prior = await db.whatsapp_messages.find_one({
            "order_id": order_id,
            "type": "admin_payment_alert",
            "status": "sent",
        })
        if prior:
            await db.whatsapp_messages.delete_one({"id": claim_id})
            return True

        customer_name = order.get("customer_name", "Customer")
        result = await send_whatsapp_template(
            phone=admin_phone,
            template_name="payment_sucess_confirmation",
            variables=[f"OWNER ALERT — {customer_name}", order_id, str(int(amount))],
        )

        # Update the sentinel row with the outcome (sent or failed) so the
        # retry loop can find it and re-send while preserving idempotency.
        update = {
            "template_name": "payment_sucess_confirmation",
            "variables": [f"OWNER ALERT — {customer_name}", order_id, str(int(amount))],
            "result_at": datetime.now(timezone.utc).isoformat(),
        }
        if result.get("success"):
            update["status"] = "sent"
            update["wa_message_id"] = result.get("wa_message_id")
            logger.info(f"[AdminAlert] ✅ sent owner alert for order {order_id}")
        else:
            update["status"] = "failed"
            update["error"] = result.get("error")
            update["retry_count"] = 0
            logger.warning(f"[AdminAlert] ✗ owner alert failed for {order_id}: {result.get('error')}")
        await db.whatsapp_messages.update_one({"id": claim_id}, {"$set": update})
        return bool(result.get("success"))
    except Exception as e:
        logger.error(f"[AdminAlert] error: {e}")
        return False


async def send_payment_sms(phone: str, order_id: str, amount: float, purpose: str):
    """
    Send payment confirmation SMS via MSG91 Flow API.
    
    CURRENTLY DISABLED: DLT registration pending.
    Will be enabled after DLT approval.
    
    MSG91_AUTH_KEY is saved in .env for future use.
    """
    # Check if SMS is enabled (disabled by default until DLT is approved)
    sms_enabled = os.environ.get("SMS_ENABLED", "false").lower() == "true"
    
    if not sms_enabled:
        logger.info(f"[SMS] Disabled (DLT pending). Skipping SMS for order {order_id}")
        return False
    
    # SMS logic will be enabled after DLT registration
    logger.info(f"[SMS] Would send to {phone} for order {order_id} (currently disabled)")
    return False


async def check_whatsapp_already_sent(order_id: str, msg_type: str = "payment_success") -> bool:
    """
    Check if WhatsApp message was already sent for this order.
    Prevents duplicate messages (idempotency).
    """
    existing = await db.whatsapp_messages.find_one({
        "order_id": order_id,
        "type": {"$regex": f"^{msg_type}"},
        "status": "sent"
    })
    return existing is not None


async def log_whatsapp_attempt(order_id: str, phone: str, msg_type: str, status: str, error: str = None):
    """Helper to log WhatsApp send attempts for debugging"""
    try:
        await db.whatsapp_messages.insert_one({
            "id": str(uuid.uuid4()),
            "phone": phone,
            "direction": "outgoing",
            "type": msg_type,
            "order_id": order_id,
            "status": status,
            "error_message": error,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log WhatsApp attempt: {e}")


async def send_payment_confirmations(order: Dict, order_id: str, amount: float):
    """
    Send payment confirmation after successful Cashfree payment.
    
    PRODUCTION FLOW:
    1. WhatsApp template message (primary) - uses approved 'payment_sucess_confirmation' template
    2. SMS is DISABLED until DLT registration is complete
    
    Features:
    - Idempotency: Won't send duplicate messages for same order
    - Detailed logging: All attempts logged with status
    - Error handling: Failures don't crash the webhook
    """
    customer_phone = order.get("customer_phone", "")
    customer_name = order.get("customer_name", "Customer")
    purpose = order.get("purpose", "Payment")
    
    logger.info(f"[Confirmations] Starting for order {order_id}, phone: ****{customer_phone[-4:] if customer_phone else 'N/A'}")
    
    results = {
        "whatsapp_sent": False,
        "sms_sent": False,  # Always false - SMS disabled
        "sms_disabled": True,
        "order_id": order_id
    }
    
    # PRIMARY: Send WhatsApp confirmation using approved template
    try:
        results["whatsapp_sent"] = await send_payment_whatsapp(
            phone=customer_phone,
            customer_name=customer_name,
            amount=amount,
            payment_url="",  # Not needed for payment_success type
            purpose=purpose,
            msg_type="payment_success",
            order_id=order_id
        )
    except Exception as e:
        logger.error(f"[Confirmations] WhatsApp error for {order_id}: {e}")
        results["whatsapp_error"] = str(e)
    
    # SMS is disabled until DLT registration
    # This call will immediately return False and log the skip
    try:
        results["sms_sent"] = await send_payment_sms(
            phone=customer_phone,
            order_id=order_id,
            amount=amount,
            purpose=purpose
        )
    except Exception as e:
        logger.error(f"[Confirmations] SMS error for {order_id}: {e}")
    
    # Log final results
    status_emoji = "✅" if results["whatsapp_sent"] else "⚠️"
    logger.info(f"[Confirmations] {status_emoji} Order {order_id} - WhatsApp: {results['whatsapp_sent']}, SMS: disabled")
    
    return results


async def create_lead_from_payment(order_data: Dict) -> str:
    """Auto-create lead from payment if doesn't exist"""
    phone = clean_phone_number(order_data.get("customer_phone", ""))
    if not phone:
        return None
    
    # Check if lead exists
    existing = await db.crm_leads.find_one(
        {"phone": {"$regex": phone[-10:]}},
        {"_id": 0}
    )
    if existing:
        return existing.get("id")
    
    # Create new lead
    lead_id = str(uuid.uuid4())
    new_lead = {
        "id": lead_id,
        "name": order_data.get("customer_name", "Website Customer"),
        "phone": phone,
        "email": order_data.get("customer_email", ""),
        "address": order_data.get("address", ""),
        "district": order_data.get("district", ""),
        "stage": "new",
        "source": f"payment_{order_data.get('payment_type', 'website')}",
        "priority": "warm",
        "property_type": "residential",
        "is_new": True,
        "is_deleted": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": f"Created from payment: {order_data.get('purpose', 'Online Payment')}"
    }
    
    await db.crm_leads.insert_one(new_lead)
    logger.info(f"Auto-created lead {lead_id} from payment")
    return lead_id

async def update_lead_after_payment(lead_id: str, payment_type: str, amount: float, order_id: str):
    """Update lead status after successful payment"""
    if not lead_id:
        return
    
    new_stage = PAYMENT_STAGE_MAPPING.get(payment_type, "converted")
    
    update_data = {
        "payment_received": True,
        "payment_status": "Paid",
        "last_payment_amount": amount,
        "last_payment_date": datetime.now(timezone.utc).isoformat(),
        "last_payment_order_id": order_id,
        "stage": new_stage,
        "priority": "hot",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    # Create activity log
    await db.crm_activities.insert_one({
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "type": "payment_received",
        "description": f"Payment received: ₹{amount:,.0f} (Order: {order_id})",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# ==================== ORDERS API ENDPOINTS ====================

@router.get("/config")
async def get_payment_config():
    """Get Cashfree configuration status (no credentials are ever returned)."""
    configured = bool(CASHFREE_PRODUCTION_APP_ID and CASHFREE_PRODUCTION_SECRET_KEY)
    return {
        "configured": configured,
        "environment": "SANDBOX" if CASHFREE_IS_SANDBOX else "PRODUCTION",
        "api_mode": "orders_api",
        "is_sandbox": CASHFREE_IS_SANDBOX,
        "support_email": ASR_SUPPORT_EMAIL,
        "support_phone": ASR_DISPLAY_PHONE,
        "whatsapp_api_phone": ASR_WHATSAPP_API_PHONE,
        "business_name": ASR_BUSINESS_NAME,
        "payment_types": PAYMENT_TYPES,
        "message": "Credentials loaded from environment" if configured
                   else "Missing CASHFREE_API_KEY / CASHFREE_SECRET_KEY",
    }

async def _create_cashfree_order_impl(payload: CreateOrderRequest):
    """Shared Cashfree order creation logic.

    This is the un-decorated implementation so it can be called both from
    the HTTP endpoint (which is rate-limited) and from internal helpers
    like ``/website/create-order`` without double-counting against the
    payment rate-limit bucket.
    """
    try:
        _require_cashfree_creds()
        base_url = get_cashfree_api_url()

        headers = {
            "Content-Type": "application/json",
            "x-client-id": CASHFREE_PRODUCTION_APP_ID,
            "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
            "x-api-version": CASHFREE_API_VERSION,
        }

        logger.info("Creating Cashfree order")
        logger.info(f"API URL: {base_url}")
        
        # Generate order ID
        order_id = generate_order_id()
        
        # Clean phone
        customer_phone = clean_phone_number(payload.customer_phone)
        if not customer_phone or len(customer_phone) != 10:
            raise HTTPException(status_code=400, detail="Invalid phone number. Please provide 10-digit mobile number.")
        
        # SECURITY: Mask phone number in logs
        masked_phone = f"****{customer_phone[-4:]}"
        
        # Determine base website URL — open-redirect protection: only accept
        # `origin_url` whose host is in the configured allowlist. Anything else
        # silently falls back to the production site to prevent attackers from
        # crafting orders that redirect victims to an evil site post-payment.
        website_base = ASR_WEBSITE
        if payload.origin_url:
            try:
                from urllib.parse import urlparse
                import config as _cfg
                parsed = urlparse(payload.origin_url)
                host = (parsed.hostname or "").lower()
                # Normalize IDN/punycode so visually-similar Unicode hosts can't
                # bypass the allowlist (e.g. "аsrenterprises.in" with Cyrillic 'а').
                try:
                    host = host.encode("idna").decode("ascii")
                except Exception:
                    pass
                # Production: HTTPS only, strict host allowlist.
                # Dev/preview: allow http + *.replit.dev so the workflow preview works.
                allowed_scheme = ("https",) if _cfg.IS_PRODUCTION else ("http", "https")
                allowed = (
                    host in _cfg.ALLOWED_REDIRECT_HOSTS
                    or (not _cfg.IS_PRODUCTION and host.endswith(".replit.dev"))
                )
                if parsed.scheme in allowed_scheme and host and allowed:
                    # Rebuild from sanitized parts only — drop userinfo/port/etc.
                    website_base = f"{parsed.scheme}://{host}"
                else:
                    logger.warning(
                        f"Rejected origin_url host '{host}' scheme='{parsed.scheme}' "
                        f"— not in allowlist (production={_cfg.IS_PRODUCTION}); using ASR_WEBSITE."
                    )
            except Exception as _e:
                logger.warning(f"Bad origin_url ({_e}); using ASR_WEBSITE.")
        logger.info(f"Using website base URL: {website_base}")
        
        # Determine return URL
        return_url = payload.return_url or f"{website_base}/payment/status?order_id={order_id}"
        
        # Create Cashfree Order payload
        order_payload = {
            "order_id": order_id,
            "order_amount": round(payload.amount, 2),
            "order_currency": "INR",
            "customer_details": {
                "customer_id": f"CUST_{customer_phone}",
                "customer_phone": customer_phone,
                "customer_name": payload.customer_name[:100] if payload.customer_name else "Customer"
            },
            "order_meta": {
                "return_url": return_url,
                "notify_url": f"{ASR_WEBSITE}/api/cashfree/webhook"  # Webhook always goes to production
            },
            "order_note": f"{payload.purpose[:100]} - {payload.payment_type}"
        }
        
        # Add email if provided
        if payload.customer_email:
            order_payload["customer_details"]["customer_email"] = payload.customer_email
        
        # SECURITY: Log order creation with masked customer data
        logger.info(f"Creating Cashfree order: {order_id}, amount: {payload.amount}, phone: {masked_phone}")
        logger.info(f"Cashfree API URL: {base_url}/orders")
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                f"{base_url}/orders",
                json=order_payload,
                headers=headers
            )
            
            response_data = response.json() if response.text else {}
            logger.info(f"Cashfree API response status: {response.status_code}")
            logger.info(f"Cashfree API response: {response_data}")
            
            if response.status_code not in [200, 201]:
                logger.error(f"Cashfree order creation failed: {response_data}")
                error_msg = response_data.get("message", "Failed to create order")
                raise HTTPException(status_code=response.status_code, detail=error_msg)
            
            # Extract payment session URL - CRITICAL: This must be present
            payment_session_id = response_data.get("payment_session_id", "")
            
            # CRITICAL: Clean the payment_session_id - remove any corruption
            # Some old code was appending "paymentpayment" to the end
            if payment_session_id:
                # Remove known corruption patterns
                while payment_session_id.endswith("payment"):
                    payment_session_id = payment_session_id[:-7]  # Remove "payment" (7 chars)
                    logger.warning("Cleaned corrupted payment_session_id - removed 'payment' suffix")
                
                # Trim to valid Cashfree session ID length (typically 132 chars)
                if len(payment_session_id) > 140:
                    logger.warning(f"payment_session_id too long ({len(payment_session_id)} chars), may be corrupted")
                    # Keep only first 132 chars if it starts with session_
                    if payment_session_id.startswith("session_"):
                        payment_session_id = payment_session_id[:132]
                        logger.info(f"Trimmed to 132 chars: {payment_session_id[:50]}...")
            
            cf_order_id = response_data.get("cf_order_id", "")
            order_status = response_data.get("order_status", "ACTIVE")
            
            # CRITICAL VALIDATION: Ensure payment_session_id is present
            if not payment_session_id:
                logger.error(f"CRITICAL: Cashfree did not return payment_session_id! Response: {response_data}")
                raise HTTPException(status_code=500, detail="Payment session creation failed - no session ID returned from Cashfree")
            
            logger.info(f"Payment session ID received: {payment_session_id[:50]}...")
            
            # ALWAYS use production payment URL
            direct_payment_url = f"https://payments.cashfree.com/order/#/{payment_session_id}"
            
            # Our custom checkout page - uses JS SDK which works without S2S
            # Use website_base for same-origin checkout
            checkout_url = f"{website_base}/payment/checkout?session_id={payment_session_id}&order_id={order_id}"
            
            # WORKAROUND: Also create a direct backend checkout URL that bypasses frontend
            # This is more reliable as it serves HTML directly from the backend
            direct_backend_checkout = f"{ASR_WEBSITE}/api/cashfree/pay/{order_id}"
            
            logger.info(f"Generated checkout URL: {checkout_url[:100]}...")
            logger.info(f"Direct backend checkout: {direct_backend_checkout}")
            
            # Use DIRECT BACKEND CHECKOUT as primary (bypasses frontend issues)
            payment_url = direct_backend_checkout
            
            # Store order in database
            order_record = {
                "id": str(uuid.uuid4()),
                "order_id": order_id,
                "cf_order_id": cf_order_id,
                "payment_session_id": payment_session_id,
                "payment_url": payment_url,
                "direct_cashfree_url": direct_payment_url,  # Backup - requires S2S
                "lead_id": payload.lead_id,
                "customer_name": payload.customer_name,
                "customer_phone": customer_phone,
                "customer_email": payload.customer_email,
                "amount": payload.amount,
                "payment_type": payload.payment_type,
                "purpose": payload.purpose,
                "notes": payload.notes,
                "status": "active",
                "source": "crm" if payload.lead_id else "website",
                "created_by": payload.created_by_staff_id,
                "return_url": return_url,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "cashfree_response": response_data
            }
            
            await db.cashfree_orders.insert_one(order_record)
            
            # Also store in payments collection for unified view
            await db.payments.insert_one({
                **order_record,
                "order_type": "hosted_checkout"
            })
            
            # Send via WhatsApp if requested
            whatsapp_sent = False
            if payload.send_via_whatsapp:
                whatsapp_sent = await send_payment_whatsapp(
                    customer_phone,
                    payload.customer_name,
                    payload.amount,
                    payment_url,
                    payload.purpose,
                    "payment_request"
                )
                
                if whatsapp_sent:
                    await db.cashfree_orders.update_one(
                        {"order_id": order_id},
                        {"$set": {"whatsapp_sent": True, "whatsapp_sent_at": datetime.now(timezone.utc).isoformat()}}
                    )
            
            logger.info(f"Cashfree order created successfully: {order_id}")
            logger.info("=== FINAL RESPONSE TO FRONTEND ===")
            logger.info(f"payment_session_id: {payment_session_id}")
            logger.info(f"payment_session_id length: {len(payment_session_id)}")
            logger.info(f"payment_url: {payment_url}")
            logger.info(f"checkout_url: {checkout_url}")
            
            # Build the final response
            final_response = {
                "success": True,
                "order_id": order_id,
                "cf_order_id": cf_order_id,
                "payment_url": payment_url,  # Our custom checkout page URL
                "checkout_url": checkout_url,  # Our custom checkout page
                "payment_session_id": payment_session_id,  # CRITICAL: This must be the raw session ID
                "payment_link": payment_url,  # Alias for compatibility
                "amount": payload.amount,
                "status": order_status,
                "whatsapp_sent": whatsapp_sent,
                "return_url": return_url,
                "cashfree_order": response_data,
                "message": "Order created successfully. Redirect customer to payment_url"
            }
            
            logger.info("=== RETURNING RESPONSE ===")
            logger.info(f"Response keys: {list(final_response.keys())}")
            logger.info(f"payment_session_id in response: {final_response.get('payment_session_id', 'MISSING')[:60]}...")
            
            return final_response
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Cashfree order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@router.post("/create-order")
@limiter.limit(RATE_LIMIT_PAYMENT)
async def create_cashfree_order(request: Request, payload: CreateOrderRequest):
    """Create a new Cashfree order for hosted checkout (env-only credentials)."""
    return await _create_cashfree_order_impl(payload)


@router.post("/website/create-order")
@limiter.limit(RATE_LIMIT_PAYMENT)
async def create_website_order(request: Request, payload: WebsiteOrderRequest):
    """Create order from website - auto-creates lead - USES HARDCODED PRODUCTION CREDENTIALS"""
    # Always active - using hardcoded credentials
    logger.info("Website order creation using HARDCODED PRODUCTION credentials")
    
    try:
        # Create/find lead
        lead_id = await create_lead_from_payment({
            "customer_name": payload.customer_name,
            "customer_phone": payload.customer_phone,
            "customer_email": payload.customer_email,
            "address": payload.address,
            "district": payload.district,
            "payment_type": payload.payment_type
        })
        
        # Get purpose label
        purpose = PAYMENT_TYPES.get(payload.payment_type, "Solar Service Payment")
        if payload.notes:
            purpose = f"{purpose} - {payload.notes}"
        
        # Create order
        order_request = CreateOrderRequest(
            lead_id=lead_id,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            customer_email=payload.customer_email,
            amount=payload.amount,
            payment_type=payload.payment_type,
            purpose=purpose,
            notes=payload.notes,
            send_via_whatsapp=False,  # Will be sent via webhook on success
            origin_url=payload.origin_url  # Pass through for same-origin checkout
        )
        
        result = await _create_cashfree_order_impl(order_request)
        result["lead_id"] = lead_id
        result["support_phone"] = ASR_DISPLAY_PHONE
        result["support_email"] = ASR_SUPPORT_EMAIL
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Website order creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate payment")

@router.get("/order/{order_id}")
async def get_order_status(order_id: str):
    """Get order status from local DB and optionally refresh from Cashfree"""
    # Get from local DB
    order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {
        "order_id": order_id,
        "status": order.get("status"),
        "amount": order.get("amount"),
        "customer_name": order.get("customer_name"),
        "payment_type": order.get("payment_type"),
        "purpose": order.get("purpose"),
        "paid": order.get("status") == "paid",
        "paid_at": order.get("paid_at"),
        "payment_url": order.get("payment_url"),
        "payment_session_id": order.get("payment_session_id"),  # IMPORTANT: Include session ID
        "created_at": order.get("created_at")
    }

@router.get("/order/{order_id}/refresh")
async def refresh_order_status(order_id: str):
    """Refresh order status from Cashfree API (env-only credentials)."""
    try:
        _require_cashfree_creds()
        base_url = get_cashfree_api_url()
        headers = {
            "Content-Type": "application/json",
            "x-client-id": CASHFREE_PRODUCTION_APP_ID,
            "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
            "x-api-version": CASHFREE_API_VERSION,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(
                f"{base_url}/orders/{order_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch order")
            
            order_data = response.json()
            order_status = order_data.get("order_status", "").upper()
            
            # Map Cashfree status to our status
            status_map = {
                "ACTIVE": "active",
                "PAID": "paid",
                "EXPIRED": "expired",
                "TERMINATED": "cancelled"
            }
            new_status = status_map.get(order_status, "pending")
            
            # Update local record
            update_data = {
                "status": new_status,
                "cashfree_status": order_data,
                "last_checked_at": datetime.now(timezone.utc).isoformat()
            }
            
            # If paid, extract payment details
            if new_status == "paid":
                update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
                
                # Get payment details
                payments_response = await http_client.get(
                    f"{base_url}/orders/{order_id}/payments",
                    headers=headers
                )
                if payments_response.status_code == 200:
                    payments_data = payments_response.json()
                    if payments_data and len(payments_data) > 0:
                        payment = payments_data[0]
                        update_data["cf_payment_id"] = payment.get("cf_payment_id")
                        update_data["payment_method"] = payment.get("payment_method", {})
                
                # Update lead
                order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
                if order and order.get("lead_id"):
                    await update_lead_after_payment(
                        order["lead_id"],
                        order.get("payment_type", "custom"),
                        order.get("amount", 0),
                        order_id
                    )
            
            await db.cashfree_orders.update_one(
                {"order_id": order_id},
                {"$set": update_data}
            )
            await db.payments.update_one(
                {"order_id": order_id},
                {"$set": update_data}
            )
            
            return {
                "order_id": order_id,
                "status": new_status,
                "paid": new_status == "paid",
                "cashfree_status": order_status,
                "updated": True
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/order/{order_id}/resend-whatsapp")
async def resend_payment_whatsapp(order_id: str):
    """Resend payment link via WhatsApp"""
    order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Payment already completed")
    
    if order.get("status") == "expired":
        raise HTTPException(status_code=400, detail="Payment link expired. Please create a new order.")
    
    sent = await send_payment_whatsapp(
        order["customer_phone"],
        order["customer_name"],
        order["amount"],
        order["payment_url"],
        order["purpose"],
        "payment_reminder"
    )
    
    if sent:
        await db.cashfree_orders.update_one(
            {"order_id": order_id},
            {"$set": {"last_whatsapp_sent_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {
        "success": sent,
        "message": "Payment link sent via WhatsApp" if sent else "Failed to send WhatsApp"
    }

# ==================== WEBHOOK HANDLER ====================

# ==================== PAYMENT RECONCILIATION ====================
# Reusable helpers so that BOTH the webhook and the periodic/manual
# reconciliation flow run identical post-payment logic. This guarantees
# every successful payment — whether observed via webhook or by polling
# Cashfree directly — propagates to: cashfree_orders, payments,
# solar_service_bookings, lead stage, and a WhatsApp confirmation.

async def _mark_order_paid(
    order: Dict,
    payment_data: Dict,
    source: str = "webhook",
    is_api_verified: bool = False,
) -> Dict:
    """Idempotently mark a cashfree order as paid and run all side effects.

    Concurrency-safe: uses an atomic conditional update (status != "paid") to
    win the transition race between the webhook and the reconciliation loop.
    Side effects (CRM update, lead, service booking, WhatsApp confirmation)
    run ONLY for the caller that wins the transition. A losing caller returns
    'already_paid' immediately.

    Args:
        order:            The DB document from cashfree_orders (must have order_id).
        payment_data:     Dict with cf_payment_id, payment_amount, payment_time,
                          payment_method, and (optional) full payload under "payment_details".
        source:           "webhook", "webhook_api_verified", or "sync" — recorded for audit.
        is_api_verified:  True when payment was confirmed via Cashfree API call (not just
                          webhook payload). Sets `is_verified=True` in the stored document,
                          which is the authoritative flag used by the CRM payments view.
    Returns dict with processing summary.
    """
    order_id = order["order_id"]
    received_at = datetime.now(timezone.utc).isoformat()

    if order.get("status") == "paid":
        return {"processed": True, "message": "Already paid", "order_id": order_id}

    cf_payment_id = payment_data.get("cf_payment_id", "")
    payment_amount = payment_data.get("payment_amount", order.get("amount", 0))
    payment_time = payment_data.get("payment_time", received_at)
    payment_method = payment_data.get("payment_method", {})
    payment_details = payment_data.get("payment_details", payment_data)

    update_data = {
        "status": "paid",
        "paid_at": payment_time,
        "cf_payment_id": cf_payment_id,
        "payment_amount_received": payment_amount,
        "payment_method": payment_method,
        "payment_details": payment_details,
        "webhook_updated_at": received_at,
        "marked_paid_via": source,
        # is_verified = True only when independently confirmed via Cashfree API.
        # The CRM payments view uses this flag to show only authoritative records.
        "is_verified": is_api_verified,
        "is_verified_at": received_at if is_api_verified else None,
    }

    # ATOMIC: only one caller transitions the order from non-paid to paid.
    # If status is already "paid", modified_count == 0 and we bail out without
    # firing side effects again — this prevents double-WhatsApp / double-booking
    # when a webhook and the reconcile loop arrive simultaneously.
    cf_result = await db.cashfree_orders.update_one(
        {"order_id": order_id, "status": {"$ne": "paid"}},
        {"$set": update_data},
    )
    if getattr(cf_result, "modified_count", 0) == 0:
        # Someone else won the race; do not duplicate side effects.
        logger.info(f"[{source}] Order {order_id} already marked paid by another caller; skipping side effects.")
        return {"processed": True, "message": "Already paid (race avoided)", "order_id": order_id}
    # Use upsert so the CRM "Cashfree Payments" list ALWAYS has a row,
    # even for orders that pre-date the dual-write code path.
    await db.payments.update_one(
        {"order_id": order_id},
        {"$set": {**order, **update_data, "order_type": order.get("order_type", "hosted_checkout")}},
        upsert=True,
    )

    # Update lead stage if linked
    if order.get("lead_id"):
        try:
            await update_lead_after_payment(
                order["lead_id"],
                order.get("payment_type", "custom"),
                payment_amount,
                order_id,
            )
        except Exception as e:
            logger.error(f"[{source}] update_lead_after_payment failed for {order_id}: {e}")

    # Sync to solar_service_bookings if this is a service/booking payment
    ptype = (order.get("payment_type", "") or "").lower()
    notes_text = order.get("notes", "") or order.get("purpose", "") or ""
    is_service_booking = ptype in ["booking", "service", "book_solar_service", "site_visit"] or any(
        kw in notes_text.lower()
        for kw in ["service", "booking", "site visit", "solar service", "site_visit"]
    )
    service_booking_synced = False
    if is_service_booking:
        try:
            booking_number = f"SB{order_id[-8:].upper()}"
            svc_doc = {
                "id": order_id,
                "booking_number": booking_number,
                "cashfree_order_id": order_id,
                "customer_name": order.get("customer_name", ""),
                "customer_phone": order.get("customer_phone", ""),
                "customer_email": order.get("customer_email", ""),
                "address": order.get("address", order.get("notes", "")),
                "price": float(payment_amount),
                "payment_status": "paid",
                "status": "confirmed",
                "booking_type": "site_visit" if ptype == "site_visit" else "book_solar_service",
                "notes": notes_text,
                "cashfree_payment_id": cf_payment_id,
                "paid_at": payment_time,
                "created_at": order.get("created_at", received_at),
                "updated_at": received_at,
                "source": f"cashfree_{source}",
            }
            await db.solar_service_bookings.update_one(
                {"cashfree_order_id": order_id},
                {"$set": svc_doc},
                upsert=True,
            )
            service_booking_synced = True
            logger.info(f"[{source}] Service booking synced to CRM: {booking_number}")
        except Exception as svc_err:
            logger.error(f"[{source}] Service booking sync failed for {order_id}: {svc_err}")

    # WhatsApp + SMS confirmations (also fires on sync, so missed-webhook
    # customers still receive their receipt the moment we reconcile).
    confirmations = {}
    try:
        # Re-read latest order so confirmations include paid status
        fresh = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
        confirmations = await send_payment_confirmations(
            order=fresh, order_id=order_id, amount=payment_amount
        )
    except Exception as e:
        logger.error(f"[{source}] send_payment_confirmations failed for {order_id}: {e}")
        confirmations = {"error": str(e)}

    # Owner alert (non-blocking, idempotent) — see send_admin_payment_alert.
    try:
        await send_admin_payment_alert(order, payment_amount)
    except Exception as e:
        logger.error(f"[{source}] send_admin_payment_alert failed for {order_id}: {e}")

    # Persist confirmation outcome on the order so the webhook handler can
    # detect "paid but WhatsApp never reached the customer" on a duplicate
    # success-webhook arrival and re-attempt the send.
    try:
        await db.cashfree_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "whatsapp_sent": bool(confirmations.get("whatsapp_sent")),
                "whatsapp_last_error": confirmations.get("error"),
                "confirmations_attempted_at": received_at,
            }},
        )
    except Exception as persist_err:
        logger.warning(f"[{source}] Could not persist confirmation outcome for {order_id}: {persist_err}")

    logger.info(
        f"Payment SUCCESS via {source}: order={order_id}, amount={payment_amount}, "
        f"service_booking={service_booking_synced}, confirmations={confirmations}"
    )
    return {
        "processed": True,
        "message": f"Payment marked as PAID via {source}",
        "amount": payment_amount,
        "confirmations": confirmations,
        "service_booking_synced": service_booking_synced,
    }


async def _sync_order_with_cashfree(order_id: str) -> Dict:
    """Poll Cashfree for a single order's true status and reconcile our DB.

    Returns a dict with the action taken: synced, skipped, not_found, error.
    """
    order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        return {"order_id": order_id, "action": "not_found"}
    if order.get("status") == "paid":
        return {"order_id": order_id, "action": "already_paid"}

    if not CASHFREE_PRODUCTION_APP_ID or not CASHFREE_PRODUCTION_SECRET_KEY:
        return {"order_id": order_id, "action": "error", "error": "Cashfree env not configured"}

    base_url = get_cashfree_api_url()
    headers = {
        "x-client-id": CASHFREE_PRODUCTION_APP_ID,
        "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            # 1. Order status
            r = await http_client.get(f"{base_url}/orders/{order_id}", headers=headers)
            if r.status_code == 404:
                return {"order_id": order_id, "action": "not_found_at_cashfree"}
            if r.status_code != 200:
                return {
                    "order_id": order_id,
                    "action": "error",
                    "error": f"Cashfree GET /orders {r.status_code}: {r.text[:200]}",
                }
            cf_order = r.json()
            cf_status = (cf_order.get("order_status") or "").upper()

            if cf_status == "PAID":
                # 2. Fetch payment details
                pr = await http_client.get(f"{base_url}/orders/{order_id}/payments", headers=headers)
                successful_payment = {}
                if pr.status_code == 200:
                    payments_list = pr.json() if isinstance(pr.json(), list) else []
                    for p in payments_list:
                        if (p.get("payment_status") or "").upper() == "SUCCESS":
                            successful_payment = p
                            break
                payment_data = {
                    "cf_payment_id": str(successful_payment.get("cf_payment_id", "")),
                    "payment_amount": successful_payment.get("payment_amount")
                    or cf_order.get("order_amount")
                    or order.get("amount", 0),
                    "payment_time": successful_payment.get("payment_completion_time")
                    or datetime.now(timezone.utc).isoformat(),
                    "payment_method": successful_payment.get("payment_method", {}),
                    "payment_details": {"order": cf_order, "payment": successful_payment},
                }
                result = await _mark_order_paid(
                    order, payment_data, source="sync", is_api_verified=True
                )
                return {"order_id": order_id, "action": "synced_to_paid", "detail": result}

            if cf_status in ("EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"):
                await db.cashfree_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "status": "expired" if cf_status == "EXPIRED" else "cancelled",
                        "webhook_updated_at": datetime.now(timezone.utc).isoformat(),
                        "cashfree_order_status": cf_status,
                    }},
                )
                return {"order_id": order_id, "action": f"synced_to_{cf_status.lower()}"}

            # ACTIVE / PENDING — leave as-is
            return {"order_id": order_id, "action": "no_change", "cashfree_status": cf_status}
    except Exception as e:
        logger.error(f"[sync] Failed to sync order {order_id}: {e}")
        return {"order_id": order_id, "action": "error", "error": str(e)}


async def _sync_pending_orders(max_orders: int = 200) -> Dict:
    """Reconcile all not-yet-paid orders against Cashfree. Self-healing."""
    cursor = db.cashfree_orders.find(
        {"status": {"$in": ["active", "pending", "ACTIVE", "PENDING", None]}},
        {"_id": 0, "order_id": 1, "created_at": 1},
    ).sort("created_at", -1).limit(max_orders)
    orders = await cursor.to_list(length=max_orders)
    results = {"checked": 0, "marked_paid": 0, "expired": 0, "errors": 0, "details": []}
    for o in orders:
        oid = o.get("order_id")
        if not oid:
            continue
        results["checked"] += 1
        r = await _sync_order_with_cashfree(oid)
        if r.get("action") == "synced_to_paid":
            results["marked_paid"] += 1
        elif r.get("action", "").startswith("synced_to_"):
            results["expired"] += 1
        elif r.get("action") == "error":
            results["errors"] += 1
        results["details"].append(r)
    return results


def _require_admin_token(request: Request) -> None:
    """Gate sensitive reconciliation endpoints behind an admin shared secret.

    The expected token is read from `ADMIN_API_TOKEN` (preferred) or, as a
    backwards-compatible fallback, `CASHFREE_WEBHOOK_SECRET` (which is already
    a server-only secret on this deployment). Header name: `x-admin-token`.

    If NEITHER secret is configured, we accept the request and log a warning
    so first-time setups still work, but production deployments MUST set one.
    """
    expected = (
        os.environ.get("ADMIN_API_TOKEN", "").strip()
        or os.environ.get("CASHFREE_WEBHOOK_SECRET", "").strip()
    )
    if not expected:
        logger.warning(
            "Cashfree sync endpoint called with no ADMIN_API_TOKEN configured — "
            "request allowed but production deployments should set this env var."
        )
        return
    provided = (request.headers.get("x-admin-token") or "").strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Admin token required")


@router.post("/sync/{order_id}")
@limiter.limit(RATE_LIMIT_SENSITIVE)
async def sync_single_order(request: Request, order_id: str):
    """Manually reconcile a single order with Cashfree.

    Auth: requires `x-admin-token` header matching `ADMIN_API_TOKEN` (or the
    fallback `CASHFREE_WEBHOOK_SECRET`). Use to retry a payment that succeeded
    on Cashfree but never updated in CRM (e.g. webhook was missed/blocked).
    Idempotent — running it on an already-paid order is a no-op."""
    _require_admin_token(request)
    return await _sync_order_with_cashfree(order_id)


@router.post("/sync-orders")
@limiter.limit(RATE_LIMIT_SENSITIVE)
async def sync_all_orders(request: Request, max_orders: int = Query(200, ge=1, le=1000)):
    """Reconcile all active/pending orders with Cashfree.

    Auth: same as `/sync/{order_id}`. Backfills CRM Cashfree Payments view,
    Service Price/Confirmed Orders, and fires any missed WhatsApp
    confirmations. Safe to run repeatedly."""
    _require_admin_token(request)
    return await _sync_pending_orders(max_orders=max_orders)


@router.post("/orders/backfill-verification")
@limiter.limit(RATE_LIMIT_SENSITIVE)
async def backfill_verification(request: Request, dry_run: bool = Query(False)):
    """One-time admin endpoint: retroactively verify all historical paid orders.

    Iterates every order whose status is 'paid' but whose `is_verified` flag is
    missing or False, calls the Cashfree ``GET /orders/{id}/payments`` API for
    each one, and marks it verified if the API confirms SUCCESS.

    Orders whose API call fails or returns a non-SUCCESS status are left with
    `is_verified=False` — they remain hidden from the CRM by default.

    Pass ``dry_run=true`` to preview what would be changed without writing.
    Auth: requires admin token header.
    """
    _require_admin_token(request)

    if not CASHFREE_PRODUCTION_APP_ID or not CASHFREE_PRODUCTION_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Cashfree credentials not configured — cannot verify"
        )

    # Find all paid orders not yet verified (or is_verified missing)
    candidates = await db.cashfree_orders.find(
        {
            "status": {"$in": ["paid", "success", "successful", "captured",
                               "completed", "settled", "confirmed"]},
            "is_deleted": {"$ne": True},
            "$or": [{"is_verified": {"$exists": False}}, {"is_verified": False}],
        },
        {"_id": 0, "order_id": 1, "amount": 1, "customer_name": 1}
    ).to_list(5000)

    results = {"total": len(candidates), "verified": 0, "failed": 0, "dry_run": dry_run, "details": []}

    import httpx as _httpx

    for order in candidates:
        oid = order.get("order_id")
        if not oid:
            continue
        try:
            async with _httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://api.cashfree.com/pg/orders/{oid}/payments",
                    headers={
                        "x-api-version": "2023-08-01",
                        "x-client-id": CASHFREE_PRODUCTION_APP_ID,
                        "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
                    }
                )
            if resp.status_code != 200:
                results["failed"] += 1
                results["details"].append({"order_id": oid, "result": "api_error", "http": resp.status_code})
                continue

            payments = resp.json()
            if not isinstance(payments, list):
                payments = [payments]

            success_pay = next(
                (p for p in payments if str(p.get("payment_status", "")).upper() == "SUCCESS"),
                None
            )
            if success_pay and float(success_pay.get("payment_amount", 0)) > 10:
                verified_at = (
                    success_pay.get("payment_completion_time")
                    or success_pay.get("payment_time")
                    or datetime.now(timezone.utc).isoformat()
                )
                if not dry_run:
                    await db.cashfree_orders.update_one(
                        {"order_id": oid},
                        {"$set": {"is_verified": True, "is_verified_at": verified_at}}
                    )
                results["verified"] += 1
                results["details"].append({"order_id": oid, "result": "verified", "amount": success_pay.get("payment_amount")})
            else:
                results["failed"] += 1
                results["details"].append({"order_id": oid, "result": "not_confirmed_by_api"})
        except Exception as e:
            results["failed"] += 1
            results["details"].append({"order_id": oid, "result": "exception", "error": str(e)})

    logger.info(
        f"[backfill-verification] dry_run={dry_run} total={results['total']} "
        f"verified={results['verified']} failed={results['failed']}"
    )
    return results


async def cashfree_reconcile_loop(interval_seconds: int = 300):
    """Background task: every N seconds, reconcile pending orders with Cashfree.

    This is the safety net that ensures payments stay in sync even if a webhook
    delivery is dropped, signature-rejected, or never sent at all."""
    import asyncio as _asyncio
    while True:
        try:
            await _asyncio.sleep(interval_seconds)
            if not CASHFREE_PRODUCTION_APP_ID or not CASHFREE_PRODUCTION_SECRET_KEY:
                continue
            res = await _sync_pending_orders(max_orders=100)
            if res["marked_paid"] or res["expired"] or res["errors"]:
                logger.info(
                    f"[cashfree-reconcile] checked={res['checked']} "
                    f"marked_paid={res['marked_paid']} expired={res['expired']} errors={res['errors']}"
                )
        except Exception as e:
            logger.error(f"[cashfree-reconcile] loop error: {e}")


@router.post("/webhook")
async def cashfree_orders_webhook(request: Request):
    """
    Production Cashfree Orders Webhook Handler
    Handles: PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_USER_DROPPED
    """
    webhook_id = str(uuid.uuid4())
    received_at = datetime.now(timezone.utc).isoformat()
    
    try:
        # Get raw body
        body = await request.body()
        raw_body = body.decode('utf-8')
        
        # Get signature headers
        signature = request.headers.get("x-webhook-signature", "")
        timestamp = request.headers.get("x-webhook-timestamp", "")
        
        # Webhook secret comes from environment via central config module.
        webhook_secret = os.environ.get("CASHFREE_WEBHOOK_SECRET", "").strip()

        # Verify signature. If a secret IS configured, signature MUST match
        # (anti-spoofing). If no secret is configured we skip verification
        # so dev / first-time setup still works, with a loud warning.
        signature_valid = False
        if webhook_secret:
            if not signature or not timestamp:
                logger.warning("Cashfree webhook missing signature/timestamp headers")
                await db.cashfree_webhook_logs.insert_one({
                    "id": webhook_id,
                    "status": "missing_signature_headers",
                    "received_at": received_at,
                    "ip": request.client.host if request.client else "unknown",
                })
                raise HTTPException(status_code=401, detail="Missing webhook signature")

            signature_valid = verify_webhook_signature(timestamp, raw_body, signature, webhook_secret)
            if not signature_valid:
                logger.warning(
                    "Invalid Cashfree webhook signature from %s",
                    request.client.host if request.client else "unknown",
                )
                await db.cashfree_webhook_logs.insert_one({
                    "id": webhook_id,
                    "status": "signature_failed",
                    "received_at": received_at,
                    "ip": request.client.host if request.client else "unknown",
                })
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
        else:
            logger.warning(
                "CASHFREE_WEBHOOK_SECRET is not set — webhook signature verification is DISABLED. "
                "Set this env var in production to reject spoofed webhooks."
            )
        
        # Parse payload
        try:
            payload = await request.json()
        except Exception:
            return {"status": "error", "message": "Invalid JSON"}
        
        event_type = payload.get("type", "")
        data = payload.get("data", {})

        # Extract order info — also try `order_id` at the top level of `data`
        # for older event shapes / payment-link variants.
        order_data = data.get("order", {}) if isinstance(data.get("order"), dict) else {}
        order_id = (
            order_data.get("order_id")
            or data.get("order_id")
            or payload.get("order_id")
            or ""
        ).strip()
        payment_data = data.get("payment", {}) if isinstance(data.get("payment"), dict) else {}
        payment_status = (payment_data.get("payment_status") or "").upper()
        order_status = (order_data.get("order_status") or "").upper()

        # Step 1: webhook RECEIVED (full payload echoed at debug for diagnosis)
        logger.info(
            f"[CF-Webhook] RECEIVED type={event_type!r} order_id={order_id!r} "
            f"payment_status={payment_status!r} order_status={order_status!r} "
            f"sig_verified={signature_valid} from={request.client.host if request.client else '?'}"
        )
        logger.debug(f"[CF-Webhook] Full payload: {raw_body[:2000]}")

        # Idempotency: only block retries when the FIRST attempt actually
        # processed successfully. If the first attempt failed (e.g. order
        # arrived out-of-order with the create-order call), Cashfree's retries
        # MUST be allowed to retry — otherwise the payment is lost forever.
        idempotency_key = f"{event_type}:{order_id}:{payment_data.get('cf_payment_id', '')}"
        existing = await db.cashfree_webhook_logs.find_one(
            {"idempotency_key": idempotency_key, "status": "processed",
             "processing_result.processed": True}
        )
        if existing:
            logger.info(f"[CF-Webhook] Idempotent skip — already successfully processed: {idempotency_key}")
            return {"status": "ok", "message": "Already processed"}
        
        # Log webhook
        webhook_log = {
            "id": webhook_id,
            "idempotency_key": idempotency_key,
            "event_type": event_type,
            "order_id": order_id,
            "payload": payload,
            "signature_verified": signature_valid,
            "status": "received",
            "received_at": received_at,
            "ip": request.client.host if request.client else "unknown"
        }
        await db.cashfree_webhook_logs.insert_one(webhook_log)
        
        # Process based on event type
        processing_result = {"processed": False}

        # Treat any of these signals as a successful payment.
        is_success_event = (
            event_type in ["PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_SUCCESS"]
            or payment_status == "SUCCESS"
            or order_status == "PAID"
        )

        if is_success_event:
            # ── GATE A: reject tiny/test amounts immediately ──────────────
            # Get the amount from the webhook payload (may be 0 if missing)
            webhook_amount = 0.0
            try:
                webhook_amount = float(
                    payment_data.get("payment_amount")
                    or order_data.get("order_amount")
                    or 0
                )
            except (TypeError, ValueError):
                webhook_amount = 0.0

            if 0 < webhook_amount <= 10:
                logger.warning(
                    f"[CF-Webhook] REJECTING tiny-amount event: "
                    f"order_id={order_id!r} amount=₹{webhook_amount}"
                )
                await db.cashfree_webhook_logs.update_one(
                    {"id": webhook_id},
                    {"$set": {"status": "rejected",
                              "reject_reason": f"amount_too_small: ₹{webhook_amount}"}},
                )
                return {"status": "ok", "message": f"Rejected: ₹{webhook_amount} below ₹10 minimum"}

            # ── GATE B: Cashfree API double-verification ──────────────────
            # Do NOT trust the webhook payload alone even after signature check.
            # Call the Cashfree orders/payments API to independently confirm.
            # If the API is temporarily unreachable we fall back to trusting the
            # signed webhook (which is still better than nothing), but log the fact.
            api_verified = False
            api_verified_payment_data = None
            if CASHFREE_PRODUCTION_APP_ID and CASHFREE_PRODUCTION_SECRET_KEY and order_id:
                try:
                    cf_headers = {
                        "x-client-id": CASHFREE_PRODUCTION_APP_ID,
                        "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
                        "x-api-version": CASHFREE_API_VERSION,
                        "Content-Type": "application/json",
                    }
                    cf_base = get_cashfree_api_url()
                    async with httpx.AsyncClient(timeout=10.0) as _hc:
                        # Hit GET /orders/{order_id}/payments — ground truth
                        _pr = await _hc.get(
                            f"{cf_base}/orders/{order_id}/payments",
                            headers=cf_headers,
                        )
                    if _pr.status_code == 200:
                        _plist = _pr.json() if isinstance(_pr.json(), list) else []
                        for _p in _plist:
                            if ((_p.get("payment_status") or "").upper() == "SUCCESS"
                                    and float(_p.get("payment_amount") or 0) > 10):
                                api_verified = True
                                api_verified_payment_data = {
                                    "cf_payment_id": str(_p.get("cf_payment_id", "")),
                                    "payment_amount": float(_p.get("payment_amount", 0)),
                                    "payment_time": _p.get("payment_completion_time",
                                                           received_at),
                                    "payment_method": _p.get("payment_method", {}),
                                    "payment_details": {"api_verified": True,
                                                        "payment": _p},
                                }
                                break
                        if not api_verified:
                            logger.warning(
                                f"[CF-Webhook] API returned no SUCCESS payment for "
                                f"order_id={order_id!r} — event rejected as unconfirmed"
                            )
                            await db.cashfree_webhook_logs.update_one(
                                {"id": webhook_id},
                                {"$set": {"status": "rejected",
                                          "reject_reason": "api_not_confirmed"}},
                            )
                            return {
                                "status": "ok",
                                "message": "Webhook rejected: Cashfree API did not confirm payment",
                            }
                    else:
                        # API error — fall back to trusting signed webhook with a warning
                        logger.error(
                            f"[CF-Webhook] API verify HTTP {_pr.status_code} for "
                            f"{order_id!r} — falling back to signed webhook"
                        )
                except Exception as _ve:
                    logger.error(
                        f"[CF-Webhook] API verify exception for {order_id!r}: {_ve} "
                        f"— falling back to signed webhook"
                    )
            else:
                logger.debug(
                    f"[CF-Webhook] Cashfree creds not configured — skipping API verify "
                    f"for {order_id!r}"
                )

            # Use API-confirmed data if available, else signed webhook data
            effective_payment_data = api_verified_payment_data or payment_data

            # Step 2: try to find the order in DB by exact order_id.
            order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})

            if order:
                logger.info(
                    f"[CF-Webhook] ORDER FOUND order_id={order_id} "
                    f"current_status={order.get('status')!r} amount={order.get('amount')} "
                    f"prev_whatsapp_sent={order.get('whatsapp_sent')}"
                )
                # Resend safety net: if the order is already paid but the
                # previous WhatsApp send failed, this duplicate webhook is
                # our chance to retry the customer notification.
                if order.get("status") == "paid" and not order.get("whatsapp_sent"):
                    logger.warning(
                        f"[CF-Webhook] RESENDING WhatsApp — order {order_id} is paid "
                        f"but whatsapp_sent={order.get('whatsapp_sent')!r}, "
                        f"prev_error={order.get('whatsapp_last_error')!r}"
                    )
                    try:
                        retry_confirmations = await send_payment_confirmations(
                            order=order, order_id=order_id,
                            amount=order.get("payment_amount_received") or order.get("amount", 0),
                        )
                        await db.cashfree_orders.update_one(
                            {"order_id": order_id},
                            {"$set": {
                                "whatsapp_sent": bool(retry_confirmations.get("whatsapp_sent")),
                                "whatsapp_last_error": retry_confirmations.get("error"),
                                "confirmations_resent_at": received_at,
                            }},
                        )
                        processing_result = {
                            "processed": True,
                            "message": "Already paid — confirmation resend attempted",
                            "confirmations": retry_confirmations,
                        }
                        logger.info(
                            f"[CF-Webhook] RESEND result for {order_id}: "
                            f"whatsapp_sent={retry_confirmations.get('whatsapp_sent')}"
                        )
                    except Exception as resend_err:
                        logger.error(f"[CF-Webhook] Resend failed for {order_id}: {resend_err}")
                        processing_result = {
                            "processed": True,
                            "message": f"Already paid — resend failed: {resend_err}",
                        }
                    # Skip the normal _mark_order_paid call (atomic guard would no-op anyway)
                    await db.cashfree_webhook_logs.update_one(
                        {"id": webhook_id},
                        {"$set": {"status": "processed", "processing_result": processing_result}},
                    )
                    return {"status": "ok", "webhook_id": webhook_id, **processing_result}

                # ── GATE C: reject suspicious customer names ──────────────
                _SUSPICIOUS_NAME_TOKENS = {
                    "test", "verify", "admin", "<script", "javascript:",
                    "onerror", "onload", "fake", "dummy", "sample",
                }
                _cname = (order.get("customer_name") or "").lower()
                if any(tok in _cname for tok in _SUSPICIOUS_NAME_TOKENS):
                    logger.warning(
                        f"[CF-Webhook] REJECTING suspicious customer name: "
                        f"order_id={order_id!r} name={_cname!r}"
                    )
                    await db.cashfree_webhook_logs.update_one(
                        {"id": webhook_id},
                        {"$set": {"status": "rejected",
                                  "reject_reason": f"suspicious_name: {_cname[:100]}"}},
                    )
                    return {
                        "status": "ok",
                        "message": f"Rejected: suspicious customer name",
                    }

                # Step 3: delegate to the shared helper. It atomically marks
                # the order paid, upserts db.payments, syncs the service
                # booking, updates lead stage, and fires WhatsApp.
                processing_result = await _mark_order_paid(
                    order=order,
                    payment_data={
                        "cf_payment_id": effective_payment_data.get("cf_payment_id", ""),
                        "payment_amount": effective_payment_data.get(
                            "payment_amount", order.get("amount", 0)
                        ),
                        "payment_time": effective_payment_data.get("payment_time", received_at),
                        "payment_method": effective_payment_data.get("payment_method", {}),
                        "payment_details": effective_payment_data.get("payment_details", data),
                    },
                    source="webhook_api_verified" if api_verified else "webhook",
                    is_api_verified=api_verified,
                )
                wa_status = (processing_result.get("confirmations") or {}).get("whatsapp_sent")
                logger.info(
                    f"[CF-Webhook] DB UPDATED order_id={order_id} "
                    f"processed={processing_result.get('processed')} "
                    f"whatsapp_sent={wa_status}"
                )
            else:
                # Step 2-fail: order missing in DB. Log loudly so it is
                # visible in production console — this means create-order
                # never wrote the row, OR the order_id format diverges.
                logger.error(
                    f"[CF-Webhook] ORDER NOT FOUND in cashfree_orders for order_id={order_id!r}. "
                    f"Reconciliation loop will retry every 5 min via Cashfree GET /orders/{{id}}."
                )
                processing_result = {"processed": False, "message": "Order not found in DB", "order_id": order_id}
        
        elif event_type in ["PAYMENT_FAILED_WEBHOOK", "PAYMENT_FAILED"]:
            order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
            if order:
                failure_reason = payment_data.get("payment_message", "Payment failed")
                
                await db.cashfree_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "status": "failed",
                        "failed_at": received_at,
                        "failure_reason": failure_reason,
                        "payment_details": data
                    }}
                )
                await db.payments.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "failed", "failed_at": received_at}}
                )
                
                processing_result = {"processed": True, "message": f"Payment FAILED: {failure_reason}"}
                logger.info(f"Payment FAILED: order={order_id}, reason={failure_reason}")
        
        elif event_type in ["PAYMENT_USER_DROPPED_WEBHOOK", "PAYMENT_USER_DROPPED"]:
            await db.cashfree_orders.update_one(
                {"order_id": order_id},
                {"$set": {"status": "dropped", "dropped_at": received_at}}
            )
            processing_result = {"processed": True, "message": "Payment dropped"}
        
        elif event_type in ["PAYMENT_LINK_EVENT", "LINK_STATUS"]:
            # Handle Cashfree Payment Link events
            link_data = data.get("link_details", data.get("payment_link", data))
            link_id = link_data.get("link_id", "") or payload.get("link_id", "")
            link_status = link_data.get("link_status", "") or data.get("link_status", "")
            link_amount_paid = link_data.get("link_amount_paid", 0)
            
            logger.info(f"[Webhook] Payment Link event: link_id={link_id}, status={link_status}")
            
            if link_status in ["PAID", "PARTIALLY_PAID"]:
                # Find order by link reference or order_id
                order = None
                if order_id:
                    order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
                if not order and link_id:
                    order = await db.cashfree_orders.find_one(
                        {"$or": [{"link_id": link_id}, {"payment_link_id": link_id}]}, 
                        {"_id": 0}
                    )
                
                if order and order.get("status") != "paid":
                    payment_amount = link_amount_paid or order.get("amount", 0)
                    update_data = {
                        "status": "paid",
                        "paid_at": received_at,
                        "payment_amount_received": payment_amount,
                        "link_status": link_status,
                        "payment_details": data,
                        "webhook_updated_at": received_at
                    }
                    
                    await db.cashfree_orders.update_one(
                        {"order_id": order.get("order_id", order_id)},
                        {"$set": update_data}
                    )
                    
                    # Send confirmations
                    confirmation_results = await send_payment_confirmations(
                        order=order,
                        order_id=order.get("order_id", order_id),
                        amount=payment_amount
                    )
                    
                    processing_result = {
                        "processed": True,
                        "message": f"Payment Link PAID: {link_id}",
                        "amount": payment_amount,
                        "confirmations": confirmation_results
                    }
                    logger.info(f"Payment Link SUCCESS: link={link_id}, amount={payment_amount}")
                else:
                    processing_result = {"processed": True, "message": f"Link event processed: {link_status}"}
            else:
                # EXPIRED, CANCELLED, etc.
                if order_id:
                    await db.cashfree_orders.update_one(
                        {"order_id": order_id},
                        {"$set": {"link_status": link_status, "webhook_updated_at": received_at}}
                    )
                processing_result = {"processed": True, "message": f"Link status: {link_status}"}
        
        # Update webhook log
        await db.cashfree_webhook_logs.update_one(
            {"id": webhook_id},
            {"$set": {"status": "processed", "processing_result": processing_result}}
        )
        
        return {"status": "ok", "webhook_id": webhook_id, **processing_result}

    except HTTPException:
        # Preserve auth/signature failures as proper HTTP error responses.
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        await db.cashfree_webhook_logs.update_one(
            {"id": webhook_id},
            {"$set": {"status": "error", "error": str(e)}}
        )
        return {"status": "error", "message": str(e)}

# ==================== ORDERS LIST & DASHBOARD ====================

@router.get("/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    payment_type: Optional[str] = None,
    lead_id: Optional[str] = None,
    search: Optional[str] = None,
    include_deleted: bool = False
):
    """Get paginated list of orders"""
    query = {}
    
    # Exclude deleted orders by default
    if not include_deleted:
        query["is_deleted"] = {"$ne": True}
    
    if status:
        query["status"] = status
    if payment_type:
        query["payment_type"] = payment_type
    if lead_id:
        query["lead_id"] = lead_id
    if search:
        query["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search}},
            {"order_id": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.cashfree_orders.count_documents(query)
    skip = (page - 1) * limit
    
    orders = await db.cashfree_orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "orders": orders,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


# ==================== DELETE TRANSACTION ENDPOINTS ====================

class BulkDeleteRequest(BaseModel):
    order_ids: list[str] = Field(..., min_length=1, max_length=100)


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    """
    Delete a single Cashfree order/transaction.
    This is a soft delete - marks as deleted but keeps data for records.
    """
    try:
        # Check if order exists
        order = await db.cashfree_orders.find_one({"order_id": order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Soft delete - mark as deleted
        await db.cashfree_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "is_deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Also mark in legacy payments if exists
        await db.payments.update_one(
            {"order_id": order_id},
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"[Delete] Order {order_id} marked as deleted")
        
        return {
            "success": True,
            "message": f"Order {order_id} deleted successfully",
            "order_id": order_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Delete] Error deleting order {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/bulk-delete")
async def bulk_delete_orders(request: BulkDeleteRequest):
    """
    Bulk delete multiple Cashfree orders/transactions.
    This is a soft delete - marks as deleted but keeps data for records.
    """
    try:
        order_ids = request.order_ids
        
        if not order_ids:
            raise HTTPException(status_code=400, detail="No order IDs provided")
        
        if len(order_ids) > 100:
            raise HTTPException(status_code=400, detail="Maximum 100 orders can be deleted at once")
        
        # Soft delete all matching orders
        now = datetime.now(timezone.utc).isoformat()
        
        result = await db.cashfree_orders.update_many(
            {"order_id": {"$in": order_ids}},
            {"$set": {
                "is_deleted": True,
                "deleted_at": now
            }}
        )
        
        # Also mark in legacy payments collection
        await db.payments.update_many(
            {"order_id": {"$in": order_ids}},
            {"$set": {"is_deleted": True, "deleted_at": now}}
        )
        
        deleted_count = result.modified_count
        logger.info(f"[Bulk Delete] {deleted_count} orders marked as deleted")
        
        return {
            "success": True,
            "message": f"{deleted_count} orders deleted successfully",
            "deleted_count": deleted_count,
            "requested_count": len(order_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bulk Delete] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Status values that mean "this order has real money behind it" — must NEVER
# be soft-deleted by the cleanup tool. Kept lowercase; query is case-folded.
_PAID_STATUSES = {"paid", "success", "successful", "captured", "completed",
                  "settled", "confirmed"}
# Pre-payment statuses that ARE eligible for stale-cleanup if old enough.
# Anything not in this set is treated as paid-by-default for safety.
_UNPAID_STATUSES = {"active", "created", "pending", "initiated",
                    "expired", "cancelled", "failed", "user_dropped"}


@router.post("/orders/cleanup-test-data")
@limiter.limit(RATE_LIMIT_SENSITIVE)
async def cleanup_test_data(
    request: Request,
    confirm: bool = False,
    max_amount: float = 5.0,
    stale_pending_hours: int = 48,
):
    """
    Targeted cleanup of obvious garbage transactions:
      1. Tiny test payments (amount <= max_amount, default ₹5)
      2. Orders whose customer_name contains script-injection markers
         (`<`, `>`, `script`, `javascript:`, `onerror`, `onload`)
      3. Stale unpaid orders older than `stale_pending_hours` (default 48h)

    Verified-paid orders (status in `_PAID_STATUSES`) are NEVER touched —
    enforced via an explicit positive allow-list of unpaid statuses, so any
    unrecognized status is treated as paid-by-default. Soft-deletes only.

    Auth: requires `x-admin-token` header (same secret as /sync/* endpoints).
    Requires `?confirm=true` to actually delete; otherwise returns a dry-run.
    """
    _require_admin_token(request)
    try:
        now = datetime.now(timezone.utc)
        stale_cutoff_iso = (now - timedelta(hours=stale_pending_hours)).isoformat()

        xss_markers = ["<", ">", "script", "javascript:", "onerror", "onload"]
        xss_regex = "|".join(xss_markers)

        # Positive allow-list of statuses we're willing to touch. Combined with
        # the per-doc paid-status check below, this is double-belt-and-braces:
        # an order with status "paid" CANNOT match any clause.
        unpaid_status_filter = {"status": {"$in": list(_UNPAID_STATUSES)}}

        match_clauses = [
            # 1. tiny amounts (only on unpaid orders)
            {"$and": [unpaid_status_filter,
                      {"amount": {"$lte": max_amount, "$gt": 0}}]},
            # 2. script-injected customer names (only on unpaid orders)
            {"$and": [unpaid_status_filter,
                      {"customer_name": {"$regex": xss_regex, "$options": "i"}}]},
            # 3. stale unpaid orders
            {"$and": [unpaid_status_filter,
                      {"created_at": {"$lt": stale_cutoff_iso}}]},
        ]

        query = {
            "$and": [
                {"$or": match_clauses},
                {"is_deleted": {"$ne": True}},
                # Hard guard, redundant with per-clause filter — defense in depth.
                {"status": {"$nin": list(_PAID_STATUSES)}},
            ]
        }

        # Preview / count
        cursor = db.cashfree_orders.find(query, {
            "order_id": 1, "amount": 1, "status": 1,
            "customer_name": 1, "created_at": 1,
        })
        try:
            preview_docs = await cursor.to_list(length=500)
        except TypeError:
            preview_docs = list(cursor)

        # Final in-Python paid-status guard. Even if the Mongo query somehow
        # let one through, we drop it here before deleting.
        safe_docs = [d for d in preview_docs
                     if str(d.get("status", "")).lower() not in _PAID_STATUSES]

        preview = [
            {
                "order_id": d.get("order_id"),
                "amount": d.get("amount"),
                "status": d.get("status"),
                "name": d.get("customer_name"),
                "created_at": d.get("created_at"),
            }
            for d in safe_docs
        ]

        if not confirm:
            return {
                "success": True,
                "dry_run": True,
                "would_delete_count": len(preview),
                "sample": preview[:25],
                "message": "Dry-run only. POST again with ?confirm=true to soft-delete these.",
            }

        # Delete by explicit ID list (NOT by query) so the Python-side guard
        # is authoritative — no chance of a TOCTOU race deleting a freshly-paid order.
        order_ids = [d.get("order_id") for d in safe_docs if d.get("order_id")]
        if not order_ids:
            return {"success": True, "dry_run": False, "deleted_count": 0, "sample": []}

        result = await db.cashfree_orders.update_many(
            {"order_id": {"$in": order_ids},
             "status": {"$nin": list(_PAID_STATUSES)}},
            {"$set": {"is_deleted": True, "deleted_at": now.isoformat(),
                      "deleted_reason": "cleanup-test-data"}},
        )
        await db.payments.update_many(
            {"order_id": {"$in": order_ids},
             "status": {"$nin": list(_PAID_STATUSES)}},
            {"$set": {"is_deleted": True, "deleted_at": now.isoformat(),
                      "deleted_reason": "cleanup-test-data"}},
        )

        deleted_count = getattr(result, "modified_count", len(order_ids))
        logger.info(f"[Cleanup Test Data] soft-deleted {deleted_count} orders")
        return {
            "success": True,
            "dry_run": False,
            "deleted_count": deleted_count,
            "sample": preview[:25],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Cleanup Test Data] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/permanent-delete/{order_id}")
async def permanent_delete_order(order_id: str, confirm: bool = False):
    """
    Permanently delete an order from the database.
    WARNING: This action is irreversible!
    Requires confirm=true parameter.
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Permanent deletion requires confirm=true parameter"
        )
    
    try:
        # Delete from cashfree_orders
        result1 = await db.cashfree_orders.delete_one({"order_id": order_id})
        
        # Delete from payments
        result2 = await db.payments.delete_one({"order_id": order_id})
        
        if result1.deleted_count == 0 and result2.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        
        logger.warning(f"[PERMANENT DELETE] Order {order_id} permanently deleted")
        
        return {
            "success": True,
            "message": f"Order {order_id} permanently deleted",
            "cashfree_deleted": result1.deleted_count > 0,
            "payments_deleted": result2.deleted_count > 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Permanent Delete] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/stats")
async def get_orders_dashboard_stats():
    """Get dashboard statistics for orders"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)
    
    # Status aggregation
    status_pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    status_stats = await db.cashfree_orders.aggregate(status_pipeline).to_list(100)
    status_dict = {s["_id"]: {"count": s["count"], "amount": s["total_amount"]} for s in status_stats}
    
    # Today stats
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}}
        }}
    ]
    today_stats = await db.cashfree_orders.aggregate(today_pipeline).to_list(1)
    today = today_stats[0] if today_stats else {"total_orders": 0, "total_amount": 0, "paid_count": 0, "paid_amount": 0}
    
    # Week stats
    week_pipeline = [
        {"$match": {"created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}}
        }}
    ]
    week_stats = await db.cashfree_orders.aggregate(week_pipeline).to_list(1)
    week = week_stats[0] if week_stats else {"total_orders": 0, "paid_count": 0, "paid_amount": 0}
    
    # Month stats
    month_pipeline = [
        {"$match": {"created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}}
        }}
    ]
    month_stats = await db.cashfree_orders.aggregate(month_pipeline).to_list(1)
    month = month_stats[0] if month_stats else {"total_orders": 0, "paid_count": 0, "paid_amount": 0}
    
    # Payment type breakdown
    type_pipeline = [
        {"$group": {
            "_id": "$payment_type",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}}
        }}
    ]
    type_stats = await db.cashfree_orders.aggregate(type_pipeline).to_list(100)
    
    return {
        "overview": {
            "total_orders": sum(s.get("count", 0) for s in status_stats),
            "total_amount_requested": sum(s.get("amount", 0) for s in status_stats),
            "total_collected": status_dict.get("paid", {}).get("amount", 0),
            "paid_count": status_dict.get("paid", {}).get("count", 0),
            "pending_count": status_dict.get("active", {}).get("count", 0),
            "failed_count": status_dict.get("failed", {}).get("count", 0)
        },
        "today": {
            "orders": today.get("total_orders", 0),
            "amount_requested": today.get("total_amount", 0),
            "paid_count": today.get("paid_count", 0),
            "collected": today.get("paid_amount", 0)
        },
        "this_week": {
            "orders": week.get("total_orders", 0),
            "paid_count": week.get("paid_count", 0),
            "collected": week.get("paid_amount", 0)
        },
        "this_month": {
            "orders": month.get("total_orders", 0),
            "paid_count": month.get("paid_count", 0),
            "collected": month.get("paid_amount", 0)
        },
        "by_status": status_dict,
        "by_payment_type": [
            {
                "type": PAYMENT_TYPES.get(s["_id"], s["_id"]),
                "type_id": s["_id"],
                "count": s["count"],
                "total_amount": s["total_amount"],
                "paid_amount": s["paid_amount"]
            }
            for s in type_stats if s["_id"]
        ]
    }

@router.get("/lead/{lead_id}/orders")
async def get_lead_orders(lead_id: str):
    """Get all orders for a specific lead"""
    orders = await db.cashfree_orders.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_paid = sum(o.get("amount", 0) for o in orders if o.get("status") == "paid")
    pending_amount = sum(o.get("amount", 0) for o in orders if o.get("status") == "active")
    
    return {
        "lead_id": lead_id,
        "orders": orders,
        "total_paid": total_paid,
        "pending_amount": pending_amount,
        "order_count": len(orders)
    }


# ==================== DIRECT CHECKOUT PAGE (WORKAROUND) ====================
from fastapi.responses import HTMLResponse

@router.get("/pay/{order_id}", response_class=HTMLResponse)
async def direct_checkout_page(order_id: str):
    """
    WORKAROUND: Serve a checkout page directly from the backend.
    This bypasses the frontend entirely and ensures the payment_session_id
    is correctly passed to the Cashfree SDK.
    
    Usage: https://asrenterprises.in/api/cashfree/pay/{order_id}
    """
    # Look up the order
    order = await db.cashfree_orders.find_one({"order_id": order_id})
    
    if not order:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Not Found - ASR Enterprises</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white; }}
                .container {{ text-align: center; padding: 40px; }}
                h1 {{ color: #f59e0b; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Order Not Found</h1>
                <p>Order ID: {order_id}</p>
                <p>This order does not exist or has expired.</p>
                <p>Please contact support: {ASR_DISPLAY_PHONE}</p>
                <a href="{ASR_WEBSITE}" style="color: #f59e0b;">Return to Home</a>
            </div>
        </body>
        </html>
        """, status_code=404)
    
    payment_session_id = order.get("payment_session_id")
    
    # CRITICAL FIX: Clean corrupted payment_session_id
    # Some old orders have "paymentpayment" appended to the end
    if payment_session_id:
        original_length = len(payment_session_id)
        while payment_session_id.endswith("payment"):
            payment_session_id = payment_session_id[:-7]  # Remove "payment" (7 chars)
        if len(payment_session_id) != original_length:
            logger.warning(f"Cleaned corrupted session_id for order {order_id}: {original_length} -> {len(payment_session_id)} chars")
    
    if not payment_session_id or len(payment_session_id) < 50:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Error - ASR Enterprises</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white; }}
                .container {{ text-align: center; padding: 40px; }}
                h1 {{ color: #ef4444; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Payment Session Expired</h1>
                <p>Order ID: {order_id}</p>
                <p>The payment session for this order has expired.</p>
                <p>Please create a new order or contact support: {ASR_DISPLAY_PHONE}</p>
                <a href="{ASR_WEBSITE}" style="color: #f59e0b;">Return to Home</a>
            </div>
        </body>
        </html>
        """, status_code=400)
    
    # Check order status
    order_status = order.get("status", "unknown")
    if order_status == "paid":
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Already Paid - ASR Enterprises</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white; }}
                .container {{ text-align: center; padding: 40px; }}
                h1 {{ color: #22c55e; }}
                .checkmark {{ font-size: 80px; color: #22c55e; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="checkmark">✓</div>
                <h1>Payment Completed</h1>
                <p>Order ID: {order_id}</p>
                <p>Amount: ₹{order.get('amount', 0):,.0f}</p>
                <p>This order has already been paid.</p>
                <a href="{ASR_WEBSITE}" style="color: #f59e0b;">Return to Home</a>
            </div>
        </body>
        </html>
        """)
    
    customer_name = order.get("customer_name", "Customer")
    amount = order.get("amount", 0)

    # XSS-safe: escape every dynamic value before HTML interpolation. order_id,
    # customer_name and payment_session_id are all attacker-influenceable.
    import html as _html
    safe_order_id = _html.escape(str(order_id), quote=True)
    safe_customer_name = _html.escape(str(customer_name), quote=True)
    safe_session_id = _html.escape(str(payment_session_id), quote=True)
    # Choose checkout host based on sandbox flag so test orders go to sandbox.
    checkout_action = (
        "https://sandbox.cashfree.com/pg/view/sessions/checkout"
        if CASHFREE_IS_SANDBOX
        else "https://api.cashfree.com/pg/view/sessions/checkout"
    )

    # Bulletproof checkout: a tiny self-submitting HTML form that POSTs the
    # session_id directly to Cashfree's hosted checkout URL. This works in
    # every browser (including in-app browsers and restrictive networks)
    # because it does NOT depend on loading sdk.cashfree.com — only the
    # form submission to api.cashfree.com is needed.
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pay ₹{amount:,.0f} - ASR Enterprises</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; color: white; padding: 20px; }}
            .container {{ background: rgba(255,255,255,0.05); border-radius: 20px; padding: 40px; max-width: 420px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.1); }}
            .logo {{ font-size: 48px; margin-bottom: 16px; }}
            h1 {{ font-size: 22px; color: #f59e0b; margin-bottom: 6px; }}
            .sub {{ color: #9ca3af; font-size: 14px; }}
            .amount {{ font-size: 44px; font-weight: bold; color: #22c55e; margin: 22px 0; }}
            .order-info {{ background: rgba(0,0,0,0.3); border-radius: 12px; padding: 14px; margin: 18px 0; font-size: 13px; }}
            .order-info p {{ margin: 4px 0; color: #9ca3af; }}
            .order-info strong {{ color: #f59e0b; }}
            .spinner {{ width: 44px; height: 44px; border: 4px solid rgba(245,158,11,0.3); border-top-color: #f59e0b; border-radius: 50%; animation: spin 1s linear infinite; margin: 18px auto; }}
            @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
            .status {{ font-size: 14px; color: #9ca3af; margin-top: 8px; }}
            .btn {{ display: inline-block; background: #f59e0b; color: #1a1a2e; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 14px; cursor: pointer; border: none; font-size: 16px; }}
            .support {{ margin-top: 24px; font-size: 12px; color: #6b7280; }}
            .support a {{ color: #f59e0b; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">⚡</div>
            <h1>ASR Enterprises</h1>
            <p class="sub">Solar Power Solutions</p>
            <div class="amount">₹{amount:,.0f}</div>
            <div class="order-info">
                <p>Order ID: <strong>{safe_order_id}</strong></p>
                <p>Customer: <strong>{safe_customer_name}</strong></p>
            </div>
            <div class="spinner"></div>
            <p class="status">Redirecting to secure payment page…</p>
            <noscript>
                <p class="status" style="color:#fbbf24;margin-top:10px;">JavaScript is off — tap the button below.</p>
            </noscript>

            <!-- Auto-submitting form: posts session_id to Cashfree-hosted checkout -->
            <form id="cfForm" method="POST" action="{checkout_action}" accept-charset="UTF-8">
                <input type="hidden" name="payment_session_id" value="{safe_session_id}">
                <noscript>
                    <button type="submit" class="btn">Continue to Payment</button>
                </noscript>
            </form>

            <div class="support">
                Need help? Call <a href="tel:{ASR_DISPLAY_PHONE}">{ASR_DISPLAY_PHONE}</a>
            </div>
        </div>

        <script>
            // Submit immediately — no third-party script needed.
            (function() {{
                try {{
                    document.getElementById('cfForm').submit();
                }} catch (e) {{
                    var s = document.querySelector('.status');
                    if (s) s.innerHTML = 'Tap below to continue. <br><button class="btn" onclick="document.getElementById(\\'cfForm\\').submit()">Continue to Payment</button>';
                }}
            }})();
        </script>
    </body>
    </html>
    """

    return HTMLResponse(content=html_content)





# ==================== FIX CORRUPTED ORDERS ====================

@router.post("/fix-corrupted-sessions")
async def fix_corrupted_payment_sessions():
    """
    Utility endpoint to fix all corrupted payment_session_id values in the database.
    These have "paymentpayment" appended to the end due to a bug in old code.
    """
    try:
        # Find all orders with corrupted session IDs
        corrupted_orders = await db.cashfree_orders.find({
            "payment_session_id": {"$regex": "payment$"}
        }).to_list(1000)
        
        fixed_count = 0
        for order in corrupted_orders:
            session_id = order.get("payment_session_id", "")
            original = session_id
            
            # Remove all trailing "payment" strings
            while session_id.endswith("payment"):
                session_id = session_id[:-7]
            
            if session_id != original:
                # Update the order
                await db.cashfree_orders.update_one(
                    {"order_id": order.get("order_id")},
                    {"$set": {"payment_session_id": session_id}}
                )
                # Also update in payments collection
                await db.payments.update_one(
                    {"order_id": order.get("order_id")},
                    {"$set": {"payment_session_id": session_id}}
                )
                fixed_count += 1
                logger.info(f"Fixed order {order.get('order_id')}: {len(original)} -> {len(session_id)} chars")
        
        return {
            "success": True,
            "corrupted_found": len(corrupted_orders),
            "fixed_count": fixed_count,
            "message": f"Fixed {fixed_count} corrupted payment sessions"
        }
    except Exception as e:
        logger.error(f"Error fixing corrupted sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
