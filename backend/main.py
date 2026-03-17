"""
Fact-Pattern Attorney Matchmaker -- FastAPI application entry point.

Run with:
    python -m uvicorn main:app --reload --port 8080

Or via the convenience script:
    python main.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import uuid
from contextlib import asynccontextmanager

import time

import structlog
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from sqlalchemy import func, select
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from starlette.middleware.base import BaseHTTPMiddleware

from db.models import AttorneyRegistered, Case, Lead
from db.session import get_db
from middleware.logging_config import setup_logging
from middleware.rate_limit import limiter
from models.schemas import ErrorResponse, HealthResponse
from routers import attorneys, attorney, intake, leaderboard, match, refine, linkedin_auth, case_lookup, stripe_webhook, jobs, coverage, dashboard, cron, timeline

# ---------------------------------------------------------------------------
# Environment & logging
# ---------------------------------------------------------------------------

load_dotenv()  # reads .env in the project root

setup_logging()
log = structlog.get_logger()

# Path to the built React frontend (relative to this file's location)
_HERE = pathlib.Path(__file__).parent
FRONTEND_DIST = _HERE.parent / "frontend" / "dist"


# ---------------------------------------------------------------------------
# Required environment variables -- crash fast if any are missing
# ---------------------------------------------------------------------------

_REQUIRED_KEYS = {
    "GEMINI_API_KEY":          "Gemini fact-pattern analysis",
    "ANTHROPIC_API_KEY":       "Claude Opus audit layer",
    "COURTLISTENER_API_TOKEN": "CourtListener RECAP docket search",
}


# ---------------------------------------------------------------------------
# X-Request-ID middleware
# ---------------------------------------------------------------------------

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a unique X-Request-ID header to every response."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once at startup (before yield) and once at shutdown (after yield).
    Use this for connection pools, model warm-up, etc.
    """
    # --- Startup -----------------------------------------------------------
    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    log.info("cors_origins_whitelisted", origins=cors_origins)

    missing = [
        f"  {k}  ({desc})"
        for k, desc in _REQUIRED_KEYS.items()
        if not os.getenv(k, "").strip()
    ]
    if missing:
        log.critical(
            "required_env_vars_missing",
            missing=missing,
        )
        sys.exit(1)

    if FRONTEND_DIST.exists():
        log.info("serving_frontend", path=str(FRONTEND_DIST))
    else:
        log.warning("frontend_dist_not_found", path=str(FRONTEND_DIST))

    # Initialize database tables (no-op if they already exist)
    from db.session import init_db
    await init_db()
    log.info("database_initialized")

    # Column migration: add credits to attorneys_registered if it doesn't exist yet
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0"
            ))
        log.info("db_migration_credits_column_ok")
    except Exception as _exc:
        log.warning("db_migration_credits_column_skipped", reason=str(_exc))

    # Column migration: add profile_embedding to attorneys_registered
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS profile_embedding JSON"
            ))
        log.info("db_migration_profile_embedding_ok")
    except Exception as _exc:
        log.warning("db_migration_profile_embedding_skipped", reason=str(_exc))

    log.info("startup_complete", app="Fact-Pattern Attorney Matchmaker")
    yield
    # --- Shutdown ----------------------------------------------------------
    log.info("shutdown_complete", app="Fact-Pattern Attorney Matchmaker")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Fact-Pattern Attorney Matchmaker",
    description=(
        "Ingests case facts, uses Gemini to extract legal issues and jurisdiction, "
        "scores attorneys via a weighted matching algorithm, and validates the "
        "top matches with Claude Opus."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- Rate limiter ----------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Request ID middleware -------------------------------------------------
app.add_middleware(RequestIDMiddleware)

# --- CORS ------------------------------------------------------------------
# In production with the frontend served from this same origin, CORS is not
# strictly needed. But we keep it for any external API consumers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---------------------------------------------------------------
app.include_router(intake.router)
app.include_router(match.router)
app.include_router(attorneys.router)
app.include_router(refine.router)
app.include_router(leaderboard.router)
app.include_router(attorney.router)
app.include_router(linkedin_auth.router)
app.include_router(case_lookup.router)
app.include_router(stripe_webhook.router)
app.include_router(jobs.router)
app.include_router(coverage.router)
app.include_router(dashboard.router)
app.include_router(cron.router)
app.include_router(timeline.router)

# Debug router -- only active when DEBUG=true in .env
if os.getenv("DEBUG", "").lower() in ("true", "1"):
    from routers import debug
    app.include_router(debug.router)
    log.info("debug_router_enabled", endpoint="/api/debug/intelligence-check")


# --- Health check ----------------------------------------------------------

@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["system"],
    summary="Service health check",
)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="0.1.0",
        gemini_configured=bool(os.getenv("GEMINI_API_KEY")),
        claude_configured=bool(os.getenv("ANTHROPIC_API_KEY")),
        courtlistener_configured=bool(os.getenv("COURTLISTENER_API_TOKEN")),
    )


# --- Platform stats -----------------------------------------------------------

_stats_cache: dict = {"data": None, "at": 0.0}
STATS_TTL = 60.0  # seconds

@app.get("/api/stats", tags=["system"], summary="Aggregate platform statistics")
@limiter.limit("60/minute")
async def get_platform_stats(request: Request, db=Depends(get_db)):
    now = time.monotonic()
    if _stats_cache["data"] and now - _stats_cache["at"] < STATS_TTL:
        return _stats_cache["data"]

    cases_count = await db.scalar(select(func.count()).select_from(Case))
    attorneys_count = await db.scalar(select(func.count()).select_from(AttorneyRegistered))
    leads_accepted = await db.scalar(
        select(func.count()).select_from(Lead).where(Lead.status == "accepted")
    )
    data = {
        "cases_analyzed": int(cases_count or 0),
        "attorneys_registered": int(attorneys_count or 0),
        "leads_accepted": int(leads_accepted or 0),
        "practice_areas": 16,
        "jurisdictions": 9,
    }
    _stats_cache["data"] = data
    _stats_cache["at"] = now
    return data


# --- Global exception handler ---------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unhandled exceptions.  Logs the full traceback and
    returns a structured error response rather than leaking internals.
    """
    log.exception(
        "unhandled_exception",
        method=request.method,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="internal_server_error",
            detail="An unexpected error occurred. Check server logs for details.",
        ).model_dump(),
    )


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

POST /api/intake        -- Submit a case description, returns case_id
POST /api/match         -- Get ranked attorney matches for a case_id
GET  /api/attorneys     -- Browse registered attorneys (filter by jurisdiction, practice_area)
GET  /api/leaderboard   -- Top attorneys by domain and jurisdiction
GET  /api/stats         -- Platform statistics (cases analyzed, attorneys registered)

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


@app.get("/api/openai-spec.json", include_in_schema=False)
async def openai_spec():
    """Trimmed OpenAPI 3.1 spec for ChatGPT Actions -- only the 4 key endpoints."""
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


# ---------------------------------------------------------------------------
# Static file serving -- React SPA (must come AFTER all API routes)
# ---------------------------------------------------------------------------

if FRONTEND_DIST.exists():
    # Serve /assets/* directly (JS, CSS, fonts, images)
    _assets = FRONTEND_DIST / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        """Serve the React SPA. Returns a specific static file if it exists,
        otherwise falls back to index.html so React Router handles routing.
        Also intercepts LinkedIn OAuth callbacks at the root URL."""
        from fastapi.responses import HTMLResponse as _HTML
        from routers.linkedin_auth import linkedin_callback
        if request.query_params.get("code") and request.query_params.get("state", "").startswith("amatch"):
            return await linkedin_callback(request)
        target = FRONTEND_DIST / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


# ---------------------------------------------------------------------------
# Convenience: run with `python main.py`
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    log_level = os.getenv("LOG_LEVEL", "INFO").lower()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level=log_level,
    )
