import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Briefcase,
  Trophy,
  Quote,
  Scale,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import type {
  MatchEntry,
  AuditedMatch,
  DocketIntelligence,
  CourtVerificationResult,
} from "../types/api";
import ScoreBar from "./ScoreBar";
import AuditBadge from "./AuditBadge";

interface AttorneyCardProps {
  match: MatchEntry;
  rank: number;
  auditData?: AuditedMatch;
}

/* Rank badge colors: gold / silver / bronze / default */
function rankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg shadow-amber-600/30";
    case 2:
      return "bg-gradient-to-br from-slate-300 to-slate-400 text-gray-900";
    case 3:
      return "bg-gradient-to-br from-amber-700 to-amber-800 text-amber-100";
    default:
      return "bg-gray-200 text-gray-600";
  }
}

function availabilityStyle(avail: string): string {
  switch (avail) {
    case "available":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "limited":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "unavailable":
      return "bg-red-50 text-red-600 border-red-200";
    default:
      return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

/* ------------------------------------------------------------------ */
/*  Case Intelligence sub-component                                    */
/* ------------------------------------------------------------------ */

function CaseIntelligenceSection({ intel }: { intel: DocketIntelligence }) {
  const [timelineOpen, setTimelineOpen] = useState(false);

  if (!intel.data_verified || intel.dockets_analyzed === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-[rgba(25,25,24,0.08)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Scale className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Case Intelligence
          </span>
        </div>
        <p className="text-xs text-gray-400 italic">
          No verified motion or judge data available for this candidate.
        </p>
      </div>
    );
  }

  const hasMotion = intel.has_osc_experience || intel.has_pi_experience || intel.has_msj_experience;

  return (
    <div className="mt-4 pt-4 border-t border-[rgba(25,25,24,0.08)] space-y-3">
      <div className="flex items-center gap-1.5">
        <Scale className="h-3.5 w-3.5 text-[#FCAA2D]" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#FCAA2D]">
          Case Intelligence
        </span>
        <span className="text-[10px] text-gray-400">
          ({intel.dockets_analyzed} docket{intel.dockets_analyzed !== 1 ? "s" : ""} analyzed)
        </span>
      </div>

      {/* Motion experience chips */}
      {hasMotion && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Motion Experience
          </p>
          <div className="flex flex-wrap gap-1.5">
            {intel.has_osc_experience && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                OSC
              </span>
            )}
            {intel.has_pi_experience && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(252,170,45,0.1)] text-[#191918] border border-[rgba(252,170,45,0.3)]">
                Prelim. Injunction
              </span>
            )}
            {intel.has_msj_experience && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border border-[rgba(25,25,24,0.1)]">
                Summary Judgment
              </span>
            )}
          </div>
        </div>
      )}

      {/* Judge appearances */}
      {intel.judge_appearances.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Judge Appearances
          </p>
          <div className="space-y-1.5">
            {intel.judge_appearances.slice(0, 3).map((j, idx) => (
              <div key={idx} className="text-xs text-gray-600">
                <span className="font-medium">Hon. {j.judge_name}</span>
                {" "}—{" "}
                <span className="text-gray-500">{j.case_name} ({j.court})</span>
                {j.motions_in_case.length > 0 && (
                  <div className="text-[10px] text-gray-400 ml-3 mt-0.5">
                    Filed: {j.motions_in_case
                      .map((m) => m === "osc" ? "OSC" : m === "pi" ? "Prelim. Inj." : m === "msj" ? "MSJ" : m.toUpperCase())
                      .join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case timeline (collapsible) */}
      {intel.case_timelines.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setTimelineOpen(!timelineOpen)}
            className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            {timelineOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span className="uppercase tracking-widest font-semibold">
              Case Timeline
            </span>
          </button>
          {timelineOpen && (
            <div className="mt-2 space-y-2">
              {intel.case_timelines.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-[rgba(25,25,24,0.02)] border border-[rgba(25,25,24,0.08)] px-3 py-2.5"
                >
                  <p className="text-xs font-medium text-gray-700 leading-snug">
                    {t.case_name}
                  </p>
                  {t.cause && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{t.cause}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Filed: {t.date_filed || "unknown"}
                    {t.date_terminated
                      ? ` — Disposed: ${t.date_terminated}`
                      : " — Pending"}
                  </p>
                  {t.key_motions.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Key motions: {t.key_motions.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Verification sub-component                                    */
/* ------------------------------------------------------------------ */

function LiveVerificationSection({ cv }: { cv: CourtVerificationResult }) {
  const sourceLabel = cv.source
    .split(", ")
    .map((s) =>
      s === "pacer_pcl" ? "PACER" : s === "nyscef" ? "NYSCEF" : s.toUpperCase()
    )
    .join(" | ");

  if (cv.records_found === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-[rgba(25,25,24,0.08)]">
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Live Verification
          </span>
        </div>
        <p className="text-xs text-gray-400 italic">
          No verified court records found for this attorney in the target venue.
        </p>
        {cv.error && (
          <p className="text-[10px] text-red-400 mt-1">{cv.error}</p>
        )}
        {cv.verification_url && (
          <a
            href={cv.verification_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide hover:bg-amber-400 transition-colors"
          >
            Verify on NYSCEF
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-[rgba(25,25,24,0.08)] space-y-3">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
          Live Court Verification
        </span>
        {cv.source !== "none" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            {sourceLabel}
          </span>
        )}
        <span className="text-[10px] text-gray-400">
          ({cv.records_found} record{cv.records_found !== 1 ? "s" : ""})
        </span>
      </div>

      <div className="space-y-2">
        {cv.court_records.slice(0, 5).map((rec, idx) => (
          <div
            key={idx}
            className="rounded-lg bg-[rgba(25,25,24,0.02)] border border-[rgba(25,25,24,0.08)] px-3 py-2.5"
          >
            <p className="text-xs font-medium text-gray-700 leading-snug">
              {rec.case_name}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {rec.court}
              {rec.date_filed ? `, ${rec.date_filed}` : ""}
            </p>
            {rec.motions_detected.length > 0 && (
              <p className="text-[10px] text-[#FCAA2D] mt-0.5">
                Motions: {rec.motions_detected.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {cv.verification_url && (
        <a
          href={cv.verification_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide hover:bg-amber-400 transition-colors"
        >
          Verify on NYSCEF
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AttorneyCard({
  match,
  rank,
  auditData,
}: AttorneyCardProps) {
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const { attorney, score_breakdown, match_rationale } = match;
  const composite = Math.round(score_breakdown.composite);

  return (
    <div className="rounded-xl bg-white border border-[rgba(25,25,24,0.12)] hover:border-[rgba(25,25,24,0.22)] transition-colors overflow-hidden">
      <div className="p-5">
        {/* Top row: rank badge + attorney info + composite score */}
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <div
            className={`flex items-center justify-center h-10 w-10 rounded-lg text-sm font-bold shrink-0 ${rankStyle(rank)}`}
          >
            #{rank}
          </div>

          {/* Attorney info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate">
              {attorney.name}
            </h3>
            <p className="text-sm text-gray-500 truncate">{attorney.firm}</p>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {attorney.years_experience} yrs
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                {Math.round(attorney.win_rate * 100)}% win rate
              </span>
              {attorney.hourly_rate && (
                <span>${attorney.hourly_rate.toLocaleString()}/hr</span>
              )}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${availabilityStyle(attorney.availability)}`}
              >
                {attorney.availability}
              </span>
            </div>
          </div>

          {/* Composite score */}
          <div className="text-center shrink-0">
            <div className="text-2xl font-extrabold text-gray-900">{composite}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              / 100
            </div>
            {/* Thin progress ring visual using a bar */}
            <div className="mt-1.5 w-16 h-1.5 bg-[rgba(25,25,24,0.07)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FCAA2D] transition-all duration-700"
                style={{ width: `${composite}%` }}
              />
            </div>
          </div>
        </div>

        {/* Jurisdiction + specialization badges */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {attorney.jurisdictions.map((j) => (
            <span
              key={j}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border border-[rgba(25,25,24,0.1)]"
            >
              <MapPin className="h-2.5 w-2.5" />
              {j}
            </span>
          ))}
          {attorney.specializations.map((s) => (
            <span
              key={s}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(252,170,45,0.1)] text-[#191918] border border-[rgba(252,170,45,0.3)]"
            >
              {s}
            </span>
          ))}
        </div>

        {/* Score breakdown */}
        <div className="mt-4 space-y-1.5">
          <ScoreBar
            label="Specialization"
            value={score_breakdown.specialization_score}
          />
          <ScoreBar
            label="Jurisdiction"
            value={score_breakdown.jurisdiction_score}
          />
          <ScoreBar
            label="Experience"
            value={score_breakdown.experience_score}
          />
          <ScoreBar
            label="Availability"
            value={score_breakdown.availability_score}
          />
          <ScoreBar
            label="Win Rate"
            value={score_breakdown.win_rate_score}
          />
        </div>

        {/* Notable case */}
        {attorney.notable_cases.length > 0 && (
          <div className="mt-4 flex items-start gap-2">
            <Quote className="h-3.5 w-3.5 text-gray-300 mt-0.5 shrink-0" />
            <p className="text-xs italic text-gray-400 leading-relaxed">
              {attorney.notable_cases[0]}
            </p>
          </div>
        )}

        {/* Collapsible rationale */}
        <button
          type="button"
          onClick={() => setRationaleOpen(!rationaleOpen)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#FCAA2D] hover:text-amber-600 transition-colors"
        >
          {rationaleOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Why this match?
        </button>
        {rationaleOpen && (
          <div className="mt-2 rounded-lg bg-[rgba(25,25,24,0.02)] border border-[rgba(25,25,24,0.08)] px-4 py-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              {match_rationale}
            </p>
          </div>
        )}

        {/* Case Intelligence (collapsible trigger) */}
        {attorney.docket_intelligence !== undefined && attorney.docket_intelligence !== null && (
          <>
            <button
              type="button"
              onClick={() => setIntelOpen(!intelOpen)}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#FCAA2D] hover:text-amber-600 transition-colors"
            >
              {intelOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Case Intelligence
            </button>
            {intelOpen && (
              <CaseIntelligenceSection intel={attorney.docket_intelligence} />
            )}
          </>
        )}

        {/* Live Verification (collapsible trigger) */}
        {match.court_verification != null && (
          <>
            <button
              type="button"
              onClick={() => setVerifyOpen(!verifyOpen)}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-500 transition-colors"
            >
              {verifyOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Live Verification
              {match.court_verification.records_found > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {match.court_verification.records_found}
                </span>
              )}
            </button>
            {verifyOpen && (
              <LiveVerificationSection cv={match.court_verification} />
            )}
          </>
        )}

        {/* Audit section (if present) */}
        {auditData && <AuditBadge auditedMatch={auditData} />}
      </div>
    </div>
  );
}
