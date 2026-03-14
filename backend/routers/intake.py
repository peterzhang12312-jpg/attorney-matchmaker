"""
Case intake router.

POST /api/intake -- accepts case facts, assigns a case_id, and stores
the submission in the database so the match endpoint can retrieve it later.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case
from db.queries import get_case  # noqa: F401 — re-exported for backward compat
from db.session import get_db
from models.schemas import (
    CaseIntakeRequest,
    CaseIntakeResponse,
    ErrorResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["intake"])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/intake",
    response_model=CaseIntakeResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        422: {"model": ErrorResponse, "description": "Validation error"},
    },
    summary="Submit case facts for analysis",
    description=(
        "Accepts a case description, optional legal area and jurisdiction hints, "
        "and urgency level.  Returns a case_id that can be passed to /api/match "
        "to trigger the full matching pipeline."
    ),
)
async def create_intake(
    body: CaseIntakeRequest,
    db: AsyncSession = Depends(get_db),
) -> CaseIntakeResponse:
    case_id = str(uuid.uuid4())

    # Pack all advanced / optional fields into a single JSON column
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
    )
    db.add(case)
    await db.commit()

    logger.info(
        "Case ingested: id=%s, jurisdiction=%s, urgency=%s, description_len=%d",
        case_id,
        body.jurisdiction,
        body.urgency.value,
        len(body.description),
    )

    return CaseIntakeResponse(
        case_id=case_id,
        status="received",
        message="Case facts received. Use /api/match with this case_id to run the matching pipeline.",
        created_at=datetime.now(timezone.utc),
    )
