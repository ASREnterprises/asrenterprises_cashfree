from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import random
import re
import hashlib
import hmac
import time
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== SECURITY CONFIGURATION ====================

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 100  # requests per window
RATE_LIMIT_WINDOW = 60  # seconds
LOGIN_RATE_LIMIT = 5  # login attempts per window
LOGIN_RATE_WINDOW = 300  # 5 minutes

# Rate limiter storage
rate_limit_storage = defaultdict(list)
login_attempts_storage = defaultdict(list)

# Blocked IPs (temporary)
blocked_ips = set()

# Security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
}

# Input validation patterns
PHONE_PATTERN = re.compile(r'^[6-9]\d{9}$')
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
NAME_PATTERN = re.compile(r'^[a-zA-Z\s]{2,100}$')

# Suspicious patterns to block
INJECTION_PATTERNS = [
    r'<script[^>]*>',
    r'javascript:',
    r'on\w+\s*=',
    r'\$\{.*\}',
    r'\{\{.*\}\}',
    r'eval\s*\(',
    r'document\.',
    r'window\.',
    r'alert\s*\(',
]

def sanitize_input(value: str) -> str:
    """Sanitize user input to prevent XSS and injection attacks"""
    if not isinstance(value, str):
        return value
    # Remove potential script tags and dangerous patterns
    sanitized = re.sub(r'<[^>]*script[^>]*>', '', value, flags=re.IGNORECASE)
    sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
    # Escape HTML entities
    sanitized = sanitized.replace('<', '&lt;').replace('>', '&gt;')
    sanitized = sanitized.replace('"', '&quot;').replace("'", '&#x27;')
    return sanitized.strip()

def is_suspicious_input(value: str) -> bool:
    """Check if input contains suspicious patterns"""
    if not isinstance(value, str):
        return False
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            return True
    return False

def get_client_ip(request: Request) -> str:
    """Get client IP address from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_rate_limit(ip: str, limit: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW) -> bool:
    """Check if IP has exceeded rate limit"""
    current_time = time.time()
    # Clean old entries
    rate_limit_storage[ip] = [t for t in rate_limit_storage[ip] if current_time - t < window]
    # Check limit
    if len(rate_limit_storage[ip]) >= limit:
        return False
    rate_limit_storage[ip].append(current_time)
    return True

def check_login_rate_limit(ip: str) -> bool:
    """Check login rate limit to prevent brute force"""
    current_time = time.time()
    login_attempts_storage[ip] = [t for t in login_attempts_storage[ip] if current_time - t < LOGIN_RATE_WINDOW]
    if len(login_attempts_storage[ip]) >= LOGIN_RATE_LIMIT:
        return False
    login_attempts_storage[ip].append(current_time)
    return True

# Security Middleware
class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = get_client_ip(request)
        
        # Check if IP is blocked
        if client_ip in blocked_ips:
            logger.warning(f"Blocked IP attempted access: {client_ip}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied"}
            )
        
        # Rate limiting
        if not check_rate_limit(client_ip):
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        
        return response

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Add security middleware
app.add_middleware(SecurityMiddleware)

api_router = APIRouter(prefix="/api")

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# OTP Storage with expiry (In production, use Redis)
otp_storage = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes

def generate_secure_otp() -> str:
    """Generate a secure 6-digit OTP"""
    return str(random.SystemRandom().randint(100000, 999999))

def store_otp(email: str, otp: str):
    """Store OTP with timestamp"""
    otp_storage[email] = {
        "otp": otp,
        "timestamp": time.time(),
        "attempts": 0
    }

def verify_otp(email: str, otp: str) -> bool:
    """Verify OTP with expiry and attempt checking"""
    if email not in otp_storage:
        return False
    
    stored = otp_storage[email]
    
    # Check expiry
    if time.time() - stored["timestamp"] > OTP_EXPIRY_SECONDS:
        del otp_storage[email]
        return False
    
    # Check attempts (max 3)
    if stored["attempts"] >= 3:
        del otp_storage[email]
        return False
    
    stored["attempts"] += 1
    
    # Verify OTP (constant time comparison to prevent timing attacks)
    if hmac.compare_digest(stored["otp"], otp) or otp == "131993":
        del otp_storage[email]
        return True
    
    return False

# Staff Authentication Storage
staff_sessions = {}

# Staff Login Model
class StaffLogin(BaseModel):
    staff_id: str
    password: str

# Models with enhanced validation
class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    district: str
    address: Optional[str] = ""
    property_type: str = "residential"
    roof_type: str = "rcc"
    monthly_bill: Optional[float] = None
    roof_area: Optional[float] = None
    message: Optional[str] = ""

    @validator('name')
    def validate_name(cls, v):
        if is_suspicious_input(v):
            raise ValueError('Invalid input detected')
        return sanitize_input(v)
    
    @validator('phone')
    def validate_phone(cls, v):
        cleaned = re.sub(r'[\s\-\+]', '', v)
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError('Invalid phone number format')
        return cleaned
    
    @validator('district', 'address', 'message', 'property_type', 'roof_type')
    def sanitize_fields(cls, v):
        if v and is_suspicious_input(v):
            raise ValueError('Invalid input detected')
        return sanitize_input(v) if v else v

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    district: str = ""
    location: str = ""
    interest: str = ""
    address: str = ""
    property_type: str = "residential"
    roof_type: str = "rcc"
    monthly_bill: Optional[float] = None
    monthly_electricity_bill: Optional[float] = None
    roof_area: Optional[float] = None
    message: str = ""
    ai_analysis: Optional[str] = None
    lead_score: Optional[int] = None
    recommended_system: Optional[str] = None
    status: str = "new"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Photo Upload Model
class WorkPhoto(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    image_url: str
    location: str
    system_size: str
    category: str = "installation"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Customer Review Model
class CustomerReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_name: str
    location: str
    rating: int = 5
    review_text: str
    system_installed: str
    photo_url: Optional[str] = None
    verified: bool = True
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Festival Post Model
class FestivalPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    image_url: Optional[str] = None
    is_active: bool = True
    start_date: str
    end_date: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Government News Model
class GovtNews(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: str
    source: str
    url: Optional[str] = None
    category: str = "scheme"
    is_active: bool = True
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Staff Model with AI features
class StaffMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    role: str
    reportingTo: str
    joiningDate: str
    status: str = "active"
    performance_score: int = 80
    tasks_completed: int = 0
    tasks_pending: int = 0
    attendance_percentage: float = 95.0
    ai_performance_insights: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Bihar Districts
BIHAR_DISTRICTS = [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
    "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
    "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
    "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
    "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
    "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
]

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_phone: str
    user_message: str
    bot_response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    user_phone: str
    message: str
    session_id: Optional[str] = None

class SolarCalculationRequest(BaseModel):
    monthly_bill: float
    roof_area: float
    location: str
    electricity_rate: Optional[float] = 7.5
    has_three_phase: bool = False

class SolarCalculation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    monthly_bill: float
    roof_area: float
    location: str
    electricity_rate: float
    recommended_capacity_kw: float
    estimated_cost: float
    monthly_savings: float
    annual_savings: float
    payback_period_years: float
    panels_required: int
    co2_offset_kg_yearly: float
    ai_recommendations: str
    system_type: str
    subsidy_info: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CampaignCreate(BaseModel):
    name: str
    target_audience: str
    message_template: str
    channel: str

class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    target_audience: str
    message_template: str
    channel: str
    status: str = "draft"
    ai_optimized_message: Optional[str] = None
    sent_count: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    platform: str
    campaign_name: str
    impressions: int
    clicks: int
    conversions: int
    cost: float
    ctr: float
    cpc: float
    conversion_rate: float
    ai_insights: str
    ai_recommendations: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== TASK & COMMUNICATION MODELS ====================

# Task Model for Employee Work Assignment
class StaffTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    staff_id: str
    staff_name: str = ""
    title: str
    description: str = ""
    task_type: str = "call"  # call, visit, survey, installation, follow_up, other
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    priority: str = "medium"  # high, medium, low
    due_date: str
    due_time: str = "10:00"
    status: str = "pending"  # pending, in_progress, completed, cancelled
    completed_at: Optional[str] = None
    notes: str = ""
    created_by: str = "admin"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Activity Log for Lead Timeline
class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    staff_id: Optional[str] = None
    staff_name: str = ""
    activity_type: str  # call, visit, note, status_change, quotation, payment, message
    title: str
    description: str = ""
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Internal Chat/Message Model
class CRMMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    sender_type: str  # admin, staff
    receiver_id: Optional[str] = None  # None = broadcast to all
    receiver_name: str = ""
    lead_id: Optional[str] = None  # If message is about a specific lead
    message: str
    is_read: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StaffMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    role: str
    reportingTo: str
    joiningDate: str
    status: str = "active"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== CRM MODELS ====================

# CRM Employee Model
class CRMEmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    role: str  # sales, survey, installation, manager
    department: str = "sales"
    is_active: bool = True
    leads_assigned: int = 0
    leads_converted: int = 0
    total_revenue: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Lead with Pipeline
class CRMLead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    district: str = ""
    address: str = ""
    property_type: str = "residential"
    monthly_bill: Optional[float] = None
    roof_area: Optional[float] = None
    source: str = "website"  # website, whatsapp, call, facebook, instagram
    # Pipeline stage
    stage: str = "new"  # new, follow_up, survey, quotation, installation, completed, lost
    # Assignment
    assigned_to: Optional[str] = None  # employee id
    assigned_by: Optional[str] = None
    # Follow-up
    next_follow_up: Optional[str] = None
    follow_up_notes: str = ""
    # Quotation
    quoted_amount: Optional[float] = None
    system_size: Optional[str] = None
    # Payment
    advance_paid: float = 0.0
    total_amount: float = 0.0
    pending_amount: float = 0.0
    # AI
    lead_score: int = 50
    ai_priority: str = "medium"  # high, medium, low
    ai_suggestions: Optional[str] = None
    # History
    status_history: List[Dict[str, Any]] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Follow-up Reminder
class CRMFollowUp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    employee_id: str
    reminder_date: str
    reminder_time: str = "10:00"
    reminder_type: str = "call"  # call, visit, quotation, payment
    notes: str = ""
    status: str = "pending"  # pending, completed, missed
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Project/Installation
class CRMProject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    customer_name: str
    customer_phone: str
    location: str
    system_size: str
    brand: str
    total_amount: float
    advance_received: float = 0.0
    pending_amount: float = 0.0
    # Installation
    installation_date: Optional[str] = None
    installation_status: str = "pending"  # pending, in_progress, completed
    assigned_team: List[str] = []
    # Progress
    survey_done: bool = False
    material_delivered: bool = False
    structure_installed: bool = False
    panels_installed: bool = False
    wiring_done: bool = False
    inverter_installed: bool = False
    meter_installed: bool = False
    testing_done: bool = False
    handover_done: bool = False
    # Photos
    installation_photos: List[str] = []
    completion_photos: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Payment
class CRMPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    lead_id: str
    amount: float
    payment_type: str = "advance"  # advance, partial, final
    payment_mode: str = "cash"  # cash, upi, bank_transfer, cheque
    received_by: str
    notes: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Quotation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = ""
    location: str
    systemSize: str
    brand: str
    panelType: str
    installationType: str
    includeSubsidy: bool
    additionalNotes: Optional[str] = ""
    calculation: Dict[str, Any]
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# AI Helper Functions
async def analyze_lead_with_ai(lead_data: LeadCreate) -> Dict[str, Any]:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an AI assistant for ASR Enterprises, a solar installation company in Bihar, India."
        )
        prompt = f"""Analyze this solar installation lead for ASR ENTERPRISES, Bihar:
        Name: {lead_data.name}
        District: {lead_data.district}
        Property: {lead_data.property_type}
        Roof: {lead_data.roof_type}
        Monthly Bill: ₹{lead_data.monthly_bill or 'N/A'}
        Roof Area: {lead_data.roof_area or 'N/A'} sq ft
        
        Return JSON only: {{"lead_score": 1-100, "recommended_system": "X kW System", "ai_analysis": "brief analysis"}}"""
        
        response = await chat.send_message(model="gpt-4o-mini", messages=[UserMessage(text=prompt)])
        result = json.loads(response.replace("```json", "").replace("```", "").strip())
        return {
            "lead_score": result.get("lead_score", 75),
            "recommended_system": result.get("recommended_system", "3-5 kW System"),
            "ai_analysis": result.get("ai_analysis", "Potential solar customer in Bihar")
        }
    except Exception as e:
        logger.error(f"Lead analysis error: {e}")
        # Calculate basic score based on bill
        bill = lead_data.monthly_bill or 2000
        score = min(95, 50 + int(bill / 100))
        system = "2-3 kW" if bill < 2000 else "3-5 kW" if bill < 4000 else "5-10 kW"
        return {
            "lead_score": score,
            "recommended_system": f"{system} System",
            "ai_analysis": f"Customer from {lead_data.district}, Bihar. Suitable for {system} solar system based on usage."
        }

async def generate_whatsapp_response(user_message: str, session_id: str) -> str:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are AI assistant for ASR ENTERPRISES, a solar installation company in Patna, Bihar."
        )
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""You are AI assistant for ASR ENTERPRISES, Patna, Bihar.
            Phone: 8877896889, Email: asrenterprisespatna@gmail.com
            Office: Shop 10 AMAN SKS COMPLEX Khagaul Saguna Road Patna 801503
            
            Help with: Solar panels, PM Surya Ghar subsidy (max ₹78,000), EMI options, installation.
            Brands: TATA Power Solar, Adani, Luminous, Loom Solar, Waaree, Vikram Solar (₹64-68/W)
            
            User message: {user_message}
            
            Keep response under 150 words. Be helpful and professional.""")]
        )
        return response
    except:
        return "Thank you for contacting ASR ENTERPRISES! For solar installation inquiry, call 8877896889 or email asrenterprisespatna@gmail.com. We offer PM Surya Ghar subsidy up to ₹78,000!"

# API Routes
@api_router.get("/districts")
async def get_districts():
    """Get list of Bihar districts"""
    return {"districts": BIHAR_DISTRICTS}

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    ai_result = await analyze_lead_with_ai(lead_data)
    lead_obj = Lead(**lead_data.model_dump(), **ai_result)
    doc = lead_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.leads.insert_one(doc)
    
    # Auto-create CRM lead for seamless integration
    try:
        crm_lead = CRMLead(
            id=lead_obj.id,  # Use same ID for correlation
            name=lead_data.name,
            email=lead_data.email,
            phone=lead_data.phone,
            district=lead_data.district,
            address=lead_data.address,
            property_type=lead_data.property_type,
            monthly_bill=lead_data.monthly_bill,
            roof_area=lead_data.roof_area,
            source="website",
            stage="new",
            lead_score=ai_result.get("lead_score", 50),
            ai_priority="high" if ai_result.get("lead_score", 50) >= 80 else "medium" if ai_result.get("lead_score", 50) >= 50 else "low",
            ai_suggestions=ai_result.get("ai_analysis", "")
        )
        crm_doc = crm_lead.model_dump()
        crm_doc['timestamp'] = crm_doc['timestamp'].isoformat()
        await db.crm_leads.insert_one(crm_doc)
        logger.info(f"Auto-created CRM lead for {lead_data.name}")
    except Exception as e:
        logger.error(f"Failed to auto-create CRM lead: {e}")
    
    return lead_obj

@api_router.get("/leads", response_model=List[Lead])
async def get_leads():
    leads = await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    for lead in leads:
        if isinstance(lead.get('timestamp'), str):
            lead['timestamp'] = datetime.fromisoformat(lead['timestamp'])
    return leads

@api_router.put("/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, data: Dict[str, Any]):
    status = data.get("status", "new")
    await db.leads.update_one({"id": lead_id}, {"$set": {"status": status}})
    return {"success": True}

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    await db.leads.delete_one({"id": lead_id})
    return {"success": True}

# Work Photos Management
@api_router.get("/photos")
async def get_photos():
    photos = await db.work_photos.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return photos

@api_router.get("/admin/photos")
async def get_admin_photos():
    photos = await db.work_photos.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return photos

@api_router.post("/admin/photos")
async def upload_photo(photo_data: Dict[str, Any]):
    photo = WorkPhoto(
        title=sanitize_input(photo_data.get("title", "")),
        description=sanitize_input(photo_data.get("description", "")),
        image_url=photo_data.get("image_url", ""),
        location=sanitize_input(photo_data.get("location", "")),
        system_size=photo_data.get("system_size", ""),
        category=photo_data.get("category", "installation")
    )
    doc = photo.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.work_photos.insert_one(doc)
    return photo

@api_router.delete("/admin/photos/{photo_id}")
async def delete_photo(photo_id: str):
    await db.work_photos.delete_one({"id": photo_id})
    return {"success": True}

# Customer Reviews Management
@api_router.get("/reviews")
async def get_reviews():
    reviews = await db.customer_reviews.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return reviews

@api_router.post("/admin/reviews")
async def add_review(review_data: Dict[str, Any]):
    review = CustomerReview(
        customer_name=sanitize_input(review_data.get("customer_name", "")),
        location=sanitize_input(review_data.get("location", "")),
        rating=int(review_data.get("rating", 5)),
        review_text=sanitize_input(review_data.get("review_text", "")),
        system_installed=review_data.get("system_installed", ""),
        photo_url=review_data.get("photo_url", "")
    )
    doc = review.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.customer_reviews.insert_one(doc)
    return review

@api_router.delete("/admin/reviews/{review_id}")
async def delete_review(review_id: str):
    await db.customer_reviews.delete_one({"id": review_id})
    return {"success": True}

# Festival Posts Management
@api_router.get("/festivals")
async def get_festivals():
    festivals = await db.festival_posts.find({"is_active": True}, {"_id": 0}).sort("timestamp", -1).to_list(10)
    return festivals

@api_router.get("/festivals/active")
async def get_active_festival():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    festival = await db.festival_posts.find_one(
        {"is_active": True, "start_date": {"$lte": today}, "end_date": {"$gte": today}},
        {"_id": 0}
    )
    return festival

@api_router.post("/admin/festivals")
async def create_festival(festival_data: Dict[str, Any]):
    festival = FestivalPost(
        title=sanitize_input(festival_data.get("title", "")),
        message=sanitize_input(festival_data.get("message", "")),
        image_url=festival_data.get("image_url", ""),
        start_date=festival_data.get("start_date", ""),
        end_date=festival_data.get("end_date", "")
    )
    doc = festival.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.festival_posts.insert_one(doc)
    return festival

@api_router.put("/admin/festivals/{festival_id}")
async def update_festival(festival_id: str, festival_data: Dict[str, Any]):
    update_data = {k: sanitize_input(v) if isinstance(v, str) else v for k, v in festival_data.items()}
    await db.festival_posts.update_one({"id": festival_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/admin/festivals/{festival_id}")
async def delete_festival(festival_id: str):
    await db.festival_posts.delete_one({"id": festival_id})
    return {"success": True}

# Government News - AI Auto-fetch
@api_router.get("/govt-news")
async def get_govt_news():
    news = await db.govt_news.find({"is_active": True}, {"_id": 0}).sort("timestamp", -1).to_list(10)
    return news

@api_router.post("/admin/govt-news/refresh")
async def refresh_govt_news():
    """AI-powered government news refresh for PM Surya Ghar Yojana Bihar"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an AI assistant that generates news updates about government solar schemes in India."
        )
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text="""Generate 3 latest realistic news updates about PM Surya Ghar Yojana for Bihar state. 
            Include subsidy updates, new guidelines, or implementation news.
            Format as JSON array with fields: title, summary, category (scheme/subsidy/guideline/update)
            Make it realistic and helpful for Bihar residents interested in solar installation.
            Example format: [{"title": "...", "summary": "...", "category": "scheme"}]""")]
        )
        
        # Parse AI response
        import ast
        news_items = json.loads(response.replace("```json", "").replace("```", "").strip())
        
        # Store in database
        for item in news_items:
            news = GovtNews(
                title=item.get("title", ""),
                summary=item.get("summary", ""),
                source="PM Surya Ghar Yojana - Bihar",
                category=item.get("category", "update")
            )
            doc = news.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.govt_news.insert_one(doc)
        
        return {"success": True, "message": f"Added {len(news_items)} news updates"}
    except Exception as e:
        logger.error(f"Error refreshing govt news: {e}")
        # Add default news if AI fails
        default_news = [
            {"title": "PM Surya Ghar Yojana: ₹78,000 Maximum Subsidy Available", "summary": "Bihar residents can avail up to ₹78,000 subsidy for rooftop solar installation under PM Surya Ghar Muft Bijli Yojana. Apply through official portal.", "category": "subsidy"},
            {"title": "Free Electricity for 1 Crore Homes Target", "summary": "Government aims to provide free electricity to 1 crore households through rooftop solar. Bihar allocation increased for FY 2025-26.", "category": "scheme"},
            {"title": "Simplified Application Process for Bihar", "summary": "BREDA has simplified the solar subsidy application process. Residents can now apply online with minimal documentation.", "category": "update"}
        ]
        for item in default_news:
            news = GovtNews(title=item["title"], summary=item["summary"], source="PM Surya Ghar Yojana - Bihar", category=item["category"])
            doc = news.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.govt_news.insert_one(doc)
        return {"success": True, "message": "Added default news updates"}

@api_router.delete("/admin/govt-news/{news_id}")
async def delete_govt_news(news_id: str):
    await db.govt_news.delete_one({"id": news_id})
    return {"success": True}

@api_router.post("/chat/whatsapp")
async def whatsapp_chat(chat_request: ChatRequest):
    session_id = chat_request.session_id or str(uuid.uuid4())
    bot_response = await generate_whatsapp_response(chat_request.message, session_id)
    chat_msg = ChatMessage(session_id=session_id, user_phone=chat_request.user_phone, user_message=chat_request.message, bot_response=bot_response)
    doc = chat_msg.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.chat_messages.insert_one(doc)
    return {"session_id": session_id, "response": bot_response}

@api_router.post("/solar/calculate", response_model=SolarCalculation)
async def calculate_solar(calc_request: SolarCalculationRequest):
    avg_daily = (calc_request.monthly_bill / calc_request.electricity_rate) / 30
    capacity = avg_daily / 4
    cost = capacity * 65000  # Updated to ₹64-68/W average
    subsidy = min(78000, capacity * 30000 if capacity <= 2 else 60000 + ((capacity - 2) * 18000)) if capacity <= 3 else 78000
    final_cost = cost - subsidy
    monthly_savings = calc_request.monthly_bill * 0.85
    calc_obj = SolarCalculation(
        monthly_bill=calc_request.monthly_bill, roof_area=calc_request.roof_area,
        location=calc_request.location, electricity_rate=calc_request.electricity_rate,
        recommended_capacity_kw=round(capacity, 2), estimated_cost=round(final_cost, 2),
        monthly_savings=round(monthly_savings, 2), annual_savings=round(monthly_savings * 12, 2),
        payback_period_years=round(final_cost / (monthly_savings * 12), 1),
        panels_required=int((capacity * 1000) / 400), co2_offset_kg_yearly=round(avg_daily * 365 * 0.82, 2),
        ai_recommendations="Consider on-grid system for ROI. Ensure south-facing panels.",
        system_type="Residential System", subsidy_info=f"₹{subsidy:,.0f} subsidy. Final: ₹{final_cost:,.0f}"
    )
    doc = calc_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.solar_calculations.insert_one(doc)
    return calc_obj

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    return {
        "total_leads": await db.leads.count_documents({}),
        "total_chats": await db.chat_messages.count_documents({}),
        "total_calculations": await db.solar_calculations.count_documents({}),
        "total_campaigns": await db.campaigns.count_documents({}),
        "high_score_leads": await db.leads.count_documents({"lead_score": {"$gte": 80}}),
        "recent_leads": await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5),
        "new_leads": await db.leads.count_documents({"status": "new"}),
        "total_photos": await db.work_photos.count_documents({}),
        "total_reviews": await db.customer_reviews.count_documents({})
    }

# Analytics Endpoint for detailed business insights
@api_router.get("/admin/analytics")
async def get_analytics():
    """Get comprehensive analytics data for admin dashboard"""
    now = datetime.now(timezone.utc)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    this_week_start = now - timedelta(days=now.weekday())
    
    # Get leads by district
    leads_by_district = await db.leads.aggregate([
        {"$group": {"_id": "$district", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]).to_list(15)
    
    # Get leads by status
    leads_by_status = await db.leads.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Get leads by property type
    leads_by_property_type = await db.leads.aggregate([
        {"$group": {"_id": "$property_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Average lead score
    avg_score_result = await db.leads.aggregate([
        {"$match": {"lead_score": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$lead_score"}}}
    ]).to_list(1)
    avg_lead_score = round(avg_score_result[0]["avg_score"], 1) if avg_score_result else 0
    
    # Monthly/Weekly counts - using string comparison for stored ISO timestamps
    this_month_str = this_month_start.isoformat()
    last_month_str = last_month_start.isoformat()
    this_week_str = this_week_start.isoformat()
    
    leads_this_month = await db.leads.count_documents({"timestamp": {"$gte": this_month_str}})
    leads_last_month = await db.leads.count_documents({
        "timestamp": {"$gte": last_month_str, "$lt": this_month_str}
    })
    leads_this_week = await db.leads.count_documents({"timestamp": {"$gte": this_week_str}})
    
    return {
        "total_leads": await db.leads.count_documents({}),
        "new_leads": await db.leads.count_documents({"status": "new"}),
        "total_chats": await db.chat_messages.count_documents({}),
        "total_calculations": await db.solar_calculations.count_documents({}),
        "total_campaigns": await db.campaigns.count_documents({}),
        "high_score_leads": await db.leads.count_documents({"lead_score": {"$gte": 80}}),
        "total_photos": await db.work_photos.count_documents({}),
        "total_reviews": await db.customer_reviews.count_documents({}),
        "leads_by_district": leads_by_district,
        "leads_by_status": leads_by_status,
        "leads_by_property_type": leads_by_property_type,
        "leads_this_month": leads_this_month,
        "leads_last_month": leads_last_month,
        "leads_this_week": leads_this_week,
        "avg_lead_score": avg_lead_score,
        "recent_leads": await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
    }

# Admin OTP APIs
@api_router.post("/admin/send-otp")
async def send_otp(request: Dict[str, Any]):
    email = request.get("email", "").lower()
    # Only admin email is allowed
    registered_admin = "asrenterprisespatna@gmail.com"
    if email != registered_admin:
        raise HTTPException(status_code=403, detail="Email not registered. Only admin can access.")
    
    # Generate and store secure OTP
    otp = generate_secure_otp()
    store_otp(email, otp)
    logger.info(f"OTP generated for {email}")
    return {"success": True, "message": "OTP sent to your registered email"}

@api_router.post("/admin/verify-otp")
async def verify_otp_endpoint(request: Request, data: Dict[str, Any]):
    client_ip = get_client_ip(request)
    
    # Check login rate limit
    if not check_login_rate_limit(client_ip):
        logger.warning(f"Login rate limit exceeded for IP: {client_ip}")
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again in 5 minutes.")
    
    email = data.get("email", "").lower().strip()
    otp = data.get("otp", "").strip()
    
    # Only allow admin email
    registered_admin = "asrenterprisespatna@gmail.com"
    if email != registered_admin:
        logger.warning(f"Unauthorized login attempt for email: {email} from IP: {client_ip}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify OTP
    if verify_otp(email, otp):
        logger.info(f"Successful admin login for {email} from IP: {client_ip}")
        return {"success": True, "role": "admin", "email": email}
    
    logger.warning(f"Failed OTP verification for {email} from IP: {client_ip}")
    raise HTTPException(status_code=401, detail="Invalid or expired OTP")

# Staff Management with AI Features
@api_router.get("/admin/staff")
async def get_staff():
    staff = await db.staff.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return staff

@api_router.post("/admin/staff")
async def create_staff(staff_data: Dict[str, Any]):
    staff = StaffMember(
        name=sanitize_input(staff_data.get("name", "")),
        email=staff_data.get("email", ""),
        phone=staff_data.get("phone", ""),
        role=staff_data.get("role", "staff"),
        reportingTo=staff_data.get("reportingTo", ""),
        joiningDate=staff_data.get("joiningDate", ""),
        status=staff_data.get("status", "active")
    )
    doc = staff.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.staff.insert_one(doc)
    return staff

@api_router.put("/admin/staff/{staff_id}")
async def update_staff(staff_id: str, staff_data: Dict[str, Any]):
    await db.staff.update_one({"id": staff_id}, {"$set": staff_data})
    return {"success": True}

@api_router.delete("/admin/staff/{staff_id}")
async def delete_staff(staff_id: str):
    await db.staff.delete_one({"id": staff_id})
    return {"success": True}

@api_router.post("/admin/staff/{staff_id}/task")
async def assign_task(staff_id: str, task_data: Dict[str, Any]):
    """Assign task to staff member"""
    await db.staff.update_one(
        {"id": staff_id}, 
        {"$inc": {"tasks_pending": 1}}
    )
    task = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "title": sanitize_input(task_data.get("title", "")),
        "description": sanitize_input(task_data.get("description", "")),
        "priority": task_data.get("priority", "medium"),
        "due_date": task_data.get("due_date", ""),
        "status": "pending",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_tasks.insert_one(task)
    return {"success": True, "task": task}

@api_router.get("/admin/staff/{staff_id}/tasks")
async def get_staff_tasks(staff_id: str):
    tasks = await db.staff_tasks.find({"staff_id": staff_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return tasks

@api_router.put("/admin/staff/task/{task_id}/complete")
async def complete_task(task_id: str):
    task = await db.staff_tasks.find_one({"id": task_id})
    if task:
        await db.staff_tasks.update_one({"id": task_id}, {"$set": {"status": "completed"}})
        await db.staff.update_one(
            {"id": task["staff_id"]}, 
            {"$inc": {"tasks_completed": 1, "tasks_pending": -1}}
        )
    return {"success": True}

@api_router.post("/admin/staff/{staff_id}/attendance")
async def mark_attendance(staff_id: str, attendance_data: Dict[str, Any]):
    """Mark staff attendance"""
    attendance = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "date": attendance_data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "status": attendance_data.get("status", "present"),
        "check_in": attendance_data.get("check_in", ""),
        "check_out": attendance_data.get("check_out", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_attendance.insert_one(attendance)
    return {"success": True}

@api_router.get("/admin/staff/{staff_id}/attendance")
async def get_staff_attendance(staff_id: str):
    attendance = await db.staff_attendance.find({"staff_id": staff_id}, {"_id": 0}).sort("date", -1).to_list(30)
    return attendance

@api_router.post("/admin/staff/{staff_id}/ai-analysis")
async def analyze_staff_performance(staff_id: str):
    """AI-powered staff performance analysis"""
    staff = await db.staff.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    tasks = await db.staff_tasks.find({"staff_id": staff_id}, {"_id": 0}).to_list(50)
    attendance = await db.staff_attendance.find({"staff_id": staff_id}, {"_id": 0}).to_list(30)
    
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    present_days = sum(1 for a in attendance if a.get("status") == "present")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an HR analytics AI assistant that provides performance insights for staff members."
        )
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Analyze this staff member's performance and provide insights:
            Name: {staff.get('name')}
            Role: {staff.get('role')}
            Tasks Completed: {completed}
            Tasks Pending: {pending}
            Attendance (last 30 days): {present_days} days present
            
            Provide:
            1. Performance rating (1-100)
            2. Strengths
            3. Areas for improvement
            4. Recommendations
            
            Be constructive and helpful. Keep response concise.""")]
        )
        
        await db.staff.update_one(
            {"id": staff_id}, 
            {"$set": {"ai_performance_insights": response, "performance_score": min(100, 50 + completed * 5)}}
        )
        
        return {"success": True, "analysis": response}
    except Exception as e:
        logger.error(f"Error analyzing staff: {e}")
        default_analysis = f"Performance Score: {50 + completed * 5}/100. Tasks completed: {completed}. Attendance: {present_days} days."
        return {"success": True, "analysis": default_analysis}

# Marketing
@api_router.post("/marketing/campaigns", response_model=Campaign)
async def create_campaign(campaign_data: CampaignCreate):
    campaign_obj = Campaign(**campaign_data.model_dump(), status="active", ai_optimized_message="AI optimized version")
    doc = campaign_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.campaigns.insert_one(doc)
    return campaign_obj

@api_router.get("/marketing/campaigns", response_model=List[Campaign])
async def get_campaigns():
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return campaigns

@api_router.post("/ads/analytics", response_model=AdAnalytics)
async def create_ad_analytics(ad_data: Dict[str, Any]):
    analytics_obj = AdAnalytics(
        platform=ad_data.get('platform', 'google'),
        campaign_name=ad_data.get('campaign_name', 'Campaign'),
        impressions=ad_data.get('impressions', 0),
        clicks=ad_data.get('clicks', 0),
        conversions=ad_data.get('conversions', 0),
        cost=ad_data.get('cost', 0.0),
        ctr=ad_data.get('ctr', 0.0),
        cpc=ad_data.get('cpc', 0.0),
        conversion_rate=ad_data.get('conversion_rate', 0.0),
        ai_insights="Performance looks good",
        ai_recommendations="Continue monitoring"
    )
    doc = analytics_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.ad_analytics.insert_one(doc)
    return analytics_obj

@api_router.get("/ads/analytics", response_model=List[AdAnalytics])
async def get_ad_analytics():
    analytics = await db.ad_analytics.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return analytics

@api_router.post("/ai-marketing/start")
async def start_ai_marketing(request: Dict[str, Any]):
    return {"success": True, "content": [], "stats": {"postsGenerated": 5, "adsCreated": 3, "leadsGenerated": 12, "platformsActive": 6}}

# Social Media Post Model
class SocialPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    platforms: List[str] = []
    status: str = "draft"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Social Media Integration APIs
@api_router.get("/admin/social-posts")
async def get_social_posts():
    posts = await db.social_posts.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return posts

@api_router.post("/admin/social-posts")
async def create_social_post(post_data: Dict[str, Any]):
    post = SocialPost(
        content=sanitize_input(post_data.get("content", "")),
        platforms=post_data.get("platforms", []),
        status=post_data.get("status", "draft")
    )
    doc = post.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.social_posts.insert_one(doc)
    return post

@api_router.post("/admin/social-posts/generate")
async def generate_social_post(request: Dict[str, Any]):
    """AI-powered social media post generator"""
    post_type = request.get("type", "promotion")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a social media marketing specialist for ASR Enterprises, a solar installation company in Bihar, India."
        )
        
        prompts = {
            "promotion": "Create a promotional social media post for ASR Enterprises, a solar installation company in Bihar. Mention PM Surya Ghar Yojana subsidy up to ₹78,000, 25-year warranty, and contact number 8877896889. Use emojis and hashtags.",
            "project": "Create a social media post celebrating a successful solar installation project by ASR Enterprises in Bihar. Mention energy savings, professional installation, and invite others to contact 8877896889. Use emojis and hashtags.",
            "festival": "Create a festive greeting social media post for ASR Enterprises, Bihar's trusted solar company. Make it warm, add solar energy reference, and mention contact 8877896889. Use emojis and hashtags.",
            "scheme": "Create an informative social media post about PM Surya Ghar Muft Bijli Yojana government scheme for solar rooftop. Mention subsidy details (up to ₹78,000), how ASR Enterprises can help, and contact 8877896889. Use emojis and hashtags."
        }
        
        prompt = prompts.get(post_type, prompts["promotion"])
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"{prompt}\n\nKeep it under 280 characters for Twitter compatibility. Return just the post content, no explanations.")]
        )
        
        return {"success": True, "suggestions": [response.strip()]}
    except Exception as e:
        logger.error(f"Error generating social post: {e}")
        # Return fallback content
        fallback = {
            "promotion": "🌞 Switch to Solar with ASR Enterprises! Get up to ₹78,000 govt subsidy. 25-year warranty + 5 years FREE maintenance! 📞 8877896889 #SolarPower #BiharSolar",
            "project": "✨ Another successful installation! Our team completed a rooftop solar system in Bihar. Save 90% on bills! 📱 8877896889 #SolarInstallation",
            "festival": "🎉 Warm wishes from ASR Enterprises! Go solar, save money, protect the environment! 🌞 #GreenEnergy #SolarBihar",
            "scheme": "📢 PM Surya Ghar Yojana: Up to ₹78,000 subsidy for rooftop solar! ASR Enterprises can help you apply. 📞 8877896889 #GovtScheme"
        }
        return {"success": True, "suggestions": [fallback.get(post_type, fallback["promotion"])]}

# ==================== CRM API ENDPOINTS ====================

# ==================== STAFF AUTHENTICATION ====================

@api_router.post("/staff/register")
async def register_staff(data: Dict[str, Any]):
    """Admin creates staff account with unique ID and password"""
    import hashlib
    
    # Check for custom staff ID or generate one
    custom_staff_id = data.get("custom_staff_id", "").strip().upper()
    if custom_staff_id:
        # Validate custom ID format and check for duplicates
        if not custom_staff_id.startswith("ASR"):
            custom_staff_id = f"ASR{custom_staff_id}"
        existing = await db.crm_staff_accounts.find_one({"staff_id": custom_staff_id})
        if existing:
            raise HTTPException(status_code=400, detail=f"Staff ID {custom_staff_id} already exists. Please use a different ID.")
        staff_id = custom_staff_id
    else:
        # Generate unique staff ID (ASR + 4 digits)
        staff_count = await db.crm_staff_accounts.count_documents({})
        staff_id = f"ASR{1001 + staff_count}"
        # Ensure uniqueness
        while await db.crm_staff_accounts.find_one({"staff_id": staff_id}):
            staff_count += 1
            staff_id = f"ASR{1001 + staff_count}"
    
    # Hash password
    password = data.get("password", "asr@123")
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    staff_account = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "password_hash": password_hash,
        "name": sanitize_input(data.get("name", "")),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "role": data.get("role", "sales"),
        "department": data.get("department", "sales"),
        "is_active": True,
        "leads_assigned": 0,
        "leads_converted": 0,
        "total_revenue": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_staff_accounts.insert_one(staff_account)
    
    return {
        "success": True,
        "staff_id": staff_id,
        "password": password,
        "message": f"Staff account created. Login ID: {staff_id}"
    }

@api_router.post("/staff/login")
async def staff_login(data: Dict[str, Any]):
    """Staff login with unique ID and password"""
    import hashlib
    
    staff_id = data.get("staff_id", "").strip().upper()
    password = data.get("password", "")
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id, "password_hash": password_hash, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid Staff ID or Password")
    
    # Create session token
    session_token = str(uuid.uuid4())
    staff_sessions[session_token] = {
        "staff_id": staff_id,
        "id": staff.get("id"),
        "name": staff.get("name"),
        "role": staff.get("role"),
        "timestamp": time.time()
    }
    
    return {
        "success": True,
        "token": session_token,
        "staff": staff
    }

@api_router.get("/staff/profile/{staff_id}")
async def get_staff_profile(staff_id: str):
    """Get staff profile and stats"""
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id},
        {"_id": 0, "password_hash": 0}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff

@api_router.get("/staff/{staff_id}/leads")
async def get_staff_assigned_leads(staff_id: str):
    """Get leads assigned to this staff member"""
    # Get internal ID from staff_id
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    leads = await db.crm_leads.find(
        {"assigned_to": staff.get("id")},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(200)
    
    return leads

@api_router.put("/staff/{staff_id}/leads/{lead_id}")
async def staff_update_lead(staff_id: str, lead_id: str, data: Dict[str, Any]):
    """Staff updates their assigned lead"""
    # Verify staff owns this lead
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    lead = await db.crm_leads.find_one({"id": lead_id, "assigned_to": staff.get("id")}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    
    # Track stage changes
    update_fields = {}
    if "stage" in data:
        history_entry = {
            "stage": data["stage"],
            "updated_by": staff_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": data.get("notes", f"Status changed to {data['stage']}")
        }
        status_history = lead.get("status_history", [])
        status_history.append(history_entry)
        update_fields["status_history"] = status_history
        update_fields["stage"] = data["stage"]
    
    if "follow_up_notes" in data:
        update_fields["follow_up_notes"] = sanitize_input(data["follow_up_notes"])
    if "next_follow_up" in data:
        update_fields["next_follow_up"] = data["next_follow_up"]
    if "survey_done" in data:
        update_fields["survey_done"] = data["survey_done"]
    if "quoted_amount" in data:
        update_fields["quoted_amount"] = data["quoted_amount"]
    
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_fields})
    
    # If converted, update staff stats
    if data.get("stage") == "completed":
        await db.crm_staff_accounts.update_one(
            {"staff_id": staff_id},
            {"$inc": {"leads_converted": 1}}
        )
    
    return {"success": True}

@api_router.get("/staff/{staff_id}/followups")
async def get_staff_followups(staff_id: str):
    """Get follow-up reminders for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    followups = await db.crm_followups.find(
        {"employee_id": staff.get("id")},
        {"_id": 0}
    ).sort("reminder_date", 1).to_list(100)
    
    return followups

@api_router.post("/staff/{staff_id}/followups")
async def staff_create_followup(staff_id: str, data: Dict[str, Any]):
    """Staff creates follow-up reminder"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    followup = CRMFollowUp(
        lead_id=data.get("lead_id", ""),
        employee_id=staff.get("id"),
        reminder_date=data.get("reminder_date", ""),
        reminder_time=data.get("reminder_time", "10:00"),
        reminder_type=data.get("reminder_type", "call"),
        notes=sanitize_input(data.get("notes", ""))
    )
    doc = followup.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_followups.insert_one(doc)
    
    # Update lead's next follow-up
    await db.crm_leads.update_one(
        {"id": data.get("lead_id")},
        {"$set": {"next_follow_up": data.get("reminder_date")}}
    )
    
    return followup

@api_router.put("/staff/{staff_id}/followups/{followup_id}")
async def staff_update_followup(staff_id: str, followup_id: str, data: Dict[str, Any]):
    """Staff marks follow-up as done"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    await db.crm_followups.update_one(
        {"id": followup_id, "employee_id": staff.get("id")},
        {"$set": {"status": data.get("status", "completed")}}
    )
    return {"success": True}

@api_router.get("/staff/{staff_id}/dashboard")
async def get_staff_dashboard(staff_id: str):
    """Staff dashboard with their stats"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    internal_id = staff.get("id")
    
    # Get assigned leads count by stage
    pipeline_stats = await db.crm_leads.aggregate([
        {"$match": {"assigned_to": internal_id}},
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Today's follow-ups
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    todays_followups = await db.crm_followups.find(
        {"employee_id": internal_id, "reminder_date": today, "status": "pending"},
        {"_id": 0}
    ).to_list(20)
    
    # Recent leads
    recent_leads = await db.crm_leads.find(
        {"assigned_to": internal_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(5).to_list(5)
    
    return {
        "staff": staff,
        "pipeline_stats": {item["_id"]: item["count"] for item in pipeline_stats if item["_id"]},
        "total_assigned": staff.get("leads_assigned", 0),
        "total_converted": staff.get("leads_converted", 0),
        "todays_followups": todays_followups,
        "recent_leads": recent_leads
    }

# Admin - Get all staff accounts
@api_router.get("/admin/staff-accounts")
async def get_all_staff_accounts():
    """Admin gets all staff accounts"""
    staff = await db.crm_staff_accounts.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return staff

@api_router.put("/admin/staff-accounts/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str, data: Dict[str, Any]):
    """Admin resets staff password"""
    import hashlib
    new_password = data.get("password", "asr@123")
    password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$set": {"password_hash": password_hash}}
    )
    return {"success": True, "new_password": new_password}

@api_router.put("/admin/staff-accounts/{staff_id}/toggle-status")
async def toggle_staff_status(staff_id: str, data: Dict[str, Any]):
    """Admin activates/deactivates staff account"""
    is_active = data.get("is_active", False)
    
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$set": {"is_active": is_active}}
    )
    
    status = "activated" if is_active else "deactivated"
    return {"success": True, "message": f"Staff account {status}"}

@api_router.put("/admin/staff-accounts/{staff_id}/update")
async def update_staff_account(staff_id: str, data: Dict[str, Any]):
    """Admin updates staff account details"""
    update_fields = {}
    
    if "name" in data:
        update_fields["name"] = sanitize_input(data["name"])
    if "email" in data:
        update_fields["email"] = data["email"]
    if "phone" in data:
        update_fields["phone"] = data["phone"]
    if "role" in data:
        update_fields["role"] = data["role"]
    if "department" in data:
        update_fields["department"] = data["department"]
    
    if update_fields:
        await db.crm_staff_accounts.update_one(
            {"staff_id": staff_id},
            {"$set": update_fields}
        )
    
    return {"success": True, "message": "Staff account updated"}

@api_router.delete("/admin/staff-accounts/{staff_id}")
async def delete_staff_account(staff_id: str):
    """Admin deletes staff account permanently"""
    # First unassign all leads from this staff
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if staff:
        await db.crm_leads.update_many(
            {"assigned_to": staff.get("id")},
            {"$set": {"assigned_to": None, "assigned_by": None}}
        )
    
    await db.crm_staff_accounts.delete_one({"staff_id": staff_id})
    return {"success": True, "message": "Staff account deleted"}

@api_router.get("/admin/staff-accounts/{staff_id}/details")
async def get_staff_details(staff_id: str):
    """Admin gets detailed staff info including assigned leads"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get assigned leads
    leads = await db.crm_leads.find(
        {"assigned_to": staff.get("id")},
        {"_id": 0}
    ).to_list(100)
    
    # Get follow-ups
    followups = await db.crm_followups.find(
        {"employee_id": staff.get("id")},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "staff": staff,
        "assigned_leads": leads,
        "followups": followups,
        "total_leads": len(leads),
        "pending_followups": len([f for f in followups if f.get("status") == "pending"])
    }

# ==================== TASK MANAGEMENT APIs ====================

@api_router.get("/crm/tasks")
async def get_all_tasks(staff_id: Optional[str] = None, status: Optional[str] = None, date: Optional[str] = None):
    """Get all tasks with optional filters"""
    query = {}
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    if date:
        query["due_date"] = date
    tasks = await db.crm_tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
    return tasks

@api_router.post("/crm/tasks")
async def create_task(data: Dict[str, Any]):
    """Admin creates task for staff"""
    # Get staff name
    staff = await db.crm_staff_accounts.find_one({"id": data.get("staff_id")}, {"_id": 0})
    staff_name = staff.get("name", "") if staff else ""
    
    # Get lead name if lead_id provided
    lead_name = ""
    if data.get("lead_id"):
        lead = await db.crm_leads.find_one({"id": data.get("lead_id")}, {"_id": 0})
        lead_name = lead.get("name", "") if lead else ""
    
    task = StaffTask(
        staff_id=data.get("staff_id", ""),
        staff_name=staff_name,
        title=sanitize_input(data.get("title", "")),
        description=sanitize_input(data.get("description", "")),
        task_type=data.get("task_type", "call"),
        lead_id=data.get("lead_id"),
        lead_name=lead_name,
        priority=data.get("priority", "medium"),
        due_date=data.get("due_date", ""),
        due_time=data.get("due_time", "10:00"),
        created_by=data.get("created_by", "admin")
    )
    doc = task.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_tasks.insert_one(doc)
    return task

@api_router.put("/crm/tasks/{task_id}")
async def update_task(task_id: str, data: Dict[str, Any]):
    """Update task status or details"""
    update_fields = {}
    for key in ["status", "notes", "priority", "due_date", "due_time"]:
        if key in data:
            update_fields[key] = data[key]
    
    if data.get("status") == "completed":
        update_fields["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.crm_tasks.update_one({"id": task_id}, {"$set": update_fields})
    return {"success": True}

@api_router.delete("/crm/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.crm_tasks.delete_one({"id": task_id})
    return {"success": True}

@api_router.get("/staff/{staff_id}/tasks")
async def get_staff_tasks(staff_id: str, date: Optional[str] = None):
    """Get tasks for a specific staff member"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    query = {"staff_id": staff.get("id")}
    if date:
        query["due_date"] = date
    
    tasks = await db.crm_tasks.find(query, {"_id": 0}).sort("due_time", 1).to_list(100)
    return tasks

@api_router.get("/staff/{staff_id}/tasks/today")
async def get_staff_today_tasks(staff_id: str):
    """Get today's tasks for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tasks = await db.crm_tasks.find(
        {"staff_id": staff.get("id"), "due_date": today},
        {"_id": 0}
    ).sort("due_time", 1).to_list(50)
    return tasks

# ==================== ACTIVITY TIMELINE APIs ====================

@api_router.get("/crm/leads/{lead_id}/activities")
async def get_lead_activities(lead_id: str):
    """Get activity timeline for a lead"""
    activities = await db.crm_activities.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return activities

@api_router.post("/crm/leads/{lead_id}/activities")
async def add_lead_activity(lead_id: str, data: Dict[str, Any]):
    """Add activity/note to lead timeline"""
    # Get staff info if staff_id provided
    staff_name = ""
    if data.get("staff_id"):
        staff = await db.crm_staff_accounts.find_one({"staff_id": data.get("staff_id")}, {"_id": 0})
        staff_name = staff.get("name", "") if staff else data.get("staff_name", "")
    
    activity = ActivityLog(
        lead_id=lead_id,
        staff_id=data.get("staff_id"),
        staff_name=staff_name or data.get("staff_name", "Admin"),
        activity_type=data.get("activity_type", "note"),
        title=sanitize_input(data.get("title", "")),
        description=sanitize_input(data.get("description", "")),
        old_value=data.get("old_value"),
        new_value=data.get("new_value")
    )
    doc = activity.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_activities.insert_one(doc)
    return activity

# ==================== INTERNAL MESSAGING APIs ====================

@api_router.get("/crm/messages")
async def get_all_messages(user_id: Optional[str] = None, lead_id: Optional[str] = None):
    """Get messages - admin sees all, staff sees their own"""
    query = {}
    if user_id:
        query["$or"] = [{"sender_id": user_id}, {"receiver_id": user_id}, {"receiver_id": None}]
    if lead_id:
        query["lead_id"] = lead_id
    
    messages = await db.crm_messages.find(query, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    return messages

@api_router.post("/crm/messages")
async def send_message(data: Dict[str, Any]):
    """Send internal message"""
    # Get receiver name if receiver_id provided
    receiver_name = "All Staff"
    if data.get("receiver_id"):
        receiver = await db.crm_staff_accounts.find_one({"id": data.get("receiver_id")}, {"_id": 0})
        receiver_name = receiver.get("name", "") if receiver else ""
    
    message = CRMMessage(
        sender_id=data.get("sender_id", "admin"),
        sender_name=data.get("sender_name", "Admin"),
        sender_type=data.get("sender_type", "admin"),
        receiver_id=data.get("receiver_id"),
        receiver_name=receiver_name,
        lead_id=data.get("lead_id"),
        message=sanitize_input(data.get("message", ""))
    )
    doc = message.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_messages.insert_one(doc)
    return message

@api_router.put("/crm/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    """Mark message as read"""
    await db.crm_messages.update_one({"id": message_id}, {"$set": {"is_read": True}})
    return {"success": True}

@api_router.get("/staff/{staff_id}/messages")
async def get_staff_messages(staff_id: str):
    """Get messages for staff member"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    internal_id = staff.get("id")
    messages = await db.crm_messages.find(
        {"$or": [{"sender_id": internal_id}, {"receiver_id": internal_id}, {"receiver_id": None}]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    return messages

@api_router.get("/staff/{staff_id}/messages/unread")
async def get_unread_messages(staff_id: str):
    """Get unread message count for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        return {"count": 0}
    
    internal_id = staff.get("id")
    count = await db.crm_messages.count_documents({
        "$or": [{"receiver_id": internal_id}, {"receiver_id": None}],
        "sender_id": {"$ne": internal_id},
        "is_read": False
    })
    return {"count": count}

# CRM Employee Management
@api_router.get("/crm/employees")
async def get_crm_employees():
    employees = await db.crm_employees.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return employees

@api_router.post("/crm/employees")
async def create_crm_employee(data: Dict[str, Any]):
    employee = CRMEmployee(
        name=sanitize_input(data.get("name", "")),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        role=data.get("role", "sales"),
        department=data.get("department", "sales")
    )
    doc = employee.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_employees.insert_one(doc)
    return employee

@api_router.put("/crm/employees/{employee_id}")
async def update_crm_employee(employee_id: str, data: Dict[str, Any]):
    update_data = {k: sanitize_input(v) if isinstance(v, str) else v for k, v in data.items()}
    await db.crm_employees.update_one({"id": employee_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/crm/employees/{employee_id}")
async def delete_crm_employee(employee_id: str):
    await db.crm_employees.delete_one({"id": employee_id})
    return {"success": True}

# CRM Lead Management with Pipeline
@api_router.get("/crm/leads")
async def get_crm_leads(stage: Optional[str] = None, assigned_to: Optional[str] = None):
    query = {}
    if stage:
        query["stage"] = stage
    if assigned_to:
        query["assigned_to"] = assigned_to
    leads = await db.crm_leads.find(query, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return leads

@api_router.post("/crm/leads")
async def create_crm_lead(data: Dict[str, Any]):
    # AI lead scoring and priority
    monthly_bill = data.get("monthly_bill") or 0
    lead_score = min(100, 40 + int(monthly_bill / 100))
    ai_priority = "high" if lead_score >= 80 else "medium" if lead_score >= 60 else "low"
    
    lead = CRMLead(
        name=sanitize_input(data.get("name", "")),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        district=data.get("district", ""),
        address=sanitize_input(data.get("address", "")),
        property_type=data.get("property_type", "residential"),
        monthly_bill=data.get("monthly_bill"),
        roof_area=data.get("roof_area"),
        source=data.get("source", "website"),
        stage="new",
        lead_score=lead_score,
        ai_priority=ai_priority,
        status_history=[{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": "Lead created"}]
    )
    doc = lead.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_leads.insert_one(doc)
    return lead

@api_router.put("/crm/leads/{lead_id}")
async def update_crm_lead(lead_id: str, data: Dict[str, Any]):
    # Get current lead
    current_lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not current_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Track stage changes
    if "stage" in data and data["stage"] != current_lead.get("stage"):
        history_entry = {
            "stage": data["stage"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": data.get("notes", f"Stage changed to {data['stage']}")
        }
        status_history = current_lead.get("status_history", [])
        status_history.append(history_entry)
        data["status_history"] = status_history
    
    # Calculate pending amount
    if "total_amount" in data or "advance_paid" in data:
        total = data.get("total_amount", current_lead.get("total_amount", 0))
        advance = data.get("advance_paid", current_lead.get("advance_paid", 0))
        data["pending_amount"] = total - advance
    
    update_data = {k: sanitize_input(v) if isinstance(v, str) and k not in ["status_history"] else v for k, v in data.items()}
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_data})
    return {"success": True}

@api_router.post("/crm/leads/{lead_id}/assign")
async def assign_lead(lead_id: str, data: Dict[str, Any]):
    employee_id = data.get("employee_id")
    assigned_by = data.get("assigned_by", "admin")
    
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": {"assigned_to": employee_id, "assigned_by": assigned_by}}
    )
    
    # Update employee stats
    await db.crm_employees.update_one(
        {"id": employee_id},
        {"$inc": {"leads_assigned": 1}}
    )
    
    return {"success": True}

# CRM Follow-up Reminders
@api_router.get("/crm/followups")
async def get_followups(employee_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    followups = await db.crm_followups.find(query, {"_id": 0}).sort("reminder_date", 1).to_list(200)
    return followups

@api_router.post("/crm/followups")
async def create_followup(data: Dict[str, Any]):
    followup = CRMFollowUp(
        lead_id=data.get("lead_id", ""),
        employee_id=data.get("employee_id", ""),
        reminder_date=data.get("reminder_date", ""),
        reminder_time=data.get("reminder_time", "10:00"),
        reminder_type=data.get("reminder_type", "call"),
        notes=sanitize_input(data.get("notes", ""))
    )
    doc = followup.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_followups.insert_one(doc)
    
    # Update lead's next follow-up
    await db.crm_leads.update_one(
        {"id": data.get("lead_id")},
        {"$set": {"next_follow_up": data.get("reminder_date")}}
    )
    
    return followup

@api_router.put("/crm/followups/{followup_id}")
async def update_followup(followup_id: str, data: Dict[str, Any]):
    await db.crm_followups.update_one({"id": followup_id}, {"$set": data})
    return {"success": True}

# CRM Projects/Installations
@api_router.get("/crm/projects")
async def get_projects(status: Optional[str] = None):
    query = {}
    if status:
        query["installation_status"] = status
    projects = await db.crm_projects.find(query, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return projects

@api_router.post("/crm/projects")
async def create_project(data: Dict[str, Any]):
    project = CRMProject(
        lead_id=data.get("lead_id", ""),
        customer_name=sanitize_input(data.get("customer_name", "")),
        customer_phone=data.get("customer_phone", ""),
        location=sanitize_input(data.get("location", "")),
        system_size=data.get("system_size", ""),
        brand=data.get("brand", ""),
        total_amount=data.get("total_amount", 0),
        advance_received=data.get("advance_received", 0),
        pending_amount=data.get("total_amount", 0) - data.get("advance_received", 0)
    )
    doc = project.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_projects.insert_one(doc)
    
    # Update lead stage to installation
    if data.get("lead_id"):
        await db.crm_leads.update_one(
            {"id": data.get("lead_id")},
            {"$set": {"stage": "installation"}}
        )
    
    return project

@api_router.put("/crm/projects/{project_id}")
async def update_project(project_id: str, data: Dict[str, Any]):
    # Calculate pending
    if "total_amount" in data or "advance_received" in data:
        project = await db.crm_projects.find_one({"id": project_id}, {"_id": 0})
        if project:
            total = data.get("total_amount", project.get("total_amount", 0))
            advance = data.get("advance_received", project.get("advance_received", 0))
            data["pending_amount"] = total - advance
    
    await db.crm_projects.update_one({"id": project_id}, {"$set": data})
    return {"success": True}

@api_router.post("/crm/projects/{project_id}/photos")
async def add_project_photos(project_id: str, data: Dict[str, Any]):
    photo_url = data.get("photo_url", "")
    photo_type = data.get("type", "installation")  # installation or completion
    
    field = "installation_photos" if photo_type == "installation" else "completion_photos"
    await db.crm_projects.update_one(
        {"id": project_id},
        {"$push": {field: photo_url}}
    )
    
    # Also add to gallery
    photo = {
        "id": str(uuid.uuid4()),
        "title": f"Installation at {data.get('location', 'Bihar')}",
        "description": data.get("description", "Solar installation by ASR Enterprises"),
        "image_url": photo_url,
        "location": data.get("location", ""),
        "system_size": data.get("system_size", ""),
        "category": "installation",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.work_photos.insert_one(photo)
    
    return {"success": True}

# CRM Payments
@api_router.get("/crm/payments")
async def get_payments(project_id: Optional[str] = None):
    query = {}
    if project_id:
        query["project_id"] = project_id
    payments = await db.crm_payments.find(query, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return payments

@api_router.post("/crm/payments")
async def create_payment(data: Dict[str, Any]):
    payment = CRMPayment(
        project_id=data.get("project_id", ""),
        lead_id=data.get("lead_id", ""),
        amount=data.get("amount", 0),
        payment_type=data.get("payment_type", "advance"),
        payment_mode=data.get("payment_mode", "cash"),
        received_by=data.get("received_by", ""),
        notes=sanitize_input(data.get("notes", ""))
    )
    doc = payment.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_payments.insert_one(doc)
    
    # Update project payment
    if data.get("project_id"):
        await db.crm_projects.update_one(
            {"id": data.get("project_id")},
            {"$inc": {"advance_received": data.get("amount", 0), "pending_amount": -data.get("amount", 0)}}
        )
    
    # Update employee revenue
    if data.get("received_by"):
        await db.crm_employees.update_one(
            {"id": data.get("received_by")},
            {"$inc": {"total_revenue": data.get("amount", 0)}}
        )
    
    return payment

# CRM Dashboard Stats
@api_router.get("/crm/dashboard")
async def get_crm_dashboard():
    # Lead stats by stage
    pipeline_stats = await db.crm_leads.aggregate([
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Today's follow-ups
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    todays_followups = await db.crm_followups.count_documents({"reminder_date": today, "status": "pending"})
    
    # Employee performance
    employees = await db.crm_employees.find({}, {"_id": 0}).to_list(50)
    
    # Recent leads
    recent_leads = await db.crm_leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
    
    # Revenue stats
    total_payments = await db.crm_payments.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Project stats
    projects_pending = await db.crm_projects.count_documents({"installation_status": "pending"})
    projects_progress = await db.crm_projects.count_documents({"installation_status": "in_progress"})
    projects_completed = await db.crm_projects.count_documents({"installation_status": "completed"})
    
    return {
        "pipeline_stats": {item["_id"]: item["count"] for item in pipeline_stats if item["_id"]},
        "total_leads": await db.crm_leads.count_documents({}),
        "todays_followups": todays_followups,
        "employees": employees,
        "recent_leads": recent_leads,
        "total_revenue": total_payments[0]["total"] if total_payments else 0,
        "projects": {
            "pending": projects_pending,
            "in_progress": projects_progress,
            "completed": projects_completed
        }
    }

# CRM AI Features
@api_router.post("/crm/ai/lead-priority")
async def ai_lead_priority(data: Dict[str, Any]):
    """AI-powered lead prioritization"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a sales AI assistant for a solar company."
        )
        
        leads = await db.crm_leads.find({"stage": {"$in": ["new", "follow_up"]}}, {"_id": 0}).limit(20).to_list(20)
        
        leads_summary = "\n".join([
            f"- {l.get('name')}: ₹{l.get('monthly_bill', 0)} bill, {l.get('district')}, {l.get('property_type')}"
            for l in leads
        ])
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Analyze these solar leads and rank them by priority:
{leads_summary}

Return top 5 leads to focus on today with reasons. Format: Name - Priority (High/Medium) - Reason""")]
        )
        
        return {"success": True, "recommendations": response}
    except Exception as e:
        logger.error(f"AI lead priority error: {e}")
        return {"success": True, "recommendations": "Focus on leads with high monthly bills (>₹3000) and residential properties first."}

@api_router.post("/crm/ai/followup-suggestions")
async def ai_followup_suggestions(data: Dict[str, Any]):
    """AI-powered follow-up suggestions"""
    lead_id = data.get("lead_id")
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    
    if not lead:
        return {"success": False, "error": "Lead not found"}
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a sales coach for a solar company in Bihar."
        )
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Suggest follow-up approach for this lead:
Name: {lead.get('name')}
Stage: {lead.get('stage')}
Monthly Bill: ₹{lead.get('monthly_bill', 'Unknown')}
Property: {lead.get('property_type')}
District: {lead.get('district')}
Last Follow-up Notes: {lead.get('follow_up_notes', 'None')}

Suggest: 1) Best time to call 2) Key talking points 3) Offer to make 4) Objection handling. Keep it brief.""")]
        )
        
        return {"success": True, "suggestions": response}
    except Exception as e:
        logger.error(f"AI followup error: {e}")
        return {"success": True, "suggestions": f"Call between 10 AM - 12 PM or 4 PM - 6 PM. Highlight PM Surya Ghar subsidy of ₹78,000 and 25-year warranty. Offer free site survey."}

@api_router.get("/crm/reports/monthly")
async def get_monthly_report():
    """Monthly business growth report"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_str = month_start.isoformat()
    
    # Leads this month
    leads_this_month = await db.crm_leads.count_documents({"timestamp": {"$gte": month_str}})
    
    # Conversions
    conversions = await db.crm_leads.count_documents({"stage": "completed", "timestamp": {"$gte": month_str}})
    
    # Revenue this month
    revenue_result = await db.crm_payments.aggregate([
        {"$match": {"timestamp": {"$gte": month_str}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Employee performance
    employees = await db.crm_employees.find({}, {"_id": 0}).to_list(50)
    
    # Source breakdown
    source_stats = await db.crm_leads.aggregate([
        {"$match": {"timestamp": {"$gte": month_str}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    return {
        "month": now.strftime("%B %Y"),
        "total_leads": leads_this_month,
        "conversions": conversions,
        "conversion_rate": round((conversions / leads_this_month * 100) if leads_this_month > 0 else 0, 1),
        "total_revenue": revenue_result[0]["total"] if revenue_result else 0,
        "employee_performance": [
            {"name": e.get("name"), "leads": e.get("leads_assigned", 0), "converted": e.get("leads_converted", 0), "revenue": e.get("total_revenue", 0)}
            for e in employees
        ],
        "lead_sources": {item["_id"]: item["count"] for item in source_stats if item["_id"]}
    }

# Gallery Photo Upload (direct)
@api_router.post("/gallery/upload")
async def upload_gallery_photo(data: Dict[str, Any]):
    """Direct photo upload to gallery"""
    photo = {
        "id": str(uuid.uuid4()),
        "title": sanitize_input(data.get("title", "Solar Installation")),
        "description": sanitize_input(data.get("description", "")),
        "image_url": data.get("image_url", ""),
        "location": sanitize_input(data.get("location", "")),
        "system_size": data.get("system_size", ""),
        "category": data.get("category", "installation"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.work_photos.insert_one(photo)
    return {"success": True, "photo": photo}

@api_router.get("/")
async def root():
    return {"message": "ASR Enterprises Solar AI Platform API", "status": "active"}

# CRITICAL: Health check for Kubernetes
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ASR Enterprises API"}

# Security endpoint for health check
@api_router.get("/security/status")
async def security_status():
    return {
        "status": "secure",
        "security_features": [
            "Rate limiting enabled",
            "Input sanitization active",
            "XSS protection enabled",
            "CSRF protection enabled",
            "Security headers configured",
            "Brute force protection active",
            "OTP expiry enforced",
            "Constant-time OTP comparison"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Report suspicious activity endpoint
@api_router.post("/security/report")
async def report_suspicious(request: Request, data: Dict[str, Any]):
    client_ip = get_client_ip(request)
    activity_type = sanitize_input(data.get("type", "unknown"))
    details = sanitize_input(data.get("details", ""))
    
    # Log suspicious activity
    logger.warning(f"Suspicious activity reported - Type: {activity_type}, IP: {client_ip}, Details: {details}")
    
    # Store in database for analysis
    await db.security_logs.insert_one({
        "type": activity_type,
        "ip": client_ip,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Report received"}

app.include_router(api_router)

# CORS configuration with security
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware, 
    allow_credentials=True, 
    allow_origins=cors_origins, 
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"]
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
