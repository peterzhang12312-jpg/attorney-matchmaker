# Attorney Profile Enrichment + Repricing Design

**Date:** 2026-03-29
**Goal:** Help regular people choose the right attorney by showing richer profile data; reprice leads to $20 flat to attract first paying attorneys.

**Architecture:** Add optional profile fields to the existing `AttorneyProfile` schema and `AttorneyRegistered` DB model. Add a unified `GET /api/attorneys/{id}` endpoint. Enrich match result cards on the frontend. Add a new `/attorney/:id` profile page.

**Tech Stack:** FastAPI · SQLAlchemy · React 18 · TypeScript · Tailwind (Mosaic design system)

---

## Section 1: Repricing

- All `_PRICE_TIERS` values in `backend/services/billing.py` → `2000` cents ($20 flat)
- `_DEFAULT_PRICE` → `2000`
- Credit packs repriced:
  - Starter: 3 credits / $50 ($16.67/lead)
  - Value: 8 credits / $100 ($12.50/lead)
  - Pro: 20 credits / $200 ($10/lead)

---

## Section 2: Attorney Data Enrichment

### Schema changes (`backend/models/schemas.py`)

Add optional fields to `AttorneyProfile`:

```python
bio: Optional[str] = None                    # short bio paragraph
languages: list[str] = Field(default_factory=list)   # ["English", "Mandarin"]
free_consultation: bool = False
photo_url: Optional[str] = None
response_time_hours: Optional[int] = None    # avg hours to respond
```

Add same fields to `AttorneyProfileUpdate` (self-registered attorney edits).
Add same fields to `AttorneyProfileResponse` (public-facing response model).

### DB migration (`backend/db/models.py`)

Add to `AttorneyRegistered`:

```python
bio = Column(Text, nullable=True)
languages = Column(JSON, nullable=True)        # list[str]
free_consultation = Column(Boolean, nullable=False, default=False, server_default="false")
photo_url = Column(String, nullable=True)
response_time_hours = Column(Integer, nullable=True)
```

Add Alembic migration: `add_attorney_profile_fields`.

### Static data enrichment (`backend/data/attorneys.py`)

Add `bio`, `languages`, `free_consultation`, `photo_url`, `response_time_hours` to all 25 existing attorney records with realistic placeholder values.

### New API endpoint

`GET /api/attorneys/{attorney_id}` in `backend/routers/attorneys.py`:
- Look up static list first (by `att-XXX` id)
- If not found, query `AttorneyRegistered` table by UUID
- Return unified `AttorneyProfile`-shaped response (no PII — no email for non-auth requests)
- 404 if not found in either source

---

## Section 3: Enriched Match Cards

In `frontend/src/components/AttorneyCard.tsx` (or equivalent match result component):

Add to each card:
- Win rate progress bar (e.g. "82% favorable outcomes")
- Years experience badge
- Languages spoken (pill tags, max 2 shown + "+N more")
- Free consultation chip (green, if `free_consultation: true`)
- Hourly rate (if available)
- "View full profile →" link → `/attorney/:id`

---

## Section 4: Attorney Profile Page

New route: `frontend/src/pages/AttorneyProfilePage.tsx` at `/attorney/:id`

**Layout:**
1. **Header** — name, firm, bar number, availability badge, free consultation chip
2. **Stats row** — win rate · years experience · hourly rate · response time
3. **Languages** — pill tags
4. **Practice areas + jurisdictions** — pill tags (two groups)
5. **Bio** — paragraph (if present)
6. **Notable cases** — expandable list (collapsed by default, "Show all" toggle)
7. **Court docket history** — if `docket_intelligence` present, show case count + landmark wins
8. **CTA** — "Find attorneys for my case →" → `/` (back to intake)

Page is public (no auth). Fetches from `GET /api/attorneys/{id}`.

Add route to `frontend/src/router.tsx`:
```typescript
{ path: "/attorney/:id", element: <AttorneyProfilePage /> }
```

---

## What Does NOT Change

- Intake flow (4-step wizard) — untouched
- Matching pipeline — untouched
- Attorney portal / dashboard — untouched
- Auth / JWT — untouched
- CourtListener docket search — untouched
