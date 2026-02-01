# ASR Enterprises Solar Website - Product Requirements Document

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" - a solar energy business in Patna, Bihar with AI-powered features, admin panel, and comprehensive business management.

## Company Information
- **Name:** ASR Enterprises
- **Location:** Patna, Bihar (Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503)
- **GSTIN:** 10CCFPK3447Q3ZD
- **Phone:** 8877896889
- **Email:** asrenterprisespatna@gmail.com
- **Admin Login:** asrenterprisespatna@gmail.com (OTP: 131993)

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

### ✅ Admin Dashboard (8 Modules)
1. **Leads Management** - View, filter, update status, WhatsApp integration
2. **Work Photos** - Upload/manage installation photos for gallery
3. **Customer Reviews** - Add/manage customer testimonials
4. **Festival Posts** - Create/edit/delete festival wishes (with templates)
5. **Govt News & Schemes** - AI auto-updates Bihar solar news
6. **Staff Management** - AI-powered with task assignment, attendance, performance analysis
7. **Security Center** - Website security status monitoring
8. **Analytics** - Business performance reports

### ✅ AI Features
- Lead scoring and analysis
- Recommended system size calculation
- WhatsApp chatbot
- Solar cost calculator
- Government news auto-refresh
- Staff performance analysis

### ✅ Security Features
- Rate limiting (100 req/min)
- Input sanitization (XSS/injection protection)
- Security headers (CORS, CSP, HSTS)
- Brute force protection (5 login attempts/5 min)
- OTP expiry (5 minutes)
- Constant-time comparison

## Quotation Rates
- TATA Power Solar: ₹68/W
- Adani Solar: ₹66/W
- Loom Solar: ₹64/W
- Luminous Solar: ₹66/W
- Waaree Solar: ₹65/W
- Vikram Solar: ₹67/W

## Technical Stack
- **Frontend:** React, Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **AI:** emergentintegrations with GPT-4o-mini

## Data Models
- Lead: {name, email, phone, district, property_type, roof_type, monthly_bill, roof_area, status, ai_analysis, lead_score}
- WorkPhoto: {title, description, image_url, location, system_size, category}
- CustomerReview: {customer_name, location, rating, review_text, system_installed}
- FestivalPost: {title, message, image_url, start_date, end_date, is_active}
- GovtNews: {title, summary, source, category, is_active}
- StaffMember: {name, email, phone, role, reportingTo, tasks_completed, performance_score, ai_insights}

## Changelog
- **2025-02-01:** Major update - Added 8 admin modules, solar inquiry form, AI security, removed quotation
- **2025-01-31:** Added brands section, admin login security, flash banner
- **2025-01-31:** Fixed preview error, implemented initial features

## Future Enhancements
- Real email OTP integration
- Deployment to www.asrenterprisespatna.com
- Real brand logo images
- SMS notifications for leads
