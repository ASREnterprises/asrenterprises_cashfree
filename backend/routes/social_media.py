"""
Social Media Manager Routes
Handles Facebook and Instagram integration for posting content
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Response
from db_client import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import os
import uuid
import httpx
import asyncio
import logging
import requests

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social", tags=["Social Media"])

# Database connection - uses EFFECTIVE_DB_NAME from db_client (Atlas-aware)
from db_client import get_db
db = get_db()
client = db.client

# Facebook Graph API - Use v19.0 for latest features
FB_GRAPH_API = "https://graph.facebook.com/v19.0"

# Object Storage
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "asr-social-media"
storage_key = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "mp4": "video/mp4",
    "mov": "video/quicktime", "avi": "video/x-msvideo", "pdf": "application/pdf"
}

def init_storage():
    """Initialize storage - call once at startup"""
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Failed to initialize storage: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to object storage"""
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    """Download file from object storage"""
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Initialize storage on module load
try:
    init_storage()
except Exception as e:
    logger.warning(f"Storage initialization skipped: {e}")

# ==================== HELPER FUNCTIONS ====================

async def get_social_settings():
    """Get social media settings, merging env vars over DB.

    Env-provided Facebook page access token (`FACEBOOK_PAGE_ACCESS_TOKEN`)
    and optional `FACEBOOK_PAGE_ID` / `INSTAGRAM_ACCOUNT_ID` are used as
    defaults when DB fields are empty. The `*_connected` flags are then
    DERIVED from the presence of usable credentials so a stale empty DB
    document can never silently flip the integration to "disconnected".
    """
    db_settings = await db.social_accounts.find_one({}, {"_id": 0}) or {}

    env_fb_token = os.environ.get("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
    env_fb_page_id = os.environ.get("FACEBOOK_PAGE_ID", "").strip()
    env_ig_account_id = os.environ.get("INSTAGRAM_ACCOUNT_ID", "").strip()

    # Env wins for the access token (canonical, rotatable from infra).
    # For page/account IDs, env wins when set, else DB.
    merged = dict(db_settings)
    merged["facebook_access_token"] = (
        env_fb_token or db_settings.get("facebook_access_token", "")
    )
    merged["facebook_page_id"] = (
        env_fb_page_id or db_settings.get("facebook_page_id", "")
    )
    merged["instagram_account_id"] = (
        env_ig_account_id or db_settings.get("instagram_account_id", "")
    )

    # Derive connection state from credential presence. Only honor an explicit
    # DB `*_connected: False` if there is NO env-provided token (otherwise env
    # is the source of truth and we treat the integration as connected).
    has_fb_creds = bool(merged["facebook_access_token"] and merged["facebook_page_id"])
    if has_fb_creds:
        if env_fb_token:
            merged["facebook_connected"] = True
        else:
            merged["facebook_connected"] = db_settings.get("facebook_connected", True)
    else:
        merged["facebook_connected"] = False

    has_ig_creds = bool(merged["facebook_access_token"] and merged["instagram_account_id"])
    if has_ig_creds:
        if env_fb_token:
            merged["instagram_connected"] = True
        else:
            merged["instagram_connected"] = db_settings.get("instagram_connected", True)
    else:
        merged["instagram_connected"] = False

    # Mark the source as "env" whenever the env var is set — even if the DB
    # also has a copy. This is the critical guard that prevents test-connection
    # from auto-disconnecting when the production token lives in an env secret.
    merged["facebook_token_source"] = "env" if env_fb_token else "db"
    return merged

async def validate_facebook_token(access_token: str, page_id: str):
    """Validate Facebook access token, page access, and permissions"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            # First check if token is valid and get page info
            response = await http_client.get(
                f"{FB_GRAPH_API}/{page_id}",
                params={"access_token": access_token, "fields": "id,name,access_token"}
            )
            if response.status_code != 200:
                error_data = response.json().get("error", {})
                error_msg = error_data.get("message", "Invalid token or Page ID")
                error_code = error_data.get("code", 0)
                
                # Provide specific guidance for common errors
                if error_code == 190:
                    error_msg = "Access token expired. Please generate a new Page Access Token from Meta Business Suite."
                elif error_code == 100:
                    error_msg = "Invalid Page ID. Please verify your Facebook Page ID."
                elif error_code == 200:
                    error_msg = "Missing permissions. Ensure your token has: pages_read_engagement, pages_manage_posts"
                
                return {"valid": False, "error": error_msg, "code": error_code}
            
            page_data = response.json()
            
            # Check token permissions
            debug_response = await http_client.get(
                f"{FB_GRAPH_API}/debug_token",
                params={"input_token": access_token, "access_token": access_token}
            )
            
            permissions_info = {
                "has_pages_read_engagement": False,
                "has_pages_manage_posts": False,
                "token_type": "unknown"
            }
            
            if debug_response.status_code == 200:
                debug_data = debug_response.json().get("data", {})
                scopes = debug_data.get("scopes", [])
                permissions_info["has_pages_read_engagement"] = "pages_read_engagement" in scopes
                permissions_info["has_pages_manage_posts"] = "pages_manage_posts" in scopes
                permissions_info["token_type"] = debug_data.get("type", "unknown")
                permissions_info["scopes"] = scopes
            
            return {
                "valid": True, 
                "data": page_data,
                "permissions": permissions_info
            }
    except Exception as e:
        return {"valid": False, "error": str(e)}

async def validate_instagram_account(access_token: str, ig_account_id: str):
    """Validate Instagram Business Account"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.get(
                f"{FB_GRAPH_API}/{ig_account_id}",
                params={"access_token": access_token, "fields": "id,username,profile_picture_url"}
            )
            if response.status_code == 200:
                return {"valid": True, "data": response.json()}
            else:
                error_data = response.json().get("error", {})
                return {"valid": False, "error": error_data.get("message", "Invalid account")}
    except Exception as e:
        return {"valid": False, "error": str(e)}

# ==================== SETTINGS ENDPOINTS ====================

@router.get("/settings")
async def get_settings():
    """Get social media connection settings"""
    settings = await get_social_settings()
    
    # Mask sensitive tokens
    masked_settings = {
        "facebook_page_id": settings.get("facebook_page_id", ""),
        "facebook_access_token": "***" + settings.get("facebook_access_token", "")[-8:] if settings.get("facebook_access_token") else "",
        "facebook_connected": settings.get("facebook_connected", False),
        "facebook_page_name": settings.get("facebook_page_name", ""),
        "facebook_permissions": settings.get("facebook_permissions", {}),
        "facebook_has_posting_permissions": settings.get("facebook_has_posting_permissions", False),
        "instagram_account_id": settings.get("instagram_account_id", ""),
        "instagram_connected": settings.get("instagram_connected", False),
        "instagram_username": settings.get("instagram_username", ""),
        "updated_at": settings.get("updated_at", "")
    }
    
    return masked_settings

@router.post("/settings")
async def save_settings(request: Request):
    """Save social media connection settings"""
    data = await request.json()
    
    facebook_page_id = data.get("facebook_page_id", "").strip()
    facebook_access_token = data.get("facebook_access_token", "").strip()
    instagram_account_id = data.get("instagram_account_id", "").strip()
    
    # Get existing settings to preserve tokens/IDs if not provided.
    # IMPORTANT: never wipe a credential to empty — that's how the integration
    # was silently auto-disconnecting on accidental empty saves.
    existing = await get_social_settings()

    if not facebook_access_token and existing.get("facebook_access_token"):
        facebook_access_token = existing.get("facebook_access_token")
    if not facebook_page_id and existing.get("facebook_page_id"):
        facebook_page_id = existing.get("facebook_page_id")
    if not instagram_account_id and existing.get("instagram_account_id"):
        instagram_account_id = existing.get("instagram_account_id")

    update_data = {
        "facebook_page_id": facebook_page_id,
        "facebook_access_token": facebook_access_token,
        "instagram_account_id": instagram_account_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.social_accounts.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "message": "Settings saved successfully"}

@router.post("/connect/facebook")
async def connect_facebook(request: Request):
    """Connect and validate Facebook Page"""
    data = await request.json()
    
    page_id = data.get("page_id", "").strip()
    access_token = data.get("access_token", "").strip()
    
    if not page_id or not access_token:
        raise HTTPException(status_code=400, detail="Page ID and Access Token are required")
    
    # Validate token
    result = await validate_facebook_token(access_token, page_id)
    
    if result["valid"]:
        page_data = result["data"]
        permissions = result.get("permissions", {})
        
        # Check if required permissions are present
        has_required_perms = permissions.get("has_pages_read_engagement") and permissions.get("has_pages_manage_posts")
        
        await db.social_accounts.update_one(
            {},
            {"$set": {
                "facebook_page_id": page_id,
                "facebook_access_token": access_token,
                "facebook_connected": True,
                "facebook_page_name": page_data.get("name", ""),
                "facebook_permissions": permissions,
                "facebook_has_posting_permissions": has_required_perms,
                "facebook_connected_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        warning_msg = ""
        if not has_required_perms:
            warning_msg = " WARNING: Missing required permissions (pages_read_engagement, pages_manage_posts). Posting may fail."
        
        return {
            "success": True,
            "message": f"Connected to Facebook Page: {page_data.get('name', page_id)}{warning_msg}",
            "page_name": page_data.get("name", ""),
            "permissions": permissions,
            "has_posting_permissions": has_required_perms
        }
    else:
        return {
            "success": False,
            "error": result.get("error", "Failed to connect to Facebook")
        }

@router.post("/connect/instagram")
async def connect_instagram(request: Request):
    """Connect and validate Instagram Business Account"""
    data = await request.json()
    
    account_id = data.get("account_id", "").strip()
    
    # Get Facebook access token from settings (Instagram uses same token)
    settings = await get_social_settings()
    access_token = settings.get("facebook_access_token", "")
    
    if not access_token:
        raise HTTPException(status_code=400, detail="Connect Facebook first. Instagram uses the same access token.")
    
    if not account_id:
        raise HTTPException(status_code=400, detail="Instagram Business Account ID is required")
    
    # Validate Instagram account
    result = await validate_instagram_account(access_token, account_id)
    
    if result["valid"]:
        ig_data = result["data"]
        await db.social_accounts.update_one(
            {},
            {"$set": {
                "instagram_account_id": account_id,
                "instagram_connected": True,
                "instagram_username": ig_data.get("username", ""),
                "instagram_connected_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {
            "success": True,
            "message": f"Connected to Instagram: @{ig_data.get('username', account_id)}",
            "username": ig_data.get("username", "")
        }
    else:
        return {
            "success": False,
            "error": result.get("error", "Failed to connect to Instagram")
        }

@router.post("/test-connection")
async def test_connection():
    """Test current social media connections"""
    settings = await get_social_settings()
    
    results = {
        "facebook": {"connected": False, "status": "Not configured"},
        "instagram": {"connected": False, "status": "Not configured"}
    }
    
    # Test Facebook
    if settings.get("facebook_access_token") and settings.get("facebook_page_id"):
        fb_result = await validate_facebook_token(
            settings["facebook_access_token"],
            settings["facebook_page_id"]
        )
        if fb_result["valid"]:
            results["facebook"] = {
                "connected": True,
                "status": "Connected",
                "page_name": fb_result["data"].get("name", "")
            }
        else:
            results["facebook"] = {
                "connected": False,
                "status": f"Error: {fb_result.get('error', 'Token expired or invalid')}"
            }
            # NOTE: We intentionally do NOT write facebook_connected=False to the
            # database here. A test is read-only — it must never auto-disconnect.
            # The user must explicitly disconnect via the UI. This was the primary
            # cause of the "always auto-disconnected" bug.
    
    # Test Instagram
    if settings.get("facebook_access_token") and settings.get("instagram_account_id"):
        ig_result = await validate_instagram_account(
            settings["facebook_access_token"],
            settings["instagram_account_id"]
        )
        if ig_result["valid"]:
            results["instagram"] = {
                "connected": True,
                "status": "Connected",
                "username": ig_result["data"].get("username", "")
            }
        else:
            results["instagram"] = {
                "connected": False,
                "status": f"Error: {ig_result.get('error', 'Account invalid')}"
            }
            # NOTE: Same as above — test-connection is read-only, no DB writes.
    
    return results

# ==================== FILE UPLOAD ENDPOINTS ====================

@router.post("/disconnect")
async def disconnect_social(request: Request):
    """Explicitly disconnect Facebook and/or Instagram.
    
    This is the ONLY sanctioned way to set *_connected to False.
    The test-connection endpoint never modifies the DB.
    """
    data = await request.json()
    platform = data.get("platform", "all")  # "facebook", "instagram", or "all"

    update = {}
    if platform in ("facebook", "all"):
        update["facebook_connected"] = False
        update["facebook_access_token"] = ""
        update["facebook_page_id"] = ""
        update["facebook_page_name"] = ""
    if platform in ("instagram", "all"):
        update["instagram_connected"] = False
        update["instagram_account_id"] = ""
        update["instagram_username"] = ""

    if update:
        await db.social_accounts.update_one({}, {"$set": update}, upsert=True)

    return {"success": True, "message": f"{platform.capitalize()} disconnected successfully"}


@router.post("/upload/media")
async def upload_media(file: UploadFile = File(...)):
    """Upload image or video for social media posts"""
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}")
    
    # Validate file size (max 25MB for videos, 8MB for images)
    max_size = 25 * 1024 * 1024 if file.content_type.startswith("video") else 8 * 1024 * 1024
    
    # Read file content
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large. Max size: {max_size // (1024*1024)}MB")
    
    # Generate unique path
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    file_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/media/{file_id}.{ext}"
    
    try:
        # Upload to object storage
        result = put_object(storage_path, content, file.content_type)
        
        # Store file record in DB
        file_record = {
            "id": file_id,
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.social_media_files.insert_one(file_record)
        
        return {
            "success": True,
            "file_id": file_id,
            "path": result["path"],
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content)
        }
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/files/{file_id}")
async def get_file(file_id: str):
    """Get file by ID - returns file content"""
    record = await db.social_media_files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        content, content_type = get_object(record["storage_path"])
        return Response(
            content=content,
            media_type=record.get("content_type", content_type),
            headers={"Content-Disposition": f"inline; filename={record.get('original_filename', 'file')}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")

@router.get("/files/{file_id}/url")
async def get_file_url(file_id: str, request: Request):
    """Get public URL for a file"""
    record = await db.social_media_files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Generate URL to serve through our API
    base_url = str(request.base_url).rstrip("/")
    file_url = f"{base_url}/api/social/files/{file_id}"
    
    return {"url": file_url, "file_id": file_id}

# ==================== POST ENDPOINTS ====================

@router.post("/posts/create")
async def create_post(request: Request):
    """Create and optionally publish a social media post"""
    data = await request.json()
    
    caption = data.get("caption", "").strip()
    image_url = data.get("image_url", "").strip()
    video_url = data.get("video_url", "").strip()
    platforms = data.get("platforms", [])  # ["facebook", "instagram"] or ["both"]
    schedule_time = data.get("schedule_time")  # ISO datetime string or None for immediate
    
    if not caption:
        raise HTTPException(status_code=400, detail="Caption is required")
    
    if not platforms:
        raise HTTPException(status_code=400, detail="Select at least one platform")
    
    # Normalize platforms
    if "both" in platforms:
        platforms = ["facebook", "instagram"]
    
    settings = await get_social_settings()
    
    # Validate connections
    if "facebook" in platforms and not settings.get("facebook_connected"):
        raise HTTPException(status_code=400, detail="Facebook is not connected. Please connect in Settings.")
    
    if "instagram" in platforms and not settings.get("instagram_connected"):
        raise HTTPException(status_code=400, detail="Instagram is not connected. Please connect in Settings.")
    
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    post_record = {
        "id": post_id,
        "caption": caption,
        "image_url": image_url,
        "video_url": video_url,
        "platforms": platforms,
        "status": "scheduled" if schedule_time else "pending",
        "schedule_time": schedule_time,
        "created_at": now,
        "results": {}
    }
    
    if schedule_time:
        # Save as scheduled post
        await db.social_scheduled_posts.insert_one(post_record)
        return {
            "success": True,
            "message": f"Post scheduled for {schedule_time}",
            "post_id": post_id,
            "status": "scheduled"
        }
    else:
        # Publish immediately
        results = await publish_post_to_platforms(post_record, settings)
        post_record["status"] = "published" if any(r.get("success") for r in results.values()) else "failed"
        post_record["results"] = results
        post_record["published_at"] = now
        
        await db.social_posts.insert_one(post_record)
        
        return {
            "success": any(r.get("success") for r in results.values()),
            "message": "Post published" if post_record["status"] == "published" else "Post failed",
            "post_id": post_id,
            "results": results
        }

async def publish_post_to_platforms(post: dict, settings: dict):
    """Publish post to selected platforms"""
    results = {}
    
    access_token = settings.get("facebook_access_token", "")
    
    for platform in post.get("platforms", []):
        if platform == "facebook":
            results["facebook"] = await publish_to_facebook(post, settings, access_token)
        elif platform == "instagram":
            results["instagram"] = await publish_to_instagram(post, settings, access_token)
    
    return results

async def get_page_access_token(page_id: str, system_user_token: str):
    """
    Get Page Access Token from System User token.
    System User tokens have permissions but need to be exchanged for a Page token to post.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(
                f"{FB_GRAPH_API}/{page_id}",
                params={
                    "fields": "access_token",
                    "access_token": system_user_token
                }
            )
            data = response.json()
            page_token = data.get("access_token")
            if page_token:
                logger.info(f"Successfully obtained Page Access Token for page {page_id}")
                return page_token
            else:
                logger.warning(f"Could not get Page token: {data}")
                return system_user_token  # Fall back to original token
    except Exception as e:
        logger.error(f"Error getting Page Access Token: {e}")
        return system_user_token  # Fall back to original token

async def publish_to_facebook(post: dict, settings: dict, access_token: str):
    """Publish to Facebook Page"""
    page_id = settings.get("facebook_page_id", "")
    
    if not page_id or not access_token:
        return {"success": False, "error": "Facebook not configured. Please add Page ID and Access Token in Settings."}
    
    try:
        # Get Page Access Token (important for System User tokens)
        page_access_token = await get_page_access_token(page_id, access_token)
        
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            image_url = post.get("image_url", "")
            video_url = post.get("video_url", "")
            
            # Check if the URL is from our API (local file) - need to fetch and upload directly
            is_local_image = image_url and "/api/social/files/" in image_url
            is_local_video = video_url and "/api/social/files/" in video_url
            
            if is_local_image:
                # Fetch the image from our storage and upload directly to Facebook
                try:
                    file_response = await http_client.get(image_url, timeout=30.0)
                    if file_response.status_code == 200:
                        # Upload as multipart form data
                        files = {
                            "source": ("image.jpg", file_response.content, "image/jpeg"),
                        }
                        data = {
                            "caption": post.get("caption", ""),
                            "access_token": page_access_token,
                            "published": "true"
                        }
                        response = await http_client.post(
                            f"{FB_GRAPH_API}/{page_id}/photos",
                            files=files,
                            data=data
                        )
                    else:
                        return {"success": False, "error": f"Could not fetch local image: HTTP {file_response.status_code}"}
                except Exception as e:
                    logger.error(f"Error uploading local image to Facebook: {e}")
                    return {"success": False, "error": f"Failed to upload image: {str(e)}"}
            elif is_local_video:
                # Fetch and upload video directly
                try:
                    file_response = await http_client.get(video_url, timeout=60.0)
                    if file_response.status_code == 200:
                        files = {
                            "source": ("video.mp4", file_response.content, "video/mp4"),
                        }
                        data = {
                            "description": post.get("caption", ""),
                            "access_token": page_access_token
                        }
                        response = await http_client.post(
                            f"{FB_GRAPH_API}/{page_id}/videos",
                            files=files,
                            data=data
                        )
                    else:
                        return {"success": False, "error": f"Could not fetch local video: HTTP {file_response.status_code}"}
                except Exception as e:
                    logger.error(f"Error uploading local video to Facebook: {e}")
                    return {"success": False, "error": f"Failed to upload video: {str(e)}"}
            elif image_url:
                # External URL - use URL method
                response = await http_client.post(
                    f"{FB_GRAPH_API}/{page_id}/photos",
                    data={
                        "url": image_url,
                        "caption": post.get("caption", ""),
                        "access_token": page_access_token,
                        "published": "true"
                    }
                )
            elif video_url:
                # External video URL - use resumable upload for better reliability
                # First, try the direct URL method
                response = await http_client.post(
                    f"{FB_GRAPH_API}/{page_id}/videos",
                    data={
                        "file_url": video_url,
                        "description": post.get("caption", ""),
                        "access_token": page_access_token
                    },
                    timeout=180.0  # Longer timeout for video uploads
                )
                
                # Check if the direct URL method failed
                if response.status_code not in [200, 201]:
                    response_data = response.json()
                    error = response_data.get("error", {})
                    error_code = error.get("code", 0)
                    
                    # If it's a URL access error, provide specific guidance
                    if error_code == 100 or "fetch" in str(error.get("message", "")).lower():
                        return {
                            "success": False,
                            "error": "Facebook couldn't access the video URL. Please ensure:\n1. The URL is publicly accessible (not behind login)\n2. The video format is supported (MP4, MOV)\n3. Try uploading a direct video file instead of a URL",
                            "error_code": error_code
                        }
            else:
                # Text-only post - use /feed endpoint
                response = await http_client.post(
                    f"{FB_GRAPH_API}/{page_id}/feed",
                    data={
                        "message": post.get("caption", ""),
                        "access_token": page_access_token
                    }
                )
            
            response_data = response.json()
            
            if response.status_code in [200, 201]:
                return {
                    "success": True,
                    "post_id": response_data.get("id") or response_data.get("post_id"),
                    "message": "Published to Facebook"
                }
            else:
                error = response_data.get("error", {})
                error_code = error.get("code", 0)
                error_msg = error.get("message", "Failed to publish to Facebook")
                
                # Provide specific guidance for common errors
                if error_code == 200:
                    error_msg = "PERMISSION ERROR: Your token lacks required permissions. Go to Meta Business Suite → Settings → Apps → Add permissions: pages_read_engagement, pages_manage_posts. Then generate a new Page Access Token."
                elif error_code == 190:
                    error_msg = "TOKEN EXPIRED: Your access token has expired. Generate a new Page Access Token from Meta Business Suite."
                elif error_code == 100:
                    error_msg = "INVALID REQUEST: Check your Page ID or image/video URL. Ensure the media URL is publicly accessible."
                elif error_code == 10:
                    error_msg = "APP PERMISSION: Your Facebook App needs to be approved. Submit for App Review in Meta Developer Console."
                
                return {
                    "success": False,
                    "error": error_msg,
                    "error_code": error_code
                }
    except Exception as e:
        logger.error(f"Facebook publish error: {e}")
        return {"success": False, "error": f"Network error: {str(e)}"}

async def publish_to_instagram(post: dict, settings: dict, access_token: str):
    """Publish to Instagram Business Account"""
    ig_account_id = settings.get("instagram_account_id", "")
    page_id = settings.get("facebook_page_id", "")
    
    if not ig_account_id or not access_token:
        return {"success": False, "error": "Instagram not configured. Connect Facebook first, then add Instagram Business Account ID."}
    
    image_url = post.get("image_url", "")
    video_url = post.get("video_url", "")
    
    # Instagram requires an image or video
    if not image_url and not video_url:
        return {"success": False, "error": "Instagram requires an image or video. Text-only posts are not supported."}
    
    # Check if URL is from our local API - Instagram REQUIRES publicly accessible URLs
    is_local = ("/api/social/files/" in image_url) or ("/api/social/files/" in video_url)
    if is_local:
        return {
            "success": False, 
            "error": "Instagram requires a publicly accessible URL. Please use the direct URL input instead of file upload, or upload your image to a free image hosting service (like imgur.com or imgbb.com) and paste the URL."
        }
    
    try:
        # Get Page Access Token for Instagram API calls
        page_access_token = await get_page_access_token(page_id, access_token) if page_id else access_token
        
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            # Step 1: Create media container
            if video_url:
                container_response = await http_client.post(
                    f"{FB_GRAPH_API}/{ig_account_id}/media",
                    data={
                        "video_url": video_url,
                        "caption": post.get("caption", ""),
                        "media_type": "REELS",
                        "access_token": page_access_token
                    }
                )
            else:
                container_response = await http_client.post(
                    f"{FB_GRAPH_API}/{ig_account_id}/media",
                    data={
                        "image_url": image_url,
                        "caption": post.get("caption", ""),
                        "access_token": page_access_token
                    }
                )
            
            container_data = container_response.json()
            
            if container_response.status_code not in [200, 201]:
                error = container_data.get("error", {})
                error_code = error.get("code", 0)
                error_msg = error.get("message", "Failed to create Instagram media container")
                
                if error_code == 200:
                    error_msg = "PERMISSION ERROR: Your token lacks instagram_content_publish permission."
                elif "image" in error_msg.lower() or "url" in error_msg.lower():
                    error_msg = "IMAGE ERROR: Instagram couldn't access the image URL. Use a direct public URL (e.g., from imgur.com or imgbb.com)."
                
                return {"success": False, "error": error_msg, "error_code": error_code}
            
            container_id = container_data.get("id")
            
            # Step 2: Wait for media to be ready (Instagram processes asynchronously)
            # For videos/reels, need to poll until ready
            if video_url:
                max_retries = 30  # Wait up to 60 seconds for video processing
                for i in range(max_retries):
                    await asyncio.sleep(2)
                    status_response = await http_client.get(
                        f"{FB_GRAPH_API}/{container_id}",
                        params={
                            "fields": "status_code,status",
                            "access_token": page_access_token
                        }
                    )
                    status_data = status_response.json()
                    status_code = status_data.get("status_code", "")
                    
                    if status_code == "FINISHED":
                        break
                    elif status_code == "ERROR":
                        return {
                            "success": False,
                            "error": f"Instagram video processing failed: {status_data.get('status', 'Unknown error')}"
                        }
                    # IN_PROGRESS - continue waiting
                else:
                    return {
                        "success": False,
                        "error": "Video processing timed out. Please try again with a shorter video."
                    }
            else:
                # For images, a short wait is usually sufficient
                await asyncio.sleep(3)
            
            # Step 3: Publish the container
            publish_response = await http_client.post(
                f"{FB_GRAPH_API}/{ig_account_id}/media_publish",
                data={
                    "creation_id": container_id,
                    "access_token": page_access_token
                }
            )
            
            publish_data = publish_response.json()
            
            if publish_response.status_code in [200, 201]:
                return {
                    "success": True,
                    "post_id": publish_data.get("id"),
                    "message": "Published to Instagram"
                }
            else:
                error = publish_data.get("error", {})
                error_code = error.get("code", 0)
                error_msg = error.get("message", "Failed to publish to Instagram")
                
                if "not ready" in error_msg.lower():
                    error_msg = "Media still processing. Please try again in a few seconds."
                
                return {"success": False, "error": error_msg, "error_code": error_code}
    except Exception as e:
        logger.error(f"Instagram publish error: {e}")
        return {"success": False, "error": f"Network error: {str(e)}"}

@router.get("/posts")
async def get_posts(status: str = "all", page: int = 1, limit: int = 20):
    """Get posts by status"""
    skip = (page - 1) * limit
    
    query = {}
    if status != "all":
        query["status"] = status
    
    posts = await db.social_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.social_posts.count_documents(query)
    
    return {
        "posts": posts,
        "pagination": {
            "current_page": page,
            "total_pages": (total + limit - 1) // limit if total > 0 else 1,
            "total_count": total
        }
    }

@router.get("/posts/scheduled")
async def get_scheduled_posts(page: int = 1, limit: int = 20):
    """Get scheduled posts"""
    skip = (page - 1) * limit
    
    posts = await db.social_scheduled_posts.find(
        {"status": "scheduled"},
        {"_id": 0}
    ).sort("schedule_time", 1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.social_scheduled_posts.count_documents({"status": "scheduled"})
    
    return {
        "posts": posts,
        "pagination": {
            "current_page": page,
            "total_pages": (total + limit - 1) // limit if total > 0 else 1,
            "total_count": total
        }
    }

@router.delete("/posts/scheduled/{post_id}")
async def delete_scheduled_post(post_id: str):
    """Delete a scheduled post"""
    result = await db.social_scheduled_posts.delete_one({"id": post_id})
    
    if result.deleted_count > 0:
        return {"success": True, "message": "Scheduled post deleted"}
    else:
        raise HTTPException(status_code=404, detail="Post not found")

@router.put("/posts/scheduled/{post_id}")
async def update_scheduled_post(post_id: str, request: Request):
    """Update a scheduled post"""
    data = await request.json()
    
    update_data = {}
    if "caption" in data:
        update_data["caption"] = data["caption"]
    if "image_url" in data:
        update_data["image_url"] = data["image_url"]
    if "video_url" in data:
        update_data["video_url"] = data["video_url"]
    if "platforms" in data:
        platforms = data["platforms"]
        if "both" in platforms:
            platforms = ["facebook", "instagram"]
        update_data["platforms"] = platforms
    if "schedule_time" in data:
        update_data["schedule_time"] = data["schedule_time"]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.social_scheduled_posts.update_one(
        {"id": post_id},
        {"$set": update_data}
    )
    
    if result.matched_count > 0:
        return {"success": True, "message": "Post updated"}
    else:
        raise HTTPException(status_code=404, detail="Post not found")

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get social media dashboard statistics"""
    settings = await get_social_settings()
    
    total_posts = await db.social_posts.count_documents({})
    scheduled_posts = await db.social_scheduled_posts.count_documents({"status": "scheduled"})
    published_posts = await db.social_posts.count_documents({"status": "published"})
    failed_posts = await db.social_posts.count_documents({"status": "failed"})
    
    # Posts today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    posts_today = await db.social_posts.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    return {
        "total_posts": total_posts,
        "scheduled_posts": scheduled_posts,
        "published_posts": published_posts,
        "failed_posts": failed_posts,
        "posts_today": posts_today,
        "facebook_connected": settings.get("facebook_connected", False),
        "facebook_page_name": settings.get("facebook_page_name", ""),
        "instagram_connected": settings.get("instagram_connected", False),
        "instagram_username": settings.get("instagram_username", "")
    }

# ==================== FESTIVAL POST INTEGRATION ====================

@router.post("/posts/festival")
async def publish_festival_post(request: Request):
    """Publish a festival post to social media"""
    data = await request.json()
    
    image_url = data.get("image_url", "").strip()
    caption = data.get("caption", "").strip()
    platforms = data.get("platforms", [])
    
    if not image_url:
        raise HTTPException(status_code=400, detail="Image URL is required for festival posts")
    
    if not platforms:
        raise HTTPException(status_code=400, detail="Select at least one platform")
    
    # Use the create_post endpoint logic
    settings = await get_social_settings()
    
    # Normalize platforms
    if "both" in platforms:
        platforms = ["facebook", "instagram"]
    
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    post_record = {
        "id": post_id,
        "caption": caption,
        "image_url": image_url,
        "video_url": "",
        "platforms": platforms,
        "source": "festival",
        "status": "pending",
        "created_at": now,
        "results": {}
    }
    
    # Publish immediately
    results = await publish_post_to_platforms(post_record, settings)
    post_record["status"] = "published" if any(r.get("success") for r in results.values()) else "failed"
    post_record["results"] = results
    post_record["published_at"] = now
    
    await db.social_posts.insert_one(post_record)
    
    return {
        "success": any(r.get("success") for r in results.values()),
        "message": "Festival post published" if post_record["status"] == "published" else "Festival post failed",
        "post_id": post_id,
        "results": results
    }

# ==================== SCHEDULER (Background Task) ====================

async def process_scheduled_posts():
    """Process and publish scheduled posts that are due"""
    now = datetime.now(timezone.utc)
    
    # Find posts that are due
    due_posts = await db.social_scheduled_posts.find({
        "status": "scheduled",
        "schedule_time": {"$lte": now.isoformat()}
    }).to_list(100)
    
    settings = await get_social_settings()
    
    for post in due_posts:
        try:
            results = await publish_post_to_platforms(post, settings)
            status = "published" if any(r.get("success") for r in results.values()) else "failed"
            
            # Move to published posts
            post["status"] = status
            post["results"] = results
            post["published_at"] = datetime.now(timezone.utc).isoformat()
            del post["_id"]
            
            await db.social_posts.insert_one(post)
            await db.social_scheduled_posts.delete_one({"id": post["id"]})
            
            logger.info(f"Scheduled post {post['id']} processed: {status}")
        except Exception as e:
            logger.error(f"Error processing scheduled post {post['id']}: {e}")
            await db.social_scheduled_posts.update_one(
                {"id": post["id"]},
                {"$set": {"status": "failed", "error": str(e)}}
            )


# ==================== FACEBOOK PAGE POSTS SYNC FOR WEBSITE GALLERY ====================

@router.get("/facebook/posts")
async def get_facebook_page_posts(limit: int = 25):
    """
    Fetch latest posts from the connected Facebook Page.
    These can be used for Website Gallery / Latest Work display.
    """
    settings = await get_social_settings()
    
    if not settings.get("facebook_connected"):
        raise HTTPException(status_code=400, detail="Facebook Page not connected")
    
    page_id = settings.get("facebook_page_id")
    access_token = settings.get("facebook_access_token")
    
    if not page_id or not access_token:
        raise HTTPException(status_code=400, detail="Facebook credentials missing")
    
    try:
        # Get Page Access Token
        page_access_token = await get_page_access_token(page_id, access_token)
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            # Fetch posts - using only non-deprecated fields for Graph API v18+
            response = await http_client.get(
                f"{FB_GRAPH_API}/{page_id}/feed",
                params={
                    "fields": "id,message,full_picture,created_time,permalink_url,is_published",
                    "limit": limit,
                    "access_token": page_access_token
                }
            )
            
            if response.status_code != 200:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Failed to fetch posts")
                return {"success": False, "error": error_msg, "posts": []}
            
            data = response.json()
            posts = data.get("data", [])
            
            # Process posts to extract relevant info
            processed_posts = []
            for post in posts:
                media_url = post.get("full_picture", "")
                
                # Determine media type from URL extension
                media_type = "text"
                if media_url:
                    url_lower = media_url.lower()
                    if any(ext in url_lower for ext in ['.mp4', '.mov', '.avi', 'video']):
                        media_type = "video"
                    elif any(ext in url_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        media_type = "image"
                    else:
                        media_type = "image"  # Default to image if has full_picture
                
                processed_posts.append({
                    "id": post.get("id", ""),
                    "message": post.get("message", ""),
                    "media_type": media_type,
                    "media_url": media_url,
                    "full_picture": post.get("full_picture", ""),
                    "permalink_url": post.get("permalink_url", ""),
                    "created_time": post.get("created_time", ""),
                    "source": "facebook"
                })
            
            return {
                "success": True,
                "posts": processed_posts,
                "count": len(processed_posts)
            }
            
    except Exception as e:
        logger.error(f"Error fetching Facebook posts: {e}")
        return {"success": False, "error": str(e), "posts": []}

@router.post("/facebook/posts/sync")
async def sync_facebook_posts_to_gallery():
    """
    Sync Facebook Page posts to local database for Website Gallery.
    Admin can then select which posts to show on the website.
    """
    settings = await get_social_settings()
    
    if not settings.get("facebook_connected"):
        raise HTTPException(status_code=400, detail="Facebook Page not connected")
    
    # Fetch latest posts from Facebook
    posts_result = await get_facebook_page_posts(limit=50)
    
    if not posts_result.get("success"):
        return {"success": False, "error": posts_result.get("error", "Failed to fetch posts")}
    
    posts = posts_result.get("posts", [])
    synced_count = 0
    
    # Keywords that identify an installation work post
    INSTALLATION_KEYWORDS = [
        "install", "solar system", "kw", "kva", "ongrid", "on grid", "offgrid",
        "off grid", "rooftop", "panel", "inverter", "completed", "work done",
        "site", "watt", "mw", "system installed", "solar work",
    ]

    def _is_installation_post(caption: str) -> bool:
        caption_lower = caption.lower()
        return any(kw in caption_lower for kw in INSTALLATION_KEYWORDS)

    for post in posts:
        # Only sync posts with media
        if not post.get("media_url") and not post.get("full_picture"):
            continue

        # Only sync installation-related posts (filter by caption keywords)
        caption = post.get("message", "")
        if not _is_installation_post(caption):
            continue
        
        # Check if already synced
        existing = await db.website_gallery.find_one({"facebook_post_id": post["id"]})
        
        if not existing:
            gallery_item = {
                "id": str(uuid.uuid4()),
                "facebook_post_id": post["id"],
                "title": (post.get("message", "")[:100] + "...") if len(post.get("message", "")) > 100 else post.get("message", ""),
                "caption": post.get("message", ""),
                "media_url": post.get("media_url") or post.get("full_picture"),
                "media_type": post.get("media_type", "image"),
                "permalink_url": post.get("permalink_url", ""),
                "source": "facebook",
                "created_time": post.get("created_time", ""),
                # Admin controls - Auto-enable gallery display for newly synced posts
                "show_on_gallery": True,
                "show_on_latest_work": True,
                "featured": False,
                "hidden": False,
                "sort_order": 0,
                # Metadata
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.website_gallery.insert_one(gallery_item)
            synced_count += 1
        else:
            # Update existing post with new data
            await db.website_gallery.update_one(
                {"facebook_post_id": post["id"]},
                {"$set": {
                    "caption": post.get("message", ""),
                    "media_url": post.get("media_url") or post.get("full_picture"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    return {
        "success": True,
        "message": f"Synced {synced_count} new posts from Facebook",
        "synced_count": synced_count,
        "total_fetched": len(posts)
    }

@router.get("/gallery")
async def get_website_gallery(
    show_on_gallery: bool = None,
    show_on_latest_work: bool = None,
    featured: bool = None,
    include_hidden: bool = False,
    page: int = 1,
    limit: int = 50
):
    """
    Get gallery items for website or admin management.
    """
    query = {}
    
    if not include_hidden:
        query["hidden"] = {"$ne": True}
    
    if show_on_gallery is not None:
        query["show_on_gallery"] = show_on_gallery
    
    if show_on_latest_work is not None:
        query["show_on_latest_work"] = show_on_latest_work
    
    if featured is not None:
        query["featured"] = featured
    
    skip = (page - 1) * limit
    
    items = await db.website_gallery.find(
        query,
        {"_id": 0}
    ).sort([("sort_order", 1), ("created_time", -1)]).skip(skip).limit(limit).to_list(limit)
    
    total = await db.website_gallery.count_documents(query)
    
    return {
        "items": items,
        "pagination": {
            "current_page": page,
            "total_pages": (total + limit - 1) // limit if total > 0 else 1,
            "total_count": total
        }
    }

@router.put("/gallery/{item_id}")
async def update_gallery_item(item_id: str, request: Request):
    """
    Update gallery item settings (show on gallery, featured, etc.)
    """
    data = await request.json()
    
    update_data = {}
    
    # Boolean flags
    for field in ["show_on_gallery", "show_on_latest_work", "featured", "hidden"]:
        if field in data:
            update_data[field] = bool(data[field])
    
    # Other fields
    if "title" in data:
        update_data["title"] = data["title"]
    if "sort_order" in data:
        update_data["sort_order"] = int(data.get("sort_order", 0))
    if "location" in data:
        update_data["location"] = data["location"]
    if "project_type" in data:
        update_data["project_type"] = data["project_type"]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.website_gallery.update_one(
        {"id": item_id},
        {"$set": update_data}
    )
    
    if result.matched_count > 0:
        return {"success": True, "message": "Gallery item updated"}
    else:
        raise HTTPException(status_code=404, detail="Item not found")

@router.delete("/gallery/{item_id}")
async def delete_gallery_item(item_id: str):
    """Delete a gallery item"""
    result = await db.website_gallery.delete_one({"id": item_id})
    
    if result.deleted_count > 0:
        return {"success": True, "message": "Item deleted"}
    else:
        raise HTTPException(status_code=404, detail="Item not found")

@router.post("/gallery/manual")
async def add_manual_gallery_item(request: Request):
    """
    Add a manual gallery item (not from Facebook sync).
    """
    data = await request.json()
    
    if not data.get("media_url"):
        raise HTTPException(status_code=400, detail="Media URL is required")
    
    item = {
        "id": str(uuid.uuid4()),
        "facebook_post_id": None,  # Manual upload
        "title": data.get("title", ""),
        "caption": data.get("caption", ""),
        "media_url": data.get("media_url"),
        "media_type": data.get("media_type", "image"),
        "permalink_url": data.get("permalink_url", ""),
        "source": "manual",
        "location": data.get("location", ""),
        "project_type": data.get("project_type", ""),
        # Admin controls
        "show_on_gallery": data.get("show_on_gallery", True),
        "show_on_latest_work": data.get("show_on_latest_work", False),
        "featured": data.get("featured", False),
        "hidden": False,
        "sort_order": data.get("sort_order", 0),
        # Metadata
        "created_time": datetime.now(timezone.utc).isoformat(),
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.website_gallery.insert_one(item)
    
    # Return without _id
    item_copy = {k: v for k, v in item.items() if k != "_id"}
    
    return {"success": True, "item": item_copy}

@router.get("/gallery/public")
async def get_public_gallery(type: str = "all", limit: int = 50):
    """
    Get public gallery items for website display.
    For 'all' type, returns all non-hidden items (Facebook posts + manual uploads).
    """
    query = {"hidden": {"$ne": True}}
    
    if type == "gallery":
        query["show_on_gallery"] = True
    elif type == "latest_work":
        query["show_on_latest_work"] = True
    elif type == "featured":
        query["featured"] = True
    # For 'all' type - return all non-hidden items regardless of show_on_gallery status
    # This allows Facebook synced posts to appear in website gallery
    
    items = await db.website_gallery.find(
        query,
        {"_id": 0}
    ).sort([("featured", -1), ("sort_order", 1), ("created_time", -1)]).limit(limit).to_list(limit)
    
    return {"items": items, "count": len(items)}

# ==================== IMPROVED POSTING WITH RETRY ====================

@router.post("/posts/retry/{post_id}")
async def retry_failed_post(post_id: str):
    """Retry a failed post"""
    post = await db.social_posts.find_one({"id": post_id}, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.get("status") != "failed":
        return {"success": False, "error": "Only failed posts can be retried"}
    
    settings = await get_social_settings()
    
    # Retry publishing
    results = await publish_post_to_platforms(post, settings)
    
    new_status = "published" if any(r.get("success") for r in results.values()) else "failed"
    
    await db.social_posts.update_one(
        {"id": post_id},
        {"$set": {
            "status": new_status,
            "results": results,
            "retried_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": new_status == "published",
        "message": f"Post {'published successfully' if new_status == 'published' else 'still failed'}",
        "results": results
    }
