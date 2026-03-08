import { AlertTriangle } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface AdvancedSearchState {
  subjectMatterJurisdiction: string;
  venueCourt: string;
  personalJurisdictionBasis: string;
  proceduralPosture: string;
  primaryRemedy: string;
  evasiveDefendant: boolean;
}

interface AdvancedSearchGridProps {
  values: AdvancedSearchState;
  onChange: (key: keyof AdvancedSearchState, value: string | boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Option lists                                                        */
/* ------------------------------------------------------------------ */

const SMJ_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "federal_question", label: "Federal Question (28 U.S.C. § 1331)" },
  { value: "diversity", label: "Diversity (28 U.S.C. § 1332)" },
  { value: "state_supreme", label: "State Supreme Court" },
];

const VENUE_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "nysupct", label: "Queens County Supreme Court" },
  { value: "nysupct_ny", label: "NY County Supreme Court" },
  { value: "nysd", label: "S.D.N.Y. (Manhattan Federal)" },
  { value: "nyed", label: "E.D.N.Y. (Brooklyn Federal)" },
  { value: "cacd", label: "C.D. Cal. (Los Angeles Federal)" },
  { value: "cand", label: "N.D. Cal. (San Francisco Federal)" },
];

const PJB_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "domicile", label: "Domicile / Resident" },
  { value: "long_arm_transacting", label: "Long-Arm: Transacting Business" },
  { value: "long_arm_tortious", label: "Long-Arm: Tortious Act in State" },
  { value: "forum_selection", label: "Forum Selection Clause" },
];

const POSTURE_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "pre_litigation", label: "Pre-Litigation Demand" },
  { value: "complaint_drafted", label: "Complaint Drafted" },
  { value: "active_discovery", label: "Active Discovery" },
  { value: "dispositive_motions", label: "Dispositive Motions" },
];

const REMEDY_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "injunctive_tro", label: "Injunctive Relief / TRO" },
  { value: "specific_performance", label: "Specific Performance" },
  { value: "declaratory_judgment", label: "Declaratory Judgment" },
  { value: "monetary_damages", label: "Monetary Damages" },
];

/* ------------------------------------------------------------------ */
/*  Shared select component                                             */
/* ------------------------------------------------------------------ */

function GridSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-white border border-[rgba(25,25,24,0.12)] px-3 py-2 text-sm text-[#191918] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D] appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export default function AdvancedSearchGrid({
  values,
  onChange,
}: AdvancedSearchGridProps) {
  return (
    <div className="rounded-xl border border-[rgba(25,25,24,0.12)] bg-[rgba(252,170,45,0.05)] px-5 py-5 mb-5 space-y-4">
      <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
        Advanced Strategic Parameters
      </p>

      {/* 2-column grid for dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GridSelect
          label="Subject Matter Jurisdiction"
          value={values.subjectMatterJurisdiction}
          options={SMJ_OPTIONS}
          onChange={(v) => onChange("subjectMatterJurisdiction", v)}
        />
        <GridSelect
          label="Venue / Court"
          value={values.venueCourt}
          options={VENUE_OPTIONS}
          onChange={(v) => onChange("venueCourt", v)}
        />
        <GridSelect
          label="Personal Jurisdiction Basis"
          value={values.personalJurisdictionBasis}
          options={PJB_OPTIONS}
          onChange={(v) => onChange("personalJurisdictionBasis", v)}
        />
        <GridSelect
          label="Procedural Posture"
          value={values.proceduralPosture}
          options={POSTURE_OPTIONS}
          onChange={(v) => onChange("proceduralPosture", v)}
        />
        <GridSelect
          label="Primary Remedy Sought"
          value={values.primaryRemedy}
          options={REMEDY_OPTIONS}
          onChange={(v) => onChange("primaryRemedy", v)}
        />
      </div>

      {/* Evasive Defendant checkbox — full width, amber accent */}
      <label className="flex items-start gap-3 cursor-pointer group mt-1">
        <input
          type="checkbox"
          checked={values.evasiveDefendant}
          onChange={(e) => onChange("evasiveDefendant", e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-amber-500 focus:ring-amber-400 cursor-pointer"
        />
        <div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">
              Evasive Defendant
            </span>
          </div>
          <p className="text-xs text-amber-600 mt-0.5 leading-snug">
            Defendant location unknown / evading service — injects alternative-service
            search and boosts attorneys with proven alternative-service motion experience.
          </p>
        </div>
      </label>
    </div>
  );
}
