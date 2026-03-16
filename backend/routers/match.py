"""
Matching pipeline router — async version.

POST /api/match now enqueues a background job and returns { job_id } immediately.
The full pipeline runs via asyncio.create_task and updates job state in Redis.
Poll GET /api/jobs/{job_id} to track progress.
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AttorneyRegistered, Lead, MatchResult as MatchResultRow
from db.queries import get_case
from db.session import get_db
from middleware.rate_limit import limiter
from models.schemas import ErrorResponse, MatchRequest, MatchResponse
from services.claude_auditor import audit_matches
from services.court_navigator import verify_attorneys
from services.gemini_analyzer import analyze_case
from services.job_store import create_job, update_job_stage, complete_job, fail_job
from services.matcher import find_matches
from services.venue_optimizer import recommend_venue

log = structlog.get_logger()

LEAD_SCORE_THRESHOLD = 60.0

router = APIRouter(prefix="/api", tags=["matching"])


async def _run_pipeline(job_id: str, case_id: str) -> None:
    """
    Full match pipeline as a background task.
    Updates Redis job state at each stage.
    """
    from db.session import AsyncSessionLocal

    warnings: list[str] = []
    start = time.monotonic()

    async with AsyncSessionLocal() as db:
        try:
            # Stage: analyzing
            await update_job_stage(job_id, "analyzing")

            case_row = await get_case(case_id, db)
            if case_row is None:
                await fail_job(job_id, f"Case {case_id} not found")
                return

            description = case_row.description
            adv = case_row.advanced_fields or {}
            client_legal_area = adv.get("legal_area")
            client_jurisdiction = adv.get("jurisdiction")
            client_urgency = case_row.urgency or "medium"
            evasive_defendant = adv.get("evasive_defendant", False)

            budget_goals = None
            if case_row.budget_goals:
                from models.schemas import BudgetGoals
                budget_goals = BudgetGoals(**case_row.budget_goals)

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

            try:
                analysis = await analyze_case(
                    description=description,
                    client_legal_area=client_legal_area,
                    client_jurisdiction=client_jurisdiction,
                    client_urgency=client_urgency,
                )
            except (RuntimeError, ValueError) as exc:
                await fail_job(job_id, f"Gemini analysis failed: {exc}")
                return

            # Stage: searching
            await update_job_stage(job_id, "searching")

            corporate_hq_state: Optional[str] = None
            try:
                from services.opencorporates_client import detect_corporate_defendants, lookup_corporation
                scan_text = analysis.fact_summary + " " + " ".join(analysis.key_issues)
                corp_names = (
                    detect_corporate_defendants(scan_text)
                    or detect_corporate_defendants(description[:2000])
                )
                if corp_names:
                    corp = await lookup_corporation(corp_names[0])
                    if corp and corp.hq_state:
                        corporate_hq_state = corp.hq_state
            except Exception as exc:
                warnings.append(f"Corporate lookup unavailable: {exc}")

            venue_recommendation = None
            try:
                venue_recommendation = await recommend_venue(
                    analysis, description, corporate_hq_state=corporate_hq_state
                )
            except Exception as exc:
                warnings.append(f"Venue recommendation unavailable: {exc}")

            # Stage: scoring
            await update_job_stage(job_id, "scoring")

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
                await fail_job(job_id, f"Matching error: {exc}")
                return

            if not candidates:
                warnings.append("No attorneys matched the case profile.")

            # Stage: auditing
            await update_job_stage(job_id, "auditing")

            audit = None
            if candidates:
                try:
                    audit = await audit_matches(
                        case_description=description,
                        analysis=analysis,
                        candidates=candidates,
                        evasive_defendant=evasive_defendant,
                    )
                except Exception as exc:
                    warnings.append(f"Audit unavailable: {exc}")

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
                except Exception as exc:
                    warnings.append(f"Court verification unavailable: {exc}")

            elapsed_ms = int((time.monotonic() - start) * 1000)

            response = MatchResponse(
                case_id=case_id,
                gemini_analysis=analysis,
                matches=candidates,
                audit=audit,
                pipeline_duration_ms=elapsed_ms,
                warnings=warnings,
                venue_recommendation=venue_recommendation,
            )

            # Persist match result
            try:
                match_row = MatchResultRow(
                    case_id=case_id,
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

            # Email and lead creation (best-effort)
            try:
                from services.email import send_matches_ready, send_lead_to_attorney

                client_email = getattr(case_row, "client_email", None) or ""
                if client_email and candidates:
                    asyncio.create_task(send_matches_ready(
                        to_email=client_email,
                        case_id=case_id,
                        match_count=len(candidates),
                    ))

                # Only send leads for candidates with composite score >= 60
                qualified = [c for c in candidates if c.score_breakdown.composite >= LEAD_SCORE_THRESHOLD]

                practice_area = analysis.primary_legal_area
                jurisdiction = analysis.jurisdiction
                qualified_names = [c.attorney.name for c in qualified]
                score_by_name = {c.attorney.name: c.score_breakdown.composite for c in qualified}

                if qualified_names:
                    result_q = await db.execute(
                        select(AttorneyRegistered).where(
                            AttorneyRegistered.name.in_(qualified_names),
                            AttorneyRegistered.accepting_clients == "true",
                        )
                    )
                    registered = result_q.scalars().all()
                    for atty in registered:
                        existing_lead = await db.execute(
                            select(Lead).where(
                                Lead.case_id == case_id,
                                Lead.attorney_id == atty.id,
                            )
                        )
                        if existing_lead.scalar_one_or_none():
                            continue
                        lead = Lead(
                            case_id=case_id,
                            attorney_id=atty.id,
                            status="sent",
                            case_summary={
                                "practice_area": practice_area,
                                "urgency": client_urgency,
                                "jurisdiction": jurisdiction,
                                "match_score": round(score_by_name[atty.name], 1),
                            },
                        )
                        db.add(lead)
                        asyncio.create_task(send_lead_to_attorney(
                            attorney_email=atty.email,
                            attorney_name=atty.name,
                            practice_area=practice_area,
                            urgency=client_urgency,
                            jurisdiction=jurisdiction,
                        ))
                    if registered:
                        await db.commit()
            except Exception as exc:
                log.warning("email_lead_creation_failed", error=str(exc))

            await complete_job(job_id, response.model_dump(mode="json"))
            log.info("pipeline_complete", case_id=case_id, duration_ms=elapsed_ms)

        except Exception as exc:
            log.error("pipeline_unexpected_error", job_id=job_id, error=str(exc))
            await fail_job(job_id, str(exc))


@router.post(
    "/match",
    summary="Enqueue the full matching pipeline — returns job_id immediately",
    responses={
        404: {"model": ErrorResponse, "description": "Case not found"},
    },
)
@limiter.limit("5/minute")
async def run_match_pipeline(
    request: Request,
    body: MatchRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Enqueues the match pipeline as a background task.
    Returns { job_id } immediately. Poll GET /api/jobs/{job_id} for progress.
    """
    case_row = await get_case(body.case_id, db)
    if case_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {body.case_id} not found.",
        )

    job_id = await create_job(body.case_id)
    asyncio.create_task(_run_pipeline(job_id, body.case_id))

    log.info("match_job_enqueued", case_id=body.case_id, job_id=job_id)
    return {"job_id": job_id, "case_id": body.case_id, "stage": "queued"}
