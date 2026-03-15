"""
Court Navigator -- live court filing verification.

Two data sources:
  1. CourtListener docket search (quick attorney name lookup via REST API).
  2. PACER Case Locator (PCL) REST API -- official ToS-compliant public index.

For NY state courts, generates a NYSCEF manual search URL so the user can
verify directly in their browser (no headless automation).

Usage
-----
    from services.court_navigator import verify_attorneys
    results = await verify_attorneys(["Jane Smith"], venue="nysd", evasive_defendant=False)
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
import structlog

from models.schemas import CourtRecord, CourtVerificationResult

log = structlog.get_logger()

# CourtListener base URL (same as courtlistener_client.py)
_CL_BASE = "https://www.courtlistener.com/api/rest/v4"

# PACER Case Locator endpoints
_PCL_LOGIN = "https://pacer.uscourts.gov/pcl-public-api/rest/login"
_PCL_FIND = "https://pacer.uscourts.gov/pcl-public-api/rest/cases/find"

# NYSCEF guest search URL template
_NYSCEF_SEARCH = "https://iapps.courts.state.ny.us/nyscef/CaseSearch"

# CA court search URL template (CourtListener)
_CA_CL_SEARCH = "https://www.courtlistener.com/?q={name}&type=r&order_by=score+desc&stat_Precedential=on"

# Court ID sets
_NY_COURTS = {"nyed", "nysd", "nysupct", "ny"}
_CA_COURTS = {"cacd", "cand", "cal", "calctapp"}
_FEDERAL_COURTS = {"nyed", "nysd", "cacd", "cand"}


def _build_ca_url(attorney_name: str) -> str:
    """Build a CourtListener search URL for CA attorneys."""
    import urllib.parse
    return _CA_CL_SEARCH.format(name=urllib.parse.quote(attorney_name))


def _cl_headers() -> dict[str, str]:
    """Build CourtListener auth headers."""
    token = os.getenv("COURTLISTENER_API_TOKEN", "").strip()
    headers: dict[str, str] = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Token {token}"
    return headers


def _build_nyscef_url(attorney_name: str) -> str:
    """
    Build a NYSCEF CaseSearch URL pre-filled with the attorney's name.

    Splits on the last space to get first/last name components.
    """
    parts = attorney_name.strip().split()
    if len(parts) >= 2:
        first_name = " ".join(parts[:-1])
        last_name = parts[-1]
    else:
        first_name = ""
        last_name = attorney_name.strip()

    return (
        f"{_NYSCEF_SEARCH}"
        f"?param=T"
        f"&lastName={quote(last_name)}"
        f"&firstName={quote(first_name)}"
    )


# ---------------------------------------------------------------------------
# CourtListener attorney name search
# ---------------------------------------------------------------------------

async def _search_courtlistener(
    attorney_name: str,
    court_ids: Optional[list[str]] = None,
) -> list[CourtRecord]:
    """
    Quick CourtListener docket search by attorney name.

    Uses the /dockets/ endpoint with attorney name filtering.
    Timeout is 3s to keep the pipeline fast.
    Returns up to 5 CourtRecord objects. Returns [] on any failure.
    """
    headers = _cl_headers()

    params: dict[str, str] = {
        "type": "1",  # civil dockets
        "order_by": "-date_filed",
        "page_size": "5",
    }

    # Filter by attorney name in the search query
    params["q"] = f'attorney:"{attorney_name}"'

    if court_ids:
        params["court"] = ",".join(court_ids)

    records: list[CourtRecord] = []

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"{_CL_BASE}/dockets/",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        log.warning("courtlistener_timeout", attorney=attorney_name)
        return []
    except Exception as exc:
        log.warning("courtlistener_search_failed", attorney=attorney_name, error=str(exc))
        return []

    results = data.get("results", [])
    for docket in results[:5]:
        try:
            records.append(CourtRecord(
                source="courtlistener",
                case_name=docket.get("case_name") or "Unknown",
                docket_number=docket.get("docket_number") or "",
                court=docket.get("court") or "",
                date_filed=docket.get("date_filed"),
            ))
        except Exception as exc:
            log.debug("cl_docket_parse_error", error=str(exc))

    log.info(
        "courtlistener_verification",
        attorney=attorney_name,
        records_found=len(records),
        courts=court_ids,
    )
    return records


# ---------------------------------------------------------------------------
# PACER Case Locator (REST API -- ToS-compliant)
# ---------------------------------------------------------------------------

async def _pcl_login(client: httpx.AsyncClient) -> Optional[str]:
    """Authenticate with PACER PCL and return the X-Auth-Token string."""
    username = os.getenv("PACER_USERNAME", "").strip()
    password = os.getenv("PACER_PASSWORD", "").strip()
    if not username or not password:
        return None
    try:
        resp = await client.post(
            _PCL_LOGIN,
            json={"loginId": username, "password": password, "redacted": False},
            timeout=10.0,
        )
        resp.raise_for_status()
        token = (
            resp.headers.get("X-Auth-Token")
            or resp.json().get("loginResult")
            or resp.json().get("token")
        )
        return token
    except Exception as exc:
        log.debug("pacer_pcl_login_failed", error=str(exc))
        return None


async def search_pacer_pcl(
    party_name: Optional[str],
    court_ids: Optional[list[str]] = None,
    nature_of_suit: Optional[str] = None,
) -> list[CourtRecord]:
    """
    Search PACER Case Locator REST API for federal cases.

    Fee protection: never follows document links (only public index data).
    PACER_FEE_PROTECTION env var is checked and logged.

    Returns up to 10 CourtRecord objects.
    Returns [] if PACER_USERNAME is not set in .env.
    """
    if not os.getenv("PACER_USERNAME", "").strip():
        log.debug("pacer_username_not_set")
        return []

    fee_protection = os.getenv("PACER_FEE_PROTECTION", "true").lower() == "true"
    log.debug("pacer_pcl_fee_protection", enabled=fee_protection)

    async with httpx.AsyncClient(timeout=15.0) as client:
        token = await _pcl_login(client)
        if not token:
            log.warning("pacer_pcl_auth_failed")
            return []

        headers = {"X-Auth-Token": token, "Accept": "application/json"}

        params: dict = {}
        if party_name:
            parts = party_name.strip().split()
            if len(parts) >= 2:
                params["firstName"] = " ".join(parts[:-1])
                params["lastName"] = parts[-1]
            else:
                params["lastName"] = party_name
        if court_ids:
            params["courtId"] = court_ids[0]  # PCL: single court per query
        if nature_of_suit:
            params["natureOfSuit"] = nature_of_suit

        try:
            resp = await client.get(
                _PCL_FIND,
                params=params,
                headers=headers,
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            log.debug("pacer_pcl_search_failed", error=str(exc))
            return []

    cases = data.get("cases") or data.get("results") or []
    records: list[CourtRecord] = []

    for case in cases[:10]:
        try:
            records.append(CourtRecord(
                source="pacer_pcl",
                case_name=(
                    case.get("caseTitle")
                    or case.get("case_name")
                    or "Unknown"
                ),
                docket_number=(
                    case.get("caseNumberFull")
                    or case.get("docket_number")
                    or ""
                ),
                court=case.get("courtId") or case.get("court") or "",
                date_filed=case.get("dateFiled") or case.get("date_filed"),
            ))
        except Exception as exc:
            log.debug("pacer_pcl_case_parse_error", error=str(exc))

    log.info("pacer_pcl_search", records_found=len(records), courts=court_ids)
    return records[:10]


# ---------------------------------------------------------------------------
# Single-attorney verifier (internal)
# ---------------------------------------------------------------------------

async def _verify_single_attorney(
    attorney_name: str,
    venue: str,
    evasive_defendant: bool,
) -> CourtVerificationResult:
    """Run CourtListener and/or PACER PCL searches for one attorney."""
    venue_lower = venue.lower()
    is_ny = venue_lower in _NY_COURTS or "ny" in venue_lower
    is_ca = venue_lower in _CA_COURTS or "ca" in venue_lower
    is_federal = venue_lower in _FEDERAL_COURTS

    tasks: list = []
    sources: list[str] = []

    # CourtListener lookup for any venue (fast, 3s timeout)
    cl_courts: list[str] = []
    if is_federal:
        cl_courts.append(venue_lower)
    if is_ny and venue_lower in _FEDERAL_COURTS:
        # Already added above
        pass
    elif is_ny:
        # Search NY federal courts as a proxy (CL has limited state coverage)
        cl_courts.extend(["nyed", "nysd"])

    if cl_courts:
        tasks.append(_search_courtlistener(
            attorney_name=attorney_name,
            court_ids=cl_courts,
        ))
        sources.append("courtlistener")

    # PACER PCL for federal courts
    if is_federal:
        tasks.append(search_pacer_pcl(
            party_name=attorney_name,
            court_ids=[venue_lower],
        ))
        sources.append("pacer_pcl")

    # Generate manual verification URL — NYSCEF for NY, CourtListener for CA
    nyscef_url: Optional[str] = None
    if is_ny:
        nyscef_url = _build_nyscef_url(attorney_name)
    elif is_ca:
        nyscef_url = _build_ca_url(attorney_name)

    now_iso = datetime.now(timezone.utc).isoformat()

    if not tasks:
        return CourtVerificationResult(
            attorney_name=attorney_name,
            records_found=0,
            court_records=[],
            source="none",
            verification_url=nyscef_url,
            checked_at=now_iso,
        )

    try:
        results = await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as exc:
        return CourtVerificationResult(
            attorney_name=attorney_name,
            records_found=0,
            court_records=[],
            source="none",
            error=str(exc),
            verification_url=nyscef_url,
            checked_at=now_iso,
        )

    all_records: list[CourtRecord] = []
    used_sources: list[str] = []
    errors: list[str] = []

    for result, source_name in zip(results, sources):
        if isinstance(result, Exception):
            errors.append(f"{source_name}: {result}")
        elif isinstance(result, list):
            all_records.extend(result)
            if result:
                used_sources.append(source_name)

    return CourtVerificationResult(
        attorney_name=attorney_name,
        records_found=len(all_records),
        court_records=all_records[:10],
        source=", ".join(used_sources) if used_sources else "none",
        error="; ".join(errors) if errors else None,
        verification_url=nyscef_url,
        checked_at=now_iso,
    )


# ---------------------------------------------------------------------------
# Public orchestrator
# ---------------------------------------------------------------------------

async def verify_attorneys(
    attorney_names: list[str],
    venue: str,
    evasive_defendant: bool = False,
) -> list[CourtVerificationResult]:
    """
    Verify multiple attorneys concurrently via CourtListener + PACER PCL.

    For NY venues, each result includes a verification_url pointing to
    NYSCEF CaseSearch so the user can manually verify state court records.

    Parameters
    ----------
    attorney_names : list[str]
        Names of attorneys to look up.
    venue : str
        Target court ID (e.g. 'nysd', 'nyed', 'nysupct').
    evasive_defendant : bool
        Passed through for future use; no longer drives NYSCEF automation.

    Returns one CourtVerificationResult per attorney.
    Total hard timeout: 10 seconds (down from 20s with Playwright).
    """
    if not attorney_names:
        return []

    log.info(
        "court_verification_started",
        attorney_count=len(attorney_names),
        venue=venue,
        evasive_defendant=evasive_defendant,
    )

    tasks = [
        _verify_single_attorney(name, venue, evasive_defendant)
        for name in attorney_names
    ]

    try:
        results = await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=10.0,
        )
    except asyncio.TimeoutError:
        log.warning("court_verification_timeout", timeout_s=10)
        now_iso = datetime.now(timezone.utc).isoformat()
        is_ny = venue.lower() in _NY_COURTS or "ny" in venue.lower()
        is_ca = venue.lower() in _CA_COURTS or "ca" in venue.lower()
        return [
            CourtVerificationResult(
                attorney_name=name,
                records_found=0,
                court_records=[],
                source="none",
                error="Verification timed out",
                verification_url=_build_nyscef_url(name) if is_ny else (_build_ca_url(name) if is_ca else None),
                checked_at=now_iso,
            )
            for name in attorney_names
        ]

    final: list[CourtVerificationResult] = []
    now_iso = datetime.now(timezone.utc).isoformat()
    is_ny = venue.lower() in _NY_COURTS or "ny" in venue.lower()
    is_ca = venue.lower() in _CA_COURTS or "ca" in venue.lower()

    for name, result in zip(attorney_names, results):
        if isinstance(result, Exception):
            final.append(CourtVerificationResult(
                attorney_name=name,
                records_found=0,
                court_records=[],
                source="none",
                error=str(result),
                verification_url=_build_nyscef_url(name) if is_ny else (_build_ca_url(name) if is_ca else None),
                checked_at=now_iso,
            ))
        else:
            final.append(result)

    log.info(
        "court_verification_complete",
        attorney_count=len(final),
        verified_count=sum(1 for r in final if r.records_found > 0),
    )
    return final
