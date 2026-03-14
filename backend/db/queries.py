"""
Reusable database query helpers.

Shared between intake and match routers so neither imports from the other.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case


async def get_case(case_id: str, db: AsyncSession) -> Case | None:
    """Retrieve a Case by primary key. Returns None if not found."""
    result = await db.execute(select(Case).where(Case.case_id == case_id))
    return result.scalar_one_or_none()
