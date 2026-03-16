import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, AlertTriangle } from "lucide-react";
import type { LitigationTimeline } from "../types/api";

interface TimelineCardProps {
  caseId: string;
}

export default function TimelineCard({ caseId }: TimelineCardProps) {
  const [timeline, setTimeline] = useState<LitigationTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (timeline || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      if (!res.ok) throw new Error("Failed to generate timeline");
      const data: LitigationTimeline = await res.json();
      setTimeline(data);
    } catch {
      setError("Timeline unavailable -- try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] overflow-hidden">
      {/* Header -- always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#FFFEF2] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-[#FCAA2D]" />
          <span className="font-mono text-[0.72rem] uppercase tracking-widest text-[#191918]">
            Litigation Timeline
          </span>
          {timeline && (
            <span className="font-mono text-[0.62rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] border border-[rgba(25,25,24,0.12)] rounded px-2 py-0.5">
              {timeline.total_estimated_duration}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[rgba(25,25,24,0.45)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[rgba(25,25,24,0.45)]" />
        )}
      </button>

      {/* Body -- visible when open */}
      {open && (
        <div className="border-t border-[rgba(25,25,24,0.08)] px-6 py-5">
          {loading && (
            <p className="text-sm text-[rgba(25,25,24,0.45)] animate-pulse">
              Generating timeline...
            </p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {timeline && !loading && (
            <div className="space-y-6">
              {/* Phases */}
              <div className="relative">
                {/* Vertical connector line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[rgba(25,25,24,0.08)]" />
                <div className="space-y-6">
                  {timeline.phases.map((phase, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-[#FCAA2D] border-2 border-[#FCAA2D] mt-0.5 z-10" />
                      <div className="flex-1 pb-2">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm text-[#191918]">
                            {phase.phase}
                          </span>
                          <span className="font-mono text-[0.62rem] uppercase tracking-wider text-[rgba(25,25,24,0.45)]">
                            {phase.duration}
                          </span>
                        </div>
                        <p className="text-sm text-[rgba(25,25,24,0.6)] mb-2">
                          {phase.description}
                        </p>
                        <ul className="space-y-0.5">
                          {phase.key_actions.map((action, j) => (
                            <li
                              key={j}
                              className="text-xs text-[rgba(25,25,24,0.55)] flex gap-1.5"
                            >
                              <span className="text-[#FCAA2D] mt-0.5">
                                &#x203A;
                              </span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Important notes */}
              {timeline.important_notes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="font-mono text-[0.65rem] uppercase tracking-widest text-amber-700">
                      Important Deadlines & Notes
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {timeline.important_notes.map((note, i) => (
                      <li key={i} className="text-xs text-amber-800">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[0.65rem] text-[rgba(25,25,24,0.35)] italic">
                This timeline is an AI estimate for planning purposes only -- not
                legal advice. Actual timelines vary by judge, court congestion,
                and case complexity.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
