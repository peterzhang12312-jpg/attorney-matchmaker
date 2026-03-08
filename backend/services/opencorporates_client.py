"""
OpenCorporates corporate defendant HQ lookup.

API: https://api.opencorporates.com/v0.4/companies/search
Auth: OPENCORPORATES_API_KEY env var (research/non-commercial key, free)
Apply at: https://opencorporates.com/api_accounts/new

Feature is fully dormant when OPENCORPORATES_API_KEY is not set — zero
network calls, zero latency impact on the existing pipeline.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional

import httpx

from models.schemas import CorporateProfile

logger = logging.getLogger(__name__)

_BASE = "https://api.opencorporates.com/v0.4"

# Regex to detect corporate entity names in free text.
# Note: no trailing \b — dot-terminated suffixes (Inc., Corp.) are not
# followed by a word boundary, so \b after them never matches in Python.
# We use a lookahead instead: suffix must be followed by whitespace,
# punctuation, or end-of-string.
_CORP_PATTERN = re.compile(
    r'\b([A-Z][A-Za-z0-9&\s\-\.]{1,60}?)\s+'
    r'(Inc\.|LLC|Corp\.|Ltd\.|LLP|LP|P\.C\.|PLLC|Co\.)'
    r'(?=[\s,;:\.]|$)'
)

# OpenCorporates jurisdiction codes -> US state abbreviations
_JURIS_TO_STATE: dict[str, str] = {
    "us_ny": "NY", "us_ca": "CA", "us_de": "DE", "us_tx": "TX",
    "us_fl": "FL", "us_il": "IL", "us_nj": "NJ", "us_pa": "PA",
    "us_oh": "OH", "us_ga": "GA", "us_wa": "WA", "us_ma": "MA",
    "us_az": "AZ", "us_co": "CO", "us_nc": "NC", "us_va": "VA",
    "us_mi": "MI", "us_mn": "MN", "us_wi": "WI", "us_mo": "MO",
    "us_ct": "CT", "us_md": "MD", "us_or": "OR", "us_sc": "SC",
    "us_in": "IN", "us_tn": "TN", "us_ks": "KS", "us_nv": "NV",
}


def detect_corporate_defendants(text: str) -> list[str]:
    """
    Scan text for corporate entity names (Inc., LLC, Corp., etc.).

    Returns up to 3 unique matches in order of appearance.
    """
    matches = _CORP_PATTERN.findall(text)
    results: list[str] = []
    for name_part, suffix in matches:
        results.append(f"{name_part.strip()} {suffix}")
    # Dedupe while preserving order, cap at 3
    seen: set[str] = set()
    deduped: list[str] = []
    for r in results:
        if r not in seen:
            seen.add(r)
            deduped.append(r)
        if len(deduped) >= 3:
            break
    return deduped


async def lookup_corporation(
    company_name: str,
    state_hint: Optional[str] = None,
) -> Optional[CorporateProfile]:
    """
    Look up a corporation via OpenCorporates and return its registered
    HQ state.

    Returns None on any error (missing key, network failure, no match) so
    the caller's pipeline is never interrupted.

    Parameters
    ----------
    company_name : str
        The corporate entity name to search for.
    state_hint : str, optional
        Two-letter US state abbreviation to narrow the search jurisdiction.
    """
    api_key = os.getenv("OPENCORPORATES_API_KEY", "").strip()
    if not api_key:
        return None

    params: dict = {"q": company_name, "api_token": api_key}
    if state_hint:
        params["jurisdiction_code"] = f"us_{state_hint.lower()}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{_BASE}/companies/search", params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("OpenCorporates error for %r: %s", company_name, exc)
        return None

    companies = (data.get("results") or {}).get("companies") or []
    if not companies:
        logger.info("OpenCorporates: no match for %r", company_name)
        return None

    # Prefer the first active company; otherwise take the first result
    best: Optional[dict] = None
    for entry in companies:
        c = entry.get("company") or entry
        if (c.get("current_status") or "").lower() in ("active", ""):
            best = c
            break
    if best is None:
        best = companies[0].get("company") or companies[0]

    jur_code = best.get("jurisdiction_code") or ""
    hq_state = _JURIS_TO_STATE.get(jur_code.lower())

    # Fallback: try to extract state from registered_address
    if not hq_state:
        addr = best.get("registered_address") or {}
        if isinstance(addr, dict):
            region = addr.get("region") or addr.get("country_subdivision_code") or ""
            candidate = region.split("-")[-1].strip().upper()
            if len(candidate) == 2:
                hq_state = candidate

    logger.info(
        "OpenCorporates: %r -> jur=%s, hq_state=%s",
        company_name, jur_code, hq_state,
    )
    return CorporateProfile(
        company_name=best.get("name") or company_name,
        jurisdiction_code=jur_code or None,
        registered_address=str(best.get("registered_address") or ""),
        hq_state=hq_state,
        company_number=best.get("company_number"),
        status=best.get("current_status"),
    )
