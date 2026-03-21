# GTM Client-First Launch — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs, add smoke tests, build client acquisition pages (SEO + social + embeddable widget), and add an attorney waitlist — all at $0 cost.

**Architecture:** Bug fixes are surgical edits to existing files. New pages follow the existing React Router + page component pattern in `frontend/src/pages/`. The embeddable widget is a hosted JS snippet + a stripped intake iframe route. The backend partner registration endpoint follows the existing FastAPI router pattern.

**Tech Stack:** FastAPI (Python), React 18 + Vite + TypeScript, Tailwind, React Helmet (already installed), React Router (createBrowserRouter), pytest + httpx (new), structlog

---

## Task 1: Add JWT_SECRET_KEY to required env vars

**Files:**
- Modify: `backend/main.py:57-61`

**Step 1: Edit `_REQUIRED_KEYS`**

```python
_REQUIRED_KEYS = {
    "GEMINI_API_KEY":          "Gemini fact-pattern analysis",
    "ANTHROPIC_API_KEY":       "Claude Opus audit layer",
    "COURTLISTENER_API_TOKEN": "CourtListener RECAP docket search",
    "JWT_SECRET_KEY":          "Attorney portal JWT signing — set to a random 64-char hex string",
}
```

**Step 2: Verify locally**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

Expected: if `JWT_SECRET_KEY` is missing from `.env`, the process exits with a log line `required_env_vars_missing`. If it's set, prints `OK`.

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "fix: require JWT_SECRET_KEY at startup"
```

---

## Task 2: Wrap async email tasks in error handlers

**Files:**
- Modify: `backend/routers/intake.py:97-105`
- Modify: `backend/routers/attorney.py:467-482`

**Step 1: Fix `intake.py` — wrap the create_task call**

Find this block (lines 97-105):
```python
# Fire-and-forget confirmation email (non-blocking)
if body.client_email:
    from services.email import send_case_confirmation
    asyncio.create_task(send_case_confirmation(
        to_email=body.client_email,
        case_id=case_id,
        practice_area=body.legal_area or "",
        urgency=body.urgency.value,
    ))
```

Replace with:
```python
# Fire-and-forget confirmation email (non-blocking)
if body.client_email:
    from services.email import send_case_confirmation
    async def _send_confirmation():
        try:
            await send_case_confirmation(
                to_email=body.client_email,
                case_id=case_id,
                practice_area=body.legal_area or "",
                urgency=body.urgency.value,
            )
        except Exception as _exc:
            log.warning("case_confirmation_email_failed", error=str(_exc))
    asyncio.create_task(_send_confirmation())
```

**Step 2: Fix `attorney.py` — wrap the lead accepted email task**

Find this block (around lines 467-482):
```python
    if body.action == "accept":
        try:
            from services.email import send_lead_accepted_to_client
            case_result = await db.execute(
                select(Case).where(Case.case_id == lead.case_id)
            )
            case_row = case_result.scalar_one_or_none()
            client_email = getattr(case_row, "client_email", None) if case_row else None
            if client_email:
                asyncio.create_task(send_lead_accepted_to_client(
                    client_email=client_email,
                    attorney_name=attorney.name,
                    firm=attorney.firm or "",
                ))
        except Exception as exc:
            log.warning("lead_accepted_email_failed", error=str(exc))
```

Replace the `asyncio.create_task(...)` call inside with a wrapped version:
```python
            if client_email:
                async def _send_accepted(email=client_email):
                    try:
                        await send_lead_accepted_to_client(
                            client_email=email,
                            attorney_name=attorney.name,
                            firm=attorney.firm or "",
                        )
                    except Exception as _exc:
                        log.warning("lead_accepted_email_failed", error=str(_exc))
                asyncio.create_task(_send_accepted())
```

**Step 3: Verify import still works**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

**Step 4: Commit**

```bash
git add backend/routers/intake.py backend/routers/attorney.py
git commit -m "fix: catch and log async email task exceptions"
```

---

## Task 3: Frontend — auto-logout on 401

**Files:**
- Modify: `frontend/src/api/client.ts`

**Step 1: Read the current client.ts to find the fetch wrapper**

```bash
cat frontend/src/api/client.ts
```

**Step 2: Add a 401 interceptor to the base fetch helper**

Find the function that makes authenticated requests (look for `Authorization: Bearer`). After the `await fetch(...)` call, add:

```typescript
if (res.status === 401) {
  localStorage.removeItem("attorney_token");
  window.location.href = "/app";
  throw new Error("Session expired. Please log in again.");
}
```

Add this check immediately after `const res = await fetch(...)` in any function that sends the `Authorization` header.

**Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "fix: auto-logout and redirect to /app on 401"
```

---

## Task 4: Set up pytest and write smoke tests

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_smoke.py`

**Step 1: Install test dependencies**

```bash
cd backend
pip install pytest pytest-asyncio httpx
pip freeze | grep -E "pytest|httpx" >> requirements.txt
```

**Step 2: Create `backend/tests/__init__.py`**

Empty file:
```python
```

**Step 3: Create `backend/tests/conftest.py`**

```python
"""Shared pytest fixtures for the backend test suite."""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Provide required env vars before importing the app
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("COURTLISTENER_API_TOKEN", "test-cl-token")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-32-chars-minimum-xx")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")


@pytest_asyncio.fixture
async def client():
    """Async HTTP client pointed at the test app instance."""
    from main import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
```

**Step 4: Create `backend/tests/test_smoke.py`**

```python
"""Smoke tests — verify the three most critical flows work end-to-end."""
import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """Health endpoint should return ok."""
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_intake_returns_case_id(client):
    """POST /api/intake should persist a case and return a case_id."""
    res = await client.post("/api/intake", json={
        "description": "I was rear-ended at a red light and injured my neck.",
        "urgency": "medium",
        "client_email": "smoketest@example.com",
    })
    assert res.status_code == 200
    data = res.json()
    assert "case_id" in data
    assert data["status"] == "received"


@pytest.mark.asyncio
async def test_reveal_requires_auth(client):
    """Lead reveal endpoint must reject unauthenticated requests."""
    res = await client.post("/api/attorney/leads/fake-id/reveal")
    assert res.status_code in (401, 403)
```

**Step 5: Run tests**

```bash
cd backend
pytest tests/test_smoke.py -v
```

Expected output:
```
PASSED tests/test_smoke.py::test_health_check
PASSED tests/test_smoke.py::test_intake_returns_case_id
PASSED tests/test_smoke.py::test_reveal_requires_auth
```

**Step 6: Commit**

```bash
git add backend/tests/ backend/requirements.txt
git commit -m "test: add pytest smoke tests for health, intake, and auth"
```

---

## Task 5: SEO programmatic landing pages

**Files:**
- Create: `frontend/src/pages/FindAttorneyPage.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `backend/main.py` (sitemap)

**Step 1: Create `frontend/src/pages/FindAttorneyPage.tsx`**

```tsx
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import JsonLd from "../components/JsonLd";

const PRACTICE_AREA_LABELS: Record<string, string> = {
  "personal-injury": "Personal Injury",
  "criminal-defense": "Criminal Defense",
  "immigration": "Immigration",
  "family-law": "Family Law",
  "employment": "Employment",
  "real-estate": "Real Estate",
  "bankruptcy": "Bankruptcy",
  "estate-planning": "Estate Planning",
  "landlord-tenant": "Landlord-Tenant",
  "intellectual-property": "Intellectual Property",
};

const CITY_LABELS: Record<string, string> = {
  "new-york": "New York",
  "los-angeles": "Los Angeles",
  "chicago": "Chicago",
  "houston": "Houston",
  "phoenix": "Phoenix",
  "philadelphia": "Philadelphia",
  "san-antonio": "San Antonio",
  "san-diego": "San Diego",
  "dallas": "Dallas",
  "san-jose": "San Jose",
};

export default function FindAttorneyPage() {
  const { practiceArea = "", city = "" } = useParams<{
    practiceArea: string;
    city: string;
  }>();

  const areaLabel = PRACTICE_AREA_LABELS[practiceArea] ?? practiceArea;
  const cityLabel = CITY_LABELS[city] ?? city;
  const title = `Find a ${areaLabel} Attorney in ${cityLabel}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": `${areaLabel} Attorney Matching — ${cityLabel}`,
    "description": `Free AI-powered attorney matching for ${areaLabel} cases in ${cityLabel}. Get matched in 2 minutes.`,
    "url": `https://attorney-matchmaker.onrender.com/find-attorney/${practiceArea}/${city}`,
    "areaServed": cityLabel,
    "serviceType": areaLabel,
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>{title} | Free Case Review — Attorney Matchmaker</title>
        <meta
          name="description"
          content={`Looking for a ${areaLabel} attorney in ${cityLabel}? Get AI-matched to the right lawyer in 2 minutes. Free, no commitment.`}
        />
        <link
          rel="canonical"
          href={`https://attorney-matchmaker.onrender.com/find-attorney/${practiceArea}/${city}`}
        />
      </Helmet>
      <JsonLd data={schema} />

      {/* Nav */}
      <nav className="border-b border-[rgba(25,25,24,0.12)] bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-semibold text-[#191918] tracking-wide">
          Attorney Matchmaker
        </Link>
        <Link
          to="/app"
          className="font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors"
        >
          For Attorneys
        </Link>
      </nav>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-[#191918] mb-4">
          {title}
        </h1>
        <p className="text-[rgba(25,25,24,0.65)] mb-8 text-lg leading-relaxed">
          Describe your situation and our AI matches you with the right{" "}
          {areaLabel.toLowerCase()} attorney in {cityLabel} — based on real court
          record data, not paid listings.
        </p>

        <ul className="mb-10 space-y-2 text-[rgba(25,25,24,0.65)] text-sm">
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            Free — no upfront cost to get matched
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            AI-scored attorneys using real federal court docket data
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            Results in under 2 minutes
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            No commitment — just a match recommendation
          </li>
        </ul>

        <Link
          to={`/app?area=${practiceArea}`}
          className="inline-block rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-8 py-4 font-semibold hover:bg-amber-400 transition-colors"
        >
          Get Matched in 2 Minutes →
        </Link>

        <p className="mt-6 text-xs text-[rgba(25,25,24,0.35)] font-mono">
          Expect contact from a matched attorney within 24 hours.
        </p>
      </main>
    </div>
  );
}
```

**Step 2: Add routes to `frontend/src/router.tsx`**

Add these imports at the top:
```typescript
import FindAttorneyPage from "./pages/FindAttorneyPage";
import GetHelpPage from "./pages/GetHelpPage";
import ForAttorneysPage from "./pages/ForAttorneysPage";
import WidgetIntakePage from "./pages/WidgetIntakePage";
```

Add these routes inside `createBrowserRouter([...])`:
```typescript
  { path: "/find-attorney/:practiceArea/:city", element: <FindAttorneyPage /> },
  { path: "/get-help", element: <GetHelpPage /> },
  { path: "/for-attorneys", element: <ForAttorneysPage /> },
  { path: "/widget/intake", element: <WidgetIntakePage /> },
```

**Step 3: Update sitemap in `backend/main.py`**

Find the `urls` list in `sitemap_xml()` (around line 407) and add the SEO pages:

```python
    # SEO landing pages
    PRACTICE_AREAS = [
        "personal-injury", "criminal-defense", "immigration",
    ]
    CITIES = [
        "new-york", "los-angeles", "chicago", "houston", "phoenix",
        "philadelphia", "san-antonio", "san-diego", "dallas", "san-jose",
    ]
    for area in PRACTICE_AREAS:
        for city in CITIES:
            urls.append((
                f"{base}/find-attorney/{area}/{city}",
                "0.8",
                "monthly",
            ))
    urls.append((base + "/get-help", "0.9", "weekly"))
    urls.append((base + "/for-attorneys", "0.7", "monthly"))
```

**Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors, `dist/index.html` updated.

**Step 5: Commit**

```bash
git add frontend/src/pages/FindAttorneyPage.tsx frontend/src/router.tsx backend/main.py
git commit -m "feat: add SEO programmatic landing pages for 30 practice-area/city combos"
```

---

## Task 6: /get-help social landing page

**Files:**
- Create: `frontend/src/pages/GetHelpPage.tsx`

**Step 1: Create `frontend/src/pages/GetHelpPage.tsx`**

```tsx
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function GetHelpPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2] flex flex-col items-center justify-center px-6">
      <Helmet>
        <title>Get Free Legal Help — Attorney Matchmaker</title>
        <meta
          name="description"
          content="Got a legal problem? Get matched with the right attorney in 2 minutes. Free, no commitment."
        />
      </Helmet>

      <div className="max-w-md w-full text-center">
        {/* Logo / brand */}
        <p className="font-mono text-xs uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-6">
          Attorney Matchmaker
        </p>

        <h1 className="text-4xl font-bold text-[#191918] mb-4 leading-tight">
          Got a legal problem?
        </h1>
        <p className="text-lg text-[rgba(25,25,24,0.65)] mb-10 leading-relaxed">
          Get matched with the right attorney in 2 minutes.
          <br />
          Free. No commitment.
        </p>

        <Link
          to="/app"
          className="block w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-sm uppercase tracking-wide py-5 font-semibold hover:bg-amber-400 transition-colors text-center"
        >
          Start Free Match →
        </Link>

        <ul className="mt-10 space-y-3 text-sm text-[rgba(25,25,24,0.55)] text-left">
          <li className="flex items-start gap-3">
            <span className="text-[#FCAA2D] font-bold mt-0.5">✓</span>
            Describe your situation — we extract the legal issues automatically
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[#FCAA2D] font-bold mt-0.5">✓</span>
            Matched based on real court record data, not who paid the most
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[#FCAA2D] font-bold mt-0.5">✓</span>
            Attorney contacts you — you don't chase anyone
          </li>
        </ul>

        <p className="mt-10 text-xs text-[rgba(25,25,24,0.35)] font-mono">
          Personal injury · Criminal defense · Immigration · Family law · and more
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add frontend/src/pages/GetHelpPage.tsx
git commit -m "feat: add /get-help social landing page for link-in-bio"
```

---

## Task 7: Embeddable intake widget

**Files:**
- Create: `frontend/src/pages/WidgetIntakePage.tsx`
- Create: `frontend/public/widget.js`
- Create: `backend/routers/partners.py`
- Modify: `backend/main.py` (register router)

**Step 1: Create `frontend/src/pages/WidgetIntakePage.tsx`**

A stripped-down intake page with no nav/footer, designed to load inside a modal iframe:

```tsx
import { Helmet } from "react-helmet-async";
import IntakeForm from "../components/IntakeForm";

export default function WidgetIntakePage() {
  // Read partner_id from URL param to tag the intake submission
  const params = new URLSearchParams(window.location.search);
  const partnerId = params.get("partner_id") ?? "widget";

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <Helmet>
        <title>Get Legal Help — Attorney Matchmaker</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="max-w-xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4 text-center">
          Powered by Attorney Matchmaker
        </p>
        {/* Reuse the existing IntakeForm — it handles the full flow */}
        <IntakeForm
          onMatchComplete={() => {
            // Post message to parent window so it can close the modal
            window.parent.postMessage({ type: "INTAKE_COMPLETE", partnerId }, "*");
          }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Create `frontend/public/widget.js`**

This is what partners paste as a `<script>` tag:

```javascript
(function () {
  var PARTNER_ID = document.currentScript
    ? (document.currentScript.getAttribute("data-partner-id") || "unknown")
    : "unknown";
  var BASE_URL = "https://attorney-matchmaker.onrender.com";

  // Create button
  var btn = document.createElement("button");
  btn.textContent = "Get Free Legal Help";
  btn.style.cssText = [
    "background:#FCAA2D",
    "color:#191918",
    "border:none",
    "border-radius:6px",
    "padding:14px 28px",
    "font-family:monospace",
    "font-size:0.75rem",
    "letter-spacing:0.1em",
    "text-transform:uppercase",
    "font-weight:600",
    "cursor:pointer",
    "display:inline-block",
  ].join(";");

  // Create modal overlay
  var overlay = document.createElement("div");
  overlay.style.cssText = [
    "display:none",
    "position:fixed",
    "top:0", "left:0", "right:0", "bottom:0",
    "background:rgba(0,0,0,0.5)",
    "z-index:99999",
    "align-items:center",
    "justify-content:center",
  ].join(";");

  var modal = document.createElement("div");
  modal.style.cssText = [
    "background:white",
    "border-radius:10px",
    "width:90vw",
    "max-width:560px",
    "max-height:90vh",
    "overflow:hidden",
    "position:relative",
  ].join(";");

  var closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = [
    "position:absolute",
    "top:12px", "right:16px",
    "background:none", "border:none",
    "font-size:1.5rem",
    "cursor:pointer",
    "color:#191918",
    "z-index:1",
  ].join(";");

  var iframe = document.createElement("iframe");
  iframe.style.cssText = "width:100%;height:80vh;border:none;display:block;";
  iframe.src = BASE_URL + "/widget/intake?partner_id=" + PARTNER_ID;

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  btn.addEventListener("click", function () {
    overlay.style.display = "flex";
  });

  closeBtn.addEventListener("click", function () {
    overlay.style.display = "none";
  });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.style.display = "none";
  });

  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "INTAKE_COMPLETE") {
      overlay.style.display = "none";
    }
  });

  // Insert button after the script tag
  var script = document.currentScript;
  if (script && script.parentNode) {
    script.parentNode.insertBefore(btn, script.nextSibling);
  } else {
    document.body.appendChild(btn);
  }
})();
```

**Step 3: Create `backend/routers/partners.py`**

```python
"""
Partner registration — generates embed codes for the intake widget.
All routes prefixed with /api/partners.
"""
from __future__ import annotations

import uuid
import structlog
from fastapi import APIRouter, Request
from pydantic import BaseModel

log = structlog.get_logger()
router = APIRouter(prefix="/api/partners", tags=["partners"])


class PartnerRegisterRequest(BaseModel):
    name: str
    website: str | None = None


class PartnerRegisterResponse(BaseModel):
    partner_id: str
    embed_code: str


@router.post("/register", response_model=PartnerRegisterResponse)
async def register_partner(body: PartnerRegisterRequest, request: Request):
    """
    Generate a partner ID and embed snippet for the intake widget.
    No auth required — the partner ID is used only for intake attribution.
    """
    partner_id = str(uuid.uuid4())[:8]
    base_url = str(request.base_url).rstrip("/")

    embed_code = (
        f'<script src="{base_url}/widget.js" '
        f'data-partner-id="{partner_id}"></script>'
    )

    log.info("partner_registered", partner_id=partner_id, name=body.name, website=body.website)

    return PartnerRegisterResponse(partner_id=partner_id, embed_code=embed_code)
```

**Step 4: Register the partners router in `backend/main.py`**

Add the import at line 37 (with the other router imports):
```python
from routers import attorneys, attorney, intake, leaderboard, match, refine, linkedin_auth, case_lookup, stripe_webhook, jobs, coverage, dashboard, cron, timeline, v1, partners
```

Add the router registration after the existing routers (around line 284):
```python
app.include_router(partners.router)
```

**Step 5: Verify**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

```bash
cd frontend && npm run build 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add frontend/src/pages/WidgetIntakePage.tsx frontend/public/widget.js \
        backend/routers/partners.py backend/main.py
git commit -m "feat: add embeddable intake widget and /widget/intake route"
```

---

## Task 8: /for-attorneys waitlist page

**Files:**
- Create: `frontend/src/pages/ForAttorneysPage.tsx`
- Create: `backend/routers/waitlist.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/routers/waitlist.py`**

```python
"""
Attorney waitlist — captures interest from attorneys before full onboarding.
All routes prefixed with /api/waitlist.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

log = structlog.get_logger()
router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


class WaitlistRequest(BaseModel):
    name: str
    email: EmailStr
    practice_area: str | None = None
    city: str | None = None


class WaitlistResponse(BaseModel):
    status: str
    message: str


@router.post("/attorney", response_model=WaitlistResponse)
async def join_attorney_waitlist(body: WaitlistRequest):
    """
    Log attorney waitlist interest. In the current lean phase this just
    logs the entry — no DB table needed yet. Replace with DB insert when
    volume justifies it.
    """
    log.info(
        "attorney_waitlist_signup",
        name=body.name,
        email=body.email,
        practice_area=body.practice_area,
        city=body.city,
    )
    return WaitlistResponse(
        status="ok",
        message="You're on the list. We'll reach out when we have leads in your area.",
    )
```

**Step 2: Register in `backend/main.py`**

Add `waitlist` to the import line and register the router:
```python
from routers import ..., partners, waitlist
```
```python
app.include_router(waitlist.router)
```

**Step 3: Create `frontend/src/pages/ForAttorneysPage.tsx`**

```tsx
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function ForAttorneysPage() {
  const [form, setForm] = useState({
    name: "", email: "", practice_area: "", city: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist/attorney`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>Attorneys — Get Leads in Your Area | Attorney Matchmaker</title>
        <meta
          name="description"
          content="We have clients looking for attorneys in your area. Join the waitlist — first 10 attorneys get their first 5 leads free."
        />
      </Helmet>

      {/* Nav */}
      <nav className="border-b border-[rgba(25,25,24,0.12)] bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-semibold text-[#191918] tracking-wide">
          Attorney Matchmaker
        </Link>
        <Link
          to="/app"
          className="font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors"
        >
          Sign In
        </Link>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-[#FCAA2D] mb-3">
          For Attorneys
        </p>
        <h1 className="text-3xl font-bold text-[#191918] mb-4">
          We have clients looking for you
        </h1>
        <p className="text-[rgba(25,25,24,0.65)] mb-4 leading-relaxed">
          Attorney Matchmaker uses AI to match people with their ideal attorney
          based on real court record data — not who paid for a listing.
        </p>
        <p className="text-[rgba(25,25,24,0.65)] mb-10 leading-relaxed">
          <strong className="text-[#191918]">First 10 founding attorneys</strong> get
          their first 5 matched leads at no cost.
        </p>

        {status === "done" ? (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 text-center">
            <p className="text-[#191918] font-semibold text-lg mb-2">You're on the list.</p>
            <p className="text-[rgba(25,25,24,0.55)] text-sm">
              We'll reach out when we have leads in your area.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                Full Name
              </label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                Email
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
                placeholder="jane@lawfirm.com"
              />
            </div>
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                Primary Practice Area
              </label>
              <select
                value={form.practice_area}
                onChange={(e) => setForm({ ...form, practice_area: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
              >
                <option value="">Select one...</option>
                <option value="personal_injury">Personal Injury</option>
                <option value="criminal_defense">Criminal Defense</option>
                <option value="immigration">Immigration</option>
                <option value="family_law">Family Law</option>
                <option value="employment">Employment</option>
                <option value="real_estate">Real Estate</option>
                <option value="bankruptcy">Bankruptcy</option>
                <option value="intellectual_property">Intellectual Property</option>
                <option value="estate_planning">Estate Planning</option>
                <option value="landlord_tenant">Landlord-Tenant</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
                placeholder="New York"
              />
            </div>

            {status === "error" && (
              <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide py-4 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {status === "loading" ? "Joining..." : "Join the Waitlist →"}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-[rgba(25,25,24,0.35)] text-center font-mono">
          Already registered?{" "}
          <Link to="/app" className="text-[#FCAA2D] hover:underline">
            Sign in to your portal
          </Link>
        </p>
      </main>
    </div>
  );
}
```

**Step 4: Verify build**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
cd ../frontend && npm run build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add frontend/src/pages/ForAttorneysPage.tsx \
        backend/routers/waitlist.py backend/main.py
git commit -m "feat: add /for-attorneys waitlist page and backend endpoint"
```

---

## Task 9: Deploy and verify

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Watch Render deploy**

Open https://dashboard.render.com and wait for green deploy (usually 3-5 minutes).

**Step 3: Smoke test production**

```bash
curl https://attorney-matchmaker.onrender.com/api/health
# Expected: {"status":"ok",...}

curl https://attorney-matchmaker.onrender.com/sitemap.xml | grep find-attorney | head -3
# Expected: 30 find-attorney URLs listed

curl -X POST https://attorney-matchmaker.onrender.com/api/partners/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Legal Aid","website":"https://example.org"}'
# Expected: {"partner_id":"...","embed_code":"<script..."}
```

**Step 4: Submit sitemap to Google Search Console**

1. Go to https://search.google.com/search-console
2. Add property: `https://attorney-matchmaker.onrender.com`
3. Submit sitemap: `https://attorney-matchmaker.onrender.com/sitemap.xml`

**Step 5: Final commit if any tweaks needed**

```bash
git add -p && git commit -m "fix: production tweaks after deploy verification"
git push origin main
```

---

## Summary

| Task | What | Files touched |
|------|------|---------------|
| 1 | JWT_SECRET_KEY required | `main.py` |
| 2 | Async email error handling | `intake.py`, `attorney.py` |
| 3 | Frontend 401 auto-logout | `api/client.ts` |
| 4 | Pytest smoke tests | `tests/conftest.py`, `test_smoke.py` |
| 5 | SEO landing pages (30 pages) | `FindAttorneyPage.tsx`, `router.tsx`, `main.py` |
| 6 | /get-help social page | `GetHelpPage.tsx` |
| 7 | Embeddable widget | `WidgetIntakePage.tsx`, `widget.js`, `partners.py` |
| 8 | /for-attorneys waitlist | `ForAttorneysPage.tsx`, `waitlist.py` |
| 9 | Deploy + verify | — |
