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
from db_client import AsyncIOMotorClient
import os
import uuid
import re

logger = logging.getLogger(__name__)

# MongoDB connection - uses EFFECTIVE_DB_NAME from db_client (Atlas-aware)
from db_client import get_db
db = get_db()
client = db.client

# Lazy import AI module (avoids circular import at startup)
_whatsapp_ai = None
def _get_ai_module():
    global _whatsapp_ai
    if _whatsapp_ai is None:
        try:
            from routes import whatsapp_ai as _ai
            _whatsapp_ai = _ai
        except Exception as _e:
            logger.warning(f"[WhatsApp AI] Could not import AI module: {_e}")
    return _whatsapp_ai

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

# Lead scoring thresholds
LEAD_SCORING = {
    "hot_triggers": ["price", "quotation", "site visit", "callback", "install", "when can", "cost", "rate", "kitna"],
    "warm_triggers": ["subsidy", "interested", "solar", "exploring", "information", "details"],
    "cold_indicators": ["just browsing", "not now", "later", "no thanks"]
}

# Capacity suggestion based on monthly electricity bill
CAPACITY_SUGGESTIONS = {
    (0, 1500): {"capacity": "1kW–2kW", "text": "Based on your bill, a 1kW–2kW system may be suitable."},
    (1500, 3000): {"capacity": "2kW–3kW", "text": "Based on your bill, a 2kW–3kW system may be suitable."},
    (3000, 6000): {"capacity": "3kW–5kW", "text": "Based on your bill, a 3kW–5kW system may be suitable."},
    (6000, 100000): {"capacity": "5kW+", "text": "Based on your bill, a 5kW or higher system may be suitable."}
}

# Hindi/Hinglish keywords for language detection
HINDI_KEYWORDS = [
    "kya", "hai", "hain", "mujhe", "chahiye", "kaise", "kitna", "lagega", "solar", "ghar", 
    "dukan", "office", "bill", "bijli", "subsidy", "sarkar", "yojana", "price", "rate",
    "namaste", "namaskar", "dhanyavad", "ji", "haan", "nahi", "theek", "accha", "batao",
    "bataiye", "lagwana", "installation", "kab", "कितना", "क्या", "है", "चाहिए", "सोलर"
]

# ==================== AUTO-REPLY MESSAGES ====================

DEFAULT_WELCOME_MESSAGE = """🙏 Welcome to ASR Enterprises – Solar Rooftop Installation

Thank you for contacting us. ☀️
We help with Home Solar, Shop/Office Solar, Subsidy, Price & Installation.

Please choose one option to continue:

1️⃣ Home Solar
2️⃣ Shop / Office Solar
3️⃣ PM Surya Ghar Subsidy
4️⃣ Price / Quotation
5️⃣ Free Site Visit
6️⃣ Service / Support
7️⃣ Talk to Sales Team

Reply with the number only."""

FACEBOOK_INSTAGRAM_WELCOME = """🙏 Welcome to ASR Enterprises ☀️

Thanks for reaching out through our ad!
We specialize in Rooftop Solar Installation in Bihar.

Quick options:

1️⃣ Home Solar
2️⃣ Shop / Office Solar
3️⃣ Subsidy Info
4️⃣ Price / Quotation
5️⃣ Free Site Visit

Reply with the number or tell us your requirement directly."""

AFTER_HOURS_MESSAGE = """🙏 Welcome to ASR Enterprises ☀️

Thanks for contacting us!
Our team is currently offline but will respond soon.

Meanwhile, please share:
- Your name
- Location
- Monthly electricity bill

Or reply with:
1 for Home Solar
2 for Shop/Office Solar
3 for Subsidy
4 for Price
5 for Site Visit

We'll assist you first thing. 📞 9296389097"""

FOLLOW_UP_MESSAGE = """Hello 👋
Just checking in regarding your rooftop solar inquiry.

If you want, simply reply with:

1 for Home Solar
2 for Shop/Office Solar
3 for Subsidy
4 for Price
5 for Site Visit

We'll assist you quickly. ☀️"""

# ==================== QUICK REPLY RESPONSES (Short, One Question at a Time) ====================

QUICK_REPLIES = {
    "1": {
        "tag": "home_solar",
        "tags": ["whatsapp_lead", "new_inquiry", "home_solar"],
        "stage": "contacted",
        "lead_type": "Home Solar",
        "response": """Great 👍
To guide you better, please tell us your monthly electricity bill.

Examples: ₹1000, ₹2000, ₹3000+""",
        "next_question": "location"
    },
    "2": {
        "tag": "commercial_solar",
        "tags": ["whatsapp_lead", "new_inquiry", "commercial_solar"],
        "stage": "contacted",
        "lead_type": "Shop/Office Solar",
        "response": """Perfect 👍
Please tell us your shop/office monthly electricity bill or approximate load requirement.""",
        "next_question": "location"
    },
    "3": {
        "tag": "subsidy_interest",
        "tags": ["whatsapp_lead", "new_inquiry", "subsidy_interest"],
        "stage": "contacted",
        "lead_type": "Subsidy Inquiry",
        "response": """Sure 👍
We can guide you about PM Surya Ghar Yojana subsidy.

Please tell us:
- Is this for Home or Business?
- And your monthly electricity bill?""",
        "next_question": "property_type"
    },
    "4": {
        "tag": "quotation_requested",
        "tags": ["whatsapp_lead", "new_inquiry", "quotation_requested", "hot_lead"],
        "stage": "quotation",
        "lead_type": "Price/Quotation",
        "response": """Sure 👍
We can help with a solar quotation.

Please share your monthly electricity bill first so we can suggest the right solar capacity.""",
        "next_question": "bill"
    },
    "5": {
        "tag": "site_visit_requested",
        "tags": ["whatsapp_lead", "new_inquiry", "site_visit_requested", "hot_lead"],
        "stage": "site_visit",
        "lead_type": "Site Visit",
        "response": """Great 👍
We can arrange a free site visit.

Please share:
1. Your name
2. Location / area
3. Monthly electricity bill""",
        "next_question": "name"
    },
    "6": {
        "tag": "service_inquiry",
        "tags": ["whatsapp_lead", "service_inquiry"],
        "stage": "contacted",
        "lead_type": "Service/Support",
        "response": """Sure 👍
Please briefly tell us your service/support issue.""",
        "next_question": "issue"
    },
    "7": {
        "tag": "sales_call_requested",
        "tags": ["whatsapp_lead", "new_inquiry", "sales_call_requested", "hot_lead"],
        "stage": "contacted",
        "lead_type": "Sales Callback",
        "response": """Certainly 👍
Please share your:
1. Name
2. Location
3. Monthly electricity bill

Our sales team will assist you shortly.""",
        "next_question": "name"
    },
    "0": {
        "tag": "human_handover",
        "tags": ["whatsapp_lead", "human_required", "priority_escalation"],
        "stage": "contacted",
        "lead_type": "Human Handover",
        "response": """Understood 👍
I'm connecting you with our customer support team.

A representative will message you shortly (usually within 15 minutes during business hours: 10 AM - 6 PM).

Meanwhile, please share:
- Your name
- Your query/concern

Thank you for your patience! 🙏""",
        "next_question": "human_handover"
    }
}

# Alternative keywords for each option (improved with Hindi/Hinglish)
KEYWORD_MAPPINGS = {
    "1": ["home solar", "residential", "ghar", "घर", "home", "1️⃣", "ghar ka", "residential solar"],
    "2": ["shop", "office", "commercial", "business", "dukan", "दुकान", "2️⃣", "shop ka", "office ka", "factory"],
    "3": ["subsidy", "pm surya", "surya ghar", "yojana", "सब्सिडी", "3️⃣", "government", "sarkari", "scheme"],
    "4": ["price", "quotation", "quote", "cost", "rate", "kitna", "कीमत", "4️⃣", "kitna lagega", "price kya hai", "kharcha"],
    "5": ["site visit", "visit", "free visit", "survey", "देखना", "5️⃣", "ghar aao", "dekhne aao", "inspection"],
    "6": ["service", "support", "repair", "problem", "issue", "समस्या", "6️⃣", "complaint", "kharab", "not working"],
    "7": ["call", "talk", "sales", "baat", "बात", "7️⃣", "call karo", "baat karna hai", "contact"],
    "0": ["human", "agent", "person", "real person", "talk to someone", "speak to", "customer service", 
          "executive", "manager", "इंसान", "आदमी", "connect me", "operator", "help desk", 
          "representative", "not bot", "real human", "talk to a person", "0️⃣"]
}

# ==================== SOLAR MITRA INTENT DETECTION ====================

# Keywords for each solar intent (checked AFTER menu option 1-7 detection)
SOLAR_INTENT_KEYWORDS: Dict[str, List[str]] = {
    "price": [
        "price", "cost", "kitna lagega", "kitna hai", "rate", "kitna paisa",
        "kharcha", "budget", "paisa", "amount", "mehanga", "sasta",
        "price kya", "cost kya", "quote", "quotation", "kitna aayega",
    ],
    "subsidy": [
        "subsidy", "yojana", "surya ghar", "pm surya", "government",
        "sarkari", "scheme", "muft", "free mein", "subvention",
        "government se", "sarkar degi", "subsidi", "subside",
    ],
    "loan": [
        "loan", "emi", "finance", "karz", "installment", "kist",
        "monthly payment", "qarz", "bank se", "bhaad", "kiraya",
        "instalment", "no cost emi", "zero interest", "avail loan",
    ],
    "installation": [
        "install", "lagwana", "lagana", "fitting", "setup",
        "kab lagega", "kitne din", "time kitna", "kab hoga",
        "process kya", "kab shuru", "work kitne din", "kitne time",
    ],
}

# Keywords that signal the user is sharing their monthly bill
BILL_CONTEXT_SIGNALS: List[str] = [
    "bill", "bijli", "electricity", "unit", "monthly", "mahine",
    "per month", "har mahine", "month mein", "bijli ka", "current bill",
    "light bill", "₹", "rs ", "rs.", "rupee", "rupees", "inr",
]

# Bihar-specific system sizing + pricing table
SOLAR_SYSTEM_TABLE: List[Dict] = [
    {
        "max_bill": 1500,
        "size": "1kW",
        "price": "₹60,000–₹75,000",
        "subsidy": "₹30,000",
        "roi": "3–4 saal",
    },
    {
        "max_bill": 3000,
        "size": "2kW",
        "price": "₹1.2L–₹1.5L",
        "subsidy": "₹60,000",
        "roi": "3–4 saal",
    },
    {
        "max_bill": 5000,
        "size": "3kW",
        "price": "₹1.8L–₹2.2L",
        "subsidy": "₹78,000",
        "roi": "3–4 saal",
    },
    {
        "max_bill": 8000,
        "size": "5kW",
        "price": "₹3L–₹3.8L",
        "subsidy": "₹78,000",
        "roi": "3–4 saal",
    },
    {
        "max_bill": 999999,
        "size": "10kW+",
        "price": "₹6L+",
        "subsidy": "₹78,000",
        "roi": "3–4 saal",
    },
]


def detect_solar_intent(content: str) -> Optional[str]:
    """
    Detect a specific solar sales intent from free-text Hinglish messages.
    Returns one of: 'price', 'subsidy', 'loan', 'installation', or None.
    """
    c = content.lower()
    for intent, keywords in SOLAR_INTENT_KEYWORDS.items():
        if any(kw in c for kw in keywords):
            return intent
    return None


def estimate_solar_system(bill_amount: int) -> Dict:
    """
    Return size, price range, subsidy and ROI for a given monthly bill (INR).
    """
    for row in SOLAR_SYSTEM_TABLE:
        if bill_amount <= row["max_bill"]:
            return row
    return SOLAR_SYSTEM_TABLE[-1]


def extract_bill_smart(content: str) -> Optional[int]:
    """
    Context-aware bill extractor.
    Only returns a number when there is a clear signal that the user is
    sharing their monthly electricity bill (currency symbol or bill keyword).
    Avoids false positives from kW ratings, option numbers, etc.
    """
    c = content.lower()
    # Must have at least one context signal
    has_context = any(sig in c for sig in BILL_CONTEXT_SIGNALS) or "₹" in content
    if not has_context:
        return None

    # Clean currency markers then search for 3-6 digit numbers
    cleaned = (
        content
        .replace("₹", " ")
        .replace("Rs.", " ")
        .replace("rs.", " ")
        .replace("Rs ", " ")
        .replace("rs ", " ")
        .lower()
        .replace("rupees", " ")
        .replace("rupee", " ")
        .replace("inr", " ")
    )
    for num_str in re.findall(r"\b\d{3,6}\b", cleaned):
        num = int(num_str)
        if 300 <= num <= 100_000:
            return num
    return None


def build_solar_intent_reply(intent: str) -> Optional[str]:
    """
    Return a short Hinglish template reply for a detected solar intent.
    Bill-specific replies are handled inline in process_auto_reply.
    """
    templates = {
        "price": (
            "Solar system approx ₹60k–₹75k per kW hota hai 👍\n"
            "Exact price aapke bill pe depend karega.\n"
            "Aapka monthly bijli bill kitna aata hai?"
        ),
        "subsidy": (
            "PM Surya Ghar Yojana mein ₹78,000 tak subsidy milti hai 👍\n"
            "2kW pe ₹60,000 aur 3kW+ pe ₹78,000 government deti hai.\n"
            "Aapka monthly bill kitna hai? System size calculate karte hain."
        ),
        "loan": (
            "Haan ji, EMI/loan option available hai 👍\n"
            "Solar lagane ke baad bill almost zero ho sakta hai.\n"
            "Aapka monthly bill kitna hai? EMI calculate karte hain."
        ),
        "installation": (
            "Installation 2–3 din mein ho jaati hai 👍\n"
            "MNRE certified team ghar aake survey aur fitting karti hai.\n"
            "Aapka area kahan hai? Free site visit book karein?"
        ),
    }
    return templates.get(intent)


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

def detect_language(content: str) -> str:
    """
    Detect if the message is in Hindi/Hinglish or English.
    Returns: 'hindi' or 'english'
    """
    content_lower = content.lower()
    
    # Check for Hindi characters (Devanagari script)
    if re.search(r'[\u0900-\u097F]', content):
        return 'hindi'
    
    # Check for common Hindi/Hinglish words
    hindi_count = sum(1 for word in HINDI_KEYWORDS if word in content_lower)
    
    # If more than 2 Hindi keywords, treat as Hindi
    if hindi_count >= 2:
        return 'hindi'
    
    return 'english'

def calculate_lead_score(content: str, selected_option: str = None) -> str:
    """
    Calculate lead score based on message content and selected option.
    Returns: 'hot_lead', 'warm_lead', or 'cold_lead'
    """
    content_lower = content.lower()
    
    # Hot lead indicators - high intent
    for trigger in LEAD_SCORING["hot_triggers"]:
        if trigger in content_lower:
            return "hot_lead"
    
    # Options that indicate hot leads
    hot_options = ["4", "5", "7"]  # Price, Site Visit, Sales
    if selected_option in hot_options:
        return "hot_lead"
    
    # Cold lead indicators
    for indicator in LEAD_SCORING["cold_indicators"]:
        if indicator in content_lower:
            return "cold_lead"
    
    # Warm lead - interested but not urgent
    for trigger in LEAD_SCORING["warm_triggers"]:
        if trigger in content_lower:
            return "warm_lead"
    
    # Default to warm if they're engaging
    if selected_option:
        return "warm_lead"
    
    return "warm_lead"

def extract_electricity_bill(content: str) -> Optional[int]:
    """
    Extract electricity bill amount from message content.
    Handles formats like: ₹2000, 2000, Rs 2000, 2000 rupees, etc.
    """
    # Remove common prefixes and clean
    content = content.lower().replace('₹', '').replace('rs', '').replace('rs.', '')
    content = content.replace('rupees', '').replace('rupee', '').replace('inr', '')
    content = content.strip()
    
    # Try to find a number
    numbers = re.findall(r'\d+', content)
    
    if numbers:
        # Get the first reasonable number (bill amount typically 500-50000)
        for num_str in numbers:
            num = int(num_str)
            if 100 <= num <= 100000:
                return num
    
    return None

def suggest_capacity(bill_amount: int) -> Dict:
    """
    Suggest solar capacity based on monthly electricity bill.
    """
    for (min_bill, max_bill), suggestion in CAPACITY_SUGGESTIONS.items():
        if min_bill <= bill_amount < max_bill:
            return suggestion
    
    # Default for very high bills
    return {"capacity": "5kW+", "text": "Based on your bill, a 5kW or higher system may be suitable."}

def generate_lead_summary(lead_data: Dict) -> str:
    """
    Generate a clean lead summary for handoff to sales team.
    """
    summary = """Thank you 🙏
We have noted your requirement.

📌 Your Requirement Summary
"""
    
    if lead_data.get("name"):
        summary += f"- Name: {lead_data['name']}\n"
    if lead_data.get("location"):
        summary += f"- Location: {lead_data['location']}\n"
    if lead_data.get("requirement_type"):
        summary += f"- Type: {lead_data['requirement_type']}\n"
    if lead_data.get("bill"):
        summary += f"- Electricity Bill: ₹{lead_data['bill']}\n"
    if lead_data.get("need"):
        summary += f"- Need: {lead_data['need']}\n"
    if lead_data.get("capacity_suggestion"):
        summary += f"- Suggested Capacity: {lead_data['capacity_suggestion']}\n"
    
    summary += "\nOur team will connect with you shortly for further guidance. ☀️"
    
    return summary

def generate_internal_lead_note(lead_data: Dict, phone: str, lead_score: str) -> str:
    """
    Generate internal CRM note for sales team.
    """
    return f"""NEW SOLAR LEAD
Name: {lead_data.get('name', 'Not provided')}
Phone: {phone}
Location: {lead_data.get('location', 'Not provided')}
Requirement: {lead_data.get('requirement_type', 'Not specified')}
Electricity Bill: {lead_data.get('bill', 'Not provided')}
Need: {lead_data.get('need', 'Not specified')}
Lead Score: {lead_score.upper().replace('_', ' ')}
Source: WhatsApp Inquiry"""

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


async def trigger_human_handover(phone: str, lead_id: str = None):
    """
    Mark lead for human handover and create an alert in CRM.
    This is triggered when customer explicitly requests to talk to a human.
    """
    phone_suffix = phone[-10:] if len(phone) >= 10 else phone
    
    # Update lead with human_required flag and high priority
    result = await db.crm_leads.update_one(
        {
            "$or": [
                {"phone": phone},
                {"phone": phone_suffix},
                {"phone": {"$regex": phone_suffix}}
            ]
        },
        {
            "$set": {
                "human_required": True,
                "ai_priority": "high",
                "human_handover_requested_at": datetime.now(timezone.utc).isoformat(),
                "follow_up_notes": "⚠️ HUMAN HANDOVER REQUESTED - Customer wants to speak with a real person"
            },
            "$addToSet": {"tags": {"$each": ["human_required", "priority_escalation"]}}
        }
    )
    
    # Create a notification/alert for the team
    await db.crm_notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "human_handover",
        "priority": "high",
        "phone": phone,
        "lead_id": lead_id,
        "message": f"🚨 Customer {phone} requested human assistance via WhatsApp",
        "status": "unread",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Human handover triggered for {phone}")
    return result.modified_count > 0

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
    # Use the central settings loader that merges env vars (WHATSAPP_ACCESS_TOKEN,
    # WHATSAPP_PHONE_NUMBER_ID) with any DB overrides — env always wins.
    from routes.whatsapp import get_whatsapp_settings
    settings = await get_whatsapp_settings()
    if not settings or not settings.get("access_token"):
        logger.error("WhatsApp API not configured (check WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID env vars)")
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
    4. Calculate lead score and apply tags
    5. Prevent duplicate messages in same conversation
    
    Args:
        phone: Sender's phone number
        content: Message content
        lead_source: Pre-determined lead source (optional)
        payload: Raw webhook payload for source detection
        lead_id: Associated lead ID
    
    Returns:
        Dict with reply type and message, or None if no auto-reply needed
    """
    # ── Master bot switch (checked first — fast exit if bot is disabled) ──
    _bot_settings: Dict = {}
    try:
        _bot_settings = await get_automation_settings()
        if not _bot_settings.get("bot_enabled", True):
            logger.info(f"[Bot] Master bot disabled — no auto-reply for {phone}")
            return None
    except Exception as _bs_err:
        logger.warning(f"[Bot] Could not read bot_enabled flag: {_bs_err}")

    # Get conversation state
    is_new = await is_new_conversation(phone)
    has_welcome = await has_received_welcome(phone)
    
    # Detect language for potential Hindi response
    language = detect_language(content)
    
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
        
        # Calculate lead score
        lead_score = calculate_lead_score(content, selected_option)
        
        # Get all tags to apply
        tags_to_apply = reply_config.get("tags", [reply_config["tag"]])
        tags_to_apply.append(lead_score)
        
        # Add source-based tag
        source_tag_internal = "organic_lead"
        if source_key in ["facebook", "facebook_ads", "fb"]:
            source_tag_internal = "facebook_ad_lead"
        elif source_key in ["instagram", "instagram_ads", "ig"]:
            source_tag_internal = "instagram_ad_lead"
        elif source_key == "website":
            source_tag_internal = "website_lead"
        tags_to_apply.append(source_tag_internal)
        
        # Apply all tags
        for tag in tags_to_apply:
            await tag_lead(phone, tag)
        
        # Update lead stage
        await update_lead_stage(phone, reply_config["stage"], selected_option, reply_config["tag"])
        
        # Trigger human handover if option "0" selected
        if selected_option == "0":
            await trigger_human_handover(phone, lead_id)
        
        # Update lead source if detected from payload
        if source_key != "whatsapp_direct":
            await update_lead_source(phone, source_key, source_tag)
        
        # Extract bill amount if mentioned
        bill_amount = extract_electricity_bill(content)
        capacity_suggestion = None
        if bill_amount:
            capacity_suggestion = suggest_capacity(bill_amount)
            # Update lead with bill info
            phone_suffix = phone[-10:] if len(phone) >= 10 else phone
            await db.crm_leads.update_one(
                {"$or": [{"phone": phone}, {"phone": phone_suffix}]},
                {"$set": {
                    "monthly_bill": bill_amount,
                    "suggested_capacity": capacity_suggestion["capacity"]
                }}
            )
        
        return {
            "type": "quick_reply",
            "option": selected_option,
            "message": reply_config["response"],
            "tag": reply_config["tag"],
            "tags": tags_to_apply,
            "stage": reply_config["stage"],
            "lead_type": reply_config.get("lead_type"),
            "lead_score": lead_score,
            "language": language,
            "bill_amount": bill_amount,
            "capacity_suggestion": capacity_suggestion
        }
    
    # ==================== SOLAR MITRA INTENT LAYER ====================
    # Runs after menu-option detection (1-7), before the welcome message.
    # Handles free-text Hinglish queries with fast template replies and
    # always extracts + saves the bill amount to the CRM lead.

    _smart_bill = extract_bill_smart(content)

    # Persist bill to CRM whenever detected anywhere in the conversation
    if _smart_bill:
        _phone_sfx = phone[-10:] if len(phone) >= 10 else phone
        _sys_info = estimate_solar_system(_smart_bill)
        await db.crm_leads.update_one(
            {"$or": [{"phone": phone}, {"phone": _phone_sfx}]},
            {"$set": {
                "monthly_bill": _smart_bill,
                "suggested_capacity": _sys_info["size"],
                "last_interaction": datetime.now(timezone.utc).isoformat(),
            }},
        )
        logger.info(f"[SolarMitra] Bill ₹{_smart_bill} captured for {phone}")

    # Use intent templates only AFTER the welcome menu has been sent
    # (so the first-message welcome flow is preserved unchanged)
    if has_welcome:
        # ── Bill amount shared → highest-priority reply ──────────────────
        if _smart_bill:
            _sys = estimate_solar_system(_smart_bill)
            _bill_reply = (
                f"₹{_smart_bill:,} bill pe approx {_sys['size']} system lagega 👍\n"
                f"Govt subsidy ₹{_sys['subsidy']} tak mil sakti hai.\n"
                f"Aapka area kahan hai? Free site visit book karein?"
            )
            await tag_lead(phone, "bill_captured")
            logger.info(f"[SolarMitra] Bill-intent reply for {phone}")
            return {
                "type": "intent_reply",
                "detected_intent": "bill",
                "bill_amount": _smart_bill,
                "system_info": _sys,
                "message": _bill_reply,
                "language": language,
            }

        # ── Named solar intent → template reply ──────────────────────────
        _solar_intent = detect_solar_intent(content)
        if _solar_intent:
            _tmpl = build_solar_intent_reply(_solar_intent)
            if _tmpl:
                await tag_lead(phone, f"intent_{_solar_intent}")
                logger.info(f"[SolarMitra] Intent '{_solar_intent}' reply for {phone}")
                return {
                    "type": "intent_reply",
                    "detected_intent": _solar_intent,
                    "message": _tmpl,
                    "language": language,
                }

    # ==================== WELCOME MESSAGE LOGIC ====================
    # Send welcome only for:
    # 1. New conversations (no messages in 24h)
    # 2. Greeting messages (hi, hello, etc.) even in existing conversation
    # 3. Any short inquiry like "price?", "solar?", "subsidy?" 
    # 4. Only if welcome not already sent in this conversation
    
    should_send_welcome = False
    
    # Short inquiries that should trigger welcome
    short_inquiry_words = ["price", "solar", "subsidy", "cost", "rate", "kitna"]
    is_short_inquiry = any(word in content.lower() for word in short_inquiry_words) and len(content) < 20
    
    if is_new and not has_welcome:
        should_send_welcome = True
        logger.info(f"New conversation detected for {phone}, will send welcome")
    elif is_greeting_message(content) and not has_welcome:
        should_send_welcome = True
        logger.info(f"Greeting message detected for {phone}, will send welcome")
    elif is_short_inquiry and not has_welcome:
        should_send_welcome = True
        logger.info(f"Short inquiry detected for {phone}, will send welcome")
    
    if should_send_welcome:
        # Calculate lead score
        lead_score = calculate_lead_score(content)
        
        # Apply initial tags
        initial_tags = ["whatsapp_lead", "new_inquiry", lead_score]
        for tag in initial_tags:
            await tag_lead(phone, tag)
        
        # Update lead source if detected
        if source_key != "whatsapp_direct":
            await update_lead_source(phone, source_key, source_tag)
        
        # Determine which welcome message to send
        if not is_business_hours():
            # After-hours message
            return {
                "type": "after_hours",
                "message": AFTER_HOURS_MESSAGE,
                "source_tag": source_tag,
                "lead_score": lead_score,
                "language": language
            }
        elif source_key in ["facebook", "facebook_ads", "instagram", "instagram_ads", "fb", "ig"]:
            # Facebook/Instagram specific welcome
            return {
                "type": "fb_ig_welcome",
                "message": FACEBOOK_INSTAGRAM_WELCOME,
                "source_tag": source_tag,
                "lead_score": lead_score,
                "language": language
            }
        else:
            # Default welcome
            return {
                "type": "welcome",
                "message": DEFAULT_WELCOME_MESSAGE,
                "source_tag": source_tag,
                "lead_score": lead_score,
                "language": language
            }
    
    # ==================== AI FALLBACK ====================
    # At this point: welcome was already sent, message doesn't match any menu
    # option. Try the AI engine for a contextual Hinglish reply.

    try:
        # Reuse settings already loaded at function start
        settings = _bot_settings or await get_automation_settings()

        # Spam/noise filter
        if settings.get("spam_filter_enabled", True):
            ai_mod = _get_ai_module()
            if ai_mod and ai_mod.is_noise_message(content):
                logger.info(f"[Bot] Noise message from {phone}, skipping reply")
                return None

        # Human handover pause check
        if settings.get("pause_bot_on_human_handover", True):
            phone_suffix = phone[-10:] if len(phone) >= 10 else phone
            lead_doc = await db.crm_leads.find_one(
                {"$or": [{"phone": phone}, {"phone": phone_suffix}]},
                {"_id": 0, "human_required": 1}
            )
            if lead_doc and lead_doc.get("human_required"):
                logger.info(f"[Bot] Human handover active for {phone}, bot paused")
                return None

        # AI fallback
        if settings.get("ai_fallback_enabled", True):
            ai_mod = _get_ai_module()
            if ai_mod:
                ai_reply = await ai_mod.generate_ai_reply(phone, content, db)
                if ai_reply:
                    logger.info(f"[Bot] AI reply generated for {phone}")
                    return {
                        "type": "ai_reply",
                        "message": ai_reply,
                        "language": language,
                    }
    except Exception as _ai_err:
        logger.warning(f"[Bot] AI fallback error for {phone}: {_ai_err}")

    # No auto-reply needed (and AI fallback returned nothing or is disabled)
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
        bh = BUSINESS_INFO["business_hours"]
        settings = {
            "bot_enabled": True,           # Master on/off switch for the bot
            "welcome_enabled": True,
            "after_hours_enabled": True,
            "quick_replies_enabled": True,
            "auto_tagging_enabled": True,
            "follow_up_enabled": False,    # Disabled by default due to 24h window
            "follow_up_delay_hours": 24,
            "ai_fallback_enabled": True,   # Use AI when keyword matching fails
            "spam_filter_enabled": True,   # Skip noise messages (ok, 👍, etc.)
            "pause_bot_on_human_handover": True,  # Stop bot when human takes over
            "business_hours": {
                "start": str(bh.get("start", "10:00:00")),
                "end": str(bh.get("end", "20:00:00")),
                "days": bh.get("days", [0, 1, 2, 3, 4, 5]),
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.whatsapp_automation_settings.insert_one(settings)
    else:
        # Back-fill new fields into existing settings document (non-destructive)
        missing = {}
        if "bot_enabled" not in settings:
            missing["bot_enabled"] = True
        if "ai_fallback_enabled" not in settings:
            missing["ai_fallback_enabled"] = True
        if "spam_filter_enabled" not in settings:
            missing["spam_filter_enabled"] = True
        if "pause_bot_on_human_handover" not in settings:
            missing["pause_bot_on_human_handover"] = True
        if missing:
            await db.whatsapp_automation_settings.update_one(
                {}, {"$set": missing}, upsert=True
            )
            settings.update(missing)

    return settings

async def update_automation_settings(updates: Dict) -> Dict:
    """Update automation settings"""
    await db.whatsapp_automation_settings.update_one(
        {},
        {"$set": {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return await get_automation_settings()
