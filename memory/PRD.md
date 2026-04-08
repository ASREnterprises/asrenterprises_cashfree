# ASR Enterprises Solar CRM - Product Requirements Document

## Original Problem Statement
Build a comprehensive Solar Business CRM with the following key features:
1. **WhatsApp API Integration**: Route all website WhatsApp buttons to the API number (8298389097)
2. **New Leads Management System**: WhatsApp inquiry inbox with full lead data
3. **Gallery Facebook Sync**: Fetch Facebook page posts and display in website Gallery
4. **Book Solar Service Widget**: Flashing homepage widget with configurable pricing

## Critical Credentials (DO NOT CHANGE)
- **Admin Login Mobile**: `8877896889`
- **Admin Login Email**: `asrenterprisespatna@gmail.com`
- **WhatsApp API Number**: `8298389097`
- **Display Contact Number**: `9296389097`

## Latest Updates (April 7, 2026 - Round 3)

### 1. ✅ New Leads Inbox - WhatsApp Only
- Only fetches leads from WhatsApp source (`whatsapp, whatsapp_direct, whatsapp_reply, whatsapp_button`)
- Full lead data display (Name, Contact, Location, Source, Stage, Date)
- Desktop table view + Mobile card view
- Bulk selection for assign and mark contacted

### 2. ✅ Book Solar Service Widget (Homepage)
- Flashing widget button on homepage with dynamic price
- Price configurable via "Service Price" tab in CRM (currently ₹2,499)
- QR code payment flow with transaction ID verification
- Bookings viewable in new "Bookings" tab

### 3. ✅ CRM Navigation Changes
- **Removed**: Social Media tab from main CRM navigation
- **Added**: Bookings tab for managing solar service bookings
- Social Media Manager still accessible via `/admin/social-media` route

### 4. ✅ Social Media Manager Updates
- Added Back button for easy navigation
- Mobile responsive layout
- Tabs show icons only on mobile

### 5. ✅ Mobile Responsiveness
- New Leads Inbox fully mobile responsive
- Bulk assign and WhatsApp campaign buttons visible on mobile
- Bookings Manager with mobile card view

### 6. ✅ WhatsApp Auto-Deletion
- Changed from 48hr to 24hr auto-deletion
- Bulk conversation delete feature added

### ⚠️ Template Message Failures
The bulk WhatsApp template campaigns are failing with error "Template name does not exist in the translation". This is caused by:
1. **Expired Access Token**: Meta WhatsApp access tokens expire every 90 days
2. **Action Required**: User needs to refresh the access token in Meta Business Manager

**How to fix:**
1. Go to [Meta Business Suite](https://business.facebook.com/settings/system-users)
2. Select your System User
3. Generate a new access token with permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
4. Update the token in ASR CRM → Credentials → WhatsApp Settings

## Current Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── crm.py                 # CRM + New Leads WhatsApp-only filter
│   │   ├── whatsapp.py            # 24hr auto-delete, bulk conversation delete
│   │   ├── social_media.py        # Gallery sync
│   └── server.py                  # Service bookings API
└── frontend/
    ├── src/
    │   ├── App.js                 # Book Service flashing widget
    │   ├── components/
    │   │   ├── CRMDashboard.js    # Bookings tab, no Social tab
    │   │   ├── SocialMediaManager.js # Back button, mobile friendly
    │   │   ├── Gallery.js         # Facebook Posts, Latest Work tabs
```

## Key API Endpoints

### Service Bookings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/service/book-solar-config` | GET/PUT | Get/Update service price |
| `/api/service/bookings` | GET | List all bookings |
| `/api/service/book-solar` | POST | Create new booking |
| `/api/service/bookings/{id}/status` | PUT | Update booking status |

### New Leads (WhatsApp Only)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/new-leads?source=whatsapp` | GET | WhatsApp leads only |
| `/api/crm/new-leads/count?source=whatsapp` | GET | Count for badge |

### WhatsApp Bulk Operations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/conversations/bulk-delete` | POST | Delete multiple conversations |
| `/api/whatsapp/messages/auto-cleanup-24h` | DELETE | Delete messages older than 24hr |

## Testing Status
- **Test Report**: `/app/test_reports/iteration_75.json`
- **Backend Tests**: 100% passed
- **Frontend Tests**: 100% passed

## Backlog (P2)
1. Advanced HR Features (AI task assignment, OCR)
2. Hyper-Local SEO Pages
3. Refactor monolithic server.py

## 3rd Party Integrations
- **Gemini AI**: Lead analysis (Emergent LLM Key)
- **MSG91**: OTP/SMS (User API Key)
- **Meta WhatsApp Cloud API**: Messaging (User API Key) - **TOKEN NEEDS REFRESH**
- **Facebook/Instagram Graph API**: Publishing & Sync (User API Key)

---
*Last Updated: April 7, 2026*
