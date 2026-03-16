"""
Pydantic models defining all request/response contracts for the
Fact-Pattern Attorney Matchmaker API.

Every schema here is the single source of truth for its shape.
Routers, services, and tests import from this module -- never
define ad-hoc dicts for API boundaries.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UrgencyLevel(str, Enum):
    """How time-sensitive the matter is."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LegalArea(str, Enum):
    """Canonical practice-area taxonomy used throughout the system."""
    INTELLECTUAL_PROPERTY = "intellectual_property"
    EMPLOYMENT = "employment"
    PERSONAL_INJURY = "personal_injury"
    CORPORATE = "corporate"
    FAMILY = "family"
    CRIMINAL_DEFENSE = "criminal_defense"
    REAL_ESTATE = "real_estate"
    IMMIGRATION = "immigration"
    BANKRUPTCY = "bankruptcy"
    ENVIRONMENTAL = "environmental"
    HEALTHCARE = "healthcare"
    SECURITIES = "securities"
    TAX = "tax"
    CIVIL_RIGHTS = "civil_rights"
    GENERAL_LITIGATION = "general_litigation"


class Availability(str, Enum):
    """Current capacity to accept new matters."""
    AVAILABLE = "available"
    LIMITED = "limited"
    UNAVAILABLE = "unavailable"


# ---------------------------------------------------------------------------
# Budget & fact-refinement models
# ---------------------------------------------------------------------------

class BudgetGoals(BaseModel):
    """Stage-gated spend limits submitted by the client."""
    pretrial: Optional[float] = Field(None, ge=0, description="Max spend for pre-trial phase (USD).")
    complaint: Optional[float] = Field(None, ge=0, description="Max spend for complaint drafting (USD).")
    discovery: Optional[float] = Field(None, ge=0, description="Max spend for discovery phase (USD).")
    hearing: Optional[float] = Field(None, ge=0, description="Max spend for hearing/trial phase (USD).")
    hourly_rate_ceiling: Optional[float] = Field(None, ge=0, description="Max acceptable hourly rate (USD).")


class RefineFactsRequest(BaseModel):
    """Payload for the stateless fact-refinement endpoint."""
    facts: str = Field(..., min_length=20, max_length=5_000)

    @field_validator("facts")
    @classmethod
    def facts_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Facts cannot be empty")
        if len(v) > 5000:
            raise ValueError("Facts must be under 5000 characters")
        return v


class RefineFactsResponse(BaseModel):
    """Returned by /api/refine-facts."""
    questions: list[str]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CaseIntakeRequest(BaseModel):
    """Payload submitted by the client through the intake form."""
    description: str = Field(
        ...,
        min_length=20,
        max_length=5_000,
        description="Free-text narrative of the case facts.",
    )

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Description cannot be empty")
        if len(v) > 5000:
            raise ValueError("Description must be under 5000 characters")
        return v
    legal_area: Optional[str] = Field(
        None,
        description=(
            "Client's best guess at practice area. "
            "May be overridden by Gemini analysis."
        ),
    )
    jurisdiction: Optional[str] = Field(
        None,
        description=(
            "Target jurisdiction (e.g. 'CA', 'SDNY', 'N.D. Ill.'). "
            "Gemini will also infer jurisdiction from the facts."
        ),
    )
    urgency: UrgencyLevel = Field(
        UrgencyLevel.MEDIUM,
        description="Self-reported urgency of the matter.",
    )
    budget_goals: Optional[BudgetGoals] = Field(None, description="Stage-gated budget constraints.")
    county: Optional[str] = Field(None, description="County-level venue selection (NY only, e.g. 'Queens').")
    plaintiff_location: Optional[str] = Field(None, description="Plaintiff location (City, State) for diversity analysis.")
    defendant_location: Optional[str] = Field(None, description="Defendant location (City, State) for diversity analysis.")
    federal_question: Optional[bool] = Field(None, description="User-asserted federal question jurisdiction (28 U.S.C. § 1331).")
    procedural_flags: Optional[list[str]] = Field(None, description="Procedural mechanisms at issue (e.g. 'interpleader', 'intervention', 'venue_challenge').")
    subject_matter_jurisdiction: Optional[str] = Field(None,
        description="'federal_question' | 'diversity' | 'state_supreme'")
    personal_jurisdiction_basis: Optional[str] = Field(None,
        description="'domicile' | 'long_arm_transacting' | 'long_arm_tortious' | 'forum_selection'")
    procedural_posture: Optional[str] = Field(None,
        description="'pre_litigation' | 'complaint_drafted' | 'active_discovery' | 'dispositive_motions'")
    primary_remedy: Optional[str] = Field(None,
        description="'injunctive_tro' | 'specific_performance' | 'declaratory_judgment' | 'monetary_damages'")
    evasive_defendant: bool = Field(False,
        description="Triggers alternative-service keyword injection in docket search.")
    advanced_mode: bool = Field(False, description="True when submitted via advanced intake grid.")
    client_email: Optional[str] = Field(None, description="Client email for match notifications (optional).")


class MatchRequest(BaseModel):
    """Trigger the full matching pipeline for a previously-submitted case."""
    case_id: str = Field(..., description="UUID returned from /api/intake.")


# ---------------------------------------------------------------------------
# Internal / service-layer models
# ---------------------------------------------------------------------------

class GeminiAnalysis(BaseModel):
    """Structured output from the Gemini fact-pattern analyzer."""
    primary_legal_area: str = Field(
        ..., description="Best-fit practice area from the LegalArea taxonomy."
    )
    secondary_areas: list[str] = Field(
        default_factory=list,
        description="Additional relevant practice areas.",
    )
    jurisdiction: str = Field(
        "Unknown", description="Inferred or confirmed jurisdiction."
    )
    urgency_level: str = Field(
        ..., description="Assessed urgency based on fact pattern."
    )
    key_issues: list[str] = Field(
        default_factory=list,
        description="Discrete legal issues identified in the facts.",
    )
    fact_summary: str = Field(
        ..., description="Condensed, neutral restatement of the case facts."
    )
    raw_model: Optional[str] = Field(
        None, description="Model identifier that produced this analysis."
    )
    inferred_defendant_location: Optional[str] = Field(
        None, description="Defendant state/location extracted from the facts, if present."
    )
    inferred_plaintiff_location: Optional[str] = Field(
        None, description="Plaintiff state/location extracted from the facts, if present."
    )
    defendant_location_unknown: bool = Field(
        False, description="True when the facts contain no indication of defendant location."
    )


class MotionRecord(BaseModel):
    """A single motion event found in a CourtListener docket entry."""
    motion_type: str = Field(..., description="'osc' | 'tro' | 'pi' | 'msj' | 'mtd'")
    motion_label: str = Field(..., description="Human-readable label, e.g. 'Order to Show Cause'")
    date_filed: Optional[str] = None
    case_name: str
    court: str


class JudgeAppearance(BaseModel):
    """A judge the attorney has appeared before."""
    judge_name: str
    court: str
    case_name: str
    motions_in_case: list[str] = Field(
        default_factory=list,
        description="motion_type values detected in this docket.",
    )


class CaseTimeline(BaseModel):
    """High-level timeline entry for a docket the attorney appeared in."""
    case_name: str
    cause: str
    court: str
    date_filed: Optional[str] = None
    date_terminated: Optional[str] = None
    key_motions: list[str] = Field(default_factory=list)


class DocketIntelligence(BaseModel):
    """Aggregated motion/judge intelligence from CourtListener dockets."""
    motion_history: list[MotionRecord] = Field(default_factory=list)
    judge_appearances: list[JudgeAppearance] = Field(default_factory=list)
    case_timelines: list[CaseTimeline] = Field(default_factory=list)
    has_osc_experience: bool = False
    has_pi_experience: bool = False
    has_msj_experience: bool = False
    data_verified: bool = True
    dockets_analyzed: int = 0


class CaselawOpinion(BaseModel):
    """A single published opinion from the Harvard Caselaw Access Project."""
    case_name: str
    citation: Optional[str] = None
    decision_date: Optional[str] = None
    url: Optional[str] = None
    jurisdiction: Optional[str] = None
    is_landmark: bool = False


class CaselawProfile(BaseModel):
    """Aggregated caselaw intelligence for a single attorney (from CAP)."""
    attorney_name: str
    landmark_case_count: int = 0
    has_landmark_wins: bool = False
    cases: list[CaselawOpinion] = Field(default_factory=list)


class CorporateProfile(BaseModel):
    """Corporate defendant profile resolved via OpenCorporates."""
    company_name: str
    jurisdiction_code: Optional[str] = None
    registered_address: Optional[str] = None
    hq_state: Optional[str] = None
    company_number: Optional[str] = None
    status: Optional[str] = None


class VenueRecommendation(BaseModel):
    """Venue recommendation produced by the venue optimizer."""
    recommended_court: str = Field(..., description="'nyed' | 'nysd' | 'nysupct'")
    recommended_court_label: str = Field(..., description="E.g. 'E.D.N.Y. (Brooklyn Federal Court)'")
    reasoning: str
    alternatives: list[dict] = Field(
        default_factory=list,
        description="[{'court': str, 'label': str, 'rationale': str}]",
    )
    john_doe_protocol: bool = False
    john_doe_recommendation: Optional[str] = None


class AttorneyProfile(BaseModel):
    """An attorney record in the in-memory database."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bar_number: str
    firm: str
    jurisdictions: list[str] = Field(
        default_factory=list,
        description="Jurisdictions where the attorney is admitted.",
    )
    specializations: list[str] = Field(
        default_factory=list,
        description="Practice areas (using LegalArea taxonomy values).",
    )
    years_experience: int = Field(ge=0)
    win_rate: float = Field(
        ge=0.0,
        le=1.0,
        description="Historical favorable-outcome rate (0-1 scale).",
    )
    availability: Availability = Availability.AVAILABLE
    notable_cases: list[str] = Field(
        default_factory=list,
        description="Short descriptions of notable matters handled.",
    )
    hourly_rate: Optional[int] = Field(
        None, description="Indicative hourly rate in USD."
    )
    email: Optional[str] = None
    docket_intelligence: Optional[DocketIntelligence] = None
    caselaw_profile: Optional[CaselawProfile] = None


class ScoreBreakdown(BaseModel):
    """Itemized scoring components for a single attorney match."""
    specialization_score: float = Field(
        ge=0, le=40,
        description="Points for practice-area alignment (0-40).",
    )
    jurisdiction_score: float = Field(
        ge=0, le=25,
        description="Points for jurisdiction match (0-25).",
    )
    experience_score: float = Field(
        ge=0, le=15,
        description="Points for years of experience (0-15).",
    )
    availability_score: float = Field(
        ge=0, le=10,
        description="Points for current availability (0-10).",
    )
    win_rate_score: float = Field(
        ge=0, le=5,
        description="Points for historical win rate (0-5).",
    )
    budget_score: float = Field(
        ge=0, le=10, default=5.0,
        description="Budget alignment score (0-10). 5.0 neutral when no budget goals provided.",
    )
    jurisdictional_alignment: float = Field(
        ge=0, default=0.0,
        description="Bonus points for courthouse-level match, federal triggers, and procedural flags (0-10).",
    )
    composite: float = Field(
        ge=0, le=100,
        description="Sum of all scoring components, normalized to 0-100.",
    )


class CourtRecord(BaseModel):
    """A single case record found via live court verification."""
    source: str                           # "courtlistener" | "pacer_pcl"
    case_name: str
    docket_number: str
    court: str
    date_filed: Optional[str] = None
    parties: list[str] = []
    attorney_name: Optional[str] = None
    motions_detected: list[str] = []      # detected motion type labels
    verified: bool = True


class CourtVerificationResult(BaseModel):
    """Aggregated live verification result for a single attorney."""
    attorney_name: str
    records_found: int
    court_records: list[CourtRecord] = []
    source: str                           # "courtlistener" | "pacer_pcl" | "none"
    error: Optional[str] = None
    verification_url: Optional[str] = None  # NYSCEF manual search URL
    checked_at: Optional[str] = None        # ISO 8601 timestamp


class MatchCandidate(BaseModel):
    """A scored attorney candidate before audit."""
    attorney: AttorneyProfile
    score_breakdown: ScoreBreakdown
    match_rationale: str = Field(
        ...,
        description="Brief explanation of why this attorney was matched.",
    )
    court_verification: Optional[CourtVerificationResult] = None


class AuditedMatch(BaseModel):
    """A single match after Claude Opus validation."""
    attorney_id: str
    attorney_name: str
    original_score: float
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Opus-assigned confidence in the match quality (0-1).",
    )
    flags: list[str] = Field(
        default_factory=list,
        description="Concerns or caveats raised by the auditor.",
    )
    reasoning: str = Field(
        ...,
        description="Opus's rationale for the confidence assessment.",
    )


class AuditResult(BaseModel):
    """Full output from the Claude Opus audit pass."""
    audited_matches: list[AuditedMatch]
    overall_assessment: str = Field(
        ...,
        description="High-level summary of match quality for this case.",
    )
    audit_model: Optional[str] = Field(
        None, description="Model identifier that performed the audit."
    )


# ---------------------------------------------------------------------------
# Moneyball leaderboard models
# ---------------------------------------------------------------------------

class AttorneyStats(BaseModel):
    """Aggregate statistics for an attorney derived from CourtListener data."""
    attorney_id: str
    attorney_name: str
    firm: str
    docket_count: int = Field(0, description="Number of RECAP dockets attorney appears in (case volume proxy).")
    jurisdictions: list[str] = Field(default_factory=list)
    primary_specializations: list[str] = Field(default_factory=list)
    data_source: str = Field("courtlistener", description="'courtlistener' or 'static_roster'.")


class LeaderboardAuditResult(BaseModel):
    """Claude Opus audit of leaderboard rankings."""
    top_pick: str = Field(..., description="Name of Opus's top recommended attorney.")
    flags: list[str] = Field(default_factory=list, description="Anomalies or concerns in the rankings.")
    overall_assessment: str
    audit_model: Optional[str] = None


class LeaderboardEntry(BaseModel):
    """A single ranked entry in the attorney leaderboard."""
    rank: int
    attorney: AttorneyProfile
    stats: AttorneyStats
    efficacy_score: float = Field(ge=0, le=100, description="Objective Efficacy Score (0-100).")
    score_label: str = Field(..., description="'Verified' (static roster with real data) or 'Data-Limited' (CL estimate).")
    score_breakdown: dict = Field(
        default_factory=dict,
        description="Component scores: {'budget': float, 'volume': float, 'win_rate': float}.",
    )


class LeaderboardResponse(BaseModel):
    """Full leaderboard result for a domain+jurisdiction combination."""
    domain: str
    jurisdiction: str
    entries: list[LeaderboardEntry]
    generated_at: str = Field(..., description="ISO 8601 timestamp when the leaderboard was generated.")
    cache_ttl_minutes: int = 60
    audit: Optional[LeaderboardAuditResult] = None


class CourtListenerKeywords(BaseModel):
    """CourtListener search parameters extracted by Gemini from the case facts."""
    search_query: str = Field(
        ..., description="Free-text query for CourtListener full-text search."
    )
    nature_of_suit_codes: list[str] = Field(
        default_factory=list,
        description="PACER NOS codes (e.g. ['820', '290']).",
    )
    target_court_ids: list[str] = Field(
        default_factory=list,
        description="CourtListener court IDs to search (e.g. ['cacd', 'cand']).",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class CaseIntakeResponse(BaseModel):
    """Returned after successfully ingesting a new case."""
    case_id: str
    status: str = "received"
    message: str = "Case facts received. Use /api/match to run the matching pipeline."
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MatchResponse(BaseModel):
    """Full pipeline result: analysis + matches + audit."""
    case_id: str
    gemini_analysis: GeminiAnalysis
    matches: list[MatchCandidate]
    audit: Optional[AuditResult] = Field(
        None,
        description="Opus audit results. None if audit was skipped or failed.",
    )
    pipeline_duration_ms: int = Field(
        ..., description="Wall-clock time for the full pipeline in milliseconds."
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Non-fatal issues encountered during the pipeline.",
    )
    venue_recommendation: Optional[VenueRecommendation] = Field(
        None,
        description="Automatically inferred venue recommendation from fact analysis.",
    )


class AttorneyListResponse(BaseModel):
    """Paginated list of attorneys."""
    attorneys: list[AttorneyProfile]
    total: int


class HealthResponse(BaseModel):
    """Service health check."""
    status: str = "ok"
    version: str = "0.1.0"
    gemini_configured: bool = False
    claude_configured: bool = False
    courtlistener_configured: bool = False


class ErrorResponse(BaseModel):
    """Standard error envelope."""
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Attorney self-onboarding schemas
# ---------------------------------------------------------------------------

class AttorneyRegisterRequest(BaseModel):
    """Payload for attorney self-registration."""
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    bar_number: Optional[str] = None
    firm: Optional[str] = None
    jurisdictions: Optional[list[str]] = None
    practice_areas: Optional[list[str]] = None
    hourly_rate: Optional[str] = None
    availability: Optional[str] = "available"
    accepting_clients: Optional[bool] = True


class AttorneyProfileUpdate(BaseModel):
    """Partial update for an attorney's own profile."""
    bar_number: Optional[str] = None
    firm: Optional[str] = None
    jurisdictions: Optional[list[str]] = None
    practice_areas: Optional[list[str]] = None
    hourly_rate: Optional[str] = None
    availability: Optional[str] = None
    accepting_clients: Optional[bool] = None


class AttorneyLoginRequest(BaseModel):
    """Credentials for attorney login."""
    email: str
    password: str


class AttorneyLoginResponse(BaseModel):
    """Returned on successful authentication."""
    token: str
    attorney_id: str
    name: str
    is_founding: bool


class AttorneyProfileResponse(BaseModel):
    """Public-facing attorney profile (no password hash)."""
    id: str
    name: str
    email: str
    bar_number: Optional[str]
    firm: Optional[str]
    jurisdictions: Optional[list[str]]
    practice_areas: Optional[list[str]]
    hourly_rate: Optional[str]
    availability: str
    accepting_clients: bool
    is_founding: bool
    created_at: Optional[str]


class LeadSummary(BaseModel):
    """A single lead as seen by the receiving attorney (no PII)."""
    id: str
    case_id: str
    status: str
    practice_area: Optional[str]
    urgency: Optional[str]
    jurisdiction: Optional[str]
    lead_score: Optional[float] = None
    sent_at: Optional[str]
    responded_at: Optional[str]


class LeadRespondRequest(BaseModel):
    """Attorney's accept/decline action on a lead."""
    action: str = Field(..., pattern="^(accept|decline)$")


# ---------------------------------------------------------------------------
# Case Lookup schemas
# ---------------------------------------------------------------------------

class TimelineEntry(BaseModel):
    date: Optional[str] = None
    description: str
    motion_type: Optional[str] = None      # tro | msj | mtd | osc | alt_service
    motion_label: Optional[str] = None
    plain_english: Optional[str] = None


class AttorneyExpectation(BaseModel):
    estimated_timeline: str
    likely_strategy: str
    typical_outcomes: str
    budget_estimate: str
    risk_flags: list[str] = []


class SimilarityAnalysis(BaseModel):
    score: int                              # 0-100
    matching_elements: list[str] = []
    key_differences: list[str] = []
    recommendation: str


class CaseMeta(BaseModel):
    name: str
    docket_number: Optional[str] = None
    court: str
    date_filed: Optional[str] = None
    judge: Optional[str] = None
    cl_url: Optional[str] = None
    outcome_tag: Optional[str] = None      # Ongoing | Settled | Dismissed | Plaintiff Win | Defendant Win | Resolved


class CaseLookupAttorney(BaseModel):
    name: str
    firm: Optional[str] = None
    role: str = "unknown"                  # plaintiff_attorney | defense_attorney | unknown
    docket_intelligence: Optional[DocketIntelligence] = None
    timeline: list[TimelineEntry] = []
    expectation: Optional[AttorneyExpectation] = None
    opposing_counsel_warning: Optional[str] = None


class CaseLookupRequest(BaseModel):
    query: Optional[str] = None
    intake_case_id: Optional[str] = None   # for similarity scoring


class CaseLookupResponse(BaseModel):
    query_type: str                         # docket_number | case_name | description
    case: CaseMeta
    attorneys: list[CaseLookupAttorney]
    case_summary: Optional[str] = None     # Claude plain-English summary
    similarity: Optional[SimilarityAnalysis] = None
    extracted_practice_area: str = "general_litigation"
    extracted_venue: str = "nysd"


# ---------------------------------------------------------------------------
# Stripe / Lead Reveal schemas
# ---------------------------------------------------------------------------

class LeadRevealResponse(BaseModel):
    """Returned when attorney initiates lead reveal payment."""
    client_secret: str
    amount_cents: int
    lead_id: str


class LeadContactInfo(BaseModel):
    """Client contact details returned after successful payment."""
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    practice_area: Optional[str] = None
    urgency: Optional[str] = None
    jurisdiction: Optional[str] = None
