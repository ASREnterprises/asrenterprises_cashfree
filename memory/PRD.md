# ASR Enterprises Solar CRM - Product Requirements Document

## Original Problem Statement
Build a comprehensive Solar Business CRM with the following key features:
1. **WhatsApp API Integration**: Route all website WhatsApp buttons to the API number (8298389097) and create CRM leads instantly
2. **New Leads Management System**: NEW tags, visual badges, dedicated dashboard tab, filters, auto-remove logic
3. **Gallery Facebook Sync**: Fetch Facebook page posts and display in website Gallery
4. **Social Media Manager**: Facebook/Instagram publishing with better error handling
5. **Human Handover Logic**: Detect when customer wants to talk to human and escalate to CRM

## Critical Credentials (DO NOT CHANGE)
- **Admin Login Mobile**: `8877896889`
- **Admin Login Email**: `asrenterprisespatna@gmail.com`
- **WhatsApp API Number**: `8298389097`
- **Display Contact Number**: `9296389097`

## Current Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── crm.py                 # CRM endpoints + New Leads Management
│   │   ├── staff.py               # Staff portal
│   │   ├── whatsapp.py            # WhatsApp API routes + 24hr auto-delete
│   │   ├── whatsapp_automation.py # Bot logic + Human Handover
│   │   └── social_media.py        # Meta Graph API + Gallery Sync
│   └── server.py                  # Main application
└── frontend/
    ├── src/
    │   ├── App.js                 # Homepage - updated URL, removed call button
    │   ├── components/
    │   │   ├── CRMDashboard.js    # Admin CRM with mobile-responsive New Leads tab
    │   │   ├── Gallery.js         # Gallery with Facebook Posts, Latest Work, Uploads tabs
    │   │   ├── WhatsAppInbox.js   # Inbox with bulk delete feature
    │   │   ├── ZeroBillHero.js    # Updated - removed Call button
    │   │   └── SmartWhatsAppButton.js # Fixed to use 8298389097
    └── .env
```

## Completed Features

### April 7, 2026 - Round 2 Updates

#### 1. ✅ New Leads Inbox - Mobile Responsive & WhatsApp Only
- Mobile-friendly layout with stacked elements
- Only shows WhatsApp leads (`source: whatsapp, whatsapp_direct, whatsapp_reply, whatsapp_button`)
- Responsive action buttons

#### 2. ✅ Website Button Cleanup
- Removed "Call: 9296389097" from "Get Started Today!" section
- Removed "Book Solar Service" button from ZeroBillHero
- Removed Call and WhatsApp buttons below "Our Mission"
- Updated www.asrenterprisespatna.com → www.asrenterprises.in

#### 3. ✅ Gallery Tab Renaming
- "All Projects" → "Facebook Posts" (general FB posts)
- "Latest" → "Latest Installation Work" (admin-selected posts)
- "Uploads" remains unchanged

#### 4. ✅ WhatsApp Auto-Deletion - 24hr
- Changed from 48hr to 24hr
- Endpoint: `DELETE /api/whatsapp/messages/auto-cleanup-24h`

#### 5. ✅ Bulk Conversation Delete
- Added bulk selection toggle in WhatsApp Inbox header
- Checkbox on each conversation for selection
- Bulk delete button with count indicator
- Endpoint: `POST /api/whatsapp/conversations/bulk-delete`

#### 6. ✅ WhatsApp Number Fix
- All `wa.me` links now use `918298389097` (not 9296389097)
- Fixed in: ZeroBillHero, AboutUs, Dashboard, BiharInstallationMap, Contact, ZeroBillComparison, SmartWhatsAppButton

### April 7, 2026 - Round 1 Updates

#### 1. ✅ Facebook Gallery Sync (P0)
- Backend: `/api/social/gallery/public?type=all` returns synced Facebook posts
- Frontend: Gallery.js displays FB posts with blue "Facebook" badge

#### 2. ✅ New Leads Management System (P0)
- Database Fields: `is_new`, `lead_status`, `first_contact_at`
- API Endpoints: `/api/crm/new-leads`, `/api/crm/new-leads/count`, mark-contacted

#### 3. ✅ Human Handover Logic (P1)
- Detection Keywords: "human", "agent", "real person", etc.
- Option 0 in WhatsApp bot menu

## Key API Endpoints

### New Leads Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/new-leads?source=whatsapp` | GET | WhatsApp leads with is_new=True |
| `/api/crm/new-leads/count?source=whatsapp` | GET | Count for badge |
| `/api/crm/leads/{id}/mark-contacted` | POST | Remove NEW badge |

### WhatsApp
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/messages/auto-cleanup-24h` | DELETE | Delete messages older than 24hr |
| `/api/whatsapp/conversations/bulk-delete` | POST | Delete multiple conversations |
| `/api/whatsapp/conversations/{phone}/clear` | DELETE | Clear single conversation |

### Gallery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/gallery/public?type=gallery` | GET | Facebook general posts |
| `/api/social/gallery/public?type=latest_work` | GET | Admin-selected installation work |

## Testing Status
- **Test Report**: `/app/test_reports/iteration_74.json`
- **Backend Tests**: 100% passed
- **Frontend**: Verified via code review and testing agent

## Backlog (P2)
1. Advanced HR Features (AI task assignment, OCR)
2. Hyper-Local SEO Pages
3. Refactor monolithic server.py

## 3rd Party Integrations
- **Gemini AI**: Lead analysis (Emergent LLM Key)
- **MSG91**: OTP/SMS (User API Key)
- **Meta WhatsApp Cloud API**: Messaging (User API Key)
- **Facebook/Instagram Graph API**: Publishing & Sync (User API Key)

---
*Last Updated: April 7, 2026*
