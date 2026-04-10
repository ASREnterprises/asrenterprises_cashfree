# Server.py Refactoring Plan

## Current State
- `server.py` is ~11,400 lines - extremely monolithic
- Contains many unrelated features mixed together
- Makes maintenance and debugging difficult

## Proposed Module Structure

### Existing Modules (already extracted)
- `/app/backend/routes/crm.py` - CRM dashboard endpoints
- `/app/backend/routes/staff.py` - Staff portal endpoints
- `/app/backend/routes/cashfree_orders.py` - Cashfree payment system
- `/app/backend/routes/hr.py` - HR management

### New Modules to Extract

1. **`/app/backend/routes/social_webhooks.py`** (~500 lines)
   - WhatsApp webhook endpoints
   - Facebook Messenger webhooks
   - Unified Meta webhook handler
   - Social media configuration

2. **`/app/backend/routes/shop.py`** (~400 lines)
   - Product categories
   - Service booking endpoints
   - Delivery fee management
   - AI service description generation

3. **`/app/backend/routes/admin_auth.py`** (~300 lines)
   - Admin login/logout
   - 2FA verification
   - Session management
   - Security enforcement

4. **`/app/backend/routes/notifications.py`** (~400 lines)
   - Notification storage
   - SMS/Email sending functions
   - WhatsApp notification helpers

5. **`/app/backend/routes/tasks.py`** (~300 lines)
   - Task management APIs
   - Activity timeline
   - Internal messaging

6. **`/app/backend/routes/leads_import.py`** (~400 lines)
   - Bulk lead import
   - Multi-format import (CSV, Excel, PDF, Image)
   - AI-powered data extraction

7. **`/app/backend/routes/analytics.py`** (~200 lines)
   - Dashboard widgets
   - Performance tracking
   - Event analytics

8. **`/app/backend/routes/backup.py`** (~200 lines)
   - Database backup system
   - Restore functionality

## Migration Priority
1. ✅ CRM (done)
2. ✅ Staff (done)
3. ✅ Cashfree (done)
4. ✅ HR (done)
5. 🔄 Social Webhooks (next)
6. 🔄 Shop/E-commerce
7. 🔄 Admin Auth
8. 🔄 Notifications
9. 🔄 Tasks
10. 🔄 Leads Import
11. 🔄 Analytics
12. 🔄 Backup

## Implementation Notes
- Each module should have its own router with a prefix
- Shared utilities stay in `server.py` or move to `/app/backend/utils/`
- Database connection (`db`) should be imported from a central config
- All modules should use consistent error handling
