import { useReducer, useState, useRef } from "react";
import {
  Loader2, Search, ChevronRight, ChevronLeft, Sparkles,
} from "lucide-react";
import type { MatchResponse, BudgetGoals } from "../types/api";
import { submitIntake, enqueueMatch, pollJob, refineFacts } from "../api/client";
import MatchProgressBar from "./MatchProgressBar";
import StepProgressBar from "./StepProgressBar";
import RefinementStep from "./RefinementStep";
import BudgetGoalsStep from "./BudgetGoalsStep";
import AdvancedSearchGrid, { type AdvancedSearchState } from "./AdvancedSearchGrid";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface IntakeFormProps {
  onMatchComplete: (result: MatchResponse) => void;
}

/* ------------------------------------------------------------------ */
/*  Urgency constants & color maps (light mode)                        */
/* ------------------------------------------------------------------ */

const URGENCY_OPTIONS = ["low", "medium", "high", "critical"] as const;
type Urgency = (typeof URGENCY_OPTIONS)[number];

const URGENCY_COLORS: Record<Urgency, string> = {
  low:      "bg-gray-100 text-gray-600 border-gray-300",
  medium:   "bg-blue-50 text-blue-600 border-blue-200",
  high:     "bg-amber-50 text-amber-700 border-amber-300",
  critical: "bg-red-50 text-red-600 border-red-300",
};

const URGENCY_ACTIVE: Record<Urgency, string> = {
  low:      "bg-gray-200 text-gray-800 border-gray-400 ring-1 ring-gray-400",
  medium:   "bg-[#FCAA2D] text-[#191918] border-[#FCAA2D] ring-1 ring-amber-400",
  high:     "bg-amber-500 text-white border-amber-500 ring-1 ring-amber-400",
  critical: "bg-red-500 text-white border-red-500 ring-1 ring-red-400",
};

/* ------------------------------------------------------------------ */
/*  Budget goals state shape                                           */
/* ------------------------------------------------------------------ */

interface BudgetGoalsFormState {
  pretrial: string;
  complaint: string;
  discovery: string;
  hearing: string;
  hourly_rate_ceiling: string;
}

function parseBudgetGoals(b: BudgetGoalsFormState): BudgetGoals | undefined {
  const pretrial = parseFloat(b.pretrial) || undefined;
  const complaint = parseFloat(b.complaint) || undefined;
  const discovery = parseFloat(b.discovery) || undefined;
  const hearing = parseFloat(b.hearing) || undefined;
  const hourly_rate_ceiling = parseFloat(b.hourly_rate_ceiling) || undefined;
  if (!pretrial && !complaint && !discovery && !hearing && !hourly_rate_ceiling) return undefined;
  return { pretrial, complaint, discovery, hearing, hourly_rate_ceiling };
}

/* ------------------------------------------------------------------ */
/*  Reducer state & actions                                            */
/* ------------------------------------------------------------------ */

type Step = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;

interface IntakeFormState {
  step: Step;
  facts: string;
  refinementQuestions: string[];
  refinementAnswers: string;
  urgency: Urgency;
  budgetGoals: BudgetGoalsFormState;
  advancedMode: boolean;
  subjectMatterJurisdiction: string;
  venueCourt: string;
  personalJurisdictionBasis: string;
  proceduralPosture: string;
  primaryRemedy: string;
  evasiveDefendant: boolean;
  client_email: string;
}

type IntakeFormAction =
  | { type: "SET_FACTS"; payload: string }
  | { type: "SET_URGENCY"; payload: Urgency }
  | { type: "SET_REFINEMENT_QUESTIONS"; payload: string[] }
  | { type: "SET_REFINEMENT_ANSWERS"; payload: string }
  | { type: "SET_BUDGET_GOAL"; payload: { key: keyof BudgetGoalsFormState; value: string } }
  | { type: "SET_ADVANCED_MODE"; payload: boolean }
  | { type: "SET_ADVANCED_FIELD"; payload: { key: keyof AdvancedSearchState; value: string | boolean } }
  | { type: "SET_CLIENT_EMAIL"; payload: string }
  | { type: "SKIP_TO_BUDGET" }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "RESET" };

const INITIAL_BUDGET: BudgetGoalsFormState = {
  pretrial: "", complaint: "", discovery: "", hearing: "", hourly_rate_ceiling: "",
};

const INITIAL_STATE: IntakeFormState = {
  step: 1,
  facts: "",
  refinementQuestions: [],
  refinementAnswers: "",
  urgency: "medium",
  budgetGoals: INITIAL_BUDGET,
  advancedMode: false,
  subjectMatterJurisdiction: "",
  venueCourt: "",
  personalJurisdictionBasis: "",
  proceduralPosture: "",
  primaryRemedy: "",
  evasiveDefendant: false,
  client_email: "",
};

/* ------------------------------------------------------------------ */
/*  sessionStorage helpers                                             */
/* ------------------------------------------------------------------ */

const SS_PREFIX = "intake_";

function persistToSession(state: IntakeFormState): void {
  try {
    sessionStorage.setItem(`${SS_PREFIX}step`, String(state.step));
    sessionStorage.setItem(`${SS_PREFIX}urgency`, state.urgency);
    sessionStorage.setItem(`${SS_PREFIX}refinementAnswers`, state.refinementAnswers);
    sessionStorage.setItem(`${SS_PREFIX}budgetGoals`, JSON.stringify(state.budgetGoals));
    sessionStorage.setItem(`${SS_PREFIX}advancedMode`, String(state.advancedMode));
    sessionStorage.setItem(`${SS_PREFIX}subjectMatterJurisdiction`, state.subjectMatterJurisdiction);
    sessionStorage.setItem(`${SS_PREFIX}venueCourt`, state.venueCourt);
    sessionStorage.setItem(`${SS_PREFIX}personalJurisdictionBasis`, state.personalJurisdictionBasis);
    sessionStorage.setItem(`${SS_PREFIX}proceduralPosture`, state.proceduralPosture);
    sessionStorage.setItem(`${SS_PREFIX}primaryRemedy`, state.primaryRemedy);
    sessionStorage.setItem(`${SS_PREFIX}evasiveDefendant`, String(state.evasiveDefendant));
    sessionStorage.setItem(`${SS_PREFIX}client_email`, state.client_email);
    // facts excluded for PII reasons
  } catch { /* quota or private browsing */ }
}

function restoreFromSession(): Partial<IntakeFormState> {
  try {
    const restored: Partial<IntakeFormState> = {};
    const stepRaw = sessionStorage.getItem(`${SS_PREFIX}step`);
    if (stepRaw) {
      const n = Number(stepRaw);
      if (n >= 1 && n <= TOTAL_STEPS) restored.step = n as Step;
    }
    const urgRaw = sessionStorage.getItem(`${SS_PREFIX}urgency`);
    if (urgRaw === "low" || urgRaw === "medium" || urgRaw === "high" || urgRaw === "critical") {
      restored.urgency = urgRaw;
    }
    const raRaw = sessionStorage.getItem(`${SS_PREFIX}refinementAnswers`);
    if (raRaw) restored.refinementAnswers = raRaw;
    const bgRaw = sessionStorage.getItem(`${SS_PREFIX}budgetGoals`);
    if (bgRaw) {
      const p = JSON.parse(bgRaw);
      if (p && typeof p === "object") restored.budgetGoals = p as BudgetGoalsFormState;
    }
    const advRaw = sessionStorage.getItem(`${SS_PREFIX}advancedMode`);
    if (advRaw === "true") restored.advancedMode = true;
    const smj = sessionStorage.getItem(`${SS_PREFIX}subjectMatterJurisdiction`);
    if (smj) restored.subjectMatterJurisdiction = smj;
    const vc = sessionStorage.getItem(`${SS_PREFIX}venueCourt`);
    if (vc) restored.venueCourt = vc;
    const pjb = sessionStorage.getItem(`${SS_PREFIX}personalJurisdictionBasis`);
    if (pjb) restored.personalJurisdictionBasis = pjb;
    const pp = sessionStorage.getItem(`${SS_PREFIX}proceduralPosture`);
    if (pp) restored.proceduralPosture = pp;
    const pr = sessionStorage.getItem(`${SS_PREFIX}primaryRemedy`);
    if (pr) restored.primaryRemedy = pr;
    const evRaw = sessionStorage.getItem(`${SS_PREFIX}evasiveDefendant`);
    if (evRaw === "true") restored.evasiveDefendant = true;
    const ceRaw = sessionStorage.getItem(`${SS_PREFIX}client_email`);
    if (ceRaw) restored.client_email = ceRaw;
    return restored;
  } catch {
    return {};
  }
}

function clearSession(): void {
  try {
    [
      "step", "urgency", "refinementAnswers", "budgetGoals",
      "advancedMode", "subjectMatterJurisdiction", "venueCourt",
      "personalJurisdictionBasis", "proceduralPosture", "primaryRemedy",
      "evasiveDefendant", "client_email",
    ].forEach((k) => sessionStorage.removeItem(`${SS_PREFIX}${k}`));
  } catch { /* noop */ }
}

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

function intakeReducer(state: IntakeFormState, action: IntakeFormAction): IntakeFormState {
  let next: IntakeFormState;
  switch (action.type) {
    case "SET_FACTS":
      next = { ...state, facts: action.payload }; break;
    case "SET_URGENCY":
      next = { ...state, urgency: action.payload }; break;
    case "SET_REFINEMENT_QUESTIONS":
      next = { ...state, refinementQuestions: action.payload }; break;
    case "SET_REFINEMENT_ANSWERS":
      next = { ...state, refinementAnswers: action.payload }; break;
    case "SET_BUDGET_GOAL":
      next = { ...state, budgetGoals: { ...state.budgetGoals, [action.payload.key]: action.payload.value } }; break;
    case "SET_ADVANCED_MODE":
      next = { ...state, advancedMode: action.payload }; break;
    case "SET_ADVANCED_FIELD":
      next = { ...state, [action.payload.key]: action.payload.value } as IntakeFormState; break;
    case "SET_CLIENT_EMAIL":
      next = { ...state, client_email: action.payload }; break;
    case "SKIP_TO_BUDGET":
      next = { ...state, step: 3 as Step }; break;
    case "NEXT_STEP":
      next = { ...state, step: state.step < TOTAL_STEPS ? ((state.step + 1) as Step) : state.step }; break;
    case "PREV_STEP":
      next = { ...state, step: state.step > 1 ? ((state.step - 1) as Step) : state.step }; break;
    case "RESET":
      next = { ...INITIAL_STATE }; break;
    default:
      return state;
  }
  persistToSession(next);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Slide header helper                                                */
/* ------------------------------------------------------------------ */

function SlideHeader({ step, headline, subtitle }: { step: number; headline: string; subtitle?: string }) {
  return (
    <>
      <div className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-4">
        Step {step} of {TOTAL_STEPS}
      </div>
      <h2 className="text-2xl sm:text-4xl font-light text-[#191918] mb-2">{headline}</h2>
      {subtitle && <p className="text-[rgba(25,25,24,0.45)] text-sm mb-8">{subtitle}</p>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation buttons                                                 */
/* ------------------------------------------------------------------ */

function NavRow({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  loading = false,
  showBack = true,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-10 gap-3">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#FCAA2D] px-5 sm:px-7 py-3 min-h-[44px] font-mono text-[0.7rem] uppercase tracking-wide text-[#191918] hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing & Matching...
          </>
        ) : (
          <>
            {nextLabel}
            {!loading && nextLabel !== "Analyze & Match" && <ChevronRight className="h-4 w-4" />}
            {nextLabel === "Analyze & Match" && <Search className="h-4 w-4" />}
          </>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function IntakeForm({ onMatchComplete }: IntakeFormProps) {
  const [state, dispatch] = useReducer(intakeReducer, INITIAL_STATE, (init) => ({
    ...init,
    ...restoreFromSession(),
  }));

  const [loading, setLoading] = useState(false);
  const [jobStage, setJobStage] = useState<string>("queued");
  const [refineLoading, setRefineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    step, facts, urgency, refinementQuestions, refinementAnswers, budgetGoals,
    advancedMode, subjectMatterJurisdiction, venueCourt,
    personalJurisdictionBasis, proceduralPosture, primaryRemedy, evasiveDefendant,
    client_email,
  } = state;

  const advancedValues: AdvancedSearchState = {
    subjectMatterJurisdiction,
    venueCourt,
    personalJurisdictionBasis,
    proceduralPosture,
    primaryRemedy,
    evasiveDefendant,
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email.trim());
  const canAdvanceStep1 = facts.trim().length >= 20 && isValidEmail;
  const truncatedFacts = facts.length > 200 ? `${facts.slice(0, 200)}...` : facts;

  /* ---- AI Refinement (Step 1 -> 2) ---- */
  const handleGetQuestions = async () => {
    setRefineLoading(true);
    setError(null);
    try {
      const res = await refineFacts({ facts: facts.trim() });
      dispatch({ type: "SET_REFINEMENT_QUESTIONS", payload: res.questions });
      dispatch({ type: "NEXT_STEP" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI questions. Please try again.");
    } finally {
      setRefineLoading(false);
    }
  };

  /* ---- Submit (Step 4) — async polling ---- */
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setJobStage("queued");
    const fullDescription = facts.trim() +
      (refinementAnswers.trim() ? "\n\nAdditional context:\n" + refinementAnswers.trim() : "");

    try {
      const intake = await submitIntake({
        description: fullDescription,
        urgency,
        budget_goals: parseBudgetGoals(budgetGoals),
        client_email: client_email.trim() || undefined,
        ...(advancedMode && {
          jurisdiction: venueCourt || undefined,
          subject_matter_jurisdiction: subjectMatterJurisdiction || undefined,
          personal_jurisdiction_basis: personalJurisdictionBasis || undefined,
          procedural_posture: proceduralPosture || undefined,
          primary_remedy: primaryRemedy || undefined,
          evasive_defendant: evasiveDefendant || undefined,
          advanced_mode: true,
        }),
      });

      // Enqueue the pipeline — get job_id immediately
      const { job_id } = await enqueueMatch({ case_id: intake.case_id });

      // Poll every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const job = await pollJob(job_id);
          setJobStage(job.stage);
          if (job.stage === "complete" && job.result) {
            clearInterval(pollRef.current!);
            clearSession();
            dispatch({ type: "RESET" });
            setLoading(false);
            onMatchComplete(job.result);
          } else if (job.stage === "failed") {
            clearInterval(pollRef.current!);
            setError(job.error || "Match pipeline failed");
            setLoading(false);
          }
        } catch { /* network blip — keep polling */ }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  /* ================================================================ */
  return (
    <div className="flex flex-col">
      {/* Progress bar */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-6">
        <StepProgressBar currentStep={step} />
      </div>

      {/* ============================================================ */}
      {/* STEP 1 -- Case Facts & Urgency                              */}
      {/* ============================================================ */}
      {step === 1 && (
        <div key={1} className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-xl">
            <SlideHeader
              step={1}
              headline="Describe the facts."
              subtitle="Include parties, dates, key events, and the nature of the dispute. The engine will automatically determine the optimal court."
            />

            {/* Advanced Mode toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-gray-500">Advanced Strategic Search</span>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_ADVANCED_MODE", payload: !advancedMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  advancedMode ? "bg-[#FCAA2D]" : "bg-gray-200"
                }`}
                aria-label="Toggle advanced mode"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                    advancedMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Advanced grid — animated show/hide */}
            <div className={`transition-all duration-300 overflow-hidden ${advancedMode ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
              <AdvancedSearchGrid
                values={advancedValues}
                onChange={(key, value) =>
                  dispatch({ type: "SET_ADVANCED_FIELD", payload: { key, value } })
                }
              />
            </div>

            <textarea
              rows={7}
              maxLength={10000}
              placeholder="Enter the factual basis of your matter, including relevant dates, parties, transactions, injuries, or disputes..."
              value={facts}
              onChange={(e) => dispatch({ type: "SET_FACTS", payload: e.target.value })}
              className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-4 py-3 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D] resize-y mb-1.5"
            />
            <div className="flex justify-between text-xs text-gray-400 mb-5">
              <span>
                {facts.trim().length < 20
                  ? `${20 - facts.trim().length} more characters needed`
                  : "Ready to proceed"}
              </span>
              <span>{facts.length.toLocaleString()} / 10,000</span>
            </div>

            <div className="mb-6">
              <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                Your Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={client_email}
                onChange={(e) => dispatch({ type: "SET_CLIENT_EMAIL", payload: e.target.value })}
                className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-4 py-3 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
              />
              {client_email.trim() && !isValidEmail && (
                <p className="text-xs text-red-400 mt-1">Enter a valid email address.</p>
              )}
              {(!client_email.trim() || isValidEmail) && (
                <p className="text-xs text-[rgba(25,25,24,0.45)] mt-1">We'll notify you when matches are ready.</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                Urgency
              </label>
              <div className="flex gap-2 flex-wrap">
                {URGENCY_OPTIONS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => dispatch({ type: "SET_URGENCY", payload: u })}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize border transition-all ${
                      urgency === u ? URGENCY_ACTIVE[u] : URGENCY_COLORS[u]
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-[rgba(25,25,24,0.35)] text-center mt-2 mb-4">
              By submitting, you agree that Attorney Matchmaker is not a law firm and does not provide legal advice.
            </p>

            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={!canAdvanceStep1 || refineLoading}
                onClick={handleGetQuestions}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#FCAA2D] w-full sm:w-auto px-5 sm:px-7 py-3 min-h-[44px] font-mono text-[0.7rem] uppercase tracking-wide text-[#191918] hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {refineLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting Questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Get AI Questions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2 -- AI Fact Refinement                                */}
      {/* ============================================================ */}
      {step === 2 && (
        <div key={2} className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-xl">
            <SlideHeader
              step={2}
              headline="Clarify the details."
              subtitle="Our AI identified gaps in the fact pattern. Answer these questions to strengthen your match."
            />
            <RefinementStep
              questions={refinementQuestions}
              answers={refinementAnswers}
              loading={false}
              onAnswersChange={(val) => dispatch({ type: "SET_REFINEMENT_ANSWERS", payload: val })}
            />
            {advancedMode && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SKIP_TO_BUDGET" })}
                  className="text-xs text-[rgba(25,25,24,0.45)] hover:text-[#FCAA2D] underline underline-offset-2 transition-colors"
                >
                  Skip Refinement — go to Budget
                </button>
              </div>
            )}
            <NavRow
              showBack
              onBack={() => dispatch({ type: "PREV_STEP" })}
              onNext={() => dispatch({ type: "NEXT_STEP" })}
              nextLabel="Continue"
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3 -- Stage-Gate Budget Goals                           */}
      {/* ============================================================ */}
      {step === 3 && (
        <div key={3} className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-xl">
            <SlideHeader
              step={3}
              headline="Set your budget."
              subtitle="Define maximum spend for each litigation stage. All fields are optional."
            />
            <BudgetGoalsStep
              budgetGoals={budgetGoals}
              onChange={(key, value) => dispatch({ type: "SET_BUDGET_GOAL", payload: { key, value } })}
            />
            <NavRow
              showBack
              onBack={() => dispatch({ type: "PREV_STEP" })}
              onNext={() => dispatch({ type: "NEXT_STEP" })}
              nextLabel="Review"
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4 -- Review & Submit                                   */}
      {/* ============================================================ */}
      {step === 4 && (
        <div key={4} className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-xl">
            <SlideHeader
              step={4}
              headline="Ready to match."
              subtitle="Review your submission before we find the right counsel."
            />

            <div className="rounded-xl border border-[rgba(25,25,24,0.12)] overflow-hidden mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[rgba(25,25,24,0.06)]">
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-[rgba(25,25,24,0.45)] font-mono text-[0.65rem] uppercase tracking-wide">Urgency</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize border ${URGENCY_ACTIVE[urgency]}`}>
                        {urgency}
                      </span>
                    </td>
                  </tr>
                  {(budgetGoals.hourly_rate_ceiling || budgetGoals.pretrial) && (
                    <tr className="bg-[rgba(25,25,24,0.02)]">
                      <td className="px-4 py-3 text-[rgba(25,25,24,0.45)] font-mono text-[0.65rem] uppercase tracking-wide">Budget</td>
                      <td className="px-4 py-3 text-[#191918] text-xs">
                        {budgetGoals.hourly_rate_ceiling && <span className="mr-3">Rate ceiling: ${budgetGoals.hourly_rate_ceiling}/hr</span>}
                        {budgetGoals.pretrial && <span className="mr-3">Pre-trial: ${budgetGoals.pretrial}</span>}
                      </td>
                    </tr>
                  )}
                  {advancedMode && (
                    <tr className="bg-[rgba(252,170,45,0.05)]">
                      <td className="px-4 py-3 text-[rgba(25,25,24,0.45)] font-mono text-[0.65rem] uppercase tracking-wide align-top">Advanced</td>
                      <td className="px-4 py-3 text-xs text-[#191918] space-y-0.5">
                        {venueCourt && <div>Venue: <span className="font-medium">{venueCourt}</span></div>}
                        {subjectMatterJurisdiction && <div>SMJ: <span className="font-medium">{subjectMatterJurisdiction}</span></div>}
                        {proceduralPosture && <div>Posture: <span className="font-medium">{proceduralPosture}</span></div>}
                        {primaryRemedy && <div>Remedy: <span className="font-medium">{primaryRemedy}</span></div>}
                        {evasiveDefendant && (
                          <div className="text-amber-600 font-semibold">Evasive defendant flag active</div>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-[rgba(25,25,24,0.45)] font-mono text-[0.65rem] uppercase tracking-wide align-top">Facts</td>
                    <td className="px-4 py-3 text-[rgba(25,25,24,0.7)] whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {truncatedFacts}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Venue and court will be automatically determined from your case facts.
            </p>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">
                {error}
              </div>
            )}
            {loading && (
              <div className="mb-4">
                <MatchProgressBar stage={jobStage} />
              </div>
            )}

            <NavRow
              showBack
              onBack={() => dispatch({ type: "PREV_STEP" })}
              onNext={handleSubmit}
              nextLabel={loading ? "Analyzing..." : "Analyze & Match"}
              nextDisabled={loading}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
