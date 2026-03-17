# Phase 3 Design: Analytics, White-Label API, Webhooks, B2B Intake

**Date:** 2026-03-16
**Status:** Approved
**Approach:** Flat expansion (Approach A) — additive to existing app, no versioning migration

---

## Scope (in shipping order)

1. Attorney Analytics Dashboard
2. White-Label API (`/api/v1/`)
3. Generic Webhook (CRM integration)
4. B2B Intake Form (`/business/intake`)
5. SaaS Billing Tiers (last — after attorney base exists)

---

## Architecture

Four workstreams shipped sequentially, all within the existing FastAPI + React monorepo. No new services.

- White-label consumers use API keys on `/api/v1/` endpoints
- Internal frontend continues calling existing `/api/` endpoints unchanged
- Dashboard, webhook settings, and API key management live inside the existing attorney portal (`/app`)
- B2B intake is a new standalone React route that reuses the existing intake/match pipeline

---

## Data Models

### New table: `api_keys`
```
id            String PK (uuid)
owner_attorney_id  String FK → attorneys_registered.id
key_hash      String  (SHA-256 of raw key, never store plaintext)
tier          String  (starter | growth | enterprise)
daily_limit   Integer (100 | 500 | 0=unlimited)
label         String  (human-readable name set by attorney)
is_active     Boolean (default true)
created_at    DateTime
```

### New table: `api_usage`
```
id            String PK (uuid)
api_key_id    String FK → api_keys.id
date          Date    (one row per key per day, upserted)
request_count Integer
```

### `cases` — add 2 columns (migration)
```
client_type      String  (default "individual")
business_fields  JSON    (company_size, legal_issue_type, in_house_counsel_pref, monthly_budget)
```

### `attorneys_registered` — add 1 column (migration)
```
webhook_config  JSON  ({url: str, secret: str, enabled: bool})
```

### Dashboard — no new tables
All analytics are aggregation queries on existing `leads` and `cases` tables.

---

## Backend

### Analytics endpoints (attorney JWT required)
- `GET /api/attorney/analytics/funnel` — lead counts by status: received / viewed / accepted / retained
- `GET /api/attorney/analytics/benchmark` — percentile rank vs peers in same practice area (response time, acceptance rate)
- `GET /api/attorney/analytics/trends` — weekly case volume by practice area, last 12 weeks

### White-label API endpoints (API key required via `X-API-Key` header)
- `POST /api/v1/intake` — mirrors `/api/intake`, logs usage
- `POST /api/v1/match` — mirrors `/api/match`, logs usage
- `GET /api/v1/attorneys` — mirrors `/api/attorneys`, logs usage
- `GET /api/v1/leaderboard` — mirrors `/api/leaderboard`, logs usage

### API key management endpoints (attorney JWT required)
- `GET /api/attorney/api-keys` — list attorney's keys
- `POST /api/attorney/api-keys` — generate new key (returns plaintext once)
- `DELETE /api/attorney/api-keys/{key_id}` — revoke key

### Webhook endpoints (attorney JWT required)
- `GET /api/attorney/webhook` — get current webhook config
- `PUT /api/attorney/webhook` — set URL + secret + enabled
- `POST /api/attorney/webhook/test` — POST a sample payload to the configured URL

### Webhook delivery
- Triggered on `lead.accepted` event in `attorney.py`
- Payload: `{event, lead_id, case_summary, attorney_id, timestamp}`
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Fire-and-forget (asyncio task, no retry in Phase 3)

### B2B intake
- Reuses `POST /api/intake` — add `client_type` and `business_fields` to `IntakeRequest` schema
- `match.py` scoring: when `client_type == "business"`, apply B2B scoring adjustments (weight firm_size_compat, business_experience)
- No new endpoint needed

---

## Frontend

### New routes
- `/attorney/dashboard` — attorney analytics (protected, JWT)
- `/business/intake` — B2B intake wizard (public)

### New components
```
frontend/src/pages/
  DashboardPage.tsx
  BusinessIntakePage.tsx

frontend/src/components/dashboard/
  FunnelChart.tsx        — Recharts bar chart: leads by status
  BenchmarkCard.tsx      — percentile badge + peer stats
  TrendsChart.tsx        — Recharts line: 12-week demand by practice area

frontend/src/components/attorney/
  ApiKeysTab.tsx         — list/generate/revoke API keys
  ApiUsageChart.tsx      — daily request count (30 days, Recharts)
  WebhookSettings.tsx    — URL, secret, toggle, test button
```

### Nav changes
- Add "For Business" link to `LandingNav` → `/business/intake`
- Add "Dashboard" tab to attorney portal (`/app` attorney section)
- Add "API Keys" tab to attorney portal
- Add "Webhook" section to attorney profile settings

---

## API Key Auth Middleware

New FastAPI dependency `get_api_key_client()`:
1. Read `X-API-Key` header
2. SHA-256 hash it, look up in `api_keys` table
3. Check `is_active == true`
4. Check daily usage against `daily_limit` (upsert `api_usage` row)
5. Return key record (for logging) or raise 401/429

---

## Design Decisions

- **No new services** — everything stays in the FastAPI monorepo
- **No retry logic for webhooks in Phase 3** — fire-and-forget; add retry queue in Phase 4 if needed
- **Recharts only** — already planned in roadmap, no new charting library
- **B2B reuses existing pipeline** — scoring adjustments in `match.py`, no separate B2B match service
- **SaaS billing tiers deferred** — build after attorney base validates the analytics + API value
