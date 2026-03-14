"""
Attorney self-onboarding routes: registration, login, profile, and lead management.

All routes are prefixed with /attorney (the /api prefix is added in main.py).
"""

from __future__ import annotations

from datetime import datetime, timezone

import jwt
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth.attorney_auth import create_token, decode_token, hash_password, verify_password
from db.models import AttorneyRegistered, Lead
from db.session import get_db
from middleware.rate_limit import limiter
from models.schemas import (
    AttorneyLoginRequest,
    AttorneyLoginResponse,
    AttorneyProfileResponse,
    AttorneyProfileUpdate,
    AttorneyRegisterRequest,
    LeadRespondRequest,
    LeadSummary,
)

log = structlog.get_logger()

router = APIRouter(prefix="/api/attorney", tags=["attorney"])


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

async def get_current_attorney(
    authorization: str = Header(..., description="Bearer <token>"),
    db: AsyncSession = Depends(get_db),
) -> AttorneyRegistered:
    """Decode the JWT from the Authorization header and return the attorney row."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization[7:]  # strip "Bearer "
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    attorney_id = payload.get("sub")
    if not attorney_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(
        select(AttorneyRegistered).where(AttorneyRegistered.id == attorney_id)
    )
    attorney = result.scalar_one_or_none()
    if not attorney:
        raise HTTPException(status_code=401, detail="Attorney not found")

    return attorney


# ---------------------------------------------------------------------------
# Helper: serialize AttorneyRegistered -> AttorneyProfileResponse
# ---------------------------------------------------------------------------

def _to_profile_response(atty: AttorneyRegistered) -> AttorneyProfileResponse:
    return AttorneyProfileResponse(
        id=atty.id,
        name=atty.name,
        email=atty.email,
        bar_number=atty.bar_number,
        firm=atty.firm,
        jurisdictions=atty.jurisdictions,
        practice_areas=atty.practice_areas,
        hourly_rate=atty.hourly_rate,
        availability=atty.availability or "available",
        accepting_clients=atty.accepting_clients == "true",
        is_founding=atty.is_founding == "true",
        created_at=atty.created_at.isoformat() if atty.created_at else None,
    )


# ---------------------------------------------------------------------------
# POST /api/attorney/register
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=AttorneyLoginResponse,
    status_code=201,
    summary="Register a new attorney account",
)
@limiter.limit("5/minute")
async def register_attorney(
    request: Request,  # required by slowapi
    body: AttorneyRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AttorneyLoginResponse:
    # Check for duplicate email
    existing = await db.execute(
        select(AttorneyRegistered).where(AttorneyRegistered.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Determine founding status: first 20 self-registered attorneys
    count_result = await db.execute(
        select(func.count()).select_from(AttorneyRegistered).where(
            AttorneyRegistered.source == "self_registered"
        )
    )
    current_count = count_result.scalar() or 0
    is_founding = "true" if current_count < 20 else "false"

    attorney = AttorneyRegistered(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        bar_number=body.bar_number,
        firm=body.firm,
        jurisdictions=body.jurisdictions,
        practice_areas=body.practice_areas,
        hourly_rate=body.hourly_rate,
        availability=body.availability or "available",
        accepting_clients="true" if body.accepting_clients else "false",
        source="self_registered",
        is_founding=is_founding,
    )

    db.add(attorney)
    await db.commit()
    await db.refresh(attorney)

    token = create_token(attorney.id, attorney.email)
    log.info(
        "attorney_registered",
        attorney_id=attorney.id,
        is_founding=is_founding,
        founding_count=current_count + 1,
    )

    return AttorneyLoginResponse(
        token=token,
        attorney_id=attorney.id,
        name=attorney.name,
        is_founding=is_founding == "true",
    )


# ---------------------------------------------------------------------------
# POST /api/attorney/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=AttorneyLoginResponse,
    summary="Authenticate and receive a JWT",
)
@limiter.limit("5/minute")
async def login_attorney(
    request: Request,  # required by slowapi
    body: AttorneyLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AttorneyLoginResponse:
    result = await db.execute(
        select(AttorneyRegistered).where(AttorneyRegistered.email == body.email)
    )
    attorney = result.scalar_one_or_none()

    if not attorney or not verify_password(body.password, attorney.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(attorney.id, attorney.email)
    log.info("attorney_login", attorney_id=attorney.id)

    return AttorneyLoginResponse(
        token=token,
        attorney_id=attorney.id,
        name=attorney.name,
        is_founding=attorney.is_founding == "true",
    )


# ---------------------------------------------------------------------------
# GET /api/attorney/profile
# ---------------------------------------------------------------------------

@router.get(
    "/profile",
    response_model=AttorneyProfileResponse,
    summary="Get the authenticated attorney's profile",
)
async def get_profile(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
) -> AttorneyProfileResponse:
    return _to_profile_response(attorney)


# ---------------------------------------------------------------------------
# PUT /api/attorney/profile
# ---------------------------------------------------------------------------

@router.put(
    "/profile",
    response_model=AttorneyProfileResponse,
    summary="Update the authenticated attorney's profile",
)
async def update_profile(
    body: AttorneyProfileUpdate,
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
) -> AttorneyProfileResponse:
    # Build a dict of only the fields that were explicitly provided
    updates = {}
    for field_name, value in body.model_dump(exclude_unset=True).items():
        if field_name == "accepting_clients" and value is not None:
            updates["accepting_clients"] = "true" if value else "false"
        else:
            updates[field_name] = value

    if updates:
        await db.execute(
            update(AttorneyRegistered)
            .where(AttorneyRegistered.id == attorney.id)
            .values(**updates)
        )
        await db.commit()
        await db.refresh(attorney)

    log.info("attorney_profile_updated", attorney_id=attorney.id, fields=list(updates.keys()))
    return _to_profile_response(attorney)


# ---------------------------------------------------------------------------
# GET /api/attorney/leads
# ---------------------------------------------------------------------------

@router.get(
    "/leads",
    response_model=list[LeadSummary],
    summary="List leads sent to the authenticated attorney",
)
async def list_leads(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
) -> list[LeadSummary]:
    result = await db.execute(
        select(Lead)
        .where(Lead.attorney_id == attorney.id)
        .order_by(Lead.sent_at.desc())
    )
    leads = result.scalars().all()

    return [
        LeadSummary(
            id=lead.id,
            case_id=lead.case_id,
            status=lead.status,
            practice_area=lead.case_summary.get("practice_area") if lead.case_summary else None,
            urgency=lead.case_summary.get("urgency") if lead.case_summary else None,
            jurisdiction=lead.case_summary.get("jurisdiction") if lead.case_summary else None,
            sent_at=lead.sent_at.isoformat() if lead.sent_at else None,
            responded_at=lead.responded_at.isoformat() if lead.responded_at else None,
        )
        for lead in leads
    ]


# ---------------------------------------------------------------------------
# POST /api/attorney/leads/{lead_id}/respond
# ---------------------------------------------------------------------------

@router.post(
    "/leads/{lead_id}/respond",
    response_model=LeadSummary,
    summary="Accept or decline a lead",
)
async def respond_to_lead(
    lead_id: str,
    body: LeadRespondRequest,
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
) -> LeadSummary:
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.attorney_id == attorney.id)
    )
    lead = result.scalar_one_or_none()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.status not in ("sent", "viewed"):
        raise HTTPException(
            status_code=400,
            detail=f"Lead already responded to (status: {lead.status})",
        )

    now = datetime.now(timezone.utc)
    new_status = "accepted" if body.action == "accept" else "declined"

    await db.execute(
        update(Lead)
        .where(Lead.id == lead_id)
        .values(status=new_status, responded_at=now)
    )
    await db.commit()
    await db.refresh(lead)

    log.info(
        "lead_responded",
        lead_id=lead_id,
        attorney_id=attorney.id,
        action=body.action,
    )

    return LeadSummary(
        id=lead.id,
        case_id=lead.case_id,
        status=lead.status,
        practice_area=lead.case_summary.get("practice_area") if lead.case_summary else None,
        urgency=lead.case_summary.get("urgency") if lead.case_summary else None,
        jurisdiction=lead.case_summary.get("jurisdiction") if lead.case_summary else None,
        sent_at=lead.sent_at.isoformat() if lead.sent_at else None,
        responded_at=lead.responded_at.isoformat() if lead.responded_at else None,
    )
