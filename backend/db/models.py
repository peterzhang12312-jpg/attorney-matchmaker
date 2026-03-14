"""
SQLAlchemy 2.0 async ORM models for the Attorney Matchmaker.

Tables:
  - cases: stores intake submissions (facts, urgency, budget, advanced fields)
  - match_results: stores pipeline output per case (matches JSON, audit, venue)
  - attorneys_registered: self-onboarded attorney profiles
  - leads: case-to-attorney lead assignments
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
    client_email = Column(String, nullable=True)
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


class AttorneyRegistered(Base):
    """Self-onboarded attorney profile with auth credentials."""

    __tablename__ = "attorneys_registered"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)
    bar_number = Column(String, nullable=True)
    firm = Column(String, nullable=True)
    jurisdictions = Column(JSON, nullable=True)    # list of strings
    practice_areas = Column(JSON, nullable=True)   # list of strings
    hourly_rate = Column(String, nullable=True)    # store as string e.g. "350"
    availability = Column(String, nullable=True, default="available")
    accepting_clients = Column(String, nullable=True, default="true")
    source = Column(String, nullable=False, default="self_registered")
    is_founding = Column(String, nullable=True, default="false")  # first 20 attorneys
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    leads = relationship("Lead", back_populates="attorney", cascade="all, delete-orphan")


class Lead(Base):
    """Case-to-attorney lead assignment with response tracking."""

    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(
        String,
        ForeignKey("cases.case_id", ondelete="CASCADE"),
        nullable=False,
    )
    attorney_id = Column(
        String,
        ForeignKey("attorneys_registered.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(String, nullable=False, default="sent")  # sent/viewed/accepted/declined
    case_summary = Column(JSON, nullable=True)  # practice_area, urgency, jurisdiction -- NO PII
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)

    attorney = relationship("AttorneyRegistered", back_populates="leads")
