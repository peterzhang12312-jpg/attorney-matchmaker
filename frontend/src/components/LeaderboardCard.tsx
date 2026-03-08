import { MapPin, Briefcase, TrendingUp } from "lucide-react";
import type { LeaderboardEntry } from "../types/api";
import EfficacyScoreBadge from "./EfficacyScoreBadge";

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  isTopPick?: boolean;
}

const rankColors: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-700 border-yellow-300",
  2: "bg-gray-100 text-gray-600 border-gray-300",
  3: "bg-orange-50 text-orange-700 border-orange-300",
};

function MiniScoreBar({ label, value, max = 40 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-[rgba(25,25,24,0.07)] rounded-full">
        <div
          className="h-1 rounded-full bg-[#FCAA2D]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-6 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

export default function LeaderboardCard({ entry, isTopPick = false }: LeaderboardCardProps) {
  const { rank, attorney, stats, efficacy_score, score_label, score_breakdown } = entry;
  const rankClass = rankColors[rank] ?? "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <div className={`bg-white rounded-2xl border border-[rgba(25,25,24,0.12)] hover:border-[rgba(25,25,24,0.22)] transition-colors p-5 ${
      isTopPick ? "ring-2 ring-[rgba(252,170,45,0.4)]" : ""
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Rank badge */}
          <span className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full border text-xs font-bold ${rankClass}`}>
            {isTopPick ? "\u2605" : rank}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{attorney.name}</div>
            <div className="text-xs text-gray-500 truncate">{attorney.firm}</div>
          </div>
        </div>
        <EfficacyScoreBadge
          score={efficacy_score}
          label={score_label}
          breakdown={score_breakdown}
        />
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {attorney.jurisdictions.slice(0, 3).map((j) => (
          <span key={j} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200">
            <MapPin className="h-2.5 w-2.5" />{j}
          </span>
        ))}
        {attorney.specializations.slice(0, 2).map((s) => (
          <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[rgba(252,170,45,0.1)] text-[#191918] border border-[rgba(252,170,45,0.25)]">
            {s.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <Briefcase className="h-3 w-3" />
          {stats.docket_count} docket{stats.docket_count !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {score_label === "Verified"
            ? `${Math.round(attorney.win_rate * 100)}% win rate`
            : "Win rate: N/A"}
        </span>
        {attorney.hourly_rate && (
          <span>${attorney.hourly_rate.toLocaleString()}/hr</span>
        )}
      </div>

      {/* Score breakdown bars */}
      <div className="space-y-1">
        <MiniScoreBar label="Budget" value={score_breakdown.budget} max={40} />
        <MiniScoreBar label="Volume" value={score_breakdown.volume} max={30} />
        <MiniScoreBar label="Win rate" value={score_breakdown.win_rate} max={30} />
      </div>
    </div>
  );
}
