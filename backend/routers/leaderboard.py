"""
/api/leaderboard -- Objective attorney leaderboard by domain and jurisdiction.

Aggregates CourtListener docket data with static roster to produce an
objective "Moneyball" ranking using the Objective Efficacy Score (0-100).
Results are cached for 60 minutes.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query
from models.schemas import LeaderboardResponse
from services.leaderboard_engine import get_leaderboard

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Leaderboard"])

_VALID_DOMAINS = {"intellectual_property", "real_estate", "corporate", "employment"}
_VALID_JURISDICTIONS = {"CA", "NY", "CA+NY"}


@router.get(
    "/leaderboard",
    response_model=LeaderboardResponse,
    summary="Get objective attorney leaderboard for a practice domain",
)
async def get_leaderboard_endpoint(
    domain: str = Query(
        "intellectual_property",
        description="Practice domain: intellectual_property | real_estate | corporate | employment",
    ),
    jurisdiction: str = Query(
        "CA+NY",
        description="Target jurisdiction: CA | NY | CA+NY",
    ),
    top_n: int = Query(10, ge=1, le=25, description="Maximum entries to return."),
    include_audit: bool = Query(
        True,
        description="Whether to run Claude Opus audit on top 5 entries.",
    ),
) -> LeaderboardResponse:
    """
    Returns the top-ranked attorneys for the specified domain and jurisdiction
    using the Objective Efficacy Score: 40% budget adherence + 30% case volume
    + 30% win rate. Results are cached for 60 minutes.

    Score labels:
    - 'Verified' -- static roster with real win-rate data
    - 'Data-Limited' -- CourtListener attorney (0.5 neutral win rate)
    """
    # Normalize domain and jurisdiction (accept case-insensitive)
    domain = domain.lower().replace(" ", "_").replace("-", "_")
    jurisdiction = jurisdiction.upper()

    if domain not in _VALID_DOMAINS:
        domain = "intellectual_property"
    if jurisdiction not in _VALID_JURISDICTIONS:
        jurisdiction = "CA+NY"

    logger.info("Leaderboard request: domain=%s jurisdiction=%s top_n=%d", domain, jurisdiction, top_n)
    return await get_leaderboard(domain=domain, jurisdiction=jurisdiction, top_n=top_n, include_audit=include_audit)
