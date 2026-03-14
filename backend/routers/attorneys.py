"""
Attorney listing router.

GET /api/attorneys -- returns the attorney roster with optional filters.
"""

from __future__ import annotations

from typing import Optional

import structlog
from fastapi import APIRouter, Query

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

    return AttorneyListResponse(
        attorneys=attorneys,
        total=len(attorneys),
    )
