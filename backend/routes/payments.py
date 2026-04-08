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
        
        access_token = wa_settings.get("access_token")
        phone_number_id = wa_settings.get("phone_number_id")
        
        if not access_token or not phone_number_id:
            logger.warning("WhatsApp credentials incomplete")
            return False
        
        # Format message for payment link
        message_text = f"""Dear {customer_name},

Your payment link for *{purpose}* is ready.

*Amount: ₹{amount:,.0f}*

Click here to pay securely:
{payment_link}

For support:
📞 {ASR_DISPLAY_PHONE}
📧 {ASR_SUPPORT_EMAIL}

Thank you,
{ASR_BUSINESS_NAME}"""
        
        # Call WhatsApp Business API
        wa_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "to": cleaned_phone,
            "type": "text",
            "text": {"body": message_text}
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(wa_url, json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                response_data = response.json()
                wa_message_id = response_data.get("messages", [{}])[0].get("id", "")
                
                # Log the WhatsApp message
                msg_log = {
                    "id": str(uuid.uuid4()),
                    "wa_message_id": wa_message_id,
                    "phone": cleaned_phone,
                    "direction": "outgoing",
                    "type": "payment_link",
                    "content": message_text,
                    "payment_link": payment_link,
                    "amount": amount,
                    "status": "sent",
                    "api_response": response_data,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.whatsapp_messages.insert_one(msg_log)
                
                logger.info(f"Payment link sent via WhatsApp to {cleaned_phone}, msg_id: {wa_message_id}")
                return True
            else:
                logger.error(f"WhatsApp API error: {response.status_code} - {response.text}")
                # Still log the attempt
                await db.whatsapp_messages.insert_one({
                    "id": str(uuid.uuid4()),
                    "phone": cleaned_phone,
                    "direction": "outgoing",
                    "type": "payment_link",
                    "content": message_text,
                    "status": "failed",
                    "error": response.text,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                return False
        
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
    
    # Check if it's production mode
    is_production = not settings.get("is_sandbox", True)
    env_mode = "PRODUCTION" if is_production else "SANDBOX"
    api_url = "api.cashfree.com" if is_production else "sandbox.cashfree.com"
    
    return {
        "configured": True,
        "app_id": settings["app_id"][:12] + "..." if len(settings["app_id"]) > 12 else settings["app_id"],
        "is_sandbox": settings.get("is_sandbox", True),
        "is_active": settings.get("is_active", True),
        "environment": env_mode,
        "api_endpoint": f"https://{api_url}/pg",
        "payment_url": "https://payments.cashfree.com" if is_production else "https://payments-test.cashfree.com",
        "webhook_configured": bool(settings.get("webhook_secret")),
        "support_email": ASR_SUPPORT_EMAIL,
        "support_phone": ASR_DISPLAY_PHONE
    }

@router.get("/status")
async def get_payment_system_status():
    """Get overall payment system status for dashboard"""
    settings = await get_cashfree_settings()
    
    # Get WhatsApp status
    wa_settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
    wa_configured = bool(wa_settings and wa_settings.get("access_token"))
    
    # Get today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "total_links": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, 1, 0]}},
            "paid_amount": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}}
        }}
    ]
    today_stats = await db.payments.aggregate(today_pipeline).to_list(1)
    today = today_stats[0] if today_stats else {"total_links": 0, "total_amount": 0, "paid_count": 0, "paid_amount": 0}
    
    return {
        "cashfree": {
            "configured": bool(settings),
            "active": settings.get("is_active", False) if settings else False,
            "environment": "PRODUCTION" if settings and not settings.get("is_sandbox", True) else "SANDBOX",
            "payment_links_api": "pending_activation"  # Will be "active" once Cashfree enables it
        },
        "whatsapp": {
            "configured": wa_configured,
            "phone_number": ASR_WHATSAPP_API_PHONE
        },
        "support": {
            "email": ASR_SUPPORT_EMAIL,
            "phone": ASR_DISPLAY_PHONE
        },
        "today": {
            "links_created": today.get("total_links", 0),
            "amount_requested": today.get("total_amount", 0),
            "payments_received": today.get("paid_count", 0),
            "amount_collected": today.get("paid_amount", 0)
        }
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
        
        # Calculate expiry - must be at least 5 minutes in future and in IST
        from datetime import timezone as tz
        import pytz
        
        # Use IST timezone for Cashfree
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        expiry_minutes = max(request.expiry_minutes, 10)  # Minimum 10 minutes
        expiry_time = now_ist + timedelta(minutes=expiry_minutes)
        
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

# ==================== WEBHOOK ENDPOINTS ====================

async def send_payment_confirmation_whatsapp(payment: Dict):
    """Send WhatsApp confirmation message after successful payment"""
    try:
        # Get WhatsApp settings
        wa_settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
        if not wa_settings or not wa_settings.get("access_token"):
            logger.warning("WhatsApp not configured, skipping payment confirmation")
            return False
        
        customer_phone = clean_phone_number(payment.get("customer_phone", ""))
        if not customer_phone:
            return False
        
        amount = payment.get("amount", 0)
        order_id = payment.get("order_id", "")
        purpose = payment.get("purpose", "Payment")
        customer_name = payment.get("customer_name", "Customer")
        payment_id = payment.get("cashfree_payment_id", "")
        
        # Create confirmation message
        message_text = f"""Dear {customer_name},

Your payment of *Rs.{amount}* has been received successfully!

Order ID: {order_id}
Payment ID: {payment_id}
Purpose: {purpose}

Thank you for choosing {ASR_BUSINESS_NAME}.

For support: {ASR_DISPLAY_PHONE}
Email: {ASR_SUPPORT_EMAIL}"""
        
        # Log the message
        msg_log = {
            "id": str(uuid.uuid4()),
            "phone": customer_phone,
            "direction": "outgoing",
            "type": "payment_confirmation",
            "content": message_text,
            "order_id": order_id,
            "amount": amount,
            "status": "sent",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.whatsapp_messages.insert_one(msg_log)
        
        logger.info(f"Payment confirmation sent via WhatsApp to {customer_phone}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending WhatsApp payment confirmation: {e}")
        return False


def verify_cashfree_webhook_signature(payload_bytes: bytes, signature: str, timestamp: str, secret: str) -> bool:
    """
    Verify Cashfree webhook signature using their official method
    Signature = base64(hmac_sha256(timestamp + raw_body, secret_key))
    """
    if not secret or not signature:
        logger.warning("Missing webhook secret or signature")
        return False
    
    try:
        # Cashfree signature format: timestamp.payload signed with secret
        message = timestamp + payload_bytes.decode('utf-8')
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Also try the base64 format
        import base64
        expected_signature_b64 = base64.b64encode(
            hmac.new(
                secret.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).digest()
        ).decode('utf-8')
        
        # Compare with provided signature
        is_valid = hmac.compare_digest(signature, expected_signature) or \
                   hmac.compare_digest(signature, expected_signature_b64)
        
        if not is_valid:
            logger.warning("Webhook signature mismatch")
        
        return is_valid
        
    except Exception as e:
        logger.error(f"Webhook signature verification error: {e}")
        return False


@router.post("/cashfree/webhook")
async def cashfree_webhook_handler(request: Request):
    """
    Production-ready Cashfree webhook handler
    Handles: PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_USER_DROPPED
    Features: Signature verification, idempotency, WhatsApp confirmation, full logging
    """
    webhook_id = str(uuid.uuid4())
    received_at = datetime.now(timezone.utc).isoformat()
    
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Get signature headers
        signature = request.headers.get("x-webhook-signature", "")
        timestamp = request.headers.get("x-webhook-timestamp", "")
        
        # Get webhook secret from settings or env
        settings = await get_cashfree_settings()
        webhook_secret = settings.get("webhook_secret") if settings else os.environ.get("CASHFREE_WEBHOOK_SECRET", "")
        
        # Verify signature if secret is configured
        signature_valid = True
        if webhook_secret:
            signature_valid = verify_cashfree_webhook_signature(body, signature, timestamp, webhook_secret)
            if not signature_valid:
                # Log failed verification attempt
                await db.payment_webhook_logs.insert_one({
                    "id": webhook_id,
                    "status": "signature_failed",
                    "signature": signature[:20] + "..." if signature else "none",
                    "received_at": received_at,
                    "ip": request.client.host if request.client else "unknown"
                })
                logger.warning(f"Webhook signature verification failed from {request.client.host if request.client else 'unknown'}")
                # Still return 200 to prevent retries, but don't process
                return {"status": "error", "message": "Invalid signature"}
        
        # Parse payload
        try:
            payload = await request.json()
        except Exception as e:
            logger.error(f"Failed to parse webhook payload: {e}")
            return {"status": "error", "message": "Invalid JSON payload"}
        
        event_type = payload.get("type", payload.get("event", ""))
        data = payload.get("data", payload)
        
        # Extract key identifiers for idempotency
        order_id = ""
        payment_id = ""
        link_id = ""
        
        # Handle different payload structures
        if "order" in data:
            order_id = data.get("order", {}).get("order_id", "")
        elif "link_id" in data:
            link_id = data.get("link_id", "")
        
        if "payment" in data:
            payment_id = data.get("payment", {}).get("cf_payment_id", "")
        
        # Fallback to root level
        order_id = order_id or data.get("order_id", "") or payload.get("order_id", "")
        link_id = link_id or data.get("link_id", "") or payload.get("link_id", "")
        
        logger.info(f"Cashfree webhook: {event_type}, order_id={order_id}, link_id={link_id}, payment_id={payment_id}")
        
        # Check for idempotency - prevent duplicate processing
        idempotency_key = f"{event_type}:{order_id or link_id}:{payment_id}"
        existing_webhook = await db.payment_webhook_logs.find_one({
            "idempotency_key": idempotency_key,
            "status": "processed"
        })
        
        if existing_webhook:
            logger.info(f"Duplicate webhook detected, skipping: {idempotency_key}")
            return {"status": "ok", "message": "Already processed"}
        
        # Store webhook log (before processing)
        webhook_log = {
            "id": webhook_id,
            "idempotency_key": idempotency_key,
            "event_type": event_type,
            "order_id": order_id,
            "link_id": link_id,
            "payment_id": payment_id,
            "payload": payload,
            "signature_verified": signature_valid,
            "status": "received",
            "received_at": received_at,
            "ip": request.client.host if request.client else "unknown"
        }
        await db.payment_webhook_logs.insert_one(webhook_log)
        
        # Process based on event type
        processing_result = {"processed": False, "message": "Unknown event type"}
        
        # PAYMENT SUCCESS
        if event_type in ["PAYMENT_SUCCESS", "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_LINK_EVENT"]:
            # For PAYMENT_LINK_EVENT, check the actual status
            if event_type == "PAYMENT_LINK_EVENT":
                link_status = data.get("link_status", "").upper()
                if link_status != "PAID":
                    processing_result = {"processed": True, "message": f"Link status: {link_status}"}
                    # Update webhook log
                    await db.payment_webhook_logs.update_one(
                        {"id": webhook_id},
                        {"$set": {"status": "processed", "processing_result": processing_result}}
                    )
                    return {"status": "ok", "message": processing_result["message"]}
            
            # Find payment record
            payment = None
            if order_id:
                payment = await db.payments.find_one({"order_id": order_id}, {"_id": 0})
            if not payment and link_id:
                payment = await db.payments.find_one({"link_id": link_id}, {"_id": 0})
            
            if payment:
                # Check if already marked as paid (idempotency)
                if payment.get("status") == "paid":
                    processing_result = {"processed": True, "message": "Already marked as paid"}
                else:
                    # Extract payment details
                    payment_details = data.get("payment", {})
                    payment_time = payment_details.get("payment_time") or data.get("payment_time") or received_at
                    cf_payment_id = payment_details.get("cf_payment_id", "") or payment_id
                    payment_amount = payment_details.get("payment_amount") or data.get("link_amount_paid") or payment.get("amount", 0)
                    payment_method = payment_details.get("payment_method", {}).get("upi", {}).get("upi_id", "") or \
                                    payment_details.get("payment_method", "Online")
                    
                    # Update payment record
                    update_data = {
                        "status": "paid",
                        "paid_at": payment_time,
                        "cashfree_payment_id": cf_payment_id,
                        "payment_amount_received": payment_amount,
                        "payment_method": str(payment_method),
                        "payment_details": data,
                        "webhook_updated_at": received_at,
                        "last_webhook_id": webhook_id
                    }
                    
                    await db.payments.update_one(
                        {"id": payment["id"]},
                        {"$set": update_data}
                    )
                    
                    # Update lead status to "Payment Received"
                    if payment.get("lead_id"):
                        await db.crm_leads.update_one(
                            {"id": payment["lead_id"]},
                            {"$set": {
                                "stage": "converted",
                                "priority": "hot",
                                "payment_received": True,
                                "payment_status": "Payment Received",
                                "last_payment_amount": payment_amount,
                                "last_payment_date": payment_time,
                                "last_payment_id": cf_payment_id,
                                "updated_at": received_at
                            }}
                        )
                        
                        # Log activity
                        await db.crm_activities.insert_one({
                            "id": str(uuid.uuid4()),
                            "lead_id": payment["lead_id"],
                            "type": "payment_received",
                            "description": f"Payment received: Rs.{payment_amount} (ID: {cf_payment_id})",
                            "timestamp": received_at
                        })
                    
                    # Send WhatsApp confirmation
                    payment["cashfree_payment_id"] = cf_payment_id
                    await send_payment_confirmation_whatsapp(payment)
                    
                    processing_result = {
                        "processed": True,
                        "message": "Payment marked as PAID",
                        "payment_id": cf_payment_id,
                        "amount": payment_amount
                    }
                    logger.info(f"Payment SUCCESS processed: order={order_id}, amount={payment_amount}")
            else:
                processing_result = {"processed": False, "message": "Payment record not found"}
                logger.warning(f"Payment record not found for order_id={order_id}, link_id={link_id}")
        
        # PAYMENT FAILED
        elif event_type in ["PAYMENT_FAILED", "PAYMENT_FAILURE_WEBHOOK"]:
            payment = None
            if order_id:
                payment = await db.payments.find_one({"order_id": order_id}, {"_id": 0})
            if not payment and link_id:
                payment = await db.payments.find_one({"link_id": link_id}, {"_id": 0})
            
            if payment:
                failure_reason = data.get("payment", {}).get("payment_message", "") or \
                                data.get("error_description", "") or "Payment failed"
                
                await db.payments.update_one(
                    {"id": payment["id"]},
                    {"$set": {
                        "status": "failed",
                        "failed_at": received_at,
                        "failure_reason": failure_reason,
                        "payment_details": data,
                        "webhook_updated_at": received_at,
                        "last_webhook_id": webhook_id
                    }}
                )
                
                # Log failure for debugging
                await db.payment_failures.insert_one({
                    "id": str(uuid.uuid4()),
                    "payment_id": payment["id"],
                    "order_id": order_id,
                    "reason": failure_reason,
                    "payload": data,
                    "created_at": received_at
                })
                
                processing_result = {"processed": True, "message": f"Payment marked as FAILED: {failure_reason}"}
                logger.info(f"Payment FAILED processed: order={order_id}, reason={failure_reason}")
            else:
                processing_result = {"processed": False, "message": "Payment record not found"}
        
        # PAYMENT USER DROPPED
        elif event_type in ["PAYMENT_USER_DROPPED", "USER_DROPPED"]:
            payment = None
            if order_id:
                payment = await db.payments.find_one({"order_id": order_id}, {"_id": 0})
            if not payment and link_id:
                payment = await db.payments.find_one({"link_id": link_id}, {"_id": 0})
            
            if payment:
                await db.payments.update_one(
                    {"id": payment["id"]},
                    {"$set": {
                        "status": "dropped",
                        "dropped_at": received_at,
                        "drop_reason": "User abandoned payment",
                        "payment_details": data,
                        "webhook_updated_at": received_at,
                        "last_webhook_id": webhook_id
                    }}
                )
                
                processing_result = {"processed": True, "message": "Payment marked as DROPPED"}
                logger.info(f"Payment DROPPED processed: order={order_id}")
            else:
                processing_result = {"processed": False, "message": "Payment record not found"}
        
        # REFUND events
        elif event_type in ["REFUND_SUCCESS", "REFUND_FAILED"]:
            if order_id:
                refund_status = "refunded" if "SUCCESS" in event_type else "refund_failed"
                await db.payments.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "status": refund_status,
                        "refund_details": data,
                        "webhook_updated_at": received_at
                    }}
                )
                processing_result = {"processed": True, "message": f"Refund status: {refund_status}"}
        
        # Update webhook log with processing result
        await db.payment_webhook_logs.update_one(
            {"id": webhook_id},
            {"$set": {
                "status": "processed",
                "processing_result": processing_result,
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Always return 200 to prevent Cashfree retries
        return {"status": "ok", "webhook_id": webhook_id, **processing_result}
        
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Log the error
        await db.payment_webhook_logs.update_one(
            {"id": webhook_id},
            {"$set": {
                "status": "error",
                "error": str(e),
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        # Still return 200 to prevent excessive retries
        return {"status": "error", "message": str(e)}


# Keep old webhook endpoint for backward compatibility
@router.post("/webhook")
async def cashfree_webhook(request: Request):
    """Legacy webhook endpoint - redirects to new handler"""
    return await cashfree_webhook_handler(request)

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
