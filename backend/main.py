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

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from starlette.middleware.base import BaseHTTPMiddleware

from middleware.logging_config import setup_logging
from middleware.rate_limit import limiter
from models.schemas import ErrorResponse, HealthResponse
from routers import attorneys, attorney, intake, leaderboard, match, refine, linkedin_auth, case_lookup, stripe_webhook

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
