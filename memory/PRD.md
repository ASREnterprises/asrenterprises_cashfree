# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, and AI-powered features.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay (payment link redirect)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key

## What's Been Implemented

### Website (Customer-Facing)
- Premium dark-blue corporate theme
- Solar Calculator with ROI calculations
- Govt. News & Schemes page with AI auto-update
- ASR Solar Advisor registration form
- Google Review integration
- WhatsApp chat widget
- Gallery page
- Contact page
- Razorpay payment link integration

### CRM/Admin Panel
- Full leads management (CRUD, pipeline stages, auto-assign, bulk import)
- Staff management (create, edit, delete, role-based)
- Task assignment system
- Follow-up scheduling
- Payment history tracking
- Photo gallery management
- AI marketing tools
- Social media integration (backend ready - needs Meta credentials)

### Private Messaging System (Feb 2026)
- End-to-end private messaging between admin and each staff member
- Staff can ONLY see their own conversation with admin
- No cross-staff message visibility
- Admin can delete messages
- Admin sees staff-wise conversation list

### Staff Portal
- Dashboard with assigned leads/tasks
- Private chat with Admin
- Add Lead capability (all roles including Telecallers)
- Lead update/follow-up tracking
- Activity logging

### Roles
- Admin, Manager, Sales Executive, Tele Caller, Technician

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / asr@123

## Completed Tasks (Latest Session - Feb 2026)
- [x] Fixed private messaging - each staff only sees own admin conversation
- [x] Added message delete functionality for admin
- [x] Added staff lead creation (POST /api/staff/{staff_id}/leads)
- [x] Updated header to premium dark-blue with larger ASR ENTERPRISES text
- [x] All login links open in new tabs

## Pending/Upcoming
- P1: Guide user on Meta webhook configuration (WhatsApp/Facebook)
- P2: Persist staff notifications in MongoDB
- P2: Refactor server.py into modular APIRouter files
- P2: Refactor CRMDashboard.js into smaller components
- P3: Deployment preparation
