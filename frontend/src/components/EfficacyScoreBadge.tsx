interface EfficacyScoreBadgeProps {
  score: number;
  label: "Verified" | "Data-Limited";
  breakdown: { budget: number; volume: number; win_rate: number };
}

export default function EfficacyScoreBadge({ score, label, breakdown }: EfficacyScoreBadgeProps) {
  const color =
    score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-600";
  const ringColor =
    score >= 70 ? "ring-emerald-200" : score >= 40 ? "ring-amber-200" : "ring-red-200";
  const labelStyle =
    label === "Verified"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : "bg-gray-100 text-gray-500 border border-gray-200";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`flex items-baseline gap-0.5 ring-1 ${ringColor} rounded-xl px-3 py-1.5`}>
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{score.toFixed(1)}</span>
        <span className="text-xs text-gray-400 ml-0.5">/ 100</span>
      </div>
      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${labelStyle}`}>
        {label}
      </span>
      <div className="flex gap-1 text-[9px] text-gray-400">
        <span>B:{breakdown.budget.toFixed(0)}</span>
        <span>·</span>
        <span>V:{breakdown.volume.toFixed(0)}</span>
        <span>·</span>
        <span>W:{breakdown.win_rate.toFixed(0)}</span>
      </div>
    </div>
  );
}
