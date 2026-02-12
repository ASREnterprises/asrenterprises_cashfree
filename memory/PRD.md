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

## Authentication
- **Admin Login:** asrenterprisespatna@gmail.com (OTP: 131993 - MOCKED)
- **Staff Login:** Unique Staff IDs (ASR1001, ASR1002...) with passwords

## Implemented Features

### ✅ Homepage Features
1. **ASR ENTERPRISES** branding in dark orange (larger size)
2. Running Flash Advertisement Banner with WhatsApp integration
3. Trust badges (MNRE Registered, PM Surya Ghar Partner)
4. Solar Brands Section (TATA, Adani, Luminous, Loom, Waaree, Vikram)
5. **Solar Inquiry Form** with Bihar districts dropdown
6. AI-powered features section
7. Government schemes information (₹78,000 max subsidy)
8. 5-year FREE maintenance offers
9. **No Admin Login button** in navigation (removed for security)

### ✅ Admin Dashboard (10 Modules)
1. **CRM System** - Complete lead & sales management
2. **Leads Management** - View, filter, update status, WhatsApp integration
3. **Work Photos** - Upload/manage installation photos for gallery
4. **Customer Reviews** - Add/manage customer testimonials
5. **Festival Posts** - Create/edit/delete festival wishes
6. **Govt News & Schemes** - AI auto-updates Bihar solar news
7. **Staff Management** - AI-powered performance analysis
8. **Social Media Hub** - AI-powered social media management
9. **Security Center** - Website security status monitoring
10. **Analytics** - Business performance reports

### ✅ CRM System Features (NEW)
**Admin CRM (/admin/crm):**
- View all leads with pipeline stages
- Assign leads to staff members
- Create staff accounts with unique IDs
- View reports and analytics
- Track payments and projects
- AI lead prioritization

**Staff Portal (/staff/portal):**
- Unique Staff ID & password login
- View only assigned leads
- Update lead status (New → Follow-up → Survey → Quotation → Installation → Completed)
- Set follow-up reminders
- Survey status update
- WhatsApp integration

### ✅ AI Features
- Lead scoring and analysis
- Lead prioritization recommendations
- Smart follow-up suggestions
- Social media post generation
- Government news auto-refresh
- Staff performance analysis

### ✅ Security Features
- Rate limiting (100 req/min)
- Input sanitization (XSS/injection protection)
- Security headers (CORS, CSP, HSTS)
- Brute force protection (5 login attempts/5 min)

## Data Models
- **CRMLead:** {name, email, phone, district, stage, assigned_to, lead_score, ai_priority, status_history}
- **CRMStaffAccount:** {staff_id, password_hash, name, phone, role, leads_assigned, leads_converted, total_revenue}
- **CRMProject:** {customer_name, location, system_size, total_amount, installation_status, progress}
- **CRMPayment:** {project_id, amount, payment_type, payment_mode, received_by}
- **CRMFollowUp:** {lead_id, employee_id, reminder_date, reminder_type, status}

## API Endpoints
### Staff Authentication
- POST `/api/staff/register` - Create staff account (admin only)
- POST `/api/staff/login` - Staff login with ID/password
- GET `/api/staff/{staff_id}/dashboard` - Staff dashboard data
- GET `/api/staff/{staff_id}/leads` - Staff assigned leads
- PUT `/api/staff/{staff_id}/leads/{lead_id}` - Update lead
- POST `/api/staff/{staff_id}/followups` - Create follow-up

### Admin CRM
- GET `/api/admin/staff-accounts` - All staff accounts
- POST `/api/crm/leads/{lead_id}/assign` - Assign lead to staff
- GET `/api/crm/dashboard` - CRM dashboard stats
- GET `/api/crm/reports/monthly` - Monthly business report

## Changelog
- **2026-02-12:** Implemented complete CRM system with separate Admin and Staff logins. Staff get unique IDs (ASR1001+). Removed Admin Login from homepage. Updated Facebook link.
- **2026-02-01:** Fixed Analytics page. Added Social Media Hub. Fixed LlmChat initialization.
- **2025-02-01:** Added 8 admin modules, solar inquiry form, AI security

## Test Credentials
- **Admin:** asrenterprisespatna@gmail.com / OTP: 131993 (MOCKED)
- **Staff:** ASR1001 / asr@123

## Future Enhancements
- Real email OTP integration
- Deployment to www.asrenterprisespatna.com
- Connect real social media accounts (Facebook API, Instagram API)
- SMS notifications for leads
- WhatsApp Business API integration
