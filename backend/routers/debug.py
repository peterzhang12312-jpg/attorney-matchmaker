"""
Debug intelligence check endpoint.

Only active when DEBUG=true in .env.
Registered in main.py conditionally.

GET /api/debug/intelligence-check?company=Formlabs+Inc.&jurisdiction=ny
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/debug", tags=["debug"])
logger = logging.getLogger(__name__)


@router.get(
    "/intelligence-check",
    summary="Verify intelligence layer connectivity",
    description=(
        "Queries OpenCorporates and CourtListener for a given company name and "
        "jurisdiction. Returns raw results for smoke-testing the intelligence stack. "
        "Only available when DEBUG=true."
    ),
)
async def intelligence_check(
    company: str = Query(..., description="Corporate entity name, e.g. 'Formlabs Inc.'"),
    jurisdiction: str = Query("ny", description="CourtListener jurisdiction slug, e.g. 'ny', 'nysd'"),
    nos_code: Optional[str] = Query(None, description="Optional NOS code for CourtListener NOS fallback test"),
) -> dict:
    errors: list[str] = []
    result: dict = {
        "company_query": company,
        "jurisdiction":  jurisdiction,
        "opencorporates": None,
        "courtlistener":  None,
        "errors":         errors,
    }

    # --- OpenCorporates lookup -----------------------------------------------
    try:
        from services.opencorporates_client import lookup_corporation
        corp = await lookup_corporation(company)
        if corp:
            result["opencorporates"] = corp.model_dump()
        else:
            result["opencorporates"] = {"message": "No result (key missing or no match)"}
    except Exception as exc:
        errors.append(f"OpenCorporates: {exc}")
        logger.warning("Debug OC error: %s", exc)

    # --- CourtListener RECAP search ------------------------------------------
    try:
        from services.courtlistener_client import (
            SCOPED_COURTS,
            fetch_attorneys_by_keywords,
        )

        # Determine courts to search from jurisdiction slug
        court_map: dict[str, list[str]] = {
            "ny":   ["nysd", "nyed", "ny"],
            "nysd": ["nysd"],
            "nyed": ["nyed"],
            "ca":   ["cacd", "cand", "cal", "calctapp"],
            "cacd": ["cacd"],
            "cand": ["cand"],
        }
        court_ids = court_map.get(jurisdiction.lower(), list(SCOPED_COURTS.keys()))

        nos_codes = [nos_code] if nos_code else []
        profiles = await fetch_attorneys_by_keywords(
            search_query=company,
            nature_of_suit_codes=nos_codes,
            court_ids=court_ids,
            fetch_docket_details=False,
        )
        result["courtlistener"] = {
            "court_ids_searched": court_ids,
            "profiles_found":     len(profiles),
            "attorney_names":     [p.name for p in profiles[:10]],
        }
    except Exception as exc:
        errors.append(f"CourtListener: {exc}")
        logger.warning("Debug CL error: %s", exc)

    return result
