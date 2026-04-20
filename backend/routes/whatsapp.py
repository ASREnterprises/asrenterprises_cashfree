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
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from db_client import AsyncIOMotorClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# MongoDB connection - uses EFFECTIVE_DB_NAME from db_client (Atlas-aware)
from db_client import get_db
db = get_db()
client = db.client

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
    """
    Get WhatsApp API settings.

    Priority: env vars (production secrets) override empty/missing DB fields.
    A stale DB document with empty access_token must NOT block the env-var
    configuration. We merge env values into any missing/empty fields so a
    half-filled DB doc cannot silently disable WhatsApp.
    """
    env_access_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    env_phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    env_waba_id = os.environ.get("WHATSAPP_WABA_ID", "").strip()
    env_verify_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "asr_whatsapp_verify_2024").strip()

    settings = await db.whatsapp_settings.find_one({}, {"_id": 0}) or {}

    # Env wins (canonical secret source). DB only fills in when env is empty.
    # This prevents a stale/empty DB doc from silently disabling WhatsApp even
    # when the env vars are correctly configured in production.
    merged = {
        "access_token": env_access_token or settings.get("access_token", ""),
        "phone_number_id": env_phone_number_id or settings.get("phone_number_id", ""),
        "waba_id": env_waba_id or settings.get("waba_id", ""),
        "verify_token": env_verify_token or settings.get("verify_token", ""),
        "default_country_code": settings.get("default_country_code") or "91",
        # Auto-active when env credentials are present, even if DB doc says inactive.
        "is_active": bool(settings.get("is_active")) or bool(env_access_token and env_phone_number_id),
        "updated_at": settings.get("updated_at", ""),
    }

    if not merged["access_token"] or not merged["phone_number_id"]:
        return None
    return merged

async def send_whatsapp_template(
    phone: str,
    template_name: str,
    language_code: str = None,  # Changed to None to auto-detect
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

    # ── OPT-OUT GUARD ── Never send to a user who opted out ───────────────────
    if await _is_opted_out(cleaned_phone):
        logger.info(f"SEND BLOCKED — {cleaned_phone} has opted out of WhatsApp messages")
        return {"success": False, "error": "opted_out", "opted_out": True}
    # ──────────────────────────────────────────────────────────────────────────

    # Fetch template record — needed both for language_code auto-detect and
    # for the Meta-approved / active gating below.
    template = await db.whatsapp_templates.find_one({"template_name": template_name}, {"_id": 0})
    if not template:
        template = await db.whatsapp_templates.find_one({"name": template_name}, {"_id": 0})

    # Enforce owner policy: WhatsApp API may only send Meta-approved, active
    # templates. If the local record exists and has been explicitly flagged
    # inactive or not-approved, refuse. If no local record exists we still
    # attempt the send (backward compat for templates created/approved on
    # Meta that have never been synced locally); Meta's own API will reject
    # non-approved names with a clear error.
    if template is not None:
        if template.get("is_active") is False:
            return {"success": False, "error": f"Template '{template_name}' is disabled locally"}
        if template.get("meta_approved") is False:
            return {"success": False, "error": f"Template '{template_name}' is not approved by Meta"}

    if not language_code:
        language_code = template.get("language_code", "en") if template else "en"
    
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
    """Get WhatsApp API settings (masked for security).

    Uses the merged settings (env-vars overlay DB doc) so configuration that
    is provided only via Replit Secrets shows as `configured: true`.
    """
    settings = await get_whatsapp_settings()
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

    # Mask verify_token too — never echo secrets back over HTTP.
    vt = settings.get("verify_token", "") or ""
    masked_verify = f"{vt[:4]}…{vt[-4:]}" if len(vt) >= 10 else "***"

    return {
        "configured": True,
        "access_token": masked_token,
        "phone_number_id": settings.get("phone_number_id", ""),
        "waba_id": settings.get("waba_id", ""),
        "verify_token": masked_verify,
        "verify_token_set": bool(vt),
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
                # Preserve the owner's is_active toggle so Sync does not
                # silently re-enable templates the admin disabled, and track
                # which approved template_names are still present on Meta so
                # we can retire (mark inactive) anything that vanished.
                existing = {
                    t["template_name"]: t
                    for t in await db.whatsapp_templates.find({}, {"_id": 0}).to_list(500)
                    if t.get("template_name")
                }
                approved_names = set()
                for t in templates:
                    if t.get("status") == "APPROVED":
                        # Extract variable count from template components
                        variable_count = 0
                        has_variables = False
                        
                        # Parse components to find variables like {{1}}, {{2}}, etc.
                        components = t.get("components", [])
                        for comp in components:
                            comp_type = comp.get("type", "")
                            
                            # Check HEADER for variables
                            if comp_type == "HEADER":
                                header_format = comp.get("format", "")
                                if header_format in ["TEXT"]:
                                    text = comp.get("text", "")
                                    # Count {{1}}, {{2}}, etc.
                                    import re
                                    vars_in_header = re.findall(r'\{\{\d+\}\}', text)
                                    variable_count += len(vars_in_header)
                            
                            # Check BODY for variables (most common place)
                            if comp_type == "BODY":
                                text = comp.get("text", "")
                                import re
                                vars_in_body = re.findall(r'\{\{\d+\}\}', text)
                                variable_count += len(vars_in_body)
                            
                            # Check BUTTONS for variables
                            if comp_type == "BUTTONS":
                                buttons = comp.get("buttons", [])
                                for btn in buttons:
                                    if btn.get("type") == "URL":
                                        url = btn.get("url", "")
                                        import re
                                        vars_in_url = re.findall(r'\{\{\d+\}\}', url)
                                        variable_count += len(vars_in_url)
                        
                        has_variables = variable_count > 0
                        
                        name = t.get("name")
                        approved_names.add(name)
                        prev = existing.get(name, {})
                        template_data = {
                            "template_name": name,
                            "display_name": t.get("name", "").replace("_", " ").title(),
                            "language_code": t.get("language", "en"),
                            "category": t.get("category", "MARKETING"),
                            "status": t.get("status"),
                            "has_variables": has_variables,
                            "variable_count": variable_count,
                            "components": components,  # Store original components for reference
                            # Respect the admin's toggle — default to True only
                            # when this template is brand new to our DB.
                            "is_active": prev.get("is_active", True),
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                            "meta_approved": True,
                        }
                        await db.whatsapp_templates.update_one(
                            {"template_name": template_data["template_name"]},
                            {"$set": template_data},
                            upsert=True
                        )
                        count += 1

                # Mark local templates that are no longer approved on Meta as
                # inactive + not approved, so the send path (which now checks
                # meta_approved) refuses them. We never auto-delete so the
                # admin can still see the history.
                stale = [n for n in existing.keys() if n not in approved_names]
                if stale:
                    await db.whatsapp_templates.update_many(
                        {"template_name": {"$in": stale}},
                        {"$set": {"is_active": False, "meta_approved": False,
                                  "status": "REMOVED_FROM_META",
                                  "synced_at": datetime.now(timezone.utc).isoformat()}},
                    )
                    logger.info(f"[WhatsApp sync] Marked {len(stale)} templates inactive: {stale}")

                return {"success": True, "message": f"Synced {count} approved templates", "count": count, "deactivated": len(stale)}
            else:
                # IMPORTANT: do NOT silently overwrite the admin's curated
                # templates with hard-coded defaults when Meta's API hiccups.
                # Return an error so the admin knows the sync failed.
                err_msg = response_data.get("error", {}).get("message") if isinstance(response_data, dict) else None
                raise HTTPException(
                    status_code=502,
                    detail=f"Meta template sync failed (HTTP {response.status_code}): {err_msg or 'unknown error'}. Your saved templates were left unchanged."
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template sync error: {str(e)}")
        # Preserve existing curated templates on error — only initialize
        # defaults if the DB is empty (first-time setup).
        existing_count = await db.whatsapp_templates.count_documents({})
        if existing_count > 0:
            raise HTTPException(
                status_code=502,
                detail=f"Meta template sync failed: {e}. Your saved templates were left unchanged."
            )
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
    language_code = data.get("language_code")  # None to auto-detect from template
    
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
    
    # Get template info to check if it needs variables
    template = await db.whatsapp_templates.find_one(
        {"template_name": template_name},
        {"_id": 0, "has_variables": 1, "variable_count": 1}
    )
    
    # Determine if we should send variables
    needs_variables = template and template.get("has_variables", False) and template.get("variable_count", 0) > 0
    
    if not needs_variables:
        # Template doesn't need variables - send empty list
        variables = []
    
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
    
    # Get template info to check if it needs variables
    template = await db.whatsapp_templates.find_one(
        {"template_name": template_name},
        {"_id": 0, "has_variables": 1, "variable_count": 1}
    )
    
    # Determine if we should send variables
    variables = data.get("variables", [])
    needs_variables = template and template.get("has_variables", False) and template.get("variable_count", 0) > 0
    
    if needs_variables:
        # Template needs variables - fill them
        if not variables:
            # Default: use lead name as first variable
            variables = [lead.get("name", "Customer")]
    else:
        # Template doesn't need variables - send empty list
        variables = []
    
    result = await send_whatsapp_template(
        phone=phone,
        template_name=template_name,
        language_code=data.get("language_code"),  # None to auto-detect from template
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
        
        # Get template to check variable count
        template = await db.whatsapp_templates.find_one(
            {"$or": [{"template_name": template_name}, {"name": template_name}]},
            {"_id": 0}
        )
        variable_count = template.get("variable_count", 0) if template else 0
        
        sent = 0
        failed = 0
        
        skipped = 0

        for i, recipient in enumerate(recipients):
            # ── Opt-out pre-check: skip without hitting the API ────────────────
            recipient_phone = clean_phone_number(recipient["phone"])
            if await _is_opted_out(recipient_phone):
                logger.info(f"Campaign {campaign_id}: skipping opted-out {recipient_phone}")
                await db.whatsapp_campaign_recipients.update_one(
                    {"id": recipient["id"]},
                    {"$set": {"status": "skipped_opted_out",
                              "error": "User has opted out",
                              "sent_at": datetime.now(timezone.utc).isoformat()}}
                )
                skipped += 1
                continue
            # ──────────────────────────────────────────────────────────────────

            # Only get variables if template needs them
            variables = None
            if variable_count > 0:
                lead = await db.crm_leads.find_one({"id": recipient["lead_id"]}, {"_id": 0, "name": 1})
                variables = [lead.get("name", "Customer")] if lead else ["Customer"]
            
            result = await send_whatsapp_template(
                phone=recipient["phone"],
                template_name=template_name,
                variables=variables,  # Will be None if template has no variables
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
            
            # Update CRM lead with campaign tracking fields
            if recipient.get("lead_id"):
                now_iso = datetime.now(timezone.utc).isoformat()
                if result.get("success"):
                    await db.crm_leads.update_one(
                        {"id": recipient["lead_id"]},
                        {"$set": {
                            "templateSent": True,
                            "templateName": template_name,
                            "templateSentAt": now_iso,
                            "wa_status": "sent",
                            "wa_delivered": False,
                            "wa_read": False,
                            "wa_failed": False,
                        }}
                    )
                else:
                    await db.crm_leads.update_one(
                        {"id": recipient["lead_id"]},
                        {"$set": {
                            "templateSent": False,
                            "templateName": template_name,
                            "templateSentAt": now_iso,
                            "wa_status": "failed",
                            "wa_failed": True,
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
            
            # Batch delay - add small delay between each message to avoid rate limiting
            await asyncio.sleep(0.5)  # 500ms delay between messages
            
            # Additional delay every batch_size messages
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

# ==================== CRM INBOX ENDPOINT ====================

@router.get("/crm-inbox")
async def get_crm_inbox(filter: str = "replies", page: int = 1, limit: int = 50):
    """
    Filtered CRM inbox based on WhatsApp campaign tracking fields on leads.
    Filters:
      - replies    : wa_reply_received=true  (customer replied — high priority)
      - failed     : wa_failed=true          (template delivery failed)
      - follow_up  : wa_delivered=true AND wa_read != true  (delivered but not read)
      - bulk_sent  : templateSent=true       (all leads that received a template)
      - opted_out  : wa_opted_out=true       (users who sent STOP)
    """
    skip = (page - 1) * limit

    if filter == "replies":
        query = {"wa_reply_received": True}
        sort_field = "wa_last_message_time"
    elif filter == "failed":
        query = {"wa_failed": True}
        sort_field = "templateSentAt"
    elif filter == "follow_up":
        query = {"wa_delivered": True, "wa_read": {"$ne": True}}
        sort_field = "templateSentAt"
    elif filter == "opted_out":
        query = {"wa_opted_out": True}
        sort_field = "wa_opted_out_at"
    else:  # bulk_sent
        query = {"templateSent": True}
        sort_field = "templateSentAt"

    total = await db.crm_leads.count_documents(query)
    leads = await db.crm_leads.find(query, {"_id": 0}).sort(
        [(sort_field, -1), ("timestamp", -1)]
    ).skip(skip).limit(limit).to_list(limit)

    return {
        "leads": leads,
        "total": total,
        "page": page,
        "per_page": limit,
        "filter": filter,
    }


@router.get("/optouts")
async def list_optouts(page: int = 1, limit: int = 100):
    """List all opted-out phone numbers from the wa_optouts collection."""
    skip = (page - 1) * limit
    records = await db.wa_optouts.find(
        {"opted_out": True}, {"_id": 0}
    ).sort("opted_out_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.wa_optouts.count_documents({"opted_out": True})
    return {"optouts": records, "total": total}


@router.post("/optouts/manual")
async def manual_optout(data: Dict[str, Any]):
    """
    Manually opt-out or re-subscribe a phone number (admin action).
    body: { phone: str, opted_out: bool }
    """
    phone_raw = (data.get("phone") or "").strip()
    if not phone_raw:
        raise HTTPException(status_code=400, detail="phone required")
    opted_out: bool = bool(data.get("opted_out", True))
    phone = clean_phone_number(phone_raw)
    now_iso = datetime.now(timezone.utc).isoformat()

    update_fields = {"phone": phone, "opted_out": opted_out}
    if opted_out:
        update_fields["opted_out_at"] = now_iso
    else:
        update_fields["opted_in_at"] = now_iso

    await db.wa_optouts.update_one(
        {"phone": phone}, {"$set": update_fields}, upsert=True
    )

    # Sync to CRM lead if exists
    crm_update = {"wa_opted_out": opted_out}
    if opted_out:
        crm_update["wa_opted_out_at"] = now_iso
    else:
        crm_update["wa_opted_in_at"] = now_iso
    await db.crm_leads.update_many(
        {"$or": [{"phone": phone}, {"phone": phone_raw}]},
        {"$set": crm_update}
    )

    action = "opted out" if opted_out else "re-subscribed"
    logger.info(f"Manual {action}: {phone} by admin")
    return {"success": True, "phone": phone, "opted_out": opted_out}

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
async def get_conversations(page: int = 1, limit: int = 50, background_tasks: BackgroundTasks = None):
    """
    Get all conversations grouped by phone number.
    Returns list of conversations with last message, unread count, and lead info.
    Sorted by last activity (most recent first).
    Auto-deletes messages older than 24 hours.
    """
    skip = (page - 1) * limit
    
    # Auto-cleanup: Delete messages older than 24 hours (run in background)
    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    # Run cleanup in background to not block the request
    async def cleanup_old_messages():
        try:
            result = await db.whatsapp_messages.delete_many({
                "created_at": {"$lt": cutoff_24h}
            })
            if result.deleted_count > 0:
                logger.info(f"Auto-cleanup: Deleted {result.deleted_count} messages older than 24 hours")
        except Exception as e:
            logger.error(f"Auto-cleanup error: {e}")
    
    if background_tasks:
        background_tasks.add_task(cleanup_old_messages)
    
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

@router.post("/templates/bulk-send")
async def send_template_bulk(request: Request, background_tasks: BackgroundTasks):
    """
    Send template message to multiple leads in bulk.
    Accepts list of lead_ids or phone numbers and a template name.
    Returns immediately and processes in background.
    """
    data = await request.json()
    template_name = data.get("template_name")
    lead_ids = data.get("lead_ids", [])
    phones = data.get("phones", [])
    variables = data.get("variables", [])  # Variables to use for all messages
    
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    if not lead_ids and not phones:
        raise HTTPException(status_code=400, detail="At least one lead_id or phone number is required")
    
    # Get settings
    settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp API not configured")
    
    # Get template to check variable count
    template = await db.whatsapp_templates.find_one(
        {"$or": [{"template_name": template_name}, {"name": template_name}]},
        {"_id": 0}
    )
    variable_count = template.get("variable_count", 0) if template else 0
    
    # Only use variables if template requires them
    if variable_count == 0:
        variables = None  # Don't send variables for templates without placeholders
    
    # Collect all phone numbers
    all_phones = []
    
    # Get phones from lead_ids
    if lead_ids:
        for lead_id in lead_ids:
            lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0, "phone": 1, "name": 1})
            if lead and lead.get("phone"):
                all_phones.append({
                    "phone": clean_phone_number(lead["phone"]),
                    "lead_id": lead_id,
                    "name": lead.get("name", "")
                })
    
    # Add direct phone numbers
    for phone in phones:
        clean_phone = clean_phone_number(phone)
        if clean_phone not in [p["phone"] for p in all_phones]:
            all_phones.append({
                "phone": clean_phone,
                "lead_id": None,
                "name": ""
            })
    
    if not all_phones:
        raise HTTPException(status_code=400, detail="No valid phone numbers found")
    
    # Create bulk send job
    job_id = str(uuid.uuid4())
    job_record = {
        "id": job_id,
        "template_name": template_name,
        "total_count": len(all_phones),
        "sent_count": 0,
        "failed_count": 0,
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "results": []
    }
    await db.whatsapp_bulk_jobs.insert_one(job_record)
    
    # Process in background
    async def process_bulk_send():
        sent = 0
        failed = 0
        results = []
        
        for recipient in all_phones:
            try:
                result = await send_whatsapp_template(
                    phone=recipient["phone"],
                    template_name=template_name,
                    variables=variables,
                    lead_id=recipient.get("lead_id")
                )
                
                if result.get("success"):
                    sent += 1
                    results.append({"phone": recipient["phone"], "status": "sent"})
                else:
                    failed += 1
                    results.append({"phone": recipient["phone"], "status": "failed", "error": result.get("error")})
                
                # Small delay to avoid rate limiting
                await asyncio.sleep(0.5)
            except Exception as e:
                failed += 1
                results.append({"phone": recipient["phone"], "status": "failed", "error": str(e)})
        
        # Update job record
        await db.whatsapp_bulk_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "sent_count": sent,
                "failed_count": failed,
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": results
            }}
        )
    
    background_tasks.add_task(process_bulk_send)
    
    return {
        "success": True,
        "job_id": job_id,
        "message": f"Bulk send started for {len(all_phones)} recipients",
        "total_count": len(all_phones)
    }

@router.get("/templates/bulk-send/{job_id}")
async def get_bulk_send_status(job_id: str):
    """Get status of a bulk send job"""
    job = await db.whatsapp_bulk_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

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

# ==================== MESSAGE DELETE ENDPOINTS ====================

# NOTE: auto-cleanup-24h must be defined BEFORE {message_id} to avoid route conflict
@router.delete("/messages/auto-cleanup-24h")
async def auto_cleanup_24h_messages():
    """
    Auto-cleanup messages older than 24 hours.
    This endpoint can be called by a scheduler or manually.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(hours=24)
    
    result = await db.whatsapp_messages.delete_many({
        "created_at": {"$lt": cutoff_date.isoformat()}
    })
    
    logger.info(f"Auto-cleanup: Deleted {result.deleted_count} messages older than 24 hours")
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"Auto-deleted {result.deleted_count} messages older than 24 hours",
        "cutoff_time": cutoff_date.isoformat()
    }

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    """Delete a single WhatsApp message from CRM (does not delete from customer's phone)"""
    result = await db.whatsapp_messages.delete_one({"id": message_id})
    
    if result.deleted_count > 0:
        return {"success": True, "message": "Message deleted"}
    else:
        raise HTTPException(status_code=404, detail="Message not found")

@router.post("/messages/bulk-delete")
async def bulk_delete_messages(request: Request):
    """Delete multiple WhatsApp messages from CRM"""
    data = await request.json()
    message_ids = data.get("message_ids", [])
    
    if not message_ids:
        raise HTTPException(status_code=400, detail="No message IDs provided")
    
    result = await db.whatsapp_messages.delete_many({"id": {"$in": message_ids}})
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"Deleted {result.deleted_count} messages"
    }

@router.delete("/conversations/{phone}/clear")
async def clear_conversation(phone: str):
    """Delete all messages in a conversation"""
    clean_phone = clean_phone_number(phone)
    
    result = await db.whatsapp_messages.delete_many({
        "$or": [
            {"phone": phone},
            {"phone": clean_phone},
            {"phone": {"$regex": phone[-10:] if len(phone) >= 10 else phone}}
        ]
    })
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"Cleared conversation - deleted {result.deleted_count} messages"
    }


@router.post("/conversations/bulk-delete")
async def bulk_delete_conversations(request: Request):
    """Delete multiple conversations at once (bulk selection)"""
    data = await request.json()
    phone_numbers = data.get("phone_numbers", [])
    
    if not phone_numbers:
        raise HTTPException(status_code=400, detail="No phone numbers provided")
    
    total_deleted = 0
    for phone in phone_numbers:
        clean_phone = clean_phone_number(phone)
        result = await db.whatsapp_messages.delete_many({
            "$or": [
                {"phone": phone},
                {"phone": clean_phone},
                {"phone": {"$regex": phone[-10:] if len(phone) >= 10 else phone}}
            ]
        })
        total_deleted += result.deleted_count
    
    return {
        "success": True,
        "deleted_count": total_deleted,
        "conversations_cleared": len(phone_numbers),
        "message": f"Cleared {len(phone_numbers)} conversations - deleted {total_deleted} messages"
    }


@router.delete("/conversations/old")
async def delete_old_conversations(request: Request):
    """Delete conversations older than specified days"""
    data = await request.json()
    days = data.get("days", 30)  # Default 30 days
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    result = await db.whatsapp_messages.delete_many({
        "created_at": {"$lt": cutoff_date.isoformat()}
    })
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"Deleted {result.deleted_count} messages older than {days} days"
    }

@router.get("/messages/cleanup-status")
async def get_cleanup_status():
    """Get cleanup status and message counts by age"""
    now = datetime.now(timezone.utc)
    
    # Count messages by age
    counts = {
        "within_24h": 0,
        "older_than_24h": 0,
        "total": 0
    }
    
    cutoff_24h = (now - timedelta(hours=24)).isoformat()
    
    counts["within_24h"] = await db.whatsapp_messages.count_documents({
        "created_at": {"$gte": cutoff_24h}
    })
    
    counts["older_than_24h"] = await db.whatsapp_messages.count_documents({
        "created_at": {"$lt": cutoff_24h}
    })
    
    counts["total"] = counts["within_24h"] + counts["older_than_24h"]
    
    return {
        "message_counts": counts,
        "auto_delete_enabled": True,
        "auto_delete_threshold_hours": 24,
        "messages_to_delete": counts["older_than_24h"],
        "next_cleanup_info": "Messages older than 24 hours are automatically deleted on each conversation load"
    }

# ==================== MEDIA SENDING ENDPOINTS ====================

@router.post("/conversations/{phone}/send-media")
async def send_media_message(phone: str, request: Request):
    """
    Send media message (image, document, video) to a conversation.
    Requires 24-hour window for non-template media.
    """
    data = await request.json()
    media_type = data.get("media_type", "image")  # image, document, video, audio
    media_url = data.get("media_url", "").strip()
    caption = data.get("caption", "").strip()
    filename = data.get("filename", "")
    
    if not media_url:
        raise HTTPException(status_code=400, detail="Media URL is required")
    
    # Check 24-hour window
    clean_phone = clean_phone_number(phone)
    
    last_incoming = await db.whatsapp_messages.find_one(
        {"phone": {"$in": [phone, clean_phone]}, "direction": "incoming"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not last_incoming:
        raise HTTPException(
            status_code=400,
            detail="No incoming message found. Customer must message first before you can send media."
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
                detail="Outside 24-hour customer service window. Media can only be sent within 24 hours of customer's last message."
            )
    except HTTPException:
        raise
    except (ValueError, TypeError, AttributeError) as e:
        raise HTTPException(status_code=400, detail=f"Unable to verify message window: {str(e)}")
    
    # Get WhatsApp settings
    settings = await get_whatsapp_settings()
    if not settings or not settings.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp API not configured")
    
    lead_id = last_incoming.get("lead_id")
    
    # Create message record
    message_id = str(uuid.uuid4())
    message_record = {
        "id": message_id,
        "phone": clean_phone,
        "lead_id": lead_id,
        "direction": "outgoing",
        "type": media_type,
        "media_url": media_url,
        "content": caption,
        "filename": filename,
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
    
    # Build payload based on media type
    if media_type == "image":
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "image",
            "image": {"link": media_url, "caption": caption}
        }
    elif media_type == "document":
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "document",
            "document": {"link": media_url, "caption": caption, "filename": filename or "document"}
        }
    elif media_type == "video":
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "video",
            "video": {"link": media_url, "caption": caption}
        }
    elif media_type == "audio":
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "audio",
            "audio": {"link": media_url}
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported media type: {media_type}")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(api_url, headers=headers, json=payload)
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
                return {"success": False, "message_id": message_id, "error": error_msg, "status": "failed"}
    except Exception as e:
        await db.whatsapp_messages.update_one(
            {"id": message_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
        return {"success": False, "message_id": message_id, "error": str(e), "status": "failed"}

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
    
    logger.info(f"Webhook verification request - Mode: {mode}, Token: ***masked***, Challenge: {challenge}")
    
    if mode == "subscribe" and token == verify_token:
        if challenge:
            logger.info(f"WhatsApp webhook verified successfully. Returning challenge: {challenge}")
            # IMPORTANT: Meta expects ONLY the challenge value as plain text, HTTP 200
            return PlainTextResponse(content=str(challenge), status_code=200)
        else:
            logger.warning("WhatsApp webhook verification: No challenge provided")
            return PlainTextResponse(content="Missing challenge", status_code=400)
    else:
        logger.warning(f"WhatsApp webhook verification failed. Mode: {mode}, token mismatch")
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

# ==================== OPT-OUT / OPT-IN SYSTEM ====================

_STOP_KEYWORDS  = {"stop", "unsubscribe", "opt out", "optout", "opt-out"}
_START_KEYWORDS = {"start", "subscribe", "opt in", "optin", "opt-in"}

async def _send_text_reply(phone: str, text: str) -> None:
    """Send a plain-text WhatsApp reply — used only for opt-out/in confirmations."""
    try:
        settings = await get_whatsapp_settings()
        if not settings or not settings.get("access_token"):
            logger.warning("Cannot send opt-out reply — WhatsApp API not configured")
            return
        cleaned = clean_phone_number(phone, settings.get("default_country_code", "91"))
        payload = {
            "messaging_product": "whatsapp",
            "to": cleaned,
            "type": "text",
            "text": {"body": text}
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{WHATSAPP_API_BASE}/{settings['phone_number_id']}/messages",
                headers={"Authorization": f"Bearer {settings['access_token']}", "Content-Type": "application/json"},
                json=payload,
            )
            if resp.status_code not in (200, 201):
                logger.warning(f"Opt-out reply failed for {phone}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Opt-out reply exception for {phone}: {e}")


async def _handle_optout_keyword(
    phone: str,
    content: str,
    lead: Optional[Dict],
) -> bool:
    """
    Detect STOP / START keywords (case-insensitive).
    Updates wa_optouts collection + crm_leads, sends auto-reply.
    Returns True if the message was a keyword (caller should skip automation).
    """
    normalized = content.lower().strip()

    if normalized in _STOP_KEYWORDS:
        now_iso = datetime.now(timezone.utc).isoformat()
        logger.info(f"OPT-OUT: {phone} sent '{content}'")

        # Upsert wa_optouts collection (phone-level, survives even without a lead)
        await db.wa_optouts.update_one(
            {"phone": phone},
            {"$set": {"phone": phone, "opted_out": True, "opted_out_at": now_iso},
             "$unset": {"opted_in_at": ""}},
            upsert=True,
        )

        # Update CRM lead if exists
        if lead:
            await db.crm_leads.update_one(
                {"id": lead["id"]},
                {"$set": {
                    "wa_opted_out": True,
                    "wa_opted_out_at": now_iso,
                    "wa_priority": "opted_out",
                }}
            )
            logger.info(f"OPT-OUT: CRM lead {lead['id']} ({lead.get('name')}) marked opted-out")

        # Send confirmation reply
        await _send_text_reply(
            phone,
            "You have been successfully removed from ASR ENTERPRISES updates. "
            "You will no longer receive messages from us. "
            "Reply START to subscribe again."
        )
        return True

    if normalized in _START_KEYWORDS:
        now_iso = datetime.now(timezone.utc).isoformat()
        logger.info(f"OPT-IN: {phone} sent '{content}'")

        # Upsert wa_optouts — mark opted back in
        await db.wa_optouts.update_one(
            {"phone": phone},
            {"$set": {"phone": phone, "opted_out": False, "opted_in_at": now_iso},
             "$unset": {"opted_out_at": ""}},
            upsert=True,
        )

        # Update CRM lead if exists
        if lead:
            await db.crm_leads.update_one(
                {"id": lead["id"]},
                {"$set": {
                    "wa_opted_out": False,
                    "wa_opted_in_at": now_iso,
                }}
            )
            logger.info(f"OPT-IN: CRM lead {lead['id']} ({lead.get('name')}) re-subscribed")

        # Send confirmation reply
        await _send_text_reply(
            phone,
            "You are successfully subscribed again to ASR ENTERPRISES updates. "
            "You will now receive our solar energy offers and service updates."
        )
        return True

    return False


async def _is_opted_out(phone: str) -> bool:
    """Quick lookup: has this phone number opted out of WhatsApp messages?"""
    record = await db.wa_optouts.find_one({"phone": phone, "opted_out": True}, {"_id": 0})
    return bool(record)


async def process_incoming_message(message: Dict, value: Dict):
    """Process incoming WhatsApp message and trigger automation"""
    from routes.whatsapp_automation import (
        handle_incoming_message_automation, 
        cancel_follow_ups_for_lead,
        schedule_follow_up
    )
    
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
    
    # Check for referral data (from Click-to-WhatsApp ads)
    referral = message.get("referral", {})
    detected_source = None
    if referral:
        source_url = referral.get("source_url", "").lower()
        source_type = referral.get("source_type", "").lower()
        if "facebook" in source_url or source_type == "facebook":
            detected_source = "facebook"
        elif "instagram" in source_url or source_type == "instagram":
            detected_source = "instagram"
        else:
            detected_source = "facebook"  # Default for Meta ads
    
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

    # ── OPT-OUT / OPT-IN KEYWORD GATE ─────────────────────────────────────────
    # Must run before automation. If it returns True the message was STOP/START,
    # so we persist it for audit then exit — no automation, no chatbot reply.
    if content:
        is_keyword = await _handle_optout_keyword(cleaned_phone, content, lead)
        if is_keyword:
            # Still save the message for compliance audit
            await db.whatsapp_messages.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "phone": cleaned_phone,
                "direction": "incoming",
                "message_type": msg_type,
                "content": content,
                "wa_message_id": wa_message_id,
                "status": "received",
                "raw_message": message,
                "opt_keyword": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return
    # ──────────────────────────────────────────────────────────────────────────

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
        "referral": referral if referral else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create new lead if not found
    if not lead_id and cleaned_phone:
        contact_name = ""
        contacts = value.get("contacts", [])
        if contacts:
            contact_name = contacts[0].get("profile", {}).get("name", "")
        
        new_lead_id = str(uuid.uuid4())
        lead_source = detected_source or "whatsapp_reply"
        
        await db.crm_leads.insert_one({
            "id": new_lead_id,
            "name": contact_name or f"WhatsApp {cleaned_phone[-4:]}",
            "phone": cleaned_phone,
            "source": lead_source,
            "stage": "new",
            "tags": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "activities": [{
                "id": str(uuid.uuid4()),
                "type": "whatsapp_reply",
                "title": "WhatsApp Reply Received",
                "description": content[:200] if content else "New WhatsApp contact",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }]
        })
        
        lead_id = new_lead_id
        
        # Update message with new lead ID
        await db.whatsapp_messages.update_one(
            {"id": message_id},
            {"$set": {"lead_id": new_lead_id}}
        )
    
    # Add activity to existing lead + update reply tracking
    if lead_id and lead:
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.crm_leads.update_one(
            {"id": lead_id},
            {
                "$push": {
                    "activities": {
                        "id": str(uuid.uuid4()),
                        "type": "whatsapp_reply",
                        "title": "WhatsApp Reply Received",
                        "description": content[:200] if content else "Received message",
                        "timestamp": now_iso
                    }
                },
                "$set": {
                    "last_interaction": now_iso,
                    "wa_reply_received": True,
                    "wa_priority": "high",
                    "wa_last_message": content[:500] if content else "",
                    "wa_last_message_time": now_iso,
                }
            }
        )
    elif lead_id and not lead:
        # New lead created — set reply tracking on it
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.crm_leads.update_one(
            {"id": lead_id},
            {"$set": {
                "wa_reply_received": True,
                "wa_priority": "high",
                "wa_last_message": content[:500] if content else "",
                "wa_last_message_time": now_iso,
            }}
        )
    
    # Cancel any pending follow-ups since customer responded
    try:
        await cancel_follow_ups_for_lead(cleaned_phone)
    except Exception as e:
        logger.warning(f"Error cancelling follow-ups: {e}")
    
    # ==================== TRIGGER AUTOMATION BOT ====================
    try:
        automation_result = await handle_incoming_message_automation(
            phone=cleaned_phone,
            content=content,
            lead_source=detected_source,
            payload=message,
            lead_id=lead_id
        )
        
        logger.info(f"Automation result for {cleaned_phone}: {automation_result}")
        
        # Schedule follow-up if automation sent a reply
        if automation_result.get("auto_reply_sent") and lead_id:
            try:
                await schedule_follow_up(phone=cleaned_phone, lead_id=lead_id, follow_up_number=1)
            except Exception as e:
                logger.warning(f"Error scheduling follow-up: {e}")
                
    except Exception as e:
        logger.error(f"Automation error for {cleaned_phone}: {str(e)}")
        # Don't fail the webhook on automation error
    
    # Auto-update lead stage based on keywords (legacy logic, kept for backward compatibility)
    if lead_id and content and lead:
        await auto_update_lead_stage(lead_id, content, lead)

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
    recipient_phone = status.get("recipient_id", "")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Update message status
    await db.whatsapp_messages.update_one(
        {"wa_message_id": wa_message_id},
        {"$set": {
            "status": status_value,
            f"{status_value}_at": now_iso
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
    
    # Update CRM lead tracking fields based on status
    lead_query = None
    if recipient_phone:
        cleaned = clean_phone_number(recipient_phone)
        lead_query = {"$or": [{"phone": cleaned}, {"phone": recipient_phone}]}
    else:
        # Fall back: look up phone via whatsapp_messages
        msg = await db.whatsapp_messages.find_one({"wa_message_id": wa_message_id}, {"lead_id": 1})
        if msg and msg.get("lead_id"):
            lead_query = {"id": msg["lead_id"]}
    
    if lead_query:
        if status_value == "delivered":
            await db.crm_leads.update_one(lead_query, {"$set": {"wa_delivered": True, "wa_status": "delivered"}})
        elif status_value == "read":
            await db.crm_leads.update_one(lead_query, {"$set": {"wa_read": True, "wa_status": "read"}})
        elif status_value == "failed":
            await db.crm_leads.update_one(lead_query, {"$set": {"wa_failed": True, "wa_status": "failed", "wa_priority": "low"}})

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


# ==================== AUTOMATION BOT ENDPOINTS ====================

@router.get("/automation/bot/settings")
async def get_bot_automation_settings():
    """Get WhatsApp bot automation settings"""
    from routes.whatsapp_automation import get_automation_settings, BUSINESS_INFO, FOLLOW_UP_CONFIG
    
    settings = await get_automation_settings()
    
    return {
        "settings": settings,
        "business_hours": {
            "start": str(BUSINESS_INFO["business_hours"]["start"]),
            "end": str(BUSINESS_INFO["business_hours"]["end"]),
            "days": BUSINESS_INFO["business_hours"]["days"],
            "days_display": "Monday to Saturday"
        },
        "follow_up_config": FOLLOW_UP_CONFIG
    }

@router.post("/automation/bot/settings")
async def update_bot_automation_settings(data: Dict[str, Any]):
    """Update WhatsApp bot automation settings"""
    from routes.whatsapp_automation import update_automation_settings
    
    settings = await update_automation_settings(data)
    return {"success": True, "settings": settings}

@router.get("/automation/bot/status")
async def get_bot_status():
    """Get current bot status and statistics"""
    from routes.whatsapp_automation import is_business_hours, get_ist_now
    
    now_ist = get_ist_now()
    
    # Get auto-reply stats for today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    stats = {
        "welcome_sent": await db.whatsapp_messages.count_documents({
            "auto_reply_type": "welcome",
            "created_at": {"$gte": today_start.isoformat()}
        }),
        "after_hours_sent": await db.whatsapp_messages.count_documents({
            "auto_reply_type": "after_hours",
            "created_at": {"$gte": today_start.isoformat()}
        }),
        "fb_ig_welcome_sent": await db.whatsapp_messages.count_documents({
            "auto_reply_type": "fb_ig_welcome",
            "created_at": {"$gte": today_start.isoformat()}
        }),
        "quick_replies_sent": await db.whatsapp_messages.count_documents({
            "auto_reply_type": "quick_reply",
            "created_at": {"$gte": today_start.isoformat()}
        }),
        "follow_ups_sent": await db.whatsapp_messages.count_documents({
            "auto_reply_type": "follow_up",
            "created_at": {"$gte": today_start.isoformat()}
        })
    }
    
    # Get pending follow-ups
    pending_follow_ups = await db.whatsapp_follow_ups.count_documents({"status": "pending"})
    
    # Fetch current settings (includes bot_enabled, ai_fallback_enabled, etc.)
    from routes.whatsapp_automation import get_automation_settings
    bot_settings = await get_automation_settings()

    # Check AI provider availability
    try:
        from routes.whatsapp_ai import ai_provider_configured
        ai_providers = ai_provider_configured()
    except Exception:
        ai_providers = {"openai": False, "gemini": False, "any_configured": False}

    # AI replies sent today
    ai_replies_today = await db.whatsapp_messages.count_documents({
        "auto_reply_type": "ai_reply",
        "created_at": {"$gte": today_start.isoformat()}
    })
    stats["ai_replies_sent"] = ai_replies_today

    # Intent-template replies sent today (price/subsidy/bill/loan/installation)
    intent_replies_today = await db.whatsapp_messages.count_documents({
        "auto_reply_type": "intent_reply",
        "created_at": {"$gte": today_start.isoformat()}
    })
    stats["intent_replies_sent"] = intent_replies_today

    return {
        "bot_active": bot_settings.get("bot_enabled", True),       # display alias
        "bot_enabled": bot_settings.get("bot_enabled", True),      # actual DB field
        "ai_fallback_enabled": bot_settings.get("ai_fallback_enabled", True),
        "ai_providers": ai_providers,
        "spam_filter_enabled": bot_settings.get("spam_filter_enabled", True),
        "pause_bot_on_human_handover": bot_settings.get("pause_bot_on_human_handover", True),
        "is_business_hours": is_business_hours(),
        "current_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
        "current_day": now_ist.strftime("%A"),
        "today_stats": stats,
        "pending_follow_ups": pending_follow_ups
    }

@router.post("/automation/bot/test")
async def test_bot_response(data: Dict[str, Any]):
    """Test bot response for a given message (does not actually send)"""
    from routes.whatsapp_automation import (
        process_auto_reply, 
        detect_option_from_message,
        is_business_hours,
        is_greeting_message
    )
    
    phone = data.get("phone", "9999999999")
    content = data.get("content", "")
    lead_source = data.get("lead_source")
    
    # Get what the bot would respond with
    result = await process_auto_reply(
        phone=phone,
        content=content,
        lead_source=lead_source
    )
    
    return {
        "test_input": {
            "phone": phone,
            "content": content,
            "lead_source": lead_source
        },
        "detected_option": detect_option_from_message(content),
        "is_greeting": is_greeting_message(content),
        "is_business_hours": is_business_hours(),
        "would_send_reply": result is not None,
        "reply_type": result.get("type") if result else None,
        "reply_message": result.get("message")[:200] + "..." if result and len(result.get("message", "")) > 200 else (result.get("message") if result else None)
    }

@router.get("/automation/bot/follow-ups")
async def get_follow_ups(status: str = None, limit: int = 50):
    """Get scheduled follow-ups"""
    query = {}
    if status:
        query["status"] = status
    
    follow_ups = await db.whatsapp_follow_ups.find(
        query,
        {"_id": 0}
    ).sort("scheduled_at", -1).limit(limit).to_list(limit)
    
    return {"follow_ups": follow_ups, "count": len(follow_ups)}

@router.post("/automation/bot/process-follow-ups")
async def trigger_process_follow_ups():
    """Manually trigger processing of pending follow-ups"""
    from routes.whatsapp_automation import process_pending_follow_ups
    
    await process_pending_follow_ups()
    
    return {"success": True, "message": "Follow-ups processed"}

@router.delete("/automation/bot/follow-ups/{follow_up_id}")
async def cancel_follow_up(follow_up_id: str):
    """Cancel a specific follow-up"""
    result = await db.whatsapp_follow_ups.update_one(
        {"id": follow_up_id, "status": "pending"},
        {"$set": {
            "status": "cancelled_manually",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count > 0:
        return {"success": True, "message": "Follow-up cancelled"}
    else:
        raise HTTPException(status_code=404, detail="Follow-up not found or already processed")



# ==================== WEBSITE WHATSAPP CLICK TRACKING ====================

@router.post("/website-click")
async def log_website_whatsapp_click(data: Dict[str, Any]):
    """
    Log WhatsApp click from website for CRM tracking.
    Creates a lead record if visitor info is available.
    """
    try:
        click_data = {
            "id": str(uuid.uuid4()),
            "source": data.get("source", "website"),
            "context": data.get("context", {}),
            "page": data.get("page", "/"),
            "timestamp": data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store click event
        await db.whatsapp_website_clicks.insert_one(click_data)
        
        # Create a potential lead if we have context
        context = data.get("context", {})
        if context.get("billAmount") or context.get("district") or context.get("lastViewedCapacity"):
            lead_id = str(uuid.uuid4())
            lead_data = {
                "id": lead_id,
                "name": "Website WhatsApp Click",
                "phone": None,  # Will be captured when they message
                "source": f"website_whatsapp_{data.get('source', 'click')}",
                "stage": "new",
                "tags": ["whatsapp_lead", "website_click", "pending_contact"],
                "website_context": context,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "activities": [{
                    "id": str(uuid.uuid4()),
                    "type": "website_whatsapp_click",
                    "title": "Clicked WhatsApp from Website",
                    "description": f"Visitor clicked WhatsApp button on {data.get('page', '/')}. Bill: {context.get('billAmount', 'N/A')}, District: {context.get('district', 'N/A')}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }]
            }
            
            # Only create lead if we have useful context
            if context.get("billAmount") or context.get("lastViewedCapacity"):
                await db.crm_leads.insert_one(lead_data)
                return {"success": True, "message": "Click logged and lead created", "lead_id": lead_id}
        
        return {"success": True, "message": "Click logged"}
        
    except Exception as e:
        logger.error(f"Error logging WhatsApp click: {e}")
        return {"success": False, "error": str(e)}

@router.get("/website-clicks/stats")
async def get_website_click_stats():
    """Get statistics for website WhatsApp clicks"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_clicks = await db.whatsapp_website_clicks.count_documents({})
    today_clicks = await db.whatsapp_website_clicks.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Get clicks by source
    pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_source = await db.whatsapp_website_clicks.aggregate(pipeline).to_list(10)
    
    return {
        "total_clicks": total_clicks,
        "today_clicks": today_clicks,
        "by_source": {item["_id"]: item["count"] for item in by_source}
    }
