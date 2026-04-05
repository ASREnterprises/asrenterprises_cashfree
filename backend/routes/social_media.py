"""
Social Media Manager Routes
Handles Facebook and Instagram integration for posting content
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import os
import uuid
import httpx
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social", tags=["Social Media"])

# Database connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Facebook Graph API
FB_GRAPH_API = "https://graph.facebook.com/v18.0"

# ==================== HELPER FUNCTIONS ====================

async def get_social_settings():
    """Get social media settings"""
    settings = await db.social_accounts.find_one({}, {"_id": 0})
    return settings or {}

async def validate_facebook_token(access_token: str, page_id: str):
    """Validate Facebook access token and page access"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Check token validity
            response = await client.get(
                f"{FB_GRAPH_API}/{page_id}",
                params={"access_token": access_token, "fields": "id,name,access_token"}
            )
            if response.status_code == 200:
                return {"valid": True, "data": response.json()}
            else:
                return {"valid": False, "error": response.json().get("error", {}).get("message", "Invalid token")}
    except Exception as e:
        return {"valid": False, "error": str(e)}

async def validate_instagram_account(access_token: str, ig_account_id: str):
    """Validate Instagram Business Account"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FB_GRAPH_API}/{ig_account_id}",
                params={"access_token": access_token, "fields": "id,username,profile_picture_url"}
            )
            if response.status_code == 200:
                return {"valid": True, "data": response.json()}
            else:
                return {"valid": False, "error": response.json().get("error", {}).get("message", "Invalid account")}
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
        await db.social_accounts.update_one(
            {},
            {"$set": {
                "facebook_page_id": page_id,
                "facebook_access_token": access_token,
                "facebook_connected": True,
                "facebook_page_name": page_data.get("name", ""),
                "facebook_connected_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {
            "success": True,
            "message": f"Connected to Facebook Page: {page_data.get('name', page_id)}",
            "page_name": page_data.get("name", "")
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
        return {"success": False, "error": "Facebook not configured"}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            if post.get("image_url"):
                # Photo post
                response = await client.post(
                    f"{FB_GRAPH_API}/{page_id}/photos",
                    data={
                        "url": post["image_url"],
                        "caption": post.get("caption", ""),
                        "access_token": access_token
                    }
                )
            elif post.get("video_url"):
                # Video post
                response = await client.post(
                    f"{FB_GRAPH_API}/{page_id}/videos",
                    data={
                        "file_url": post["video_url"],
                        "description": post.get("caption", ""),
                        "access_token": access_token
                    }
                )
            else:
                # Text-only post
                response = await client.post(
                    f"{FB_GRAPH_API}/{page_id}/feed",
                    data={
                        "message": post.get("caption", ""),
                        "access_token": access_token
                    }
                )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "post_id": data.get("id") or data.get("post_id"),
                    "message": "Published to Facebook"
                }
            else:
                error = response.json().get("error", {})
                return {
                    "success": False,
                    "error": error.get("message", "Failed to publish to Facebook")
                }
    except Exception as e:
        logger.error(f"Facebook publish error: {e}")
        return {"success": False, "error": str(e)}

async def publish_to_instagram(post: dict, settings: dict, access_token: str):
    """Publish to Instagram Business Account"""
    ig_account_id = settings.get("instagram_account_id", "")
    
    if not ig_account_id or not access_token:
        return {"success": False, "error": "Instagram not configured"}
    
    # Instagram requires an image or video
    if not post.get("image_url") and not post.get("video_url"):
        return {"success": False, "error": "Instagram requires an image or video"}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1: Create media container
            if post.get("video_url"):
                container_response = await client.post(
                    f"{FB_GRAPH_API}/{ig_account_id}/media",
                    data={
                        "video_url": post["video_url"],
                        "caption": post.get("caption", ""),
                        "media_type": "REELS",
                        "access_token": access_token
                    }
                )
            else:
                container_response = await client.post(
                    f"{FB_GRAPH_API}/{ig_account_id}/media",
                    data={
                        "image_url": post["image_url"],
                        "caption": post.get("caption", ""),
                        "access_token": access_token
                    }
                )
            
            if container_response.status_code not in [200, 201]:
                error = container_response.json().get("error", {})
                return {
                    "success": False,
                    "error": error.get("message", "Failed to create Instagram media container")
                }
            
            container_id = container_response.json().get("id")
            
            # Step 2: Publish the container
            publish_response = await client.post(
                f"{FB_GRAPH_API}/{ig_account_id}/media_publish",
                data={
                    "creation_id": container_id,
                    "access_token": access_token
                }
            )
            
            if publish_response.status_code in [200, 201]:
                data = publish_response.json()
                return {
                    "success": True,
                    "post_id": data.get("id"),
                    "message": "Published to Instagram"
                }
            else:
                error = publish_response.json().get("error", {})
                return {
                    "success": False,
                    "error": error.get("message", "Failed to publish to Instagram")
                }
    except Exception as e:
        logger.error(f"Instagram publish error: {e}")
        return {"success": False, "error": str(e)}

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
