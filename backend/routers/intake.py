"""
Case intake router.

POST /api/intake -- accepts case facts, assigns a case_id, and stores
the submission in an in-memory registry so the match endpoint can
retrieve it later.

In production the case store would be a proper database with
encryption-at-rest for PII.  The in-memory dict is strictly for the
MVP pipeline.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict

from fastapi import APIRouter, HTTPException, status

from models.schemas import (
    CaseIntakeRequest,
    CaseIntakeResponse,
    ErrorResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["intake"])

# ---------------------------------------------------------------------------
# In-memory case store
# ---------------------------------------------------------------------------
# Keys: case_id (str)   Values: dict with intake data + metadata
_case_store: Dict[str, dict] = {}


_CASE_TTL = timedelta(hours=2)


def _purge_expired() -> None:
    """Remove case store entries older than 2 hours."""
    cutoff = datetime.now(timezone.utc) - _CASE_TTL
    expired = [
        cid for cid, data in _case_store.items()
        if datetime.fromisoformat(data["created_at"]) < cutoff
    ]
    for cid in expired:
        del _case_store[cid]
    if expired:
        logger.info("Purged %d expired case entries", len(expired))


def get_case(case_id: str) -> dict | None:
    """Retrieve a stored case by ID.  Returns None if not found."""
    return _case_store.get(case_id)


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
async def create_intake(body: CaseIntakeRequest) -> CaseIntakeResponse:
    _purge_expired()
    case_id = str(uuid.uuid4())

    _case_store[case_id] = {
        "case_id": case_id,
        "description": body.description,
        "legal_area": body.legal_area,
        "jurisdiction": body.jurisdiction,
        "urgency": body.urgency.value,
        "budget_goals": body.budget_goals.model_dump() if body.budget_goals else None,
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "received",
    }

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
