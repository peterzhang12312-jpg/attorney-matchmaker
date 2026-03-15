"""
Client dashboard API.

POST /api/dashboard/request-otp  -- send OTP to client email
POST /api/dashboard/verify-otp   -- verify OTP, return JWT session token
GET  /api/dashboard              -- return case history for authenticated client
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case, MatchResult
from db.session import get_db
from middleware.rate_limit import limiter
from services.otp import send_otp, verify_otp

log = structlog.get_logger()
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

_JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret")
_TOKEN_TTL_HOURS = 24


def _make_client_token(email: str) -> str:
    payload = {
        "sub": email.lower(),
        "type": "client",
        "exp": datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm="HS256")


def _decode_client_token(token: str) -> str:
    """Returns email from token or raises HTTPException."""
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "client":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class OTPRequest(BaseModel):
    email: str


class OTPVerify(BaseModel):
    email: str
    code: str


@router.post("/request-otp")
@limiter.limit("5/minute")
async def request_otp_endpoint(request: Request, body: OTPRequest) -> dict:
    """Send a 6-digit OTP to the client's email."""
    if not body.email or "@" not in body.email:
        raise HTTPException(status_code=400, detail="Valid email required")
    await send_otp(body.email.lower())
    return {"sent": True, "message": "Check your email for a 6-digit login code."}


@router.post("/verify-otp")
@limiter.limit("5/minute")
async def verify_otp_endpoint(request: Request, body: OTPVerify) -> dict:
    """Verify OTP and return a 24-hour session token."""
    valid = await verify_otp(body.email.lower(), body.code)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid or expired code")
    token = _make_client_token(body.email)
    return {"token": token, "email": body.email.lower()}


@router.get("")
@limiter.limit("30/minute")
async def get_dashboard(
    request: Request,
    authorization: str = Header(..., description="Bearer <token>"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all cases and match results for the authenticated client."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    email = _decode_client_token(authorization[7:])

    result = await db.execute(
        select(Case).where(Case.client_email == email).order_by(Case.created_at.desc())
    )
    cases = result.scalars().all()

    case_data = []
    for case in cases:
        mr_result = await db.execute(
            select(MatchResult)
            .where(MatchResult.case_id == case.case_id)
            .order_by(MatchResult.created_at.desc())
            .limit(1)
        )
        match_row = mr_result.scalar_one_or_none()

        top_attorney = None
        match_count = 0
        if match_row and match_row.matches:
            match_count = len(match_row.matches)
            if match_count > 0:
                top = match_row.matches[0]
                top_attorney = top.get("attorney", {}).get("name")

        case_data.append({
            "case_id": case.case_id,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "urgency": case.urgency,
            "practice_area": (case.advanced_fields or {}).get("legal_area", "Unknown"),
            "match_count": match_count,
            "top_attorney": top_attorney,
            "has_results": match_row is not None,
        })

    return {"email": email, "cases": case_data, "total": len(case_data)}
