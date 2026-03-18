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

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
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
    client_type = Column(String, nullable=True, default="individual")
    business_fields = Column(JSON, nullable=True)
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
    credits = Column(Integer, nullable=False, default=0, server_default="0")
    profile_embedding = Column(JSON, nullable=True)   # list[float] 768-dim Gemini embedding
    mcp_api_key_hash = Column(String, nullable=True)  # SHA-256 hash of MCP API key
    webhook_config = Column(JSON, nullable=True)  # {url, secret, enabled}
    case_preferences = Column(JSON, nullable=True)  # {practice_areas?, min_budget?, jurisdictions?}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    leads = relationship("Lead", back_populates="attorney", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="owner", cascade="all, delete-orphan")


class ApiKey(Base):
    """White-label API key for external consumers."""

    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_attorney_id = Column(String, ForeignKey("attorneys_registered.id", ondelete="CASCADE"), nullable=False)
    key_hash = Column(String, nullable=False, unique=True)  # SHA-256, never store plaintext
    tier = Column(String, nullable=False, default="starter")  # starter | growth | enterprise
    daily_limit = Column(Integer, nullable=False, default=100)  # 0 = unlimited
    label = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("AttorneyRegistered", back_populates="api_keys")
    usage = relationship("ApiUsage", back_populates="api_key", cascade="all, delete-orphan")


class ApiUsage(Base):
    """Daily usage counter per API key — one row per key per day, upserted."""

    __tablename__ = "api_usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String, ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # ISO date string: "2026-03-16"
    request_count = Column(Integer, nullable=False, default=0)

    api_key = relationship("ApiKey", back_populates="usage")


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
    status = Column(String, nullable=False, default="sent")  # sent/viewed/accepted/declined/revealed
    case_summary = Column(JSON, nullable=True)  # practice_area, urgency, jurisdiction -- NO PII
    stripe_payment_intent_id = Column(String, nullable=True)
    revealed_at = Column(DateTime(timezone=True), nullable=True)
    client_contact = Column(JSON, nullable=True)  # populated after payment: {name, email, phone}
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)

    attorney = relationship("AttorneyRegistered", back_populates="leads")


class CoverageRequest(Base):
    """Demand signal when a user requests attorney coverage in a state."""

    __tablename__ = "coverage_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    state = Column(String, nullable=False)
    email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
