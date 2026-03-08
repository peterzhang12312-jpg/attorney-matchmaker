import { MessageSquare } from "lucide-react";

interface RefinementStepProps {
  questions: string[];
  answers: string;
  loading: boolean;
  onAnswersChange: (value: string) => void;
}

export default function RefinementStep({ questions, answers, loading, onAnswersChange }: RefinementStepProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-[rgba(25,25,24,0.07)] rounded w-full mb-1" />
            <div className="h-4 bg-[rgba(25,25,24,0.07)] rounded w-4/5" />
          </div>
        ))}
        <p className="text-xs text-[rgba(25,25,24,0.45)] mt-3">Analyzing your case facts...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-[rgba(25,25,24,0.12)] bg-[rgba(25,25,24,0.02)] p-4">
        <p className="text-sm text-[rgba(25,25,24,0.45)]">No follow-up questions generated. You may proceed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-3 p-4 rounded-xl bg-[rgba(252,170,45,0.05)] border border-[rgba(252,170,45,0.2)]">
            <MessageSquare className="h-4 w-4 text-[#FCAA2D] mt-0.5 shrink-0" />
            <p className="text-sm text-[#191918] leading-relaxed">{q}</p>
          </div>
        ))}
      </div>

      <div>
        <label className="block font-mono text-[0.68rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
          Your answers
        </label>
        <textarea
          rows={5}
          placeholder="Address the questions above. Your answers will be appended to your case facts..."
          value={answers}
          onChange={(e) => onAnswersChange(e.target.value)}
          className="w-full rounded-xl bg-white border border-[rgba(25,25,24,0.12)] px-4 py-3 text-sm text-[#191918] placeholder-[rgba(25,25,24,0.3)] focus:outline-none focus:ring-2 focus:ring-[#FCAA2D]/30 focus:border-[#FCAA2D] resize-y"
        />
      </div>
    </div>
  );
}
