import { Check } from "lucide-react";

interface StepDef {
  number: number;
  label: string;
}

interface StepProgressBarProps {
  currentStep: number;
  steps?: StepDef[];
}

const DEFAULT_STEPS: StepDef[] = [
  { number: 1, label: "Facts" },
  { number: 2, label: "AI Refinement" },
  { number: 3, label: "Budget" },
  { number: 4, label: "Review" },
];

export default function StepProgressBar({ currentStep, steps = DEFAULT_STEPS }: StepProgressBarProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.number;
        const isActive = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#FCAA2D] border-[#FCAA2D] text-[#191918] shadow-lg shadow-amber-400/30"
                    : isCompleted
                      ? "bg-transparent border-[#FCAA2D] text-[#FCAA2D]"
                      : "bg-[rgba(25,25,24,0.04)] border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.35)]"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-[#FCAA2D]" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  isActive
                    ? "text-[#FCAA2D]"
                    : isCompleted
                      ? "text-[#FCAA2D]"
                      : "text-[rgba(25,25,24,0.35)]"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {idx < steps.length - 1 && (
              <div
                className={`w-10 sm:w-16 h-0.5 mx-2 mb-5 transition-colors ${
                  currentStep > step.number
                    ? "bg-[#FCAA2D]"
                    : "bg-[rgba(25,25,24,0.12)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
