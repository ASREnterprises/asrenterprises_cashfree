# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, AI-powered features, and e-commerce system.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay Checkout SDK (Live key: rzp_live_SJIqziW7w31a3U)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key (for testimonials, lead analysis, chat, service descriptions)
- **Security:** Honeypot fields, security headers, 2FA OTP (reCAPTCHA disabled for preview)

## Logo
- Stored at `/app/frontend/public/asr_logo_dark.png`
- Used across ALL pages

## What's Been Implemented

### Razorpay Live Integration (February 2026) - LATEST
- Replaced payment link approach with Razorpay Checkout SDK
- Live API key `rzp_live_SJIqziW7w31a3U` configured via backend .env
- Frontend fetches key from `/api/shop/razorpay-config` endpoint
- Checkout modal opens inline with prefilled customer details
- Payment verification via `/api/shop/orders/{id}/payment-verify`

### AI Service Description Generation Fix (February 2026) - LATEST
- Fixed LlmChat import and API usage (was using wrong parameters)
- Now correctly uses `.with_model("openai", "gpt-4o-mini").send_message(UserMessage(text=...))`
- Returns AI-generated descriptions with `generated: true` flag

### E-commerce Shop System (February 2026)
- **Shop page** at `/shop` with product catalog, category filtering, search
- **Product categories:** Solar Panels, Inverters, Batteries, Solar Wire (AC/DC, 4sqmm/6sqmm), Accessories, Services (base price 1500)
- **Product Detail Modal:** Full product info, image gallery, delivery options
- **Shopping cart** with localStorage persistence, quantity controls
- **Checkout flow:** Customer details, delivery options (distance-based fees), payment (COD/Razorpay)
- **No Return Policy notice:** "Goods once sold cannot be taken back"
- **WhatsApp notifications:** Admin + Customer confirmation
- **Shop Management at `/admin/shop`:** Full product and order CRUD
- **Dynamic Product Forms:** Wire Configuration (AC/DC, 4sqmm/6sqmm), Service Configuration (type + AI description)
- **Auto Payment Recording:** Razorpay payments auto-create CRM records

### Core Features (Previously Implemented)
- Full dark navy-blue theme
- Premium header with "ASR ENTERPRISES"
- Honeypot spam protection
- Security headers, HTTPS force, rate limiting
- Staff 2FA OTP login
- Private messaging system
- Full CRM with leads, staff, tasks, payments, gallery, messages
- Staff portal with lead creation
- AI-Powered Testimonials (GPT-4o)
- React.lazy() code splitting

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Key API Endpoints
- `GET /api/shop/razorpay-config` - Razorpay key for frontend
- `POST /api/generate-service-description` - AI service descriptions
- `GET, POST, PUT, DELETE /api/shop/products` - Product CRUD
- `POST /api/shop/products/{id}/upload-image` - Image upload
- `GET, POST /api/shop/orders` - Order management
- `POST /api/shop/orders/{id}/payment-verify` - Razorpay verification
- `GET /api/shop/stats` - Shop analytics
- `GET /api/shop/categories` - Category list
- `GET /api/shop/delivery-fees` - Delivery fee structure

## Pending/Upcoming Tasks
- P2: Finalize Deployment & Webhook Configuration (user action needed)
- P3: Re-enable Google reCAPTCHA (post-deployment)
- P3: Live Google Reviews integration (pending user clarification)
- P3: Refactor server.py into modular APIRouter files
- P3: Refactor ProductManagement.js into smaller components
- P3: Refactor Shop.js into sub-components
- P3: Persist Staff Notifications in MongoDB
