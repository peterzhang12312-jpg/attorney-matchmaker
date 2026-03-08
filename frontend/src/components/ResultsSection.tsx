import { Award } from "lucide-react";
import type { MatchEntry, AuditResult } from "../types/api";
import AttorneyCard from "./AttorneyCard";

interface ResultsSectionProps {
  matches: MatchEntry[];
  audit: AuditResult | null;
}

export default function ResultsSection({ matches, audit }: ResultsSectionProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-[rgba(25,25,24,0.12)] p-8 text-center">
        <p className="text-sm text-gray-500">
          No matching attorneys found for this fact pattern.
        </p>
      </div>
    );
  }

  /* Build a lookup map from attorney_id to audit data */
  const auditMap = new Map(
    audit?.audited_matches.map((am) => [am.attorney_id, am]) ?? [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-[#FCAA2D]" />
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
          Top Attorney Matches
        </h2>
        <span className="text-xs text-gray-400">
          ({matches.length} result{matches.length !== 1 ? "s" : ""})
        </span>
      </div>

      <div className="grid gap-4">
        {matches.map((m, i) => (
          <AttorneyCard
            key={m.attorney.id}
            match={m}
            rank={i + 1}
            auditData={auditMap.get(m.attorney.id)}
          />
        ))}
      </div>
    </div>
  );
}
