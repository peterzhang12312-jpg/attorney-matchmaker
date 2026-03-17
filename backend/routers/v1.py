"""
White-label /api/v1/ router.

All endpoints require a valid X-API-Key header (white-label tier).
Rate limiting is enforced per-key via the daily_limit field rather than
the slowapi limiter used on the public /api/* endpoints.

Endpoints mirror:
  POST /api/intake       -> POST /api/v1/intake
  POST /api/match        -> POST /api/v1/match
  GET  /api/attorneys    -> GET  /api/v1/attorneys
  GET  /api/leaderboard  -> GET  /api/v1/leaderboard
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ApiKey, Case
from db.queries import get_case
from db.session import get_db
from middleware.api_key_auth import get_api_key_client
from models.schemas import (
    AttorneyListResponse,
    Availability,
    CaseIntakeRequest,
    CaseIntakeResponse,
    ErrorResponse,
    LeaderboardResponse,
    MatchRequest,
)

log = structlog.get_logger()

router = APIRouter(prefix="/api/v1", tags=["v1"])


# ---------------------------------------------------------------------------
# POST /api/v1/intake
# ---------------------------------------------------------------------------

@router.post(
    "/intake",
    response_model=CaseIntakeResponse,
    status_code=status.HTTP_201_CREATED,
    responses={422: {"model": ErrorResponse, "description": "Validation error"}},
    summary="[v1] Submit case facts for analysis",
)
async def v1_intake(
    body: CaseIntakeRequest,
    api_key: ApiKey = Depends(get_api_key_client),
    db: AsyncSession = Depends(get_db),
) -> CaseIntakeResponse:
    """Authenticated intake endpoint for white-label API consumers."""
    case_id = str(uuid.uuid4())

    advanced_fields = {
        "legal_area": body.legal_area,
        "jurisdiction": body.jurisdiction,
        "county": body.county,
        "plaintiff_location": body.plaintiff_location,
        "defendant_location": body.defendant_location,
        "federal_question": body.federal_question,
        "procedural_flags": body.procedural_flags,
        "subject_matter_jurisdiction": body.subject_matter_jurisdiction,
        "personal_jurisdiction_basis": body.personal_jurisdiction_basis,
        "procedural_posture": body.procedural_posture,
        "primary_remedy": body.primary_remedy,
        "evasive_defendant": body.evasive_defendant,
        "advanced_mode": body.advanced_mode,
    }

    case = Case(
        case_id=case_id,
        description=body.description,
        urgency=body.urgency.value,
        budget_goals=body.budget_goals.model_dump() if body.budget_goals else None,
        advanced_fields=advanced_fields,
        client_email=body.client_email,
    )
    db.add(case)
    await db.commit()

    log.info(
        "v1_case_ingested",
        case_id=case_id,
        key_id=api_key.id,
        urgency=body.urgency.value,
    )

    if body.client_email:
        from services.email import send_case_confirmation
        asyncio.create_task(send_case_confirmation(
            to_email=body.client_email,
            case_id=case_id,
            practice_area=body.legal_area or "",
            urgency=body.urgency.value,
        ))

    return CaseIntakeResponse(
        case_id=case_id,
        status="received",
        message="Case facts received. Use /api/v1/match with this case_id to run the matching pipeline.",
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# POST /api/v1/match
# ---------------------------------------------------------------------------

@router.post(
    "/match",
    summary="[v1] Enqueue the full matching pipeline — returns job_id immediately",
    responses={404: {"model": ErrorResponse, "description": "Case not found"}},
)
async def v1_match(
    body: MatchRequest,
    api_key: ApiKey = Depends(get_api_key_client),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Enqueues the match pipeline as a background task.
    Returns { job_id } immediately. Poll GET /api/jobs/{job_id} for progress.
    """
    from routers.match import _run_pipeline
    from services.job_store import create_job

    case_row = await get_case(body.case_id, db)
    if case_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {body.case_id} not found.",
        )

    job_id = await create_job(body.case_id)
    asyncio.create_task(_run_pipeline(job_id, body.case_id))

    log.info("v1_match_job_enqueued", case_id=body.case_id, job_id=job_id, key_id=api_key.id)
    return {"job_id": job_id, "case_id": body.case_id, "stage": "queued"}


# ---------------------------------------------------------------------------
# GET /api/v1/attorneys
# ---------------------------------------------------------------------------

@router.get(
    "/attorneys",
    response_model=AttorneyListResponse,
    summary="[v1] List available attorneys",
)
async def v1_attorneys(
    specialization: Optional[str] = Query(None, description="Filter by practice area"),
    jurisdiction: Optional[str] = Query(None, description="Filter by jurisdiction"),
    availability: Optional[Availability] = Query(None, description="Filter by availability status"),
    api_key: ApiKey = Depends(get_api_key_client),
) -> AttorneyListResponse:
    """Authenticated attorney listing for white-label API consumers."""
    from data.attorneys import get_all_attorneys

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
        "v1_attorney_listing",
        result_count=len(attorneys),
        key_id=api_key.id,
    )

    return AttorneyListResponse(attorneys=attorneys, total=len(attorneys))


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard
# ---------------------------------------------------------------------------

_VALID_DOMAINS = {
    "intellectual_property", "real_estate", "corporate", "employment",
    "criminal_defense", "immigration", "bankruptcy", "personal_injury",
    "landlord_tenant", "employment_employee", "estate_planning", "family_law",
    "civil_litigation", "contract_dispute", "securities", "tax",
}
_VALID_JURISDICTIONS = {"CA", "NY", "CA+NY"}


@router.get(
    "/leaderboard",
    response_model=LeaderboardResponse,
    summary="[v1] Get objective attorney leaderboard for a practice domain",
)
async def v1_leaderboard(
    domain: str = Query("intellectual_property", description="Practice domain"),
    jurisdiction: str = Query("CA+NY", description="Target jurisdiction: CA | NY | CA+NY"),
    top_n: int = Query(10, ge=1, le=25, description="Maximum entries to return."),
    include_audit: bool = Query(True, description="Whether to run Claude Opus audit on top 5 entries."),
    api_key: ApiKey = Depends(get_api_key_client),
) -> LeaderboardResponse:
    """Authenticated leaderboard endpoint for white-label API consumers."""
    from services.leaderboard_engine import get_leaderboard

    domain = domain.lower().replace(" ", "_").replace("-", "_")
    jurisdiction = jurisdiction.upper()

    if domain not in _VALID_DOMAINS:
        domain = "intellectual_property"
    if jurisdiction not in _VALID_JURISDICTIONS:
        jurisdiction = "CA+NY"

    log.info("v1_leaderboard_request", domain=domain, jurisdiction=jurisdiction, key_id=api_key.id)
    return await get_leaderboard(domain=domain, jurisdiction=jurisdiction, top_n=top_n, include_audit=include_audit)
