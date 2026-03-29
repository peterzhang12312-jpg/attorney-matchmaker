import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  MapPin,
  Briefcase,
  Trophy,
  Clock,
  Languages,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import type { Attorney } from "../types/api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function PillTag({ label, amber }: { label: string; amber?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
        amber
          ? "bg-[rgba(252,170,45,0.1)] text-[#191918] border-[rgba(252,170,45,0.3)]"
          : "bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border-[rgba(25,25,24,0.1)]"
      }`}
    >
      {label}
    </span>
  );
}

function NotableCasesSection({ cases }: { cases: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cases : cases.slice(0, 2);

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Notable Cases</h2>
      <ul className="space-y-2">
        {visible.map((c, i) => (
          <li key={i} className="text-sm text-gray-600 leading-relaxed pl-3 border-l-2 border-[rgba(252,170,45,0.4)]">
            {c}
          </li>
        ))}
      </ul>
      {cases.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-medium text-[#FCAA2D] hover:text-amber-600 transition-colors"
        >
          {expanded ? "Show less" : `Show all ${cases.length} cases`}
        </button>
      )}
    </div>
  );
}

export default function AttorneyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [attorney, setAttorney] = useState<Attorney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/attorneys/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Attorney not found");
        return r.json();
      })
      .then(setAttorney)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFEF2] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#FCAA2D] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !attorney) {
    return (
      <div className="min-h-screen bg-[#FFFEF2] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Attorney not found.</p>
        <Link to="/" className="text-[#FCAA2D] hover:text-amber-600 text-sm font-medium">
          ← Back to search
        </Link>
      </div>
    );
  }

  const winPct = Math.round(attorney.win_rate * 100);

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to search
        </Link>

        {/* Header card */}
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 mb-4">
          <div className="flex items-start gap-4">
            {/* Avatar placeholder */}
            <div className="h-16 w-16 rounded-xl bg-[rgba(252,170,45,0.15)] flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-[#FCAA2D]">
                {attorney.name.charAt(0)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#191918] truncate">{attorney.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{attorney.firm}</p>
              <p className="text-xs text-gray-400 mt-0.5">Bar #{attorney.bar_number}</p>

              <div className="flex flex-wrap gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${
                    attorney.availability === "available"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : attorney.availability === "limited"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}
                >
                  {attorney.availability}
                </span>
                {attorney.free_consultation && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="h-3 w-3" />
                    Free consultation
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Trophy className="h-4 w-4 text-[#FCAA2D]" />, value: `${winPct}%`, label: "Win rate" },
              { icon: <Briefcase className="h-4 w-4 text-[#FCAA2D]" />, value: `${attorney.years_experience} yrs`, label: "Experience" },
              { icon: <Clock className="h-4 w-4 text-[#FCAA2D]" />, value: attorney.response_time_hours ? `~${attorney.response_time_hours}h` : "—", label: "Response time" },
              { icon: <span className="text-[#FCAA2D] text-sm font-bold">$</span>, value: attorney.hourly_rate ? `$${attorney.hourly_rate}/hr` : "Contact", label: "Hourly rate" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center bg-[rgba(25,25,24,0.02)] border border-[rgba(25,25,24,0.08)] rounded-lg p-3 text-center">
                {stat.icon}
                <span className="mt-1 text-sm font-bold text-[#191918]">{stat.value}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bio */}
        {attorney.bio && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">About</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{attorney.bio}</p>
          </div>
        )}

        {/* Languages */}
        {attorney.languages && attorney.languages.length > 0 && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Languages className="h-4 w-4 text-[#FCAA2D]" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Languages</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attorney.languages.map((lang) => (
                <PillTag key={lang} label={lang} />
              ))}
            </div>
          </div>
        )}

        {/* Practice areas + jurisdictions */}
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Practice Areas</h2>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {attorney.specializations.map((s) => (
              <PillTag key={s} label={s.replace(/_/g, " ")} amber />
            ))}
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Jurisdictions</h2>
          <div className="flex flex-wrap gap-1.5">
            {attorney.jurisdictions.map((j) => (
              <span key={j} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[rgba(25,25,24,0.05)] text-[rgba(25,25,24,0.6)] border border-[rgba(25,25,24,0.1)]">
                <MapPin className="h-2.5 w-2.5" />
                {j}
              </span>
            ))}
          </div>
        </div>

        {/* Notable cases */}
        {attorney.notable_cases && attorney.notable_cases.length > 0 && (
          <NotableCasesSection cases={attorney.notable_cases} />
        )}

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] px-6 hover:bg-amber-400 transition-colors"
          >
            Find attorneys for my case →
          </Link>
        </div>
      </div>
    </div>
  );
}
