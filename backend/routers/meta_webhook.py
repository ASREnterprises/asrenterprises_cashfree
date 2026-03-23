"""
Meta Webhook Integration for Facebook, Instagram, and WhatsApp Messages
Handles incoming messages and stores them in CRM
"""

from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import logging
import hmac
import hashlib

router = APIRouter(prefix="/api/meta", tags=["Meta Webhook"])

# Configure logging
logger = logging.getLogger(__name__)

# Meta Webhook Configuration - loaded dynamically to support env updates
def get_verify_token():
    return os.environ.get("META_VERIFY_TOKEN", "asrsolar2026")

def get_app_secret():
    return os.environ.get("META_APP_SECRET", "")

# Database reference (will be set from main server)
db = None

def set_database(database):
    """Set database reference from main application"""
    global db
    db = database


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify that the webhook request came from Meta"""
    app_secret = get_app_secret()
    if not app_secret:
        logger.warning("META_APP_SECRET not configured - skipping signature verification")
        return True
    
    if not signature:
        return False
    
    app_secret = get_app_secret()
    # Meta sends signature as 'sha256=xxx'
    if signature.startswith('sha256='):
        signature = signature[7:]
    
    expected_signature = hmac.new(
        app_secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)


# ==================== WEBHOOK VERIFICATION ====================

@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Meta Webhook Verification Endpoint
    Called by Meta during webhook setup to verify ownership
    Returns hub.challenge as plain text for Meta verification
    """
    # Get query parameters
    hub_mode = request.query_params.get("hub.mode")
    hub_verify_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")
    
    expected_token = get_verify_token()
    logger.info(f"Webhook verification request: mode={hub_mode}, token={hub_verify_token}, challenge={hub_challenge}")
    
    # Meta verification check
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("Webhook verification successful!")
        # Return challenge as plain text - this is required by Meta
        return PlainTextResponse(content=hub_challenge, status_code=200)
    
    logger.warning(f"Webhook verification failed: mode={hub_mode}, expected_token={expected_token}, received_token={hub_verify_token}")
    return PlainTextResponse(content="Verification failed", status_code=403)


# ==================== MESSAGE WEBHOOK ====================

@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Meta Webhook Message Receiver
    Handles incoming messages from Facebook, Instagram, and WhatsApp
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify signature if app secret is configured
    signature = request.headers.get("X-Hub-Signature-256", "")
    app_secret = get_app_secret()
    if app_secret and not verify_webhook_signature(body, signature):
        logger.warning("Invalid webhook signature")
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    try:
        data = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    logger.info(f"Received webhook: {data.get('object', 'unknown')}")
    
    # Process based on object type
    object_type = data.get("object")
    
    if object_type == "whatsapp_business_account":
        await process_whatsapp_messages(data)
    elif object_type == "instagram":
        await process_instagram_messages(data)
    elif object_type == "page":
        await process_facebook_messages(data)
    else:
        logger.warning(f"Unknown webhook object type: {object_type}")
    
    # Always return 200 to acknowledge receipt
    return JSONResponse(content={"status": "received"}, status_code=200)


# ==================== MESSAGE PROCESSORS ====================

async def process_whatsapp_messages(data: dict):
    """Process incoming WhatsApp messages"""
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                
                # Get contact info
                contacts = value.get("contacts", [])
                contact_name = contacts[0].get("profile", {}).get("name", "Unknown") if contacts else "Unknown"
                contact_phone = contacts[0].get("wa_id", "") if contacts else ""
                
                # Process messages
                for message in value.get("messages", []):
                    msg_data = {
                        "id": f"wa_{message.get('id', '')}",
                        "platform": "whatsapp",
                        "sender_id": message.get("from", ""),
                        "sender_name": contact_name,
                        "sender_phone": contact_phone,
                        "message_type": message.get("type", "text"),
                        "timestamp": datetime.fromtimestamp(int(message.get("timestamp", 0)), tz=timezone.utc),
                        "received_at": datetime.now(timezone.utc),
                        "status": "unread",
                        "replied": False
                    }
                    
                    # Extract message content based on type
                    if message.get("type") == "text":
                        msg_data["content"] = message.get("text", {}).get("body", "")
                    elif message.get("type") == "image":
                        msg_data["content"] = "[Image]"
                        msg_data["media_id"] = message.get("image", {}).get("id", "")
                    elif message.get("type") == "audio":
                        msg_data["content"] = "[Audio]"
                        msg_data["media_id"] = message.get("audio", {}).get("id", "")
                    elif message.get("type") == "video":
                        msg_data["content"] = "[Video]"
                        msg_data["media_id"] = message.get("video", {}).get("id", "")
                    elif message.get("type") == "document":
                        msg_data["content"] = "[Document]"
                        msg_data["media_id"] = message.get("document", {}).get("id", "")
                    elif message.get("type") == "location":
                        loc = message.get("location", {})
                        msg_data["content"] = f"[Location: {loc.get('latitude')}, {loc.get('longitude')}]"
                    else:
                        msg_data["content"] = f"[{message.get('type', 'Unknown')} message]"
                    
                    await save_message(msg_data)
                    logger.info(f"WhatsApp message saved: {msg_data['id']}")
                    
    except Exception as e:
        logger.error(f"Error processing WhatsApp messages: {e}")


async def process_instagram_messages(data: dict):
    """Process incoming Instagram Direct messages"""
    try:
        for entry in data.get("entry", []):
            # Handle messaging events
            for messaging in entry.get("messaging", []):
                sender = messaging.get("sender", {})
                message = messaging.get("message", {})
                
                msg_data = {
                    "id": f"ig_{message.get('mid', '')}",
                    "platform": "instagram",
                    "sender_id": sender.get("id", ""),
                    "sender_name": "",  # Will be fetched via Graph API if needed
                    "message_type": "text",
                    "timestamp": datetime.fromtimestamp(int(messaging.get("timestamp", 0)) / 1000, tz=timezone.utc),
                    "received_at": datetime.now(timezone.utc),
                    "status": "unread",
                    "replied": False
                }
                
                # Extract content
                if message.get("text"):
                    msg_data["content"] = message.get("text", "")
                elif message.get("attachments"):
                    attachments = message.get("attachments", [])
                    if attachments:
                        att_type = attachments[0].get("type", "attachment")
                        msg_data["content"] = f"[{att_type.capitalize()}]"
                        msg_data["message_type"] = att_type
                        msg_data["attachment_url"] = attachments[0].get("payload", {}).get("url", "")
                else:
                    msg_data["content"] = "[Message]"
                
                await save_message(msg_data)
                logger.info(f"Instagram message saved: {msg_data['id']}")
                
    except Exception as e:
        logger.error(f"Error processing Instagram messages: {e}")


async def process_facebook_messages(data: dict):
    """Process incoming Facebook Messenger messages"""
    try:
        for entry in data.get("entry", []):
            page_id = entry.get("id", "")
            
            for messaging in entry.get("messaging", []):
                sender = messaging.get("sender", {})
                message = messaging.get("message", {})
                
                # Skip echo messages (messages sent by the page)
                if message.get("is_echo"):
                    continue
                
                msg_data = {
                    "id": f"fb_{message.get('mid', '')}",
                    "platform": "facebook",
                    "page_id": page_id,
                    "sender_id": sender.get("id", ""),
                    "sender_name": "",  # Will be fetched via Graph API if needed
                    "message_type": "text",
                    "timestamp": datetime.fromtimestamp(int(messaging.get("timestamp", 0)) / 1000, tz=timezone.utc),
                    "received_at": datetime.now(timezone.utc),
                    "status": "unread",
                    "replied": False
                }
                
                # Extract content
                if message.get("text"):
                    msg_data["content"] = message.get("text", "")
                elif message.get("attachments"):
                    attachments = message.get("attachments", [])
                    if attachments:
                        att_type = attachments[0].get("type", "attachment")
                        msg_data["content"] = f"[{att_type.capitalize()}]"
                        msg_data["message_type"] = att_type
                        msg_data["attachment_url"] = attachments[0].get("payload", {}).get("url", "")
                elif message.get("sticker_id"):
                    msg_data["content"] = "[Sticker]"
                    msg_data["message_type"] = "sticker"
                else:
                    msg_data["content"] = "[Message]"
                
                await save_message(msg_data)
                logger.info(f"Facebook message saved: {msg_data['id']}")
                
    except Exception as e:
        logger.error(f"Error processing Facebook messages: {e}")


async def save_message(msg_data: dict):
    """Save message to database"""
    if db is None:
        logger.error("Database not initialized")
        return
    
    try:
        # Check if message already exists (prevent duplicates)
        existing = await db.meta_messages.find_one({"id": msg_data["id"]})
        if existing:
            logger.info(f"Message {msg_data['id']} already exists, skipping")
            return
        
        await db.meta_messages.insert_one(msg_data)
        
        # Update unread count
        await update_unread_count()
        
    except Exception as e:
        logger.error(f"Error saving message: {e}")


async def update_unread_count():
    """Update the unread message count in stats"""
    if db is None:
        return
    
    try:
        count = await db.meta_messages.count_documents({"status": "unread"})
        await db.meta_stats.update_one(
            {"type": "message_stats"},
            {"$set": {"unread_count": count, "updated_at": datetime.now(timezone.utc)}},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Error updating unread count: {e}")


# ==================== CRM API ENDPOINTS ====================

@router.get("/messages")
async def get_messages(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get messages for CRM dashboard"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status
    
    messages = await db.meta_messages.find(
        query, 
        {"_id": 0}
    ).sort("received_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.meta_messages.count_documents(query)
    
    return {
        "messages": messages,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/messages/stats")
async def get_message_stats():
    """Get message statistics for CRM dashboard"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get counts by platform
    pipeline = [
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
    ]
    platform_stats = await db.meta_messages.aggregate(pipeline).to_list(10)
    
    # Get unread count
    unread = await db.meta_messages.count_documents({"status": "unread"})
    total = await db.meta_messages.count_documents({})
    
    # Get today's count
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = await db.meta_messages.count_documents({"received_at": {"$gte": today_start}})
    
    return {
        "total": total,
        "unread": unread,
        "today": today_count,
        "by_platform": {stat["_id"]: stat["count"] for stat in platform_stats}
    }


@router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    """Mark a message as read"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    result = await db.meta_messages.update_one(
        {"id": message_id},
        {"$set": {"status": "read", "read_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await update_unread_count()
    return {"status": "success", "message": "Message marked as read"}


@router.put("/messages/{message_id}/reply")
async def mark_message_replied(message_id: str, reply_note: Optional[str] = None):
    """Mark a message as replied"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    update_data = {
        "replied": True,
        "replied_at": datetime.now(timezone.utc),
        "status": "read"
    }
    if reply_note:
        update_data["reply_note"] = reply_note
    
    result = await db.meta_messages.update_one(
        {"id": message_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await update_unread_count()
    return {"status": "success", "message": "Message marked as replied"}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    """Delete a message"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    result = await db.meta_messages.delete_one({"id": message_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await update_unread_count()
    return {"status": "success", "message": "Message deleted"}


# ==================== WEBHOOK STATUS ====================

@router.get("/webhook/status")
async def webhook_status():
    """Check webhook configuration status"""
    verify_token = get_verify_token()
    app_secret = get_app_secret()
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    access_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    return {
        "status": "ready",
        "verify_token_configured": bool(verify_token),
        "app_secret_configured": bool(app_secret),
        "whatsapp_configured": bool(phone_id and access_token),
        "database_connected": db is not None,
        "endpoints": {
            "verification": "GET /api/meta/webhook",
            "messages": "POST /api/meta/webhook",
            "send_message": "POST /api/meta/whatsapp/send"
        }
    }


# ==================== WHATSAPP SEND MESSAGE API ====================

import httpx

def get_whatsapp_config():
    """Get WhatsApp API configuration"""
    return {
        "phone_number_id": os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""),
        "access_token": os.environ.get("WHATSAPP_ACCESS_TOKEN", ""),
        "api_version": "v21.0"
    }


class SendMessageRequest(BaseModel):
    """Request model for sending WhatsApp message"""
    recipient_phone: str
    message_text: str
    message_type: str = "text"  # text, template


class SendMessageResponse(BaseModel):
    """Response model for send message"""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


@router.post("/whatsapp/send", response_model=SendMessageResponse)
async def send_whatsapp_message(request: SendMessageRequest):
    """
    Send a WhatsApp message to a customer
    
    - recipient_phone: Phone number with country code (e.g., 919876543210)
    - message_text: Text message content
    - message_type: 'text' for regular messages
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        raise HTTPException(
            status_code=500, 
            detail="WhatsApp API not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN"
        )
    
    # Clean phone number - remove + and spaces
    recipient = request.recipient_phone.replace("+", "").replace(" ", "").replace("-", "")
    
    # Add India country code if not present
    if len(recipient) == 10:
        recipient = "91" + recipient
    
    url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}/messages"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {
            "preview_url": True,
            "body": request.message_text
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            result = response.json()
            logger.info(f"WhatsApp API response: {result}")
            
            if response.status_code == 200 and "messages" in result:
                message_id = result["messages"][0]["id"]
                
                # Save outgoing message to database
                if db is not None:
                    outgoing_msg = {
                        "id": f"wa_out_{message_id}",
                        "platform": "whatsapp",
                        "direction": "outgoing",
                        "sender_id": config["phone_number_id"],
                        "sender_name": "ASR Enterprises",
                        "recipient_phone": recipient,
                        "message_type": "text",
                        "content": request.message_text,
                        "wa_message_id": message_id,
                        "timestamp": datetime.now(timezone.utc),
                        "status": "sent"
                    }
                    await db.meta_messages.insert_one(outgoing_msg)
                
                return SendMessageResponse(
                    success=True,
                    message_id=message_id
                )
            else:
                error_msg = result.get("error", {}).get("message", "Unknown error")
                logger.error(f"WhatsApp API error: {error_msg}")
                return SendMessageResponse(
                    success=False,
                    error=error_msg
                )
                
    except httpx.HTTPError as e:
        logger.error(f"HTTP error sending WhatsApp message: {str(e)}")
        return SendMessageResponse(
            success=False,
            error=str(e)
        )
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {str(e)}")
        return SendMessageResponse(
            success=False,
            error=str(e)
        )


@router.get("/whatsapp/conversations")
async def get_whatsapp_conversations():
    """
    Get all WhatsApp conversations grouped by phone number
    Returns conversations with last message and unread count
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Aggregate messages by sender phone
    pipeline = [
        {"$match": {"platform": "whatsapp"}},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": {"$cond": [
                {"$eq": ["$direction", "outgoing"]},
                "$recipient_phone",
                "$sender_phone"
            ]},
            "last_message": {"$first": "$content"},
            "last_timestamp": {"$first": "$timestamp"},
            "sender_name": {"$first": "$sender_name"},
            "unread_count": {
                "$sum": {"$cond": [
                    {"$and": [
                        {"$eq": ["$status", "unread"]},
                        {"$ne": ["$direction", "outgoing"]}
                    ]},
                    1, 0
                ]}
            },
            "total_messages": {"$sum": 1}
        }},
        {"$sort": {"last_timestamp": -1}},
        {"$limit": 50}
    ]
    
    conversations = await db.meta_messages.aggregate(pipeline).to_list(50)
    
    # Format response
    formatted = []
    for conv in conversations:
        if conv["_id"]:
            formatted.append({
                "phone": conv["_id"],
                "name": conv.get("sender_name", "Unknown"),
                "last_message": conv.get("last_message", ""),
                "last_timestamp": conv.get("last_timestamp").isoformat() if conv.get("last_timestamp") else None,
                "unread_count": conv.get("unread_count", 0),
                "total_messages": conv.get("total_messages", 0)
            })
    
    return {"conversations": formatted}


@router.get("/whatsapp/chat/{phone}")
async def get_whatsapp_chat(phone: str, limit: int = 50):
    """
    Get chat history with a specific phone number
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Clean phone number
    clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
    
    # Find messages to/from this phone
    messages = await db.meta_messages.find(
        {
            "platform": "whatsapp",
            "$or": [
                {"sender_phone": {"$regex": clean_phone}},
                {"recipient_phone": {"$regex": clean_phone}},
                {"sender_id": {"$regex": clean_phone}}
            ]
        },
        {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.meta_messages.update_many(
        {
            "platform": "whatsapp",
            "status": "unread",
            "$or": [
                {"sender_phone": {"$regex": clean_phone}},
                {"sender_id": {"$regex": clean_phone}}
            ]
        },
        {"$set": {"status": "read", "read_at": datetime.now(timezone.utc)}}
    )
    
    await update_unread_count()
    
    return {"messages": messages, "phone": phone}


@router.post("/whatsapp/chat/{phone}/send")
async def send_chat_message(phone: str, data: Dict[str, Any]):
    """
    Send a message in a chat conversation
    """
    message_text = data.get("message", "")
    if not message_text:
        raise HTTPException(status_code=400, detail="Message text is required")
    
    # Use the send_whatsapp_message function
    request = SendMessageRequest(
        recipient_phone=phone,
        message_text=message_text
    )
    
    return await send_whatsapp_message(request)


# ==================== WHATSAPP TEMPLATE MESSAGES ====================

class TemplateComponent(BaseModel):
    """Component for template message"""
    type: str  # header, body, button
    parameters: List[Dict[str, Any]] = []


class SendTemplateRequest(BaseModel):
    """Request model for sending template message"""
    recipient_phone: str
    template_name: str
    language_code: str = "en"
    components: List[TemplateComponent] = []


@router.post("/whatsapp/send-template")
async def send_template_message(request: SendTemplateRequest):
    """
    Send a WhatsApp template message (for messages outside 24-hour window)
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        raise HTTPException(status_code=500, detail="WhatsApp API not configured")
    
    recipient = request.recipient_phone.replace("+", "").replace(" ", "").replace("-", "")
    if len(recipient) == 10:
        recipient = "91" + recipient
    
    url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}/messages"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json"
    }
    
    # Build template payload
    template_payload = {
        "name": request.template_name,
        "language": {"code": request.language_code}
    }
    
    if request.components:
        template_payload["components"] = [
            {"type": c.type, "parameters": c.parameters} for c in request.components
        ]
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "template",
        "template": template_payload
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            result = response.json()
            logger.info(f"Template API response: {result}")
            
            if response.status_code == 200 and "messages" in result:
                message_id = result["messages"][0]["id"]
                
                if db is not None:
                    outgoing_msg = {
                        "id": f"wa_tpl_{message_id}",
                        "platform": "whatsapp",
                        "direction": "outgoing",
                        "sender_id": config["phone_number_id"],
                        "sender_name": "ASR Enterprises",
                        "recipient_phone": recipient,
                        "message_type": "template",
                        "content": f"[Template: {request.template_name}]",
                        "template_name": request.template_name,
                        "wa_message_id": message_id,
                        "timestamp": datetime.now(timezone.utc),
                        "status": "sent"
                    }
                    await db.meta_messages.insert_one(outgoing_msg)
                
                return {"success": True, "message_id": message_id}
            else:
                error_msg = result.get("error", {}).get("message", "Unknown error")
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        logger.error(f"Error sending template: {str(e)}")
        return {"success": False, "error": str(e)}


@router.get("/whatsapp/templates")
async def get_whatsapp_templates():
    """
    Get list of available WhatsApp message templates from Meta
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        raise HTTPException(status_code=500, detail="WhatsApp API not configured")
    
    # Get WABA ID from phone number
    url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            # First get the WABA ID
            phone_response = await client.get(
                f"{url}?fields=verified_name,display_phone_number",
                headers=headers,
                timeout=30.0
            )
            phone_data = phone_response.json()
            
            # Get templates from the business account
            # Note: Templates are associated with the WhatsApp Business Account, not the phone number
            # We need to get the WABA ID first
            waba_url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}/whatsapp_business_profile"
            
            # For now, return common pre-defined templates that can be created
            common_templates = [
                {
                    "name": "hello_world",
                    "language": "en",
                    "category": "UTILITY",
                    "status": "APPROVED",
                    "description": "Default hello world template",
                    "components": [
                        {"type": "BODY", "text": "Hello World!"}
                    ]
                },
                {
                    "name": "order_confirmation",
                    "language": "en",
                    "category": "UTILITY",
                    "status": "PENDING",
                    "description": "Order confirmation template",
                    "components": [
                        {"type": "BODY", "text": "Your order {{1}} has been confirmed. Thank you for choosing ASR Enterprises!"}
                    ]
                },
                {
                    "name": "appointment_reminder",
                    "language": "en",
                    "category": "UTILITY",
                    "status": "PENDING",
                    "description": "Appointment reminder template",
                    "components": [
                        {"type": "BODY", "text": "Reminder: Your solar consultation is scheduled for {{1}} at {{2}}. Reply YES to confirm."}
                    ]
                },
                {
                    "name": "service_update",
                    "language": "en",
                    "category": "UTILITY",
                    "status": "PENDING",
                    "description": "Service status update",
                    "components": [
                        {"type": "BODY", "text": "Service Update: {{1}}. For queries, call us at 8877896889."}
                    ]
                }
            ]
            
            return {
                "success": True,
                "phone_info": phone_data,
                "templates": common_templates,
                "note": "Create these templates in Meta Business Suite for approval"
            }
            
    except Exception as e:
        logger.error(f"Error fetching templates: {str(e)}")
        return {"success": False, "error": str(e), "templates": []}


# ==================== WHATSAPP MEDIA MESSAGES ====================

class SendMediaRequest(BaseModel):
    """Request model for sending media message"""
    recipient_phone: str
    media_type: str  # image, document, audio, video
    media_url: str  # Public URL of the media
    caption: Optional[str] = None
    filename: Optional[str] = None


@router.post("/whatsapp/send-media")
async def send_media_message(request: SendMediaRequest):
    """
    Send a WhatsApp media message (image, document, audio, video)
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        raise HTTPException(status_code=500, detail="WhatsApp API not configured")
    
    recipient = request.recipient_phone.replace("+", "").replace(" ", "").replace("-", "")
    if len(recipient) == 10:
        recipient = "91" + recipient
    
    url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}/messages"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json"
    }
    
    # Build media payload based on type
    media_object = {"link": request.media_url}
    
    if request.media_type == "image" and request.caption:
        media_object["caption"] = request.caption
    elif request.media_type == "document":
        if request.filename:
            media_object["filename"] = request.filename
        if request.caption:
            media_object["caption"] = request.caption
    elif request.media_type == "video" and request.caption:
        media_object["caption"] = request.caption
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": request.media_type,
        request.media_type: media_object
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            result = response.json()
            logger.info(f"Media API response: {result}")
            
            if response.status_code == 200 and "messages" in result:
                message_id = result["messages"][0]["id"]
                
                if db is not None:
                    outgoing_msg = {
                        "id": f"wa_media_{message_id}",
                        "platform": "whatsapp",
                        "direction": "outgoing",
                        "sender_id": config["phone_number_id"],
                        "sender_name": "ASR Enterprises",
                        "recipient_phone": recipient,
                        "message_type": request.media_type,
                        "content": request.caption or f"[{request.media_type.upper()}]",
                        "media_url": request.media_url,
                        "filename": request.filename,
                        "wa_message_id": message_id,
                        "timestamp": datetime.now(timezone.utc),
                        "status": "sent"
                    }
                    await db.meta_messages.insert_one(outgoing_msg)
                
                return {"success": True, "message_id": message_id}
            else:
                error_msg = result.get("error", {}).get("message", "Unknown error")
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        logger.error(f"Error sending media: {str(e)}")
        return {"success": False, "error": str(e)}


@router.post("/whatsapp/upload-media")
async def upload_media_to_whatsapp(request: Request):
    """
    Upload media to WhatsApp servers and get a media ID
    Accepts multipart form data with 'file' field
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        raise HTTPException(status_code=500, detail="WhatsApp API not configured")
    
    form = await request.form()
    file = form.get("file")
    
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Read file content
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    
    url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}/media"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            files = {
                "file": (file.filename, content, content_type),
                "messaging_product": (None, "whatsapp"),
                "type": (None, content_type)
            }
            
            response = await client.post(url, headers=headers, files=files, timeout=60.0)
            result = response.json()
            
            if response.status_code == 200 and "id" in result:
                return {
                    "success": True,
                    "media_id": result["id"],
                    "filename": file.filename
                }
            else:
                error_msg = result.get("error", {}).get("message", "Upload failed")
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        logger.error(f"Error uploading media: {str(e)}")
        return {"success": False, "error": str(e)}


@router.post("/whatsapp/send-media-by-id")
async def send_media_by_id(data: Dict[str, Any]):
    """
    Send media using WhatsApp media ID (for uploaded media)
    """
    config = get_whatsapp_config()
    
    if not config["phone_number_id"] or not config["access_token"]:
        raise HTTPException(status_code=500, detail="WhatsApp API not configured")
    
    recipient = data.get("recipient_phone", "").replace("+", "").replace(" ", "").replace("-", "")
    if len(recipient) == 10:
        recipient = "91" + recipient
    
    media_type = data.get("media_type", "image")
    media_id = data.get("media_id")
    caption = data.get("caption", "")
    filename = data.get("filename", "")
    
    if not media_id:
        raise HTTPException(status_code=400, detail="media_id is required")
    
    url = f"https://graph.facebook.com/{config['api_version']}/{config['phone_number_id']}/messages"
    
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "Content-Type": "application/json"
    }
    
    media_object = {"id": media_id}
    if caption:
        media_object["caption"] = caption
    if media_type == "document" and filename:
        media_object["filename"] = filename
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": media_type,
        media_type: media_object
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            result = response.json()
            
            if response.status_code == 200 and "messages" in result:
                message_id = result["messages"][0]["id"]
                
                if db is not None:
                    outgoing_msg = {
                        "id": f"wa_media_{message_id}",
                        "platform": "whatsapp",
                        "direction": "outgoing",
                        "sender_id": config["phone_number_id"],
                        "sender_name": "ASR Enterprises",
                        "recipient_phone": recipient,
                        "message_type": media_type,
                        "content": caption or f"[{media_type.upper()}]",
                        "media_id": media_id,
                        "filename": filename,
                        "wa_message_id": message_id,
                        "timestamp": datetime.now(timezone.utc),
                        "status": "sent"
                    }
                    await db.meta_messages.insert_one(outgoing_msg)
                
                return {"success": True, "message_id": message_id}
            else:
                error_msg = result.get("error", {}).get("message", "Unknown error")
                return {"success": False, "error": error_msg}
                
    except Exception as e:
        logger.error(f"Error sending media: {str(e)}")
        return {"success": False, "error": str(e)}
