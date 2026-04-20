"""
ASR Enterprises - Comprehensive Security Module
Implements: Rate Limiting, Security Headers, Input Validation, 
IP Blocking, Suspicious Activity Logging, and more.
"""

import os
import re
import time
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Set
from collections import defaultdict
from functools import wraps

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

# Rate Limiting Configuration
RATE_LIMIT_DEFAULT = "100/minute"
RATE_LIMIT_AUTH = "10/minute"
RATE_LIMIT_PAYMENT = "10/minute"
RATE_LIMIT_ADMIN = "30/minute"
RATE_LIMIT_SENSITIVE = "5/minute"
RATE_LIMIT_OTP_SEND = "5/minute"
RATE_LIMIT_OTP_VERIFY = "15/minute"

# IP Blocking Configuration
MAX_FAILED_ATTEMPTS = 10
BLOCK_DURATION_MINUTES = 30
SUSPICIOUS_PATTERNS = [
    r"<script",
    r"javascript:",
    r"on\w+\s*=",
    r"union\s+select",
    r"drop\s+table",
    r"insert\s+into",
    r"delete\s+from",
    r"\$where",
    r"\$regex",
    r"\$ne",
    r"\$gt",
    r"\$lt",
    r"\.\.\/",
    r"\.\.\\",
    r"%00",
    r"0x",
]

# ==================== RATE LIMITER ====================

def get_real_ip(request: Request) -> str:
    """Get real IP address considering proxies and Cloudflare"""
    # Cloudflare header
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip
    
    # X-Forwarded-For header
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    
    # X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to client host
    return request.client.host if request.client else "unknown"

# Initialize rate limiter
limiter = Limiter(key_func=get_real_ip)

# ==================== IP BLOCKING & TRACKING ====================

class SecurityTracker:
    """Track suspicious activities and manage IP blocking"""
    
    def __init__(self):
        self.failed_attempts: Dict[str, list] = defaultdict(list)
        self.blocked_ips: Dict[str, datetime] = {}
        self.suspicious_activity: Dict[str, list] = defaultdict(list)
        self.request_counts: Dict[str, int] = defaultdict(int)
    
    def is_blocked(self, ip: str) -> bool:
        """Check if IP is currently blocked"""
        if ip in self.blocked_ips:
            block_time = self.blocked_ips[ip]
            if datetime.now(timezone.utc) < block_time:
                return True
            else:
                # Block expired, remove it
                del self.blocked_ips[ip]
        return False
    
    def record_failed_attempt(self, ip: str, reason: str = ""):
        """Record a failed attempt and potentially block IP"""
        now = datetime.now(timezone.utc)
        # Clean old attempts (older than 1 hour)
        self.failed_attempts[ip] = [
            t for t in self.failed_attempts[ip]
            if now - t < timedelta(hours=1)
        ]
        self.failed_attempts[ip].append(now)
        
        if len(self.failed_attempts[ip]) >= MAX_FAILED_ATTEMPTS:
            self.block_ip(ip, f"Too many failed attempts: {reason}")
    
    def block_ip(self, ip: str, reason: str = ""):
        """Block an IP address"""
        block_until = datetime.now(timezone.utc) + timedelta(minutes=BLOCK_DURATION_MINUTES)
        self.blocked_ips[ip] = block_until
        logger.warning(f"🚫 IP BLOCKED: {ip} until {block_until} - Reason: {reason}")
    
    def record_suspicious_activity(self, ip: str, activity: str, request_path: str):
        """Log suspicious activity"""
        now = datetime.now(timezone.utc)
        entry = {
            "timestamp": now.isoformat(),
            "activity": activity,
            "path": request_path
        }
        self.suspicious_activity[ip].append(entry)
        logger.warning(f"⚠️ SUSPICIOUS: IP={ip}, Activity={activity}, Path={request_path}")
        
        # Auto-block if too many suspicious activities
        recent = [
            e for e in self.suspicious_activity[ip]
            if now - datetime.fromisoformat(e["timestamp"]) < timedelta(minutes=5)
        ]
        if len(recent) >= 5:
            self.block_ip(ip, "Too many suspicious activities")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get security statistics"""
        return {
            "blocked_ips": len(self.blocked_ips),
            "tracked_ips": len(self.failed_attempts),
            "suspicious_activities": sum(len(v) for v in self.suspicious_activity.values())
        }

# Global security tracker
security_tracker = SecurityTracker()

# ==================== INPUT VALIDATION ====================

def sanitize_input(value: Any) -> Any:
    """Sanitize input to prevent XSS and injection attacks"""
    if value is None:
        return None
    
    if isinstance(value, str):
        # Remove null bytes
        value = value.replace("\x00", "")
        # Basic HTML entity encoding for XSS prevention
        value = value.replace("<", "&lt;").replace(">", "&gt;")
        # Remove potential script injections
        value = re.sub(r"javascript:", "", value, flags=re.IGNORECASE)
        value = re.sub(r"on\w+\s*=", "", value, flags=re.IGNORECASE)
        return value.strip()
    
    if isinstance(value, dict):
        return {k: sanitize_input(v) for k, v in value.items()}
    
    if isinstance(value, list):
        return [sanitize_input(v) for v in value]
    
    return value

def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone(phone: str) -> bool:
    """Validate phone number (Indian format)"""
    if not phone:
        return False
    # Remove spaces and dashes
    phone = re.sub(r'[\s\-]', '', phone)
    # Indian phone: 10 digits, optionally starting with +91 or 91
    pattern = r'^(\+91|91)?[6-9]\d{9}$'
    return bool(re.match(pattern, phone))

def check_suspicious_input(value: str, ip: str, path: str) -> bool:
    """Check for suspicious patterns in input"""
    if not isinstance(value, str):
        return False
    
    value_lower = value.lower()
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, value_lower, re.IGNORECASE):
            security_tracker.record_suspicious_activity(
                ip, f"Suspicious pattern detected: {pattern}", path
            )
            return True
    return False

def validate_request_data(data: Dict[str, Any], ip: str, path: str) -> Dict[str, Any]:
    """Validate and sanitize request data"""
    def check_value(v):
        if isinstance(v, str):
            check_suspicious_input(v, ip, path)
            return sanitize_input(v)
        elif isinstance(v, dict):
            return {k: check_value(val) for k, val in v.items()}
        elif isinstance(v, list):
            return [check_value(item) for item in v]
        return v
    
    return {k: check_value(v) for k, v in data.items()}

# ==================== SECURITY HEADERS MIDDLEWARE ====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        ip = get_real_ip(request)
        
        # Check if IP is blocked
        if security_tracker.is_blocked(ip):
            logger.warning(f"🚫 Blocked IP attempted access: {ip}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied. Your IP has been temporarily blocked."}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://api.razorpay.com https://www.google.com https://www.gstatic.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.google.com; "
            "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com;"
        )
        
        # Strict Transport Security (HSTS)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response

# ==================== REQUEST SIZE LIMITER ====================

class RequestSizeLimiterMiddleware(BaseHTTPMiddleware):
    """Limit request body size to prevent DoS attacks"""
    
    MAX_BODY_SIZE = 10 * 1024 * 1024  # 10MB max
    MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB for file uploads
    
    async def dispatch(self, request: Request, call_next):
        # Check content length
        content_length = request.headers.get("content-length")
        if content_length:
            size = int(content_length)
            # Allow larger size for file upload endpoints
            is_upload = "/upload" in request.url.path or "/gallery" in request.url.path
            max_size = self.MAX_UPLOAD_SIZE if is_upload else self.MAX_BODY_SIZE
            
            if size > max_size:
                ip = get_real_ip(request)
                security_tracker.record_suspicious_activity(
                    ip, f"Oversized request: {size} bytes", request.url.path
                )
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request too large. Maximum size: {max_size // (1024*1024)}MB"}
                )
        
        return await call_next(request)

# ==================== RATE LIMIT EXCEPTION HANDLER ====================

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded errors"""
    ip = get_real_ip(request)
    security_tracker.record_failed_attempt(ip, "Rate limit exceeded")
    logger.warning(f"⚡ Rate limit exceeded: IP={ip}, Path={request.url.path}")
    
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down.",
            "retry_after": "60 seconds"
        }
    )

# ==================== SECURITY UTILITIES ====================

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure token"""
    return hashlib.sha256(os.urandom(length)).hexdigest()

def hash_password(password: str, salt: str = None) -> tuple:
    """Hash a password with salt"""
    if salt is None:
        salt = os.urandom(32).hex()
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return hashed.hex(), salt

def verify_password(password: str, hashed: str, salt: str) -> bool:
    """Verify a password against its hash"""
    new_hash, _ = hash_password(password, salt)
    return new_hash == hashed

def mask_sensitive_data(data: str, visible_chars: int = 4) -> str:
    """Mask sensitive data like phone numbers, emails"""
    if not data:
        return ""
    if len(data) <= visible_chars * 2:
        return "*" * len(data)
    return data[:visible_chars] + "*" * (len(data) - visible_chars * 2) + data[-visible_chars:]

# ==================== LOGGING UTILITIES ====================

def log_security_event(event_type: str, ip: str, details: Dict[str, Any]):
    """Log security events for monitoring"""
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": event_type,
        "ip": ip,
        "details": details
    }
    logger.info(f"🔐 SECURITY_EVENT: {log_entry}")


# ==================== SHARED ADMIN AUTH ====================

def require_admin_token(request: Request) -> None:
    """Gate sensitive admin/CRM endpoints behind a shared secret.

    Reads the expected value from ADMIN_API_TOKEN env var (preferred) or,
    as a backward-compatible fallback, CASHFREE_WEBHOOK_SECRET.
    Header name: `x-admin-token`.

    If NEITHER secret is configured the request is allowed with a warning
    so first-time setups work out of the box; production MUST set one.

    Usage:
        from security import require_admin_token
        ...
        @router.delete("/leads/permanent-delete")
        async def my_endpoint(request: Request):
            require_admin_token(request)
    """
    import os
    import hmac as _hmac
    expected = (
        os.environ.get("ADMIN_API_TOKEN", "").strip()
        or os.environ.get("CASHFREE_WEBHOOK_SECRET", "").strip()
    )
    if not expected:
        logger.warning(
            "Admin-gated endpoint called but no ADMIN_API_TOKEN configured — "
            "request allowed. Set ADMIN_API_TOKEN in production."
        )
        return
    provided = (request.headers.get("x-admin-token") or "").strip()
    if not provided or not _hmac.compare_digest(provided, expected):
        log_security_event(
            "admin_token_rejected",
            get_real_ip(request),
            {"path": str(request.url.path)},
        )
        raise HTTPException(status_code=401, detail="Admin token required")
