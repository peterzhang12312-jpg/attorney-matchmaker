import { Helmet } from "react-helmet-async";
import LandingNav from "../components/landing/LandingNav";
import HeroBlock from "../components/landing/HeroBlock";
import StatsBand from "../components/landing/StatsBand";
import Testimonials from "../components/landing/Testimonials";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturesGrid from "../components/landing/FeaturesGrid";
import ForAttorneys from "../components/landing/ForAttorneys";
import GithubBand from "../components/landing/GithubBand";
import BlogPreview from "../components/landing/BlogPreview";
import LandingFooter from "../components/landing/LandingFooter";
import JsonLd from "../components/JsonLd";

const legalServiceSchema = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  "name": "Attorney Matchmaker",
  "description": "AI-powered attorney matching using real federal court docket data. No paid listings.",
  "url": "https://attorney-matchmaker.onrender.com",
  "serviceType": "Legal Referral Service",
  "areaServed": ["New York", "California", "United States"],
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": "https://attorney-matchmaker.onrender.com/app"
  }
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does AI attorney matching work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You describe your legal situation. Gemini AI extracts the practice area, legal issues, and ideal jurisdiction. A weighted algorithm scores registered attorneys. Claude Opus audits the matched results. You see ranked results with scores and reasoning."
      }
    },
    {
      "@type": "Question",
      "name": "What practice areas does Attorney Matchmaker support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorney Matchmaker covers 16+ practice areas including real estate, intellectual property, immigration, family law, criminal defense, employment law, personal injury, corporate law, bankruptcy, tax law, estate planning, and federal court matters."
      }
    },
    {
      "@type": "Question",
      "name": "Is Attorney Matchmaker free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Submitting a case and receiving attorney matches is free for clients. Attorneys pay per-lead credits to reveal client contact information."
      }
    },
    {
      "@type": "Question",
      "name": "How are attorneys scored and ranked?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorneys are scored on practice area match, jurisdiction coverage, availability, client budget alignment, and semantic similarity between their profile and your case using AI embeddings. Claude Opus audits the matched results for quality."
      }
    },
    {
      "@type": "Question",
      "name": "What jurisdictions are covered?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorney Matchmaker covers New York, California, and federal courts nationwide, with expanding coverage across all 50 states."
      }
    },
    {
      "@type": "Question",
      "name": "How do I find a real estate attorney near me?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Describe your real estate situation on Attorney Matchmaker. The AI identifies your jurisdiction automatically and returns attorneys who specialize in real estate law in your area, ranked by match score."
      }
    },
    {
      "@type": "Question",
      "name": "What is the attorney leaderboard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The leaderboard ranks attorneys by domain and jurisdiction using CourtListener federal docket data. It shows attorneys with the most relevant case history and highest AI-audited match scores."
      }
    },
    {
      "@type": "Question",
      "name": "How do attorneys join Attorney Matchmaker?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Attorneys register at attorney-matchmaker.onrender.com under the Attorney tab. Founding attorneys (first 20) receive bonus lead credits. Registration requires name, bar number, practice areas, and jurisdictions."
      }
    }
  ]
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>Attorney Matchmaker — Find the Right Attorney Using Real Court Data</title>
        <meta name="description" content="AI-powered attorney matching that uses real federal docket records, not paid listings. Describe your case and get matched to attorneys with proven experience in your exact situation." />
        <link rel="canonical" href="https://attorney-matchmaker.onrender.com" />
        <meta property="og:title" content="Attorney Matchmaker — Find the Right Attorney Using Real Court Data" />
        <meta property="og:description" content="AI-powered attorney matching using real federal court data. No paid listings. Free for clients." />
        <meta property="og:url" content="https://attorney-matchmaker.onrender.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Attorney Matchmaker" />
        <meta name="twitter:description" content="Find attorneys matched to your case using real court docket data, not paid rankings." />
      </Helmet>
      <JsonLd data={legalServiceSchema} />
      <JsonLd data={faqSchema} />
      <LandingNav />
      <main>
        <HeroBlock />
        <StatsBand />
        <Testimonials />
        <HowItWorks />
        <FeaturesGrid />
        <ForAttorneys />
        <BlogPreview />
        <GithubBand />
      </main>
      <LandingFooter />
    </div>
  );
}
