"""
Advanced HR Features Router
- AI-driven Task Assignment
- OCR for Expense Reimbursement
- Attendance & Leave Management
- Performance Analytics
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
import base64
import httpx

router = APIRouter(prefix="/api/hr", tags=["HR Features"])

logger = logging.getLogger(__name__)

# Database reference
db = None

def set_database(database):
    """Set database reference from main application"""
    global db
    db = database


# ==================== AI TASK ASSIGNMENT ====================

class TaskAssignmentRequest(BaseModel):
    """Request for AI task assignment"""
    task_type: str  # lead, service, followup
    task_details: Dict[str, Any]
    priority: str = "medium"  # low, medium, high, urgent
    location: Optional[str] = None
    skills_required: List[str] = []


@router.post("/ai-assign-task")
async def ai_assign_task(request: TaskAssignmentRequest):
    """
    AI-driven task assignment based on staff workload, location, and skills
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        # Get all active staff members
        staff_list = await db.crm_staff_accounts.find(
            {"status": {"$ne": "inactive"}},
            {"_id": 0}
        ).to_list(100)
        
        if not staff_list:
            return {"success": False, "error": "No active staff available"}
        
        # Calculate scores for each staff member
        staff_scores = []
        
        for staff in staff_list:
            score = 100  # Base score
            
            # Factor 1: Current workload (fewer tasks = higher score)
            current_tasks = staff.get("assigned_leads_count", 0)
            max_tasks = staff.get("max_leads", 50)
            workload_ratio = current_tasks / max_tasks if max_tasks > 0 else 1
            score -= workload_ratio * 40  # Up to 40 points deduction for high workload
            
            # Factor 2: Location match
            if request.location and staff.get("district"):
                if request.location.lower() in staff.get("district", "").lower():
                    score += 20  # 20 points bonus for location match
            
            # Factor 3: Skills match
            staff_skills = staff.get("skills", [])
            if request.skills_required:
                matching_skills = len(set(request.skills_required) & set(staff_skills))
                score += matching_skills * 10  # 10 points per matching skill
            
            # Factor 4: Performance rating
            performance = staff.get("performance_score", 50)
            score += (performance - 50) * 0.3  # Adjust based on performance
            
            # Factor 5: Recent activity (active today = bonus)
            last_active = staff.get("last_active")
            if last_active:
                if isinstance(last_active, str):
                    last_active = datetime.fromisoformat(last_active.replace('Z', '+00:00'))
                hours_since_active = (datetime.now(timezone.utc) - last_active).total_seconds() / 3600
                if hours_since_active < 1:
                    score += 15  # Active in last hour
                elif hours_since_active < 8:
                    score += 10  # Active today
            
            # Priority adjustment
            if request.priority == "urgent" and staff.get("handle_urgent", True):
                score += 10
            
            staff_scores.append({
                "staff_id": staff.get("staff_id"),
                "name": staff.get("name"),
                "score": round(score, 2),
                "workload": f"{current_tasks}/{max_tasks}",
                "district": staff.get("district", "N/A")
            })
        
        # Sort by score (highest first)
        staff_scores.sort(key=lambda x: x["score"], reverse=True)
        
        # Select best match
        best_match = staff_scores[0] if staff_scores else None
        
        if best_match and best_match["score"] > 30:
            # Auto-assign if score is acceptable
            return {
                "success": True,
                "assigned_to": best_match,
                "reason": f"Best match based on workload, location, and skills",
                "all_candidates": staff_scores[:5],  # Top 5 candidates
                "auto_assigned": True
            }
        else:
            return {
                "success": True,
                "assigned_to": None,
                "reason": "No suitable staff found. Manual assignment recommended.",
                "all_candidates": staff_scores[:5],
                "auto_assigned": False
            }
            
    except Exception as e:
        logger.error(f"AI task assignment error: {str(e)}")
        return {"success": False, "error": str(e)}


@router.post("/bulk-ai-assign")
async def bulk_ai_assign_leads(data: Dict[str, Any]):
    """
    Bulk AI assignment for multiple leads
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    lead_ids = data.get("lead_ids", [])
    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")
    
    assignments = []
    
    for lead_id in lead_ids:
        # Get lead details
        lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            assignments.append({"lead_id": lead_id, "success": False, "error": "Lead not found"})
            continue
        
        # Use AI assignment
        request = TaskAssignmentRequest(
            task_type="lead",
            task_details={"lead_id": lead_id, "phone": lead.get("phone")},
            location=lead.get("district") or lead.get("location"),
            priority="medium"
        )
        
        result = await ai_assign_task(request)
        
        if result.get("auto_assigned") and result.get("assigned_to"):
            staff_id = result["assigned_to"]["staff_id"]
            
            # Update lead
            await db.crm_leads.update_one(
                {"id": lead_id},
                {"$set": {
                    "assigned_to": staff_id,
                    "assigned_at": datetime.now(timezone.utc),
                    "assignment_method": "ai_auto"
                }}
            )
            
            # Update staff count
            await db.crm_staff_accounts.update_one(
                {"staff_id": staff_id},
                {"$inc": {"assigned_leads_count": 1}}
            )
            
            assignments.append({
                "lead_id": lead_id,
                "success": True,
                "assigned_to": result["assigned_to"]["name"],
                "score": result["assigned_to"]["score"]
            })
        else:
            assignments.append({
                "lead_id": lead_id,
                "success": False,
                "candidates": result.get("all_candidates", [])[:3]
            })
    
    return {
        "success": True,
        "total": len(lead_ids),
        "assigned": sum(1 for a in assignments if a.get("success")),
        "assignments": assignments
    }


# ==================== OCR EXPENSE REIMBURSEMENT ====================

class ExpenseRequest(BaseModel):
    """Expense reimbursement request"""
    staff_id: str
    amount: Optional[float] = None
    vendor: Optional[str] = None
    category: str = "other"  # travel, food, supplies, equipment, other
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    ocr_data: Optional[Dict[str, Any]] = None


@router.post("/expense/submit")
async def submit_expense(request: ExpenseRequest):
    """
    Submit an expense for reimbursement
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    expense = {
        "id": f"exp_{datetime.now().strftime('%Y%m%d%H%M%S')}_{request.staff_id[:4]}",
        "staff_id": request.staff_id,
        "amount": request.amount,
        "vendor": request.vendor,
        "category": request.category,
        "description": request.description,
        "receipt_url": request.receipt_url,
        "ocr_data": request.ocr_data,
        "status": "pending",  # pending, approved, rejected
        "submitted_at": datetime.now(timezone.utc),
        "reviewed_by": None,
        "reviewed_at": None
    }
    
    await db.hr_expenses.insert_one(expense)
    
    return {
        "success": True,
        "expense_id": expense["id"],
        "message": "Expense submitted for approval"
    }


@router.post("/expense/ocr-extract")
async def ocr_extract_receipt(file: UploadFile = File(...)):
    """
    Extract data from receipt image using OCR (Gemini Vision)
    """
    try:
        # Read image
        content = await file.read()
        base64_image = base64.b64encode(content).decode('utf-8')
        
        # Get mime type
        content_type = file.content_type or "image/jpeg"
        
        # Use Gemini for OCR
        gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_API_KEY")
        
        if not gemini_key:
            # Fallback: Return template for manual entry
            return {
                "success": True,
                "ocr_available": False,
                "message": "OCR not configured. Please enter details manually.",
                "extracted_data": {
                    "amount": None,
                    "vendor": None,
                    "date": None,
                    "items": []
                }
            }
        
        # Call Gemini Vision API
        from emergentintegrations.llm.gemini import GeminiConfig, gemini_text_and_image_request
        
        config = GeminiConfig(
            api_key=gemini_key,
            model="gemini-2.0-flash"
        )
        
        prompt = """Analyze this receipt image and extract the following information in JSON format:
        {
            "vendor": "store/restaurant name",
            "date": "date on receipt (YYYY-MM-DD format)",
            "amount": total amount as number,
            "currency": "INR" or other currency,
            "items": [{"name": "item name", "price": price}],
            "payment_method": "cash/card/upi",
            "receipt_number": "if visible"
        }
        Only return the JSON, no other text."""
        
        result = await gemini_text_and_image_request(
            config=config,
            prompt=prompt,
            image_data=base64_image,
            image_mime_type=content_type
        )
        
        # Parse JSON from response
        import json
        try:
            # Try to extract JSON from response
            response_text = result.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            extracted_data = json.loads(response_text)
        except:
            extracted_data = {"raw_response": result}
        
        return {
            "success": True,
            "ocr_available": True,
            "extracted_data": extracted_data
        }
        
    except Exception as e:
        logger.error(f"OCR extraction error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "extracted_data": None
        }


@router.get("/expenses/{staff_id}")
async def get_staff_expenses(staff_id: str, status: Optional[str] = None):
    """
    Get expenses for a staff member
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {"staff_id": staff_id}
    if status:
        query["status"] = status
    
    expenses = await db.hr_expenses.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    
    total_pending = sum(e.get("amount", 0) for e in expenses if e.get("status") == "pending")
    total_approved = sum(e.get("amount", 0) for e in expenses if e.get("status") == "approved")
    
    return {
        "expenses": expenses,
        "summary": {
            "total_pending": total_pending,
            "total_approved": total_approved,
            "count": len(expenses)
        }
    }


@router.get("/expenses")
async def get_all_expenses(status: Optional[str] = None, limit: int = 50):
    """
    Get all expenses (admin view)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {}
    if status:
        query["status"] = status
    
    expenses = await db.hr_expenses.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(limit)
    
    return {"expenses": expenses, "total": len(expenses)}


@router.post("/expense/{expense_id}/review")
async def review_expense(expense_id: str, data: Dict[str, Any]):
    """
    Approve or reject an expense
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    action = data.get("action")  # approve or reject
    reviewer = data.get("reviewer", "admin")
    notes = data.get("notes", "")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    result = await db.hr_expenses.update_one(
        {"id": expense_id},
        {"$set": {
            "status": "approved" if action == "approve" else "rejected",
            "reviewed_by": reviewer,
            "reviewed_at": datetime.now(timezone.utc),
            "review_notes": notes
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    return {"success": True, "message": f"Expense {action}d successfully"}


# ==================== ATTENDANCE & LEAVE MANAGEMENT ====================

class AttendanceRecord(BaseModel):
    """Attendance check-in/out record"""
    staff_id: str
    action: str  # checkin, checkout
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


@router.post("/attendance/record")
async def record_attendance(record: AttendanceRecord):
    """
    Record attendance check-in or check-out
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    attendance = {
        "id": f"att_{today}_{record.staff_id}_{record.action}",
        "staff_id": record.staff_id,
        "date": today,
        "action": record.action,
        "timestamp": datetime.now(timezone.utc),
        "location": record.location,
        "latitude": record.latitude,
        "longitude": record.longitude,
        "notes": record.notes
    }
    
    # Check if already checked in/out today
    existing = await db.hr_attendance.find_one({
        "staff_id": record.staff_id,
        "date": today,
        "action": record.action
    })
    
    if existing:
        return {
            "success": False,
            "error": f"Already {record.action}ed today",
            "existing_record": {
                "time": existing.get("timestamp").isoformat() if existing.get("timestamp") else None
            }
        }
    
    await db.hr_attendance.insert_one(attendance)
    
    # Update staff last_active
    await db.crm_staff_accounts.update_one(
        {"staff_id": record.staff_id},
        {"$set": {"last_active": datetime.now(timezone.utc)}}
    )
    
    return {
        "success": True,
        "message": f"{record.action.capitalize()} recorded successfully",
        "timestamp": attendance["timestamp"].isoformat()
    }


@router.get("/attendance/{staff_id}")
async def get_staff_attendance(staff_id: str, month: Optional[str] = None):
    """
    Get attendance records for a staff member
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {"staff_id": staff_id}
    
    if month:
        # Filter by month (format: YYYY-MM)
        query["date"] = {"$regex": f"^{month}"}
    else:
        # Default to current month
        current_month = datetime.now().strftime("%Y-%m")
        query["date"] = {"$regex": f"^{current_month}"}
    
    records = await db.hr_attendance.find(query, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    # Calculate summary
    dates_present = set(r["date"] for r in records if r.get("action") == "checkin")
    
    return {
        "records": records,
        "summary": {
            "days_present": len(dates_present),
            "total_records": len(records)
        }
    }


@router.get("/attendance/today")
async def get_today_attendance():
    """
    Get all staff attendance for today (admin view)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    records = await db.hr_attendance.find(
        {"date": today},
        {"_id": 0}
    ).to_list(500)
    
    # Group by staff
    staff_attendance = {}
    for record in records:
        staff_id = record["staff_id"]
        if staff_id not in staff_attendance:
            staff_attendance[staff_id] = {"checkin": None, "checkout": None}
        staff_attendance[staff_id][record["action"]] = record.get("timestamp")
    
    return {
        "date": today,
        "attendance": staff_attendance,
        "total_checked_in": len([s for s in staff_attendance.values() if s.get("checkin")])
    }


# Leave Management

class LeaveRequest(BaseModel):
    """Leave request"""
    staff_id: str
    leave_type: str  # sick, casual, earned, emergency
    start_date: str  # YYYY-MM-DD
    end_date: str
    reason: str
    contact_during_leave: Optional[str] = None


@router.post("/leave/request")
async def submit_leave_request(request: LeaveRequest):
    """
    Submit a leave request
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Calculate days
    start = datetime.strptime(request.start_date, "%Y-%m-%d")
    end = datetime.strptime(request.end_date, "%Y-%m-%d")
    days = (end - start).days + 1
    
    leave = {
        "id": f"leave_{datetime.now().strftime('%Y%m%d%H%M%S')}_{request.staff_id[:4]}",
        "staff_id": request.staff_id,
        "leave_type": request.leave_type,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "days": days,
        "reason": request.reason,
        "contact_during_leave": request.contact_during_leave,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc),
        "reviewed_by": None,
        "reviewed_at": None
    }
    
    await db.hr_leaves.insert_one(leave)
    
    return {
        "success": True,
        "leave_id": leave["id"],
        "days": days,
        "message": "Leave request submitted"
    }


@router.get("/leave/requests")
async def get_leave_requests(status: Optional[str] = None, staff_id: Optional[str] = None):
    """
    Get leave requests
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {}
    if status:
        query["status"] = status
    if staff_id:
        query["staff_id"] = staff_id
    
    requests = await db.hr_leaves.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    
    return {"requests": requests, "total": len(requests)}


@router.post("/leave/{leave_id}/review")
async def review_leave(leave_id: str, data: Dict[str, Any]):
    """
    Approve or reject a leave request
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    action = data.get("action")
    reviewer = data.get("reviewer", "admin")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    result = await db.hr_leaves.update_one(
        {"id": leave_id},
        {"$set": {
            "status": "approved" if action == "approve" else "rejected",
            "reviewed_by": reviewer,
            "reviewed_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    return {"success": True, "message": f"Leave {action}d successfully"}


# ==================== PERFORMANCE ANALYTICS ====================

@router.get("/performance/team")
async def get_team_performance(period: str = "month"):
    """
    Get team-wide performance analytics
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get all staff
    staff_list = await db.crm_staff_accounts.find(
        {"status": {"$ne": "inactive"}},
        {"_id": 0, "staff_id": 1, "name": 1}
    ).to_list(100)
    
    team_performance = []
    
    for staff in staff_list:
        try:
            perf = await get_individual_staff_performance(staff["staff_id"], period)
            team_performance.append({
                "staff_id": staff["staff_id"],
                "name": staff.get("name"),
                "score": perf.get("performance_score"),
                "metrics": perf.get("metrics"),
                "rating": perf.get("rating")
            })
        except HTTPException:
            # Skip staff that throws errors
            continue
        except Exception:
            continue
    
    # Sort by score
    team_performance.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    # Calculate team averages
    if team_performance:
        avg_score = sum(p.get("score", 0) for p in team_performance) / len(team_performance)
        total_leads = sum(p.get("metrics", {}).get("leads_assigned", 0) for p in team_performance)
        total_converted = sum(p.get("metrics", {}).get("leads_converted", 0) for p in team_performance)
    else:
        avg_score = 0
        total_leads = 0
        total_converted = 0
    
    return {
        "period": period,
        "team_size": len(team_performance),
        "team_average_score": round(avg_score, 2),
        "total_leads_assigned": total_leads,
        "total_leads_converted": total_converted,
        "team_conversion_rate": round(total_converted / total_leads * 100, 2) if total_leads > 0 else 0,
        "leaderboard": team_performance[:10],
        "all_staff": team_performance
    }


async def get_individual_staff_performance(staff_id: str, period: str = "month"):
    """
    Internal function to get performance analytics for a staff member
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=30)
    
    # Get staff info
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        # Return default performance for non-existent staff
        return {
            "staff_id": staff_id,
            "staff_name": "Unknown",
            "period": period,
            "metrics": {
                "leads_assigned": 0,
                "leads_converted": 0,
                "conversion_rate": 0,
                "tasks_completed": 0,
                "days_present": 0
            },
            "performance_score": 50,
            "rating": "Average"
        }
    
    # Get leads assigned
    leads_assigned = await db.crm_leads.count_documents({
        "assigned_to": staff_id,
        "assigned_at": {"$gte": start_date}
    })
    
    # Get leads converted
    leads_converted = await db.crm_leads.count_documents({
        "assigned_to": staff_id,
        "stage": {"$in": ["converted", "closed_won", "installation_done"]},
        "updated_at": {"$gte": start_date}
    })
    
    # Get tasks completed
    tasks_completed = await db.crm_tasks.count_documents({
        "assigned_to": staff_id,
        "status": "completed",
        "completed_at": {"$gte": start_date}
    })
    
    # Get attendance
    attendance_records = await db.hr_attendance.count_documents({
        "staff_id": staff_id,
        "action": "checkin",
        "timestamp": {"$gte": start_date}
    })
    
    # Calculate metrics
    conversion_rate = (leads_converted / leads_assigned * 100) if leads_assigned > 0 else 0
    
    # Calculate performance score
    score = 50  # Base score
    score += min(leads_assigned * 2, 20)  # Up to 20 points for leads handled
    score += min(conversion_rate, 20)  # Up to 20 points for conversion rate
    score += min(tasks_completed, 10)  # Up to 10 points for tasks
    
    return {
        "staff_id": staff_id,
        "staff_name": staff.get("name"),
        "period": period,
        "metrics": {
            "leads_assigned": leads_assigned,
            "leads_converted": leads_converted,
            "conversion_rate": round(conversion_rate, 2),
            "tasks_completed": tasks_completed,
            "days_present": attendance_records
        },
        "performance_score": min(round(score, 2), 100),
        "rating": "Excellent" if score >= 80 else "Good" if score >= 60 else "Average" if score >= 40 else "Needs Improvement"
    }


@router.get("/performance/{staff_id}")
async def get_staff_performance(staff_id: str, period: str = "month"):
    """
    Get performance analytics for a staff member (API endpoint)
    """
    return await get_individual_staff_performance(staff_id, period)


@router.get("/dashboard")
async def get_hr_dashboard():
    """
    Get HR dashboard summary
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Today's attendance
    attendance_today = await db.hr_attendance.count_documents({
        "date": today,
        "action": "checkin"
    })
    
    # Pending expenses
    pending_expenses = await db.hr_expenses.count_documents({"status": "pending"})
    pending_expense_amount = 0
    expenses = await db.hr_expenses.find({"status": "pending"}, {"amount": 1}).to_list(100)
    pending_expense_amount = sum(e.get("amount", 0) for e in expenses)
    
    # Pending leaves
    pending_leaves = await db.hr_leaves.count_documents({"status": "pending"})
    
    # Active staff count
    active_staff = await db.crm_staff_accounts.count_documents({"status": {"$ne": "inactive"}})
    
    return {
        "today": today,
        "attendance": {
            "checked_in_today": attendance_today,
            "total_staff": active_staff
        },
        "expenses": {
            "pending_count": pending_expenses,
            "pending_amount": pending_expense_amount
        },
        "leaves": {
            "pending_requests": pending_leaves
        },
        "staff": {
            "total_active": active_staff
        }
    }
