/* ------------------------------------------------------------------ */
/*  API type definitions — mirrors the backend MatchResponse schema   */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: string;
  version: string;
  gemini_configured: boolean;
  claude_configured: boolean;
  courtlistener_configured: boolean;
}

export interface IntakeRequest {
  description: string;
  urgency?: "low" | "medium" | "high" | "critical";
  budget_goals?: BudgetGoals;
  subject_matter_jurisdiction?: string;
  personal_jurisdiction_basis?: string;
  procedural_posture?: string;
  primary_remedy?: string;
  evasive_defendant?: boolean;
  advanced_mode?: boolean;
}

export interface BudgetGoals {
  pretrial?: number;
  complaint?: number;
  discovery?: number;
  hearing?: number;
  hourly_rate_ceiling?: number;
}

export interface RefineFactsRequest {
  facts: string;
}

export interface RefineFactsResponse {
  questions: string[];
}

export interface IntakeResponse {
  case_id: string;
}

export interface MatchRequest {
  case_id: string;
}

/* ---------- Nested shapes within MatchResponse ---------- */

export interface GeminiAnalysis {
  primary_legal_area: string;
  secondary_areas: string[];
  jurisdiction: string;
  urgency_level: string;
  key_issues: string[];
  fact_summary: string;
  raw_model: string | null;
  inferred_defendant_location: string | null;
  inferred_plaintiff_location: string | null;
  defendant_location_unknown: boolean;
}

export interface MotionRecord {
  motion_type: string;
  motion_label: string;
  date_filed: string | null;
  case_name: string;
  court: string;
}

export interface JudgeAppearance {
  judge_name: string;
  court: string;
  case_name: string;
  motions_in_case: string[];
}

export interface CaseTimeline {
  case_name: string;
  cause: string;
  court: string;
  date_filed: string | null;
  date_terminated: string | null;
  key_motions: string[];
}

export interface DocketIntelligence {
  motion_history: MotionRecord[];
  judge_appearances: JudgeAppearance[];
  case_timelines: CaseTimeline[];
  has_osc_experience: boolean;
  has_pi_experience: boolean;
  has_msj_experience: boolean;
  data_verified: boolean;
  dockets_analyzed: number;
}

export interface VenueRecommendation {
  recommended_court: string;
  recommended_court_label: string;
  reasoning: string;
  alternatives: Array<{ court: string; label: string; rationale: string }>;
  john_doe_protocol: boolean;
  john_doe_recommendation: string | null;
}

export interface Attorney {
  id: string;
  name: string;
  bar_number: string;
  firm: string;
  jurisdictions: string[];
  specializations: string[];
  years_experience: number;
  win_rate: number;
  availability: "available" | "limited" | "unavailable";
  notable_cases: string[];
  hourly_rate: number | null;
  email: string | null;
  docket_intelligence?: DocketIntelligence | null;
}

export interface ScoreBreakdown {
  specialization_score: number;
  jurisdiction_score: number;
  experience_score: number;
  availability_score: number;
  win_rate_score: number;
  budget_score: number;
  jurisdictional_alignment: number;
  composite: number;
}

export interface CourtRecord {
  source: "courtlistener" | "pacer_pcl";
  case_name: string;
  docket_number: string;
  court: string;
  date_filed: string | null;
  parties: string[];
  attorney_name: string | null;
  motions_detected: string[];
  verified: boolean;
}

export interface CourtVerificationResult {
  attorney_name: string;
  records_found: number;
  court_records: CourtRecord[];
  source: string;
  error: string | null;
  verification_url: string | null;
  checked_at: string | null;
}

export interface MatchEntry {
  attorney: Attorney;
  score_breakdown: ScoreBreakdown;
  match_rationale: string;
  court_verification?: CourtVerificationResult | null;
}

export interface AuditedMatch {
  attorney_id: string;
  attorney_name: string;
  original_score: number;
  confidence: number;
  flags: string[];
  reasoning: string;
}

export interface AuditResult {
  audited_matches: AuditedMatch[];
  overall_assessment: string;
  audit_model: string | null;
}

export interface AttorneyStats {
  attorney_id: string;
  attorney_name: string;
  firm: string;
  docket_count: number;
  jurisdictions: string[];
  primary_specializations: string[];
  data_source: "courtlistener" | "static_roster";
}

export interface LeaderboardEntry {
  rank: number;
  attorney: Attorney;
  stats: AttorneyStats;
  efficacy_score: number;
  score_label: "Verified" | "Data-Limited";
  score_breakdown: {
    budget: number;
    volume: number;
    win_rate: number;
  };
}

export interface LeaderboardAuditResult {
  top_pick: string;
  flags: string[];
  overall_assessment: string;
  audit_model: string | null;
}

export interface LeaderboardResponse {
  domain: string;
  jurisdiction: string;
  entries: LeaderboardEntry[];
  generated_at: string;
  cache_ttl_minutes: number;
  audit?: LeaderboardAuditResult;
}

export interface MatchResponse {
  case_id: string;
  gemini_analysis: GeminiAnalysis;
  matches: MatchEntry[];
  audit: AuditResult | null;
  pipeline_duration_ms: number;
  warnings: string[];
  venue_recommendation?: VenueRecommendation | null;
}

/* ---------- Roster endpoint ---------- */

export interface AttorneyListResponse {
  attorneys: Attorney[];
  total: number;
}
