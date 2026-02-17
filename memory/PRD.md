# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, and AI-powered features.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay (payment link redirect)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key
- **Security:** Honeypot fields, security headers, 2FA OTP (reCAPTCHA disabled for preview)

## Logo
- Original logo had white background
- Processed with Python PIL to replace white pixels with dark (#0a1628) background
- Stored at `/app/frontend/public/asr_logo_dark.png`
- Used across ALL pages: header, footer, calculator, admin login, staff login, CRM, staff portal

## What's Been Implemented
- Full dark navy-blue theme across ALL pages
- Premium header with large "ASR ENTERPRISES" and green subtitle
- Honeypot spam protection on inquiry form (reCAPTCHA disabled for preview domain)
- Security headers, HTTPS force, rate limiting
- Staff 2FA OTP login (password + OTP, 131993 hidden from UI)
- Private messaging system (end-to-end per staff)
- Full CRM with leads, staff, tasks, payments, gallery, messages
- Staff portal with lead creation capability
- Brand logos enlarged with dark backgrounds

### Performance Optimizations (December 2025)
- **React.lazy() code splitting** - 23 components lazy-loaded on demand
- **Suspense wrapper** with PageLoader fallback for smooth UX
- **asyncio.gather** parallel DB queries in 3 major endpoints:
  - `/api/crm/dashboard` - ~130ms response (was sequential)
  - `/api/dashboard/stats` - ~132ms response (was sequential)
  - `/api/admin/analytics` - ~178ms response (was sequential)
- **Memoization** added to TestimonialsTab component in CRMDashboard

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Pending/Upcoming Tasks
- P1: Configure Meta webhooks (WhatsApp/Facebook) - needs user credentials
- P1: Add valid reCAPTCHA keys for production domain (currently disabled for preview)
- P2: Persist staff notifications in MongoDB
- P2: Refactor server.py into modular APIRouter files
- P2: Refactor CRMDashboard.js into smaller components
- P3: Deployment preparation
