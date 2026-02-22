# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, AI-powered features, and e-commerce system.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay (payment link redirect)
- **AI:** OpenAI GPT-4o via Emergent LLM Key (for testimonials, lead analysis, chat)
- **Security:** Honeypot fields, security headers, 2FA OTP (reCAPTCHA disabled for preview)

## Logo
- Original logo had white background
- Processed with Python PIL to replace white pixels with dark (#0a1628) background
- Stored at `/app/frontend/public/asr_logo_dark.png`
- Used across ALL pages: header, footer, calculator, admin login, staff login, CRM, staff portal, contact, gallery

## What's Been Implemented

### E-commerce Shop System (February 2026) ✅ NEW
- **Shop page** at `/shop` with product catalog, category filtering, search
- **Product categories:** Solar Panels, Inverters, Batteries, **Solar Wire (AC/DC, 4sqmm/6sqmm)**, Accessories, Services (₹1,500 base)
- **Product Detail Modal:** Click product image or "Details" button to view:
  - Full product info (name, price, description, stock, category badge)
  - **Image gallery** with navigation arrows and thumbnails
  - Delivery options (Home Delivery, Store Pickup)
  - "View Details" overlay on hover
  - Add to Cart from modal
- **Shopping cart** with localStorage persistence, quantity controls
- **Checkout flow:**
  - Customer details (name, phone, email)
  - Delivery options: Store Pickup (FREE) or Home Delivery (**distance-based fee**: ₹50-₹300)
  - Payment methods: Cash on Delivery/Store, Razorpay online payment
  - **No Return Policy notice:** "Goods once sold cannot be taken back"
- **WhatsApp notifications:** 
  - Admin notification: Auto-generated WhatsApp message URL for admin (8877896889) on every order
  - **Customer confirmation:** Order confirmation sent to customer's phone via WhatsApp after checkout
  - Payment confirmation sent to customer after successful Razorpay payment
- **CRM notifications:** Order alerts posted to CRM messages
- **Shop Management moved to Admin Dashboard:** Full product and order management at `/admin/shop`
  - Products tab: Add, edit, delete products with **mobile image upload**
  - Orders tab: View all orders, update status
  - Shop stats dashboard
- **Auto Payment Recording:** Razorpay payments auto-create records in CRM Payments; COD payments manual
- **APIs:**
  - `GET/POST/PUT/DELETE /api/shop/products` - Full CRUD
  - `POST /api/shop/products/{id}/upload-image` - Mobile image upload
  - `GET/POST /api/shop/orders` - Order management
  - `PUT /api/shop/orders/{id}/status` - Update order status
  - `POST /api/shop/orders/{id}/payment-verify` - Razorpay payment confirmation + auto payment record
  - `GET /api/shop/stats` - Shop analytics
  - `GET /api/shop/categories` - Category list with Wire
  - `GET /api/shop/delivery-fees` - Distance-based delivery fee structure

### Core Features (Previously Implemented)
- Full dark navy-blue theme across ALL pages
- Premium header with large "ASR ENTERPRISES" and green subtitle
- Honeypot spam protection on inquiry form (reCAPTCHA disabled for preview domain)
- Security headers, HTTPS force, rate limiting
- Staff 2FA OTP login (password + OTP, 131993 hidden from UI)
- Private messaging system (end-to-end per staff)
- Full CRM with leads, staff, tasks, payments, gallery, messages
- Staff portal with lead creation capability
- Brand logos enlarged with dark backgrounds

### AI-Powered Testimonials (December 2025)
- **POST /api/crm/generate-testimonial** generates unique AI testimonials
- Uses GPT-4o via Emergent LLM integration
- Each testimonial is unique, mentioning customer details (name, location, savings)
- Falls back to templates if AI unavailable

### Performance Optimizations (December 2025)
- **React.lazy() code splitting** - 24 components lazy-loaded on demand (including ShopPage)
- **Suspense wrapper** with PageLoader fallback for smooth UX
- **asyncio.gather** parallel DB queries in 3 major endpoints

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Sample Products (Pre-seeded)
1. Loom Solar 400W Mono Panel - ₹15,500
2. Luminous 3kVA Solar Inverter - ₹42,000
3. Exide 150Ah Solar Battery - ₹18,500
4. MC4 Connector Set - ₹450

## Pending/Upcoming Tasks
- P1: Add product images to shop items (currently showing placeholders)
- P1: Configure Meta webhooks (WhatsApp/Facebook) - needs user credentials
- P1: Add valid reCAPTCHA keys for production domain (currently disabled for preview)
- P2: Persist staff notifications in MongoDB
- P2: Refactor server.py into modular APIRouter files
- P2: Refactor CRMDashboard.js into smaller components
- P3: Deployment preparation
