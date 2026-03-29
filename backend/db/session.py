"""
Async SQLAlchemy engine and session factory.

Reads DATABASE_URL from the environment:
  - If set (e.g. postgres://...): uses PostgreSQL via asyncpg
  - If unset: falls back to a local SQLite file via aiosqlite
"""

from __future__ import annotations

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./attorney_matchmaker.db")

# Render (and many PaaS) expose postgres:// — SQLAlchemy requires postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db():
    """FastAPI dependency that yields a scoped async session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables if they don't exist. No-op for existing tables."""
    from db.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def migrate_attorney_profile_columns():
    """Add new attorney profile columns if they don't exist (idempotent)."""
    from sqlalchemy import text
    alter_statements = [
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS languages JSON",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS free_consultation BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS photo_url VARCHAR",
        "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS response_time_hours INTEGER",
    ]
    async with engine.begin() as conn:
        for stmt in alter_statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists (SQLite doesn't support IF NOT EXISTS)
