import { Link } from "react-router-dom";

interface CaseData {
  case_id: string;
  created_at?: string;
  urgency?: string;
  practice_area?: string;
  match_count: number;
  top_attorney?: string;
  has_results: boolean;
}

interface Props {
  caseData: CaseData;
}

const URGENCY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-gray-100 text-gray-600",
};

export default function CaseHistoryCard({ caseData }: Props) {
  const date = caseData.created_at
    ? new Date(caseData.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)]">
            {date}
          </p>
          <p className="font-semibold text-[#191918] mt-0.5 capitalize">
            {(caseData.practice_area || "General Litigation").replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {caseData.urgency && (
            <span
              className={`font-mono text-[0.6rem] uppercase px-2 py-0.5 rounded ${
                URGENCY_COLORS[caseData.urgency] || "bg-gray-100 text-gray-600"
              }`}
            >
              {caseData.urgency}
            </span>
          )}
        </div>
      </div>

      {caseData.has_results ? (
        <div className="text-sm text-[rgba(25,25,24,0.65)]">
          {caseData.match_count} attorney{caseData.match_count !== 1 ? "s" : ""} matched
          {caseData.top_attorney && (
            <span>
              {" "}
              &mdash; closest match:{" "}
              <strong className="text-[#191918]">{caseData.top_attorney}</strong>
            </span>
          )}
        </div>
      ) : (
        <div className="text-sm text-[rgba(25,25,24,0.4)]">Matching not yet run</div>
      )}

      <div className="mt-3 pt-3 border-t border-[rgba(25,25,24,0.06)] flex gap-3">
        <Link
          to="/app"
          className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)] hover:text-[#191918] transition-colors"
        >
          New Case
        </Link>
      </div>
    </div>
  );
}
