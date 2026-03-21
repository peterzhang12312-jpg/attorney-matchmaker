# GTM Plan: Client-First Launch Strategy
**Date:** 2026-03-21
**Approach:** Approach A — Client Funnel First
**Budget:** $0 (fully organic, no paid ads)

---

## Goal

Drive client intakes first via SEO + partnerships + organic social. Use real demand as the sales pitch to attorneys. Revenue flows when attorneys pay to reveal matched client leads ($25–75/lead by practice area).

---

## Stage 1: Critical Bug Fixes + Smoke Tests (Week 1)

Fix before any clients arrive:

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | `case_summary` null crash | `backend/routers/attorney.py:407` | `(lead.case_summary or {}).get(...)` |
| 2 | JWT secret not required at startup | `backend/main.py` lifespan | Crash on startup if `JWT_SECRET_KEY` missing |
| 3 | Async email exceptions swallowed | `backend/routers/intake.py`, `match.py` | Wrap `asyncio.create_task()` in try/except + log |
| 4 | Stale lead status in response | `backend/routers/attorney.py:496` | Capture status after `db.refresh()` |
| 5 | Token expiry not checked on load | `frontend/src/App.tsx:27` | Auto-logout on 401 |

Smoke tests (pytest):
- `test_intake_creates_case` — POST /intake returns job ID
- `test_reveal_requires_payment` — reveal endpoint rejects without PaymentIntent
- `test_attorney_login` — JWT issued correctly

---

## Stage 2: SEO Programmatic Landing Pages (Week 1–2)

**Route:** `/find-attorney/:practiceArea/:city`

**Launch matrix:** 3 practice areas × 10 cities = 30 pages
- Practice areas: personal_injury, criminal_defense, immigration (highest lead value = $75)
- Cities: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, San Jose

**Each page:**
- Unique `<title>`, `<h1>`, meta description via React Helmet
- Schema.org `LegalService` structured data
- Mobile-first layout: brief explainer + "Get matched in 2 minutes" CTA
- CTA pre-fills intake form with practice area from URL
- Post-submission message: "We're finding attorneys in [city] — expect contact within 24 hours"

**Sitemap:** Auto-generated from practice area × city matrix, submitted to Google Search Console (free).

---

## Stage 3: Embeddable Intake Widget (Week 2)

**For partners:** single `<script>` tag drops a "Get Free Legal Match" button + modal on any website.

- Hosted at: `https://attorney-matchmaker.onrender.com/widget.js`
- Modal loads `/widget/intake` — stripped intake form (no nav/footer)
- UTM source = partner ID for tracking
- New endpoint: `POST /api/partners/register` → returns partner ID + embed snippet

**Partner outreach targets (free directories):**
- Legal aid orgs: lsc.gov directory (132 orgs nationwide)
- State bar lawyer referral pages
- Court self-help centers
- Immigrant services orgs (high immigration volume = $75/lead)

---

## Stage 4: Social Landing Page `/get-help` (Week 1)

**For TikTok/IG link-in-bio:**
- Headline: "Got a legal problem? Get matched with an attorney — free, in 2 minutes"
- Single CTA → intake form
- Mobile-first, fast, no clutter

**Organic content strategy (no budget):**
- 30–60 sec videos answering one legal question per video
- Focus areas: personal injury, criminal defense, landlord-tenant
- CTA: "Get a free attorney match — link in bio"
- Post natively on TikTok + IG Reels

---

## Stage 5: Attorney Supply Trigger (At 20 Intakes)

**Attorney waitlist page:** `/for-attorneys`
- "We have clients in your area looking for attorneys. Join free."

**Manual outreach at 20 intakes:**
- Find 20–30 solo attorneys free on Avvo, Martindale, state bar directories
- CourtListener (already integrated) for attorney data
- Email pitch: "We have [X] unmatched cases in [city] right now. First 10 attorneys get founding member pricing — first 5 leads free."

---

## Cost: $0

All stages run on existing Render deployment. No new services or subscriptions.

---

## Success Metrics

| Milestone | Target |
|-----------|--------|
| Critical bugs fixed | Week 1 |
| 30 SEO pages live | Week 2 |
| Widget on 3 partner sites | Week 3 |
| 20 client intakes | Week 3–4 |
| 5 paying attorneys | Week 4–5 |
| First revenue | Week 4–5 |
