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

#### Customer Reviews & Ratings
- **Star rating system** on every product card (1-5 stars with review count)
- **Review form** in product detail modal (name, star rating, title, review text)
- **Rating badge** in product detail (green badge with avg rating like Flipkart)
- **Reviews list** with customer avatars, timestamps, individual ratings
- Backend: `GET/POST /api/shop/products/{id}/reviews`, `GET /api/shop/reviews/summary`
- MongoDB collection: `product_reviews`

#### Bug Fixes
- **"Become an ASR Solar Advisor"** — Route `/become-agent` restored
- **Track Order "Back to Shop"** — Fixed: no longer opens new tab, navigates in same tab
- **Payment Flow** — WhatsApp no longer auto-opens. Failed payments cancel orders.
- **Service product images** — Admin can now upload images for service products (was hidden)

#### ASR Logo on Shop
- **Transparent ASR logo** (`asr_logo_transparent.png`) in shop header next to "ASR Solar Shop"

#### Delivery Fee Display
- **Pincode results** in header and product detail now explicitly show: `Delivery Fee: ₹{amount}`
- Per-product delivery check also shows fee: `₹{fee} ({days} days)`

#### Book Service Feature
- **"Book Service" button** on homepage opens Razorpay directly (online-only)
- **Admin-configurable price** via Shop Management
- **WhatsApp + Email confirmations** sent to customer after successful payment

#### Unified Payment Notifications (Feb 23, 2026)
- **Shop order payments** now trigger both WhatsApp AND email confirmations
- Email template includes: order number, items table, amount paid, payment ID, delivery details
- Backend endpoint `/api/shop/orders/{order_id}/payment-verify` returns `email_sent` field
- Consistent notification experience across all payment types (Book Service + Shop Orders)

#### Premium Shop UI (Flipkart/Amazon-style)
- White/light product grid, sticky header + search, category strip
- Product cards: wishlist hearts, share, quantity controls, discount badges, star ratings
- Product detail: image gallery, pincode check, reviews, related products
- Trust badges, promo banner, recently viewed products

#### Per-Product Delivery by Pincode
- 37 Bihar districts with distance-based fees (₹50-₹350)
- Admin sets delivery districts per product (checkbox grid)
- Customer checks via pincode in header & product detail

#### Content Updates
- Installation→Solar Cleaning Service, Govt Schemes removed
- Shop links open in new tab, "Goods once sold" removed
- Order Tracking at `/track-order`, Product Sharing (WhatsApp/Facebook/Email/Copy)

### Previously Implemented
- Full CRM with leads, staff, tasks, payments, gallery, messages
- Staff 2FA OTP login, private messaging
- AI-powered testimonials & service descriptions (GPT-4o-mini)
- WhatsApp notifications for orders
- Admin order deletion (pending/cancelled)
- Premium dark navy-blue theme (main site)

## Key Credentials
- Admin: asrenterprisespatna@gmail.com / OTP: 131993
- Staff: ASR1001 / password: asr@123 / OTP: 131993

## Pending Tasks
- **P1:** Refactor server.py into modular APIRouter files (CRITICAL - file is very large)
- **P2:** Deployment & Webhook Configuration (user action)
- **P3:** Re-enable Google reCAPTCHA (post-deployment)
- **P3:** Live Google Reviews (pending user clarification)
- **P3:** Refactor large frontend components (Shop.js, ProductManagementPage.js)
