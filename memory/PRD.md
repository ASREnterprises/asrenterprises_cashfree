# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, and AI-powered features.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay (payment link redirect)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key
- **Security:** Google reCAPTCHA v2, honeypot fields, security headers, 2FA OTP

## What's Been Implemented

### Website (Customer-Facing)
- Premium dark-blue corporate theme (full dark mode)
- Solar Calculator with ROI calculations
- Govt. News & Schemes page with AI auto-update
- ASR Solar Advisor registration form
- Google Review integration
- WhatsApp chat widget
- Gallery page (dark themed)
- Contact page (dark themed)
- Razorpay payment link integration

### Security Features (Feb 2026)
- Google reCAPTCHA v2 on inquiry form (site key: 6Ldpt2ssAAAAABvIQe10pOrMm8TuxVNGKQMZZv87)
- Honeypot anti-spam fields on forms
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy, COOP, CORP
- HTTPS force redirect
- Rate limiting on all endpoints
- Brute force protection on login
- Staff 2FA OTP login security
- Admin OTP login

### Private Messaging System
- End-to-end private messaging between admin and each staff member
- Staff can ONLY see their own conversation with admin
- Admin can delete messages

### CRM/Admin Panel
- Full leads management, staff management, task assignment
- Payment history tracking, photo gallery
- AI marketing tools
- Social media integration (backend ready)

### Staff Portal
- Dashboard, private chat with Admin, add/update leads
- Activity logging

### UI/Theme
- Full dark navy-blue theme across ALL pages
- "ASR ENTERPRISES" large amber/gold text in header
- "Trusted Solar Rooftop Installation Experts in Bihar" in GREEN
- Logo backgrounds match dark theme
- No white backgrounds remaining

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Pending/Upcoming Tasks
- P1: Configure Meta webhooks (WhatsApp/Facebook) - needs user credentials
- P2: Persist staff notifications in MongoDB
- P2: Refactor server.py into modular APIRouter files
- P2: Refactor CRMDashboard.js into smaller components
- P3: Deployment preparation
