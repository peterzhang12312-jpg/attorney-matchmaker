"""
CourtListener REST API v4 client.

Searches for attorneys who have recently appeared in cases matching
the provided keywords in California state and federal courts.

Key design decision
-------------------
CourtListener search results (type=r) include attorney names, IDs, and
firm names INLINE in each result — no secondary /attorneys/?docket= call
is needed.  The secondary endpoint only has data for dockets manually
uploaded via the RECAP browser extension, which most dockets lack.

We extract attorney profiles directly from the search result fields:
  attorney      -> list of attorney name strings (parallel with attorney_id)
  attorney_id   -> CourtListener person IDs for each attorney
  firm          -> list of firm names present in the case (not 1-to-1 with
                   attorneys; one firm is assigned per attorney as a best guess)
  cause         -> cause of action string, added to notable_cases

Scoped courts
-------------
  Federal (LA):  C.D. Cal.           cacd
  Federal (SF):  N.D. Cal.           cand
  State:         CA Supreme Court    cal
  State:         CA Court of Appeal  calctapp

Authentication
--------------
Set COURTLISTENER_API_TOKEN in .env.  Register for free at
https://www.courtlistener.com/sign-in/ to get a token.

Rate limit: 5,000 requests / hour (authenticated users).
"""

from __future__ import annotations

import asyncio
import os

import structlog
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from models.schemas import (
    AttorneyProfile,
    Availability,
    CaseTimeline,
    DocketIntelligence,
    JudgeAppearance,
    MotionRecord,
)

log = structlog.get_logger()

_BASE = "https://www.courtlistener.com/api/rest/v4"

# Courts in scope for this integration — all 94 federal districts + state courts
from data.federal_courts import FEDERAL_COURTS as _FC
SCOPED_COURTS: dict[str, str] = {k: v["label"] for k, v in _FC.items()}
SCOPED_COURTS["cal"] = "California Supreme Court"
SCOPED_COURTS["calctapp"] = "California Court of Appeal"
SCOPED_COURTS["ny"] = "New York Court of Appeals"
SCOPED_COURTS["nysupct"] = "New York Supreme Court"

# Jurisdiction labels written onto each AttorneyProfile.
# Multiple values give the scorer more surface area to find a match.
_COURT_JURISDICTIONS: dict[str, list[str]] = {
    "cacd":     ["C.D. Cal.", "CA"],
    "cand":     ["N.D. Cal.", "CA"],
    "cal":      ["CA"],
    "calctapp": ["CA"],
    "nyed":     ["E.D.N.Y.", "NY"],
    "nysd":     ["S.D.N.Y.", "NY"],
    "ny":       ["NY"],
    "nysupct":  ["NY", "New York Supreme Court"],
}

# Auto-generate jurisdiction labels for all federal courts not already mapped
for _court_id, _court_info in _FC.items():
    if _court_id not in _COURT_JURISDICTIONS:
        _COURT_JURISDICTIONS[_court_id] = [_court_info["label"], _court_info["state"]]

# County → CourtListener court IDs for NY Supreme Court (trial-level, all counties)
_NY_COUNTY_COURTS: dict[str, list[str]] = {
    "Queens":    ["nysupct"],
    "Kings":     ["nysupct"],
    "Bronx":     ["nysupct"],
    "New York":  ["nysupct"],
    "Richmond":  ["nysupct"],
}

_LOOKBACK_DAYS = 730  # 2 years


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _headers() -> dict[str, str]:
    token = os.getenv("COURTLISTENER_API_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "COURTLISTENER_API_TOKEN is not set.  "
            "Register at https://www.courtlistener.com/sign-in/ to obtain a "
            "free token, then add it to your .env file."
        )
    return {"Authorization": f"Token {token}", "Accept": "application/json"}


def _filed_after() -> str:
    """MM/DD/YYYY recency cutoff (CourtListener search format)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS)
    return cutoff.strftime("%m/%d/%Y")


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

async def _nos_fallback_search(
    client: httpx.AsyncClient,
    nos_codes: list[str],
    court_ids: list[str],
    inferred_specializations: list[str],
) -> list[AttorneyProfile]:
    """
    NOS-code fallback using /dockets/?nature_of_suit=<code>&has_entries=true.

    Called when the primary RECAP full-text search returns fewer than 3
    attorney profiles.  The /dockets/ endpoint supports nature_of_suit
    filtering (unlike /search/), giving us a second chance to find
    domain-specific attorneys.

    Returns profiles extracted from docket attorney objects, or [] on any error.
    """
    if not nos_codes:
        return []

    profiles: list[AttorneyProfile] = []
    seen_names: set[str] = set()

    for nos_code in nos_codes[:2]:   # cap at 2 NOS codes to limit API calls
        for court_id in court_ids[:3]:
            try:
                resp = await asyncio.wait_for(
                    client.get(
                        f"{_BASE}/dockets/",
                        params={
                            "nature_of_suit": nos_code,
                            "court":          court_id,
                            "has_entries":    "true",
                            "order_by":       "date_filed desc",
                            "page_size":      5,
                            "fields":         "id,case_name,court_id,attorneys,date_filed",
                        },
                    ),
                    timeout=5.0,
                )
                if resp.status_code != 200:
                    continue
                dockets = resp.json().get("results") or []
            except Exception as exc:
                log.debug("NOS fallback %s/%s error: %s", nos_code, court_id, exc)
                continue

            court_jurs = _COURT_JURISDICTIONS.get(court_id, [court_id.upper()])
            for docket in dockets:
                attorneys_raw = docket.get("attorneys") or []
                case_name = str(docket.get("case_name") or "")
                for atty_obj in attorneys_raw:
                    try:
                        name = (atty_obj.get("name") or "").strip()
                        if not name or name in seen_names:
                            continue
                        seen_names.add(name)
                        firm = (atty_obj.get("organization") or "Unknown Firm").strip()
                        profiles.append(AttorneyProfile(
                            id=f"cl-nos-{name.lower().replace(' ', '-')}",
                            name=name,
                            bar_number=f"CL-NOS-{nos_code}",
                            firm=firm,
                            jurisdictions=court_jurs,
                            specializations=inferred_specializations or ["general_litigation"],
                            years_experience=5,
                            win_rate=0.5,
                            availability=Availability.AVAILABLE,
                            notable_cases=[case_name] if case_name else [],
                        ))
                    except Exception:
                        continue

            if len(profiles) >= 10:
                break
        if len(profiles) >= 10:
            break

    if profiles:
        log.info(
            "NOS fallback: %d attorney profiles from nos_codes=%s",
            len(profiles), nos_codes,
        )
    return profiles


async def _search_dockets(
    client: httpx.AsyncClient,
    query: str,
    court_ids: list[str],
    max_results: int,
) -> list[dict[str, Any]]:
    """
    Query the CourtListener search endpoint for RECAP dockets (type=r).

    type=r means RECAP-only — only dockets contributed via the RECAP browser
    extension or bulk import are returned.  This is intentional: we never
    follow document links and never incur PACER fees.

    Each result includes inline arrays:
      attorney / attorney_id / firm / firm_id / party / cause / suitNature
    These are used directly by _profiles_from_result — no follow-up call needed.
    """
    params: dict[str, Any] = {
        "q":           query,
        "type":        "r",                   # RECAP-only — no PACER fees
        "court":       " ".join(court_ids),
        "filed_after": _filed_after(),
        "order_by":    "score desc",
    }
    log.info(
        "CL search: q=%r  courts=%s  filed_after=%s",
        query, params["court"], params["filed_after"],
    )
    resp = await client.get(f"{_BASE}/search/", params=params)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    log.info("CL search: %d raw results", len(results))
    return results[:max_results]


# ---------------------------------------------------------------------------
# Profile extraction — from inline search result fields
# ---------------------------------------------------------------------------

def _profiles_from_result(
    result: dict[str, Any],
    inferred_specializations: list[str],
) -> list[AttorneyProfile]:
    """
    Build AttorneyProfile objects from the inline attorney data embedded in a
    CourtListener search result.

    Field mapping
    -------------
    attorney      parallel list of name strings          (attorney[i] + attorney_id[i])
    attorney_id   parallel list of CL person IDs
    firm          list of firm names in the case         (NOT 1-to-1 with attorney list)
    cause         cause-of-action string                 (e.g. '17:501 Copyright Infringement')
    caseName      case name for notable_cases

    Because firm[] is not 1-to-1 with attorney[], we assign each attorney the
    firm at the same modular index (round-robin).  This is imprecise but gives
    reasonable attribution for 2-firm cases (plaintiff / defendant split).
    """
    names:       list[str] = result.get("attorney") or []
    ids:         list[int] = result.get("attorney_id") or []
    firms:       list[str] = [f for f in (result.get("firm") or []) if f]
    court_id:    str       = str(result.get("court_id") or result.get("court") or "")
    case_name:   str       = str(result.get("caseName") or result.get("case_name") or "")
    cause:       str       = str(result.get("cause") or "")
    suit_nature: str       = str(result.get("suitNature") or "")

    jurisdictions = _COURT_JURISDICTIONS.get(court_id, [court_id.upper(), "CA"])
    notable = f"{case_name} — {cause}" if cause else case_name

    profiles: list[AttorneyProfile] = []
    seen_ids: set[int] = set()
    seen_names: set[str] = set()

    for i, raw_name in enumerate(names):
        # Clean up trailing commas / whitespace CourtListener sometimes adds
        name = raw_name.strip().rstrip(",").strip()
        if not name:
            continue

        atty_id: int | None = ids[i] if i < len(ids) else None

        # Deduplicate by ID (preferred) then by name
        if atty_id is not None:
            if atty_id in seen_ids:
                continue
            seen_ids.add(atty_id)
        else:
            if name in seen_names:
                continue
        seen_names.add(name)

        # Round-robin firm assignment — best effort without extra API calls
        firm = firms[i % len(firms)] if firms else "Unknown Firm"

        profiles.append(AttorneyProfile(
            id=f"cl-{atty_id if atty_id is not None else name.lower().replace(' ', '-')}",
            name=name,
            bar_number=f"CL-{atty_id or '000000'}",
            firm=firm,
            jurisdictions=jurisdictions,
            specializations=inferred_specializations or ["general_litigation"],
            years_experience=5,   # CL has no bar-admission date; conservative default
            win_rate=0.5,         # CL has no outcome data; neutral default
            availability=Availability.AVAILABLE,
            notable_cases=[notable] if notable else [],
        ))

    if profiles:
        log.debug(
            "CL: extracted %d attorneys from %r (suit=%s)",
            len(profiles), case_name, suit_nature,
        )

    return profiles


# ---------------------------------------------------------------------------
# Docket intelligence helpers
# ---------------------------------------------------------------------------

MOTION_KEYWORDS: dict[str, list[str]] = {
    "osc": ["order to show cause", "show cause"],
    "tro": ["temporary restraining order"],
    "pi":  ["preliminary injunction"],
    "msj": ["summary judgment"],
    "mtd": ["motion to dismiss"],
    "alt_service": [
        "substituted service",
        "service by publication",
        "alternative service",
        "ex parte motion for alternative service",
    ],
}

MOTION_LABELS: dict[str, str] = {
    "osc":         "Order to Show Cause",
    "tro":         "Temporary Restraining Order",
    "pi":          "Preliminary Injunction",
    "msj":         "Summary Judgment",
    "mtd":         "Motion to Dismiss",
    "alt_service": "Alternative Service Motion",
}


async def _fetch_docket_meta(docket_id: Any, client: httpx.AsyncClient) -> dict[str, Any]:
    """
    Fetch judge name and case dates from the CL dockets endpoint.
    Returns an empty dict on any failure (partial data is acceptable).
    """
    try:
        resp = await asyncio.wait_for(
            client.get(
                f"{_BASE}/dockets/{docket_id}/",
                params={
                    "fields": "assigned_to_str,referred_to_str,date_filed,date_terminated,case_name,docket_number",
                },
            ),
            timeout=2.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        log.debug("_fetch_docket_meta(%s) failed: %s", docket_id, exc)
    return {}


async def _fetch_docket_entries(docket_id: Any, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """
    Fetch recent docket entries (filings) to detect motion types.
    Returns an empty list on any failure.
    """
    try:
        resp = await asyncio.wait_for(
            client.get(
                f"{_BASE}/docket-entries/",
                params={
                    "docket": docket_id,
                    "order_by": "date_filed",
                    "page_size": 20,
                    "fields": "date_filed,description,entry_number",
                },
            ),
            timeout=2.0,
        )
        if resp.status_code == 200:
            return resp.json().get("results", [])
    except Exception as exc:
        log.debug("_fetch_docket_entries(%s) failed: %s", docket_id, exc)
    return []


def _detect_motion_types(entries: list[dict[str, Any]]) -> set[str]:
    """
    Parse docket entry descriptions using keyword matching (no LLM).
    Returns a set of detected motion_type keys (osc, tro, pi, msj, mtd).
    """
    detected: set[str] = set()
    for entry in entries:
        desc = (entry.get("description") or "").lower()
        for motion_type, keywords in MOTION_KEYWORDS.items():
            if any(kw in desc for kw in keywords):
                detected.add(motion_type)
    return detected


def _extract_docket_id(result: dict[str, Any]) -> Any:
    """Extract docket_id from a CL search result dict."""
    # Prefer the explicit field
    docket_id = result.get("docket_id")
    if docket_id:
        return docket_id
    # Fall back: parse from absolute_url "/recap/gov.uscourts.nysd.12345/"
    url = result.get("absolute_url") or ""
    parts = [p for p in url.rstrip("/").split("/") if p]
    if parts:
        candidate = parts[-1]
        if candidate.isdigit():
            return int(candidate)
    return None


async def _build_docket_intelligence(
    attorney_name: str,
    docket_results: list[dict[str, Any]],
    client: httpx.AsyncClient,
) -> DocketIntelligence:
    """
    For a single attorney, aggregate motion/judge intelligence across their dockets.
    Fetches meta + entries concurrently (up to 10 dockets).
    """
    # Collect unique docket IDs from results where this attorney appears
    docket_ids: list[Any] = []
    result_by_id: dict[Any, dict[str, Any]] = {}
    for result in docket_results:
        attorneys_in_result = result.get("attorney") or []
        # Check if this attorney appeared in this docket
        appeared = any(
            (n.strip().rstrip(",").strip()).lower() == attorney_name.lower()
            for n in attorneys_in_result
        )
        if not appeared:
            continue
        docket_id = _extract_docket_id(result)
        if docket_id and docket_id not in result_by_id:
            docket_ids.append(docket_id)
            result_by_id[docket_id] = result
        if len(docket_ids) >= 10:
            break

    if not docket_ids:
        return DocketIntelligence(data_verified=False, dockets_analyzed=0)

    # Fetch meta + entries concurrently for all dockets
    meta_tasks = [_fetch_docket_meta(did, client) for did in docket_ids]
    entries_tasks = [_fetch_docket_entries(did, client) for did in docket_ids]
    all_meta, all_entries = await asyncio.gather(
        asyncio.gather(*meta_tasks),
        asyncio.gather(*entries_tasks),
    )

    motion_history: list[MotionRecord] = []
    judge_appearances: list[JudgeAppearance] = []
    case_timelines: list[CaseTimeline] = []
    judge_seen: set[str] = set()

    for docket_id, meta, entries, result in zip(
        docket_ids, all_meta, all_entries, [result_by_id[did] for did in docket_ids]
    ):
        court_id = str(result.get("court_id") or result.get("court") or "")
        court_label = SCOPED_COURTS.get(court_id, court_id.upper())
        case_name = meta.get("case_name") or str(result.get("caseName") or "")
        judge_name = (
            meta.get("assigned_to_str")
            or meta.get("referred_to_str")
            or ""
        ).strip()
        date_filed = meta.get("date_filed") or str(result.get("dateFiled") or "")
        date_terminated = meta.get("date_terminated")
        cause = str(result.get("cause") or "")

        detected = _detect_motion_types(entries)

        # Build MotionRecord entries
        first_entry_date: Optional[str] = entries[0].get("date_filed") if entries else None
        for motion_type in detected:
            motion_history.append(MotionRecord(
                motion_type=motion_type,
                motion_label=MOTION_LABELS[motion_type],
                date_filed=first_entry_date or date_filed or None,
                case_name=case_name,
                court=court_label,
            ))

        # Judge appearance (deduplicate by judge name)
        if judge_name and judge_name not in judge_seen:
            judge_seen.add(judge_name)
            judge_appearances.append(JudgeAppearance(
                judge_name=judge_name,
                court=court_label,
                case_name=case_name,
                motions_in_case=list(detected),
            ))

        # Case timeline (up to 3)
        if len(case_timelines) < 3:
            case_timelines.append(CaseTimeline(
                case_name=case_name,
                cause=cause,
                court=court_label,
                date_filed=date_filed or None,
                date_terminated=date_terminated or None,
                key_motions=[MOTION_LABELS[m] for m in sorted(detected)],
            ))

    all_motion_types = {mr.motion_type for mr in motion_history}

    return DocketIntelligence(
        motion_history=motion_history,
        judge_appearances=judge_appearances[:5],
        case_timelines=case_timelines,
        has_osc_experience="osc" in all_motion_types,
        has_pi_experience="pi" in all_motion_types,
        has_msj_experience="msj" in all_motion_types,
        data_verified=True,
        dockets_analyzed=len(docket_ids),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def fetch_attorneys_by_keywords(
    search_query: str,
    nature_of_suit_codes: list[str],
    court_ids: list[str] | None = None,
    inferred_specializations: list[str] | None = None,
    top_n: int = 20,
    county: Optional[str] = None,
    fetch_docket_details: bool = False,
    evasive_defendant: bool = False,
    recap_only: bool = True,  # enforced via type=r in _search_dockets; param documents intent
) -> list[AttorneyProfile]:
    """
    Search CourtListener for recent cases in the scoped CA courts and return
    deduplicated attorney profiles extracted from the inline search result data.

    Returns an empty list (never raises) when:
      - COURTLISTENER_API_TOKEN is missing
      - The search returns no dockets
      - No attorney names appear in the results

    The matcher falls back to the static attorney roster when < 3 profiles return.

    Parameters
    ----------
    search_query : str
        Free-text keywords (e.g. "3D model copyright infringement digital asset").
    nature_of_suit_codes : list[str]
        PACER NOS codes — logged for transparency but not used as a search
        filter param (CL's /search/ endpoint does not support NOS filtering;
        only the /dockets/ REST endpoint does, which lacks full-text search).
    court_ids : list[str] | None
        Target CL court IDs.  Defaults to all four scoped CA courts.
    inferred_specializations : list[str] | None
        Practice areas to tag all returned attorneys with.
    top_n : int
        Maximum unique attorney profiles to return.
    """
    try:
        hdrs = _headers()
    except RuntimeError as exc:
        log.warning("CourtListener disabled: %s", exc)
        return []

    target_courts = list(court_ids) if court_ids else list(SCOPED_COURTS.keys())

    # Add county-specific NY courts when a county is specified
    if county:
        county_courts = _NY_COUNTY_COURTS.get(county, [])
        ny_related = {"ny", "nyed", "nysd"}
        if county_courts and any(c in ny_related for c in target_courts):
            for cc in county_courts:
                if cc not in target_courts:
                    target_courts.append(cc)
            log.info("Added county courts for %s: %s", county, county_courts)

    specs = inferred_specializations or ["general_litigation"]

    if evasive_defendant:
        alt_terms = (
            ' "substituted service" OR "service by publication" OR "alternative service"'
        )
        search_query += alt_terms
        log.info("Evasive defendant mode: injected alt-service keywords into CL query")

    if nature_of_suit_codes:
        log.info(
            "NOS codes %s noted (CL full-text search does not filter by NOS)",
            nature_of_suit_codes,
        )

    async with httpx.AsyncClient(headers=hdrs, timeout=20.0) as client:

        # Step 1: Search for relevant dockets (attorney data is inline) --------
        try:
            results = await _search_dockets(
                client, search_query, target_courts, max_results=10
            )
        except httpx.HTTPStatusError as exc:
            log.error("CL search HTTP %s: %s", exc.response.status_code, exc)
            return []
        except Exception as exc:
            log.error("CL search failed: %s", exc)
            return []

        if not results:
            log.info("CL: 0 dockets for query %r", search_query)
            # Attempt NOS fallback before giving up
            if nature_of_suit_codes:
                nos_profiles = await _nos_fallback_search(
                    client, nature_of_suit_codes, target_courts, specs
                )
                if nos_profiles:
                    log.info("NOS fallback produced %d profiles", len(nos_profiles))
                    return nos_profiles[:top_n]
            return []

        # Step 2: Extract attorneys from inline fields — no secondary call needed
        seen_global_ids: set[str] = set()
        seen_global_names: set[str] = set()
        profiles: list[AttorneyProfile] = []

        for result in results:
            for profile in _profiles_from_result(result, specs):
                # Global dedup across all dockets
                atty_id_str = profile.id  # "cl-<id>"
                if atty_id_str in seen_global_ids:
                    continue
                if profile.name in seen_global_names:
                    continue
                seen_global_ids.add(atty_id_str)
                seen_global_names.add(profile.name)
                profiles.append(profile)
                if len(profiles) >= top_n:
                    break
            if len(profiles) >= top_n:
                break

        # If primary search yielded < 3 profiles, supplement with NOS fallback
        if len(profiles) < 3 and nature_of_suit_codes:
            log.info(
                "CL primary search: %d profiles (< 3); attempting NOS fallback nos=%s",
                len(profiles), nature_of_suit_codes,
            )
            nos_profiles = await _nos_fallback_search(
                client, nature_of_suit_codes, target_courts, specs
            )
            seen_nos_names = {p.name for p in profiles}
            for np in nos_profiles:
                if np.name not in seen_nos_names:
                    profiles.append(np)
                    seen_nos_names.add(np.name)
                if len(profiles) >= top_n:
                    break

        # Step 3 (optional): Fetch docket meta + entries for motion intelligence
        if fetch_docket_details and profiles:
            log.info(
                "CL: fetching docket details for %d attorneys (%d dockets)",
                len(profiles), len(results),
            )
            intelligence_tasks = [
                _build_docket_intelligence(p.name, results, client)
                for p in profiles
            ]
            intelligence_list = await asyncio.gather(*intelligence_tasks)
            for profile, intel in zip(profiles, intelligence_list):
                profile.docket_intelligence = intel

    log.info(
        "CL: %d unique attorney profiles from %d dockets",
        len(profiles), len(results),
    )
    return profiles
