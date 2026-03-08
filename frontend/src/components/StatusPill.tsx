import type { HealthResponse } from "../types/api";

interface StatusPillProps {
  health: HealthResponse | null;
}

export default function StatusPill({ health }: StatusPillProps) {
  if (!health) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(25,25,24,0.05)] px-3 py-1 text-xs font-medium text-[rgba(25,25,24,0.35)]">
        <span className="h-2 w-2 rounded-full bg-[rgba(25,25,24,0.25)] animate-pulse" />
        Connecting...
      </span>
    );
  }

  const isLive = health.courtlistener_configured;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isLive
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isLive ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {isLive ? "Live Data" : "Demo Mode"}
    </span>
  );
}
