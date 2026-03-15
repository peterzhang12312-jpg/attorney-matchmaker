"""Coverage stats and demand-signal endpoints."""
from __future__ import annotations

from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from data.federal_courts import FEDERAL_COURTS
from db.models import AttorneyRegistered, CoverageRequest
from db.session import get_db
from middleware.rate_limit import limiter

log = structlog.get_logger()
router = APIRouter(prefix="/api/coverage", tags=["Coverage"])


@router.get("/stats")
async def coverage_stats(db: AsyncSession = Depends(get_db)) -> dict:
    """Returns attorney count per US state for the density map."""
    result = await db.execute(
        select(AttorneyRegistered.jurisdictions, AttorneyRegistered.id)
        .where(AttorneyRegistered.accepting_clients == "true")
    )
    rows = result.all()

    state_counts: dict[str, int] = {}
    for jurs_list, _ in rows:
        if not jurs_list:
            continue
        for jur in jurs_list:
            jur_upper = jur.upper().strip()
            if len(jur_upper) == 2:
                state_counts[jur_upper] = state_counts.get(jur_upper, 0) + 1

    # Build state metadata from federal_courts
    state_meta: dict[str, dict] = {}
    for court_id, info in FEDERAL_COURTS.items():
        state = info["state"]
        if state not in state_meta:
            state_meta[state] = {
                "count": state_counts.get(state, 0),
                "coverage": info["coverage"],
                "primary_court": court_id,
                "primary_court_label": info["label"],
            }

    return {"states": state_meta, "total_attorneys": sum(state_counts.values())}


class CoverageRequestBody(BaseModel):
    state: str
    email: Optional[str] = None


@router.post("/request")
@limiter.limit("5/minute")
async def request_coverage(
    request: Request,
    body: CoverageRequestBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Log a demand signal for attorney coverage in a state."""
    row = CoverageRequest(state=body.state.upper()[:2], email=body.email)
    db.add(row)
    await db.commit()
    log.info("coverage_requested", state=body.state)
    return {"received": True, "state": body.state.upper()[:2]}
