# Phase 2 Expansion Design

**Date:** 2026-03-15
**Status:** Approved
**Goal:** Monetize the platform (Stripe), fix pipeline UX (async jobs), expand market (50-state courts + density map), increase retention (client dashboard).

---

## A — Stripe Pay-Per-Lead

**Model:** Attorneys see anonymized case summaries for free. They pay to reveal client contact info at the time of reveal, not at match time.

**Lead price tiers:**
- PI / Immigration / Criminal Defense → $75
- Employment / IP / Corporate → $50
- Real Estate / Family / Bankruptcy → $35
- Landlord-Tenant → $25

**Flow:**
1. Attorney clicks "Reveal Client" on a lead card in `AttorneyDashboard`
2. Frontend calls `POST /api/attorney/leads/{id}/reveal` → backend creates Stripe PaymentIntent
3. Frontend renders Stripe Elements inline (no redirect)
4. On payment success → backend marks lead `revealed`, returns client name + email + phone
5. Stripe webhook `payment_intent.succeeded` confirms on server side

**New files:**
- `backend/services/billing.py` — lead price lookup, PaymentIntent creation, webhook verification
- `backend/routers/stripe_webhook.py` — `POST /api/stripe/webhook`

**Modified files:**
- `backend/routers/attorney.py` — add `POST /api/attorney/leads/{id}/reveal`
- `backend/db/models.py` — add `stripe_customer_id`, `revealed_at` to leads table
- `frontend/src/components/AttorneyDashboard.tsx` — reveal button + Stripe Elements inline checkout

**Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## B — Async Job Queue

**Problem:** Match pipeline takes 30-60s synchronously. Users abandon during the wait.

**Stack:** Upstash Redis (free tier, no server) + ARQ (async Redis queue for Python).

**Flow:**
1. `POST /api/intake` unchanged (fast)
2. `POST /api/match` enqueues job, returns `{ job_id }` immediately (< 100ms)
3. ARQ worker runs the full pipeline: Gemini → CourtListener → scoring → Claude audit
4. Frontend polls `GET /api/jobs/{job_id}` every 2 seconds
5. Worker updates stage at each step: `queued → analyzing → searching → scoring → auditing → complete`
6. On `complete`, polling response includes full `MatchResponse` inline
7. Frontend shows live progress bar with stage labels

**Progress stages shown to user:**
- `queued` → "In queue..."
- `analyzing` → "Analyzing your case facts..."
- `searching` → "Searching court docket records..."
- `scoring` → "Scoring attorneys..."
- `auditing` → "Running AI quality audit..."
- `complete` → results render

**New files:**
- `backend/worker.py` — ARQ worker definition, job functions
- `backend/services/job_store.py` — Redis job state (set/get/update stage)
- `backend/routers/jobs.py` — `GET /api/jobs/{job_id}`

**Modified files:**
- `backend/routers/match.py` — enqueue instead of run inline
- `backend/main.py` — register jobs router
- `frontend/src/App.tsx` — polling logic replaces single await
- `frontend/src/components/MatchProgressBar.tsx` (new) — animated stage progress

**Env vars:** `REDIS_URL` (Upstash Redis REST URL)

---

## C — 50-State Court Expansion + Density Map

### Court Expansion

**Replace** hardcoded 7-court `SCOPED_COURTS` with all 94 federal district courts.

**Coverage tiers:**
- `full` — NY (nyed, nysd) + CA (cacd, cand) — deep RECAP docket data
- `partial` — TX, FL, IL, GA, PA, WA, CO, NJ, MA — meaningful RECAP coverage
- `limited` — remaining 44 states — static roster + data quality flag shown

**State → federal district mapping** stored in `backend/data/federal_courts.py`:
```python
FEDERAL_COURTS: dict[str, dict] = {
    "txsd": {"label": "S.D. Tex. (Houston)", "state": "TX", "coverage": "partial"},
    "txnd": {"label": "N.D. Tex. (Dallas)", "state": "TX", "coverage": "partial"},
    # ... all 94 districts
}
STATE_TO_PRIMARY_COURT: dict[str, str] = {
    "TX": "txsd", "FL": "flsd", "IL": "ilnd", ...
}
```

**Venue optimizer** extended: any US state routes to its primary federal district for federal question cases, state superior court label for state-law cases.

### Density Map

**New page:** `/coverage` — linked from LandingNav.

**Component:** `react-simple-maps` SVG map of the US.
- Green = 5+ attorneys in our DB for that state
- Amber = 1-4 attorneys
- Red = 0 attorneys
- Click state → side panel: practice areas available, attorney count, coverage tier badge
- Red states show "Request Coverage" button → `POST /api/coverage/request` logs demand to DB

**New files:**
- `backend/data/federal_courts.py` — 94-court dict + state mapping
- `backend/routers/coverage.py` — `GET /api/coverage/stats`, `POST /api/coverage/request`
- `frontend/src/pages/CoveragePage.tsx`
- `frontend/src/components/coverage/DensityMap.tsx`
- `frontend/src/components/coverage/StateSidePanel.tsx`

**Modified files:**
- `backend/services/courtlistener_client.py` — expand SCOPED_COURTS
- `backend/services/venue_optimizer.py` — 50-state routing
- `frontend/src/router.tsx`, `LandingNav.tsx` — add Coverage nav link

---

## D — Client Account Dashboard

**Auth:** Email-based OTP (no password). Client enters email → receives 6-digit code via Resend → verified → 24hr JWT session. OTP stored in Redis with 10-min TTL.

**Dashboard at `/dashboard`:**
- Lists all past cases linked to that email
- Each case card: date, practice area, urgency, top matched attorney name, lead status
- Lead status badges: "Waiting" / "Attorney Accepted" / "Attorney Declined"
- Click case → expands to full match results (attorney cards with scores, same as App.tsx results view)
- "Start New Case" CTA

**New files:**
- `backend/services/otp.py` — generate, store, verify 6-digit OTP via Redis
- `backend/routers/dashboard.py` — `POST /api/dashboard/request-otp`, `POST /api/dashboard/verify-otp`, `GET /api/dashboard`
- `frontend/src/pages/DashboardPage.tsx` — OTP entry form + case history
- `frontend/src/components/dashboard/CaseHistoryCard.tsx` — single case row
- `frontend/src/components/dashboard/OTPForm.tsx` — email + code entry

**Modified files:**
- `frontend/src/router.tsx` — `/dashboard` route
- `frontend/src/components/landing/LandingNav.tsx` — "My Cases" link

---

## Implementation Order

1. **A (Stripe)** — revenue critical path
2. **B (Async queue)** — UX fix before driving volume
3. **C (50-state + map)** — market expansion
4. **D (Dashboard)** — retention layer
