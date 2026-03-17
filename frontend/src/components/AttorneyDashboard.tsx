import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getAttorneyProfile, getAttorneyLeads, respondToLead } from "../api/client";
import type { AttorneyProfile, CreditPackage, LeadSummary } from "../types/api";
import { Award, ChevronDown, ChevronUp, Clock } from "lucide-react";
import AttorneyAnalytics from "./analytics/AttorneyAnalytics";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

const LEAD_PRICE_LABELS: Record<string, string> = {
  personal_injury: "$75",
  immigration: "$75",
  criminal_defense: "$75",
  employment: "$50",
  employment_employee: "$50",
  intellectual_property: "$50",
  corporate: "$50",
  real_estate: "$35",
  family_law: "$35",
  bankruptcy: "$35",
  estate_planning: "$35",
  landlord_tenant: "$25",
  civil_litigation: "$25",
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  accepted: "bg-green-100 text-green-700 border-green-200",
  declined:
    "bg-[rgba(25,25,24,0.06)] text-[rgba(25,25,24,0.45)] border-[rgba(25,25,24,0.12)]",
  revealed: "bg-purple-100 text-purple-700 border-purple-200",
};

function scoreColor(score?: number): string {
  if (!score) return "bg-gray-100 text-gray-500 border-gray-200";
  if (score >= 80) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
}

// ---------------------------------------------------------------------------
// RevealForm — inline Stripe Card payment modal
// ---------------------------------------------------------------------------

function RevealForm({
  leadId,
  token,
  practiceArea,
  onSuccess,
  onCancel,
}: {
  leadId: string;
  token: string;
  practiceArea: string;
  onSuccess: (contact: { client_email?: string; practice_area?: string }) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setErr(null);
    try {
      // 1. Create PaymentIntent
      const res = await fetch(`/api/attorney/leads/${leadId}/reveal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const { client_secret } = await res.json();

      // 2. Confirm payment with card
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card element not mounted");
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message);

      // 3. Confirm reveal with backend
      const piId = result.paymentIntent?.id;
      const confRes = await fetch(
        `/api/attorney/leads/${leadId}/confirm-reveal?payment_intent_id=${piId}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!confRes.ok) throw new Error("Payment confirmed but reveal failed");
      const contact = await confRes.json();
      onSuccess(contact);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-[#FFFEF2] rounded-[10px] border border-[rgba(25,25,24,0.12)] p-6 w-full max-w-md">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
          Reveal Client Contact
        </p>
        <p className="text-lg font-bold text-[#191918] mb-1">
          {LEAD_PRICE_LABELS[practiceArea] || "$25"} lead fee
        </p>
        <p className="text-sm text-[rgba(25,25,24,0.55)] mb-4">
          Charged once. You'll receive the client's email address immediately.
        </p>
        <div className="border border-[rgba(25,25,24,0.12)] rounded-md px-3 py-3 bg-white mb-4">
          <CardElement
            options={{ style: { base: { fontSize: "14px", color: "#191918" } } }}
          />
        </div>
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <div className="flex gap-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="flex-1 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] disabled:opacity-50"
          >
            {loading ? "Processing..." : "Pay & Reveal"}
          </button>
          <button
            onClick={onCancel}
            className="px-4 font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreditPurchaseModal — buy a credit pack via Stripe
// ---------------------------------------------------------------------------

function CreditPurchaseModal({
  token,
  onSuccess,
  onCancel,
}: {
  token: string;
  onSuccess: (newCredits: number) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/attorney/credit-packages", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setPackages)
      .catch(() => {});
  }, [token]);

  async function handlePurchase() {
    if (!stripe || !elements || !selectedPack) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/attorney/purchase-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ package_id: selectedPack }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { client_secret, credits: creditsToAdd, package_id } = await res.json();

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card element not mounted");
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message);

      const piId = result.paymentIntent?.id;
      const confRes = await fetch(
        `/api/attorney/confirm-credit-purchase?payment_intent_id=${piId}&package_id=${package_id}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!confRes.ok) throw new Error("Payment succeeded but credit grant failed");
      const { credits } = await confRes.json();
      onSuccess(credits);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-[#FFFEF2] rounded-[10px] border border-[rgba(25,25,24,0.12)] p-6 w-full max-w-md">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
          Buy Lead Credits
        </p>
        <p className="text-lg font-bold text-[#191918] mb-1">Choose a pack</p>
        <p className="text-sm text-[rgba(25,25,24,0.55)] mb-4">
          Each credit reveals one client's contact info instantly — no card re-entry.
        </p>

        <div className="space-y-2 mb-4">
          {packages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPack(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-md border transition-colors text-left ${
                selectedPack === p.id
                  ? "border-[#FCAA2D] bg-[#FCAA2D]/5"
                  : "border-[rgba(25,25,24,0.12)] bg-white hover:border-[rgba(25,25,24,0.3)]"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-[#191918]">{p.label}</p>
                <p className="font-mono text-[0.6rem] text-[rgba(25,25,24,0.45)]">
                  {p.per_credit}/credit
                </p>
              </div>
              <p className="text-sm font-bold text-[#191918]">
                ${(p.amount_cents / 100).toFixed(0)}
              </p>
            </button>
          ))}
        </div>

        {selectedPack && (
          <div className="border border-[rgba(25,25,24,0.12)] rounded-md px-3 py-3 bg-white mb-4">
            <CardElement
              options={{ style: { base: { fontSize: "14px", color: "#191918" } } }}
            />
          </div>
        )}

        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

        <div className="flex gap-3">
          <button
            onClick={handlePurchase}
            disabled={loading || !selectedPack}
            className="flex-1 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] disabled:opacity-50"
          >
            {loading ? "Processing..." : "Purchase Credits"}
          </button>
          <button
            onClick={onCancel}
            className="px-4 font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

interface AttorneyDashboardProps {
  token: string;
  onSignOut: () => void;
}

function AttorneyDashboardInner({ token, onSignOut }: AttorneyDashboardProps) {
  const [profile, setProfile] = useState<AttorneyProfile | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [revealLead, setRevealLead] = useState<{
    id: string;
    practiceArea: string;
  } | null>(null);
  const [revealedContacts, setRevealedContacts] = useState<
    Record<string, { client_email?: string }>
  >({});
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [credits, setCredits] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"leads" | "analytics">("leads");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, l] = await Promise.all([
        getAttorneyProfile(token),
        getAttorneyLeads(token),
      ]);
      setProfile(p);
      setCredits(p.credits ?? 0);
      setLeads(l);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(msg);
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
          <h1 className="text-xl font-semibold text-[#191918]">{profile?.name}</h1>
          {profile?.is_founding && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FCAA2D]/10 border border-[#FCAA2D]/30 rounded-md">
              <Award className="h-3.5 w-3.5 text-[#FCAA2D]" />
              <span className="font-mono text-[0.65rem] uppercase tracking-wide text-[#FCAA2D] font-semibold">
                Founding Attorney
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[rgba(25,25,24,0.12)] rounded-md">
            <span className="font-mono text-[0.65rem] uppercase tracking-wide text-[rgba(25,25,24,0.45)]">
              Credits:
            </span>
            <span className="font-mono text-[0.75rem] font-semibold text-[#191918]">
              {credits}
            </span>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBuyingCredits(true)}
            className="min-h-[44px] px-4 rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide hover:opacity-90 transition-opacity"
          >
            Buy Credits
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[44px] px-4 rounded-md border border-[rgba(25,25,24,0.12)] text-[rgba(25,25,24,0.45)] font-mono text-[0.7rem] uppercase tracking-wide hover:text-[#191918] hover:border-[rgba(25,25,24,0.3)] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Profile card */}
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

      {/* Tab bar */}
      <div className="border-b border-[rgba(25,25,24,0.12)] flex gap-6 px-6 mt-4">
        {(["leads", "analytics"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`font-mono text-[0.65rem] uppercase tracking-widest pb-3 border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#FCAA2D] text-[#191918]"
                : "border-transparent text-[rgba(25,25,24,0.45)] hover:text-[#191918]"
            }`}
          >
            {tab === "leads" ? "Leads" : "Analytics"}
          </button>
        ))}
      </div>

      {/* Leads section */}
      {activeTab === "leads" && (
      <div>
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
          Case Leads
        </h2>

        {leads.length === 0 ? (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 text-center">
            <Clock className="h-8 w-8 text-[rgba(25,25,24,0.2)] mx-auto mb-3" />
            <p className="text-sm text-[rgba(25,25,24,0.45)]">
              No case leads yet. When clients submit cases matching your profile, they will
              appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {lead.practice_area && (
                        <span className="text-sm font-medium text-[#191918]">
                          {lead.practice_area}
                        </span>
                      )}
                      {lead.lead_score != null && (
                        <span
                          className={`font-mono text-[0.6rem] uppercase px-2 py-0.5 rounded border ${scoreColor(lead.lead_score)}`}
                        >
                          {lead.lead_score}% match
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
                        <span>{new Date(lead.sent_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Reveal / contact section */}
                    {lead.status === "revealed" ? (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-800">
                        Client revealed — check your email for contact details
                      </div>
                    ) : revealedContacts[lead.id] ? (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
                        <p className="font-mono text-[0.6rem] uppercase tracking-widest text-green-700 mb-1">
                          Client Contact
                        </p>
                        <p className="text-green-900 font-medium">
                          {revealedContacts[lead.id].client_email || "No email on file"}
                        </p>
                      </div>
                    ) : lead.status === "accepted" ? (
                      <div className="flex gap-2 flex-wrap mt-3">
                        {credits > 0 && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/attorney/leads/${lead.id}/reveal-with-credit`, {
                                  method: "POST",
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                if (!res.ok) throw new Error(await res.text());
                                const contact = await res.json();
                                setRevealedContacts((prev) => ({ ...prev, [lead.id]: contact }));
                                setCredits((c) => Math.max(0, c - 1));
                                setProfile((prev) =>
                                  prev ? { ...prev, credits: Math.max(0, (prev.credits ?? 0) - 1) } : prev
                                );
                              } catch (e: unknown) {
                                setError(e instanceof Error ? e.message : "Reveal failed");
                              }
                            }}
                            className="rounded-md bg-[#191918] text-white font-mono text-[0.65rem] uppercase tracking-wide px-4 min-h-[44px] hover:opacity-90 transition-opacity"
                          >
                            Use 1 Credit
                          </button>
                        )}
                        <button
                          onClick={() => setRevealLead({ id: lead.id, practiceArea: lead.practice_area || "" })}
                          className="rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.65rem] uppercase tracking-wide px-4 min-h-[44px] hover:border-[rgba(25,25,24,0.4)] transition-colors"
                        >
                          Pay by Card
                        </button>
                      </div>
                    ) : null}
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
      )}

      {activeTab === "analytics" && (
        <div className="p-6">
          <AttorneyAnalytics token={token} />
        </div>
      )}

      {/* Stripe reveal modal */}
      {revealLead && (
        <RevealForm
          leadId={revealLead.id}
          token={token}
          practiceArea={revealLead.practiceArea}
          onSuccess={(contact) => {
            setRevealedContacts((prev) => ({ ...prev, [revealLead.id]: contact }));
            setRevealLead(null);
          }}
          onCancel={() => setRevealLead(null)}
        />
      )}
      {buyingCredits && (
        <CreditPurchaseModal
          token={token}
          onSuccess={(newCredits) => {
            setCredits(newCredits);
            setProfile((prev) => prev ? { ...prev, credits: newCredits } : prev);
            setBuyingCredits(false);
          }}
          onCancel={() => setBuyingCredits(false)}
        />
      )}
    </div>
  );
}

export default function AttorneyDashboard(props: AttorneyDashboardProps) {
  return (
    <Elements stripe={stripePromise}>
      <AttorneyDashboardInner {...props} />
    </Elements>
  );
}
