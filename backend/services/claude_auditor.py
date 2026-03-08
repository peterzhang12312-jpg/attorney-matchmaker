"""
Claude Opus audit layer.

After the matcher produces its top-N candidates, this service sends
the full context (original case facts, Gemini analysis, and scored
candidates) to Claude Opus for independent validation.

Opus evaluates:
  - Whether each match is defensible given the facts
  - Confidence score per match (0-1 scale)
  - Flags for potential issues (jurisdiction gaps, practice-area
    mismatch, availability concerns, possible conflicts)
  - An overall quality assessment of the match set

This serves as a second-opinion check that catches reasoning errors
in the deterministic matcher or misclassifications from Gemini.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import anthropic

from models.schemas import (
    AuditedMatch,
    AuditResult,
    GeminiAnalysis,
    LeaderboardAuditResult,
    LeaderboardEntry,
    MatchCandidate,
)

logger = logging.getLogger(__name__)

AUDIT_MODEL = "claude-opus-4-6"


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a senior legal staffing auditor.  You are reviewing a set of
attorney-match recommendations produced by an automated system.

Your job is to independently assess each match and determine whether
the recommended attorney is a sound fit for the client's case.

For each match you must provide:
  1. confidence (float 0.0-1.0): your confidence that this is a good match
  2. flags (list of strings): any concerns -- jurisdiction gaps, practice-area
     mismatch, availability issues, experience level concerns, potential
     conflicts of interest, or anything else relevant
  3. reasoning (string): 1-3 sentences explaining your assessment

You must also provide:
  4. overall_assessment (string): a 2-4 sentence summary of the match set
     quality, noting any systemic issues (e.g., all candidates lack state
     court admission when the case is in state court)

Respond with ONLY valid JSON matching this schema:
{
  "audited_matches": [
    {
      "attorney_id": "<string>",
      "attorney_name": "<string>",
      "original_score": <float>,
      "confidence": <float 0.0-1.0>,
      "flags": ["<string>", ...],
      "reasoning": "<string>"
    }
  ],
  "overall_assessment": "<string>"
}
"""


def _build_audit_payload(
    case_description: str,
    analysis: GeminiAnalysis,
    candidates: list[MatchCandidate],
) -> str:
    """
    Build the user-turn content with all context the auditor needs.
    """
    candidates_data = []
    for c in candidates:
        candidates_data.append({
            "attorney_id": c.attorney.id,
            "attorney_name": c.attorney.name,
            "firm": c.attorney.firm,
            "specializations": c.attorney.specializations,
            "jurisdictions": c.attorney.jurisdictions,
            "years_experience": c.attorney.years_experience,
            "win_rate": c.attorney.win_rate,
            "availability": c.attorney.availability.value,
            "notable_cases": c.attorney.notable_cases,
            "composite_score": c.score_breakdown.composite,
            "score_breakdown": {
                "specialization": c.score_breakdown.specialization_score,
                "jurisdiction": c.score_breakdown.jurisdiction_score,
                "experience": c.score_breakdown.experience_score,
                "availability": c.score_breakdown.availability_score,
                "win_rate": c.score_breakdown.win_rate_score,
            },
            "match_rationale": c.match_rationale,
        })

    payload = {
        "case_description": case_description,
        "gemini_analysis": {
            "primary_legal_area": analysis.primary_legal_area,
            "secondary_areas": analysis.secondary_areas,
            "jurisdiction": analysis.jurisdiction,
            "urgency_level": analysis.urgency_level,
            "key_issues": analysis.key_issues,
            "fact_summary": analysis.fact_summary,
        },
        "candidates": candidates_data,
    }

    return json.dumps(payload, indent=2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def audit_matches(
    case_description: str,
    analysis: GeminiAnalysis,
    candidates: list[MatchCandidate],
    evasive_defendant: bool = False,
) -> AuditResult:
    """
    Send the match set to Claude Opus for independent validation.

    Raises
    ------
    RuntimeError
        If the Anthropic API key is missing or the API call fails.
    ValueError
        If the Opus response cannot be parsed into the AuditResult schema.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Cannot perform audit."
        )

    client = anthropic.AsyncAnthropic(api_key=api_key, timeout=60.0)

    user_content = _build_audit_payload(case_description, analysis, candidates)

    if evasive_defendant:
        priority_directive = (
            "PRIORITY DIRECTIVE: This case involves an evasive defendant whose location "
            "is unknown or who is actively evading service of process. Give a CONFIDENCE "
            "BOOST to any attorney with documented experience winning motions for alternative "
            "service (substituted service, service by publication, ex parte motion for "
            "alternative service) in the target jurisdiction. Flag attorneys who lack "
            "this experience.\n\n"
        )
        user_content = priority_directive + user_content
        logger.info("Evasive defendant mode: prepended priority directive to audit prompt")

    logger.info(
        "Sending %d candidates to Claude Opus for audit (payload: %d chars)",
        len(candidates),
        len(user_content),
    )

    try:
        response = await client.messages.create(
            model=AUDIT_MODEL,
            max_tokens=4096,
            temperature=0.3,  # slightly creative for nuanced assessment
            system=_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_content},
            ],
        )
    except (anthropic.APIError, anthropic.APIStatusError) as exc:
        logger.error("Anthropic API error during audit: %s", exc)
        raise RuntimeError(f"Claude Opus audit API error: {exc}") from exc

    # Extract text from the response
    raw_text = ""
    for block in response.content:
        if block.type == "text":
            raw_text += block.text

    raw_text = raw_text.strip()
    logger.debug("Opus raw audit response: %s", raw_text[:500])

    parsed = _extract_json(raw_text)
    if parsed is None:
        raise ValueError(
            f"Claude Opus returned unparseable audit output. "
            f"First 300 chars: {raw_text[:300]}"
        )

    # Validate and build the AuditResult
    try:
        audited_matches = [
            AuditedMatch(**match_data)
            for match_data in parsed.get("audited_matches", [])
        ]
        result = AuditResult(
            audited_matches=audited_matches,
            overall_assessment=parsed.get("overall_assessment", "No assessment provided."),
            audit_model=AUDIT_MODEL,
        )
    except Exception as exc:
        logger.error("Schema validation failed for audit output: %s", exc)
        raise ValueError(f"Audit output failed schema validation: {exc}") from exc

    logger.info(
        "Audit complete: %d matches audited, model=%s",
        len(result.audited_matches),
        AUDIT_MODEL,
    )
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict[str, Any] | None:
    """Parse JSON from Opus output, tolerating markdown fences."""
    cleaned = text
    if cleaned.startswith("```"):
        first_newline = cleaned.index("\n") if "\n" in cleaned else 3
        cleaned = cleaned[first_newline + 1:]
    if cleaned.rstrip().endswith("```"):
        cleaned = cleaned.rstrip()[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Bracket extraction fallback
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# Leaderboard audit
# ---------------------------------------------------------------------------

_LEADERBOARD_AUDIT_SYSTEM = """\
You are the Chief Legal Analytics Auditor for a top-tier corporate law firm.
You are reviewing an objective attorney ranking generated by an automated scoring system.

Your task: Audit the top 5 ranked attorneys in this leaderboard for a given practice domain.
Check for:
1. Score anomalies -- Are "Data-Limited" attorneys ranked higher than "Verified" attorneys with similar credentials?
2. Specialization fit -- Does each attorney's specialization actually match the domain being ranked?
3. Outliers -- Any attorney with an unusually high or low score that seems inconsistent with their profile?

Identify the single best attorney from this list for the domain based on the full profile.

Output ONLY this JSON (no markdown):
{
  "top_pick": "<attorney name>",
  "flags": ["<flag 1>", "<flag 2>"],
  "overall_assessment": "<2-3 sentence summary>"
}
"""


async def audit_leaderboard(
    domain: str,
    entries: list["LeaderboardEntry"],
) -> "LeaderboardAuditResult":
    """
    Claude Opus reviews the top leaderboard entries for a domain.
    Returns LeaderboardAuditResult. Raises RuntimeError if ANTHROPIC_API_KEY is not set.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    payload = {
        "domain": domain,
        "entries": [
            {
                "rank": e.rank,
                "name": e.attorney.name,
                "firm": e.attorney.firm,
                "specializations": e.attorney.specializations,
                "jurisdictions": e.attorney.jurisdictions,
                "years_experience": e.attorney.years_experience,
                "win_rate": e.attorney.win_rate,
                "hourly_rate": e.attorney.hourly_rate,
                "efficacy_score": e.efficacy_score,
                "score_label": e.score_label,
                "score_breakdown": e.score_breakdown,
                "docket_count": e.stats.docket_count,
            }
            for e in entries
        ],
    }

    import anthropic as _anthropic
    client = _anthropic.AsyncAnthropic(api_key=api_key, timeout=60.0)
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        temperature=0.2,
        system=_LEADERBOARD_AUDIT_SYSTEM,
        messages=[{"role": "user", "content": json.dumps(payload, indent=2)}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    data = json.loads(raw)
    return LeaderboardAuditResult(
        top_pick=data.get("top_pick", entries[0].attorney.name if entries else ""),
        flags=data.get("flags", []),
        overall_assessment=data.get("overall_assessment", ""),
        audit_model="claude-opus-4-6",
    )
