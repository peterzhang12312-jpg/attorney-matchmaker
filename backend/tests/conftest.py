"""Shared pytest fixtures for the backend test suite."""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Provide required env vars before importing the app
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("COURTLISTENER_API_TOKEN", "test-cl-token")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-at-least-32-chars-xx")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")


@pytest_asyncio.fixture
async def client():
    """Async HTTP client pointed at the test app instance."""
    # Ensure the SQLite test DB has all tables before the app starts handling requests.
    # This is needed because db/session.py creates the engine at module-import time,
    # and the lifespan init_db() may connect to Postgres if the module was already
    # cached. Calling init_db() here guarantees the SQLite schema is populated.
    from db.session import init_db
    await init_db()

    from main import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
