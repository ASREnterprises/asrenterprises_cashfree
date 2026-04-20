"""Central configuration loader for ASR Enterprises backend.

This is the single source of truth for environment-driven settings.
All secrets and environment-dependent values must be read from here so
that:
    * Missing critical secrets are detected at startup (fail-fast).
    * Sensitive values are never accidentally logged.
    * Tests / dev / prod behave consistently.

NOTE: Existing modules that still read ``os.environ`` directly continue
to work; new code MUST import from this module instead.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("asr.config")


def _get(name: str, default: str = "") -> str:
    val = os.environ.get(name, default)
    return val.strip() if isinstance(val, str) else val


# ---------- Environment / runtime ----------
ENVIRONMENT: str = _get("ENVIRONMENT", "development").lower()
IS_PRODUCTION: bool = ENVIRONMENT in {"production", "prod"}
DEBUG: bool = (not IS_PRODUCTION) and _get("DEBUG", "false").lower() in {"1", "true", "yes"}

# ---------- CORS ----------
_raw_cors = _get("CORS_ORIGINS", "*")
CORS_ORIGINS: List[str] = [o.strip() for o in _raw_cors.split(",") if o.strip()]

# ---------- HTTPS / Canonical host ----------
# When set, requests to other hosts get 308-redirected to this one.
# Example: CANONICAL_HOST=www.asrenterprises.in
CANONICAL_HOST: str = _get("CANONICAL_HOST", "")
# When true (default in production), HTTP requests are 301-redirected to HTTPS.
FORCE_HTTPS: bool = _get(
    "FORCE_HTTPS", "true" if ENVIRONMENT in {"production", "prod"} else "false"
).lower() in {"1", "true", "yes"}
# Hostnames that may be used as `origin_url` when creating Cashfree orders.
# Prevents open-redirect via attacker-supplied return URL.
_raw_redirect = _get(
    "ALLOWED_REDIRECT_HOSTS",
    "asrenterprises.in,www.asrenterprises.in",
)
ALLOWED_REDIRECT_HOSTS: List[str] = [
    h.strip().lower() for h in _raw_redirect.split(",") if h.strip()
]

# ---------- Database ----------
MONGO_URL: str = _get("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME: str = _get("DB_NAME", "asr_dev")
USE_IN_MEMORY_MONGO: bool = _get("USE_IN_MEMORY_MONGO", "false").lower() in {"1", "true", "yes"}

# ---------- Cashfree ----------
CASHFREE_API_KEY: str = _get("CASHFREE_API_KEY")
CASHFREE_SECRET_KEY: str = _get("CASHFREE_SECRET_KEY")
CASHFREE_IS_SANDBOX: bool = _get("CASHFREE_IS_SANDBOX", "false").lower() in {"1", "true", "yes"}
CASHFREE_WEBHOOK_SECRET: str = _get("CASHFREE_WEBHOOK_SECRET")

# ---------- MSG91 (OTP) ----------
MSG91_AUTH_KEY: str = _get("MSG91_AUTH_KEY")
MSG91_TOKEN_AUTH: str = _get("MSG91_TOKEN_AUTH")
MSG91_WIDGET_ID: str = _get("MSG91_WIDGET_ID")
MSG91_SENDER_ID: str = _get("MSG91_SENDER_ID", "ASRSOL")

# ---------- Webhook verify tokens (Meta / WhatsApp) ----------
META_VERIFY_TOKEN: str = _get("META_VERIFY_TOKEN", "")
WHATSAPP_VERIFY_TOKEN: str = _get("WHATSAPP_VERIFY_TOKEN", "")


# Critical secrets that must be present in production.
CRITICAL_SECRETS: Dict[str, str] = {
    "CASHFREE_API_KEY": CASHFREE_API_KEY,
    "CASHFREE_SECRET_KEY": CASHFREE_SECRET_KEY,
    "MSG91_AUTH_KEY": MSG91_AUTH_KEY,
    "MSG91_TOKEN_AUTH": MSG91_TOKEN_AUTH,
    "MSG91_WIDGET_ID": MSG91_WIDGET_ID,
}


def missing_critical_secrets() -> List[str]:
    """Return the names of any required secrets that are not set."""
    return [name for name, value in CRITICAL_SECRETS.items() if not value]


def validate_or_exit() -> None:
    """Fail-fast startup validation.

    In production, exit immediately if critical secrets are missing.
    In development, log a clear warning so the developer notices.
    """
    missing = missing_critical_secrets()
    if not missing:
        logger.info("Config OK: all critical secrets are present.")
        return

    msg = (
        "Missing critical environment variables: "
        + ", ".join(missing)
        + ". Set them as Replit Secrets / environment variables."
    )
    if IS_PRODUCTION:
        logger.critical("FATAL: %s", msg)
        sys.stderr.write(f"FATAL: {msg}\n")
        sys.exit(1)
    logger.warning("WARNING: %s", msg)


def mask_phone(phone: str) -> str:
    """Partial-mask a phone number for safe logging (keep last 4)."""
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) <= 4:
        return "*" * len(digits)
    return "*" * (len(digits) - 4) + digits[-4:]


def mask_secret(value: str, visible: int = 4) -> str:
    """Partial-mask any secret/token for safe logging."""
    if not value:
        return ""
    s = str(value)
    if len(s) <= visible:
        return "*" * len(s)
    return s[:visible] + "***"
