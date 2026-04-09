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

# ASR Contact Info
ASR_SUPPORT_EMAIL = "support@asrenterprises.in"
ASR_DISPLAY_PHONE = "9296389097"
ASR_WHATSAPP_API_PHONE = "8298389097"
ASR_BUSINESS_NAME = "ASR Enterprises"
ASR_WEBSITE = os.environ.get("ASR_WEBSITE", "https://asrenterprises.in")

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

class WebsiteOrderRequest(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    payment_type: str = Field(default="booking")
    amount: float = Field(..., gt=0)
    notes: Optional[str] = None

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
    """Get Cashfree API settings from env/db"""
    # Primary: Environment variables
    app_id = os.environ.get("CASHFREE_APP_ID", "")
    secret_key = os.environ.get("CASHFREE_SECRET_KEY", "")
    sandbox_env = os.environ.get("CASHFREE_SANDBOX", "false").lower()
    env_mode = os.environ.get("CASHFREE_ENV", "PRODUCTION").upper()
    
    # Determine if sandbox mode - MUST be explicitly set to true
    is_sandbox = sandbox_env == "true" or env_mode == "SANDBOX"
    
    logger.info(f"Cashfree Config: ENV={env_mode}, SANDBOX_VAR={sandbox_env}, is_sandbox={is_sandbox}")
    
    if app_id and secret_key:
        return {
            "app_id": app_id,
            "secret_key": secret_key,
            "is_sandbox": is_sandbox,
            "webhook_secret": os.environ.get("CASHFREE_WEBHOOK_SECRET", ""),
            "is_active": True
        }
    
    # Fallback: Database settings
    settings = await db.cashfree_settings.find_one({}, {"_id": 0})
    return settings

def get_cashfree_api_url(is_sandbox: bool = False) -> str:
    """Get Cashfree API base URL"""
    if is_sandbox:
        return "https://sandbox.cashfree.com/pg"
    return "https://api.cashfree.com/pg"

def get_cashfree_headers(config: Dict) -> Dict:
    """Get headers for Cashfree API requests"""
    return {
        "Content-Type": "application/json",
        "x-client-id": config["app_id"],
        "x-client-secret": config["secret_key"],
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
                                 payment_url: str, purpose: str, msg_type: str = "payment_request"):
    """Send payment notification via WhatsApp API"""
    try:
        wa_settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
        if not wa_settings or not wa_settings.get("access_token"):
            logger.warning("WhatsApp not configured")
            return False
        
        cleaned_phone = clean_phone_with_country(phone)
        if not cleaned_phone:
            return False
        
        access_token = wa_settings.get("access_token")
        phone_number_id = wa_settings.get("phone_number_id")
        
        if not access_token or not phone_number_id:
            return False
        
        # Create message based on type
        if msg_type == "payment_request":
            message = f"""Dear {customer_name},

Your payment request from *{ASR_BUSINESS_NAME}* is ready.

*Purpose:* {purpose}
*Amount:* ₹{amount:,.0f}

Pay securely here:
{payment_url}

Need help? Reply on WhatsApp or call {ASR_DISPLAY_PHONE}

Thank you,
{ASR_BUSINESS_NAME}
{ASR_WEBSITE}"""
        
        elif msg_type == "payment_success":
            message = f"""Dear {customer_name},

*Payment Received Successfully!*

Amount: ₹{amount:,.0f}
Purpose: {purpose}

Thank you for choosing {ASR_BUSINESS_NAME}.
Our team will contact you shortly.

For support: {ASR_DISPLAY_PHONE}
{ASR_WEBSITE}"""
        
        elif msg_type == "payment_reminder":
            message = f"""Dear {customer_name},

Gentle reminder: Your payment of ₹{amount:,.0f} for *{purpose}* is pending.

Complete payment here:
{payment_url}

Questions? Call {ASR_DISPLAY_PHONE}

{ASR_BUSINESS_NAME}"""
        
        else:
            message = f"""Dear {customer_name},

Update from {ASR_BUSINESS_NAME}:
{purpose}

Amount: ₹{amount:,.0f}

Contact: {ASR_DISPLAY_PHONE}
{ASR_WEBSITE}"""
        
        # Send via WhatsApp Business API
        wa_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
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
                
                # Log the message
                await db.whatsapp_messages.insert_one({
                    "id": str(uuid.uuid4()),
                    "wa_message_id": wa_message_id,
                    "phone": cleaned_phone,
                    "direction": "outgoing",
                    "type": msg_type,
                    "content": message,
                    "status": "sent",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                logger.info(f"WhatsApp {msg_type} sent to {cleaned_phone}")
                return True
            else:
                logger.error(f"WhatsApp API error: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Error sending WhatsApp: {e}")
        return False

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
    """Get Cashfree configuration status"""
    config = await get_cashfree_config()
    if not config:
        return {
            "configured": False,
            "message": "Cashfree not configured"
        }
    
    is_production = not config.get("is_sandbox", True)
    
    return {
        "configured": True,
        "environment": "PRODUCTION" if is_production else "SANDBOX",
        "api_mode": "orders_api",
        "support_email": ASR_SUPPORT_EMAIL,
        "support_phone": ASR_DISPLAY_PHONE,
        "whatsapp_api_phone": ASR_WHATSAPP_API_PHONE,
        "business_name": ASR_BUSINESS_NAME,
        "payment_types": PAYMENT_TYPES
    }

@router.post("/create-order")
async def create_cashfree_order(request: CreateOrderRequest):
    """Create a new Cashfree order for hosted checkout"""
    config = await get_cashfree_config()
    if not config:
        raise HTTPException(status_code=400, detail="Cashfree payments not configured")
    
    if not config.get("is_active"):
        raise HTTPException(status_code=400, detail="Cashfree payments disabled")
    
    try:
        base_url = get_cashfree_api_url(config.get("is_sandbox", False))
        headers = get_cashfree_headers(config)
        
        # Generate order ID
        order_id = generate_order_id()
        
        # Clean phone
        customer_phone = clean_phone_number(request.customer_phone)
        if not customer_phone or len(customer_phone) != 10:
            raise HTTPException(status_code=400, detail="Invalid phone number. Please provide 10-digit mobile number.")
        
        # Determine return URL
        return_url = request.return_url or f"{ASR_WEBSITE}/payment/status?order_id={order_id}"
        
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
                "notify_url": f"{ASR_WEBSITE}/api/cashfree/webhook"
            },
            "order_note": f"{request.purpose[:100]} - {request.payment_type}"
        }
        
        # Add email if provided
        if request.customer_email:
            order_payload["customer_details"]["customer_email"] = request.customer_email
        
        logger.info(f"Creating Cashfree order: {order_id}, amount: {request.amount}")
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                f"{base_url}/orders",
                json=order_payload,
                headers=headers
            )
            
            response_data = response.json() if response.text else {}
            
            if response.status_code not in [200, 201]:
                logger.error(f"Cashfree order creation failed: {response_data}")
                error_msg = response_data.get("message", "Failed to create order")
                raise HTTPException(status_code=response.status_code, detail=error_msg)
            
            # Extract payment session URL
            payment_session_id = response_data.get("payment_session_id", "")
            cf_order_id = response_data.get("cf_order_id", "")
            order_status = response_data.get("order_status", "ACTIVE")
            
            # Get payment URL for hosted checkout
            # Use our custom checkout page that loads Cashfree JS SDK
            # This avoids the S2S requirement
            is_sandbox = config.get("is_sandbox", False)
            
            # Direct Cashfree URL (may require S2S approval)
            if is_sandbox:
                direct_payment_url = f"https://payments-test.cashfree.com/order/#/{payment_session_id}"
            else:
                direct_payment_url = f"https://payments.cashfree.com/order/#/{payment_session_id}"
            
            # Our custom checkout page (uses JS SDK - works without S2S)
            checkout_url = f"{ASR_WEBSITE}/payment/checkout?session_id={payment_session_id}&order_id={order_id}"
            
            logger.info(f"Generated PRODUCTION checkout URL: {checkout_url[:80]}...")
            
            # Use our checkout page as primary (more reliable)
            payment_url = checkout_url
            
            # Store order in database
            order_record = {
                "id": str(uuid.uuid4()),
                "order_id": order_id,
                "cf_order_id": cf_order_id,
                "payment_session_id": payment_session_id,
                "payment_url": payment_url,
                "direct_cashfree_url": direct_payment_url,
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
            
            return {
                "success": True,
                "order_id": order_id,
                "cf_order_id": cf_order_id,
                "payment_url": payment_url,
                "direct_cashfree_url": direct_payment_url,
                "payment_session_id": payment_session_id,
                "amount": request.amount,
                "status": order_status,
                "whatsapp_sent": whatsapp_sent,
                "return_url": return_url,
                "message": "Order created successfully. Redirect customer to payment_url"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Cashfree order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@router.post("/website/create-order")
async def create_website_order(request: WebsiteOrderRequest):
    """Create order from website - auto-creates lead"""
    config = await get_cashfree_config()
    if not config or not config.get("is_active"):
        raise HTTPException(status_code=400, detail="Online payments not available")
    
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
            send_via_whatsapp=False  # Will be sent via webhook on success
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
        "created_at": order.get("created_at")
    }

@router.get("/order/{order_id}/refresh")
async def refresh_order_status(order_id: str):
    """Refresh order status from Cashfree API"""
    config = await get_cashfree_config()
    if not config:
        raise HTTPException(status_code=400, detail="Cashfree not configured")
    
    try:
        base_url = get_cashfree_api_url(config.get("is_sandbox", False))
        headers = get_cashfree_headers(config)
        
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
        
        # Get webhook secret
        config = await get_cashfree_config()
        webhook_secret = config.get("webhook_secret") if config else ""
        
        # Verify signature
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
                    
                    # Send WhatsApp confirmation
                    await send_payment_whatsapp(
                        order["customer_phone"],
                        order["customer_name"],
                        payment_amount,
                        "",
                        order["purpose"],
                        "payment_success"
                    )
                    
                    processing_result = {
                        "processed": True,
                        "message": "Payment marked as PAID",
                        "amount": payment_amount
                    }
                    logger.info(f"Payment SUCCESS: order={order_id}, amount={payment_amount}")
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
    search: Optional[str] = None
):
    """Get paginated list of orders"""
    query = {}
    
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
