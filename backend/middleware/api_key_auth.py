"""
FastAPI dependency for white-label API key authentication.
Validates X-API-Key header, checks daily rate limit, increments usage.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import date

import structlog
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ApiKey, ApiUsage
from db.session import get_db

log = structlog.get_logger()


async def get_api_key_client(
    x_api_key: str = Header(..., description="White-label API key"),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """Validate X-API-Key, enforce daily rate limit, increment usage counter."""
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()

    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    # Check and increment daily usage
    today = date.today().isoformat()
    usage_result = await db.execute(
        select(ApiUsage).where(
            ApiUsage.api_key_id == api_key.id,
            ApiUsage.date == today,
        )
    )
    usage = usage_result.scalar_one_or_none()

    if usage is None:
        usage = ApiUsage(
            id=str(uuid.uuid4()),
            api_key_id=api_key.id,
            date=today,
            request_count=0,
        )
        db.add(usage)
        await db.flush()

    # Rate limit check (0 = unlimited)
    if api_key.daily_limit > 0 and usage.request_count >= api_key.daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {api_key.daily_limit} requests reached.",
        )

    # Increment
    await db.execute(
        update(ApiUsage)
        .where(ApiUsage.api_key_id == api_key.id, ApiUsage.date == today)
        .values(request_count=usage.request_count + 1)
    )
    await db.commit()

    log.info("api_v1_request", key_id=api_key.id, tier=api_key.tier)
    return api_key
