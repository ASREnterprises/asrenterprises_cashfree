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

## Latest Updates (April 7, 2026 - Round 4)

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
| `/api/crm/leads/bulk-delete` | POST | Bulk delete leads |
| `/api/crm/leads/bulk-mark-contacted` | POST | Bulk mark contacted |

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
- **Test Report**: `/app/test_reports/iteration_76.json`
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
*Last Updated: April 7, 2026*
