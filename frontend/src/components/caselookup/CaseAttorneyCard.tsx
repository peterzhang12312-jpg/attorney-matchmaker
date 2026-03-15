import type { CaseLookupAttorney } from "../../types/api";

const MOTION_COLORS: Record<string, string> = {
  tro:         "bg-red-100 text-red-700 border-red-200",
  msj:         "bg-amber-100 text-amber-800 border-amber-200",
  mtd:         "bg-blue-100 text-blue-700 border-blue-200",
  osc:         "bg-purple-100 text-purple-700 border-purple-200",
  alt_service: "bg-orange-100 text-orange-700 border-orange-200",
  pi:          "bg-teal-100 text-teal-700 border-teal-200",
};

interface Props {
  attorney: CaseLookupAttorney;
  onViewTimeline: () => void;
}

export default function CaseAttorneyCard({ attorney, onViewTimeline }: Props) {
  const motionTypes = [...new Set(attorney.timeline.filter(e => e.motion_type).map(e => e.motion_type!))];

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5">
      {attorney.opposing_counsel_warning && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
          {attorney.opposing_counsel_warning}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#191918]">{attorney.name}</p>
          {attorney.firm && <p className="text-sm text-[rgba(25,25,24,0.55)] mt-0.5">{attorney.firm}</p>}
          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-[rgba(25,25,24,0.4)] mt-1 inline-block">
            {attorney.role.replace(/_/g, " ")}
          </span>
        </div>
        <button
          onClick={onViewTimeline}
          className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.65rem] uppercase tracking-wide px-4 min-h-[36px] whitespace-nowrap flex-shrink-0"
        >
          View Timeline
        </button>
      </div>

      {motionTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {motionTypes.map((mt) => {
            const entry = attorney.timeline.find(e => e.motion_type === mt);
            return (
              <span key={mt} className={`border font-mono text-[0.6rem] uppercase tracking-wide px-2 py-0.5 rounded ${MOTION_COLORS[mt] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {entry?.motion_label || mt}
              </span>
            );
          })}
        </div>
      )}

      {attorney.expectation && (
        <div className="mt-3 pt-3 border-t border-[rgba(25,25,24,0.08)]">
          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)] mb-1">Expected timeline</p>
          <p className="text-xs text-[rgba(25,25,24,0.65)]">{attorney.expectation.estimated_timeline}</p>
        </div>
      )}
    </div>
  );
}
