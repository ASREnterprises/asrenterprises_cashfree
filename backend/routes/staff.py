"""
Staff Portal Router
Handles all staff-related endpoints: login, leads, tasks, training, notifications
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
import uuid
import hashlib
import re
import logging

router = APIRouter(prefix="/staff", tags=["Staff Portal"])

# Database and utilities will be passed from main app
db = None
sanitize_input = None
logger = logging.getLogger(__name__)

def init_router(database, sanitize_func):
    """Initialize router with database connection and utilities"""
    global db, sanitize_input
    db = database
    sanitize_input = sanitize_func

# ==================== STAFF LOGIN ENDPOINTS ====================

@router.post("/login")
async def staff_login(data: Dict[str, Any]):
    """Staff login with Staff ID and Password"""
    staff_id = data.get("staff_id", "").strip()
    password = data.get("password", "")
    
    if not staff_id or not password:
        raise HTTPException(status_code=400, detail="Staff ID and password are required")
    
    # Find staff by staff_id
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": {"$regex": f"^{staff_id}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not staff.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")
    
    # Verify password - check both hashed and plain
    stored_password = staff.get("password_hash") or staff.get("password", "")
    if stored_password.startswith("sha256:"):
        # Hashed password
        password_hash = f"sha256:{hashlib.sha256(password.encode()).hexdigest()}"
        if stored_password != password_hash:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    else:
        # Plain password (legacy)
        if stored_password != password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if 2FA/OTP is enabled
    if staff.get("otp_login_enabled", False):
        return {
            "requires_2fa": True,
            "staff_id": staff.get("staff_id"),
            "message": "Please verify with OTP sent to your mobile"
        }
    
    # Update last login
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff.get("staff_id")},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "staff_id": staff.get("staff_id"),
        "name": staff.get("name"),
        "role": staff.get("role"),
        "id": staff.get("id"),
        "requires_2fa": False
    }

@router.post("/login-email")
async def staff_login_email(data: Dict[str, Any]):
    """Staff login with Email and Password (no OTP required)"""
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Find staff by email
    staff = await db.crm_staff_accounts.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not staff.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")
    
    # Verify password - check both hashed and plain
    stored_password = staff.get("password_hash") or staff.get("password", "")
    if stored_password.startswith("sha256:"):
        # Hashed password
        password_hash = f"sha256:{hashlib.sha256(password.encode()).hexdigest()}"
        if stored_password != password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    else:
        # Plain password (legacy)
        if stored_password != password:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Email login bypasses 2FA
    await db.crm_staff_accounts.update_one(
        {"email": staff.get("email")},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "staff_id": staff.get("staff_id"),
        "name": staff.get("name"),
        "role": staff.get("role"),
        "id": staff.get("id"),
        "message": "Login successful (email authentication)"
    }

# ==================== STAFF LEADS ENDPOINTS ====================

@router.get("/{staff_id}/leads")
async def get_staff_assigned_leads(staff_id: str, page: int = 1, limit: int = 150):
    """Get leads assigned to this staff member with pagination"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    staff_internal_id = staff.get("id")
    
    # Get total count
    total_count = await db.crm_leads.count_documents({"assigned_to": staff_internal_id})
    
    # Calculate pagination
    skip = (page - 1) * limit
    total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
    
    # Get paginated leads
    leads = await db.crm_leads.find(
        {"assigned_to": staff_internal_id},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "pagination": {
            "current_page": page,
            "total_pages": total_pages,
            "total_count": total_count,
            "per_page": limit,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }

@router.put("/{staff_id}/leads/{lead_id}")
async def staff_update_lead(staff_id: str, lead_id: str, data: Dict[str, Any]):
    """Staff updates their assigned lead"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    lead = await db.crm_leads.find_one({"id": lead_id, "assigned_to": staff.get("id")}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    
    update_fields = {}
    if "stage" in data:
        history_entry = {
            "stage": data["stage"],
            "updated_by": staff_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": data.get("notes", f"Status changed to {data['stage']}")
        }
        status_history = lead.get("status_history", [])
        status_history.append(history_entry)
        update_fields["status_history"] = status_history
        update_fields["stage"] = data["stage"]
    
    if "follow_up_notes" in data:
        update_fields["follow_up_notes"] = sanitize_input(data["follow_up_notes"])
    if "next_follow_up" in data:
        update_fields["next_follow_up"] = data["next_follow_up"]
    if "survey_done" in data:
        update_fields["survey_done"] = data["survey_done"]
    if "quoted_amount" in data:
        update_fields["quoted_amount"] = data["quoted_amount"]
    # Call tracking fields
    if "call_status" in data:
        update_fields["call_status"] = data["call_status"]
    if "last_call_at" in data:
        update_fields["last_call_at"] = data["last_call_at"]
    
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_fields})
    
    if data.get("stage") == "completed":
        await db.crm_staff_accounts.update_one(
            {"staff_id": staff_id},
            {"$inc": {"leads_converted": 1}}
        )
    
    return {"success": True}

@router.post("/{staff_id}/leads/{lead_id}/not-interested")
async def staff_mark_lead_not_interested(staff_id: str, lead_id: str):
    """
    Mark a lead as not interested and transfer back to CRM pool.
    This unassigns the lead from the staff and sets stage to 'contacted'.
    """
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    lead = await db.crm_leads.find_one({"id": lead_id, "assigned_to": staff.get("id")}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=403, detail="Not authorized to update this lead or lead not found")
    
    history_entry = {
        "stage": "contacted",
        "updated_by": staff_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": f"Marked as not interested by {staff.get('name', staff_id)}. Returned to CRM pool."
    }
    status_history = lead.get("status_history", [])
    status_history.append(history_entry)
    
    update_fields = {
        "assigned_to": None,
        "assigned_by": None,
        "stage": "contacted",
        "status_history": status_history,
        "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Not Interested - Returned to CRM pool by {staff.get('name', staff_id)}. " + (lead.get("follow_up_notes") or "")
    }
    
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_fields})
    
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$inc": {"leads_assigned": -1}}
    )
    
    logger.info(f"Lead {lead_id} marked as not interested by staff {staff_id}, returned to CRM pool")
    
    return {"success": True, "message": "Lead marked as not interested and returned to CRM pool"}

@router.post("/{staff_id}/leads")
async def staff_create_lead(staff_id: str, data: Dict[str, Any]):
    """Allow staff to create new leads"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    lead_id = str(uuid.uuid4())
    lead = {
        "id": lead_id,
        "name": sanitize_input(data.get("name", "")),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "district": data.get("district", ""),
        "address": sanitize_input(data.get("address", "")),
        "property_type": data.get("property_type", "residential"),
        "monthly_bill": data.get("monthly_bill"),
        "roof_area": data.get("roof_area"),
        "source": "staff_entry",
        "stage": "new",
        "assigned_to": staff.get("id"),
        "assigned_by": staff_id,
        "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
        "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Created by {staff.get('name')}. {data.get('notes', '')}",
        "lead_score": 50,
        "ai_priority": "medium",
        "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": f"Created by staff {staff_id}"}],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_leads.insert_one(lead)
    await db.crm_staff_accounts.update_one({"staff_id": staff_id}, {"$inc": {"leads_assigned": 1}})
    
    return {"success": True, "lead_id": lead_id}

# ==================== STAFF DASHBOARD ====================

@router.get("/{staff_id}/dashboard")
async def get_staff_dashboard(staff_id: str):
    """Staff dashboard with their stats - optimized for speed"""
    import asyncio
    
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    internal_id = staff.get("id")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Run all queries in parallel for faster response
    results = await asyncio.gather(
        db.crm_leads.aggregate([
            {"$match": {"assigned_to": internal_id}},
            {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
        ]).to_list(20),
        db.crm_followups.find(
            {"employee_id": internal_id, "reminder_date": today, "status": "pending"},
            {"_id": 0}
        ).to_list(20),
        db.crm_leads.find(
            {"assigned_to": internal_id},
            {"_id": 0, "name": 1, "phone": 1, "stage": 1, "district": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(5).to_list(5)
    )
    
    pipeline_stats = results[0]
    todays_followups = results[1]
    recent_leads = results[2]
    
    return {
        "staff": staff,
        "pipeline_stats": {item["_id"]: item["count"] for item in pipeline_stats if item["_id"]},
        "total_assigned": staff.get("leads_assigned", 0),
        "total_converted": staff.get("leads_converted", 0),
        "todays_followups": todays_followups,
        "recent_leads": recent_leads
    }

# ==================== STAFF FOLLOWUPS ====================

@router.get("/{staff_id}/followups")
async def get_staff_followups(staff_id: str):
    """Get follow-up reminders for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    followups = await db.crm_followups.find(
        {"employee_id": staff.get("id")},
        {"_id": 0}
    ).sort("reminder_date", 1).to_list(100)
    
    return followups

@router.post("/{staff_id}/followups")
async def staff_create_followup(staff_id: str, data: Dict[str, Any]):
    """Staff creates follow-up reminder"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    followup = {
        "id": str(uuid.uuid4()),
        "lead_id": data.get("lead_id", ""),
        "employee_id": staff.get("id"),
        "reminder_date": data.get("reminder_date", ""),
        "reminder_time": data.get("reminder_time", "10:00"),
        "reminder_type": data.get("reminder_type", "call"),
        "notes": sanitize_input(data.get("notes", "")),
        "status": "pending",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.crm_followups.insert_one(followup)
    
    await db.crm_leads.update_one(
        {"id": data.get("lead_id")},
        {"$set": {"next_follow_up": data.get("reminder_date")}}
    )
    
    return followup

@router.put("/{staff_id}/followups/{followup_id}")
async def staff_update_followup(staff_id: str, followup_id: str, data: Dict[str, Any]):
    """Staff marks follow-up as done"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    await db.crm_followups.update_one(
        {"id": followup_id, "employee_id": staff.get("id")},
        {"$set": {"status": data.get("status", "completed")}}
    )
    return {"success": True}

# ==================== STAFF NOTIFICATIONS ====================

@router.get("/{staff_id}/notifications")
async def get_staff_notifications(staff_id: str):
    """Get notifications for staff"""
    notifications = await db.staff_notifications.find(
        {"staff_id": staff_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    unread_count = await db.staff_notifications.count_documents({"staff_id": staff_id, "is_read": False})
    
    return {"notifications": notifications, "unread_count": unread_count}

@router.put("/{staff_id}/notifications/{notification_id}/read")
async def mark_notification_read(staff_id: str, notification_id: str):
    """Mark notification as read"""
    await db.staff_notifications.update_one(
        {"id": notification_id, "staff_id": staff_id},
        {"$set": {"is_read": True}}
    )
    return {"success": True}

@router.put("/{staff_id}/notifications/read-all")
async def mark_all_notifications_read(staff_id: str):
    """Mark all notifications as read"""
    await db.staff_notifications.update_many(
        {"staff_id": staff_id},
        {"$set": {"is_read": True}}
    )
    return {"success": True}

# ==================== STAFF TASKS ====================

@router.get("/{staff_id}/tasks")
async def get_staff_tasks(staff_id: str):
    """Get all tasks for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    tasks = await db.crm_tasks.find(
        {"staff_id": staff.get("id")},
        {"_id": 0}
    ).sort("due_date", -1).to_list(100)
    
    return tasks

@router.get("/{staff_id}/tasks/today")
async def get_staff_tasks_today(staff_id: str):
    """Get today's tasks for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tasks = await db.crm_tasks.find(
        {"staff_id": staff.get("id"), "due_date": today},
        {"_id": 0}
    ).sort("due_time", 1).to_list(50)
    
    return tasks

# ==================== STAFF MESSAGES ====================

@router.get("/{staff_id}/messages")
async def get_staff_messages(staff_id: str):
    """Get messages for staff (from admin)"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    messages = await db.crm_messages.find(
        {"$or": [
            {"sender_id": staff.get("id")},
            {"receiver_id": staff.get("id")},
            {"receiver_id": "admin", "sender_id": staff.get("id")},
            {"sender_id": "admin", "receiver_id": staff.get("id")}
        ]},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    
    return messages

@router.get("/{staff_id}/messages/unread")
async def get_staff_unread_count(staff_id: str):
    """Get unread message count for staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        return {"count": 0}
    
    count = await db.crm_messages.count_documents({
        "receiver_id": staff.get("id"),
        "is_read": False
    })
    
    return {"count": count}

# ==================== STAFF TRAINING ====================

@router.get("/{staff_id}/training")
async def get_staff_training(staff_id: str):
    """Get training modules and progress for a staff member"""
    employee = await db.hr_employees.find_one({"employee_id": staff_id}, {"_id": 0})
    
    modules = [
        {"id": "solar_basics", "title": "Solar Energy Basics", "description": "Learn fundamentals of solar power systems", "duration": "30 mins", "type": "video", "is_mandatory": True},
        {"id": "product_knowledge", "title": "Product Knowledge", "description": "ASR Enterprises product lineup and specifications", "duration": "45 mins", "type": "presentation", "is_mandatory": True},
        {"id": "sales_techniques", "title": "Sales Techniques", "description": "Effective solar sales strategies and customer handling", "duration": "1 hour", "type": "video", "is_mandatory": True},
        {"id": "installation_basics", "title": "Installation Overview", "description": "Understanding installation process and requirements", "duration": "45 mins", "type": "video", "is_mandatory": False},
        {"id": "crm_training", "title": "CRM System Training", "description": "How to use the ASR CRM effectively", "duration": "20 mins", "type": "interactive", "is_mandatory": True},
        {"id": "customer_service", "title": "Customer Service Excellence", "description": "Best practices for customer support", "duration": "30 mins", "type": "video", "is_mandatory": False},
        {"id": "company_policies", "title": "Company Policies", "description": "HR policies, leave management, and guidelines", "duration": "15 mins", "type": "document", "is_mandatory": True}
    ]
    
    progress_records = await db.staff_training_progress.find(
        {"staff_id": staff_id},
        {"_id": 0}
    ).to_list(50)
    
    completed_modules = {p["module_id"]: p for p in progress_records}
    
    for module in modules:
        if module["id"] in completed_modules:
            module["completed"] = True
            module["completed_at"] = completed_modules[module["id"]].get("completed_at")
        else:
            module["completed"] = False
    
    total = len(modules)
    completed = len([m for m in modules if m.get("completed")])
    
    return {
        "modules": modules,
        "total_modules": total,
        "completed_modules": completed,
        "progress_percentage": round((completed / total) * 100) if total > 0 else 0,
        "employee_info": employee
    }

@router.post("/{staff_id}/training/{module_id}/complete")
async def complete_training_module(staff_id: str, module_id: str):
    """Mark a training module as complete"""
    existing = await db.staff_training_progress.find_one(
        {"staff_id": staff_id, "module_id": module_id}
    )
    
    if existing:
        return {"success": True, "message": "Module already completed"}
    
    progress = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "module_id": module_id,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_training_progress.insert_one(progress)
    
    return {"success": True, "message": "Module marked as complete"}

# ==================== STAFF PROFILE ====================

@router.get("/profile/{staff_id}")
async def get_staff_profile(staff_id: str):
    """Get staff profile information"""
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id},
        {"_id": 0, "password": 0, "password_hash": 0}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    return staff
