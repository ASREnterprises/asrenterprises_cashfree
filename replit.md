# Project Overview

ASR Enterprises is a full-stack web application with a Create React App frontend in `frontend/` and a FastAPI backend in `backend/`.

# Replit Setup

- The development workflow is `Start application`.
- The React dev server runs on `0.0.0.0:5000` for the Replit preview.
- The FastAPI backend runs on `127.0.0.1:8000` and is reached through the React dev server `/api` proxy.
- `frontend/craco.config.js` allows all dev hosts and proxies `/api` to the backend.
- The imported backend originally expected MongoDB and a private `emergentintegrations` package. Replit setup adds:
  - `backend/db_client.py` to use in-memory Mongo compatibility when `USE_IN_MEMORY_MONGO=true`.
  - `backend/emergentintegrations/` as a compatibility shim so AI-dependent routes fail gracefully or return safe defaults without private packages.

# Dependencies

- Frontend dependencies are installed with npm and tracked in `frontend/package-lock.json`.
- Backend dependencies are tracked in `pyproject.toml`/`uv.lock` and include FastAPI, Uvicorn, Motor, and in-memory Mongo compatibility.

# Deployment

- Deployment is configured as autoscale.
- Build command: `cd frontend && npm install --no-audit --no-fund && npm run build`.
- Run command starts FastAPI on `0.0.0.0:${PORT:-5000}` and serves the compiled React app from `frontend/build`.
- Frontend production dependencies were aligned for normal npm install: React 18, React DOM 18, date-fns 3, ESLint 8, AJV 8.
- The public website theme uses a premium light solar palette with sunlit gold, solar-glass blue, emerald CTA accents, and visible solar-panel grid/array effects on the homepage hero and zero-bill section.
## April 19, 2026 — Login UX, Solar Hub Rename, Payment WhatsApp, Shop Fixes (Session 7)

### Login Pages — Back to Login
- Added "← Back to Login" button to all 4 login pages (Admin, Staff, Customer, Solar Advisor) pointing to `/login` (the LoginSelector).

### ASR Solar Hub Rename
- "ASR Solar Shop" renamed to "ASR Solar Hub" in Shop.js (navbar) and throughout server.py (notifications, CRM messages, order confirmations).

### WhatsApp Order Confirmation — Payment Verified First
- **Bug**: `create_order` was sending WhatsApp confirmation to customer immediately on order creation, before Cashfree payment was verified.
- **Fix**: WhatsApp is now sent **only for COD orders** at creation. For online payment orders, WhatsApp is triggered inside `verify_cashfree_shop_payment` only after Cashfree API confirms `order_status == "PAID"`.

### Service Booking Amount Fix
- **Bug**: `renderBookingsTable` in CRMDashboard.js displayed `b.amount` but solar_service_bookings documents use `price` field. All bookings showed ₹0.
- **Fix**: Changed to `b.price || b.amount || 0` with `toLocaleString('en-IN')` formatting.

### Shop Management — Settings Tab
- Removed `BookServiceConfig` and `DistrictFeesConfig` from always-visible area; moved into a new dedicated **Settings** tab.
- Settings tab contains: Book Service Price config + Delivery Fees by District editor.

### Shop Management — Add Product UX
- Added green success banner ("Product created successfully!") that auto-dismisses after 4 seconds on product create/update.
- Submit now uses `editingProduct` correctly to show "Product updated" vs "Product created".

## April 18, 2026 — Payment Routing Fix + Shop Management Overhaul (Session 6)

### Payment Order Routing Fix
- **Bug**: `_mark_order_paid` in `cashfree_orders.py` used `ptype or "site_visit"` as a fallback, causing solar-service payments (ptype="booking") to be stored with `booking_type="booking"` instead of `"book_solar_service"`. Frontend site-visit tab filtered by `booking_type=="site_visit"`, and solar-service tab had no exclusion.
- **Fix**: `booking_type` is now explicitly set: `"site_visit"` when ptype is `"site_visit"`, otherwise `"book_solar_service"` for all other payment types.
- **Fix**: `GET /service/bookings` now filters `{"booking_type": {"$ne": "site_visit"}}` to exclude site-visit records from the Solar Service tab.

### Shop Management — Product Form Overhaul
- **Bug fixed**: `handleSubmit` showed generic "Failed to save product" with no details; added name/price validation with clear error messages; API error detail is now surfaced to user.
- **Bug fixed**: `resetForm()` was missing `wire_type`, `wire_size`, `service_type` fields — form state was stale after reset.
- **Bug fixed**: `handleEdit()` was missing all new fields — editing a product lost wire/service/spec data.
- **Bulk image upload**: `handleImageUpload` now loops over `e.target.files` (multiple); file input has `multiple` attribute; upload button text updated to say "select multiple".
- **Enhanced product specs**: Added 5 new fields to backend `Product` model: `electrical_specs`, `mechanical_specs`, `warranty_info`, `shipping_info`, `product_highlights`.
- **New form sections** (shown for solar_panel/inverter/battery/accessory categories):
  - Product Highlights (textarea, one bullet per line)
  - Electrical Specifications (dynamic key-value table, new `SpecTableEditor` component)
  - Mechanical Specifications (same editor)
  - Warranty Information (same editor)
  - Shipping & Returns Info (textarea)

## April 18, 2026 — Critical DB Routing Fix + Campaign/Pagination (Session 5)

### Root Cause Fixed: All Routes Pointing to Wrong Database
- **Bug**: `whatsapp.py`, `social_media.py`, `cashfree_orders.py`, `payments.py`, `whatsapp_automation.py` all had `DB_NAME = os.environ.get("DB_NAME", "test_database")` — defaulting to a nonexistent `test_database` instead of the Atlas `asr_crm` database. This caused "No valid leads found" on every campaign attempt in production.
- **Fix**: Changed all 5 route files from `db = get_db(DB_NAME)` to `db = get_db()` which auto-uses `EFFECTIVE_DB_NAME` from `db_client.py` (correctly resolves to `asr_crm` when Atlas URI is set).
- **Pagination**: Backend `/leads/advanced` default changed from 50 to 250 to match frontend. All endpoints now consistently return 250 leads per page.
- **Trash/Bin**: Confirmed working — `GET /api/crm/leads/trash`, `POST /api/crm/leads/restore`, `POST /api/crm/leads/bulk-delete` (soft delete with 30-day TTL) all functional. Frontend shows Trash section under Lead Management tab.
- **5366 leads confirmed safe**: All bulk-imported leads are in Atlas `asr_crm.crm_leads` with proper UUID `id` fields.

## April 18, 2026 — Solar Mitra Complete AI Bot (Session 3)

### Architecture: Full Solar Mitra Intent Engine
- **Priority chain**: Menu options (1-7) → Solar Intent Layer → Welcome → AI fallback → no reply
- **Intent layer** (`detect_solar_intent`): handles price/subsidy/loan/installation with Hinglish templates — zero AI API cost
- **Bill extraction** (`extract_bill_smart`): context-aware (requires ₹ / "bill" / "monthly" signal to avoid false positives from kW numbers)
- **System sizing** (`estimate_solar_system`): Bihar market pricing table (1kW→10kW+) with govt subsidy per tier
- **Bill auto-save**: whenever bill is detected in ANY message, it's written to `crm_leads.monthly_bill` + `suggested_capacity`
- **AI System prompt**: full Solar Mitra spec — Bihar pricing, ROI, subsidy table, lead-capture goals, CTA rules
- **Admin stats**: 4-column Today Activity (Welcome / Menu / Intent / AI) in bot settings panel

### Modified files (Session 3)
- `backend/routes/whatsapp_automation.py` — Added `SOLAR_INTENT_KEYWORDS`, `SOLAR_SYSTEM_TABLE`, `detect_solar_intent()`, `estimate_solar_system()`, `extract_bill_smart()`, `build_solar_intent_reply()`; inserted intent layer in `process_auto_reply` between option detection and welcome logic
- `backend/routes/whatsapp_ai.py` — Upgraded `WHATSAPP_AI_SYSTEM_PROMPT` with full Solar Mitra spec (pricing, subsidy, ROI, lead-capture rules, CTA rules, system sizing guide)
- `backend/routes/whatsapp.py` — Added `intent_replies_sent` counter to bot status stats
- `frontend/src/components/WhatsAppCRM.js` — Bot Activity grid upgraded to 4 columns (Intent counter added, orange highlight)

## April 18, 2026 — WhatsApp AI Bot Automation (Session 2)

### Architecture: WhatsApp Automation + AI Fallback
- **Priority chain**: Keyword/menu matching (options 1-7) → AI fallback → no reply
- **AI fallback** triggers only when: welcome already sent + no keyword match
- **Spam filter**: noise messages (ok, 👍, ji, etc.) are silently skipped — no AI calls wasted
- **Human handover pause**: bot stops replying when `human_required=True` on lead document
- **Master switch**: `bot_enabled` flag in DB controls ALL auto-replies (welcome/menu/AI)
- **AI providers**: OpenAI GPT-4o-mini (primary) → Google Gemini Flash (fallback), both optional
- **Rate limit**: max 12 AI calls/hour/phone number enforced in memory

### New files
- `backend/routes/whatsapp_ai.py` — AI reply engine (OpenAI + Gemini, conversation history, noise filter, rate limit)

### Modified files
- `backend/routes/whatsapp_automation.py` — `process_auto_reply` now: (1) checks `bot_enabled` master switch at start, (2) at end runs AI fallback with noise/handover/rate-limit checks
- `backend/routes/whatsapp_automation.py` — `get_automation_settings` default settings now include `bot_enabled`, `ai_fallback_enabled`, `spam_filter_enabled`, `pause_bot_on_human_handover`; back-fills these fields into existing settings documents
- `backend/routes/whatsapp.py` — `/automation/bot/status` now returns `bot_enabled`, `ai_fallback_enabled`, `ai_providers` (OpenAI/Gemini configured?), `spam_filter_enabled`, `pause_bot_on_human_handover`, plus today's `ai_replies_sent` count
- `frontend/src/components/WhatsAppCRM.js` — Settings tab now has "AI Bot Settings" card with: AI provider status indicators, today's activity stats (welcome/menu/AI), 4 toggle switches (Master Bot, AI Fallback, Spam Filter, Human Handover Pause), how-it-works guide

### To enable AI replies
Set environment secret `OPENAI_API_KEY` (GPT-4o-mini) or `GEMINI_API_KEY` (Gemini Flash). The bot still sends keyword-matched menu replies without any AI key.

## April 18, 2026 — Leads Bin, 250/page, Soft-Delete & WhatsApp Cleanup

### Frontend changes
- **LeadsManagement.js**: Added "Leads Bin" tab — soft-deleted leads appear here with countdown timer (days remaining before permanent deletion). Restore button per lead. Bin count badge on tab.
- **LeadsManagement.js**: Leads fetch limit increased 100 → 250.
- **LeadsManagement.js**: Single delete and bulk delete now both soft-delete (move to Leads Bin) instead of permanent delete. Confirmation message updated accordingly.
- **StaffPortal.js**: Staff leads fetch limit increased 150 → 250.
- **WhatsAppInbox.js**: Template name display changed from `truncate` to `break-all` so full template name is visible in chat bubbles.

### Backend changes
- **server.py**: `GET /dashboard/widget/counts` and CRM stats endpoints now exclude `is_deleted=true` leads from all counts — dashboard numbers match only live (non-deleted) leads.
- **server.py**: Staff leads endpoint (`GET /staff/{staff_id}/leads`) now filters out `is_deleted=true` leads so deleted leads don't appear in staff portal.
- **server.py**: Daily cleanup scheduler now purges WhatsApp messages older than 24 hours from `whatsapp_messages` collection (keeps chat history lean, compliant with Meta 24h window policy).

---

## April 17, 2026 — HR / Cashfree CRM / WhatsApp Template Fixes

**Fixed 7 reported issues via 3 architectural changes:**

1. **Shared DB client singleton** (`db_client.py` + 5 route files + `server.py`) — Previously each route module called `AsyncIOMotorClient(MONGO_URL)` independently. Under `USE_IN_MEMORY_MONGO=true` (mongomock-motor), every call spins up its OWN isolated in-memory store, so Cashfree's `db.payments.update_one(...)` wrote into one store while the CRM "Cashfree Payments" page read from a different one. All routes now use `db_client.get_db()` which caches a single shared client. Fixes: Cashfree Payments not showing in CRM, any cross-module data invisibility.

2. **Anamika (ASR1002) seed — create-only** (`server.py:610-687`) — The seed block used to `update_one(...)` on every startup, force-overwriting any edits the Super Admin made via HR Management. Now it only inserts if the record is missing. Also fixed the default email typo (`analnikarathod1905` → `anamikarathod1905`) and corrected default phone (`9999900002` → `7903434221`). `ANAMIKA_PASSWORD` env still refreshes password hash for owner recovery, nothing else.

3. **Snapshot resurrection guard** (`db_client.py`) — Test staff `ASR1003` (Persistence Test) and `ASR1004` (Sales Test) were baked into `data/mongo_snapshot.json` and reappeared on every restart. Cleaned them out of the snapshot AND added `_BLOCKED_STAFF_IDS` filter inside `load_snapshot` so these IDs can never be restored even if they reappear in a future snapshot.

**WhatsApp template sync hardening** (`routes/whatsapp.py:420-560`)
- Only APPROVED templates from Meta are stored as active; any template that disappears from Meta is marked `is_active=False` and `meta_approved=False` (kept for history, but unusable).
- On Meta API failure the endpoint now returns `502` instead of silently overwriting the admin's curated table with hard-coded `DEFAULT_TEMPLATES`.
- Preserves the admin's `is_active` toggle on re-sync.

---

## 2026-04-17 — Stability + Automation Sweep (deployed)

### Backend additions
- **WhatsApp auto-retry** (`routes/cashfree_orders.py: retry_failed_whatsapp_messages`, `whatsapp_retry_loop`):
  - Real send retry (re-fires `send_whatsapp_template`) with exponential backoff (1, 2, 4 min) and max 3 attempts.
  - 60-second background task scheduled in `server.py` startup.
  - Rows missing `template_name` but with `order_id` are deferred to the cashfree reconcile loop instead of being permanently skipped.
- **Owner alert on payment** (`send_admin_payment_alert`, hooked into `_mark_order_paid`):
  - WhatsApp to ASR1001 owner phone (or `ADMIN_ALERT_PHONE` env override) on every successful Cashfree payment.
  - Atomic claim via insert + sparse unique index `whatsapp_messages.(order_id, type)` for `admin_payment_alert` — survives concurrent webhooks.
  - Failures are non-blocking and re-attempted by the WhatsApp retry loop.
- **CSV export endpoints**: `GET /api/payments/transactions/export.csv`, `GET /api/crm/leads/export.csv` (filters: status/source/from_date/to_date/search).
- **Revenue chart**: `GET /api/payments/revenue/chart?period=daily|weekly|monthly&days=N` returns aggregated paid-revenue time series.
- **HTML invoice**: `GET /api/payments/invoice/{order_id}` (printable, browser "Save as PDF"). All user-controlled fields are HTML-escaped to prevent XSS.

### Frontend additions
- **PaymentsDashboard**: date-range filter (from/to), Export CSV button, Revenue Trend bar chart (toggle Daily/Weekly/Monthly).
- **LeadsManagement**: Export CSV button next to existing Import CSV.

### Code-review hardening (architect FAIL → PASS)
- XSS in invoice fixed (every field run through `html.escape`).
- Admin-alert idempotency fixed via atomic claim + sparse unique index.
- Retry loop no longer drops text-fallback rows that have order context.

---

## 2026-04-17 — Production Security Hardening

### Headers (verified live in `/api/*` responses)
| Header | Value |
|---|---|
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload |
| Content-Security-Policy | locked to Cashfree, MSG91, Google (no Razorpay leftovers); `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `upgrade-insecure-requests` |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | geolocation=(), microphone=(), camera=() |
| Cross-Origin-Opener/Resource-Policy | same-origin / same-site |
| Server / X-Powered-By | **stripped** (uvicorn `--no-server-header` + middleware del) |

### Redirect / Transport
- `FORCE_HTTPS` env (defaults true in production) → real `RedirectResponse(301)` for any `X-Forwarded-Proto: http`. Skips `/api/health/live` for healthcheck-friendliness.
- `CANONICAL_HOST` env (e.g. `www.asrenterprises.in`) → 308 redirect for any non-API GET coming in on a different host. API + webhook paths are never redirected so payment provider POST bodies aren't lost.

### Open-redirect protection (Cashfree create-order)
- `origin_url` from the client is now host-checked against `ALLOWED_REDIRECT_HOSTS` (env, defaults to `asrenterprises.in,www.asrenterprises.in`; `*.replit.dev` for preview). Anything else falls back silently to `ASR_WEBSITE` and is logged. Verified: `https://evil.example.com` is rejected, `https://www.asrenterprises.in` is accepted.

### Existing controls (re-verified)
- Cashfree webhook HMAC-SHA256 signature verification + replay protection + idempotent processing.
- Rate limiting on auth (5/min), payment (10/min), OTP (5/min), admin (30/min) with IP block after 10 failed attempts.
- Input sanitization + suspicious-pattern auto-blocking (XSS, SQLi, NoSQL operators, path traversal).
- 10 MB request body cap; 50 MB upload cap; CORS env-driven and fail-fast against `*` in production.
- Mongo unique indexes for orders, staff, admin alerts; sparse indexes on emails / payment_id.
- Secrets fail-fast at startup if missing in production; never logged (mask helpers in `config.py`).
- HTML-escaping in invoice rendering (verified blocks `<script>` payload).

### Env vars added
- `FORCE_HTTPS` (true/false) — defaults true in prod, false in dev.
- `CANONICAL_HOST` — set to `www.asrenterprises.in` in production deploy.
- `ALLOWED_REDIRECT_HOSTS` — comma-separated allowlist for Cashfree `origin_url`.

### Post-architect-review hardening (2026-04-17 round 2)
- **CSP completed** — added the third-party scripts the React app actually loads (`assets.emergent.sh`, `connect.facebook.net`, `us.i.posthog.com` + `*.i.posthog.com`, `www.recaptcha.net`) to `script-src`/`connect-src`/`frame-src`, so production CSP no longer breaks PostHog analytics, Facebook Pixel, Emergent debug tooling, or Google reCAPTCHA xhr.
- **Open-redirect tightened** — `origin_url` validator now: HTTPS-only in production (no http downgrade), strict allowlist only (`*.replit.dev` fallback removed in production, kept in dev for preview), IDN/punycode-normalized host comparison (Cyrillic look-alikes blocked: `www.аsrenterprises.in` → rejected as `www.xn--srenterprises-v1k.in`), and rebuilds URL from sanitized `scheme + hostname` only (drops userinfo and arbitrary ports).
- **Canonical-host redirect skip-list** — extended from `/api/` to `/api/`, `/webhook`, `/cashfree` so Meta webhook verification GETs and Cashfree return URLs remain on whatever host they were called with.

## Sweep 2026-04-18 — UX polish + DNS docs + test-data cleanup

### New: cleanup endpoint for fake/test transactions
- `POST /api/cashfree/orders/cleanup-test-data` (in `backend/routes/cashfree_orders.py`).
  Soft-deletes orders matching ANY of: amount ≤ ₹5, customer name containing
  XSS markers (`<`, `>`, `script`, `javascript:`, `onerror`, `onload`), or
  pending/created status older than 48h. **Verified-paid orders (SUCCESS/PAID)
  are explicitly excluded.** Defaults to dry-run; pass `?confirm=true` to apply.
- Wired into Payments dashboard as "Cleanup Test Data" button (amber). Always
  shows a preview confirm dialog before deletion.

### Auto-logout: 10/30/15 → 60/60/30 min
- `frontend/src/hooks/useAutoLogout.js`. Old 10-min admin window was the most
  likely cause of "logged out on back button" complaints (browser back-nav does
  not fire mousemove/scroll, so the timer was already past expiry on restore).

### Lead-count "going to 0" fix
- `frontend/src/components/LeadsManagement.js`: on fetch failure we now KEEP
  the previously loaded list and show an amber error banner with a Refresh
  button, instead of silently `setLeads([])`. The "0 Total" the user was
  seeing was almost always a transient API failure, not a real data wipe.

### DNS / SSL setup (USER ACTION REQUIRED — agent cannot do this)
SSL is auto-issued and auto-renewed by Replit on the deployed domain, but only
after you point DNS correctly:

1. In your domain registrar (where you bought `asrenterprises.in`), add:
   ```
   Type   Host   Value             TTL
   A      @      34.111.179.208    3600
   A      www    34.111.179.208    3600
   ```
   (If a TXT verification record is shown in the Replit Deployments → Domains
   panel, copy it verbatim into a TXT record on `@`.)
2. In Replit → Deployments → Domains, add BOTH `asrenterprises.in` AND
   `www.asrenterprises.in`. Wait until both show "Verified" and "SSL Active"
   (usually 5–30 min, sometimes up to 24h for DNS to propagate).
3. After SSL is active, set these deployment **Secrets** (not dev secrets):
   - `FORCE_HTTPS=true`
   - `CANONICAL_HOST=www.asrenterprises.in`
   - `ALLOWED_REDIRECT_HOSTS=asrenterprises.in,www.asrenterprises.in`
4. Re-deploy. The `NET::ERR_CERT_COMMON_NAME_INVALID` will disappear once the
   cert covers both names AND the canonical-host redirect routes everything
   through `www.`.

### Known limitation (NOT changed in this round)
Admin/staff "auth" is a `localStorage` flag (`asrAdminAuth=true`) — anyone who
sets that key in devtools can access the admin UI. The only real protection is
that backend admin endpoints ARE rate-limited and the OTP flow is gated, but
direct API calls don't require an Authorization header. Migrating to real JWT +
backend `Depends(require_admin)` is a multi-day refactor touching every admin
route — flagged here so it's not forgotten.
