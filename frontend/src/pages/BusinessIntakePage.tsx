import { useState } from "react";
import { Loader2, ChevronRight, ChevronLeft, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";
import { submitIntake, enqueueMatch, pollJob } from "../api/client";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type CompanySize = "1-10" | "11-50" | "51-200" | "200+";
type LegalIssueType =
  | "contract_dispute"
  | "employment"
  | "ip"
  | "regulatory"
  | "general_corporate";
type MonthlyBudget = "under_5k" | "5k_25k" | "25k_plus";
type Urgency = "low" | "medium" | "high";

interface BusinessFields {
  company_size: CompanySize | "";
  legal_issue_type: LegalIssueType | "";
  in_house_counsel_pref: boolean;
  monthly_budget: MonthlyBudget | "";
}

/* ------------------------------------------------------------------ */
/*  Label helpers                                                       */
/* ------------------------------------------------------------------ */

const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  "1-10": "1–10 employees",
  "11-50": "11–50 employees",
  "51-200": "51–200 employees",
  "200+": "200+ employees",
};

const LEGAL_ISSUE_LABELS: Record<LegalIssueType, string> = {
  contract_dispute: "Contract Dispute",
  employment: "Employment / HR",
  ip: "Intellectual Property",
  regulatory: "Regulatory / Compliance",
  general_corporate: "General Corporate",
};

const BUDGET_LABELS: Record<MonthlyBudget, string> = {
  under_5k: "Under $5,000 / mo",
  "5k_25k": "$5,000–$25,000 / mo",
  "25k_plus": "$25,000+ / mo",
};

const URGENCY_LABELS: Record<Urgency, string> = {
  low: "Low — weeks to months",
  medium: "Medium — days to weeks",
  high: "High — urgent, within days",
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[0.65rem] font-semibold transition-colors ${
              i + 1 === current
                ? "bg-[#FCAA2D] text-[#191918]"
                : i + 1 < current
                ? "bg-[#191918] text-[#FFFEF2]"
                : "bg-[rgba(25,25,24,0.08)] text-[rgba(25,25,24,0.4)]"
            }`}
          >
            {i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-px w-8 transition-colors ${
                i + 1 < current ? "bg-[#191918]" : "bg-[rgba(25,25,24,0.12)]"
              }`}
            />
          )}
        </div>
      ))}
      <span className="font-mono text-[0.65rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest ml-2">
        Step {current} of {total}
      </span>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-4 py-3 text-sm text-[#191918] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D] appearance-none cursor-pointer"
      >
        <option value="">Select…</option>
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

export default function BusinessIntakePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [businessFields, setBusinessFields] = useState<BusinessFields>({
    company_size: "",
    legal_issue_type: "",
    in_house_counsel_pref: false,
    monthly_budget: "",
  });

  // Step 2 fields
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [clientEmail, setClientEmail] = useState("");

  // Submission state
  const [loading, setLoading] = useState(false);
  const [jobStage, setJobStage] = useState<string>("queued");
  const [error, setError] = useState<string | null>(null);

  /* ---- Validation ---- */
  const step1Valid =
    businessFields.company_size !== "" &&
    businessFields.legal_issue_type !== "" &&
    businessFields.monthly_budget !== "";

  const step2Valid = description.trim().length >= 20;

  const emailValid =
    clientEmail.trim() === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim());

  /* ---- Submit ---- */
  async function handleSubmit() {
    if (!step2Valid || !emailValid) return;
    setLoading(true);
    setError(null);
    setJobStage("queued");

    try {
      const intake = await submitIntake({
        description: description.trim(),
        urgency,
        client_email: clientEmail.trim() || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(({ client_type: "business", business_fields: businessFields } as any)),
      });

      const { job_id } = await enqueueMatch({ case_id: intake.case_id });

      const pollInterval = setInterval(async () => {
        try {
          const job = await pollJob(job_id);
          setJobStage(job.stage);
          if (job.stage === "complete" && job.result) {
            clearInterval(pollInterval);
            // Store result in sessionStorage so /app can pick it up
            sessionStorage.setItem("biz_match_result", JSON.stringify(job.result));
            navigate("/app");
          } else if (job.stage === "failed") {
            clearInterval(pollInterval);
            setError(job.error ?? "Match pipeline failed. Please try again.");
            setLoading(false);
          }
        } catch {
          /* network blip — keep polling */
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  /* ---- Stage label ---- */
  const stageLabel: Record<string, string> = {
    queued: "Queued…",
    intake: "Processing intake…",
    analysis: "Analyzing with Gemini…",
    matching: "Matching attorneys…",
    audit: "Running Claude audit…",
    complete: "Complete!",
    failed: "Failed",
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2] flex flex-col">
      <LandingNav />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-16">
        {/* Hero header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-[#FCAA2D]/10 border border-[#FCAA2D]/30 rounded-full px-3 py-1 mb-4">
            <Building2 className="w-3.5 h-3.5 text-[#FCAA2D]" />
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[#191918]">
              For Businesses
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#191918] mb-3">
            Find corporate counsel.
          </h1>
          <p className="text-[rgba(25,25,24,0.6)] text-base max-w-lg">
            AI-matched attorneys with verified court records. Describe your
            business's legal need and get ranked matches in minutes.
          </p>
        </div>

        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 sm:p-8">
          <StepIndicator current={step} total={2} />

          {/* ============================================================ */}
          {/* STEP 1 — Business info                                        */}
          {/* ============================================================ */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-semibold text-[#191918] mb-1">
                  Tell us about your business.
                </h2>
                <p className="text-sm text-[rgba(25,25,24,0.5)]">
                  This helps us surface attorneys with the right experience for
                  your company's size and legal need.
                </p>
              </div>

              <SelectField<CompanySize>
                label="Company size"
                value={businessFields.company_size}
                onChange={(v) =>
                  setBusinessFields((f) => ({ ...f, company_size: v }))
                }
                options={(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map(
                  (k) => ({ value: k, label: COMPANY_SIZE_LABELS[k] })
                )}
                required
              />

              <SelectField<LegalIssueType>
                label="Primary legal issue"
                value={businessFields.legal_issue_type}
                onChange={(v) =>
                  setBusinessFields((f) => ({ ...f, legal_issue_type: v }))
                }
                options={(
                  Object.keys(LEGAL_ISSUE_LABELS) as LegalIssueType[]
                ).map((k) => ({ value: k, label: LEGAL_ISSUE_LABELS[k] }))}
                required
              />

              <SelectField<MonthlyBudget>
                label="Monthly legal budget"
                value={businessFields.monthly_budget}
                onChange={(v) =>
                  setBusinessFields((f) => ({ ...f, monthly_budget: v }))
                }
                options={(Object.keys(BUDGET_LABELS) as MonthlyBudget[]).map(
                  (k) => ({ value: k, label: BUDGET_LABELS[k] })
                )}
                required
              />

              {/* In-house counsel pref */}
              <div className="flex items-start gap-3 pt-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={businessFields.in_house_counsel_pref}
                  onClick={() =>
                    setBusinessFields((f) => ({
                      ...f,
                      in_house_counsel_pref: !f.in_house_counsel_pref,
                    }))
                  }
                  className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 transition-colors flex items-center justify-center ${
                    businessFields.in_house_counsel_pref
                      ? "bg-[#FCAA2D] border-[#FCAA2D]"
                      : "bg-white border-[rgba(25,25,24,0.25)]"
                  }`}
                >
                  {businessFields.in_house_counsel_pref && (
                    <svg
                      className="w-3 h-3 text-[#191918]"
                      fill="none"
                      viewBox="0 0 12 12"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2 6l3 3 5-5"
                      />
                    </svg>
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium text-[#191918]">
                    Prefer attorneys with in-house counsel experience
                  </p>
                  <p className="text-xs text-[rgba(25,25,24,0.45)] mt-0.5">
                    Prioritize attorneys who have worked inside corporations or
                    handled ongoing corporate advisory work.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#FCAA2D] px-6 py-3 min-h-[44px] font-mono text-[0.7rem] uppercase tracking-wide text-[#191918] hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2 — Case description                                     */}
          {/* ============================================================ */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-semibold text-[#191918] mb-1">
                  Describe the matter.
                </h2>
                <p className="text-sm text-[rgba(25,25,24,0.5)]">
                  Include relevant parties, timeline, and the nature of the
                  dispute. The AI will determine the optimal court and
                  jurisdiction automatically.
                </p>
              </div>

              <div>
                <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                  Case description <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={7}
                  maxLength={10000}
                  placeholder="Describe the legal matter — parties involved, key dates, the dispute, and what outcome you need..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-4 py-3 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D] resize-y"
                />
                <div className="flex justify-between text-xs text-[rgba(25,25,24,0.35)] mt-1">
                  <span>
                    {description.trim().length < 20
                      ? `${20 - description.trim().length} more characters required`
                      : "Ready to proceed"}
                  </span>
                  <span>{description.length.toLocaleString()} / 10,000</span>
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                  Urgency
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(["low", "medium", "high"] as Urgency[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`rounded-lg border px-4 py-2.5 text-left transition-colors ${
                        urgency === u
                          ? "bg-[#FCAA2D]/10 border-[#FCAA2D] text-[#191918]"
                          : "bg-white border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.7)]"
                      }`}
                    >
                      <div className="font-mono text-[0.65rem] uppercase tracking-widest mb-0.5 font-semibold">
                        {u}
                      </div>
                      <div className="text-xs">{URGENCY_LABELS[u]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
                  Contact email{" "}
                  <span className="text-[rgba(25,25,24,0.35)] normal-case font-sans text-[0.65rem]">
                    (optional)
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="legal@yourcompany.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-4 py-3 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
                />
                {clientEmail.trim() && !emailValid && (
                  <p className="text-xs text-red-400 mt-1">
                    Enter a valid email address.
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Loading stage */}
              {loading && (
                <div className="rounded-lg bg-[#FCAA2D]/8 border border-[#FCAA2D]/20 px-4 py-3 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FCAA2D] flex-shrink-0" />
                  <span className="text-sm text-[#191918]">
                    {stageLabel[jobStage] ?? "Processing…"}
                  </span>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-sm text-[rgba(25,25,24,0.5)] hover:text-[#191918] transition-colors disabled:opacity-40 min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  disabled={!step2Valid || !emailValid || loading}
                  onClick={handleSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#FCAA2D] px-6 py-3 min-h-[44px] font-mono text-[0.7rem] uppercase tracking-wide text-[#191918] hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Matching…
                    </>
                  ) : (
                    "Find Counsel"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trust note */}
        <p className="text-center text-xs text-[rgba(25,25,24,0.35)] mt-6">
          AI-matched. Attorney-verified. No paid listings.
        </p>
      </main>

      <LandingFooter />
    </div>
  );
}
