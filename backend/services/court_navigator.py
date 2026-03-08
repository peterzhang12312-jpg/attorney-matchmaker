"""
Court Navigator — live court filing verification.

Two data sources:
  1. NYSCEF (New York State Courts Electronic Filing System) via Playwright
     headless browser (guest-only access, no document downloads).
  2. PACER Case Locator (PCL) REST API — official ToS-compliant public index.

# NOTE: NYSCEF automation policy unconfirmed. Guest-only. No document downloads.

Usage
-----
    from services.court_navigator import verify_attorneys
    results = await verify_attorneys(["Jane Smith"], venue="nysd", evasive_defendant=False)
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import httpx

from models.schemas import CourtRecord, CourtVerificationResult

logger = logging.getLogger(__name__)

# PACER Case Locator endpoints
_PCL_LOGIN = "https://pacer.uscourts.gov/pcl-public-api/rest/login"
_PCL_FIND  = "https://pacer.uscourts.gov/pcl-public-api/rest/cases/find"

# NYSCEF guest search URL
_NYSCEF_SEARCH = "https://iapps.courts.state.ny.us/nyscef/Search"

# Court ID sets
_NY_COURTS     = {"nyed", "nysd", "nysupct", "ny"}
_FEDERAL_COURTS = {"nyed", "nysd", "cacd", "cand"}


# ---------------------------------------------------------------------------
# NYSCEF (Playwright headless browser)
# ---------------------------------------------------------------------------

async def search_nyscef_guest(
    party_name: Optional[str],
    county: Optional[str] = None,
    keywords: Optional[list[str]] = None,
) -> list[CourtRecord]:
    """
    Search NYSCEF as a guest user via Playwright headless browser.

    # NOTE: NYSCEF automation policy unconfirmed. Guest-only. No document downloads.

    Returns up to 10 CourtRecord objects. Silently returns [] on any failure.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Playwright not installed -- NYSCEF search unavailable. "
                       "Run: pip install playwright && playwright install chromium")
        return []

    search_term = party_name or (" ".join(keywords) if keywords else None)
    if not search_term:
        return []

    records: list[CourtRecord] = []

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page()

                await page.goto(_NYSCEF_SEARCH, timeout=15000)

                # Locate party name / search input (NYSCEF varies by version)
                party_input = page.locator(
                    "input[name*='party'], input[id*='party'], "
                    "input[placeholder*='Party'], input[placeholder*='party']"
                )
                if await party_input.count() > 0:
                    await party_input.first.fill(search_term)
                else:
                    text_inputs = page.locator("input[type='text']")
                    if await text_inputs.count() > 0:
                        await text_inputs.first.fill(search_term)
                    else:
                        logger.debug("NYSCEF: no suitable input field found")
                        return []

                # Submit
                submit_btn = page.locator(
                    "input[type='submit'], button[type='submit']"
                )
                if await submit_btn.count() > 0:
                    await submit_btn.first.click()
                    await page.wait_for_load_state("networkidle", timeout=15000)

                # Parse results table — skip header row (index 0)
                rows = page.locator("table tr")
                row_count = await rows.count()

                for i in range(1, min(row_count, 11)):
                    row = rows.nth(i)
                    cells = row.locator("td")
                    cell_count = await cells.count()
                    if cell_count < 2:
                        continue
                    try:
                        texts = [
                            (await cells.nth(j).inner_text()).strip()
                            for j in range(cell_count)
                        ]
                        records.append(CourtRecord(
                            source="nyscef",
                            case_name=texts[0] if texts else "Unknown",
                            docket_number=texts[1] if len(texts) > 1 else "",
                            court=county or "New York Supreme Court",
                            date_filed=texts[2] if len(texts) > 2 else None,
                            parties=[party_name] if party_name else [],
                            attorney_name=None,
                            motions_detected=[],
                            verified=True,
                        ))
                    except Exception as row_exc:
                        logger.debug("NYSCEF row %d parse error: %s", i, row_exc)
            finally:
                await browser.close()

    except Exception as exc:
        logger.debug("NYSCEF search failed (non-fatal): %s", exc)
        return []

    logger.info("NYSCEF: %d records found (county=%s)", len(records), county)
    return records[:10]


# ---------------------------------------------------------------------------
# PACER Case Locator (REST API — ToS-compliant)
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
        # Token may be in header or body
        token = (
            resp.headers.get("X-Auth-Token")
            or resp.json().get("loginResult")
            or resp.json().get("token")
        )
        return token
    except Exception as exc:
        logger.debug("PACER PCL login failed: %s", exc)
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
        logger.debug("PACER_USERNAME not set -- PCL search skipped")
        return []

    fee_protection = os.getenv("PACER_FEE_PROTECTION", "true").lower() == "true"
    logger.debug("PACER PCL fee protection=%s", fee_protection)

    async with httpx.AsyncClient(timeout=15.0) as client:
        token = await _pcl_login(client)
        if not token:
            logger.warning("PACER PCL: authentication failed -- skipping PCL search")
            return []

        headers = {"X-Auth-Token": token, "Accept": "application/json"}

        # Build search params per PCL API spec
        params: dict = {}
        if party_name:
            parts = party_name.strip().split()
            if len(parts) >= 2:
                params["firstName"] = " ".join(parts[:-1])
                params["lastName"] = parts[-1]
            else:
                params["lastName"] = party_name
        if court_ids:
            params["courtId"] = court_ids[0]   # PCL: single court per query
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
            logger.debug("PACER PCL search failed: %s", exc)
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
                parties=[party_name] if party_name else [],
                attorney_name=None,
                motions_detected=[],
                verified=True,
            ))
        except Exception as exc:
            logger.debug("PACER PCL case parse error: %s", exc)

    logger.info("PACER PCL: %d records found (courts=%s)", len(records), court_ids)
    return records[:10]


# ---------------------------------------------------------------------------
# Single-attorney verifier (internal)
# ---------------------------------------------------------------------------

async def _verify_single_attorney(
    attorney_name: str,
    venue: str,
    evasive_defendant: bool,
) -> CourtVerificationResult:
    """Run NYSCEF and/or PACER PCL searches for one attorney."""
    venue_lower = venue.lower()
    is_ny      = venue_lower in _NY_COURTS or "ny" in venue_lower
    is_federal = venue_lower in _FEDERAL_COURTS

    keywords: Optional[list[str]] = None
    if evasive_defendant:
        keywords = [
            "substituted service",
            "alternative service",
            "service by publication",
        ]

    tasks: list = []
    sources: list[str] = []

    if is_ny:
        tasks.append(search_nyscef_guest(
            party_name=attorney_name,
            county=None,
            keywords=keywords,
        ))
        sources.append("nyscef")

    if is_federal:
        tasks.append(search_pacer_pcl(
            party_name=attorney_name,
            court_ids=[venue_lower] if venue else None,
        ))
        sources.append("pacer_pcl")

    if not tasks:
        return CourtVerificationResult(
            attorney_name=attorney_name,
            records_found=0,
            court_records=[],
            source="none",
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
    Verify multiple attorneys concurrently via NYSCEF + PACER PCL.

    Parameters
    ----------
    attorney_names : list[str]
        Names of attorneys to look up.
    venue : str
        Target court ID (e.g. 'nysd', 'nyed', 'nysupct').
    evasive_defendant : bool
        When True, injects alternative-service keywords into NYSCEF searches.

    Returns one CourtVerificationResult per attorney.
    Total hard timeout: 20 seconds.
    """
    if not attorney_names:
        return []

    tasks = [
        _verify_single_attorney(name, venue, evasive_defendant)
        for name in attorney_names
    ]

    try:
        results = await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=20.0,
        )
    except asyncio.TimeoutError:
        logger.warning("Court verification timed out after 20s")
        return [
            CourtVerificationResult(
                attorney_name=name,
                records_found=0,
                court_records=[],
                source="none",
                error="Verification timed out",
            )
            for name in attorney_names
        ]

    final: list[CourtVerificationResult] = []
    for name, result in zip(attorney_names, results):
        if isinstance(result, Exception):
            final.append(CourtVerificationResult(
                attorney_name=name,
                records_found=0,
                court_records=[],
                source="none",
                error=str(result),
            ))
        else:
            final.append(result)

    logger.info(
        "Court verification complete: %d attorneys, %d with records",
        len(final),
        sum(1 for r in final if r.records_found > 0),
    )
    return final
