"""
Moneyball Leaderboard Engine.

Builds objective attorney rankings for CA and NY by combining:
  - CourtListener docket counts (case volume proxy)
  - Attorney hourly rates vs budget goals (budget adherence)
  - Historical win rates (real for static roster, neutral 0.5 for CL attorneys)

Caches results for 60 minutes to avoid repeated CL API calls.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from models.schemas import (
    AttorneyProfile, AttorneyStats, LeaderboardEntry, LeaderboardResponse,
    LeaderboardAuditResult,
)
from services.courtlistener_client import (
    SCOPED_COURTS, _headers, _filed_after, _search_dockets, _profiles_from_result,
)
from data.attorneys import get_all_attorneys

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Domain query map
# ---------------------------------------------------------------------------

_DOMAIN_QUERIES: dict[str, list[str]] = {
    "intellectual_property": [
        "copyright patent trademark digital asset 3D model",
        "trade secret IP infringement software code",
    ],
    "real_estate": [
        "commercial real estate lease deed foreclosure",
        "real property acquisition development easement",
    ],
    "corporate": [
        "corporate merger acquisition securities fraud disclosure",
    ],
    "employment": [
        "employment discrimination wrongful termination wage labor",
    ],
}

_DOMAIN_NOS: dict[str, list[str]] = {
    "intellectual_property": ["820", "830", "840"],
    "real_estate": ["290", "220", "240"],
    "corporate": ["850", "890", "190"],
    "employment": ["442", "710", "720"],
}

_JURISDICTION_COURTS: dict[str, list[str]] = {
    "CA":    ["cacd", "cand", "cal", "calctapp"],
    "NY":    ["nyed", "nysd", "ny"],
    "CA+NY": ["cacd", "cand", "cal", "calctapp", "nyed", "nysd", "ny"],
}

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, LeaderboardResponse]] = {}
_CACHE_TTL = 3600  # 60 minutes


def _cache_key(domain: str, jurisdiction: str) -> str:
    return f"{domain}:{jurisdiction}"


def _cache_get(domain: str, jurisdiction: str) -> Optional[LeaderboardResponse]:
    key = _cache_key(domain, jurisdiction)
    if key in _cache:
        ts, resp = _cache[key]
        if time.monotonic() - ts < _CACHE_TTL:
            logger.info("Leaderboard cache hit: %s", key)
            return resp
        del _cache[key]
    return None


def _cache_set(domain: str, jurisdiction: str, resp: LeaderboardResponse) -> None:
    _cache[_cache_key(domain, jurisdiction)] = (time.monotonic(), resp)


# ---------------------------------------------------------------------------
# Pool builder -- CourtListener multi-query
# ---------------------------------------------------------------------------

async def _build_cl_pool(
    domain: str,
    court_ids: list[str],
) -> list[tuple[AttorneyProfile, int]]:
    """
    Run multiple CL searches for the domain; count docket appearances per attorney.
    Returns list of (AttorneyProfile, docket_count) sorted by docket_count desc.
    """
    queries = _DOMAIN_QUERIES.get(domain, [domain])
    specs = [domain]

    try:
        hdrs = _headers()
    except RuntimeError:
        logger.warning("CourtListener token missing; skipping CL pool for leaderboard")
        return []

    # attorney_id -> (profile, set_of_docket_ids)
    seen_by_id: dict[str, tuple[AttorneyProfile, set[str]]] = {}

    async with httpx.AsyncClient(headers=hdrs, timeout=30.0) as client:
        for query in queries:
            try:
                results = await _search_dockets(client, query, court_ids, max_results=25)
            except Exception as exc:
                logger.warning("CL leaderboard search failed for %r: %s", query, exc)
                continue

            for result in results:
                docket_id = str(result.get("id") or result.get("docket_id") or "")
                profiles = _profiles_from_result(result, specs)
                for p in profiles:
                    if p.id not in seen_by_id:
                        seen_by_id[p.id] = (p, set())
                    seen_by_id[p.id][1].add(docket_id)

    return [
        (profile, len(docket_ids))
        for profile, docket_ids in seen_by_id.values()
    ]


# ---------------------------------------------------------------------------
# Efficacy scoring
# ---------------------------------------------------------------------------

def compute_efficacy_score(
    attorney: AttorneyProfile,
    docket_count: int,
    data_source: str,
    budget_ceiling: Optional[float] = None,
) -> tuple[float, str, dict]:
    """
    Compute the Objective Efficacy Score (0-100).

    Breakdown:
      Budget adherence  (0-40 pts): hourly_rate vs budget_ceiling
      Case volume       (0-30 pts): docket_count / 50, capped
      Win rate          (0-30 pts): real for static_roster; 15 neutral for CL

    Returns (score, label, breakdown_dict).
    """
    # --- Budget (40 pts max) ---
    if budget_ceiling and attorney.hourly_rate:
        ratio = attorney.hourly_rate / budget_ceiling
        if ratio <= 1.0:
            budget_pts = 40.0
        elif ratio <= 1.2:
            budget_pts = 24.0
        elif ratio <= 1.5:
            budget_pts = 8.0
        else:
            budget_pts = 0.0
    else:
        budget_pts = 20.0  # neutral 50%

    # --- Case volume (30 pts max) ---
    volume_pts = min(30.0, (docket_count / 50.0) * 30.0)

    # --- Win rate (30 pts max) ---
    if data_source == "static_roster":
        win_pts = round(attorney.win_rate * 30.0, 1)
        label = "Verified"
    else:
        win_pts = 15.0  # neutral -- CL has no outcome data
        label = "Data-Limited"

    score = round(min(100.0, budget_pts + volume_pts + win_pts), 1)
    breakdown = {
        "budget": round(budget_pts, 1),
        "volume": round(volume_pts, 1),
        "win_rate": round(win_pts, 1),
    }
    return score, label, breakdown


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_leaderboard(
    domain: str,
    jurisdiction: str,
    top_n: int = 10,
    include_audit: bool = True,
    budget_ceiling: Optional[float] = None,
) -> LeaderboardResponse:
    """
    Cache-aware leaderboard builder.

    1. Check in-memory cache (60-min TTL).
    2. Fetch CourtListener pool for domain+jurisdiction.
    3. Merge with static roster (static roster gets "Verified" label).
    4. Score all attorneys with compute_efficacy_score.
    5. Sort by efficacy_score desc, take top_n.
    6. Optionally run Claude Opus audit on top 5.
    7. Cache and return.
    """
    cached = _cache_get(domain, jurisdiction)
    if cached:
        return cached

    court_ids = _JURISDICTION_COURTS.get(jurisdiction, list(SCOPED_COURTS.keys()))

    # --- CourtListener pool ---
    cl_pool = await _build_cl_pool(domain, court_ids)
    cl_seen_names: set[str] = {p.name for p, _ in cl_pool}

    # --- Static roster ---
    static_attorneys = get_all_attorneys()
    static_pool: list[tuple[AttorneyProfile, int]] = [
        (a, 0) for a in static_attorneys  # docket_count=0 (no CL data)
        if a.name not in cl_seen_names     # avoid duplicates
    ]

    combined = cl_pool + static_pool

    # --- Score all ---
    entries: list[LeaderboardEntry] = []
    for attorney, docket_count in combined:
        src = "static_roster" if attorney.id.startswith("att-") else "courtlistener"
        score, label, breakdown = compute_efficacy_score(
            attorney, docket_count, src, budget_ceiling
        )
        stats = AttorneyStats(
            attorney_id=attorney.id,
            attorney_name=attorney.name,
            firm=attorney.firm,
            docket_count=docket_count,
            jurisdictions=attorney.jurisdictions,
            primary_specializations=attorney.specializations,
            data_source=src,
        )
        entries.append(LeaderboardEntry(
            rank=0,  # assigned after sort
            attorney=attorney,
            stats=stats,
            efficacy_score=score,
            score_label=label,
            score_breakdown=breakdown,
        ))

    # Sort and assign ranks
    entries.sort(key=lambda e: e.efficacy_score, reverse=True)
    entries = entries[:top_n]
    for i, entry in enumerate(entries):
        entry.rank = i + 1

    # --- Opus audit (optional, non-blocking) ---
    audit: Optional[LeaderboardAuditResult] = None
    if include_audit and entries:
        try:
            from services.claude_auditor import audit_leaderboard
            audit = await audit_leaderboard(domain, entries[:5])
        except Exception as exc:
            logger.warning("Leaderboard audit failed: %s", exc)

    resp = LeaderboardResponse(
        domain=domain,
        jurisdiction=jurisdiction,
        entries=entries,
        generated_at=datetime.now(timezone.utc).isoformat(),
        cache_ttl_minutes=_CACHE_TTL // 60,
        audit=audit,
    )

    _cache_set(domain, jurisdiction, resp)
    return resp
