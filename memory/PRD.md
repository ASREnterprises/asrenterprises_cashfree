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
1. **ASR ENTERPRISES** branding in dark orange
2. Running Flash Advertisement Banner with WhatsApp integration
3. Trust badges (MNRE Registered, PM Surya Ghar Partner)
4. Solar Brands Section (TATA, Adani, Luminous, Loom, Waaree, Vikram)
5. **Solar Inquiry Form** with Bihar districts dropdown
6. AI-powered features section
7. Government schemes information (₹78,000 max subsidy)
8. 5-year FREE maintenance offers
9. **Login button** in navigation (links to Admin/Staff login)

### ✅ Admin Panel (10 Modules)
1. **CRM System** - Complete lead & sales management with ASR logo
2. **Leads Management** - View, filter, update status
3. **Work Photos** - Upload/manage installation photos
4. **Customer Reviews** - Add/manage testimonials
5. **Festival Posts** - Create/edit/delete festival wishes
6. **Govt News & Schemes** - AI auto-updates Bihar solar news
7. **Staff Management** - AI-powered performance analysis
8. **Social Media Hub** - AI-powered social media management
9. **Security Center** - Website security monitoring
10. **Analytics** - Business performance reports

### ✅ CRM System Features (with ASR Logo)
**Admin CRM (/admin/crm):**
- ASR Enterprises original logo in header
- View all leads with pipeline stages
- Assign leads to staff members
- Create staff accounts with unique IDs
- View reports and analytics
- Track payments and projects
- AI lead prioritization
- **Gallery Tab** - Upload work photos (auto-updates website gallery)

**Staff Portal (/staff/portal):**
- ASR Enterprises logo
- Unique Staff ID & password login
- View only assigned leads
- Update lead status
- Set follow-up reminders
- Survey status update
- WhatsApp integration

### ✅ Login Flow
- Homepage → "Login" button → Admin Login page
- Admin Login → Email OTP verification (131993)
- Admin Login → "Staff Login →" button → Staff Login page
- Staff Login → Staff ID + Password → Staff Portal

### ✅ Gallery Photo Upload (NEW)
- Admin can upload work photos via CRM → Gallery tab
- Photos auto-update on website gallery
- Fields: Title, Image URL, Location, System Size, Description
- Delete photos with confirmation

## Data Models
- **CRMLead:** {name, email, phone, district, stage, assigned_to, lead_score, ai_priority}
- **CRMStaffAccount:** {staff_id, password_hash, name, phone, role, leads_assigned, leads_converted}
- **CRMProject:** {customer_name, location, system_size, total_amount, installation_status}
- **CRMPayment:** {project_id, amount, payment_type, payment_mode, received_by}
- **WorkPhoto:** {title, image_url, location, system_size, description, category}

## API Endpoints
### Staff Authentication
- POST `/api/staff/register` - Create staff account
- POST `/api/staff/login` - Staff login
- GET `/api/staff/{staff_id}/dashboard` - Staff dashboard
- GET `/api/staff/{staff_id}/leads` - Staff assigned leads

### Gallery
- POST `/api/gallery/upload` - Upload photo to gallery
- GET `/api/admin/photos` - Get all gallery photos
- DELETE `/api/admin/photos/{id}` - Delete photo

## Changelog
- **2026-02-12:** Added Login button to homepage, ASR logo to CRM/Staff pages, Gallery tab for photo upload
- **2026-02-12:** Implemented CRM with separate Admin and Staff logins
- **2026-02-01:** Fixed Analytics page, Added Social Media Hub

## Test Credentials
- **Admin:** asrenterprisespatna@gmail.com / OTP: 131993 (MOCKED)
- **Staff:** ASR1001 / asr@123

## Future Enhancements
- Real email OTP integration
- Deployment to www.asrenterprisespatna.com
- Direct file upload (currently uses image URLs)
- WhatsApp Business API integration
