interface ScoreBarProps {
  label: string;
  value: number;
  /** Maximum value for the bar scale. Defaults to 100. */
  max?: number;
}

export default function ScoreBar({ label, value, max = 100 }: ScoreBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  /* Color gradient based on percentage */
  let barColor = "bg-[#FCAA2D]";
  if (pct >= 80) barColor = "bg-emerald-500";
  else if (pct >= 50) barColor = "bg-[#FCAA2D]";
  else if (pct >= 25) barColor = "bg-amber-500";
  else barColor = "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-[rgba(25,25,24,0.45)] w-28 shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 h-2 bg-[rgba(25,25,24,0.07)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-[rgba(25,25,24,0.45)] w-10 text-right">
        {value.toFixed(0)}
      </span>
    </div>
  );
}
