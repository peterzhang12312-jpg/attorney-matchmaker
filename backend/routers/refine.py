"""
/api/refine-facts -- Stateless fact-refinement endpoint.

Accepts raw case facts and returns 2-3 Gemini-generated follow-up questions
to extract missing legal nuances before final intake submission.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Request
from middleware.rate_limit import limiter
from models.schemas import RefineFactsRequest, RefineFactsResponse
from services.gemini_analyzer import refine_facts

log = structlog.get_logger()

router = APIRouter(prefix="/api", tags=["Fact Refinement"])


@router.post(
    "/refine-facts",
    response_model=RefineFactsResponse,
    summary="Generate follow-up questions for case fact refinement",
)
@limiter.limit("20/minute")
async def refine_facts_endpoint(request: Request, body: RefineFactsRequest) -> RefineFactsResponse:
    """
    Analyze submitted case facts and return 2-3 targeted follow-up questions
    to extract missing legal nuances (procedural posture, jurisdiction triggers,
    financial exposure).

    This endpoint is stateless -- no case_id required. The caller is responsible
    for appending answers to the final fact description before calling /api/intake.
    """
    log.info("refine_facts_request", chars=len(body.facts))
    questions = await refine_facts(body.facts)
    return RefineFactsResponse(questions=questions)
