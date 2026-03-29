# Attorney Profile Enrichment + Repricing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show richer attorney profiles so regular people can confidently choose the right attorney; reprice leads to $20 flat to attract first paying attorneys.

**Architecture:** Add 5 optional fields (`bio`, `languages`, `free_consultation`, `photo_url`, `response_time_hours`) to the `AttorneyProfile` Pydantic schema and `AttorneyRegistered` SQLAlchemy model. Add a unified `GET /api/attorneys/{id}` endpoint. Enrich match cards with a "View full profile" link. Add `/attorney/:id` profile page.

**Tech Stack:** FastAPI · SQLAlchemy (async, `create_all`) · React 18 · TypeScript · Tailwind (Mosaic: amber `#FCAA2D`, bg `#FFFEF2`, no shadows on cards)

---

## Task 1: Reprice leads to $20 flat

**Files:**
- Modify: `backend/services/billing.py`

**Step 1: Write the failing test**

In `backend/tests/test_billing.py` (create if it doesn't exist), add:

```python
def test_all_practice_areas_cost_twenty_dollars():
    from services.billing import get_lead_price, _PRICE_TIERS
    for area in _PRICE_TIERS:
        assert get_lead_price(area) == 2000, f"{area} should cost $20 (2000 cents)"

def test_unknown_practice_area_costs_twenty_dollars():
    from services.billing import get_lead_price
    assert get_lead_price("unknown_area") == 2000

def test_credit_pack_starter_is_three_credits_fifty_dollars():
    from services.billing import CREDIT_PACKAGES
    starter = next(p for p in CREDIT_PACKAGES if p["id"] == "pack_3")
    assert starter["credits"] == 3
    assert starter["amount_cents"] == 5000

def test_credit_pack_value_is_eight_credits_hundred_dollars():
    from services.billing import CREDIT_PACKAGES
    value = next(p for p in CREDIT_PACKAGES if p["id"] == "pack_8")
    assert value["credits"] == 8
    assert value["amount_cents"] == 10000

def test_credit_pack_pro_is_twenty_credits_two_hundred_dollars():
    from services.billing import CREDIT_PACKAGES
    pro = next(p for p in CREDIT_PACKAGES if p["id"] == "pack_20")
    assert pro["credits"] == 20
    assert pro["amount_cents"] == 20000
```

**Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_billing.py -v
```

Expected: FAIL (old prices and old pack IDs)

**Step 3: Update billing.py**

Replace the `_PRICE_TIERS` dict and `_DEFAULT_PRICE` and `CREDIT_PACKAGES`:

```python
# Lead price — flat $20 across all practice areas
_PRICE_TIERS: dict[str, int] = {
    "personal_injury":       2000,
    "immigration":           2000,
    "criminal_defense":      2000,
    "employment":            2000,
    "employment_employee":   2000,
    "intellectual_property": 2000,
    "corporate":             2000,
    "securities":            2000,
    "real_estate":           2000,
    "family_law":            2000,
    "bankruptcy":            2000,
    "estate_planning":       2000,
    "landlord_tenant":       2000,
    "civil_litigation":      2000,
    "contract_dispute":      2000,
    "tax":                   2000,
}

_DEFAULT_PRICE = 2000  # $20 fallback
```

Replace `CREDIT_PACKAGES`:

```python
CREDIT_PACKAGES: list[dict] = [
    {"id": "pack_3",  "credits": 3,  "amount_cents": 5000,  "label": "Starter — 3 credits",  "per_credit": "$16.67"},
    {"id": "pack_8",  "credits": 8,  "amount_cents": 10000, "label": "Value — 8 credits",     "per_credit": "$12.50"},
    {"id": "pack_20", "credits": 20, "amount_cents": 20000, "label": "Pro — 20 credits",      "per_credit": "$10.00"},
]
```

**Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_billing.py -v
```

Expected: all PASS

**Step 5: Commit**

```bash
git add backend/services/billing.py backend/tests/test_billing.py
git commit -m "feat: reprice leads to $20 flat, update credit packs"
```

---

## Task 2: Add new fields to AttorneyProfile schema

**Files:**
- Modify: `backend/models/schemas.py` (around line 299 — `AttorneyProfile`, line 577 — `AttorneyProfileUpdate`, line 603 — `AttorneyProfileResponse`)

**Step 1: Write the failing test**

In `backend/tests/test_schemas.py` (create if it doesn't exist):

```python
def test_attorney_profile_accepts_new_fields():
    from models.schemas import AttorneyProfile, Availability
    a = AttorneyProfile(
        id="att-test",
        name="Test Attorney",
        bar_number="NY-000001",
        firm="Test Firm",
        jurisdictions=["NY"],
        specializations=["employment"],
        years_experience=5,
        win_rate=0.75,
        availability=Availability.AVAILABLE,
        bio="Experienced employment attorney.",
        languages=["English", "Spanish"],
        free_consultation=True,
        photo_url="https://example.com/photo.jpg",
        response_time_hours=24,
    )
    assert a.bio == "Experienced employment attorney."
    assert a.languages == ["English", "Spanish"]
    assert a.free_consultation is True
    assert a.photo_url == "https://example.com/photo.jpg"
    assert a.response_time_hours == 24

def test_attorney_profile_new_fields_default_to_none_or_empty():
    from models.schemas import AttorneyProfile, Availability
    a = AttorneyProfile(
        id="att-test",
        name="Test Attorney",
        bar_number="NY-000001",
        firm="Test Firm",
        jurisdictions=["NY"],
        specializations=["employment"],
        years_experience=5,
        win_rate=0.75,
        availability=Availability.AVAILABLE,
    )
    assert a.bio is None
    assert a.languages == []
    assert a.free_consultation is False
    assert a.photo_url is None
    assert a.response_time_hours is None
```

**Step 2: Run to verify they fail**

```bash
cd backend
python -m pytest tests/test_schemas.py -v
```

Expected: FAIL (fields don't exist yet)

**Step 3: Add fields to AttorneyProfile**

In `backend/models/schemas.py`, find `class AttorneyProfile(BaseModel):` and add after the existing fields (after `caselaw_profile`):

```python
    bio: Optional[str] = None
    languages: list[str] = Field(default_factory=list)
    free_consultation: bool = False
    photo_url: Optional[str] = None
    response_time_hours: Optional[int] = None
```

In `class AttorneyProfileUpdate(BaseModel):`, add:

```python
    bio: Optional[str] = None
    languages: Optional[list[str]] = None
    free_consultation: Optional[bool] = None
    photo_url: Optional[str] = None
    response_time_hours: Optional[int] = None
```

In `class AttorneyProfileResponse(BaseModel):`, add:

```python
    bio: Optional[str] = None
    languages: Optional[list[str]] = None
    free_consultation: bool = False
    photo_url: Optional[str] = None
    response_time_hours: Optional[int] = None
```

**Step 4: Run to verify they pass**

```bash
cd backend
python -m pytest tests/test_schemas.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/models/schemas.py backend/tests/test_schemas.py
git commit -m "feat: add bio, languages, free_consultation, photo_url, response_time_hours to AttorneyProfile schema"
```

---

## Task 3: Add new columns to AttorneyRegistered DB model + column migration

**Files:**
- Modify: `backend/db/models.py`
- Modify: `backend/db/session.py`

**Step 1: Add columns to AttorneyRegistered model**

In `backend/db/models.py`, find `class AttorneyRegistered(Base):` and add after the `mcp_api_key_hash` line:

```python
    bio = Column(Text, nullable=True)
    languages = Column(JSON, nullable=True)           # list[str]
    free_consultation = Column(Boolean, nullable=False, default=False, server_default="false")
    photo_url = Column(String, nullable=True)
    response_time_hours = Column(Integer, nullable=True)
```

**Step 2: Add column migration to session.py**

In `backend/db/session.py`, add a new function after `init_db()`:

```python
async def migrate_attorney_profile_columns():
    """Add new attorney profile columns if they don't exist (idempotent)."""
    alter_statements = [
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS languages JSON",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS free_consultation BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS photo_url VARCHAR",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS response_time_hours INTEGER",
    ]
    from sqlalchemy import text
    async with engine.begin() as conn:
        for stmt in alter_statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists (SQLite doesn't support IF NOT EXISTS)
```

**Step 3: Call the migration from app startup**

In `backend/main.py`, find the lifespan startup block that calls `await init_db()` and add the migration call after it:

```python
await init_db()
await migrate_attorney_profile_columns()
```

Import at the top of main.py:
```python
from db.session import init_db, migrate_attorney_profile_columns
```

**Step 4: Verify the app still starts**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

Expected: `OK`

**Step 5: Commit**

```bash
git add backend/db/models.py backend/db/session.py backend/main.py
git commit -m "feat: add profile columns to AttorneyRegistered, idempotent migration on startup"
```

---

## Task 4: Enrich static attorney data

**Files:**
- Modify: `backend/data/attorneys.py`

**Step 1: Write the failing test**

In `backend/tests/test_attorneys_data.py` (create if not exists):

```python
def test_all_static_attorneys_have_bio():
    from data.attorneys import get_all_attorneys
    for a in get_all_attorneys():
        assert a.bio is not None and len(a.bio) > 10, f"{a.name} missing bio"

def test_all_static_attorneys_have_languages():
    from data.attorneys import get_all_attorneys
    for a in get_all_attorneys():
        assert len(a.languages) >= 1, f"{a.name} missing languages"

def test_all_static_attorneys_have_response_time():
    from data.attorneys import get_all_attorneys
    for a in get_all_attorneys():
        assert a.response_time_hours is not None, f"{a.name} missing response_time_hours"
```

**Step 2: Run to verify they fail**

```bash
cd backend
python -m pytest tests/test_attorneys_data.py -v
```

Expected: FAIL (fields are None/empty)

**Step 3: Add new fields to every attorney record in data/attorneys.py**

For each of the 25 attorneys in `backend/data/attorneys.py`, add:
- `bio`: 1-2 sentence description of their background and focus
- `languages`: at least `["English"]`; add secondary languages where realistic (e.g. Chen → Mandarin, Williams → Spanish where applicable)
- `free_consultation`: `True` for solo practitioners and smaller firms, `False` for large firm partners
- `photo_url`: `None` (no real photos available)
- `response_time_hours`: between 4 and 48 depending on availability (available=4-12, limited=24-48)

Example for the first attorney (Dr. Sarah Chen):

```python
AttorneyProfile(
    id="att-001",
    name="Dr. Sarah Chen",
    bar_number="CA-298451",
    firm="Chen & Associates IP Law",
    jurisdictions=["CA", "N.D. Cal.", "Fed. Cir.", "C.D. Cal."],
    specializations=["intellectual_property", "corporate"],
    years_experience=18,
    win_rate=0.82,
    availability=Availability.AVAILABLE,
    notable_cases=[
        "Led patent infringement defense for SaaS company ($45M at stake), summary judgment granted",
        "Negotiated cross-licensing agreement between two Fortune 500 tech firms",
    ],
    hourly_rate=650,
    email="schen@chenip.com",
    bio="Dr. Chen is a dual-qualified patent attorney and engineer with 18 years defending IP rights in Silicon Valley. She focuses on software patents and cross-border licensing for tech companies.",
    languages=["English", "Mandarin"],
    free_consultation=True,
    photo_url=None,
    response_time_hours=8,
),
```

Apply the same pattern to all remaining attorneys with appropriate bios and language choices.

**Step 4: Run to verify they pass**

```bash
cd backend
python -m pytest tests/test_attorneys_data.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/data/attorneys.py backend/tests/test_attorneys_data.py
git commit -m "feat: enrich static attorney data with bio, languages, free_consultation, response_time_hours"
```

---

## Task 5: Add GET /api/attorneys/{attorney_id} endpoint

**Files:**
- Modify: `backend/routers/attorneys.py`

**Step 1: Write the failing test**

In `backend/tests/test_routers/test_attorneys.py` (create if not exists):

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_get_attorney_by_static_id_returns_profile():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/attorneys/att-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "att-001"
    assert data["name"] == "Dr. Sarah Chen"
    assert "bio" in data

@pytest.mark.asyncio
async def test_get_attorney_unknown_id_returns_404():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/attorneys/att-9999")
    assert resp.status_code == 404
```

**Step 2: Run to verify they fail**

```bash
cd backend
python -m pytest tests/test_routers/test_attorneys.py -v
```

Expected: FAIL (endpoint doesn't exist)

**Step 3: Add the endpoint to attorneys.py router**

At the bottom of `backend/routers/attorneys.py`, add:

```python
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends
from db.session import get_db
from db.models import AttorneyRegistered
from models.schemas import AttorneyProfile, Availability


@router.get(
    "/attorneys/{attorney_id}",
    summary="Get a single attorney profile by ID",
)
async def get_attorney(
    attorney_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # 1. Check static list first (att-XXX IDs)
    attorneys = get_all_attorneys()
    static_match = next((a for a in attorneys if a.id == attorney_id), None)
    if static_match:
        data = static_match.model_dump()
        data.pop("email", None)  # don't expose email publicly
        return data

    # 2. Fall back to registered attorneys table
    result = await db.execute(
        select(AttorneyRegistered).where(AttorneyRegistered.id == attorney_id)
    )
    reg = result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Attorney not found")

    return {
        "id": reg.id,
        "name": reg.name,
        "bar_number": reg.bar_number,
        "firm": reg.firm,
        "jurisdictions": reg.jurisdictions or [],
        "specializations": reg.practice_areas or [],
        "years_experience": 0,
        "win_rate": 0.0,
        "availability": reg.availability or "available",
        "notable_cases": [],
        "hourly_rate": int(reg.hourly_rate) if reg.hourly_rate else None,
        "bio": reg.bio,
        "languages": reg.languages or [],
        "free_consultation": reg.free_consultation or False,
        "photo_url": reg.photo_url,
        "response_time_hours": reg.response_time_hours,
    }
```

**Step 4: Run to verify they pass**

```bash
cd backend
python -m pytest tests/test_routers/test_attorneys.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routers/attorneys.py backend/tests/test_routers/test_attorneys.py
git commit -m "feat: add GET /api/attorneys/{attorney_id} unified profile endpoint"
```

---

## Task 6: Update frontend Attorney TypeScript interface

**Files:**
- Modify: `frontend/src/types/api.ts` (around line 116 — `interface Attorney`)

**Step 1: Add new fields to the `Attorney` interface**

Find `export interface Attorney {` at line 116 and add after `docket_intelligence?`:

```typescript
  bio?: string | null;
  languages?: string[];
  free_consultation?: boolean;
  photo_url?: string | null;
  response_time_hours?: number | null;
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

**Step 3: Commit**

```bash
git add frontend/src/types/api.ts
git commit -m "feat: add profile fields to Attorney TypeScript interface"
```

---

## Task 7: Enrich AttorneyCard with trust signals + profile link

**Files:**
- Modify: `frontend/src/components/AttorneyCard.tsx`

**Step 1: Add free consultation chip and languages to the metadata row**

In `AttorneyCard.tsx`, find the metadata row (around line 326 — the `<div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">`).

After the availability badge (end of the metadata row div), add:

```tsx
{attorney.free_consultation && (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
    Free consult
  </span>
)}
{attorney.languages && attorney.languages.length > 0 && (
  <span className="text-[10px] text-gray-400">
    {attorney.languages.slice(0, 2).join(" · ")}
    {attorney.languages.length > 2 && ` +${attorney.languages.length - 2}`}
  </span>
)}
```

**Step 2: Add "View full profile" link**

After the audit section at the bottom of the card (after `{auditData && <AuditBadge auditedMatch={auditData} />}`), add:

```tsx
<div className="mt-3 pt-3 border-t border-[rgba(25,25,24,0.06)]">
  <a
    href={`/attorney/${attorney.id}`}
    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FCAA2D] hover:text-amber-600 transition-colors"
  >
    View full profile
    <ExternalLink className="h-3 w-3" />
  </a>
</div>
```

`ExternalLink` is already imported at the top of the file.

**Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/components/AttorneyCard.tsx
git commit -m "feat: add free consultation chip, languages, and profile link to AttorneyCard"
```

---

## Task 8: Create AttorneyProfilePage

**Files:**
- Create: `frontend/src/pages/AttorneyProfilePage.tsx`

**Step 1: Create the file**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  MapPin,
  Briefcase,
  Trophy,
  Clock,
  Languages,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import type { Attorney } from "../types/api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function PillTag({ label, amber }: { label: string; amber?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
        amber
          ? "bg-[rgba(252,170,45,0.1)] text-[#191918] border-[rgba(252,170,45,0.3)]"
          : "bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border-[rgba(25,25,24,0.1)]"
      }`}
    >
      {label}
    </span>
  );
}

export default function AttorneyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [attorney, setAttorney] = useState<Attorney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/attorneys/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Attorney not found");
        return r.json();
      })
      .then(setAttorney)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFEF2] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#FCAA2D] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !attorney) {
    return (
      <div className="min-h-screen bg-[#FFFEF2] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Attorney not found.</p>
        <Link to="/" className="text-[#FCAA2D] hover:text-amber-600 text-sm font-medium">
          ← Back to search
        </Link>
      </div>
    );
  }

  const winPct = Math.round(attorney.win_rate * 100);

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to search
        </Link>

        {/* Header card */}
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 mb-4">
          <div className="flex items-start gap-4">
            {/* Avatar placeholder */}
            <div className="h-16 w-16 rounded-xl bg-[rgba(252,170,45,0.15)] flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-[#FCAA2D]">
                {attorney.name.charAt(0)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#191918] truncate">{attorney.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{attorney.firm}</p>
              <p className="text-xs text-gray-400 mt-0.5">Bar #{attorney.bar_number}</p>

              <div className="flex flex-wrap gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${
                    attorney.availability === "available"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : attorney.availability === "limited"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}
                >
                  {attorney.availability}
                </span>
                {attorney.free_consultation && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="h-3 w-3" />
                    Free consultation
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Trophy className="h-4 w-4 text-[#FCAA2D]" />, value: `${winPct}%`, label: "Win rate" },
              { icon: <Briefcase className="h-4 w-4 text-[#FCAA2D]" />, value: `${attorney.years_experience} yrs`, label: "Experience" },
              { icon: <Clock className="h-4 w-4 text-[#FCAA2D]" />, value: attorney.response_time_hours ? `~${attorney.response_time_hours}h` : "—", label: "Response time" },
              { icon: <span className="text-[#FCAA2D] text-sm font-bold">$</span>, value: attorney.hourly_rate ? `$${attorney.hourly_rate}/hr` : "Contact", label: "Hourly rate" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center bg-[rgba(25,25,24,0.02)] border border-[rgba(25,25,24,0.08)] rounded-lg p-3 text-center">
                {stat.icon}
                <span className="mt-1 text-sm font-bold text-[#191918]">{stat.value}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bio */}
        {attorney.bio && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">About</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{attorney.bio}</p>
          </div>
        )}

        {/* Languages */}
        {attorney.languages && attorney.languages.length > 0 && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Languages className="h-4 w-4 text-[#FCAA2D]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Languages</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attorney.languages.map((lang) => (
                <PillTag key={lang} label={lang} />
              ))}
            </div>
          </div>
        )}

        {/* Practice areas + jurisdictions */}
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Practice Areas</h2>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {attorney.specializations.map((s) => (
              <PillTag key={s} label={s.replace(/_/g, " ")} amber />
            ))}
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Jurisdictions</h2>
          <div className="flex flex-wrap gap-1.5">
            {attorney.jurisdictions.map((j) => (
              <span key={j} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border border-[rgba(25,25,24,0.1)]">
                <MapPin className="h-2.5 w-2.5" />
                {j}
              </span>
            ))}
          </div>
        </div>

        {/* Notable cases */}
        {attorney.notable_cases && attorney.notable_cases.length > 0 && (
          <NotableCasesSection cases={attorney.notable_cases} />
        )}

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] px-6 hover:bg-amber-400 transition-colors"
          >
            Find attorneys for my case →
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotableCasesSection({ cases }: { cases: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cases : cases.slice(0, 2);

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Notable Cases</h2>
      <ul className="space-y-2">
        {visible.map((c, i) => (
          <li key={i} className="text-sm text-gray-600 leading-relaxed pl-3 border-l-2 border-[rgba(252,170,45,0.4)]">
            {c}
          </li>
        ))}
      </ul>
      {cases.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-medium text-[#FCAA2D] hover:text-amber-600 transition-colors"
        >
          {expanded ? "Show less" : `Show all ${cases.length} cases`}
        </button>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

**Step 3: Commit**

```bash
git add frontend/src/pages/AttorneyProfilePage.tsx
git commit -m "feat: add AttorneyProfilePage at /attorney/:id"
```

---

## Task 9: Add route + push to deploy

**Files:**
- Modify: `frontend/src/router.tsx`

**Step 1: Add import and route**

In `frontend/src/router.tsx`, add import at the top:

```typescript
import AttorneyProfilePage from "./pages/AttorneyProfilePage";
```

In the routes array, add before the final redirects:

```typescript
{ path: "/attorney/:id", element: <AttorneyProfilePage /> },
```

**Step 2: Verify TypeScript compiles and app builds**

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Expected: no errors, build succeeds

**Step 3: Smoke test locally**

```bash
# Terminal 1
cd backend && python -m uvicorn main:app --reload --port 8080

# Terminal 2 — verify the endpoint works
curl http://localhost:8080/api/attorneys/att-001 | python -m json.tool
```

Expected: JSON with `id: "att-001"`, `bio`, `languages`, `free_consultation` fields present.

**Step 4: Commit and push**

```bash
git add frontend/src/router.tsx
git commit -m "feat: add /attorney/:id route"
git push origin main
```

Render will redeploy automatically. Verify at:
- `https://attorney-matchmaker.onrender.com/attorney/att-001` — Dr. Sarah Chen's profile
- `https://attorney-matchmaker.onrender.com/attorney/att-002` — Marcus Williams' profile
- Match results cards now show "View full profile →" link and free consultation chip
