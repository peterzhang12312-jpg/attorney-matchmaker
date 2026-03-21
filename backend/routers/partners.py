"""
Partner registration -- generates embed codes for the intake widget.
All routes prefixed with /api/partners.
"""
from __future__ import annotations

import uuid
import structlog
from fastapi import APIRouter, Request
from pydantic import BaseModel

log = structlog.get_logger()
router = APIRouter(prefix="/api/partners", tags=["partners"])


class PartnerRegisterRequest(BaseModel):
    name: str
    website: str | None = None


class PartnerRegisterResponse(BaseModel):
    partner_id: str
    embed_code: str


@router.post("/register", response_model=PartnerRegisterResponse)
async def register_partner(body: PartnerRegisterRequest, request: Request):
    """Generate a partner ID and embed snippet for the intake widget."""
    partner_id = str(uuid.uuid4())[:8]
    base_url = str(request.base_url).rstrip("/")

    embed_code = (
        f'<script src="{base_url}/widget.js" '
        f'data-partner-id="{partner_id}"></script>'
    )

    log.info("partner_registered", partner_id=partner_id, name=body.name, website=body.website)

    return PartnerRegisterResponse(partner_id=partner_id, embed_code=embed_code)
