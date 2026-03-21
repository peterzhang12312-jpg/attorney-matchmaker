"""
Attorney waitlist — captures interest from attorneys before full onboarding.
All routes prefixed with /api/waitlist.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel

log = structlog.get_logger()
router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


class WaitlistRequest(BaseModel):
    name: str
    email: str
    practice_area: str | None = None
    city: str | None = None


class WaitlistResponse(BaseModel):
    status: str
    message: str


@router.post("/attorney", response_model=WaitlistResponse)
async def join_attorney_waitlist(body: WaitlistRequest):
    """
    Log attorney waitlist interest. Just logs for now — no DB table needed
    at this volume. Replace with DB insert when demand justifies it.
    """
    log.info(
        "attorney_waitlist_signup",
        name=body.name,
        email=body.email,
        practice_area=body.practice_area,
        city=body.city,
    )
    return WaitlistResponse(
        status="ok",
        message="You're on the list. We'll reach out when we have leads in your area.",
    )
