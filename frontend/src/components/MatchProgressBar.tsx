const STAGES = [
  { key: "queued",    label: "In queue" },
  { key: "analyzing", label: "Analyzing your case..." },
  { key: "searching", label: "Searching court records..." },
  { key: "scoring",   label: "Scoring attorneys..." },
  { key: "auditing",  label: "Running AI audit..." },
  { key: "complete",  label: "Done" },
];

interface Props {
  stage: string;
}

export default function MatchProgressBar({ stage }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.key === stage);
  const label = STAGES.find((s) => s.key === stage)?.label || stage;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex justify-between mb-2">
        {STAGES.filter((s) => s.key !== "complete").map((s, i) => (
          <div
            key={s.key}
            className={`h-1.5 flex-1 mx-0.5 rounded-full transition-all duration-500 ${
              i <= currentIndex ? "bg-[#FCAA2D]" : "bg-[rgba(25,25,24,0.08)]"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 justify-center mt-3">
        {stage !== "complete" && stage !== "failed" && (
          <div className="w-4 h-4 border-2 border-[#FCAA2D] border-t-transparent rounded-full animate-spin" />
        )}
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.55)]">
          {label}
        </p>
      </div>
    </div>
  );
}
