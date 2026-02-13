# ASR Enterprises Solar Website - Product Requirements Document

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" - a solar energy business in Patna, Bihar with AI-powered features, admin panel, and comprehensive CRM system for managing leads, staff, and business operations.

## Company Information
- **Name:** ASR Enterprises
- **Location:** Patna, Bihar (Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503)
- **GSTIN:** 10CCFPK3447Q3ZD
- **Phone:** 8877896889
- **Email:** asrenterprisespatna@gmail.com
- **Facebook:** https://www.facebook.com/share/1876swUqxu/
- **Instagram:** @asr_enterprises_patna

## Test Credentials
- **Admin Login:** asrenterprisespatna@gmail.com (OTP: 131993 - fallback when RESEND_API_KEY not set)
- **Staff Login:** ASR1001 / asr@123 (Password) OR via Email OTP

## Implemented Features (100% Complete)

### Homepage Features
1. Running Flash Advertisement Banner
2. Trust badges (MNRE Registered, PM Surya Ghar Partner)
3. Solar Brands Section (TATA, Adani, Luminous, Loom, Waaree, Vikram)
4. **Solar Inquiry Form** - Auto-creates CRM Lead
5. **Festive Banner** - Auto-displays active festival posts
6. Login button in navigation

### CRM System - Complete Feature List

#### Admin CRM (/admin/crm)
1. **Dashboard** with pipeline overview and stats
2. **Lead Management**
   - View all leads with filters
   - Update lead stage
   - **AI Auto-Assign** (single lead or bulk)
   - **Send Quote via WhatsApp** - Generates pre-filled quote message
   - WhatsApp/Call customers directly
   - Forward leads to staff via WhatsApp
3. **Staff (Team) Management**
   - Create staff with **Custom Staff ID**
   - Edit/Deactivate/Delete staff
   - Password reset
4. **Task Management** - Assign tasks to staff
5. **Messages** - Internal messaging
6. **Gallery** - Upload work photos (syncs to website)
7. **Projects** - Track installations
8. **Payments** - Payment tracking

#### Staff Portal (/staff/portal)
1. **Dashboard** with assigned leads and tasks
2. **My Leads** - View and update assigned leads
3. **Follow-ups** - Manage follow-up reminders
4. **Tasks** - Today's tasks
5. **Messages** - Internal messaging
6. **Notifications** - Bell icon with dropdown showing:
   - New lead assignments
   - Follow-up reminders
   - Unread count badge

### NEW FEATURES (Session 4 - 2026-02-12)

#### 1. WhatsApp Web URL Integration ✅
- **Send Quote via WhatsApp**: Pre-filled message with system size, cost, subsidy, EMI
- **Forward Lead to Staff**: Notify staff about new assignments
- **Customer Follow-up**: Quick WhatsApp message to customers
- **Endpoint**: `POST /api/crm/leads/{lead_id}/send-quote-whatsapp`

#### 2. AI-Powered Auto Lead Assignment ✅
- **Strategy**: Location-based (checks staff districts) → Round-robin (least leads)
- **Single Lead**: `POST /api/crm/leads/{lead_id}/auto-assign`
- **Bulk All**: `POST /api/crm/leads/auto-assign-all`
- **UI Button**: "AI Auto-Assign All" on CRM Leads tab
- **Notifications**: Auto-sends in-app + WhatsApp notification to assigned staff

#### 3. Follow-up Reminder System ✅
- **Create Follow-up**: With notification to staff
- **Today's Follow-ups**: `GET /api/crm/followups/today`
- **WhatsApp URLs**: staff_whatsapp_url (reminder) + customer_whatsapp_url (follow-up message)
- **In-app Notifications**: Bell icon in Staff Portal

#### 4. Real Email OTP for Login ✅
- **Admin OTP**: `POST /api/admin/send-otp` → Email via Resend
- **Staff OTP**: `POST /api/staff/send-otp` → Email via Resend
- **Fallback**: OTP 131993 works when RESEND_API_KEY not configured
- **Staff Login UI**: Toggle between Password and Email OTP

## Data Models
- **Lead:** {name, email, phone, district, status, lead_score, ai_analysis}
- **CRMLead:** {name, email, phone, district, stage, assigned_to, ai_priority, source}
- **CRMStaffAccount:** {staff_id, password_hash, name, email, phone, role, districts, leads_assigned}
- **CRMFollowUp:** {lead_id, employee_id, reminder_date, reminder_time, status}
- **Notification:** {id, type, title, message, lead_id, is_read, timestamp} (in-memory)

## Key API Endpoints

### Public
- `GET /api/photos` - Gallery photos
- `GET /api/festivals/active` - Active festive banner
- `POST /api/leads` - Submit inquiry (auto-creates CRM lead)

### Admin Auth
- `POST /api/admin/send-otp` - Send OTP email (returns email_sent status)
- `POST /api/admin/verify-otp` - Verify OTP

### Staff Auth
- `POST /api/staff/register` - Create staff (supports custom_staff_id)
- `POST /api/staff/login` - Password login
- `POST /api/staff/send-otp` - Send OTP to staff email
- `POST /api/staff/verify-otp` - Verify staff OTP

### CRM - Lead Assignment
- `POST /api/crm/leads/{id}/assign` - Manual assign with WhatsApp notification
- `POST /api/crm/leads/{id}/auto-assign` - AI auto-assign
- `POST /api/crm/leads/auto-assign-all` - Bulk auto-assign

### CRM - WhatsApp Integration
- `POST /api/crm/leads/{id}/send-quote-whatsapp` - Generate quote WhatsApp URL

### CRM - Notifications
- `GET /api/staff/{staff_id}/notifications` - Get notifications
- `PUT /api/staff/{staff_id}/notifications/{id}/read` - Mark read
- `PUT /api/staff/{staff_id}/notifications/read-all` - Mark all read

### CRM - Follow-ups
- `POST /api/crm/followups` - Create with notification
- `GET /api/crm/followups/today` - Today's with WhatsApp URLs

## Environment Variables
```
# Backend (.env)
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
EMERGENT_LLM_KEY=sk-emergent-xxx
RESEND_API_KEY=re_xxx (optional - falls back to 131993)
SENDER_EMAIL=onboarding@resend.dev
```

## Testing Status
- **Backend Tests:** 100% (24/24 passed - iteration_4)
- **Frontend Tests:** 100% (all features verified)
- **Test Reports:** /app/test_reports/iteration_4.json

## Known Limitations
1. **Email OTP**: Requires RESEND_API_KEY - falls back to 131993 if not configured
2. **Notifications**: Stored in-memory, reset on server restart (not persisted to MongoDB)
3. **WhatsApp**: Uses wa.me URLs (opens WhatsApp Web) - not true API integration

## Future Enhancements (Backlog)
- **P1: Persist Notifications**: Store in MongoDB for persistence
- **P2: Deployment**: Deploy to www.asrenterprisespatna.com
- **P2: WhatsApp Business API**: Direct messaging (requires Meta approval)
- **P3: Real-time Updates**: WebSocket for live notifications
- **P3: Mobile App**: React Native staff app

## Changelog
- **2026-02-12 (Session 4):**
  - WhatsApp Web URL integration for quotes
  - AI auto lead assignment (location + round-robin)
  - Follow-up reminder system with notifications
  - Real email OTP with Resend (fallback 131993)
  - Staff Portal notification bell with dropdown
- **2026-02-12 (Session 3):** Gallery Sync, Custom Staff ID, Auto-CRM Lead
- **2026-02-12 (Session 2):** Login button, ASR logo, Gallery tab
- **2026-02-12 (Session 1):** CRM with Admin and Staff portals
