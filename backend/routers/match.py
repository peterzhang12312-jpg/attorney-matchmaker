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
import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, status

from models.schemas import (
    ErrorResponse,
    MatchRequest,
    MatchResponse,
)
from routers.intake import get_case
from services.claude_auditor import audit_matches
from services.court_navigator import verify_attorneys
from services.gemini_analyzer import analyze_case
from services.matcher import find_matches
from services.venue_optimizer import recommend_venue

logger = logging.getLogger(__name__)

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
async def run_match_pipeline(body: MatchRequest) -> MatchResponse:
    start = time.monotonic()
    warnings: list[str] = []

    # ----- Step 0: Retrieve the case ----------------------------------------
    case_data = get_case(body.case_id)
    if case_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {body.case_id} not found. Submit facts via /api/intake first.",
        )

    description = case_data["description"]
    client_legal_area = case_data.get("legal_area")
    client_jurisdiction = case_data.get("jurisdiction")
    client_urgency = case_data.get("urgency", "medium")

    # Extract budget goals if the client provided them at intake
    budget_goals_data = case_data.get("budget_goals")
    budget_goals = None
    if budget_goals_data:
        from models.schemas import BudgetGoals
        budget_goals = BudgetGoals(**budget_goals_data)

    evasive_defendant = case_data.get("evasive_defendant", False)

    # Build case_meta for jurisdictional alignment scorer
    case_meta = {
        "jurisdiction": client_jurisdiction,
        "county": case_data.get("county"),
        "plaintiff_location": case_data.get("plaintiff_location"),
        "defendant_location": case_data.get("defendant_location"),
        "federal_question": case_data.get("federal_question"),
        "procedural_flags": case_data.get("procedural_flags"),
        "subject_matter_jurisdiction": case_data.get("subject_matter_jurisdiction"),
        "personal_jurisdiction_basis": case_data.get("personal_jurisdiction_basis"),
        "procedural_posture": case_data.get("procedural_posture"),
        "primary_remedy": case_data.get("primary_remedy"),
        "evasive_defendant": evasive_defendant,
    }

    logger.info("Starting match pipeline for case %s", body.case_id)

    # ----- Step 1: Gemini analysis ------------------------------------------
    try:
        analysis = await analyze_case(
            description=description,
            client_legal_area=client_legal_area,
            client_jurisdiction=client_jurisdiction,
            client_urgency=client_urgency,
        )
    except RuntimeError as exc:
        logger.error("Gemini analysis failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini analysis failed: {exc}",
        )
    except ValueError as exc:
        logger.error("Gemini output parsing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini returned invalid output: {exc}",
        )

    logger.info(
        "Gemini analysis: primary=%s, jurisdiction=%s, issues=%d",
        analysis.primary_legal_area,
        analysis.jurisdiction,
        len(analysis.key_issues),
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
                logger.info(
                    "Corporate HQ resolved: %s -> %s",
                    corp_names[0], corporate_hq_state,
                )
    except Exception as exc:
        logger.warning("Corporate lookup (non-fatal): %s", exc)
        warnings.append(f"Corporate defendant lookup unavailable: {exc}")

    # ----- Step 1c: Venue recommendation ------------------------------------
    venue_recommendation = None
    try:
        venue_recommendation = await recommend_venue(analysis, description, corporate_hq_state=corporate_hq_state)
        logger.info(
            "Venue recommendation: %s (john_doe=%s)",
            venue_recommendation.recommended_court,
            venue_recommendation.john_doe_protocol,
        )
    except Exception as exc:
        logger.warning("Venue optimizer failed (non-fatal): %s", exc)
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
        logger.error("Matching algorithm failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matching algorithm error: {exc}",
        )

    if not candidates:
        warnings.append(
            "No attorneys matched the case profile. "
            "This may indicate a coverage gap in the attorney database."
        )

    logger.info("Matcher returned %d candidates", len(candidates))

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
            logger.warning("Claude Opus audit failed (non-fatal): %s", exc)
            warnings.append(f"Audit layer unavailable: {exc}")
        except ValueError as exc:
            logger.warning("Claude Opus audit output invalid (non-fatal): %s", exc)
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
            logger.info(
                "Court verification attached to %d candidates",
                sum(1 for v in verifications if v.records_found > 0),
            )
        except Exception as exc:
            logger.warning("Live court verification unavailable (non-fatal): %s", exc)
            warnings.append(f"Live court verification unavailable: {exc}")

    # ----- Step 4: Assemble response ----------------------------------------
    elapsed_ms = int((time.monotonic() - start) * 1000)

    logger.info(
        "Pipeline complete for case %s in %d ms (matches=%d, audited=%s)",
        body.case_id,
        elapsed_ms,
        len(candidates),
        audit is not None,
    )

    return MatchResponse(
        case_id=body.case_id,
        gemini_analysis=analysis,
        matches=candidates,
        audit=audit,
        pipeline_duration_ms=elapsed_ms,
        warnings=warnings,
        venue_recommendation=venue_recommendation,
    )
