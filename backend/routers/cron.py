"""
Cron jobs -- called by Render Cron or an external scheduler.
Protected by CRON_SECRET header to prevent public access.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case, Lead, MatchResult
from db.session import get_db
from services.email import send_match_followup

log = structlog.get_logger()

CRON_SECRET = os.getenv("CRON_SECRET", "")

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _verify_cron(x_cron_secret: str = Header(default="")) -> None:
    if CRON_SECRET and x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.post("/followup-emails")
async def send_followup_emails(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_cron),
) -> dict:
    """
    Send 7-day follow-up emails to clients whose case has matches
    but no accepted lead.

    Intended to be called once daily by a cron job.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=8)
    window_end = now - timedelta(days=7)

    # Cases created 7-8 days ago with a client_email
    result = await db.execute(
        select(Case).where(
            Case.client_email.isnot(None),
            Case.created_at >= window_start,
            Case.created_at < window_end,
        )
    )
    cases = result.scalars().all()

    sent = 0
    for case in cases:
        # Skip if any lead was accepted
        accepted = await db.execute(
            select(Lead).where(
                Lead.case_id == case.case_id,
                Lead.status == "accepted",
            )
        )
        if accepted.scalar_one_or_none():
            continue

        # Get match count from match_results
        match_row = await db.execute(
            select(MatchResult).where(MatchResult.case_id == case.case_id)
        )
        mr = match_row.scalar_one_or_none()
        if not mr or not mr.matches:
            continue
        match_count = len(mr.matches)

        asyncio.create_task(send_match_followup(
            to_email=case.client_email,
            case_id=case.case_id,
            match_count=match_count,
        ))
        sent += 1
        log.info("followup_email_queued", case_id=case.case_id, to=case.client_email)

    log.info("cron.followup_emails_done", sent=sent, window_start=str(window_start), window_end=str(window_end))
    return {"sent": sent}
