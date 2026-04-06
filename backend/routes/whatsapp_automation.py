"""
WhatsApp CRM Automation for ASR Enterprises
Handles auto-replies, lead qualification, quick reply flows, and follow-ups

Features:
- Default welcome auto-reply for new conversations
- Ad-specific auto-reply (Facebook/Instagram/Website leads)
- After-hours auto-reply (outside business hours)
- Quick reply menu (Options 1-7)
- Lead qualification & tagging
- Sales follow-up message scheduling
- Duplicate message prevention
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta, time
from typing import Dict, Any, Optional, List, Tuple
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import re

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
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
    # Monday to Saturday: 10:00 AM - 7:00 PM IST
    # Sunday: Treated as after-hours/holiday
    "business_hours": {
        "start": time(10, 0),  # 10 AM IST
        "end": time(19, 0),    # 7 PM IST (19:00)
        "days": [0, 1, 2, 3, 4, 5]  # Monday=0 to Saturday=5 (Sunday=6 is excluded)
    }
}

# Follow-up configuration
FOLLOW_UP_CONFIG = {
    "first_follow_up_hours": 2,      # Send first follow-up after 2 hours of inactivity
    "second_follow_up_hours": 24,    # Send second follow-up after 24 hours (if allowed by policy)
    "max_follow_ups": 2,             # Maximum number of follow-ups per lead
    "respect_24h_window": True       # Only send free-form within 24h, else use template
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

# Source tag mappings - Maps internal source values to display tags
SOURCE_TAGS = {
    # Facebook sources
    "facebook_ads": "Facebook Lead",
    "facebook": "Facebook Lead",
    "fb": "Facebook Lead",
    "fb_ads": "Facebook Lead",
    "facebook_lead": "Facebook Lead",
    "meta_ads": "Facebook Lead",
    
    # Instagram sources
    "instagram_ads": "Instagram Lead",
    "instagram": "Instagram Lead",
    "ig": "Instagram Lead",
    "ig_ads": "Instagram Lead",
    "instagram_lead": "Instagram Lead",
    
    # Website sources
    "website": "Website Lead",
    "web": "Website Lead",
    "website_form": "Website Lead",
    "landing_page": "Website Lead",
    "google_ads": "Website Lead",
    
    # Direct WhatsApp sources
    "whatsapp_direct": "Direct WhatsApp Lead",
    "whatsapp_reply": "Direct WhatsApp Lead",
    "whatsapp": "Direct WhatsApp Lead",
    "wa_direct": "Direct WhatsApp Lead",
    "organic": "Direct WhatsApp Lead",
    "direct": "Direct WhatsApp Lead"
}

# Keywords to detect source from message content or referral
SOURCE_DETECTION_KEYWORDS = {
    "facebook": ["facebook", "fb", "meta", "facebook.com", "fb.com"],
    "instagram": ["instagram", "ig", "insta", "instagram.com"],
    "website": ["website", "google", "web", "asrenterprises.in", "landing"]
}

# Greetings that should trigger welcome message (case-insensitive)
GREETING_KEYWORDS = [
    "hi", "hello", "hey", "hola", "namaste", "namaskar", 
    "good morning", "good afternoon", "good evening",
    "hii", "hiii", "hiiii", "helloo", "hellooo",
    "start", "begin", "menu"
]

# ==================== HELPER FUNCTIONS ====================

def get_ist_now() -> datetime:
    """Get current time in IST (UTC+5:30)"""
    ist_offset = timedelta(hours=5, minutes=30)
    now_utc = datetime.now(timezone.utc)
    return now_utc + ist_offset

def is_business_hours() -> bool:
    """
    Check if current time is within business hours (IST)
    Business Hours: Monday to Saturday, 10:00 AM - 7:00 PM IST
    Sunday: Treated as after-hours/holiday
    """
    now_ist = get_ist_now()
    current_time = now_ist.time()
    current_day = now_ist.weekday()  # Monday=0, Sunday=6
    
    hours = BUSINESS_INFO["business_hours"]
    
    # Check if it's a working day (Monday=0 to Saturday=5)
    if current_day not in hours["days"]:
        logger.info(f"Outside business hours: Sunday (day={current_day})")
        return False
    
    # Check if within business hours (10 AM to 7 PM)
    within_hours = hours["start"] <= current_time <= hours["end"]
    if not within_hours:
        logger.info(f"Outside business hours: Current time {current_time}, Business hours {hours['start']} - {hours['end']}")
    
    return within_hours

def is_greeting_message(content: str) -> bool:
    """Check if message is a greeting/starting message"""
    content_lower = content.lower().strip()
    
    # Check exact matches first
    if content_lower in GREETING_KEYWORDS:
        return True
    
    # Check if message starts with a greeting
    for greeting in GREETING_KEYWORDS:
        if content_lower.startswith(greeting + " ") or content_lower.startswith(greeting + ","):
            return True
    
    return False

def detect_option_from_message(content: str) -> Optional[str]:
    """
    Detect which option the user selected based on message content.
    Supports numeric input (1-7), emoji numbers, and keyword matching.
    """
    if not content:
        return None
        
    content_lower = content.lower().strip()
    
    # First check for direct number input (1, 2, 3, etc.)
    # Handle formats: "1", "1.", "1 ", "option 1", etc.
    for option in QUICK_REPLIES.keys():
        patterns = [
            f"^{option}$",           # Exact match: "1"
            f"^{option}\\.$",        # With period: "1."
            f"^{option}\\s",         # With trailing space: "1 "
            f"^option\\s*{option}$", # "option 1" or "option1"
            f"^{option}\\)",         # "1)"
            f"^\\({option}\\)$",     # "(1)"
        ]
        for pattern in patterns:
            if re.match(pattern, content_lower):
                return option
    
    # Check for emoji numbers
    emoji_numbers = {
        "1️⃣": "1", "2️⃣": "2", "3️⃣": "3", "4️⃣": "4", 
        "5️⃣": "5", "6️⃣": "6", "7️⃣": "7"
    }
    for emoji, option in emoji_numbers.items():
        if emoji in content:
            return option
    
    # Check for keywords (only if no exact number match)
    for option, keywords in KEYWORD_MAPPINGS.items():
        for keyword in keywords:
            # Use word boundary matching for better accuracy
            if keyword in content_lower:
                return option
    
    return None

def detect_source_from_payload(payload: Dict = None, message_content: str = None) -> Optional[str]:
    """
    Detect lead source from webhook payload metadata or message content.
    Priority order:
    1. Payload/webhook metadata (referral, context, etc.)
    2. Message content analysis
    3. Return None to let caller check database
    """
    # Check payload for referral/source info
    if payload:
        # Check for referral data (from Click-to-WhatsApp ads)
        referral = payload.get("referral", {})
        if referral:
            source_url = referral.get("source_url", "").lower()
            source_type = referral.get("source_type", "").lower()
            
            if "facebook" in source_url or source_type == "facebook":
                return "facebook"
            if "instagram" in source_url or source_type == "instagram":
                return "instagram"
            if referral.get("headline") or referral.get("body"):
                # Has ad content, likely from Meta ads
                return "facebook"
        
        # Check for context (WhatsApp flows, etc.)
        context = payload.get("context", {})
        if context:
            referred_product = context.get("referred_product", {})
            if "facebook" in str(referred_product).lower():
                return "facebook"
            if "instagram" in str(referred_product).lower():
                return "instagram"
    
    # Analyze message content for source hints
    if message_content:
        content_lower = message_content.lower()
        for source, keywords in SOURCE_DETECTION_KEYWORDS.items():
            for keyword in keywords:
                if keyword in content_lower:
                    return source
    
    return None

async def get_lead_source(phone: str, payload: Dict = None, message_content: str = None) -> Tuple[str, str]:
    """
    Get the source of the lead with priority:
    1. Payload/URL/webhook metadata
    2. Existing CRM source field
    3. Fallback to "whatsapp_direct"
    
    Returns: (source_key, display_tag)
    """
    # Priority 1: Check payload metadata
    detected_source = detect_source_from_payload(payload, message_content)
    if detected_source:
        tag = SOURCE_TAGS.get(detected_source, "Direct WhatsApp Lead")
        return detected_source, tag
    
    # Priority 2: Check existing lead in database
    lead = await db.crm_leads.find_one(
        {"$or": [
            {"phone": phone},
            {"phone": phone[-10:] if len(phone) >= 10 else phone}
        ]},
        {"_id": 0, "source": 1}
    )
    
    if lead and lead.get("source"):
        source = lead["source"]
        tag = SOURCE_TAGS.get(source, "Direct WhatsApp Lead")
        return source, tag
    
    # Priority 3: Default fallback
    return "whatsapp_direct", "Direct WhatsApp Lead"

async def is_new_conversation(phone: str, hours: int = 24) -> bool:
    """
    Check if this is a new conversation (no messages in specified hours).
    Default: 24 hours
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    existing_messages = await db.whatsapp_messages.count_documents({
        "phone": {"$regex": phone_suffix},
        "created_at": {"$gte": cutoff.isoformat()}
    })
    
    # New conversation if only 1 or no messages (the current incoming one)
    return existing_messages <= 1

async def has_received_welcome(phone: str, hours: int = 24) -> bool:
    """
    Check if user has already received a welcome/auto-reply message.
    Prevents duplicate greetings in the same conversation window.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    welcome_sent = await db.whatsapp_messages.count_documents({
        "phone": {"$regex": phone_suffix},
        "direction": "outgoing",
        "auto_reply_type": {"$in": ["welcome", "after_hours", "fb_ig_welcome"]},
        "created_at": {"$gte": cutoff.isoformat()}
    })
    
    return welcome_sent > 0

async def has_received_option_reply(phone: str, option: str, hours: int = 24) -> bool:
    """
    Check if user has already received a reply for a specific option.
    Prevents duplicate responses for the same selection.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    option_sent = await db.whatsapp_messages.count_documents({
        "phone": {"$regex": phone_suffix},
        "direction": "outgoing",
        "auto_reply_type": "quick_reply",
        "auto_reply_option": option,
        "created_at": {"$gte": cutoff.isoformat()}
    })
    
    return option_sent > 0

async def tag_lead(phone: str, tag: str, replace_existing: bool = False):
    """
    Add a tag to the lead.
    If replace_existing is True, replaces all existing tags of the same category.
    """
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    update_op = {"$addToSet": {"tags": tag}} if not replace_existing else {"$set": {"tags": [tag]}}
    update_op["$set"] = update_op.get("$set", {})
    update_op["$set"]["tagged_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.crm_leads.update_one(
        {"$or": [
            {"phone": phone},
            {"phone": phone_suffix}
        ]},
        update_op
    )
    
    if result.modified_count > 0:
        logger.info(f"Tagged lead {phone_suffix} with: {tag}")
    
    return result.modified_count > 0

async def update_lead_stage(phone: str, stage: str, option: str, tag: str):
    """Update lead stage and add qualification info based on selected option"""
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    result = await db.crm_leads.update_one(
        {"$or": [
            {"phone": phone},
            {"phone": phone_suffix}
        ]},
        {
            "$set": {
                "stage": stage,
                "qualification_option": option,
                "qualification_tag": tag,
                "qualified_at": datetime.now(timezone.utc).isoformat(),
                "last_interaction": datetime.now(timezone.utc).isoformat()
            },
            "$addToSet": {"tags": tag},
            "$push": {
                "activities": {
                    "id": str(uuid.uuid4()),
                    "type": "auto_qualification",
                    "title": f"Lead Qualified: Option {option}",
                    "description": f"Customer selected option {option}. Stage updated to: {stage}. Tag: {tag}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    if result.modified_count > 0:
        logger.info(f"Updated lead {phone_suffix}: stage={stage}, tag={tag}")
    
    return result.modified_count > 0

async def update_lead_source(phone: str, source: str, source_tag: str):
    """Update or set the lead source if not already set"""
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    # Only update if source is not already set or is generic
    # Use $and to combine phone matching with source conditions
    await db.crm_leads.update_one(
        {
            "$and": [
                {
                    "$or": [
                        {"phone": phone},
                        {"phone": phone_suffix}
                    ]
                },
                {
                    "$or": [
                        {"source": {"$exists": False}},
                        {"source": "whatsapp_direct"},
                        {"source": "whatsapp_reply"},
                        {"source": "direct"},
                        {"source": None}
                    ]
                }
            ]
        },
        {
            "$set": {
                "source": source,
                "source_updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$addToSet": {"tags": source_tag}
        }
    )

async def send_text_message(
    phone: str, 
    text: str, 
    auto_reply_type: str = None,
    auto_reply_option: str = None,
    lead_id: str = None
) -> Dict:
    """
    Send a text message via WhatsApp Cloud API.
    
    Args:
        phone: Recipient phone number
        text: Message text to send
        auto_reply_type: Type of auto-reply (welcome, after_hours, fb_ig_welcome, quick_reply, follow_up)
        auto_reply_option: Option number if quick_reply (1-7)
        lead_id: Associated lead ID
    
    Returns:
        Dict with success status and message details
    """
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
    
    message_id = str(uuid.uuid4())
    
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
                
                # Log outgoing message with full metadata
                await db.whatsapp_messages.insert_one({
                    "id": message_id,
                    "phone": cleaned_phone,
                    "lead_id": lead_id,
                    "direction": "outgoing",
                    "message_type": "text",
                    "content": text,
                    "wa_message_id": wa_message_id,
                    "status": "sent",
                    "auto_reply_type": auto_reply_type,
                    "auto_reply_option": auto_reply_option,
                    "is_bot_message": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                logger.info(f"Auto-reply sent to {cleaned_phone}: type={auto_reply_type}, option={auto_reply_option}")
                
                return {
                    "success": True, 
                    "message_id": message_id,
                    "wa_message_id": wa_message_id
                }
            else:
                error_msg = response_data.get("error", {}).get("message", "Unknown error")
                logger.error(f"WhatsApp send error to {cleaned_phone}: {error_msg}")
                
                # Log failed message
                await db.whatsapp_messages.insert_one({
                    "id": message_id,
                    "phone": cleaned_phone,
                    "lead_id": lead_id,
                    "direction": "outgoing",
                    "message_type": "text",
                    "content": text,
                    "status": "failed",
                    "error": error_msg,
                    "auto_reply_type": auto_reply_type,
                    "auto_reply_option": auto_reply_option,
                    "is_bot_message": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        logger.error(f"WhatsApp API error: {str(e)}")
        return {"success": False, "error": str(e)}

# ==================== MAIN AUTOMATION FUNCTIONS ====================

async def process_auto_reply(
    phone: str, 
    content: str, 
    lead_source: str = None,
    payload: Dict = None,
    lead_id: str = None
) -> Optional[Dict]:
    """
    Main function to process incoming messages and determine auto-reply.
    
    Logic flow:
    1. Check if user selected an option (1-7) → Send quick reply
    2. Check if greeting/new conversation → Send welcome message
    3. Determine which welcome: after-hours, ad-specific, or default
    4. Prevent duplicate messages in same conversation
    
    Args:
        phone: Sender's phone number
        content: Message content
        lead_source: Pre-determined lead source (optional)
        payload: Raw webhook payload for source detection
        lead_id: Associated lead ID
    
    Returns:
        Dict with reply type and message, or None if no auto-reply needed
    """
    # Get conversation state
    is_new = await is_new_conversation(phone)
    has_welcome = await has_received_welcome(phone)
    
    # Detect lead source (priority: payload > DB > default)
    if not lead_source:
        source_key, source_tag = await get_lead_source(phone, payload, content)
    else:
        source_key = lead_source
        source_tag = SOURCE_TAGS.get(lead_source, "Direct WhatsApp Lead")
    
    # ==================== OPTION DETECTION (1-7) ====================
    selected_option = detect_option_from_message(content)
    
    if selected_option and selected_option in QUICK_REPLIES:
        # Check if we already replied to this option
        if await has_received_option_reply(phone, selected_option):
            logger.info(f"Skipping duplicate option reply for {phone}, option {selected_option}")
            return None
        
        reply_config = QUICK_REPLIES[selected_option]
        
        # Tag the lead with qualification tag
        await tag_lead(phone, reply_config["tag"])
        
        # Update lead stage
        await update_lead_stage(phone, reply_config["stage"], selected_option, reply_config["tag"])
        
        # Also add source tag
        await tag_lead(phone, source_tag)
        
        # Update lead source if detected from payload
        if source_key != "whatsapp_direct":
            await update_lead_source(phone, source_key, source_tag)
        
        return {
            "type": "quick_reply",
            "option": selected_option,
            "message": reply_config["response"],
            "tag": reply_config["tag"],
            "stage": reply_config["stage"]
        }
    
    # ==================== WELCOME MESSAGE LOGIC ====================
    # Send welcome only for:
    # 1. New conversations (no messages in 24h)
    # 2. Greeting messages (hi, hello, etc.) even in existing conversation
    # 3. Only if welcome not already sent in this conversation
    
    should_send_welcome = False
    
    if is_new and not has_welcome:
        should_send_welcome = True
        logger.info(f"New conversation detected for {phone}, will send welcome")
    elif is_greeting_message(content) and not has_welcome:
        should_send_welcome = True
        logger.info(f"Greeting message detected for {phone}, will send welcome")
    
    if should_send_welcome:
        # Update lead source if detected
        if source_key != "whatsapp_direct":
            await update_lead_source(phone, source_key, source_tag)
        
        # Determine which welcome message to send
        if not is_business_hours():
            # After-hours message
            return {
                "type": "after_hours",
                "message": AFTER_HOURS_MESSAGE,
                "source_tag": source_tag
            }
        elif source_key in ["facebook", "facebook_ads", "instagram", "instagram_ads", "fb", "ig"]:
            # Facebook/Instagram specific welcome
            return {
                "type": "fb_ig_welcome",
                "message": FACEBOOK_INSTAGRAM_WELCOME,
                "source_tag": source_tag
            }
        else:
            # Default welcome
            return {
                "type": "welcome",
                "message": DEFAULT_WELCOME_MESSAGE,
                "source_tag": source_tag
            }
    
    # No auto-reply needed
    logger.info(f"No auto-reply needed for {phone}: is_new={is_new}, has_welcome={has_welcome}")
    return None

async def handle_incoming_message_automation(
    phone: str, 
    content: str, 
    lead_source: str = None,
    payload: Dict = None,
    lead_id: str = None
) -> Dict:
    """
    Handle incoming message and send appropriate auto-reply.
    This is the main entry point called from the webhook handler.
    
    Args:
        phone: Sender's phone number
        content: Message content
        lead_source: Pre-determined lead source (optional)
        payload: Raw webhook payload for metadata extraction
        lead_id: Associated lead ID (if known)
    
    Returns:
        Dict with auto_reply_sent status and details
    """
    try:
        result = await process_auto_reply(
            phone=phone, 
            content=content, 
            lead_source=lead_source,
            payload=payload,
            lead_id=lead_id
        )
        
        if result:
            # Send the auto-reply
            send_result = await send_text_message(
                phone=phone,
                text=result["message"],
                auto_reply_type=result["type"],
                auto_reply_option=result.get("option"),
                lead_id=lead_id
            )
            
            return {
                "auto_reply_sent": True,
                "reply_type": result["type"],
                "option": result.get("option"),
                "tag": result.get("tag"),
                "stage": result.get("stage"),
                "send_result": send_result
            }
        
        return {"auto_reply_sent": False, "reason": "No auto-reply needed"}
        
    except Exception as e:
        logger.error(f"Error in automation handler: {str(e)}")
        return {"auto_reply_sent": False, "error": str(e)}

async def schedule_follow_up(phone: str, lead_id: str, follow_up_number: int = 1):
    """
    Schedule a follow-up message for a lead.
    
    Follow-up timing:
    - First follow-up: After 2 hours of inactivity
    - Second follow-up: After 24 hours (if allowed by WhatsApp policy)
    - Maximum 2 follow-ups per lead
    
    Args:
        phone: Lead phone number
        lead_id: Associated lead ID
        follow_up_number: 1 for first follow-up, 2 for second
    """
    if follow_up_number > FOLLOW_UP_CONFIG["max_follow_ups"]:
        logger.info(f"Max follow-ups reached for {phone}")
        return
    
    delay_hours = (
        FOLLOW_UP_CONFIG["first_follow_up_hours"] if follow_up_number == 1 
        else FOLLOW_UP_CONFIG["second_follow_up_hours"]
    )
    
    follow_up_time = datetime.now(timezone.utc) + timedelta(hours=delay_hours)
    
    # Check if follow-up already scheduled
    existing = await db.whatsapp_follow_ups.find_one({
        "phone": {"$regex": phone[-10:]},
        "follow_up_number": follow_up_number,
        "status": "pending"
    })
    
    if existing:
        logger.info(f"Follow-up {follow_up_number} already scheduled for {phone}")
        return
    
    await db.whatsapp_follow_ups.insert_one({
        "id": str(uuid.uuid4()),
        "phone": phone,
        "lead_id": lead_id,
        "follow_up_number": follow_up_number,
        "scheduled_at": follow_up_time.isoformat(),
        "delay_hours": delay_hours,
        "status": "pending",
        "message": FOLLOW_UP_MESSAGE,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Scheduled follow-up {follow_up_number} for {phone} at {follow_up_time.isoformat()}")

async def process_pending_follow_ups():
    """
    Process all pending follow-ups that are due.
    Respects WhatsApp 24-hour policy - uses template if outside window.
    
    This function should be called by a background scheduler/cron job.
    """
    now = datetime.now(timezone.utc)
    
    pending = await db.whatsapp_follow_ups.find({
        "status": "pending",
        "scheduled_at": {"$lte": now.isoformat()}
    }).to_list(100)
    
    for follow_up in pending:
        phone = follow_up["phone"]
        phone_suffix = phone[-10:] if len(phone) >= 10 else phone
        
        # Check if customer has replied since follow-up was scheduled
        cutoff = datetime.fromisoformat(follow_up["created_at"])
        recent_reply = await db.whatsapp_messages.count_documents({
            "phone": {"$regex": phone_suffix},
            "direction": "incoming",
            "created_at": {"$gte": cutoff.isoformat()}
        })
        
        if recent_reply > 0:
            # Customer replied, skip this follow-up
            await db.whatsapp_follow_ups.update_one(
                {"id": follow_up["id"]},
                {"$set": {
                    "status": "skipped_customer_replied",
                    "processed_at": now.isoformat()
                }}
            )
            logger.info(f"Skipped follow-up for {phone}: customer replied")
            continue
        
        # Check 24-hour window
        last_incoming = await db.whatsapp_messages.find_one(
            {"phone": {"$regex": phone_suffix}, "direction": "incoming"},
            sort=[("created_at", -1)]
        )
        
        within_24h = False
        if last_incoming:
            try:
                last_incoming_at = datetime.fromisoformat(
                    last_incoming["created_at"].replace("Z", "+00:00")
                )
                within_24h = (now - last_incoming_at) < timedelta(hours=24)
            except (ValueError, TypeError):
                pass
        
        if within_24h:
            # Can send free-form message
            result = await send_text_message(
                phone=phone,
                text=follow_up["message"],
                auto_reply_type="follow_up",
                lead_id=follow_up.get("lead_id")
            )
            status = "sent" if result.get("success") else "failed"
        else:
            # Outside 24h window - should use template
            # For now, mark as skipped (template sending requires different logic)
            status = "skipped_outside_24h_window"
            logger.info(f"Follow-up for {phone} outside 24h window - needs template")
        
        # Update follow-up status
        await db.whatsapp_follow_ups.update_one(
            {"id": follow_up["id"]},
            {"$set": {
                "status": status,
                "processed_at": now.isoformat()
            }}
        )
        
        # Schedule second follow-up if this was the first
        if status == "sent" and follow_up.get("follow_up_number", 1) == 1:
            await schedule_follow_up(
                phone=phone,
                lead_id=follow_up.get("lead_id"),
                follow_up_number=2
            )

async def cancel_follow_ups_for_lead(phone: str):
    """
    Cancel all pending follow-ups for a lead (e.g., when they respond).
    """
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    result = await db.whatsapp_follow_ups.update_many(
        {
            "phone": {"$regex": phone_suffix},
            "status": "pending"
        },
        {"$set": {
            "status": "cancelled_customer_responded",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count > 0:
        logger.info(f"Cancelled {result.modified_count} follow-ups for {phone}")

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
