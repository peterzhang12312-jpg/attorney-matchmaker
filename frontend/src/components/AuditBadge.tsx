import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { AuditedMatch } from "../types/api";

interface AuditBadgeProps {
  auditedMatch: AuditedMatch;
}

export default function AuditBadge({ auditedMatch }: AuditBadgeProps) {
  const { confidence, flags, reasoning } = auditedMatch;
  const pct = Math.round(confidence * 100);

  /* Color thresholds: green >= 0.7, amber 0.4-0.7, red < 0.4 */
  let colorClass: string;
  let Icon: typeof ShieldCheck;
  if (confidence >= 0.7) {
    colorClass = "text-emerald-600";
    Icon = ShieldCheck;
  } else if (confidence >= 0.4) {
    colorClass = "text-amber-600";
    Icon = ShieldAlert;
  } else {
    colorClass = "text-red-600";
    Icon = ShieldX;
  }

  return (
    <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="text-xs font-semibold text-gray-600">
          Opus Audit
        </span>
        <span className={`text-sm font-bold font-mono ${colorClass}`}>
          {pct}%
        </span>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((flag, i) => {
            /* Flags containing "warning" or "risk" are amber, others red */
            const isAmber =
              /warning|caution|note/i.test(flag);
            return (
              <span
                key={i}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isAmber
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {flag}
              </span>
            );
          })}
        </div>
      )}

      {/* Reasoning */}
      {reasoning && (
        <p className="text-xs text-gray-500 leading-relaxed">{reasoning}</p>
      )}
    </div>
  );
}
