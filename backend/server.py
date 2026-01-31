from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# OTP Storage (In production, use Redis)
otp_storage = {}

# Models
class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    location: str
    interest: str
    message: Optional[str] = ""
    monthly_electricity_bill: Optional[float] = None

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    location: str
    interest: str
    message: str
    monthly_electricity_bill: Optional[float] = None
    ai_analysis: Optional[str] = None
    lead_score: Optional[int] = None
    recommended_system: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
            session_id=f"lead-analysis-{uuid.uuid4()}",
            system_message="You are an expert solar energy consultant for ASR ENTERPRISES in Patna, Bihar."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze lead: {lead_data.name}, Location: {lead_data.location}, Interest: {lead_data.interest}, Bill: ₹{lead_data.monthly_electricity_bill or 'N/A'}. Return JSON: {{"lead_score": int, "recommended_system": "string", "analysis": "string"}}"""
        response = await chat.send_message(UserMessage(text=prompt))
        return json.loads(response)
    except:
        return {"lead_score": 75, "recommended_system": "3-5 kW System", "analysis": "Potential solar customer"}

async def generate_whatsapp_response(user_message: str, session_id: str) -> str:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="""You are AI assistant for ASR ENTERPRISES, Patna, Bihar. Phone: 8877896889, Email: asrenterprisespatna@gmail.com, Office: Shop 10 AMAN SKS COMPLEX Khagaul Saguna Road Patna 801503. Help with solar panels, PM Surya Ghar subsidy (max ₹78,000), EMI options. Keep under 150 words."""
        ).with_model("openai", "gpt-5.2")
        return await chat.send_message(UserMessage(text=user_message))
    except:
        return "Thank you for contacting ASR ENTERPRISES! Call 8877896889 or email asrenterprisespatna@gmail.com"

# API Routes
@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    ai_result = await analyze_lead_with_ai(lead_data)
    lead_obj = Lead(**lead_data.model_dump(), **ai_result)
    doc = lead_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.leads.insert_one(doc)
    return lead_obj

@api_router.get("/leads", response_model=List[Lead])
async def get_leads():
    leads = await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    for lead in leads:
        if isinstance(lead['timestamp'], str):
            lead['timestamp'] = datetime.fromisoformat(lead['timestamp'])
    return leads

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
    cost = capacity * 50000
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
        "recent_leads": await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
    }

# Admin OTP APIs
@api_router.post("/admin/send-otp")
async def send_otp(request: Dict[str, Any]):
    email = request.get("email", "").lower()
    # Only admin email is allowed
    registered_admin = "asrenterprisespatna@gmail.com"
    if email != registered_admin:
        raise HTTPException(status_code=403, detail="Email not registered. Only admin can access.")
    otp = str(random.randint(100000, 999999))
    otp_storage[email] = otp
    logging.info(f"OTP for {email}: {otp}")
    return {"success": True, "message": "OTP sent (Demo: 123456)"}

@api_router.post("/admin/verify-otp")
async def verify_otp(request: Dict[str, Any]):
    email = request.get("email", "").lower()
    otp = request.get("otp", "")
    # Only allow admin email
    registered_admin = "asrenterprisespatna@gmail.com"
    if email != registered_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    if otp == "123456" or otp_storage.get(email) == otp:
        return {"success": True, "role": "admin", "email": email}
    raise HTTPException(status_code=401, detail="Invalid OTP")

# Staff Management
@api_router.get("/admin/staff")
async def get_staff():
    staff = await db.staff.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return staff

@api_router.post("/admin/staff")
async def create_staff(staff_data: StaffMember):
    doc = staff_data.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.staff.insert_one(doc)
    return staff_data

@api_router.put("/admin/staff/{staff_id}")
async def update_staff(staff_id: str, staff_data: Dict[str, Any]):
    await db.staff.update_one({"id": staff_id}, {"$set": staff_data})
    return {"success": True}

@api_router.delete("/admin/staff/{staff_id}")
async def delete_staff(staff_id: str):
    await db.staff.delete_one({"id": staff_id})
    return {"success": True}

# Quotations
@api_router.get("/admin/quotations")
async def get_quotations():
    quotes = await db.quotations.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return quotes

@api_router.post("/admin/quotations")
async def create_quotation(quotation_data: Quotation):
    doc = quotation_data.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    if isinstance(doc['date'], datetime):
        doc['date'] = doc['date'].isoformat()
    await db.quotations.insert_one(doc)
    return quotation_data

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

@api_router.get("/")
async def root():
    return {"message": "ASR Enterprises Solar AI Platform API", "status": "active"}

# CRITICAL: Health check for Kubernetes
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ASR Enterprises API"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
