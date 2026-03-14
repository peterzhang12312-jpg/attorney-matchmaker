"""
Matching pipeline router.

POST /api/match -- orchestrates the full pipeline:
  1. Retrieve stored case from intake
  2. Gemini analysis (fact extraction)
  3. Attorney scoring / ranking
  4. Claude Opus audit of top candidates
  5. Assemble and return unified response
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import MatchResult as MatchResultRow
from db.queries import get_case
from db.session import get_db
from middleware.rate_limit import limiter
from models.schemas import (
    ErrorResponse,
    MatchRequest,
    MatchResponse,
)
from services.claude_auditor import audit_matches
from services.court_navigator import verify_attorneys
from services.gemini_analyzer import analyze_case
from services.matcher import find_matches
from services.venue_optimizer import recommend_venue

log = structlog.get_logger()

router = APIRouter(prefix="/api", tags=["matching"])


@router.post(
    "/match",
    response_model=MatchResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Case not found"},
        502: {"model": ErrorResponse, "description": "Upstream AI service failure"},
    },
    summary="Run the full matching pipeline",
    description=(
        "Given a case_id from /api/intake, runs Gemini fact extraction, "
        "scores all attorneys, and validates the top matches with Claude Opus. "
        "Returns the complete analysis, ranked matches, and audit results."
    ),
)
@limiter.limit("5/minute")
async def run_match_pipeline(
    request: Request,
    body: MatchRequest,
    db: AsyncSession = Depends(get_db),
) -> MatchResponse:
    start = time.monotonic()
    warnings: list[str] = []

    # ----- Step 0: Retrieve the case ----------------------------------------
    case_row = await get_case(body.case_id, db)
    if case_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {body.case_id} not found. Submit facts via /api/intake first.",
        )

    description = case_row.description
    adv = case_row.advanced_fields or {}
    client_legal_area = adv.get("legal_area")
    client_jurisdiction = adv.get("jurisdiction")
    client_urgency = case_row.urgency or "medium"

    # Extract budget goals if the client provided them at intake
    budget_goals_data = case_row.budget_goals
    budget_goals = None
    if budget_goals_data:
        from models.schemas import BudgetGoals
        budget_goals = BudgetGoals(**budget_goals_data)

    evasive_defendant = adv.get("evasive_defendant", False)

    # Build case_meta for jurisdictional alignment scorer
    case_meta = {
        "jurisdiction": client_jurisdiction,
        "county": adv.get("county"),
        "plaintiff_location": adv.get("plaintiff_location"),
        "defendant_location": adv.get("defendant_location"),
        "federal_question": adv.get("federal_question"),
        "procedural_flags": adv.get("procedural_flags"),
        "subject_matter_jurisdiction": adv.get("subject_matter_jurisdiction"),
        "personal_jurisdiction_basis": adv.get("personal_jurisdiction_basis"),
        "procedural_posture": adv.get("procedural_posture"),
        "primary_remedy": adv.get("primary_remedy"),
        "evasive_defendant": evasive_defendant,
    }

    log.info("match_pipeline_start", case_id=body.case_id)

    # ----- Step 1: Gemini analysis ------------------------------------------
    try:
        analysis = await analyze_case(
            description=description,
            client_legal_area=client_legal_area,
            client_jurisdiction=client_jurisdiction,
            client_urgency=client_urgency,
        )
    except RuntimeError as exc:
        log.error("gemini_analysis_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini analysis failed: {exc}",
        )
    except ValueError as exc:
        log.error("gemini_output_parse_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini returned invalid output: {exc}",
        )

    log.info(
        "gemini_analysis_complete",
        primary_area=analysis.primary_legal_area,
        jurisdiction=analysis.jurisdiction,
        issue_count=len(analysis.key_issues),
    )

    # ----- Step 1b: Corporate defendant HQ lookup ---------------------------
    corporate_hq_state: Optional[str] = None
    try:
        from services.opencorporates_client import detect_corporate_defendants, lookup_corporation
        # Scan Gemini's cleaner fact summary first; fall back to raw description
        scan_text = analysis.fact_summary + " " + " ".join(analysis.key_issues)
        corp_names = detect_corporate_defendants(scan_text) or detect_corporate_defendants(description[:2000])
        if corp_names:
            corp = await lookup_corporation(corp_names[0])
            if corp and corp.hq_state:
                corporate_hq_state = corp.hq_state
                log.info(
                    "corporate_hq_resolved",
                    company=corp_names[0],
                    hq_state=corporate_hq_state,
                )
    except Exception as exc:
        log.warning("corporate_lookup_failed", error=str(exc))
        warnings.append(f"Corporate defendant lookup unavailable: {exc}")

    # ----- Step 1c: Venue recommendation ------------------------------------
    venue_recommendation = None
    try:
        venue_recommendation = await recommend_venue(analysis, description, corporate_hq_state=corporate_hq_state)
        log.info(
            "venue_recommendation",
            court=venue_recommendation.recommended_court,
            john_doe=venue_recommendation.john_doe_protocol,
        )
    except Exception as exc:
        log.warning("venue_optimizer_failed", error=str(exc))
        warnings.append(f"Venue recommendation unavailable: {exc}")

    # ----- Step 2: Score and rank attorneys ----------------------------------
    try:
        candidates = await find_matches(
            analysis,
            case_description=description,
            top_n=5,
            budget_goals=budget_goals,
            case_meta=case_meta,
            fetch_docket_details=True,
            evasive_defendant=evasive_defendant,
        )
    except Exception as exc:
        log.error("matching_algorithm_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matching algorithm error: {exc}",
        )

    if not candidates:
        warnings.append(
            "No attorneys matched the case profile. "
            "This may indicate a coverage gap in the attorney database."
        )

    log.info("matcher_results", candidate_count=len(candidates))

    # ----- Step 3: Claude Opus audit ----------------------------------------
    audit = None
    if candidates:
        try:
            audit = await audit_matches(
                case_description=description,
                analysis=analysis,
                candidates=candidates,
                evasive_defendant=evasive_defendant,
            )
        except RuntimeError as exc:
            # Audit is non-blocking -- if it fails we still return matches
            log.warning("opus_audit_failed", error=str(exc))
            warnings.append(f"Audit layer unavailable: {exc}")
        except ValueError as exc:
            log.warning("opus_audit_output_invalid", error=str(exc))
            warnings.append(f"Audit produced invalid output: {exc}")

    # ----- Step 3b: Live court verification (non-blocking) ------------------
    if candidates:
        try:
            verifications = await asyncio.wait_for(
                verify_attorneys(
                    attorney_names=[c.attorney.name for c in candidates],
                    venue=(
                        venue_recommendation.recommended_court
                        if venue_recommendation else "nysd"
                    ),
                    evasive_defendant=evasive_defendant,
                ),
                timeout=25.0,
            )
            ver_map = {v.attorney_name: v for v in verifications}
            for candidate in candidates:
                candidate.court_verification = ver_map.get(candidate.attorney.name)
            log.info(
                "court_verification_attached",
                verified_count=sum(1 for v in verifications if v.records_found > 0),
            )
        except Exception as exc:
            log.warning("court_verification_unavailable", error=str(exc))
            warnings.append(f"Live court verification unavailable: {exc}")

    # ----- Step 4: Assemble response ----------------------------------------
    elapsed_ms = int((time.monotonic() - start) * 1000)

    log.info(
        "pipeline_complete",
        case_id=body.case_id,
        duration_ms=elapsed_ms,
        match_count=len(candidates),
        audited=audit is not None,
    )

    response = MatchResponse(
        case_id=body.case_id,
        gemini_analysis=analysis,
        matches=candidates,
        audit=audit,
        pipeline_duration_ms=elapsed_ms,
        warnings=warnings,
        venue_recommendation=venue_recommendation,
    )

    # ----- Step 5: Persist match results ------------------------------------
    try:
        match_row = MatchResultRow(
            case_id=body.case_id,
            matches=[m.model_dump(mode="json") for m in candidates],
            audit=audit,
            venue_recommendation=(
                venue_recommendation.model_dump(mode="json")
                if venue_recommendation else None
            ),
        )
        db.add(match_row)
        await db.commit()
    except Exception as exc:
        log.warning("match_persist_failed", error=str(exc))

    return response
