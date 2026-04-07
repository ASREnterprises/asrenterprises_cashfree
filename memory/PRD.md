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
│   │   ├── whatsapp.py            # WhatsApp API routes
│   │   ├── whatsapp_automation.py # Bot logic + Human Handover
│   │   └── social_media.py        # Meta Graph API + Gallery Sync
│   └── server.py                  # Main application
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── CRMDashboard.js    # Admin CRM with New Leads tab
    │   │   ├── Gallery.js         # Public gallery with FB posts
    │   │   ├── StaffPortal.js     # Staff interface
    │   │   └── SocialMediaManager.js
    └── .env
```

## Completed Features

### 1. ✅ Facebook Gallery Sync (P0) - COMPLETED April 7, 2026
- **Backend**: `/api/social/gallery/public?type=all` returns synced Facebook posts
- **Frontend**: Gallery.js displays FB posts with blue "Facebook" badge
- **Filter Tabs**: "All Projects", "Latest (Facebook)", "Uploads"
- **Auto-sync**: Posts synced with `show_on_gallery: true` by default
- **46 Facebook posts** currently synced and visible

### 2. ✅ New Leads Management System (P0) - COMPLETED April 7, 2026
- **Database Fields**: `is_new`, `lead_status`, `first_contact_at` added to leads
- **API Endpoints**:
  - `GET /api/crm/new-leads` - List leads with is_new=True
  - `GET /api/crm/new-leads/count` - Quick count for badge
  - `POST /api/crm/leads/{id}/mark-contacted` - Remove NEW badge
  - `POST /api/crm/leads/bulk-mark-contacted` - Bulk operation
- **CRM Dashboard**: "🆕 New" tab with green background and red count badge
- **Visual Badge**: "NEW" pill on lead cards
- **Auto-removal**: NEW flag removed when staff marks as contacted

### 3. ✅ Human Handover Logic (P1) - COMPLETED April 7, 2026
- **Detection Keywords**: "human", "agent", "real person", "talk to someone", etc.
- **Option 0**: Added to WhatsApp bot menu for human handover
- **CRM Alert**: Creates notification in `crm_notifications` collection
- **Lead Update**: Sets `human_required: true` and `ai_priority: high`

### 4. ✅ WhatsApp Routing (P0) - VERIFIED
- All `wa.me` links use `8298389097` (API number)
- Bot creates CRM leads automatically
- Conversational flow with lead scoring

### 5. ✅ Social Media Publishing Improvements (P1) - COMPLETED April 7, 2026
- **Instagram**: Added polling for video container readiness
- **Facebook Video**: Better error handling for URL access issues
- **Error Messages**: Clear guidance for common errors

## Database Schema Updates
```javascript
// crm_leads collection
{
  id: String,
  name: String,
  phone: String,
  stage: "new" | "contacted" | "site_visit" | "quotation" | "negotiation" | "converted" | "completed" | "lost",
  // New Leads Management fields
  lead_status: "new" | "in_progress" | "follow_up" | "closed",
  is_new: Boolean,  // Visual flag for NEW badge
  first_contact_at: DateTime,
  human_required: Boolean,  // For human handover
  // ... existing fields
}

// website_gallery collection
{
  id: String,
  facebook_post_id: String,
  source: "facebook" | "upload",
  media_url: String,
  caption: String,
  show_on_gallery: Boolean,  // Default: true for synced posts
  // ... other fields
}
```

## Key API Endpoints

### New Leads Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/new-leads` | GET | Get leads with is_new=True |
| `/api/crm/new-leads/count` | GET | Quick count for badge |
| `/api/crm/leads/{id}/mark-contacted` | POST | Remove NEW badge |
| `/api/crm/leads/bulk-mark-contacted` | POST | Bulk mark contacted |

### Gallery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/gallery/public?type=all` | GET | All gallery items |
| `/api/social/gallery/public?type=gallery` | GET | Gallery-marked only |
| `/api/social/gallery/public?type=latest_work` | GET | Latest work section |

## Testing Status
- **Test Report**: `/app/test_reports/iteration_73.json`
- **Backend Tests**: 100% passed (15/15)
- **Frontend**: Gallery verified, CRM requires 2FA

## Backlog (P2)

### Future Tasks
1. Advanced HR Features (AI task assignment, OCR for expenses)
2. Hyper-Local SEO Pages (district-specific landing pages)
3. Refactor monolithic `server.py` into modular routers

### Known Issues
- CRM Dashboard requires 2FA for automated testing
- `server.py` is still large (11,000+ lines)

## 3rd Party Integrations
- **Gemini AI**: Lead analysis (Emergent LLM Key)
- **MSG91**: OTP/SMS (User API Key)
- **Meta WhatsApp Cloud API**: Messaging (User API Key)
- **Facebook/Instagram Graph API**: Publishing & Sync (User API Key)

---
*Last Updated: April 7, 2026*
