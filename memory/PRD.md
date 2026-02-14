# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, and AI-powered features.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay (payment link redirect)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key
- **Security:** Google reCAPTCHA (invisible), honeypot fields, security headers, 2FA OTP

## Logo
- Original logo had white background
- Processed with Python PIL to replace white pixels with dark (#0a1628) background
- Stored at `/app/frontend/public/asr_logo_dark.png`
- Used across ALL pages: header, footer, calculator, admin login, staff login, CRM, staff portal

## What's Been Implemented
- Full dark navy-blue theme across ALL pages
- Premium header with large "ASR ENTERPRISES" and green subtitle
- Google reCAPTCHA invisible mode on inquiry form
- Security headers, honeypot, HTTPS force, rate limiting
- Staff 2FA OTP login (password + OTP, 131993 hidden from UI)
- Private messaging system (end-to-end per staff)
- Full CRM with leads, staff, tasks, payments, gallery, messages
- Staff portal with lead creation capability
- Brand logos enlarged with dark backgrounds

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Pending/Upcoming Tasks
- P1: Configure Meta webhooks (WhatsApp/Facebook)
- P1: Verify reCAPTCHA key type in Google admin console
- P2: Persist staff notifications in MongoDB
- P2: Refactor server.py into modular APIRouter files
- P2: Refactor CRMDashboard.js into smaller components
- P3: Deployment preparation
