# ASR Enterprises Solar CRM - Product Requirements Document

## Original Problem Statement
Build a comprehensive Solar Business CRM with the following key features:
1. **WhatsApp API Integration**: Route all website WhatsApp buttons to the API number (8298389097)
2. **New Leads Management System**: Inbox for all new inquiries with full lead data
3. **Gallery Facebook Sync**: Fetch Facebook page posts and display in website Gallery
4. **Book Solar Service Widget**: Prominent banner with configurable pricing

## Critical Credentials (DO NOT CHANGE)
- **Admin Login Mobile**: `8877896889`
- **Admin Login Email**: `asrenterprisespatna@gmail.com`
- **WhatsApp API Number**: `8298389097`
- **Display Contact Number**: `9296389097`

## Latest Updates (April 8, 2026 - Round 6)

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
- **Test Report**: `/app/test_reports/iteration_78.json`
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
