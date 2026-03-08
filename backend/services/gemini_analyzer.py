"""
Gemini-powered fact-pattern analyzer.

Sends the raw case description to Google Gemini and receives a structured
extraction of legal issues, practice areas, jurisdiction, and urgency.

Uses the current google-genai SDK (google.genai) -- NOT the deprecated
google.generativeai package.

The prompt is engineered to return *only* valid JSON matching the
GeminiAnalysis schema so downstream code never has to parse prose.
"""

from __future__ import annotations

import asyncio
import functools
import json
import logging
import os
from typing import Any

from google import genai
from google.genai import types

from models.schemas import CourtListenerKeywords, GeminiAnalysis

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTION = """\
You are a legal fact-pattern analysis engine.  Your sole job is to read a
client's case description and produce a structured JSON extraction.

You MUST respond with valid JSON and nothing else -- no markdown fences,
no commentary, no preamble.

Output schema (every field is required unless marked optional):
{
  "primary_legal_area": "<one of: intellectual_property, employment, personal_injury, corporate, family, criminal_defense, real_estate, immigration, bankruptcy, environmental, healthcare, securities, tax, civil_rights, general_litigation>",
  "secondary_areas": ["<zero or more from the same list>"],
  "jurisdiction": "<inferred jurisdiction abbreviation, e.g. 'CA', 'S.D.N.Y.', 'N.D. Ill.'>",
  "urgency_level": "<one of: low, medium, high, critical>",
  "key_issues": ["<discrete legal issues identified>"],
  "fact_summary": "<2-4 sentence neutral summary of the facts>",
  "inferred_defendant_location": "<state or 'City, ST' if clearly stated in facts, else null>",
  "inferred_plaintiff_location": "<state or 'City, ST' if clearly stated in facts, else null>",
  "defendant_location_unknown": <true if facts contain NO indication of defendant location, false otherwise>
}

Rules:
- Infer jurisdiction from geographic references in the facts.  If the client
  explicitly provided one, prefer that.
- Urgency should reflect both the client's stated urgency AND any implicit
  time pressure (pending SOL, TRO needed, regulatory deadline, etc.).
- key_issues should be specific (e.g. "potential Section 101 patent
  eligibility challenge") not generic ("patent issue").
- If the facts span multiple practice areas, pick the dominant one as
  primary and list the rest in secondary_areas.
- For inferred_defendant_location: extract state of incorporation, principal
  place of business, or last known address if present in the facts. Set null
  if not clearly inferable.
- Set defendant_location_unknown=true only when there is genuinely NO
  geographic information about the defendant in the facts.
"""


def _build_user_prompt(
    description: str,
    client_legal_area: str | None,
    client_jurisdiction: str | None,
    client_urgency: str,
) -> str:
    """Assemble the user-turn prompt with all client-supplied context."""
    parts = [f"## Case Description\n{description}"]
    if client_legal_area:
        parts.append(f"\n## Client-Indicated Legal Area\n{client_legal_area}")
    if client_jurisdiction:
        parts.append(f"\n## Client-Indicated Jurisdiction\n{client_jurisdiction}")
    parts.append(f"\n## Client-Reported Urgency\n{client_urgency}")
    parts.append(
        "\nAnalyze the above and respond with the JSON extraction described "
        "in your instructions."
    )
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def analyze_case(
    description: str,
    client_legal_area: str | None = None,
    client_jurisdiction: str | None = None,
    client_urgency: str = "medium",
) -> GeminiAnalysis:
    """
    Send case facts to Gemini and return a validated GeminiAnalysis.

    Raises
    ------
    ValueError
        If the Gemini response cannot be parsed into valid JSON.
    RuntimeError
        If the Gemini API call itself fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Cannot perform fact-pattern analysis."
        )

    client = genai.Client(api_key=api_key)

    user_prompt = _build_user_prompt(
        description, client_legal_area, client_jurisdiction, client_urgency
    )

    logger.info("Sending case facts to Gemini for analysis (%d chars)", len(description))

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                functools.partial(
                    client.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=_SYSTEM_INSTRUCTION,
                        temperature=0.2,
                        top_p=0.95,
                        max_output_tokens=2048,
                        response_mime_type="application/json",
                    ),
                )
            ),
            timeout=30.0,
        )
    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc)
        raise RuntimeError(f"Gemini API error: {exc}") from exc

    # --- Parse the response ------------------------------------------------
    raw_text = response.text.strip()
    logger.debug("Gemini raw response: %s", raw_text[:500])

    parsed = _extract_json(raw_text)
    if parsed is None:
        raise ValueError(
            f"Gemini returned unparseable output. First 300 chars: {raw_text[:300]}"
        )

    # Validate against Pydantic schema — new optional fields default gracefully
    try:
        analysis = GeminiAnalysis(
            raw_model=GEMINI_MODEL,
            inferred_defendant_location=parsed.get("inferred_defendant_location"),
            inferred_plaintiff_location=parsed.get("inferred_plaintiff_location"),
            defendant_location_unknown=bool(parsed.get("defendant_location_unknown", False)),
            **{k: v for k, v in parsed.items() if k not in (
                "inferred_defendant_location",
                "inferred_plaintiff_location",
                "defendant_location_unknown",
            )},
        )
    except Exception as exc:
        logger.error("Schema validation failed for Gemini output: %s", exc)
        raise ValueError(f"Gemini output failed schema validation: {exc}") from exc

    logger.info(
        "Gemini analysis complete: primary_area=%s, jurisdiction=%s, issues=%d",
        analysis.primary_legal_area,
        analysis.jurisdiction,
        len(analysis.key_issues),
    )
    return analysis


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict[str, Any] | None:
    """
    Attempt to parse JSON from Gemini output, handling common wrapping
    artifacts (markdown code fences, leading/trailing whitespace).
    """
    # Strip markdown code fences if present
    cleaned = text
    if cleaned.startswith("```"):
        # Remove opening fence (possibly ```json)
        first_newline = cleaned.index("\n") if "\n" in cleaned else 3
        cleaned = cleaned[first_newline + 1:]
    if cleaned.rstrip().endswith("```"):
        cleaned = cleaned.rstrip()[:-3]

    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Primary JSON parse failed, attempting bracket extraction")

    # Last resort: find the first { ... } block
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# CourtListener keyword extraction
# ---------------------------------------------------------------------------

_KW_SYSTEM = """\
You are a legal search query optimizer for CourtListener (a U.S. federal
court database).  Given case facts and an existing legal analysis, produce
a compact JSON object with three fields that will drive a CourtListener
full-text search.

Output schema (required, no other text):
{
  "search_query": "<5-15 domain-specific keywords, NOT generic legal terms>",
  "nature_of_suit_codes": ["<0-3 PACER NOS codes as strings>"],
  "target_court_ids": ["<1-4 court IDs from the allowed list>"]
}

Allowed court IDs (California and New York):
  cacd      C.D. Cal.  (Los Angeles — federal)
  cand      N.D. Cal.  (San Francisco / Bay Area — federal)
  cal       California Supreme Court
  calctapp  California Court of Appeal
  nyed      E.D.N.Y.   (Brooklyn — federal)
  nysd      S.D.N.Y.   (Manhattan — federal)
  ny        New York Court of Appeals (state)

PACER Nature of Suit codes (pick the most likely 1-3):
  820 Copyright   830 Patent   840 Trademark
  290 All Other Real Property   220 Foreclosure   240 Torts to Land
  190 Other Contract   890 Other Statutory Actions

Rules for search_query:
- Use specific domain vocabulary from the facts:
    "3D Asset" cases  → "3D model digital asset CGI computer graphics"
    "Real Estate"     → "real property commercial lease deed escrow"
    IP / Copyright    → "copyright infringement reproduction derivative work"
- Avoid generic terms like "breach", "damages", "plaintiff", "court".

Rules for target_court_ids:
- Default to ["cacd", "cand"] for federal IP / copyright / patent matters.
- Add "cal" or "calctapp" for California state-law claims.
- Use nyed/nysd for NY federal IP/commercial cases; use ny for NY state law claims.
- Use all four only if the case spans both state and federal issues.
"""

_FACT_REFINEMENT_SYSTEM = """\
You are a Senior Litigation Partner at a top-tier corporate law firm, advising an internal Legal Director.
Your objective is to analyze a newly submitted fact pattern for high-stakes litigation (typically involving commercial real estate, digital/3D assets, or IP) and identify critical missing details needed to select the perfect outside counsel.

Analyze the provided facts and return a JSON object containing exactly 2 to 3 highly targeted, probing questions.
Focus your questions on extracting:
1. Procedural posture (e.g., pre-litigation, demand letter received, complaint filed, discovery phase).
2. Jurisdictional and venue triggers (e.g., specific choice of law clauses, CA vs. NY venue viability, state vs. federal strategic advantages).
3. Financial exposure and remedies (e.g., preliminary injunctions sought, specific performance, damages quantification).

IMPORTANT: Always include one question that specifically asks about the defendant's location (state of incorporation or last known address) when it cannot be clearly inferred from the facts, so we can assess personal jurisdiction and determine the appropriate court.

Tone: Direct, analytical, and strictly professional. No pleasantries, no fluff. Do not give legal advice; you are strictly gathering intelligence for attorney routing.

Output Schema:
{
  "questions": [
    "<High-level strategic question 1>",
    "<High-level strategic question 2>"
  ]
}
"""


async def extract_search_keywords(
    description: str,
    analysis: GeminiAnalysis,
) -> CourtListenerKeywords:
    """
    Ask Gemini to produce optimised CourtListener search parameters from
    the case description and existing analysis.

    Falls back to safe defaults if Gemini is unavailable or returns bad JSON.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return _default_keywords(analysis)

    client = genai.Client(api_key=api_key)

    user_prompt = (
        f"## Case Description\n{description}\n\n"
        f"## Existing Legal Analysis\n"
        f"Primary area: {analysis.primary_legal_area}\n"
        f"Secondary areas: {', '.join(analysis.secondary_areas)}\n"
        f"Jurisdiction: {analysis.jurisdiction}\n"
        f"Key issues: {'; '.join(analysis.key_issues)}\n\n"
        "Generate the CourtListener search parameters."
    )

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                functools.partial(
                    client.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=_KW_SYSTEM,
                        temperature=0.1,
                        max_output_tokens=512,
                        response_mime_type="application/json",
                    ),
                )
            ),
            timeout=30.0,
        )
        raw = response.text.strip()
        parsed = _extract_json(raw)
        if parsed:
            return CourtListenerKeywords(
                search_query=parsed.get("search_query", analysis.primary_legal_area),
                nature_of_suit_codes=parsed.get("nature_of_suit_codes", []),
                target_court_ids=parsed.get("target_court_ids", ["cacd", "cand"]),
            )
    except Exception as exc:
        logger.warning("Keyword extraction failed, using defaults: %s", exc)

    return _default_keywords(analysis)


def _default_keywords(analysis: GeminiAnalysis) -> CourtListenerKeywords:
    """Safe fallback when Gemini keyword extraction is unavailable or fails."""
    _area_to_nos: dict[str, list[str]] = {
        "intellectual_property": ["820", "830", "840"],
        "real_estate":           ["290", "220"],
        "copyright":             ["820"],
        "patent":                ["830"],
        "trademark":             ["840"],
    }
    nos = _area_to_nos.get(analysis.primary_legal_area, [])
    query_terms = [analysis.primary_legal_area.replace("_", " ")]
    query_terms += [i.split()[0] for i in analysis.key_issues[:3] if i]
    return CourtListenerKeywords(
        search_query=" ".join(query_terms),
        nature_of_suit_codes=nos,
        target_court_ids=["cacd", "cand"],
    )


# ---------------------------------------------------------------------------
# Fact refinement
# ---------------------------------------------------------------------------

async def refine_facts(facts: str) -> list[str]:
    """
    Stateless endpoint helper: analyze raw case facts and return 2-3 probing follow-up questions.

    Uses _FACT_REFINEMENT_SYSTEM prompt.  Never raises -- returns [] on any failure.
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            logger.warning("GEMINI_API_KEY not set; skipping fact refinement")
            return []

        client = genai.Client(api_key=api_key)
        response = await asyncio.wait_for(
            asyncio.to_thread(
                functools.partial(
                    client.models.generate_content,
                    model="gemini-2.5-flash",
                    contents=facts,
                    config=types.GenerateContentConfig(
                        system_instruction=_FACT_REFINEMENT_SYSTEM,
                        temperature=0.3,
                        max_output_tokens=1024,
                        response_mime_type="application/json",
                    ),
                )
            ),
            timeout=30.0,
        )
        raw = response.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        questions = data.get("questions", [])
        if isinstance(questions, list):
            return [str(q) for q in questions if q]
        return []
    except Exception as exc:
        logger.warning("refine_facts failed: %s", exc)
        return []
