"""
WhatsApp Cloud API Integration for ASR Enterprises CRM
Handles template messaging, campaigns, webhooks, and message logging
"""
import os
import re
import uuid
import httpx
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# WhatsApp API Constants
WHATSAPP_API_VERSION = "v23.0"
WHATSAPP_API_BASE = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}"

# Default templates for ASR Enterprises Solar Business
DEFAULT_TEMPLATES = [
    {"template_name": "asr_welcome", "display_name": "Welcome Message", "category": "MARKETING", "has_variables": True, "variable_count": 1, "description": "Send welcome message to new leads"},
    {"template_name": "asr_solar_offer", "display_name": "Solar Offer", "category": "MARKETING", "has_variables": True, "variable_count": 1, "description": "Send solar installation offers"},
    {"template_name": "asr_subsidy_info", "display_name": "Subsidy Information", "category": "UTILITY", "has_variables": True, "variable_count": 1, "description": "PM Surya Ghar Yojana subsidy details"},
    {"template_name": "asr_site_visit", "display_name": "Site Visit Reminder", "category": "UTILITY", "has_variables": True, "variable_count": 2, "description": "Schedule/remind site visits"},
    {"template_name": "asr_quotation_followup", "display_name": "Quotation Follow-up", "category": "MARKETING", "has_variables": True, "variable_count": 1, "description": "Follow up on quotations"},
    {"template_name": "asr_callback_request", "display_name": "Callback Request", "category": "UTILITY", "has_variables": True, "variable_count": 1, "description": "Request callback from customer"},
    {"template_name": "asr_reactivation", "display_name": "Lead Reactivation", "category": "MARKETING", "has_variables": True, "variable_count": 1, "description": "Re-engage inactive leads"},
    {"template_name": "hello_world", "display_name": "Hello World (Test)", "category": "UTILITY", "has_variables": False, "variable_count": 0, "description": "Test template from Meta"},
]

# ==================== HELPER FUNCTIONS ====================

def clean_phone_number(phone: str, default_country_code: str = "91") -> str:
    """Clean and format phone number to WhatsApp format (country code + number)"""
    if not phone:
        return ""
    
    # Remove all non-digit characters
    cleaned = re.sub(r'\D', '', str(phone))
    
    # Handle different formats
    if cleaned.startswith("00"):
        cleaned = cleaned[2:]  # Remove 00 prefix
    
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]  # Remove + if somehow still there
    
    # If starts with 0 and is 11 digits (0XXXXXXXXXX), remove leading 0
    if cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    
    # If 10 digits, add country code
    if len(cleaned) == 10:
        cleaned = default_country_code + cleaned
    
    # If starts with country code already (91XXXXXXXXXX), keep as is
    if len(cleaned) == 12 and cleaned.startswith(default_country_code):
        return cleaned
    
    # Validate final number
    if len(cleaned) < 10 or len(cleaned) > 15:
        return ""  # Invalid
    
    return cleaned

def validate_phone_number(phone: str) -> bool:
    """Validate if phone number is valid for WhatsApp"""
    cleaned = clean_phone_number(phone)
    return len(cleaned) >= 12 and len(cleaned) <= 15

async def get_whatsapp_settings() -> Optional[Dict]:
    """Get WhatsApp API settings from database"""
    settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
    if not settings:
        # Try environment variables as fallback
        access_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
        phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
        if access_token and phone_number_id:
            return {
                "access_token": access_token,
                "phone_number_id": phone_number_id,
                "waba_id": os.environ.get("WHATSAPP_WABA_ID", ""),
                "verify_token": os.environ.get("WHATSAPP_VERIFY_TOKEN", "asr_whatsapp_verify_2024"),
                "default_country_code": "91",
                "is_active": True
            }
    return settings

async def send_whatsapp_template(
    phone: str,
    template_name: str,
    language_code: str = "en",
    variables: List[str] = None,
    lead_id: str = None,
    campaign_id: str = None
) -> Dict[str, Any]:
    """Send WhatsApp template message via Meta Cloud API"""
    settings = await get_whatsapp_settings()
    if not settings or not settings.get("access_token"):
        return {"success": False, "error": "WhatsApp API not configured"}
    
    # Clean phone number
    cleaned_phone = clean_phone_number(phone, settings.get("default_country_code", "91"))
    if not cleaned_phone:
        return {"success": False, "error": f"Invalid phone number: {phone}"}
    
    # Build request payload
    payload = {
        "messaging_product": "whatsapp",
        "to": cleaned_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code}
        }
    }
    
    # Add variables if provided
    if variables and len(variables) > 0:
        payload["template"]["components"] = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": var} for var in variables]
            }
        ]
    
    # Send request to Meta API
    api_url = f"{WHATSAPP_API_BASE}/{settings['phone_number_id']}/messages"
    headers = {
        "Authorization": f"Bearer {settings['access_token']}",
        "Content-Type": "application/json"
    }
    
    message_id = str(uuid.uuid4())
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response_data = response.json()
            
            if response.status_code == 200 and "messages" in response_data:
                wa_message_id = response_data["messages"][0].get("id", "")
                
                # Log message in database
                await db.whatsapp_messages.insert_one({
                    "id": message_id,
                    "lead_id": lead_id,
                    "campaign_id": campaign_id,
                    "phone": cleaned_phone,
                    "template_name": template_name,
                    "direction": "outgoing",
                    "message_type": "template",
                    "wa_message_id": wa_message_id,
                    "status": "sent",
                    "variables": variables,
                    "content_json": payload,
                    "api_response_json": response_data,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                # Update lead's last WhatsApp contact
                if lead_id:
                    await db.crm_leads.update_one(
                        {"id": lead_id},
                        {"$set": {
                            "last_whatsapp_sent": datetime.now(timezone.utc).isoformat(),
                            "last_whatsapp_template": template_name
                        }}
                    )
                
                return {
                    "success": True,
                    "message_id": message_id,
                    "wa_message_id": wa_message_id,
                    "phone": cleaned_phone
                }
            else:
                error_msg = response_data.get("error", {}).get("message", "Unknown error")
                
                # Log failed message
                await db.whatsapp_messages.insert_one({
                    "id": message_id,
                    "lead_id": lead_id,
                    "campaign_id": campaign_id,
                    "phone": cleaned_phone,
                    "template_name": template_name,
                    "direction": "outgoing",
                    "message_type": "template",
                    "wa_message_id": None,
                    "status": "failed",
                    "variables": variables,
                    "content_json": payload,
                    "api_response_json": response_data,
                    "error": error_msg,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                return {"success": False, "error": error_msg, "response": response_data}
                
    except Exception as e:
        logger.error(f"WhatsApp API error: {str(e)}")
        
        # Log error
        await db.whatsapp_messages.insert_one({
            "id": message_id,
            "lead_id": lead_id,
            "campaign_id": campaign_id,
            "phone": cleaned_phone,
            "template_name": template_name,
            "direction": "outgoing",
            "message_type": "template",
            "wa_message_id": None,
            "status": "failed",
            "variables": variables,
            "content_json": payload,
            "error": str(e),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": False, "error": str(e)}

# ==================== SETTINGS ENDPOINTS ====================

@router.get("/settings")
async def get_settings():
    """Get WhatsApp API settings (masked for security)"""
    settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "configured": False,
            "access_token": "",
            "phone_number_id": "",
            "waba_id": "",
            "verify_token": "asr_whatsapp_verify_2024",
            "default_country_code": "91",
            "is_active": False,
            "webhook_url": "/api/whatsapp/webhook"
        }
    
    # Mask access token for security
    token = settings.get("access_token", "")
    masked_token = f"{token[:10]}...{token[-10:]}" if len(token) > 20 else "***"
    
    return {
        "configured": True,
        "access_token": masked_token,
        "phone_number_id": settings.get("phone_number_id", ""),
        "waba_id": settings.get("waba_id", ""),
        "verify_token": settings.get("verify_token", ""),
        "default_country_code": settings.get("default_country_code", "91"),
        "is_active": settings.get("is_active", False),
        "webhook_url": "/api/whatsapp/webhook",
        "updated_at": settings.get("updated_at", "")
    }

@router.post("/settings")
async def save_settings(data: Dict[str, Any]):
    """Save WhatsApp API settings"""
    access_token = data.get("access_token", "").strip()
    phone_number_id = data.get("phone_number_id", "").strip()
    waba_id = data.get("waba_id", "").strip()
    verify_token = data.get("verify_token", "asr_whatsapp_verify_2024").strip()
    default_country_code = data.get("default_country_code", "91").strip()
    
    if not access_token or not phone_number_id:
        raise HTTPException(status_code=400, detail="Access Token and Phone Number ID are required")
    
    settings_data = {
        "access_token": access_token,
        "phone_number_id": phone_number_id,
        "waba_id": waba_id,
        "verify_token": verify_token,
        "default_country_code": default_country_code,
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert settings
    await db.whatsapp_settings.update_one(
        {},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"success": True, "message": "WhatsApp settings saved successfully"}

@router.post("/settings/test")
async def test_connection():
    """Test WhatsApp API connection"""
    settings = await get_whatsapp_settings()
    if not settings or not settings.get("access_token"):
        return {"success": False, "error": "WhatsApp API not configured"}
    
    # Test API connection by fetching phone number details
    api_url = f"{WHATSAPP_API_BASE}/{settings['phone_number_id']}"
    headers = {
        "Authorization": f"Bearer {settings['access_token']}"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(api_url, headers=headers)
            response_data = response.json()
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "API connection successful",
                    "phone_number": response_data.get("display_phone_number", ""),
                    "verified_name": response_data.get("verified_name", ""),
                    "quality_rating": response_data.get("quality_rating", "")
                }
            else:
                error_msg = response_data.get("error", {}).get("message", "Connection failed")
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/settings/test-send")
async def test_send_message(data: Dict[str, Any]):
    """Send a test message"""
    phone = data.get("phone", "")
    template = data.get("template", "hello_world")
    
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    
    result = await send_whatsapp_template(phone, template)
    return result

# ==================== TEMPLATES ENDPOINTS ====================

@router.get("/templates")
async def get_templates():
    """Get all WhatsApp templates"""
    templates = await db.whatsapp_templates.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    if not templates:
        # Return default templates if none configured
        return DEFAULT_TEMPLATES
    
    return templates

@router.post("/templates")
async def save_template(data: Dict[str, Any]):
    """Add or update a WhatsApp template"""
    template_name = data.get("template_name", "").strip()
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    template_data = {
        "template_name": template_name,
        "display_name": data.get("display_name", template_name),
        "language_code": data.get("language_code", "en"),
        "category": data.get("category", "MARKETING"),
        "has_variables": data.get("has_variables", False),
        "variable_count": data.get("variable_count", 0),
        "variable_names": data.get("variable_names", []),
        "description": data.get("description", ""),
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.whatsapp_templates.update_one(
        {"template_name": template_name},
        {"$set": template_data},
        upsert=True
    )
    
    return {"success": True, "message": "Template saved successfully"}

@router.post("/templates/sync")
async def sync_templates():
    """Sync templates from Meta Business Manager"""
    settings = await get_whatsapp_settings()
    if not settings or not settings.get("waba_id"):
        # If no WABA ID, just initialize with defaults
        for template in DEFAULT_TEMPLATES:
            template["is_active"] = True
            template["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.whatsapp_templates.update_one(
                {"template_name": template["template_name"]},
                {"$set": template},
                upsert=True
            )
        return {"success": True, "message": "Initialized with default templates", "count": len(DEFAULT_TEMPLATES)}
    
    # Fetch templates from Meta API
    api_url = f"{WHATSAPP_API_BASE}/{settings['waba_id']}/message_templates"
    headers = {
        "Authorization": f"Bearer {settings['access_token']}"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(api_url, headers=headers)
            response_data = response.json()
            
            if response.status_code == 200 and "data" in response_data:
                templates = response_data["data"]
                count = 0
                for t in templates:
                    if t.get("status") == "APPROVED":
                        template_data = {
                            "template_name": t.get("name"),
                            "display_name": t.get("name", "").replace("_", " ").title(),
                            "language_code": t.get("language", "en"),
                            "category": t.get("category", "MARKETING"),
                            "status": t.get("status"),
                            "is_active": True,
                            "synced_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.whatsapp_templates.update_one(
                            {"template_name": template_data["template_name"]},
                            {"$set": template_data},
                            upsert=True
                        )
                        count += 1
                
                return {"success": True, "message": f"Synced {count} approved templates", "count": count}
            else:
                # Initialize defaults on failure
                for template in DEFAULT_TEMPLATES:
                    template["is_active"] = True
                    await db.whatsapp_templates.update_one(
                        {"template_name": template["template_name"]},
                        {"$set": template},
                        upsert=True
                    )
                return {"success": True, "message": "Initialized with default templates (API sync failed)", "count": len(DEFAULT_TEMPLATES)}
                
    except Exception as e:
        logger.error(f"Template sync error: {str(e)}")
        # Initialize defaults on error
        for template in DEFAULT_TEMPLATES:
            template["is_active"] = True
            await db.whatsapp_templates.update_one(
                {"template_name": template["template_name"]},
                {"$set": template},
                upsert=True
            )
        return {"success": True, "message": "Initialized with default templates (sync error)", "count": len(DEFAULT_TEMPLATES)}

# ==================== SINGLE MESSAGE ENDPOINTS ====================

@router.post("/send")
async def send_single_message(data: Dict[str, Any]):
    """Send WhatsApp template message to a single lead"""
    lead_id = data.get("lead_id")
    phone = data.get("phone")
    template_name = data.get("template_name", "")
    variables = data.get("variables", [])
    language_code = data.get("language_code", "en")
    
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    # Get lead info if lead_id provided
    lead = None
    if lead_id:
        lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
        if lead and not phone:
            phone = lead.get("phone", "")
    
    result = await send_whatsapp_template(
        phone=phone,
        template_name=template_name,
        language_code=language_code,
        variables=variables,
        lead_id=lead_id
    )
    
    return result

@router.post("/send-to-lead/{lead_id}")
async def send_to_lead(lead_id: str, data: Dict[str, Any]):
    """Send WhatsApp template to a specific lead"""
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    phone = lead.get("phone", "")
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no phone number")
    
    template_name = data.get("template_name", "")
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    # Auto-fill variables with lead data
    variables = data.get("variables", [])
    if not variables:
        # Default: use lead name as first variable
        variables = [lead.get("name", "Customer")]
    
    result = await send_whatsapp_template(
        phone=phone,
        template_name=template_name,
        language_code=data.get("language_code", "en"),
        variables=variables,
        lead_id=lead_id
    )
    
    # Add to lead activity log
    if result.get("success"):
        await db.crm_leads.update_one(
            {"id": lead_id},
            {"$push": {
                "activities": {
                    "id": str(uuid.uuid4()),
                    "type": "whatsapp_sent",
                    "title": f"WhatsApp: {template_name}",
                    "description": f"Sent template '{template_name}' to {phone}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
    
    return result

# ==================== CAMPAIGN ENDPOINTS ====================

@router.post("/campaigns")
async def create_campaign(data: Dict[str, Any], background_tasks: BackgroundTasks):
    """Create and send a bulk WhatsApp campaign"""
    campaign_name = data.get("campaign_name", f"Campaign_{datetime.now().strftime('%Y%m%d_%H%M')}")
    template_name = data.get("template_name", "")
    lead_ids = data.get("lead_ids", [])
    filters = data.get("filters", {})
    batch_size = data.get("batch_size", 30)
    batch_delay = data.get("batch_delay", 2)  # seconds between batches
    
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    # Get leads based on filters or IDs
    if lead_ids:
        leads = await db.crm_leads.find(
            {"id": {"$in": lead_ids}, "phone": {"$exists": True, "$ne": ""}},
            {"_id": 0, "id": 1, "phone": 1, "name": 1}
        ).to_list(5000)
    else:
        query = {"phone": {"$exists": True, "$ne": ""}}
        if filters.get("stage"):
            query["stage"] = filters["stage"]
        if filters.get("assigned_to"):
            query["assigned_to"] = filters["assigned_to"]
        if filters.get("source"):
            query["source"] = filters["source"]
        
        leads = await db.crm_leads.find(query, {"_id": 0, "id": 1, "phone": 1, "name": 1}).to_list(5000)
    
    if not leads:
        raise HTTPException(status_code=400, detail="No valid leads found for campaign")
    
    # Create campaign record
    campaign_id = str(uuid.uuid4())
    campaign_data = {
        "id": campaign_id,
        "campaign_name": campaign_name,
        "template_name": template_name,
        "total_selected": len(leads),
        "total_sent": 0,
        "total_failed": 0,
        "total_delivered": 0,
        "total_read": 0,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.whatsapp_campaigns.insert_one(campaign_data)
    
    # Create recipient records
    for lead in leads:
        await db.whatsapp_campaign_recipients.insert_one({
            "id": str(uuid.uuid4()),
            "campaign_id": campaign_id,
            "lead_id": lead.get("id"),
            "phone": lead.get("phone"),
            "name": lead.get("name", ""),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Send messages in background
    background_tasks.add_task(
        process_campaign_batch,
        campaign_id,
        template_name,
        batch_size,
        batch_delay
    )
    
    return {
        "success": True,
        "campaign_id": campaign_id,
        "campaign_name": campaign_name,
        "total_recipients": len(leads),
        "message": f"Campaign started with {len(leads)} recipients"
    }

async def process_campaign_batch(campaign_id: str, template_name: str, batch_size: int, batch_delay: int):
    """Process campaign messages in batches"""
    import asyncio
    
    try:
        recipients = await db.whatsapp_campaign_recipients.find(
            {"campaign_id": campaign_id, "status": "pending"},
            {"_id": 0}
        ).to_list(5000)
        
        sent = 0
        failed = 0
        
        for i, recipient in enumerate(recipients):
            # Send message
            lead = await db.crm_leads.find_one({"id": recipient["lead_id"]}, {"_id": 0, "name": 1})
            variables = [lead.get("name", "Customer")] if lead else ["Customer"]
            
            result = await send_whatsapp_template(
                phone=recipient["phone"],
                template_name=template_name,
                variables=variables,
                lead_id=recipient["lead_id"],
                campaign_id=campaign_id
            )
            
            # Update recipient status
            status = "sent" if result.get("success") else "failed"
            await db.whatsapp_campaign_recipients.update_one(
                {"id": recipient["id"]},
                {"$set": {
                    "status": status,
                    "wa_message_id": result.get("wa_message_id"),
                    "error": result.get("error"),
                    "sent_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            if result.get("success"):
                sent += 1
            else:
                failed += 1
            
            # Update campaign stats
            await db.whatsapp_campaigns.update_one(
                {"id": campaign_id},
                {"$set": {"total_sent": sent, "total_failed": failed}}
            )
            
            # Batch delay
            if (i + 1) % batch_size == 0:
                await asyncio.sleep(batch_delay)
        
        # Mark campaign complete
        await db.whatsapp_campaigns.update_one(
            {"id": campaign_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
    except Exception as e:
        logger.error(f"Campaign processing error: {str(e)}")
        await db.whatsapp_campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )

@router.get("/campaigns")
async def get_campaigns(page: int = 1, limit: int = 20):
    """Get all campaigns with pagination"""
    skip = (page - 1) * limit
    
    campaigns = await db.whatsapp_campaigns.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.whatsapp_campaigns.count_documents({})
    
    return {
        "campaigns": campaigns,
        "pagination": {
            "current_page": page,
            "total_pages": (total + limit - 1) // limit,
            "total_count": total
        }
    }

@router.get("/campaigns/{campaign_id}")
async def get_campaign_details(campaign_id: str):
    """Get campaign details with recipient stats"""
    campaign = await db.whatsapp_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get recipient stats
    recipients = await db.whatsapp_campaign_recipients.find(
        {"campaign_id": campaign_id},
        {"_id": 0}
    ).to_list(5000)
    
    stats = {
        "pending": sum(1 for r in recipients if r.get("status") == "pending"),
        "sent": sum(1 for r in recipients if r.get("status") == "sent"),
        "delivered": sum(1 for r in recipients if r.get("status") == "delivered"),
        "read": sum(1 for r in recipients if r.get("status") == "read"),
        "failed": sum(1 for r in recipients if r.get("status") == "failed"),
    }
    
    return {
        "campaign": campaign,
        "stats": stats,
        "recipients": recipients[:100]  # Limit to first 100 for display
    }

# ==================== MESSAGE HISTORY ENDPOINTS ====================

@router.get("/messages")
async def get_messages(page: int = 1, limit: int = 50, lead_id: str = None, direction: str = None):
    """Get WhatsApp message history"""
    skip = (page - 1) * limit
    
    query = {}
    if lead_id:
        query["lead_id"] = lead_id
    if direction:
        query["direction"] = direction
    
    messages = await db.whatsapp_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.whatsapp_messages.count_documents(query)
    
    return {
        "messages": messages,
        "pagination": {
            "current_page": page,
            "total_pages": (total + limit - 1) // limit,
            "total_count": total
        }
    }

@router.get("/messages/lead/{lead_id}")
async def get_lead_messages(lead_id: str):
    """Get all WhatsApp messages for a specific lead"""
    messages = await db.whatsapp_messages.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return messages

# ==================== CONVERSATION / INBOX ENDPOINTS ====================

@router.get("/conversations")
async def get_conversations(page: int = 1, limit: int = 50):
    """
    Get all conversations grouped by phone number.
    Returns list of conversations with last message, unread count, and lead info.
    Sorted by last activity (most recent first).
    """
    skip = (page - 1) * limit
    
    # Aggregate messages by phone number
    pipeline = [
        {
            "$group": {
                "_id": "$phone",
                "last_message": {"$last": "$$ROOT"},
                "first_message": {"$first": "$$ROOT"},
                "message_count": {"$sum": 1},
                "unread_count": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$direction", "incoming"]},
                                {"$ne": ["$read_by_admin", True]}
                            ]},
                            1,
                            0
                        ]
                    }
                },
                "last_incoming_at": {
                    "$max": {
                        "$cond": [
                            {"$eq": ["$direction", "incoming"]},
                            "$created_at",
                            None
                        ]
                    }
                },
                "last_activity": {"$max": "$created_at"}
            }
        },
        {"$sort": {"last_activity": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    conversations_cursor = db.whatsapp_messages.aggregate(pipeline)
    conversations_raw = await conversations_cursor.to_list(limit)
    
    # Process and enrich conversations
    conversations = []
    for conv in conversations_raw:
        phone = conv["_id"]
        if not phone:
            continue
            
        last_msg = conv.get("last_message", {})
        lead_id = last_msg.get("lead_id")
        
        # Try to find linked lead
        lead_info = None
        if lead_id:
            lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "stage": 1, "district": 1})
            if lead:
                lead_info = lead
        
        # If no lead_id in message, try to find by phone
        if not lead_info:
            # Clean phone for matching
            clean_phone = re.sub(r'\D', '', phone)
            if clean_phone.startswith("91") and len(clean_phone) > 10:
                clean_phone = clean_phone[2:]
            
            lead = await db.crm_leads.find_one(
                {"$or": [
                    {"phone": {"$regex": clean_phone[-10:]}},
                    {"phone": phone}
                ]},
                {"_id": 0, "id": 1, "name": 1, "phone": 1, "stage": 1, "district": 1}
            )
            if lead:
                lead_info = lead
        
        # Check 24-hour window
        last_incoming = conv.get("last_incoming_at")
        within_24h = False
        if last_incoming:
            try:
                if isinstance(last_incoming, str):
                    last_incoming_dt = datetime.fromisoformat(last_incoming.replace("Z", "+00:00"))
                else:
                    last_incoming_dt = last_incoming
                within_24h = datetime.now(timezone.utc) - last_incoming_dt < timedelta(hours=24)
            except (ValueError, TypeError, AttributeError):
                pass
        
        conversations.append({
            "phone": phone,
            "lead": lead_info,
            "last_message": {
                "content": last_msg.get("content") or last_msg.get("template_name") or "",
                "direction": last_msg.get("direction", ""),
                "status": last_msg.get("status", ""),
                "created_at": last_msg.get("created_at", ""),
                "template_name": last_msg.get("template_name")
            },
            "message_count": conv.get("message_count", 0),
            "unread_count": conv.get("unread_count", 0),
            "last_activity": conv.get("last_activity", ""),
            "within_24h_window": within_24h,
            "last_incoming_at": last_incoming
        })
    
    # Get total unique conversations
    total_pipeline = [{"$group": {"_id": "$phone"}}, {"$count": "total"}]
    total_result = await db.whatsapp_messages.aggregate(total_pipeline).to_list(1)
    total = total_result[0]["total"] if total_result else 0
    
    return {
        "conversations": conversations,
        "pagination": {
            "current_page": page,
            "total_pages": (total + limit - 1) // limit if total > 0 else 1,
            "total_count": total
        }
    }

@router.get("/conversations/unread-count")
async def get_unread_count():
    """Get total unread message count across all conversations"""
    count = await db.whatsapp_messages.count_documents({
        "direction": "incoming",
        "read_by_admin": {"$ne": True}
    })
    return {"unread_count": count}

@router.get("/conversations/{phone}")
async def get_conversation_thread(phone: str):
    """
    Get full message thread for a specific phone number.
    Returns all messages in chronological order with lead info.
    """
    # Clean phone number for query
    clean_phone = clean_phone_number(phone)
    
    # Find messages by phone (try multiple formats)
    messages = await db.whatsapp_messages.find(
        {"$or": [
            {"phone": phone},
            {"phone": clean_phone},
            {"phone": {"$regex": phone[-10:] if len(phone) >= 10 else phone}}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    # Mark incoming messages as read
    await db.whatsapp_messages.update_many(
        {"phone": {"$in": [phone, clean_phone]}, "direction": "incoming"},
        {"$set": {"read_by_admin": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Try to find linked lead
    lead_info = None
    lead_id = None
    for msg in messages:
        if msg.get("lead_id"):
            lead_id = msg.get("lead_id")
            break
    
    if lead_id:
        lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "stage": 1, "district": 1, "monthly_bill": 1, "property_type": 1})
        if lead:
            lead_info = lead
    
    if not lead_info:
        # Try to find by phone
        search_phone = phone[-10:] if len(phone) >= 10 else phone
        lead = await db.crm_leads.find_one(
            {"phone": {"$regex": search_phone}},
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "stage": 1, "district": 1, "monthly_bill": 1, "property_type": 1}
        )
        if lead:
            lead_info = lead
    
    # Check 24-hour window
    last_incoming = None
    for msg in reversed(messages):
        if msg.get("direction") == "incoming":
            last_incoming = msg.get("created_at")
            break
    
    within_24h = False
    if last_incoming:
        try:
            if isinstance(last_incoming, str):
                last_incoming_dt = datetime.fromisoformat(last_incoming.replace("Z", "+00:00"))
            else:
                last_incoming_dt = last_incoming
            within_24h = datetime.now(timezone.utc) - last_incoming_dt < timedelta(hours=24)
        except (ValueError, TypeError, AttributeError):
            pass
    
    return {
        "phone": phone,
        "lead": lead_info,
        "messages": messages,
        "within_24h_window": within_24h,
        "last_incoming_at": last_incoming,
        "message_count": len(messages)
    }

@router.post("/conversations/{phone}/send-text")
async def send_freeform_text(phone: str, request: Request):
    """
    Send free-form text message (only within 24-hour customer service window).
    """
    data = await request.json()
    text = data.get("text", "").strip()
    
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required")
    
    # Check 24-hour window
    clean_phone = clean_phone_number(phone)
    
    # Find last incoming message
    last_incoming = await db.whatsapp_messages.find_one(
        {"phone": {"$in": [phone, clean_phone]}, "direction": "incoming"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not last_incoming:
        raise HTTPException(
            status_code=400, 
            detail="No incoming message found. Customer must message first before you can reply with free-form text."
        )
    
    last_incoming_at = last_incoming.get("created_at")
    try:
        if isinstance(last_incoming_at, str):
            last_incoming_dt = datetime.fromisoformat(last_incoming_at.replace("Z", "+00:00"))
        else:
            last_incoming_dt = last_incoming_at
        
        if datetime.now(timezone.utc) - last_incoming_dt > timedelta(hours=24):
            raise HTTPException(
                status_code=400,
                detail="Outside 24-hour customer service window. Please send an approved template instead."
            )
    except HTTPException:
        raise
    except (ValueError, TypeError, AttributeError) as e:
        raise HTTPException(status_code=400, detail=f"Unable to verify message window: {str(e)}")
    
    # Get WhatsApp settings
    settings = await get_whatsapp_settings()
    if not settings or not settings.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp API not configured")
    
    # Find lead_id if exists
    lead_id = last_incoming.get("lead_id")
    
    # Create message record first
    message_id = str(uuid.uuid4())
    message_record = {
        "id": message_id,
        "phone": clean_phone,
        "lead_id": lead_id,
        "direction": "outgoing",
        "type": "text",
        "content": text,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.whatsapp_messages.insert_one(message_record)
    
    # Send via Meta API
    api_url = f"{WHATSAPP_API_BASE}/{settings['phone_number_id']}/messages"
    headers = {
        "Authorization": f"Bearer {settings['access_token']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "text",
        "text": {"body": text}
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, headers=headers, json=payload)
            response_data = response.json()
            
            if response.status_code in [200, 201]:
                wa_message_id = response_data.get("messages", [{}])[0].get("id", "")
                await db.whatsapp_messages.update_one(
                    {"id": message_id},
                    {"$set": {
                        "status": "sent",
                        "wa_message_id": wa_message_id,
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                return {
                    "success": True,
                    "message_id": message_id,
                    "wa_message_id": wa_message_id,
                    "status": "sent"
                }
            else:
                error_msg = response_data.get("error", {}).get("message", "Unknown error")
                await db.whatsapp_messages.update_one(
                    {"id": message_id},
                    {"$set": {"status": "failed", "error": error_msg}}
                )
                return {
                    "success": False,
                    "message_id": message_id,
                    "error": error_msg,
                    "status": "failed"
                }
    except Exception as e:
        await db.whatsapp_messages.update_one(
            {"id": message_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
        return {"success": False, "message_id": message_id, "error": str(e), "status": "failed"}

@router.post("/conversations/{phone}/send-template")
async def send_template_to_conversation(phone: str, request: Request):
    """
    Send template message to a conversation.
    Can be used anytime (not restricted to 24-hour window).
    """
    data = await request.json()
    template_name = data.get("template_name")
    variables = data.get("variables", [])
    
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    # Find lead_id if exists
    clean_phone = clean_phone_number(phone)
    last_msg = await db.whatsapp_messages.find_one(
        {"phone": {"$in": [phone, clean_phone]}},
        {"_id": 0, "lead_id": 1},
        sort=[("created_at", -1)]
    )
    lead_id = last_msg.get("lead_id") if last_msg else None
    
    # If no lead_id from messages, try to find by phone
    if not lead_id:
        search_phone = phone[-10:] if len(phone) >= 10 else phone
        lead = await db.crm_leads.find_one({"phone": {"$regex": search_phone}}, {"_id": 0, "id": 1})
        if lead:
            lead_id = lead.get("id")
    
    # Send template
    result = await send_whatsapp_template(
        phone=clean_phone,
        template_name=template_name,
        variables=variables,
        lead_id=lead_id
    )
    
    return result

@router.get("/conversations/by-lead/{lead_id}")
async def get_conversation_by_lead(lead_id: str):
    """
    Get conversation thread for a specific lead.
    Returns phone number and redirects to that conversation.
    """
    # Get lead info
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0, "id": 1, "name": 1, "phone": 1})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    phone = lead.get("phone", "")
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no phone number")
    
    # Clean phone
    clean_phone = clean_phone_number(phone)
    
    # Get conversation thread
    return await get_conversation_thread(clean_phone)

# ==================== DASHBOARD STATS ====================

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get WhatsApp dashboard statistics"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Today's stats
    today_sent = await db.whatsapp_messages.count_documents({
        "direction": "outgoing",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    today_delivered = await db.whatsapp_messages.count_documents({
        "direction": "outgoing",
        "status": "delivered",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    today_read = await db.whatsapp_messages.count_documents({
        "direction": "outgoing",
        "status": "read",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    today_failed = await db.whatsapp_messages.count_documents({
        "direction": "outgoing",
        "status": "failed",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    today_replies = await db.whatsapp_messages.count_documents({
        "direction": "incoming",
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Total stats
    total_sent = await db.whatsapp_messages.count_documents({"direction": "outgoing"})
    total_replies = await db.whatsapp_messages.count_documents({"direction": "incoming"})
    
    # Active campaigns
    active_campaigns = await db.whatsapp_campaigns.count_documents({"status": "running"})
    
    return {
        "today": {
            "sent": today_sent,
            "delivered": today_delivered,
            "read": today_read,
            "failed": today_failed,
            "replies": today_replies
        },
        "total": {
            "sent": total_sent,
            "replies": total_replies
        },
        "active_campaigns": active_campaigns
    }

# ==================== WEBHOOK ENDPOINTS ====================

@router.get("/webhook")
async def webhook_verify(request: Request):
    """
    Verify webhook for Meta WhatsApp Cloud API
    
    Meta sends GET request with query params:
    - hub.mode: should be "subscribe"
    - hub.verify_token: must match our saved verify token
    - hub.challenge: must be returned as plain text response
    
    Returns: Plain text response with challenge value (HTTP 200) or HTTP 403
    """
    from fastapi.responses import PlainTextResponse, Response
    
    params = dict(request.query_params)
    
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    # If no params provided, show debug message
    if not mode and not token and not challenge:
        return PlainTextResponse(
            content="WhatsApp webhook endpoint active. Ready to receive Meta verification.",
            status_code=200
        )
    
    # Get verify token from settings
    settings = await get_whatsapp_settings()
    verify_token = settings.get("verify_token", "asr_whatsapp_verify_2024") if settings else "asr_whatsapp_verify_2024"
    
    logger.info(f"Webhook verification request - Mode: {mode}, Token received: {token}, Expected token: {verify_token}, Challenge: {challenge}")
    
    if mode == "subscribe" and token == verify_token:
        if challenge:
            logger.info(f"WhatsApp webhook verified successfully. Returning challenge: {challenge}")
            # IMPORTANT: Meta expects ONLY the challenge value as plain text, HTTP 200
            return PlainTextResponse(content=str(challenge), status_code=200)
        else:
            logger.warning("WhatsApp webhook verification: No challenge provided")
            return PlainTextResponse(content="Missing challenge", status_code=400)
    else:
        logger.warning(f"WhatsApp webhook verification failed. Mode: {mode}, Token: {token}, Expected: {verify_token}")
        return PlainTextResponse(content="Verification failed", status_code=403)

@router.post("/webhook")
async def webhook_receive(request: Request):
    """Receive webhook events from Meta WhatsApp Cloud API"""
    try:
        payload = await request.json()
        
        # Log raw webhook
        await db.whatsapp_webhook_logs.insert_one({
            "id": str(uuid.uuid4()),
            "payload_json": payload,
            "event_type": "webhook_received",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Process webhook entries
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                
                # Handle incoming messages
                messages = value.get("messages", [])
                for msg in messages:
                    await process_incoming_message(msg, value)
                
                # Handle status updates
                statuses = value.get("statuses", [])
                for status in statuses:
                    await process_status_update(status)
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        # Still return 200 to prevent Meta from retrying
        return {"status": "error", "message": str(e)}

async def process_incoming_message(message: Dict, value: Dict):
    """Process incoming WhatsApp message"""
    wa_message_id = message.get("id", "")
    from_phone = message.get("from", "")
    msg_type = message.get("type", "")
    # timestamp is available in message but not currently used
    
    # Get message content
    content = ""
    if msg_type == "text":
        content = message.get("text", {}).get("body", "")
    elif msg_type == "button":
        content = message.get("button", {}).get("text", "")
    elif msg_type == "interactive":
        interactive = message.get("interactive", {})
        if "button_reply" in interactive:
            content = interactive["button_reply"].get("title", "")
        elif "list_reply" in interactive:
            content = interactive["list_reply"].get("title", "")
    
    # Clean phone number for lookup
    cleaned_phone = clean_phone_number(from_phone)
    
    # Find matching lead
    lead = await db.crm_leads.find_one(
        {"$or": [
            {"phone": cleaned_phone},
            {"phone": from_phone},
            {"phone": from_phone[-10:]},  # Last 10 digits
        ]},
        {"_id": 0}
    )
    
    lead_id = lead.get("id") if lead else None
    
    # Save incoming message
    message_id = str(uuid.uuid4())
    await db.whatsapp_messages.insert_one({
        "id": message_id,
        "lead_id": lead_id,
        "phone": cleaned_phone,
        "direction": "incoming",
        "message_type": msg_type,
        "content": content,
        "wa_message_id": wa_message_id,
        "status": "received",
        "raw_message": message,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Auto-update lead stage based on keywords
    if lead_id and content:
        await auto_update_lead_stage(lead_id, content, lead)
    
    # Create new lead if not found
    if not lead_id and cleaned_phone:
        contact_name = ""
        contacts = value.get("contacts", [])
        if contacts:
            contact_name = contacts[0].get("profile", {}).get("name", "")
        
        new_lead_id = str(uuid.uuid4())
        await db.crm_leads.insert_one({
            "id": new_lead_id,
            "name": contact_name or f"WhatsApp {cleaned_phone[-4:]}",
            "phone": cleaned_phone,
            "source": "whatsapp_reply",
            "stage": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "activities": [{
                "id": str(uuid.uuid4()),
                "type": "whatsapp_reply",
                "title": "WhatsApp Reply Received",
                "description": content[:200] if content else "New WhatsApp contact",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }]
        })
        
        # Update message with new lead ID
        await db.whatsapp_messages.update_one(
            {"id": message_id},
            {"$set": {"lead_id": new_lead_id}}
        )
    
    # Add activity to lead
    if lead_id:
        await db.crm_leads.update_one(
            {"id": lead_id},
            {"$push": {
                "activities": {
                    "id": str(uuid.uuid4()),
                    "type": "whatsapp_reply",
                    "title": "WhatsApp Reply Received",
                    "description": content[:200] if content else "Received message",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )

async def auto_update_lead_stage(lead_id: str, content: str, lead: Dict):
    """Auto-update lead stage based on message keywords"""
    content_lower = content.lower()
    
    stage_keywords = {
        "contacted": ["interested", "yes", "call me", "contact", "want", "need"],
        "site_visit": ["site visit", "visit", "come", "see location"],
        "quotation": ["quotation", "quote", "price", "cost", "rate"],
        "lost": ["not interested", "no thanks", "don't want", "already have"]
    }
    
    new_stage = None
    matched_keyword = None
    
    for stage, keywords in stage_keywords.items():
        for keyword in keywords:
            if keyword in content_lower:
                new_stage = stage
                matched_keyword = keyword
                break
        if new_stage:
            break
    
    if new_stage and lead.get("stage") != new_stage:
        # Update lead stage
        await db.crm_leads.update_one(
            {"id": lead_id},
            {"$set": {
                "stage": new_stage,
                "auto_stage_update": True,
                "auto_stage_keyword": matched_keyword,
                "stage_updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Add activity
        await db.crm_leads.update_one(
            {"id": lead_id},
            {"$push": {
                "activities": {
                    "id": str(uuid.uuid4()),
                    "type": "auto_stage_update",
                    "title": f"Auto Stage Update: {new_stage}",
                    "description": f"Stage changed to '{new_stage}' based on keyword '{matched_keyword}'",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )

async def process_status_update(status: Dict):
    """Process message status update (sent, delivered, read, failed)"""
    wa_message_id = status.get("id", "")
    status_value = status.get("status", "")
    # recipient_phone available but not currently needed
    
    # Update message status
    await db.whatsapp_messages.update_one(
        {"wa_message_id": wa_message_id},
        {"$set": {
            "status": status_value,
            f"{status_value}_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update campaign recipient if part of campaign
    await db.whatsapp_campaign_recipients.update_one(
        {"wa_message_id": wa_message_id},
        {"$set": {"status": status_value}}
    )
    
    # Update campaign stats if delivered/read
    if status_value in ["delivered", "read"]:
        message = await db.whatsapp_messages.find_one(
            {"wa_message_id": wa_message_id},
            {"campaign_id": 1}
        )
        if message and message.get("campaign_id"):
            field = f"total_{status_value}"
            await db.whatsapp_campaigns.update_one(
                {"id": message["campaign_id"]},
                {"$inc": {field: 1}}
            )

# ==================== AUTOMATION SETTINGS ====================

@router.get("/automation/settings")
async def get_automation_settings():
    """Get WhatsApp automation settings"""
    settings = await db.whatsapp_automation_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "auto_welcome": False,
            "welcome_template": "asr_welcome",
            "auto_contacted": False,
            "contacted_template": "asr_callback_request",
            "auto_site_visit": False,
            "site_visit_template": "asr_site_visit",
            "auto_quotation": False,
            "quotation_template": "asr_quotation_followup",
            "auto_reactivation": False,
            "reactivation_template": "asr_reactivation",
            "reactivation_days": 7
        }
    return settings

@router.post("/automation/settings")
async def save_automation_settings(data: Dict[str, Any]):
    """Save WhatsApp automation settings"""
    settings_data = {
        "auto_welcome": data.get("auto_welcome", False),
        "welcome_template": data.get("welcome_template", "asr_welcome"),
        "auto_contacted": data.get("auto_contacted", False),
        "contacted_template": data.get("contacted_template", "asr_callback_request"),
        "auto_site_visit": data.get("auto_site_visit", False),
        "site_visit_template": data.get("site_visit_template", "asr_site_visit"),
        "auto_quotation": data.get("auto_quotation", False),
        "quotation_template": data.get("quotation_template", "asr_quotation_followup"),
        "auto_reactivation": data.get("auto_reactivation", False),
        "reactivation_template": data.get("reactivation_template", "asr_reactivation"),
        "reactivation_days": data.get("reactivation_days", 7),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.whatsapp_automation_settings.update_one(
        {},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"success": True, "message": "Automation settings saved"}

# ==================== UTILITY ENDPOINTS ====================

@router.post("/clean-phone")
async def clean_phone_endpoint(data: Dict[str, Any]):
    """Clean and validate a phone number"""
    phone = data.get("phone", "")
    cleaned = clean_phone_number(phone)
    is_valid = validate_phone_number(phone)
    
    return {
        "original": phone,
        "cleaned": cleaned,
        "is_valid": is_valid
    }

@router.get("/leads-for-campaign")
async def get_leads_for_campaign(
    stage: str = None,
    assigned_to: str = None,
    source: str = None,
    limit: int = 100
):
    """Get leads eligible for WhatsApp campaign"""
    query = {"phone": {"$exists": True, "$ne": ""}}
    
    if stage:
        query["stage"] = stage
    if assigned_to:
        query["assigned_to"] = assigned_to
    if source:
        query["source"] = source
    
    leads = await db.crm_leads.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "phone": 1, "stage": 1, "source": 1}
    ).limit(limit).to_list(limit)
    
    # Validate phone numbers
    valid_leads = []
    invalid_count = 0
    for lead in leads:
        if validate_phone_number(lead.get("phone", "")):
            valid_leads.append(lead)
        else:
            invalid_count += 1
    
    return {
        "leads": valid_leads,
        "valid_count": len(valid_leads),
        "invalid_count": invalid_count,
        "total_found": len(leads)
    }
