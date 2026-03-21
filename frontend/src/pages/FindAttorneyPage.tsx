import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import JsonLd from "../components/JsonLd";

const PRACTICE_AREA_LABELS: Record<string, string> = {
  "personal-injury": "Personal Injury",
  "criminal-defense": "Criminal Defense",
  "immigration": "Immigration",
  "family-law": "Family Law",
  "employment": "Employment",
  "real-estate": "Real Estate",
  "bankruptcy": "Bankruptcy",
  "estate-planning": "Estate Planning",
  "landlord-tenant": "Landlord-Tenant",
  "intellectual-property": "Intellectual Property",
};

const CITY_LABELS: Record<string, string> = {
  "new-york": "New York",
  "los-angeles": "Los Angeles",
  "chicago": "Chicago",
  "houston": "Houston",
  "phoenix": "Phoenix",
  "philadelphia": "Philadelphia",
  "san-antonio": "San Antonio",
  "san-diego": "San Diego",
  "dallas": "Dallas",
  "san-jose": "San Jose",
};

export default function FindAttorneyPage() {
  const { practiceArea = "", city = "" } = useParams<{
    practiceArea: string;
    city: string;
  }>();

  const areaLabel = PRACTICE_AREA_LABELS[practiceArea] ?? practiceArea;
  const cityLabel = CITY_LABELS[city] ?? city;
  const title = `Find a ${areaLabel} Attorney in ${cityLabel}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": `${areaLabel} Attorney Matching — ${cityLabel}`,
    "description": `Free AI-powered attorney matching for ${areaLabel} cases in ${cityLabel}. Get matched in 2 minutes.`,
    "url": `https://attorney-matchmaker.onrender.com/find-attorney/${practiceArea}/${city}`,
    "areaServed": cityLabel,
    "serviceType": areaLabel,
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>{title} | Free Case Review — Attorney Matchmaker</title>
        <meta
          name="description"
          content={`Looking for a ${areaLabel} attorney in ${cityLabel}? Get AI-matched to the right lawyer in 2 minutes. Free, no commitment.`}
        />
        <link
          rel="canonical"
          href={`https://attorney-matchmaker.onrender.com/find-attorney/${practiceArea}/${city}`}
        />
      </Helmet>
      <JsonLd data={schema} />

      {/* Nav */}
      <nav className="border-b border-[rgba(25,25,24,0.12)] bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-semibold text-[#191918] tracking-wide">
          Attorney Matchmaker
        </Link>
        <Link
          to="/app"
          className="font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors"
        >
          For Attorneys
        </Link>
      </nav>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-[#191918] mb-4">
          {title}
        </h1>
        <p className="text-[rgba(25,25,24,0.65)] mb-8 text-lg leading-relaxed">
          Describe your situation and our AI matches you with the right{" "}
          {areaLabel.toLowerCase()} attorney in {cityLabel} — based on real court
          record data, not paid listings.
        </p>

        <ul className="mb-10 space-y-2 text-[rgba(25,25,24,0.65)] text-sm">
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            Free — no upfront cost to get matched
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            AI-scored attorneys using real federal court docket data
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            Results in under 2 minutes
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FCAA2D] font-bold">✓</span>
            No commitment — just a match recommendation
          </li>
        </ul>

        <Link
          to={`/app?area=${practiceArea}`}
          className="inline-block rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-8 py-4 font-semibold hover:bg-amber-400 transition-colors"
        >
          Get Matched in 2 Minutes →
        </Link>

        <p className="mt-6 text-xs text-[rgba(25,25,24,0.35)] font-mono">
          Expect contact from a matched attorney within 24 hours.
        </p>
      </main>
    </div>
  );
}
