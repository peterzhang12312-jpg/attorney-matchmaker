import { useState } from "react";
import { registerAttorney } from "../api/client";
import type { AttorneyRegisterRequest } from "../types/api";
import StepProgressBar from "./StepProgressBar";
import { Check, Award } from "lucide-react";

interface AttorneyOnboardProps {
  onSuccess: (token: string, name: string, isFounding: boolean) => void;
}

const PRACTICE_AREAS = [
  "IP",
  "Employment",
  "Corporate",
  "Real Estate",
  "Civil Litigation",
  "Criminal Defense",
  "Immigration",
  "Family Law",
  "Bankruptcy",
  "Personal Injury",
  "Landlord-Tenant",
  "Estate Planning",
];

const ONBOARD_STEPS = [
  { number: 1, label: "Account" },
  { number: 2, label: "Practice" },
  { number: 3, label: "Availability" },
  { number: 4, label: "Review" },
];

export default function AttorneyOnboard({ onSuccess }: AttorneyOnboardProps) {
  const [step, setStep] = useState(1);

  /* Step 1 — Account */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* Step 2 — Practice */
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [jurisdictionInput, setJurisdictionInput] = useState("");
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);

  /* Step 3 — Availability */
  const [caseload, setCaseload] = useState<"Low" | "Medium" | "High">("Medium");
  const [acceptingClients, setAcceptingClients] = useState(true);
  const [hourlyRate, setHourlyRate] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [firmName, setFirmName] = useState("");

  /* Submission state */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    name: string;
    isFounding: boolean;
  } | null>(null);

  function togglePracticeArea(area: string) {
    setPracticeAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  function addJurisdiction() {
    const trimmed = jurisdictionInput.trim();
    if (trimmed && !jurisdictions.includes(trimmed)) {
      setJurisdictions((prev) => [...prev, trimmed]);
      setJurisdictionInput("");
    }
  }

  function removeJurisdiction(j: string) {
    setJurisdictions((prev) => prev.filter((x) => x !== j));
  }

  function handleJurisdictionKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addJurisdiction();
    }
  }

  /* Map caseload to availability string the backend expects */
  const availabilityMap: Record<string, string> = {
    Low: "available",
    Medium: "limited",
    High: "unavailable",
  };

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const payload: AttorneyRegisterRequest = {
      name,
      email,
      password,
      bar_number: barNumber || undefined,
      firm: firmName || undefined,
      jurisdictions: jurisdictions.length > 0 ? jurisdictions : undefined,
      practice_areas: practiceAreas.length > 0 ? practiceAreas : undefined,
      hourly_rate: hourlyRate || undefined,
      availability: availabilityMap[caseload],
      accepting_clients: acceptingClients,
    };

    try {
      const res = await registerAttorney(payload);
      setSuccessData({ name: res.name, isFounding: res.is_founding });
      onSuccess(res.token, res.name, res.is_founding);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  /* Validation per step */
  const step1Valid = name.trim().length > 0 && email.includes("@") && password.length >= 8;
  const step2Valid = true; /* practice areas and jurisdictions are optional */

  if (successData) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 animate-fade-in">
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[#FCAA2D]/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-[#FCAA2D]" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-[#191918] mb-2">
            Welcome, {successData.name}!
          </h2>
          {successData.isFounding && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FCAA2D]/10 border border-[#FCAA2D]/30 rounded-md mt-2">
              <Award className="h-4 w-4 text-[#FCAA2D]" />
              <span className="font-mono text-[0.7rem] uppercase tracking-wide text-[#FCAA2D] font-semibold">
                Founding Attorney
              </span>
            </div>
          )}
          <p className="text-[rgba(25,25,24,0.45)] mt-4 text-sm">
            Your profile is live. You will be matched with clients whose cases align with your practice areas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
      <StepProgressBar currentStep={step} steps={ONBOARD_STEPS} />

      <div key={step} className="animate-fade-in">
        {/* ---- Step 1: Account ---- */}
        {step === 1 && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 space-y-5">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
              Create Your Account
            </h2>

            <div>
              <label className="block text-sm font-medium text-[#191918] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#191918] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@firm.com"
                className="w-full min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#191918] mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
              )}
            </div>

            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="w-full min-h-[44px] rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* ---- Step 2: Practice ---- */}
        {step === 2 && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 space-y-5">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
              Practice Areas
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRACTICE_AREAS.map((area) => {
                const selected = practiceAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => togglePracticeArea(area)}
                    className={`min-h-[44px] px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      selected
                        ? "bg-[#FCAA2D]/10 border-[#FCAA2D] text-[#191918]"
                        : "bg-white border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.45)] hover:border-[rgba(25,25,24,0.3)]"
                    }`}
                  >
                    {selected && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                    {area}
                  </button>
                );
              })}
            </div>

            <div>
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">
                Jurisdictions
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={jurisdictionInput}
                  onChange={(e) => setJurisdictionInput(e.target.value)}
                  onKeyDown={handleJurisdictionKeyDown}
                  placeholder="e.g. SDNY, EDNY, NY Supreme"
                  className="flex-1 min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
                />
                <button
                  type="button"
                  onClick={addJurisdiction}
                  className="min-h-[44px] px-4 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold hover:bg-amber-400"
                >
                  Add
                </button>
              </div>
              {jurisdictions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {jurisdictions.map((j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FCAA2D]/10 border border-[#FCAA2D]/30 rounded-md text-sm text-[#191918]"
                    >
                      {j}
                      <button
                        type="button"
                        onClick={() => removeJurisdiction(j)}
                        className="ml-0.5 text-[rgba(25,25,24,0.45)] hover:text-[#191918]"
                        aria-label={`Remove ${j}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 min-h-[44px] rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold hover:bg-[rgba(25,25,24,0.04)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!step2Valid}
                onClick={() => setStep(3)}
                className="flex-1 min-h-[44px] rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ---- Step 3: Availability ---- */}
        {step === 3 && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 space-y-5">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
              Availability & Details
            </h2>

            {/* Caseload */}
            <div>
              <label className="block text-sm font-medium text-[#191918] mb-2">
                Current Caseload
              </label>
              <div className="flex gap-2">
                {(["Low", "Medium", "High"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCaseload(level)}
                    className={`flex-1 min-h-[44px] px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      caseload === level
                        ? "bg-[#FCAA2D]/10 border-[#FCAA2D] text-[#191918]"
                        : "bg-white border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.45)] hover:border-[rgba(25,25,24,0.3)]"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Accepting clients toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#191918]">
                Accepting New Clients
              </span>
              <button
                type="button"
                onClick={() => setAcceptingClients(!acceptingClients)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  acceptingClients ? "bg-[#FCAA2D]" : "bg-[rgba(25,25,24,0.12)]"
                }`}
                role="switch"
                aria-checked={acceptingClients}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                    acceptingClients ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Hourly rate */}
            <div>
              <label className="block text-sm font-medium text-[#191918] mb-1">
                Hourly Rate (USD)
              </label>
              <input
                type="text"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="e.g. 450"
                className="w-full min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
              />
            </div>

            {/* Bar number */}
            <div>
              <label className="block text-sm font-medium text-[#191918] mb-1">
                Bar Number
              </label>
              <input
                type="text"
                value={barNumber}
                onChange={(e) => setBarNumber(e.target.value)}
                placeholder="Optional"
                className="w-full min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
              />
            </div>

            {/* Firm name */}
            <div>
              <label className="block text-sm font-medium text-[#191918] mb-1">
                Firm Name
              </label>
              <input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Optional"
                className="w-full min-h-[44px] px-3 py-2 border border-[rgba(25,25,24,0.12)] rounded-md bg-white text-[#191918] placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/40 focus:border-[#FCAA2D]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 min-h-[44px] rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold hover:bg-[rgba(25,25,24,0.04)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 min-h-[44px] rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold transition-colors hover:bg-amber-400"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* ---- Step 4: Review + Submit ---- */}
        {step === 4 && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 space-y-5">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
              Review Your Profile
            </h2>

            <table className="w-full text-sm">
              <tbody className="divide-y divide-[rgba(25,25,24,0.08)]">
                <tr>
                  <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium w-1/3">Name</td>
                  <td className="py-2 text-[#191918]">{name}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Email</td>
                  <td className="py-2 text-[#191918]">{email}</td>
                </tr>
                {practiceAreas.length > 0 && (
                  <tr>
                    <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Practice Areas</td>
                    <td className="py-2 text-[#191918]">
                      <div className="flex flex-wrap gap-1">
                        {practiceAreas.map((a) => (
                          <span
                            key={a}
                            className="px-2 py-0.5 bg-[#FCAA2D]/10 rounded text-xs"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {jurisdictions.length > 0 && (
                  <tr>
                    <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Jurisdictions</td>
                    <td className="py-2 text-[#191918]">{jurisdictions.join(", ")}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Caseload</td>
                  <td className="py-2 text-[#191918]">{caseload}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Accepting Clients</td>
                  <td className="py-2 text-[#191918]">{acceptingClients ? "Yes" : "No"}</td>
                </tr>
                {hourlyRate && (
                  <tr>
                    <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Hourly Rate</td>
                    <td className="py-2 text-[#191918]">${hourlyRate}/hr</td>
                  </tr>
                )}
                {barNumber && (
                  <tr>
                    <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Bar Number</td>
                    <td className="py-2 text-[#191918]">{barNumber}</td>
                  </tr>
                )}
                {firmName && (
                  <tr>
                    <td className="py-2 text-[rgba(25,25,24,0.45)] font-medium">Firm</td>
                    <td className="py-2 text-[#191918]">{firmName}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <p className="text-xs text-[rgba(25,25,24,0.35)] text-center">
              By registering, you agree to our{" "}
              <a href="/attorney-agreement" target="_blank" className="text-[#FCAA2D] hover:underline">
                Attorney Participation Agreement
              </a>
              {" "}governing referral fee arrangements under NY Rule 1.5(g).
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={submitting}
                className="flex-1 min-h-[44px] rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold hover:bg-[rgba(25,25,24,0.04)] disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 min-h-[44px] rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Registering..." : "Create Profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
