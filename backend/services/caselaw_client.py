"""
Harvard Caselaw Access Project (CAP) client.

API: https://api.case.law/v1/cases/
Auth: CASELAW_API_KEY env var (researcher key, free)
Apply at: https://case.law/api/

Feature is fully dormant when CASELAW_API_KEY is not set — zero network
calls, zero latency impact on the existing pipeline.

Rate limits: researcher keys have generous limits; asyncio.Semaphore(2)
caps concurrent CAP requests to stay safely within them.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from models.schemas import CaselawOpinion, CaselawProfile

logger = logging.getLogger(__name__)

_BASE = "https://api.case.law/v1"
_LOOKBACK_YEARS = 10
_PAGE_SIZE = 5

# Initialized to asyncio.Semaphore(2) on first use (event loop must exist)
_CAP_SEMAPHORE: Optional[asyncio.Semaphore] = None

# Map CourtListener/venue court IDs to CAP jurisdiction slugs
_JUR_MAP: dict[str, str] = {
    "ny":      "ny",
    "nysd":    "ny",
    "nyed":    "ny",
    "nysupct": "ny",
    "ca":      "cal",
    "cacd":    "cal",
    "cand":    "cal",
}


def _is_landmark(case: dict) -> bool:
    """
    A case is considered a landmark if it has been cited by other cases
    OR if it was decided within the lookback window (still recent/relevant).
    """
    if case.get("cites_to"):
        return True
    date_str = case.get("decision_date") or ""
    if date_str:
        try:
            decision = datetime.fromisoformat(date_str[:10])
            cutoff = datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_YEARS * 365)
            return decision.replace(tzinfo=timezone.utc) >= cutoff
        except ValueError:
            pass
    return False


async def search_landmark_cases(
    legal_area: str,
    jurisdiction: str,
    attorney_name: str,
) -> Optional[CaselawProfile]:
    """
    Query Harvard CAP for published opinions that mention the attorney by name
    in the relevant legal area.

    Returns None silently on any error (network, auth, rate limit) — the
    feature degrades gracefully so the rest of the pipeline is unaffected.

    Parameters
    ----------
    legal_area : str
        Primary legal area string from GeminiAnalysis (e.g. 'intellectual_property').
    jurisdiction : str
        CourtListener-style jurisdiction string (e.g. 'nysd', 'ny').
    attorney_name : str
        Full attorney name as it would appear in court opinions.
    """
    global _CAP_SEMAPHORE
    if _CAP_SEMAPHORE is None:
        _CAP_SEMAPHORE = asyncio.Semaphore(2)

    api_key = os.getenv("CASELAW_API_KEY", "").strip()
    if not api_key:
        return None

    jur_slug = _JUR_MAP.get(jurisdiction.lower(), "")
    params: dict = {
        "search":    f"{attorney_name} {legal_area}",
        "ordering":  "-cites_to",
        "page_size": _PAGE_SIZE,
    }
    if jur_slug:
        params["jurisdiction"] = jur_slug

    async with _CAP_SEMAPHORE:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{_BASE}/cases/",
                    params=params,
                    headers={
                        "Authorization": f"Token {api_key}",
                        "Accept":        "application/json",
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results") or []
        except Exception as exc:
            logger.warning("CAP API error for %s: %s", attorney_name, exc)
            return None

    opinions: list[CaselawOpinion] = []
    for case in results:
        landmark = _is_landmark(case)
        cites = case.get("citations") or []
        citation = cites[0].get("cite") if cites and isinstance(cites[0], dict) else None
        jur_obj = case.get("jurisdiction") or {}
        opinions.append(CaselawOpinion(
            case_name=case.get("name_abbreviation") or case.get("name") or "",
            citation=citation,
            decision_date=case.get("decision_date"),
            url=case.get("url"),
            jurisdiction=jur_obj.get("slug") if isinstance(jur_obj, dict) else str(jur_obj),
            is_landmark=landmark,
        ))

    landmark_count = sum(1 for o in opinions if o.is_landmark)
    logger.info(
        "CAP: %d opinions for %s (%d landmark)",
        len(opinions), attorney_name, landmark_count,
    )
    return CaselawProfile(
        attorney_name=attorney_name,
        landmark_case_count=landmark_count,
        has_landmark_wins=landmark_count > 0,
        cases=opinions,
    )
