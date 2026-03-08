interface BudgetGoalsState {
  pretrial: string;
  complaint: string;
  discovery: string;
  hearing: string;
  hourly_rate_ceiling: string;
}

interface BudgetGoalsStepProps {
  budgetGoals: BudgetGoalsState;
  onChange: (key: keyof BudgetGoalsState, value: string) => void;
}

const STAGES = [
  { key: "pretrial" as const,  label: "Pre-trial",  hint: "Research, motions, settlement negotiations" },
  { key: "complaint" as const, label: "Complaint",  hint: "Drafting, filing, initial response" },
  { key: "discovery" as const, label: "Discovery",  hint: "Depositions, document review, expert witnesses" },
  { key: "hearing" as const,   label: "Hearing",    hint: "Trial preparation and court appearances" },
];

export default function BudgetGoalsStep({ budgetGoals, onChange }: BudgetGoalsStepProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STAGES.map(({ key, label, hint }) => (
          <div key={key} className="rounded-xl bg-white border border-[rgba(25,25,24,0.12)] p-4">
            <label className="block font-mono text-[0.68rem] text-[#191918] uppercase tracking-wide mb-1">{label}</label>
            <p className="text-[11px] text-[rgba(25,25,24,0.45)] mb-2">{hint}</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(25,25,24,0.35)] text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={budgetGoals[key]}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full rounded-lg bg-white border border-[rgba(25,25,24,0.12)] pl-7 pr-3 py-2 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-[rgba(25,25,24,0.12)] p-4">
        <label className="block font-mono text-[0.68rem] text-[#191918] uppercase tracking-wide mb-1">Hourly Rate Ceiling</label>
        <p className="text-[11px] text-[rgba(25,25,24,0.45)] mb-2">Maximum acceptable attorney hourly rate</p>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(25,25,24,0.35)] text-sm">$</span>
          <input
            type="number"
            min="0"
            step="25"
            placeholder="0"
            value={budgetGoals.hourly_rate_ceiling}
            onChange={(e) => onChange("hourly_rate_ceiling", e.target.value)}
            className="w-full rounded-lg bg-white border border-[rgba(25,25,24,0.12)] pl-7 pr-3 py-2 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(25,25,24,0.35)] text-xs">/hr</span>
        </div>
      </div>
    </div>
  );
}
