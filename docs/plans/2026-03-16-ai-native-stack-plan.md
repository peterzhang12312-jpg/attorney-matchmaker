# AI-Native Stack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Attorney Matchmaker discoverable and callable by ChatGPT, Claude, and Gemini via crawlability files, ChatGPT Actions, and an API-key-gated MCP server.

**Architecture:** Three independent layers — (1) static crawlability files served by FastAPI, (2) ChatGPT Actions manifest + trimmed OpenAPI spec, (3) standalone MCP server in `backend/mcp_server.py` that proxies to the live Render API with SHA-256 key auth. DB migration adds `mcp_api_key_hash` to `attorneys_registered`.

**Tech Stack:** FastAPI (plain responses), React 18 (dangerouslySetInnerHTML JSON-LD), Python `mcp` library (stdio MCP server), `secrets` + `hashlib` (key generation/hashing)

---

## Task 1: Fix canonical URL in index.html

**Files:**
- Modify: `frontend/index.html`

**Step 1: Edit the two placeholder URLs**

In `frontend/index.html`, replace every occurrence of `https://PRODUCTION_DOMAIN_HERE` with `https://attorney-matchmaker.onrender.com`:

Line 13:
```html
<link rel="canonical" href="https://attorney-matchmaker.onrender.com/" />
```
Line 18:
```html
<meta property="og:url" content="https://attorney-matchmaker.onrender.com/" />
```
Line 21:
```html
<meta property="og:image" content="https://attorney-matchmaker.onrender.com/og-image.png" />
```

**Step 2: Commit**
```bash
git add frontend/index.html
git commit -m "fix: replace canonical URL placeholder with production domain"
```

---

## Task 2: Serve robots.txt from FastAPI

**Files:**
- Modify: `backend/main.py`

**Step 1: Add the robots.txt endpoint**

In `backend/main.py`, add this route BEFORE the catch-all SPA route (just above the `if FRONTEND_DIST.exists():` block at line 275):

```python
@app.get("/robots.txt", include_in_schema=False)
async def robots_txt():
    """Allow all AI crawlers to index the site."""
    content = """User-agent: *
Allow: /
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Bytespider
Allow: /
Sitemap: https://attorney-matchmaker.onrender.com/sitemap.xml
"""
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content)
```

**Step 2: Verify locally**

Run from `backend/`: `python -m uvicorn main:app --reload --port 8080`
Visit `http://localhost:8080/robots.txt`
Expected: plain text with user-agent rules

**Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat: serve robots.txt allowing all AI crawlers"
```

---

## Task 3: Serve sitemap.xml from FastAPI

**Files:**
- Modify: `backend/main.py`

**Step 1: Add the sitemap endpoint**

In `backend/main.py`, add this route directly after the `robots_txt` function:

```python
@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml():
    """XML sitemap for all public pages."""
    from fastapi.responses import Response
    base = "https://attorney-matchmaker.onrender.com"
    urls = [
        (base + "/",              "1.0", "weekly"),
        (base + "/app",           "0.9", "weekly"),
        (base + "/blog",          "0.8", "weekly"),
        (base + "/leaderboard",   "0.6", "monthly"),
        (base + "/case-lookup",   "0.7", "monthly"),
        (base + "/coverage",      "0.6", "monthly"),
    ]
    items = "\n".join(
        f"  <url><loc>{loc}</loc><priority>{pri}</priority><changefreq>{freq}</changefreq></url>"
        for loc, pri, freq in urls
    )
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{items}
</urlset>"""
    return Response(content=xml, media_type="application/xml")
```

**Step 2: Verify locally**

Visit `http://localhost:8080/sitemap.xml`
Expected: valid XML with 6 `<url>` entries

**Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat: serve sitemap.xml with all public routes"
```

---

## Task 4: Serve llms.txt from FastAPI

**Files:**
- Modify: `backend/main.py`

**Step 1: Add the llms.txt endpoint**

Add this route after `sitemap_xml`:

```python
@app.get("/llms.txt", include_in_schema=False)
async def llms_txt():
    """LLM-readable site description (llms.txt standard)."""
    from fastapi.responses import PlainTextResponse
    content = """# Attorney Matchmaker

> AI-powered attorney matching using real federal court docket data. No paid listings.

Attorney Matchmaker helps people find the best-fit attorney for their legal case.
Users describe their situation; Gemini AI extracts legal issues, practice areas, and
optimal jurisdiction; a weighted algorithm scores registered attorneys; Claude Opus
audits the top matches for quality. Results include match scores, reasoning, and
a venue recommendation.

## What this site does

- Accepts case descriptions and returns ranked attorney matches with AI scoring
- Covers 16+ practice areas: real estate, IP, immigration, family law, criminal defense, and more
- Covers 9+ jurisdictions including New York, California, and federal courts nationwide
- Attorneys self-register and receive leads from matched cases
- A leaderboard ranks attorneys by domain and jurisdiction using CourtListener docket data

## API

Base URL: https://attorney-matchmaker.onrender.com
OpenAPI spec: https://attorney-matchmaker.onrender.com/api/openai-spec.json
ChatGPT plugin manifest: https://attorney-matchmaker.onrender.com/.well-known/ai-plugin.json

### Key endpoints

POST /api/intake        — Submit a case description, returns case_id
POST /api/match         — Get ranked attorney matches for a case_id
GET  /api/attorneys     — Browse registered attorneys (filter by jurisdiction, practice_area)
GET  /api/leaderboard   — Top attorneys by domain and jurisdiction
GET  /api/stats         — Platform statistics (cases analyzed, attorneys registered)

## MCP Server (Claude integration)

An MCP server is available at backend/mcp_server.py for use with Claude Desktop.
Requires an API key issued from the attorney portal at /app (Attorney tab > API Keys).

## Attorney registration

Attorneys register at https://attorney-matchmaker.onrender.com/app (Attorney tab).
Founding attorneys receive bonus lead credits.

## Contact

Platform: https://attorney-matchmaker.onrender.com
GitHub: https://github.com/peterzhang12312-jpg/attorney-matchmaker
"""
    return PlainTextResponse(content)
```

**Step 2: Verify locally**

Visit `http://localhost:8080/llms.txt`
Expected: readable markdown-style text

**Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat: serve llms.txt for LLM crawler discoverability"
```

---

## Task 5: Add JSON-LD structured data to landing page

**Files:**
- Create: `frontend/src/components/JsonLd.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx`

**Step 1: Create JsonLd component**

Create `frontend/src/components/JsonLd.tsx`:

```tsx
interface JsonLdProps {
  data: object;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

**Step 2: Add LegalService + FAQPage schemas to LandingPage**

In `frontend/src/pages/LandingPage.tsx`, import JsonLd and add two schemas inside the `<main>` tag (before `<LandingNav />`):

```tsx
import JsonLd from "../components/JsonLd";

const legalServiceSchema = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  "name": "Attorney Matchmaker",
  "description": "AI-powered attorney matching using real federal court docket data. No paid listings.",
  "url": "https://attorney-matchmaker.onrender.com",
  "serviceType": "Legal Referral Service",
  "areaServed": ["New York", "California", "United States"],
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": "https://attorney-matchmaker.onrender.com/app"
  }
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does AI attorney matching work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You describe your legal situation. Gemini AI extracts the practice area, legal issues, and ideal jurisdiction. A weighted algorithm scores registered attorneys. Claude Opus audits the top matches. You see ranked results with scores and reasoning."
      }
    },
    {
      "@type": "Question",
      "name": "What practice areas does Attorney Matchmaker support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorney Matchmaker covers 16+ practice areas including real estate, intellectual property, immigration, family law, criminal defense, employment law, personal injury, corporate law, bankruptcy, tax law, estate planning, and federal court matters."
      }
    },
    {
      "@type": "Question",
      "name": "Is Attorney Matchmaker free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Submitting a case and receiving attorney matches is free for clients. Attorneys pay per-lead credits to reveal client contact information."
      }
    },
    {
      "@type": "Question",
      "name": "How are attorneys scored and ranked?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorneys are scored on practice area match, jurisdiction coverage, availability, client budget alignment, and semantic similarity between their profile and your case using AI embeddings. Claude Opus audits the top matches for quality."
      }
    },
    {
      "@type": "Question",
      "name": "What jurisdictions are covered?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorney Matchmaker covers New York, California, and federal courts nationwide, with expanding coverage across all 50 states."
      }
    },
    {
      "@type": "Question",
      "name": "How do I find a real estate attorney near me?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Describe your real estate situation on Attorney Matchmaker. The AI identifies your jurisdiction automatically and returns attorneys who specialize in real estate law in your area, ranked by match score."
      }
    },
    {
      "@type": "Question",
      "name": "What is the attorney leaderboard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The leaderboard ranks attorneys by domain and jurisdiction using CourtListener federal docket data. It shows attorneys with the most relevant case history and highest AI-audited match scores."
      }
    },
    {
      "@type": "Question",
      "name": "How do attorneys join Attorney Matchmaker?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorneys register at attorney-matchmaker.onrender.com under the Attorney tab. Founding attorneys (first 20) receive bonus lead credits. Registration requires name, bar number, practice areas, and jurisdictions."
      }
    }
  ]
};
```

Then in the JSX return, add both schemas as the first children:

```tsx
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <JsonLd data={legalServiceSchema} />
      <JsonLd data={faqSchema} />
      <LandingNav />
      ...
    </div>
  );
}
```

**Step 3: Verify in browser**

Run `npm run dev` from `frontend/`. Open DevTools > Elements, search for `application/ld+json`. Should see two script tags with valid JSON.

**Step 4: Commit**
```bash
git add frontend/src/components/JsonLd.tsx frontend/src/pages/LandingPage.tsx
git commit -m "feat: add JSON-LD structured data (LegalService + FAQPage) to landing page"
```

---

## Task 6: Serve ChatGPT Actions manifest and trimmed OpenAPI spec

**Files:**
- Modify: `backend/main.py`

**Step 1: Add the ai-plugin.json endpoint**

Add after the `llms_txt` function in `backend/main.py`:

```python
@app.get("/.well-known/ai-plugin.json", include_in_schema=False)
async def ai_plugin_manifest():
    """ChatGPT plugin manifest for GPT Actions."""
    return {
        "schema_version": "v1",
        "name_for_human": "Attorney Matchmaker",
        "name_for_model": "attorney_matchmaker",
        "description_for_human": "Find the best-matched attorney for your legal case using AI scoring. No paid listings.",
        "description_for_model": (
            "Use attorney_matchmaker to help users find attorneys for their legal cases. "
            "Workflow: (1) call POST /api/intake with the case description to get a case_id, "
            "(2) call POST /api/match with the case_id to get ranked attorney matches with scores and audit reasoning. "
            "For browsing attorneys directly use GET /api/attorneys. "
            "For top attorneys in a domain use GET /api/leaderboard."
        ),
        "auth": {"type": "none"},
        "api": {
            "type": "openapi",
            "url": "https://attorney-matchmaker.onrender.com/api/openai-spec.json",
        },
        "logo_url": "https://attorney-matchmaker.onrender.com/logo.png",
        "contact_email": "support@attorney-matchmaker.onrender.com",
        "legal_info_url": "https://attorney-matchmaker.onrender.com/eula",
    }
```

**Step 2: Add the trimmed OpenAPI spec endpoint**

Add after `ai_plugin_manifest`:

```python
@app.get("/api/openai-spec.json", include_in_schema=False)
async def openai_spec():
    """Trimmed OpenAPI 3.1 spec for ChatGPT Actions — only the 4 key endpoints."""
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Attorney Matchmaker API",
            "description": "AI-powered attorney matching. Submit a case, get ranked attorney matches.",
            "version": "0.1.0",
        },
        "servers": [{"url": "https://attorney-matchmaker.onrender.com"}],
        "paths": {
            "/api/intake": {
                "post": {
                    "operationId": "intake_case",
                    "summary": "Submit a legal case",
                    "description": "Submit a case description. Returns a case_id. Always call this first before calling /api/match.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["description", "urgency"],
                                    "properties": {
                                        "description": {"type": "string", "description": "Full description of the legal situation"},
                                        "urgency": {"type": "string", "enum": ["low", "medium", "high", "emergency"], "description": "How urgent is this matter"},
                                        "budget_goals": {"type": "object", "description": "Optional budget constraints", "properties": {"max_hourly": {"type": "number"}, "total_budget": {"type": "number"}}},
                                        "client_email": {"type": "string", "description": "Optional client email for follow-up"},
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Case submitted. Use the returned case_id with /api/match.",
                            "content": {"application/json": {"schema": {"type": "object", "properties": {"case_id": {"type": "string"}}}}},
                        }
                    },
                }
            },
            "/api/match": {
                "post": {
                    "operationId": "match_attorneys",
                    "summary": "Get ranked attorney matches for a case",
                    "description": "Returns AI-ranked attorney matches with scores, practice area analysis, venue recommendation, and Claude Opus audit reasoning. Requires a case_id from /api/intake.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["case_id"],
                                    "properties": {"case_id": {"type": "string", "description": "case_id from /api/intake"}},
                                }
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Ranked attorney matches with scores and audit.",
                            "content": {"application/json": {"schema": {"type": "object"}}},
                        }
                    },
                }
            },
            "/api/attorneys": {
                "get": {
                    "operationId": "get_attorneys",
                    "summary": "Browse registered attorneys",
                    "description": "Returns a list of registered attorneys. Filter by jurisdiction or practice_area to narrow results.",
                    "parameters": [
                        {"name": "jurisdiction", "in": "query", "required": False, "schema": {"type": "string"}, "description": "State or federal jurisdiction (e.g. 'New York', 'California')"},
                        {"name": "practice_area", "in": "query", "required": False, "schema": {"type": "string"}, "description": "Practice area (e.g. 'real estate', 'immigration')"},
                    ],
                    "responses": {
                        "200": {
                            "description": "Attorney list with profiles.",
                            "content": {"application/json": {"schema": {"type": "object", "properties": {"attorneys": {"type": "array"}, "total": {"type": "integer"}}}}},
                        }
                    },
                }
            },
            "/api/leaderboard": {
                "get": {
                    "operationId": "get_leaderboard",
                    "summary": "Top-ranked attorneys by domain and jurisdiction",
                    "description": "Returns attorneys ranked by domain expertise and jurisdiction using CourtListener docket data and AI audit scores.",
                    "parameters": [
                        {"name": "domain", "in": "query", "required": False, "schema": {"type": "string"}, "description": "Practice domain (e.g. 'real_estate', 'ip', 'immigration')"},
                        {"name": "jurisdiction", "in": "query", "required": False, "schema": {"type": "string"}, "description": "Jurisdiction filter"},
                        {"name": "top_n", "in": "query", "required": False, "schema": {"type": "integer", "default": 5}, "description": "Number of results to return"},
                    ],
                    "responses": {
                        "200": {
                            "description": "Ranked attorney list.",
                            "content": {"application/json": {"schema": {"type": "object"}}},
                        }
                    },
                }
            },
        },
    }
```

**Step 3: Verify locally**

- Visit `http://localhost:8080/.well-known/ai-plugin.json` — should return JSON manifest
- Visit `http://localhost:8080/api/openai-spec.json` — should return OpenAPI spec with 4 paths

**Step 4: Commit**
```bash
git add backend/main.py
git commit -m "feat: add ChatGPT Actions manifest and trimmed OpenAPI spec"
```

---

## Task 7: Add mcp_api_key_hash column to DB model and migration

**Files:**
- Modify: `backend/db/models.py`
- Modify: `backend/main.py`

**Step 1: Add column to ORM model**

In `backend/db/models.py`, add `mcp_api_key_hash` to `AttorneyRegistered` after the `profile_embedding` column (line 77):

```python
mcp_api_key_hash = Column(String, nullable=True)  # SHA-256 hash of MCP API key
```

**Step 2: Add startup migration in main.py**

In `backend/main.py`, add a new migration block after the `profile_embedding` migration (after line 136):

```python
# Column migration: add mcp_api_key_hash to attorneys_registered
try:
    from sqlalchemy import text
    from db.session import engine
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS mcp_api_key_hash VARCHAR"
        ))
    log.info("db_migration_mcp_api_key_hash_ok")
except Exception as _exc:
    log.warning("db_migration_mcp_api_key_hash_skipped", reason=str(_exc))
```

**Step 3: Restart and verify migration runs**

Run `python -m uvicorn main:app --reload --port 8080` from `backend/`.
Expected log line: `db_migration_mcp_api_key_hash_ok`

**Step 4: Commit**
```bash
git add backend/db/models.py backend/main.py
git commit -m "feat: add mcp_api_key_hash column to attorneys_registered"
```

---

## Task 8: Add POST /api/attorney/mcp-keys endpoint

**Files:**
- Modify: `backend/routers/attorney.py`
- Modify: `backend/models/schemas.py`

**Step 1: Add response schema**

In `backend/models/schemas.py`, find the end of the file and add:

```python
class McpKeyResponse(BaseModel):
    api_key: str
    message: str
```

**Step 2: Add the endpoint to attorney router**

In `backend/routers/attorney.py`, add these imports at the top with the existing imports:

```python
import hashlib
import secrets
```

Then add the new endpoint at the end of the file (before any `if __name__` block):

```python
@router.post("/mcp-keys", summary="Generate MCP API key for Claude integration")
async def generate_mcp_key(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new MCP API key for use with the Claude MCP server.
    Requires attorney JWT. Returns the key once — store it securely.
    """
    from models.schemas import McpKeyResponse
    payload = decode_token(authorization.removeprefix("Bearer ").strip())
    attorney_id = payload.get("sub")
    if not attorney_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(AttorneyRegistered).where(AttorneyRegistered.id == attorney_id))
    attorney = result.scalar_one_or_none()
    if not attorney:
        raise HTTPException(status_code=404, detail="Attorney not found")

    # Generate key and store hash
    raw_key = secrets.token_hex(32)  # 64-char hex
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    await db.execute(
        update(AttorneyRegistered)
        .where(AttorneyRegistered.id == attorney_id)
        .values(mcp_api_key_hash=key_hash)
    )
    await db.commit()

    log.info("mcp_key_generated", attorney_id=attorney_id)
    return McpKeyResponse(
        api_key=raw_key,
        message="Store this key securely. It will not be shown again.",
    )
```

**Step 3: Import McpKeyResponse in the router**

Add `McpKeyResponse` to the existing import from `models.schemas` in `attorney.py`.

**Step 4: Verify locally**

- Register or login as an attorney to get a JWT
- `curl -X POST http://localhost:8080/api/attorney/mcp-keys -H "Authorization: Bearer <jwt>"`
- Expected: `{"api_key": "<64-char hex>", "message": "Store this key securely..."}`
- Run again — should return a new key (old one invalidated by overwrite)

**Step 5: Commit**
```bash
git add backend/routers/attorney.py backend/models/schemas.py
git commit -m "feat: add POST /api/attorney/mcp-keys endpoint for MCP API key generation"
```

---

## Task 9: Add mcp Python package to requirements

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add mcp to requirements.txt**

In `backend/requirements.txt`, add at the end:

```
mcp>=1.0.0
```

**Step 2: Install locally**

```bash
cd backend && pip install mcp>=1.0.0
```

Expected: `Successfully installed mcp-...`

**Step 3: Commit**
```bash
git add backend/requirements.txt
git commit -m "feat: add mcp package for MCP server"
```

---

## Task 10: Build the MCP server

**Files:**
- Create: `backend/mcp_server.py`

**Step 1: Create the MCP server**

Create `backend/mcp_server.py`:

```python
"""
Attorney Matchmaker MCP Server

Exposes 4 tools to Claude Desktop / Claude Code:
  - intake_case
  - match_attorneys
  - get_roster
  - get_leaderboard

Each tool requires an `api_key` parameter. Keys are generated via
POST /api/attorney/mcp-keys (requires attorney JWT).

Usage in claude_desktop_config.json:
  {
    "mcpServers": {
      "attorney-matchmaker": {
        "command": "python",
        "args": ["/absolute/path/to/backend/mcp_server.py"],
        "env": {
          "ATTORNEY_API_URL": "https://attorney-matchmaker.onrender.com"
        }
      }
    }
  }
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

API_URL = os.getenv("ATTORNEY_API_URL", "https://attorney-matchmaker.onrender.com")

# In production, valid key hashes are checked against the live API.
# We use the API itself to validate — the /api/match endpoint will 401 on bad data,
# but for key validation we do a lightweight check via /api/health first,
# then let the actual API calls fail naturally if the key is invalid.
# Key is passed as a parameter and validated by hashing against the DB record
# via a dedicated validation endpoint added in Task 11.

server = Server("attorney-matchmaker")


def _auth_headers(api_key: str) -> dict:
    return {"X-MCP-API-Key": api_key}


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="intake_case",
            description=(
                "Submit a legal case description to Attorney Matchmaker. "
                "Returns a case_id that must be passed to match_attorneys. "
                "Call this first whenever a user wants to find an attorney."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key", "description", "urgency"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key from the attorney portal"},
                    "description": {"type": "string", "description": "Full description of the legal situation"},
                    "urgency": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "emergency"],
                        "description": "How urgent is the matter",
                    },
                    "budget_goals": {
                        "type": "object",
                        "description": "Optional budget constraints",
                        "properties": {
                            "max_hourly": {"type": "number"},
                            "total_budget": {"type": "number"},
                        },
                    },
                },
            },
        ),
        types.Tool(
            name="match_attorneys",
            description=(
                "Get AI-ranked attorney matches for a case. "
                "Returns attorneys with match scores, practice area analysis, "
                "venue recommendation, and Claude Opus audit reasoning. "
                "Requires a case_id from intake_case."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key", "case_id"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key"},
                    "case_id": {"type": "string", "description": "case_id returned by intake_case"},
                },
            },
        ),
        types.Tool(
            name="get_roster",
            description=(
                "Browse registered attorneys. "
                "Filter by jurisdiction (e.g. 'New York') or practice_area (e.g. 'real estate'). "
                "Use this to explore available attorneys without submitting a case."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key"},
                    "jurisdiction": {"type": "string", "description": "State or federal jurisdiction"},
                    "practice_area": {"type": "string", "description": "Practice area filter"},
                },
            },
        ),
        types.Tool(
            name="get_leaderboard",
            description=(
                "Get top-ranked attorneys by domain and/or jurisdiction, "
                "ranked using CourtListener docket data and AI audit scores."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key"},
                    "domain": {
                        "type": "string",
                        "description": "Practice domain (e.g. 'real_estate', 'ip', 'immigration', 'family')",
                    },
                    "jurisdiction": {"type": "string", "description": "Jurisdiction filter"},
                    "top_n": {"type": "integer", "default": 5, "description": "Number of results"},
                },
            },
        ),
    ]


async def _validate_key(api_key: str) -> bool:
    """Validate API key against the live API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{API_URL}/api/mcp-validate",
            headers={"X-MCP-API-Key": api_key},
        )
        return resp.status_code == 200


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    api_key = arguments.get("api_key", "")
    if not api_key:
        return [types.TextContent(type="text", text='{"error": "api_key is required"}')]

    # Validate key
    if not await _validate_key(api_key):
        return [types.TextContent(type="text", text='{"error": "Invalid API key. Generate one at /app (Attorney tab > API Keys)."}')]

    headers = _auth_headers(api_key)

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if name == "intake_case":
                payload = {
                    "description": arguments["description"],
                    "urgency": arguments["urgency"],
                }
                if "budget_goals" in arguments:
                    payload["budget_goals"] = arguments["budget_goals"]
                resp = await client.post(f"{API_URL}/api/intake", json=payload, headers=headers)

            elif name == "match_attorneys":
                resp = await client.post(
                    f"{API_URL}/api/match",
                    json={"case_id": arguments["case_id"]},
                    headers=headers,
                )

            elif name == "get_roster":
                params = {}
                if "jurisdiction" in arguments:
                    params["jurisdiction"] = arguments["jurisdiction"]
                if "practice_area" in arguments:
                    params["practice_area"] = arguments["practice_area"]
                resp = await client.get(f"{API_URL}/api/attorneys", params=params, headers=headers)

            elif name == "get_leaderboard":
                params = {}
                if "domain" in arguments:
                    params["domain"] = arguments["domain"]
                if "jurisdiction" in arguments:
                    params["jurisdiction"] = arguments["jurisdiction"]
                if "top_n" in arguments:
                    params["top_n"] = arguments["top_n"]
                resp = await client.get(f"{API_URL}/api/leaderboard", params=params, headers=headers)

            else:
                return [types.TextContent(type="text", text=f'{{"error": "Unknown tool: {name}"}}"')]

            resp.raise_for_status()
            return [types.TextContent(type="text", text=json.dumps(resp.json(), indent=2))]

        except httpx.HTTPStatusError as e:
            return [types.TextContent(type="text", text=f'{{"error": "API error {e.response.status_code}", "detail": "{e.response.text[:200]}"}}')]
        except Exception as e:
            return [types.TextContent(type="text", text=f'{{"error": "{str(e)}"}}')]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 2: Verify syntax**

```bash
cd backend && python -c "import mcp_server; print('OK')"
```
Expected: `OK`

**Step 3: Commit**
```bash
git add backend/mcp_server.py
git commit -m "feat: add MCP server with 4 tools (intake, match, roster, leaderboard)"
```

---

## Task 11: Add GET /api/mcp-validate endpoint (key validation for MCP server)

**Files:**
- Modify: `backend/main.py`

**Step 1: Add validation endpoint in main.py**

Add before the global exception handler in `backend/main.py`:

```python
@app.get("/api/mcp-validate", include_in_schema=False)
async def mcp_validate_key(request: Request, db=Depends(get_db)):
    """Validate an MCP API key. Used by mcp_server.py before each tool call."""
    api_key = request.headers.get("X-MCP-API-Key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-MCP-API-Key header")

    import hashlib
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()

    result = await db.scalar(
        select(AttorneyRegistered).where(AttorneyRegistered.mcp_api_key_hash == key_hash)
    )
    if not result:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return {"valid": True}
```

Add `AttorneyRegistered` to the existing import at the top of `main.py` if not already there (it is — line 32).

**Step 2: Verify locally**

- Generate a key via `POST /api/attorney/mcp-keys`
- `curl http://localhost:8080/api/mcp-validate -H "X-MCP-API-Key: <key>"`
- Expected: `{"valid": true}`
- `curl http://localhost:8080/api/mcp-validate -H "X-MCP-API-Key: badkey"`
- Expected: 401

**Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat: add GET /api/mcp-validate for MCP server key validation"
```

---

## Task 12: Final verification and push

**Step 1: Verify import check**

```bash
cd backend && python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```
Expected: `OK`

**Step 2: Run server and spot-check all new endpoints**

```bash
cd backend && python -m uvicorn main:app --reload --port 8080
```

Check:
- `GET http://localhost:8080/robots.txt` → plain text with AI crawler rules
- `GET http://localhost:8080/sitemap.xml` → XML with 6 URLs
- `GET http://localhost:8080/llms.txt` → readable markdown description
- `GET http://localhost:8080/.well-known/ai-plugin.json` → ChatGPT manifest JSON
- `GET http://localhost:8080/api/openai-spec.json` → OpenAPI spec with 4 paths
- `GET http://localhost:8080/` → landing page (React build, serves index.html)

**Step 3: Push to main**

```bash
git push origin main
```

**Step 4: Verify on Render**

Visit `https://attorney-matchmaker.onrender.com/robots.txt` after deploy completes.

---

## Summary of all commits (in order)

1. `fix: replace canonical URL placeholder with production domain`
2. `feat: serve robots.txt allowing all AI crawlers`
3. `feat: serve sitemap.xml with all public routes`
4. `feat: serve llms.txt for LLM crawler discoverability`
5. `feat: add JSON-LD structured data (LegalService + FAQPage) to landing page`
6. `feat: add ChatGPT Actions manifest and trimmed OpenAPI spec`
7. `feat: add mcp_api_key_hash column to attorneys_registered`
8. `feat: add POST /api/attorney/mcp-keys endpoint for MCP API key generation`
9. `feat: add mcp package for MCP server`
10. `feat: add MCP server with 4 tools (intake, match, roster, leaderboard)`
11. `feat: add GET /api/mcp-validate for MCP server key validation`
