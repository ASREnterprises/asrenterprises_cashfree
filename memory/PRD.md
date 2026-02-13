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

## Authentication
- **Admin Login:** asrenterprisespatna@gmail.com (OTP: 131993 - MOCKED)
- **Staff Login:** Unique Staff IDs (ASR1001, ASR1002...) with passwords

## Implemented Features (100% Complete)

### Homepage Features
1. **ASR ENTERPRISES** branding in dark orange
2. Running Flash Advertisement Banner with WhatsApp integration
3. Trust badges (MNRE Registered, PM Surya Ghar Partner)
4. Solar Brands Section (TATA, Adani, Luminous, Loom, Waaree, Vikram)
5. **Solar Inquiry Form** with Bihar districts dropdown - Auto-creates CRM Lead
6. AI-powered features section
7. Government schemes information (₹78,000 max subsidy)
8. 5-year FREE maintenance offers
9. **Login button** in navigation
10. **Festive Banner** - Auto-displays active festival posts from admin panel

### Admin Panel (10 Modules)
1. **CRM System** - Complete lead & sales management
2. **Leads Management** - View, filter, update status
3. **Festival Posts** - Create/edit/delete festival wishes (auto-displays on homepage)
4. **Govt News & Schemes** - AI auto-updates Bihar solar news
5. **Social Media Hub** - AI-powered social media management
6. **Security Center** - Website security monitoring
7. **Analytics** - Business performance reports

### CRM System Features (Fully Integrated)
**Admin CRM (/admin/crm):**
- Dashboard with pipeline overview
- Lead management with stage tracking
- Staff account creation with **Custom Staff ID** support
- Lead assignment to staff
- Task management
- Messages/Communication
- **Gallery Tab** - Upload work photos (auto-syncs to website gallery)
- Projects tracking
- Payment management

**Staff Portal (/staff/portal):**
- Unique Staff ID & password login
- View assigned leads only
- Update lead status (Lead → Follow-up → Survey → Quotation → Installation → Completed)
- Set follow-up reminders
- WhatsApp integration

### Gallery Features (NEW - 2026-02-12)
- **Gallery Sync**: Photos uploaded in CRM Gallery → Auto-display on website /gallery page
- **Mobile Upload**: File input with `accept="image/*"` for direct mobile gallery/camera access
- **Refresh Button**: Users can refresh gallery to see latest uploads

### Lead Management Features (NEW - 2026-02-12)
- **Auto-CRM Lead Creation**: Website inquiry form submissions auto-create leads in CRM
- AI-powered lead scoring and prioritization
- Source tracking (website, WhatsApp, call, etc.)

### Staff Management Features (NEW - 2026-02-12)
- **Custom Staff ID**: Admin can specify custom Staff IDs (e.g., ASR2001)
- **Duplicate Detection**: System prevents duplicate Staff IDs
- Auto-prefix ASR if not provided
- Password reset capability

## Data Models
- **Lead:** {name, email, phone, district, status, lead_score, ai_analysis}
- **CRMLead:** {name, email, phone, district, stage, assigned_to, lead_score, ai_priority, source}
- **CRMStaffAccount:** {staff_id, password_hash, name, phone, role, leads_assigned, leads_converted}
- **WorkPhoto:** {title, image_url, location, system_size, description, category}
- **FestivalPost:** {title, message, image_url, start_date, end_date, is_active}

## API Endpoints
### Public
- `GET /api/photos` - Public gallery photos
- `GET /api/festivals/active` - Active festival banner
- `POST /api/leads` - Submit inquiry (auto-creates CRM lead)

### Admin
- `POST /api/admin/photos` - Upload photo to gallery
- `DELETE /api/admin/photos/{id}` - Delete photo
- `POST /api/admin/festivals` - Create festival post
- `GET /api/admin/staff-accounts` - List all staff

### Staff
- `POST /api/staff/register` - Create staff (supports custom_staff_id)
- `POST /api/staff/login` - Staff login
- `GET /api/staff/{staff_id}/leads` - Get assigned leads

## Test Credentials
- **Admin:** asrenterprisespatna@gmail.com / OTP: 131993 (MOCKED)
- **Staff:** ASR1001 / asr@123

## Changelog
- **2026-02-12 (Session 3):** 
  - Gallery Sync - CRM photos auto-display on website gallery
  - Custom Staff ID - Admin can specify custom IDs
  - Mobile Gallery Upload - accept="image/*" attribute
  - Auto-CRM Lead Creation - Website inquiries auto-create CRM leads
  - Festive Banner - Admin posts auto-flash on homepage
  - Facebook link updated to https://www.facebook.com/share/1876swUqxu/
- **2026-02-12 (Session 2):** Added Login button, ASR logo to CRM/Staff pages, Gallery tab
- **2026-02-12 (Session 1):** Implemented CRM with Admin and Staff logins
- **2026-02-01:** Fixed Analytics page, Added Social Media Hub

## Testing Status
- **Backend Tests:** 100% (12/12 passed)
- **Frontend Tests:** 100% (all features verified)
- **Test Reports:** /app/test_reports/iteration_3.json

## Future Enhancements (Backlog)
- **P1: WhatsApp Business API** - Send quotes/updates directly from CRM
- **P1: AI Lead Assignment** - Round-robin or location-based auto-assignment
- **P1: Follow-up Reminders** - Automatic reminder notifications
- **P2: Real Email OTP** - Replace mock OTP with production email service
- **P2: Performance Dashboard** - Employee performance tracking
- **P2: Deployment** - Deploy to www.asrenterprisespatna.com
- **P3: Direct File Upload** - Cloud storage for uploaded images

## Notes
- Admin OTP (131993) is MOCKED - not sent via real email
- AI content generation has fallback if LLM API fails
