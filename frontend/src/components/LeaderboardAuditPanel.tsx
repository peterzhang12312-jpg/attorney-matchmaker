import { Shield, Crown, AlertTriangle } from "lucide-react";
import type { LeaderboardAuditResult } from "../types/api";

interface LeaderboardAuditPanelProps {
  audit: LeaderboardAuditResult;
}

export default function LeaderboardAuditPanel({ audit }: LeaderboardAuditPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-[rgba(25,25,24,0.12)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-[#FCAA2D]" />
        <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">Opus Audit</span>
        {audit.audit_model && (
          <span className="text-[10px] text-[rgba(25,25,24,0.35)] bg-[rgba(25,25,24,0.05)] px-2 py-0.5 rounded-full">
            {audit.audit_model}
          </span>
        )}
      </div>

      {/* Top pick */}
      <div className="flex items-center gap-2 mb-3 p-3 bg-[rgba(252,170,45,0.08)] rounded-xl border border-[rgba(252,170,45,0.2)]">
        <Crown className="h-4 w-4 text-[#FCAA2D] shrink-0" />
        <div>
          <div className="font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-wide">Top Match</div>
          <div className="text-sm font-semibold text-[#191918]">{audit.top_pick}</div>
        </div>
      </div>

      {/* Flags */}
      {audit.flags.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {audit.flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-xs text-[rgba(25,25,24,0.6)]">{flag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Assessment */}
      <p className="text-xs text-[rgba(25,25,24,0.5)] leading-relaxed italic border-l-2 border-[rgba(252,170,45,0.4)] pl-3">
        {audit.overall_assessment}
      </p>
    </div>
  );
}
