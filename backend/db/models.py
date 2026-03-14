"""
SQLAlchemy 2.0 async ORM models for the Attorney Matchmaker.

Tables:
  - cases: stores intake submissions (facts, urgency, budget, advanced fields)
  - match_results: stores pipeline output per case (matches JSON, audit, venue)
"""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Case(Base):
    __tablename__ = "cases"

    case_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    description = Column(Text, nullable=False)
    urgency = Column(String, nullable=False, default="medium")
    budget_goals = Column(JSON, nullable=True)
    advanced_fields = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    match_results = relationship(
        "MatchResult",
        back_populates="case",
        cascade="all, delete-orphan",
    )


class MatchResult(Base):
    __tablename__ = "match_results"

    match_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(
        String,
        ForeignKey("cases.case_id", ondelete="CASCADE"),
        nullable=False,
    )
    matches = Column(JSON, nullable=True)
    audit = Column(Text, nullable=True)
    venue_recommendation = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="match_results")
