"""Ensure test DB tables exist before router tests run."""
import os
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("COURTLISTENER_API_TOKEN", "test-cl-token")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-at-least-32-chars-xx")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")


@pytest.fixture(autouse=True)
async def init_test_db():
    """Create all tables in the test SQLite DB before each test."""
    from db.session import init_db
    await init_db()
