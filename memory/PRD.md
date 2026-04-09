# ASR Enterprises Solar CRM - Product Requirements Document

## Original Problem Statement
Build a comprehensive Solar Business CRM with the following key features:
1. **WhatsApp API Integration**: Route all website WhatsApp buttons to the API number (8298389097)
2. **New Leads Management System**: Inbox for all new inquiries with full lead data
3. **Gallery Facebook Sync**: Fetch Facebook page posts and display in website Gallery
4. **Book Solar Service Widget**: Prominent banner with configurable pricing
5. **Cashfree Payments Integration**: Full payment collection system with links, webhooks, and tracking

## Critical Credentials (DO NOT CHANGE)
- **Admin Login Email**: `asrenterprisespatna@gmail.com`
- **Admin Login Password**: `admin@asr123`
- **WhatsApp API Number**: `8298389097`
- **Display Contact Number**: `9296389097`
- **Support Email**: `support@asrenterprises.in`
- **Website**: `https://asrenterprises.in`

## Latest Updates (April 9, 2026 - Round 14)

### ✅ LIVE CASHFREE PAYMENT SYSTEM - PRODUCTION READY

**CRITICAL FIX: Switched from Payment Links API to Orders API**
- The Payment Links API was blocked with "link_creation_api is not enabled or approved"
- Solution: Implemented Cashfree Orders API (Hosted Checkout) which is fully activated
- Live payments are now working in PRODUCTION

**New Backend Route: `/app/backend/routes/cashfree_orders.py`**
- `POST /api/cashfree/create-order` - Creates LIVE payment orders
- `POST /api/cashfree/website/create-order` - Website payments with auto-lead creation
- `GET /api/cashfree/order/{order_id}` - Get order details
- `GET /api/cashfree/order/{order_id}/refresh` - Refresh status from Cashfree
- `POST /api/cashfree/order/{order_id}/resend-whatsapp` - Resend payment link via WA
- `GET /api/cashfree/dashboard/stats` - Payment statistics
- `GET /api/cashfree/orders` - Paginated orders list
- `GET /api/cashfree/lead/{lead_id}/orders` - Orders for a specific lead
- `POST /api/cashfree/webhook` - Webhook handler for payment events

**Payment Status Pages Created:**
- `/payment/success` - Shows order details, WhatsApp button, Call button
- `/payment/failed` - Shows error, tips, retry option
- `/payment/pending` - Auto-refresh, check status button
- All pages have ASR Enterprises branding and correct support info

**Payment Types Supported:**
- Advance Payment
- Site Visit Payment
- Booking Token Amount
- Consultation Fee
- Installation Payment
- Custom Payment

**Auto Lead Stage Update After Payment:**
- site_visit → "site_visit"
- booking → "converted"
- consultation → "contacted"
- installation → "installation_scheduled"
- advance → "converted"

**UI Improvements:**
- Removed yellow marquee, replaced with dark blue premium theme
- Updated phone numbers from 8877896889 to 9296389097 in CRM dashboard
- Payment Type selector added to payment modal in lead cards

**Testing Results (Iteration 86):**
- 100% pass rate (19/19 tests passed)
- Live orders created successfully
- Payment URLs working at payments.cashfree.com
- Webhook endpoint ready for payment events

## Previous Updates (April 8, 2026 - Round 13)

### ✅ Enhanced Cashfree Webhook Implementation

**New Webhook Endpoint:** `/api/payments/cashfree/webhook`
- Proper signature verification using x-webhook-signature header
- Idempotency checking to prevent duplicate processing
- Full webhook logging to `payment_webhook_logs` collection
- Handles events: PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_USER_DROPPED, REFUND_SUCCESS, REFUND_FAILED

**On PAYMENT_SUCCESS:**
- Mark payment as PAID in database
- Store order_id, payment_id, amount, payment_time
- Update linked lead status to "converted" with payment_received=true
- Auto-send WhatsApp confirmation message
- Log activity in crm_activities

**On PAYMENT_FAILED:**
- Mark payment as FAILED
- Store failure reason
- Log to payment_failures collection

**Webhook Security:**
- Signature verification enabled when CASHFREE_WEBHOOK_SECRET is set
- Returns 200 OK always (to prevent Cashfree retries)
- Full audit trail in payment_webhook_logs

### ✅ Book Solar Service → Cashfree Integration

**Replaced QR Code Payment with Cashfree:**
- Website "Book Solar Service" now uses Cashfree payment links
- Flow: Fill form → Create payment link → Redirect to Cashfree → Verify payment
- Auto-creates lead on successful payment
- API endpoints used: POST /api/payments/website/initiate, GET /api/payments/website/verify/{order_id}

### ✅ CRM Dashboard Tab Reorganization

**New Tab Structure:**
| Tab | Contents | Color |
|-----|----------|-------|
| Dashboard | Main CRM dashboard | Blue |
| Lead Management | All Leads + Trash (with subtabs) | Blue |
| Cashfree Payments | Payment links, transactions, stats | Emerald |
| WhatsApp | WhatsApp inbox and messaging | Green |
| HR Management | Team + Tasks (with subtabs) | Purple |
| Service Price | Book Solar pricing config | Blue |
| Site Settings | Marquee, OG settings | Blue |
| Security Centre | Backups (with subtabs) | Red |
| Credentials | API key management | Blue |

**New Section Components:**
- `LeadManagementSection` - Combines All Leads + Trash with subtab navigation
- `HRManagementSection` - Combines Team + Tasks with subtab navigation
- `SecurityCentreSection` - Contains Backups with subtab navigation

## Previous Updates (April 8, 2026 - Round 11)

### ✅ Cashfree Payments Integration (12 Phases Complete)

**Phase 1-2: Foundation**
- Created `/app/backend/routes/payments.py` with full Cashfree API integration
- Settings management for App ID, Secret Key, Webhook Secret
- Payment link creation with Cashfree Sandbox/Production support

**Phase 3-4: WhatsApp Integration**
- Payment links can be sent via WhatsApp API automatically
- "Send via WhatsApp" option when creating payment links
- Resend functionality for existing links

**Phase 5-6: Webhooks & Tracking**
- Webhook endpoint at `/api/payments/webhook` for Cashfree callbacks
- Signature verification for webhook security
- Auto-update lead stages on successful payment (→ converted)
- Transaction history with filters (status, source, date, search)

**Phase 7-8: Website Payment**
- WebsitePayment component (`/app/frontend/src/components/WebsitePayment.js`)
- Auto-lead creation from website payments
- Service type selection with predefined amounts

**Phase 9-10: Manual Payments**
- Record cash/UPI/bank/cheque payments manually
- Link payments to existing leads
- Payment mode tracking

**Phase 11-12: Dashboard & Analytics**
- PaymentsDashboard component with statistics
- Today/Week/Month collection summaries
- Source-wise breakdown (CRM/WhatsApp/Website/Manual)
- Pending/Paid/Failed status tracking

**New Files Created:**
- `/app/backend/routes/payments.py` - 1100+ lines, full Cashfree integration
- `/app/frontend/src/components/PaymentsDashboard.js` - Admin payments UI
- `/app/frontend/src/components/WebsitePayment.js` - Website payment form

**CRM Tab Added:**
- "Cashfree Payments" tab (emerald green highlight when active)
- Position: After "All Leads", before "WhatsApp"

**API Endpoints Created:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/settings` | GET/POST | Manage Cashfree credentials |
| `/api/payments/settings/test` | POST | Test Cashfree connection |
| `/api/payments/create-link` | POST | Create payment link |
| `/api/payments/create-link/bulk` | POST | Bulk create links for leads |
| `/api/payments/link/{id}/status` | GET | Check link payment status |
| `/api/payments/link/{id}/resend` | POST | Resend link via WhatsApp |
| `/api/payments/link/{id}/cancel` | POST | Cancel payment link |
| `/api/payments/webhook` | POST | Cashfree webhook handler |
| `/api/payments/transactions` | GET | Paginated transaction list |
| `/api/payments/transaction/{id}` | GET | Transaction details |
| `/api/payments/dashboard/stats` | GET | Payment statistics |
| `/api/payments/manual` | POST | Record manual payment |
| `/api/payments/website/initiate` | POST | Initiate website payment |
| `/api/payments/website/verify/{id}` | GET | Verify website payment |
| `/api/payments/lead/{id}/payments` | GET | Lead's payment history |
| `/api/payments/webhook-url` | GET | Webhook configuration URL |

**Cashfree Sandbox Credentials:**
- App ID: `TEST11045628c113bde30257854276e782654011`
- Secret Key: `cfsk_ma_test_242162c934ca261ca601a894626087cb_801c971a`
- Environment: Sandbox (is_sandbox=true)

**Payment Sources:**
- `crm_link` - CRM Payment Link
- `crm_bulk` - Bulk CRM Links
- `whatsapp` - WhatsApp Payment
- `website` - Website Payment
- `manual` - Manual Payment

**Payment Statuses:**
- `link_created` - Link created, not yet sent
- `link_sent` - Link sent via WhatsApp
- `pending` - Payment pending
- `paid` - Payment completed
- `failed` - Payment failed
- `expired` - Link expired
- `cancelled` - Link cancelled

**Auto Lead Updates:**
- On successful payment: stage → "converted", priority → "hot"
- Payment history tracked per lead
- Activity log updated with payment events

## Previous Updates (April 8, 2026 - Round 10)

### 1. ✅ Social Media Link Preview Setup
Complete implementation of rich link previews for https://www.asrenterprises.in

**OG Image Created:**
- File: `/app/frontend/public/og-homepage.jpg` (1200x630 px)
- Content: ASR Enterprises logo, rooftop solar house, headline "Rooftop Solar Solutions in Patna, Bihar", contact info, website URL
- Style: Premium dark brown background with orange/green accents

**Meta Tags Added:**
- Open Graph: og:title, og:description, og:image, og:url, og:type, og:site_name, og:locale
- Twitter Card: summary_large_image, twitter:title, twitter:description, twitter:image
- Canonical URL: https://www.asrenterprises.in/
- All meta tags in index.html (lines 8-43)

**Preview Content:**
- Title: "ASR Enterprises | Rooftop Solar Solutions in Patna, Bihar"
- Description: "Trusted rooftop solar company in Patna, Bihar for home, shop, and commercial solar installation with subsidy support."
- Image: https://www.asrenterprises.in/og-homepage.jpg

**Platforms Supported:**
- WhatsApp, WhatsApp Status, Facebook, Messenger, Telegram, LinkedIn

## Previous Updates (April 8, 2026 - Round 9)

### 1. ✅ ABHIJEET KUMAR as Main Admin/Owner
- **Staff ID**: ASR1001 (permanent, protected)
- **Role**: Super Admin / Owner
- **Email**: asrenterprisespatna@gmail.com
- **Mobile**: 8877896889
- **Designation**: Owner & Managing Director
- **Status**: PROTECTED - Cannot be deleted or removed

### 2. ✅ Owner Account Protection
- Backend startup automatically creates/verifies owner account
- DELETE /api/admin/staff-accounts/ASR1001 returns 403 Forbidden
- Delete button shows "Protected" and is disabled for ASR1001
- Owner has is_owner=true, is_super_admin=true, can_delete=false flags

### 3. ✅ Owner UI Visibility
- **Team Tab**: Golden owner card at top with OWNER badge, PROTECTED ACCOUNT label
- **Credentials Tab**: Owner card with Full Access and Protected badges
- Owner account displayed prominently across CRM

### 4. ✅ CRM Tabs Finalized
Final tab list: Dashboard, All Leads, WhatsApp, Trash, Tasks, Team, Service Price, Site Settings, Backups, Credentials
- Removed duplicate Bookings and Messages tabs
- WhatsApp tab restored with green highlight

## Previous Updates (April 8, 2026 - Round 8)

### 1. ✅ WhatsApp Tab Restored in CRM Dashboard
- WhatsApp tab is back in the CRM navigation with green highlight when active
- Full WhatsApp inbox functionality restored for admin

### 2. ✅ Staff WhatsApp Chat for Assigned Leads
- Staff Portal WhatsApp tab shows "Only your assigned leads" filter
- Staff can view WhatsApp conversations only for leads assigned to them
- Staff can send WhatsApp templates to their assigned leads
- Staff can start new WhatsApp conversations with assigned leads

### 3. ✅ Removed Duplicate Bookings Tab
- Removed redundant "Bookings" and "Messages" tabs
- Service Price tab handles booking/service configuration
- CRM tabs now: Dashboard, All Leads, WhatsApp, Trash, Tasks, Team, Service Price, Site Settings, Backups, Credentials

## Previous Updates (April 8, 2026 - Round 7)

### 1. ✅ Removed "New" and "WhatsApp Inquiries" tabs from CRM Dashboard
- Simplified the CRM Dashboard navigation
- These tabs were causing confusion and mixing old/new leads
- Leads management is now consolidated in the Professional Leads Management page

### 2. ✅ Admin-Editable Marquee Header (Site Settings Tab)
- **NEW Tab**: "Site Settings" added to CRM Dashboard
- Admin can edit the running marquee text that appears on the website
- Features:
  - Live preview of marquee animation
  - Toggle to enable/disable marquee
  - Quick template buttons for common announcements
  - Save settings persisted to database
- **Backend**: New endpoints `GET/POST /api/site-settings`
- **Frontend**: Homepage now fetches marquee content from backend API

### 3. ✅ WhatsApp API Integration in Leads Management
- WhatsApp buttons now open a modal for API-based messaging
- Features:
  - Select from approved WhatsApp templates
  - Or type custom message
  - Send via WhatsApp Business API
  - Messages tracked in lead activity
- Replaces old wa.me direct links

### 4. ✅ Staff Login - Email + Password Option (2FA Optional)
- **3 Login Methods** now available:
  1. **Email + Password** (default, no 2FA) - Quick login for trusted staff
  2. **Mobile OTP** - Login via registered mobile number
  3. **Email + 2FA** - Email verification + Mobile OTP for extra security
- 2FA is now optional based on staff preference/security needs
- Password visibility toggle added

## Previous Updates (April 8, 2026 - Round 6)

### 1. ✅ MAJOR: Professional Leads Management System
Complete rebuild of the Leads Management module at `/admin/leads`:

**New Features Implemented:**
- **Professional Table View (default)**: Compact, powerful lead table with columns: Lead ID, Customer Name, Contact, Location, Source, Stage, Priority, Assigned Staff, Follow-up, Created Date, Actions
- **Card View (optional toggle)**: Mobile-friendly card layout with all lead details
- **8 Stats Dashboard Cards**: Total, Fresh, Today's, Follow-up Due, Hot, Unassigned, Converted, Lost - clickable for quick filtering
- **Fresh Leads System**: Leads created within 48 hours marked with animated "NEW" badge
- **Lead Priority/Temperature**: Hot (red), Warm (orange), Cold (blue), Low Quality (gray) with inline dropdown to change
- **Solar-Specific Pipeline Stages** (12 stages):
  1. New Lead → 2. Contacted → 3. Interested → 4. Documents Pending → 5. Site Survey → 6. Quotation Sent → 7. Subsidy Explained → 8. Negotiation → 9. Converted → 10. Installation Scheduled → 11. Completed → 12. Lost
- **Advanced Lead Source Tracking**: Website, WhatsApp, Facebook, Instagram, Manual Entry, CSV Import, Old Database, Referral, Walk-in, Phone Call, Other - with colored badges
- **Advanced Search**: Search by name, phone, email, district, lead ID
- **Multi-Filter System**: Filter by Source, Stage, Priority, District, Property Type, Assigned Staff, Date Range
- **Quick Filters**: Fresh Leads, Today's Leads, Follow-up Due, Unassigned, Hot Leads, Converted, Lost
- **Sorting Options**: Newest, Oldest, Fresh First, Hot First, Follow-up Due First, Uncontacted First, Name A-Z/Z-A
- **Bulk Actions**: Assign, Change Stage, Change Priority, Export CSV, Delete - with progress indicators
- **Follow-up Management**: Add follow-up with date, time, type (call/visit/quotation/payment/whatsapp), notes
- **Lead Details Modal**: Complete lead view with activity timeline, notes, status history
- **Add Lead Modal**: Comprehensive form with all fields: Name, Phone, Alternate Phone, Email, District, Property Type, Roof Type, Monthly Bill, Required Capacity, Source, Priority, Address, Notes

**New Backend Endpoints:**
- `GET /api/crm/leads/advanced` - Paginated leads with filters, search, sorting, stats
- `GET /api/crm/leads/stats` - Quick stats for dashboard cards
- `POST /api/crm/leads/bulk-assign` - Bulk assign leads to staff
- `POST /api/crm/leads/bulk-update` - Bulk update stage/priority
- `POST /api/crm/leads/check-duplicate` - Duplicate detection by phone/email
- `POST /api/crm/leads/{lead_id}/trash` - Soft delete single lead
- `GET /api/crm/leads/{lead_id}/timeline` - Lead activity timeline

**Files Created/Modified:**
- NEW: `/app/frontend/src/components/ProfessionalLeadsManagement.js` (Complete professional CRM UI)
- MODIFIED: `/app/backend/routes/crm.py` (Advanced endpoints)
- MODIFIED: `/app/frontend/src/App.js` (Route updated to use new component)

## Previous Updates (April 8, 2026 - Round 5)

### 1. ✅ Running Marquee Header
- Added prominent running/scrolling announcement bar at top of website
- Text: "☀Get up to ₹78,000 Subsidy under PM Surya Ghar Yojana Call Now: 9296389097 WhatsApp for Quote"
- Orange/amber gradient background with continuous scrolling animation
- Visible on all pages below the navbar

### 2. ✅ New Inquiries Tab Overhaul
- **CHANGED**: Now fetches ONLY WhatsApp leads (source=whatsapp filter)
- **ADDED**: Auto-sync feature (refreshes every 15 seconds when enabled)
- **REPLACED**: WhatsApp action button with Assign button (blue, opens bulk assign modal)
- Call button (green) and Done button (gray) retained
- Desktop table + Mobile card responsive views

### 3. ✅ Soft Delete / Trash System
- **NEW**: Leads are now soft-deleted (moved to Trash instead of permanent delete)
- 30-day retention period before auto-deletion
- **NEW**: Trash tab in CRM dashboard with restore functionality
- Admins can select and restore multiple leads at once
- Shows deletion date for each trashed lead

### 4. ✅ Bulk Delete at All Leads
- **ADDED**: Red "Delete" button appears when leads are selected in All Leads tab
- Confirmation dialog mentions leads will be moved to Trash
- Works alongside existing Bulk Assign and WhatsApp Campaign buttons

### 5. ✅ RAZORPAY Removal Complete
- Fixed undefined RAZORPAY_PAYMENT_LINK error in ServiceRegistration component
- Payment flow now redirects to WhatsApp for manual QR payment

## Previous Updates (April 7, 2026 - Round 4)

### 1. ✅ Bulk Template Message Fix
- **Problem**: Bulk campaigns failed while individual template sends worked
- **Root Cause**: Templates with `variable_count=0` (like `promote_asr_enterprises`) were receiving variables array
- **Fix**: Now checks template's `variable_count` before sending - only sends variables if template needs them
- **Added**: 500ms delay between messages to avoid rate limiting

### 2. ✅ New Leads Inbox - All Sources + Actions
- Now shows ALL new leads (not just WhatsApp)
- **Added**: Call button (tel: link) for direct calling
- **Added**: Bulk Delete button with confirmation
- Desktop table view + Mobile card view
- Bulk Assign and Mark Contacted buttons

### 3. ✅ Book Service Banner - Repositioned
- Moved to TOP of hero section (above "Make Your Electricity Bill ZERO")
- Prominent flashing banner with shimmer animation
- Shows dynamic price (currently ₹2,499)
- Click triggers Book Solar Service modal

## Key Features Summary

### New Leads Inbox
- Shows all new inquiries from: Website, WhatsApp, Bulk Import, Manual Entry
- Call button (blue phone icon) - direct tel: link
- WhatsApp button - opens wa.me link
- Bulk Actions: Mark Contacted, Assign to Staff, Delete
- Desktop table + Mobile card views

### Book Solar Service
- Prominent banner at top of hero section
- Price: ₹2,499 (configurable via CRM → Service Price)
- QR code payment flow with transaction verification
- Bookings managed in CRM → Bookings tab

### WhatsApp Bulk Campaigns
- Templates with variables: Sends customer name
- Templates without variables: Sends cleanly without variables array
- 500ms delay between messages to avoid rate limiting

## Key API Endpoints

### Leads
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/new-leads?source=all` | GET | All new leads |
| `/api/crm/new-leads?source=whatsapp` | GET | WhatsApp leads only |
| `/api/crm/leads/bulk-delete` | POST | Soft-delete leads (moves to Trash) |
| `/api/crm/leads/bulk-mark-contacted` | POST | Bulk mark contacted |
| `/api/crm/leads/trash` | GET | Get soft-deleted leads |
| `/api/crm/leads/restore` | POST | Restore leads from Trash |

### WhatsApp
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/templates/bulk-send` | POST | Send to multiple leads |
| `/api/whatsapp/campaign/create` | POST | Create new campaign |

### Service
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/service/book-solar-config` | GET/PUT | Get/Update price |
| `/api/service/bookings` | GET | List all bookings |

## Testing Status
- **Test Report**: `/app/test_reports/iteration_82.json`
- **Backend Tests**: 100% passed
- **Frontend Tests**: 100% passed

## Database Schema

### crm_leads
```javascript
{
  id: String,
  name: String,
  phone: String,
  source: String,  // 'website', 'whatsapp', 'bulk_import', 'manual'
  is_new: Boolean, // Flag for New Leads Inbox
  stage: String,   // 'new', 'contacted', 'site_visit', etc.
  is_deleted: Boolean, // Soft delete flag (NEW)
  deleted_at: DateTime, // Deletion timestamp (NEW)
  ...
}
```

### whatsapp_templates
```javascript
{
  template_name: String,
  language_code: String,  // 'en' or 'en_US'
  variable_count: Number, // 0 = no variables, 1+ = needs variables
  status: String          // 'APPROVED', 'PENDING', etc.
}
```

## 3rd Party Integrations
- **Gemini AI**: Lead analysis (Emergent LLM Key)
- **MSG91**: OTP/SMS (User API Key)
- **Meta WhatsApp Cloud API**: Messaging (User API Key)
- **Facebook/Instagram Graph API**: Publishing & Sync (User API Key)

---
*Last Updated: April 8, 2026*
