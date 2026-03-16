"""
Case timeline generation via Gemini.
POST /api/timeline -- returns a structured litigation timeline for a given case.
"""
from __future__ import annotations

import asyncio
import json
import os

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.queries import get_case
from db.session import get_db
from middleware.rate_limit import limiter
from models.schemas import LitigationTimeline


class TimelineRequest(BaseModel):
    case_id: str

log = structlog.get_logger()

router = APIRouter(prefix="/api", tags=["timeline"])

_TIMELINE_PROMPT = """\
You are a litigation timeline advisor. Given a case summary, generate a realistic
litigation timeline broken into phases.

Return ONLY valid JSON matching this exact schema -- no markdown, no commentary:
{{
  "practice_area": "<string>",
  "jurisdiction": "<string>",
  "total_estimated_duration": "<string, e.g. '12-18 months'>",
  "phases": [
    {{
      "phase": "<phase name>",
      "duration": "<e.g. '2-4 weeks'>",
      "description": "<1-2 sentence description>",
      "key_actions": ["<action 1>", "<action 2>", "<action 3>"]
    }}
  ],
  "important_notes": ["<deadline or warning>", ...]
}}

Case details:
Practice area: {practice_area}
Jurisdiction: {jurisdiction}
Key legal issues: {key_issues}
Urgency: {urgency}
Case summary: {fact_summary}

Generate 4-6 phases covering the full lifecycle from pre-filing through resolution.
Include realistic durations. Flag any statute of limitations concerns in important_notes.
"""


@router.post("/timeline", response_model=LitigationTimeline)
@limiter.limit("10/minute")
async def generate_timeline(
    request: Request,
    body: TimelineRequest,
    db: AsyncSession = Depends(get_db),
) -> LitigationTimeline:
    """Generate a litigation timeline for a case."""
    case_id = body.case_id
    if not case_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="case_id required",
        )

    case_row = await get_case(case_id, db)
    if not case_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Let Gemini derive practice area and jurisdiction from the case text
    fact_summary = case_row.description[:2000]
    urgency = case_row.urgency or "medium"

    prompt = _TIMELINE_PROMPT.format(
        practice_area="(determine from case description)",
        jurisdiction="(determine from case description)",
        key_issues="(determine from case description)",
        urgency=urgency,
        fact_summary=fact_summary,
    )

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured",
        )

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        loop = asyncio.get_running_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                ),
            ),
            timeout=30.0,
        )
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            parts = raw.split("```", 2)
            if len(parts) >= 2:
                raw = parts[1]
                if raw.lower().startswith("json"):
                    raw = raw[4:]
        raw = raw.strip()
        data = json.loads(raw)
        timeline = LitigationTimeline(**data)
        log.info("timeline.generated", case_id=case_id, phases=len(timeline.phases))
        return timeline
    except asyncio.TimeoutError:
        log.error("timeline.generation_timeout", case_id=case_id)
        raise HTTPException(
            status_code=504,
            detail="Timeline generation timed out",
        )
    except json.JSONDecodeError as exc:
        log.error("timeline.json_parse_error", case_id=case_id, error=str(exc))
        raise HTTPException(
            status_code=500,
            detail="Timeline generation failed -- invalid AI response",
        )
    except Exception as exc:
        log.error("timeline.generation_error", case_id=case_id, error=str(exc))
        raise HTTPException(
            status_code=500,
            detail="Timeline generation failed",
        )
