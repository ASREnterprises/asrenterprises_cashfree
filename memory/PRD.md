# ASR Enterprises - Solar Business Platform PRD

## Original Problem Statement
Build a feature-rich website for ASR Enterprises solar energy business including:
- Customer-facing website with inquiry forms
- Comprehensive admin/CRM panel
- AI-powered features for lead management
- Payment integration for service registration
- Agent/Referral program management

## Tech Stack
- **Frontend:** React, React Router, Tailwind CSS, Axios
- **Backend:** FastAPI (Python), Pydantic
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay (payment link redirect)
- **AI:** OpenAI GPT-4o (Emergent LLM Key)
- **Email:** Resend (OTP authentication)

## What's Been Implemented

### Phase 1: Core Platform (Complete)
- Homepage with hero section, services, testimonials
- Solar calculator with savings estimation
- Gallery page with project photos
- Contact form with lead capture
- Admin login with OTP authentication
- Staff login with password authentication

### Phase 2: CRM System (Complete)
- Lead management with pipeline stages
- Staff account management
- Task assignment and tracking
- Activity logging
- Multiple photo upload to gallery
- AI-powered lead scoring and suggestions

### Phase 3: Payment Integration (Complete - Feb 2025)
- Service registration form at /register
- Razorpay payment link integration (https://razorpay.me/@asrenterprises9465)
- Admin configurable registration fee
- **NEW: Mark as Paid feature** for admin to confirm Razorpay payments

### Phase 4: Social Media Integration (Infra Complete)
- WhatsApp webhook endpoint ready
- Facebook Messenger webhook endpoint ready
- Bulk CSV lead import
- Quick Add lead modal
- Fetch Social Leads button
**Status:** Awaiting Meta credentials to activate

### Phase 5: New Features (Completed - Feb 2025)
- **Edit/Delete Leads:** Full CRUD in Leads Management with CRM sync
- **Agent Registration:** Complete form with KYC (Aadhar, PAN) and bank details at /become-agent
- **Google Review:** Replaced WhatsApp link with Google Business review button (https://share.google/HWt7y6fPM2DbAZ085)
- **Solar Calculator Redesign:** Modern UI with ASR logo, PM Surya Ghar Partner badge
- **Govt News & Schemes:** Public page at /govt-schemes, admin-only delete access
- **Photo Upload Fix:** Removed camera-only restriction, gallery selection enabled

## Bug Fixes Applied (Feb 2025)
- [FIXED] Mobile photo upload only opening camera - removed `capture` attribute
- [FIXED] Stripe to Razorpay payment gateway replacement
- [FIXED] WhatsApp links replaced with proper alternatives (Google Review, Agent Form)

## Key API Endpoints

### Registration & Payments
- `POST /api/registration/save-details` - Save registration before Razorpay redirect
- `POST /api/admin/registrations/{id}/mark-paid` - Mark payment as confirmed
- `GET /api/registration/fee` - Get current registration fee
- `POST /api/registration/update-fee` - Admin update fee

### Leads Management
- `POST /api/leads` - Create new lead
- `PUT /api/admin/leads/{id}` - Edit lead (syncs both collections)
- `DELETE /api/admin/leads/{id}` - Delete lead (syncs both collections)
- `POST /api/crm/leads/bulk` - Bulk CSV import

### Agent Management
- `POST /api/agents/register` - Register new agent
- `GET /api/admin/agents` - Get all agents
- `PUT /api/admin/agents/{id}/status` - Update agent status

### Public APIs
- `GET /api/public/govt-news` - Public govt news (read-only)
- `POST /api/solar/calculate` - Solar savings calculator

## Pages & Routes

### Public Pages
- `/` - Homepage
- `/gallery` - Project gallery
- `/calculator` - Solar calculator (redesigned)
- `/govt-schemes` - Government news & schemes (NEW)
- `/become-agent` - Agent registration form (NEW)
- `/register` - Service registration with Razorpay
- `/contact` - Contact page

### Admin/Staff Pages
- `/admin/login` - Admin OTP login
- `/staff/login` - Staff password login
- `/admin/dashboard` - Main admin dashboard
- `/admin/leads` - Leads management (edit/delete)
- `/crm` - CRM dashboard (mark as paid)
- `/admin/govt-news` - Govt news management (admin delete)

## Credentials
- **Admin:** asrenterprisespatna@gmail.com (OTP: 131993 fallback)
- **Staff:** ASR1001 / asr@123

## Pending Tasks

### P2 - Medium Priority
- Configure Meta credentials for WhatsApp/Facebook lead auto-capture
- Add domain to Resend for OTP emails

### P3 - Low Priority (Refactoring)
- Break server.py into modular routers
- Refactor CRMDashboard.js into smaller components

## Test Reports
- `/app/test_reports/iteration_8.json` - Latest test (100% pass rate)

## File Structure
```
/app/
├── backend/
│   ├── server.py       # Main FastAPI application
│   ├── tests/          # Backend tests
│   └── .env
└── frontend/
    ├── src/
    │   ├── App.js                    # Main app with all routes
    │   ├── components/
    │   │   ├── CRMDashboard.js       # CRM with Mark as Paid
    │   │   ├── LeadsManagement.js    # Leads with Edit/Delete
    │   │   ├── Testimonials.js       # Google Review button
    │   │   └── GovtNewsManagement.js # Admin news management
    │   └── .env
    └── package.json
```
