"""
Email OTP service for client dashboard login.

Generates a 6-digit code, stores it in Redis with 10-minute TTL.
Sends the code via Resend (same email service used for match notifications).
"""
from __future__ import annotations

import asyncio
import functools
import os
import random

import structlog

log = structlog.get_logger()

_OTP_TTL = 600  # 10 minutes


def _redis():
    import redis as _r
    return _r.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)


async def send_otp(email: str) -> bool:
    """
    Generate a 6-digit OTP, store in Redis, and email it.
    Returns True on success, False if email send fails.
    """
    code = str(random.randint(100000, 999999))
    r = _redis()
    await asyncio.to_thread(
        functools.partial(r.setex, f"otp:{email.lower()}", _OTP_TTL, code)
    )
    log.info("otp_generated", email=email)

    try:
        import resend
        resend.api_key = os.getenv("RESEND_API_KEY", "")
        if not resend.api_key:
            log.warning("RESEND_API_KEY not set -- OTP not sent")
            return False

        await asyncio.to_thread(
            functools.partial(
                resend.Emails.send,
                {
                    "from": os.getenv("EMAIL_FROM", "matches@attorney-matchmaker.com"),
                    "to": email,
                    "subject": "Your Attorney Matchmaker login code",
                    "html": (
                        f"<p>Your login code is: <strong style='font-size:24px'>{code}</strong></p>"
                        f"<p>This code expires in 10 minutes.</p>"
                        f"<p style='color:#999;font-size:12px'>Attorney Matchmaker &mdash; not a law firm</p>"
                    ),
                },
            )
        )
        log.info("otp_sent", email=email)
        return True
    except Exception as exc:
        log.warning("otp_email_failed", email=email, error=str(exc))
        return False


async def verify_otp(email: str, code: str) -> bool:
    """
    Check that the submitted code matches the stored OTP and delete it (one-time use).
    Returns True if valid.
    """
    r = _redis()
    stored = await asyncio.to_thread(functools.partial(r.get, f"otp:{email.lower()}"))
    if not stored:
        return False
    if stored.strip() != code.strip():
        return False
    await asyncio.to_thread(functools.partial(r.delete, f"otp:{email.lower()}"))
    return True
