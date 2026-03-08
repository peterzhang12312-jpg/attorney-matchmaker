import { ShieldCheck } from "lucide-react";
import type { AuditResult } from "../types/api";

interface AuditSummaryProps {
  audit: AuditResult;
}

export default function AuditSummary({ audit }: AuditSummaryProps) {
  return (
    <div className="rounded-xl bg-white border border-[rgba(25,25,24,0.12)] p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-[#FCAA2D]" />
        <h2 className="text-sm font-semibold text-gray-900">Audit Summary</h2>
        {audit.audit_model && (
          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 border border-gray-200">
            {audit.audit_model}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 leading-relaxed">
        {audit.overall_assessment}
      </p>
    </div>
  );
}
