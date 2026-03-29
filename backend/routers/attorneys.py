"""
Attorney listing router.

GET /api/attorneys -- returns the attorney roster with optional filters.
"""

from __future__ import annotations

from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from db.models import AttorneyRegistered

from data.attorneys import get_all_attorneys
from models.schemas import AttorneyListResponse, Availability

log = structlog.get_logger()

router = APIRouter(prefix="/api", tags=["attorneys"])


@router.get(
    "/attorneys",
    response_model=AttorneyListResponse,
    summary="List available attorneys",
    description=(
        "Returns the full attorney roster.  Supports optional filtering by "
        "specialization, jurisdiction, and availability status."
    ),
)
async def list_attorneys(
    specialization: Optional[str] = Query(
        None,
        description=(
            "Filter by practice area (e.g. 'employment', 'intellectual_property'). "
            "Uses the LegalArea taxonomy values."
        ),
    ),
    jurisdiction: Optional[str] = Query(
        None,
        description="Filter by jurisdiction (e.g. 'CA', 'S.D.N.Y.').",
    ),
    availability: Optional[Availability] = Query(
        None,
        description="Filter by availability status.",
    ),
) -> AttorneyListResponse:
    attorneys = get_all_attorneys()

    if specialization:
        spec_lower = specialization.lower().strip()
        attorneys = [
            a for a in attorneys
            if spec_lower in [s.lower() for s in a.specializations]
        ]

    if jurisdiction:
        jur_upper = jurisdiction.upper().strip()
        attorneys = [
            a for a in attorneys
            if jur_upper in [j.upper().strip() for j in a.jurisdictions]
        ]

    if availability:
        attorneys = [
            a for a in attorneys
            if a.availability == availability
        ]

    log.info(
        "attorney_listing",
        result_count=len(attorneys),
        specialization=specialization,
        jurisdiction=jurisdiction,
        availability=availability,
    )

    # Strip email before returning public list
    attorneys_public = []
    for a in attorneys:
        data = a.model_dump()
        data.pop("email", None)
        attorneys_public.append(data)

    return {"attorneys": attorneys_public, "total": len(attorneys_public)}


@router.get(
    "/attorneys/{attorney_id}",
    summary="Get a single attorney profile by ID",
)
async def get_attorney(
    attorney_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # 1. Check static list first (att-XXX IDs)
    all_attorneys = get_all_attorneys()
    static_match = next((a for a in all_attorneys if a.id == attorney_id), None)
    if static_match:
        data = static_match.model_dump()
        data.pop("email", None)  # don't expose email publicly
        return data

    # 2. Fall back to registered attorneys table
    result = await db.execute(
        select(AttorneyRegistered).where(AttorneyRegistered.id == attorney_id)
    )
    reg = result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Attorney not found")

    return {
        "id": reg.id,
        "name": reg.name,
        "bar_number": reg.bar_number,
        "firm": reg.firm,
        "jurisdictions": reg.jurisdictions or [],
        "specializations": reg.practice_areas or [],
        "years_experience": 0,
        "win_rate": 0.0,
        "availability": reg.availability or "available",
        "notable_cases": [],
        "hourly_rate": int(reg.hourly_rate) if reg.hourly_rate else None,
        "bio": reg.bio,
        "languages": reg.languages or [],
        "free_consultation": reg.free_consultation or False,
        "photo_url": reg.photo_url,
        "response_time_hours": reg.response_time_hours,
    }
