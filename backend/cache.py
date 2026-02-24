"""
ASR Enterprises - Redis Caching Module
High-performance caching for dashboard and API responses
"""

import os
import json
import logging
import asyncio
from typing import Optional, Any, Union
from datetime import timedelta
import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Redis Configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
REDIS_DB = int(os.environ.get('REDIS_DB', 0))

# Cache TTL Configuration (in seconds)
CACHE_TTL = {
    'dashboard_stats': 30,
    'crm_stats': 30,
    'shop_stats': 60,
    'products': 300,
    'categories': 600,
    'settings': 300,
    'analytics': 60,
    'leads_list': 30,
    'orders_list': 30,
    'default': 60
}

redis_client: Optional[redis.Redis] = None
cache_enabled = False

async def init_redis():
    global redis_client, cache_enabled
    try:
        redis_client = redis.from_url(REDIS_URL, db=REDIS_DB, encoding='utf-8', decode_responses=True, socket_timeout=5, socket_connect_timeout=5)
        await redis_client.ping()
        cache_enabled = True
        logger.info("Redis cache initialized successfully")
        return True
    except Exception as e:
        logger.warning(f"Redis not available, using in-memory cache: {e}")
        cache_enabled = False
        return False

async def close_redis():
    global redis_client, cache_enabled
    if redis_client:
        await redis_client.close()
        redis_client = None
        cache_enabled = False

memory_cache = {}
memory_cache_timestamps = {}

async def cache_get(key: str) -> Optional[Any]:
    global cache_enabled
    try:
        if cache_enabled and redis_client:
            value = await redis_client.get(f"asr:{key}")
            if value:
                return json.loads(value)
        else:
            import time
            if key in memory_cache:
                timestamp = memory_cache_timestamps.get(key, 0)
                ttl = CACHE_TTL.get(key.split(':')[0], CACHE_TTL['default'])
                if time.time() - timestamp < ttl:
                    return memory_cache[key]
                else:
                    del memory_cache[key]
                    del memory_cache_timestamps[key]
    except Exception as e:
        logger.error(f"Cache get error: {e}")
    return None

async def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    global cache_enabled
    if ttl is None:
        key_type = key.split(':')[0] if ':' in key else key
        ttl = CACHE_TTL.get(key_type, CACHE_TTL['default'])
    try:
        if cache_enabled and redis_client:
            await redis_client.setex(f"asr:{key}", ttl, json.dumps(value, default=str))
            return True
        else:
            import time
            memory_cache[key] = value
            memory_cache_timestamps[key] = time.time()
            if len(memory_cache) > 500:
                oldest = sorted(memory_cache_timestamps.keys(), key=lambda k: memory_cache_timestamps[k])[:100]
                for k in oldest:
                    memory_cache.pop(k, None)
                    memory_cache_timestamps.pop(k, None)
            return True
    except Exception as e:
        logger.error(f"Cache set error: {e}")
        return False

async def cache_delete(key: str) -> bool:
    try:
        if cache_enabled and redis_client:
            await redis_client.delete(f"asr:{key}")
        else:
            memory_cache.pop(key, None)
            memory_cache_timestamps.pop(key, None)
        return True
    except Exception as e:
        logger.error(f"Cache delete error: {e}")
        return False

async def cache_clear_pattern(pattern: str) -> int:
    count = 0
    try:
        if cache_enabled and redis_client:
            cursor = 0
            while True:
                cursor, keys = await redis_client.scan(cursor, match=f"asr:{pattern}*", count=100)
                if keys:
                    await redis_client.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
        else:
            to_delete = [k for k in memory_cache.keys() if k.startswith(pattern)]
            for k in to_delete:
                memory_cache.pop(k, None)
                memory_cache_timestamps.pop(k, None)
                count += 1
        return count
    except Exception as e:
        logger.error(f"Cache clear pattern error: {e}")
        return 0

async def cache_clear_all() -> bool:
    try:
        if cache_enabled and redis_client:
            cursor = 0
            while True:
                cursor, keys = await redis_client.scan(cursor, match="asr:*", count=100)
                if keys:
                    await redis_client.delete(*keys)
                if cursor == 0:
                    break
        else:
            memory_cache.clear()
            memory_cache_timestamps.clear()
        logger.info("Cache cleared completely")
        return True
    except Exception as e:
        logger.error(f"Cache clear all error: {e}")
        return False

async def get_cache_stats() -> dict:
    stats = {"enabled": cache_enabled, "backend": "redis" if cache_enabled else "memory", "keys_count": 0, "memory_usage": "N/A"}
    try:
        if cache_enabled and redis_client:
            info = await redis_client.info("memory")
            cursor, count = 0, 0
            while True:
                cursor, keys = await redis_client.scan(cursor, match="asr:*", count=100)
                count += len(keys)
                if cursor == 0:
                    break
            stats["keys_count"] = count
            stats["memory_usage"] = info.get("used_memory_human", "N/A")
        else:
            stats["keys_count"] = len(memory_cache)
    except Exception as e:
        logger.error(f"Get cache stats error: {e}")
    return stats

def cached(key_prefix: str, ttl: Optional[int] = None):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            cache_key = f"{key_prefix}"
            if args:
                cache_key += f":{':'.join(str(a) for a in args)}"
            if kwargs:
                cache_key += f":{':'.join(f'{k}={v}' for k, v in sorted(kwargs.items()))}"
            cached_value = await cache_get(cache_key)
            if cached_value is not None:
                return cached_value
            result = await func(*args, **kwargs)
            await cache_set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator
