import { useEffect } from "react";
import type { CaseLookupAttorney } from "../../types/api";

const MOTION_COLORS: Record<string, string> = {
  tro:         "bg-red-100 text-red-700",
  msj:         "bg-amber-100 text-amber-800",
  mtd:         "bg-blue-100 text-blue-700",
  osc:         "bg-purple-100 text-purple-700",
  alt_service: "bg-orange-100 text-orange-700",
  pi:          "bg-teal-100 text-teal-700",
};

interface Props {
  attorney: CaseLookupAttorney;
  onClose: () => void;
}

export default function MotionTimelineModal({ attorney, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const exp = attorney.expectation;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-[#FFFEF2] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-[10px] border border-[rgba(25,25,24,0.12)] p-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{attorney.role.replace(/_/g, " ")}</p>
            <h2 className="text-xl font-bold text-[#191918]">{attorney.name}</h2>
            {attorney.firm && <p className="text-sm text-[rgba(25,25,24,0.55)]">{attorney.firm}</p>}
          </div>
          <button onClick={onClose} className="text-[rgba(25,25,24,0.4)] hover:text-[#191918] text-xl font-light ml-4">x</button>
        </div>

        {/* Timeline */}
        <div className="mb-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">Motion Timeline</p>
          {attorney.timeline.length === 0 ? (
            <p className="text-sm text-[rgba(25,25,24,0.5)]">No docket entries available for this case.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-[rgba(25,25,24,0.08)]" />
              <div className="space-y-4">
                {attorney.timeline.map((entry, i) => (
                  <div key={i} className="relative pl-8">
                    <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${entry.motion_type ? "bg-[#FCAA2D] border-[#FCAA2D]" : "bg-white border-[rgba(25,25,24,0.2)]"}`} />
                    <div className="bg-white border border-[rgba(25,25,24,0.08)] rounded-[8px] p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {entry.date && (
                          <span className="font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)]">{entry.date}</span>
                        )}
                        {entry.motion_type && (
                          <span className={`font-mono text-[0.6rem] uppercase tracking-wide px-2 py-0.5 rounded ${MOTION_COLORS[entry.motion_type] || "bg-gray-100 text-gray-600"}`}>
                            {entry.motion_label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#191918] leading-snug">{entry.description}</p>
                      {entry.plain_english && (
                        <p className="text-xs text-[rgba(25,25,24,0.55)] mt-2 leading-relaxed italic">
                          {entry.plain_english}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* What to Expect */}
        {exp && (
          <div className="border-t border-[rgba(25,25,24,0.12)] pt-6">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
              What to Expect If You Hire This Attorney
            </p>
            <div className="space-y-3">
              {[
                ["Estimated Timeline", exp.estimated_timeline],
                ["Likely Strategy", exp.likely_strategy],
                ["Typical Outcomes", exp.typical_outcomes],
                ["Budget Estimate", exp.budget_estimate],
              ].map(([label, value]) => (
                <div key={label} className="bg-white border border-[rgba(25,25,24,0.08)] rounded-[8px] p-3">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">{label}</p>
                  <p className="text-sm text-[#191918]">{value}</p>
                </div>
              ))}
              {exp.risk_flags.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-3">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-amber-700 mb-1">Risk Flags</p>
                  <ul className="space-y-1">
                    {exp.risk_flags.map((flag, i) => (
                      <li key={i} className="text-xs text-amber-800">! {flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 pt-4 border-t border-[rgba(25,25,24,0.08)] text-center">
          <p className="text-sm text-[rgba(25,25,24,0.55)] mb-3">Want an attorney with this expertise for your case?</p>
          <a href="/app" className="inline-flex items-center rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px]">
            Get Matched Now
          </a>
        </div>
      </div>
    </div>
  );
}
