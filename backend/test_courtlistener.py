#!/usr/bin/env python3
"""
CourtListener API diagnostic.
Run from inside the backend/ directory:
    python test_courtlistener.py
"""
from __future__ import annotations

import asyncio
import os
import sys

# Load .env before any service imports
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

import httpx

from services.courtlistener_client import (
    _BASE, _headers, _filed_after,
    SCOPED_COURTS, _search_dockets, _profiles_from_result,
    fetch_attorneys_by_keywords,
)


def _sep(title: str) -> None:
    print(f"\n{'-' * 60}")
    print(f"  {title}")
    print('-' * 60)


# ---------------------------------------------------------------------------
# Individual tests
# ---------------------------------------------------------------------------

async def test_auth() -> bool:
    _sep("1. Authentication (GET /api/rest/v4/)")
    try:
        hdrs = _headers()
    except RuntimeError as exc:
        print(f"[FAIL] {exc}")
        return False

    async with httpx.AsyncClient(headers=hdrs, timeout=10.0) as client:
        resp = await client.get(f"{_BASE}/")
        if resp.status_code == 200:
            endpoints = list(resp.json().keys())
            print(f"[OK]  HTTP {resp.status_code} — {len(endpoints)} endpoints available")
            print(f"      Sample: {', '.join(endpoints[:6])}")
            return True
        print(f"[FAIL] HTTP {resp.status_code}: {resp.text[:200]}")
        return False


async def test_search(label: str, query: str, courts: list[str]) -> list[dict]:
    _sep(f"2. Search — {label}")
    print(f"      query   : {query!r}")
    print(f"      courts  : {courts}")
    print(f"      after   : {_filed_after()}")

    try:
        hdrs = _headers()
    except RuntimeError:
        return []

    async with httpx.AsyncClient(headers=hdrs, timeout=20.0) as client:
        try:
            results = await _search_dockets(client, query, courts, max_results=5)
        except Exception as exc:
            print(f"[FAIL] {exc}")
            return []

    if not results:
        print("[WARN] 0 dockets returned — query may be too specific or courts have no RECAP data")
        return []

    print(f"[OK]  {len(results)} docket(s) returned")
    for r in results[:3]:
        did   = r.get("id") or r.get("docket_id", "?")
        name  = r.get("caseName") or r.get("case_name", "—")
        court = r.get("court_id") or r.get("court", "—")
        filed = r.get("dateFiled") or r.get("date_filed", "—")
        print(f"      [{did}] {name!r}  court={court}  filed={filed}")

    return results


async def test_inline_extraction(results: list[dict]) -> list:
    _sep("3. Inline attorney extraction from search results")
    if not results:
        print("[SKIP] No search results to extract from")
        return []

    all_profiles = []
    for result in results[:3]:
        profiles = _profiles_from_result(result, ["intellectual_property", "real_estate"])
        case = result.get("caseName") or result.get("case_name", "?")
        court = result.get("court_id") or "?"
        print(f"\n  [{court}] {case!r}  -> {len(profiles)} attorney(s)")
        for p in profiles[:4]:
            print(f"      {p.name!r}  @  {p.firm}")
        if len(profiles) > 4:
            print(f"      ... and {len(profiles) - 4} more")
        all_profiles.extend(profiles)

    print(f"\n[OK]  {len(all_profiles)} total profiles extracted (before global dedup)")
    return all_profiles


async def test_pipeline() -> None:
    _sep("4. Full pipeline — fetch_attorneys_by_keywords()")
    print("      Simulating a '3D Asset / Real Estate' case in CA federal courts")

    profiles = await fetch_attorneys_by_keywords(
        search_query="copyright 3D model digital asset real property",
        nature_of_suit_codes=["820", "290"],
        court_ids=["cacd", "cand"],
        inferred_specializations=["intellectual_property", "real_estate"],
        top_n=8,
    )

    if not profiles:
        print("[WARN] 0 profiles returned — see warnings above for reason")
        return

    print(f"[OK]  {len(profiles)} attorney profile(s) ready for scoring")
    for p in profiles:
        print(f"      {p.name!r}")
        print(f"        firm         : {p.firm}")
        print(f"        jurisdictions: {p.jurisdictions}")
        print(f"        specs        : {p.specializations}")
        print(f"        notable      : {p.notable_cases[:1]}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    print("=" * 60)
    print(" CourtListener Integration Diagnostic")
    print("=" * 60)

    token_set = bool(os.getenv("COURTLISTENER_API_TOKEN", "").strip())
    print(f"\n  COURTLISTENER_API_TOKEN : {'SET' if token_set else 'NOT SET'}")
    print(f"  Scoped courts          : {list(SCOPED_COURTS.keys())}")

    ok = await test_auth()
    if not ok:
        print("\n[STOP] Fix authentication first — add COURTLISTENER_API_TOKEN to .env")
        return

    # Test 1: 3D Asset / IP query in federal CA courts
    ip_results = await test_search(
        "3D Asset / Copyright",
        "copyright 3D model digital asset CGI",
        ["cacd", "cand"],
    )

    # Test 2: Real Estate query across all four scoped courts
    re_results = await test_search(
        "Real Estate",
        "real property commercial lease deed foreclosure",
        ["cacd", "cand", "cal", "calctapp"],
    )

    # Test 3: Inline attorney extraction from search results
    await test_inline_extraction(ip_results + re_results)

    # Test 4: Full pipeline
    await test_pipeline()

    print(f"\n{'=' * 60}")
    print("  Diagnostic complete")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    asyncio.run(main())
