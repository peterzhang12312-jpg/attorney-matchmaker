"""
Gemini text embedding service.

Uses models/text-embedding-004 (768-dim).
Falls back silently when GEMINI_API_KEY is not set.
"""
from __future__ import annotations

import math
import os
from typing import Optional

import structlog

log = structlog.get_logger()

_client = None


def _get_client():
    global _client
    if _client is None:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return None
        _client = genai.Client(api_key=api_key)
    return _client


async def generate_embedding(text: str) -> Optional[list[float]]:
    """
    Generate a 768-dim embedding for the given text using Gemini.
    Returns None if the API key is not set or on any error.
    """
    client = _get_client()
    if not client or not text.strip():
        return None
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: client.models.embed_content(
                model="models/text-embedding-004",
                contents=text.strip()[:8000],  # token limit guard
            )
        )
        # result.embeddings is a list of ContentEmbedding objects
        if result.embeddings:
            return result.embeddings[0].values
        return None
    except Exception as exc:
        log.warning("embedding.failed", error=str(exc))
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors. Returns 0.0 on any error."""
    try:
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x * x for x in a))
        mag_b = math.sqrt(sum(y * y for y in b))
        if mag_a == 0.0 or mag_b == 0.0:
            return 0.0
        return dot / (mag_a * mag_b)
    except Exception:
        return 0.0


def attorney_profile_text(name: str, firm: Optional[str], practice_areas: Optional[list],
                           jurisdictions: Optional[list]) -> str:
    """Build a plain-text profile summary for embedding."""
    parts = [f"Attorney: {name}"]
    if firm:
        parts.append(f"Firm: {firm}")
    if practice_areas:
        parts.append(f"Practice areas: {', '.join(practice_areas)}")
    if jurisdictions:
        parts.append(f"Jurisdictions: {', '.join(jurisdictions)}")
    return "\n".join(parts)
