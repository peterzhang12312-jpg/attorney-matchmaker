import { useState, useEffect, useCallback } from "react";
import { getAttorneyProfile, getAttorneyLeads, respondToLead } from "../api/client";
import type { AttorneyProfile, LeadSummary } from "../types/api";
import { Award, ChevronDown, ChevronUp, Clock } from "lucide-react";

interface AttorneyDashboardProps {
  token: string;
  onSignOut: () => void;
}

const URGENCY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  accepted: "bg-green-100 text-green-700 border-green-200",
  declined: "bg-[rgba(25,25,24,0.06)] text-[rgba(25,25,24,0.45)] border-[rgba(25,25,24,0.12)]",
};

export default function AttorneyDashboard({ token, onSignOut }: AttorneyDashboardProps) {
  const [profile, setProfile] = useState<AttorneyProfile | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, l] = await Promise.all([
        getAttorneyProfile(token),
        getAttorneyLeads(token),
      ]);
      setProfile(p);
      setLeads(l);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(msg);
      /* If token is invalid, sign out */
      if (msg.includes("401") || msg.includes("403")) {
        onSignOut();
      }
    } finally {
      setLoading(false);
    }
  }, [token, onSignOut]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRespond(leadId: string, action: "accept" | "decline") {
    setRespondingTo(leadId);
    try {
      await respondToLead(token, leadId, action);
      /* Refresh leads after response */
      const updated = await getAttorneyLeads(token);
      setLeads(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to respond";
      setError(msg);
    } finally {
      setRespondingTo(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center animate-fade-in">
        <p className="text-[rgba(25,25,24,0.45)] font-mono text-sm">Loading dashboard...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 animate-fade-in">
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#191918]">
            {profile?.name}
          </h1>
          {profile?.is_founding && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FCAA2D]/10 border border-[#FCAA2D]/30 rounded-md">
              <Award className="h-3.5 w-3.5 text-[#FCAA2D]" />
              <span className="font-mono text-[0.65rem] uppercase tracking-wide text-[#FCAA2D] font-semibold">
                Founding Attorney
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="min-h-[44px] px-4 rounded-md border border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.45)] font-mono text-[0.7rem] uppercase tracking-wide hover:text-[#191918] hover:border-[rgba(25,25,24,0.3)] transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Profile card (collapsible) */}
      {profile && (
        <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px]">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center justify-between px-6 py-4 min-h-[44px]"
          >
            <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
              Your Profile
            </span>
            {profileOpen ? (
              <ChevronUp className="h-4 w-4 text-[rgba(25,25,24,0.45)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[rgba(25,25,24,0.45)]" />
            )}
          </button>

          {profileOpen && (
            <div className="px-6 pb-5 space-y-4 border-t border-[rgba(25,25,24,0.08)]">
              {/* Practice areas */}
              {profile.practice_areas && profile.practice_areas.length > 0 && (
                <div className="pt-4">
                  <span className="text-xs font-medium text-[rgba(25,25,24,0.45)] block mb-2">
                    Practice Areas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.practice_areas.map((area) => (
                      <span
                        key={area}
                        className="px-2.5 py-1 bg-[#FCAA2D]/10 border border-[#FCAA2D]/20 rounded-md text-xs text-[#191918]"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Jurisdictions */}
              {profile.jurisdictions && profile.jurisdictions.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-[rgba(25,25,24,0.45)] block mb-2">
                    Jurisdictions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.jurisdictions.map((j) => (
                      <span
                        key={j}
                        className="px-2.5 py-1 bg-[rgba(25,25,24,0.04)] border border-[rgba(25,25,24,0.12)] rounded-md text-xs text-[#191918]"
                      >
                        {j}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Details row */}
              <div className="flex flex-wrap gap-4 text-sm">
                {profile.hourly_rate && (
                  <div>
                    <span className="text-[rgba(25,25,24,0.45)] text-xs">Rate</span>
                    <p className="text-[#191918] font-medium">${profile.hourly_rate}/hr</p>
                  </div>
                )}
                <div>
                  <span className="text-[rgba(25,25,24,0.45)] text-xs">Availability</span>
                  <p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        profile.availability === "available"
                          ? "bg-green-100 text-green-700"
                          : profile.availability === "limited"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {profile.availability}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[rgba(25,25,24,0.45)] text-xs">Accepting Clients</span>
                  <p className="text-[#191918] font-medium">
                    {profile.accepting_clients ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leads section */}
      <div>
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
          Case Leads
        </h2>

        {leads.length === 0 ? (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 text-center">
            <Clock className="h-8 w-8 text-[rgba(25,25,24,0.2)] mx-auto mb-3" />
            <p className="text-sm text-[rgba(25,25,24,0.45)]">
              No case leads yet. When clients submit cases matching your profile, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {lead.practice_area && (
                        <span className="text-sm font-medium text-[#191918]">
                          {lead.practice_area}
                        </span>
                      )}
                      {lead.urgency && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${
                            URGENCY_COLORS[lead.urgency] || URGENCY_COLORS.medium
                          }`}
                        >
                          {lead.urgency}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium border ${
                          STATUS_COLORS[lead.status] || STATUS_COLORS.sent
                        }`}
                      >
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-[rgba(25,25,24,0.45)]">
                      {lead.jurisdiction && <span>{lead.jurisdiction}</span>}
                      {lead.sent_at && (
                        <span>
                          {new Date(lead.sent_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {lead.status === "sent" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={respondingTo === lead.id}
                        onClick={() => handleRespond(lead.id, "accept")}
                        className="min-h-[44px] px-4 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {respondingTo === lead.id ? "..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={respondingTo === lead.id}
                        onClick={() => handleRespond(lead.id, "decline")}
                        className="min-h-[44px] px-4 rounded-md border border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.45)] font-mono text-[0.7rem] uppercase tracking-wide hover:text-[#191918] hover:border-[rgba(25,25,24,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
