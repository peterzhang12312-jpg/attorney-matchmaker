"""
Case lookup service -- searches CourtListener by docket number, case name, or description.
Returns case metadata, attorneys with motion timelines, and Claude-generated summaries.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional

import httpx
import structlog

from models.schemas import (
    AttorneyExpectation, CaseLookupAttorney, CaseMeta,
    CaseLookupResponse, DocketIntelligence, SimilarityAnalysis,
    TimelineEntry,
)
from services.courtlistener_client import (
    MOTION_KEYWORDS, MOTION_LABELS,
    _fetch_docket_entries, _fetch_docket_meta, _headers,
)

log = structlog.get_logger()

_BASE = "https://www.courtlistener.com/api/rest/v4"

# Plain-English motion explanations
MOTION_PLAIN_ENGLISH: dict[str, str] = {
    "tro": (
        "An emergency court order asking the judge to immediately stop the other side "
        "from doing something harmful -- used when waiting for trial would cause irreparable damage."
    ),
    "msj": (
        "Asks the court to resolve the case without a trial by arguing the facts are undisputed "
        "and the law is clear. A win here ends the case early."
    ),
    "mtd": (
        "Challenges whether the lawsuit should even proceed by arguing the complaint is legally "
        "deficient. Often the first motion filed by a defendant."
    ),
    "osc": (
        "The court orders a party to explain why they shouldn't face consequences -- "
        "commonly used for contempt or to enforce prior court orders."
    ),
    "alt_service": (
        "When a defendant is hiding or evading process servers, this motion asks the court "
        "to allow service by alternative means such as email or publication."
    ),
    "pi": (
        "A court order that remains in place during the lawsuit, preventing a party from "
        "taking certain actions while the case proceeds."
    ),
}


def _outcome_tag(docket: dict[str, Any]) -> str:
    date_terminated = docket.get("date_terminated")
    if not date_terminated:
        return "Ongoing"
    return "Resolved"


def _detect_query_type(query: str) -> str:
    """Detect whether query is a docket number, case name, or free-text description."""
    if re.search(r"\d+:\d+-[a-z]+-\d+|\d+-[a-z]+-\d+", query, re.IGNORECASE):
        return "docket_number"
    if re.search(r"\bv\.\s|\bvs\.\s|\bversus\s", query, re.IGNORECASE):
        return "case_name"
    return "description"


async def _search_by_docket_number(query: str, client: httpx.AsyncClient) -> list[dict]:
    """Search CourtListener dockets by docket number."""
    try:
        resp = await client.get(
            f"{_BASE}/dockets/",
            params={"docket_number": query.strip(), "format": "json", "page_size": 3},
            headers=_headers(),
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []
        return resp.json().get("results", [])
    except Exception as exc:
        log.warning("docket_number_search_failed", error=str(exc))
        return []


async def _search_by_case_name(query: str, client: httpx.AsyncClient) -> list[dict]:
    """Search CourtListener RECAP index by case name."""
    try:
        resp = await client.get(
            f"{_BASE}/search/",
            params={"q": query, "type": "r", "format": "json", "page_size": 5},
            headers=_headers(),
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []
        results = resp.json().get("results", [])
        docket_ids = list({r.get("docket_id") for r in results if r.get("docket_id")})[:3]
        dockets = []
        for did in docket_ids:
            meta = await _fetch_docket_meta(did, client)
            if meta:
                meta["id"] = did
                dockets.append(meta)
        return dockets
    except Exception as exc:
        log.warning("case_name_search_failed", error=str(exc))
        return []


async def _search_by_description(query: str, client: httpx.AsyncClient) -> list[dict]:
    """Use query as free-text search against CourtListener RECAP index."""
    try:
        resp = await client.get(
            f"{_BASE}/search/",
            params={"q": query, "type": "r", "format": "json", "page_size": 5},
            headers=_headers(),
            timeout=10.0,
        )
        if resp.status_code != 200:
            return []
        results = resp.json().get("results", [])
        docket_ids = list({r.get("docket_id") for r in results if r.get("docket_id")})[:3]
        dockets = []
        for did in docket_ids:
            meta = await _fetch_docket_meta(did, client)
            if meta:
                meta["id"] = did
                dockets.append(meta)
        return dockets
    except Exception as exc:
        log.warning("description_search_failed", error=str(exc))
        return []


def _extract_attorneys_from_docket(docket: dict) -> list[dict]:
    """Extract attorney objects from a docket result."""
    attorneys = list(docket.get("attorneys") or [])
    for party in (docket.get("parties") or []):
        for atty in (party.get("attorneys") or []):
            if atty not in attorneys:
                attorneys.append(atty)
    return attorneys


def _build_timeline(entries: list[dict]) -> list[TimelineEntry]:
    """Convert raw docket entries to TimelineEntry list with motion detection."""
    timeline = []
    for entry in entries:
        desc = entry.get("description", "")
        date = entry.get("date_filed", "")
        desc_lower = desc.lower()

        motion_type = None
        motion_label = None
        plain_english = None

        for mtype, keywords in MOTION_KEYWORDS.items():
            if any(kw in desc_lower for kw in keywords):
                motion_type = mtype
                motion_label = MOTION_LABELS.get(mtype)
                plain_english = MOTION_PLAIN_ENGLISH.get(mtype)
                break

        if desc:
            timeline.append(TimelineEntry(
                date=date or None,
                description=desc,
                motion_type=motion_type,
                motion_label=motion_label,
                plain_english=plain_english,
            ))

    return sorted(timeline, key=lambda e: e.date or "")


async def _generate_expectation(
    attorney_name: str,
    timeline: list[TimelineEntry],
    docket_intel: Optional[DocketIntelligence],
    hourly_rate: Optional[float],
) -> AttorneyExpectation:
    """Generate Claude Opus attorney expectation summary."""
    import anthropic
    import os

    motion_summary = ", ".join(
        {e.motion_label for e in timeline if e.motion_label}
    ) or "no specific motions detected"

    docket_count = docket_intel.dockets_analyzed if docket_intel else 0
    rate_str = f"${hourly_rate:.0f}/hr" if hourly_rate else "rate unknown"

    prompt = f"""You are a legal analyst. Based on this attorney's docket history, write a concise "What to Expect" summary for a potential client.

Attorney: {attorney_name}
Dockets found: {docket_count}
Motion types filed: {motion_summary}
Hourly rate: {rate_str}

Return JSON with exactly these fields:
{{
  "estimated_timeline": "X-Y months based on [evidence]",
  "likely_strategy": "one sentence on their typical motion approach",
  "typical_outcomes": "one sentence on outcomes based on docket data",
  "budget_estimate": "low-high range based on hourly rate and typical case length",
  "risk_flags": ["flag1", "flag2"]
}}

Be honest about data limitations. If docket_count < 5, include a risk flag about limited data."""

    try:
        cl = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        msg = cl.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return AttorneyExpectation(**data)
    except Exception as exc:
        log.warning("expectation_generation_failed", attorney=attorney_name, error=str(exc))

    # Fallback
    risk_flags = []
    if docket_count < 5:
        risk_flags.append(f"Limited data: only {docket_count} docket entries found in CourtListener")
    return AttorneyExpectation(
        estimated_timeline="Unable to estimate (insufficient docket data)",
        likely_strategy=f"Files: {motion_summary}" if motion_summary != "no specific motions detected" else "No pattern detected",
        typical_outcomes="Insufficient data to assess typical outcomes",
        budget_estimate=f"Based on {rate_str}, estimate varies widely by case complexity",
        risk_flags=risk_flags,
    )


async def _generate_case_summary(case_meta: CaseMeta, timeline: list[TimelineEntry]) -> str:
    """Generate plain-English case summary using Claude Opus."""
    import anthropic
    import os

    entries_text = "\n".join(
        f"- {e.date}: {e.description}" for e in timeline[:20]
    ) or "No docket entries available."

    prompt = f"""Write a plain-English 3-paragraph summary of this court case for a non-lawyer client.

Case: {case_meta.name}
Court: {case_meta.court}
Filed: {case_meta.date_filed or "unknown"}
Judge: {case_meta.judge or "unknown"}
Outcome: {case_meta.outcome_tag or "unknown"}

Key docket entries:
{entries_text}

Paragraph 1: What the dispute was about (parties, legal theory, what was at stake).
Paragraph 2: How the case unfolded (key motions, turning points).
Paragraph 3: How it resolved and what a similar client can learn from it.

Write clearly. Avoid legal jargon. Keep each paragraph 2-3 sentences."""

    try:
        cl = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        msg = cl.messages.create(
            model="claude-opus-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as exc:
        log.warning("case_summary_failed", error=str(exc))
        return f"Case summary unavailable. {case_meta.name} was filed in {case_meta.court}."


async def _score_similarity(
    intake_description: str,
    case_meta: CaseMeta,
    timeline: list[TimelineEntry],
) -> SimilarityAnalysis:
    """Claude Opus similarity score between client's intake and looked-up case."""
    import anthropic
    import os

    motions = [e.motion_label for e in timeline if e.motion_label]
    prompt = f"""Compare a client's case description to a known court case and return a similarity score.

CLIENT'S CASE:
{intake_description}

KNOWN CASE:
Name: {case_meta.name}
Court: {case_meta.court}
Motions filed: {", ".join(set(motions)) or "none detected"}
Outcome: {case_meta.outcome_tag or "unknown"}

Return JSON:
{{
  "score": <0-100 integer>,
  "matching_elements": ["element1", "element2"],
  "key_differences": ["diff1", "diff2"],
  "recommendation": "one sentence on how relevant this case is"
}}"""

    try:
        cl = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        msg = cl.messages.create(
            model="claude-opus-4-6",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return SimilarityAnalysis(**data)
    except Exception as exc:
        log.warning("similarity_scoring_failed", error=str(exc))

    return SimilarityAnalysis(
        score=0,
        matching_elements=[],
        key_differences=[],
        recommendation="Unable to score similarity (AI unavailable).",
    )


async def lookup_case(
    query: Optional[str],
    intake_description: Optional[str] = None,
) -> CaseLookupResponse:
    """
    Main entry point. Detects query type, searches CourtListener,
    builds attorney timelines, runs Claude co-work, returns full response.
    If query is empty, returns an empty result.
    """
    if not query or not query.strip():
        return CaseLookupResponse(
            query_type="description",
            case=CaseMeta(name="No query provided", court="unknown"),
            attorneys=[],
            case_summary="Please enter a docket number, case name, or description to search.",
            extracted_practice_area="general_litigation",
            extracted_venue="nysd",
        )

    query = query.strip()
    query_type = _detect_query_type(query)
    log.info("case_lookup", query_type=query_type, query=query[:80])

    async with httpx.AsyncClient() as client:
        # 1. Fetch dockets
        if query_type == "docket_number":
            dockets = await _search_by_docket_number(query, client)
        elif query_type == "case_name":
            dockets = await _search_by_case_name(query, client)
        else:
            dockets = await _search_by_description(query, client)

        if not dockets:
            return CaseLookupResponse(
                query_type=query_type,
                case=CaseMeta(name="No case found", court="unknown"),
                attorneys=[],
                case_summary="No matching case found in CourtListener. Try a different docket number or case name.",
                extracted_practice_area="general_litigation",
                extracted_venue="nysd",
            )

        docket = dockets[0]
        docket_id = docket.get("id")
        court = docket.get("court") or docket.get("court_id") or "unknown"
        if isinstance(court, dict):
            court = court.get("full_name") or court.get("id") or "unknown"

        case_meta = CaseMeta(
            name=docket.get("case_name") or "Unknown Case",
            docket_number=docket.get("docket_number"),
            court=str(court),
            date_filed=docket.get("date_filed"),
            judge=docket.get("assigned_to_str"),
            cl_url=f"https://www.courtlistener.com/docket/{docket_id}/" if docket_id else None,
            outcome_tag=_outcome_tag(docket),
        )

        # 2. Fetch docket entries for timeline
        entries = await _fetch_docket_entries(docket_id, client) if docket_id else []
        all_timeline = _build_timeline(entries)

        # 3. Extract attorneys
        raw_attorneys = _extract_attorneys_from_docket(docket)

        # 4. Build attorney profiles
        attorney_objects: list[CaseLookupAttorney] = []
        seen_names: set[str] = set()

        for atty in raw_attorneys[:6]:
            name = atty.get("name") or ""
            if isinstance(atty.get("attorney"), dict):
                name = name or atty["attorney"].get("name", "")
            if not name or name in seen_names:
                continue
            seen_names.add(name)

            firm = atty.get("firm") or ""
            if isinstance(atty.get("attorney"), dict):
                firm = firm or atty["attorney"].get("firm", "")

            roles = atty.get("roles") or []
            role = "unknown"
            if any("plaintiff" in str(r).lower() for r in roles):
                role = "plaintiff_attorney"
            elif any("defendant" in str(r).lower() or "defense" in str(r).lower() for r in roles):
                role = "defense_attorney"

            expectation = await _generate_expectation(name, all_timeline, None, None)

            attorney_objects.append(CaseLookupAttorney(
                name=name,
                firm=firm or None,
                role=role,
                timeline=all_timeline,
                expectation=expectation,
            ))

        # 5. Claude case summary
        case_summary = await _generate_case_summary(case_meta, all_timeline)

        # 6. Similarity score (if intake description provided)
        similarity = None
        if intake_description and intake_description.strip():
            similarity = await _score_similarity(intake_description, case_meta, all_timeline)

        # 7. Infer practice area
        combined_text = (case_meta.name + " ".join(e.description for e in all_timeline[:10])).lower()
        practice_area = "general_litigation"
        for area, keywords in [
            ("intellectual_property", ["patent", "copyright", "trademark", "ip"]),
            ("real_estate", ["real estate", "property", "mortgage", "landlord", "tenant"]),
            ("employment", ["employment", "discrimination", "wrongful termination", "title vii"]),
            ("criminal_defense", ["criminal", "felony", "misdemeanor", "arrest"]),
            ("immigration", ["immigration", "visa", "deportation", "asylum"]),
            ("personal_injury", ["personal injury", "negligence", "tort", "accident"]),
        ]:
            if any(kw in combined_text for kw in keywords):
                practice_area = area
                break

        # 8. Infer venue
        venue = "nysd"
        court_lower = str(court).lower()
        if "california" in court_lower or "cacd" in court_lower or "cand" in court_lower:
            venue = "cacd"
        elif "eastern district of new york" in court_lower or "edny" in court_lower:
            venue = "nyed"

        return CaseLookupResponse(
            query_type=query_type,
            case=case_meta,
            attorneys=attorney_objects,
            case_summary=case_summary,
            similarity=similarity,
            extracted_practice_area=practice_area,
            extracted_venue=venue,
        )
