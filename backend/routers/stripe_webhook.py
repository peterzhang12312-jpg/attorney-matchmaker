"""
POST /api/stripe/webhook -- handles Stripe payment events.

payment_intent.succeeded: marks the lead as revealed (backup to the
confirm-reveal endpoint -- handles cases where the client-side call fails).
"""
from __future__ import annotations

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case, Lead
from db.session import get_db
from services.billing import verify_webhook_signature

log = structlog.get_logger()
router = APIRouter(prefix="/api/stripe", tags=["Stripe"])


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    event = verify_webhook_signature(payload, sig)
    if event is None:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type", "")
    log.info("stripe_webhook", event_type=event_type)

    if event_type == "payment_intent.succeeded":
        pi = event["data"]["object"]
        metadata = pi.get("metadata", {})
        lead_id = metadata.get("lead_id")

        if lead_id:
            result = await db.execute(
                select(Lead, Case).join(Case, Lead.case_id == Case.case_id).where(
                    Lead.id == lead_id
                )
            )
            row = result.first()
            if row and not row[0].revealed_at:
                lead, case = row
                contact = {"email": case.client_email}
                await db.execute(
                    update(Lead)
                    .where(Lead.id == lead_id)
                    .values(
                        status="revealed",
                        revealed_at=datetime.now(timezone.utc),
                        client_contact=contact,
                    )
                )
                await db.commit()
                log.info("lead_revealed_via_webhook", lead_id=lead_id)

    return {"received": True}
