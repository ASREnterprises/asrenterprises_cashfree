"""
Social Media Manager Routes
Handles Facebook and Instagram integration for posting content
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Response
from motor.motor_asyncio import AsyncIOMotorClient
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

# Database connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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
    """Get social media settings"""
    settings = await db.social_accounts.find_one({}, {"_id": 0})
    return settings or {}

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
    
    # Get existing settings to preserve tokens if not provided
    existing = await get_social_settings()
    
    # Use existing tokens if new ones not provided
    if not facebook_access_token and existing.get("facebook_access_token"):
        facebook_access_token = existing.get("facebook_access_token")
    
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
            # Update settings to reflect disconnected state
            await db.social_accounts.update_one({}, {"$set": {"facebook_connected": False}})
    
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
            await db.social_accounts.update_one({}, {"$set": {"instagram_connected": False}})
    
    return results

# ==================== FILE UPLOAD ENDPOINTS ====================

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

async def publish_to_facebook(post: dict, settings: dict, access_token: str):
    """Publish to Facebook Page"""
    page_id = settings.get("facebook_page_id", "")
    
    if not page_id or not access_token:
        return {"success": False, "error": "Facebook not configured. Please add Page ID and Access Token in Settings."}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            if post.get("image_url"):
                # Photo post
                response = await http_client.post(
                    f"{FB_GRAPH_API}/{page_id}/photos",
                    data={
                        "url": post["image_url"],
                        "caption": post.get("caption", ""),
                        "access_token": access_token,
                        "published": "true"
                    }
                )
            elif post.get("video_url"):
                # Video post
                response = await http_client.post(
                    f"{FB_GRAPH_API}/{page_id}/videos",
                    data={
                        "file_url": post["video_url"],
                        "description": post.get("caption", ""),
                        "access_token": access_token
                    }
                )
            else:
                # Text-only post - use /feed endpoint
                response = await http_client.post(
                    f"{FB_GRAPH_API}/{page_id}/feed",
                    data={
                        "message": post.get("caption", ""),
                        "access_token": access_token
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
    
    if not ig_account_id or not access_token:
        return {"success": False, "error": "Instagram not configured. Connect Facebook first, then add Instagram Business Account ID."}
    
    # Instagram requires an image or video
    if not post.get("image_url") and not post.get("video_url"):
        return {"success": False, "error": "Instagram requires an image or video. Text-only posts are not supported."}
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            # Step 1: Create media container
            if post.get("video_url"):
                container_response = await http_client.post(
                    f"{FB_GRAPH_API}/{ig_account_id}/media",
                    data={
                        "video_url": post["video_url"],
                        "caption": post.get("caption", ""),
                        "media_type": "REELS",
                        "access_token": access_token
                    }
                )
            else:
                container_response = await http_client.post(
                    f"{FB_GRAPH_API}/{ig_account_id}/media",
                    data={
                        "image_url": post["image_url"],
                        "caption": post.get("caption", ""),
                        "access_token": access_token
                    }
                )
            
            container_data = container_response.json()
            
            if container_response.status_code not in [200, 201]:
                error = container_data.get("error", {})
                error_code = error.get("code", 0)
                error_msg = error.get("message", "Failed to create Instagram media container")
                
                if error_code == 200:
                    error_msg = "PERMISSION ERROR: Your token lacks instagram_content_publish permission."
                elif "image" in error_msg.lower():
                    error_msg = "IMAGE ERROR: Instagram couldn't access the image URL. Ensure it's publicly accessible and in JPEG/PNG format."
                
                return {"success": False, "error": error_msg, "error_code": error_code}
            
            container_id = container_data.get("id")
            
            # Step 2: Wait for media to be ready (Instagram processes asynchronously)
            await asyncio.sleep(2)
            
            # Step 3: Publish the container
            publish_response = await http_client.post(
                f"{FB_GRAPH_API}/{ig_account_id}/media_publish",
                data={
                    "creation_id": container_id,
                    "access_token": access_token
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
