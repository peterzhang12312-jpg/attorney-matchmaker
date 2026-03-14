"""
Fact-Pattern Attorney Matchmaker -- FastAPI application entry point.

Run with:
    python -m uvicorn main:app --reload --port 8080

Or via the convenience script:
    python main.py
"""

from __future__ import annotations

import logging
import os
import pathlib
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from models.schemas import ErrorResponse, HealthResponse
from routers import attorneys, intake, leaderboard, match, refine

# ---------------------------------------------------------------------------
# Environment & logging
# ---------------------------------------------------------------------------

load_dotenv()  # reads .env in the project root

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# Path to the built React frontend (relative to this file's location)
_HERE = pathlib.Path(__file__).parent
FRONTEND_DIST = _HERE.parent / "frontend" / "dist"


# ---------------------------------------------------------------------------
# Required environment variables — crash fast if any are missing
# ---------------------------------------------------------------------------

_REQUIRED_KEYS = {
    "GEMINI_API_KEY":          "Gemini fact-pattern analysis",
    "ANTHROPIC_API_KEY":       "Claude Opus audit layer",
    "COURTLISTENER_API_TOKEN": "CourtListener RECAP docket search",
}


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
    logger.info("CORS origins whitelisted: %s", cors_origins)

    missing = [
        f"  {k}  ({desc})"
        for k, desc in _REQUIRED_KEYS.items()
        if not os.getenv(k, "").strip()
    ]
    if missing:
        logger.critical(
            "FATAL: Required environment variables are not set:\n%s\n"
            "Add them to .env and restart.",
            "\n".join(missing),
        )
        sys.exit(1)

    if FRONTEND_DIST.exists():
        logger.info("Serving frontend from %s", FRONTEND_DIST)
    else:
        logger.warning("Frontend dist not found at %s — API-only mode", FRONTEND_DIST)

    # Initialize database tables (no-op if they already exist)
    from db.session import init_db
    await init_db()
    logger.info("Database initialized")

    logger.info("Fact-Pattern Attorney Matchmaker starting up")
    yield
    # --- Shutdown ----------------------------------------------------------
    logger.info("Fact-Pattern Attorney Matchmaker shutting down")


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

# Debug router — only active when DEBUG=true in .env
if os.getenv("DEBUG", "").lower() in ("true", "1"):
    from routers import debug
    app.include_router(debug.router)
    logger.info("Debug router enabled: GET /api/debug/intelligence-check")


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
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="internal_server_error",
            detail="An unexpected error occurred. Check server logs for details.",
        ).model_dump(),
    )


# ---------------------------------------------------------------------------
# Static file serving — React SPA (must come AFTER all API routes)
# ---------------------------------------------------------------------------

if FRONTEND_DIST.exists():
    # Serve /assets/* directly (JS, CSS, fonts, images)
    _assets = FRONTEND_DIST / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        """Serve the React SPA. Returns a specific static file if it exists,
        otherwise falls back to index.html so React Router handles routing."""
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
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level=LOG_LEVEL.lower(),
    )
