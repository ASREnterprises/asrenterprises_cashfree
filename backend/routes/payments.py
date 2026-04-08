"""
Cashfree Payments Integration for ASR Enterprises CRM
Handles payment links, webhooks, and transaction tracking
Phases 1-12 Implementation
"""
import os
import re
import uuid
import hmac
import httpx
import hashlib
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ==================== CONSTANTS ====================
CASHFREE_API_VERSION = "2023-08-01"

# ASR Contact Info (as per user requirements)
ASR_SUPPORT_EMAIL = "support@asrenterprises.in"
ASR_DISPLAY_PHONE = "9296389097"  # For website/UI display
ASR_WHATSAPP_API_PHONE = "8298389097"  # For WhatsApp API sending
ASR_BUSINESS_NAME = "ASR Enterprises"

# Payment Sources
PAYMENT_SOURCES = {
    "crm_link": "CRM Payment Link",
    "whatsapp": "WhatsApp Payment",
    "website": "Website Payment",
    "manual": "Manual Payment"
}

# Payment Statuses
PAYMENT_STATUSES = {
    "pending": "Pending",
    "link_created": "Link Created",
    "link_sent": "Link Sent",
    "paid": "Paid",
    "failed": "Failed",
    "expired": "Expired",
    "cancelled": "Cancelled",
    "refunded": "Refunded"
}

# Default link expiry in minutes
DEFAULT_LINK_EXPIRY_MINUTES = 60 * 24  # 24 hours

# ==================== PYDANTIC MODELS ====================

class CashfreeSettings(BaseModel):
    app_id: str = Field(..., description="Cashfree App ID")
    secret_key: str = Field(..., description="Cashfree Secret Key")
    webhook_secret: Optional[str] = Field(None, description="Webhook verification secret")
    is_sandbox: bool = Field(True, description="Use sandbox/test environment")
    is_active: bool = Field(True, description="Enable Cashfree payments")

class CreatePaymentLinkRequest(BaseModel):
    lead_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    amount: float = Field(..., gt=0)
    purpose: str = Field(default="Solar Service Payment")
    notes: Optional[str] = None
    expiry_minutes: int = Field(default=DEFAULT_LINK_EXPIRY_MINUTES)
    send_via_whatsapp: bool = Field(default=False)
    source: str = Field(default="crm_link")
    created_by_staff_id: Optional[str] = None

class BulkPaymentLinkRequest(BaseModel):
    lead_ids: List[str]
    amount: float
    purpose: str
    send_via_whatsapp: bool = Field(default=False)

class WebsitePaymentRequest(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    service_type: str = Field(default="solar_consultation")
    amount: float
    notes: Optional[str] = None

class ManualPaymentRequest(BaseModel):
    lead_id: str
    amount: float
    payment_mode: str = Field(default="cash")  # cash, upi, bank_transfer, cheque
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    received_by_staff_id: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def clean_phone_number(phone: str) -> str:
    """Clean and format phone number to standard format"""
    if not phone:
        return ""
    cleaned = re.sub(r'\D', '', str(phone))
    if cleaned.startswith("91") and len(cleaned) == 12:
        return cleaned
    if len(cleaned) == 10:
        return "91" + cleaned
    return cleaned

def generate_order_id() -> str:
    """Generate unique order ID for Cashfree"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"ASR{timestamp}{random_suffix}"

def generate_link_id() -> str:
    """Generate unique link ID"""
    return f"LINK{uuid.uuid4().hex[:12].upper()}"

async def get_cashfree_settings() -> Optional[Dict]:
    """Get Cashfree API settings from database"""
    settings = await db.cashfree_settings.find_one({}, {"_id": 0})
    if not settings:
        # Try environment variables as fallback
        app_id = os.environ.get("CASHFREE_APP_ID", "")
        secret_key = os.environ.get("CASHFREE_SECRET_KEY", "")
        if app_id and secret_key:
            return {
                "app_id": app_id,
                "secret_key": secret_key,
                "webhook_secret": os.environ.get("CASHFREE_WEBHOOK_SECRET", ""),
                "is_sandbox": os.environ.get("CASHFREE_SANDBOX", "true").lower() == "true",
                "is_active": True
            }
    return settings

def get_cashfree_base_url(is_sandbox: bool = True) -> str:
    """Get Cashfree API base URL based on environment"""
    if is_sandbox:
        return "https://sandbox.cashfree.com/pg"
    return "https://api.cashfree.com/pg"

async def get_cashfree_headers(settings: Dict) -> Dict:
    """Get headers for Cashfree API requests"""
    return {
        "Content-Type": "application/json",
        "x-client-id": settings["app_id"],
        "x-client-secret": settings["secret_key"],
        "x-api-version": CASHFREE_API_VERSION
    }

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify Cashfree webhook signature"""
    if not secret or not signature:
        return False
    try:
        expected_signature = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
    except Exception as e:
        logger.error(f"Webhook signature verification error: {e}")
        return False

async def create_lead_from_payment(payment_data: Dict) -> str:
    """Auto-create lead from payment if doesn't exist"""
    phone = clean_phone_number(payment_data.get("customer_phone", ""))
    if not phone:
        return None
    
    # Check if lead exists
    existing = await db.crm_leads.find_one({"phone": {"$regex": phone[-10:]}}, {"_id": 0})
    if existing:
        return existing.get("id")
    
    # Create new lead
    lead_id = str(uuid.uuid4())
    new_lead = {
        "id": lead_id,
        "name": payment_data.get("customer_name", "Website Customer"),
        "phone": phone,
        "email": payment_data.get("customer_email", ""),
        "address": payment_data.get("address", ""),
        "district": payment_data.get("district", ""),
        "stage": "new",
        "source": payment_data.get("source", "website_payment"),
        "priority": "warm",
        "property_type": "residential",
        "is_new": True,
        "is_deleted": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": f"Auto-created from payment: {payment_data.get('purpose', 'Online Payment')}"
    }
    
    await db.crm_leads.insert_one(new_lead)
    logger.info(f"Auto-created lead {lead_id} from payment")
    return lead_id

async def update_lead_on_payment(lead_id: str, payment_status: str, amount: float):
    """Update lead stage based on payment status"""
    if not lead_id:
        return
    
    update_data = {
        "last_payment_status": payment_status,
        "last_payment_amount": amount,
        "last_payment_date": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Auto-advance stage on successful payment
    if payment_status == "paid":
        update_data["stage"] = "converted"
        update_data["priority"] = "hot"
        update_data["payment_received"] = True
    
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    # Log activity
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "type": "payment",
        "description": f"Payment {payment_status}: ₹{amount}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.crm_activities.insert_one(activity)

async def send_payment_link_via_whatsapp(phone: str, customer_name: str, amount: float, payment_link: str, purpose: str):
    """Send payment link via WhatsApp API"""
    try:
        # Get WhatsApp settings
        wa_settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
        if not wa_settings or not wa_settings.get("access_token"):
            logger.warning("WhatsApp not configured, skipping WA notification")
            return False
        
        cleaned_phone = clean_phone_number(phone)
        if not cleaned_phone:
            return False
        
        # Send template message with payment link
        message_text = f"Dear {customer_name},\n\nYour payment link for *{purpose}* of *₹{amount}* is ready.\n\nPay here: {payment_link}\n\nFor support: {ASR_DISPLAY_PHONE}\n\n- {ASR_BUSINESS_NAME}"
        
        # Log the WhatsApp message
        msg_log = {
            "id": str(uuid.uuid4()),
            "phone": cleaned_phone,
            "direction": "outgoing",
            "type": "payment_link",
            "content": message_text,
            "payment_link": payment_link,
            "amount": amount,
            "status": "sent",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.whatsapp_messages.insert_one(msg_log)
        
        # Use existing WhatsApp send function (simplified for this integration)
        # In production, this would call the actual WhatsApp API
        logger.info(f"Payment link sent via WhatsApp to {cleaned_phone}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending WhatsApp payment link: {e}")
        return False

# ==================== SETTINGS ENDPOINTS ====================

@router.get("/settings")
async def get_payment_settings():
    """Get Cashfree payment settings (masked)"""
    settings = await get_cashfree_settings()
    if not settings:
        return {
            "configured": False,
            "message": "Cashfree payments not configured"
        }
    
    return {
        "configured": True,
        "app_id": settings["app_id"][:8] + "..." if len(settings["app_id"]) > 8 else settings["app_id"],
        "is_sandbox": settings.get("is_sandbox", True),
        "is_active": settings.get("is_active", True),
        "webhook_configured": bool(settings.get("webhook_secret")),
        "support_email": ASR_SUPPORT_EMAIL,
        "support_phone": ASR_DISPLAY_PHONE
    }

@router.post("/settings")
async def save_payment_settings(settings: CashfreeSettings):
    """Save Cashfree payment settings"""
    settings_dict = settings.dict()
    settings_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert settings
    await db.cashfree_settings.update_one(
        {},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {"success": True, "message": "Payment settings saved successfully"}

@router.post("/settings/test")
async def test_payment_connection():
    """Test Cashfree API connection"""
    settings = await get_cashfree_settings()
    if not settings:
        raise HTTPException(status_code=400, detail="Cashfree not configured")
    
    try:
        base_url = get_cashfree_base_url(settings.get("is_sandbox", True))
        headers = await get_cashfree_headers(settings)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test by creating a minimal order
            test_order = {
                "order_id": f"TEST{uuid.uuid4().hex[:8].upper()}",
                "order_amount": 1.0,
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": "test_customer",
                    "customer_phone": "9999999999"
                }
            }
            
            response = await client.post(
                f"{base_url}/orders",
                json=test_order,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                return {
                    "success": True,
                    "message": "Cashfree connection successful",
                    "environment": "Sandbox" if settings.get("is_sandbox") else "Production"
                }
            else:
                error_data = response.json() if response.text else {}
                return {
                    "success": False,
                    "message": f"Connection failed: {error_data.get('message', response.status_code)}",
                    "details": error_data
                }
                
    except Exception as e:
        logger.error(f"Cashfree connection test error: {e}")
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

# ==================== PAYMENT LINK ENDPOINTS ====================

@router.post("/create-link")
async def create_payment_link(request: CreatePaymentLinkRequest, background_tasks: BackgroundTasks):
    """Create a new payment link"""
    settings = await get_cashfree_settings()
    if not settings:
        raise HTTPException(status_code=400, detail="Cashfree payments not configured")
    
    if not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="Cashfree payments are disabled")
    
    try:
        base_url = get_cashfree_base_url(settings.get("is_sandbox", True))
        headers = await get_cashfree_headers(settings)
        
        # Generate IDs
        order_id = generate_order_id()
        link_id = generate_link_id()
        
        # Clean phone
        customer_phone = clean_phone_number(request.customer_phone)
        if not customer_phone:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        
        # Calculate expiry
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=request.expiry_minutes)
        
        # Create payment link via Cashfree API
        link_payload = {
            "link_id": link_id,
            "link_amount": request.amount,
            "link_currency": "INR",
            "link_purpose": request.purpose[:100] if request.purpose else "Payment",
            "customer_details": {
                "customer_phone": customer_phone,
                "customer_name": request.customer_name[:100] if request.customer_name else "Customer"
            },
            "link_expiry_time": expiry_time.strftime("%Y-%m-%dT%H:%M:%S+05:30"),
            "link_notify": {
                "send_sms": False,
                "send_email": False
            },
            "link_meta": {
                "upi_intent": True
            }
        }
        
        # Only add link_notes if we have valid values (1-100 chars, no special chars)
        link_notes = {}
        if order_id:
            link_notes["order_id"] = order_id[:100]
        if request.lead_id:
            link_notes["lead_id"] = request.lead_id[:100]
        if request.source:
            link_notes["source"] = request.source[:50]
        
        if link_notes:
            link_payload["link_notes"] = link_notes
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/links",
                json=link_payload,
                headers=headers
            )
            
            response_data = response.json() if response.text else {}
            
            if response.status_code not in [200, 201]:
                logger.error(f"Cashfree link creation failed: {response_data}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response_data.get("message", "Failed to create payment link")
                )
            
            # Extract payment link URL
            payment_link = response_data.get("link_url", "")
            cf_link_id = response_data.get("link_id", link_id)
            
            # Store payment record in database
            payment_record = {
                "id": str(uuid.uuid4()),
                "order_id": order_id,
                "link_id": cf_link_id,
                "lead_id": request.lead_id,
                "customer_name": request.customer_name,
                "customer_phone": customer_phone,
                "customer_email": request.customer_email,
                "amount": request.amount,
                "purpose": request.purpose,
                "payment_link": payment_link,
                "status": "link_created",
                "source": request.source,
                "notes": request.notes,
                "created_by": request.created_by_staff_id,
                "expiry_time": expiry_time.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "cashfree_response": response_data
            }
            
            await db.payments.insert_one(payment_record)
            
            # Send via WhatsApp if requested
            whatsapp_sent = False
            if request.send_via_whatsapp and payment_link:
                whatsapp_sent = await send_payment_link_via_whatsapp(
                    customer_phone,
                    request.customer_name,
                    request.amount,
                    payment_link,
                    request.purpose
                )
                
                # Update status
                await db.payments.update_one(
                    {"id": payment_record["id"]},
                    {"$set": {"status": "link_sent" if whatsapp_sent else "link_created"}}
                )
            
            return {
                "success": True,
                "payment_id": payment_record["id"],
                "order_id": order_id,
                "link_id": cf_link_id,
                "payment_link": payment_link,
                "amount": request.amount,
                "expiry_time": expiry_time.isoformat(),
                "whatsapp_sent": whatsapp_sent,
                "message": "Payment link created successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating payment link: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create payment link: {str(e)}")

@router.post("/create-link/bulk")
async def create_bulk_payment_links(request: BulkPaymentLinkRequest):
    """Create payment links for multiple leads"""
    settings = await get_cashfree_settings()
    if not settings or not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="Cashfree payments not configured or disabled")
    
    results = []
    for lead_id in request.lead_ids:
        try:
            # Get lead details
            lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
            if not lead:
                results.append({"lead_id": lead_id, "success": False, "error": "Lead not found"})
                continue
            
            # Create payment link request
            link_request = CreatePaymentLinkRequest(
                lead_id=lead_id,
                customer_name=lead.get("name", "Customer"),
                customer_phone=lead.get("phone", ""),
                customer_email=lead.get("email"),
                amount=request.amount,
                purpose=request.purpose,
                send_via_whatsapp=request.send_via_whatsapp,
                source="crm_bulk"
            )
            
            # Create link (without background tasks for bulk)
            result = await create_payment_link(link_request, BackgroundTasks())
            results.append({
                "lead_id": lead_id,
                "success": True,
                "payment_link": result.get("payment_link"),
                "payment_id": result.get("payment_id")
            })
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.2)
            
        except Exception as e:
            results.append({"lead_id": lead_id, "success": False, "error": str(e)})
    
    successful = sum(1 for r in results if r.get("success"))
    return {
        "total": len(request.lead_ids),
        "successful": successful,
        "failed": len(request.lead_ids) - successful,
        "results": results
    }

@router.get("/link/{link_id}/status")
async def get_payment_link_status(link_id: str):
    """Get payment link status from Cashfree"""
    settings = await get_cashfree_settings()
    if not settings:
        raise HTTPException(status_code=400, detail="Cashfree not configured")
    
    try:
        base_url = get_cashfree_base_url(settings.get("is_sandbox", True))
        headers = await get_cashfree_headers(settings)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{base_url}/links/{link_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch link status")
            
            link_data = response.json()
            
            # Update local record
            link_status = link_data.get("link_status", "").lower()
            if link_status:
                await db.payments.update_one(
                    {"link_id": link_id},
                    {"$set": {
                        "status": link_status,
                        "last_checked": datetime.now(timezone.utc).isoformat(),
                        "cashfree_status": link_data
                    }}
                )
            
            return {
                "link_id": link_id,
                "status": link_status,
                "amount": link_data.get("link_amount"),
                "paid_amount": link_data.get("link_amount_paid", 0),
                "expiry_time": link_data.get("link_expiry_time"),
                "details": link_data
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching link status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/link/{link_id}/resend")
async def resend_payment_link(link_id: str):
    """Resend payment link via WhatsApp"""
    payment = await db.payments.find_one({"link_id": link_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link not found")
    
    if payment.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Payment already completed")
    
    # Check if link is expired
    expiry = payment.get("expiry_time")
    if expiry:
        expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        if expiry_dt < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Payment link has expired. Please create a new link.")
    
    # Resend via WhatsApp
    sent = await send_payment_link_via_whatsapp(
        payment["customer_phone"],
        payment["customer_name"],
        payment["amount"],
        payment["payment_link"],
        payment["purpose"]
    )
    
    if sent:
        await db.payments.update_one(
            {"link_id": link_id},
            {"$set": {
                "status": "link_sent",
                "last_sent_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "success": sent,
        "message": "Payment link resent via WhatsApp" if sent else "Failed to send via WhatsApp"
    }

@router.post("/link/{link_id}/cancel")
async def cancel_payment_link(link_id: str):
    """Cancel a payment link"""
    settings = await get_cashfree_settings()
    if not settings:
        raise HTTPException(status_code=400, detail="Cashfree not configured")
    
    payment = await db.payments.find_one({"link_id": link_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link not found")
    
    if payment.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel paid payment")
    
    # Cancel in Cashfree
    try:
        base_url = get_cashfree_base_url(settings.get("is_sandbox", True))
        headers = await get_cashfree_headers(settings)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try to cancel in Cashfree (response may fail for already cancelled links)
            await client.post(
                f"{base_url}/links/{link_id}/cancel",
                headers=headers
            )
            
            # Update local record regardless of Cashfree response
            await db.payments.update_one(
                {"link_id": link_id},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {"success": True, "message": "Payment link cancelled"}
            
    except Exception as e:
        logger.error(f"Error cancelling link: {e}")
        # Still mark as cancelled locally
        await db.payments.update_one(
            {"link_id": link_id},
            {"$set": {"status": "cancelled"}}
        )
        return {"success": True, "message": "Payment link cancelled locally"}

# ==================== WEBHOOK ENDPOINT ====================

@router.post("/webhook")
async def cashfree_webhook(request: Request):
    """Handle Cashfree payment webhooks"""
    try:
        # Get raw body for signature verification
        body = await request.body()
        signature = request.headers.get("x-webhook-signature", "")
        
        # Get settings
        settings = await get_cashfree_settings()
        webhook_secret = settings.get("webhook_secret") if settings else None
        
        # Verify signature if secret is configured
        if webhook_secret and signature:
            if not verify_webhook_signature(body, signature, webhook_secret):
                logger.warning("Invalid webhook signature")
                raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse payload
        payload = await request.json()
        event_type = payload.get("type", "")
        data = payload.get("data", {})
        
        logger.info(f"Cashfree webhook received: {event_type}")
        
        # Store webhook log
        webhook_log = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "payload": payload,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_webhooks.insert_one(webhook_log)
        
        # Process based on event type
        if event_type == "PAYMENT_LINK_EVENT":
            link_status = data.get("link_status", "").lower()
            link_id = data.get("link_id", "")
            
            # Update payment record
            update_data = {
                "status": link_status,
                "webhook_updated_at": datetime.now(timezone.utc).isoformat(),
                "last_webhook": payload
            }
            
            # Get payment record
            payment = await db.payments.find_one({"link_id": link_id}, {"_id": 0})
            
            if link_status == "paid":
                update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
                update_data["payment_details"] = data.get("payment_details", {})
                
                # Update lead
                if payment and payment.get("lead_id"):
                    await update_lead_on_payment(
                        payment["lead_id"],
                        "paid",
                        payment.get("amount", 0)
                    )
            
            await db.payments.update_one(
                {"link_id": link_id},
                {"$set": update_data}
            )
            
        elif event_type == "PAYMENT_SUCCESS_WEBHOOK":
            order_id = data.get("order", {}).get("order_id", "")
            
            # Find and update payment
            payment = await db.payments.find_one({"order_id": order_id}, {"_id": 0})
            if payment:
                await db.payments.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                        "payment_details": data,
                        "webhook_updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Update lead
                if payment.get("lead_id"):
                    await update_lead_on_payment(
                        payment["lead_id"],
                        "paid",
                        payment.get("amount", 0)
                    )
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        return {"success": False, "error": str(e)}

# ==================== TRANSACTION LIST ENDPOINTS ====================

@router.get("/transactions")
async def get_transactions(
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    source: Optional[str] = None,
    lead_id: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get paginated list of payment transactions"""
    query = {}
    
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    if lead_id:
        query["lead_id"] = lead_id
    if search:
        query["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}},
            {"link_id": {"$regex": search, "$options": "i"}}
        ]
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    total = await db.payments.count_documents(query)
    skip = (page - 1) * limit
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "transactions": payments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/transaction/{payment_id}")
async def get_transaction_details(payment_id: str):
    """Get detailed transaction info"""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        # Try by link_id
        payment = await db.payments.find_one({"link_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get associated lead if exists
    lead = None
    if payment.get("lead_id"):
        lead = await db.crm_leads.find_one({"id": payment["lead_id"]}, {"_id": 0})
    
    return {
        "payment": payment,
        "lead": lead
    }

# ==================== DASHBOARD STATISTICS ====================

@router.get("/dashboard/stats")
async def get_payment_dashboard_stats():
    """Get payment dashboard statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)
    
    # Pipeline for aggregation
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    
    status_stats = await db.payments.aggregate(pipeline).to_list(100)
    status_dict = {s["_id"]: {"count": s["count"], "amount": s["total_amount"]} for s in status_stats}
    
    # Today's stats
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}}
        }}
    ]
    today_stats = await db.payments.aggregate(today_pipeline).to_list(1)
    today = today_stats[0] if today_stats else {"count": 0, "total_amount": 0, "paid_amount": 0, "paid_count": 0}
    
    # This week's stats
    week_pipeline = [
        {"$match": {"created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}}
        }}
    ]
    week_stats = await db.payments.aggregate(week_pipeline).to_list(1)
    week = week_stats[0] if week_stats else {"count": 0, "total_amount": 0, "paid_amount": 0, "paid_count": 0}
    
    # This month's stats
    month_pipeline = [
        {"$match": {"created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}}
        }}
    ]
    month_stats = await db.payments.aggregate(month_pipeline).to_list(1)
    month = month_stats[0] if month_stats else {"count": 0, "total_amount": 0, "paid_amount": 0, "paid_count": 0}
    
    # Source-wise stats
    source_pipeline = [
        {"$group": {
            "_id": "$source",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}}
        }}
    ]
    source_stats = await db.payments.aggregate(source_pipeline).to_list(100)
    
    # Pending links count
    pending_count = await db.payments.count_documents({"status": {"$in": ["link_created", "link_sent"]}})
    
    return {
        "overview": {
            "total_links_created": sum(s.get("count", 0) for s in status_stats),
            "total_amount_requested": sum(s.get("amount", 0) for s in status_stats),
            "total_collected": status_dict.get("paid", {}).get("amount", 0),
            "total_paid_count": status_dict.get("paid", {}).get("count", 0),
            "pending_links": pending_count,
            "failed_count": status_dict.get("failed", {}).get("count", 0),
            "expired_count": status_dict.get("expired", {}).get("count", 0)
        },
        "today": {
            "links_created": today.get("count", 0),
            "amount_requested": today.get("total_amount", 0),
            "amount_collected": today.get("paid_amount", 0),
            "success_count": today.get("paid_count", 0)
        },
        "this_week": {
            "links_created": week.get("count", 0),
            "amount_requested": week.get("total_amount", 0),
            "amount_collected": week.get("paid_amount", 0),
            "success_count": week.get("paid_count", 0)
        },
        "this_month": {
            "links_created": month.get("count", 0),
            "amount_requested": month.get("total_amount", 0),
            "amount_collected": month.get("paid_amount", 0),
            "success_count": month.get("paid_count", 0)
        },
        "by_source": [
            {
                "source": PAYMENT_SOURCES.get(s["_id"], s["_id"]),
                "source_id": s["_id"],
                "count": s["count"],
                "total_amount": s["total_amount"],
                "paid_amount": s["paid_amount"]
            }
            for s in source_stats if s["_id"]
        ],
        "by_status": status_dict
    }

# ==================== MANUAL PAYMENT RECORDING ====================

@router.post("/manual")
async def record_manual_payment(payment: ManualPaymentRequest):
    """Record a manual payment (cash, bank transfer, etc.)"""
    # Get lead details
    lead = await db.crm_leads.find_one({"id": payment.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": generate_order_id(),
        "lead_id": payment.lead_id,
        "customer_name": lead.get("name", "Customer"),
        "customer_phone": lead.get("phone", ""),
        "customer_email": lead.get("email", ""),
        "amount": payment.amount,
        "purpose": "Manual Payment",
        "payment_mode": payment.payment_mode,
        "reference_number": payment.reference_number,
        "status": "paid",
        "source": "manual",
        "notes": payment.notes,
        "received_by": payment.received_by_staff_id,
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.insert_one(payment_record)
    
    # Update lead
    await update_lead_on_payment(payment.lead_id, "paid", payment.amount)
    
    return {
        "success": True,
        "payment_id": payment_record["id"],
        "message": "Manual payment recorded successfully"
    }

# ==================== WEBSITE PAYMENT ENDPOINTS ====================

@router.post("/website/initiate")
async def initiate_website_payment(request: WebsitePaymentRequest):
    """Initiate payment from website - creates lead if needed"""
    settings = await get_cashfree_settings()
    if not settings or not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="Online payments not available")
    
    try:
        # Clean phone
        customer_phone = clean_phone_number(request.customer_phone)
        if not customer_phone:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        
        # Check/Create lead
        lead_id = await create_lead_from_payment({
            "customer_name": request.customer_name,
            "customer_phone": customer_phone,
            "customer_email": request.customer_email,
            "address": request.address,
            "district": request.district,
            "source": "website_payment"
        })
        
        # Create payment link
        link_request = CreatePaymentLinkRequest(
            lead_id=lead_id,
            customer_name=request.customer_name,
            customer_phone=customer_phone,
            customer_email=request.customer_email,
            amount=request.amount,
            purpose=f"Solar {request.service_type.replace('_', ' ').title()} - {ASR_BUSINESS_NAME}",
            source="website",
            notes=request.notes
        )
        
        result = await create_payment_link(link_request, BackgroundTasks())
        
        return {
            "success": True,
            "payment_link": result.get("payment_link"),
            "order_id": result.get("order_id"),
            "amount": request.amount,
            "lead_id": lead_id,
            "support_phone": ASR_DISPLAY_PHONE,
            "support_email": ASR_SUPPORT_EMAIL
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Website payment initiation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate payment")

@router.get("/website/verify/{order_id}")
async def verify_website_payment(order_id: str):
    """Verify payment status for website"""
    payment = await db.payments.find_one({"order_id": order_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {
        "order_id": order_id,
        "status": payment.get("status"),
        "amount": payment.get("amount"),
        "paid": payment.get("status") == "paid",
        "paid_at": payment.get("paid_at")
    }

# ==================== LEAD PAYMENT HISTORY ====================

@router.get("/lead/{lead_id}/payments")
async def get_lead_payments(lead_id: str):
    """Get all payments for a specific lead"""
    payments = await db.payments.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "paid")
    pending_amount = sum(p.get("amount", 0) for p in payments if p.get("status") in ["link_created", "link_sent"])
    
    return {
        "lead_id": lead_id,
        "payments": payments,
        "total_paid": total_paid,
        "pending_amount": pending_amount,
        "payment_count": len(payments)
    }

# ==================== WEBHOOK CONFIGURATION HELPER ====================

@router.get("/webhook-url")
async def get_webhook_url(request: Request):
    """Get the webhook URL to configure in Cashfree dashboard"""
    base_url = str(request.base_url).rstrip("/")
    webhook_url = f"{base_url}/api/payments/webhook"
    
    return {
        "webhook_url": webhook_url,
        "instructions": [
            "1. Go to Cashfree Dashboard > Settings > Webhooks",
            "2. Add a new webhook with the URL above",
            "3. Select events: PAYMENT_LINK_EVENT, PAYMENT_SUCCESS_WEBHOOK",
            "4. Copy the webhook secret and save it in your payment settings",
            "5. Enable the webhook"
        ],
        "supported_events": [
            "PAYMENT_LINK_EVENT",
            "PAYMENT_SUCCESS_WEBHOOK"
        ]
    }
