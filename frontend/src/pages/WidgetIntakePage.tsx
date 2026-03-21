import { Helmet } from "react-helmet-async";
import IntakeForm from "../components/IntakeForm";
import type { MatchResponse } from "../types/api";

export default function WidgetIntakePage() {
  const params = new URLSearchParams(window.location.search);
  const partnerId = params.get("partner_id") ?? "widget";

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <Helmet>
        <title>Get Legal Help — Attorney Matchmaker</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="max-w-xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4 text-center">
          Powered by Attorney Matchmaker
        </p>
        <IntakeForm
          onMatchComplete={(_result: MatchResponse) => {
            window.parent.postMessage({ type: "INTAKE_COMPLETE", partnerId }, "*");
          }}
        />
      </div>
    </div>
  );
}
