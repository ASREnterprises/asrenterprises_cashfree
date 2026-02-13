# ASR Enterprises - Solar Business Platform

## Original Problem Statement
Build a feature-rich website for ASR Enterprises solar energy business including:
- Customer-facing website with inquiry forms
- Comprehensive admin/CRM panel
- AI-powered features for lead management
- Payment integration for service registration

## Core Requirements
1. **Customer Website:** Homepage, gallery, calculator, contact forms
2. **CRM Dashboard:** Lead management, staff management, task tracking
3. **Payment System:** Service registration with fee payment
4. **Social Media Integration:** WhatsApp/Facebook lead capture

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
- Lead creation from registrations

### Phase 4: Social Media Integration (Infra Complete)
- WhatsApp webhook endpoint ready
- Facebook Messenger webhook endpoint ready
- Bulk CSV lead import
- Quick Add lead modal
- Fetch Social Leads button
**Status:** Awaiting Meta credentials to activate

## Bug Fixes Applied (Feb 2025)
- [FIXED] Mobile photo upload only opening camera - removed `capture` attribute
- [FIXED] Stripe to Razorpay payment gateway replacement

## Pending Tasks

### P0 - Critical
- None currently

### P1 - High Priority
- Verify Quick Add lead form simplicity
- Test mobile photo upload on actual device

### P2 - Medium Priority
- Configure Meta credentials for social lead capture
- Persist staff notifications in MongoDB
- Add domain to Resend for OTP emails

### P3 - Low Priority (Refactoring)
- Break server.py into modular routers (crm_routes, auth_routes, payment_routes)
- Refactor CRMDashboard.js into smaller components
- Organize App.js routing

## Key API Endpoints
- `POST /api/registration/save-details` - Save registration before Razorpay redirect
- `GET /api/registration/fee` - Get current registration fee
- `POST /api/registration/update-fee` - Admin update fee
- `POST /api/crm/leads` - Create new lead
- `POST /api/crm/leads/bulk` - Bulk CSV import
- `POST /api/webhooks/whatsapp` - WhatsApp lead capture
- `POST /api/webhooks/facebook` - Facebook lead capture

## Credentials
- **Admin:** asrenterprisespatna@gmail.com (OTP: 131993 fallback)
- **Staff:** ASR1001 / asr@123

## Files Reference
- `/app/backend/server.py` - Monolithic backend (needs refactoring)
- `/app/frontend/src/components/CRMDashboard.js` - CRM interface
- `/app/frontend/src/App.js` - Main app with ServiceRegistration component
