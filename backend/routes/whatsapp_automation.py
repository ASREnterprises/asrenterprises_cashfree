"""
WhatsApp CRM Automation for ASR Enterprises
Handles auto-replies, lead qualification, quick reply flows, and follow-ups
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta, time
from typing import Dict, Any, Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "asr_enterprises")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ==================== ASR ENTERPRISES BUSINESS INFO ====================
BUSINESS_INFO = {
    "name": "ASR Enterprises",
    "phone": "9296389097",
    "whatsapp": "9296389097",
    "website": "www.asrenterprises.in",
    "email": "support@asrenterprises.in",
    "address": "Shop no 10 AMAN SKS COMPLEX, Khagaul Saguna Road, Patna, Bihar 801503",
    "location": "Patna, Bihar",
    "business_type": "Rooftop Solar Installation",
    # Business hours (IST - UTC+5:30)
    "business_hours": {
        "start": time(9, 0),  # 9 AM IST
        "end": time(19, 0),   # 7 PM IST
        "days": [0, 1, 2, 3, 4, 5]  # Monday to Saturday (0=Monday)
    }
}

# ==================== AUTO-REPLY MESSAGES ====================

DEFAULT_WELCOME_MESSAGE = """👋 Hello! Welcome to ASR Enterprises ☀️

Thank you for contacting us for Rooftop Solar Solutions.

We are here to help you with:
✅ Home Solar Installation
✅ Shop / Office Solar
✅ PM Surya Ghar Subsidy Guidance
✅ Free Site Visit
✅ Price / Quotation
✅ System Upgrade / Support

Please reply with the option number below:

1️⃣ Home Solar
2️⃣ Shop / Office Solar
3️⃣ PM Surya Ghar Subsidy
4️⃣ Free Site Visit
5️⃣ Price / Quotation
6️⃣ Existing Solar Service / Support
7️⃣ Talk to Sales Team

📞 Call: 9296389097
🌐 www.asrenterprises.in
📍 Patna, Bihar"""

FACEBOOK_INSTAGRAM_WELCOME = """👋 Hello! Thank you for your interest in ASR Enterprises Solar Solutions ☀️

We'd be happy to help you with the best solar solution for your home or business.

Please reply with any one option:

1️⃣ I want Home Solar
2️⃣ I want Shop / Office Solar
3️⃣ I want Subsidy Information
4️⃣ I want Price Details
5️⃣ I want a Free Site Visit

You can also send:
📸 A photo of your roof
📄 Your electricity bill
📍 Your location

This helps us give you a faster and better estimate.

📞 9296389097"""

AFTER_HOURS_MESSAGE = """🌙 Hello! Thank you for contacting ASR Enterprises ☀️

Our team is currently offline, but your inquiry is important to us.

Please leave the following details and our team will contact you soon:

👤 Name
📍 Location
🏠 Home / Shop / Office
⚡ Monthly electricity bill (approx)
📸 Roof photo (optional)

You can also reply with:

1️⃣ Home Solar
2️⃣ Shop / Office Solar
3️⃣ Subsidy Help
4️⃣ Price / Quotation
5️⃣ Free Site Visit

We will get back to you as soon as possible.

📞 9296389097
📍 Patna, Bihar"""

FOLLOW_UP_MESSAGE = """👋 Hello from ASR Enterprises ☀️

Just following up on your solar inquiry.

If you are still interested, we can help you with:

✅ Solar price estimate
✅ Subsidy guidance
✅ Free site visit
✅ Home / Shop solar installation

Simply reply with:
1️⃣ Price
2️⃣ Subsidy
3️⃣ Site Visit
4️⃣ Talk to Team

📞 9296389097"""

# ==================== QUICK REPLY RESPONSES ====================

QUICK_REPLIES = {
    "1": {
        "tag": "Home Solar Lead",
        "stage": "contacted",
        "response": """🏠 Great choice! We can help you with Home Rooftop Solar Installation.

To guide you properly, please send:

1️⃣ Your location
2️⃣ Approx monthly electricity bill
3️⃣ Roof type (RCC / Tin / Other)
4️⃣ Roof photo (optional)

Once we receive this, our team can suggest the best solar capacity for your home.

📞 9296389097"""
    },
    "2": {
        "tag": "Commercial Solar Lead",
        "stage": "contacted",
        "response": """🏢 Thank you! We also provide Solar Solutions for Shops, Offices & Commercial Use.

Please share:

1️⃣ Your business/shop location
2️⃣ Approx monthly electricity bill
3️⃣ Available rooftop space
4️⃣ Roof photo (optional)

Our team will suggest the best system for your requirement.

📞 9296389097"""
    },
    "3": {
        "tag": "Subsidy Lead",
        "stage": "contacted",
        "response": """☀️ Yes, we can guide you regarding PM Surya Ghar Yojana / Subsidy Support.

To help you better, please share:

1️⃣ Your district / location
2️⃣ House type
3️⃣ Approx electricity bill
4️⃣ Whether you want installation also

Our team will explain eligibility, process, and solar options.

📞 9296389097"""
    },
    "4": {
        "tag": "Site Visit Lead",
        "stage": "site_visit",
        "response": """📍 Sure! We can arrange a Free Site Visit.

Please send:

1️⃣ Your name
2️⃣ Full address / location
3️⃣ Preferred day / time
4️⃣ Contact number

Our team will coordinate with you shortly.

📞 9296389097"""
    },
    "5": {
        "tag": "Quotation Lead",
        "stage": "quotation",
        "response": """💰 Sure! We can help with Solar Price / Quotation.

Please share:

1️⃣ Monthly electricity bill
2️⃣ Home / Shop / Office
3️⃣ Location
4️⃣ Roof type

After that, our team can suggest an estimated system size and pricing.

📞 9296389097"""
    },
    "6": {
        "tag": "Service Lead",
        "stage": "contacted",
        "response": """🛠️ We can also help with Existing Solar System Service / Support.

Please send:

1️⃣ Installed system size (if known)
2️⃣ Problem you are facing
3️⃣ Location
4️⃣ Photo / video (if available)

Our support team will review and assist you.

📞 9296389097"""
    },
    "7": {
        "tag": "Sales Call Lead",
        "stage": "contacted",
        "response": """📞 Sure! Our sales team will connect with you shortly.

Please share:

- Your name
- Your location
- Your requirement

You can also call directly on:
📞 9296389097"""
    }
}

# Alternative keywords for each option
KEYWORD_MAPPINGS = {
    "1": ["home solar", "residential", "ghar", "घर", "home", "1️⃣"],
    "2": ["shop", "office", "commercial", "business", "dukan", "दुकान", "2️⃣"],
    "3": ["subsidy", "pm surya", "surya ghar", "yojana", "सब्सिडी", "3️⃣"],
    "4": ["site visit", "visit", "free visit", "survey", "देखना", "4️⃣"],
    "5": ["price", "quotation", "quote", "cost", "rate", "kitna", "कीमत", "5️⃣"],
    "6": ["service", "support", "repair", "problem", "issue", "समस्या", "6️⃣"],
    "7": ["call", "talk", "sales", "baat", "बात", "7️⃣"]
}

# Source tag mappings
SOURCE_TAGS = {
    "facebook_ads": "Facebook Lead",
    "facebook": "Facebook Lead",
    "instagram_ads": "Instagram Lead",
    "instagram": "Instagram Lead",
    "website": "Website Lead",
    "whatsapp_direct": "Direct WhatsApp Lead",
    "whatsapp_reply": "Direct WhatsApp Lead"
}

# ==================== HELPER FUNCTIONS ====================

def is_business_hours() -> bool:
    """Check if current time is within business hours (IST)"""
    # Convert to IST (UTC+5:30)
    ist_offset = timedelta(hours=5, minutes=30)
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc + ist_offset
    
    current_time = now_ist.time()
    current_day = now_ist.weekday()
    
    hours = BUSINESS_INFO["business_hours"]
    
    # Check if it's a working day
    if current_day not in hours["days"]:
        return False
    
    # Check if within business hours
    return hours["start"] <= current_time <= hours["end"]

def detect_option_from_message(content: str) -> Optional[str]:
    """Detect which option the user selected based on message content"""
    content_lower = content.lower().strip()
    
    # First check for direct number input
    for option in QUICK_REPLIES.keys():
        if content_lower == option or content_lower == f"{option}." or content_lower.startswith(f"{option} "):
            return option
    
    # Check for emoji numbers
    emoji_numbers = {"1️⃣": "1", "2️⃣": "2", "3️⃣": "3", "4️⃣": "4", "5️⃣": "5", "6️⃣": "6", "7️⃣": "7"}
    for emoji, option in emoji_numbers.items():
        if emoji in content:
            return option
    
    # Check for keywords
    for option, keywords in KEYWORD_MAPPINGS.items():
        for keyword in keywords:
            if keyword in content_lower:
                return option
    
    return None

async def is_new_conversation(phone: str) -> bool:
    """Check if this is a new conversation (no previous messages in last 24 hours)"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    
    existing_messages = await db.whatsapp_messages.count_documents({
        "phone": {"$regex": phone[-10:]},  # Match last 10 digits
        "created_at": {"$gte": cutoff.isoformat()}
    })
    
    return existing_messages <= 1  # Only the current incoming message

async def has_received_welcome(phone: str) -> bool:
    """Check if user has already received a welcome message"""
    # Check if we've sent a welcome/auto-reply in the last 24 hours
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    
    welcome_sent = await db.whatsapp_messages.count_documents({
        "phone": {"$regex": phone[-10:]},
        "direction": "outgoing",
        "auto_reply_type": {"$in": ["welcome", "after_hours", "fb_ig_welcome"]},
        "created_at": {"$gte": cutoff.isoformat()}
    })
    
    return welcome_sent > 0

async def get_lead_source(phone: str) -> str:
    """Get the source of the lead"""
    lead = await db.crm_leads.find_one(
        {"$or": [
            {"phone": phone},
            {"phone": phone[-10:]}
        ]},
        {"_id": 0, "source": 1}
    )
    
    return lead.get("source", "whatsapp_direct") if lead else "whatsapp_direct"

async def tag_lead(phone: str, tag: str):
    """Add a tag to the lead"""
    await db.crm_leads.update_one(
        {"$or": [
            {"phone": phone},
            {"phone": phone[-10:]}
        ]},
        {
            "$addToSet": {"tags": tag},
            "$set": {"tagged_at": datetime.now(timezone.utc).isoformat()}
        }
    )

async def update_lead_stage(phone: str, stage: str, option: str):
    """Update lead stage based on selected option"""
    await db.crm_leads.update_one(
        {"$or": [
            {"phone": phone},
            {"phone": phone[-10:]}
        ]},
        {
            "$set": {
                "stage": stage,
                "qualification_option": option,
                "qualified_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "activities": {
                    "id": str(uuid.uuid4()),
                    "type": "auto_qualification",
                    "title": f"Lead Qualified: Option {option}",
                    "description": f"Customer selected option {option}. Stage: {stage}. Tag: {QUICK_REPLIES[option]['tag']}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )

async def send_text_message(phone: str, text: str, auto_reply_type: str = None) -> Dict:
    """Send a text message via WhatsApp Cloud API"""
    import httpx
    
    settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("access_token"):
        logger.error("WhatsApp API not configured")
        return {"success": False, "error": "WhatsApp API not configured"}
    
    access_token = settings["access_token"]
    phone_number_id = settings["phone_number_id"]
    
    # Clean phone number
    cleaned_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
    if not cleaned_phone.startswith("91") and len(cleaned_phone) == 10:
        cleaned_phone = f"91{cleaned_phone}"
    
    payload = {
        "messaging_product": "whatsapp",
        "to": cleaned_phone,
        "type": "text",
        "text": {"body": text}
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                f"https://graph.facebook.com/v18.0/{phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            response_data = response.json()
            
            if response.status_code in [200, 201]:
                wa_message_id = response_data.get("messages", [{}])[0].get("id", "")
                
                # Log outgoing message
                message_id = str(uuid.uuid4())
                await db.whatsapp_messages.insert_one({
                    "id": message_id,
                    "phone": cleaned_phone,
                    "direction": "outgoing",
                    "message_type": "text",
                    "content": text,
                    "wa_message_id": wa_message_id,
                    "status": "sent",
                    "auto_reply_type": auto_reply_type,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                return {"success": True, "wa_message_id": wa_message_id}
            else:
                error_msg = response_data.get("error", {}).get("message", "Unknown error")
                logger.error(f"WhatsApp send error: {error_msg}")
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        logger.error(f"WhatsApp API error: {str(e)}")
        return {"success": False, "error": str(e)}

# ==================== MAIN AUTOMATION FUNCTIONS ====================

async def process_auto_reply(phone: str, content: str, lead_source: str = None) -> Optional[Dict]:
    """
    Main function to process incoming messages and determine auto-reply
    Returns the response to send, or None if no auto-reply needed
    """
    # Check if this is a new conversation
    is_new = await is_new_conversation(phone)
    has_welcome = await has_received_welcome(phone)
    
    # Get lead source
    if not lead_source:
        lead_source = await get_lead_source(phone)
    
    # Detect if user selected an option
    selected_option = detect_option_from_message(content)
    
    if selected_option and selected_option in QUICK_REPLIES:
        # User selected an option - send quick reply response
        reply_config = QUICK_REPLIES[selected_option]
        
        # Tag the lead
        await tag_lead(phone, reply_config["tag"])
        
        # Update lead stage
        await update_lead_stage(phone, reply_config["stage"], selected_option)
        
        # Add source tag
        source_tag = SOURCE_TAGS.get(lead_source, "Direct WhatsApp Lead")
        await tag_lead(phone, source_tag)
        
        return {
            "type": "quick_reply",
            "option": selected_option,
            "message": reply_config["response"],
            "tag": reply_config["tag"],
            "stage": reply_config["stage"]
        }
    
    # If new conversation and no welcome sent yet
    if is_new and not has_welcome:
        # Determine which welcome message to send
        if not is_business_hours():
            return {
                "type": "after_hours",
                "message": AFTER_HOURS_MESSAGE
            }
        elif lead_source in ["facebook_ads", "facebook", "instagram_ads", "instagram"]:
            return {
                "type": "fb_ig_welcome",
                "message": FACEBOOK_INSTAGRAM_WELCOME
            }
        else:
            return {
                "type": "welcome",
                "message": DEFAULT_WELCOME_MESSAGE
            }
    
    # No auto-reply needed
    return None

async def handle_incoming_message_automation(phone: str, content: str, lead_source: str = None) -> Dict:
    """
    Handle incoming message and send appropriate auto-reply
    Called from the webhook handler
    """
    result = await process_auto_reply(phone, content, lead_source)
    
    if result:
        # Send the auto-reply
        send_result = await send_text_message(
            phone=phone,
            text=result["message"],
            auto_reply_type=result["type"]
        )
        
        return {
            "auto_reply_sent": True,
            "reply_type": result["type"],
            "send_result": send_result
        }
    
    return {"auto_reply_sent": False, "reason": "No auto-reply needed"}

async def schedule_follow_up(phone: str, lead_id: str, delay_hours: int = 24):
    """Schedule a follow-up message for a lead"""
    follow_up_time = datetime.now(timezone.utc) + timedelta(hours=delay_hours)
    
    await db.whatsapp_follow_ups.insert_one({
        "id": str(uuid.uuid4()),
        "phone": phone,
        "lead_id": lead_id,
        "scheduled_at": follow_up_time.isoformat(),
        "status": "pending",
        "message": FOLLOW_UP_MESSAGE,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

async def process_pending_follow_ups():
    """Process all pending follow-ups that are due"""
    now = datetime.now(timezone.utc)
    
    pending = await db.whatsapp_follow_ups.find({
        "status": "pending",
        "scheduled_at": {"$lte": now.isoformat()}
    }).to_list(100)
    
    for follow_up in pending:
        # Check if customer has replied in the last 24 hours
        cutoff = now - timedelta(hours=24)
        recent_reply = await db.whatsapp_messages.count_documents({
            "phone": {"$regex": follow_up["phone"][-10:]},
            "direction": "incoming",
            "created_at": {"$gte": cutoff.isoformat()}
        })
        
        if recent_reply == 0:
            # No recent reply, send follow-up
            # Note: This should ideally be sent as a template to avoid 24-hour window issues
            result = await send_text_message(
                phone=follow_up["phone"],
                text=follow_up["message"],
                auto_reply_type="follow_up"
            )
            
            status = "sent" if result.get("success") else "failed"
        else:
            status = "skipped_customer_replied"
        
        # Update follow-up status
        await db.whatsapp_follow_ups.update_one(
            {"id": follow_up["id"]},
            {"$set": {
                "status": status,
                "processed_at": now.isoformat()
            }}
        )

# ==================== AUTOMATION SETTINGS MANAGEMENT ====================

async def get_automation_settings() -> Dict:
    """Get current automation settings"""
    settings = await db.whatsapp_automation_settings.find_one({}, {"_id": 0})
    
    if not settings:
        # Default settings
        settings = {
            "welcome_enabled": True,
            "after_hours_enabled": True,
            "quick_replies_enabled": True,
            "auto_tagging_enabled": True,
            "follow_up_enabled": False,  # Disabled by default due to 24h window
            "follow_up_delay_hours": 24,
            "business_hours": BUSINESS_INFO["business_hours"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.whatsapp_automation_settings.insert_one(settings)
    
    return settings

async def update_automation_settings(updates: Dict) -> Dict:
    """Update automation settings"""
    await db.whatsapp_automation_settings.update_one(
        {},
        {"$set": {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return await get_automation_settings()
