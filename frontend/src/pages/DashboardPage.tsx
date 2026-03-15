import { useState, useEffect } from "react";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";
import OTPForm from "../components/dashboard/OTPForm";
import CaseHistoryCard from "../components/dashboard/CaseHistoryCard";

interface CaseData {
  case_id: string;
  created_at?: string;
  urgency?: string;
  practice_area?: string;
  match_count: number;
  top_attorney?: string;
  has_results: boolean;
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem("dashboard_token"),
  );
  const [email, setEmail] = useState<string>(
    () => sessionStorage.getItem("dashboard_email") || "",
  );
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) fetchDashboard(token);
  }, [token]);

  async function fetchDashboard(t: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        setToken(null);
        sessionStorage.removeItem("dashboard_token");
        return;
      }
      const data = await res.json();
      setCases(data.cases || []);
    } catch {
      // network error — leave cases empty
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(t: string, e: string) {
    sessionStorage.setItem("dashboard_token", t);
    sessionStorage.setItem("dashboard_email", e);
    setToken(t);
    setEmail(e);
  }

  function handleLogout() {
    sessionStorage.removeItem("dashboard_token");
    sessionStorage.removeItem("dashboard_email");
    setToken(null);
    setEmail("");
    setCases([]);
  }

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {!token ? (
          <>
            <div className="mb-10">
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
                Client Portal
              </p>
              <h1 className="text-4xl font-bold text-[#191918] mb-3">My Cases</h1>
              <p className="text-[rgba(25,25,24,0.6)]">
                Sign in to view your case history and attorney matches.
              </p>
            </div>
            <OTPForm onSuccess={handleLogin} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
                  Client Portal
                </p>
                <h1 className="text-3xl font-bold text-[#191918]">My Cases</h1>
                <p className="text-sm text-[rgba(25,25,24,0.5)] mt-1">{email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.4)] hover:text-[#191918] transition-colors"
              >
                Sign out
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-6 h-6 border-2 border-[#FCAA2D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cases.length === 0 ? (
              <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 text-center">
                <p className="text-[rgba(25,25,24,0.5)] mb-4">No cases found for this email.</p>
                <a
                  href="/app"
                  className="inline-flex items-center rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px]"
                >
                  Start a Case
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {cases.map((c) => (
                  <CaseHistoryCard key={c.case_id} caseData={c} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
