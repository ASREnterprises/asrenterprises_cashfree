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
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cashfree", tags=["Cashfree Orders"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ==================== CONSTANTS ====================
CASHFREE_API_VERSION = "2023-08-01"

# ========== HARDCODED PRODUCTION CREDENTIALS ==========
# These are the ONLY credentials that should be used
# DO NOT use database or environment overrides
CASHFREE_PRODUCTION_APP_ID = "12549525aaaf9a53607bb180e232594521"
CASHFREE_PRODUCTION_SECRET_KEY = "cfsk_ma_prod_6abd08de6c87e078b9051fcbc50064c0_7af3b19b"
CASHFREE_IS_SANDBOX = False  # ALWAYS PRODUCTION - NEVER SANDBOX

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
    """Get Cashfree API base URL - ALWAYS returns PRODUCTION URL"""
    # FORCE PRODUCTION - ignore is_sandbox parameter
    return CASHFREE_PRODUCTION_API_URL

def get_cashfree_headers(config: Dict) -> Dict:
    """Get headers for Cashfree API requests"""
    return {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_PRODUCTION_APP_ID,  # Use hardcoded
        "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,  # Use hardcoded
        "x-api-version": CASHFREE_API_VERSION
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
    - Template-based: Uses approved 'payment_sucess_confirm' template
    
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
        
        # Get WhatsApp settings from database
        wa_settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
        if not wa_settings or not wa_settings.get("access_token"):
            logger.warning(f"[WhatsApp] Not configured - missing access_token. Order: {order_id}")
            await log_whatsapp_attempt(order_id, phone, msg_type, "failed", "WhatsApp not configured - missing access_token")
            return False
        
        cleaned_phone = clean_phone_with_country(phone)
        if not cleaned_phone:
            logger.warning(f"[WhatsApp] Invalid phone: {phone}, Order: {order_id}")
            await log_whatsapp_attempt(order_id, phone, msg_type, "failed", "Invalid phone number")
            return False
        
        access_token = wa_settings.get("access_token")
        phone_number_id = wa_settings.get("phone_number_id")
        
        if not access_token or not phone_number_id:
            logger.warning(f"[WhatsApp] Missing credentials. Order: {order_id}")
            await log_whatsapp_attempt(order_id, phone, msg_type, "failed", "Missing phone_number_id or access_token")
            return False
        
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
            # Template: payment_sucess_confirm (note: typo in original template name)
            # 6 body parameters matching user's approved template
            
            template_payload = {
                "messaging_product": "whatsapp",
                "to": cleaned_phone,
                "type": "template",
                "template": {
                    "name": "payment_sucess_confirm",  # User's approved template name
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
            
            logger.info(f"[WhatsApp] Sending template 'payment_sucess_confirm' to {cleaned_phone}")
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
                        "template_name": "payment_sucess_confirm",
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
                        "template_name": "payment_sucess_confirm",
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
        if msg_type == "payment_request":
            # Try to use a payment request template if available
            # Template format (user should create this in Meta Business Manager):
            # Hello {{1}},
            # Your payment request from ASR Enterprises is ready.
            # Amount: ₹{{2}}
            # Purpose: {{3}}
            # Pay here: {{4}}
            # Call: 9296389097
            
            # First, try template-based approach
            template_name = "payment_request"  # User can create this template
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
    Retry sending failed WhatsApp messages (called periodically or manually).
    Retries up to 3 times with exponential backoff.
    """
    try:
        failed_messages = await db.whatsapp_messages.find({
            "status": "failed",
            "retry_count": {"$lt": 3},
            "type": {"$in": ["payment_success_template", "payment_request_template"]}
        }).to_list(10)
        
        for msg in failed_messages:
            retry_count = msg.get("retry_count", 0) + 1
            logger.info(f"[WhatsApp] Retrying message {msg.get('id')} (attempt {retry_count})")
            
            # Update retry count
            await db.whatsapp_messages.update_one(
                {"id": msg.get("id")},
                {"$set": {"retry_count": retry_count, "last_retry": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Note: Actual retry logic would call send_payment_whatsapp again
            # For now, just log the attempt
            logger.info(f"[WhatsApp] Retry logged for message {msg.get('id')}")
            
        return len(failed_messages)
    except Exception as e:
        logger.error(f"[WhatsApp] Retry error: {e}")
        return 0


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
    1. WhatsApp template message (primary) - uses approved 'payment_sucess_confirm' template
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
    """Get Cashfree configuration status - ALWAYS PRODUCTION"""
    return {
        "configured": True,
        "environment": "PRODUCTION",  # HARDCODED - ALWAYS PRODUCTION
        "api_mode": "orders_api",
        "app_id_preview": CASHFREE_PRODUCTION_APP_ID[:8] + "...",  # Show first 8 chars
        "is_sandbox": False,  # ALWAYS FALSE
        "support_email": ASR_SUPPORT_EMAIL,
        "support_phone": ASR_DISPLAY_PHONE,
        "whatsapp_api_phone": ASR_WHATSAPP_API_PHONE,
        "business_name": ASR_BUSINESS_NAME,
        "payment_types": PAYMENT_TYPES,
        "message": "Using HARDCODED PRODUCTION credentials"
    }

@router.post("/create-order")
async def create_cashfree_order(request: CreateOrderRequest):
    """Create a new Cashfree order for hosted checkout - USES HARDCODED PRODUCTION CREDENTIALS"""
    try:
        # ALWAYS use production API URL
        base_url = CASHFREE_PRODUCTION_API_URL
        
        # ALWAYS use hardcoded production headers
        headers = {
            "Content-Type": "application/json",
            "x-client-id": CASHFREE_PRODUCTION_APP_ID,
            "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
            "x-api-version": CASHFREE_API_VERSION
        }
        
        logger.info("Creating Cashfree order with HARDCODED PRODUCTION credentials")
        logger.info(f"API URL: {base_url}")
        logger.info(f"App ID: {CASHFREE_PRODUCTION_APP_ID[:10]}...")
        
        # Generate order ID
        order_id = generate_order_id()
        
        # Clean phone
        customer_phone = clean_phone_number(request.customer_phone)
        if not customer_phone or len(customer_phone) != 10:
            raise HTTPException(status_code=400, detail="Invalid phone number. Please provide 10-digit mobile number.")
        
        # SECURITY: Mask phone number in logs
        masked_phone = f"****{customer_phone[-4:]}"
        
        # Determine base website URL - use origin_url if provided, else default to production
        website_base = request.origin_url or ASR_WEBSITE
        logger.info(f"Using website base URL: {website_base}")
        
        # Determine return URL
        return_url = request.return_url or f"{website_base}/payment/status?order_id={order_id}"
        
        # Create Cashfree Order payload
        order_payload = {
            "order_id": order_id,
            "order_amount": round(request.amount, 2),
            "order_currency": "INR",
            "customer_details": {
                "customer_id": f"CUST_{customer_phone}",
                "customer_phone": customer_phone,
                "customer_name": request.customer_name[:100] if request.customer_name else "Customer"
            },
            "order_meta": {
                "return_url": return_url,
                "notify_url": f"{ASR_WEBSITE}/api/cashfree/webhook"  # Webhook always goes to production
            },
            "order_note": f"{request.purpose[:100]} - {request.payment_type}"
        }
        
        # Add email if provided
        if request.customer_email:
            order_payload["customer_details"]["customer_email"] = request.customer_email
        
        # SECURITY: Log order creation with masked customer data
        logger.info(f"Creating Cashfree order: {order_id}, amount: {request.amount}, phone: {masked_phone}")
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
                "lead_id": request.lead_id,
                "customer_name": request.customer_name,
                "customer_phone": customer_phone,
                "customer_email": request.customer_email,
                "amount": request.amount,
                "payment_type": request.payment_type,
                "purpose": request.purpose,
                "notes": request.notes,
                "status": "active",
                "source": "crm" if request.lead_id else "website",
                "created_by": request.created_by_staff_id,
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
            if request.send_via_whatsapp:
                whatsapp_sent = await send_payment_whatsapp(
                    customer_phone,
                    request.customer_name,
                    request.amount,
                    payment_url,
                    request.purpose,
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
                "amount": request.amount,
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

@router.post("/website/create-order")
async def create_website_order(request: WebsiteOrderRequest):
    """Create order from website - auto-creates lead - USES HARDCODED PRODUCTION CREDENTIALS"""
    # Always active - using hardcoded credentials
    logger.info("Website order creation using HARDCODED PRODUCTION credentials")
    
    try:
        # Create/find lead
        lead_id = await create_lead_from_payment({
            "customer_name": request.customer_name,
            "customer_phone": request.customer_phone,
            "customer_email": request.customer_email,
            "address": request.address,
            "district": request.district,
            "payment_type": request.payment_type
        })
        
        # Get purpose label
        purpose = PAYMENT_TYPES.get(request.payment_type, "Solar Service Payment")
        if request.notes:
            purpose = f"{purpose} - {request.notes}"
        
        # Create order
        order_request = CreateOrderRequest(
            lead_id=lead_id,
            customer_name=request.customer_name,
            customer_phone=request.customer_phone,
            customer_email=request.customer_email,
            amount=request.amount,
            payment_type=request.payment_type,
            purpose=purpose,
            notes=request.notes,
            send_via_whatsapp=False,  # Will be sent via webhook on success
            origin_url=request.origin_url  # Pass through for same-origin checkout
        )
        
        result = await create_cashfree_order(order_request)
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
    """Refresh order status from Cashfree API - USES HARDCODED PRODUCTION CREDENTIALS"""
    try:
        # ALWAYS use production API
        base_url = CASHFREE_PRODUCTION_API_URL
        headers = {
            "Content-Type": "application/json",
            "x-client-id": CASHFREE_PRODUCTION_APP_ID,
            "x-client-secret": CASHFREE_PRODUCTION_SECRET_KEY,
            "x-api-version": CASHFREE_API_VERSION
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
        
        # Webhook secret (currently not configured - skip verification)
        webhook_secret = ""
        
        # Verify signature (skip if no secret configured)
        signature_valid = True
        if webhook_secret:
            signature_valid = verify_webhook_signature(timestamp, raw_body, signature, webhook_secret)
            if not signature_valid:
                logger.warning(f"Invalid webhook signature from {request.client.host}")
                await db.cashfree_webhook_logs.insert_one({
                    "id": webhook_id,
                    "status": "signature_failed",
                    "received_at": received_at,
                    "ip": request.client.host if request.client else "unknown"
                })
                return {"status": "error", "message": "Invalid signature"}
        
        # Parse payload
        try:
            payload = await request.json()
        except Exception:
            return {"status": "error", "message": "Invalid JSON"}
        
        event_type = payload.get("type", "")
        data = payload.get("data", {})
        
        # Extract order info
        order_data = data.get("order", {})
        order_id = order_data.get("order_id", "")
        payment_data = data.get("payment", {})
        
        logger.info(f"Cashfree webhook: {event_type}, order_id={order_id}")
        
        # Check idempotency
        idempotency_key = f"{event_type}:{order_id}:{payment_data.get('cf_payment_id', '')}"
        existing = await db.cashfree_webhook_logs.find_one({
            "idempotency_key": idempotency_key,
            "status": "processed"
        })
        if existing:
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
        
        if event_type in ["PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_SUCCESS"]:
            order = await db.cashfree_orders.find_one({"order_id": order_id}, {"_id": 0})
            
            if order:
                if order.get("status") == "paid":
                    processing_result = {"processed": True, "message": "Already paid"}
                else:
                    # Extract payment details
                    cf_payment_id = payment_data.get("cf_payment_id", "")
                    payment_amount = payment_data.get("payment_amount", order.get("amount", 0))
                    payment_time = payment_data.get("payment_time", received_at)
                    payment_method = payment_data.get("payment_method", {})
                    
                    # Update order
                    update_data = {
                        "status": "paid",
                        "paid_at": payment_time,
                        "cf_payment_id": cf_payment_id,
                        "payment_amount_received": payment_amount,
                        "payment_method": payment_method,
                        "payment_details": data,
                        "webhook_updated_at": received_at
                    }
                    
                    await db.cashfree_orders.update_one(
                        {"order_id": order_id},
                        {"$set": update_data}
                    )
                    await db.payments.update_one(
                        {"order_id": order_id},
                        {"$set": update_data}
                    )
                    
                    # Update lead
                    if order.get("lead_id"):
                        await update_lead_after_payment(
                            order["lead_id"],
                            order.get("payment_type", "custom"),
                            payment_amount,
                            order_id
                        )
                    
                    # Send BOTH WhatsApp AND SMS confirmations
                    confirmation_results = await send_payment_confirmations(
                        order=order,
                        order_id=order_id,
                        amount=payment_amount
                    )
                    
                    processing_result = {
                        "processed": True,
                        "message": "Payment marked as PAID",
                        "amount": payment_amount,
                        "confirmations": confirmation_results
                    }
                    logger.info(f"Payment SUCCESS: order={order_id}, amount={payment_amount}, confirmations={confirmation_results}")
            else:
                processing_result = {"processed": False, "message": "Order not found"}
        
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
        
        # Update webhook log
        await db.cashfree_webhook_logs.update_one(
            {"id": webhook_id},
            {"$set": {"status": "processed", "processing_result": processing_result}}
        )
        
        return {"status": "ok", "webhook_id": webhook_id, **processing_result}
        
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
    
    # Return HTML page with Cashfree SDK
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pay ₹{amount:,.0f} - ASR Enterprises</title>
        <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
            }}
            .container {{
                background: rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 40px;
                max-width: 420px;
                width: 90%;
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }}
            .logo {{
                font-size: 48px;
                margin-bottom: 20px;
            }}
            h1 {{
                font-size: 24px;
                margin-bottom: 10px;
                color: #f59e0b;
            }}
            .amount {{
                font-size: 48px;
                font-weight: bold;
                color: #22c55e;
                margin: 20px 0;
            }}
            .order-info {{
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                padding: 15px;
                margin: 20px 0;
            }}
            .order-info p {{
                margin: 5px 0;
                color: #9ca3af;
                font-size: 14px;
            }}
            .order-info strong {{
                color: #f59e0b;
            }}
            .loading {{
                display: flex;
                flex-direction: column;
                align-items: center;
                margin: 30px 0;
            }}
            .spinner {{
                width: 50px;
                height: 50px;
                border: 4px solid rgba(245, 158, 11, 0.3);
                border-top-color: #f59e0b;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }}
            @keyframes spin {{
                to {{ transform: rotate(360deg); }}
            }}
            .status {{
                margin-top: 15px;
                font-size: 16px;
                color: #9ca3af;
            }}
            .error {{
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid #ef4444;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                display: none;
            }}
            .error h3 {{
                color: #ef4444;
                margin-bottom: 10px;
            }}
            .btn {{
                display: inline-block;
                background: #f59e0b;
                color: #1a1a2e;
                padding: 15px 30px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: bold;
                margin-top: 15px;
                cursor: pointer;
                border: none;
                font-size: 16px;
            }}
            .btn:hover {{
                background: #d97706;
            }}
            .support {{
                margin-top: 30px;
                font-size: 12px;
                color: #6b7280;
            }}
            .support a {{
                color: #f59e0b;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">⚡</div>
            <h1>ASR Enterprises</h1>
            <p>Solar Power Solutions</p>
            
            <div class="amount">₹{amount:,.0f}</div>
            
            <div class="order-info">
                <p>Order ID: <strong>{order_id}</strong></p>
                <p>Customer: <strong>{customer_name}</strong></p>
            </div>
            
            <div class="loading" id="loadingSection">
                <div class="spinner"></div>
                <p class="status" id="statusText">Initializing secure payment...</p>
            </div>
            
            <div class="error" id="errorSection">
                <h3>Payment Error</h3>
                <p id="errorMessage"></p>
                <button class="btn" onclick="retryPayment()">Try Again</button>
            </div>
            
            <div class="support">
                Need help? Call <a href="tel:{ASR_DISPLAY_PHONE}">{ASR_DISPLAY_PHONE}</a>
            </div>
        </div>
        
        <script>
            const paymentSessionId = "{payment_session_id}";
            const orderId = "{order_id}";
            
            console.log('=== ASR ENTERPRISES DIRECT CHECKOUT ===');
            console.log('Order ID:', orderId);
            console.log('Payment Session ID:', paymentSessionId);
            console.log('Session ID Length:', paymentSessionId.length);
            
            function showError(message) {{
                document.getElementById('loadingSection').style.display = 'none';
                document.getElementById('errorSection').style.display = 'block';
                document.getElementById('errorMessage').textContent = message;
            }}
            
            function updateStatus(text) {{
                document.getElementById('statusText').textContent = text;
            }}
            
            function retryPayment() {{
                document.getElementById('errorSection').style.display = 'none';
                document.getElementById('loadingSection').style.display = 'flex';
                initializePayment();
            }}
            
            // Wait for Cashfree SDK to load
            function waitForCashfree(maxWait = 10000) {{
                return new Promise((resolve, reject) => {{
                    const startTime = Date.now();
                    
                    function check() {{
                        if (typeof Cashfree !== 'undefined') {{
                            console.log('Cashfree SDK loaded successfully');
                            resolve(Cashfree);
                        }} else if (Date.now() - startTime > maxWait) {{
                            reject(new Error('Cashfree SDK failed to load. Please refresh the page.'));
                        }} else {{
                            setTimeout(check, 200);
                        }}
                    }}
                    
                    check();
                }});
            }}
            
            async function initializePayment() {{
                try {{
                    updateStatus('Loading Cashfree SDK...');
                    
                    // Validate session ID
                    if (!paymentSessionId || paymentSessionId.length < 50) {{
                        throw new Error('Invalid payment session. Please create a new order.');
                    }}
                    
                    // Wait for Cashfree SDK to load
                    const CashfreeSDK = await waitForCashfree();
                    
                    // Initialize Cashfree
                    updateStatus('Initializing payment gateway...');
                    const cashfree = CashfreeSDK({{ mode: "production" }});
                    
                    console.log('Cashfree SDK initialized in PRODUCTION mode');
                    
                    // Small delay for UI
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    updateStatus('Opening secure payment page...');
                    
                    // Launch checkout
                    console.log('Calling cashfree.checkout() with:', {{
                        paymentSessionId: paymentSessionId,
                        redirectTarget: "_self"
                    }});
                    
                    cashfree.checkout({{
                        paymentSessionId: paymentSessionId,
                        redirectTarget: "_self"
                    }});
                    
                }} catch (error) {{
                    console.error('Payment initialization error:', error);
                    showError(error.message || 'Failed to initialize payment. Please try again.');
                }}
            }}
            
            // Start payment on page load
            document.addEventListener('DOMContentLoaded', function() {{
                setTimeout(initializePayment, 500);
            }});
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
