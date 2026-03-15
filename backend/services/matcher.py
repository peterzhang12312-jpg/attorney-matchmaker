"""
Attorney matching algorithm.

Scores every attorney in the database against the Gemini-extracted
case profile and returns the top N candidates with itemized score
breakdowns.

Scoring Rubric (100-point scale)
--------------------------------
  Specialization alignment   0-40 pts
  Jurisdiction match         0-25 pts
  Experience weight          0-15 pts
  Availability factor        0-10 pts
  Win-rate bonus             0-5 pts
  Budget alignment           0-10 pts  (5.0 neutral when no ceiling provided)
  ─────────────────────────────────────
  Maximum                    100 pts   (95 base + 5 neutral budget)
"""

from __future__ import annotations

import structlog
from typing import Optional

from data.attorneys import get_all_attorneys
from models.schemas import (
    AttorneyProfile,
    Availability,
    BudgetGoals,
    GeminiAnalysis,
    MatchCandidate,
    ScoreBreakdown,
)
from services.courtlistener_client import fetch_attorneys_by_keywords, _COURT_JURISDICTIONS
from services.gemini_analyzer import extract_search_keywords

log = structlog.get_logger()

TOP_N = 5


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

def _score_specialization(
    attorney: AttorneyProfile,
    primary_area: str,
    secondary_areas: list[str],
) -> float:
    """
    0-40 points.  Full marks if primary area is in the attorney's
    specializations.  Partial credit for secondary overlap.
    """
    specs = set(attorney.specializations)
    score = 0.0

    if primary_area in specs:
        score += 30.0  # strong primary match
    # Partial credit: primary area partially matches a specialization
    # (e.g., "employment" vs. "employment_litigation")
    elif any(primary_area in s or s in primary_area for s in specs):
        score += 15.0

    # Secondary area overlap (up to 10 additional points)
    if secondary_areas:
        overlap = specs.intersection(set(secondary_areas))
        # 5 pts per secondary match, capped at 10
        score += min(len(overlap) * 5.0, 10.0)

    return min(score, 40.0)


def _score_jurisdiction(
    attorney: AttorneyProfile,
    target_jurisdiction: str,
) -> float:
    """
    0-25 points.  Exact match gets full marks.  State-level match when
    the target is a federal district within that state gets partial credit.
    """
    target_upper = target_jurisdiction.upper().strip()
    attorney_jurisdictions_upper = [j.upper().strip() for j in attorney.jurisdictions]

    # Exact match
    if target_upper in attorney_jurisdictions_upper:
        return 25.0

    # Partial: target contains state abbrev that attorney covers
    # e.g., target "N.D. Cal." and attorney has "CA"
    for j in attorney_jurisdictions_upper:
        if len(j) == 2:
            # j is a state abbreviation -- check if target references it
            # Common patterns: "S.D.N.Y." -> NY, "N.D. Cal." -> CA(L)
            # We use a simplified heuristic: state abbrev appears in target
            state = j
            # Map common court abbreviations
            state_map = {
                "CAL": "CA", "CALIF": "CA", "TEX": "TX",
                "ILL": "IL", "FLA": "FL", "MASS": "MA",
                "WASH": "WA", "MICH": "MI", "PENN": "PA",
                "GA": "GA", "OHIO": "OH",
            }
            if state in target_upper:
                return 18.0
            # Check full-name abbreviations in target
            for abbrev, st in state_map.items():
                if abbrev in target_upper and st == state:
                    return 18.0
        else:
            # j is a court name -- check substring containment both ways
            if target_upper in j or j in target_upper:
                return 20.0

    return 0.0


def _score_experience(attorney: AttorneyProfile) -> float:
    """
    0-15 points.  Linear scale capped at 20+ years.
    """
    years = min(attorney.years_experience, 20)
    return (years / 20.0) * 15.0


def _score_availability(attorney: AttorneyProfile) -> float:
    """
    0-10 points.  Available=10, Limited=4, Unavailable=0.
    """
    mapping = {
        Availability.AVAILABLE: 10.0,
        Availability.LIMITED: 4.0,
        Availability.UNAVAILABLE: 0.0,
    }
    return mapping.get(attorney.availability, 0.0)


def _score_win_rate(attorney: AttorneyProfile) -> float:
    """
    0-5 points.  Direct proportional mapping of the attorney's
    historical win rate.  Ceiling lowered from 10 to 5 to preserve
    headroom for budget_score (0-10) without a ceiling collision.
    """
    return attorney.win_rate * 5.0


def _score_budget_alignment(
    attorney: AttorneyProfile,
    budget_goals: Optional["BudgetGoals"],
) -> float:
    """
    Compare attorney hourly_rate against budget_goals.hourly_rate_ceiling.

    Returns a score 0-10:
      10  -- rate within ceiling (or no ceiling set)
       6  -- rate up to 20% over ceiling (acceptable with justification)
       2  -- rate 20-50% over ceiling (penalized)
       0  -- rate >50% over ceiling (disqualified on budget)
       5  -- neutral default when either value is missing
    """
    if not budget_goals or not budget_goals.hourly_rate_ceiling or not attorney.hourly_rate:
        return 5.0
    ratio = attorney.hourly_rate / budget_goals.hourly_rate_ceiling
    if ratio <= 1.0:
        return 10.0
    if ratio <= 1.2:
        return 6.0
    if ratio <= 1.5:
        return 2.0
    return 0.0


# ---------------------------------------------------------------------------
# Jurisdictional alignment scorer
# ---------------------------------------------------------------------------

def _extract_state(location: str) -> str:
    """Extract state abbreviation from 'City, ST' format."""
    if not location:
        return ""
    parts = location.strip().split(",")
    if len(parts) >= 2:
        return parts[-1].strip().upper()
    return location.strip().upper()


def _score_jurisdictional_alignment(
    attorney: AttorneyProfile,
    case_meta: dict,
    diversity_eligible: bool = False,
) -> float:
    """
    0-10 bonus points for precise jurisdictional fit.

    +5  attorney.jurisdictions covers one of the user-selected target courts
    +3  procedural_flags includes 'interpleader' and attorney has interpleader
        experience in notable_cases
    +2  federal_question=True and attorney is admitted in a federal court
    +3  diversity_eligible=True and attorney is admitted in a federal court
        (promotes federal-court attorneys for diversity cases)
    """
    score = 0.0

    # Parse target court IDs from jurisdiction string ("nysd,ny" etc.)
    jurisdiction_str = case_meta.get("jurisdiction") or ""
    target_court_ids = [c.strip() for c in jurisdiction_str.split(",") if c.strip()]

    procedural_flags = case_meta.get("procedural_flags") or []
    federal_question = case_meta.get("federal_question") or False

    atty_jurs_upper = {j.upper().strip() for j in attorney.jurisdictions}

    # Federal court labels (uppercase for comparison)
    federal_labels = {"C.D. CAL.", "N.D. CAL.", "S.D.N.Y.", "E.D.N.Y."}
    has_federal_court = bool(atty_jurs_upper.intersection(federal_labels))

    # +5: attorney covers at least one of the target courts
    for court_id in target_court_ids:
        court_labels = _COURT_JURISDICTIONS.get(court_id, [])
        if any(label.upper() in atty_jurs_upper for label in court_labels):
            score += 5.0
            break

    # +3: interpleader flag and attorney has interpleader in notable_cases
    if "interpleader" in procedural_flags:
        if any("interpleader" in nc.lower() for nc in attorney.notable_cases):
            score += 3.0

    # +2: federal question and attorney has federal court admission
    if federal_question and has_federal_court:
        score += 2.0

    # +3: diversity eligible — promote federal-court attorneys
    if diversity_eligible and has_federal_court:
        score += 3.0

    return min(score, 10.0)


# ---------------------------------------------------------------------------
# Rationale generation
# ---------------------------------------------------------------------------

def _build_rationale(
    attorney: AttorneyProfile,
    breakdown: ScoreBreakdown,
    primary_area: str,
    target_jurisdiction: str,
) -> str:
    """Generate a human-readable explanation of the match."""
    parts: list[str] = []

    if breakdown.specialization_score >= 25:
        parts.append(
            f"Strong specialization alignment: {attorney.name} practices "
            f"in {', '.join(attorney.specializations)} which directly covers "
            f"the identified primary area ({primary_area})."
        )
    elif breakdown.specialization_score > 0:
        parts.append(
            f"Partial specialization overlap: {attorney.name} covers "
            f"{', '.join(attorney.specializations)}."
        )
    else:
        parts.append("No direct specialization match; included based on other factors.")

    if breakdown.jurisdiction_score >= 20:
        parts.append(
            f"Jurisdiction coverage: admitted in {', '.join(attorney.jurisdictions)}, "
            f"which covers the target ({target_jurisdiction})."
        )
    elif breakdown.jurisdiction_score > 0:
        parts.append(
            f"Partial jurisdiction relevance via state-level admission."
        )

    if attorney.years_experience >= 15:
        parts.append(f"Senior practitioner with {attorney.years_experience} years of experience.")

    if attorney.win_rate >= 0.80:
        parts.append(f"Notable win rate of {attorney.win_rate:.0%}.")

    if attorney.availability == Availability.LIMITED:
        parts.append("Note: currently at limited capacity.")
    elif attorney.availability == Availability.UNAVAILABLE:
        parts.append("Warning: currently unavailable for new matters.")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Caselaw enrichment (Harvard CAP)
# ---------------------------------------------------------------------------

async def _enrich_with_caselaw(
    candidates: list[MatchCandidate],
    analysis: GeminiAnalysis,
) -> list[MatchCandidate]:
    """
    Query Harvard Caselaw Access Project for each top candidate and apply a
    +3 landmark bonus to jurisdictional_alignment when wins are found.

    Silently skips candidates on any error so the pipeline is never blocked.
    Requires CASELAW_API_KEY env var — dormant without it.
    """
    import asyncio as _asyncio
    from services.caselaw_client import search_landmark_cases

    tasks = [
        search_landmark_cases(
            analysis.primary_legal_area,
            analysis.jurisdiction,
            c.attorney.name,
        )
        for c in candidates
    ]
    profiles = await _asyncio.gather(*tasks, return_exceptions=True)

    for candidate, profile in zip(candidates, profiles):
        if not profile or isinstance(profile, Exception):
            continue
        candidate.attorney.caselaw_profile = profile
        if profile.has_landmark_wins:
            old_alignment = candidate.score_breakdown.jurisdictional_alignment
            new_alignment = round(min(old_alignment + 3.0, 10.0), 2)
            candidate.score_breakdown.jurisdictional_alignment = new_alignment
            bd = candidate.score_breakdown
            new_composite = round(min(100.0,
                bd.specialization_score + bd.jurisdiction_score + bd.experience_score +
                bd.availability_score + bd.win_rate_score + bd.budget_score + new_alignment
            ), 2)
            candidate.score_breakdown.composite = new_composite
            log.info(
                "CAP landmark bonus: %s -> composite %.1f",
                candidate.attorney.name, new_composite,
            )

    candidates.sort(key=lambda c: c.score_breakdown.composite, reverse=True)
    return candidates


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def find_matches(
    analysis: GeminiAnalysis,
    case_description: str = "",
    top_n: int = 5,
    include_unavailable: bool = False,
    budget_goals: Optional[BudgetGoals] = None,
    case_meta: Optional[dict] = None,
    fetch_docket_details: bool = False,
    evasive_defendant: bool = False,
) -> list[MatchCandidate]:
    """
    Score attorneys against the Gemini analysis and return the top N candidates.

    When case_description is provided the function first tries to source
    attorneys from CourtListener (real data, scoped to CA/federal courts).
    If CourtListener returns fewer than 3 profiles — due to a missing token,
    no matching dockets, or an API error — it falls back to the static
    in-memory roster.

    Parameters
    ----------
    analysis : GeminiAnalysis
        Structured output from the Gemini fact-pattern analyzer.
    case_description : str
        Raw case text used to drive the CourtListener keyword search.
        Pass an empty string to skip live lookup and use static data.
    top_n : int
        Number of candidates to return.
    include_unavailable : bool
        If False (default), attorneys marked UNAVAILABLE are excluded
        before scoring.
    """
    meta = case_meta or {}
    attorneys: list[AttorneyProfile] = []
    data_source = "static"

    # Diversity jurisdiction detection
    plaintiff_loc = meta.get("plaintiff_location") or ""
    defendant_loc = meta.get("defendant_location") or ""
    diversity_eligible = bool(
        plaintiff_loc and defendant_loc
        and _extract_state(plaintiff_loc) != _extract_state(defendant_loc)
        and _extract_state(plaintiff_loc) != ""
        and _extract_state(defendant_loc) != ""
    )
    if diversity_eligible:
        log.info(
            "Diversity jurisdiction detected: plaintiff=%s, defendant=%s",
            plaintiff_loc, defendant_loc,
        )

    # ------ Attempt live CourtListener lookup --------------------------------
    if case_description:
        try:
            kw = await extract_search_keywords(case_description, analysis)
            log.info(
                "CL keywords: query=%r  nos=%s  courts=%s",
                kw.search_query, kw.nature_of_suit_codes, kw.target_court_ids,
            )
            live = await fetch_attorneys_by_keywords(
                search_query=kw.search_query,
                nature_of_suit_codes=kw.nature_of_suit_codes,
                court_ids=kw.target_court_ids or None,
                inferred_specializations=(
                    [analysis.primary_legal_area] + analysis.secondary_areas
                ),
                county=meta.get("county"),
                fetch_docket_details=fetch_docket_details,
                evasive_defendant=evasive_defendant,
            )
            if len(live) >= 3:
                attorneys = live
                data_source = "courtlistener"
            else:
                log.info(
                    "CL returned %d profiles (need ≥3); falling back to static data",
                    len(live),
                )
        except Exception as exc:
            log.warning("CL pipeline error, using static data: %s", exc)

    # ------ Static fallback --------------------------------------------------
    if not attorneys:
        attorneys = get_all_attorneys()

    if not include_unavailable:
        attorneys = [
            a for a in attorneys if a.availability != Availability.UNAVAILABLE
        ]

    log.info(
        "Scoring %d attorneys (source=%s, primary_area=%s, jurisdiction=%s)",
        len(attorneys),
        data_source,
        analysis.primary_legal_area,
        analysis.jurisdiction,
    )

    scored: list[MatchCandidate] = []

    for attorney in attorneys:
        spec_score = _score_specialization(
            attorney, analysis.primary_legal_area, analysis.secondary_areas
        )
        jur_score = _score_jurisdiction(attorney, analysis.jurisdiction)
        exp_score = _score_experience(attorney)
        avail_score = _score_availability(attorney)
        wr_score = _score_win_rate(attorney)
        budget_score = round(_score_budget_alignment(attorney, budget_goals), 2)
        alignment_score = round(_score_jurisdictional_alignment(attorney, meta, diversity_eligible), 2)

        base_composite = spec_score + jur_score + exp_score + avail_score + wr_score
        composite = round(min(100.0, base_composite + budget_score + alignment_score), 2)

        breakdown = ScoreBreakdown(
            specialization_score=round(spec_score, 2),
            jurisdiction_score=round(jur_score, 2),
            experience_score=round(exp_score, 2),
            availability_score=round(avail_score, 2),
            win_rate_score=round(wr_score, 2),
            budget_score=budget_score,
            jurisdictional_alignment=alignment_score,
            composite=round(composite, 2),
        )

        rationale = _build_rationale(
            attorney, breakdown,
            analysis.primary_legal_area,
            analysis.jurisdiction,
        )

        scored.append(
            MatchCandidate(
                attorney=attorney,
                score_breakdown=breakdown,
                match_rationale=rationale,
            )
        )

    # Sort descending by composite score
    scored.sort(key=lambda m: m.score_breakdown.composite, reverse=True)

    # Apply minimum relevance threshold: at least some specialization or jurisdiction
    # overlap required. Prevents padding with completely irrelevant attorneys.
    _MIN_THRESHOLD = 20.0
    relevant = [m for m in scored if m.score_breakdown.composite >= _MIN_THRESHOLD]
    # Fall back to top scored candidates if nothing meets the threshold
    top_pool = relevant if relevant else scored
    top = top_pool[:top_n]

    # Enrich top candidates with Harvard CAP landmark caselaw data (dormant without key)
    if case_description:
        try:
            top = await _enrich_with_caselaw(top, analysis)
        except Exception as exc:
            log.warning("Caselaw enrichment failed (non-fatal): %s", exc)

    log.info(
        "Top %d matches: %s",
        len(top),
        [(m.attorney.name, m.score_breakdown.composite) for m in top],
    )

    return top
