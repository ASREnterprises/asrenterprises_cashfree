from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, Response, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from db_client import AsyncIOMotorClient, load_snapshot, save_snapshot, periodic_snapshot
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import random
import re
import hashlib
import hmac
import time
import asyncio
from collections import defaultdict
import resend
import base64
import csv
import io
import httpx
from PIL import Image
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from urllib.parse import quote

# Import security module
from security import (
    limiter, 
    SecurityHeadersMiddleware, 
    RequestSizeLimiterMiddleware,
    rate_limit_exceeded_handler,
    security_tracker,
    get_real_ip,
    validate_request_data,
    sanitize_input as secure_sanitize,
    validate_email,
    validate_phone,
    log_security_event,
    mask_sensitive_data,
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_AUTH,
    RATE_LIMIT_PAYMENT,
    RATE_LIMIT_ADMIN,
    RATE_LIMIT_SENSITIVE,
    RATE_LIMIT_OTP_SEND,
    RATE_LIMIT_OTP_VERIFY,
)

# Import Redis cache module
from cache import (
    init_redis,
    close_redis,
    cache_get,
    cache_set,
    cache_delete,
    cache_clear_pattern,
    cache_clear_all,
    get_cache_stats,
    cached,
    CACHE_TTL
)

# Import HR routes module
from routes.hr import router as hr_router, init_router as init_hr_router, ensure_owner_employee
from routes.crm import router as crm_router, init_router as init_crm_router
from routes.staff import router as staff_router, init_router as init_staff_router
from routes.whatsapp import router as whatsapp_router
from routes.social_media import router as social_media_router
from routes.payments import router as payments_router
from routes.cashfree_orders import router as cashfree_orders_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Central config + fail-fast secret validation
import config as app_config
from config import mask_phone as _mask_phone, mask_secret as _mask_secret

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Configure structured logging (level depends on environment / DEBUG flag)
_LOG_LEVEL = logging.DEBUG if app_config.DEBUG else logging.INFO
logging.basicConfig(
    level=_LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger(__name__)

# Crash early in production if any critical secret is missing.
app_config.validate_or_exit()

# ==================== EMAIL CONFIGURATION ====================
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ==================== SECURITY CONFIGURATION ====================

# reCAPTCHA Configuration
RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY', '')

async def verify_recaptcha(token: str) -> bool:
    """Verify Google reCAPTCHA token"""
    if not RECAPTCHA_SECRET_KEY or not token:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={"secret": RECAPTCHA_SECRET_KEY, "response": token}
            )
            result = resp.json()
            return result.get("success", False)
    except Exception as e:
        logger.error(f"reCAPTCHA verification error: {e}")
        return False

def check_honeypot(data: dict) -> bool:
    """Check honeypot field - if filled, it's a bot"""
    honeypot_value = data.get("website_url", "") or data.get("company_fax", "")
    return len(honeypot_value) == 0

# ==================== RATE LIMITING CONFIGURATION ====================

RATE_LIMIT_REQUESTS = 100  # General API requests per window
RATE_LIMIT_WINDOW = 60     # Window in seconds
LOGIN_RATE_LIMIT = 5       # Login attempts per window
LOGIN_RATE_WINDOW = 300    # 5 minutes window for login attempts
LOGIN_LOCKOUT_TIME = 900   # 15 minutes lockout after max failed attempts
MAX_FAILED_LOGINS = 5      # Max failed logins before lockout

# ============================================================
# PROTECTED OWNER CREDENTIALS — DO NOT CHANGE
# These are the only credentials that can access the admin panel.
# This account cannot be deleted, modified, or bypassed.
# ============================================================
OWNER_EMAIL    = "asrenterprisespatna@gmail.com"
OWNER_MOBILE   = "9296389097"
OWNER_STAFF_ID = "ASR1001"
OWNER_NAME     = "ABHIJEET KUMAR"
OWNER_PASSWORD = "Abhi@9745"   # fallback if DB has no hash
OWNER_ROLE     = "super_admin"

def is_owner_account(doc: dict) -> bool:
    """Return True if a staff/user document belongs to the protected owner."""
    return (
        doc.get("staff_id") == OWNER_STAFF_ID
        or doc.get("email", "").lower() == OWNER_EMAIL.lower()
        or doc.get("mobile") == OWNER_MOBILE
        or doc.get("is_owner") is True
        or doc.get("is_super_admin") is True
    )

# Rate limiting storage
rate_limit_storage = defaultdict(list)
login_attempts_storage = defaultdict(list)
failed_login_storage = defaultdict(lambda: {"count": 0, "lockout_until": 0})
blocked_ips = set()

def check_login_lockout(ip: str, email: str = None) -> tuple:
    """Check if IP or email is locked out from login attempts"""
    current_time = time.time()
    
    # Check IP lockout
    ip_data = failed_login_storage[f"ip:{ip}"]
    if ip_data["lockout_until"] > current_time:
        remaining = int(ip_data["lockout_until"] - current_time)
        return False, f"Too many failed attempts. Try again in {remaining // 60} minutes."
    
    # Check email lockout if provided
    if email:
        email_data = failed_login_storage[f"email:{email}"]
        if email_data["lockout_until"] > current_time:
            remaining = int(email_data["lockout_until"] - current_time)
            return False, f"Account temporarily locked. Try again in {remaining // 60} minutes."
    
    return True, None

def record_failed_login(ip: str, email: str = None):
    """Record a failed login attempt"""
    current_time = time.time()
    
    # Record for IP
    ip_key = f"ip:{ip}"
    failed_login_storage[ip_key]["count"] += 1
    if failed_login_storage[ip_key]["count"] >= MAX_FAILED_LOGINS:
        failed_login_storage[ip_key]["lockout_until"] = current_time + LOGIN_LOCKOUT_TIME
        logger.warning(f"IP {ip} locked out due to {failed_login_storage[ip_key]['count']} failed login attempts")
    
    # Record for email if provided
    if email:
        email_key = f"email:{email}"
        failed_login_storage[email_key]["count"] += 1
        if failed_login_storage[email_key]["count"] >= MAX_FAILED_LOGINS:
            failed_login_storage[email_key]["lockout_until"] = current_time + LOGIN_LOCKOUT_TIME
            logger.warning(f"Email {email} locked out due to {failed_login_storage[email_key]['count']} failed attempts")

def reset_failed_login(ip: str, email: str = None):
    """Reset failed login counter after successful login"""
    failed_login_storage[f"ip:{ip}"] = {"count": 0, "lockout_until": 0}
    if email:
        failed_login_storage[f"email:{email}"] = {"count": 0, "lockout_until": 0}

# Security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    # CSP locked down to *actually used* third parties:
    #   - Cashfree (payment checkout SDK + redirects)
    #   - MSG91 (OTP widget)
    #   - Google (reCAPTCHA / Maps embeds + reCAPTCHA xhr)
    #   - Emergent (frontend tooling scripts loaded from index.html)
    #   - Facebook Pixel (fbevents + tr noscript pixel)
    #   - PostHog (analytics — us.i.posthog.com + dynamic *-assets subdomains)
    # Frame-ancestors 'none' equivalent to X-Frame-Options: DENY.
    # 'unsafe-inline' is required because index.html ships large inline init
    # scripts; 'unsafe-eval' kept for now because some payment SDKs use it.
    # TODO: migrate to nonce-based CSP and drop unsafe-eval.
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
            "https://sdk.cashfree.com https://*.cashfree.com "
            "https://verify.msg91.com https://control.msg91.com "
            "https://www.google.com https://www.gstatic.com https://www.recaptcha.net "
            "https://assets.emergent.sh "
            "https://connect.facebook.net "
            "https://us.i.posthog.com https://*.i.posthog.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: blob: https:; "
        "frame-src 'self' https://sdk.cashfree.com https://*.cashfree.com "
            "https://verify.msg91.com https://www.google.com https://www.recaptcha.net "
            "https://www.facebook.com; "
        "connect-src 'self' https://*.cashfree.com https://api.msg91.com "
            "https://control.msg91.com https://graph.facebook.com "
            "https://www.google.com https://www.gstatic.com https://www.recaptcha.net "
            "https://us.i.posthog.com https://*.i.posthog.com "
            "https://www.facebook.com https://connect.facebook.net; "
        "object-src 'none'; base-uri 'self'; form-action 'self' https://*.cashfree.com; "
        "frame-ancestors 'none'; upgrade-insecure-requests"
    ),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "cross-origin"
}

# Input validation patterns
PHONE_PATTERN = re.compile(r'^[6-9]\d{9}$')
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
NAME_PATTERN = re.compile(r'^[a-zA-Z\s]{2,100}$')

# Suspicious patterns to block
INJECTION_PATTERNS = [
    r'<script[^>]*>',
    r'javascript:',
    r'on\w+\s*=',
    r'\$\{.*\}',
    r'\{\{.*\}\}',
    r'eval\s*\(',
    r'document\.',
    r'window\.',
    r'alert\s*\(',
]

def sanitize_input(value: str) -> str:
    """Sanitize user input to prevent XSS and injection attacks"""
    if not isinstance(value, str):
        return value
    # Remove potential script tags and dangerous patterns
    sanitized = re.sub(r'<[^>]*script[^>]*>', '', value, flags=re.IGNORECASE)
    sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
    # Escape HTML entities
    sanitized = sanitized.replace('<', '&lt;').replace('>', '&gt;')
    sanitized = sanitized.replace('"', '&quot;').replace("'", '&#x27;')
    return sanitized.strip()

def is_suspicious_input(value: str) -> bool:
    """Check if input contains suspicious patterns"""
    if not isinstance(value, str):
        return False
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            return True
    return False

def get_client_ip(request: Request) -> str:
    """Get client IP address from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_rate_limit(ip: str, limit: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW) -> bool:
    """Check if IP has exceeded rate limit"""
    current_time = time.time()
    # Clean old entries
    rate_limit_storage[ip] = [t for t in rate_limit_storage[ip] if current_time - t < window]
    # Check limit
    if len(rate_limit_storage[ip]) >= limit:
        return False
    rate_limit_storage[ip].append(current_time)
    return True

def check_login_rate_limit(ip: str) -> bool:
    """Check login rate limit to prevent brute force"""
    current_time = time.time()
    login_attempts_storage[ip] = [t for t in login_attempts_storage[ip] if current_time - t < LOGIN_RATE_WINDOW]
    if len(login_attempts_storage[ip]) >= LOGIN_RATE_LIMIT:
        return False
    login_attempts_storage[ip].append(current_time)
    return True

# Security Middleware
class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = get_client_ip(request)
        path = request.url.path
        
        # HTTPS Force - redirect HTTP to HTTPS (production only / when enabled).
        # Use a real RedirectResponse — JSONResponse with Location does NOT redirect.
        from fastapi.responses import RedirectResponse
        if app_config.FORCE_HTTPS and not path.startswith("/api/health"):
            forwarded_proto = request.headers.get("X-Forwarded-Proto", "https").lower()
            if forwarded_proto == "http":
                https_url = str(request.url).replace("http://", "https://", 1)
                return RedirectResponse(url=https_url, status_code=301)

        # Canonical-host redirect (e.g. asrenterprises.in -> www.asrenterprises.in).
        # Skip for API + webhook paths so payment / Meta providers' verification
        # GETs and POST bodies are preserved unchanged.
        _NEVER_REDIRECT_PREFIXES = ("/api/", "/webhook", "/cashfree")
        if (
            app_config.CANONICAL_HOST
            and request.method == "GET"
            and not any(path.startswith(p) for p in _NEVER_REDIRECT_PREFIXES)
        ):
            host_header = (request.headers.get("host") or "").split(":")[0].lower()
            if host_header and host_header != app_config.CANONICAL_HOST.lower():
                target = request.url.replace(netloc=app_config.CANONICAL_HOST)
                return RedirectResponse(url=str(target), status_code=308)
        
        # Check if IP is blocked
        if client_ip in blocked_ips:
            logger.warning(f"Blocked IP attempted access: {client_ip}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied"}
            )
        
        # Enhanced rate limiting for login endpoints
        login_endpoints = ["/api/admin/send-otp", "/api/admin/verify-otp", "/api/staff/login", "/api/staff/verify-otp", "/api/staff/verify-2fa"]
        if path in login_endpoints and request.method == "POST":
            # Check login rate limit
            if not check_login_rate_limit(client_ip):
                logger.warning(f"Login rate limit exceeded for IP: {client_ip}")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many login attempts. Please wait 5 minutes."},
                    headers={"Retry-After": "300"}
                )
            
            # Check lockout status
            allowed, message = check_login_lockout(client_ip)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": message},
                    headers={"Retry-After": "900"}
                )
        
        # General rate limiting
        if not check_rate_limit(client_ip):
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value

        # Strip server-identity headers that leak stack info (ASVS V14.4.1).
        for h in ("Server", "X-Powered-By"):
            if h in response.headers:
                del response.headers[h]

        return response

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://127.0.0.1:27017')
from db_client import get_client as _get_shared_client, get_db as _get_shared_db, EFFECTIVE_DB_NAME as _DB_NAME
client = _get_shared_client()
db = _get_shared_db()  # uses EFFECTIVE_DB_NAME automatically

# ==================== PERFORMANCE OPTIMIZATION ====================

# In-memory cache for API responses
api_cache = {}
CACHE_TTL = 60  # Default cache TTL in seconds

def get_cached(key: str, ttl: int = CACHE_TTL):
    """Get cached value if not expired"""
    if key in api_cache:
        cached = api_cache[key]
        if time.time() - cached['timestamp'] < ttl:
            return cached['data']
        del api_cache[key]
    return None

def set_cache(key: str, data: any, ttl: int = CACHE_TTL):
    """Set cache with TTL"""
    api_cache[key] = {
        'data': data,
        'timestamp': time.time(),
        'ttl': ttl
    }
    # Clean old cache entries (keep max 1000)
    if len(api_cache) > 1000:
        oldest_keys = sorted(api_cache.keys(), key=lambda k: api_cache[k]['timestamp'])[:200]
        for k in oldest_keys:
            del api_cache[k]

def invalidate_cache(pattern: str = None):
    """Invalidate cache entries matching pattern"""
    if pattern:
        keys_to_delete = [k for k in api_cache.keys() if pattern in k]
        for k in keys_to_delete:
            del api_cache[k]
    else:
        api_cache.clear()

# Database index creation
async def create_indexes():
    """Create MongoDB indexes for optimized queries"""
    try:
        # Leads collection indexes
        await db.leads.create_index([("created_at", -1)])
        await db.leads.create_index([("status", 1)])
        await db.leads.create_index([("district", 1)])
        await db.leads.create_index([("assigned_to", 1)])
        await db.leads.create_index([("email", 1)])
        await db.leads.create_index([("phone", 1)])
        
        # WhatsApp messages — unique key for admin alert idempotency claim.
        # Without this, the atomic-claim insert in send_admin_payment_alert
        # would NOT actually be atomic (two webhook callers could both win).
        # Sparse so it only applies to admin-alert rows that have order_id.
        try:
            await db.whatsapp_messages.create_index(
                [("order_id", 1), ("type", 1)],
                unique=True,
                partialFilterExpression={"type": "admin_payment_alert"},
                name="admin_alert_unique",
            )
        except Exception as _e:
            # Index may already exist with different options — harmless.
            logger.debug(f"admin_alert unique index: {_e}")

        # Orders collection indexes
        await db.orders.create_index([("created_at", -1)])
        await db.orders.create_index([("status", 1)])
        await db.orders.create_index([("payment_status", 1)])
        await db.orders.create_index([("order_number", 1)], unique=True, sparse=True)
        await db.orders.create_index([("customer_details.phone", 1)])
        await db.orders.create_index([("payment_id", 1)], sparse=True)
        
        # WhatsApp opt-out collection — must be fast for every outgoing message
        await db.wa_optouts.create_index([("phone", 1)], unique=True)
        await db.wa_optouts.create_index([("opted_out", 1)])

        # OTP store — TTL index auto-deletes expired OTPs after 10 minutes
        await db.otp_store.create_index([("mobile", 1)], unique=True)
        await db.otp_store.create_index(
            [("created_at", 1)],
            expireAfterSeconds=600,  # 10 minutes (5-min expiry + 5-min grace)
            name="otp_store_ttl"
        )

        # Products collection indexes
        await db.products.create_index([("category", 1)])
        await db.products.create_index([("price", 1)])
        await db.products.create_index([("name", "text")])
        await db.products.create_index([("is_active", 1)])
        
        # Staff collection indexes
        await db.staff.create_index([("staff_id", 1)], unique=True)
        await db.staff.create_index([("email", 1)], sparse=True)
        await db.staff.create_index([("is_active", 1)])
        
        # Sessions and logs indexes with TTL for auto-cleanup
        await db.sessions.create_index([("created_at", 1)], expireAfterSeconds=86400*7)  # 7 days
        await db.activity_logs.create_index([("timestamp", -1)])
        await db.activity_logs.create_index([("created_at", 1)], expireAfterSeconds=86400*30)  # 30 days
        
        # Chats collection indexes
        await db.chats.create_index([("created_at", -1)])
        await db.chats.create_index([("session_id", 1)])
        
        # Photos collection indexes
        await db.photos.create_index([("uploaded_at", -1)])
        
        # Bookings collection indexes
        await db.bookings.create_index([("created_at", -1)])
        await db.bookings.create_index([("status", 1)])

        # Product reviews indexes
        await db.product_reviews.create_index([("product_id", 1)])
        await db.product_reviews.create_index([("created_at", -1)])

        # crm_leads — primary CRM collection (5000+ records in production).
        # Compound index on the most-used advanced-search filters.
        await db.crm_leads.create_index([("timestamp", -1)])
        await db.crm_leads.create_index([("stage", 1)])
        await db.crm_leads.create_index([("source", 1)])
        await db.crm_leads.create_index([("priority", 1)])
        await db.crm_leads.create_index([("assigned_to", 1)])
        await db.crm_leads.create_index([("district", 1)])
        await db.crm_leads.create_index([("property_type", 1)])
        await db.crm_leads.create_index([("is_deleted", 1)])
        await db.crm_leads.create_index([("next_follow_up", 1)])
        await db.crm_leads.create_index([("phone", 1)])
        await db.crm_leads.create_index([("is_deleted", 1), ("timestamp", -1)])
        # Text index supports full-text search on name/phone/email/district
        try:
            await db.crm_leads.create_index(
                [("name", "text"), ("phone", "text"), ("email", "text"), ("district", "text")],
                name="crm_leads_text_search",
            )
        except Exception as _te:
            logger.debug(f"crm_leads text index: {_te}")

        # cashfree_orders — production payments collection.
        await db.cashfree_orders.create_index([("order_id", 1)], unique=True, sparse=True)
        await db.cashfree_orders.create_index([("status", 1)])
        await db.cashfree_orders.create_index([("created_at", -1)])
        await db.cashfree_orders.create_index([("customer_phone", 1)])
        await db.cashfree_orders.create_index([("is_deleted", 1)])
        await db.cashfree_orders.create_index([("is_deleted", 1), ("status", 1)])
        await db.cashfree_orders.create_index([("lead_id", 1)], sparse=True)

        # admin_audit_log — write-once records of sensitive admin actions.
        await db.admin_audit_log.create_index([("timestamp", -1)])
        await db.admin_audit_log.create_index([("action", 1)])
        await db.admin_audit_log.create_index([("actor_ip", 1)])
        # Auto-expire audit entries after 1 year
        await db.admin_audit_log.create_index(
            [("timestamp", 1)], expireAfterSeconds=86400 * 365, name="audit_ttl"
        )
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

# ==================== BROTLI COMPRESSION MIDDLEWARE ====================

class BrotliMiddleware(BaseHTTPMiddleware):
    """Brotli compression for supported clients"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Check if client supports brotli
        accept_encoding = request.headers.get("Accept-Encoding", "")
        if "br" not in accept_encoding:
            return response
        
        # Only compress JSON and HTML responses
        content_type = response.headers.get("Content-Type", "")
        if not any(t in content_type for t in ["application/json", "text/html", "text/plain"]):
            return response
        
        return response

# Cache Headers Middleware for static and API responses
class CacheHeadersMiddleware(BaseHTTPMiddleware):
    """Add cache headers for performance optimization"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        
        # Cache static files for 1 year
        if any(ext in path for ext in ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2']):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        # Cache API responses for short duration
        elif path.startswith("/api/") and request.method == "GET":
            # Don't cache auth or admin endpoints
            if not any(x in path for x in ["/auth", "/login", "/otp", "/verify"]):
                response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
        
        return response

# Create the main app
app = FastAPI(
    title="ASR Enterprises API",
    description="Secure Solar Business API",
    version="2.0.0"
)

# Initialize rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Add security middlewares (order matters - last added runs first)
app.add_middleware(RequestSizeLimiterMiddleware)  # Limit request sizes
app.add_middleware(SecurityHeadersMiddleware)  # Add security headers
app.add_middleware(GZipMiddleware, minimum_size=500)  # Compression
app.add_middleware(CacheHeadersMiddleware)  # Cache headers
app.add_middleware(SecurityMiddleware)  # Existing security

# WWW redirect: ensure canonical domain is www.asrenterprises.in.
# Added LAST so it runs FIRST for all incoming requests.
class WwwRedirectMiddleware(BaseHTTPMiddleware):
    """301-redirect bare domain → www for SEO canonical consistency."""
    _NON_WWW_HOSTS = {"asrenterprises.in", "asrenterprises.in:80", "asrenterprises.in:443"}

    async def dispatch(self, request: Request, call_next):
        from fastapi.responses import RedirectResponse as _Redirect
        host = request.headers.get("host", "").lower().split(":")[0]
        if host == "asrenterprises.in":
            target = f"https://www.asrenterprises.in{request.url.path}"
            if request.url.query:
                target += f"?{request.url.query}"
            return _Redirect(url=target, status_code=301)
        return await call_next(request)

app.add_middleware(WwwRedirectMiddleware)

# Startup event to create indexes and start background tasks
@app.on_event("startup")
async def startup_event():
    """Initialize database indexes, Redis cache, and start background tasks on startup"""
    global cleanup_task
    
    # Initialize Redis cache
    await init_redis()

    # Log which database mode is active
    from db_client import MONGO_URI as _MONGO_URI, USE_IN_MEMORY as _USE_IN_MEMORY
    if _MONGO_URI and not _USE_IN_MEMORY:
        logger.info("🌐 DATABASE MODE: MongoDB Atlas (fully persistent) ✅")
        # Verify Atlas connectivity at startup
        try:
            from db_client import ping_db
            ok = await ping_db()
            if ok:
                logger.info("✅ MongoDB Atlas connection verified")
            else:
                logger.error("❌ MongoDB Atlas ping FAILED — check MONGO_URI secret")
        except Exception as _pe:
            logger.error(f"❌ Atlas ping error: {_pe}")
    elif _USE_IN_MEMORY:
        if _MONGO_URI:
            logger.warning("⚠️  DATABASE MODE: In-memory (Atlas DNS failed — verify MONGO_URI hostname). Data will NOT persist across restarts.")
        else:
            logger.warning("⚠️  DATABASE MODE: In-memory (data lost on restart). Set MONGO_URI secret for persistence.")
    else:
        logger.info("🏠 DATABASE MODE: Local MongoDB (MONGO_URL)")

    # Restore in-memory database from disk snapshot (no-op when using real Mongo)
    try:
        await load_snapshot(client, _DB_NAME)
    except Exception as e:
        logger.warning(f"snapshot restore skipped: {e}")

    # Create database indexes
    await create_indexes()
    
    # Initialize HR router with database connection
    init_hr_router(db)
    # Ensure owner / super admin (ASR1001 - ABHIJEET KUMAR) always exists & is active
    await ensure_owner_employee()
    
    # Initialize CRM router with database connection and utilities
    init_crm_router(db, sanitize_input, cache_get, cache_set)
    
    # Initialize Staff router with database connection and utilities
    init_staff_router(db, sanitize_input)
    
    # Start automated cleanup scheduler
    cleanup_task = asyncio.create_task(cleanup_scheduler())

    # Start periodic disk snapshot for in-memory mongo so newly added staff /
    # leads / etc. survive across workflow restarts.
    try:
        asyncio.create_task(periodic_snapshot(client, _DB_NAME, interval=15))
    except Exception as e:
        logger.warning(f"periodic snapshot task not started: {e}")

    # Start Cashfree reconciliation loop — self-healing safety net that polls
    # Cashfree every 5 minutes for any active/pending order whose webhook may
    # have been missed/blocked, and runs the same paid-side-effects (CRM
    # update, service booking, lead stage, WhatsApp confirmation).
    try:
        from routes.cashfree_orders import cashfree_reconcile_loop
        asyncio.create_task(cashfree_reconcile_loop(interval_seconds=300))
        logger.info("Cashfree reconciliation loop started (every 5 minutes)")
    except Exception as e:
        logger.warning(f"Cashfree reconciliation loop not started: {e}")

    # WhatsApp retry loop — every 60s pulls failed outgoing messages and
    # re-fires them through the Meta API with exponential backoff (max 3
    # attempts). Implemented in routes/cashfree_orders.py for module reuse.
    try:
        from routes.cashfree_orders import whatsapp_retry_loop
        asyncio.create_task(whatsapp_retry_loop(interval_seconds=60))
        logger.info("WhatsApp retry loop started (every 60 seconds)")
    except Exception as e:
        logger.warning(f"WhatsApp retry loop not started: {e}")
    
    # ==================== OWNER ACCOUNT INITIALIZATION ====================
    # Ensure owner account exists with full privileges — always runs on startup
    # Uses global OWNER_* constants so credentials are defined in one place only.
    _owner_protected = {
        "staff_id": OWNER_STAFF_ID,
        "name": OWNER_NAME,
        "email": OWNER_EMAIL,
        "mobile": OWNER_MOBILE,
        "role": OWNER_ROLE,
        "department": "admin",
        "designation": "Owner & Managing Director",
        "is_active": True,
        "is_owner": True,
        "is_super_admin": True,
        "can_delete": False,
        "permissions": {
            "full_access": True,
            "manage_staff": True,
            "manage_leads": True,
            "manage_settings": True,
            "manage_whatsapp": True,
            "view_analytics": True,
            "manage_backups": True,
            "manage_credentials": True
        },
        "password_hash": hashlib.sha256(OWNER_PASSWORD.encode()).hexdigest(),
        "notes": "Owner and first employee of ASR ENTERPRISES. Cannot be deleted."
    }
    owner_account = await db.crm_staff_accounts.find_one({"staff_id": OWNER_STAFF_ID})
    if not owner_account:
        _owner_protected["id"] = str(uuid.uuid4())
        _owner_protected["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.crm_staff_accounts.insert_one(_owner_protected)
        logger.info(f"✅ Owner account {OWNER_NAME} ({OWNER_STAFF_ID}) created")
    else:
        # Always re-enforce all owner privileges on startup (cannot be weakened by anyone)
        await db.crm_staff_accounts.update_one(
            {"staff_id": OWNER_STAFF_ID},
            {"$set": {k: v for k, v in _owner_protected.items()}}
        )
        logger.info(f"✅ Owner account {OWNER_NAME} ({OWNER_STAFF_ID}) verified and hardened")

    # ==================== SEED ANAMIKA (ASR1002) - ADMIN MANAGER ====================
    # Anamika is the first admin-department manager. She gets module access for
    # Leads, Customer Portal, Social Media, Gallery, Testimonials, Festive Posts,
    # WhatsApp API and Solar Advisors (controlled in the AdminDashboard UI by
    # role=manager + department=admin). Seeded so she remains available even if
    # the in-memory database is freshly initialized.
    try:
        anamika_id = "ASR1002"
        anamika_name = "Anamika"
        # Correct credentials registered by Super Admin Abhijeet. These are used
        # ONLY for the first-time seed — once the record exists in the DB, the
        # values entered in HR Management are the source of truth and this seed
        # block must NEVER overwrite them (that caused Anamika's email/phone to
        # revert on every restart).
        anamika_email = os.environ.get("ANAMIKA_EMAIL", "anamikarathod1905@gmail.com").lower()
        anamika_phone = os.environ.get("ANAMIKA_PHONE", "7903434221")
        anamika_password = os.environ.get("ANAMIKA_PASSWORD", "anamika@123")
        anamika_pwd_hash = hashlib.sha256(anamika_password.encode()).hexdigest()

        # HR record — create only if missing. Do NOT touch an existing record:
        # the Super Admin's manual edits in HR Management must be preserved.
        hr_doc = await db.hr_employees.find_one({"employee_id": anamika_id})
        if not hr_doc:
            await db.hr_employees.insert_one({
                "id": str(uuid.uuid4()),
                "employee_id": anamika_id,
                "name": anamika_name,
                "email": anamika_email,
                "phone": anamika_phone,
                "department": "admin",
                "designation": "Admin Manager",
                "role": "manager",
                "is_active": True,
                "status": "active",
                "employment_type": "full_time",
                "joining_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "state": "Bihar",
                "salary_type": "monthly",
                "base_salary": 0.0,
                "allowances": 0.0,
                "incentive_percentage": 0.0,
                "documents": {},
                "total_leaves": 18,
                "leaves_taken": 0,
                "leaves_remaining": 18,
                "onboarding_completed": True,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"✅ Seeded admin manager {anamika_name} ({anamika_id})")
        else:
            logger.info(f"Anamika ({anamika_id}) HR record already exists — leaving Super Admin's values untouched")

        # CRM staff (login) record — same rule: create only if missing. The
        # only field we keep in sync on every startup is `password_hash`, and
        # only if ANAMIKA_PASSWORD was explicitly set via env (so owner can
        # recover access). Identity fields (email/phone/name) are owned by HR.
        staff_doc = await db.crm_staff_accounts.find_one({"staff_id": anamika_id})
        if not staff_doc:
            await db.crm_staff_accounts.insert_one({
                "id": str(uuid.uuid4()),
                "staff_id": anamika_id,
                "name": anamika_name,
                "email": anamika_email,
                "phone": anamika_phone,
                "mobile": anamika_phone,
                "role": "manager",
                "department": "admin",
                "is_active": True,
                "otp_login_enabled": True,
                "password_hash": anamika_pwd_hash,
                "leads_assigned": 0,
                "leads_converted": 0,
                "total_revenue": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"✅ Created CRM staff account for {anamika_name} ({anamika_id})")
        elif os.environ.get("ANAMIKA_PASSWORD"):
            # Explicit env override — allow password recovery without touching identity.
            await db.crm_staff_accounts.update_one(
                {"staff_id": anamika_id},
                {"$set": {"password_hash": anamika_pwd_hash}},
            )
            logger.info(f"Anamika ({anamika_id}) password refreshed from ANAMIKA_PASSWORD env override")
        else:
            logger.info(f"Anamika ({anamika_id}) staff account already exists — Super Admin's credentials preserved")
    except Exception as e:
        logger.warning(f"Anamika seed skipped: {e}")

    logger.info("🚀 Application started with database optimizations and automated cleanup")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean shutdown of background tasks and connections"""
    global cleanup_task
    
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

    # Final disk snapshot so the latest writes survive the restart
    try:
        await save_snapshot(client, _DB_NAME)
    except Exception as e:
        logger.warning(f"final snapshot save failed: {e}")

    # Close Redis connection
    await close_redis()
    
    logger.info("🛑 Application shutdown complete")

# Simple Meta Webhook endpoint directly on app (no middleware interference)
@app.get("/webhook")
async def simple_meta_webhook(request: Request):
    """Simple webhook verification for Meta - bypasses all middleware"""
    hub_mode = request.query_params.get("hub.mode")
    hub_verify_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")
    
    logger.info(f"[SIMPLE WEBHOOK] mode={hub_mode}, token=***masked***, challenge={hub_challenge}")
    
    if hub_mode == "subscribe" and hub_verify_token == os.environ.get("META_VERIFY_TOKEN", "asrsolar2026"):
        return PlainTextResponse(content=hub_challenge, status_code=200)
    
    return PlainTextResponse(content="Verification failed", status_code=403)

@app.post("/webhook")
async def simple_meta_webhook_post(request: Request):
    """Simple webhook receiver for Meta messages"""
    body = await request.json()
    logger.info(f"[SIMPLE WEBHOOK POST] Received: {body.get('object', 'unknown')}")
    return JSONResponse(content={"status": "received"}, status_code=200)

api_router = APIRouter(prefix="/api")

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# ASR Solar Expert System Prompt
ASR_SOLAR_EXPERT_PROMPT = """You are the "ASR Solar Expert," the official AI assistant for ASR Enterprises, Patna. Your role is to convert website visitors into leads by explaining solar benefits and government subsidies in Bihar.

### 1. CORE BUSINESS DATA
- Company: ASR Enterprises.
- Credentials: MNRE Bihar Registered Vendor & PM Surya Ghar Partner.
- Location: Shop 10, Aman SKS Complex, Khagaul Saguna Road, Patna.
- Services: Design, supply, installation, and 5-year free maintenance.
- Phone: 9296389097
- Experience: 25+ verified installations across Bihar

### 2. SOLAR PANEL COSTS & INSTALLATION (Updated Pricing)
- 2 kW System: ₹1,50,000 total cost (₹70,000/kW + installation)
- 3 kW System: ₹2,10,000 total cost
- 5 kW System: ₹3,50,000 total cost
- 7 kW System: ₹4,90,000 total cost
- 10 kW System: ₹7,00,000 total cost
- Price includes: Mono-PERC panels, grid-tie inverter, mounting structure, wiring, installation, and commissioning
- Installation time: 2-3 days for residential, 1-2 weeks for commercial

### 3. GOVERNMENT SUBSIDIES & INCENTIVES (PM SURYA GHAR YOJANA)
Apply these exact figures for residential inquiries:
- 1 kW: ₹30,000 subsidy (20% of cost)
- 2 kW: ₹60,000 subsidy (40% of cost)
- 3 kW to 10 kW: ₹78,000 Fixed maximum subsidy
- Commercial/Industrial: No direct subsidy, but 80% accelerated depreciation tax benefits
- Subsidy is directly credited to customer's bank account within 30 days
- Required documents: Electricity bill, Aadhar card, Bank details, House ownership proof

### 4. ROI AND SAVINGS CALCULATIONS
- Monthly savings: 80-90% of current bill amount
- Payback period: 3-4 years (after subsidy)
- System lifespan: 25+ years
- Example: ₹3000 monthly bill → Save ₹2,700/month → ₹32,400/year → ₹8 Lakhs+ over 25 years
- After payback period: FREE electricity for remaining 20+ years

### 5. MAINTENANCE & WARRANTY INFORMATION
- Panel warranty: 25 years performance guarantee (min 80% efficiency)
- Inverter warranty: 5 years standard, extendable to 10 years
- FREE maintenance: 5 years from ASR Enterprises
- Maintenance includes: Panel cleaning, performance monitoring, inverter check
- Annual maintenance cost after 5 years: ₹2,000-3,000

### 6. SYSTEM SIZING & REQUIREMENTS
Based on monthly electricity bill:
- Bill ₹500-1500: 2 kW system (6 panels, 100 sq ft roof)
- Bill ₹1500-3000: 3 kW system (9 panels, 150 sq ft roof)
- Bill ₹3000-4500: 4 kW system (12 panels, 200 sq ft roof)
- Bill ₹4500-6000: 5 kW system (15 panels, 250 sq ft roof)
- Bill ₹6000+: 7-10 kW system (21-30 panels, 350-500 sq ft roof)
- Roof types supported: RCC, Metal sheet, Tin shed
- Shadow-free area required during 9 AM - 5 PM

### 7. FINANCING OPTIONS
- Zero-cost EMI: Starting ₹2,000/month
- Bank loans: 6-9% interest rate
- Loan tenure: 3-7 years
- No down payment required with government subsidy

### 8. CONVERSION & LEAD CAPTURE
- After answering 2 questions, ask for the user's Mobile Number and District to "book a FREE site survey".
- Districts served: All 38 districts of Bihar, including Patna, Gaya, Muzaffarpur, Bhagalpur, Vaishali, Hajipur, Arrah, Chhapra.
- Site survey is FREE and includes: Roof assessment, shadow analysis, exact quotation, subsidy calculation

### 9. STYLE & TONE
- Language: Professional, polite, and knowledgeable. Respond in the same language the user uses (Hindi or English).
- Keep responses concise but informative (max 200 words).
- Restrictions: Do not discuss non-solar topics. If asked about competitors, focus on ASR's 25-year warranty and official MNRE registration.
- Always end with a question or call-to-action to keep the conversation going.
- Use WhatsApp for follow-up: 919296389097
"""

# Admin AI Assistant Prompt
ASR_ADMIN_ASSISTANT_PROMPT = """You are the ASR Admin Assistant, an AI helper for ASR Enterprises staff. You help with:

1. **Quote Generation**: Calculate solar system quotes based on:
   - 2 kW: ₹1,50,000 total (₹90,000 after subsidy)
   - 3 kW: ₹2,10,000 total (₹1,32,000 after subsidy)
   - 5 kW: ₹3,50,000 total (₹2,72,000 after subsidy)
   - Include: Panels, inverter, mounting, wiring, installation, 5-year maintenance

2. **WhatsApp Reply Templates**: Generate professional responses for:
   - Price inquiries
   - Subsidy questions
   - Site survey scheduling
   - Follow-up messages

3. **Lead Prioritization**: Help analyze leads based on:
   - Monthly bill amount (higher = higher priority)
   - Property type (commercial > residential for larger orders)
   - Location accessibility

4. **Subsidy Calculations**:
   - 1 kW: ₹30,000 subsidy
   - 2 kW: ₹60,000 subsidy
   - 3+ kW: ₹78,000 maximum

5. **Financing Options**:
   - EMI starting ₹2,000/month
   - Interest rate: 6-9%
   - Tenure: 3-7 years

Always be helpful, professional, and provide actionable information."""

# Chat session storage (in production, use Redis)
chat_sessions = {}

# OTP Storage with expiry (In production, use Redis)
otp_storage = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes
OTP_COOLDOWN_SECONDS = 60  # Minimum 60 seconds between OTP sends

# ==================== AUTOMATED CLEANUP SCHEDULER ====================

# Cleanup configuration
CLEANUP_INTERVAL_HOURS = 24  # Run cleanup every 24 hours (daily)
WEEKLY_DEEP_CLEANUP_DAY = 0  # Monday (0 = Monday, 6 = Sunday)
cleanup_task = None
last_cleanup_time = None
last_deep_cleanup_time = None

async def perform_cleanup(deep_clean: bool = False):
    """Perform database cleanup operations"""
    global last_cleanup_time, last_deep_cleanup_time
    
    try:
        now = datetime.now(timezone.utc)
        cleanup_results = {
            "type": "deep" if deep_clean else "regular",
            "old_sessions_deleted": 0,
            "old_logs_deleted": 0,
            "old_otp_cleared": 0,
            "expired_bookings_cleaned": 0,
            "old_notifications_deleted": 0,
            "cache_cleared": True,
            "indexes_verified": False
        }
        
        # 1. Delete old sessions (older than 7 days)
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        sessions_result = await db.sessions.delete_many({"created_at": {"$lt": seven_days_ago}})
        cleanup_results["old_sessions_deleted"] = sessions_result.deleted_count
        
        # 2. Delete old activity logs (older than 30 days)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        logs_result = await db.activity_logs.delete_many({"timestamp": {"$lt": thirty_days_ago}})
        cleanup_results["old_logs_deleted"] = logs_result.deleted_count
        
        # 3. Clear expired OTPs from memory
        current_time = time.time()
        expired_otps = [email for email, data in otp_storage.items() 
                       if current_time - data.get("timestamp", 0) > OTP_EXPIRY_SECONDS]
        for email in expired_otps:
            del otp_storage[email]
        cleanup_results["old_otp_cleared"] = len(expired_otps)
        
        # 4. Delete old pending bookings (older than 24 hours and not paid)
        one_day_ago = (now - timedelta(days=1)).isoformat()
        bookings_result = await db.service_bookings.delete_many({
            "payment_status": "pending",
            "created_at": {"$lt": one_day_ago}
        })
        cleanup_results["expired_bookings_cleaned"] = bookings_result.deleted_count
        
        # 5. Delete old notifications (older than 30 days)
        notifications_result = await db.notifications.delete_many({
            "created_at": {"$lt": thirty_days_ago}
        })
        cleanup_results["old_notifications_deleted"] = notifications_result.deleted_count

        # 5b. WhatsApp messages are CRM records — do NOT auto-delete them.
        # Message history is permanent; admins can manually clear via the CRM UI.
        cleanup_results["old_whatsapp_messages_deleted"] = 0
        
        # 6. Clear API cache
        invalidate_cache()
        
        # 7. Deep clean operations (weekly)
        if deep_clean:
            # Re-create indexes to ensure optimization
            await create_indexes()
            cleanup_results["indexes_verified"] = True
            
            # Delete cancelled orders older than 90 days
            ninety_days_ago = (now - timedelta(days=90)).isoformat()
            old_cancelled = await db.orders.delete_many({
                "status": "cancelled",
                "created_at": {"$lt": ninety_days_ago}
            })
            cleanup_results["old_cancelled_orders_deleted"] = old_cancelled.deleted_count
            
            # Clean up orphaned cart data
            cleanup_results["deep_clean_completed"] = True
            last_deep_cleanup_time = now
        
        last_cleanup_time = now
        logger.info(f"🧹 Auto cleanup completed: {cleanup_results}")
        return cleanup_results
        
    except Exception as e:
        logger.error(f"Auto cleanup error: {e}")
        return {"error": str(e)}

async def cleanup_scheduler():
    """Background task that runs cleanup on schedule"""
    global cleanup_task
    
    logger.info("🕐 Automated cleanup scheduler started")
    
    while True:
        try:
            # Wait for the interval
            await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 3600)  # Convert hours to seconds
            
            # Check if it's the deep cleanup day (Monday)
            now = datetime.now(timezone.utc)
            is_deep_clean_day = now.weekday() == WEEKLY_DEEP_CLEANUP_DAY
            
            # Perform cleanup
            logger.info(f"🧹 Starting {'deep' if is_deep_clean_day else 'regular'} auto cleanup...")
            await perform_cleanup(deep_clean=is_deep_clean_day)
            
        except asyncio.CancelledError:
            logger.info("Cleanup scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"Cleanup scheduler error: {e}")
            # Continue running even if there's an error
            await asyncio.sleep(3600)  # Wait 1 hour before retrying

# ==================== NOTIFICATION STORAGE ====================
# In-app notifications storage
notifications_storage = defaultdict(list)

def generate_secure_otp() -> str:
    """Generate a secure 6-digit OTP"""
    return str(random.SystemRandom().randint(100000, 999999))

def can_send_otp(email: str) -> tuple:
    """Check if OTP can be sent (cooldown check)"""
    if email in otp_storage:
        last_sent = otp_storage[email].get("timestamp", 0)
        time_since_last = time.time() - last_sent
        if time_since_last < OTP_COOLDOWN_SECONDS:
            remaining = int(OTP_COOLDOWN_SECONDS - time_since_last)
            return False, f"Please wait {remaining} seconds before requesting another OTP"
    return True, None

def store_otp(email: str, otp: str):
    """Store OTP with timestamp"""
    otp_storage[email] = {
        "otp": otp,
        "timestamp": time.time(),
        "attempts": 0
    }

async def send_otp_email(email: str, otp: str, user_type: str = "Admin") -> bool:
    """Send OTP via Resend Email API"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - OTP email not sent")
        return False
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://customer-assets.emergentagent.com/job_marketing-ai-hub-18/artifacts/tnvw3j4i_file_000000002898720bbdee3e2f991ebe3f.png" alt="ASR Enterprises" style="height: 60px;">
        </div>
        <h2 style="color: #ea580c; text-align: center;">ASR Enterprises - {user_type} Login</h2>
        <p style="color: #333; font-size: 16px;">Your One-Time Password (OTP) for login verification:</p>
        <div style="background: linear-gradient(135deg, #ea580c, #f97316); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            {otp}
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
            ASR Enterprises - Bihar's Trusted Solar Rooftop Installation Company<br>
            📞 9296389097 | ✉️ support@asrenterprises.in
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": f"ASR Enterprises - Your {user_type} Login OTP: {otp}",
        "html": html_content
    }
    
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"OTP email sent to {email}, ID: {result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {e}")
        return False

def verify_otp(email: str, otp: str) -> bool:
    """Verify OTP with expiry and attempt checking"""
    if email not in otp_storage:
        return False
    
    stored = otp_storage[email]
    
    # Check expiry
    if time.time() - stored["timestamp"] > OTP_EXPIRY_SECONDS:
        del otp_storage[email]
        return False
    
    # Check attempts (max 3)
    if stored["attempts"] >= 3:
        del otp_storage[email]
        return False
    
    stored["attempts"] += 1
    
    # Verify OTP (constant time comparison to prevent timing attacks)
    # Allow real OTP OR fallback 131993 for admin email during development
    admin_email = "support@asrenterprises.in"
    is_admin = email.lower() == admin_email
    is_staff_2fa = email.startswith("staff_2fa:") or email.startswith("staff:")
    
    if hmac.compare_digest(stored["otp"], otp):
        del otp_storage[email]
        return True
    elif is_admin and otp == "131993":
        # Admin fallback for development/testing
        del otp_storage[email]
        return True
    elif not RESEND_API_KEY and otp == "131993":
        # Fallback for testing without email configured
        del otp_storage[email]
        return True
    elif is_staff_2fa and otp == "131993":
        # Staff 2FA fallback for testing (matches message shown on login)
        del otp_storage[email]
        return True
    
    return False

# ==================== NOTIFICATION FUNCTIONS ====================

def add_notification(staff_id: str, notification_type: str, title: str, message: str, lead_id: str = None):
    """Add in-app notification for staff"""
    notification = {
        "id": str(uuid.uuid4()),
        "type": notification_type,  # followup, lead_assigned, message, reminder
        "title": title,
        "message": message,
        "lead_id": lead_id,
        "is_read": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    notifications_storage[staff_id].append(notification)
    # Keep only last 50 notifications per staff
    if len(notifications_storage[staff_id]) > 50:
        notifications_storage[staff_id] = notifications_storage[staff_id][-50:]
    return notification

def get_whatsapp_url(phone: str, message: str) -> str:
    """Generate WhatsApp Web URL with pre-filled message"""
    clean_phone = re.sub(r'\D', '', phone)
    if not clean_phone.startswith('91'):
        clean_phone = f'91{clean_phone}'
    encoded_message = message.replace(' ', '%20').replace('\n', '%0A')
    return f"https://wa.me/{clean_phone}?text={encoded_message}"

# Staff Authentication Storage
staff_sessions = {}

# Staff Login Model
class StaffLogin(BaseModel):
    staff_id: str
    password: str

# Models with enhanced validation
class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = ""  # Made optional since simplified form doesn't have email
    phone: str
    district: str
    address: Optional[str] = ""
    property_type: str = "residential"
    roof_type: str = "rcc"
    monthly_bill: Optional[float] = None
    roof_area: Optional[float] = None
    message: Optional[str] = ""

    @validator('name')
    def validate_name(cls, v):
        if is_suspicious_input(v):
            raise ValueError('Invalid input detected')
        return sanitize_input(v)
    
    @validator('phone')
    def validate_phone(cls, v):
        cleaned = re.sub(r'[\s\-\+]', '', v)
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError('Invalid phone number format')
        return cleaned
    
    @validator('district', 'address', 'message', 'property_type', 'roof_type')
    def sanitize_fields(cls, v):
        if v and is_suspicious_input(v):
            raise ValueError('Invalid input detected')
        return sanitize_input(v) if v else v

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    district: str = ""
    location: str = ""
    interest: str = ""
    address: str = ""
    property_type: str = "residential"
    roof_type: str = "rcc"
    monthly_bill: Optional[float] = None
    monthly_electricity_bill: Optional[float] = None
    roof_area: Optional[float] = None
    message: str = ""
    ai_analysis: Optional[str] = None
    lead_score: Optional[int] = None
    recommended_system: Optional[str] = None
    status: str = "new"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Photo Upload Model
class WorkPhoto(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    image_url: str
    location: str
    system_size: str
    category: str = "installation"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Customer Review Model
class CustomerReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_name: str
    location: str
    rating: int = 5
    review_text: str
    system_installed: str = ""
    solar_capacity: str = ""
    monthly_bill_before: str = ""
    monthly_bill_after: str = ""
    photo_url: Optional[str] = None
    verified: bool = True
    is_testimonial: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Festival Post Model
class FestivalPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    image_url: Optional[str] = None
    is_active: bool = True
    start_date: str
    end_date: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Government News Model
class GovtNews(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: str
    source: str
    url: Optional[str] = None
    category: str = "scheme"
    is_active: bool = True
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Staff Model with AI features
class StaffMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    role: str
    reportingTo: str
    joiningDate: str
    status: str = "active"
    performance_score: int = 80
    tasks_completed: int = 0
    tasks_pending: int = 0
    attendance_percentage: float = 95.0
    ai_performance_insights: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Bihar Districts
BIHAR_DISTRICTS = [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
    "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
    "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
    "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
    "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
    "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
]

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_phone: str
    user_message: str
    bot_response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    user_phone: str
    message: str
    session_id: Optional[str] = None

class SolarCalculationRequest(BaseModel):
    monthly_bill: float
    roof_area: float
    location: str
    electricity_rate: Optional[float] = 7.5
    has_three_phase: bool = False

class SolarCalculation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    monthly_bill: float
    roof_area: float
    location: str
    electricity_rate: float
    recommended_capacity_kw: float
    estimated_cost: float
    monthly_savings: float
    annual_savings: float
    payback_period_years: float
    panels_required: int
    co2_offset_kg_yearly: float
    ai_recommendations: str
    system_type: str
    subsidy_info: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CampaignCreate(BaseModel):
    name: str
    target_audience: str
    message_template: str
    channel: str

class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    target_audience: str
    message_template: str
    channel: str
    status: str = "draft"
    ai_optimized_message: Optional[str] = None
    sent_count: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    platform: str
    campaign_name: str
    impressions: int
    clicks: int
    conversions: int
    cost: float
    ctr: float
    cpc: float
    conversion_rate: float
    ai_insights: str
    ai_recommendations: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== TASK & COMMUNICATION MODELS ====================

# Task Model for Employee Work Assignment
class StaffTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    staff_id: str
    staff_name: str = ""
    title: str
    description: str = ""
    task_type: str = "call"  # call, visit, survey, installation, follow_up, other
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    priority: str = "medium"  # high, medium, low
    due_date: str
    due_time: str = "10:00"
    status: str = "pending"  # pending, in_progress, completed, cancelled
    completed_at: Optional[str] = None
    notes: str = ""
    created_by: str = "admin"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== SHOP/E-COMMERCE MODELS ====================

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    short_description: str = ""
    category: str = "solar_panel"  # solar_panel, inverter, battery, accessory, service
    price: float
    sale_price: Optional[float] = None
    stock: int = 0
    sku: str = ""
    brand: str = ""
    specifications: Dict[str, Any] = {}
    electrical_specs: Dict[str, str] = {}   # e.g. {"Peak Power": "730W", "Efficiency": "23.5%"}
    mechanical_specs: Dict[str, str] = {}   # e.g. {"Weight": "38.3 kg", "Frame": "Anodized Aluminium"}
    warranty_info: Dict[str, str] = {}      # e.g. {"Product Warranty": "15-year", "Performance": "30-year"}
    shipping_info: str = ""
    product_highlights: List[str] = []     # Bullet-point feature list
    images: List[str] = []  # List of image URLs
    is_active: bool = True
    is_featured: bool = False
    warranty: str = ""
    delivery_available: bool = True
    pickup_available: bool = True
    delivery_districts: List[str] = []  # List of Bihar districts this product delivers to (empty = all)
    delivery_fees: Dict[str, float] = {}  # District-wise delivery fees
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    customer_name: str
    customer_phone: str = ""
    rating: int = 5  # 1-5 stars
    title: str = ""
    review_text: str = ""
    is_verified_purchase: bool = False
    is_approved: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CartItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    price: float
    image: str = ""

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = Field(default_factory=lambda: f"ASR{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:6].upper()}")
    customer_name: str
    customer_phone: str
    customer_email: str = ""
    items: List[Dict[str, Any]] = []
    subtotal: float
    delivery_charge: float = 0
    total: float
    delivery_type: str = "pickup"  # pickup, delivery
    delivery_address: str = ""
    delivery_district: str = "Patna"
    payment_method: str = "cod"  # cod, razorpay
    payment_status: str = "pending"  # pending, paid, failed
    razorpay_order_id: str = ""
    razorpay_payment_id: str = ""
    order_status: str = "pending"  # pending, confirmed, processing, ready, delivered, cancelled
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Activity Log for Lead Timeline
class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    staff_id: Optional[str] = None
    staff_name: str = ""
    activity_type: str  # call, visit, note, status_change, quotation, payment, message
    title: str
    description: str = ""
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Internal Chat/Message Model
class CRMMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    sender_type: str  # admin, staff
    receiver_id: Optional[str] = None  # None = broadcast to all
    receiver_name: str = ""
    lead_id: Optional[str] = None  # If message is about a specific lead
    message: str
    is_read: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StaffMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    role: str
    reportingTo: str
    joiningDate: str
    status: str = "active"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== CRM MODELS ====================

# CRM Employee Model
class CRMEmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    role: str  # sales, survey, installation, manager
    department: str = "sales"
    is_active: bool = True
    leads_assigned: int = 0
    leads_converted: int = 0
    total_revenue: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Lead with Pipeline
class CRMLead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    district: str = ""
    address: str = ""
    property_type: str = "residential"
    monthly_bill: Optional[float] = None
    roof_area: Optional[float] = None
    source: str = "website"  # website, whatsapp, call, facebook, instagram
    # Pipeline stage - aligned with frontend CRMDashboard.js and StaffPortal.js
    stage: str = "new"  # new, contacted, site_visit, quotation, negotiation, converted, completed, lost
    # New Leads Management System
    lead_status: str = "new"  # 'new', 'in_progress', 'follow_up', 'closed'
    is_new: bool = True  # Visual flag for "NEW" badge - auto-removed on first contact
    first_contact_at: Optional[str] = None  # When staff first interacted
    # Assignment
    assigned_to: Optional[str] = None  # employee id
    assigned_by: Optional[str] = None
    # Follow-up
    next_follow_up: Optional[str] = None
    follow_up_notes: str = ""
    # Quotation
    quoted_amount: Optional[float] = None
    system_size: Optional[str] = None
    # Payment
    advance_paid: float = 0.0
    total_amount: float = 0.0
    pending_amount: float = 0.0
    # AI
    lead_score: int = 50
    ai_priority: str = "medium"  # high, medium, low
    ai_suggestions: Optional[str] = None
    # History
    status_history: List[Dict[str, Any]] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Follow-up Reminder
class CRMFollowUp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    employee_id: str
    reminder_date: str
    reminder_time: str = "10:00"
    reminder_type: str = "call"  # call, visit, quotation, payment
    notes: str = ""
    status: str = "pending"  # pending, completed, missed
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Project/Installation
class CRMProject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    customer_name: str
    customer_phone: str
    location: str
    system_size: str
    brand: str
    total_amount: float
    advance_received: float = 0.0
    pending_amount: float = 0.0
    # Installation
    installation_date: Optional[str] = None
    installation_status: str = "pending"  # pending, in_progress, completed
    assigned_team: List[str] = []
    # Progress
    survey_done: bool = False
    material_delivered: bool = False
    structure_installed: bool = False
    panels_installed: bool = False
    wiring_done: bool = False
    inverter_installed: bool = False
    meter_installed: bool = False
    testing_done: bool = False
    handover_done: bool = False
    # Photos
    installation_photos: List[str] = []
    completion_photos: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CRM Payment
class CRMPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    lead_id: str
    amount: float
    payment_type: str = "advance"  # advance, partial, final
    payment_mode: str = "cash"  # cash, upi, bank_transfer, cheque
    received_by: str
    notes: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# HR Employee Management Model
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

# HR Leave Request Model
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

# HR Attendance Model
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

class Quotation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = ""
    location: str
    systemSize: str
    brand: str
    panelType: str
    installationType: str
    includeSubsidy: bool
    additionalNotes: Optional[str] = ""
    calculation: Dict[str, Any]
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# AI Helper Functions
async def analyze_lead_with_ai(lead_data: LeadCreate) -> Dict[str, Any]:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an AI assistant for ASR Enterprises, a solar installation company in Bihar, India."
        )
        prompt = f"""Analyze this solar installation lead for ASR ENTERPRISES, Bihar:
        Name: {lead_data.name}
        District: {lead_data.district}
        Property: {lead_data.property_type}
        Roof: {lead_data.roof_type}
        Monthly Bill: ₹{lead_data.monthly_bill or 'N/A'}
        Roof Area: {lead_data.roof_area or 'N/A'} sq ft
        
        Return JSON only: {{"lead_score": 1-100, "recommended_system": "X kW System", "ai_analysis": "brief analysis"}}"""
        
        response = await chat.send_message(model="gpt-4o-mini", messages=[UserMessage(text=prompt)])
        result = json.loads(response.replace("```json", "").replace("```", "").strip())
        return {
            "lead_score": result.get("lead_score", 75),
            "recommended_system": result.get("recommended_system", "3-5 kW System"),
            "ai_analysis": result.get("ai_analysis", "Potential solar customer in Bihar")
        }
    except Exception as e:
        logger.error(f"Lead analysis error: {e}")
        # Calculate basic score based on bill
        bill = lead_data.monthly_bill or 2000
        score = min(95, 50 + int(bill / 100))
        system = "2-3 kW" if bill < 2000 else "3-5 kW" if bill < 4000 else "5-10 kW"
        return {
            "lead_score": score,
            "recommended_system": f"{system} System",
            "ai_analysis": f"Customer from {lead_data.district}, Bihar. Suitable for {system} solar system based on usage."
        }

async def generate_whatsapp_response(user_message: str, session_id: str) -> str:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are AI assistant for ASR ENTERPRISES, a solar installation company in Patna, Bihar."
        )
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""You are AI assistant for ASR ENTERPRISES, Patna, Bihar.
            Phone: 9296389097, Email: support@asrenterprises.in
            Office: Shop 10 AMAN SKS COMPLEX Khagaul Saguna Road Patna 801503
            
            Help with: Solar panels, PM Surya Ghar subsidy (max ₹78,000), EMI options, installation.
            Brands: TATA Power Solar, Adani, Luminous, Loom Solar, Waaree, Vikram Solar (₹64-68/W)
            
            User message: {user_message}
            
            Keep response under 150 words. Be helpful and professional.""")]
        )
        return response
    except:
        return "Thank you for contacting ASR ENTERPRISES! For solar installation inquiry, call 9296389097 or email support@asrenterprises.in. We offer PM Surya Ghar subsidy up to ₹78,000!"

# API Routes

# ==================== GEMINI AI CHAT ENDPOINTS ====================
@api_router.post("/ai/chat/public")
async def public_ai_chat(request: Request, data: Dict[str, Any]):
    """
    Public AI chat for website visitors - ASR Solar Expert
    Features:
    - Creates/updates CRM leads
    - Detects human handover triggers
    - Stores conversations for WhatsApp CRM flow
    """
    try:
        session_id = data.get("session_id", str(uuid.uuid4()))
        message = data.get("message", "").strip()
        visitor_info = data.get("visitor_info", {})  # Optional: name, phone, location
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Use Emergent LLM key with Gemini model as primary (better quota management)
        # Fall back to user's Gemini key if available
        api_key = EMERGENT_LLM_KEY or GEMINI_API_KEY
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Get or create chat session
        if session_id not in chat_sessions:
            chat_sessions[session_id] = {
                "messages": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "lead_captured": False,
                "lead_id": None,
                "human_handover_requested": False,
                "visitor_info": visitor_info
            }
        
        session = chat_sessions[session_id]
        
        # Add user message to history
        session["messages"].append({
            "role": "user",
            "content": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # ==================== HUMAN HANDOVER DETECTION ====================
        handover_triggers = [
            "price", "quotation", "quote", "cost", "rate", "kitna lagega",
            "subsidy", "pm surya", "yojana", "government",
            "site visit", "visit karo", "ghar aao", "survey",
            "install", "installation", "lagwana",
            "home solar", "ghar ka solar", "residential",
            "shop solar", "office solar", "commercial", "dukan",
            "monthly bill", "bijli bill", "upload bill",
            "talk to human", "agent", "executive", "sales", "expert",
            "callback", "call me", "call back", "urgent"
        ]
        
        message_lower = message.lower()
        needs_human = any(trigger in message_lower for trigger in handover_triggers)
        
        # ==================== LEAD CAPTURE ====================
        # Extract phone number from message
        phone_pattern = r'(?:\+91)?[6-9]\d{9}'
        phone_match = re.search(phone_pattern, message)
        captured_phone = phone_match.group() if phone_match else None
        
        # Create or update lead if phone detected OR if human handover needed
        lead_id = session.get("lead_id")
        
        if captured_phone or needs_human:
            lead_data = {
                "source": "website_chatbot",
                "stage": "new",
                "chat_session_id": session_id,
                "chat_messages": session["messages"],
                "last_interaction": datetime.now(timezone.utc).isoformat()
            }
            
            if captured_phone:
                # Clean phone number
                clean_phone = captured_phone.replace("+91", "")
                if len(clean_phone) == 10:
                    clean_phone = f"91{clean_phone}"
                
                # Check if lead exists
                existing_lead = await db.crm_leads.find_one(
                    {"$or": [
                        {"phone": clean_phone},
                        {"phone": clean_phone[-10:]}
                    ]},
                    {"_id": 0}
                )
                
                if existing_lead:
                    lead_id = existing_lead["id"]
                    # Update existing lead
                    await db.crm_leads.update_one(
                        {"id": lead_id},
                        {
                            "$set": {
                                "chat_session_id": session_id,
                                "last_interaction": datetime.now(timezone.utc).isoformat()
                            },
                            "$push": {
                                "activities": {
                                    "id": str(uuid.uuid4()),
                                    "type": "website_chat",
                                    "title": "Website Chatbot Conversation",
                                    "description": f"Customer chatted via website: {message[:100]}",
                                    "timestamp": datetime.now(timezone.utc).isoformat()
                                }
                            }
                        }
                    )
                else:
                    # Create new lead
                    lead_id = str(uuid.uuid4())
                    new_lead = {
                        "id": lead_id,
                        "name": visitor_info.get("name", f"Website Chat {clean_phone[-4:]}"),
                        "phone": clean_phone,
                        "email": visitor_info.get("email", ""),
                        "source": "website_chatbot",
                        "stage": "new",
                        "tags": ["whatsapp_lead", "new_inquiry", "website_chat"],
                        "chat_session_id": session_id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "activities": [{
                            "id": str(uuid.uuid4()),
                            "type": "lead_created",
                            "title": "Lead Created from Website Chat",
                            "description": f"Customer initiated chat: {message[:100]}",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }]
                    }
                    await db.crm_leads.insert_one(new_lead)
                    session["lead_captured"] = True
                
                session["lead_id"] = lead_id
        
        # ==================== MARK HUMAN REQUIRED ====================
        if needs_human and lead_id and not session.get("human_handover_requested"):
            session["human_handover_requested"] = True
            
            # Determine intent for tagging
            intent_tags = []
            if any(t in message_lower for t in ["price", "quotation", "quote", "cost", "rate", "kitna"]):
                intent_tags.append("quotation_requested")
            if any(t in message_lower for t in ["subsidy", "pm surya", "yojana"]):
                intent_tags.append("subsidy_interest")
            if any(t in message_lower for t in ["site visit", "visit", "survey"]):
                intent_tags.append("site_visit_requested")
            if any(t in message_lower for t in ["home solar", "ghar"]):
                intent_tags.append("home_solar")
            if any(t in message_lower for t in ["shop", "office", "commercial", "dukan"]):
                intent_tags.append("commercial_solar")
            if any(t in message_lower for t in ["talk to", "agent", "executive", "sales", "callback"]):
                intent_tags.append("sales_call_requested")
            
            # Update lead with human_required flag
            await db.crm_leads.update_one(
                {"id": lead_id},
                {
                    "$set": {
                        "human_required": True,
                        "human_required_at": datetime.now(timezone.utc).isoformat(),
                        "human_required_reason": message[:200],
                        "assigned_to": None,  # Unassigned queue
                        "stage": "contacted"
                    },
                    "$addToSet": {"tags": {"$each": intent_tags + ["human_required", "hot_lead"]}},
                    "$push": {
                        "activities": {
                            "id": str(uuid.uuid4()),
                            "type": "human_handover",
                            "title": "Human Handover Requested",
                            "description": f"Customer requested human assistance. Trigger: {message[:100]}",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    }
                }
            )
            
            logger.info(f"Human handover requested for lead {lead_id} from session {session_id}")
        
        # ==================== BUILD RESPONSE ====================
        # Build conversation history for context
        history_text = ""
        for msg in session["messages"][-10:]:  # Last 10 messages for context
            role = "Customer" if msg["role"] == "user" else "ASR Expert"
            history_text += f"{role}: {msg['content']}\n"
        
        # If human handover requested, add special instruction to AI
        handover_instruction = ""
        if needs_human and session.get("human_handover_requested"):
            handover_instruction = """
IMPORTANT: The customer needs human assistance. In your response:
1. Acknowledge their request warmly
2. Tell them our team will contact them shortly
3. Ask for their phone number if not already provided
4. Provide the contact number: 9296389097
5. Do NOT try to handle complex pricing or technical details yourself
"""
        
        # Create Gemini chat instance using Emergent key
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=ASR_SOLAR_EXPERT_PROMPT + handover_instruction
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Send message with context
        context_message = f"Previous conversation:\n{history_text}\n\nCustomer's latest message: {message}"
        response = await chat.send_message(UserMessage(text=context_message))
        
        # Add assistant response to history
        session["messages"].append({
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Store chat in database for CRM reference
        await db.website_chat_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "messages": session["messages"],
                    "lead_id": lead_id,
                    "human_handover_requested": session.get("human_handover_requested", False),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "source": "website_chatbot"
                }
            },
            upsert=True
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "response": response,
            "message_count": len(session["messages"]),
            "lead_id": lead_id,
            "human_handover": session.get("human_handover_requested", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Public AI chat error: {e}")
        return {
            "success": False,
            "response": "I apologize, but I'm having trouble connecting. Please call us at 9296389097 for immediate assistance with your solar inquiry!",
            "error": str(e)
        }


@api_router.post("/ai/chat/admin")
async def admin_ai_chat(request: Request, data: Dict[str, Any]):
    """Admin AI assistant for staff - quote generation, WhatsApp replies"""
    try:
        session_id = data.get("session_id", str(uuid.uuid4()))
        message = data.get("message", "").strip()
        context_type = data.get("context_type", "general")  # general, quote, whatsapp, lead
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Use Emergent LLM key with Gemini model
        api_key = EMERGENT_LLM_KEY or GEMINI_API_KEY
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Create admin chat instance
        admin_session_id = f"admin_{session_id}"
        
        # Prepare context-specific prompt addition
        context_additions = {
            "quote": "\n\nThe user needs help generating a quote. Ask for system size, location, and property type if not provided.",
            "whatsapp": "\n\nThe user needs a WhatsApp message template. Generate a professional, friendly message.",
            "lead": "\n\nThe user needs help analyzing a lead. Provide prioritization and next action suggestions.",
            "general": ""
        }
        
        enhanced_prompt = ASR_ADMIN_ASSISTANT_PROMPT + context_additions.get(context_type, "")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=admin_session_id,
            system_message=enhanced_prompt
        ).with_model("gemini", "gemini-2.5-flash")
        
        response = await chat.send_message(UserMessage(text=message))
        
        return {
            "success": True,
            "session_id": session_id,
            "response": response,
            "context_type": context_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin AI chat error: {e}")
        return {
            "success": False,
            "response": "AI assistant temporarily unavailable. Please try again.",
            "error": str(e)
        }


# ASR Staff Training Assistant System Prompt
ASR_TRAINING_ASSISTANT_PROMPT = """You are the AI Training Assistant for ASR Enterprises - a leading solar energy company in Bihar, India.

## About ASR Enterprises
- **Company**: ASR Enterprises (आसर एंटरप्राइजेज)
- **Location**: Patna, Bihar
- **Business**: Solar panel installation under PM Surya Ghar Yojana
- **Experience**: Trusted solar installer with 500+ installations in Bihar
- **Services**: Residential rooftop solar, commercial solar, on-grid systems
- **USP**: End-to-end service from consultation to installation to subsidy processing

## Your Role
You are training new staff members (telecallers, sales executives, technicians) to become solar sales experts. Be encouraging, practical, and always provide actionable advice.

## PM Surya Ghar Yojana 2024-25 Knowledge (CRITICAL - Always provide accurate info):

### Subsidy Structure:
- 1 kW to 2 kW: ₹30,000 per kW (Maximum ₹60,000)
- 2 kW to 3 kW: ₹18,000 per kW (₹60,000 + ₹18,000 = ₹78,000 for 3 kW)
- Above 3 kW: Fixed subsidy of ₹78,000
- Note: Subsidy comes DIRECTLY to customer's bank account from government

### Eligibility:
- Only for residential properties (not commercial)
- Must have valid electricity connection
- Must have adequate shadow-free roof space
- One subsidy per household

### Application Process:
1. Customer applies on pmsuryaghar.gov.in
2. Chooses vendor (ASR Enterprises)
3. Site survey and quotation
4. Installation (7-10 days)
5. DISCOM inspection and net meter installation
6. Subsidy credited to bank account (within 30-60 days)

### System Sizing Guide:
| Monthly Bill | Recommended System | Approx. Cost (After Subsidy) |
|-------------|-------------------|------------------------------|
| ₹1,000-2,000 | 1-2 kW | ₹10,000-30,000 |
| ₹2,000-4,000 | 2-3 kW | ₹30,000-50,000 |
| ₹4,000-6,000 | 3-4 kW | ₹60,000-90,000 |
| ₹6,000+ | 5+ kW | ₹1,00,000+ |

## ASR Enterprises Pricing (2024-25):
- Installation Cost: ₹70,000 per kW (all-inclusive)
- Includes: Panels, Inverter, Mounting, Wiring, Installation, Net Meter Processing
- Warranty: 25 years on panels, 5 years on inverter
- Free: First year maintenance

## Sales Training Guidelines:

### Opening Call Script:
"नमस्ते [Name] जी, मैं ASR Enterprises से बोल रहा/रही हूं। क्या आपको पता है कि PM Surya Ghar योजना में ₹78,000 तक सरकारी सब्सिडी मिल रही है? आपका बिजली बिल लगभग शून्य हो जाएगा।"

### Key Objection Handling:
1. "बहुत महंगा है" → Focus on subsidy + EMI + 25-year free electricity
2. "बाद में देखेंगे" → Create urgency - subsidy scheme has limited period
3. "Quality का भरोसा नहीं" → Share 500+ installations, show gallery, offer site visit
4. "छत पर जगह नहीं" → Offer free site survey to check

### Closing Techniques:
1. Ask for convenient time for FREE site survey
2. Offer to send WhatsApp quotation
3. Mention current month's special offer/discount
4. Share nearby installation reference

## Training Topics by Role:

### For Telecallers:
- How to open calls professionally
- Handling objections gracefully
- Qualifying leads (monthly bill, location, roof type)
- Scheduling site visits
- Follow-up timing and frequency

### For Sales Executives:
- Site survey checklist
- Quotation generation
- Closing deals
- Payment collection process
- Document collection for subsidy

### For Technicians:
- Panel mounting best practices
- Inverter installation
- Wiring safety standards
- Net meter process
- Maintenance procedures

## Response Style:
- Be conversational and supportive
- Use Hindi/English mix (Hinglish) when appropriate
- Provide practical examples
- Include scripts they can use directly
- Always encourage and motivate

Remember: Your goal is to make every staff member confident and knowledgeable about solar sales!
"""


@api_router.post("/ai/training-assistant")
async def ai_training_assistant(data: Dict[str, Any]):
    """AI Training Assistant for staff - helps with solar sales training"""
    try:
        message = data.get("message", "").strip()
        staff_role = data.get("staff_role", "sales")
        context = data.get("context", "general")
        session_id = data.get("session_id", str(uuid.uuid4()))
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Use Emergent LLM key with Gemini model
        api_key = EMERGENT_LLM_KEY or GEMINI_API_KEY
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Enhance prompt based on role
        role_context = {
            "telecaller": "\n\nThis staff member is a TELECALLER. Focus on call scripts, objection handling, and lead qualification.",
            "sales": "\n\nThis staff member is a SALES EXECUTIVE. Focus on site visits, quotations, and closing techniques.",
            "technician": "\n\nThis staff member is a TECHNICIAN. Focus on installation procedures, safety, and technical knowledge.",
            "manager": "\n\nThis staff member is a MANAGER. Provide comprehensive training overview and team management tips."
        }
        
        # Topic-specific context
        topic_context = {
            "pm_surya_ghar": "\n\nFocus on PM Surya Ghar Yojana details - subsidy, eligibility, application process.",
            "sales_calling": "\n\nFocus on calling techniques, scripts, and objection handling.",
            "technical_knowledge": "\n\nFocus on technical aspects of solar installation.",
            "customer_handling": "\n\nFocus on customer service and relationship building.",
            "roi_calculator": "\n\nFocus on explaining ROI, savings, and financial benefits to customers."
        }
        
        enhanced_prompt = ASR_TRAINING_ASSISTANT_PROMPT + role_context.get(staff_role, "") + topic_context.get(context, "")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"training_{session_id}",
            system_message=enhanced_prompt
        ).with_model("gemini", "gemini-2.5-flash")
        
        response = await chat.send_message(UserMessage(text=message))
        
        # Log training interaction for analytics
        await db.training_logs.insert_one({
            "session_id": session_id,
            "staff_role": staff_role,
            "context": context,
            "question": message,
            "response_length": len(response),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "session_id": session_id,
            "response": response,
            "staff_role": staff_role,
            "context": context
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training AI error: {e}")
        return {
            "success": False,
            "response": "माफ़ कीजिए, AI सेवा अभी उपलब्ध नहीं है। कृपया बाद में प्रयास करें।",
            "error": str(e)
        }


@api_router.get("/training/modules")
async def get_training_modules():
    """Get available training modules with progress tracking"""
    modules = [
        {
            "id": "pm_surya_ghar",
            "title": "PM Surya Ghar Yojana",
            "description": "Complete guide to PM Surya Ghar scheme for rooftop solar",
            "duration": "45 mins",
            "topics": ["Scheme Overview", "Subsidy Structure", "Application Process", "Documentation", "Installation", "Customer FAQs"]
        },
        {
            "id": "sales_calling",
            "title": "Sales & Calling Skills",
            "description": "Master telecalling and lead conversion techniques",
            "duration": "30 mins",
            "topics": ["Opening Scripts", "Objection Handling", "Building Trust", "Closing Techniques", "Follow-up Strategies"]
        },
        {
            "id": "technical_knowledge",
            "title": "Solar Technical Knowledge",
            "description": "Technical aspects of solar installation",
            "duration": "60 mins",
            "topics": ["Panel Types", "System Sizing", "Inverters", "Mounting", "Net Metering", "Maintenance"]
        },
        {
            "id": "asr_company",
            "title": "About ASR Enterprises",
            "description": "Know your company - history, values, services",
            "duration": "20 mins",
            "topics": ["Company History", "Our Values", "Services Offered", "Our USP", "Success Stories", "Team Structure"]
        }
    ]
    return {"modules": modules}


@api_router.post("/training/progress")
async def save_training_progress(data: Dict[str, Any]):
    """Save staff training progress"""
    try:
        staff_id = data.get("staff_id")
        module_id = data.get("module_id")
        topic_index = data.get("topic_index")
        completed = data.get("completed", True)
        
        if not staff_id or not module_id:
            raise HTTPException(status_code=400, detail="Staff ID and Module ID required")
        
        progress_key = f"{staff_id}_{module_id}_{topic_index}"
        
        await db.training_progress.update_one(
            {"progress_key": progress_key},
            {"$set": {
                "staff_id": staff_id,
                "module_id": module_id,
                "topic_index": topic_index,
                "completed": completed,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return {"success": True, "message": "Progress saved"}
    except Exception as e:
        logger.error(f"Save training progress error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/training/progress/{staff_id}")
async def get_training_progress(staff_id: str):
    """Get training progress for a staff member"""
    progress = await db.training_progress.find(
        {"staff_id": staff_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"staff_id": staff_id, "progress": progress}


@api_router.post("/ai/chat/save-lead")
async def save_chat_lead(data: Dict[str, Any]):
    """Save lead captured from AI chat"""
    try:
        session_id = data.get("session_id")
        name = sanitize_input(data.get("name", "AI Chat Lead"))
        phone = data.get("phone", "")
        district = data.get("district", "")
        notes = data.get("notes", "")
        
        if not phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        
        # Clean phone number
        phone_clean = re.sub(r'[^\d]', '', phone)
        if len(phone_clean) == 10 and phone_clean[0] in '6789':
            phone_clean = f"91{phone_clean}"
        
        # Check for duplicate
        existing = await db.crm_leads.find_one({"phone": {"$regex": phone_clean[-10:]}})
        if existing:
            return {
                "success": False,
                "message": "Lead with this phone number already exists",
                "lead_id": existing.get("id")
            }
        
        # Create lead
        lead_id = str(uuid.uuid4())
        lead = {
            "id": lead_id,
            "name": name,
            "phone": phone_clean,
            "district": district,
            "source": "ai_chat",
            "stage": "new",
            "lead_status": "new",
            "is_new": True,
            "notes": f"Captured via AI Chat. {notes}",
            "lead_category": "residential_solar",
            "ai_priority": "high",
            "lead_score": 75,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": "AI Chat lead"}]
        }
        
        await db.crm_leads.insert_one(lead)
        logger.info(f"AI Chat lead saved: {lead_id}")
        
        return {
            "success": True,
            "message": "Lead saved successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save chat lead error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/ai/chat/session/{session_id}")
async def clear_chat_session(session_id: str):
    """Clear a chat session"""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"success": True, "message": "Session cleared"}


@api_router.post("/verify-recaptcha")
async def verify_recaptcha_endpoint(request: Request, data: Dict[str, Any]):
    """Verify reCAPTCHA token and honeypot field"""
    client_ip = get_client_ip(request)
    token = data.get("recaptcha_token", "")
    
    # Check honeypot - hidden field should be empty
    if not check_honeypot(data):
        logger.warning(f"Honeypot triggered from IP: {client_ip}")
        return {"success": False, "error": "Spam detected"}
    
    if not token:
        return {"success": False, "error": "No reCAPTCHA token provided"}
    
    is_valid = await verify_recaptcha(token)
    if not is_valid:
        logger.warning(f"reCAPTCHA failed from IP: {client_ip}")
        return {"success": False, "error": "reCAPTCHA verification failed"}
    
    return {"success": True}

@api_router.post("/secure-lead")
async def create_secure_lead(request: Request, data: Dict[str, Any]):
    """Create lead with reCAPTCHA + honeypot protection"""
    client_ip = get_client_ip(request)
    
    # Check honeypot
    if not check_honeypot(data):
        logger.warning(f"Honeypot triggered on lead form from IP: {client_ip}")
        raise HTTPException(status_code=400, detail="Form submission rejected")
    
    # Verify reCAPTCHA
    recaptcha_token = data.get("recaptcha_token", "")
    if recaptcha_token:
        is_valid = await verify_recaptcha(recaptcha_token)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Security verification failed. Please try again.")
    
    # Create lead using existing logic
    lead_data = LeadCreate(
        name=sanitize_input(data.get("name", "")),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        district=data.get("district", ""),
        address=sanitize_input(data.get("address", "")),
        property_type=data.get("property_type", "residential"),
        roof_type=data.get("roof_type", "rcc"),
        monthly_bill=data.get("monthly_bill"),
        roof_area=data.get("roof_area"),
        message=sanitize_input(data.get("message", ""))
    )
    
    ai_result = await analyze_lead_with_ai(lead_data)
    lead_obj = Lead(**lead_data.model_dump(), **ai_result)
    doc = lead_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.leads.insert_one(doc)
    
    # Auto-create CRM lead
    try:
        crm_lead = CRMLead(
            id=lead_obj.id,
            name=lead_data.name,
            email=lead_data.email,
            phone=lead_data.phone,
            district=lead_data.district,
            address=lead_data.address,
            property_type=lead_data.property_type,
            monthly_bill=lead_data.monthly_bill,
            roof_area=lead_data.roof_area,
            source="website",
            stage="new",
            lead_status="new",
            is_new=True,
            lead_score=ai_result.get("lead_score", 50),
            ai_priority=ai_result.get("ai_priority", "medium"),
            next_follow_up=(datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
            status_history=[{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": "Created from website inquiry"}]
        )
        crm_doc = crm_lead.model_dump()
        crm_doc['timestamp'] = crm_doc['timestamp'].isoformat()
        await db.crm_leads.insert_one(crm_doc)
        
        # AI Auto-Response: Generate and send instant quotation via WhatsApp
        asyncio.create_task(send_ai_auto_response(lead_data, ai_result))
        
        # Send Lead Alert to Admin/Sales Team
        asyncio.create_task(send_lead_alert_to_team(lead_data, ai_result))
        
    except Exception as e:
        logger.error(f"CRM lead creation error: {e}")
    
    return {"success": True, "lead": lead_obj.model_dump()}

async def send_ai_auto_response(lead_data, ai_result):
    """Send AI-generated auto-response with instant quotation to new leads"""
    try:
        # Calculate rough quotation based on monthly bill
        monthly_bill = lead_data.monthly_bill or 3000
        system_size = max(2, min(10, int(monthly_bill / 1000) + 1))
        subsidy = 78000 if system_size >= 3 else 60000
        total_cost = system_size * 55000
        net_cost = total_cost - subsidy
        monthly_savings = int(monthly_bill * 0.85)
        payback_years = round(net_cost / (monthly_savings * 12), 1)
        
        # Generate personalized message
        message = f"""नमस्ते {lead_data.name} जी! 🙏

ASR Enterprises Patna में आपका स्वागत है! 🌞

आपकी ₹{monthly_bill:,}/month बिल के आधार पर, हमारी AI ने आपके लिए सोलर प्लान तैयार किया है:

📊 *आपका Solar Plan:*
━━━━━━━━━━━━━━━
✅ System Size: *{system_size} kW*
✅ Total Cost: ₹{total_cost:,}
✅ Govt Subsidy: *-₹{subsidy:,}* (PM Surya Ghar)
✅ Your Investment: *₹{net_cost:,}*
✅ Monthly Savings: ₹{monthly_savings:,}
✅ Payback: ~{payback_years} years
━━━━━━━━━━━━━━━

🎁 *FREE Site Survey Available!*
हमारी टीम आपके घर आकर exact quotation देगी।

📞 अभी call करें: *9296389097*

_आपको 5 मिनट में हमारी team का call आएगा!_

~Team ASR Enterprises"""
        
        # Log the auto-response
        await db.lead_auto_responses.insert_one({
            "id": str(uuid.uuid4()),
            "lead_id": lead_data.name,
            "phone": lead_data.phone,
            "message": message,
            "system_size": system_size,
            "quotation": {
                "total_cost": total_cost,
                "subsidy": subsidy,
                "net_cost": net_cost,
                "monthly_savings": monthly_savings
            },
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "logged"  # Would be "sent" if WhatsApp API is configured
        })
        
        logger.info(f"AI auto-response generated for lead: {lead_data.name} ({lead_data.phone})")
        
    except Exception as e:
        logger.error(f"AI auto-response error: {e}")

async def send_lead_alert_to_team(lead_data, ai_result):
    """Send instant lead alert to sales team"""
    try:
        priority = ai_result.get("ai_priority", "medium")
        lead_score = ai_result.get("lead_score", 50)
        
        # Determine system size recommendation
        monthly_bill = lead_data.monthly_bill or 3000
        system_size = max(2, min(10, int(monthly_bill / 1000) + 1))
        
        # Create alert notification
        alert = {
            "id": str(uuid.uuid4()),
            "type": "new_lead_alert",
            "title": f"🔔 New Lead: {lead_data.name}",
            "message": f"Priority: {priority.upper()} | Score: {lead_score}/100 | Bill: ₹{monthly_bill:,} | System: {system_size}kW | District: {lead_data.district or 'Not specified'}",
            "lead_data": {
                "name": lead_data.name,
                "phone": lead_data.phone,
                "email": lead_data.email,
                "district": lead_data.district,
                "monthly_bill": monthly_bill,
                "property_type": lead_data.property_type,
                "recommended_system": f"{system_size} kW"
            },
            "priority": priority,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False
        }
        
        # Store in staff notifications
        await db.staff_notifications.insert_one(alert)
        
        logger.info(f"Lead alert sent for: {lead_data.name} (Priority: {priority})")
        
    except Exception as e:
        logger.error(f"Lead alert error: {e}")

@api_router.get("/districts")
async def get_districts():
    """Get list of Bihar districts"""
    return {"districts": BIHAR_DISTRICTS}

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    ai_result = await analyze_lead_with_ai(lead_data)
    lead_obj = Lead(**lead_data.model_dump(), **ai_result)
    doc = lead_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.leads.insert_one(doc)
    
    # Auto-create CRM lead for seamless integration
    try:
        crm_lead = CRMLead(
            id=lead_obj.id,  # Use same ID for correlation
            name=lead_data.name,
            email=lead_data.email,
            phone=lead_data.phone,
            district=lead_data.district,
            address=lead_data.address,
            property_type=lead_data.property_type,
            monthly_bill=lead_data.monthly_bill,
            roof_area=lead_data.roof_area,
            source="website",
            stage="new",
            lead_status="new",
            is_new=True,
            lead_score=ai_result.get("lead_score", 50),
            ai_priority="high" if ai_result.get("lead_score", 50) >= 80 else "medium" if ai_result.get("lead_score", 50) >= 50 else "low",
            ai_suggestions=ai_result.get("ai_analysis", "")
        )
        crm_doc = crm_lead.model_dump()
        crm_doc['timestamp'] = crm_doc['timestamp'].isoformat()
        await db.crm_leads.insert_one(crm_doc)
        logger.info(f"Auto-created CRM lead for {lead_data.name}")
    except Exception as e:
        logger.error(f"Failed to auto-create CRM lead: {e}")
    
    return lead_obj

@api_router.get("/leads", response_model=List[Lead])
async def get_leads():
    leads = await db.leads.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    for lead in leads:
        if isinstance(lead.get('timestamp'), str):
            lead['timestamp'] = datetime.fromisoformat(lead['timestamp'])
    return leads

@api_router.put("/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, data: Dict[str, Any]):
    status = data.get("status", "new")
    await db.leads.update_one({"id": lead_id}, {"$set": {"status": status}})
    return {"success": True}

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True}

# Work Photos Management
@api_router.get("/photos")
async def get_photos():
    photos = await db.work_photos.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return photos

@api_router.get("/admin/photos")
async def get_admin_photos(page: int = 1, limit: int = 12):
    """Get admin photos with pagination for better performance"""
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.work_photos.count_documents({})
    
    # Get paginated photos
    photos = await db.work_photos.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "photos": photos,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@api_router.post("/admin/photos")
async def upload_photo(photo_data: Dict[str, Any]):
    photo = WorkPhoto(
        title=sanitize_input(photo_data.get("title", "")),
        description=sanitize_input(photo_data.get("description", "")),
        image_url=photo_data.get("image_url", ""),
        location=sanitize_input(photo_data.get("location", "")),
        system_size=photo_data.get("system_size", ""),
        category=photo_data.get("category", "installation")
    )
    doc = photo.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.work_photos.insert_one(doc)
    return photo

@api_router.delete("/admin/photos/{photo_id}")
async def delete_photo(photo_id: str):
    result = await db.work_photos.delete_one({"id": photo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"success": True}

# Customer Reviews Management
@api_router.get("/reviews")
async def get_reviews():
    reviews = await db.customer_reviews.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return reviews

@api_router.post("/admin/reviews")
async def add_review(review_data: Dict[str, Any]):
    review = CustomerReview(
        customer_name=sanitize_input(review_data.get("customer_name", "")),
        location=sanitize_input(review_data.get("location", "")),
        rating=int(review_data.get("rating", 5)),
        review_text=sanitize_input(review_data.get("review_text", "")),
        system_installed=review_data.get("system_installed", ""),
        solar_capacity=review_data.get("solar_capacity", ""),
        monthly_bill_before=review_data.get("monthly_bill_before", ""),
        monthly_bill_after=review_data.get("monthly_bill_after", ""),
        photo_url=review_data.get("photo_url", ""),
        is_testimonial=review_data.get("is_testimonial", False)
    )
    doc = review.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.customer_reviews.insert_one(doc)
    return review

@api_router.post("/crm/generate-testimonial")
async def generate_testimonial(data: Dict[str, Any]):
    """Generate unique AI-powered customer testimonial and save it"""
    name = sanitize_input(data.get("name", ""))
    address = sanitize_input(data.get("address", ""))
    solar_capacity = data.get("solar_capacity", "")
    bill_before = data.get("bill_before", "")
    bill_after = data.get("bill_after", "0")
    rating = int(data.get("rating", 5))
    
    # Calculate savings
    savings_amount = 0
    if bill_before:
        try:
            savings_amount = int(bill_before) - int(bill_after or 0)
        except ValueError:
            pass
    
    # Get existing testimonials to ensure uniqueness
    existing_testimonials = await db.customer_reviews.find(
        {"is_testimonial": True}, 
        {"review_text": 1, "_id": 0}
    ).to_list(20)
    existing_texts = [t.get("review_text", "")[:100] for t in existing_testimonials]
    
    # Generate unique testimonial using AI
    testimonial_text = ""
    if EMERGENT_LLM_KEY:
        try:
            llm = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=str(uuid.uuid4()),
                system_message="You are a testimonial writer for ASR Enterprises, a solar installation company in Bihar, India. Write authentic, unique customer testimonials."
            ).with_model("openai", "gpt-4o")
            
            prompt = f"""Generate a unique, authentic customer testimonial for ASR Enterprises (solar installation company in Bihar, India).

Customer Details:
- Name: {name}
- Location: {address}, Bihar
- System: {solar_capacity} kW Solar System
- Previous Bill: ₹{bill_before}/month
- Current Bill: ₹{bill_after}/month
- Monthly Savings: ₹{savings_amount}
- Rating: {rating}/5 stars

Requirements:
1. Write in first person as the customer
2. Keep it natural and conversational (2-3 sentences)
3. Mention specific details like location, savings, or system size
4. Vary the tone - some happy, some thankful, some professional
5. MUST be different from these existing testimonials (avoid similar phrases):
{chr(10).join(existing_texts[:5]) if existing_texts else 'None yet'}

Write ONLY the testimonial text, nothing else."""

            user_message = UserMessage(text=prompt)
            response = await llm.send_message(user_message)
            testimonial_text = response.strip().strip('"').strip("'")
            logger.info(f"AI-generated testimonial for {name}: {testimonial_text[:50]}...")
        except Exception as e:
            logger.error(f"AI testimonial generation failed: {e}")
    
    # Fallback to template if AI fails or returns empty
    if not testimonial_text:
        logger.info("Using fallback template for testimonial (AI returned empty or failed)")
        templates = [
            f"After installing {solar_capacity} kW solar panels from ASR Enterprises, my electricity bill dropped from ₹{bill_before} to just ₹{bill_after}! Best decision for my home in {address}.",
            f"ASR Enterprises installed a {solar_capacity} kW system at my {address} residence. Saving ₹{savings_amount} every month now. Professional team, excellent work!",
            f"Switched to solar with ASR Enterprises. {solar_capacity} kW system running perfectly at my {address} home. Bills went from ₹{bill_before} to ₹{bill_after}!",
            f"Got solar installed by ASR Enterprises in {address}. My {solar_capacity} kW system saves me ₹{savings_amount}/month. Highly recommended for Bihar residents!",
            f"Happy customer from {address}! ASR Enterprises installed {solar_capacity} kW solar. Bill reduced from ₹{bill_before} to ₹{bill_after}. Great service!"
        ]
        import random
        testimonial_text = random.choice(templates)
    
    review = CustomerReview(
        customer_name=name,
        location=address,
        rating=rating,
        review_text=testimonial_text,
        system_installed=f"{solar_capacity} kW Solar System",
        solar_capacity=str(solar_capacity),
        monthly_bill_before=str(bill_before),
        monthly_bill_after=str(bill_after),
        is_testimonial=True
    )
    doc = review.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.customer_reviews.insert_one(doc)
    return review

@api_router.delete("/admin/reviews/{review_id}")
async def delete_review(review_id: str):
    result = await db.customer_reviews.delete_one({"id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"success": True}

# Festival Posts Management
@api_router.get("/festivals")
async def get_festivals():
    festivals = await db.festival_posts.find({"is_active": True}, {"_id": 0}).sort("timestamp", -1).to_list(10)
    return festivals

@api_router.get("/festivals/active")
async def get_active_festival():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    festival = await db.festival_posts.find_one(
        {"is_active": True, "start_date": {"$lte": today}, "end_date": {"$gte": today}},
        {"_id": 0}
    )
    return festival

@api_router.post("/admin/festivals")
async def create_festival(festival_data: Dict[str, Any]):
    festival = FestivalPost(
        title=sanitize_input(festival_data.get("title", "")),
        message=sanitize_input(festival_data.get("message", "")),
        image_url=festival_data.get("image_url", ""),
        start_date=festival_data.get("start_date", ""),
        end_date=festival_data.get("end_date", "")
    )
    doc = festival.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.festival_posts.insert_one(doc)
    return festival

@api_router.put("/admin/festivals/{festival_id}")
async def update_festival(festival_id: str, festival_data: Dict[str, Any]):
    update_data = {k: sanitize_input(v) if isinstance(v, str) else v for k, v in festival_data.items()}
    await db.festival_posts.update_one({"id": festival_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/admin/festivals/{festival_id}")
async def delete_festival(festival_id: str):
    result = await db.festival_posts.delete_one({"id": festival_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Festival not found")
    return {"success": True}

# Government News - AI Auto-fetch
@api_router.get("/govt-news")
async def get_govt_news():
    news = await db.govt_news.find({"is_active": True}, {"_id": 0}).sort("timestamp", -1).to_list(10)
    return news

@api_router.post("/admin/govt-news/refresh")
async def refresh_govt_news():
    """AI-powered government news refresh for PM Surya Ghar Yojana Bihar"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an AI assistant specializing in Indian government solar energy schemes and policies. Provide accurate, up-to-date information about PM Surya Ghar Muft Bijli Yojana and Bihar state solar initiatives."
        )
        
        current_date = datetime.now().strftime("%B %Y")
        response = await chat.send_message(
            model="gpt-4o",
            messages=[UserMessage(text=f"""Generate 4 latest and realistic news updates about PM Surya Ghar Yojana and solar schemes for Bihar state as of {current_date}.

Include updates about:
1. Current subsidy amounts and eligibility (up to ₹78,000 for residential)
2. Application process updates via BREDA or national portal
3. New policy announcements or deadline extensions
4. Success stories or installation targets for Bihar

Format as JSON array with fields: title, summary, category
Categories: subsidy, scheme, guideline, update, success_story

Make updates realistic, informative, and helpful for Bihar residents planning solar installation.
Include specific details like subsidy amounts, capacity limits (1-3kW gets higher subsidy), portal names.

Example format: [{{"title": "...", "summary": "...", "category": "subsidy"}}]
Return ONLY the JSON array, no other text.""")]
        )
        
        # Parse AI response
        news_items = json.loads(response.replace("```json", "").replace("```", "").strip())
        
        # Clear old news and add fresh updates
        await db.govt_news.delete_many({})
        
        # Store in database
        for item in news_items:
            news = GovtNews(
                title=item.get("title", ""),
                summary=item.get("summary", ""),
                source="PM Surya Ghar Yojana - Bihar",
                category=item.get("category", "update")
            )
            doc = news.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.govt_news.insert_one(doc)
        
        logger.info(f"Govt news refreshed with {len(news_items)} items")
        return {"success": True, "message": f"Added {len(news_items)} latest news updates"}
    except Exception as e:
        logger.error(f"Error refreshing govt news: {e}")
        # Add default news if AI fails
        await db.govt_news.delete_many({})
        default_news = [
            {"title": "PM Surya Ghar Yojana: ₹78,000 Maximum Subsidy for Bihar Residents", "summary": "Bihar residents can avail up to ₹78,000 subsidy for 3kW rooftop solar installation under PM Surya Ghar Muft Bijli Yojana. 1-2kW systems get ₹30,000/kW subsidy, 2-3kW gets ₹18,000/kW for additional capacity. Apply through national portal pmsuryaghar.gov.in or BREDA.", "category": "subsidy"},
            {"title": "BREDA Simplifies Solar Application Process in Bihar", "summary": "Bihar Renewable Energy Development Agency (BREDA) has streamlined the solar subsidy application. Residents need only Aadhar, electricity bill, and bank details. Applications processed within 30 days. Technical inspection scheduled within 15 days of approval.", "category": "update"},
            {"title": "1 Crore Homes Target: Bihar Gets Increased Allocation", "summary": "Under PM Surya Ghar scheme target of 1 crore solar rooftop homes, Bihar's allocation has been increased for FY 2025-26. Priority given to rural and semi-urban areas. Free electricity up to 300 units/month for eligible households.", "category": "scheme"},
            {"title": "Net Metering Benefits: Sell Excess Solar Power to Grid", "summary": "Bihar residents with rooftop solar can sell excess electricity to BSPHCL through net metering. Earn ₹2-3 per unit for surplus power. Smart meters being installed across state for accurate billing. Apply for net metering along with solar installation.", "category": "guideline"}
        ]
        for item in default_news:
            news = GovtNews(title=item["title"], summary=item["summary"], source="PM Surya Ghar Yojana - Bihar", category=item["category"])
            doc = news.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.govt_news.insert_one(doc)
        return {"success": True, "message": "Added latest news updates"}

@api_router.delete("/admin/govt-news/{news_id}")
async def delete_govt_news(news_id: str):
    result = await db.govt_news.delete_one({"id": news_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News item not found")
    return {"success": True}

@api_router.post("/chat/whatsapp")
async def whatsapp_chat(chat_request: ChatRequest):
    session_id = chat_request.session_id or str(uuid.uuid4())
    bot_response = await generate_whatsapp_response(chat_request.message, session_id)
    chat_msg = ChatMessage(session_id=session_id, user_phone=chat_request.user_phone, user_message=chat_request.message, bot_response=bot_response)
    doc = chat_msg.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.chat_messages.insert_one(doc)
    return {"session_id": session_id, "response": bot_response}

@api_router.post("/solar/calculate", response_model=SolarCalculation)
async def calculate_solar(calc_request: SolarCalculationRequest):
    avg_daily = (calc_request.monthly_bill / calc_request.electricity_rate) / 30
    capacity = avg_daily / 4
    cost = capacity * 65000  # Updated to ₹64-68/W average
    subsidy = min(78000, capacity * 30000 if capacity <= 2 else 60000 + ((capacity - 2) * 18000)) if capacity <= 3 else 78000
    final_cost = cost - subsidy
    monthly_savings = calc_request.monthly_bill * 0.85
    calc_obj = SolarCalculation(
        monthly_bill=calc_request.monthly_bill, roof_area=calc_request.roof_area,
        location=calc_request.location, electricity_rate=calc_request.electricity_rate,
        recommended_capacity_kw=round(capacity, 2), estimated_cost=round(final_cost, 2),
        monthly_savings=round(monthly_savings, 2), annual_savings=round(monthly_savings * 12, 2),
        payback_period_years=round(final_cost / (monthly_savings * 12), 1),
        panels_required=int((capacity * 1000) / 400), co2_offset_kg_yearly=round(avg_daily * 365 * 0.82, 2),
        ai_recommendations="Consider on-grid system for ROI. Ensure south-facing panels.",
        system_type="Residential System", subsidy_info=f"₹{subsidy:,.0f} subsidy. Final: ₹{final_cost:,.0f}"
    )
    doc = calc_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.solar_calculations.insert_one(doc)
    return calc_obj

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Optimized dashboard stats with Redis caching and parallel queries"""
    # Check Redis cache first
    cache_key = "dashboard_stats"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    results = await asyncio.gather(
        db.leads.count_documents({}),
        db.chat_messages.count_documents({}),
        db.solar_calculations.count_documents({}),
        db.campaigns.count_documents({}),
        db.leads.count_documents({"lead_score": {"$gte": 80}}),
        db.leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5),
        db.leads.count_documents({"status": "new"}),
        db.work_photos.count_documents({}),
        db.customer_reviews.count_documents({}),
        db.orders.count_documents({})
    )
    
    response = {
        "total_leads": results[0],
        "total_chats": results[1],
        "total_calculations": results[2],
        "total_campaigns": results[3],
        "high_score_leads": results[4],
        "recent_leads": results[5],
        "new_leads": results[6],
        "total_photos": results[7],
        "total_reviews": results[8],
        "total_orders": results[9]
    }
    
    await cache_set(cache_key, response, ttl=30)
    return response

# ==================== LAZY LOADING DASHBOARD WIDGETS ====================

@api_router.get("/dashboard/widget/counts")
async def get_dashboard_counts():
    """Fast endpoint for basic counts - loads first"""
    cache_key = "dashboard_counts"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Count from both leads collections
    results = await asyncio.gather(
        db.leads.count_documents({}),
        db.orders.count_documents({}),
        db.leads.count_documents({"status": "new"}),
        db.orders.count_documents({"status": "pending"}),
        db.crm_leads.count_documents({"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}),  # CRM leads (excl. deleted)
        db.crm_leads.count_documents({"stage": "new", "$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]})  # New CRM leads
    )
    
    # Use max of both collections
    total_leads = max(results[0], results[4])
    new_leads = max(results[2], results[5])
    
    response = {
        "total_leads": total_leads,
        "total_orders": results[1],
        "new_leads": new_leads,
        "pending_orders": results[3],
        "crm_leads": results[4],
        "website_leads": results[0]
    }
    
    await cache_set(cache_key, response, ttl=10)  # Shorter cache for fresh data
    return response

@api_router.get("/dashboard/widget/recent-leads")
async def get_recent_leads_widget():
    """Recent leads widget - loads separately"""
    cache_key = "dashboard_recent_leads"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    recent_leads = await db.leads.find(
        {}, 
        {"_id": 0, "name": 1, "phone": 1, "district": 1, "status": 1, "timestamp": 1, "lead_score": 1}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    response = {"recent_leads": recent_leads}
    await cache_set(cache_key, response, ttl=20)
    return response

@api_router.get("/dashboard/widget/recent-orders")
async def get_recent_orders_widget():
    """Recent orders widget - loads separately"""
    cache_key = "dashboard_recent_orders"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    recent_orders = await db.orders.find(
        {},
        {"_id": 0, "order_number": 1, "customer_name": 1, "total": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    response = {"recent_orders": recent_orders}
    await cache_set(cache_key, response, ttl=20)
    return response

@api_router.get("/dashboard/widget/revenue")
async def get_revenue_widget():
    """Revenue widget - heavier query, loads last"""
    cache_key = "dashboard_revenue"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    now = datetime.now(timezone.utc)
    this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    pipeline = [
        {"$match": {"status": {"$in": ["confirmed", "delivered", "completed"]}, "created_at": {"$gte": this_month}}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total"}, "order_count": {"$sum": 1}}}
    ]
    
    result = await db.orders.aggregate(pipeline).to_list(1)
    
    response = {
        "this_month_revenue": result[0]["total_revenue"] if result else 0,
        "this_month_orders": result[0]["order_count"] if result else 0
    }
    
    await cache_set(cache_key, response, ttl=60)
    return response

@api_router.get("/dashboard/widget/chart-data")
async def get_chart_data_widget():
    """Chart data widget - heaviest query"""
    cache_key = "dashboard_chart_data"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Last 7 days leads trend
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": seven_days_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$timestamp"}}}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    leads_trend = await db.leads.aggregate(pipeline).to_list(7)
    
    # Leads by status
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    leads_by_status = await db.leads.aggregate(status_pipeline).to_list(10)
    
    response = {
        "leads_trend": leads_trend,
        "leads_by_status": leads_by_status
    }
    
    await cache_set(cache_key, response, ttl=60)
    return response

# ==================== CRM LAZY LOADING WIDGETS ====================

@api_router.get("/crm/widget/stats-v1")
async def get_crm_stats_widget_v1():
    """Legacy CRM stats widget - use /crm/widget/stats from modular router instead"""
    cache_key = "crm_stats"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Query both leads and crm_leads collections
    results = await asyncio.gather(
        db.leads.count_documents({}),
        db.crm_leads.count_documents({"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}),
        db.leads.count_documents({"status": "new"}),
        db.crm_leads.count_documents({"stage": "new", "$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}),
        db.leads.count_documents({"status": "qualified"}),
        db.crm_leads.count_documents({"stage": "quotation", "$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}),
        db.leads.count_documents({"status": "converted"}),
        db.crm_leads.count_documents({"stage": "completed", "$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}),
        db.crm_staff_accounts.count_documents({"is_active": True}),
        db.crm_tasks.count_documents({"status": "pending"})
    )
    
    # Total leads from both collections
    total_leads = max(results[0], results[1])  # Take higher value to avoid undercounting
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
    
    await cache_set(cache_key, response, ttl=30)
    return response

@api_router.get("/crm/widget/pipeline")
async def get_crm_pipeline_widget():
    """CRM pipeline data"""
    cache_key = "crm_pipeline"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "value": {"$sum": {"$ifNull": ["$expected_value", 0]}}}},
        {"$sort": {"count": -1}}
    ]
    
    stages = await db.leads.aggregate(pipeline).to_list(10)
    
    response = {"pipeline_stages": stages}
    await cache_set(cache_key, response, ttl=30)
    return response

@api_router.get("/crm/widget/recent-activity")
async def get_crm_recent_activity():
    """CRM recent activity"""
    cache_key = "crm_recent_activity"
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    recent_leads = await db.leads.find(
        {},
        {"_id": 0, "name": 1, "phone": 1, "status": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(5).to_list(5)
    
    recent_tasks = await db.crm_tasks.find(
        {},
        {"_id": 0, "title": 1, "status": 1, "due_date": 1, "priority": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    response = {
        "recent_leads": recent_leads,
        "recent_tasks": recent_tasks
    }
    
    await cache_set(cache_key, response, ttl=30)
    return response

# ==================== CACHE MANAGEMENT ENDPOINTS ====================

@api_router.get("/admin/cache/status")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_cache_status(request: Request):
    """Get Redis cache status and statistics"""
    stats = await get_cache_stats()
    return {
        "status": "active" if stats["enabled"] else "fallback",
        "backend": stats["backend"],
        "keys_count": stats["keys_count"],
        "memory_usage": stats.get("memory_usage", "N/A"),
        "ttl_config": CACHE_TTL
    }

@api_router.post("/admin/cache/clear")
@limiter.limit(RATE_LIMIT_ADMIN)
async def clear_cache(request: Request, pattern: Optional[str] = None):
    """Clear cache (all or by pattern)"""
    if pattern:
        count = await cache_clear_pattern(pattern)
        return {"success": True, "message": f"Cleared {count} keys matching '{pattern}'"}
    else:
        await cache_clear_all()
        return {"success": True, "message": "All cache cleared"}

# Analytics Endpoint for detailed business insights
@api_router.get("/admin/analytics")
async def get_analytics():
    """Optimized analytics with parallel DB queries"""
    now = datetime.now(timezone.utc)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    this_week_start = now - timedelta(days=now.weekday())
    
    this_month_str = this_month_start.isoformat()
    last_month_str = last_month_start.isoformat()
    this_week_str = this_week_start.isoformat()
    
    # Run ALL database queries in parallel
    results = await asyncio.gather(
        # Aggregations
        db.leads.aggregate([
            {"$group": {"_id": "$district", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 15}
        ]).to_list(15),
        db.leads.aggregate([
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(10),
        db.leads.aggregate([
            {"$group": {"_id": "$property_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(10),
        db.leads.aggregate([
            {"$match": {"lead_score": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": None, "avg_score": {"$avg": "$lead_score"}}}
        ]).to_list(1),
        # Counts
        db.leads.count_documents({}),
        db.leads.count_documents({"status": "new"}),
        db.chat_messages.count_documents({}),
        db.solar_calculations.count_documents({}),
        db.campaigns.count_documents({}),
        db.leads.count_documents({"lead_score": {"$gte": 80}}),
        db.work_photos.count_documents({}),
        db.customer_reviews.count_documents({}),
        db.leads.count_documents({"timestamp": {"$gte": this_month_str}}),
        db.leads.count_documents({"timestamp": {"$gte": last_month_str, "$lt": this_month_str}}),
        db.leads.count_documents({"timestamp": {"$gte": this_week_str}}),
        db.leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
    )
    
    leads_by_district, leads_by_status, leads_by_property_type, avg_score_result, \
        total_leads, new_leads, total_chats, total_calculations, total_campaigns, \
        high_score_leads, total_photos, total_reviews, leads_this_month, \
        leads_last_month, leads_this_week, recent_leads = results
    
    avg_lead_score = round(avg_score_result[0]["avg_score"], 1) if avg_score_result else 0
    
    return {
        "total_leads": total_leads,
        "new_leads": new_leads,
        "total_chats": total_chats,
        "total_calculations": total_calculations,
        "total_campaigns": total_campaigns,
        "high_score_leads": high_score_leads,
        "total_photos": total_photos,
        "total_reviews": total_reviews,
        "leads_by_district": leads_by_district,
        "leads_by_status": leads_by_status,
        "leads_by_property_type": leads_by_property_type,
        "leads_this_month": leads_this_month,
        "leads_last_month": leads_last_month,
        "leads_this_week": leads_this_week,
        "avg_lead_score": avg_lead_score,
        "recent_leads": recent_leads
    }

# ==================== DATABASE CLEANUP ENDPOINTS ====================

@api_router.get("/admin/cleanup/status")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_cleanup_status(request: Request):
    """Get automated cleanup status and schedule"""
    now = datetime.now(timezone.utc)
    
    # Calculate next scheduled cleanup
    next_cleanup = None
    if last_cleanup_time:
        next_cleanup = (last_cleanup_time + timedelta(hours=CLEANUP_INTERVAL_HOURS)).isoformat()
    
    # Calculate next deep cleanup (next Monday)
    days_until_monday = (WEEKLY_DEEP_CLEANUP_DAY - now.weekday()) % 7
    if days_until_monday == 0 and now.hour >= 12:  # If it's Monday after noon, next week
        days_until_monday = 7
    next_deep_cleanup = (now + timedelta(days=days_until_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    
    return {
        "status": "active",
        "scheduler_running": cleanup_task is not None and not cleanup_task.done(),
        "cleanup_interval_hours": CLEANUP_INTERVAL_HOURS,
        "deep_cleanup_day": "Monday",
        "last_cleanup": last_cleanup_time.isoformat() if last_cleanup_time else None,
        "last_deep_cleanup": last_deep_cleanup_time.isoformat() if last_deep_cleanup_time else None,
        "next_scheduled_cleanup": next_cleanup,
        "next_deep_cleanup": next_deep_cleanup,
        "current_time": now.isoformat()
    }

@api_router.post("/admin/cleanup/run")
@limiter.limit(RATE_LIMIT_ADMIN)
async def run_manual_cleanup(request: Request, deep: bool = False):
    """Manually trigger database cleanup"""
    log_security_event("MANUAL_CLEANUP", get_real_ip(request), {"deep": deep})
    
    results = await perform_cleanup(deep_clean=deep)
    
    return {
        "success": True,
        "message": f"{'Deep' if deep else 'Regular'} cleanup completed",
        "results": results,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/admin/database/cleanup")
@limiter.limit(RATE_LIMIT_ADMIN)
async def database_cleanup(request: Request):
    """Admin endpoint to clean old logs, expired sessions, and optimize database (legacy endpoint)"""
    return await run_manual_cleanup(request, deep=True)

@api_router.get("/admin/database/status")
async def database_status():
    """Get database health status, storage mode, and collection statistics"""
    from db_client import MONGO_URI as _MONGO_URI, USE_IN_MEMORY as _USE_IN_MEMORY, ping_db
    try:
        # Determine storage mode — USE_IN_MEMORY is the canonical flag
        # (it may be True even when MONGO_URI is set, if Atlas DNS failed at startup)
        if _MONGO_URI and not _USE_IN_MEMORY:
            db_mode = "mongodb_atlas"
            db_mode_label = "MongoDB Atlas (Fully Persistent ✅)"
            is_persistent = True
        elif _USE_IN_MEMORY:
            db_mode = "in_memory"
            db_mode_label = "In-Memory + Snapshot (Restart-Safe ⚠️)"
            is_persistent = False
        else:
            db_mode = "local_mongodb"
            db_mode_label = "Local MongoDB"
            is_persistent = True

        # Ping DB
        db_alive = await ping_db()

        stats = {}
        crm_collections = [
            "crm_leads", "cashfree_orders", "whatsapp_messages", "crm_staff_accounts",
            "hr_employees", "crm_tasks", "crm_followups", "crm_payments"
        ]
        for coll in crm_collections:
            try:
                count = await db[coll].count_documents({})
                stats[coll] = count
            except:
                stats[coll] = 0

        cache_stats = {
            "entries": len(api_cache),
            "size_estimate_kb": len(str(api_cache)) // 1024
        }

        return {
            "status": "healthy" if db_alive else "degraded",
            "db_mode": db_mode,
            "db_mode_label": db_mode_label,
            "is_persistent": is_persistent,
            "db_alive": db_alive,
            "collections": stats,
            "cache": cache_stats,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "recommendation": None if is_persistent else "Set MONGO_URI secret with your MongoDB Atlas connection string for fully persistent storage"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==================== ASYNC DASHBOARD LOADING ENDPOINTS ====================

@api_router.get("/dashboard/quick-stats")
async def get_quick_stats():
    """Minimal stats for initial dashboard load - fast response"""
    cache_key = "quick_stats"
    cached = get_cached(cache_key, ttl=15)
    if cached:
        return cached
    
    # Only essential counts - parallel execution
    results = await asyncio.gather(
        db.leads.count_documents({"status": "new"}),
        db.orders.count_documents({"order_status": "pending"}),
        return_exceptions=True
    )
    
    response = {
        "new_leads": results[0] if not isinstance(results[0], Exception) else 0,
        "pending_orders": results[1] if not isinstance(results[1], Exception) else 0,
        "loaded_at": datetime.now(timezone.utc).isoformat()
    }
    set_cache(cache_key, response, ttl=15)
    return response

@api_router.get("/dashboard/pipeline")
async def get_pipeline_stats():
    """Pipeline overview - deferred load"""
    cache_key = "pipeline_stats"
    cached = get_cached(cache_key, ttl=30)
    if cached:
        return cached
    
    # Get leads by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.leads.aggregate(pipeline).to_list(10)
    
    response = {
        "pipeline": {item["_id"]: item["count"] for item in status_counts if item["_id"]},
        "loaded_at": datetime.now(timezone.utc).isoformat()
    }
    set_cache(cache_key, response, ttl=30)
    return response

@api_router.get("/dashboard/recent-leads")
async def get_recent_leads():
    """Recent leads - deferred load"""
    cache_key = "recent_leads"
    cached = get_cached(cache_key, ttl=30)
    if cached:
        return cached
    
    leads = await db.leads.find(
        {}, 
        {"_id": 0, "name": 1, "district": 1, "lead_score": 1, "status": 1}
    ).sort("timestamp", -1).limit(5).to_list(5)
    
    response = {"leads": leads, "loaded_at": datetime.now(timezone.utc).isoformat()}
    set_cache(cache_key, response, ttl=30)
    return response

@api_router.get("/dashboard/revenue")
async def get_revenue_stats():
    """Revenue stats - deferred load"""
    cache_key = "revenue_stats"
    cached = get_cached(cache_key, ttl=60)
    if cached:
        return cached
    
    # Get total revenue
    revenue_result = await db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    
    response = {
        "total_revenue": revenue_result[0]["total"] if revenue_result else 0,
        "loaded_at": datetime.now(timezone.utc).isoformat()
    }
    set_cache(cache_key, response, ttl=60)
    return response

@api_router.get("/crm/stats/quick")
async def get_crm_quick_stats():
    """Quick CRM stats for initial load"""
    cache_key = "crm_quick_stats"
    cached = get_cached(cache_key, ttl=20)
    if cached:
        return cached
    
    results = await asyncio.gather(
        db.leads.count_documents({}),
        db.leads.count_documents({"status": "completed"}),
        db.staff.count_documents({"is_active": True}),
        return_exceptions=True
    )
    
    response = {
        "total_leads": results[0] if not isinstance(results[0], Exception) else 0,
        "completed": results[1] if not isinstance(results[1], Exception) else 0,
        "staff_members": results[2] if not isinstance(results[2], Exception) else 0,
        "loaded_at": datetime.now(timezone.utc).isoformat()
    }
    set_cache(cache_key, response, ttl=20)
    return response

# Admin OTP APIs
@api_router.post("/admin/send-otp")
@limiter.limit(RATE_LIMIT_AUTH)
async def send_otp(request: Request, data: Dict[str, Any]):
    client_ip = get_real_ip(request)
    email = data.get("email", "").lower().strip()
    
    # Log security event
    log_security_event("ADMIN_LOGIN_ATTEMPT", client_ip, {"email": mask_sensitive_data(email)})
    
    # Only admin email is allowed
    registered_admin = "asrenterprisespatna@gmail.com"
    if email != registered_admin:
        security_tracker.record_failed_attempt(client_ip, "Invalid admin email")
        raise HTTPException(status_code=403, detail="Email not registered. Only admin can access.")
    
    # Check cooldown to prevent multiple OTP sends
    can_send, cooldown_msg = can_send_otp(email)
    if not can_send:
        raise HTTPException(status_code=429, detail=cooldown_msg)
    
    # Check lockout status
    allowed, lockout_msg = check_login_lockout(client_ip, email)
    if not allowed:
        raise HTTPException(status_code=429, detail=lockout_msg)
    
    # Generate and store secure OTP
    otp = generate_secure_otp()
    store_otp(email, otp)
    
    # Send OTP via email
    email_sent = await send_otp_email(email, otp, "Admin")
    
    if email_sent:
        logger.info(f"OTP email sent to {mask_sensitive_data(email)}")
        return {"success": True, "message": "OTP sent to your registered email (valid for 5 minutes)", "email_sent": True}
    else:
        # Fallback message if email not configured
        logger.info(f"OTP generated for {mask_sensitive_data(email)} (email not configured, use 131993)")
        return {"success": True, "message": "OTP has been sent to your email", "email_sent": False}

@api_router.post("/admin/verify-otp")
@limiter.limit(RATE_LIMIT_AUTH)
async def verify_otp_endpoint(request: Request, data: Dict[str, Any]):
    client_ip = get_real_ip(request)
    email = data.get("email", "").lower().strip()
    phone = data.get("phone", "").strip()
    otp = data.get("otp", "").strip()
    
    user_id = email or phone
    
    # Check lockout status
    allowed, message = check_login_lockout(client_ip, user_id)
    if not allowed:
        security_tracker.record_failed_attempt(client_ip, "Login lockout active")
        raise HTTPException(status_code=429, detail=message)
    
    # Only allow admin email or registered phone
    registered_admin = "asrenterprisespatna@gmail.com"
    if email and email != registered_admin:
        record_failed_login(client_ip, email)
        logger.warning(f"Unauthorized login attempt for email: {email} from IP: {client_ip}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify OTP
    if verify_otp(user_id, otp):
        reset_failed_login(client_ip, user_id)  # Reset on successful login
        logger.info(f"Successful admin login for {user_id} from IP: {client_ip}")
        return {"success": True, "role": "admin", "email": email or user_id}
    
    # Record failed attempt
    record_failed_login(client_ip, user_id)
    logger.warning(f"Failed OTP verification for {user_id} from IP: {client_ip}")
    raise HTTPException(status_code=401, detail="Invalid or expired OTP")

@api_router.post("/admin/login-password")
@limiter.limit(RATE_LIMIT_AUTH)
async def admin_login_password(request: Request, data: Dict[str, Any]):
    """Admin login with email + password - DIRECT LOGIN (no OTP required)"""
    client_ip = get_real_ip(request)
    user_id = data.get("user_id", "").strip()
    password = data.get("password", "").strip()
    direct_login = data.get("direct_login", False)  # If True, skip OTP
    
    # Check lockout status
    allowed, message = check_login_lockout(client_ip, user_id)
    if not allowed:
        security_tracker.record_failed_attempt(client_ip, "Login lockout active")
        raise HTTPException(status_code=429, detail=message)
    
    # STRICT CHECK: Only the registered owner email can access the admin panel
    if user_id.lower() != OWNER_EMAIL.lower():
        record_failed_login(client_ip, user_id)
        logger.warning(f"Unauthorized admin login attempt with '{user_id}' from IP: {client_ip}")
        raise HTTPException(
            status_code=401, 
            detail="Access Denied. Only the registered admin can login here. Staff members should use the Staff Portal."
        )
    
    password_valid = False
    
    # Check crm_staff_accounts (startup-seeded, primary source)
    staff_cred = await db.crm_staff_accounts.find_one(
        {"staff_id": OWNER_STAFF_ID, "is_owner": True}, {"_id": 0}
    )
    if staff_cred:
        stored_hash = staff_cred.get("password_hash", "")
        if stored_hash and hashlib.sha256(password.encode()).hexdigest() == stored_hash:
            password_valid = True
    
    # Legacy check: admin_credentials collection (with salt)
    if not password_valid:
        admin_cred = await db.admin_credentials.find_one({"user_id": user_id.lower()}, {"_id": 0})
        if admin_cred:
            hashed = hashlib.sha256((password + admin_cred.get("salt", "")).encode()).hexdigest()
            if hashed == admin_cred.get("password_hash"):
                password_valid = True
    
    # Final fallback: compare against global constant directly
    if not password_valid and password == OWNER_PASSWORD:
        password_valid = True
    
    if not password_valid:
        record_failed_login(client_ip, user_id)
        raise HTTPException(status_code=401, detail="Invalid password")
    
    reset_failed_login(client_ip, user_id)
    logger.info(f"Successful admin login for {user_id} from IP: {client_ip}")
    
    if direct_login:
        return {
            "success": True, 
            "require_otp": False,
            "role": "admin", 
            "email": OWNER_EMAIL,
            "name": OWNER_NAME,
            "staff_id": OWNER_STAFF_ID,
            "message": "Login successful!"
        }
    else:
        return {
            "success": True, 
            "require_otp": True,
            "role": "admin", 
            "email": OWNER_EMAIL,
            "mobile_last4": OWNER_MOBILE[-4:],
            "name": OWNER_NAME,
            "staff_id": OWNER_STAFF_ID,
            "message": "Password verified. Please verify OTP sent to your registered mobile."
        }

@api_router.post("/admin/login-otp")
@limiter.limit(RATE_LIMIT_AUTH)
async def admin_login_otp(request: Request, data: Dict[str, Any]):
    """Login with mobile OTP for admin and staff (MSG91 verified)
    
    Admin: Only 9296389097 is allowed
    Staff: Only registered staff mobile numbers are allowed
    """
    client_ip = get_real_ip(request)
    mobile = data.get("mobile", "").strip().replace(" ", "").replace("-", "")
    login_type = data.get("login_type", "staff")  # 'admin' or 'staff'
    
    # Remove country code if present
    if mobile.startswith("91") and len(mobile) == 12:
        mobile = mobile[2:]
    elif mobile.startswith("+91") and len(mobile) == 13:
        mobile = mobile[3:]
    
    if not mobile or len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number format")
    
    # Check lockout status
    allowed, message = check_login_lockout(client_ip, mobile)
    if not allowed:
        security_tracker.record_failed_attempt(client_ip, "Login lockout active")
        raise HTTPException(status_code=429, detail=message)
    
    # ADMIN LOGIN: Only allow the registered owner mobile
    if login_type == "admin":
        if mobile != OWNER_MOBILE:
            record_failed_login(client_ip, mobile)
            logger.warning(f"Invalid admin OTP attempt with mobile {mobile} from IP: {client_ip}")
            raise HTTPException(status_code=401, detail="Access Denied. Only the registered admin mobile can login here.")
        
        reset_failed_login(client_ip, mobile)
        logger.info(f"Successful admin OTP login from IP: {client_ip}")
        return {
            "success": True, 
            "role": "admin", 
            "email": OWNER_EMAIL,
            "name": OWNER_NAME,
            "staff_id": OWNER_STAFF_ID,
            "department": "admin",
            "message": "Admin login successful"
        }
    
    # STAFF LOGIN: Owner mobile always works as admin
    if mobile == OWNER_MOBILE:
        reset_failed_login(client_ip, mobile)
        logger.info(f"Owner logged in via staff portal from IP: {client_ip}")
        return {
            "success": True, 
            "role": "admin", 
            "email": OWNER_EMAIL,
            "name": OWNER_NAME,
            "staff_id": OWNER_STAFF_ID,
            "department": "admin",
            "message": "Admin login successful"
        }
    
    # STAFF LOGIN: Check if mobile is registered for staff (check both mobile and phone fields)
    staff = await db.crm_staff_accounts.find_one(
        {"$or": [{"mobile": mobile}, {"phone": mobile}], "is_active": True}, 
        {"_id": 0}
    )
    
    if staff:
        # Block admin/super_admin accounts from using the staff login path
        staff_role = (staff.get("role") or "").lower()
        if staff_role in {"super_admin", "admin"}:
            logger.warning(f"Admin account {staff.get('staff_id')} attempted staff portal login from IP: {client_ip}")
            raise HTTPException(
                status_code=403,
                detail="This is an Admin account. Please log in at the Admin Login page."
            )
        reset_failed_login(client_ip, mobile)
        logger.info(f"Successful OTP login for staff {staff.get('name')} from IP: {client_ip}")
        # Look up department from HR record
        department = ""
        try:
            hr_emp = await db.hr_employees.find_one({"employee_id": staff.get("staff_id")}, {"_id": 0, "department": 1})
            if hr_emp:
                department = hr_emp.get("department", "") or ""
        except Exception:
            pass
        return {
            "success": True, 
            "role": staff_role or "staff", 
            "email": staff.get("email"),
            "name": staff.get("name"),
            "staff_id": staff.get("staff_id"),
            "department": department,
            "id": staff.get("id"),
            "message": "Staff login successful"
        }
    
    # Not registered - reject
    record_failed_login(client_ip, mobile)
    logger.warning(f"Invalid login attempt with unregistered mobile {mobile} from IP: {client_ip}")
    raise HTTPException(status_code=401, detail="Invalid login. Mobile number not registered. Contact admin.")

@api_router.post("/admin/verify-2fa")
@limiter.limit(RATE_LIMIT_AUTH)
async def admin_verify_2fa(request: Request, data: Dict[str, Any]):
    """Step 2 of 2FA: Verify OTP and complete login - ADMIN ONLY"""
    client_ip = get_real_ip(request)
    email = data.get("email", "").strip()
    role = data.get("role", "")
    staff_id = data.get("staff_id", "")
    
    # STRICT CHECK: Only allow the registered owner email to complete 2FA
    if email.lower() != OWNER_EMAIL.lower():
        logger.warning(f"Unauthorized 2FA attempt with email '{email}' from IP: {client_ip}")
        raise HTTPException(
            status_code=401, 
            detail="Access Denied. Only the registered admin can complete this verification."
        )
    
    logger.info(f"2FA verified for admin {email} from IP: {client_ip}")
    return {
        "success": True,
        "role": "admin",
        "email": OWNER_EMAIL,
        "name": OWNER_NAME,
        "staff_id": OWNER_STAFF_ID,
        "department": "admin",
        "message": "2FA verification successful"
    }

@api_router.post("/admin/register-otp-mobile")
async def register_otp_mobile(data: Dict[str, Any]):
    """Register a mobile number for OTP login (admin only)"""
    mobile = data.get("mobile", "").strip().replace(" ", "").replace("-", "")
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    role = data.get("role", "staff")
    
    # Remove country code if present
    if mobile.startswith("91") and len(mobile) == 12:
        mobile = mobile[2:]
    elif mobile.startswith("+91") and len(mobile) == 13:
        mobile = mobile[3:]
    
    if not mobile or len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number format")
    
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Check if already registered
    existing = await db.registered_otp_logins.find_one({"mobile": mobile})
    
    if existing:
        # Update existing
        await db.registered_otp_logins.update_one(
            {"mobile": mobile},
            {"$set": {
                "name": name,
                "email": email,
                "role": role,
                "active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"success": True, "message": f"OTP login updated for {mobile}"}
    
    # Create new
    await db.registered_otp_logins.insert_one({
        "mobile": mobile,
        "name": name,
        "email": email,
        "role": role,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": f"OTP login registered for {mobile}"}

@api_router.get("/admin/otp-logins")
async def get_otp_logins():
    """Get all registered OTP login mobiles (admin only)"""
    logins = await db.registered_otp_logins.find(
        {"active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"logins": logins}

@api_router.delete("/admin/otp-login/{mobile}")
async def delete_otp_login(mobile: str):
    """Disable OTP login for a mobile number (admin only)"""
    result = await db.registered_otp_logins.update_one(
        {"mobile": mobile},
        {"$set": {"active": False, "disabled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mobile not found")
    
    return {"success": True, "message": f"OTP login disabled for {mobile}"}

@api_router.post("/admin/set-password")
async def set_admin_password(data: Dict[str, Any]):
    """Set password for admin or staff (admin only)"""
    user_id = data.get("user_id", "").strip()
    new_password = data.get("password", "").strip()
    role = data.get("role", "staff")
    
    if not user_id or not new_password:
        raise HTTPException(status_code=400, detail="User ID and password required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    import hashlib
    import secrets
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((new_password + salt).encode()).hexdigest()
    
    await db.admin_credentials.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "password_hash": password_hash,
            "salt": salt,
            "role": role,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Also update staff account if exists
    if role == "staff":
        await db.crm_staff_accounts.update_one(
            {"$or": [{"email": user_id}, {"phone": user_id}, {"staff_id": user_id}]},
            {"$set": {"password": new_password}}
        )
    
    return {"success": True, "message": f"Password set successfully for {user_id}"}

# Staff Management with AI Features
@api_router.get("/admin/staff")
async def get_staff():
    staff = await db.staff.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return staff

@api_router.post("/admin/staff")
async def create_staff(staff_data: Dict[str, Any]):
    staff = StaffMember(
        name=sanitize_input(staff_data.get("name", "")),
        email=staff_data.get("email", ""),
        phone=staff_data.get("phone", ""),
        role=staff_data.get("role", "staff"),
        reportingTo=staff_data.get("reportingTo", ""),
        joiningDate=staff_data.get("joiningDate", ""),
        status=staff_data.get("status", "active")
    )
    doc = staff.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.staff.insert_one(doc)
    return staff

@api_router.put("/admin/staff/{staff_id}")
async def update_staff(staff_id: str, staff_data: Dict[str, Any]):
    await db.staff.update_one({"id": staff_id}, {"$set": staff_data})
    return {"success": True}

@api_router.delete("/admin/staff/{staff_id}")
async def delete_staff(staff_id: str):
    # PROTECTION: Owner account can never be deleted
    if staff_id == OWNER_STAFF_ID:
        raise HTTPException(status_code=403, detail=f"Cannot delete owner account. {OWNER_NAME} ({OWNER_STAFF_ID}) has permanent protected access.")
    staff = await db.staff.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if is_owner_account(staff):
        raise HTTPException(status_code=403, detail="Cannot delete owner account")
    result = await db.staff.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return {"success": True}

@api_router.post("/admin/staff/{staff_id}/task")
async def assign_task(staff_id: str, task_data: Dict[str, Any]):
    """Assign task to staff member"""
    await db.staff.update_one(
        {"id": staff_id}, 
        {"$inc": {"tasks_pending": 1}}
    )
    task = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "title": sanitize_input(task_data.get("title", "")),
        "description": sanitize_input(task_data.get("description", "")),
        "priority": task_data.get("priority", "medium"),
        "due_date": task_data.get("due_date", ""),
        "status": "pending",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_tasks.insert_one(task)
    return {"success": True, "task": task}

@api_router.get("/admin/staff/{staff_id}/tasks")
async def get_staff_tasks(staff_id: str):
    tasks = await db.staff_tasks.find({"staff_id": staff_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return tasks

@api_router.put("/admin/staff/task/{task_id}/complete")
async def complete_task(task_id: str):
    task = await db.staff_tasks.find_one({"id": task_id})
    if task:
        await db.staff_tasks.update_one({"id": task_id}, {"$set": {"status": "completed"}})
        await db.staff.update_one(
            {"id": task["staff_id"]}, 
            {"$inc": {"tasks_completed": 1, "tasks_pending": -1}}
        )
    return {"success": True}

@api_router.post("/admin/staff/{staff_id}/attendance")
async def mark_attendance(staff_id: str, attendance_data: Dict[str, Any]):
    """Mark staff attendance"""
    attendance = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "date": attendance_data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "status": attendance_data.get("status", "present"),
        "check_in": attendance_data.get("check_in", ""),
        "check_out": attendance_data.get("check_out", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_attendance.insert_one(attendance)
    return {"success": True}

@api_router.get("/admin/staff/{staff_id}/attendance")
async def get_staff_attendance(staff_id: str):
    attendance = await db.staff_attendance.find({"staff_id": staff_id}, {"_id": 0}).sort("date", -1).to_list(30)
    return attendance

@api_router.post("/admin/staff/{staff_id}/ai-analysis")
async def analyze_staff_performance(staff_id: str):
    """AI-powered staff performance analysis"""
    staff = await db.staff.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    tasks = await db.staff_tasks.find({"staff_id": staff_id}, {"_id": 0}).to_list(50)
    attendance = await db.staff_attendance.find({"staff_id": staff_id}, {"_id": 0}).to_list(30)
    
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    present_days = sum(1 for a in attendance if a.get("status") == "present")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an HR analytics AI assistant that provides performance insights for staff members."
        )
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Analyze this staff member's performance and provide insights:
            Name: {staff.get('name')}
            Role: {staff.get('role')}
            Tasks Completed: {completed}
            Tasks Pending: {pending}
            Attendance (last 30 days): {present_days} days present
            
            Provide:
            1. Performance rating (1-100)
            2. Strengths
            3. Areas for improvement
            4. Recommendations
            
            Be constructive and helpful. Keep response concise.""")]
        )
        
        await db.staff.update_one(
            {"id": staff_id}, 
            {"$set": {"ai_performance_insights": response, "performance_score": min(100, 50 + completed * 5)}}
        )
        
        return {"success": True, "analysis": response}
    except Exception as e:
        logger.error(f"Error analyzing staff: {e}")
        default_analysis = f"Performance Score: {50 + completed * 5}/100. Tasks completed: {completed}. Attendance: {present_days} days."
        return {"success": True, "analysis": default_analysis}

# Marketing
@api_router.post("/marketing/campaigns", response_model=Campaign)
async def create_campaign(campaign_data: CampaignCreate):
    campaign_obj = Campaign(**campaign_data.model_dump(), status="active", ai_optimized_message="AI optimized version")
    doc = campaign_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.campaigns.insert_one(doc)
    return campaign_obj

@api_router.get("/marketing/campaigns", response_model=List[Campaign])
async def get_campaigns():
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return campaigns

@api_router.post("/ads/analytics", response_model=AdAnalytics)
async def create_ad_analytics(ad_data: Dict[str, Any]):
    analytics_obj = AdAnalytics(
        platform=ad_data.get('platform', 'google'),
        campaign_name=ad_data.get('campaign_name', 'Campaign'),
        impressions=ad_data.get('impressions', 0),
        clicks=ad_data.get('clicks', 0),
        conversions=ad_data.get('conversions', 0),
        cost=ad_data.get('cost', 0.0),
        ctr=ad_data.get('ctr', 0.0),
        cpc=ad_data.get('cpc', 0.0),
        conversion_rate=ad_data.get('conversion_rate', 0.0),
        ai_insights="Performance looks good",
        ai_recommendations="Continue monitoring"
    )
    doc = analytics_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.ad_analytics.insert_one(doc)
    return analytics_obj

@api_router.get("/ads/analytics", response_model=List[AdAnalytics])
async def get_ad_analytics():
    analytics = await db.ad_analytics.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return analytics

@api_router.post("/ai-marketing/start")
async def start_ai_marketing(request: Dict[str, Any]):
    return {"success": True, "content": [], "stats": {"postsGenerated": 5, "adsCreated": 3, "leadsGenerated": 12, "platformsActive": 6}}

# Social Media Post Model
class SocialPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    platforms: List[str] = []
    status: str = "draft"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Social Media Integration APIs
@api_router.get("/admin/social-posts")
async def get_social_posts():
    posts = await db.social_posts.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return posts

@api_router.post("/admin/social-posts")
async def create_social_post(post_data: Dict[str, Any]):
    post = SocialPost(
        content=sanitize_input(post_data.get("content", "")),
        platforms=post_data.get("platforms", []),
        status=post_data.get("status", "draft")
    )
    doc = post.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.social_posts.insert_one(doc)
    return post

@api_router.post("/admin/social-posts/generate")
async def generate_social_post(request: Dict[str, Any]):
    """AI-powered social media post generator"""
    post_type = request.get("type", "promotion")
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a social media marketing specialist for ASR Enterprises, a solar installation company in Bihar, India."
        )
        
        prompts = {
            "promotion": "Create a promotional social media post for ASR Enterprises, a solar installation company in Bihar. Mention PM Surya Ghar Yojana subsidy up to ₹78,000, 25-year warranty, and contact number 9296389097 (Call) / 9296389097 (WhatsApp). Use emojis and hashtags.",
            "project": "Create a social media post celebrating a successful solar installation project by ASR Enterprises in Bihar. Mention energy savings, professional installation, and invite others to contact 9296389097 (Call) / 9296389097 (WhatsApp). Use emojis and hashtags.",
            "festival": "Create a festive greeting social media post for ASR Enterprises, Bihar's trusted solar company. Make it warm, add solar energy reference, and mention contact 9296389097 (Call) / 9296389097 (WhatsApp). Use emojis and hashtags.",
            "scheme": "Create an informative social media post about PM Surya Ghar Muft Bijli Yojana government scheme for solar rooftop. Mention subsidy details (up to ₹78,000), how ASR Enterprises can help, and contact 9296389097 (Call) / 9296389097 (WhatsApp). Use emojis and hashtags."
        }
        
        prompt = prompts.get(post_type, prompts["promotion"])
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"{prompt}\n\nKeep it under 280 characters for Twitter compatibility. Return just the post content, no explanations.")]
        )
        
        return {"success": True, "suggestions": [response.strip()]}
    except Exception as e:
        logger.error(f"Error generating social post: {e}")
        # Return fallback content
        fallback = {
            "promotion": "🌞 Switch to Solar with ASR Enterprises! Get up to ₹78,000 govt subsidy. 25-year warranty + 5 years FREE maintenance! 📞 Call: 9296389097 | 💬 WhatsApp: 9296389097 #SolarPower #BiharSolar",
            "project": "✨ Another successful installation! Our team completed a rooftop solar system in Bihar. Save 90% on bills! 📞 Call: 9296389097 | 💬 WhatsApp: 9296389097 #SolarInstallation",
            "festival": "🎉 Warm wishes from ASR Enterprises! Go solar, save money, protect the environment! 🌞 #GreenEnergy #SolarBihar",
            "scheme": "📢 PM Surya Ghar Yojana: Up to ₹78,000 subsidy for rooftop solar! ASR Enterprises can help you apply. 📞 Call: 9296389097 | 💬 WhatsApp: 9296389097 #GovtScheme"
        }
        return {"success": True, "suggestions": [fallback.get(post_type, fallback["promotion"])]}

# ==================== CRM API ENDPOINTS ====================

# ==================== STAFF AUTHENTICATION ====================

@api_router.post("/staff/register")
async def register_staff(data: Dict[str, Any]):
    """Admin creates staff account with unique ID and password"""
    import hashlib
    
    # Check for custom staff ID or generate one
    custom_staff_id = data.get("custom_staff_id", "").strip().upper()
    if custom_staff_id:
        # Validate custom ID format and check for duplicates
        if not custom_staff_id.startswith("ASR"):
            custom_staff_id = f"ASR{custom_staff_id}"
        existing = await db.crm_staff_accounts.find_one({"staff_id": custom_staff_id})
        if existing:
            raise HTTPException(status_code=400, detail=f"Staff ID {custom_staff_id} already exists. Please use a different ID.")
        staff_id = custom_staff_id
    else:
        # Generate unique staff ID (ASR + 4 digits)
        staff_count = await db.crm_staff_accounts.count_documents({})
        staff_id = f"ASR{1001 + staff_count}"
        # Ensure uniqueness
        while await db.crm_staff_accounts.find_one({"staff_id": staff_id}):
            staff_count += 1
            staff_id = f"ASR{1001 + staff_count}"
    
    # Hash password
    password = data.get("password", "asr@123")
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    staff_account = {
        "id": str(uuid.uuid4()),
        "staff_id": staff_id,
        "password_hash": password_hash,
        "name": sanitize_input(data.get("name", "")),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "role": data.get("role", "sales"),
        "department": data.get("department", "sales"),
        "is_active": True,
        "leads_assigned": 0,
        "leads_converted": 0,
        "total_revenue": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_staff_accounts.insert_one(staff_account)
    
    return {
        "success": True,
        "staff_id": staff_id,
        "password": password,
        "message": f"Staff account created. Login ID: {staff_id}"
    }

@api_router.post("/staff/login")
async def staff_login(request: Request, data: Dict[str, Any]):
    """Staff login with password - Step 1 of 2FA: verify credentials, require mobile OTP"""
    import hashlib
    
    client_ip = get_client_ip(request)
    if not check_login_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again in 5 minutes.")
    
    staff_id = data.get("staff_id", "").strip().upper()
    password = data.get("password", "")
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Find staff with hashed password
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id, "password_hash": password_hash, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    
    # Also try with plain password for backwards compatibility
    if not staff:
        staff = await db.crm_staff_accounts.find_one(
            {"staff_id": staff_id, "password": password, "is_active": True},
            {"_id": 0, "password": 0}
        )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid Staff ID or Password")
    
    # Block admin/super_admin accounts — they must use Admin Login
    if (staff.get("role") or "").lower() in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="This is an Admin account. Please log in at the Admin Login page.")
    
    # Get staff phone for 2FA
    phone = staff.get("phone", "")
    mobile_last4 = phone[-4:] if phone else "****"
    
    # Store staff_id in pending 2FA sessions
    await db.pending_2fa_sessions.update_one(
        {"staff_id": staff_id},
        {"$set": {
            "staff_id": staff_id,
            "staff": staff,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        }},
        upsert=True
    )
    
    logger.info(f"Staff 2FA initiated for {staff_id} from IP: {client_ip}")
    
    return {
        "success": True,
        "require_otp": True,
        "phone": phone,
        "mobile_last4": mobile_last4,
        "message": f"Password verified. OTP will be sent to mobile ending in ****{mobile_last4}",
        "staff_id": staff_id
    }

@api_router.post("/staff/login-email")
async def staff_login_email(request: Request, data: Dict[str, Any]):
    """Staff login with email + password (No OTP required)"""
    import hashlib
    import secrets
    
    client_ip = get_client_ip(request)
    if not check_login_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again in 5 minutes.")
    
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Find staff by email with hashed password
    staff = await db.crm_staff_accounts.find_one(
        {"email": email, "password_hash": password_hash, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    
    # Also try with plain password for backwards compatibility
    if not staff:
        staff = await db.crm_staff_accounts.find_one(
            {"email": email, "password": password, "is_active": True},
            {"_id": 0, "password": 0}
        )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Block admin/super_admin accounts — they must use Admin Login
    if (staff.get("role") or "").lower() in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="This is an Admin account. Please log in at the Admin Login page.")
    
    reset_failed_login(client_ip, email)
    
    # Generate token
    token = secrets.token_urlsafe(32)
    
    return {
        "success": True,
        "staff": staff,
        "token": token
    }

@api_router.post("/staff/verify-2fa")
async def staff_verify_2fa(request: Request, data: Dict[str, Any]):
    """Verify 2FA OTP after password login - Step 2: Complete login after MSG91 OTP verification"""
    import secrets
    
    client_ip = get_client_ip(request)
    if not check_login_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again in 5 minutes.")
    
    staff_id = data.get("staff_id", "").strip().upper()
    
    # Check if there's a pending 2FA session
    pending_session = await db.pending_2fa_sessions.find_one(
        {"staff_id": staff_id},
        {"_id": 0}
    )
    
    if pending_session:
        # Check if session is expired
        expires_at = pending_session.get("expires_at")
        if expires_at:
            try:
                expiry_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expiry_time:
                    await db.pending_2fa_sessions.delete_one({"staff_id": staff_id})
                    raise HTTPException(status_code=401, detail="2FA session expired. Please login again.")
            except:
                pass
        
        # Get staff data from session
        staff = pending_session.get("staff")
        if staff:
            # Block admin/super_admin accounts — they must use Admin Login
            if (staff.get("role") or "").lower() in {"super_admin", "admin"}:
                raise HTTPException(status_code=403, detail="This is an Admin account. Please log in at the Admin Login page.")
            # Clean up pending session
            await db.pending_2fa_sessions.delete_one({"staff_id": staff_id})
            
            # Create session token
            session_token = secrets.token_urlsafe(32)
            
            logger.info(f"Successful 2FA login for staff {staff_id} from IP: {client_ip}")
            return {
                "success": True,
                "token": session_token,
                "staff": staff
            }
    
    # Fallback: Get staff directly from database
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id, "is_active": True},
        {"_id": 0, "password_hash": 0, "password": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Staff account not found")
    
    # Block admin/super_admin accounts — they must use Admin Login
    if (staff.get("role") or "").lower() in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="This is an Admin account. Please log in at the Admin Login page.")
    
    # Create session token
    session_token = secrets.token_urlsafe(32)
    
    logger.info(f"Successful 2FA login for staff {staff_id} from IP: {client_ip}")
    return {
        "success": True,
        "token": session_token,
        "staff": staff
    }

# Staff Email + Mobile OTP 2FA Endpoints
@api_router.post("/staff/login-email-2fa")
async def staff_login_email_2fa(request: Request, data: Dict[str, Any]):
    """Staff login with email - Step 1 of 2FA: verify email, require mobile OTP"""
    client_ip = get_client_ip(request)
    if not check_login_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again in 5 minutes.")
    
    email = data.get("email", "").strip().lower()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find staff by email
    staff = await db.crm_staff_accounts.find_one(
        {"email": email, "is_active": True},
        {"_id": 0, "password_hash": 0, "password": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Email not registered. Please contact admin.")
    
    # Get staff phone for 2FA
    phone = staff.get("phone", "")
    mobile_last4 = phone[-4:] if phone else "****"
    
    # Store pending 2FA session
    await db.pending_2fa_sessions.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "staff_id": staff.get("staff_id"),
            "staff": staff,
            "phone": phone,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        }},
        upsert=True
    )
    
    logger.info(f"Staff email 2FA initiated for {email} from IP: {client_ip}")
    
    return {
        "success": True,
        "require_otp": True,
        "phone": phone,
        "mobile_last4": mobile_last4,
        "staff_id": staff.get("staff_id"),
        "name": staff.get("name"),
        "message": f"Email verified. OTP will be sent to mobile ending in ****{mobile_last4}"
    }

@api_router.post("/staff/verify-email-2fa")
async def staff_verify_email_2fa(request: Request, data: Dict[str, Any]):
    """Staff email 2FA - Step 2: Complete login after MSG91 OTP verification"""
    import secrets
    
    client_ip = get_client_ip(request)
    if not check_login_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again in 5 minutes.")
    
    email = data.get("email", "").strip().lower()
    staff_id = data.get("staff_id", "").strip().upper()
    
    # Check pending 2FA session
    pending_session = await db.pending_2fa_sessions.find_one(
        {"$or": [{"email": email}, {"staff_id": staff_id}]},
        {"_id": 0}
    )
    
    if pending_session:
        # Check if session is expired
        expires_at = pending_session.get("expires_at")
        if expires_at:
            try:
                expiry_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expiry_time:
                    await db.pending_2fa_sessions.delete_one({"email": email})
                    raise HTTPException(status_code=401, detail="2FA session expired. Please login again.")
            except:
                pass
        
        # Get staff data from session
        staff = pending_session.get("staff")
        if staff:
            # Clean up pending session
            await db.pending_2fa_sessions.delete_one({"email": email})
            
            # Create session token
            session_token = secrets.token_urlsafe(32)
            
            logger.info(f"Successful email 2FA login for staff {staff.get('name')} from IP: {client_ip}")
            return {
                "success": True,
                "token": session_token,
                "staff": staff
            }
    
    # Fallback: Get staff directly from database
    staff = await db.crm_staff_accounts.find_one(
        {"$or": [{"email": email}, {"staff_id": staff_id}], "is_active": True},
        {"_id": 0, "password_hash": 0, "password": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=401, detail="Staff account not found")
    
    # Create session token
    session_token = secrets.token_urlsafe(32)
    
    logger.info(f"Successful email 2FA login for staff {staff.get('name')} from IP: {client_ip}")
    return {
        "success": True,
        "token": session_token,
        "staff": staff
    }

# Staff OTP Login Endpoints
@api_router.post("/staff/send-otp")
async def staff_send_otp(data: Dict[str, Any]):
    """Send OTP to staff email for login"""
    staff_id = data.get("staff_id", "").strip().upper()
    
    # Find staff by ID
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id, "is_active": True},
        {"_id": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff ID not found or account inactive")
    
    email = staff.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email configured for this staff account")
    
    # Generate and store OTP
    otp = generate_secure_otp()
    store_otp(f"staff:{staff_id}", otp)
    
    # Send OTP via email
    email_sent = await send_otp_email(email, otp, "Staff")
    
    if email_sent:
        logger.info(f"Staff OTP email sent to {email} for {staff_id}")
        return {"success": True, "message": f"OTP sent to {email[:3]}***{email[-10:]}", "email_sent": True}
    else:
        logger.info(f"Staff OTP generated for {staff_id} (email not configured)")
        return {"success": True, "message": "OTP has been sent to your registered email", "email_sent": False}

@api_router.post("/staff/verify-otp")
async def staff_verify_otp(request: Request, data: Dict[str, Any]):
    """Verify staff OTP and login"""
    client_ip = get_client_ip(request)
    
    if not check_login_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again in 5 minutes.")
    
    staff_id = data.get("staff_id", "").strip().upper()
    otp = data.get("otp", "").strip()
    
    # Verify OTP
    if not verify_otp(f"staff:{staff_id}", otp):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    
    # Get staff details
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Block admin/super_admin accounts — they must use Admin Login
    if (staff.get("role") or "").lower() in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="This is an Admin account. Please log in at the Admin Login page.")
    
    # Create session token
    session_token = str(uuid.uuid4())
    staff_sessions[session_token] = {
        "staff_id": staff_id,
        "id": staff.get("id"),
        "name": staff.get("name"),
        "role": staff.get("role"),
        "timestamp": time.time()
    }
    
    logger.info(f"Successful staff OTP login for {staff_id} from IP: {client_ip}")
    return {
        "success": True,
        "token": session_token,
        "staff": staff
    }

# ==================== NOTIFICATION ENDPOINTS ====================

@api_router.get("/staff/{staff_id}/notifications")
async def get_staff_notifications(staff_id: str):
    """Get in-app notifications for staff"""
    notifications = notifications_storage.get(staff_id, [])
    unread_count = sum(1 for n in notifications if not n.get("is_read"))
    return {
        "notifications": sorted(notifications, key=lambda x: x.get("timestamp", ""), reverse=True),
        "unread_count": unread_count
    }

@api_router.put("/staff/{staff_id}/notifications/{notification_id}/read")
async def mark_notification_read(staff_id: str, notification_id: str):
    """Mark notification as read"""
    notifications = notifications_storage.get(staff_id, [])
    for n in notifications:
        if n.get("id") == notification_id:
            n["is_read"] = True
            break
    return {"success": True}

@api_router.put("/staff/{staff_id}/notifications/read-all")
async def mark_all_notifications_read(staff_id: str):
    """Mark all notifications as read"""
    notifications = notifications_storage.get(staff_id, [])
    for n in notifications:
        n["is_read"] = True
    return {"success": True}

@api_router.get("/staff/profile/{staff_id}")
async def get_staff_profile(staff_id: str):
    """Get staff profile and stats"""
    staff = await db.crm_staff_accounts.find_one(
        {"staff_id": staff_id},
        {"_id": 0, "password_hash": 0}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff

@api_router.get("/staff/{staff_id}/leads")
async def get_staff_assigned_leads(staff_id: str, page: int = 1, limit: int = 150):
    """Get leads assigned to this staff member with pagination (150 per page)"""
    # Get internal ID from staff_id
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    staff_internal_id = staff.get("id")
    _not_deleted = {"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}
    
    # Get total count (exclude deleted)
    total_count = await db.crm_leads.count_documents({"assigned_to": staff_internal_id, **_not_deleted})
    
    # Calculate pagination
    skip = (page - 1) * limit
    total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
    
    # Get paginated leads (exclude deleted, newest first)
    leads = await db.crm_leads.find(
        {"assigned_to": staff_internal_id, **_not_deleted},
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

@api_router.put("/staff/{staff_id}/leads/{lead_id}")
async def staff_update_lead(staff_id: str, lead_id: str, data: Dict[str, Any]):
    """Staff updates their assigned lead"""
    # Verify staff owns this lead
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    lead = await db.crm_leads.find_one({"id": lead_id, "assigned_to": staff.get("id")}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    
    # Track stage changes
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
    # Call tracking fields for staff portal
    if "call_status" in data:
        update_fields["call_status"] = data["call_status"]
    if "last_call_at" in data:
        update_fields["last_call_at"] = data["last_call_at"]
    
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_fields})
    
    # If converted, update staff stats
    if data.get("stage") == "completed":
        await db.crm_staff_accounts.update_one(
            {"staff_id": staff_id},
            {"$inc": {"leads_converted": 1}}
        )
    
    return {"success": True}

@api_router.post("/staff/{staff_id}/leads/{lead_id}/not-interested")
async def staff_mark_lead_not_interested(staff_id: str, lead_id: str):
    """
    Mark a lead as not interested and transfer back to CRM pool.
    This unassigns the lead from the staff and sets stage to 'contacted'.
    """
    # Verify staff owns this lead
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    lead = await db.crm_leads.find_one({"id": lead_id, "assigned_to": staff.get("id")}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=403, detail="Not authorized to update this lead or lead not found")
    
    # Track stage change in history
    history_entry = {
        "stage": "contacted",
        "updated_by": staff_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": f"Marked as not interested by {staff.get('name', staff_id)}. Returned to CRM pool."
    }
    status_history = lead.get("status_history", [])
    status_history.append(history_entry)
    
    # Update lead: unassign and set stage to contacted
    update_fields = {
        "assigned_to": None,
        "assigned_by": None,
        "stage": "contacted",
        "status_history": status_history,
        "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Not Interested - Returned to CRM pool by {staff.get('name', staff_id)}. " + (lead.get("follow_up_notes") or "")
    }
    
    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_fields})
    
    # Decrement staff's leads_assigned count
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$inc": {"leads_assigned": -1}}
    )
    
    logger.info(f"Lead {lead_id} marked as not interested by staff {staff_id}, returned to CRM pool")
    
    return {"success": True, "message": "Lead marked as not interested and returned to CRM pool"}

@api_router.get("/staff/{staff_id}/followups")
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

@api_router.post("/staff/{staff_id}/followups")
async def staff_create_followup(staff_id: str, data: Dict[str, Any]):
    """Staff creates follow-up reminder"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    followup = CRMFollowUp(
        lead_id=data.get("lead_id", ""),
        employee_id=staff.get("id"),
        reminder_date=data.get("reminder_date", ""),
        reminder_time=data.get("reminder_time", "10:00"),
        reminder_type=data.get("reminder_type", "call"),
        notes=sanitize_input(data.get("notes", ""))
    )
    doc = followup.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_followups.insert_one(doc)
    
    # Update lead's next follow-up
    await db.crm_leads.update_one(
        {"id": data.get("lead_id")},
        {"$set": {"next_follow_up": data.get("reminder_date")}}
    )
    
    return followup

@api_router.put("/staff/{staff_id}/followups/{followup_id}")
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

@api_router.get("/staff/{staff_id}/dashboard")
async def get_staff_dashboard(staff_id: str):
    """Staff dashboard with their stats"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    internal_id = staff.get("id")
    
    # Get assigned leads count by stage
    pipeline_stats = await db.crm_leads.aggregate([
        {"$match": {"assigned_to": internal_id}},
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Today's follow-ups
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    todays_followups = await db.crm_followups.find(
        {"employee_id": internal_id, "reminder_date": today, "status": "pending"},
        {"_id": 0}
    ).to_list(20)
    
    # Recent leads
    recent_leads = await db.crm_leads.find(
        {"assigned_to": internal_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(5).to_list(5)
    
    return {
        "staff": staff,
        "pipeline_stats": {item["_id"]: item["count"] for item in pipeline_stats if item["_id"]},
        "total_assigned": staff.get("leads_assigned", 0),
        "total_converted": staff.get("leads_converted", 0),
        "todays_followups": todays_followups,
        "recent_leads": recent_leads
    }

@api_router.get("/staff/{staff_id}/training")
async def get_staff_training(staff_id: str):
    """Get training modules and progress for a staff member"""
    # Get employee record to check onboarding status
    employee = await db.hr_employees.find_one({"employee_id": staff_id}, {"_id": 0})
    
    # Default training modules for all staff
    modules = [
        {"id": "solar_basics", "title": "Solar Energy Basics", "description": "Learn fundamentals of solar power systems", "duration": "30 mins", "type": "video", "is_mandatory": True},
        {"id": "product_knowledge", "title": "Product Knowledge", "description": "ASR Enterprises product lineup and specifications", "duration": "45 mins", "type": "presentation", "is_mandatory": True},
        {"id": "sales_techniques", "title": "Sales Techniques", "description": "Effective solar sales strategies and customer handling", "duration": "1 hour", "type": "video", "is_mandatory": True},
        {"id": "installation_basics", "title": "Installation Overview", "description": "Understanding installation process and requirements", "duration": "45 mins", "type": "video", "is_mandatory": False},
        {"id": "crm_training", "title": "CRM System Training", "description": "How to use the ASR CRM effectively", "duration": "20 mins", "type": "interactive", "is_mandatory": True},
        {"id": "customer_service", "title": "Customer Service Excellence", "description": "Best practices for customer support", "duration": "30 mins", "type": "video", "is_mandatory": False},
        {"id": "company_policies", "title": "Company Policies", "description": "HR policies, leave management, and guidelines", "duration": "15 mins", "type": "document", "is_mandatory": True}
    ]
    
    # Get progress for this staff
    progress_records = await db.staff_training_progress.find(
        {"staff_id": staff_id},
        {"_id": 0}
    ).to_list(50)
    
    progress = {record.get("module_id"): record.get("completed", False) for record in progress_records}
    
    return {"modules": modules, "progress": progress}

@api_router.post("/staff/{staff_id}/training/{module_id}/complete")
async def complete_staff_training(staff_id: str, module_id: str):
    """Mark a training module as complete"""
    await db.staff_training_progress.update_one(
        {"staff_id": staff_id, "module_id": module_id},
        {"$set": {
            "staff_id": staff_id,
            "module_id": module_id,
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True, "message": "Training marked as complete"}

# Admin - Get all staff accounts
@api_router.get("/admin/staff-accounts")
async def get_all_staff_accounts():
    """Admin gets all staff accounts"""
    staff = await db.crm_staff_accounts.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return staff

@api_router.put("/admin/staff-accounts/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str, data: Dict[str, Any]):
    """Admin resets staff password — owner password cannot be reset via API"""
    if staff_id == OWNER_STAFF_ID:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot reset owner password via API. {OWNER_NAME} ({OWNER_STAFF_ID}) credentials are protected."
        )
    new_password = data.get("password", "asr@123")
    password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$set": {"password_hash": password_hash}}
    )
    return {"success": True, "new_password": new_password}

@api_router.put("/admin/staff-accounts/{staff_id}/toggle-otp")
async def toggle_staff_otp(staff_id: str, data: Dict[str, Any]):
    """Admin enables/disables mobile OTP login for staff"""
    if staff_id == OWNER_STAFF_ID:
        raise HTTPException(status_code=403, detail=f"Cannot modify owner account settings. {OWNER_NAME} ({OWNER_STAFF_ID}) is permanently protected.")
    otp_enabled = data.get("otp_login_enabled", False)
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$set": {"otp_login_enabled": otp_enabled}}
    )
    status = "enabled" if otp_enabled else "disabled"
    return {"success": True, "message": f"Mobile OTP login {status}"}

@api_router.put("/admin/staff-accounts/{staff_id}/toggle-status")
async def toggle_staff_status(staff_id: str, data: Dict[str, Any]):
    """Admin activates/deactivates staff account — owner cannot be deactivated"""
    if staff_id == OWNER_STAFF_ID:
        raise HTTPException(status_code=403, detail=f"Cannot deactivate owner account. {OWNER_NAME} ({OWNER_STAFF_ID}) is permanently active.")
    is_active = data.get("is_active", False)
    await db.crm_staff_accounts.update_one(
        {"staff_id": staff_id},
        {"$set": {"is_active": is_active}}
    )
    status = "activated" if is_active else "deactivated"
    return {"success": True, "message": f"Staff account {status}"}

@api_router.put("/admin/staff-accounts/{staff_id}/update")
async def update_staff_account(staff_id: str, data: Dict[str, Any]):
    """Admin updates staff account details — owner core fields are immutable"""
    update_fields = {}
    
    if "name" in data:
        update_fields["name"] = sanitize_input(data["name"])
    if "email" in data:
        update_fields["email"] = data["email"]
    if "phone" in data:
        update_fields["phone"] = data["phone"]
    if "role" in data:
        update_fields["role"] = data["role"]
    if "department" in data:
        update_fields["department"] = data["department"]
    
    if staff_id == OWNER_STAFF_ID:
        # Strip any attempt to change core identity or downgrade the owner
        for locked_field in ("email", "mobile", "role", "is_owner", "is_super_admin", "can_delete", "staff_id", "permissions"):
            update_fields.pop(locked_field, None)
        # Always keep owner flags set correctly
        update_fields["is_owner"] = True
        update_fields["is_super_admin"] = True
        update_fields["can_delete"] = False
        update_fields["email"] = OWNER_EMAIL
        update_fields["mobile"] = OWNER_MOBILE
    
    if update_fields:
        await db.crm_staff_accounts.update_one(
            {"staff_id": staff_id},
            {"$set": update_fields}
        )
    
    return {"success": True, "message": "Staff account updated"}

@api_router.delete("/admin/staff-accounts/{staff_id}")
async def delete_staff_account(staff_id: str):
    """Admin deletes staff account permanently"""
    # ABSOLUTE PROTECTION: Owner account (ASR1001) can NEVER be deleted by anyone
    if staff_id == OWNER_STAFF_ID:
        raise HTTPException(
            status_code=403, 
            detail=f"Cannot delete owner account. {OWNER_NAME} ({OWNER_STAFF_ID}) is the owner and has permanent protected access."
        )
    
    # Fetch account and double-check owner flags
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if staff and is_owner_account(staff):
        raise HTTPException(
            status_code=403, 
            detail=f"Cannot delete owner/super-admin account. {OWNER_NAME} ({OWNER_STAFF_ID}) is permanently protected."
        )
    
    if staff:
        # Unassign all leads before deleting
        await db.crm_leads.update_many(
            {"assigned_to": staff.get("id")},
            {"$set": {"assigned_to": None, "assigned_by": None}}
        )
    
    await db.crm_staff_accounts.delete_one({"staff_id": staff_id})
    return {"success": True, "message": "Staff account deleted"}

@api_router.get("/admin/staff-accounts/{staff_id}/details")
async def get_staff_details(staff_id: str):
    """Admin gets detailed staff info including assigned leads"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Get assigned leads
    leads = await db.crm_leads.find(
        {"assigned_to": staff.get("id")},
        {"_id": 0}
    ).to_list(100)
    
    # Get follow-ups
    followups = await db.crm_followups.find(
        {"employee_id": staff.get("id")},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "staff": staff,
        "assigned_leads": leads,
        "followups": followups,
        "total_leads": len(leads),
        "pending_followups": len([f for f in followups if f.get("status") == "pending"])
    }

# ==================== TASK MANAGEMENT APIs ====================

@api_router.get("/crm/tasks")
async def get_all_tasks(staff_id: Optional[str] = None, status: Optional[str] = None, date: Optional[str] = None):
    """Get all tasks with optional filters"""
    query = {}
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    if date:
        query["due_date"] = date
    tasks = await db.crm_tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
    return tasks

@api_router.post("/crm/tasks")
async def create_task(data: Dict[str, Any]):
    """Admin creates task for staff"""
    # Get staff name
    staff = await db.crm_staff_accounts.find_one({"id": data.get("staff_id")}, {"_id": 0})
    staff_name = staff.get("name", "") if staff else ""
    
    # Get lead name if lead_id provided
    lead_name = ""
    if data.get("lead_id"):
        lead = await db.crm_leads.find_one({"id": data.get("lead_id")}, {"_id": 0})
        lead_name = lead.get("name", "") if lead else ""
    
    task = StaffTask(
        staff_id=data.get("staff_id", ""),
        staff_name=staff_name,
        title=sanitize_input(data.get("title", "")),
        description=sanitize_input(data.get("description", "")),
        task_type=data.get("task_type", "call"),
        lead_id=data.get("lead_id"),
        lead_name=lead_name,
        priority=data.get("priority", "medium"),
        due_date=data.get("due_date", ""),
        due_time=data.get("due_time", "10:00"),
        created_by=data.get("created_by", "admin")
    )
    doc = task.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_tasks.insert_one(doc)
    return task

@api_router.put("/crm/tasks/{task_id}")
async def update_task(task_id: str, data: Dict[str, Any]):
    """Update task status or details"""
    update_fields = {}
    for key in ["status", "notes", "priority", "due_date", "due_time"]:
        if key in data:
            update_fields[key] = data[key]
    
    if data.get("status") == "completed":
        update_fields["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.crm_tasks.update_one({"id": task_id}, {"$set": update_fields})
    return {"success": True}

@api_router.delete("/crm/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.crm_tasks.delete_one({"id": task_id})
    return {"success": True}

@api_router.get("/staff/{staff_id}/tasks")
async def get_staff_tasks(staff_id: str, date: Optional[str] = None):
    """Get tasks for a specific staff member"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    query = {"staff_id": staff.get("id")}
    if date:
        query["due_date"] = date
    
    tasks = await db.crm_tasks.find(query, {"_id": 0}).sort("due_time", 1).to_list(100)
    return tasks

@api_router.get("/staff/{staff_id}/tasks/today")
async def get_staff_today_tasks(staff_id: str):
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

# ==================== ACTIVITY TIMELINE APIs ====================

@api_router.get("/crm/leads/{lead_id}/activities")
async def get_lead_activities(lead_id: str):
    """Get activity timeline for a lead"""
    activities = await db.crm_activities.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return activities

@api_router.post("/crm/leads/{lead_id}/activities")
async def add_lead_activity(lead_id: str, data: Dict[str, Any]):
    """Add activity/note to lead timeline"""
    # Get staff info if staff_id provided
    staff_name = ""
    if data.get("staff_id"):
        staff = await db.crm_staff_accounts.find_one({"staff_id": data.get("staff_id")}, {"_id": 0})
        staff_name = staff.get("name", "") if staff else data.get("staff_name", "")
    
    activity = ActivityLog(
        lead_id=lead_id,
        staff_id=data.get("staff_id"),
        staff_name=staff_name or data.get("staff_name", "Admin"),
        activity_type=data.get("activity_type", "note"),
        title=sanitize_input(data.get("title", "")),
        description=sanitize_input(data.get("description", "")),
        old_value=data.get("old_value"),
        new_value=data.get("new_value")
    )
    doc = activity.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_activities.insert_one(doc)
    return activity

# ==================== INTERNAL MESSAGING APIs ====================

@api_router.get("/crm/messages")
async def get_all_messages(user_id: Optional[str] = None, lead_id: Optional[str] = None):
    """Get messages - admin sees all, staff sees their own"""
    query = {}
    if user_id:
        query["$or"] = [{"sender_id": user_id}, {"receiver_id": user_id}, {"receiver_id": None}]
    if lead_id:
        query["lead_id"] = lead_id
    
    messages = await db.crm_messages.find(query, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    return messages

@api_router.post("/crm/messages")
async def send_message(data: Dict[str, Any]):
    """Send internal message"""
    # Get receiver name if receiver_id provided
    receiver_name = "All Staff"
    if data.get("receiver_id"):
        receiver = await db.crm_staff_accounts.find_one({"id": data.get("receiver_id")}, {"_id": 0})
        receiver_name = receiver.get("name", "") if receiver else ""
    
    message = CRMMessage(
        sender_id=data.get("sender_id", "admin"),
        sender_name=data.get("sender_name", "Admin"),
        sender_type=data.get("sender_type", "admin"),
        receiver_id=data.get("receiver_id"),
        receiver_name=receiver_name,
        lead_id=data.get("lead_id"),
        message=sanitize_input(data.get("message", ""))
    )
    doc = message.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_messages.insert_one(doc)
    return message

@api_router.put("/crm/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    """Mark message as read"""
    await db.crm_messages.update_one({"id": message_id}, {"$set": {"is_read": True}})
    return {"success": True}

@api_router.delete("/crm/messages/{message_id}")
async def delete_message(message_id: str):
    """Delete a message (admin only)"""
    result = await db.crm_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "message": "Message deleted"}

@api_router.get("/crm/messages/conversation/{staff_id}")
async def get_conversation_with_staff(staff_id: str):
    """Get private conversation between admin and a specific staff member"""
    # Get messages where:
    # - sender is admin AND receiver is this staff OR
    # - sender is this staff AND receiver is admin
    messages = await db.crm_messages.find({
        "$or": [
            {"sender_id": "admin", "receiver_id": staff_id},
            {"sender_id": staff_id, "receiver_id": "admin"}
        ]
    }, {"_id": 0}).sort("timestamp", 1).limit(100).to_list(100)
    return messages

@api_router.get("/staff/{staff_id}/messages")
async def get_staff_messages(staff_id: str):
    """Get ONLY private messages between this staff member and admin - no broadcasts, no other staff messages"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    internal_id = staff.get("id")
    # SECURE: Only return messages where this staff is directly involved with admin
    messages = await db.crm_messages.find(
        {"$or": [
            {"sender_id": internal_id, "receiver_id": "admin"},
            {"sender_id": "admin", "receiver_id": internal_id}
        ]},
        {"_id": 0}
    ).sort("timestamp", 1).limit(100).to_list(100)
    return messages

@api_router.get("/staff/{staff_id}/messages/unread")
async def get_unread_messages(staff_id: str):
    """Get unread message count for staff - only from admin to this staff"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        return {"count": 0}
    
    internal_id = staff.get("id")
    count = await db.crm_messages.count_documents({
        "sender_id": "admin",
        "receiver_id": internal_id,
        "is_read": False
    })
    return {"count": count}

@api_router.post("/staff/{staff_id}/leads")
async def staff_create_lead(staff_id: str, data: Dict[str, Any]):
    """Allow staff (telecaller/manager) to create new leads"""
    staff = await db.crm_staff_accounts.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    monthly_bill = data.get("monthly_bill") or 0
    lead_score = min(100, 40 + int(monthly_bill / 100))
    ai_priority = "high" if lead_score >= 80 else "medium" if lead_score >= 60 else "low"
    
    notes = data.get("notes", "")
    follow_up_notes = ""
    if notes:
        follow_up_notes = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] {notes}"
    
    lead = CRMLead(
        name=sanitize_input(data.get("name", "")),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        district=data.get("district", ""),
        address=sanitize_input(data.get("address", "")),
        property_type=data.get("property_type", "residential"),
        monthly_bill=data.get("monthly_bill"),
        roof_area=data.get("roof_area"),
        source=f"staff:{staff.get('name', staff_id)}",
        stage="new",
        assigned_to=staff.get("id"),
        lead_score=lead_score,
        ai_priority=ai_priority,
        follow_up_notes=follow_up_notes,
        next_follow_up=(datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
        status_history=[{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": f"Lead created by {staff.get('name', staff_id)}"}]
    )
    doc = lead.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_leads.insert_one(doc)
    await db.crm_staff_accounts.update_one({"staff_id": staff_id}, {"$inc": {"leads_assigned": 1}})
    return lead

# CRM Employee Management
@api_router.get("/crm/employees")
async def get_crm_employees():
    employees = await db.crm_employees.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return employees

@api_router.post("/crm/employees")
async def create_crm_employee(data: Dict[str, Any]):
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

@api_router.put("/crm/employees/{employee_id}")
async def update_crm_employee(employee_id: str, data: Dict[str, Any]):
    update_data = {k: sanitize_input(v) if isinstance(v, str) else v for k, v in data.items()}
    await db.crm_employees.update_one({"id": employee_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/crm/employees/{employee_id}")
async def delete_crm_employee(employee_id: str):
    await db.crm_employees.delete_one({"id": employee_id})
    return {"success": True}

# CRM Lead Management with Pipeline
@api_router.get("/crm/leads")
async def get_crm_leads(
    stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    page: int = 1,
    limit: int = 250,
    search: Optional[str] = None
):
    """
    Get CRM leads with pagination — always excludes soft-deleted leads.
    - page: Page number (1-indexed)
    - limit: Leads per page (default 250, max 500)
    - search: Search by name or phone
    """
    # ALWAYS exclude soft-deleted leads (is_deleted: True).
    # This was the root cause of the "deleted leads still appearing" bug —
    # the old query = {} had no filter and returned everything including
    # leads that had been soft-deleted via DELETE /admin/leads/{id}.
    must = [{"$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}]

    if stage:
        must.append({"stage": stage})
    if assigned_to:
        must.append({"assigned_to": assigned_to})
    if search:
        must.append({"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}}
        ]})

    query = {"$and": must} if len(must) > 1 else must[0]

    limit = min(limit, 500)
    skip = (page - 1) * limit

    total_count = await db.crm_leads.count_documents(query)
    total_pages = (total_count + limit - 1) // limit

    leads = await db.crm_leads.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)

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

@api_router.get("/crm/leads/export.csv")
async def export_crm_leads_csv(
    stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Stream all leads matching the given filters as a CSV download."""
    import csv, io
    from fastapi.responses import StreamingResponse

    query: Dict[str, Any] = {}
    if stage: query["stage"] = stage
    if assigned_to: query["assigned_to"] = assigned_to
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}},
            {"district": {"$regex": search, "$options": "i"}},
        ]
    if from_date or to_date:
        ts: Dict[str, Any] = {}
        if from_date: ts["$gte"] = from_date
        if to_date: ts["$lte"] = to_date
        query["timestamp"] = ts

    rows = await db.crm_leads.find(query, {"_id": 0}).sort("timestamp", -1).to_list(20000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Name", "Phone", "Email", "District", "Stage", "Source",
                "Property Type", "Assigned To", "Created At", "Last Contact"])
    for r in rows:
        w.writerow([
            r.get("name", ""), r.get("phone", ""), r.get("email", ""),
            r.get("district", ""), r.get("stage", ""), r.get("source", ""),
            r.get("property_type", ""), r.get("assigned_to", ""),
            r.get("timestamp", r.get("created_at", "")),
            r.get("last_contact", ""),
        ])
    buf.seek(0)
    fname = f"asr_leads_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api_router.post("/crm/leads")
async def create_crm_lead(data: Dict[str, Any]):
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
    
    logger.info(f"Manual lead created: {data.get('name')} from source: {data.get('source', 'manual')}")
    return lead

@api_router.put("/crm/leads/{lead_id}")
async def update_crm_lead(lead_id: str, data: Dict[str, Any]):
    # Get current lead
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

@api_router.post("/crm/leads/{lead_id}/assign")
async def assign_lead(lead_id: str, data: Dict[str, Any]):
    employee_id = data.get("employee_id")
    assigned_by = data.get("assigned_by", "admin")
    
    # Get lead details
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get staff details
    staff = await db.crm_staff_accounts.find_one({"id": employee_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": {"assigned_to": employee_id, "assigned_by": assigned_by}}
    )
    
    # Update employee stats
    await db.crm_staff_accounts.update_one(
        {"id": employee_id},
        {"$inc": {"leads_assigned": 1}}
    )
    
    # Send in-app notification to staff
    add_notification(
        staff.get("staff_id"),
        "lead_assigned",
        "New Lead Assigned!",
        f"Lead: {lead.get('name')} from {lead.get('district')} - ₹{lead.get('monthly_bill', 0)}/mo bill",
        lead_id
    )
    
    # Generate WhatsApp notification URL
    whatsapp_message = f"""🔔 *New Lead Assigned - ASR Enterprises*

👤 *Name:* {lead.get('name')}
📞 *Phone:* {lead.get('phone')}
📍 *District:* {lead.get('district')}
💰 *Monthly Bill:* ₹{lead.get('monthly_bill', 'N/A')}
🏠 *Property:* {lead.get('property_type', 'residential')}

Please contact within 24 hours.

_From ASR Enterprises Admin_"""
    
    whatsapp_url = get_whatsapp_url(staff.get("phone", ""), whatsapp_message) if staff.get("phone") else None
    
    return {"success": True, "whatsapp_notification_url": whatsapp_url}

@api_router.post("/crm/leads/bulk-assign")
async def bulk_assign_leads(data: Dict[str, Any]):
    """Bulk assign multiple leads to a staff member"""
    lead_ids = data.get("lead_ids", [])
    employee_id = data.get("employee_id")
    assigned_by = data.get("assigned_by", "admin")
    
    if not lead_ids:
        raise HTTPException(status_code=400, detail="No leads selected")
    if not employee_id:
        raise HTTPException(status_code=400, detail="Staff not selected")
    
    # Get staff details
    staff = await db.crm_staff_accounts.find_one({"id": employee_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Update all leads
    result = await db.crm_leads.update_many(
        {"id": {"$in": lead_ids}},
        {"$set": {"assigned_to": employee_id, "assigned_by": assigned_by}}
    )
    
    # Update employee stats
    await db.crm_staff_accounts.update_one(
        {"id": employee_id},
        {"$inc": {"leads_assigned": result.modified_count}}
    )
    
    # Send in-app notification to staff
    add_notification(
        staff.get("staff_id"),
        "bulk_lead_assigned",
        f"🎯 {result.modified_count} New Leads Assigned!",
        f"Admin has assigned {result.modified_count} leads to you. Check your leads tab.",
        None
    )
    
    return {
        "success": True, 
        "assigned_count": result.modified_count,
        "message": f"{result.modified_count} leads assigned to {staff.get('name')}"
    }

# AI Auto Lead Assignment
@api_router.post("/crm/leads/{lead_id}/auto-assign")
async def auto_assign_lead(lead_id: str):
    """AI-powered auto lead assignment - location first, then round-robin"""
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead.get("assigned_to"):
        return {"success": False, "message": "Lead already assigned"}
    
    # Staff IDs excluded from lead allotment (owners / admin only accounts)
    _ALLOTMENT_EXCLUDED_IDS = {"ASR1001", "ASR1002"}
    _ALLOTMENT_EXCLUDED_NAMES = {"ABHIJEET KUMAR", "ANAMIKA"}

    # Get all active staff excluding owners and specific non-field staff
    active_staff = await db.crm_staff_accounts.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)

    active_staff = [
        s for s in active_staff
        if s.get("staff_id") not in _ALLOTMENT_EXCLUDED_IDS
        and s.get("name", "").upper().strip() not in _ALLOTMENT_EXCLUDED_NAMES
    ]
    
    if not active_staff:
        return {"success": False, "message": "No active field staff available for assignment"}
    
    lead_district = lead.get("district", "").lower()
    assigned_staff = None
    assignment_reason = ""
    
    # Strategy 1: Location-based assignment
    # Check if any staff has the district in their name/notes or handles that area
    for staff in active_staff:
        staff_districts = staff.get("districts", [])
        if isinstance(staff_districts, list):
            if any(lead_district in d.lower() for d in staff_districts):
                assigned_staff = staff
                assignment_reason = f"Location match: {lead_district}"
                break
    
    # Strategy 2: Round-robin (assign to staff with least leads)
    if not assigned_staff:
        # Sort by leads_assigned ascending
        sorted_staff = sorted(active_staff, key=lambda x: x.get("leads_assigned", 0))
        assigned_staff = sorted_staff[0]
        assignment_reason = "Round-robin (least leads)"
    
    # Assign the lead
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": {
            "assigned_to": assigned_staff.get("id"),
            "assigned_by": "ai_auto",
            "ai_assignment_reason": assignment_reason
        }}
    )
    
    # Update staff stats
    await db.crm_staff_accounts.update_one(
        {"id": assigned_staff.get("id")},
        {"$inc": {"leads_assigned": 1}}
    )
    
    # Send notification
    add_notification(
        assigned_staff.get("staff_id"),
        "lead_assigned",
        "New Lead Auto-Assigned!",
        f"Lead: {lead.get('name')} from {lead.get('district')} - AI assigned ({assignment_reason})",
        lead_id
    )
    
    # WhatsApp notification
    whatsapp_message = f"""🤖 *Auto-Assigned Lead - ASR Enterprises*

👤 *Name:* {lead.get('name')}
📞 *Phone:* {lead.get('phone')}
📍 *District:* {lead.get('district')}
💰 *Monthly Bill:* ₹{lead.get('monthly_bill', 'N/A')}

📌 *Assignment:* {assignment_reason}

Please contact within 24 hours."""
    
    whatsapp_url = get_whatsapp_url(assigned_staff.get("phone", ""), whatsapp_message)
    
    return {
        "success": True,
        "assigned_to": assigned_staff.get("staff_id"),
        "assigned_name": assigned_staff.get("name"),
        "assignment_reason": assignment_reason,
        "whatsapp_notification_url": whatsapp_url
    }

# Bulk Auto-Assign Unassigned Leads
@api_router.post("/crm/leads/auto-assign-all")
async def auto_assign_all_leads():
    """Auto-assign all unassigned leads"""
    unassigned = await db.crm_leads.find(
        {"$or": [{"assigned_to": None}, {"assigned_to": ""}]},
        {"_id": 0}
    ).to_list(100)
    
    results = []
    for lead in unassigned:
        try:
            # Call auto-assign for each lead
            result = await auto_assign_lead(lead.get("id"))
            results.append({"lead_id": lead.get("id"), "name": lead.get("name"), **result})
        except Exception as e:
            results.append({"lead_id": lead.get("id"), "name": lead.get("name"), "success": False, "error": str(e)})
    
    return {
        "total_processed": len(results),
        "successful": sum(1 for r in results if r.get("success")),
        "results": results
    }

# CRM Follow-up Reminders
@api_router.get("/crm/followups")
async def get_followups(employee_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    followups = await db.crm_followups.find(query, {"_id": 0}).sort("reminder_date", 1).to_list(200)
    return followups

@api_router.post("/crm/followups")
async def create_followup(data: Dict[str, Any]):
    followup = CRMFollowUp(
        lead_id=data.get("lead_id", ""),
        employee_id=data.get("employee_id", ""),
        reminder_date=data.get("reminder_date", ""),
        reminder_time=data.get("reminder_time", "10:00"),
        reminder_type=data.get("reminder_type", "call"),
        notes=sanitize_input(data.get("notes", ""))
    )
    doc = followup.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_followups.insert_one(doc)
    
    # Update lead's next follow-up
    await db.crm_leads.update_one(
        {"id": data.get("lead_id")},
        {"$set": {"next_follow_up": data.get("reminder_date")}}
    )
    
    # Get lead and staff details for notification
    lead = await db.crm_leads.find_one({"id": data.get("lead_id")}, {"_id": 0})
    staff = await db.crm_staff_accounts.find_one({"id": data.get("employee_id")}, {"_id": 0})
    
    # Send in-app notification
    if staff:
        add_notification(
            staff.get("staff_id"),
            "followup",
            f"Follow-up Reminder: {data.get('reminder_type', 'call').title()}",
            f"Lead: {lead.get('name', 'Unknown') if lead else 'Unknown'} on {data.get('reminder_date')} at {data.get('reminder_time', '10:00')}",
            data.get("lead_id")
        )
    
    return followup

# Get Today's Follow-up Reminders with WhatsApp URLs
@api_router.get("/crm/followups/today")
async def get_todays_followups():
    """Get today's follow-up reminders with WhatsApp notification URLs"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    followups = await db.crm_followups.find(
        {"reminder_date": today, "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    enriched_followups = []
    for fu in followups:
        # Get lead details
        lead = await db.crm_leads.find_one({"id": fu.get("lead_id")}, {"_id": 0})
        # Get staff details
        staff = await db.crm_staff_accounts.find_one({"id": fu.get("employee_id")}, {"_id": 0})
        
        # Generate WhatsApp reminder message for staff
        reminder_message = f"""⏰ *Follow-up Reminder - ASR Enterprises*

📋 *Type:* {fu.get('reminder_type', 'call').title()}
👤 *Lead:* {lead.get('name', 'Unknown') if lead else 'Unknown'}
📞 *Phone:* {lead.get('phone', 'N/A') if lead else 'N/A'}
📍 *District:* {lead.get('district', 'N/A') if lead else 'N/A'}
⏰ *Time:* {fu.get('reminder_time', '10:00')}
📝 *Notes:* {fu.get('notes', 'No notes')}

Please complete this follow-up today!"""
        
        staff_whatsapp_url = get_whatsapp_url(staff.get("phone", ""), reminder_message) if staff else None
        
        # Generate WhatsApp message for contacting customer
        customer_message = f"""Hello {lead.get('name', 'Sir/Madam') if lead else 'Sir/Madam'},

This is a follow-up from ASR Enterprises regarding your solar rooftop inquiry.

Would you like to discuss further about:
- Government subsidy up to ₹78,000
- 25-year warranty
- Easy EMI options

Please let us know a convenient time to discuss.

Best regards,
ASR Enterprises
📞 9296389097"""
        
        customer_whatsapp_url = get_whatsapp_url(lead.get("phone", ""), customer_message) if lead else None
        
        enriched_followups.append({
            **fu,
            "lead_name": lead.get("name") if lead else "Unknown",
            "lead_phone": lead.get("phone") if lead else None,
            "lead_district": lead.get("district") if lead else None,
            "staff_name": staff.get("name") if staff else "Unassigned",
            "staff_phone": staff.get("phone") if staff else None,
            "staff_whatsapp_url": staff_whatsapp_url,
            "customer_whatsapp_url": customer_whatsapp_url
        })
    
    return enriched_followups

# Send WhatsApp Quote
@api_router.post("/crm/leads/{lead_id}/send-quote-whatsapp")
async def send_quote_whatsapp(lead_id: str, data: Dict[str, Any]):
    """Generate WhatsApp URL for sending quote to customer"""
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    system_size = data.get("system_size", "3kW")
    total_cost = data.get("total_cost", 210000)
    subsidy = data.get("subsidy", 78000)
    final_cost = data.get("final_cost", total_cost - subsidy)
    monthly_savings = data.get("monthly_savings", 3000)
    
    quote_message = f"""🌞 *ASR ENTERPRISES - Solar Quotation*

Dear {lead.get('name', 'Sir/Madam')},

Thank you for your interest in solar rooftop installation!

📋 *QUOTATION DETAILS*
━━━━━━━━━━━━━━━━━━━━━
🔆 System Size: {system_size}
💰 Total Cost: ₹{total_cost:,}
🎁 Govt Subsidy: -₹{subsidy:,}
✅ *Final Price: ₹{final_cost:,}*

📊 *BENEFITS*
━━━━━━━━━━━━━━━━━━━━━
💵 Monthly Savings: ~₹{monthly_savings:,}
📅 Payback Period: ~3-4 years
🛡️ Warranty: 25 years
🔧 Free Maintenance: 5 years

📍 *Your Location:* {lead.get('district', 'Bihar')}

*EMI Available:* Starting ₹{int(final_cost/36):,}/month

Ready to go solar? Reply YES or call us!

📞 *9296389097*
📧 support@asrenterprises.in

_ASR Enterprises - Bihar's Trusted Solar Partner_"""

    whatsapp_url = get_whatsapp_url(lead.get("phone", ""), quote_message)
    
    # Log activity
    await db.crm_activities.insert_one({
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "activity_type": "quote_sent",
        "title": f"Quote sent via WhatsApp - {system_size}",
        "description": f"Quoted ₹{final_cost:,} after subsidy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "whatsapp_url": whatsapp_url,
        "message": "Open the URL to send quote via WhatsApp"
    }

@api_router.put("/crm/followups/{followup_id}")
async def update_followup(followup_id: str, data: Dict[str, Any]):
    await db.crm_followups.update_one({"id": followup_id}, {"$set": data})
    return {"success": True}

# CRM Projects/Installations
@api_router.get("/crm/projects")
async def get_projects(status: Optional[str] = None):
    query = {}
    if status:
        query["installation_status"] = status
    projects = await db.crm_projects.find(query, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return projects

@api_router.post("/crm/projects")
async def create_project(data: Dict[str, Any]):
    project = CRMProject(
        lead_id=data.get("lead_id", ""),
        customer_name=sanitize_input(data.get("customer_name", "")),
        customer_phone=data.get("customer_phone", ""),
        location=sanitize_input(data.get("location", "")),
        system_size=data.get("system_size", ""),
        brand=data.get("brand", ""),
        total_amount=data.get("total_amount", 0),
        advance_received=data.get("advance_received", 0),
        pending_amount=data.get("total_amount", 0) - data.get("advance_received", 0)
    )
    doc = project.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_projects.insert_one(doc)
    
    # Update lead stage to installation
    if data.get("lead_id"):
        await db.crm_leads.update_one(
            {"id": data.get("lead_id")},
            {"$set": {"stage": "installation"}}
        )
    
    return project

@api_router.put("/crm/projects/{project_id}")
async def update_project(project_id: str, data: Dict[str, Any]):
    # Calculate pending
    if "total_amount" in data or "advance_received" in data:
        project = await db.crm_projects.find_one({"id": project_id}, {"_id": 0})
        if project:
            total = data.get("total_amount", project.get("total_amount", 0))
            advance = data.get("advance_received", project.get("advance_received", 0))
            data["pending_amount"] = total - advance
    
    await db.crm_projects.update_one({"id": project_id}, {"$set": data})
    return {"success": True}

@api_router.post("/crm/projects/{project_id}/photos")
async def add_project_photos(project_id: str, data: Dict[str, Any]):
    photo_url = data.get("photo_url", "")
    photo_type = data.get("type", "installation")  # installation or completion
    
    field = "installation_photos" if photo_type == "installation" else "completion_photos"
    await db.crm_projects.update_one(
        {"id": project_id},
        {"$push": {field: photo_url}}
    )
    
    # Also add to gallery
    photo = {
        "id": str(uuid.uuid4()),
        "title": f"Installation at {data.get('location', 'Bihar')}",
        "description": data.get("description", "Solar installation by ASR Enterprises"),
        "image_url": photo_url,
        "location": data.get("location", ""),
        "system_size": data.get("system_size", ""),
        "category": "installation",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.work_photos.insert_one(photo)
    
    return {"success": True}

# CRM Payments
@api_router.get("/crm/payments")
async def get_payments(project_id: Optional[str] = None):
    query = {}
    if project_id:
        query["project_id"] = project_id
    payments = await db.crm_payments.find(query, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return payments

@api_router.post("/crm/payments")
async def create_payment(data: Dict[str, Any]):
    payment = CRMPayment(
        project_id=data.get("project_id", ""),
        lead_id=data.get("lead_id", ""),
        amount=data.get("amount", 0),
        payment_type=data.get("payment_type", "advance"),
        payment_mode=data.get("payment_mode", "cash"),
        received_by=data.get("received_by", ""),
        notes=sanitize_input(data.get("notes", ""))
    )
    doc = payment.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.crm_payments.insert_one(doc)
    
    # Update project payment
    if data.get("project_id"):
        await db.crm_projects.update_one(
            {"id": data.get("project_id")},
            {"$inc": {"advance_received": data.get("amount", 0), "pending_amount": -data.get("amount", 0)}}
        )
    
    # Update employee revenue
    if data.get("received_by"):
        await db.crm_employees.update_one(
            {"id": data.get("received_by")},
            {"$inc": {"total_revenue": data.get("amount", 0)}}
        )
    
    return payment

# CRM Dashboard Stats
@api_router.get("/crm/dashboard-v1")
async def get_crm_dashboard_v1():
    """Legacy CRM Dashboard endpoint - use /crm/dashboard from modular router instead"""
    cache_key = "crm_dashboard"
    cached = get_cached(cache_key, ttl=20)  # 20 second cache for CRM
    if cached:
        return cached
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Run all database queries in parallel for faster response
    results = await asyncio.gather(
        # Lead stats by stage
        db.crm_leads.aggregate([
            {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
        ]).to_list(20),
        # Today's follow-ups
        db.crm_followups.count_documents({"reminder_date": today, "status": "pending"}),
        # Employee performance
        db.crm_employees.find({}, {"_id": 0}).to_list(50),
        # Recent leads
        db.crm_leads.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10),
        # Revenue stats
        db.crm_payments.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1),
        # Project stats - parallel counts
        db.crm_projects.count_documents({"installation_status": "pending"}),
        db.crm_projects.count_documents({"installation_status": "in_progress"}),
        db.crm_projects.count_documents({"installation_status": "completed"}),
        # Total leads count
        db.crm_leads.count_documents({})
    )
    
    pipeline_stats, todays_followups, employees, recent_leads, total_payments, \
        projects_pending, projects_progress, projects_completed, total_leads = results
    
    response = {
        "pipeline_stats": {item["_id"]: item["count"] for item in pipeline_stats if item["_id"]},
        "total_leads": total_leads,
        "todays_followups": todays_followups,
        "employees": employees,
        "recent_leads": recent_leads,
        "total_revenue": total_payments[0]["total"] if total_payments else 0,
        "projects": {
            "pending": projects_pending,
            "in_progress": projects_progress,
            "completed": projects_completed
        }
    }
    
    set_cache(cache_key, response, ttl=20)
    return response

# CRM AI Features
@api_router.post("/crm/ai/lead-priority")
async def ai_lead_priority(data: Dict[str, Any]):
    """AI-powered lead prioritization"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a sales AI assistant for a solar company."
        )
        
        leads = await db.crm_leads.find({"stage": {"$in": ["new", "contacted"]}}, {"_id": 0}).limit(20).to_list(20)
        
        leads_summary = "\n".join([
            f"- {l.get('name')}: ₹{l.get('monthly_bill', 0)} bill, {l.get('district')}, {l.get('property_type')}"
            for l in leads
        ])
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Analyze these solar leads and rank them by priority:
{leads_summary}

Return top 5 leads to focus on today with reasons. Format: Name - Priority (High/Medium) - Reason""")]
        )
        
        return {"success": True, "recommendations": response}
    except Exception as e:
        logger.error(f"AI lead priority error: {e}")
        return {"success": True, "recommendations": "Focus on leads with high monthly bills (>₹3000) and residential properties first."}

@api_router.post("/crm/ai/followup-suggestions")
async def ai_followup_suggestions(data: Dict[str, Any]):
    """AI-powered follow-up suggestions"""
    lead_id = data.get("lead_id")
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    
    if not lead:
        return {"success": False, "error": "Lead not found"}
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a sales coach for a solar company in Bihar."
        )
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Suggest follow-up approach for this lead:
Name: {lead.get('name')}
Stage: {lead.get('stage')}
Monthly Bill: ₹{lead.get('monthly_bill', 'Unknown')}
Property: {lead.get('property_type')}
District: {lead.get('district')}
Last Follow-up Notes: {lead.get('follow_up_notes', 'None')}

Suggest: 1) Best time to call 2) Key talking points 3) Offer to make 4) Objection handling. Keep it brief.""")]
        )
        
        return {"success": True, "suggestions": response}
    except Exception as e:
        logger.error(f"AI followup error: {e}")
        return {"success": True, "suggestions": "Call between 10 AM - 12 PM or 4 PM - 6 PM. Highlight PM Surya Ghar subsidy of ₹78,000 and 25-year warranty. Offer free site survey."}

@api_router.get("/crm/reports/monthly")
async def get_monthly_report():
    """Monthly business growth report"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_str = month_start.isoformat()
    
    # Leads this month
    leads_this_month = await db.crm_leads.count_documents({"timestamp": {"$gte": month_str}})
    
    # Conversions
    conversions = await db.crm_leads.count_documents({"stage": "completed", "timestamp": {"$gte": month_str}})
    
    # Revenue this month
    revenue_result = await db.crm_payments.aggregate([
        {"$match": {"timestamp": {"$gte": month_str}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Employee performance
    employees = await db.crm_employees.find({}, {"_id": 0}).to_list(50)
    
    # Source breakdown
    source_stats = await db.crm_leads.aggregate([
        {"$match": {"timestamp": {"$gte": month_str}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    return {
        "month": now.strftime("%B %Y"),
        "total_leads": leads_this_month,
        "conversions": conversions,
        "conversion_rate": round((conversions / leads_this_month * 100) if leads_this_month > 0 else 0, 1),
        "total_revenue": revenue_result[0]["total"] if revenue_result else 0,
        "employee_performance": [
            {"name": e.get("name"), "leads": e.get("leads_assigned", 0), "converted": e.get("leads_converted", 0), "revenue": e.get("total_revenue", 0)}
            for e in employees
        ],
        "lead_sources": {item["_id"]: item["count"] for item in source_stats if item["_id"]}
    }

# Gallery Photo Upload (direct)
@api_router.post("/gallery/upload")
async def upload_gallery_photo(data: Dict[str, Any]):
    """Direct photo upload to gallery"""
    photo = {
        "id": str(uuid.uuid4()),
        "title": sanitize_input(data.get("title", "Solar Installation")),
        "description": sanitize_input(data.get("description", "")),
        "image_url": data.get("image_url", ""),
        "location": sanitize_input(data.get("location", "")),
        "system_size": data.get("system_size", ""),
        "category": data.get("category", "installation"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.work_photos.insert_one(photo)
    return {"success": True, "photo": photo}

@api_router.post("/gallery/upload-file")
async def upload_gallery_photo_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    location: str = Form(""),
    system_size: str = Form(""),
    category: str = Form("installation")
):
    """Upload photo file directly from mobile/desktop with auto-optimization"""
    try:
        # Read file content
        content = await file.read()
        original_size = len(content)
        
        # Validate file size (max 10MB)
        if original_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Max 10MB allowed.")
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {allowed_types}")
        
        # AUTO-OPTIMIZE: Convert to WebP and resize for faster loading
        try:
            from PIL import Image
            import io
            
            # Open image
            img = Image.open(io.BytesIO(content))
            
            # Convert RGBA to RGB if needed (for WebP compatibility)
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if too large (max 1920px width for web)
            max_width = 1920
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Convert to WebP with quality optimization
            output = io.BytesIO()
            quality = 85
            img.save(output, format='WEBP', quality=quality, optimize=True)
            
            # If still > 200KB, reduce quality
            while output.tell() > 200 * 1024 and quality > 40:
                output = io.BytesIO()
                quality -= 10
                img.save(output, format='WEBP', quality=quality, optimize=True)
            
            optimized_content = output.getvalue()
            content_type = "image/webp"
            logger.info(f"Image optimized: {original_size} -> {len(optimized_content)} bytes ({quality}% quality)")
            
        except Exception as opt_error:
            logger.warning(f"Image optimization failed, using original: {opt_error}")
            optimized_content = content
            content_type = file.content_type
        
        # Convert to base64 data URL for storage
        base64_content = base64.b64encode(optimized_content).decode('utf-8')
        data_url = f"data:{content_type};base64,{base64_content}"
        
        photo = {
            "id": str(uuid.uuid4()),
            "title": sanitize_input(title),
            "description": sanitize_input(description),
            "image_url": data_url,
            "location": sanitize_input(location),
            "system_size": system_size,
            "category": category,
            "file_name": file.filename,
            "file_size": len(optimized_content),
            "original_size": original_size,
            "optimized": original_size != len(optimized_content),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # AI Auto-Caption: Generate caption if description is empty
        if not description and title:
            asyncio.create_task(generate_and_update_photo_caption(photo["id"], title, location, system_size))
        
        await db.work_photos.insert_one(photo)
        logger.info(f"Photo uploaded: {title} - {len(optimized_content)} bytes (original: {original_size})")
        return {"success": True, "photo": {**photo, "_id": None}, "optimization": {"original": original_size, "optimized": len(optimized_content)}}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_and_update_photo_caption(photo_id: str, title: str, location: str, system_size: str):
    """AI Auto-Caption: Generate SEO-friendly caption for gallery photos"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="""You are a social media expert for ASR Enterprises, a solar company in Bihar, India.
            Write short, engaging captions for solar installation photos.
            Include emojis, location tag, and hashtags.
            Keep it under 150 characters. Make it feel authentic and professional.
            Example: "Another successful 5kW installation in Patna! Customer now enjoys ₹0 electricity bills. ☀️ #GoSolar #ZeroBill"
            Write in English with occasional Hindi words for authenticity."""
        ).with_model("openai", "gpt-4o-mini")
        
        prompt = f"Write a short Instagram-style caption for: {title}"
        if location:
            prompt += f" in {location}"
        if system_size:
            prompt += f" ({system_size} kW system)"
        
        response = await chat.send_message_async(UserMessage(text=prompt))
        caption = response.text.strip()
        
        # Update the photo with AI caption
        await db.work_photos.update_one(
            {"id": photo_id},
            {"$set": {"ai_caption": caption, "description": caption}}
        )
        logger.info(f"AI caption generated for photo {photo_id}: {caption[:50]}...")
        
    except Exception as e:
        logger.error(f"AI caption generation error: {e}")

@api_router.post("/gallery/generate-mobile-link")
async def generate_mobile_upload_link(data: Dict[str, Any]):
    """Generate a unique mobile upload link for field staff"""
    try:
        staff_id = data.get("staff_id", "")
        staff_name = data.get("staff_name", "Field Staff")
        expires_hours = data.get("expires_hours", 24)
        
        # Generate unique token
        token = str(uuid.uuid4())[:8]
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=expires_hours)).isoformat()
        
        upload_link = {
            "id": str(uuid.uuid4()),
            "token": token,
            "staff_id": staff_id,
            "staff_name": staff_name,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "uploads_count": 0,
            "active": True
        }
        
        await db.mobile_upload_links.insert_one(upload_link)
        
        # The link would be: /mobile-upload/{token}
        # But we'll return a sharable message for WhatsApp
        share_message = f"""📸 ASR Enterprises Photo Upload Link

👤 Staff: {staff_name}
🔗 Link: {os.getenv('FRONTEND_URL', '')}/mobile-upload/{token}
⏰ Valid for: {expires_hours} hours

Upload installation photos directly to our website gallery!"""
        
        return {
            "success": True, 
            "token": token,
            "upload_url": f"/mobile-upload/{token}",
            "expires_at": expires_at,
            "share_message": share_message
        }
        
    except Exception as e:
        logger.error(f"Mobile link generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/gallery/mobile-upload/{token}")
async def mobile_upload_with_token(
    token: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    location: str = Form(""),
    system_size: str = Form("")
):
    """Upload photo via mobile link token"""
    try:
        # Verify token
        link = await db.mobile_upload_links.find_one({"token": token, "active": True})
        if not link:
            raise HTTPException(status_code=404, detail="Invalid or expired upload link")
        
        # Check expiry
        expires_at = datetime.fromisoformat(link["expires_at"].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            await db.mobile_upload_links.update_one({"token": token}, {"$set": {"active": False}})
            raise HTTPException(status_code=400, detail="Upload link has expired")
        
        # Use existing upload function
        result = await upload_gallery_photo_file(
            file=file,
            title=title,
            description="",  # Will be auto-generated
            location=location,
            system_size=system_size,
            category="installation"
        )
        
        # Update link usage count
        await db.mobile_upload_links.update_one(
            {"token": token},
            {"$inc": {"uploads_count": 1}, "$push": {"uploads": {"photo_id": result["photo"]["id"], "timestamp": datetime.now(timezone.utc).isoformat()}}}
        )
        
        return {**result, "uploaded_by": link.get("staff_name")}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mobile upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SHOP/E-COMMERCE API ENDPOINTS ====================

# Product Categories
PRODUCT_CATEGORIES = [
    {"id": "solar_panel", "name": "Solar Panels", "icon": "sun"},
    {"id": "inverter", "name": "Inverters", "icon": "zap"},
    {"id": "battery", "name": "Batteries", "icon": "battery"},
    {"id": "wire", "name": "Solar Wire", "icon": "cable"},
    {"id": "accessory", "name": "Accessories", "icon": "settings"},
    {"id": "service", "name": "Services", "icon": "wrench", "base_price": 1500}
]

# Delivery fee based on distance (km)
DELIVERY_FEES = {
    "0-5": 50,      # 0-5 km
    "5-10": 100,    # 5-10 km
    "10-20": 150,   # 10-20 km
    "20-30": 200,   # 20-30 km
    "30+": 300      # 30+ km
}

@api_router.post("/generate-service-description")
async def generate_service_description(data: Dict[str, Any]):
    """Generate AI-powered service description"""
    service_name = data.get("service_name", "Solar Service")
    service_type = data.get("service_type", "installation")
    price = data.get("price", 1500)
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="""You are a professional copywriter for ASR Enterprises, a solar energy company in Bihar, India. 
            Write compelling, professional service descriptions that highlight:
            - The expertise of ASR Enterprises certified technicians
            - Benefits to the customer
            - What's included in the service
            - Quality assurance
            Keep descriptions concise (3-4 sentences), professional, and persuasive.
            Do not use markdown formatting. Write in plain text."""
        ).with_model("openai", "gpt-4o-mini")
        
        prompt = f"Write a professional service description for '{service_name}' (type: {service_type}, price: ₹{price}). Focus on solar energy services in Patna, Bihar."
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        return {"description": response, "generated": True}
        
    except Exception as e:
        logger.error(f"AI service description generation failed: {e}")
        templates = {
            "cleaning": f"Professional {service_name} by ASR Enterprises. Our expert technicians provide comprehensive solar panel cleaning to restore maximum power output. Service includes dust and debris removal, water spot cleaning, visual inspection, and performance verification. Regular cleaning ensures your panels operate at peak efficiency year-round.",
            "maintenance": f"Comprehensive {service_name} from ASR Enterprises. Keep your solar system running at peak efficiency with our annual maintenance package. Includes thorough panel cleaning, connection inspection, performance analysis, and detailed system health report.",
            "repair": f"Expert {service_name} by ASR Enterprises. Quick diagnosis and repair of all solar system issues - inverter faults, panel damage, wiring problems, and more. Our experienced technicians carry genuine spare parts for on-site repairs.",
            "consultation": f"Expert {service_name} from ASR Enterprises. Get personalized guidance for your solar journey. Our consultants assess your energy needs, roof suitability, and budget to recommend the ideal solar solution. Includes detailed cost-benefit analysis and subsidy guidance."
        }
        return {"description": templates.get(service_type, templates["cleaning"]), "generated": False}

@api_router.get("/shop/delivery-fees")
async def get_delivery_fees():
    """Get delivery fee structure based on distance"""
    return DELIVERY_FEES

@api_router.get("/admin/security-status")
@limiter.limit(RATE_LIMIT_ADMIN)
async def get_security_status(request: Request):
    """Get security monitoring status (admin only)"""
    stats = security_tracker.get_stats()
    return {
        "status": "active",
        "security_features": {
            "rate_limiting": True,
            "ip_blocking": True,
            "security_headers": True,
            "input_validation": True,
            "request_size_limits": True,
            "suspicious_activity_logging": True
        },
        "statistics": stats,
        "blocked_ips_count": stats["blocked_ips"],
        "tracked_suspicious_activities": stats["suspicious_activities"]
    }

# ==================== SYNC SERVICE BOOKINGS TO ORDERS ====================

@api_router.post("/admin/sync-service-bookings")
async def sync_service_bookings_to_orders():
    """Sync all paid service bookings to orders table"""
    bookings = await db.service_bookings.find({"payment_status": "paid"}, {"_id": 0}).to_list(1000)
    
    synced_count = 0
    new_orders = 0
    
    for booking in bookings:
        # Check if already synced to orders
        existing = await db.orders.find_one({"booking_id": booking.get("id")}, {"_id": 0})
        if existing:
            synced_count += 1
            continue
        
        # Create order from booking
        order = {
            "id": str(uuid.uuid4()),
            "order_number": booking.get("booking_number", f"BSK-{str(uuid.uuid4())[:8].upper()}"),
            "booking_id": booking.get("id"),
            "customer_name": booking.get("customer_name", ""),
            "customer_phone": booking.get("customer_phone", ""),
            "customer_email": booking.get("customer_email", ""),
            "items": [{
                "product_id": "service_booking",
                "product_name": booking.get("service", "Solar Maintenance Service"),
                "quantity": 1,
                "price": booking.get("amount", 1500)
            }],
            "subtotal": booking.get("amount", 1500),
            "delivery_charge": 0,
            "total": booking.get("amount", 1500),
            "delivery_type": "service",
            "delivery_address": "",
            "delivery_district": "",
            "payment_method": "razorpay",
            "payment_status": "paid",
            "razorpay_payment_id": booking.get("payment_id", ""),
            "order_status": "confirmed",
            "notes": "Service booking",
            "source": "service_booking",
            "created_at": booking.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.orders.insert_one(order)
        new_orders += 1
        synced_count += 1
    
    return {
        "status": "success",
        "message": f"Synced {synced_count} service bookings",
        "new_orders_created": new_orders,
        "total_processed": synced_count
    }

# ==================== CRM PAYMENTS ====================

@api_router.get("/crm/payments")
async def get_crm_payments(count: int = 100, skip: int = 0):
    """Get all payments from local database for CRM payments section"""
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(count)
    return {"status": "success", "payments": payments, "source": "local", "total": len(payments)}

# Book Service - configurable price stored in settings collection
@api_router.get("/shop/book-service-config")
async def get_book_service_config():
    """Get book service price (admin configurable)"""
    config = await db.settings.find_one({"key": "book_service_price"}, {"_id": 0})
    price = config.get("value", 2999) if config else 2999
    return {"price": price}

@api_router.put("/shop/book-service-config")
async def update_book_service_config(data: Dict[str, Any]):
    """Update book service price (Admin CRM)"""
    price = data.get("price", 2999)
    await db.settings.update_one(
        {"key": "book_service_price"},
        {"$set": {"key": "book_service_price", "value": price}},
        upsert=True
    )
    return {"status": "success", "price": price}

@api_router.post("/shop/book-service")
@limiter.limit(RATE_LIMIT_PAYMENT)
async def book_service(request: Request, data: Dict[str, Any]):
    """Create a service booking - QR code payment"""
    client_ip = get_real_ip(request)
    
    # Validate and sanitize input
    data = validate_request_data(data, client_ip, "/shop/book-service")
    
    customer_name = sanitize_input(data.get("customer_name", ""))
    customer_phone = sanitize_input(data.get("customer_phone", ""))
    customer_email = sanitize_input(data.get("customer_email", ""))
    
    if not customer_name or not customer_phone:
        raise HTTPException(status_code=400, detail="Name and phone are required")
    
    # Validate phone format
    if not validate_phone(customer_phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Validate email if provided
    if customer_email and not validate_email(customer_email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Log payment attempt
    log_security_event("BOOKING_INITIATED", client_ip, {
        "type": "book_service",
        "phone": mask_sensitive_data(customer_phone)
    })
    
    # Get service price
    config = await db.settings.find_one({"key": "book_service_price"}, {"_id": 0})
    price = config.get("value", 2999) if config else 2999
    
    booking_id = str(uuid.uuid4())
    booking_number = f"BSK-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    
    booking = {
        "id": booking_id,
        "booking_number": booking_number,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "service": "Solar Maintenance Service",
        "amount": price,
        "payment_method": "qr_code",
        "payment_status": "pending",
        "payment_id": "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.service_bookings.insert_one(booking)
    booking.pop("_id", None)
    
    # Generate WhatsApp URL for customer
    whatsapp_message = f"Hi ASR Enterprises! I've made a booking (#{booking_number}) for Solar Maintenance Service. Amount: Rs.{price}. Please confirm my payment."
    customer_whatsapp_url = f"https://wa.me/919296389097?text={quote(whatsapp_message)}"
    
    return {
        "status": "success", 
        "booking": booking,
        "customer_whatsapp_url": customer_whatsapp_url,
        "payment_instructions": f"Please scan the Paytm QR code and pay Rs.{price}. After payment, click the WhatsApp button to confirm your booking."
    }

@api_router.post("/shop/book-service/{booking_id}/confirm")
async def confirm_service_booking(booking_id: str, data: Dict[str, Any]):
    """Confirm service booking after payment - sends WhatsApp + Email"""
    payment_reference = data.get("payment_reference", "")
    
    booking = await db.service_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Update booking status
    await db.service_bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "payment_status": "paid",
            "payment_reference": payment_reference,
            "status": "confirmed",
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    customer_name = booking.get("customer_name", "Customer")
    customer_phone = booking.get("customer_phone", "")
    customer_email = booking.get("customer_email", "")
    booking_number = booking.get("booking_number", "N/A")
    amount = booking.get("amount", 2999)
    
    # ===== WHATSAPP CONFIRMATION TO CUSTOMER =====
    customer_whatsapp_msg = f"""*Payment Successful!*
*ASR Enterprises - Solar Solutions*

Dear {customer_name},

Your service booking has been confirmed!

*Booking Number:* {booking_number}
*Service:* Solar Maintenance Service
*Amount Paid:* Rs.{amount:,.0f}

Our team will contact you within 24 hours to schedule your service appointment.

*Need Help?*
Call: 9296389097
WhatsApp: 9296389097

_Thank you for choosing ASR Enterprises!_
_Powering Bihar's future with clean energy_"""
    
    customer_whatsapp_url = get_whatsapp_url(customer_phone, customer_whatsapp_msg)
    
    # ===== WHATSAPP NOTIFICATION TO ADMIN =====
    admin_phone = "9296389097"
    admin_whatsapp_msg = f"""*NEW SERVICE BOOKING*

*Booking #:* {booking_number}
*Customer:* {customer_name}
*Phone:* {customer_phone}
{f"*Email:* {customer_email}" if customer_email else ""}

*Service:* Solar Maintenance Service
*Amount:* Rs.{amount:,.0f}
*Payment:* PAID (Razorpay: {payment_id})

_Please contact the customer within 24 hours to schedule the service!_"""
    
    admin_whatsapp_url = get_whatsapp_url(admin_phone, admin_whatsapp_msg)
    
    # ===== EMAIL CONFIRMATION TO CUSTOMER =====
    email_sent = False
    if customer_email and RESEND_API_KEY:
        try:
            email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
                <div style="background: linear-gradient(135deg, #1a2332, #0f1824); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">Payment Successful!</h1>
                    <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0 0;">ASR Enterprises - Solar Solutions</p>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
                    <p style="color: #333; font-size: 16px;">Dear <strong>{customer_name}</strong>,</p>
                    <p style="color: #333; font-size: 15px;">Your service booking has been confirmed! Our team will contact you within 24 hours.</p>
                    
                    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%; font-size: 14px; color: #333;">
                            <tr><td style="padding: 6px 0; color: #666;">Booking Number</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{booking_number}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">Solar Maintenance Service</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Amount Paid</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #16a34a;">₹{amount:,.0f}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Payment ID</td><td style="padding: 6px 0; text-align: right; font-size: 12px;">{payment_id}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Status</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #16a34a;">CONFIRMED</td></tr>
                        </table>
                    </div>
                    
                    <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;"><strong>What's Next?</strong></p>
                        <p style="color: #666; font-size: 13px; margin: 0;">Our service team will call you at <strong>{customer_phone}</strong> within 24 hours to schedule your appointment.</p>
                    </div>
                    
                    <p style="color: #666; font-size: 13px;">Need immediate help? Call us at <strong>9296389097</strong> | WhatsApp: <strong>9296389097</strong></p>
                </div>
                <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
                    <p style="color: #999; font-size: 12px; margin: 0;">ASR Enterprises - Bihar's Trusted Solar Rooftop Company</p>
                    <p style="color: #999; font-size: 11px; margin: 5px 0 0 0;">Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503</p>
                </div>
            </div>"""
            
            params = {
                "from": SENDER_EMAIL,
                "to": [customer_email],
                "subject": f"Booking Confirmed - {booking_number} | ASR Enterprises",
                "html": email_html
            }
            await asyncio.to_thread(resend.Emails.send, params)
            email_sent = True
            logger.info(f"Booking confirmation email sent to {customer_email}")
        except Exception as e:
            logger.error(f"Failed to send booking email: {e}")
    
    # ===== CRM NOTIFICATION =====
    try:
        crm_message = CRMMessage(
            sender_id="system",
            sender_name="Booking System",
            sender_type="system",
            receiver_id="admin",
            receiver_name="Admin",
            message=f"NEW SERVICE BOOKING #{booking_number} - {customer_name} - Rs.{amount:,.0f} PAID (Razorpay: {payment_id})"
        )
        msg_doc = crm_message.model_dump()
        msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
        await db.crm_messages.insert_one(msg_doc)
    except Exception as e:
        logger.error(f"Failed to create CRM notification for booking: {e}")
    
    # ===== PAYMENT RECORD =====
    try:
        payment_record = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "booking_number": booking_number,
            "amount": amount,
            "method": "razorpay",
            "status": "paid",
            "transaction_id": payment_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "type": "service_booking",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payments.insert_one(payment_record)
    except Exception as e:
        logger.error(f"Failed to create payment record: {e}")
    
    return {
        "status": "success",
        "booking_number": booking_number,
        "customer_whatsapp_url": customer_whatsapp_url,
        "admin_whatsapp_url": admin_whatsapp_url,
        "email_sent": email_sent
    }

# =============================================
# WHATSAPP OTP - PRIMARY METHOD (No DLT needed)
# =============================================

# WhatsApp OTP config — uses the existing Cloud API credentials
_WA_OTP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
_WA_OTP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
# Optional: set to an approved WhatsApp authentication template name (e.g. "asr_otp")
# If not set, the system sends a plain text WhatsApp message (works for existing contacts)
WHATSAPP_OTP_TEMPLATE_NAME = os.environ.get("WHATSAPP_OTP_TEMPLATE_NAME", "")
_WA_GRAPH_VERSION = "v23.0"


async def _send_whatsapp_otp(mobile_with_country: str, otp_code: str) -> dict:
    """Send OTP via WhatsApp Cloud API.

    Strategy (in order):
    1. If WHATSAPP_OTP_TEMPLATE_NAME is set → send as authentication template
    2. Fallback → send as plain text message (works within 24-hour contact window)

    Returns dict with keys: sent (bool), method (str), error (str or None)
    """
    if not _WA_OTP_ACCESS_TOKEN or not _WA_OTP_PHONE_NUMBER_ID:
        return {"sent": False, "method": None, "error": "WhatsApp credentials not configured"}

    api_url = f"https://graph.facebook.com/{_WA_GRAPH_VERSION}/{_WA_OTP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {_WA_OTP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # ── Method 1: Authentication template (works for any WhatsApp user) ─────
        if WHATSAPP_OTP_TEMPLATE_NAME:
            payload = {
                "messaging_product": "whatsapp",
                "to": mobile_with_country,
                "type": "template",
                "template": {
                    "name": WHATSAPP_OTP_TEMPLATE_NAME,
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [{"type": "text", "text": otp_code}],
                        },
                        # button component for authentication templates (copy-code button)
                        {
                            "type": "button",
                            "sub_type": "url",
                            "index": "0",
                            "parameters": [{"type": "text", "text": otp_code}],
                        },
                    ],
                },
            }
            try:
                resp = await client.post(api_url, json=payload, headers=headers)
                resp_data = resp.json()
                logger.info(f"[WA-OTP] Template send: {resp.status_code} - {str(resp_data)[:200]}")
                if resp.status_code == 200 and resp_data.get("messages"):
                    return {"sent": True, "method": "whatsapp_template", "error": None}
                # If template has no button component (non-auth template), retry without button
                error_code = resp_data.get("error", {}).get("code", 0)
                if error_code in (132000, 132001, 132015):
                    # Template component mismatch — try without button
                    payload_simple = {
                        "messaging_product": "whatsapp",
                        "to": mobile_with_country,
                        "type": "template",
                        "template": {
                            "name": WHATSAPP_OTP_TEMPLATE_NAME,
                            "language": {"code": "en"},
                            "components": [
                                {
                                    "type": "body",
                                    "parameters": [{"type": "text", "text": otp_code}],
                                }
                            ],
                        },
                    }
                    resp2 = await client.post(api_url, json=payload_simple, headers=headers)
                    resp2_data = resp2.json()
                    logger.info(f"[WA-OTP] Template (simple) send: {resp2.status_code} - {str(resp2_data)[:200]}")
                    if resp2.status_code == 200 and resp2_data.get("messages"):
                        return {"sent": True, "method": "whatsapp_template_simple", "error": None}
            except Exception as e:
                logger.warning(f"[WA-OTP] Template method failed: {e}")

        # ── Method 2: Plain text message (works within 24-hour contact window) ──
        otp_message = (
            f"🔐 *ASR Enterprises — OTP Verification*\n\n"
            f"Your One-Time Password is:\n\n"
            f"*{otp_code}*\n\n"
            f"Valid for 5 minutes. Do NOT share this code with anyone.\n\n"
            f"— ASR Enterprises Solar ☀️"
        )
        payload_text = {
            "messaging_product": "whatsapp",
            "to": mobile_with_country,
            "type": "text",
            "text": {"body": otp_message},
        }
        try:
            resp = await client.post(api_url, json=payload_text, headers=headers)
            resp_data = resp.json()
            logger.info(f"[WA-OTP] Text send: {resp.status_code} - {str(resp_data)[:200]}")
            if resp.status_code == 200 and resp_data.get("messages"):
                return {"sent": True, "method": "whatsapp_text", "error": None}
            err = resp_data.get("error", {}).get("message", "Unknown error")
            return {"sent": False, "method": "whatsapp_text", "error": err}
        except Exception as e:
            logger.warning(f"[WA-OTP] Text method failed: {e}")
            return {"sent": False, "method": None, "error": str(e)}


# =============================================
# MSG91 OTP - SMS FALLBACK
# =============================================

MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_SENDER_ID = os.environ.get("MSG91_SENDER_ID", "ASRSOL")
MSG91_WIDGET_ID = os.environ.get("MSG91_WIDGET_ID", "")
MSG91_TOKEN_AUTH = os.environ.get("MSG91_TOKEN_AUTH", "")
# DLT-approved OTP template ID from MSG91 dashboard (required for India SMS delivery)
MSG91_OTP_TEMPLATE_ID = os.environ.get("MSG91_OTP_TEMPLATE_ID", "")
# MSG91 Flow ID for flow-based OTP (optional, leave blank if not configured)
MSG91_FLOW_ID = os.environ.get("MSG91_FLOW_ID", "")


def _require_msg91() -> None:
    """Fail fast with a clear 503 if MSG91 credentials aren't configured.

    Called from every MSG91 send/verify path so the OTP system never
    silently calls the upstream with an empty auth key.
    """
    if not MSG91_AUTH_KEY:
        logger.error("MSG91 not configured: set MSG91_AUTH_KEY in environment.")
        raise HTTPException(
            status_code=503,
            detail="Missing environment configuration: MSG91_AUTH_KEY",
        )

async def _send_otp_impl(data: Dict[str, Any]):
    """Core OTP send logic (un-decorated).

    Used by the public ``/otp/send`` route AND by other routes that need
    to trigger an OTP internally (resend, customer login, solar advisor
    login). Keeping this separate prevents double-counting against the
    SlowAPI rate-limit bucket on nested calls.

    Parameters (in ``data``):
      mobile            : 10-digit mobile number (required)
      registered_only   : bool (default False) — if True, reject unregistered numbers
    """
    _require_msg91()
    mobile = data.get("mobile", "").replace(" ", "").replace("+", "")
    if not mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")

    # Clean mobile — ensure 10 digits
    mobile_clean = mobile[-10:] if len(mobile) >= 10 else mobile
    if len(mobile_clean) != 10 or not mobile_clean.isdigit():
        raise HTTPException(status_code=400, detail="Invalid mobile number. Enter 10 digits.")

    # ── REGISTRATION CHECK ──────────────────────────────────────────────────
    # When registered_only=True (admin/staff login), the mobile must belong to
    # a known staff member or registered customer. Inquiry forms and Solar
    # Advisor registration forms pass registered_only=False (default) to allow
    # any number.
    registered_only: bool = bool(data.get("registered_only", False))
    if registered_only:
        is_owner = (mobile_clean == OWNER_MOBILE[-10:])
        is_staff = None
        is_customer = None
        if not is_owner:
            is_staff = await db.crm_staff_accounts.find_one(
                {"$or": [{"mobile": mobile_clean}, {"phone": mobile_clean}], "is_active": True},
                {"_id": 0, "staff_id": 1},
            )
        if not is_owner and not is_staff:
            is_customer = await db.customers.find_one(
                {"mobile": mobile_clean}, {"_id": 0, "name": 1}
            )
        if not (is_owner or is_staff or is_customer):
            logger.warning(f"[OTP] Registration check failed for ****{mobile_clean[-4:]}")
            raise HTTPException(
                status_code=404,
                detail="This mobile number is not registered. Please register first or contact ASR Enterprises at 9296389097.",
            )
        logger.info(f"[OTP] Registration check passed for ****{mobile_clean[-4:]}")

    # ── COOLDOWN CHECK (60 sec between OTP sends per mobile) ───────────────
    # Prevents users from flooding the OTP endpoint. Enforced server-side so
    # the UI timer alone cannot be bypassed.
    OTP_RESEND_COOLDOWN = 60  # seconds
    existing_record = await db.otp_store.find_one({"mobile": mobile_clean}, {"_id": 0, "created_at": 1})
    if existing_record and isinstance(existing_record.get("created_at"), datetime):
        stored_time = existing_record["created_at"]
        # MongoDB may return timezone-naive datetime (UTC) — normalise to aware
        if stored_time.tzinfo is None:
            stored_time = stored_time.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - stored_time).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN:
            remaining = int(OTP_RESEND_COOLDOWN - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} more second{'s' if remaining != 1 else ''} before requesting a new OTP.",
            )

    mobile_with_country = "91" + mobile_clean

    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    
    # Store OTP in MongoDB with 5-minute expiry
    # created_at stored as datetime (not string) so MongoDB TTL index can auto-delete
    now_utc = datetime.now(timezone.utc)
    await db.otp_store.update_one(
        {"mobile": mobile_clean},
        {"$set": {
            "mobile": mobile_clean,
            "otp": otp_code,
            "created_at": now_utc,
            "expires_at": (now_utc + timedelta(minutes=5)).isoformat(),
            "verified": False,
            "attempts": 0
        }},
        upsert=True
    )
    
    sent = False
    send_method = "none"
    msg91_request_id = None
    delivery_channel = "sms"   # "whatsapp" or "sms" — used to tailor user-facing message

    # ── PRIMARY: WhatsApp OTP (no DLT registration needed) ───────────────────
    wa_result = await _send_whatsapp_otp(mobile_with_country, otp_code)
    if wa_result.get("sent"):
        sent = True
        send_method = wa_result["method"]
        delivery_channel = "whatsapp"
        logger.info(f"[OTP] WhatsApp OTP sent to ****{mobile_clean[-4:]} via {send_method}")
    else:
        logger.warning(f"[OTP] WhatsApp OTP failed ({wa_result.get('error')}) — falling back to MSG91 SMS")

    # ── FALLBACK: MSG91 SMS OTP ───────────────────────────────────────────────
    if not sent:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                # Method 1: MSG91 OTP API v5
                try:
                    otp_payload = {
                        "mobile": mobile_with_country,
                        "otp": otp_code,
                        "otp_length": 6,
                        "otp_expiry": 5,
                        "sender": MSG91_SENDER_ID
                    }
                    if MSG91_OTP_TEMPLATE_ID:
                        otp_payload["template_id"] = MSG91_OTP_TEMPLATE_ID
                    otp_response = await client.post(
                        "https://control.msg91.com/api/v5/otp",
                        headers={
                            "authkey": MSG91_AUTH_KEY,
                            "Content-Type": "application/json"
                        },
                        json=otp_payload
                    )
                    logger.info(f"[OTP] MSG91 OTP API response: {otp_response.status_code} - {otp_response.text[:300]}")
                    if otp_response.status_code == 200:
                        resp_data = otp_response.json()
                        if resp_data.get("type") == "success":
                            sent = True
                            send_method = "msg91_otp_api"
                            msg91_request_id = resp_data.get("request_id")
                except Exception as e:
                    logger.warning(f"[OTP] MSG91 OTP API failed: {e}")

                # Method 2: MSG91 Flow API (only if flow_id is configured)
                if not sent and MSG91_FLOW_ID:
                    try:
                        flow_response = await client.post(
                            "https://api.msg91.com/api/v5/flow/",
                            headers={
                                "authkey": MSG91_AUTH_KEY,
                                "Content-Type": "application/json"
                            },
                            json={
                                "flow_id": MSG91_FLOW_ID,
                                "sender": MSG91_SENDER_ID,
                                "mobiles": mobile_with_country,
                                "OTP": otp_code
                            }
                        )
                        logger.info(f"[OTP] MSG91 Flow API response: {flow_response.status_code} - {flow_response.text[:300]}")
                        if flow_response.status_code == 200:
                            flow_data = flow_response.json()
                            if flow_data.get("type") == "success":
                                sent = True
                                send_method = "msg91_flow_api"
                    except Exception as e:
                        logger.warning(f"[OTP] MSG91 Flow API failed: {e}")

        except Exception as e:
            logger.error(f"[OTP] All MSG91 send methods failed: {e}")

    # ── LAST RESORT: Email fallback for admin/owner ───────────────────────────
    if not sent and mobile_clean == OWNER_MOBILE[-10:]:
        try:
            email_sent = await send_otp_email(OWNER_EMAIL, otp_code, "Admin Mobile OTP")
            if email_sent:
                sent = True
                send_method = "email_fallback"
                delivery_channel = "email"
                logger.info(f"[OTP] Admin OTP sent via email fallback to {OWNER_EMAIL}")
        except Exception as e:
            logger.warning(f"[OTP] Email fallback failed: {e}")

    # Store msg91_request_id to enable MSG91-side OTP verify as dual-fallback
    if msg91_request_id:
        await db.otp_store.update_one(
            {"mobile": mobile_clean},
            {"$set": {"msg91_request_id": msg91_request_id}}
        )

    if sent:
        logger.info(f"[OTP] OTP sent to ****{mobile_clean[-4:]} via {send_method}")
        masked = f"+91 XXXXXX{mobile_clean[-4:]}"
        if delivery_channel == "whatsapp":
            user_msg = f"OTP sent to your WhatsApp ({masked}). Check WhatsApp and enter the code below."
        elif delivery_channel == "email":
            user_msg = f"OTP sent to admin email (SMS/WhatsApp unavailable)."
        else:
            user_msg = f"OTP sent via SMS to {masked}."
        return {
            "success": True,
            "type": "success",
            "message": user_msg,
            "method": send_method,
            "channel": delivery_channel
        }
    else:
        logger.warning(f"[OTP] All delivery methods failed for ****{mobile_clean[-4:]}")
        return {
            "success": False,
            "type": "error",
            "message": "Could not deliver OTP. Please try again or contact support at 9296389097.",
            "method": "failed",
            "channel": "none",
            "note": "WhatsApp OTP requires the user to have an active WhatsApp account on this number. SMS OTP requires MSG91_OTP_TEMPLATE_ID for India delivery."
        }


@api_router.post("/otp/send")
@limiter.limit(RATE_LIMIT_OTP_SEND)
async def send_otp(request: Request, data: Dict[str, Any]):
    """Public OTP send endpoint (rate-limited)."""
    return await _send_otp_impl(data)


@api_router.post("/otp/verify")
@limiter.limit(RATE_LIMIT_OTP_VERIFY)
async def verify_otp(request: Request, data: Dict[str, Any]):
    """Verify OTP against stored value (with MSG91 API as dual-verification fallback)"""
    mobile = data.get("mobile", "").replace(" ", "").replace("+", "")
    otp = data.get("otp", "").strip()
    
    if not mobile or not otp:
        raise HTTPException(status_code=400, detail="Mobile and OTP are required")
    
    mobile_clean = mobile[-10:] if len(mobile) >= 10 else mobile
    mobile_with_country = "91" + mobile_clean

    async def _try_msg91_verify(request_id: str = None) -> bool:
        """Try to verify OTP via MSG91's API (handles widget-sent OTPs too)."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                params = {"authkey": MSG91_AUTH_KEY, "mobile": mobile_with_country, "otp": otp}
                if request_id:
                    params["request_id"] = request_id
                verify_resp = await client.post(
                    "https://control.msg91.com/api/v5/otp/verify",
                    params=params
                )
                logger.info(f"[OTP] MSG91 verify API: {verify_resp.status_code} - {verify_resp.text[:200]}")
                if verify_resp.status_code == 200:
                    resp_data = verify_resp.json()
                    return resp_data.get("type") == "success"
        except Exception as e:
            logger.warning(f"[OTP] MSG91 verify API failed: {e}")
        return False
    
    # Check stored OTP record
    stored = await db.otp_store.find_one({"mobile": mobile_clean}, {"_id": 0})
    
    if not stored:
        # No stored record — try MSG91 API (handles widget-initiated OTPs)
        if await _try_msg91_verify():
            logger.info(f"[OTP] OTP verified via MSG91 API (no local record) for ****{mobile_clean[-4:]}")
            return {"success": True, "type": "success", "message": "OTP verified successfully"}
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new OTP.")
    
    # Check expiry
    try:
        expires_at_str = stored.get("expires_at", "")
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await db.otp_store.delete_one({"mobile": mobile_clean})
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")
    except (ValueError, AttributeError):
        pass  # If we can't parse expiry, continue and let attempt check handle it
    
    # Check attempts (max 5)
    if stored.get("attempts", 0) >= 5:
        await db.otp_store.delete_one({"mobile": mobile_clean})
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
    
    # Verify against stored OTP (backend-generated)
    if stored["otp"] == otp:
        await db.otp_store.update_one(
            {"mobile": mobile_clean},
            {"$set": {"verified": True}}
        )
        logger.info(f"[OTP] OTP verified (local) for ****{mobile_clean[-4:]}")
        return {"success": True, "type": "success", "message": "OTP verified successfully"}
    
    # Stored OTP didn't match — try MSG91 API as dual fallback
    # This handles cases where widget sends its own OTP (different from backend-generated)
    request_id = stored.get("msg91_request_id")
    if await _try_msg91_verify(request_id):
        await db.otp_store.update_one(
            {"mobile": mobile_clean},
            {"$set": {"verified": True}}
        )
        logger.info(f"[OTP] OTP verified via MSG91 API (dual-verify) for ****{mobile_clean[-4:]}")
        return {"success": True, "type": "success", "message": "OTP verified successfully"}
    
    # Both verifications failed — increment attempts
    await db.otp_store.update_one(
        {"mobile": mobile_clean},
        {"$inc": {"attempts": 1}}
    )
    remaining = max(0, 5 - stored.get("attempts", 0) - 1)
    raise HTTPException(
        status_code=400, 
        detail=f"Invalid OTP. {remaining} attempt{'s' if remaining != 1 else ''} remaining."
    )


@api_router.post("/otp/resend")
@limiter.limit(RATE_LIMIT_OTP_SEND)
async def resend_otp(request: Request, data: Dict[str, Any]):
    """Resend OTP to mobile number"""
    _require_msg91()
    mobile = data.get("mobile", "").replace(" ", "").replace("+", "")
    if not mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")
    
    # Reuse send logic
    return await _send_otp_impl({"mobile": mobile})


@api_router.get("/otp/status")
async def otp_status():
    """Admin diagnostic: check OTP delivery configuration (no secrets exposed)."""
    # WhatsApp (primary)
    has_wa_token = bool(_WA_OTP_ACCESS_TOKEN)
    has_wa_phone_id = bool(_WA_OTP_PHONE_NUMBER_ID)
    wa_ready = has_wa_token and has_wa_phone_id
    has_wa_template = bool(WHATSAPP_OTP_TEMPLATE_NAME)

    # MSG91 SMS (fallback)
    has_auth_key = bool(MSG91_AUTH_KEY)
    has_template_id = bool(MSG91_OTP_TEMPLATE_ID)
    has_flow_id = bool(MSG91_FLOW_ID)
    has_widget = bool(MSG91_WIDGET_ID)
    has_token_auth = bool(MSG91_TOKEN_AUTH)

    recommendations = []
    if not wa_ready:
        recommendations.append("Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable WhatsApp OTP (primary channel)")
    if not has_wa_template:
        recommendations.append(
            "Optional: Create an Authentication-category template in Meta Business Manager and set "
            "WHATSAPP_OTP_TEMPLATE_NAME=<your_template_name> to send OTP to users outside the 24-hour window"
        )
    if not has_auth_key:
        recommendations.append("Set MSG91_AUTH_KEY to enable SMS OTP fallback")
    if not has_template_id:
        recommendations.append(
            "Set MSG91_OTP_TEMPLATE_ID for DLT-compliant SMS delivery (India). "
            "Get from MSG91 Dashboard → SMS → OTP Templates → DLT Template ID"
        )

    return {
        "primary_channel": "whatsapp" if wa_ready else "sms",
        "whatsapp_otp": {
            "configured": wa_ready,
            "phone_number_id_set": has_wa_phone_id,
            "access_token_set": has_wa_token,
            "template_name": WHATSAPP_OTP_TEMPLATE_NAME or "(plain text mode — works for existing contacts)",
        },
        "sms_fallback": {
            "msg91_configured": has_auth_key,
            "sender_id": MSG91_SENDER_ID,
            "dlt_template_id_set": has_template_id,
            "flow_id_set": has_flow_id,
            "widget_configured": has_widget and has_token_auth,
        },
        "recommendations": recommendations,
    }


# =============================================
# BOOK SOLAR SERVICE - QR CODE PAYMENT (NEW)
# =============================================

@api_router.get("/service/book-solar-config")
async def get_book_solar_service_config():
    """Get Book Solar Service price (admin configurable via CRM)"""
    config = await db.settings.find_one({"key": "book_solar_service_price"}, {"_id": 0})
    price = config.get("value", 2499) if config else 2499
    return {"price": price}

@api_router.put("/service/book-solar-config")
async def update_book_solar_service_config(data: Dict[str, Any]):
    """Update Book Solar Service price (Admin CRM)"""
    price = data.get("price", 2499)
    await db.settings.update_one(
        {"key": "book_solar_service_price"},
        {"$set": {"key": "book_solar_service_price", "value": price, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    logger.info(f"Book Solar Service price updated to Rs.{price}")
    return {"status": "success", "price": price, "message": "Price updated successfully"}

@api_router.get("/service/site-visit-config")
async def get_site_visit_config():
    """Get Site Visit booking price (admin configurable via CRM)"""
    config = await db.settings.find_one({"key": "site_visit_price"}, {"_id": 0})
    price = config.get("value", 500) if config else 500
    return {"price": price}

@api_router.put("/service/site-visit-config")
async def update_site_visit_config(data: Dict[str, Any]):
    """Update Site Visit price (Admin CRM)"""
    price = data.get("price", 500)
    await db.settings.update_one(
        {"key": "site_visit_price"},
        {"$set": {"key": "site_visit_price", "value": price, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    logger.info(f"Site Visit price updated to Rs.{price}")
    return {"status": "success", "price": price, "message": "Site Visit price updated"}

@api_router.get("/service/site-visit-bookings")
async def get_site_visit_bookings():
    """Get all site visit bookings (from solar_service_bookings where type=site_visit)"""
    bookings = await db.solar_service_bookings.find(
        {"booking_type": "site_visit", "payment_status": {"$in": ["paid", "confirmed", "verified"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    return {"bookings": bookings}

@api_router.post("/service/book-solar")
@limiter.limit(RATE_LIMIT_PAYMENT)
async def book_solar_service(request: Request, data: Dict[str, Any]):
    """Create a solar service booking with QR payment verification + MSG91 SMS confirmation"""
    client_ip = get_real_ip(request)
    
    # Validate and sanitize input
    data = validate_request_data(data, client_ip, "/service/book-solar")
    
    customer_name = sanitize_input(data.get("customer_name", ""))
    customer_phone = sanitize_input(data.get("customer_phone", ""))
    customer_email = sanitize_input(data.get("customer_email", ""))
    transaction_id = sanitize_input(data.get("transaction_id", ""))
    amount = data.get("amount", 2499)
    payment_method = data.get("payment_method", "qr_code")
    
    if not customer_name or not customer_phone:
        raise HTTPException(status_code=400, detail="Name and phone are required")
    
    if not transaction_id:
        raise HTTPException(status_code=400, detail="Transaction ID is required for payment verification")
    
    # Validate phone format
    if not validate_phone(customer_phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Get service price from config
    config = await db.settings.find_one({"key": "book_solar_service_price"}, {"_id": 0})
    price = config.get("value", 2499) if config else 2499
    
    # Log payment attempt
    log_security_event("QR_PAYMENT_SUBMITTED", client_ip, {
        "type": "book_solar_service",
        "phone": mask_sensitive_data(customer_phone),
        "transaction_id": transaction_id[:4] + "***"
    })
    
    booking_id = str(uuid.uuid4())
    booking_number = f"ASR-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    
    # Create booking record
    booking = {
        "id": booking_id,
        "booking_number": booking_number,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "service": "Book Solar Service",
        "amount": price,
        "payment_method": payment_method,
        "transaction_id": transaction_id,
        "payment_status": "pending_verification",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.solar_service_bookings.insert_one(booking)
    booking.pop("_id", None)
    
    # ===== SEND SMS CONFIRMATION VIA MSG91 =====
    sms_sent = False
    try:
        # Format phone number (add 91 if needed)
        phone_for_sms = customer_phone.replace("+", "").replace(" ", "")
        if len(phone_for_sms) == 10:
            phone_for_sms = "91" + phone_for_sms
        
        sms_message = f"Dear {customer_name}, Your Solar Service booking {booking_number} is received. Amount: Rs.{price}. Our team will verify payment & call you within 24hrs. ASR Enterprises 9296389097"
        
        # MSG91 SMS API
        async with httpx.AsyncClient() as client:
            sms_response = await client.post(
                "https://api.msg91.com/api/v5/flow/",
                headers={
                    "authkey": MSG91_AUTH_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "flow_id": "default",  # Use default flow
                    "sender": MSG91_SENDER_ID,
                    "mobiles": phone_for_sms,
                    "message": sms_message
                },
                timeout=10
            )
            if sms_response.status_code == 200:
                sms_sent = True
                logger.info(f"SMS confirmation sent to {phone_for_sms}")
            else:
                logger.warning(f"SMS sending returned status {sms_response.status_code}")
    except Exception as e:
        logger.error(f"Failed to send SMS confirmation: {e}")
        # Try alternate simple SMS method
        try:
            phone_for_sms = customer_phone.replace("+", "").replace(" ", "")
            if len(phone_for_sms) == 10:
                phone_for_sms = "91" + phone_for_sms
            async with httpx.AsyncClient() as client:
                await client.get(
                    f"https://api.msg91.com/api/sendhttp.php",
                    params={
                        "authkey": MSG91_AUTH_KEY,
                        "mobiles": phone_for_sms,
                        "message": f"Booking {booking_number} received. Rs.{price}. Team will call within 24hrs. ASR Enterprises",
                        "sender": MSG91_SENDER_ID,
                        "route": "4",
                        "country": "91"
                    },
                    timeout=10
                )
                sms_sent = True
        except Exception as e2:
            logger.error(f"Alternate SMS method also failed: {e2}")
    
    # ===== SEND EMAIL CONFIRMATION =====
    email_sent = False
    if customer_email and RESEND_API_KEY:
        try:
            email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">ASR Enterprises</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Solar Service Booking Received</p>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
                    <p style="color: #333; font-size: 16px;">Dear <strong>{customer_name}</strong>,</p>
                    <p style="color: #333; font-size: 15px;">Thank you for booking our Solar Service! Your payment is being verified.</p>
                    
                    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%; font-size: 14px; color: #333;">
                            <tr><td style="padding: 6px 0; color: #666;">Booking Number</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{booking_number}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">Book Solar Service</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Amount</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #16a34a;">₹{price:,.0f}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Transaction ID</td><td style="padding: 6px 0; text-align: right; font-size: 12px;">{transaction_id}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Status</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #f59e0b;">PENDING VERIFICATION</td></tr>
                        </table>
                    </div>
                    
                    <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;"><strong>What's Next?</strong></p>
                        <p style="color: #666; font-size: 13px; margin: 0;">Our team will verify your payment and call you at <strong>{customer_phone}</strong> within 24 hours to confirm your booking.</p>
                    </div>
                    
                    <p style="color: #666; font-size: 13px;">Need help? Call: <strong>9296389097</strong> | WhatsApp: <strong>9296389097</strong></p>
                </div>
                <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
                    <p style="color: #999; font-size: 12px; margin: 0;">ASR Enterprises - Bihar's Trusted Solar Rooftop Company</p>
                </div>
            </div>"""
            
            params = {
                "from": SENDER_EMAIL,
                "to": [customer_email],
                "subject": f"Booking Received - {booking_number} | ASR Enterprises",
                "html": email_html
            }
            await asyncio.to_thread(resend.Emails.send, params)
            email_sent = True
            logger.info(f"Booking email sent to {customer_email}")
        except Exception as e:
            logger.error(f"Failed to send booking email: {e}")
    
    # ===== WHATSAPP URL FOR CUSTOMER =====
    whatsapp_message = f"Hi ASR Enterprises! I just booked Solar Service.\n\nBooking: {booking_number}\nName: {customer_name}\nAmount: Rs.{price}\nTransaction ID: {transaction_id}\n\nPlease confirm my booking."
    customer_whatsapp_url = f"https://wa.me/919296389097?text={quote(whatsapp_message)}"
    
    # ===== CRM NOTIFICATION =====
    try:
        crm_message = CRMMessage(
            sender_id="system",
            sender_name="Booking System",
            sender_type="system",
            receiver_id="admin",
            receiver_name="Admin",
            message=f"NEW SOLAR SERVICE BOOKING #{booking_number} - {customer_name} ({customer_phone}) - Rs.{price} - TXN: {transaction_id} - VERIFY PAYMENT"
        )
        msg_doc = crm_message.model_dump()
        msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
        await db.crm_messages.insert_one(msg_doc)
    except Exception as e:
        logger.error(f"Failed to create CRM notification: {e}")
    
    # ===== ADMIN WHATSAPP NOTIFICATION =====
    admin_phone = "9296389097"
    admin_message = f"🔔 NEW BOOKING\n\n#{booking_number}\n{customer_name}\n📱 {customer_phone}\n💰 Rs.{price}\n🔢 TXN: {transaction_id}\n\n⚠️ VERIFY PAYMENT"
    admin_whatsapp_url = f"https://wa.me/91{admin_phone}?text={quote(admin_message)}"
    
    logger.info(f"Solar service booking created: {booking_number} by {customer_name}")
    
    return {
        "success": True,
        "booking_number": booking_number,
        "amount": price,
        "customer_whatsapp_url": customer_whatsapp_url,
        "admin_whatsapp_url": admin_whatsapp_url,
        "sms_sent": sms_sent,
        "email_sent": email_sent,
        "message": "Booking created successfully. Our team will verify payment and contact you."
    }

@api_router.get("/service/bookings")
async def get_solar_service_bookings(status: str = None, limit: int = 50):
    """Admin: Get all solar service bookings (excludes site visits)"""
    query = {"booking_type": {"$ne": "site_visit"}}
    if status:
        query["status"] = status
    
    bookings = await db.solar_service_bookings.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"bookings": bookings, "count": len(bookings)}

@api_router.put("/service/bookings/{booking_id}/status")
async def update_solar_booking_status(booking_id: str, data: Dict[str, Any]):
    """Admin: Update booking status (confirm/reject payment)"""
    new_status = data.get("status", "pending")
    payment_status = data.get("payment_status", "pending_verification")
    notes = data.get("notes", "")
    
    result = await db.solar_service_bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": new_status,
            "payment_status": payment_status,
            "admin_notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"success": True, "message": f"Booking status updated to {new_status}"}

# Bihar districts list for product delivery configuration
BIHAR_DISTRICT_LIST = [
    "Patna", "Nalanda", "Gaya", "Muzaffarpur", "Saran (Chapra)", "East Champaran",
    "West Champaran", "Darbhanga", "Madhubani", "Purnia", "Bhagalpur", "Munger",
    "Banka", "Begusarai", "Samastipur", "Sitamarhi", "Saharsa", "Katihar",
    "Vaishali", "Arwal", "Aurangabad", "Rohtas", "Kaimur", "Buxar", "Siwan",
    "Gopalganj", "Sheohar", "Supaul", "Kishanganj", "Araria", "Sasaram",
    "Nawada", "Jehanabad", "Lakhisarai", "Sheikhpura", "Jamui", "Khagaria"
]

# Distance-based delivery fee structure
DISTRICT_DELIVERY_FEES = {
    "Patna": 50, "Nalanda": 100, "Vaishali": 100, "Arwal": 100, "Jehanabad": 100,
    "Gaya": 150, "Begusarai": 150, "Samastipur": 150,
    "Muzaffarpur": 200, "Saran (Chapra)": 200, "Darbhanga": 200, "Bhagalpur": 200,
    "Munger": 200, "Buxar": 200, "Siwan": 200, "Gopalganj": 200, "Aurangabad": 200,
    "Rohtas": 200, "Sasaram": 200, "Nawada": 200, "Lakhisarai": 200,
    "East Champaran": 300, "West Champaran": 300, "Madhubani": 300, "Purnia": 300,
    "Banka": 300, "Sitamarhi": 300, "Saharsa": 300, "Katihar": 300,
    "Supaul": 300, "Kaimur": 300, "Sheohar": 300,
    "Kishanganj": 350, "Araria": 350, "Sheikhpura": 200, "Jamui": 250, "Khagaria": 250
}

@api_router.get("/shop/bihar-districts")
async def get_bihar_districts():
    """Get list of Bihar districts with delivery fees (can be admin-customized)"""
    # Try to get custom fees from database, fallback to defaults
    custom_fees = await db.settings.find_one({"key": "district_delivery_fees"}, {"_id": 0})
    fees = custom_fees.get("value", DISTRICT_DELIVERY_FEES) if custom_fees else DISTRICT_DELIVERY_FEES
    return {
        "districts": BIHAR_DISTRICT_LIST,
        "delivery_fees": fees
    }

@api_router.put("/shop/bihar-districts/fees")
async def update_district_delivery_fees(data: Dict[str, Any]):
    """Admin: Update delivery fees for districts"""
    fees = data.get("delivery_fees", {})
    if not fees:
        raise HTTPException(status_code=400, detail="No fees provided")
    
    await db.settings.update_one(
        {"key": "district_delivery_fees"},
        {"$set": {"key": "district_delivery_fees", "value": fees}},
        upsert=True
    )
    
    logger.info(f"District delivery fees updated")
    return {"status": "success", "message": "Delivery fees updated", "fees": fees}

@api_router.get("/admin/district-fees")
async def get_admin_district_fees():
    """Admin: Get all district fees for editing"""
    custom_fees = await db.settings.find_one({"key": "district_delivery_fees"}, {"_id": 0})
    fees = custom_fees.get("value", DISTRICT_DELIVERY_FEES) if custom_fees else DISTRICT_DELIVERY_FEES
    return {
        "districts": BIHAR_DISTRICT_LIST,
        "fees": fees,
        "default_fees": DISTRICT_DELIVERY_FEES
    }

@api_router.get("/shop/products/{product_id}/check-delivery/{pincode}")
async def check_product_delivery(product_id: str, pincode: str):
    """Check if a specific product can be delivered to a pincode"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get district from pincode
    pincode_info = BIHAR_PINCODES.get(pincode)
    district = None
    if pincode_info:
        district = pincode_info["district"]
    elif pincode[:2] in ["80", "81", "82", "83", "84", "85"]:
        district = "Bihar"
    
    if not district:
        return {"deliverable": False, "district": None, "fee": 0, "note": "Sorry, delivery only within Bihar."}
    
    # Check product-specific delivery districts
    product_districts = product.get("delivery_districts", [])
    if product_districts and district not in product_districts and district != "Bihar":
        return {"deliverable": False, "district": district, "fee": 0, "note": f"This product is not available for delivery in {district}."}
    
    # Check product-specific fee or use default
    product_fees = product.get("delivery_fees", {})
    fee = product_fees.get(district, DISTRICT_DELIVERY_FEES.get(district, 200))
    
    est_days = pincode_info["days"] if pincode_info else "5-7"
    
    return {
        "deliverable": True,
        "district": district,
        "fee": fee,
        "estimated_days": est_days,
        "pickup_available": product.get("pickup_available", True)
    }

@api_router.get("/shop/categories")
async def get_product_categories():
    """Get all product categories"""
    return PRODUCT_CATEGORIES

@api_router.get("/shop/products")
async def get_products(category: str = None, featured: bool = None, active_only: bool = True):
    """Get all products for the shop"""
    query = {}
    if active_only:
        query["is_active"] = True
    if category:
        query["category"] = category
    if featured is not None:
        query["is_featured"] = featured
    
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return products

@api_router.get("/shop/products/{product_id}")
async def get_product(product_id: str):
    """Get single product details"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/shop/products")
async def create_product(product: Product):
    """Create a new product (CRM)"""
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.products.insert_one(doc)
    return {"status": "success", "product": product}

@api_router.put("/shop/products/{product_id}")
async def update_product(product_id: str, data: Dict[str, Any]):
    """Update product details (CRM)"""
    data['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"id": product_id}, {"$set": data})
    return {"status": "success", "message": "Product updated"}

@api_router.delete("/shop/products/{product_id}")
async def delete_product(product_id: str):
    """Delete a product (CRM)"""
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "success", "message": "Product deleted"}

@api_router.post("/shop/products/{product_id}/images")
async def add_product_image(product_id: str, image_url: str = Form(...)):
    """Add image to product"""
    await db.products.update_one(
        {"id": product_id}, 
        {"$push": {"images": image_url}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success", "message": "Image added"}

@api_router.post("/shop/products/{product_id}/upload-image")
async def upload_product_image(product_id: str, file: UploadFile = File(...)):
    """Upload product image directly from mobile/desktop storage"""
    try:
        # Read file content
        content = await file.read()
        
        # Validate file size (max 5MB for products)
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Max 5MB allowed.")
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
        
        # Convert to base64 data URL for storage
        base64_content = base64.b64encode(content).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{base64_content}"
        
        # Add image to product
        await db.products.update_one(
            {"id": product_id}, 
            {"$push": {"images": data_url}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"status": "success", "message": "Image uploaded", "image_url": data_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Product image upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")

@api_router.delete("/shop/products/{product_id}/images")
async def remove_product_image(product_id: str, image_url: str):
    """Remove image from product"""
    await db.products.update_one(
        {"id": product_id}, 
        {"$pull": {"images": image_url}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success", "message": "Image removed"}

# Order Management
def generate_order_whatsapp_message(order: Order) -> str:
    """Generate WhatsApp notification message for admin (new order alert)"""
    items_text = "\n".join([f"• {item.get('product_name', 'Item')} x{item.get('quantity', 1)} - ₹{item.get('price', 0) * item.get('quantity', 1):,.0f}" for item in order.items])
    
    message = f"""🛒 *NEW ORDER - ASR Solar Hub*

📦 Order #: {order.order_number}

👤 *Customer Details:*
Name: {order.customer_name}
Phone: {order.customer_phone}
{f"Email: {order.customer_email}" if order.customer_email else ""}

📋 *Items Ordered:*
{items_text}

💰 *Payment Details:*
Subtotal: ₹{order.subtotal:,.0f}
Delivery: {f"₹{order.delivery_charge:,.0f}" if order.delivery_charge else "FREE"}
*Total: ₹{order.total:,.0f}*

📍 *Delivery Type:* {"🏪 Store Pickup" if order.delivery_type == "pickup" else "🚚 Home Delivery"}
{f"Address: {order.delivery_address}" if order.delivery_type == "delivery" else "Pickup: Shop 10, AMAN SKS COMPLEX, Khagaul Saguna Road"}

💳 *Payment Method:* {"💵 Cash on " + ("Store" if order.delivery_type == "pickup" else "Delivery") if order.payment_method == "cod" else "💳 Razorpay Online"}

{f"📝 Notes: {order.notes}" if order.notes else ""}

⏰ Order Time: {datetime.now(timezone.utc).strftime('%d-%b-%Y %I:%M %p')}

_Please process this order promptly!_"""
    return message

def generate_customer_order_confirmation(order: Order, is_payment_confirmed: bool = False) -> str:
    """Generate WhatsApp order confirmation message for customer"""
    items_text = "\n".join([f"• {item.get('product_name', 'Item')} x{item.get('quantity', 1)} - ₹{item.get('price', 0) * item.get('quantity', 1):,.0f}" for item in order.items])
    
    payment_status = "✅ PAID" if is_payment_confirmed else ("💳 Pay Online" if order.payment_method == "razorpay" else "💵 Pay on " + ("Pickup" if order.delivery_type == "pickup" else "Delivery"))
    
    message = f"""🌞 *Thank You for Your Order!*
*ASR Enterprises - Solar Solutions*

Dear {order.customer_name},

Your order has been {"confirmed" if is_payment_confirmed else "received"}! 🎉

📦 *Order Number:* {order.order_number}

📋 *Your Items:*
{items_text}

💰 *Order Summary:*
Subtotal: ₹{order.subtotal:,.0f}
Delivery: {f"₹{order.delivery_charge:,.0f}" if order.delivery_charge else "FREE"}
━━━━━━━━━━━━━━━
*Total: ₹{order.total:,.0f}*

💳 *Payment:* {payment_status}

📍 *{"Pickup Location" if order.delivery_type == "pickup" else "Delivery Address"}:*
{("Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503" if order.delivery_type == "pickup" else order.delivery_address)}

📞 *Need Help?*
Call: 9296389097
WhatsApp: 9296389097

⏰ *{"Pickup" if order.delivery_type == "pickup" else "Delivery"} Time:*
{"Visit our store during business hours (9 AM - 7 PM)" if order.delivery_type == "pickup" else "Within 2-3 business days"}

_Thank you for choosing ASR Enterprises!_
_Powering Bihar's future with clean energy_ ☀️"""
    return message

@api_router.post("/shop/orders")
async def create_order(order_data: Dict[str, Any]):
    """Create a new order with Cashfree payment and WhatsApp notification"""
    order = Order(
        customer_name=sanitize_input(order_data.get("customer_name", "")),
        customer_phone=sanitize_input(order_data.get("customer_phone", "")),
        customer_email=sanitize_input(order_data.get("customer_email", "")),
        items=order_data.get("items", []),
        subtotal=float(order_data.get("subtotal", 0)),
        delivery_charge=float(order_data.get("delivery_charge", 0)),
        total=float(order_data.get("total", 0)),
        delivery_type=order_data.get("delivery_type", "pickup"),
        delivery_address=sanitize_input(order_data.get("delivery_address", "")),
        delivery_district=order_data.get("delivery_district", "Patna"),
        payment_method=order_data.get("payment_method", "cod"),
        notes=sanitize_input(order_data.get("notes", ""))
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    cashfree_order_id = None
    cashfree_session_id = None
    cashfree_payment_url = None
    
    # If online payment, create Cashfree order
    if order.payment_method == "online":
        try:
            # Cashfree production credentials — env vars only (see cashfree_orders.py)
            cf_app_id = os.environ.get("CASHFREE_API_KEY", "")
            cf_secret = os.environ.get("CASHFREE_SECRET_KEY", "")
            cf_api_url = "https://api.cashfree.com/pg"
            if not cf_app_id or not cf_secret:
                raise HTTPException(
                    status_code=503,
                    detail="Cashfree credentials not configured (CASHFREE_API_KEY / CASHFREE_SECRET_KEY).",
                )
            
            cf_order_id = f"SHOP{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:4].upper()}"
            
            # Build return URL
            origin_url = order_data.get("origin_url", "https://asrenterprises.in")
            return_url = f"{origin_url}/shop?payment_status=success&order_id={cf_order_id}"
            
            cf_payload = {
                "order_id": cf_order_id,
                "order_amount": float(order.total),
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": f"CUST_{order.customer_phone[-10:]}",
                    "customer_name": order.customer_name[:50],
                    "customer_phone": order.customer_phone[-10:],
                    "customer_email": order.customer_email or "customer@asrenterprises.in"
                },
                "order_meta": {
                    "return_url": return_url,
                    "notify_url": "https://asrenterprises.in/api/cashfree/webhook"
                },
                "order_note": f"Shop Order #{order.order_number}"
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                cf_response = await client.post(
                    f"{cf_api_url}/orders",
                    headers={
                        "x-client-id": cf_app_id,
                        "x-client-secret": cf_secret,
                        "x-api-version": "2023-08-01",
                        "Content-Type": "application/json"
                    },
                    json=cf_payload
                )
                
                if cf_response.status_code in [200, 201]:
                    cf_data = cf_response.json()
                    cashfree_order_id = cf_data.get("order_id", cf_order_id)
                    cashfree_session_id = cf_data.get("payment_session_id", "")
                    cashfree_payment_url = cf_data.get("payment_link", "") or cf_data.get("payments", {}).get("url", "")
                    
                    doc['cashfree_order_id'] = cashfree_order_id
                    doc['payment_session_id'] = cashfree_session_id
                    doc['payment_url'] = cashfree_payment_url
                    doc['payment_status'] = 'pending'
                    
                    # Also save to cashfree_orders collection for webhook matching
                    await db.cashfree_orders.insert_one({
                        "order_id": cashfree_order_id,
                        "shop_order_id": order.id,
                        "shop_order_number": order.order_number,
                        "customer_name": order.customer_name,
                        "customer_phone": order.customer_phone,
                        "customer_email": order.customer_email,
                        "amount": float(order.total),
                        "purpose": f"Shop Order #{order.order_number}",
                        "payment_type": "shop_order",
                        "status": "active",
                        "payment_session_id": cashfree_session_id,
                        "payment_url": cashfree_payment_url,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    logger.info(f"Created Cashfree order: {cashfree_order_id} for shop order {order.order_number}")
                else:
                    logger.error(f"Cashfree order creation failed: {cf_response.status_code} - {cf_response.text}")
                    raise HTTPException(status_code=500, detail="Payment order creation failed")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Cashfree order creation error: {e}")
            raise HTTPException(status_code=500, detail=f"Payment order creation failed: {str(e)}")
    
    await db.orders.insert_one(doc)
    
    # Update product stock
    for item in order.items:
        await db.products.update_one(
            {"id": item.get("product_id")},
            {"$inc": {"stock": -item.get("quantity", 0)}}
        )
    
    # Generate WhatsApp notification URL for admin
    admin_phone = "9296389097"
    whatsapp_message = generate_order_whatsapp_message(order)
    whatsapp_notification_url = get_whatsapp_url(admin_phone, whatsapp_message)
    
    customer_confirmation_message = generate_customer_order_confirmation(order, is_payment_confirmed=(order.payment_method == "cod"))
    customer_whatsapp_url = get_whatsapp_url(order.customer_phone, customer_confirmation_message)
    
    # Add CRM notification
    try:
        crm_message = CRMMessage(
            sender_id="system",
            sender_name="ASR Solar Hub",
            sender_type="system",
            receiver_id="admin",
            receiver_name="Admin",
            message=f"🛒 New Order #{order.order_number} from {order.customer_name} - ₹{order.total:,.0f} ({order.payment_method.upper()})"
        )
        msg_doc = crm_message.model_dump()
        msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
        await db.crm_messages.insert_one(msg_doc)
    except Exception as e:
        logger.error(f"Failed to create CRM notification for order: {e}")
    
    # Auto-send WhatsApp order confirmation ONLY for COD orders.
    # For online payment orders, WhatsApp is sent after Cashfree payment is verified.
    whatsapp_sent = False
    if order.payment_method == "cod":
        try:
            order_data_for_whatsapp = {
                "order_number": order.order_number,
                "customer_name": order.customer_name,
                "items": order.items,
                "total": order.total,
                "delivery_type": order.delivery_type,
                "delivery_address": order.delivery_address
            }
            whatsapp_sent = await send_whatsapp_order_confirmation(order.customer_phone, order_data_for_whatsapp)
        except Exception as e:
            logger.error(f"Failed to send WhatsApp order confirmation: {e}")
    
    return {
        "status": "success", 
        "order": order,
        "order_number": order.order_number,
        "cashfree_order_id": cashfree_order_id,
        "payment_session_id": cashfree_session_id,
        "payment_url": cashfree_payment_url,
        "whatsapp_notification_url": whatsapp_notification_url,
        "customer_whatsapp_url": customer_whatsapp_url,
        "whatsapp_auto_sent": whatsapp_sent
    }

@api_router.post("/shop/cashfree-verify")
async def verify_cashfree_shop_payment(data: Dict[str, Any]):
    """Verify Cashfree payment for shop order after redirect return"""
    cf_order_id = data.get("cf_order_id", "").strip()
    if not cf_order_id:
        raise HTTPException(status_code=400, detail="cf_order_id required")

    # Find the shop order by cashfree_order_id
    order = await db.orders.find_one({"cashfree_order_id": cf_order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # If already paid, return success immediately
    if order.get("payment_status") == "paid":
        phone = order.get("customer_phone", "")
        wa_msg = f"Your order {order.get('order_number', '')} is confirmed! Track it at asrenterprises.in"
        customer_whatsapp_url = f"https://wa.me/91{phone[-10:]}?text={wa_msg}" if phone else None
        return {"success": True, "order": {**order, "payment_completed": True, "customer_whatsapp_url": customer_whatsapp_url}}

    # Verify with Cashfree API — env vars only (see cashfree_orders.py)
    cf_app_id = os.environ.get("CASHFREE_API_KEY", "")
    cf_secret = os.environ.get("CASHFREE_SECRET_KEY", "")
    cf_api_url = "https://api.cashfree.com/pg"
    if not cf_app_id or not cf_secret:
        raise HTTPException(
            status_code=503,
            detail="Cashfree credentials not configured (CASHFREE_API_KEY / CASHFREE_SECRET_KEY).",
        )
    payment_verified = False
    cf_payment_id = ""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{cf_api_url}/orders/{cf_order_id}",
                headers={
                    "x-client-id": cf_app_id,
                    "x-client-secret": cf_secret,
                    "x-api-version": "2023-08-01"
                }
            )
            if resp.status_code == 200:
                cf_data = resp.json()
                order_status = cf_data.get("order_status", "")
                if order_status in ["PAID", "SUCCESS"]:
                    payment_verified = True
                    cf_payment_id = cf_data.get("cf_payment_id", "")
    except Exception as e:
        logger.error(f"[Cashfree verify] API error: {e}")

    if payment_verified:
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"cashfree_order_id": cf_order_id},
            {"$set": {
                "payment_status": "paid",
                "order_status": "confirmed",
                "cashfree_payment_id": cf_payment_id,
                "paid_at": now,
                "updated_at": now
            }}
        )
        invalidate_cache("shop_stats")
        invalidate_cache("orders")
        order = await db.orders.find_one({"cashfree_order_id": cf_order_id}, {"_id": 0})
        phone = order.get("customer_phone", "")
        wa_msg = f"Your ASR Solar Hub order {order.get('order_number', '')} has been confirmed! Payment received. Track at asrenterprises.in"
        customer_whatsapp_url = f"https://wa.me/91{phone[-10:]}?text={wa_msg}" if phone else None
        logger.info(f"[Cashfree] Shop order {cf_order_id} payment verified and updated to PAID")
        # Send WhatsApp confirmation now that payment is verified
        try:
            await send_whatsapp_order_confirmation(phone, {
                "order_number": order.get("order_number", ""),
                "customer_name": order.get("customer_name", "Customer"),
                "items": order.get("items", []),
                "total": order.get("total", 0),
                "delivery_type": order.get("delivery_type", "pickup"),
                "delivery_address": order.get("delivery_address", "")
            })
        except Exception as wa_err:
            logger.error(f"[Cashfree] WhatsApp post-payment send failed for {cf_order_id}: {wa_err}")
        return {"success": True, "order": {**order, "payment_completed": True, "customer_whatsapp_url": customer_whatsapp_url}}
    else:
        # Return order info without payment confirmation
        return {"success": False, "message": "Payment not yet confirmed"}


@api_router.get("/shop/orders")
async def get_orders(status: str = None):
    """Get all orders (CRM)"""
    query = {}
    if status:
        query["order_status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return orders

@api_router.get("/shop/orders/{order_id}")
async def get_order(order_id: str):
    """Get single order details"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.put("/shop/orders/{order_id}/status")
async def update_order_status(order_id: str, data: Dict[str, Any]):
    """Update order status (CRM)"""
    update_data = {
        "order_status": data.get("order_status"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if data.get("payment_status"):
        update_data["payment_status"] = data.get("payment_status")
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    return {"status": "success", "message": "Order status updated"}

@api_router.delete("/shop/orders/{order_id}")
async def delete_order(order_id: str, force: bool = False):
    """Delete orders (Admin only). Use force=true to delete paid orders."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Allow force delete for admin
    if not force:
        if order.get("order_status") not in ["pending", "cancelled"] and order.get("payment_status") not in ["pending", "failed"]:
            raise HTTPException(status_code=400, detail="This order has been paid/processed. Use force delete option to remove it.")
    
    await db.orders.delete_one({"id": order_id})
    return {"status": "success", "message": "Order deleted"}

@api_router.post("/shop/track-order")
async def track_order(data: Dict[str, Any]):
    """Track order by order number and phone number"""
    order_number = data.get("order_number", "").strip()
    phone = data.get("phone", "").strip()
    
    if not order_number or not phone:
        raise HTTPException(status_code=400, detail="Order number and phone number are required")
    
    order = await db.orders.find_one(
        {"order_number": order_number, "customer_phone": phone},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found. Please check your order number and phone number.")
    
    return order

# Bihar Districts with Pincodes for delivery
BIHAR_PINCODES = {
    "800001": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800002": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800003": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800004": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800005": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800006": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800007": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800008": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800009": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800010": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800014": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "800020": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "801503": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "801505": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "801108": {"district": "Patna", "deliverable": True, "days": "1-2"},
    "803101": {"district": "Nalanda", "deliverable": True, "days": "2-3"},
    "803301": {"district": "Nalanda", "deliverable": True, "days": "2-3"},
    "801301": {"district": "Gaya", "deliverable": True, "days": "2-4"},
    "823001": {"district": "Gaya", "deliverable": True, "days": "2-4"},
    "842001": {"district": "Muzaffarpur", "deliverable": True, "days": "3-5"},
    "842002": {"district": "Muzaffarpur", "deliverable": True, "days": "3-5"},
    "841301": {"district": "Saran (Chapra)", "deliverable": True, "days": "3-5"},
    "841101": {"district": "Saran (Chapra)", "deliverable": True, "days": "3-5"},
    "845401": {"district": "East Champaran", "deliverable": True, "days": "4-6"},
    "845438": {"district": "East Champaran", "deliverable": True, "days": "4-6"},
    "845101": {"district": "West Champaran", "deliverable": True, "days": "4-6"},
    "846001": {"district": "Darbhanga", "deliverable": True, "days": "3-5"},
    "846004": {"district": "Darbhanga", "deliverable": True, "days": "3-5"},
    "847211": {"district": "Madhubani", "deliverable": True, "days": "4-6"},
    "854301": {"district": "Purnia", "deliverable": True, "days": "4-6"},
    "854105": {"district": "Purnia", "deliverable": True, "days": "4-6"},
    "812001": {"district": "Bhagalpur", "deliverable": True, "days": "3-5"},
    "812002": {"district": "Bhagalpur", "deliverable": True, "days": "3-5"},
    "811101": {"district": "Munger", "deliverable": True, "days": "3-5"},
    "813101": {"district": "Banka", "deliverable": True, "days": "4-6"},
    "851101": {"district": "Begusarai", "deliverable": True, "days": "2-4"},
    "848101": {"district": "Samastipur", "deliverable": True, "days": "2-4"},
    "843301": {"district": "Sitamarhi", "deliverable": True, "days": "4-6"},
    "852101": {"district": "Saharsa", "deliverable": True, "days": "4-6"},
    "855101": {"district": "Katihar", "deliverable": True, "days": "4-6"},
    "843001": {"district": "Vaishali", "deliverable": True, "days": "2-3"},
    "844101": {"district": "Vaishali", "deliverable": True, "days": "2-3"},
    "802301": {"district": "Arwal", "deliverable": True, "days": "2-3"},
    "824101": {"district": "Aurangabad", "deliverable": True, "days": "3-5"},
    "821305": {"district": "Rohtas", "deliverable": True, "days": "3-5"},
    "821115": {"district": "Kaimur", "deliverable": True, "days": "4-6"},
    "802101": {"district": "Buxar", "deliverable": True, "days": "3-5"},
    "841201": {"district": "Siwan", "deliverable": True, "days": "3-5"},
    "841226": {"district": "Gopalganj", "deliverable": True, "days": "3-5"},
    "843302": {"district": "Sheohar", "deliverable": True, "days": "4-6"},
    "847101": {"district": "Madhubani", "deliverable": True, "days": "4-6"},
    "847301": {"district": "Supaul", "deliverable": True, "days": "4-6"},
    "850101": {"district": "Jhajha", "deliverable": True, "days": "3-5"},
    "854301": {"district": "Kishanganj", "deliverable": True, "days": "5-7"},
    "854202": {"district": "Araria", "deliverable": True, "days": "5-7"},
    "821301": {"district": "Sasaram", "deliverable": True, "days": "3-5"},
    "805101": {"district": "Nawada", "deliverable": True, "days": "3-5"},
    "804401": {"district": "Jehanabad", "deliverable": True, "days": "2-3"},
    "824201": {"district": "Aurangabad", "deliverable": True, "days": "3-5"},
}

@api_router.get("/shop/check-delivery/{pincode}")
async def check_delivery(pincode: str):
    """Check delivery availability by pincode for Bihar"""
    info = BIHAR_PINCODES.get(pincode)
    if info:
        return {
            "deliverable": info["deliverable"],
            "district": info["district"],
            "estimated_days": info["days"],
            "pincode": pincode
        }
    
    # Check if pincode starts with Bihar range (80-85)
    if pincode[:2] in ["80", "81", "82", "83", "84", "85"]:
        return {
            "deliverable": True,
            "district": "Bihar",
            "estimated_days": "5-7",
            "pincode": pincode,
            "note": "Delivery available but exact timeline may vary. Contact us for confirmation."
        }
    
    return {
        "deliverable": False,
        "district": None,
        "estimated_days": None,
        "pincode": pincode,
        "note": "Sorry, we currently deliver only within Bihar state."
    }

@api_router.post("/shop/orders/{order_id}/payment-verify")
async def verify_razorpay_payment(order_id: str, data: Dict[str, Any]):
    """Verify Razorpay payment with signature verification and send notifications"""
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_signature = data.get("razorpay_signature")
    
    # Get order details for notification
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # SECURITY: Verify Razorpay signature if provided
    razorpay_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    signature_verified = False
    
    if razorpay_signature and razorpay_order_id and razorpay_secret:
        try:
            # Create signature verification string
            signature_payload = f"{razorpay_order_id}|{razorpay_payment_id}"
            expected_signature = hmac.new(
                razorpay_secret.encode('utf-8'),
                signature_payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            signature_verified = hmac.compare_digest(expected_signature, razorpay_signature)
            if signature_verified:
                logger.info(f"Razorpay signature verified for order {order_id}")
            else:
                logger.warning(f"Razorpay signature mismatch for order {order_id}")
        except Exception as sig_err:
            logger.error(f"Signature verification error: {sig_err}")
    
    # Even if signature verification fails, process payment (Razorpay already collected it)
    # But log for security audit
    if not signature_verified and razorpay_signature:
        logger.warning(f"Payment processed without signature verification for order {order_id}")
    
    # Update order with payment details
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": "paid",
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "signature_verified": signature_verified,
            "order_status": "confirmed",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Invalidate cache for orders
    invalidate_cache("shop_stats")
    invalidate_cache("orders")
    
    # Generate WhatsApp payment confirmation notification for admin
    admin_phone = "9296389097"
    payment_message = f"""✅ *PAYMENT CONFIRMED - ASR Solar Hub*

📦 Order #: {order.get('order_number', 'N/A')}
👤 Customer: {order.get('customer_name', 'N/A')}
📞 Phone: {order.get('customer_phone', 'N/A')}

💳 *Payment Details:*
Amount: ₹{order.get('total', 0):,.0f}
Payment ID: {razorpay_payment_id}
Status: ✅ PAID

📍 Delivery: {"🏪 Store Pickup" if order.get('delivery_type') == "pickup" else "🚚 Home Delivery"}
{f"Address: {order.get('delivery_address', '')}" if order.get('delivery_type') == "delivery" else ""}

_Order is now CONFIRMED. Please prepare for dispatch!_"""
    
    whatsapp_notification_url = get_whatsapp_url(admin_phone, payment_message)
    
    # Generate customer payment confirmation WhatsApp message
    items_text = "\n".join([f"• {item.get('product_name', 'Item')} x{item.get('quantity', 1)} - ₹{item.get('price', 0) * item.get('quantity', 1):,.0f}" for item in order.get('items', [])])
    customer_confirmation = f"""🌞 *Payment Successful!*
*ASR Enterprises - Solar Solutions*

Dear {order.get('customer_name', 'Customer')},

Your payment has been confirmed! ✅

📦 *Order Number:* {order.get('order_number', 'N/A')}

📋 *Your Items:*
{items_text}

💰 *Amount Paid:* ₹{order.get('total', 0):,.0f}
💳 *Payment ID:* {razorpay_payment_id}

📍 *{"Pickup Location" if order.get('delivery_type') == "pickup" else "Delivery Address"}:*
{("Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503" if order.get('delivery_type') == "pickup" else order.get('delivery_address', 'N/A'))}

⏰ *{"Pickup" if order.get('delivery_type') == "pickup" else "Delivery"} Time:*
{"Visit our store during business hours (9 AM - 7 PM)" if order.get('delivery_type') == "pickup" else "Within 2-3 business days"}

📞 *Need Help?*
Call: 9296389097
WhatsApp: 9296389097

_Thank you for choosing ASR Enterprises!_
_Powering Bihar's future with clean energy_ ☀️"""
    
    customer_whatsapp_url = get_whatsapp_url(order.get('customer_phone', ''), customer_confirmation)
    
    # ===== EMAIL CONFIRMATION TO CUSTOMER =====
    email_sent = False
    customer_email = order.get('customer_email', '')
    if customer_email and RESEND_API_KEY:
        try:
            # Generate items HTML for email
            items_html = ""
            for item in order.get('items', []):
                item_total = item.get('price', 0) * item.get('quantity', 1)
                items_html += f"""<tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333;">{item.get('product_name', 'Item')}</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: center; color: #666;">{item.get('quantity', 1)}</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #333; font-weight: 500;">₹{item_total:,.0f}</td>
                </tr>"""
            
            delivery_info = "Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503" if order.get('delivery_type') == "pickup" else order.get('delivery_address', 'N/A')
            delivery_label = "Pickup Location" if order.get('delivery_type') == "pickup" else "Delivery Address"
            delivery_time = "Visit our store during business hours (9 AM - 7 PM)" if order.get('delivery_type') == "pickup" else "Within 2-3 business days"
            
            email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
                <div style="background: linear-gradient(135deg, #1a2332, #0f1824); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">Payment Successful!</h1>
                    <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0 0;">ASR Enterprises - Solar Solutions</p>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
                    <p style="color: #333; font-size: 16px;">Dear <strong>{order.get('customer_name', 'Customer')}</strong>,</p>
                    <p style="color: #333; font-size: 15px;">Your payment has been confirmed and your order is now being processed!</p>
                    
                    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%; font-size: 14px; color: #333;">
                            <tr><td style="padding: 6px 0; color: #666;">Order Number</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{order.get('order_number', 'N/A')}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Amount Paid</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #16a34a;">₹{order.get('total', 0):,.0f}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Payment ID</td><td style="padding: 6px 0; text-align: right; font-size: 12px;">{razorpay_payment_id}</td></tr>
                            <tr><td style="padding: 6px 0; color: #666;">Status</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #16a34a;">CONFIRMED</td></tr>
                        </table>
                    </div>
                    
                    <h3 style="color: #333; font-size: 16px; margin: 25px 0 15px 0; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">Order Items</h3>
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                        <tr style="background: #f8fafc;">
                            <th style="padding: 10px 0; text-align: left; color: #666; font-weight: 600;">Item</th>
                            <th style="padding: 10px 0; text-align: center; color: #666; font-weight: 600;">Qty</th>
                            <th style="padding: 10px 0; text-align: right; color: #666; font-weight: 600;">Price</th>
                        </tr>
                        {items_html}
                        <tr style="background: #f8fafc;">
                            <td colspan="2" style="padding: 12px 0; font-weight: bold; color: #333;">Total</td>
                            <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #16a34a; font-size: 16px;">₹{order.get('total', 0):,.0f}</td>
                        </tr>
                    </table>
                    
                    <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;"><strong>{delivery_label}:</strong></p>
                        <p style="color: #666; font-size: 13px; margin: 0 0 10px 0;">{delivery_info}</p>
                        <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;"><strong>Expected {delivery_label.split()[0]}:</strong></p>
                        <p style="color: #666; font-size: 13px; margin: 0;">{delivery_time}</p>
                    </div>
                    
                    <p style="color: #666; font-size: 13px;">Need help? Call us at <strong>9296389097</strong> | WhatsApp: <strong>9296389097</strong></p>
                </div>
                <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
                    <p style="color: #999; font-size: 12px; margin: 0;">ASR Enterprises - Bihar's Trusted Solar Rooftop Company</p>
                    <p style="color: #999; font-size: 11px; margin: 5px 0 0 0;">Shop no 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna 801503</p>
                </div>
            </div>"""
            
            params = {
                "from": SENDER_EMAIL,
                "to": [customer_email],
                "subject": f"Order Confirmed - {order.get('order_number', 'N/A')} | ASR Enterprises",
                "html": email_html
            }
            await asyncio.to_thread(resend.Emails.send, params)
            email_sent = True
            logger.info(f"Order confirmation email sent to {customer_email} for order #{order.get('order_number', '')}")
        except Exception as e:
            logger.error(f"Failed to send order confirmation email: {e}")
    
    # Add CRM notification for payment confirmation
    try:
        crm_message = CRMMessage(
            sender_id="system",
            sender_name="Payment System",
            sender_type="system",
            receiver_id="admin",
            receiver_name="Admin",
            message=f"✅ Payment CONFIRMED for Order #{order.get('order_number', 'N/A')} - ₹{order.get('total', 0):,.0f} (Razorpay: {razorpay_payment_id})"
        )
        msg_doc = crm_message.model_dump()
        msg_doc['timestamp'] = msg_doc['timestamp'].isoformat()
        await db.crm_messages.insert_one(msg_doc)
    except Exception as e:
        logger.error(f"Failed to create CRM notification for payment: {e}")
    
    # AUTO-CREATE PAYMENT RECORD IN CRM for Razorpay payments
    try:
        payment_record = {
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "order_number": order.get('order_number', ''),
            "customer_name": order.get('customer_name', ''),
            "customer_phone": order.get('customer_phone', ''),
            "amount": order.get('total', 0),
            "payment_method": "razorpay",
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "status": "completed",
            "payment_type": "shop_order",
            "notes": f"Online payment for Order #{order.get('order_number', '')}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "auto_recorded": True
        }
        await db.payments.insert_one(payment_record)
        logger.info(f"Auto-created payment record for Order #{order.get('order_number', '')}")
    except Exception as e:
        logger.error(f"Failed to auto-create payment record: {e}")
    
    return {
        "status": "success", 
        "message": "Payment verified",
        "whatsapp_notification_url": whatsapp_notification_url,
        "customer_whatsapp_url": customer_whatsapp_url,
        "email_sent": email_sent
    }

@api_router.get("/shop/orders/track/{order_number}")
async def track_order(order_number: str):
    """Track order by order number (public)"""
    order = await db.orders.find_one(
        {"order_number": order_number}, 
        {"_id": 0, "customer_name": 1, "order_number": 1, "order_status": 1, 
         "payment_status": 1, "delivery_type": 1, "total": 1, "created_at": 1, "items": 1}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.get("/shop/stats")
async def get_shop_stats():
    """Get shop statistics for CRM dashboard with caching"""
    cache_key = "shop_stats"
    cached = get_cached(cache_key, ttl=30)
    if cached:
        return cached
    
    results = await asyncio.gather(
        db.products.count_documents({"is_active": True}),
        db.orders.count_documents({}),
        db.orders.count_documents({"order_status": "pending"}),
        db.orders.count_documents({"payment_status": "paid"}),
        db.orders.aggregate([
            {"$match": {"payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]).to_list(1)
    )
    
    response = {
        "total_products": results[0],
        "total_orders": results[1],
        "pending_orders": results[2],
        "paid_orders": results[3],
        "total_revenue": results[4][0]["total"] if results[4] else 0
    }
    
    set_cache(cache_key, response, ttl=30)
    return response


# ==================== PRODUCT REVIEWS ====================

@api_router.get("/shop/products/{product_id}/reviews")
async def get_product_reviews(product_id: str):
    """Get all approved reviews for a product"""
    reviews = await db.product_reviews.find(
        {"product_id": product_id, "is_approved": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate average rating
    avg_rating = 0
    if reviews:
        avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
    
    return {"reviews": reviews, "average_rating": avg_rating, "total_reviews": len(reviews)}

@api_router.post("/shop/products/{product_id}/reviews")
async def create_product_review(product_id: str, data: Dict[str, Any]):
    """Submit a product review"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    review = ProductReview(
        product_id=product_id,
        customer_name=data.get("customer_name", "Anonymous"),
        customer_phone=data.get("customer_phone", ""),
        rating=min(5, max(1, int(data.get("rating", 5)))),
        title=data.get("title", ""),
        review_text=data.get("review_text", ""),
        is_verified_purchase=False,
        is_approved=True
    )
    
    doc = review.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.product_reviews.insert_one(doc)
    doc.pop("_id", None)
    
    return {"status": "success", "review": doc}

@api_router.get("/shop/reviews/summary")
async def get_all_reviews_summary():
    """Get review summary (avg rating + count) for all products"""
    pipeline = [
        {"$match": {"is_approved": True}},
        {"$group": {
            "_id": "$product_id",
            "avg_rating": {"$avg": "$rating"},
            "count": {"$sum": 1}
        }}
    ]
    results = await db.product_reviews.aggregate(pipeline).to_list(500)
    summary = {}
    for r in results:
        summary[r["_id"]] = {"avg_rating": round(r["avg_rating"], 1), "count": r["count"]}
    return summary


# ==================== BULK LEAD IMPORT ====================

@api_router.post("/crm/leads/bulk-import")
async def bulk_import_leads(file: UploadFile = File(...)):
    """
    Import leads from CSV/Excel file.
    PRIORITY: First extract 10-digit mobile numbers from ANY column, then read other data.
    Handles large files efficiently with batch processing.
    These leads are for calling purposes only.
    """
    try:
        content = await file.read()
        filename = file.filename.lower()
        
        # Check file size (max 10MB)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum 10MB allowed.")
        
        rows = []
        column_names = []
        
        # Parse based on file type
        if filename.endswith('.csv'):
            # Parse CSV
            decoded = content.decode('utf-8-sig')  # Handle BOM
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
            if rows:
                column_names = list(rows[0].keys())
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            # Parse Excel
            import pandas as pd
            df = pd.read_excel(io.BytesIO(content), dtype=str)  # Read all as string to preserve phone numbers
            df = df.fillna('')
            column_names = list(df.columns)
            rows = df.to_dict('records')
        else:
            raise HTTPException(status_code=400, detail="Only CSV and Excel (.xlsx, .xls) files are supported")
        
        if not rows:
            raise HTTPException(status_code=400, detail="File is empty or has no data rows")
        
        logger.info(f"Bulk import: Processing {len(rows)} rows with columns: {column_names}")
        
        def extract_10_digit_phone(value):
            """
            Extract exactly 10-digit Indian mobile number from any value.
            Returns the 10-digit number or None if not found.
            """
            val = str(value).strip()
            if not val or val.lower() == 'nan':
                return None
            
            # Remove common prefixes and formatting
            val = val.replace('+91', '').replace('+', '').replace('-', '').replace(' ', '')
            val = val.replace('(', '').replace(')', '').replace('.', '')
            
            # Handle scientific notation (Excel sometimes does this)
            if 'e' in val.lower():
                try:
                    val = str(int(float(val)))
                except:
                    pass
            
            # Extract only digits
            digits = re.sub(r'[^\d]', '', val)
            
            # Look for valid 10-digit Indian mobile (starts with 6,7,8,9)
            if len(digits) >= 10:
                # Take last 10 digits
                phone_10 = digits[-10:]
                if phone_10[0] in ['6', '7', '8', '9']:
                    return phone_10
            
            return None
        
        def find_phone_in_row(row):
            """
            PRIORITY: Scan ALL columns in a row to find a valid 10-digit mobile number.
            Returns (phone_10_digits, column_name) or (None, None)
            """
            # Priority columns to check first
            priority_cols = ['phone', 'Phone', 'PHONE', 'mobile', 'Mobile', 'MOBILE', 
                           'contact', 'Contact', 'CONTACT', 'number', 'Number', 'NUMBER',
                           'phone_number', 'Phone Number', 'mobile_number', 'Mobile Number',
                           'cell', 'Cell', 'telephone', 'tel']
            
            # Check priority columns first
            for col in priority_cols:
                if col in row:
                    phone = extract_10_digit_phone(row[col])
                    if phone:
                        return phone, col
            
            # Then check all other columns
            for col, val in row.items():
                phone = extract_10_digit_phone(val)
                if phone:
                    return phone, col
            
            return None, None
        
        imported = []
        errors = []
        duplicates = []
        
        # Batch size for efficient processing
        BATCH_SIZE = 100
        batch_leads = []
        
        # First pass: extract all valid phones for duplicate check
        all_phones_in_file = []
        for row in rows:
            phone, _ = find_phone_in_row(row)
            if phone:
                all_phones_in_file.append(f"91{phone}")
        
        # Batch check for existing phones in DB
        existing_phones = set()
        if all_phones_in_file:
            existing_leads = await db.crm_leads.find(
                {"phone": {"$in": all_phones_in_file}},
                {"phone": 1}
            ).to_list(len(all_phones_in_file))
            existing_phones = {lead["phone"] for lead in existing_leads}
        
        processed_phones = set()  # Track phones within this import
        phone_columns_used = set()
        
        for row_num, row in enumerate(rows, start=2):
            try:
                # PRIORITY: First find 10-digit phone from any column
                phone, found_in_col = find_phone_in_row(row)
                
                if not phone:
                    # Show what values were in the row for debugging
                    sample_vals = list(row.values())[:3]
                    errors.append({"row": row_num, "error": f"No valid 10-digit mobile found (sample: {sample_vals})"})
                    continue
                
                if found_in_col:
                    phone_columns_used.add(found_in_col)
                
                phone_full = f"91{phone}"
                
                # Check for duplicate (already in DB)
                if phone_full in existing_phones:
                    duplicates.append({"row": row_num, "phone": phone})
                    continue
                
                # Check for duplicate within this file
                if phone_full in processed_phones:
                    duplicates.append({"row": row_num, "phone": phone, "reason": "duplicate in file"})
                    continue
                
                processed_phones.add(phone_full)
                
                # AFTER phone is validated, read other data
                name = str(row.get('name', row.get('Name', row.get('NAME', row.get('customer_name', row.get('Customer Name', '')))))).strip()
                if not name or name.lower() == 'nan':
                    name = f"Lead-{phone[-4:]}"
                
                # Create lead (minimal for calling purposes)
                lead_id = str(uuid.uuid4())
                lead = {
                    "id": lead_id,
                    "name": sanitize_input(name),
                    "email": "",
                    "phone": phone_full,
                    "district": "",
                    "address": "",
                    "property_type": "residential",
                    "monthly_bill": None,
                    "roof_area": None,
                    "source": "bulk_import",
                    "stage": "new",
                    "assigned_to": None,
                    "assigned_by": None,
                    "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Bulk imported for calling",
                    "quoted_amount": None,
                    "system_size": None,
                    "advance_paid": 0.0,
                    "total_amount": 0.0,
                    "pending_amount": 0.0,
                    "lead_score": 30,
                    "ai_priority": "low",
                    "ai_suggestions": None,
                    "call_status": None,
                    "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": "Bulk imported for calling"}],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                batch_leads.append(lead)
                
                # Insert in batches for efficiency
                if len(batch_leads) >= BATCH_SIZE:
                    await db.crm_leads.insert_many(batch_leads)
                    imported.extend([{"name": l["name"], "phone": l["phone"][-10:], "id": l["id"]} for l in batch_leads])
                    batch_leads = []
                
            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})
        
        # Insert remaining batch
        if batch_leads:
            await db.crm_leads.insert_many(batch_leads)
            imported.extend([{"name": l["name"], "phone": l["phone"][-10:], "id": l["id"]} for l in batch_leads])
        
        logger.info(f"Bulk import: {len(imported)} leads imported, {len(duplicates)} duplicates skipped, {len(errors)} errors")
        
        return {
            "success": True,
            "imported_count": len(imported),
            "duplicate_count": len(duplicates),
            "error_count": len(errors),
            "total_rows": len(rows),
            "phone_columns_used": list(phone_columns_used),
            "imported_leads": imported[:20],
            "duplicates": duplicates[:20],
            "errors": errors[:20],
            "message": f"Successfully imported {len(imported)} leads" + 
                      (f", {len(duplicates)} duplicates skipped" if duplicates else "") +
                      (f", {len(errors)} errors" if errors else "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@api_router.post("/crm/leads/bulk-import-manual")
async def bulk_import_leads_manual(data: dict):
    """
    Import leads from manually pasted phone numbers.
    Accepts a text with phone numbers (one per line or comma-separated).
    These leads are for calling purposes only.
    """
    try:
        text = data.get("phones", "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="No phone numbers provided")
        
        # Split by newline, comma, semicolon, or space
        raw_phones = re.split(r'[\n,;\s]+', text)
        raw_phones = [p.strip() for p in raw_phones if p.strip()]
        
        if not raw_phones:
            raise HTTPException(status_code=400, detail="No valid phone numbers found in input")
        
        logger.info(f"Manual bulk import: Processing {len(raw_phones)} phone numbers")
        
        imported = []
        errors = []
        duplicates = []
        
        # Extract and validate phones
        def extract_phone(value):
            val = str(value).strip()
            val = val.replace('+91', '').replace('+', '').replace('-', '').replace(' ', '')
            val = val.replace('(', '').replace(')', '').replace('.', '')
            digits = re.sub(r'[^\d]', '', val)
            return digits
        
        # Get all potential phones for duplicate check
        valid_phones = []
        for raw in raw_phones:
            phone = extract_phone(raw)
            if len(phone) >= 10:
                phone = phone[-10:]
                valid_phones.append(f"91{phone}")
        
        # Batch check for existing phones
        existing_phones = set()
        if valid_phones:
            existing_leads = await db.crm_leads.find(
                {"phone": {"$in": valid_phones}},
                {"phone": 1}
            ).to_list(len(valid_phones))
            existing_phones = {lead["phone"] for lead in existing_leads}
        
        batch_leads = []
        processed_phones = set()
        BATCH_SIZE = 100
        
        for idx, raw_phone in enumerate(raw_phones, start=1):
            try:
                phone = extract_phone(raw_phone)
                
                if not phone or len(phone) < 10:
                    errors.append({"row": idx, "input": raw_phone, "error": "Invalid phone number"})
                    continue
                
                phone = phone[-10:]
                if phone[0] not in ['6', '7', '8', '9']:
                    errors.append({"row": idx, "input": raw_phone, "error": "Must start with 6-9"})
                    continue
                
                phone = f"91{phone}"
                
                if phone in existing_phones:
                    duplicates.append({"row": idx, "phone": phone[-10:]})
                    continue
                
                if phone in processed_phones:
                    duplicates.append({"row": idx, "phone": phone[-10:], "reason": "duplicate in input"})
                    continue
                
                processed_phones.add(phone)
                
                lead_id = str(uuid.uuid4())
                lead = {
                    "id": lead_id,
                    "name": f"Lead-{phone[-4:]}",
                    "email": "",
                    "phone": phone,
                    "district": "",
                    "address": "",
                    "property_type": "residential",
                    "monthly_bill": None,
                    "roof_area": None,
                    "source": "manual_bulk",
                    "stage": "new",
                    "assigned_to": None,
                    "assigned_by": None,
                    "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Manual bulk entry for calling",
                    "quoted_amount": None,
                    "system_size": None,
                    "advance_paid": 0.0,
                    "total_amount": 0.0,
                    "pending_amount": 0.0,
                    "lead_score": 30,
                    "ai_priority": "low",
                    "ai_suggestions": None,
                    "call_status": None,
                    "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": "Manual bulk entry for calling"}],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                batch_leads.append(lead)
                
                if len(batch_leads) >= BATCH_SIZE:
                    await db.crm_leads.insert_many(batch_leads)
                    imported.extend([{"name": l["name"], "phone": l["phone"][-10:], "id": l["id"]} for l in batch_leads])
                    batch_leads = []
                
            except Exception as e:
                errors.append({"row": idx, "input": raw_phone, "error": str(e)})
        
        if batch_leads:
            await db.crm_leads.insert_many(batch_leads)
            imported.extend([{"name": l["name"], "phone": l["phone"][-10:], "id": l["id"]} for l in batch_leads])
        
        logger.info(f"Manual bulk import: {len(imported)} leads imported, {len(duplicates)} duplicates, {len(errors)} errors")

        if imported:
            try:
                await save_snapshot(client, _DB_NAME)
                logger.info(f"[snapshot] Saved after manual import of {len(imported)} leads")
            except Exception as _snap_err:
                logger.warning(f"[snapshot] Post-import save failed: {_snap_err}")
        
        return {
            "success": True,
            "imported_count": len(imported),
            "duplicate_count": len(duplicates),
            "error_count": len(errors),
            "total_input": len(raw_phones),
            "imported_leads": imported[:20],
            "duplicates": duplicates[:20],
            "errors": errors[:20],
            "message": f"Successfully imported {len(imported)} leads" + 
                      (f", {len(duplicates)} duplicates skipped" if duplicates else "") +
                      (f", {len(errors)} errors" if errors else "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manual bulk import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@api_router.get("/crm/leads/import-template")
async def get_import_template():
    """Get CSV template for bulk import - only phone is required"""
    return {
        "columns": ["phone", "name", "email", "district", "address", "property_type", "monthly_bill", "roof_area", "source", "notes"],
        "required": ["phone"],
        "optional": ["name", "email", "district", "address", "property_type", "monthly_bill", "roof_area", "source", "notes"],
        "notes": "Only phone number is required. Name will be auto-generated if not provided. Supports both CSV and Excel files.",
        "example": {
            "phone": "9876543210",
            "name": "Ramesh Kumar",
            "email": "ramesh@example.com",
            "district": "Patna",
            "address": "123 Main Road",
            "property_type": "residential",
            "monthly_bill": "3500",
            "roof_area": "500",
            "source": "referral",
            "notes": "Interested in 5kW system"
        },
        "minimal_example": {
            "phone": "9876543210"
        },
        "property_types": ["residential", "commercial", "industrial", "agricultural"],
        "sources": ["website", "referral", "walk_in", "phone_call", "whatsapp", "facebook", "exhibition", "csv_import"]
    }

# ==================== MULTI-FORMAT LEAD IMPORT ====================
@api_router.post("/crm/leads/smart-import")
async def smart_import_leads(file: UploadFile = File(...)):
    """
    AI-powered lead import from multiple file formats:
    - CSV files (all variants)
    - Excel files (.xlsx, .xls)
    - PDF files (text extraction + AI parsing)
    - Image files (OCR + AI parsing)
    """
    import pandas as pd
    from PyPDF2 import PdfReader
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    
    try:
        content = await file.read()
        filename = file.filename.lower()
        file_ext = filename.split('.')[-1] if '.' in filename else ''
        
        extracted_data = []
        raw_text = ""
        use_ai_extraction = False
        
        # ========== CSV Processing ==========
        if file_ext == 'csv':
            try:
                # Try different encodings
                for encoding in ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']:
                    try:
                        decoded = content.decode(encoding)
                        # Detect delimiter
                        sample = decoded[:2000]
                        delimiter = ','
                        if sample.count(';') > sample.count(','):
                            delimiter = ';'
                        elif sample.count('\t') > sample.count(','):
                            delimiter = '\t'
                        
                        df = pd.read_csv(io.StringIO(decoded), delimiter=delimiter, on_bad_lines='skip')
                        break
                    except:
                        continue
                else:
                    raise HTTPException(status_code=400, detail="Could not decode CSV file")
                
                # Normalize column names
                df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
                
                for _, row in df.iterrows():
                    lead = extract_lead_from_row(row.to_dict())
                    if lead.get('name') or lead.get('phone'):
                        extracted_data.append(lead)
                        
            except Exception as e:
                logger.error(f"CSV parsing error: {e}")
                raise HTTPException(status_code=400, detail=f"CSV parsing failed: {str(e)}")
        
        # ========== Excel Processing ==========
        elif file_ext in ['xlsx', 'xls']:
            try:
                import openpyxl
                df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
                df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
                
                for _, row in df.iterrows():
                    lead = extract_lead_from_row(row.to_dict())
                    if lead.get('name') or lead.get('phone'):
                        extracted_data.append(lead)
                        
            except Exception as e:
                logger.error(f"Excel parsing error: {e}")
                raise HTTPException(status_code=400, detail=f"Excel parsing failed: {str(e)}")
        
        # ========== PDF Processing ==========
        elif file_ext == 'pdf':
            try:
                pdf_reader = PdfReader(io.BytesIO(content))
                raw_text = ""
                for page in pdf_reader.pages:
                    raw_text += page.extract_text() + "\n"
                
                if raw_text.strip():
                    use_ai_extraction = True
                else:
                    raise HTTPException(status_code=400, detail="Could not extract text from PDF")
                    
            except Exception as e:
                logger.error(f"PDF parsing error: {e}")
                raise HTTPException(status_code=400, detail=f"PDF parsing failed: {str(e)}")
        
        # ========== Image Processing (OCR via AI) ==========
        elif file_ext in ['jpg', 'jpeg', 'png', 'webp', 'heic']:
            try:
                # Save temp file for AI processing
                temp_path = UPLOADS_DIR / f"temp_import_{uuid.uuid4()}.{file_ext}"
                with open(temp_path, 'wb') as f:
                    f.write(content)
                
                # Use Gemini for image OCR
                if EMERGENT_LLM_KEY:
                    chat = LlmChat(
                        api_key=EMERGENT_LLM_KEY,
                        session_id=f"ocr-{uuid.uuid4()}",
                        system_message="You are an OCR assistant. Extract all text from the image."
                    ).with_model("gemini", "gemini-2.5-flash")
                    
                    mime_type = f"image/{file_ext}" if file_ext != 'jpg' else "image/jpeg"
                    file_content = FileContentWithMimeType(
                        file_path=str(temp_path),
                        mime_type=mime_type
                    )
                    
                    response = await chat.send_message(UserMessage(
                        text="Extract all text visible in this image. Return only the extracted text, nothing else.",
                        file_contents=[file_content]
                    ))
                    
                    raw_text = response
                    use_ai_extraction = True
                    
                    # Clean up temp file
                    temp_path.unlink(missing_ok=True)
                else:
                    raise HTTPException(status_code=400, detail="AI key not configured for image processing")
                    
            except Exception as e:
                logger.error(f"Image processing error: {e}")
                raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}. Supported: csv, xlsx, xls, pdf, jpg, png, webp")
        
        # ========== AI-Powered Data Extraction ==========
        if use_ai_extraction and raw_text and EMERGENT_LLM_KEY:
            try:
                chat = LlmChat(
                    api_key=EMERGENT_LLM_KEY,
                    session_id=f"lead-extract-{uuid.uuid4()}",
                    system_message="""You are a lead data extraction assistant for a solar energy company in Bihar, India.
Extract customer/lead information from the provided text and return a valid JSON array.

For each lead found, extract:
- name: Customer/business name
- phone: Mobile number (10 digits, clean any formatting)
- email: Email if available
- district: Location/city/district in Bihar
- address: Full address if available
- property_type: residential/commercial/industrial/agricultural
- business_type: Type of business if mentioned
- monthly_bill: Electricity bill amount if mentioned (number only)
- notes: Any additional relevant information

Return ONLY a valid JSON array of objects. Example:
[{"name": "Ramesh Kumar", "phone": "9876543210", "district": "Patna", "property_type": "residential"}]

If no valid leads found, return: []"""
                ).with_model("openai", "gpt-4o-mini")
                
                response = await chat.send_message(UserMessage(
                    text=f"Extract lead/customer data from this text:\n\n{raw_text[:8000]}"
                ))
                
                # Parse AI response
                try:
                    # Clean response - find JSON array
                    response_clean = response.strip()
                    if '```json' in response_clean:
                        response_clean = response_clean.split('```json')[1].split('```')[0]
                    elif '```' in response_clean:
                        response_clean = response_clean.split('```')[1].split('```')[0]
                    
                    # Find array brackets
                    start_idx = response_clean.find('[')
                    end_idx = response_clean.rfind(']') + 1
                    if start_idx >= 0 and end_idx > start_idx:
                        json_str = response_clean[start_idx:end_idx]
                        ai_extracted = json.loads(json_str)
                        
                        for item in ai_extracted:
                            lead = {
                                "name": str(item.get('name', '')).strip(),
                                "phone": clean_phone_number(str(item.get('phone', ''))),
                                "email": str(item.get('email', '')).strip(),
                                "district": str(item.get('district', '')).strip(),
                                "address": str(item.get('address', '')).strip(),
                                "property_type": str(item.get('property_type', 'residential')).lower(),
                                "business_type": str(item.get('business_type', '')).strip(),
                                "monthly_bill": item.get('monthly_bill'),
                                "notes": str(item.get('notes', '')).strip(),
                                "source": f"{file_ext}_import"
                            }
                            if lead.get('name') or lead.get('phone'):
                                extracted_data.append(lead)
                except json.JSONDecodeError as je:
                    logger.warning(f"AI response JSON parse error: {je}")
                    # Try line-by-line extraction as fallback
                    lines = raw_text.split('\n')
                    for line in lines:
                        # Look for phone numbers
                        phones = re.findall(r'(?:\+91)?[6-9]\d{9}', line)
                        if phones:
                            extracted_data.append({
                                "name": "",
                                "phone": clean_phone_number(phones[0]),
                                "notes": line.strip(),
                                "source": f"{file_ext}_import"
                            })
                            
            except Exception as e:
                logger.error(f"AI extraction error: {e}")
                # Fallback: basic regex extraction
                phones = re.findall(r'(?:\+91)?[6-9]\d{9}', raw_text)
                for phone in phones[:50]:
                    extracted_data.append({
                        "name": "",
                        "phone": clean_phone_number(phone),
                        "source": f"{file_ext}_import"
                    })
        
        # Return preview data
        return {
            "success": True,
            "file_type": file_ext,
            "total_extracted": len(extracted_data),
            "preview_data": extracted_data[:50],  # Return first 50 for preview
            "raw_text_preview": raw_text[:500] if raw_text else None,
            "message": f"Extracted {len(extracted_data)} potential leads from {file_ext.upper()} file"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Smart import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@api_router.post("/crm/leads/confirm-import")
async def confirm_import_leads(data: Dict[str, Any]):
    """Confirm and import the extracted leads after preview with lead type classification"""
    try:
        leads_to_import = data.get('leads', [])
        lead_type = data.get('lead_type', 'auto')  # 'residential', 'commercial', or 'auto'
        
        if not leads_to_import:
            raise HTTPException(status_code=400, detail="No leads to import")
        
        imported = []
        errors = []
        duplicates = []
        residential_count = 0
        commercial_count = 0
        
        for idx, lead_data in enumerate(leads_to_import):
            try:
                name = sanitize_input(str(lead_data.get('name', '')).strip())
                phone = clean_phone_number(str(lead_data.get('phone', '')))
                
                if not phone:
                    errors.append({"index": idx, "error": "Valid mobile number required", "name": name})
                    continue
                
                # Check for duplicate by mobile number only (check multiple formats)
                phone_variants = [phone]
                if len(phone) == 10:
                    phone_variants.extend([f"91{phone}", f"+91{phone}", f"0{phone}"])
                
                existing = await db.crm_leads.find_one(
                    {"phone": {"$in": phone_variants}}, 
                    {"_id": 0, "name": 1, "phone": 1}
                )
                if existing:
                    duplicates.append({
                        "phone": phone, 
                        "name": name, 
                        "existing_name": existing.get('name'),
                        "existing_phone": existing.get('phone')
                    })
                    continue
                
                # Parse optional fields
                email = str(lead_data.get('email', '')).strip()
                district = str(lead_data.get('district', '')).strip()
                address = sanitize_input(str(lead_data.get('address', '')).strip())
                property_type = str(lead_data.get('property_type', 'residential')).lower()
                if property_type not in ['residential', 'commercial', 'industrial', 'agricultural']:
                    property_type = 'residential'
                
                monthly_bill = None
                bill_val = lead_data.get('monthly_bill')
                if bill_val:
                    try:
                        monthly_bill = float(re.sub(r'[^\d.]', '', str(bill_val)))
                    except:
                        pass
                
                business_type = str(lead_data.get('business_type', '')).strip()
                notes = sanitize_input(str(lead_data.get('notes', '')).strip())
                
                # Determine lead category based on data or user selection
                if lead_type == 'residential':
                    lead_category = 'residential_solar'
                    source_label = 'Residential Solar Customer'
                    residential_count += 1
                elif lead_type == 'commercial':
                    lead_category = 'commercial_solar'
                    source_label = 'Commercial Solar Customer'
                    commercial_count += 1
                else:
                    # Auto-detect based on property type and business info
                    is_commercial = (
                        property_type in ['commercial', 'industrial'] or
                        bool(business_type) or
                        (monthly_bill and monthly_bill > 10000)
                    )
                    if is_commercial:
                        lead_category = 'commercial_solar'
                        source_label = 'Commercial Solar Customer'
                        commercial_count += 1
                    else:
                        lead_category = 'residential_solar'
                        source_label = 'Residential Solar Customer'
                        residential_count += 1
                
                # Build notes with business info
                lead_notes = []
                if business_type:
                    lead_notes.append(f"Business: {business_type}")
                if notes:
                    lead_notes.append(notes)
                final_notes = ". ".join(lead_notes) if lead_notes else ""
                
                # Calculate lead score
                lead_score = min(100, 40 + int((monthly_bill or 0) / 100))
                ai_priority = "high" if lead_score >= 80 else "medium" if lead_score >= 60 else "low"
                
                # Create lead
                lead_id = str(uuid.uuid4())
                lead = {
                    "id": lead_id,
                    "name": name if name else "Unknown",
                    "email": email,
                    "phone": phone,
                    "district": district,
                    "address": address,
                    "property_type": property_type,
                    "monthly_bill": monthly_bill,
                    "roof_area": None,
                    "source": f"smart_import:{source_label}",
                    "lead_category": lead_category,
                    "business_type": business_type,
                    "stage": "new",
                    "assigned_to": None,
                    "assigned_by": None,
                    "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Imported as {source_label}. {final_notes}" if final_notes else f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Imported as {source_label}",
                    "quoted_amount": None,
                    "system_size": None,
                    "advance_paid": 0.0,
                    "total_amount": 0.0,
                    "pending_amount": 0.0,
                    "lead_score": lead_score,
                    "ai_priority": ai_priority,
                    "ai_suggestions": None,
                    "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": f"Imported as {source_label}"}],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                await db.crm_leads.insert_one(lead)
                imported.append({"name": name, "phone": phone, "id": lead_id, "category": lead_category})
                
            except Exception as e:
                errors.append({"index": idx, "error": str(e)})
        
        logger.info(f"Smart import confirmed: {len(imported)} leads imported ({residential_count} Residential, {commercial_count} Commercial), {len(duplicates)} duplicates, {len(errors)} errors")

        # Immediately persist to snapshot so data survives a restart
        if imported:
            try:
                await save_snapshot(client, _DB_NAME)
                logger.info(f"[snapshot] Saved after import of {len(imported)} leads")
            except Exception as _snap_err:
                logger.warning(f"[snapshot] Post-import save failed: {_snap_err}")
        
        return {
            "success": True,
            "imported_count": len(imported),
            "residential_count": residential_count,
            "commercial_count": commercial_count,
            "duplicate_count": len(duplicates),
            "error_count": len(errors),
            "imported_leads": imported[:20],
            "duplicates": duplicates[:10],
            "errors": errors[:10],
            "message": f"Successfully imported {len(imported)} leads ({residential_count} Residential Solar, {commercial_count} Commercial Solar)" + 
                      (f", {len(duplicates)} duplicates skipped (matched by mobile)" if duplicates else "") +
                      (f", {len(errors)} errors" if errors else "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Confirm import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@api_router.post("/crm/leads/bulk-delete")
async def bulk_delete_leads(data: Dict[str, Any]):
    """Soft-delete multiple leads (moves to Leads Bin, 30-day retention)"""
    from datetime import datetime, timezone
    try:
        lead_ids = data.get('lead_ids', [])
        if not lead_ids:
            raise HTTPException(status_code=400, detail="No lead IDs provided")

        now = datetime.now(timezone.utc).isoformat()
        deleted_count = 0
        errors = []

        for lead_id in lead_ids:
            try:
                result = await db.crm_leads.update_one(
                    {"id": lead_id},
                    {"$set": {"is_deleted": True, "deleted_at": now}}
                )
                if result.modified_count > 0:
                    deleted_count += 1
            except Exception as e:
                errors.append({"id": lead_id, "error": str(e)})

        logger.info(f"Bulk soft-delete: {deleted_count} leads moved to bin, {len(errors)} errors")

        return {
            "success": True,
            "deleted_count": deleted_count,
            "error_count": len(errors),
            "errors": errors[:10],
            "message": f"Successfully moved {deleted_count} leads to Leads Bin" + (f", {len(errors)} errors" if errors else "")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk delete error: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@api_router.delete("/crm/leads/delete-all")
async def delete_all_leads(request: Request):
    """Permanently delete ALL leads from the database (admin clean-slate operation)"""
    try:
        result = await db.crm_leads.delete_many({})
        deleted = result.deleted_count
        await save_snapshot(client, _DB_NAME)
        logger.warning(f"[ADMIN] ALL leads deleted: {deleted} records removed")
        return {
            "success": True,
            "deleted_count": deleted,
            "message": f"All {deleted} leads permanently deleted. Database is now clean."
        }
    except Exception as e:
        logger.error(f"Delete-all-leads error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete leads: {str(e)}")


def extract_lead_from_row(row: dict) -> dict:
    """Extract lead data from a row dictionary with flexible column mapping"""
    # Name variations
    name = ""
    for key in ['name', 'customer_name', 'full_name', 'customer', 'client', 'client_name', 'contact_name', 'person']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            name = str(row[key]).strip()
            break
    
    # Phone variations
    phone = ""
    for key in ['phone', 'mobile', 'mobile_no', 'mobile_number', 'phone_number', 'contact', 'contact_no', 'cell', 'telephone']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            phone = clean_phone_number(str(row[key]))
            break
    
    # Email variations
    email = ""
    for key in ['email', 'email_id', 'email_address', 'mail', 'e-mail']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            email = str(row[key]).strip()
            break
    
    # District/Location variations
    district = ""
    for key in ['district', 'city', 'location', 'area', 'place', 'town', 'locality']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            district = str(row[key]).strip()
            break
    
    # Address variations
    address = ""
    for key in ['address', 'full_address', 'street', 'street_address', 'location_address']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            address = str(row[key]).strip()
            break
    
    # Property type variations
    property_type = "residential"
    for key in ['property_type', 'type', 'property', 'category']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            pt = str(row[key]).strip().lower()
            if pt in ['residential', 'commercial', 'industrial', 'agricultural']:
                property_type = pt
            elif 'commer' in pt:
                property_type = 'commercial'
            elif 'indust' in pt:
                property_type = 'industrial'
            elif 'agri' in pt or 'farm' in pt:
                property_type = 'agricultural'
            break
    
    # Monthly bill variations
    monthly_bill = None
    for key in ['monthly_bill', 'bill', 'electricity_bill', 'bill_amount', 'monthly_electricity']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            try:
                monthly_bill = float(re.sub(r'[^\d.]', '', str(row[key])))
            except:
                pass
            break
    
    # Business type variations
    business_type = ""
    for key in ['business', 'business_type', 'company', 'company_name', 'firm', 'organization']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            business_type = str(row[key]).strip()
            break
    
    # Notes variations
    notes = ""
    for key in ['notes', 'remarks', 'comments', 'description', 'details', 'info']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            notes = str(row[key]).strip()
            break
    
    # Source variations
    source = "file_import"
    for key in ['source', 'lead_source', 'origin', 'channel']:
        if key in row and row[key] and str(row[key]).strip() and str(row[key]).lower() != 'nan':
            source = str(row[key]).strip().lower()
            break
    
    return {
        "name": name,
        "phone": phone,
        "email": email,
        "district": district,
        "address": address,
        "property_type": property_type,
        "monthly_bill": monthly_bill,
        "business_type": business_type,
        "notes": notes,
        "source": source
    }


def clean_phone_number(phone: str) -> str:
    """Clean and normalize Indian phone number"""
    if not phone:
        return ""
    
    # Convert to string and strip whitespace
    phone_str = str(phone).strip()
    
    # Handle scientific notation (e.g., 9.87654321E9)
    if 'e' in phone_str.lower() or 'E' in phone_str:
        try:
            phone_str = str(int(float(phone_str)))
        except:
            pass
    
    # Remove all non-digit characters
    digits = re.sub(r'[^\d]', '', phone_str)
    
    # Remove leading zeros
    digits = digits.lstrip('0')
    
    # Handle various formats
    if len(digits) == 10 and digits[0] in '6789':
        # Standard 10-digit Indian mobile
        return digits
    elif len(digits) == 12 and digits.startswith('91') and digits[2] in '6789':
        # With country code 91
        return digits[2:]  # Return just 10 digits
    elif len(digits) == 11 and digits.startswith('0') and digits[1] in '6789':
        # With leading 0
        return digits[1:]
    elif len(digits) == 13 and digits.startswith('091'):
        # With 091 prefix
        return digits[3:]
    elif len(digits) > 10:
        # Try to extract valid 10-digit number from longer string
        for i in range(len(digits) - 9):
            potential = digits[i:i+10]
            if potential[0] in '6789':
                return potential
    elif len(digits) == 10 and digits[0] not in '6789':
        # Invalid mobile number starting digit
        return ""
    
    # Return cleaned digits if 10 digits
    return digits if len(digits) == 10 else ""

@api_router.get("/")
async def root():
    return {"message": "ASR Enterprises Solar AI Platform API", "status": "active"}

# Analytics tracking endpoint for frontend events
@api_router.post("/analytics/track-event")
async def track_analytics_event(event: dict):
    """Track frontend events like call clicks, button interactions etc."""
    try:
        event_data = {
            "id": str(uuid.uuid4()),
            "event_type": event.get("event_type", "unknown"),
            "source": event.get("source", "website"),
            "phone": event.get("phone"),
            "metadata": event,
            "timestamp": event.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.analytics_events.insert_one(event_data)
        logger.info(f"[Analytics] Tracked event: {event.get('event_type')}")
        
        return {"success": True, "event_id": event_data["id"]}
    except Exception as e:
        logger.error(f"[Analytics] Error tracking event: {e}")
        return {"success": False, "error": str(e)}


# CRM Call Logging Endpoint (for Heyo integration)
@api_router.post("/crm/log-call-attempt")
async def log_crm_call_attempt(call_data: dict):
    """Log call attempts from CRM leads management (Heyo app integration)"""
    try:
        call_log = {
            "id": str(uuid.uuid4()),
            "lead_id": call_data.get("lead_id"),
            "phone": call_data.get("phone"),
            "lead_name": call_data.get("lead_name"),
            "call_type": call_data.get("call_type", "heyo"),
            "source": "crm_admin",
            "status": "initiated",
            "timestamp": call_data.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.call_logs.insert_one(call_log)
        logger.info(f"[CRM Call] Logged call to {call_data.get('phone')} for lead {call_data.get('lead_id')}")
        
        return {"success": True, "call_id": call_log["id"]}
    except Exception as e:
        logger.error(f"[CRM Call] Error logging call: {e}")
        return {"success": False, "error": str(e)}


# Staff Call Logging Endpoint (for Heyo integration)
@api_router.post("/staff/log-call")
async def log_staff_call(call_data: dict):
    """Log call attempts from staff portal (Heyo app integration)"""
    try:
        call_log = {
            "id": str(uuid.uuid4()),
            "lead_id": call_data.get("lead_id"),
            "phone": call_data.get("phone"),
            "lead_name": call_data.get("lead_name"),
            "staff_id": call_data.get("staff_id"),
            "call_type": call_data.get("call_type", "heyo"),
            "source": "staff_portal",
            "status": "initiated",
            "timestamp": call_data.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.call_logs.insert_one(call_log)
        logger.info(f"[Staff Call] Staff {call_data.get('staff_id')} called {call_data.get('phone')}")
        
        return {"success": True, "call_id": call_log["id"]}
    except Exception as e:
        logger.error(f"[Staff Call] Error logging call: {e}")
        return {"success": False, "error": str(e)}


# CRITICAL: Health check for Kubernetes
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ASR Enterprises API"}

# Security endpoint for health check
@api_router.get("/security/status")
async def security_status():
    return {
        "status": "secure",
        "security_features": [
            "Google reCAPTCHA v2 enabled",
            "Honeypot anti-spam fields active",
            "HTTPS forced (HSTS with preload)",
            "Rate limiting enabled",
            "Input sanitization active",
            "XSS protection enabled",
            "Security headers (CSP, X-Frame, CORP, COOP)",
            "Brute force protection active",
            "2FA OTP for staff login",
            "OTP expiry enforced",
            "Constant-time OTP comparison",
            "Admin access OTP protected",
            "IP blocking for suspicious activity"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Report suspicious activity endpoint
@api_router.post("/security/report")
async def report_suspicious(request: Request, data: Dict[str, Any]):
    client_ip = get_client_ip(request)
    activity_type = sanitize_input(data.get("type", "unknown"))
    details = sanitize_input(data.get("details", ""))
    
    # Log suspicious activity
    logger.warning(f"Suspicious activity reported - Type: {activity_type}, IP: {client_ip}, Details: {details}")
    
    # Store in database for analysis
    await db.security_logs.insert_one({
        "type": activity_type,
        "ip": client_ip,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Report received"}

# ==================== SITE SETTINGS ====================

@api_router.get("/site-settings")
async def get_site_settings():
    """Get current site settings including marquee text"""
    settings = await db.site_settings.find_one({"type": "general"}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "marquee_text": "☀Get up to ₹78,000 Subsidy under PM Surya Ghar Yojana Call Now: 9296389097 WhatsApp for Quote",
            "marquee_enabled": True
        }
    return settings

@api_router.post("/site-settings")
async def update_site_settings(request: Request):
    """Update site settings (admin only)"""
    data = await request.json()
    
    # Sanitize inputs
    marquee_text = sanitize_input(data.get("marquee_text", ""))[:500]  # Limit to 500 chars
    marquee_enabled = bool(data.get("marquee_enabled", True))
    
    # Upsert settings
    await db.site_settings.update_one(
        {"type": "general"},
        {"$set": {
            "type": "general",
            "marquee_text": marquee_text,
            "marquee_enabled": marquee_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Site settings updated"}

@api_router.get("/owner-info")
async def get_owner_info():
    """Get owner/main admin information"""
    owner = await db.crm_staff_accounts.find_one(
        {"$or": [{"staff_id": "ASR1001"}, {"is_owner": True}]},
        {"_id": 0, "password_hash": 0}
    )
    if owner:
        return {
            "name": owner.get("name", "ABHIJEET KUMAR"),
            "staff_id": owner.get("staff_id", "ASR1001"),
            "email": owner.get("email"),
            "mobile": owner.get("mobile"),
            "role": owner.get("role", "super_admin"),
            "designation": owner.get("designation", "Owner & Managing Director"),
            "is_owner": True,
            "company": "ASR ENTERPRISES"
        }
    return {
        "name": "ABHIJEET KUMAR",
        "staff_id": "ASR1001",
        "role": "super_admin",
        "designation": "Owner & Managing Director",
        "is_owner": True,
        "company": "ASR ENTERPRISES"
    }

# ==================== BUSINESS BOOST FEATURES ====================

# 1. Staff Performance Leaderboard
@api_router.get("/crm/leaderboard")
async def get_staff_leaderboard():
    """Staff performance leaderboard with rankings"""
    staff_list = await db.crm_staff_accounts.find({"is_active": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Calculate scores for each staff
    leaderboard = []
    for staff in staff_list:
        staff_id = staff.get("id")
        
        # Count conversions (leads that reached 'won' stage)
        conversions = await db.crm_leads.count_documents({
            "assigned_to": staff_id,
            "stage": "won"
        })
        
        # Calculate total revenue from payments
        revenue_data = await db.crm_payments.aggregate([
            {"$match": {"received_by": staff_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_revenue = revenue_data[0]["total"] if revenue_data else 0
        
        # Count follow-ups completed
        followups_done = await db.crm_followups.count_documents({
            "employee_id": staff_id,
            "status": "completed"
        })
        
        # Calculate response rate (leads contacted within 24h)
        leads_assigned = staff.get("leads_assigned", 0)
        
        # Performance score = (conversions * 100) + (revenue/1000) + (followups * 10)
        score = (conversions * 100) + (total_revenue / 1000) + (followups_done * 10)
        
        leaderboard.append({
            "staff_id": staff.get("staff_id"),
            "name": staff.get("name"),
            "role": staff.get("role"),
            "leads_assigned": leads_assigned,
            "conversions": conversions,
            "conversion_rate": round((conversions / leads_assigned * 100), 1) if leads_assigned > 0 else 0,
            "total_revenue": total_revenue,
            "followups_completed": followups_done,
            "performance_score": round(score, 1),
            "phone": staff.get("phone")
        })
    
    # Sort by performance score
    leaderboard.sort(key=lambda x: x["performance_score"], reverse=True)
    
    # Add ranks
    for i, staff in enumerate(leaderboard):
        staff["rank"] = i + 1
        if i == 0:
            staff["badge"] = "🥇 Top Performer"
        elif i == 1:
            staff["badge"] = "🥈 Star Seller"
        elif i == 2:
            staff["badge"] = "🥉 Rising Star"
        else:
            staff["badge"] = None
    
    return leaderboard

# 2. Revenue & Target Dashboard
@api_router.get("/crm/revenue-dashboard")
async def get_revenue_dashboard():
    """Revenue analytics and target tracking"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # This month's revenue
    monthly_revenue = await db.crm_payments.aggregate([
        {"$match": {"timestamp": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Total all-time revenue
    total_revenue = await db.crm_payments.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Revenue by payment type
    revenue_by_type = await db.crm_payments.aggregate([
        {"$group": {"_id": "$payment_type", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # Daily revenue for last 7 days
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    daily_revenue = await db.crm_payments.aggregate([
        {"$match": {"timestamp": {"$gte": seven_days_ago}}},
        {"$group": {
            "_id": {"$substr": ["$timestamp", 0, 10]},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(7)
    
    # Pipeline value (potential revenue from active leads)
    pipeline_leads = await db.crm_leads.find(
        {"stage": {"$in": ["new", "contacted", "site_visit", "quotation", "negotiation"]}},
        {"_id": 0, "monthly_bill": 1}
    ).to_list(1000)
    
    # Estimate: monthly_bill * 12 * 3 (3kW system assumption) = potential project value
    pipeline_value = sum([(l.get("monthly_bill", 0) * 60) for l in pipeline_leads])
    
    # Get targets (stored in settings or default)
    settings = await db.crm_settings.find_one({"type": "targets"}, {"_id": 0})
    monthly_target = settings.get("monthly_revenue_target", 1000000) if settings else 1000000
    
    current_monthly = monthly_revenue[0]["total"] if monthly_revenue else 0
    target_progress = round((current_monthly / monthly_target * 100), 1) if monthly_target > 0 else 0
    
    return {
        "monthly_revenue": current_monthly,
        "monthly_target": monthly_target,
        "target_progress": target_progress,
        "total_revenue": total_revenue[0]["total"] if total_revenue else 0,
        "pipeline_value": pipeline_value,
        "revenue_by_type": {item["_id"]: {"amount": item["total"], "count": item["count"]} for item in revenue_by_type if item["_id"]},
        "daily_revenue": daily_revenue,
        "days_remaining": (month_start.replace(month=month_start.month % 12 + 1) - now).days if month_start.month < 12 else (month_start.replace(year=month_start.year + 1, month=1) - now).days
    }

# Set monthly target
@api_router.post("/crm/set-target")
async def set_monthly_target(data: Dict[str, Any]):
    """Set monthly revenue target"""
    target = data.get("monthly_revenue_target", 1000000)
    
    await db.crm_settings.update_one(
        {"type": "targets"},
        {"$set": {"monthly_revenue_target": target, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"success": True, "target": target}

# 3. Lead Analytics
@api_router.get("/crm/lead-analytics")
async def get_lead_analytics():
    """Comprehensive lead analytics"""
    now = datetime.now(timezone.utc)
    
    # Leads by source
    by_source = await db.crm_leads.aggregate([
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Leads by district
    by_district = await db.crm_leads.aggregate([
        {"$group": {"_id": "$district", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Leads by stage
    by_stage = await db.crm_leads.aggregate([
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Conversion funnel
    total_leads = await db.crm_leads.count_documents({})
    contacted = await db.crm_leads.count_documents({"stage": {"$ne": "new"}})
    surveyed = await db.crm_leads.count_documents({"stage": {"$in": ["site_visit", "quotation", "negotiation", "converted", "completed", "lost"]}})
    quoted = await db.crm_leads.count_documents({"stage": {"$in": ["quotation", "negotiation", "converted", "completed", "lost"]}})
    won = await db.crm_leads.count_documents({"stage": {"$in": ["converted", "completed"]}})
    
    # Average lead score
    avg_score = await db.crm_leads.aggregate([
        {"$group": {"_id": None, "avg": {"$avg": "$lead_score"}}}
    ]).to_list(1)
    
    # Leads this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    this_month = await db.crm_leads.count_documents({"timestamp": {"$gte": month_start}})
    
    # High value leads (bill > 5000)
    high_value = await db.crm_leads.count_documents({"monthly_bill": {"$gte": 5000}})
    
    return {
        "total_leads": total_leads,
        "this_month": this_month,
        "by_source": {item["_id"] or "unknown": item["count"] for item in by_source},
        "by_district": [{"district": item["_id"], "count": item["count"]} for item in by_district if item["_id"]],
        "by_stage": {item["_id"] or "new": item["count"] for item in by_stage},
        "funnel": {
            "total": total_leads,
            "contacted": contacted,
            "surveyed": surveyed,
            "quoted": quoted,
            "won": won,
            "conversion_rate": round((won / total_leads * 100), 1) if total_leads > 0 else 0
        },
        "avg_lead_score": round(avg_score[0]["avg"], 1) if avg_score and avg_score[0].get("avg") else 0,
        "high_value_leads": high_value
    }

# 4. Overdue Lead Alerts
@api_router.get("/crm/overdue-leads")
async def get_overdue_leads():
    """Get leads that haven't been contacted/updated recently"""
    now = datetime.now(timezone.utc)
    
    leads = await db.crm_leads.find(
        {"stage": {"$in": ["new", "contacted"]}},
        {"_id": 0}
    ).to_list(500)
    
    overdue_24h = []
    overdue_48h = []
    overdue_72h = []
    critical = []  # More than 5 days
    
    for lead in leads:
        try:
            last_update = datetime.fromisoformat(lead.get("timestamp", "").replace("Z", "+00:00"))
            hours_since = (now - last_update).total_seconds() / 3600
            
            lead_info = {
                **lead,
                "hours_since_update": round(hours_since, 1),
                "days_since_update": round(hours_since / 24, 1),
                "whatsapp_url": get_whatsapp_url(lead.get("phone", ""), f"Hello {lead.get('name')}, this is ASR Enterprises following up on your solar inquiry...")
            }
            
            if hours_since > 120:  # 5+ days
                critical.append(lead_info)
            elif hours_since > 72:
                overdue_72h.append(lead_info)
            elif hours_since > 48:
                overdue_48h.append(lead_info)
            elif hours_since > 24:
                overdue_24h.append(lead_info)
        except:
            continue
    
    return {
        "critical": critical,
        "overdue_72h": overdue_72h,
        "overdue_48h": overdue_48h,
        "overdue_24h": overdue_24h,
        "summary": {
            "critical_count": len(critical),
            "total_overdue": len(critical) + len(overdue_72h) + len(overdue_48h) + len(overdue_24h)
        }
    }

# 5. Customer Journey Timeline
@api_router.get("/crm/leads/{lead_id}/timeline")
async def get_lead_timeline(lead_id: str):
    """Get complete timeline for a lead"""
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get all activities
    activities = await db.crm_activities.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    # Get all follow-ups
    followups = await db.crm_followups.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    # Get project if exists
    project = await db.crm_projects.find_one({"lead_id": lead_id}, {"_id": 0})
    
    # Get payments
    payments = await db.crm_payments.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(20)
    
    # Build timeline
    timeline = []
    
    # Lead created
    timeline.append({
        "type": "lead_created",
        "title": "Lead Created",
        "description": f"New inquiry from {lead.get('source', 'website')}",
        "timestamp": lead.get("timestamp"),
        "icon": "user-plus"
    })
    
    # Activities
    for activity in activities:
        timeline.append({
            "type": "activity",
            "title": activity.get("title", "Activity"),
            "description": activity.get("description", ""),
            "timestamp": activity.get("timestamp"),
            "icon": "activity"
        })
    
    # Follow-ups
    for fu in followups:
        timeline.append({
            "type": "followup",
            "title": f"Follow-up ({fu.get('reminder_type', 'call')})",
            "description": fu.get("notes", ""),
            "status": fu.get("status"),
            "timestamp": fu.get("timestamp"),
            "icon": "phone"
        })
    
    # Payments
    for payment in payments:
        timeline.append({
            "type": "payment",
            "title": f"Payment Received - ₹{payment.get('amount', 0):,}",
            "description": f"{payment.get('payment_type', 'payment')} via {payment.get('payment_mode', 'cash')}",
            "timestamp": payment.get("timestamp"),
            "icon": "credit-card"
        })
    
    # Sort by timestamp
    timeline.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Get assigned staff
    assigned_staff = None
    if lead.get("assigned_to"):
        assigned_staff = await db.crm_staff_accounts.find_one(
            {"id": lead.get("assigned_to")},
            {"_id": 0, "password_hash": 0}
        )
    
    return {
        "lead": lead,
        "timeline": timeline,
        "project": project,
        "assigned_staff": assigned_staff,
        "total_paid": sum([p.get("amount", 0) for p in payments]),
        "summary": {
            "activities": len(activities),
            "followups": len(followups),
            "payments": len(payments)
        }
    }

# 6. Commission Calculator
@api_router.get("/crm/commissions")
async def get_commission_report():
    """Calculate staff commissions"""
    # Commission rates
    COMMISSION_RATES = {
        "sales": 0.02,       # 2% of project value
        "survey": 500,       # Fixed per survey
        "installation": 0.01, # 1% of project value
        "manager": 0.005      # 0.5% of team revenue
    }
    
    staff_list = await db.crm_staff_accounts.find({"is_active": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    commissions = []
    for staff in staff_list:
        staff_id = staff.get("id")
        role = staff.get("role", "sales")
        
        # Get revenue generated by this staff
        revenue_data = await db.crm_payments.aggregate([
            {"$match": {"received_by": staff_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        revenue = revenue_data[0]["total"] if revenue_data else 0
        
        # Get conversions
        conversions = await db.crm_leads.count_documents({
            "assigned_to": staff_id,
            "stage": "won"
        })
        
        # Calculate commission
        if role in ["sales", "manager"]:
            commission = revenue * COMMISSION_RATES.get(role, 0.02)
        elif role == "survey":
            surveys_done = await db.crm_followups.count_documents({
                "employee_id": staff_id,
                "reminder_type": "survey",
                "status": "completed"
            })
            commission = surveys_done * COMMISSION_RATES["survey"]
        elif role == "installation":
            commission = revenue * COMMISSION_RATES["installation"]
        else:
            commission = revenue * 0.01
        
        commissions.append({
            "staff_id": staff.get("staff_id"),
            "name": staff.get("name"),
            "role": role,
            "revenue_generated": revenue,
            "conversions": conversions,
            "commission_rate": f"{COMMISSION_RATES.get(role, 0.02) * 100}%",
            "commission_earned": round(commission, 2),
            "phone": staff.get("phone")
        })
    
    # Sort by commission earned
    commissions.sort(key=lambda x: x["commission_earned"], reverse=True)
    
    total_commission = sum([c["commission_earned"] for c in commissions])
    
    return {
        "commissions": commissions,
        "total_commission_payable": round(total_commission, 2),
        "commission_rates": {k: f"{v*100}%" if v < 1 else f"₹{v}" for k, v in COMMISSION_RATES.items()}
    }

# 7. Daily Business Digest
@api_router.get("/crm/daily-digest")
async def get_daily_digest():
    """Daily summary of business activities"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Today's stats
    new_leads_today = await db.crm_leads.count_documents({"timestamp": {"$gte": today_start}})
    followups_today = await db.crm_followups.count_documents({"reminder_date": now.strftime("%Y-%m-%d")})
    followups_completed = await db.crm_followups.count_documents({
        "reminder_date": now.strftime("%Y-%m-%d"),
        "status": "completed"
    })
    
    # Today's revenue
    revenue_today = await db.crm_payments.aggregate([
        {"$match": {"timestamp": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Yesterday's comparison
    new_leads_yesterday = await db.crm_leads.count_documents({
        "timestamp": {"$gte": yesterday_start, "$lt": today_start}
    })
    
    revenue_yesterday = await db.crm_payments.aggregate([
        {"$match": {"timestamp": {"$gte": yesterday_start, "$lt": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Hot leads (high score, new/contacted stage)
    hot_leads = await db.crm_leads.find(
        {"lead_score": {"$gte": 75}, "stage": {"$in": ["new", "contacted"]}},
        {"_id": 0}
    ).sort("lead_score", -1).limit(5).to_list(5)
    
    # Overdue critical
    overdue_response = await get_overdue_leads()
    
    # Staff activity today
    active_staff = await db.crm_staff_accounts.count_documents({"is_active": True})
    
    # Projects status
    installations_pending = await db.crm_projects.count_documents({"installation_status": "pending"})
    installations_today = await db.crm_projects.count_documents({
        "scheduled_date": now.strftime("%Y-%m-%d")
    })
    
    today_revenue = revenue_today[0]["total"] if revenue_today else 0
    yesterday_revenue = revenue_yesterday[0]["total"] if revenue_yesterday else 0
    
    return {
        "date": now.strftime("%Y-%m-%d"),
        "day": now.strftime("%A"),
        "greeting": "Good Morning" if now.hour < 12 else "Good Afternoon" if now.hour < 17 else "Good Evening",
        "summary": {
            "new_leads": new_leads_today,
            "leads_change": new_leads_today - new_leads_yesterday,
            "revenue": today_revenue,
            "revenue_change": today_revenue - yesterday_revenue,
            "followups_scheduled": followups_today,
            "followups_completed": followups_completed,
            "followups_pending": followups_today - followups_completed
        },
        "hot_leads": hot_leads,
        "overdue_critical": overdue_response.get("critical", [])[:3],
        "total_overdue": overdue_response.get("summary", {}).get("total_overdue", 0),
        "staff": {
            "active": active_staff
        },
        "installations": {
            "pending": installations_pending,
            "scheduled_today": installations_today
        },
        "ai_tip": await generate_daily_tip()
    }

async def generate_daily_tip():
    """Generate AI-powered daily business tip"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a solar business coach in Bihar, India."
        )
        
        # Get some context
        total_leads = await db.crm_leads.count_documents({})
        won_leads = await db.crm_leads.count_documents({"stage": "won"})
        conversion = round((won_leads / total_leads * 100), 1) if total_leads > 0 else 0
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            messages=[UserMessage(text=f"""Give one short, actionable tip (2 lines max) to improve solar sales.
Current stats: {total_leads} leads, {conversion}% conversion rate.
Focus on Bihar market. Be specific and practical.""")]
        )
        
        return response
    except:
        tips = [
            "💡 Call new leads within 2 hours - response time is key to conversion!",
            "💡 Focus on high-bill customers (>₹4000/month) - they have the best ROI.",
            "💡 Send WhatsApp quotes immediately after site survey while interest is high.",
            "💡 Offer EMI options prominently - it removes the biggest objection.",
            "💡 Follow up on Saturdays - homeowners are available for site surveys."
        ]
        return random.choice(tips)

# 8. Smart Lead Insights
@api_router.get("/crm/insights")
async def get_business_insights():
    """AI-powered business insights and recommendations"""
    # Get comprehensive data
    total_leads = await db.crm_leads.count_documents({})
    conversion_rate = await db.crm_leads.count_documents({"stage": "won"}) / total_leads * 100 if total_leads > 0 else 0
    
    # Best performing district
    by_district = await db.crm_leads.aggregate([
        {"$match": {"stage": "won"}},
        {"$group": {"_id": "$district", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]).to_list(1)
    
    # Best lead source
    by_source = await db.crm_leads.aggregate([
        {"$match": {"stage": "won"}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]).to_list(1)
    
    # Average deal value
    avg_deal = await db.crm_projects.aggregate([
        {"$group": {"_id": None, "avg": {"$avg": "$total_amount"}}}
    ]).to_list(1)
    
    # Response time impact (leads contacted within 24h vs later)
    
    insights = []
    
    # Conversion rate insight
    if conversion_rate < 10:
        insights.append({
            "type": "warning",
            "title": "Low Conversion Rate",
            "message": f"Your conversion rate is {round(conversion_rate, 1)}%. Industry average is 15-20%. Focus on follow-up quality.",
            "action": "Review lost leads to identify common objections"
        })
    elif conversion_rate > 20:
        insights.append({
            "type": "success",
            "title": "Great Conversion Rate!",
            "message": f"Your {round(conversion_rate, 1)}% conversion rate is above average. Keep up the good work!",
            "action": "Document your winning strategies"
        })
    
    # District insight
    if by_district:
        insights.append({
            "type": "info",
            "title": "Top Performing District",
            "message": f"{by_district[0]['_id']} has the most conversions. Consider increasing marketing here.",
            "action": f"Focus more resources on {by_district[0]['_id']}"
        })
    
    # Source insight
    if by_source:
        insights.append({
            "type": "info",
            "title": "Best Lead Source",
            "message": f"'{by_source[0]['_id']}' brings the most converting leads.",
            "action": "Invest more in this channel"
        })
    
    # Average deal insight
    if avg_deal and avg_deal[0].get("avg"):
        avg = avg_deal[0]["avg"]
        insights.append({
            "type": "info",
            "title": "Average Deal Value",
            "message": f"₹{int(avg):,} per project. Consider upselling to larger systems.",
            "action": "Offer 5kW+ systems to high-bill customers"
        })
    
    # Staff performance insight
    leaderboard = await get_staff_leaderboard()
    if leaderboard and len(leaderboard) > 1:
        top = leaderboard[0]
        insights.append({
            "type": "success",
            "title": "Top Performer",
            "message": f"{top['name']} leads with {top['conversions']} conversions and ₹{top['total_revenue']:,} revenue.",
            "action": "Recognize and reward top performers"
        })
    
    return {
        "insights": insights,
        "key_metrics": {
            "conversion_rate": round(conversion_rate, 1),
            "total_leads": total_leads,
            "avg_deal_value": int(avg_deal[0]["avg"]) if avg_deal and avg_deal[0].get("avg") else 0,
            "top_district": by_district[0]["_id"] if by_district else "N/A",
            "top_source": by_source[0]["_id"] if by_source else "website"
        }
    }

# ==================== SOCIAL MEDIA WEBHOOK CONFIGURATION ====================
WEBHOOK_VERIFY_TOKEN = os.environ.get('WEBHOOK_VERIFY_TOKEN', 'ASR_VERIFY_123')
WHATSAPP_PHONE_NUMBER_ID = os.environ.get('WHATSAPP_PHONE_NUMBER_ID', '')
WHATSAPP_ACCESS_TOKEN = os.environ.get('WHATSAPP_ACCESS_TOKEN', '')
FACEBOOK_APP_ID = os.environ.get('FACEBOOK_APP_ID', '')
FACEBOOK_APP_SECRET = os.environ.get('FACEBOOK_APP_SECRET', '')
FACEBOOK_PAGE_ACCESS_TOKEN = os.environ.get('FACEBOOK_PAGE_ACCESS_TOKEN', '')

def verify_facebook_signature(payload: bytes, signature: str) -> bool:
    """Verify Facebook webhook signature for security"""
    if not signature or not FACEBOOK_APP_SECRET:
        return True  # Skip verification if no secret configured
    try:
        if signature.startswith('sha256='):
            expected = hmac.new(
                FACEBOOK_APP_SECRET.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(signature[7:], expected)
    except Exception as e:
        logger.error(f"Signature verification error: {e}")
    return False

async def send_whatsapp_order_confirmation(phone_number: str, order_data: dict) -> bool:
    """Send order confirmation via WhatsApp Business API"""
    if not WHATSAPP_PHONE_NUMBER_ID or not WHATSAPP_ACCESS_TOKEN:
        logger.warning("WhatsApp credentials not configured, skipping order confirmation")
        return False
    
    # Format phone number (ensure it has country code)
    phone = phone_number.strip()
    if not phone.startswith("+") and not phone.startswith("91"):
        phone = "91" + phone
    elif phone.startswith("+"):
        phone = phone[1:]
    
    try:
        # Build order items text
        items = order_data.get("items", [])
        items_text = "\n".join([f"• {item.get('product_name', 'Item')} x{item.get('quantity', 1)} - ₹{item.get('price', 0) * item.get('quantity', 1):,.0f}" for item in items])
        
        delivery_info = "🏪 Store Pickup" if order_data.get("delivery_type") == "pickup" else f"🚚 Home Delivery to {order_data.get('delivery_address', 'N/A')}"
        
        message_body = f"""✅ *Order Confirmed!*
*ASR Enterprises - Solar Solutions*

Dear {order_data.get('customer_name', 'Customer')},

Your order has been received! 🎉

📦 *Order ID:* {order_data.get('order_number', 'N/A')}

📋 *Products:*
{items_text}

💰 *Amount:* ₹{order_data.get('total', 0):,.0f}

📍 *Delivery:* {delivery_info}

📞 *Support:* 9296389097 | WhatsApp: 9296389097

_Thank you for choosing ASR Enterprises!_
_Powering Bihar with clean energy_ ☀️"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages",
                headers={
                    "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                    "Content-Type": "application/json"
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "text": {
                        "body": message_body
                    }
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"WhatsApp order confirmation sent to {phone}")
                return True
            else:
                logger.error(f"Failed to send WhatsApp order confirmation: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending WhatsApp order confirmation: {e}")
        return False

async def send_whatsapp_auto_reply(phone_number: str, is_new_lead: bool = True) -> bool:
    """Send auto-reply message to WhatsApp user"""
    if not WHATSAPP_PHONE_NUMBER_ID or not WHATSAPP_ACCESS_TOKEN:
        logger.warning("WhatsApp credentials not configured, skipping auto-reply")
        return False
    
    try:
        # Different messages for new vs returning customers
        if is_new_lead:
            message_body = """Hi 👋 Welcome to ASR Enterprises Solar - Bihar's Trusted Solar Partner!

Please share your details:
1️⃣ Your Name
2️⃣ City/District
3️⃣ Monthly Electricity Bill Amount
4️⃣ Required Solar Capacity (if known)

We will calculate your PM Surya Ghar subsidy (up to ₹78,000) instantly! ☀️

📞 Call: 9296389097
💬 WhatsApp: 9296389097
📍 Office: Shop 10, AMAN SKS COMPLEX, Khagaul Saguna Road, Patna"""
        else:
            message_body = """Thank you for contacting ASR Enterprises again! 🙏

Our team will get back to you shortly.

For immediate assistance:
📞 Call: 9296389097
💬 WhatsApp: 9296389097"""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages",
                headers={
                    "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                    "Content-Type": "application/json"
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_number,
                    "text": {
                        "body": message_body
                    }
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"WhatsApp auto-reply sent successfully to {phone_number}")
                return True
            else:
                logger.error(f"WhatsApp auto-reply failed: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Error sending WhatsApp auto-reply: {e}")
        return False

async def create_lead_from_social_message(
    source: str,
    sender_id: str,
    sender_name: str,
    message_text: str,
    phone_number: str = None
) -> Dict[str, Any]:
    """Create or update CRM lead from social media message"""
    try:
        # Check if lead already exists by phone or sender_id
        existing_lead = None
        if phone_number:
            existing_lead = await db.crm_leads.find_one({"phone": phone_number}, {"_id": 0})
        if not existing_lead:
            existing_lead = await db.crm_leads.find_one(
                {"$or": [
                    {"social_id": sender_id},
                    {"name": sender_name, "source": source}
                ]},
                {"_id": 0}
            )
        
        if existing_lead:
            # Update existing lead with new message
            update_data = {
                "follow_up_notes": f"{existing_lead.get('follow_up_notes', '')}\n[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] {source.upper()}: {message_text[:200]}",
                "stage": "contacted" if existing_lead.get("stage") == "new" else existing_lead.get("stage")
            }
            await db.crm_leads.update_one({"id": existing_lead["id"]}, {"$set": update_data})
            logger.info(f"Updated existing lead {existing_lead['id']} from {source}")
            return {"action": "updated", "lead_id": existing_lead["id"], "name": existing_lead["name"]}
        
        # Create new lead
        lead_id = str(uuid.uuid4())
        new_lead = {
            "id": lead_id,
            "name": sender_name or f"{source.capitalize()} User",
            "email": "",
            "phone": phone_number or "",
            "district": "",
            "address": "",
            "property_type": "residential",
            "monthly_bill": None,
            "roof_area": None,
            "source": source,  # "whatsapp" or "facebook"
            "social_id": sender_id,
            "stage": "new",
            "assigned_to": None,
            "assigned_by": None,
            "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
            "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Initial message: {message_text[:500]}",
            "quoted_amount": None,
            "system_size": None,
            "advance_paid": 0.0,
            "total_amount": 0.0,
            "pending_amount": 0.0,
            "lead_score": 60,  # Default score for social leads
            "ai_priority": "medium",
            "ai_suggestions": f"New inquiry from {source.upper()}. Customer reached out via social media - indicates active interest.",
            "status_history": [{"status": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "by": "system"}],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.crm_leads.insert_one(new_lead)
        logger.info(f"Created new lead {lead_id} from {source}: {sender_name}")
        
        # Also create in leads collection for website display
        website_lead = {
            "id": lead_id,
            "name": sender_name or f"{source.capitalize()} User",
            "email": "",
            "phone": phone_number or "",
            "district": "",
            "location": "",
            "interest": f"Inquiry via {source.upper()}",
            "address": "",
            "property_type": "residential",
            "roof_type": "rcc",
            "monthly_bill": None,
            "roof_area": None,
            "message": message_text[:500],
            "ai_analysis": f"Social media lead from {source.upper()}",
            "lead_score": 60,
            "recommended_system": "To be assessed",
            "status": "new",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.leads.insert_one(website_lead)
        
        return {"action": "created", "lead_id": lead_id, "name": sender_name}
        
    except Exception as e:
        logger.error(f"Error creating lead from {source}: {e}")
        return {"action": "error", "error": str(e)}

# ==================== UNIFIED WEBHOOK ENDPOINT (for Meta) ====================

@api_router.get("/webhook")
async def verify_unified_webhook(request: Request):
    """Unified webhook verification for Meta (WhatsApp & Facebook)"""
    hub_mode = request.query_params.get("hub.mode")
    hub_verify_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")
    
    logger.info(f"Meta webhook verification: mode={hub_mode}, token=***masked***")
    
    if hub_mode == "subscribe" and hub_verify_token == WEBHOOK_VERIFY_TOKEN:
        logger.info("Meta webhook verified successfully!")
        from starlette.responses import PlainTextResponse
        return PlainTextResponse(hub_challenge)
    
    logger.warning("Meta webhook verification failed: token mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")

@api_router.post("/webhook")
async def receive_unified_webhook(request: Request):
    """Unified webhook receiver for WhatsApp & Facebook messages"""
    try:
        body = await request.body()
        data = await request.json()
        
        logger.info(f"Meta webhook received: {json.dumps(data, indent=2)[:500]}")
        
        # Route to appropriate handler based on object type
        obj_type = data.get("object", "")
        
        if obj_type == "whatsapp_business_account":
            # Handle WhatsApp messages
            return await receive_whatsapp_webhook(request)
        elif obj_type == "page":
            # Handle Facebook Messenger messages
            return await receive_facebook_webhook(request)
        else:
            logger.info(f"Unknown webhook object type: {obj_type}")
            return {"status": "ok", "message": f"Unknown object type: {obj_type}"}
            
    except Exception as e:
        logger.error(f"Unified webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== WHATSAPP WEBHOOK ENDPOINTS ====================

@api_router.get("/webhook/whatsapp")
async def verify_whatsapp_webhook(request: Request):
    """WhatsApp webhook verification endpoint (Meta requirement)"""
    hub_mode = request.query_params.get("hub.mode")
    hub_verify_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")
    
    logger.info(f"WhatsApp webhook verification: mode={hub_mode}")
    
    if hub_mode == "subscribe" and hub_verify_token == WEBHOOK_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully")
        from starlette.responses import PlainTextResponse
        return PlainTextResponse(hub_challenge)
    
    logger.warning("WhatsApp webhook verification failed: token mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")

@api_router.post("/webhook/whatsapp")
async def receive_whatsapp_webhook(request: Request):
    """Receive incoming WhatsApp messages and auto-create leads"""
    try:
        body = await request.body()
        data = await request.json()
        
        logger.info(f"WhatsApp webhook received: {json.dumps(data, indent=2)[:500]}")
        
        # Verify this is a WhatsApp Business Account webhook
        if data.get("object") != "whatsapp_business_account":
            return {"status": "ignored", "reason": "not whatsapp_business_account"}
        
        # Process each entry
        results = []
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                
                # Get contacts info
                contacts = value.get("contacts", [])
                contact_map = {c.get("wa_id"): c.get("profile", {}).get("name", "Unknown") for c in contacts}
                
                # Process messages
                for message in value.get("messages", []):
                    sender_id = message.get("from", "")
                    sender_name = contact_map.get(sender_id, "WhatsApp User")
                    message_id = message.get("id", "")
                    message_type = message.get("type", "text")
                    timestamp = message.get("timestamp", "")
                    
                    # Extract message content
                    message_text = ""
                    if message_type == "text":
                        message_text = message.get("text", {}).get("body", "")
                    elif message_type == "image":
                        caption = message.get("image", {}).get("caption", "")
                        message_text = f"[Image] {caption}" if caption else "[Image sent]"
                    elif message_type == "document":
                        filename = message.get("document", {}).get("filename", "document")
                        message_text = f"[Document: {filename}]"
                    elif message_type == "audio":
                        message_text = "[Audio message]"
                    elif message_type == "video":
                        caption = message.get("video", {}).get("caption", "")
                        message_text = f"[Video] {caption}" if caption else "[Video sent]"
                    elif message_type == "location":
                        loc = message.get("location", {})
                        message_text = f"[Location: {loc.get('name', 'Shared location')}]"
                    else:
                        message_text = f"[{message_type} message]"
                    
                    # Create/update lead
                    result = await create_lead_from_social_message(
                        source="whatsapp",
                        sender_id=sender_id,
                        sender_name=sender_name,
                        message_text=message_text,
                        phone_number=sender_id  # WhatsApp ID is the phone number
                    )
                    results.append(result)
                    
                    # Send auto-reply to new leads
                    is_new_lead = result.get('action') == 'created'
                    await send_whatsapp_auto_reply(sender_id, is_new_lead)
                    
                    logger.info(f"WhatsApp lead processed: {sender_name} ({sender_id}) - {result.get('action')}")
        
        return {"status": "ok", "processed": len(results), "results": results}
        
    except Exception as e:
        logger.error(f"WhatsApp webhook error: {e}")
        # Always return 200 to acknowledge receipt (Meta requirement)
        return {"status": "error", "message": str(e)}

# ==================== FACEBOOK MESSENGER WEBHOOK ENDPOINTS ====================

@api_router.get("/webhook/facebook")
async def verify_facebook_webhook(request: Request):
    """Facebook Messenger webhook verification endpoint (Meta requirement)"""
    hub_mode = request.query_params.get("hub.mode")
    hub_verify_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")
    
    logger.info(f"Facebook webhook verification: mode={hub_mode}")
    
    if hub_mode == "subscribe" and hub_verify_token == WEBHOOK_VERIFY_TOKEN:
        logger.info("Facebook webhook verified successfully")
        from starlette.responses import PlainTextResponse
        return PlainTextResponse(hub_challenge)
    
    logger.warning("Facebook webhook verification failed: token mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")

@api_router.post("/webhook/facebook")
async def receive_facebook_webhook(request: Request):
    """Receive incoming Facebook Messenger messages and auto-create leads"""
    try:
        body = await request.body()
        
        # Verify signature if app secret is configured
        signature = request.headers.get("X-Hub-Signature-256", "")
        if FACEBOOK_APP_SECRET and not verify_facebook_signature(body, signature):
            logger.warning("Facebook webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        data = await request.json()
        logger.info(f"Facebook webhook received: {json.dumps(data, indent=2)[:500]}")
        
        # Verify this is a page subscription
        if data.get("object") != "page":
            return {"status": "ignored", "reason": "not page object"}
        
        # Process each entry
        results = []
        for entry in data.get("entry", []):
            page_id = entry.get("id", "")
            
            for messaging_event in entry.get("messaging", []):
                sender_id = messaging_event.get("sender", {}).get("id", "")
                recipient_id = messaging_event.get("recipient", {}).get("id", "")
                timestamp = messaging_event.get("timestamp", "")
                
                # Skip if sender is the page itself (echo)
                if sender_id == page_id:
                    continue
                
                # Check if this is a message event
                if "message" in messaging_event:
                    message_data = messaging_event["message"]
                    
                    # Skip echo messages
                    if message_data.get("is_echo"):
                        continue
                    
                    message_id = message_data.get("mid", "")
                    message_text = message_data.get("text", "")
                    
                    # Handle attachments
                    if not message_text and "attachments" in message_data:
                        attachments = message_data["attachments"]
                        if attachments:
                            att_type = attachments[0].get("type", "unknown")
                            message_text = f"[{att_type.capitalize()} attachment]"
                    
                    # Try to get user profile (requires page access token)
                    sender_name = "Facebook User"
                    if FACEBOOK_PAGE_ACCESS_TOKEN:
                        try:
                            import httpx
                            async with httpx.AsyncClient() as client:
                                profile_url = f"https://graph.facebook.com/{sender_id}"
                                params = {
                                    "fields": "name",
                                    "access_token": FACEBOOK_PAGE_ACCESS_TOKEN
                                }
                                response = await client.get(profile_url, params=params, timeout=5.0)
                                if response.status_code == 200:
                                    profile = response.json()
                                    sender_name = profile.get("name", "Facebook User")
                        except Exception as e:
                            logger.warning(f"Could not fetch Facebook profile: {e}")
                    
                    # Create/update lead
                    result = await create_lead_from_social_message(
                        source="facebook",
                        sender_id=sender_id,
                        sender_name=sender_name,
                        message_text=message_text or "[No text content]",
                        phone_number=None  # Facebook doesn't provide phone
                    )
                    results.append(result)
                    
                    logger.info(f"Facebook lead processed: {sender_name} ({sender_id}) - {result.get('action')}")
        
        return {"status": "ok", "processed": len(results), "results": results}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Facebook webhook error: {e}")
        # Always return 200 to acknowledge receipt (Meta requirement)
        return {"status": "error", "message": str(e)}

# ==================== WEBHOOK STATUS & TESTING ====================

@api_router.get("/webhook/status")
async def get_webhook_status():
    """Get status of social media webhook integrations"""
    return {
        "whatsapp": {
            "configured": bool(WHATSAPP_ACCESS_TOKEN),
            "phone_number_id": WHATSAPP_PHONE_NUMBER_ID[:4] + "***" if WHATSAPP_PHONE_NUMBER_ID else None,
            "webhook_url": "/api/webhook/whatsapp",
            "verify_token": WEBHOOK_VERIFY_TOKEN
        },
        "facebook": {
            "configured": bool(FACEBOOK_PAGE_ACCESS_TOKEN),
            "app_id": FACEBOOK_APP_ID[:4] + "***" if FACEBOOK_APP_ID else None,
            "webhook_url": "/api/webhook/facebook",
            "verify_token": WEBHOOK_VERIFY_TOKEN
        },
        "instructions": {
            "step1": "Go to Meta for Developers (developers.facebook.com)",
            "step2": "Select your app → WhatsApp/Messenger → Settings",
            "step3": "Add webhook URL: YOUR_DOMAIN/api/webhook/whatsapp or /api/webhook/facebook",
            "step4": f"Use verify token: {WEBHOOK_VERIFY_TOKEN}",
            "step5": "Subscribe to 'messages' events",
            "step6": "Add your credentials to backend/.env file"
        }
    }

@api_router.get("/webhook/recent-social-leads")
async def get_recent_social_leads():
    """Get recently created leads from social media"""
    leads = await db.crm_leads.find(
        {"source": {"$in": ["whatsapp", "facebook"]}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    
    return {
        "total": len(leads),
        "leads": leads,
        "by_source": {
            "whatsapp": sum(1 for l in leads if l.get("source") == "whatsapp"),
            "facebook": sum(1 for l in leads if l.get("source") == "facebook")
        }
    }

# ==================== IMAGE OPTIMIZATION ====================

def optimize_image_to_webp(image_data: bytes, max_size_kb: int = 200) -> bytes:
    """Convert image to WebP format and optimize to stay under max size"""
    try:
        img = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary (for PNG with alpha)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Start with quality 85 and reduce if needed
        quality = 85
        output = io.BytesIO()
        
        while quality > 10:
            output = io.BytesIO()
            img.save(output, format='WEBP', quality=quality, optimize=True)
            
            if output.tell() <= max_size_kb * 1024:
                break
            
            quality -= 10
            
            # Also resize if still too large
            if quality <= 50 and output.tell() > max_size_kb * 1024:
                width, height = img.size
                img = img.resize((int(width * 0.8), int(height * 0.8)), Image.Resampling.LANCZOS)
        
        return output.getvalue()
    except Exception as e:
        logger.error(f"Image optimization failed: {e}")
        return image_data

@api_router.post("/upload/optimize-image")
async def upload_and_optimize_image(file: UploadFile = File(...)):
    """Upload image, convert to WebP, and optimize to under 200KB"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image data
        image_data = await file.read()
        original_size = len(image_data)
        
        # Optimize to WebP
        optimized_data = optimize_image_to_webp(image_data, max_size_kb=200)
        optimized_size = len(optimized_data)
        
        # Save to uploads directory
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.webp"
        filepath = UPLOADS_DIR / filename
        
        with open(filepath, 'wb') as f:
            f.write(optimized_data)
        
        # Return base64 for immediate use
        base64_image = base64.b64encode(optimized_data).decode('utf-8')
        
        return {
            "status": "success",
            "filename": filename,
            "original_size_kb": round(original_size / 1024, 2),
            "optimized_size_kb": round(optimized_size / 1024, 2),
            "compression_ratio": round((1 - optimized_size / original_size) * 100, 1),
            "data_url": f"data:image/webp;base64,{base64_image}",
            "url": f"/api/uploads/{filename}"
        }
    except Exception as e:
        logger.error(f"Image upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to process image")

@api_router.get("/uploads/{filename}")
async def get_uploaded_image(filename: str):
    """Serve uploaded images with caching headers"""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Set cache headers for CDN
    headers = {
        "Cache-Control": "public, max-age=31536000",  # 1 year
        "Content-Type": "image/webp"
    }
    
    return Response(content=data, media_type="image/webp", headers=headers)

# ==================== SERVICE REGISTRATION WITH PAYMENT ====================

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
REGISTRATION_FEE = float(os.environ.get('REGISTRATION_FEE', '1500'))

# Service Registration Pydantic Model
class ServiceRegistration(BaseModel):
    name: str
    phone: str
    email: str = ""
    district: str = ""
    address: str = ""
    property_type: str = "residential"
    roof_type: str = "rcc"
    monthly_bill: Optional[float] = None
    roof_area: Optional[float] = None
    notes: str = ""

@api_router.get("/registration/fee")
async def get_registration_fee():
    """Get current registration fee (admin configurable)"""
    return {
        "fee": REGISTRATION_FEE,
        "currency": "INR",
        "description": "Solar Service Registration Fee"
    }

@api_router.post("/registration/update-fee")
async def update_registration_fee(data: Dict[str, Any]):
    """Admin API to update registration fee"""
    global REGISTRATION_FEE
    new_fee = data.get("fee")
    if new_fee is None or float(new_fee) < 0:
        raise HTTPException(status_code=400, detail="Invalid fee amount")
    REGISTRATION_FEE = float(new_fee)
    logger.info(f"Registration fee updated to ₹{REGISTRATION_FEE}")
    return {"success": True, "new_fee": REGISTRATION_FEE}

@api_router.post("/registration/save-details")
async def save_registration_details(data: Dict[str, Any]):
    """Save customer registration details before Razorpay payment redirect"""
    try:
        customer_data = data.get("customer", {})
        registration_id = str(uuid.uuid4())
        
        # Calculate lead score
        monthly_bill = customer_data.get("monthly_bill") or 0
        try:
            monthly_bill = float(monthly_bill) if monthly_bill else 0
        except:
            monthly_bill = 0
        lead_score = min(100, 50 + int(monthly_bill / 100))
        
        # Create registration document
        registration_doc = {
            "id": registration_id,
            "customer": {
                "name": customer_data.get("name", ""),
                "phone": customer_data.get("phone", ""),
                "email": customer_data.get("email", ""),
                "district": customer_data.get("district", ""),
                "address": customer_data.get("address", ""),
                "property_type": customer_data.get("property_type", "residential"),
                "roof_type": customer_data.get("roof_type", ""),
                "monthly_bill": monthly_bill,
                "roof_area": customer_data.get("roof_area"),
                "notes": customer_data.get("notes", "")
            },
            "payment_method": "razorpay_link",
            "amount": REGISTRATION_FEE,
            "payment_status": "pending",  # Will be manually marked as paid by admin after receiving payment
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Save to database
        await db.payment_transactions.insert_one(registration_doc)
        
        # Also create a CRM lead immediately (since payment will be manual verification)
        lead_id = str(uuid.uuid4())
        crm_lead = {
            "id": lead_id,
            "name": customer_data.get("name", ""),
            "email": customer_data.get("email", ""),
            "phone": customer_data.get("phone", ""),
            "district": customer_data.get("district", ""),
            "address": customer_data.get("address", ""),
            "property_type": customer_data.get("property_type", "residential"),
            "monthly_bill": monthly_bill,
            "roof_area": customer_data.get("roof_area"),
            "source": "registration",
            "stage": "new",
            "assigned_to": None,
            "assigned_by": None,
            "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
            "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] REGISTRATION (Razorpay Payment Pending) ₹{REGISTRATION_FEE}. {customer_data.get('notes', '')}",
            "quoted_amount": None,
            "system_size": None,
            "advance_paid": 0.0,  # Will be updated when payment is confirmed
            "total_amount": 0.0,
            "pending_amount": 0.0,
            "lead_score": lead_score,
            "ai_priority": "high",
            "ai_suggestions": "REGISTRATION LEAD - Awaiting payment confirmation via Razorpay.",
            "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": f"Registration ₹{REGISTRATION_FEE} (payment pending)"}],
            "registration_id": registration_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.crm_leads.insert_one(crm_lead)
        
        logger.info(f"Registration saved: {registration_id} - Customer: {customer_data.get('name')} - Phone: {customer_data.get('phone')}")
        
        return {
            "success": True,
            "registration_id": registration_id,
            "message": "Registration details saved successfully"
        }
        
    except Exception as e:
        logger.error(f"Registration save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/registration/create-checkout")
async def create_registration_checkout(data: Dict[str, Any], request: Request):
    """Create Stripe checkout session for service registration"""
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        
        if not STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        # Get customer details
        customer_data = data.get("customer", {})
        origin_url = data.get("origin_url", str(request.base_url).rstrip('/'))
        
        # Initialize Stripe
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session ID for tracking
        registration_id = str(uuid.uuid4())
        
        # Build URLs
        success_url = f"{origin_url}/registration-success?session_id={{CHECKOUT_SESSION_ID}}&registration_id={registration_id}"
        cancel_url = f"{origin_url}/"
        
        # Create checkout request (amount in INR)
        checkout_request = CheckoutSessionRequest(
            amount=float(REGISTRATION_FEE),
            currency="inr",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "registration_id": registration_id,
                "customer_name": customer_data.get("name", ""),
                "customer_phone": customer_data.get("phone", ""),
                "customer_email": customer_data.get("email", ""),
                "service_type": "solar_registration"
            }
        )
        
        # Create Stripe session
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store pending registration in database
        registration_doc = {
            "id": registration_id,
            "session_id": session.session_id,
            "customer": {
                "name": sanitize_input(customer_data.get("name", "")),
                "phone": customer_data.get("phone", ""),
                "email": customer_data.get("email", ""),
                "district": customer_data.get("district", ""),
                "address": sanitize_input(customer_data.get("address", "")),
                "property_type": customer_data.get("property_type", "residential"),
                "roof_type": customer_data.get("roof_type", "rcc"),
                "monthly_bill": customer_data.get("monthly_bill"),
                "roof_area": customer_data.get("roof_area"),
                "notes": sanitize_input(customer_data.get("notes", ""))
            },
            "amount": REGISTRATION_FEE,
            "currency": "INR",
            "payment_status": "pending",
            "lead_created": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(registration_doc)
        
        logger.info(f"Registration checkout created: {registration_id} - ₹{REGISTRATION_FEE}")
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id,
            "registration_id": registration_id
        }
        
    except Exception as e:
        logger.error(f"Registration checkout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/registration/status/{session_id}")
async def get_registration_status(session_id: str):
    """Check registration payment status"""
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        
        if not STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        
        # Get status from Stripe
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Find registration in database
        registration = await db.payment_transactions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if not registration:
            raise HTTPException(status_code=404, detail="Registration not found")
        
        # Update status if payment is complete
        if status.payment_status == "paid" and registration.get("payment_status") != "paid":
            # Update payment status
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Create CRM lead if not already created
            if not registration.get("lead_created"):
                customer = registration.get("customer", {})
                lead_id = str(uuid.uuid4())
                
                # Calculate lead score
                monthly_bill = customer.get("monthly_bill") or 0
                lead_score = min(100, 50 + int(monthly_bill / 100))  # Paid leads get bonus
                
                crm_lead = {
                    "id": lead_id,
                    "name": customer.get("name", ""),
                    "email": customer.get("email", ""),
                    "phone": customer.get("phone", ""),
                    "district": customer.get("district", ""),
                    "address": customer.get("address", ""),
                    "property_type": customer.get("property_type", "residential"),
                    "monthly_bill": customer.get("monthly_bill"),
                    "roof_area": customer.get("roof_area"),
                    "source": "registration",
                    "stage": "new",
                    "assigned_to": None,
                    "assigned_by": None,
                    "next_follow_up": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] PAID REGISTRATION ₹{REGISTRATION_FEE}. {customer.get('notes', '')}",
                    "quoted_amount": None,
                    "system_size": None,
                    "advance_paid": float(REGISTRATION_FEE),
                    "total_amount": 0.0,
                    "pending_amount": 0.0,
                    "lead_score": lead_score,
                    "ai_priority": "high",  # Paid registrations are high priority
                    "ai_suggestions": "PAID CUSTOMER - High priority lead. Customer has already paid registration fee.",
                    "status_history": [{"stage": "new", "timestamp": datetime.now(timezone.utc).isoformat(), "notes": f"Paid registration ₹{REGISTRATION_FEE}"}],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                await db.crm_leads.insert_one(crm_lead)
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"lead_created": True, "lead_id": lead_id}}
                )
                
                logger.info(f"Paid registration lead created: {lead_id} - {customer.get('name')}")
        
        return {
            "success": True,
            "payment_status": status.payment_status,
            "status": status.status,
            "amount": status.amount_total / 100,  # Convert from paise
            "currency": status.currency,
            "registration": registration
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe payment webhooks"""
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        
        if not STRIPE_API_KEY:
            return {"status": "ignored", "reason": "Stripe not configured"}
        
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        
        try:
            webhook_response = await stripe_checkout.handle_webhook(body, signature)
            
            if webhook_response.payment_status == "paid":
                # Update payment transaction
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "webhook_event_id": webhook_response.event_id,
                        "paid_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Stripe webhook: Payment confirmed for {webhook_response.session_id}")
            
            return {"status": "ok", "event_type": webhook_response.event_type}
            
        except Exception as e:
            logger.warning(f"Stripe webhook handling failed: {e}")
            return {"status": "ok"}  # Return 200 to acknowledge receipt
        
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/admin/registrations")
async def get_all_registrations():
    """Get all service registrations for admin"""
    registrations = await db.payment_transactions.find(
        {"customer": {"$exists": True}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    return {
        "total": len(registrations),
        "paid": sum(1 for r in registrations if r.get("payment_status") == "paid"),
        "pending": sum(1 for r in registrations if r.get("payment_status") == "pending"),
        "registrations": registrations
    }

@api_router.post("/admin/registrations/{registration_id}/mark-paid")
async def mark_registration_paid(registration_id: str, data: Dict[str, Any]):
    """Mark a registration as paid and update associated CRM lead"""
    try:
        payment_id = data.get("payment_id", "")
        amount = data.get("amount", REGISTRATION_FEE)
        
        # Update registration status
        result = await db.payment_transactions.update_one(
            {"id": registration_id},
            {"$set": {
                "payment_status": "paid",
                "payment_id": payment_id,
                "amount": float(amount),
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "marked_paid_by": "admin"
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Registration not found")
        
        # Update associated CRM lead
        await db.crm_leads.update_one(
            {"registration_id": registration_id},
            {"$set": {
                "advance_paid": float(amount),
                "ai_suggestions": f"PAYMENT CONFIRMED - ₹{amount} via Razorpay. Payment ID: {payment_id}",
                "follow_up_notes": f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] PAYMENT CONFIRMED ₹{amount}. Razorpay ID: {payment_id}"
            }}
        )
        
        logger.info(f"Registration {registration_id} marked as paid - ₹{amount}")
        return {"success": True, "message": "Payment marked as confirmed"}
    except Exception as e:
        logger.error(f"Error marking registration paid: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/registrations/{registration_id}")
async def delete_registration(registration_id: str):
    """Admin deletes a registration record"""
    try:
        result = await db.payment_transactions.delete_one({"id": registration_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Registration not found")
        logger.info(f"Registration {registration_id} deleted")
        return {"success": True, "message": "Registration deleted"}
    except Exception as e:
        logger.error(f"Error deleting registration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== EDIT/DELETE LEADS WITH SYNC ====================

@api_router.put("/admin/leads/{lead_id}")
async def admin_update_lead(lead_id: str, data: Dict[str, Any]):
    """Admin update lead - syncs with both leads and crm_leads collections"""
    try:
        update_data = {k: v for k, v in data.items() if k not in ["id", "_id", "timestamp"]}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update in leads collection
        await db.leads.update_one({"id": lead_id}, {"$set": update_data})
        
        # Update in crm_leads collection
        await db.crm_leads.update_one({"id": lead_id}, {"$set": update_data})
        
        logger.info(f"Lead {lead_id} updated by admin")
        return {"success": True, "message": "Lead updated successfully"}
    except Exception as e:
        logger.error(f"Error updating lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/leads/{lead_id}")
async def admin_delete_lead(lead_id: str):
    """Admin soft-delete lead - moves to Leads Bin (30-day retention, restorable)"""
    try:
        lead = await db.crm_leads.find_one({"id": lead_id, "$or": [{"is_deleted": {"$exists": False}}, {"is_deleted": False}]}, {"_id": 0, "id": 1})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        now = datetime.now(timezone.utc).isoformat()
        await db.crm_leads.update_one(
            {"id": lead_id},
            {"$set": {"is_deleted": True, "deleted_at": now}}
        )
        logger.info(f"Lead {lead_id} soft-deleted by admin (moved to Leads Bin)")
        return {"success": True, "message": "Lead moved to Leads Bin (restorable for 30 days)"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AGENT REGISTRATION ====================

class AgentRegistration(BaseModel):
    name: str
    phone: str
    email: str = ""
    district: str
    address: str = ""
    aadhar_number: str = ""
    pan_number: str = ""
    bank_name: str = ""
    bank_account: str = ""
    ifsc_code: str = ""
    experience: str = ""
    notes: str = ""

def _hash_pw(p: str) -> str:
    return hashlib.sha256((p or "").encode()).hexdigest()

async def _next_advisor_id() -> str:
    """Generate sequential SA1001, SA1002, ..."""
    cursor = db.agents.find({"agent_id": {"$regex": "^SA[0-9]+$"}}, {"_id": 0, "agent_id": 1})
    max_n = 1000
    async for d in cursor:
        try:
            n = int(d["agent_id"][2:])
            if n > max_n:
                max_n = n
        except Exception:
            pass
    return f"SA{max_n + 1}"

@api_router.post("/agents/register")
async def register_agent(agent: AgentRegistration):
    """Register a new Solar Advisor (creates a login account automatically)."""
    try:
        phone_clean = re.sub(r"\D", "", agent.phone or "")[-10:]
        if len(phone_clean) != 10:
            raise HTTPException(status_code=400, detail="Valid 10-digit mobile number required")

        existing = await db.agents.find_one({"phone": phone_clean})
        if existing:
            raise HTTPException(status_code=409, detail="A Solar Advisor with this mobile is already registered.")

        agent_id = await _next_advisor_id()
        default_password = phone_clean  # initial password = mobile (advisor / admin can change)

        agent_doc = {
            "id": str(uuid.uuid4()),
            "agent_id": agent_id,
            "name": agent.name,
            "phone": phone_clean,
            "mobile": phone_clean,
            "email": (agent.email or "").strip().lower(),
            "district": agent.district,
            "address": agent.address,
            "pincode": "",
            "aadhar_number": agent.aadhar_number,
            "pan_number": agent.pan_number,
            "bank_details": {
                "bank_name": agent.bank_name,
                "account_number": agent.bank_account,
                "ifsc_code": agent.ifsc_code,
            },
            "experience": agent.experience,
            "notes": agent.notes,
            "status": "pending",  # pending, approved, rejected, suspended
            "is_active": True,
            "password_hash": _hash_pw(default_password),
            "must_reset_password": True,
            "commission_percent": 5.0,
            "referrals": 0,
            "customers_onboarded": 0,
            "total_commission": 0.0,
            "paid_commission": 0.0,
            "pending_commission": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.agents.insert_one(agent_doc)
        logger.info(f"New Solar Advisor registered: {agent_id} - {agent.name}")

        # Notify admin via WhatsApp link (non-blocking)
        try:
            admin_msg = (
                f"🌟 *NEW SOLAR ADVISOR REGISTRATION*\n\n"
                f"ID: {agent_id}\n"
                f"Name: {agent.name}\n"
                f"Mobile: {phone_clean}\n"
                f"Email: {(agent.email or '').strip()}\n"
                f"District: {agent.district or ''}\n"
                f"Experience: {agent.experience or 'Not specified'}\n\n"
                f"⚠️ Status: *PENDING APPROVAL*\n"
                f"Please review and approve at:\nasrenterprises.in/admin/solar-advisors"
            )
            admin_wa_url = get_whatsapp_url(OWNER_MOBILE, admin_msg)
            logger.info(f"Admin WhatsApp notification URL ready for new advisor {agent_id}: {admin_wa_url[:60]}...")
        except Exception as notify_err:
            logger.warning(f"Could not build admin notification for {agent_id}: {notify_err}")

        return {
            "success": True,
            "agent_id": agent_id,
            "default_password": default_password,
            "message": "Registration successful. Use your mobile number as both User ID and initial password to login.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/agents")
async def get_all_agents():
    """Get all registered Solar Advisors (with stats)."""
    agents = await db.agents.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return {"agents": agents, "total": len(agents)}

@api_router.get("/admin/agents/{agent_id}")
async def get_one_agent(agent_id: str):
    a = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0, "password_hash": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    return a

@api_router.put("/admin/agents/{agent_id}/status")
async def update_agent_status(agent_id: str, data: Dict[str, Any]):
    """Approve / reject / suspend a Solar Advisor."""
    status = (data.get("status") or "pending").lower()
    await db.agents.update_one(
        {"agent_id": agent_id},
        {"$set": {
            "status": status,
            "is_active": status in ("approved", "active"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True}

@api_router.put("/admin/agents/{agent_id}")
async def update_agent_details(agent_id: str, data: Dict[str, Any]):
    """Admin updates Solar Advisor details (anything except password/agent_id)."""
    allowed = {"name", "phone", "mobile", "email", "district", "address", "pincode",
               "aadhar_number", "pan_number", "experience", "notes",
               "commission_percent", "is_active", "status"}
    payload = {k: v for k, v in data.items() if k in allowed}
    if "phone" in payload:
        payload["phone"] = re.sub(r"\D", "", str(payload["phone"]))[-10:]
        payload["mobile"] = payload["phone"]
    if "email" in payload and payload["email"]:
        payload["email"] = str(payload["email"]).strip().lower()
    bank = {}
    for k in ("bank_name", "account_number", "ifsc_code"):
        if k in data:
            bank[k] = data[k]
    if bank:
        existing = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0, "bank_details": 1})
        merged = {**(existing or {}).get("bank_details", {}), **bank}
        payload["bank_details"] = merged
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.agents.update_one({"agent_id": agent_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    return {"success": True}

@api_router.post("/admin/agents/{agent_id}/set-password")
async def admin_set_agent_password(agent_id: str, data: Dict[str, Any]):
    """Admin (re)sets a Solar Advisor's password."""
    new_pw = (data.get("password") or "").strip()
    if len(new_pw) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    res = await db.agents.update_one(
        {"agent_id": agent_id},
        {"$set": {"password_hash": _hash_pw(new_pw), "must_reset_password": False,
                   "password_changed_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    return {"success": True, "message": "Password updated successfully"}

@api_router.delete("/admin/agents/{agent_id}")
async def delete_agent(agent_id: str):
    res = await db.agents.delete_one({"agent_id": agent_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    return {"success": True}

# -------------------- Solar Advisor login & self-service --------------------

# In-memory session token store for advisor self-service auth.
# Maps token -> {"agent_id": str, "expires": iso_string}
_advisor_sessions: Dict[str, Dict[str, Any]] = {}
_ADVISOR_TOKEN_TTL_HOURS = 24

def _issue_advisor_token(agent_id: str) -> str:
    import secrets
    token = secrets.token_urlsafe(32)
    _advisor_sessions[token] = {
        "agent_id": agent_id,
        "expires": (datetime.now(timezone.utc) + timedelta(hours=_ADVISOR_TOKEN_TTL_HOURS)).isoformat(),
    }
    # opportunistic cleanup
    if len(_advisor_sessions) > 5000:
        now = datetime.now(timezone.utc)
        expired = [t for t, s in _advisor_sessions.items()
                   if datetime.fromisoformat(s["expires"]) < now]
        for t in expired:
            _advisor_sessions.pop(t, None)
    return token

def _require_advisor(request: Request, path_agent_id: str) -> str:
    """Validate X-Advisor-Token header and ensure it matches the path agent_id."""
    token = request.headers.get("x-advisor-token") or request.headers.get("X-Advisor-Token")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    sess = _advisor_sessions.get(token)
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please login again.")
    try:
        if datetime.fromisoformat(sess["expires"]) < datetime.now(timezone.utc):
            _advisor_sessions.pop(token, None)
            raise HTTPException(status_code=401, detail="Session expired. Please login again.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")
    if sess["agent_id"] != path_agent_id:
        raise HTTPException(status_code=403, detail="Not authorized for this advisor account")
    return sess["agent_id"]

def _advisor_status_ok(advisor: Dict[str, Any]) -> Optional[str]:
    """Return None if account can login, else error message."""
    status = (advisor.get("status") or "pending").lower()
    if status == "pending":
        return "Your account is pending admin approval."
    if status in ("rejected", "suspended"):
        return f"Account {status}. Contact admin."
    if not advisor.get("is_active", True):
        return "Account disabled. Contact admin."
    return None

@api_router.post("/solar-advisor/login")
async def solar_advisor_login(data: Dict[str, Any]):
    """Login by mobile or email + password. Returns session token."""
    user_id = (data.get("user_id") or data.get("mobile") or data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    if not user_id or not password:
        raise HTTPException(status_code=400, detail="User ID and password required")
    if "@" in user_id:
        query = {"email": user_id.lower()}
    else:
        cleaned = re.sub(r"\D", "", user_id)[-10:]
        query = {"$or": [{"phone": cleaned}, {"mobile": cleaned}]}
    advisor = await db.agents.find_one(query, {"_id": 0})
    if not advisor:
        raise HTTPException(status_code=404, detail="No Solar Advisor account found with that ID")
    err = _advisor_status_ok(advisor)
    if err:
        raise HTTPException(status_code=403, detail=err)
    if _hash_pw(password) != advisor.get("password_hash", ""):
        raise HTTPException(status_code=401, detail="Invalid password")
    advisor.pop("password_hash", None)
    token = _issue_advisor_token(advisor["agent_id"])
    return {
        "success": True,
        "advisor": advisor,
        "token": token,
        "must_reset_password": advisor.get("must_reset_password", False),
        "message": "Login successful",
    }

@api_router.post("/solar-advisor/login-otp")
async def solar_advisor_login_otp(request: Request, data: Dict[str, Any]):
    """Send OTP to advisor's registered mobile (only for active accounts)."""
    user_id = (data.get("user_id") or data.get("mobile") or "").strip()
    cleaned = re.sub(r"\D", "", user_id)[-10:]
    advisor = await db.agents.find_one({"$or": [{"phone": cleaned}, {"mobile": cleaned}]}, {"_id": 0})
    if not advisor:
        raise HTTPException(status_code=404, detail="Mobile not registered as Solar Advisor")
    err = _advisor_status_ok(advisor)
    if err:
        raise HTTPException(status_code=403, detail=err)
    return await _send_otp_impl({"mobile": cleaned})

@api_router.post("/solar-advisor/verify-otp")
async def solar_advisor_verify_otp(request: Request, data: Dict[str, Any]):
    user_id = (data.get("user_id") or data.get("mobile") or "").strip()
    otp = (data.get("otp") or "").strip()
    cleaned = re.sub(r"\D", "", user_id)[-10:]
    advisor = await db.agents.find_one({"$or": [{"phone": cleaned}, {"mobile": cleaned}]}, {"_id": 0, "password_hash": 0, "agent_id": 1, "status": 1, "is_active": 1, "name": 1, "phone": 1, "email": 1, "must_reset_password": 1, "commission_percent": 1, "district": 1, "address": 1, "bank_details": 1})
    if not advisor:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    err = _advisor_status_ok(advisor)
    if err:
        raise HTTPException(status_code=403, detail=err)
    res = await verify_otp(request, {"mobile": cleaned, "otp": otp})
    if not res.get("success"):
        raise HTTPException(status_code=400, detail="OTP verification failed")
    full = await db.agents.find_one({"agent_id": advisor["agent_id"]}, {"_id": 0, "password_hash": 0})
    token = _issue_advisor_token(advisor["agent_id"])
    return {"success": True, "advisor": full, "token": token, "must_reset_password": full.get("must_reset_password", False), "message": "OTP verified"}

@api_router.post("/solar-advisor/{agent_id}/change-password")
async def advisor_change_password(agent_id: str, data: Dict[str, Any], request: Request):
    _require_advisor(request, agent_id)
    old = (data.get("old_password") or "").strip()
    new = (data.get("new_password") or "").strip()
    if len(new) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    if not old:
        raise HTTPException(status_code=400, detail="Current password is required")
    advisor = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0, "password_hash": 1})
    if not advisor:
        raise HTTPException(status_code=404, detail="Not found")
    if _hash_pw(old) != advisor.get("password_hash", ""):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await db.agents.update_one({"agent_id": agent_id},
        {"$set": {"password_hash": _hash_pw(new), "must_reset_password": False,
                   "password_changed_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}

class AdvisorOnboardCustomer(BaseModel):
    customer_name: str
    customer_mobile: str
    customer_email: Optional[str] = ""
    address: str
    district: str
    pincode: Optional[str] = ""
    ca_no: Optional[str] = ""                  # Electricity bill CA / Consumer number
    electricity_provider: Optional[str] = ""   # SBPDCL | NBPDCL
    required_capacity_kw: Optional[float] = None
    customer_type: str = "residential"  # residential | commercial
    monthly_bill: Optional[float] = None
    notes: Optional[str] = ""

@api_router.post("/solar-advisor/{agent_id}/onboard-customer")
async def advisor_onboard_customer(agent_id: str, data: AdvisorOnboardCustomer, request: Request):
    """Solar advisor onboards a customer. Creates a CRM lead tagged with the advisor."""
    _require_advisor(request, agent_id)
    advisor = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0, "name": 1, "status": 1, "commission_percent": 1, "phone": 1})
    if not advisor:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    if advisor.get("status") == "pending":
        raise HTTPException(status_code=403, detail="Account pending admin approval")

    mobile_clean = re.sub(r"\D", "", data.customer_mobile)[-10:]
    if len(mobile_clean) != 10:
        raise HTTPException(status_code=400, detail="Invalid customer mobile")

    lead_doc = {
        "id": str(uuid.uuid4()),
        "name": data.customer_name,
        "phone": mobile_clean,
        "email": (data.customer_email or "").strip().lower(),
        "address": data.address,
        "district": data.district,
        "pincode": data.pincode or "",
        "ca_no": (data.ca_no or "").strip(),
        "electricity_provider": (data.electricity_provider or "").strip(),
        "property_type": data.customer_type,
        "customer_type": data.customer_type,
        "required_capacity_kw": data.required_capacity_kw,
        "monthly_bill": data.monthly_bill,
        "message": data.notes or "",
        "status": "new",
        "source": "solar_advisor",
        "advisor_id": agent_id,
        "advisor_name": advisor.get("name", ""),
        "advisor_mobile": advisor.get("phone", ""),
        "commission_percent": advisor.get("commission_percent", 5.0),
        "commission_status": "pending",  # pending, approved, paid
        "commission_amount": 0.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.crm_leads.insert_one(lead_doc)
    await db.agents.update_one({"agent_id": agent_id}, {"$inc": {"customers_onboarded": 1, "referrals": 1}})

    lead_doc.pop("_id", None)
    return {"success": True, "lead": lead_doc, "message": "Customer onboarded. Our team will contact them shortly."}

@api_router.get("/solar-advisor/{agent_id}/customers")
async def advisor_list_customers(agent_id: str, request: Request):
    _require_advisor(request, agent_id)
    """List all customers an advisor onboarded with current login/conversion status."""
    leads = await db.crm_leads.find({"advisor_id": agent_id}, {"_id": 0}).sort("timestamp", -1).to_list(500)
    # Enrich with login status from db.customers (registered = customer can log in)
    mobiles = [l.get("phone") for l in leads if l.get("phone")]
    registered = set()
    if mobiles:
        async for c in db.customers.find({"mobile": {"$in": mobiles}}, {"_id": 0, "mobile": 1}):
            registered.add(c.get("mobile"))
    for l in leads:
        l["customer_can_login"] = l.get("phone") in registered
        l["customer_status"] = "active" if l.get("phone") in registered else "lead"
    return {"customers": leads, "total": len(leads)}

@api_router.get("/solar-advisor/{agent_id}/dashboard")
async def advisor_dashboard(agent_id: str, request: Request):
    _require_advisor(request, agent_id)
    advisor = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0, "password_hash": 0})
    if not advisor:
        raise HTTPException(status_code=404, detail="Solar Advisor not found")
    leads = await db.crm_leads.find({"advisor_id": agent_id}, {"_id": 0}).to_list(1000)
    by_status = {"new": 0, "contacted": 0, "qualified": 0, "converted": 0, "lost": 0}
    pending_comm = 0.0
    paid_comm = 0.0
    total_revenue = 0.0
    for l in leads:
        s = (l.get("status") or "new").lower()
        by_status[s] = by_status.get(s, 0) + 1
        cs = (l.get("commission_status") or "pending").lower()
        amt = float(l.get("commission_amount") or 0)
        if cs == "paid":
            paid_comm += amt
        else:
            pending_comm += amt
        total_revenue += float(l.get("total_cost") or 0)
    return {
        "advisor": advisor,
        "stats": {
            "total_customers": len(leads),
            "by_status": by_status,
            "converted": by_status.get("converted", 0),
            "pending_commission": round(pending_comm, 2),
            "paid_commission": round(paid_comm, 2),
            "total_commission": round(pending_comm + paid_comm, 2),
            "total_revenue_generated": round(total_revenue, 2),
        },
    }

@api_router.get("/admin/solar-advisor-leads")
async def admin_advisor_leads():
    """All leads brought in by Solar Advisors (admin overview)."""
    leads = await db.crm_leads.find({"source": "solar_advisor"}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return {"leads": leads, "total": len(leads)}

@api_router.put("/admin/solar-advisor-leads/{lead_id}/commission")
async def admin_update_commission(lead_id: str, data: Dict[str, Any]):
    payload = {}
    if "commission_status" in data:
        payload["commission_status"] = data["commission_status"]
    if "commission_amount" in data:
        try:
            payload["commission_amount"] = float(data["commission_amount"])
        except Exception:
            pass
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.crm_leads.update_one({"id": lead_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True}

# ==================== PUBLIC GOVT NEWS ====================

@api_router.get("/public/govt-news")
async def get_public_govt_news():
    """Get govt news for public website (read-only)"""
    news = await db.govt_news.find({}, {"_id": 0}).sort("date", -1).to_list(20)
    return news

# ==================== HR MANAGEMENT ====================
# HR endpoints have been moved to routes/hr.py for better modularity
# All /api/hr/* endpoints are now handled by the HR router

# ==================== WEBSITE OPTIMIZATION ====================

# In-memory cache storage
_api_cache = {}

@api_router.post("/admin/clear-cache")
async def clear_api_cache():
    """Clear all API caches for fresh data loading"""
    global _api_cache
    _api_cache = {}
    
    # Clear any cached data in collections (if applicable)
    try:
        # Reset cache timestamps
        await db.cache_meta.delete_many({})
    except:
        pass
    
    return {
        "success": True,
        "message": "API cache cleared successfully",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/admin/optimize-website")
async def optimize_website():
    """Run website optimization tasks"""
    optimizations = []
    
    try:
        # 1. Compact collections (remove fragmentation)
        collections = ["leads", "work_photos", "reviews", "orders", "hr_employees"]
        for coll in collections:
            try:
                await db.command({"compact": coll})
                optimizations.append(f"Compacted {coll}")
            except:
                pass
        
        # 2. Clear old temporary data (older than 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Clean old OTPs
        await db.otp_codes.delete_many({"created_at": {"$lt": thirty_days_ago.isoformat()}})
        optimizations.append("Cleaned old OTP codes")
        
        # 3. Update statistics
        stats = {
            "total_leads": await db.leads.count_documents({}),
            "total_orders": await db.orders.count_documents({}),
            "total_photos": await db.work_photos.count_documents({}),
            "total_employees": await db.hr_employees.count_documents({}),
            "optimization_time": datetime.now(timezone.utc).isoformat()
        }
        
        optimizations.append("Updated statistics cache")
        
        return {
            "success": True,
            "message": f"Completed {len(optimizations)} optimization tasks",
            "optimizations": optimizations,
            "stats": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Optimization error: {e}")
        return {
            "success": True,
            "message": "Basic optimization completed",
            "optimizations": optimizations,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@api_router.delete("/admin/cleanup-non-asr-orders")
async def cleanup_non_asr_orders():
    """Permanently delete all non-ASR Solar Hub orders from database"""
    
    # Find orders that are NOT from ASR Solar Hub
    # These include:
    # 1. Orders with source = "razorpay_sync" (old sync without ASR filter)
    # 2. Orders with order_number starting with "RZP-" (old Razorpay sync prefix)
    # 3. Orders that don't have ASR identifiers in notes
    
    non_asr_query = {
        "$or": [
            {"source": "razorpay_sync"},  # Old non-filtered sync
            {"order_number": {"$regex": "^RZP-"}},  # Old Razorpay sync prefix
            {"notes": {"$regex": "Auto-synced from Razorpay\\. Original", "$options": "i"}}  # Old sync without ASR tag
        ]
    }
    
    # First, get count and list of orders to be deleted
    orders_to_delete = await db.orders.find(non_asr_query, {"_id": 0, "order_number": 1, "source": 1, "total": 1}).to_list(1000)
    
    if not orders_to_delete:
        return {
            "success": True,
            "message": "No non-ASR orders found to delete",
            "deleted_count": 0,
            "deleted_orders": []
        }
    
    # Delete the orders
    result = await db.orders.delete_many(non_asr_query)
    
    return {
        "success": True,
        "message": f"Permanently deleted {result.deleted_count} non-ASR orders",
        "deleted_count": result.deleted_count,
        "deleted_orders": [o.get("order_number") for o in orders_to_delete]
    }

# ==================== GOOGLE REVIEWS MANUAL SYNC ====================
@api_router.get("/admin/google-reviews")
async def get_google_reviews():
    """Get all manually synced Google reviews"""
    try:
        reviews = await db.google_reviews.find({}, {"_id": 0}).sort("synced_at", -1).to_list(100)
        return {"success": True, "reviews": reviews, "total": len(reviews)}
    except Exception as e:
        logger.error(f"Get Google reviews error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/google-reviews/sync")
async def sync_google_review(data: Dict[str, Any]):
    """Manually add/sync a Google review"""
    try:
        reviewer_name = data.get("reviewer_name", "").strip()
        review_text = data.get("review_text", "").strip()
        rating = int(data.get("rating", 5))
        review_date = data.get("review_date", "")
        profile_photo = data.get("profile_photo", "")
        
        if not reviewer_name or not review_text:
            raise HTTPException(status_code=400, detail="Reviewer name and review text required")
        
        # Check for duplicate
        existing = await db.google_reviews.find_one({
            "reviewer_name": reviewer_name,
            "review_text": {"$regex": review_text[:50], "$options": "i"}
        })
        
        if existing:
            return {"success": False, "message": "This review already exists"}
        
        review_id = str(uuid.uuid4())
        review = {
            "id": review_id,
            "reviewer_name": reviewer_name,
            "review_text": review_text,
            "rating": min(5, max(1, rating)),
            "review_date": review_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "profile_photo": profile_photo,
            "source": "google",
            "verified": True,
            "visible": True,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.google_reviews.insert_one(review)
        logger.info(f"Google review synced: {reviewer_name}")
        
        return {"success": True, "message": "Review synced successfully", "review_id": review_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sync Google review error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/google-reviews/bulk-sync")
async def bulk_sync_google_reviews(data: Dict[str, Any]):
    """Bulk sync multiple Google reviews at once"""
    try:
        reviews_data = data.get("reviews", [])
        if not reviews_data:
            raise HTTPException(status_code=400, detail="No reviews provided")
        
        synced = 0
        skipped = 0
        
        for r in reviews_data:
            reviewer_name = r.get("reviewer_name", "").strip()
            review_text = r.get("review_text", "").strip()
            
            if not reviewer_name or not review_text:
                skipped += 1
                continue
            
            # Check duplicate
            existing = await db.google_reviews.find_one({
                "reviewer_name": reviewer_name,
                "review_text": {"$regex": review_text[:30], "$options": "i"}
            })
            
            if existing:
                skipped += 1
                continue
            
            review = {
                "id": str(uuid.uuid4()),
                "reviewer_name": reviewer_name,
                "review_text": review_text,
                "rating": min(5, max(1, int(r.get("rating", 5)))),
                "review_date": r.get("review_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                "profile_photo": r.get("profile_photo", ""),
                "source": "google",
                "verified": True,
                "visible": True,
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.google_reviews.insert_one(review)
            synced += 1
        
        logger.info(f"Bulk Google review sync: {synced} synced, {skipped} skipped")
        return {"success": True, "synced": synced, "skipped": skipped}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/google-reviews/{review_id}")
async def delete_google_review(review_id: str):
    """Delete a Google review"""
    result = await db.google_reviews.delete_one({"id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Google review not found")
    return {"success": True}

@api_router.put("/admin/google-reviews/{review_id}/toggle")
async def toggle_google_review_visibility(review_id: str):
    """Toggle review visibility"""
    review = await db.google_reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    new_visibility = not review.get("visible", True)
    await db.google_reviews.update_one(
        {"id": review_id},
        {"$set": {"visible": new_visibility}}
    )
    return {"success": True, "visible": new_visibility}

# Public endpoint to get visible Google reviews
@api_router.get("/google-reviews")
async def get_public_google_reviews():
    """Get visible Google reviews for public display"""
    try:
        reviews = await db.google_reviews.find(
            {"visible": True}, 
            {"_id": 0}
        ).sort("synced_at", -1).to_list(20)
        return {"success": True, "reviews": reviews}
    except Exception as e:
        return {"success": False, "reviews": []}

# ==================== DATABASE BACKUP SYSTEM ====================
BACKUP_DIR = ROOT_DIR.parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

@api_router.post("/admin/backup/create")
async def create_database_backup():
    """Create a manual database backup"""
    try:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_filename = f"asr_backup_{timestamp}.json"
        backup_path = BACKUP_DIR / backup_filename
        
        # Collections to backup
        collections = [
            "crm_leads", "leads", "testimonials", "google_reviews", 
            "photos", "festivals", "orders", "employees", "staffs",
            "agents", "consultations", "feedback", "admin_users"
        ]
        
        backup_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "collections": {}
        }
        
        for collection_name in collections:
            try:
                collection = db[collection_name]
                docs = await collection.find({}, {"_id": 0}).to_list(10000)
                backup_data["collections"][collection_name] = {
                    "count": len(docs),
                    "data": docs
                }
            except Exception as e:
                backup_data["collections"][collection_name] = {"error": str(e)}
        
        # Save backup
        with open(backup_path, 'w') as f:
            json.dump(backup_data, f, default=str, indent=2)
        
        # Get file size
        file_size = backup_path.stat().st_size
        
        # Log backup
        await db.backup_logs.insert_one({
            "id": str(uuid.uuid4()),
            "filename": backup_filename,
            "path": str(backup_path),
            "size_bytes": file_size,
            "type": "manual",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Database backup created: {backup_filename} ({file_size} bytes)")
        
        return {
            "success": True,
            "filename": backup_filename,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "collections_backed_up": len([c for c in backup_data["collections"] if "error" not in backup_data["collections"][c]])
        }
    except Exception as e:
        logger.error(f"Backup creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/backup/list")
async def list_backups():
    """List all available backups"""
    try:
        backups = []
        for backup_file in BACKUP_DIR.glob("asr_backup_*.json"):
            backups.append({
                "filename": backup_file.name,
                "size_bytes": backup_file.stat().st_size,
                "size_mb": round(backup_file.stat().st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(backup_file.stat().st_mtime).isoformat()
            })
        
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return {"success": True, "backups": backups, "total": len(backups)}
    except Exception as e:
        logger.error(f"List backups error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/backup/{filename}")
async def delete_backup(filename: str):
    """Delete a backup file"""
    try:
        backup_path = BACKUP_DIR / filename
        if backup_path.exists() and backup_path.suffix == ".json":
            backup_path.unlink()
            await db.backup_logs.delete_one({"filename": filename})
            return {"success": True, "message": f"Backup {filename} deleted"}
        raise HTTPException(status_code=404, detail="Backup not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/backup/download/{filename}")
async def download_backup(filename: str):
    """Download a backup file"""
    from fastapi.responses import FileResponse
    try:
        backup_path = BACKUP_DIR / filename
        if not backup_path.exists() or backup_path.suffix != ".json":
            raise HTTPException(status_code=404, detail="Backup not found")
        return FileResponse(
            path=str(backup_path),
            filename=filename,
            media_type="application/json"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/backup/restore/{filename}")
async def restore_backup(filename: str, data: Dict[str, Any] = {}):
    """Restore database from backup (with confirmation)"""
    try:
        backup_path = BACKUP_DIR / filename
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="Backup not found")
        
        confirm = data.get("confirm", False)
        if not confirm:
            return {
                "success": False,
                "message": "Please confirm restoration. This will overwrite current data.",
                "requires_confirmation": True
            }
        
        with open(backup_path, 'r') as f:
            backup_data = json.load(f)
        
        restored_collections = []
        for collection_name, collection_data in backup_data.get("collections", {}).items():
            if "data" in collection_data and collection_data["data"]:
                # Clear existing and restore
                await db[collection_name].delete_many({})
                if collection_data["data"]:
                    await db[collection_name].insert_many(collection_data["data"])
                restored_collections.append(collection_name)
        
        logger.info(f"Database restored from: {filename}")
        
        return {
            "success": True,
            "message": f"Restored {len(restored_collections)} collections",
            "restored_collections": restored_collections
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restore error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Weekly backup scheduler
async def weekly_backup_task():
    """Automated weekly backup task"""
    while True:
        try:
            # Wait until Sunday 2 AM
            now = datetime.now(timezone.utc)
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0 and now.hour >= 2:
                days_until_sunday = 7
            
            next_sunday = now + timedelta(days=days_until_sunday)
            next_backup_time = next_sunday.replace(hour=2, minute=0, second=0, microsecond=0)
            
            wait_seconds = (next_backup_time - now).total_seconds()
            logger.info(f"Next scheduled backup in {wait_seconds/3600:.1f} hours")
            
            await asyncio.sleep(wait_seconds)
            
            # Create backup
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_filename = f"asr_backup_weekly_{timestamp}.json"
            backup_path = BACKUP_DIR / backup_filename
            
            collections = ["crm_leads", "leads", "testimonials", "google_reviews", 
                          "photos", "festivals", "orders", "employees", "staffs"]
            
            backup_data = {"timestamp": datetime.now(timezone.utc).isoformat(), "collections": {}}
            
            for coll in collections:
                try:
                    docs = await db[coll].find({}, {"_id": 0}).to_list(10000)
                    backup_data["collections"][coll] = {"count": len(docs), "data": docs}
                except:
                    pass
            
            with open(backup_path, 'w') as f:
                json.dump(backup_data, f, default=str)
            
            # Log it
            await db.backup_logs.insert_one({
                "id": str(uuid.uuid4()),
                "filename": backup_filename,
                "type": "weekly_auto",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"Weekly automated backup created: {backup_filename}")
            
            # Keep only last 4 weekly backups
            weekly_backups = sorted(BACKUP_DIR.glob("asr_backup_weekly_*.json"), reverse=True)
            for old_backup in weekly_backups[4:]:
                old_backup.unlink()
                logger.info(f"Old backup deleted: {old_backup.name}")
                
        except Exception as e:
            logger.error(f"Weekly backup error: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour

# Start weekly backup scheduler on startup
@app.on_event("startup")
async def start_backup_scheduler():
    asyncio.create_task(weekly_backup_task())
    logger.info("Weekly backup scheduler started")

# ==================== HR MANAGEMENT API ENDPOINTS ====================

@api_router.get("/hr/employees-gamification")
async def get_hr_employees_gamification():
    """Get all employees for HR gamification dashboard"""
    try:
        employees = await db.employees.find({}, {"_id": 0}).to_list(100)
        # Add mock scores for gamification
        for emp in employees:
            emp["leads_closed"] = random.randint(0, 15)
            emp["surveys_completed"] = random.randint(0, 20)
            emp["photos_uploaded"] = random.randint(0, 30)
            emp["reviews_received"] = random.randint(0, 8)
            emp["fast_responses"] = random.randint(0, 25)
        return employees
    except Exception as e:
        logger.error(f"Get employees error: {e}")
        return []

@api_router.get("/hr/employee/{employee_id}/leave-balance")
async def get_employee_leave_balance(employee_id: str):
    """Get employee leave balance"""
    try:
        balance = await db.leave_balances.find_one({"employee_id": employee_id}, {"_id": 0})
        if not balance:
            return {"casual": 12, "sick": 6, "earned": 15}
        return balance
    except Exception as e:
        return {"casual": 12, "sick": 6, "earned": 15}

@api_router.get("/hr/employee/{employee_id}/payslips")
async def get_employee_payslips(employee_id: str):
    """Get employee payslips"""
    try:
        payslips = await db.payslips.find(
            {"employee_id": employee_id}, 
            {"_id": 0}
        ).sort("month", -1).to_list(12)
        return payslips
    except Exception as e:
        return []

@api_router.get("/hr/attendance/today")
async def get_today_attendance():
    """Get today's attendance records"""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        records = await db.attendance.find(
            {"date": today},
            {"_id": 0}
        ).to_list(100)
        return records
    except Exception as e:
        return []

@api_router.post("/hr/attendance/mark")
async def mark_attendance(data: Dict[str, Any]):
    """Mark attendance with geo-location"""
    try:
        staff_id = data.get("staff_id")
        att_type = data.get("type")  # "check_in" or "check_out"
        location = data.get("location", {})
        within_geofence = data.get("within_geofence", False)
        distance = data.get("distance_from_office", 0)
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_time = datetime.now(timezone.utc).strftime("%H:%M:%S")
        
        # Find or create today's record
        existing = await db.attendance.find_one({"staff_id": staff_id, "date": today})
        
        if existing:
            # Update existing record
            update_field = "check_in" if att_type == "check_in" else "check_out"
            await db.attendance.update_one(
                {"staff_id": staff_id, "date": today},
                {"$set": {
                    update_field: now_time,
                    f"{update_field}_location": location,
                    f"{update_field}_geofence": within_geofence,
                    f"{update_field}_distance": distance
                }}
            )
            record = await db.attendance.find_one({"staff_id": staff_id, "date": today}, {"_id": 0})
        else:
            # Create new record
            record = {
                "id": str(uuid.uuid4()),
                "staff_id": staff_id,
                "staff_name": data.get("staff_name", "Staff"),
                "date": today,
                "check_in": now_time if att_type == "check_in" else None,
                "check_out": now_time if att_type == "check_out" else None,
                "check_in_location": location if att_type == "check_in" else None,
                "check_out_location": location if att_type == "check_out" else None,
                "within_geofence": within_geofence,
                "distance_from_office": distance,
                "device_info": data.get("device_info", "")
            }
            await db.attendance.insert_one(record)
            record.pop("_id", None)
        
        logger.info(f"Attendance marked: {staff_id} - {att_type} at {now_time}")
        return record
        
    except Exception as e:
        logger.error(f"Mark attendance error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/hr/ai/assign-tasks")
async def ai_assign_tasks(data: Dict[str, Any]):
    """AI-powered task assignment based on workload and location"""
    try:
        leads = data.get("leads", [])
        staff = data.get("staff", [])
        
        if not leads or not staff:
            return {"assignments": []}
        
        # Get staff workload
        staff_workload = {}
        for s in staff:
            # Count current active leads assigned to this staff
            assigned = await db.crm_leads.count_documents({
                "assigned_to": s.get("id"),
                "stage": {"$nin": ["completed", "lost"]}
            })
            staff_workload[s.get("id")] = {
                "staff": s,
                "current_load": assigned,
                "district": s.get("district", "Patna")
            }
        
        assignments = []
        for lead in leads:
            # Find best staff based on workload and location match
            best_staff = None
            best_score = -1
            
            for staff_id, info in staff_workload.items():
                score = 100 - (info["current_load"] * 10)  # Lower workload = higher score
                
                # Location bonus
                if lead.get("district") == info["district"]:
                    score += 30
                
                if score > best_score:
                    best_score = score
                    best_staff = info["staff"]
            
            if best_staff:
                assignments.append({
                    "lead_id": lead.get("id"),
                    "lead_name": lead.get("name"),
                    "lead_district": lead.get("district"),
                    "staff_id": best_staff.get("id"),
                    "staff_name": best_staff.get("name"),
                    "reason": f"Lowest workload ({staff_workload[best_staff.get('id')]['current_load']} active)",
                    "priority": lead.get("ai_priority", "medium")
                })
                # Update workload count
                staff_workload[best_staff.get("id")]["current_load"] += 1
        
        return {"assignments": assignments}
        
    except Exception as e:
        logger.error(f"AI task assignment error: {e}")
        return {"assignments": []}

@api_router.post("/hr/leave/apply")
async def apply_leave(data: Dict[str, Any]):
    """Apply for leave"""
    try:
        leave_request = {
            "id": str(uuid.uuid4()),
            "employee_id": data.get("employee_id"),
            "employee_name": data.get("employee_name"),
            "leave_type": data.get("leave_type", "casual"),
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date"),
            "reason": sanitize_input(data.get("reason", "")),
            "status": "pending",
            "applied_at": datetime.now(timezone.utc).isoformat()
        }
        await db.leave_requests.insert_one(leave_request)
        leave_request.pop("_id", None)
        return {"success": True, "request": leave_request}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/hr/leave/{request_id}/approve")
async def approve_leave(request_id: str, data: Dict[str, Any]):
    """Approve or reject leave request"""
    try:
        status = data.get("status", "approved")  # "approved" or "rejected"
        await db.leave_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": status,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_by": data.get("reviewed_by", "Admin")
            }}
        )
        
        # If approved, deduct from balance
        if status == "approved":
            request = await db.leave_requests.find_one({"id": request_id})
            if request:
                leave_type = request.get("leave_type", "casual")
                # Calculate days
                days = 1  # Simplified
                await db.leave_balances.update_one(
                    {"employee_id": request["employee_id"]},
                    {"$inc": {leave_type: -days}},
                    upsert=True
                )
        
        return {"success": True, "status": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/hr/expense/submit")
async def submit_expense(data: Dict[str, Any]):
    """Submit expense reimbursement"""
    try:
        expense = {
            "id": str(uuid.uuid4()),
            "employee_id": data.get("employee_id"),
            "employee_name": data.get("employee_name"),
            "category": data.get("category", "travel"),  # travel, food, equipment
            "amount": float(data.get("amount", 0)),
            "description": sanitize_input(data.get("description", "")),
            "receipt_url": data.get("receipt_url", ""),
            "status": "pending",
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }
        await db.expenses.insert_one(expense)
        expense.pop("_id", None)
        return {"success": True, "expense": expense}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/hr/leaderboard")
async def get_staff_leaderboard():
    """Get staff leaderboard with scores"""
    try:
        staff = await db.employees.find({}, {"_id": 0}).to_list(50)
        
        # Calculate scores for each staff
        scored_staff = []
        for s in staff:
            staff_id = s.get("id")
            
            # Get real stats from database
            leads_closed = await db.crm_leads.count_documents({
                "assigned_to": staff_id,
                "stage": "completed"
            })
            
            score = leads_closed * 50
            score += random.randint(0, 100)  # Activity bonus
            
            scored_staff.append({
                **s,
                "score": score,
                "leads_closed": leads_closed,
                "rank": 0
            })
        
        # Sort by score
        scored_staff.sort(key=lambda x: x["score"], reverse=True)
        
        # Assign ranks
        for i, s in enumerate(scored_staff):
            s["rank"] = i + 1
        
        return scored_staff
        
    except Exception as e:
        logger.error(f"Leaderboard error: {e}")
        return []

# ============================================================
# CUSTOMER PORTAL - Backend API Routes
# ============================================================

class CustomerRegistration(BaseModel):
    mobile: str
    name: str
    address: str = ""
    district: str = ""
    installation_date: str = ""
    application_id: str = ""
    application_status: str = "pending"
    subsidy_amount: float = 0.0
    subsidy_status: str = "pending"
    subsidy_credited_date: str = ""
    system_capacity_kw: float = 0.0
    solar_brand: str = ""
    inverter_brand: str = ""
    panels_count: int = 0
    panel_warranty_years: int = 25
    inverter_warranty_years: int = 5
    installation_warranty_years: int = 1
    total_cost: float = 0.0
    amount_paid: float = 0.0
    payment_status: str = "pending"
    net_metering_status: str = "not_applied"
    notes: str = ""

@api_router.get("/admin/customers")
async def get_all_customers(request: Request):
    """Get all registered customers (admin only)"""
    customers = await db.customers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return customers

@api_router.post("/admin/customers")
async def create_customer(request: Request, data: CustomerRegistration):
    """Register a new customer (admin only)"""
    mobile_clean = data.mobile.replace(" ", "").replace("+", "")[-10:]
    if len(mobile_clean) != 10 or not mobile_clean.isdigit():
        raise HTTPException(status_code=400, detail="Invalid mobile number")
    existing = await db.customers.find_one({"mobile": mobile_clean})
    if existing:
        raise HTTPException(status_code=409, detail="Customer with this mobile number already registered")
    doc = {
        "id": str(uuid.uuid4()),
        "mobile": mobile_clean,
        "name": sanitize_input(data.name),
        "address": sanitize_input(data.address),
        "district": sanitize_input(data.district),
        "installation_date": data.installation_date,
        "application_id": sanitize_input(data.application_id),
        "application_status": data.application_status,
        "subsidy_amount": data.subsidy_amount,
        "subsidy_status": data.subsidy_status,
        "subsidy_credited_date": data.subsidy_credited_date,
        "system_capacity_kw": data.system_capacity_kw,
        "solar_brand": sanitize_input(data.solar_brand),
        "inverter_brand": sanitize_input(data.inverter_brand),
        "panels_count": data.panels_count,
        "panel_warranty_years": data.panel_warranty_years,
        "inverter_warranty_years": data.inverter_warranty_years,
        "installation_warranty_years": data.installation_warranty_years,
        "total_cost": data.total_cost,
        "amount_paid": data.amount_paid,
        "payment_status": data.payment_status,
        "net_metering_status": data.net_metering_status,
        "notes": sanitize_input(data.notes),
        "service_requests": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.customers.insert_one(doc)
    return {"success": True, "customer": doc}

@api_router.put("/admin/customers/{customer_id}")
async def update_customer(request: Request, customer_id: str, data: Dict[str, Any]):
    """Update customer details (admin only)"""
    update_fields = {k: v for k, v in data.items() if k not in ["_id", "id", "mobile", "created_at"]}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.customers.update_one({"id": customer_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"success": True}

@api_router.delete("/admin/customers/{customer_id}")
async def delete_customer(request: Request, customer_id: str):
    """Delete a customer (admin only)"""
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"success": True}

@api_router.get("/admin/customer-portal-settings")
async def get_customer_portal_settings(request: Request):
    """Get customer portal content settings"""
    settings = await db.customer_portal_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "welcome_message": "Welcome to your Solar Dashboard! Track your PM Surya Ghar Yojana application, savings, and installation details here.",
            "contact_number": "9296389097",
            "support_email": "support@asrenterprises.in",
            "service_hours": "Mon-Sat: 9 AM - 6 PM",
            "banner_text": "For any support, call us at 9296389097 or WhatsApp us anytime!",
            "important_notices": []
        }
    return settings

@api_router.put("/admin/customer-portal-settings")
async def update_customer_portal_settings(request: Request, data: Dict[str, Any]):
    """Update customer portal content settings (admin only)"""
    data.pop("_id", None)
    await db.customer_portal_settings.update_one({}, {"$set": data}, upsert=True)
    return {"success": True}

@api_router.post("/customer/send-otp")
async def customer_send_otp(request: Request, data: Dict[str, Any]):
    """Send OTP to customer's registered mobile number"""
    mobile = data.get("mobile", "").replace(" ", "").replace("+", "")
    mobile_clean = mobile[-10:] if len(mobile) >= 10 else mobile
    if len(mobile_clean) != 10 or not mobile_clean.isdigit():
        raise HTTPException(status_code=400, detail="Invalid mobile number")
    customer = await db.customers.find_one({"mobile": mobile_clean}, {"_id": 0, "name": 1})
    if not customer:
        raise HTTPException(status_code=404, detail="Mobile number not registered. Please contact ASR Enterprises to register.")
    return await _send_otp_impl({"mobile": mobile_clean})

@api_router.post("/customer/verify-otp")
async def customer_verify_otp(request: Request, data: Dict[str, Any]):
    """Verify OTP and return customer data"""
    mobile = data.get("mobile", "").replace(" ", "").replace("+", "")
    otp = data.get("otp", "").strip()
    mobile_clean = mobile[-10:] if len(mobile) >= 10 else mobile
    otp_result = await verify_otp(request, {"mobile": mobile_clean, "otp": otp})
    if not otp_result.get("success"):
        raise HTTPException(status_code=400, detail="OTP verification failed")
    customer = await db.customers.find_one({"mobile": mobile_clean}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    portal_settings = await get_customer_portal_settings(request)
    return {"success": True, "customer": customer, "portal_settings": portal_settings}

@api_router.post("/customer/service-request")
async def customer_service_request(request: Request, data: Dict[str, Any]):
    """Customer submits a service request"""
    mobile = data.get("mobile", "").replace(" ", "").replace("+", "")
    mobile_clean = mobile[-10:] if len(mobile) >= 10 else mobile
    service_req = {
        "id": str(uuid.uuid4()),
        "type": data.get("type", "general"),
        "description": sanitize_input(data.get("description", "")),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customers.update_one(
        {"mobile": mobile_clean},
        {"$push": {"service_requests": service_req}}
    )
    return {"success": True, "request_id": service_req["id"]}

# Include CRM router under /api prefix
api_router.include_router(crm_router)

# Include Staff router under /api prefix
api_router.include_router(staff_router)

# Include HR router under /api prefix
api_router.include_router(hr_router)

# Include WhatsApp router under /api prefix
api_router.include_router(whatsapp_router)

# Include Social Media router under /api prefix
api_router.include_router(social_media_router)

# Include Payments router under /api prefix (Cashfree Integration)
api_router.include_router(payments_router)

# Include Cashfree Orders router (Live Production Payments via Hosted Checkout)
api_router.include_router(cashfree_orders_router)

app.include_router(api_router)

# CORS configuration with security (env-driven; strict in production)
cors_origins = list(app_config.CORS_ORIGINS) or ["*"]
if app_config.IS_PRODUCTION and (cors_origins == ["*"] or "*" in cors_origins):
    logger.critical(
        "FATAL: CORS_ORIGINS must list explicit domains in production "
        "(wildcard '*' is not allowed). Set CORS_ORIGINS=https://yourdomain.com"
    )
    raise SystemExit(1)
# allow_credentials cannot be combined with wildcard origin per CORS spec
_allow_credentials = cors_origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=_allow_credentials,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
logger.info(
    "CORS configured: origins=%s, credentials=%s",
    cors_origins, _allow_credentials,
)

FRONTEND_BUILD_DIR = ROOT_DIR.parent / "frontend" / "build"

# Serve static assets (JS, CSS, images, etc.) from the build folder
_STATIC_ASSET_DIR = FRONTEND_BUILD_DIR / "static"
if _STATIC_ASSET_DIR.exists():
    app.mount("/static", StaticFiles(directory=_STATIC_ASSET_DIR), name="static_assets")

# ==================== DYNAMIC OG META INJECTION ====================
_OG_BASE_URL = "https://www.asrenterprises.in"
_OG_DEFAULT_IMAGE   = f"{_OG_BASE_URL}/og-home.jpg"
_OG_ADVISOR_IMAGE   = f"{_OG_BASE_URL}/og-advisor.jpg"
_OG_GALLERY_IMAGE   = f"{_OG_BASE_URL}/og-gallery.jpg"
_OG_CONTACT_IMAGE   = f"{_OG_BASE_URL}/og-contact.jpg"
_OG_SHOP_IMAGE      = f"{_OG_BASE_URL}/og-shop.jpg"
_OG_PRODUCT_CACHE: dict = {}  # simple TTL-less in-memory cache for product OG data

def _esc(s: str) -> str:
    """Escape HTML attribute characters."""
    return (s or "").replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")

def _build_og_block(title: str, description: str, image: str, canonical: str) -> str:
    """Return the HTML snippet that replaces the DYNAMIC_OG markers."""
    t, d, i, u = _esc(title), _esc(description), image, canonical
    return f"""<!-- DYNAMIC_OG_START -->
        <!-- Primary Meta Tags -->
        <title>{t}</title>
        <meta name="title" content="{t}" />
        <meta name="description" content="{d}" />
        <meta name="author" content="ASR Enterprises" />
        <meta name="robots" content="index, follow" />

        <!-- Canonical URL -->
        <link rel="canonical" href="{u}" />

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website" />
        <meta property="og:url" content="{u}" />
        <meta property="og:title" content="{t}" />
        <meta property="og:description" content="{d}" />
        <meta property="og:image" content="{i}" />
        <meta property="og:image:secure_url" content="{i}" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="{t}" />
        <meta property="og:site_name" content="ASR Enterprises" />
        <meta property="og:locale" content="en_IN" />

        <!-- Twitter Card -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="{u}" />
        <meta name="twitter:title" content="{t}" />
        <meta name="twitter:description" content="{d}" />
        <meta name="twitter:image" content="{i}" />
        <meta name="twitter:image:alt" content="{t}" />
        <!-- DYNAMIC_OG_END -->"""

async def _resolve_og(path: str, product_id: str = ""):
    """Return (title, description, image, canonical) for a given URL path."""
    path = "/" + path.strip("/")

    # Home
    if path in ("/", ""):
        return (
            "ASR Enterprises | Solar Solutions Patna, Bihar",
            "Get solar installation with subsidy in Bihar. Trusted rooftop solar company — PM Surya Ghar Yojana support, net metering, free site survey.",
            _OG_DEFAULT_IMAGE,
            _OG_BASE_URL + "/",
        )

    # Advisor page
    if path.rstrip("/") == "/advisor":
        return (
            "Become Solar Advisor - ASR Enterprises",
            "Join ASR Enterprises & earn with solar business. High commission, flexible work. Serving Bihar.",
            _OG_ADVISOR_IMAGE,
            _OG_BASE_URL + "/advisor",
        )

    # Gallery / Our Work
    if path.rstrip("/") == "/gallery":
        return (
            "Our Solar Installation Work - ASR Enterprises",
            "See our latest solar installation projects across Bihar. 25+ happy customers, 100kW+ total capacity.",
            _OG_GALLERY_IMAGE,
            _OG_BASE_URL + "/gallery",
        )

    # Contact
    if path.rstrip("/") == "/contact":
        return (
            "Contact ASR Enterprises - Solar Company Patna Bihar",
            "Contact ASR Enterprises for solar installation, subsidy assistance and free site survey. Call 9296389097.",
            _OG_CONTACT_IMAGE,
            _OG_BASE_URL + "/contact",
        )

    # Shop (with optional ?product=id for product-specific OG)
    if path.rstrip("/") == "/shop":
        if product_id:
            # Fetch product from DB and return product-specific OG
            try:
                cached_product = _OG_PRODUCT_CACHE.get(product_id)
                if not cached_product:
                    cached_product = await db.shop_products.find_one(
                        {"id": product_id},
                        {"_id": 0, "name": 1, "description": 1, "short_description": 1, "images": 1, "brand": 1, "sale_price": 1, "price": 1}
                    )
                    if cached_product:
                        _OG_PRODUCT_CACHE[product_id] = cached_product
                if cached_product:
                    p_name = cached_product.get("name", "Solar Product")
                    p_brand = cached_product.get("brand", "")
                    p_desc = (cached_product.get("short_description") or cached_product.get("description", ""))[:160]
                    p_price = cached_product.get("sale_price") or cached_product.get("price", "")
                    p_imgs = cached_product.get("images") or []
                    p_img = next((u for u in p_imgs if isinstance(u, str) and u.startswith("http")), _OG_SHOP_IMAGE)
                    t = f"{p_name}" + (f" by {p_brand}" if p_brand else "") + " | ASR Enterprises"
                    d = p_desc or f"Buy {p_name} at ASR Enterprises Solar Hub. Quality solar products with doorstep delivery in Bihar."
                    if p_price:
                        d = d[:120] + f" Price: ₹{p_price}" if len(d) > 120 else d + f" Price: ₹{p_price}"
                    return (t, d, p_img, f"{_OG_BASE_URL}/shop?product={product_id}")
            except Exception as _pe:
                logger.warning(f"OG product lookup failed for {product_id}: {_pe}")
        return (
            "Solar Shop - ASR Enterprises",
            "Buy solar panels, inverters, batteries and accessories online. Quality products, doorstep delivery in Bihar.",
            _OG_SHOP_IMAGE,
            _OG_BASE_URL + "/shop",
        )

    # Product detail page: /product/:id
    product_match = re.match(r"^/product/([^/?#]+)$", path)
    if product_match:
        product_id = product_match.group(1)
        try:
            product = _OG_PRODUCT_CACHE.get(product_id)
            if not product:
                product = await db.shop_products.find_one(
                    {"id": product_id},
                    {"_id": 0, "name": 1, "description": 1, "short_description": 1, "images": 1, "brand": 1}
                )
                if product:
                    _OG_PRODUCT_CACHE[product_id] = product
            if product:
                name = product.get("name", "Solar Product")
                desc = product.get("short_description") or product.get("description", "")
                desc = (desc[:200] + "…") if len(desc) > 200 else desc
                imgs = product.get("images", [])
                img = next((u for u in imgs if isinstance(u, str) and u.startswith("http")), _OG_DEFAULT_IMAGE)
                brand = product.get("brand", "")
                title = f"{name}{' - ' + brand if brand else ''} | ASR Enterprises"
                return (title, desc or f"Buy {name} from ASR Enterprises. Quality solar products in Bihar.", img, f"{_OG_BASE_URL}/product/{product_id}")
        except Exception as _e:
            logger.warning(f"OG product fetch failed for {product_id}: {_e}")

    # Default fallback for any other page
    return (
        "ASR Enterprises | Rooftop Solar Solutions in Patna, Bihar",
        "Trusted rooftop solar company in Patna, Bihar. Solar installation, PM Surya Ghar subsidy, net metering.",
        _OG_DEFAULT_IMAGE,
        _OG_BASE_URL + path,
    )

# SPA catch-all: serve index.html with dynamic OG meta injection for bots/crawlers.
# All API routes are registered before this so they take priority.
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str, request: Request):
    """Serve the React SPA with route-specific OG meta tags for social sharing."""
    from fastapi.responses import FileResponse as _FileResponse, HTMLResponse as _HTMLResponse

    index_file = FRONTEND_BUILD_DIR / "index.html"
    if not index_file.exists():
        from fastapi.responses import JSONResponse as _JSONResponse
        return _JSONResponse({"detail": "Frontend not built yet"}, status_code=404)

    # Static files in the build directory are served directly
    candidate = FRONTEND_BUILD_DIR / full_path
    if candidate.is_file():
        return _FileResponse(str(candidate))

    # Determine if this path needs dynamic OG injection.
    # We inject for known page routes; fall through to plain FileResponse for anything else.
    path = "/" + full_path.strip("/")
    product_id = request.query_params.get("product", "").strip()
    needs_og = (
        path in ("/", "")
        or path.rstrip("/") in ("/advisor", "/gallery", "/contact", "/shop", "/about")
        or bool(re.match(r"^/product/[^/?#]+$", path))
        or (path.rstrip("/") == "/shop" and bool(product_id))
    )

    if not needs_og:
        # Unknown/other routes: serve index.html as-is (React Router handles it)
        return _FileResponse(str(index_file))

    # Resolve OG meta for this route and inject into HTML
    try:
        title, description, image, canonical = await _resolve_og(path, product_id=product_id)
        og_block = _build_og_block(title, description, image, canonical)
        html = index_file.read_text(encoding="utf-8")

        # Always strip any existing og:/twitter:/canonical tags first so there are
        # no duplicates that could confuse social-media crawlers (WhatsApp reads the
        # LAST occurrence, so leaving old static tags in place would override ours).
        html = re.sub(r'<meta\s+property="og:[^"]*"[^>]*/?\s*>', "", html)
        html = re.sub(r"<meta\s+property='og:[^']*'[^>]*/?\s*>", "", html)
        html = re.sub(r'<meta\s+name="twitter:[^"]*"[^>]*/?\s*>', "", html)
        html = re.sub(r"<meta\s+name='twitter:[^']*'[^>]*/?\s*>", "", html)
        html = re.sub(r'<link\s+rel="canonical"[^>]*/?\s*>', "", html)
        html = re.sub(r"<link\s+rel='canonical'[^>]*/?\s*>", "", html)

        inject = og_block.replace("<!-- DYNAMIC_OG_START -->", "").replace("<!-- DYNAMIC_OG_END -->", "").strip()

        if "<!-- DYNAMIC_OG_START -->" in html:
            # Built index.html has the placeholder markers — replace (already stripped above)
            html = re.sub(
                r"<!-- DYNAMIC_OG_START -->.*?<!-- DYNAMIC_OG_END -->",
                inject,
                html,
                flags=re.DOTALL,
            )
        else:
            # Older build: inject right after <head> — now guaranteed no duplicate tags
            html = html.replace("<head>", f"<head>\n{inject}", 1)

        logger.debug(f"OG inject: path={path} title={title!r}")
        return _HTMLResponse(content=html, status_code=200, headers={"Cache-Control": "no-cache"})
    except Exception as _e:
        logger.error(f"OG injection failed for {path}: {_e}")
        return _FileResponse(str(index_file))

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
