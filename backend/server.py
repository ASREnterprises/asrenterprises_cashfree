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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# ==================== MODELS ====================

# Lead Capture Models
class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    location: str
    interest: str  # solar_panel, solar_water_heater, consultation
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

# WhatsApp Chat Models
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

# Solar Calculator Models
class SolarCalculationRequest(BaseModel):
    monthly_bill: float
    roof_area: float  # in sq ft
    location: str
    electricity_rate: Optional[float] = 7.5  # Default ₹7.5 per unit for Bihar
    has_three_phase: bool = False

class SolarCalculation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    monthly_bill: float
    roof_area: float
    location: str
    electricity_rate: float
    
    # Calculated values
    recommended_capacity_kw: float
    estimated_cost: float
    monthly_savings: float
    annual_savings: float
    payback_period_years: float
    panels_required: int
    co2_offset_kg_yearly: float
    
    # AI Recommendations
    ai_recommendations: str
    system_type: str
    subsidy_info: str
    
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Marketing Campaign Models
class CampaignCreate(BaseModel):
    name: str
    target_audience: str
    message_template: str
    channel: str  # email, sms, whatsapp

class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    target_audience: str
    message_template: str
    channel: str
    status: str = "draft"  # draft, active, paused, completed
    ai_optimized_message: Optional[str] = None
    sent_count: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Ads Analytics Models
class AdAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    platform: str  # google, facebook
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

# ==================== AI HELPER FUNCTIONS ====================

async def analyze_lead_with_ai(lead_data: LeadCreate) -> Dict[str, Any]:
    """Analyze lead and provide AI insights"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"lead-analysis-{uuid.uuid4()}",
            system_message="You are an expert solar energy consultant for ASR ENTERPRISES in Patna, Bihar. Analyze leads and provide insights based on Bihar's solar market conditions."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""
        Analyze this solar energy lead:
        Name: {lead_data.name}
        Location: {lead_data.location}
        Interest: {lead_data.interest}
        Monthly Bill: ₹{lead_data.monthly_electricity_bill or 'Not provided'}
        Message: {lead_data.message}
        
        Provide:
        1. Lead Score (1-100)
        2. Recommended System Type
        3. Brief Analysis (2-3 sentences)
        
        Return in JSON format: {{"lead_score": int, "recommended_system": "string", "analysis": "string"}}
        """
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        # Parse AI response
        result = json.loads(response)
        return result
    except Exception as e:
        logging.error(f"AI analysis error: {str(e)}")
        return {
            "lead_score": 70,
            "recommended_system": "3-5 kW Rooftop System",
            "analysis": "Potential customer for residential solar installation."
        }

async def calculate_solar_with_ai(calc_data: SolarCalculationRequest) -> Dict[str, Any]:
    """Calculate solar requirements and provide AI recommendations"""
    
    # Basic calculations
    avg_daily_consumption = (calc_data.monthly_bill / calc_data.electricity_rate) / 30  # kWh/day
    recommended_capacity = avg_daily_consumption / 4  # Assuming 4 peak sun hours
    
    # Cost estimation (₹50,000 per kW average in India)
    cost_per_kw = 50000
    estimated_cost = recommended_capacity * cost_per_kw
    
    # Subsidy (30% for residential up to 10kW)
    subsidy_percentage = 0.30 if recommended_capacity <= 10 else 0.20
    subsidy_amount = estimated_cost * subsidy_percentage
    final_cost = estimated_cost - subsidy_amount
    
    # Savings calculation
    monthly_savings = calc_data.monthly_bill * 0.85  # 85% bill reduction
    annual_savings = monthly_savings * 12
    payback_period = final_cost / annual_savings
    
    # Number of panels (assuming 400W panels)
    panels_required = int((recommended_capacity * 1000) / 400)
    
    # CO2 offset (0.82 kg CO2 per kWh)
    annual_generation = avg_daily_consumption * 365
    co2_offset = annual_generation * 0.82
    
    # Get AI recommendations
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"solar-calc-{uuid.uuid4()}",
            system_message="You are an expert solar energy consultant providing recommendations."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""
        Solar system requirements for:
        - Location: {calc_data.location}
        - Monthly Bill: ₹{calc_data.monthly_bill}
        - Roof Area: {calc_data.roof_area} sq ft
        - Recommended Capacity: {recommended_capacity:.2f} kW
        - Estimated Cost: ₹{final_cost:,.0f} (after subsidy)
        
        Provide 3 specific recommendations for this customer in 150 words.
        """
        
        message = UserMessage(text=prompt)
        ai_recommendations = await chat.send_message(message)
    except Exception as e:
        logging.error(f"AI recommendations error: {str(e)}")
        ai_recommendations = "Consider on-grid system for better ROI. Ensure south-facing panels. Regular maintenance recommended."
    
    # System type
    if recommended_capacity < 3:
        system_type = "Small Residential System (1-3 kW)"
    elif recommended_capacity < 10:
        system_type = "Medium Residential System (3-10 kW)"
    else:
        system_type = "Large Residential/Commercial System (10+ kW)"
    
    subsidy_info = f"Eligible for {subsidy_percentage*100:.0f}% subsidy (₹{subsidy_amount:,.0f}). Final cost: ₹{final_cost:,.0f}"
    
    return {
        "recommended_capacity_kw": round(recommended_capacity, 2),
        "estimated_cost": round(final_cost, 2),
        "monthly_savings": round(monthly_savings, 2),
        "annual_savings": round(annual_savings, 2),
        "payback_period_years": round(payback_period, 1),
        "panels_required": panels_required,
        "co2_offset_kg_yearly": round(co2_offset, 2),
        "ai_recommendations": ai_recommendations,
        "system_type": system_type,
        "subsidy_info": subsidy_info
    }

async def generate_whatsapp_response(user_message: str, session_id: str) -> str:
    """Generate AI response for WhatsApp chatbot"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="""You are a helpful assistant for ASR ENTERPRISES, a leading solar energy company in Patna, Bihar. 
            
            Company Details:
            - Phone: 8877896889
            - Email: asrenterprisespatna@gmail.com
            - Office: Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503
            - Registered Office: Dawarikapuri, Khagaul, Patna 801105, Bihar
            - GSTIN: 10CCFPK3447Q3ZD
            - Social Media: @asr_enterprises_patna
            
            Help customers with:
            - Solar panel information and benefits
            - Cost estimates and ROI calculations
            - Installation process and timeline
            - Government subsidies (30% for residential up to 10kW)
            - Maintenance and warranty details
            - System sizing recommendations
            
            Be concise, friendly, and professional. Keep responses under 150 words. Always provide accurate contact information when asked."""
        ).with_model("openai", "gpt-5.2")
        
        message = UserMessage(text=user_message)
        response = await chat.send_message(message)
        return response
    except Exception as e:
        logging.error(f"WhatsApp AI error: {str(e)}")
        return "Thank you for contacting ASR ENTERPRISES! For immediate assistance, please call us at 8877896889 or email asrenterprisespatna@gmail.com. We're here to help with all your solar energy needs!"

async def optimize_campaign_with_ai(campaign: CampaignCreate) -> str:
    """Optimize marketing campaign message with AI"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"campaign-opt-{uuid.uuid4()}",
            system_message="You are an expert marketing copywriter specializing in solar energy campaigns."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""
        Optimize this marketing message for better engagement:
        
        Campaign: {campaign.name}
        Target: {campaign.target_audience}
        Channel: {campaign.channel}
        Original Message: {campaign.message_template}
        
        Provide an improved version that is more engaging and conversion-focused. Keep it under 160 characters for SMS, or 300 characters for email/WhatsApp.
        """
        
        message = UserMessage(text=prompt)
        optimized = await chat.send_message(message)
        return optimized
    except Exception as e:
        logging.error(f"Campaign optimization error: {str(e)}")
        return campaign.message_template

# ==================== API ROUTES ====================

# Lead Capture APIs
@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    """Smart lead capture with AI analysis"""
    try:
        # Get AI analysis
        ai_result = await analyze_lead_with_ai(lead_data)
        
        # Create lead object
        lead_dict = lead_data.model_dump()
        lead_obj = Lead(
            **lead_dict,
            ai_analysis=ai_result.get("analysis", ""),
            lead_score=ai_result.get("lead_score", 70),
            recommended_system=ai_result.get("recommended_system", "")
        )
        
        # Save to database
        doc = lead_obj.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.leads.insert_one(doc)
        
        return lead_obj
    except Exception as e:
        logging.error(f"Lead creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/leads", response_model=List[Lead])
async def get_leads():
    """Get all leads"""
    leads = await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for lead in leads:
        if isinstance(lead['timestamp'], str):
            lead['timestamp'] = datetime.fromisoformat(lead['timestamp'])
    
    return leads

# WhatsApp Chat APIs
@api_router.post("/chat/whatsapp")
async def whatsapp_chat(chat_request: ChatRequest):
    """Handle WhatsApp chatbot messages"""
    try:
        session_id = chat_request.session_id or str(uuid.uuid4())
        
        # Generate AI response
        bot_response = await generate_whatsapp_response(
            chat_request.message,
            session_id
        )
        
        # Save chat message
        chat_msg = ChatMessage(
            session_id=session_id,
            user_phone=chat_request.user_phone,
            user_message=chat_request.message,
            bot_response=bot_response
        )
        
        doc = chat_msg.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.chat_messages.insert_one(doc)
        
        return {
            "session_id": session_id,
            "response": bot_response
        }
    except Exception as e:
        logging.error(f"WhatsApp chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/history/{user_phone}")
async def get_chat_history(user_phone: str):
    """Get chat history for a user"""
    messages = await db.chat_messages.find(
        {"user_phone": user_phone},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return messages

# Solar Calculator APIs
@api_router.post("/solar/calculate", response_model=SolarCalculation)
async def calculate_solar(calc_request: SolarCalculationRequest):
    """Calculate solar requirements with AI recommendations"""
    try:
        # Get calculations and AI recommendations
        calc_result = await calculate_solar_with_ai(calc_request)
        
        # Create calculation object
        calc_obj = SolarCalculation(
            monthly_bill=calc_request.monthly_bill,
            roof_area=calc_request.roof_area,
            location=calc_request.location,
            electricity_rate=calc_request.electricity_rate,
            **calc_result
        )
        
        # Save to database
        doc = calc_obj.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.solar_calculations.insert_one(doc)
        
        return calc_obj
    except Exception as e:
        logging.error(f"Solar calculation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/solar/calculations", response_model=List[SolarCalculation])
async def get_solar_calculations():
    """Get all solar calculations"""
    calculations = await db.solar_calculations.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for calc in calculations:
        if isinstance(calc['timestamp'], str):
            calc['timestamp'] = datetime.fromisoformat(calc['timestamp'])
    
    return calculations

# Marketing Automation APIs
@api_router.post("/marketing/campaigns", response_model=Campaign)
async def create_campaign(campaign_data: CampaignCreate):
    """Create marketing campaign with AI optimization"""
    try:
        # Optimize campaign message with AI
        optimized_message = await optimize_campaign_with_ai(campaign_data)
        
        # Create campaign object
        campaign_obj = Campaign(
            **campaign_data.model_dump(),
            ai_optimized_message=optimized_message,
            status="active"
        )
        
        # Save to database
        doc = campaign_obj.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.campaigns.insert_one(doc)
        
        return campaign_obj
    except Exception as e:
        logging.error(f"Campaign creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketing/campaigns", response_model=List[Campaign])
async def get_campaigns():
    """Get all marketing campaigns"""
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for campaign in campaigns:
        if isinstance(campaign['timestamp'], str):
            campaign['timestamp'] = datetime.fromisoformat(campaign['timestamp'])
    
    return campaigns

# Ads Analytics APIs
@api_router.post("/ads/analytics", response_model=AdAnalytics)
async def create_ad_analytics(ad_data: Dict[str, Any]):
    """Create ads analytics entry (mock data for demo)"""
    try:
        # Generate AI insights
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ads-analysis-{uuid.uuid4()}",
            system_message="You are an expert digital marketing analyst specializing in ad optimization."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""
        Analyze this ad campaign performance:
        Platform: {ad_data.get('platform', 'Google')}
        Campaign: {ad_data.get('campaign_name', 'Solar Campaign')}
        Impressions: {ad_data.get('impressions', 0):,}
        Clicks: {ad_data.get('clicks', 0):,}
        Conversions: {ad_data.get('conversions', 0)}
        Cost: ₹{ad_data.get('cost', 0):,.2f}
        
        Provide:
        1. Key Insights (2-3 sentences)
        2. Top 3 Recommendations for improvement
        
        Format as: INSIGHTS: ... | RECOMMENDATIONS: ...
        """
        
        message = UserMessage(text=prompt)
        ai_response = await chat.send_message(message)
        
        # Parse AI response
        if " | " in ai_response:
            insights, recommendations = ai_response.split(" | ", 1)
            insights = insights.replace("INSIGHTS:", "").strip()
            recommendations = recommendations.replace("RECOMMENDATIONS:", "").strip()
        else:
            insights = ai_response[:200]
            recommendations = "Continue monitoring performance and adjust targeting as needed."
        
        # Create analytics object
        analytics_obj = AdAnalytics(
            platform=ad_data.get('platform', 'google'),
            campaign_name=ad_data.get('campaign_name', 'Solar Campaign'),
            impressions=ad_data.get('impressions', 0),
            clicks=ad_data.get('clicks', 0),
            conversions=ad_data.get('conversions', 0),
            cost=ad_data.get('cost', 0.0),
            ctr=ad_data.get('ctr', 0.0),
            cpc=ad_data.get('cpc', 0.0),
            conversion_rate=ad_data.get('conversion_rate', 0.0),
            ai_insights=insights,
            ai_recommendations=recommendations
        )
        
        # Save to database
        doc = analytics_obj.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.ad_analytics.insert_one(doc)
        
        return analytics_obj
    except Exception as e:
        logging.error(f"Ad analytics error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/ads/analytics", response_model=List[AdAnalytics])
async def get_ad_analytics():
    """Get all ads analytics"""
    analytics = await db.ad_analytics.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for item in analytics:
        if isinstance(item['timestamp'], str):
            item['timestamp'] = datetime.fromisoformat(item['timestamp'])
    
    return analytics

# Dashboard Stats API
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    total_leads = await db.leads.count_documents({})
    total_chats = await db.chat_messages.count_documents({})
    total_calculations = await db.solar_calculations.count_documents({})
    total_campaigns = await db.campaigns.count_documents({})
    
    # Get high score leads
    high_score_leads = await db.leads.count_documents({"lead_score": {"$gte": 80}})
    
    # Get recent leads
    recent_leads = await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
    for lead in recent_leads:
        if isinstance(lead['timestamp'], str):
            lead['timestamp'] = datetime.fromisoformat(lead['timestamp'])
    
    return {
        "total_leads": total_leads,
        "total_chats": total_chats,
        "total_calculations": total_calculations,
        "total_campaigns": total_campaigns,
        "high_score_leads": high_score_leads,
        "recent_leads": recent_leads
    }

# Health check
@api_router.get("/")
async def root():
    return {"message": "ASR Enterprises Solar AI Platform API", "status": "active"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
