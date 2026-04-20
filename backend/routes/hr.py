"""
HR Management Router
Handles all HR-related endpoints: employees, leaves, attendance, performance
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
import uuid

router = APIRouter(prefix="/hr", tags=["HR Management"])

# Database and models will be passed from main app
db = None

# ==================== OWNER / SUPER ADMIN PROTECTION ====================
# ASR1001 is permanently reserved for the company owner / super admin.
# This account can never be deleted, deactivated, or have its identity changed.
OWNER_EMPLOYEE_ID = "ASR1001"
OWNER_NAME = "ABHIJEET KUMAR"
OWNER_EMAIL = "asrenterprisespatna@gmail.com"
OWNER_PHONE = "8877896889"

def _is_owner(employee_id: str) -> bool:
    return (employee_id or "").strip().upper() == OWNER_EMPLOYEE_ID


def init_router(database):
    """Initialize router with database connection"""
    global db
    db = database


async def ensure_owner_employee():
    """Ensure the super admin / owner employee record (ASR1001 - ABHIJEET KUMAR) always exists
    and is active. Called on startup. Safe to run repeatedly."""
    if db is None:
        return
    try:
        existing = await db.hr_employees.find_one({"employee_id": OWNER_EMPLOYEE_ID}, {"_id": 0})
        owner_fields = {
            "employee_id": OWNER_EMPLOYEE_ID,
            "name": OWNER_NAME,
            "email": OWNER_EMAIL,
            "phone": OWNER_PHONE,
            "department": "admin",
            "designation": "Owner & Super Admin",
            "role": "admin",
            "employment_type": "full_time",
            "status": "active",
            "is_active": True,
            "is_owner": True,
            "is_protected": True,
        }
        if not existing:
            owner_doc = {
                "id": str(uuid.uuid4()),
                "joining_date": "2020-01-01",
                "state": "Bihar",
                "salary_type": "monthly",
                "base_salary": 0.0,
                "allowances": 0.0,
                "incentive_percentage": 0.0,
                "documents": {},
                "total_leaves": 365,
                "leaves_taken": 0,
                "leaves_remaining": 365,
                "onboarding_completed": True,
                "onboarding_checklist": {
                    "documents_submitted": True,
                    "id_card_created": True,
                    "bank_details_added": True,
                    "system_access_given": True,
                    "training_completed": True,
                    "reporting_manager_assigned": True
                },
                "notes": "Company Owner & Super Admin - Protected Account",
                "status_history": [{
                    "status": "active",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "notes": "Owner account initialized"
                }],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **owner_fields,
            }
            await db.hr_employees.insert_one(owner_doc)
        else:
            # Always re-assert owner identity & active state
            await db.hr_employees.update_one(
                {"employee_id": OWNER_EMPLOYEE_ID},
                {"$set": owner_fields}
            )

        # Ensure CRM staff account also exists for owner with OTP login enabled
        owner_staff_doc = await db.crm_staff_accounts.find_one({"staff_id": OWNER_EMPLOYEE_ID}, {"_id": 0})
        owner_staff_fields = {
            "staff_id": OWNER_EMPLOYEE_ID,
            "name": OWNER_NAME,
            "email": OWNER_EMAIL,
            "phone": OWNER_PHONE,
            "mobile": OWNER_PHONE,
            "role": "admin",
            "is_active": True,
            "is_owner": True,
            "is_protected": True,
            "otp_login_enabled": True,
        }
        if not owner_staff_doc:
            await db.crm_staff_accounts.insert_one({
                "id": str(uuid.uuid4()),
                "leads_assigned": 0,
                "leads_converted": 0,
                "total_revenue": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **owner_staff_fields,
            })
        else:
            await db.crm_staff_accounts.update_one(
                {"staff_id": OWNER_EMPLOYEE_ID},
                {"$set": owner_staff_fields}
            )
    except Exception as e:
        # Best effort - never fail startup
        import logging
        logging.getLogger(__name__).warning(f"ensure_owner_employee failed: {e}")

# ==================== PYDANTIC MODELS ====================

class HREmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str  # Custom ID like ASR1001
    
    # Personal Information
    name: str
    email: str = ""
    phone: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None  # male, female, other
    blood_group: Optional[str] = None
    photo_url: Optional[str] = None
    
    # Address
    address: str = ""
    city: str = ""
    state: str = "Bihar"
    pincode: str = ""
    
    # Emergency Contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    
    # Employment Details
    department: str = "sales"  # sales, technical, admin, marketing, support
    designation: str = ""  # Sales Executive, Technician, Manager, etc.
    role: str = "sales"  # sales, manager, telecaller, technician, admin
    employment_type: str = "full_time"  # full_time, part_time, contract, intern
    joining_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    probation_end_date: Optional[str] = None
    confirmation_date: Optional[str] = None
    
    # Salary & Compensation
    salary_type: str = "monthly"  # monthly, daily, hourly
    base_salary: float = 0.0
    allowances: float = 0.0
    incentive_percentage: float = 0.0  # % of sales
    pf_number: Optional[str] = None
    esi_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None
    
    # Documents (URLs)
    documents: Dict[str, str] = {}  # {document_type: url}
    
    # Status & History
    status: str = "active"  # active, probation, notice_period, resigned, terminated
    is_active: bool = True
    
    # Performance Metrics
    leads_assigned: int = 0
    leads_converted: int = 0
    total_sales: float = 0.0
    total_revenue: float = 0.0
    performance_rating: float = 0.0  # 1-5
    last_review_date: Optional[str] = None
    
    # Attendance & Leave
    total_leaves: int = 18  # Annual leaves
    leaves_taken: int = 0
    leaves_remaining: int = 18
    
    # Onboarding Checklist
    onboarding_completed: bool = False
    onboarding_checklist: Dict[str, bool] = {
        "documents_submitted": False,
        "id_card_created": False,
        "bank_details_added": False,
        "system_access_given": False,
        "training_completed": False,
        "reporting_manager_assigned": False
    }
    
    # Reporting
    reporting_manager_id: Optional[str] = None
    reporting_manager_name: Optional[str] = None
    
    # Notes & History
    notes: str = ""
    status_history: List[Dict[str, Any]] = []
    
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HRLeaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    leave_type: str = "casual"  # casual, sick, earned, unpaid
    from_date: str
    to_date: str
    total_days: int = 1
    reason: str = ""
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_date: Optional[str] = None
    notes: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HRAttendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: str = "present"  # present, absent, half_day, leave, holiday
    work_hours: float = 0.0
    notes: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== EMPLOYEE ENDPOINTS ====================

@router.get("/employees")
async def get_hr_employees(department: Optional[str] = None, status: Optional[str] = None):
    """Get all HR employees with optional filters"""
    query = {}
    if department:
        query["department"] = department
    if status:
        query["status"] = status
    employees = await db.hr_employees.find(query, {"_id": 0}).sort("joining_date", -1).to_list(200)
    return {"employees": employees, "total": len(employees)}


@router.get("/employees/{employee_id}")
async def get_hr_employee(employee_id: str):
    """Get single employee details"""
    employee = await db.hr_employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.post("/employees")
async def create_hr_employee(data: Dict[str, Any]):
    """Create new HR employee and auto-sync with CRM staff"""
    # ASR1001 is permanently reserved for the owner — block any external attempt to claim it
    if data.get("employee_id") and _is_owner(data["employee_id"]):
        raise HTTPException(
            status_code=403,
            detail=f"Employee ID {OWNER_EMPLOYEE_ID} is reserved for the owner ({OWNER_NAME}) and cannot be assigned."
        )

    # Generate employee ID if not provided — ALWAYS skip ASR1001 (owner-reserved), start at ASR1002
    if not data.get("employee_id"):
        latest = await db.hr_employees.find_one(
            {"employee_id": {"$ne": OWNER_EMPLOYEE_ID}},
            {"_id": 0},
            sort=[("employee_id", -1)]
        )
        next_num = 1002
        if latest and latest.get("employee_id", "").startswith("ASR"):
            try:
                last_num = int(latest["employee_id"][3:])
                next_num = max(last_num + 1, 1002)
            except (ValueError, IndexError, TypeError):
                next_num = 1002
        # Defensive: never produce ASR1001
        if next_num <= 1001:
            next_num = 1002
        data["employee_id"] = f"ASR{next_num:04d}"
    
    # Set default values
    data.setdefault("status", "probation")
    data.setdefault("is_active", True)
    data.setdefault("joining_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    
    # Calculate probation end date (3 months from joining)
    if not data.get("probation_end_date"):
        joining = datetime.strptime(data["joining_date"], "%Y-%m-%d")
        probation_end = joining + timedelta(days=90)
        data["probation_end_date"] = probation_end.strftime("%Y-%m-%d")
    
    # Initialize onboarding checklist
    data.setdefault("onboarding_checklist", {
        "documents_submitted": False,
        "id_card_created": False,
        "bank_details_added": False,
        "system_access_given": False,
        "training_completed": False,
        "reporting_manager_assigned": False
    })
    
    # Initialize status history
    data["status_history"] = [{
        "status": data.get("status", "probation"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": "Employee created"
    }]
    
    employee = HREmployee(**data)
    doc = employee.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    
    await db.hr_employees.insert_one(doc)
    
    # Auto-sync with CRM staff accounts
    import hashlib
    import os
    # Use environment variable for default password or generate a random one
    default_password = os.environ.get("DEFAULT_STAFF_PASSWORD", str(uuid.uuid4())[:12])
    password_hash = hashlib.sha256(default_password.encode()).hexdigest()
    
    staff_data = {
        "id": employee.id,
        "staff_id": employee.employee_id,
        "name": employee.name,
        "email": employee.email,
        "phone": employee.phone,
        "role": employee.role,
        "is_active": employee.is_active,
        "password_hash": password_hash,  # Store hashed password for login
        "otp_login_enabled": True,  # Enable mobile OTP login by default
        "leads_assigned": 0,
        "leads_converted": 0,
        "total_revenue": 0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if staff account already exists
    existing_staff = await db.crm_staff_accounts.find_one({"staff_id": employee.employee_id})
    if not existing_staff:
        await db.crm_staff_accounts.insert_one(staff_data)
    
    return {
        "success": True,
        "employee": {k: v for k, v in doc.items() if k != "_id"},
        "temp_password": default_password,
        "staff_id": employee.employee_id,
        "message": f"Employee {employee.employee_id} created successfully"
    }


@router.put("/employees/{employee_id}")
async def update_hr_employee(employee_id: str, data: Dict[str, Any]):
    """Update HR employee details and sync with CRM"""
    # Remove fields that shouldn't be updated directly
    data.pop("id", None)
    data.pop("employee_id", None)
    data.pop("timestamp", None)
    data.pop("is_owner", None)
    data.pop("is_protected", None)

    # Owner / Super Admin protection — cannot be deactivated, terminated, renamed, demoted, or removed
    if _is_owner(employee_id):
        # Block any disabling / status-change attempts
        if "is_active" in data and data["is_active"] is False:
            raise HTTPException(status_code=403, detail=f"{OWNER_NAME} (Owner) cannot be deactivated.")
        if "status" in data and data["status"] in ("terminated", "resigned", "notice_period", "inactive"):
            raise HTTPException(status_code=403, detail=f"{OWNER_NAME} (Owner) status cannot be changed to {data['status']}.")
        # Force-preserve owner identity fields even if client sent them
        data["name"] = OWNER_NAME
        data["email"] = OWNER_EMAIL
        data["phone"] = OWNER_PHONE
        data["role"] = "admin"
        data["department"] = "admin"
        data["designation"] = "Owner & Super Admin"
        data["is_active"] = True
        data["status"] = "active"

    # Track status change
    if "status" in data:
        existing = await db.hr_employees.find_one({"employee_id": employee_id}, {"_id": 0})
        if existing and existing.get("status") != data["status"]:
            status_history = existing.get("status_history", [])
            status_history.append({
                "status": data["status"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": data.get("status_notes", "Status updated")
            })
            data["status_history"] = status_history
    
    await db.hr_employees.update_one({"employee_id": employee_id}, {"$set": data})
    
    # Sync with CRM staff accounts
    sync_fields = {}
    if "name" in data:
        sync_fields["name"] = data["name"]
    if "email" in data:
        sync_fields["email"] = data["email"]
    if "phone" in data:
        sync_fields["phone"] = data["phone"]
    if "role" in data:
        sync_fields["role"] = data["role"]
    if "is_active" in data:
        sync_fields["is_active"] = data["is_active"]
    
    if sync_fields:
        await db.crm_staff_accounts.update_one({"staff_id": employee_id}, {"$set": sync_fields})
    
    return {"success": True, "message": "Employee updated successfully"}


@router.put("/employees/{employee_id}/onboarding")
async def update_employee_onboarding(employee_id: str, data: Dict[str, Any]):
    """Update employee onboarding checklist"""
    employee = await db.hr_employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    checklist = employee.get("onboarding_checklist", {})
    checklist.update(data)
    
    # Check if all items are completed
    all_completed = all(checklist.values())
    
    await db.hr_employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"onboarding_checklist": checklist, "onboarding_completed": all_completed}}
    )
    
    return {"success": True, "onboarding_completed": all_completed}


@router.delete("/employees/{employee_id}")
async def delete_hr_employee(employee_id: str):
    """Delete HR employee (soft delete - mark as terminated)"""
    if _is_owner(employee_id):
        raise HTTPException(
            status_code=403,
            detail=f"{OWNER_NAME} (Owner / Super Admin) cannot be deactivated or deleted."
        )
    await db.hr_employees.update_one(
        {"employee_id": employee_id},
        {"$set": {
            "status": "terminated",
            "is_active": False,
            "status_history": {"$push": {
                "status": "terminated",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "notes": "Employee terminated"
            }}
        }}
    )
    
    # Also deactivate in CRM
    await db.crm_staff_accounts.update_one(
        {"staff_id": employee_id},
        {"$set": {"is_active": False}}
    )
    
    return {"success": True, "message": "Employee deactivated"}


@router.delete("/employees/{employee_id}/permanent")
async def permanently_delete_hr_employee(employee_id: str):
    """Permanently delete HR employee and all associated data"""
    if _is_owner(employee_id):
        raise HTTPException(
            status_code=403,
            detail=f"{OWNER_NAME} (Owner / Super Admin) is a protected account and cannot be deleted."
        )
    # Check if employee exists
    employee = await db.hr_employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Delete from HR employees
    await db.hr_employees.delete_one({"employee_id": employee_id})
    
    # Delete from CRM staff accounts
    await db.crm_staff_accounts.delete_one({"staff_id": employee_id})
    
    # Delete all leave requests for this employee
    await db.hr_leave_requests.delete_many({"employee_id": employee_id})
    
    # Delete all attendance records for this employee
    await db.hr_attendance.delete_many({"employee_id": employee_id})
    
    # Delete all follow-ups assigned to this employee
    await db.crm_followups.delete_many({"employee_id": employee_id})
    
    # Delete CRM employee record if exists
    await db.crm_employees.delete_one({"id": employee.get("id")})
    
    return {
        "success": True, 
        "message": f"Employee {employee_id} and all associated data have been permanently deleted"
    }


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_hr_dashboard():
    """Get HR dashboard statistics"""
    # Get all employees
    employees = await db.hr_employees.find({}, {"_id": 0}).to_list(500)
    
    total = len(employees)
    active = sum(1 for e in employees if e.get("is_active"))
    on_probation = sum(1 for e in employees if e.get("status") == "probation")
    on_notice = sum(1 for e in employees if e.get("status") == "notice_period")
    
    # Department breakdown
    departments = {}
    for e in employees:
        dept = e.get("department", "other")
        departments[dept] = departments.get(dept, 0) + 1
    
    # Recent joinings (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    recent_joinings = sum(1 for e in employees if e.get("joining_date", "") >= thirty_days_ago)
    
    # Pending onboarding
    pending_onboarding = sum(1 for e in employees if not e.get("onboarding_completed"))
    
    # Total salary expense
    total_salary = sum(e.get("base_salary", 0) + e.get("allowances", 0) for e in employees if e.get("is_active"))
    
    # Leave statistics
    pending_leaves = await db.hr_leave_requests.count_documents({"status": "pending"})
    
    return {
        "total_employees": total,
        "active_employees": active,
        "on_probation": on_probation,
        "on_notice": on_notice,
        "departments": departments,
        "recent_joinings": recent_joinings,
        "pending_onboarding": pending_onboarding,
        "total_monthly_salary": total_salary,
        "pending_leave_requests": pending_leaves
    }


# ==================== LEAVE MANAGEMENT ====================

@router.get("/leaves")
async def get_leave_requests(employee_id: Optional[str] = None, status: Optional[str] = None):
    """Get leave requests"""
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    leaves = await db.hr_leave_requests.find(query, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return {"leaves": leaves}


@router.post("/leaves")
async def create_leave_request(data: Dict[str, Any]):
    """Create leave request"""
    # Get employee name
    employee = await db.hr_employees.find_one({"employee_id": data.get("employee_id")}, {"_id": 0})
    if employee:
        data["employee_name"] = employee.get("name", "")
    
    # Calculate total days
    from_date = datetime.strptime(data.get("from_date", ""), "%Y-%m-%d")
    to_date = datetime.strptime(data.get("to_date", ""), "%Y-%m-%d")
    data["total_days"] = (to_date - from_date).days + 1
    
    leave = HRLeaveRequest(**data)
    doc = leave.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    
    await db.hr_leave_requests.insert_one(doc)
    return {"success": True, "leave": {k: v for k, v in doc.items() if k != "_id"}}


@router.put("/leaves/{leave_id}")
async def update_leave_request(leave_id: str, data: Dict[str, Any]):
    """Approve/Reject leave request"""
    if data.get("status") in ["approved", "rejected"]:
        data["approved_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Update employee leave balance if approved
        if data.get("status") == "approved":
            leave = await db.hr_leave_requests.find_one({"id": leave_id}, {"_id": 0})
            if leave:
                await db.hr_employees.update_one(
                    {"employee_id": leave.get("employee_id")},
                    {"$inc": {"leaves_taken": leave.get("total_days", 0), "leaves_remaining": -leave.get("total_days", 0)}}
                )
    
    await db.hr_leave_requests.update_one({"id": leave_id}, {"$set": data})
    return {"success": True}


# ==================== ATTENDANCE ====================

@router.get("/attendance")
async def get_attendance(employee_id: Optional[str] = None, date: Optional[str] = None):
    """Get attendance records"""
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if date:
        query["date"] = date
    attendance = await db.hr_attendance.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return {"attendance": attendance}


@router.post("/attendance")
async def mark_attendance(data: Dict[str, Any]):
    """Mark attendance"""
    # Check if already marked
    existing = await db.hr_attendance.find_one({
        "employee_id": data.get("employee_id"),
        "date": data.get("date")
    })
    
    if existing:
        # Update existing
        await db.hr_attendance.update_one(
            {"id": existing.get("id")},
            {"$set": data}
        )
        return {"success": True, "message": "Attendance updated"}
    
    attendance = HRAttendance(**data)
    doc = attendance.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    
    await db.hr_attendance.insert_one(doc)
    return {"success": True, "message": "Attendance marked"}


@router.post("/attendance/bulk")
async def mark_bulk_attendance(data: Dict[str, Any]):
    """Mark attendance for multiple employees"""
    date = data.get("date")
    attendances = data.get("attendances", [])  # [{employee_id, status}]
    
    for att in attendances:
        existing = await db.hr_attendance.find_one({
            "employee_id": att.get("employee_id"),
            "date": date
        })
        
        if existing:
            await db.hr_attendance.update_one(
                {"id": existing.get("id")},
                {"$set": {"status": att.get("status", "present")}}
            )
        else:
            attendance = HRAttendance(
                employee_id=att.get("employee_id"),
                date=date,
                status=att.get("status", "present")
            )
            doc = attendance.model_dump()
            doc["timestamp"] = doc["timestamp"].isoformat()
            await db.hr_attendance.insert_one(doc)
    
    return {"success": True, "message": f"Attendance marked for {len(attendances)} employees"}


# ==================== PERFORMANCE ====================

@router.get("/performance")
async def get_performance_data():
    """Get performance data for all employees"""
    employees = await db.hr_employees.find({"is_active": True}, {"_id": 0}).to_list(200)
    
    performance_data = []
    for emp in employees:
        performance_data.append({
            "employee_id": emp.get("employee_id"),
            "name": emp.get("name"),
            "department": emp.get("department"),
            "designation": emp.get("designation"),
            "leads_assigned": emp.get("leads_assigned", 0),
            "leads_converted": emp.get("leads_converted", 0),
            "conversion_rate": round((emp.get("leads_converted", 0) / max(emp.get("leads_assigned", 1), 1)) * 100, 1),
            "total_sales": emp.get("total_sales", 0),
            "total_revenue": emp.get("total_revenue", 0),
            "performance_rating": emp.get("performance_rating", 0),
            "last_review_date": emp.get("last_review_date")
        })
    
    return {"performance": performance_data}


@router.put("/employees/{employee_id}/performance")
async def update_employee_performance(employee_id: str, data: Dict[str, Any]):
    """Update employee performance metrics"""
    update_data = {
        "performance_rating": data.get("performance_rating"),
        "last_review_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    if data.get("notes"):
        # Add to performance history
        employee = await db.hr_employees.find_one({"employee_id": employee_id}, {"_id": 0})
        performance_history = employee.get("performance_history", []) if employee else []
        performance_history.append({
            "rating": data.get("performance_rating"),
            "notes": data.get("notes"),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        })
        update_data["performance_history"] = performance_history
    
    await db.hr_employees.update_one({"employee_id": employee_id}, {"$set": update_data})
    return {"success": True}


# ==================== REPORTS ====================

@router.get("/reports/summary")
async def get_hr_summary_report():
    """Get HR summary report"""
    employees = await db.hr_employees.find({}, {"_id": 0}).to_list(500)
    
    # Status breakdown
    status_breakdown = {}
    for e in employees:
        status = e.get("status", "unknown")
        status_breakdown[status] = status_breakdown.get(status, 0) + 1
    
    # Department breakdown
    department_breakdown = {}
    for e in employees:
        dept = e.get("department", "other")
        department_breakdown[dept] = department_breakdown.get(dept, 0) + 1
    
    # Salary analysis
    total_salary = sum(e.get("base_salary", 0) + e.get("allowances", 0) for e in employees if e.get("is_active"))
    avg_salary = total_salary / max(len([e for e in employees if e.get("is_active")]), 1)
    
    # Performance summary
    avg_rating = sum(e.get("performance_rating", 0) for e in employees) / max(len(employees), 1)
    total_revenue = sum(e.get("total_revenue", 0) for e in employees)
    
    # Tenure analysis
    tenure_data = {"0-6 months": 0, "6-12 months": 0, "1-2 years": 0, "2+ years": 0}
    today = datetime.now(timezone.utc)
    for e in employees:
        joining = e.get("joining_date")
        if joining:
            try:
                join_date = datetime.strptime(joining, "%Y-%m-%d")
                months = (today.year - join_date.year) * 12 + today.month - join_date.month
                if months < 6:
                    tenure_data["0-6 months"] += 1
                elif months < 12:
                    tenure_data["6-12 months"] += 1
                elif months < 24:
                    tenure_data["1-2 years"] += 1
                else:
                    tenure_data["2+ years"] += 1
            except (ValueError, TypeError):
                pass
    
    return {
        "total_employees": len(employees),
        "status_breakdown": status_breakdown,
        "department_breakdown": department_breakdown,
        "total_monthly_salary": total_salary,
        "average_salary": round(avg_salary, 2),
        "average_performance_rating": round(avg_rating, 2),
        "total_revenue_generated": total_revenue,
        "tenure_analysis": tenure_data
    }


# ==================== SYNC ENDPOINTS ====================

@router.post("/sync-from-crm")
async def sync_hr_from_crm():
    """Sync HR employees from CRM staff accounts - creates/updates HR records for active CRM staff"""
    # Get all active CRM staff accounts
    crm_staff = await db.crm_staff_accounts.find(
        {"is_active": True},
        {"_id": 0, "password_hash": 0, "password": 0}
    ).to_list(500)
    
    synced = 0
    created = 0
    updated = 0
    
    for staff in crm_staff:
        staff_id = staff.get("staff_id")
        if not staff_id:
            continue
        
        # Check if HR employee exists
        existing = await db.hr_employees.find_one({"employee_id": staff_id}, {"_id": 0})
        
        hr_data = {
            "employee_id": staff_id,
            "name": staff.get("name", ""),
            "email": staff.get("email", ""),
            "phone": staff.get("phone", ""),
            "department": "sales",
            "designation": staff.get("role", "sales").title() + " Executive",
            "role": staff.get("role", "sales"),
            "status": "active",
            "is_active": True,
            "leads_assigned": staff.get("leads_assigned", 0),
            "leads_converted": staff.get("leads_converted", 0),
            "joining_date": staff.get("created_at", datetime.now(timezone.utc).strftime("%Y-%m-%d"))[:10] if staff.get("created_at") else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            # Update existing
            await db.hr_employees.update_one(
                {"employee_id": staff_id},
                {"$set": hr_data}
            )
            updated += 1
        else:
            # Create new
            hr_data["id"] = staff.get("id", str(uuid.uuid4()))
            hr_data["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.hr_employees.insert_one(hr_data)
            created += 1
        
        synced += 1
    
    return {
        "success": True,
        "total_synced": synced,
        "created": created,
        "updated": updated,
        "message": f"Synced {synced} employees ({created} created, {updated} updated)"
    }


@router.put("/employees/activate-all")
async def activate_all_employees():
    """Activate all HR employees (reset status to active)"""
    result = await db.hr_employees.update_many(
        {},
        {"$set": {"status": "active", "is_active": True}}
    )
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"Activated {result.modified_count} employees"
    }

