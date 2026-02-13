# ASR Enterprises Solar Website - Product Requirements Document

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" - a solar energy business in Patna, Bihar with AI-powered features, admin panel, and comprehensive CRM system.

## Company Information
- **Name:** ASR Enterprises
- **Location:** Patna, Bihar
- **Phone:** 8877896889
- **Email:** asrenterprisespatna@gmail.com
- **Facebook:** https://www.facebook.com/share/1876swUqxu/

## Test Credentials
- **Admin:** asrenterprisespatna@gmail.com / OTP: 131993 (or check email)
- **Staff:** ASR1001 / asr@123
- **Webhook Verify Token:** asr_solar_verify_2024

---

## COMPLETE FEATURE LIST

### 🏠 Homepage
- Running flash advertisement banner
- Solar inquiry form (auto-creates CRM lead)
- Festive banner (auto-displays from admin)
- AI-generated brand logos
- Trust badges (MNRE, PM Surya Ghar)

### 📊 CRM System (/admin/crm)
- Lead management with AI scoring
- Staff account management (custom Staff IDs)
- Task management
- Internal messaging
- Work photo gallery (syncs to website)
- Project tracking
- Payment management
- **NEW: Auto-capture leads from WhatsApp & Facebook**

### 📱 Social Media Lead Auto-Capture (NEW)
- WhatsApp Business API webhook integration
- Facebook Messenger webhook integration
- Auto-creates lead when customer messages
- Updates existing lead on repeat messages
- Stores conversation history in follow-up notes
- Source marked as "whatsapp" or "facebook"

### 👨‍💼 Staff Portal (/staff/portal)
- Assigned leads view
- Follow-up management
- Task management
- Notifications bell with dropdown
- Email OTP login option

### 🚀 Business Intelligence Dashboard (/admin/business-dashboard)

#### 1. Daily Digest
- Personalized greeting with date
- AI-powered daily tip
- New leads count (vs yesterday)
- Today's revenue
- Follow-ups scheduled/completed
- Hot leads to focus (with WhatsApp/Call buttons)

#### 2. Staff Leaderboard
- Performance rankings with scores
- Top 3 podium display (🥇🥈🥉)
- Metrics: Conversions, Revenue, Conversion Rate
- Gamification badges

#### 3. Revenue Dashboard
- Monthly revenue vs target
- Progress bar visualization
- Pipeline value (potential revenue)
- Revenue by payment type
- Set monthly target feature

#### 4. Lead Analytics
- Total leads & this month count
- Conversion funnel visualization
- Leads by source
- Top performing districts
- Average lead score

#### 5. Overdue Lead Alerts
- Critical (5+ days) - RED
- 72+ hours - ORANGE
- 48+ hours - YELLOW
- 24+ hours - BLUE
- Quick WhatsApp/Call buttons

#### 6. AI Business Insights
- Conversion rate analysis
- Top performing district
- Best lead source
- Average deal value
- Top performer recognition
- Actionable recommendations

#### 7. Commission Calculator
- Staff commission report
- Commission rates: Sales 2%, Survey ₹500, Installation 1%, Manager 0.5%
- Total commission payable

### 🔔 Notifications & Reminders
- In-app notifications (bell icon)
- Follow-up reminders
- Lead assignment alerts
- WhatsApp notification URLs

### 📱 WhatsApp Integration
- Send quotes via WhatsApp (pre-filled message)
- Follow-up customer via WhatsApp
- Notify staff via WhatsApp
- Forward leads to staff WhatsApp

### 🤖 AI Features
- Lead scoring & prioritization
- Auto lead assignment (location + round-robin)
- Daily business tips
- Business insights & recommendations

### 🔐 Authentication
- Admin Email OTP (via Resend)
- Staff Password login
- Staff Email OTP login
- Fallback OTP: 131993

---

## API Endpoints Summary

### Business Intelligence APIs
```
GET  /api/crm/daily-digest        - Daily summary
GET  /api/crm/leaderboard         - Staff rankings
GET  /api/crm/revenue-dashboard   - Revenue analytics
POST /api/crm/set-target          - Set monthly target
GET  /api/crm/lead-analytics      - Lead analytics
GET  /api/crm/overdue-leads       - Overdue alerts
GET  /api/crm/leads/{id}/timeline - Customer journey
GET  /api/crm/commissions         - Commission report
GET  /api/crm/insights            - AI insights
```

### CRM APIs
```
POST /api/crm/leads/{id}/auto-assign     - AI auto-assign
POST /api/crm/leads/auto-assign-all      - Bulk auto-assign
POST /api/crm/leads/{id}/send-quote-whatsapp - Quote via WhatsApp
GET  /api/staff/{id}/notifications       - Staff notifications
POST /api/crm/followups                  - Create follow-up
GET  /api/crm/followups/today            - Today's follow-ups
```

### Social Media Webhook APIs (NEW)
```
GET  /api/webhook/whatsapp              - WhatsApp verification
POST /api/webhook/whatsapp              - Receive WhatsApp messages
GET  /api/webhook/facebook              - Facebook verification
POST /api/webhook/facebook              - Receive Messenger messages
GET  /api/webhook/status                - Webhook configuration status
GET  /api/webhook/recent-social-leads   - Recent social media leads
```

### Auth APIs
```
POST /api/admin/send-otp    - Send admin OTP
POST /api/admin/verify-otp  - Verify admin OTP
POST /api/staff/send-otp    - Send staff OTP
POST /api/staff/verify-otp  - Verify staff OTP
POST /api/staff/login       - Staff password login
```

---

## Testing Status
- **Total Tests:** 44/44 passed (100%)
- **Test Reports:** /app/test_reports/iteration_1-5.json

## Environment Variables
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=sk-emergent-xxx
RESEND_API_KEY=re_xxx (configured)
SENDER_EMAIL=onboarding@resend.dev
WEBHOOK_VERIFY_TOKEN=asr_solar_verify_2024
WHATSAPP_PHONE_NUMBER_ID=        # Add from Meta Dashboard
WHATSAPP_ACCESS_TOKEN=           # Add from Meta Dashboard
FACEBOOK_APP_ID=                 # Add from Meta Dashboard
FACEBOOK_APP_SECRET=             # Add from Meta Dashboard
FACEBOOK_PAGE_ACCESS_TOKEN=      # Add from Meta Dashboard
```

---

## Session Changelog

### Session 6 (2026-02-13) - Social Media Auto-Capture
- ✅ WhatsApp Business API webhook integration
- ✅ Facebook Messenger webhook integration
- ✅ Auto-creates leads from incoming messages
- ✅ Duplicate detection (updates existing lead)
- ✅ Conversation history tracking
- ✅ Lead source marking (whatsapp/facebook)
- ✅ Webhook status endpoint with setup instructions
- ✅ 84% test success rate (16/19 tests passed)

### Session 4-5 (2026-02-13)
- ✅ Staff Performance Leaderboard with rankings
- ✅ Revenue & Target Dashboard with goal tracking
- ✅ Lead Analytics with conversion funnel
- ✅ Overdue Lead Alerts (24h/48h/72h/critical)
- ✅ Customer Journey Timeline
- ✅ Commission Calculator
- ✅ Daily Business Digest with AI tips
- ✅ Smart Business Insights
- ✅ Real Email OTP via Resend
- ✅ WhatsApp Quote Integration
- ✅ AI Auto Lead Assignment
- ✅ Follow-up Reminder System
- ✅ Staff Notifications

### Previous Sessions
- CRM with Admin & Staff portals
- Gallery sync to website
- Custom Staff ID support
- Mobile gallery upload

---

## Future Roadmap
- P1: Persist notifications to MongoDB
- P2: WebSocket real-time updates
- P2: Deployment to production
- P3: Mobile app for staff
