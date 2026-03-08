"""
/api/refine-facts -- Stateless fact-refinement endpoint.

Accepts raw case facts and returns 2-3 Gemini-generated follow-up questions
to extract missing legal nuances before final intake submission.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from models.schemas import RefineFactsRequest, RefineFactsResponse
from services.gemini_analyzer import refine_facts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Fact Refinement"])


@router.post(
    "/refine-facts",
    response_model=RefineFactsResponse,
    summary="Generate follow-up questions for case fact refinement",
)
async def refine_facts_endpoint(request: RefineFactsRequest) -> RefineFactsResponse:
    """
    Analyze submitted case facts and return 2-3 targeted follow-up questions
    to extract missing legal nuances (procedural posture, jurisdiction triggers,
    financial exposure).

    This endpoint is stateless -- no case_id required. The caller is responsible
    for appending answers to the final fact description before calling /api/intake.
    """
    logger.info("refine-facts: %d chars submitted", len(request.facts))
    questions = await refine_facts(request.facts)
    return RefineFactsResponse(questions=questions)
