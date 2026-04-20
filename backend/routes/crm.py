"""
CRM Management Router
Handles core CRM endpoints: leads, tasks, dashboard, widgets, and staff management
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
import uuid
import asyncio
import logging
from security import require_admin_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["CRM Management"])

# Database and dependencies will be passed from main app
db = None
sanitize_input = None
cache_get = None
cache_set = None

def init_router(database, sanitize_fn=None, cache_get_fn=None, cache_set_fn=None):
    """Initialize router with database connection and utility functions"""
    global db, sanitize_input, cache_get, cache_set
    db = database
    sanitize_input = sanitize_fn or (lambda x: x)
    cache_get = cache_get_fn
    cache_set = cache_set_fn


# ==================== PYDANTIC MODELS ====================

class CRMLead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str = ""
    phone: str
    district: str = ""
    address: str = ""
    property_type: str = "residential"
    monthly_bill: Optional[int] = None
    roof_area: Optional[int] = None
    source: str = "manual"
    stage: str = "new"
    lead_status: str = "new"  # 'new', 'in_progress', 'follow_up', 'closed'
    is_new: bool = True  # Visual flag for "NEW" badge
    lead_score: int = 50
    ai_priority: str = "medium"
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    notes: str = ""
    follow_up_notes: str = ""
    next_follow_up: Optional[str] = None
    total_amount: float = 0
    advance_paid: float = 0
    pending_amount: float = 0
    status_history: List[Dict[str, Any]] = []
    first_contact_at: Optional[datetime] = None  # When staff first interacted
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CRMTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_type: str
    title: str
    description: str = ""
    staff_id: str
    staff_name: str = ""
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    due_date: str
    due_time: str = "10:00"
    priority: str = "medium"
    status: str = "pending"
    notes: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CRMEmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str = ""
    phone: str = ""
    role: str = "sales"
    department: str = "sales"
    is_active: bool = True
    leads_assigned: int = 0
    leads_converted: int = 0
    total_revenue: float = 0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



# ==================== NEW LEADS MANAGEMENT ENDPOINTS ====================

@router.get("/new-leads")
async def get_new_leads(limit: int = 50, page: int = 1, source: str = "whatsapp"):
    """
    Get fresh WhatsApp inquiries with is_new=True flag.
    Only returns leads from WhatsApp source (new customer messages).
    Excludes deleted leads.
    """
    skip = (page - 1) * limit
    
    # Build query - only WhatsApp leads by default, exclude deleted
    query = {
        "is_new": True,
        "$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]
    }
    if source == "whatsapp":
        query["source"] = {"$in": ["whatsapp", "whatsapp_direct", "whatsapp_reply", "whatsapp_button"]}
    # For 'all' - no source filter
    
    # Count total new leads
    total_count = await db.crm_leads.count_documents(query)
    
    # Fetch new leads sorted by newest first
    leads = await db.crm_leads.find(
        query,
        {"_id": 0}
    ).sort([("timestamp", -1)]).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total_count": total_count,
        "page": page,
        "per_page": limit,
        "has_more": (page * limit) < total_count
    }


@router.post("/leads/bulk-delete")
async def bulk_delete_leads(request: Request):
    """Soft delete - Move leads to trash (kept for 30 days)"""
    data = await request.json()
    lead_ids = data.get("lead_ids", [])
    actor = data.get("actor_id", "") or data.get("deleted_by", "") or "unknown"

    if not lead_ids:
        return {"success": False, "error": "No lead IDs provided"}

    now_iso = datetime.now(timezone.utc).isoformat()

    result = await db.crm_leads.update_many(
        {"id": {"$in": lead_ids}},
        {"$set": {
            "is_deleted": True,
            "deleted_at": now_iso,
            "deleted_by": actor,
        }}
    )

    # Audit log — non-blocking fire-and-forget
    try:
        from security import get_real_ip as _get_ip
        actor_ip = _get_ip(request)
        await db.admin_audit_log.insert_one({
            "action": "lead_bulk_soft_delete",
            "actor": actor,
            "actor_ip": actor_ip,
            "lead_ids": lead_ids,
            "affected_count": result.modified_count,
            "timestamp": now_iso,
        })
    except Exception as _ae:
        logger.warning(f"[Audit] lead_bulk_soft_delete log failed: {_ae}")

    return {
        "success": True,
        "deleted_count": result.modified_count,
        "message": f"{result.modified_count} leads moved to trash (will be permanently deleted after 30 days)"
    }


@router.get("/leads/trash")
async def get_deleted_leads(limit: int = 50, page: int = 1):
    """Get leads in trash (soft-deleted leads)"""
    skip = (page - 1) * limit
    
    # Also clean up leads older than 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    await db.crm_leads.delete_many({
        "is_deleted": True,
        "deleted_at": {"$lt": thirty_days_ago}
    })
    
    total_count = await db.crm_leads.count_documents({"is_deleted": True})
    leads = await db.crm_leads.find(
        {"is_deleted": True},
        {"_id": 0}
    ).sort([("deleted_at", -1)]).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total_count": total_count,
        "page": page,
        "per_page": limit
    }


@router.post("/leads/restore")
async def restore_leads(request: Request):
    """Restore leads from trash"""
    data = await request.json()
    lead_ids = data.get("lead_ids", [])
    
    if not lead_ids:
        return {"success": False, "error": "No lead IDs provided"}
    
    result = await db.crm_leads.update_many(
        {"id": {"$in": lead_ids}},
        {"$unset": {"is_deleted": "", "deleted_at": ""}}
    )
    
    return {
        "success": True,
        "restored_count": result.modified_count,
        "message": f"{result.modified_count} leads restored"
    }


@router.delete("/leads/permanent-delete")
async def permanent_delete_leads(request: Request):
    """Permanently delete leads (no recovery).

    Auth: requires `x-admin-token` header matching ADMIN_API_TOKEN env var
    (same token used for Cashfree sync and test-data cleanup endpoints).
    In dev with no token configured, the call is allowed with a warning.
    """
    require_admin_token(request)

    data = await request.json()
    lead_ids = data.get("lead_ids", [])
    actor = data.get("actor_id", "") or data.get("deleted_by", "") or "unknown"

    if not lead_ids:
        return {"success": False, "error": "No lead IDs provided"}

    now_iso = datetime.now(timezone.utc).isoformat()

    # Capture lead names before deletion for the audit log
    try:
        previews = await db.crm_leads.find(
            {"id": {"$in": lead_ids}}, {"id": 1, "name": 1, "phone": 1, "_id": 0}
        ).to_list(length=500)
    except Exception:
        previews = []

    result = await db.crm_leads.delete_many({"id": {"$in": lead_ids}})

    # Audit log
    try:
        from security import get_real_ip as _get_ip
        actor_ip = _get_ip(request)
        await db.admin_audit_log.insert_one({
            "action": "lead_permanent_delete",
            "actor": actor,
            "actor_ip": actor_ip,
            "lead_ids": lead_ids,
            "lead_previews": previews[:50],
            "affected_count": result.deleted_count,
            "timestamp": now_iso,
            "irreversible": True,
        })
    except Exception as _ae:
        logger.warning(f"[Audit] lead_permanent_delete log failed: {_ae}")

    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"{result.deleted_count} leads permanently deleted"
    }


@router.post("/leads/{lead_id}/mark-contacted")
async def mark_lead_contacted(lead_id: str):
    """
    Mark a lead as contacted - removes the NEW badge.
    Called when staff first interacts with the lead.
    """
    lead = await db.crm_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = {
        "is_new": False,
        "lead_status": "in_progress",
        "first_contact_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Only update stage if it's still 'new'
    if lead.get("stage") == "new":
        update_data["stage"] = "contacted"
    
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_data})
    
    return {"success": True, "message": "Lead marked as contacted"}


@router.post("/leads/bulk-mark-contacted")
async def bulk_mark_leads_contacted(request: Request):
    """Bulk mark multiple leads as contacted"""
    data = await request.json()
    lead_ids = data.get("lead_ids", [])
    
    if not lead_ids:
        return {"success": False, "error": "No lead IDs provided"}
    
    result = await db.crm_leads.update_many(
        {"id": {"$in": lead_ids}},
        {"$set": {
            "is_new": False,
            "lead_status": "in_progress",
            "first_contact_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"{result.modified_count} leads marked as contacted"
    }


@router.get("/new-leads/count")
async def get_new_leads_count(source: str = "all"):
    """Quick count of new leads for badge display"""
    query = {"is_new": True}
    if source == "whatsapp":
        query["source"] = {"$in": ["whatsapp", "whatsapp_direct", "whatsapp_reply", "whatsapp_button"]}
    # For 'all' - count all new leads regardless of source
    count = await db.crm_leads.count_documents(query)
    return {"count": count}



# ==================== WIDGET ENDPOINTS ====================

@router.get("/widget/stats")
async def get_crm_stats_widget():
    """CRM quick stats - loads first"""
    cache_key = "crm_stats"
    if cache_get:
        cached_data = await cache_get(cache_key)
        if cached_data:
            return cached_data
    
    # Query both leads and crm_leads collections
    results = await asyncio.gather(
        db.leads.count_documents({}),
        db.crm_leads.count_documents({}),
        db.leads.count_documents({"status": "new"}),
        db.crm_leads.count_documents({"stage": "new"}),
        db.leads.count_documents({"status": "qualified"}),
        db.crm_leads.count_documents({"stage": "quotation"}),
        db.leads.count_documents({"status": "converted"}),
        db.crm_leads.count_documents({"stage": "completed"}),
        db.crm_staff_accounts.count_documents({"is_active": True}),
        db.crm_tasks.count_documents({"status": "pending"})
    )
    
    # Total leads from both collections
    total_leads = max(results[0], results[1])
    new_leads = results[2] + results[3]
    qualified_leads = results[4] + results[5]
    converted_leads = results[6] + results[7]
    
    response = {
        "total_leads": total_leads,
        "new_leads": new_leads,
        "qualified_leads": qualified_leads,
        "converted_leads": converted_leads,
        "active_staff": results[8],
        "pending_tasks": results[9]
    }
    
    if cache_set:
        await cache_set(cache_key, response, ttl=30)
    return response


@router.get("/widget/pipeline")
async def get_crm_pipeline_widget():
    """Get lead pipeline stages - optimized with parallel queries"""
    stages = ["new", "contacted", "site_visit", "quotation", "negotiation", "converted", "completed", "lost"]
    
    # Run all count queries in parallel for faster response
    counts = await asyncio.gather(*[
        db.crm_leads.count_documents({"stage": stage}) for stage in stages
    ])
    
    pipeline = {stage: count for stage, count in zip(stages, counts)}
    return {"pipeline": pipeline}


@router.get("/widget/recent-activity")
async def get_crm_recent_activity():
    """Get recent CRM activities"""
    # Get recent leads
    recent_leads = await db.crm_leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
    
    # Get recent follow-ups
    recent_followups = await db.crm_followups.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
    
    activities = []
    for lead in recent_leads:
        activities.append({
            "type": "new_lead",
            "title": f"New lead: {lead.get('name', 'Unknown')}",
            "subtitle": lead.get('district', ''),
            "timestamp": lead.get('timestamp', '')
        })
    
    for fu in recent_followups:
        activities.append({
            "type": "followup",
            "title": f"Follow-up: {fu.get('lead_name', 'Unknown')}",
            "subtitle": fu.get('notes', '')[:50],
            "timestamp": fu.get('timestamp', '')
        })
    
    # Sort by timestamp and return top 10
    activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"activities": activities[:10]}


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_crm_dashboard():
    """Get comprehensive CRM dashboard data - optimized for speed"""
    # Run all queries in parallel for faster response
    stages = ["new", "contacted", "site_visit", "quotation", "negotiation", "converted", "completed", "lost"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Parallel queries for all dashboard data
    results = await asyncio.gather(
        db.crm_leads.count_documents({}),  # 0: total
        *[db.crm_leads.count_documents({"stage": stage}) for stage in stages],  # 1-8: pipeline counts
        db.crm_followups.count_documents({"scheduled_date": today}),  # 9: today's followups
        db.crm_staff_accounts.count_documents({"is_active": True}),  # 10: active staff
        db.crm_leads.find({}, {"_id": 0, "name": 1, "phone": 1, "stage": 1, "source": 1, "district": 1, "timestamp": 1}).sort("timestamp", -1).limit(10).to_list(10),  # 11: recent leads
        db.crm_leads.aggregate([
            {"$group": {"_id": "$source", "count": {"$sum": 1}}}
        ]).to_list(20),  # 12: source breakdown
    )
    
    total_leads = results[0]
    pipeline_stats = {stage: results[i+1] for i, stage in enumerate(stages)}
    todays_followups = results[9]
    active_staff = results[10]
    recent_leads = results[11]
    source_breakdown = {item["_id"]: item["count"] for item in results[12] if item["_id"]}
    
    converted_count = pipeline_stats.get("converted", 0) + pipeline_stats.get("completed", 0)
    
    return {
        "total_leads": total_leads,
        "pipeline_stats": pipeline_stats,
        "source_stats": source_breakdown,
        "todays_followups": todays_followups,
        "active_staff": active_staff,
        "recent_leads": recent_leads,
        "conversion_rate": round(converted_count / max(total_leads, 1) * 100, 1)
    }


@router.get("/stats/quick")
async def get_quick_stats():
    """Quick stats for dashboard header"""
    results = await asyncio.gather(
        db.crm_leads.count_documents({}),
        db.crm_leads.count_documents({"stage": "new"}),
        db.crm_leads.count_documents({"stage": {"$in": ["converted", "completed"]}}),
        db.crm_tasks.count_documents({"status": "pending"})
    )
    return {
        "total_leads": results[0],
        "new_leads": results[1],
        "converted": results[2],
        "pending_tasks": results[3]
    }


# ==================== EMPLOYEE MANAGEMENT ====================

@router.get("/employees")
async def get_crm_employees():
    """Get all CRM employees"""
    employees = await db.crm_employees.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return employees


@router.post("/employees")
async def create_crm_employee(data: Dict[str, Any]):
    """Create CRM employee"""
    employee = CRMEmployee(
        name=sanitize_input(data.get("name", "")),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        role=data.get("role", "sales"),
        department=data.get("department", "sales")
    )
    doc = employee.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_employees.insert_one(doc)
    return employee


@router.put("/employees/{employee_id}")
async def update_crm_employee(employee_id: str, data: Dict[str, Any]):
    """Update CRM employee"""
    update_data = {k: sanitize_input(v) if isinstance(v, str) else v for k, v in data.items()}
    await db.crm_employees.update_one({"id": employee_id}, {"$set": update_data})
    return {"success": True}


@router.delete("/employees/{employee_id}")
async def delete_crm_employee(employee_id: str):
    """Delete CRM employee"""
    await db.crm_employees.delete_one({"id": employee_id})
    return {"success": True}


# ==================== LEAD MANAGEMENT ====================

@router.get("/leads")
async def get_crm_leads(stage: Optional[str] = None, assigned_to: Optional[str] = None, page: int = 1, limit: int = 100):
    """Get all CRM leads with optional filters (excludes deleted leads)"""
    # Base query excludes deleted leads
    query = {"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}
    
    if stage:
        query["stage"] = stage
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    skip = (page - 1) * limit
    total_count = await db.crm_leads.count_documents(query)
    leads = await db.crm_leads.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "pagination": {
            "current_page": page,
            "total_pages": (total_count + limit - 1) // limit,
            "total_count": total_count,
            "per_page": limit,
            "has_next": (page * limit) < total_count,
            "has_prev": page > 1
        }
    }


@router.post("/leads")
async def create_crm_lead(data: Dict[str, Any]):
    """Create new CRM lead with AI scoring"""
    # AI lead scoring and priority
    monthly_bill = data.get("monthly_bill") or 0
    lead_score = min(100, 40 + int(monthly_bill / 100))
    ai_priority = "high" if lead_score >= 80 else "medium" if lead_score >= 60 else "low"
    
    # Process notes into follow_up_notes
    notes = data.get("notes", "")
    follow_up_notes = ""
    if notes:
        follow_up_notes = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Initial Notes: {notes}"
    
    lead = CRMLead(
        name=sanitize_input(data.get("name", "")),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        district=data.get("district", ""),
        address=sanitize_input(data.get("address", "")),
        property_type=data.get("property_type", "residential"),
        monthly_bill=data.get("monthly_bill"),
        roof_area=data.get("roof_area"),
        source=data.get("source", "manual"),
        stage="new",
        lead_score=lead_score,
        ai_priority=ai_priority,
        follow_up_notes=follow_up_notes,
        next_follow_up=(datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
        status_history=[{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": f"Lead created via {data.get('source', 'manual')}"}]
    )
    doc = lead.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_leads.insert_one(doc)
    
    logger.info(f"CRM lead created: {data.get('name')} from source: {data.get('source', 'manual')}")
    return lead


@router.put("/leads/{lead_id}")
async def update_crm_lead(lead_id: str, data: Dict[str, Any]):
    """Update CRM lead"""
    current_lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not current_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Track stage changes
    if "stage" in data and data["stage"] != current_lead.get("stage"):
        history_entry = {
            "stage": data["stage"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": data.get("notes", f"Stage changed to {data['stage']}")
        }
        status_history = current_lead.get("status_history", [])
        status_history.append(history_entry)
        data["status_history"] = status_history
    
    # Calculate pending amount
    if "total_amount" in data or "advance_paid" in data:
        total = data.get("total_amount", current_lead.get("total_amount", 0))
        advance = data.get("advance_paid", current_lead.get("advance_paid", 0))
        data["pending_amount"] = total - advance
    
    update_data = {k: sanitize_input(v) if isinstance(v, str) and k not in ["status_history"] else v for k, v in data.items()}
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_data})
    return {"success": True}


@router.post("/leads/{lead_id}/assign")
async def assign_lead(lead_id: str, data: Dict[str, Any]):
    """Assign lead to staff member"""
    employee_id = data.get("employee_id")
    
    # Get lead details
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get staff details
    staff = await db.crm_staff_accounts.find_one({"id": employee_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Update lead
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": {
            "assigned_to": employee_id,
            "assigned_to_name": staff.get("name"),
            "assigned_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update staff lead count
    await db.crm_staff_accounts.update_one(
        {"id": employee_id},
        {"$inc": {"leads_assigned": 1}}
    )
    
    return {"success": True, "assigned_to": staff.get("name")}


# ==================== TASK MANAGEMENT ====================

@router.get("/tasks")
async def get_crm_tasks(staff_id: Optional[str] = None, status: Optional[str] = None):
    """Get CRM tasks"""
    query = {}
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    tasks = await db.crm_tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
    return tasks


@router.post("/tasks")
async def create_crm_task(data: Dict[str, Any]):
    """Create CRM task"""
    # Get staff name
    staff = await db.crm_staff_accounts.find_one({"id": data.get("staff_id")}, {"_id": 0})
    staff_name = staff.get("name", "Unknown") if staff else "Unknown"
    
    # Get lead name if provided
    lead_name = ""
    if data.get("lead_id"):
        lead = await db.crm_leads.find_one({"id": data.get("lead_id")}, {"_id": 0})
        lead_name = lead.get("name", "") if lead else ""
    
    task = CRMTask(
        task_type=data.get("task_type", "call"),
        title=sanitize_input(data.get("title", "")),
        description=sanitize_input(data.get("description", "")),
        staff_id=data.get("staff_id"),
        staff_name=staff_name,
        lead_id=data.get("lead_id"),
        lead_name=lead_name,
        due_date=data.get("due_date"),
        due_time=data.get("due_time", "10:00"),
        priority=data.get("priority", "medium"),
        status="pending"
    )
    doc = task.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_tasks.insert_one(doc)
    return task


@router.put("/tasks/{task_id}")
async def update_crm_task(task_id: str, data: Dict[str, Any]):
    """Update CRM task"""
    await db.crm_tasks.update_one({"id": task_id}, {"$set": data})
    return {"success": True}


@router.delete("/tasks/{task_id}")
async def delete_crm_task(task_id: str):
    """Delete CRM task"""
    await db.crm_tasks.delete_one({"id": task_id})
    return {"success": True}


# ==================== FOLLOW-UPS ====================

@router.get("/followups")
async def get_crm_followups(lead_id: Optional[str] = None):
    """Get follow-ups"""
    query = {}
    if lead_id:
        query["lead_id"] = lead_id
    followups = await db.crm_followups.find(query, {"_id": 0}).sort("scheduled_date", -1).to_list(200)
    return followups


@router.post("/followups")
async def create_crm_followup(data: Dict[str, Any]):
    """Create follow-up"""
    followup_id = str(uuid.uuid4())
    
    # Get lead name
    lead_name = ""
    if data.get("lead_id"):
        lead = await db.crm_leads.find_one({"id": data.get("lead_id")}, {"_id": 0})
        lead_name = lead.get("name", "") if lead else ""
    
    followup = {
        "id": followup_id,
        "lead_id": data.get("lead_id"),
        "lead_name": lead_name,
        "scheduled_date": data.get("scheduled_date"),
        "scheduled_time": data.get("scheduled_time", "10:00"),
        "followup_type": data.get("followup_type", "call"),
        "notes": sanitize_input(data.get("notes", "")),
        "status": "scheduled",
        "employee_id": data.get("employee_id"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_followups.insert_one(followup)
    
    # Update lead's next follow-up date
    if data.get("lead_id"):
        await db.crm_leads.update_one(
            {"id": data.get("lead_id")},
            {"$set": {"next_follow_up": data.get("scheduled_date")}}
        )
    
    return {"success": True, "followup": {k: v for k, v in followup.items() if k != "_id"}}


@router.get("/followups/today")
async def get_todays_followups():
    """Get today's follow-ups"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    followups = await db.crm_followups.find(
        {"scheduled_date": today, "status": {"$ne": "completed"}},
        {"_id": 0}
    ).to_list(100)
    return {"followups": followups, "count": len(followups)}


@router.put("/followups/{followup_id}")
async def update_crm_followup(followup_id: str, data: Dict[str, Any]):
    """Update follow-up"""
    await db.crm_followups.update_one({"id": followup_id}, {"$set": data})
    return {"success": True}


# ==================== ACTIVITIES ====================

@router.get("/leads/{lead_id}/activities")
async def get_lead_activities(lead_id: str):
    """Get activities for a specific lead"""
    activities = await db.crm_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return activities


@router.post("/leads/{lead_id}/activities")
async def add_lead_activity(lead_id: str, data: Dict[str, Any]):
    """Add activity to a lead"""
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "activity_type": data.get("activity_type", "note"),
        "description": sanitize_input(data.get("description", "")),
        "created_by": data.get("created_by", "admin"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.crm_activities.insert_one(activity)
    return {"success": True, "activity": {k: v for k, v in activity.items() if k != "_id"}}


# ==================== REPORTS ====================

@router.get("/reports/monthly")
async def get_monthly_report():
    """Get monthly CRM report"""
    # Get current month's data
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Count leads created this month
    all_leads = await db.crm_leads.find({}, {"_id": 0}).to_list(1000)
    
    monthly_leads = [lead for lead in all_leads if lead.get("timestamp", "") >= month_start.isoformat()]
    converted = [lead for lead in all_leads if lead.get("stage") in ["converted", "completed"]]
    
    # Revenue calculation
    total_revenue = sum(lead.get("total_amount", 0) for lead in converted)
    
    # Source breakdown
    source_breakdown = {}
    for lead in monthly_leads:
        source = lead.get("source", "manual")
        source_breakdown[source] = source_breakdown.get(source, 0) + 1
    
    return {
        "month": now.strftime("%B %Y"),
        "new_leads": len(monthly_leads),
        "total_leads": len(all_leads),
        "converted": len(converted),
        "conversion_rate": round(len(converted) / max(len(all_leads), 1) * 100, 1),
        "total_revenue": total_revenue,
        "source_breakdown": source_breakdown
    }


# ==================== LEADERBOARD ====================

@router.get("/leaderboard")
async def get_leaderboard():
    """Get staff leaderboard"""
    staff_list = await db.crm_staff_accounts.find({"is_active": True}, {"_id": 0}).to_list(50)
    
    leaderboard = []
    for staff in staff_list:
        # Calculate conversion rate
        assigned = staff.get("leads_assigned", 0)
        converted = staff.get("leads_converted", 0)
        conversion_rate = round(converted / max(assigned, 1) * 100, 1)
        
        leaderboard.append({
            "id": staff.get("id"),
            "staff_id": staff.get("staff_id"),
            "name": staff.get("name"),
            "role": staff.get("role"),
            "leads_assigned": assigned,
            "leads_converted": converted,
            "conversion_rate": conversion_rate,
            "total_revenue": staff.get("total_revenue", 0),
            "score": converted * 100 + conversion_rate * 10 + staff.get("total_revenue", 0) / 10000
        })
    
    # Sort by score
    leaderboard.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    # Add rank
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return {"leaderboard": leaderboard}



# ==================== ADVANCED LEADS MANAGEMENT ENDPOINTS ====================

@router.get("/leads/advanced")
async def get_leads_advanced(
    page: int = 1,
    limit: int = 250,
    search: str = None,
    source: str = None,
    stage: str = None,
    priority: str = None,
    assigned_to: str = None,
    district: str = None,
    property_type: str = None,
    quick_filter: str = None,
    sort: str = "newest"
):
    """
    Advanced leads endpoint with comprehensive filtering, sorting, and stats.
    Supports search by name, phone, email, district, and lead ID.
    """
    skip = (page - 1) * limit
    
    # Build base query - exclude deleted
    query = {"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}
    
    # Apply filters
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$and"] = query.get("$and", [])
        query["$and"].append({
            "$or": [
                {"name": search_regex},
                {"phone": search_regex},
                {"email": search_regex},
                {"district": search_regex},
                {"id": search_regex}
            ]
        })
    
    if source:
        # Handle multiple source types for whatsapp
        if source == "whatsapp":
            query["source"] = {"$in": ["whatsapp", "whatsapp_direct", "whatsapp_reply", "whatsapp_button"]}
        else:
            query["source"] = source
    
    if stage:
        query["stage"] = stage
    
    if priority:
        query["priority"] = priority
    
    if district:
        query["district"] = district
    
    if property_type:
        query["property_type"] = property_type
    
    if assigned_to:
        if assigned_to == "unassigned":
            query["$or"] = [{"assigned_to": None}, {"assigned_to": {"$exists": False}}, {"assigned_to": ""}]
        else:
            query["assigned_to"] = assigned_to
    
    # Quick filters
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    two_days_ago = (now - timedelta(hours=48)).isoformat()
    
    if quick_filter == "fresh":
        query["timestamp"] = {"$gte": two_days_ago}
        query["is_new"] = True
    elif quick_filter == "today":
        query["timestamp"] = {"$gte": today_start}
    elif quick_filter == "follow_up_due":
        today_str = now.strftime("%Y-%m-%d")
        query["next_follow_up"] = {"$lte": today_str}
    elif quick_filter == "unassigned":
        query["$or"] = [{"assigned_to": None}, {"assigned_to": {"$exists": False}}, {"assigned_to": ""}]
    elif quick_filter == "hot_leads":
        query["priority"] = "hot"
    elif quick_filter == "converted":
        query["stage"] = {"$in": ["converted", "completed"]}
    elif quick_filter == "lost":
        query["stage"] = "lost"
    
    # Sorting
    sort_field = [("timestamp", -1)]  # Default: newest first
    if sort == "oldest":
        sort_field = [("timestamp", 1)]
    elif sort == "name_asc":
        sort_field = [("name", 1)]
    elif sort == "name_desc":
        sort_field = [("name", -1)]
    elif sort == "recently_updated":
        sort_field = [("updated_at", -1), ("timestamp", -1)]
    
    # Get total count and leads
    total_count = await db.crm_leads.count_documents(query)
    leads = await db.crm_leads.find(query, {"_id": 0}).sort(sort_field).skip(skip).limit(limit).to_list(limit)
    
    # Calculate stats
    base_query = {"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}
    
    stats_results = await asyncio.gather(
        db.crm_leads.count_documents(base_query),  # total
        db.crm_leads.count_documents({**base_query, "timestamp": {"$gte": two_days_ago}, "is_new": True}),  # fresh
        db.crm_leads.count_documents({**base_query, "timestamp": {"$gte": today_start}}),  # today
        db.crm_leads.count_documents({**base_query, "next_follow_up": {"$lte": now.strftime("%Y-%m-%d")}}),  # follow_up_due
        db.crm_leads.count_documents({**base_query, "priority": "hot"}),  # hot
        db.crm_leads.count_documents({**base_query, "stage": {"$in": ["converted", "completed"]}}),  # converted
        db.crm_leads.count_documents({**base_query, "stage": "lost"}),  # lost
        db.crm_leads.count_documents({**base_query, "$or": [{"assigned_to": None}, {"assigned_to": {"$exists": False}}, {"assigned_to": ""}]}),  # unassigned
    )
    
    stats = {
        "total": stats_results[0],
        "fresh": stats_results[1],
        "today": stats_results[2],
        "follow_up_due": stats_results[3],
        "hot": stats_results[4],
        "converted": stats_results[5],
        "lost": stats_results[6],
        "unassigned": stats_results[7]
    }
    
    return {
        "leads": leads,
        "pagination": {
            "current_page": page,
            "total_pages": (total_count + limit - 1) // limit,
            "total_count": total_count,
            "per_page": limit,
            "has_next": (page * limit) < total_count,
            "has_prev": page > 1
        },
        "stats": stats
    }


@router.get("/leads/stats")
async def get_leads_stats():
    """Get comprehensive lead statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    two_days_ago = (now - timedelta(hours=48)).isoformat()
    
    base_query = {"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}
    
    results = await asyncio.gather(
        db.crm_leads.count_documents(base_query),
        db.crm_leads.count_documents({**base_query, "timestamp": {"$gte": two_days_ago}, "is_new": True}),
        db.crm_leads.count_documents({**base_query, "timestamp": {"$gte": today_start}}),
        db.crm_leads.count_documents({**base_query, "next_follow_up": {"$lte": now.strftime("%Y-%m-%d")}}),
        db.crm_leads.count_documents({**base_query, "priority": "hot"}),
        db.crm_leads.count_documents({**base_query, "stage": {"$in": ["converted", "completed"]}}),
        db.crm_leads.count_documents({**base_query, "stage": "lost"}),
        db.crm_leads.count_documents({**base_query, "$or": [{"assigned_to": None}, {"assigned_to": {"$exists": False}}, {"assigned_to": ""}]}),
    )
    
    return {
        "total": results[0],
        "fresh": results[1],
        "today": results[2],
        "follow_up_due": results[3],
        "hot": results[4],
        "converted": results[5],
        "lost": results[6],
        "unassigned": results[7]
    }


@router.post("/leads/bulk-assign")
async def bulk_assign_leads(request: Request):
    """Bulk assign leads to a staff member"""
    data = await request.json()
    lead_ids = data.get("lead_ids", [])
    staff_id = data.get("staff_id")
    
    if not lead_ids or not staff_id:
        return {"success": False, "error": "Lead IDs and staff ID are required"}
    
    # Get staff details
    staff = await db.crm_staff_accounts.find_one({"id": staff_id}, {"_id": 0})
    staff_name = staff.get("name", "Unknown") if staff else "Unknown"
    
    result = await db.crm_leads.update_many(
        {"id": {"$in": lead_ids}},
        {"$set": {
            "assigned_to": staff_id,
            "assigned_to_name": staff_name,
            "assigned_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update staff lead count
    if staff:
        await db.crm_staff_accounts.update_one(
            {"id": staff_id},
            {"$inc": {"leads_assigned": result.modified_count}}
        )
    
    return {
        "success": True,
        "assigned_count": result.modified_count,
        "message": f"{result.modified_count} leads assigned to {staff_name}"
    }


@router.post("/leads/bulk-update")
async def bulk_update_leads(request: Request):
    """Bulk update leads with specified fields"""
    data = await request.json()
    lead_ids = data.get("lead_ids", [])
    updates = data.get("updates", {})
    
    if not lead_ids or not updates:
        return {"success": False, "error": "Lead IDs and updates are required"}
    
    # Add timestamp for updates
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.crm_leads.update_many(
        {"id": {"$in": lead_ids}},
        {"$set": updates}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"{result.modified_count} leads updated"
    }


@router.post("/leads/{lead_id}/trash")
async def trash_single_lead(lead_id: str):
    """Soft delete a single lead"""
    result = await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {"success": True, "message": "Lead moved to trash"}


@router.get("/leads/{lead_id}/timeline")
async def get_lead_timeline(lead_id: str):
    """Get complete activity timeline for a lead"""
    # Get lead data
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    activities = []
    
    # Add status history
    for entry in lead.get("status_history", []):
        activities.append({
            "type": "status_change",
            "title": f"Stage changed to {entry.get('stage', 'unknown')}",
            "notes": entry.get("notes", ""),
            "timestamp": entry.get("timestamp", "")
        })
    
    # Get follow-ups
    followups = await db.crm_followups.find({"lead_id": lead_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    for fu in followups:
        activities.append({
            "type": "followup",
            "title": f"Follow-up: {fu.get('followup_type', 'call')}",
            "notes": fu.get("notes", ""),
            "status": fu.get("status", "scheduled"),
            "timestamp": fu.get("timestamp", "")
        })
    
    # Get activities
    lead_activities = await db.crm_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    for act in lead_activities:
        activities.append({
            "type": act.get("activity_type", "note"),
            "title": act.get("description", ""),
            "notes": "",
            "timestamp": act.get("timestamp", "")
        })
    
    # Sort all by timestamp
    activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    return {"lead_id": lead_id, "activities": activities[:100]}


@router.post("/leads/check-duplicate")
async def check_duplicate_lead(request: Request):
    """Check for duplicate leads by phone or email"""
    data = await request.json()
    phone = data.get("phone", "")
    email = data.get("email", "")
    
    if not phone and not email:
        return {"duplicates": [], "is_duplicate": False}
    
    # Clean phone number
    clean_phone = phone.replace("+91", "").replace(" ", "").replace("-", "")[-10:] if phone else None
    
    query_conditions = []
    if clean_phone:
        query_conditions.append({"phone": {"$regex": clean_phone}})
    if email:
        query_conditions.append({"email": {"$regex": email, "$options": "i"}})
    
    if not query_conditions:
        return {"duplicates": [], "is_duplicate": False}
    
    duplicates = await db.crm_leads.find(
        {
            "$and": [
                {"$or": query_conditions},
                {"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "phone": 1, "email": 1, "source": 1, "stage": 1, "timestamp": 1}
    ).limit(5).to_list(5)
    
    return {
        "duplicates": duplicates,
        "is_duplicate": len(duplicates) > 0
    }
