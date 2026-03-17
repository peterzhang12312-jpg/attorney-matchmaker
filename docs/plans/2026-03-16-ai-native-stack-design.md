# AI-Native Stack Design
**Date:** 2026-03-16
**Goal:** Increase discoverability and usability by ChatGPT, Claude, and Gemini
**Scope:** Crawlability layer + ChatGPT Actions + MCP Server (API-key-gated)

---

## Overview

Two complementary layers:

1. **Crawlability Layer** — Passive discoverability. AI crawlers can index the site and cite it in answers. Costs nothing to maintain, compounds over time.
2. **Tool Integration** — Active usability. AI assistants can call the API as a tool when users ask "find me a lawyer." ChatGPT via Actions, Claude via MCP server.

---

## Section 1: Crawlability Layer

### robots.txt (`/robots.txt`)
Served as a static file by FastAPI. Explicitly allows all major AI crawlers:
- `GPTBot` (OpenAI)
- `ClaudeBot` (Anthropic)
- `Google-Extended` (Gemini training)
- `PerplexityBot`
- `Bytespider` (ByteDance/TikTok AI)

Points to sitemap at canonical Render URL.

### sitemap.xml (`/sitemap.xml`)
Generated and served by FastAPI (not a static file — allows future dynamic attorney pages).
Pages included with priorities:
- `/` (1.0)
- `/app` (0.9)
- `/blog` (0.8)
- `/blog/:slug` for each post (0.7)
- `/case-lookup` (0.7)
- `/coverage` (0.6)
- `/leaderboard` (0.6)

### llms.txt (`/llms.txt`)
Plain markdown at root. Emerging standard for LLM crawlers (like robots.txt but human-readable prose). Describes:
- What the service does
- What the API can do (intake, match, roster, leaderboard)
- How attorneys register and get an API key
- Link to OpenAPI spec and MCP server docs

### JSON-LD Structured Data
Injected via `<script type="application/ld+json">` in React pages:

| Page | Schema Type | Key Fields |
|------|------------|-----------|
| Landing (`/`) | `LegalService` + `Organization` | name, description, url, areaServed, serviceType |
| Landing (`/`) | `FAQPage` | 8 Q&A pairs about AI matching, practice areas, pricing |
| Leaderboard (`/leaderboard`) | `ItemList` | Top attorneys as `ListItem` entries |

FAQ questions target natural-language queries LLMs receive:
- "How does AI attorney matching work?"
- "What practice areas does Attorney Matchmaker support?"
- "Is Attorney Matchmaker free to use?"
- "How are attorneys scored and ranked?"
- "What jurisdictions are covered?"
- "How do I find a real estate attorney near me?"
- "What is the attorney leaderboard?"
- "How do attorneys join Attorney Matchmaker?"

---

## Section 2: ChatGPT Actions

### `/.well-known/ai-plugin.json`
Plugin manifest served by FastAPI. No auth required (public read endpoints). Fields:
- `name_for_model`: `attorney_matchmaker`
- `description_for_model`: Rich prose telling ChatGPT when and how to use each tool
- Points to trimmed OpenAPI spec at `/api/openai-spec.json`

### `/api/openai-spec.json`
Manually crafted trimmed OpenAPI 3.1 spec (not the full FastAPI auto-generated one). Exposes 4 endpoints only:

| Endpoint | Method | LLM Description |
|----------|--------|----------------|
| `/api/intake` | POST | "Submit a legal case. Call this first. Returns case_id for use with /api/match." |
| `/api/match` | POST | "Get AI-ranked attorney matches for a case_id. Returns scores, audit, venue recommendation." |
| `/api/attorneys` | GET | "Browse registered attorneys. Filter by jurisdiction or practice_area." |
| `/api/leaderboard` | GET | "Get top-ranked attorneys by domain and/or jurisdiction." |

Each endpoint description written for LLM consumption — explicit about call order and what to do with results.

---

## Section 3: MCP Server (Claude API-Key-Gated)

### File: `backend/mcp_server.py`
Standalone MCP server using the `mcp` Python library. Runs via `stdio` transport as a separate process. Acts as a thin authenticated proxy to the live Render API.

### Authentication
- Every tool call requires an `api_key` parameter
- Keys stored in backend `.env` as `MCP_API_KEYS` (comma-separated)
- Invalid key → structured MCP error, no data returned
- Keys issued via new `POST /api/mcp-keys` endpoint (requires attorney JWT auth)

### Tools

| Tool | Parameters | Returns |
|------|-----------|---------|
| `intake_case` | `api_key`, `description`, `urgency` (low/medium/high/emergency), `budget_goals?` | `case_id`, extracted facts |
| `match_attorneys` | `api_key`, `case_id` | Ranked attorney list with scores, audit reasoning, venue recommendation |
| `get_roster` | `api_key`, `jurisdiction?`, `practice_area?` | Attorney list with profiles |
| `get_leaderboard` | `api_key`, `domain?`, `jurisdiction?`, `top_n?` | Top attorneys with scores |

### Distribution
Users configure in `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "attorney-matchmaker": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"],
      "env": {
        "ATTORNEY_API_URL": "https://attorney-matchmaker.onrender.com"
      }
    }
  }
}
```

`mcp_server.py` is a standalone file — no backend install required. Reads `ATTORNEY_API_URL` from env, makes HTTP calls to the live API.

### New Backend Endpoint
`POST /api/mcp-keys` (attorney JWT required):
- Generates a random 32-byte hex key
- Stores hashed version in `attorneys_registered.mcp_api_key_hash`
- Returns plaintext key once (not stored plaintext)

---

## Implementation Order

1. Crawlability layer (robots.txt, sitemap.xml, llms.txt, JSON-LD) — backend + frontend changes
2. ChatGPT Actions (ai-plugin.json, openai-spec.json) — backend only
3. MCP server (mcp_server.py, mcp-keys endpoint, DB migration) — backend + new file

---

## Files Changed

### Backend
- `main.py` — serve robots.txt, sitemap.xml, llms.txt, ai-plugin.json
- `routers/attorney.py` — add `POST /api/mcp-keys`
- `db/models.py` — add `mcp_api_key_hash` column to `attorneys_registered`
- `backend/mcp_server.py` — new standalone MCP server file
- `requirements.txt` — add `mcp` package

### Frontend
- `frontend/index.html` — fix canonical URL placeholder
- `pages/LandingPage.tsx` — inject JSON-LD (LegalService, FAQPage)
- `pages/LeaderboardView.tsx` or router — inject JSON-LD (ItemList)

### New Files
- `backend/mcp_server.py`
- `docs/plans/2026-03-16-ai-native-stack-design.md` (this file)
