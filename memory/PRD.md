# ASR Enterprises Solar Website - Product Requirements Document

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" - a solar energy business in Patna, Bihar. The website should include AI-powered features, company branding, and an admin panel for business management.

## Company Information
- **Name:** ASR Enterprises
- **Location:** Patna, Bihar (Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503)
- **GSTIN:** 10CCFPK3447Q3ZD
- **Phone:** 8877896889
- **Email:** asrenterprisespatna@gmail.com
- **Social Media:** Instagram (@asr_enterprises_patna), Facebook

## User Personas
1. **Customers** - Homeowners/businesses seeking solar installation
2. **Admin/Manager** - Business owners managing leads and operations
3. **Staff** - Employees reporting to managers

## Core Requirements

### Phase 1: Core AI Features ✅ COMPLETED
1. ✅ AI WhatsApp Chatbot
2. ✅ AI Lead Capture Form
3. ✅ AI Solar Cost & Savings Calculator
4. ✅ AI Ads Optimization Dashboard (placeholder)

### Phase 2: Content and Branding ✅ COMPLETED
1. ✅ Company Information integration
2. ✅ Branding (logo, title, removed watermark)
3. ✅ Social Media links
4. ✅ Content Sections (About Us, Gallery, Testimonials, Government Schemes)
5. ✅ PM Surya Ghar Yojana info (max subsidy ₹78,000)
6. ✅ Easy EMI/Financing information
7. ✅ Residential and Commercial services
8. ✅ 25+ happy customers showcase

### Phase 3: Advanced Functionality 🔄 IN PROGRESS
1. 🔄 AI Marketing Automation Hub (UI created, backend pending)
2. 🔄 Admin Panel & Staff Management
   - Admin/Manager login with email OTP
   - Role-based access control
   - Staff management facility
3. 🔄 Solar Quotation System (brands: TATA Power Solar, Adani Power, Loom Solar, Luminous Solar, Waaree)
4. ⏳ Deployment to www.asrenterprisespatna.com

## Code Architecture
```
/app/
├── backend/
│   ├── server.py       # FastAPI application
│   └── .env            # Backend environment variables
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.js      # Main component with routing
    │   ├── components/
    │   │   ├── WhatsAppChat.js
    │   │   ├── Marketing.js
    │   │   ├── Ads.js
    │   │   ├── Dashboard.js
    │   │   ├── Gallery.js
    │   │   ├── Contact.js
    │   │   ├── Testimonials.js
    │   │   ├── AIMarketing.js
    │   │   ├── AdminLogin.js
    │   │   ├── AdminDashboard.js
    │   │   ├── StaffManagement.js
    │   │   └── QuotationSystem.js
    └── package.json
```

## Technical Stack
- **Frontend:** React, Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **AI:** emergentintegrations library with Emergent LLM Key

## Data Models
- Lead: {id, name, email, phone, details, source, status, created_at}
- SolarCalculation: {id, monthly_bill, system_capacity_kw, estimated_cost, monthly_savings, yearly_savings, breakeven_years, created_at}
- ChatMessage: {session_id, message, response, timestamp}
- Staff: {id, name, email, role ('manager' or 'staff'), manager_id}
- Quotation: {id, customer_name, system_capacity, brand, cost, created_by}

## Changelog
- **2025-01-31:** Added "Top Solar Brands We Offer" section (TATA, Adani, Luminous, Loom, Waaree, Vikram)
- **2025-01-31:** Secured admin access - only asrenterprisespatna@gmail.com can login
- **2025-01-31:** Removed Dashboard from public navigation, added Admin Login button
- **2025-01-31:** Fixed preview error (duplicate imports in AdminLogin.js)
- **Previous:** Implemented core AI features, website content, branding

## Backlog (P0/P1/P2)
### P0 - Critical
- Complete Admin Panel with OTP login
- Staff management functionality
- Quotation system

### P1 - High Priority
- AI Marketing Automation backend logic
- Real ads integration

### P2 - Nice to Have
- Deployment to custom domain
- Enhanced analytics
