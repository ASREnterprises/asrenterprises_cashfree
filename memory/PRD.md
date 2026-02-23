# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, AI-powered features, and full e-commerce system.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons + Shadcn/UI
- **Backend:** FastAPI (Python) - monolithic server.py
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay Checkout SDK (Live key: rzp_live_SJIqziW7w31a3U)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key (testimonials, lead analysis, chat, service descriptions)

## What's Been Implemented

### Feb 2026 - Latest Session

#### P0: Critical Fixes
- **Razorpay Live Key Updated** — Replaced payment link with Razorpay Checkout SDK, key served via `/api/shop/razorpay-config`
- **Payment Flow Fixed** — WhatsApp no longer auto-opens during payment. Razorpay modal opens inline. Order confirmation only on successful payment. Failed/cancelled payments mark order as cancelled.
- **"Goods once sold" notice removed** from checkout

#### P1: Core New Features
- **Customer Order Tracking** — New page at `/track-order` with order number + phone lookup, status timeline, order details
- **Admin Delete Orders** — Pending/cancelled orders can be deleted from Shop Management
- **Product Sharing** — WhatsApp, Facebook, Email, Copy Link sharing for every product (card + detail modal)
- **Pincode Delivery Check** — Bihar district-wise delivery availability check with estimated days, 50+ pincodes configured
- **AI Service Description** — Fixed LlmChat integration, generates real AI descriptions for service products

#### P2: Content/Config Updates
- **Installation → Solar Cleaning Service** — Default service type changed from Installation to Cleaning
- **Govt Schemes Removed** — Removed from navigation, homepage sections, and routes
- **Book Now → Solar Maintenance Service** — Updated CTA to link to shop with ₹1,500 pricing
- **Shop Opens in New Tab** — All shop navigation links use target="_blank"

#### P3: E-commerce UX Enhancements
- **Product Sorting** — Newest, Price Low-High, Price High-Low, Name A-Z
- **Recently Viewed Products** — Shows last 8 viewed products, persisted in localStorage
- **Related Products** — Shown in product detail modal (same category)
- **Product Count Display** — Shows filtered product count
- **Responsive 2-col mobile grid** — Better mobile shopping experience

### Previously Implemented
- Full e-commerce: Shop, Cart, Checkout, Orders, WhatsApp notifications
- Dynamic product forms: Wire (AC/DC, 4sqmm/6sqmm), Service (cleaning, maintenance, repair, consultation)
- Product detail modal with image gallery
- Distance-based delivery fees
- CRM with leads, staff, tasks, payments, gallery, messages
- Staff 2FA OTP login, private messaging
- AI-powered testimonials
- Premium dark navy-blue theme
- Code splitting with React.lazy()

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Key API Endpoints
- `GET /api/shop/razorpay-config` - Razorpay key for frontend
- `GET /api/shop/check-delivery/{pincode}` - Pincode delivery check
- `POST /api/shop/track-order` - Track order by number + phone
- `DELETE /api/shop/orders/{id}` - Delete pending/cancelled orders
- `POST /api/generate-service-description` - AI service descriptions
- `GET,POST,PUT,DELETE /api/shop/products` - Product CRUD
- `GET,POST /api/shop/orders` - Order management
- `POST /api/shop/orders/{id}/payment-verify` - Razorpay verification

## Pending Tasks
- **P2:** Finalize Deployment & Webhook Configuration (user action needed)
- **P3:** Re-enable Google reCAPTCHA (post-deployment, needs production keys)
- **P3:** Live Google Reviews (pending user clarification)
- **P3:** Refactor server.py into modular APIRouter files
- **P3:** Refactor ProductManagement.js into smaller components
- **P3:** Refactor Shop.js into sub-components
- **P3:** Persist Staff Notifications in MongoDB
