# ASR Enterprises - Solar Business Website PRD

## Original Problem Statement
Build a feature-rich website for "ASR Enterprises" solar energy business with customer-facing website, admin/CRM panel, AI-powered features, and full e-commerce system.

## Core Architecture
- **Frontend:** React + Tailwind CSS + Lucide React icons
- **Backend:** FastAPI (Python) - monolithic server.py  
- **Database:** MongoDB (Motor async driver)
- **Payments:** Razorpay Checkout SDK (Live key: rzp_live_SJIqziW7w31a3U)
- **AI:** OpenAI GPT-4o-mini via Emergent LLM Key

## What's Been Implemented

### Latest Session (Feb 2026)

#### Bug Fixes
- **Become an ASR Solar Advisor** — Route `/become-agent` restored (was accidentally removed)
- **Payment Flow** — WhatsApp no longer auto-opens. Failed payments cancel orders. Success only on completion.

#### Book Service Feature
- **"Book Service" button** on homepage opens Razorpay payment directly (online payment only)
- **Admin-configurable price** via Shop Management → Book Service Price section
- Backend endpoints: `GET/PUT /api/shop/book-service-config`

#### Premium Shop UI (Flipkart/Amazon-style)
- **White/light background** product grid like e-commerce leaders
- **Sticky header** with search bar, Track Order, Cart
- **Category navigation strip** below header
- **Promo banner** with trust badges (Free Pickup, Quality Guaranteed, Secure Payments)
- **Product cards** with wishlist hearts, share buttons, quantity controls, discount badges
- **Product detail modal** with image gallery, pincode delivery check, share options, related products
- **Trust badges section** at bottom (Genuine Products, Bihar Delivery, Secure Payment, Expert Support)
- **Recently viewed products** with localStorage persistence

#### Per-Product Delivery by Pincode
- **37 Bihar districts** with distance-based delivery fees (₹50 Patna → ₹350 remote)
- **Customer pincode check** in header and product detail modal
- **Product-specific delivery** — Admin sets which districts each product delivers to
- Backend: `GET /api/shop/bihar-districts`, `GET /api/shop/products/{id}/check-delivery/{pincode}`

#### Admin Enhancements
- **Delivery district config** per product (checkbox grid of Bihar districts)
- **Delete orders** (pending/cancelled only)
- **Book Service Price** management in Shop Management

#### Content Updates
- Installation Service → **Solar Cleaning Service**
- Govt Schemes **removed** from site
- Book Now → **Book Service** (direct Razorpay payment)
- Shop links open in **new tab**
- "Goods once sold" notice **removed**
- **Order Tracking** page at `/track-order`
- **Product Sharing** (WhatsApp, Facebook, Email, Copy Link)
- **Product Sorting** (Relevance, Newest, Price, Name)

### Previously Implemented
- Full CRM with leads, staff, tasks, payments, gallery, messages
- Staff 2FA OTP login, private messaging
- AI-powered testimonials (GPT-4o-mini)
- WhatsApp notifications for orders
- Premium dark navy-blue theme (main site)
- Code splitting with React.lazy()

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Pending Tasks
- **P2:** Finalize Deployment & Webhook Configuration (user action)
- **P3:** Re-enable Google reCAPTCHA (post-deployment)
- **P3:** Live Google Reviews (pending user clarification)
- **P3:** Refactor server.py into modular APIRouter files
- **P3:** Refactor ProductManagement.js & Shop.js into sub-components
- **P3:** Persist Staff Notifications in MongoDB
