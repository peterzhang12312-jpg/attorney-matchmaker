import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function ForAttorneysPage() {
  const [form, setForm] = useState({
    name: "", email: "", practice_area: "", city: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist/attorney`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>Attorneys — Get Leads in Your Area | Attorney Matchmaker</title>
        <meta
          name="description"
          content="We have clients looking for attorneys in your area. Join the waitlist — first 10 attorneys get their first 5 leads free."
        />
      </Helmet>

      {/* Nav */}
      <nav className="border-b border-[rgba(25,25,24,0.12)] bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-semibold text-[#191918] tracking-wide">
          Attorney Matchmaker
        </Link>
        <Link
          to="/app"
          className="font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors"
        >
          Sign In
        </Link>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-[#FCAA2D] mb-3">
          For Attorneys
        </p>
        <h1 className="text-3xl font-bold text-[#191918] mb-4">
          We have clients looking for you
        </h1>
        <p className="text-[rgba(25,25,24,0.65)] mb-4 leading-relaxed">
          Attorney Matchmaker uses AI to connect people with matched attorneys
          based on real court record data — not who paid for a listing.
        </p>
        <p className="text-[rgba(25,25,24,0.65)] mb-10 leading-relaxed">
          <strong className="text-[#191918]">First 10 founding attorneys</strong> get
          their first 5 matched leads at no cost.
        </p>

        {status === "done" ? (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 text-center">
            <p className="text-[#191918] font-semibold text-lg mb-2">You're on the list.</p>
            <p className="text-[rgba(25,25,24,0.55)] text-sm">
              We'll reach out when we have leads in your area.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                Full Name
              </label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                Email
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
                placeholder="jane@lawfirm.com"
              />
            </div>
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                Primary Practice Area
              </label>
              <select
                value={form.practice_area}
                onChange={(e) => setForm({ ...form, practice_area: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
              >
                <option value="">Select one...</option>
                <option value="personal_injury">Personal Injury</option>
                <option value="criminal_defense">Criminal Defense</option>
                <option value="immigration">Immigration</option>
                <option value="family_law">Family Law</option>
                <option value="employment">Employment</option>
                <option value="real_estate">Real Estate</option>
                <option value="bankruptcy">Bankruptcy</option>
                <option value="intellectual_property">Intellectual Property</option>
                <option value="estate_planning">Estate Planning</option>
                <option value="landlord_tenant">Landlord-Tenant</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[0.7rem] uppercase tracking-wide text-[rgba(25,25,24,0.55)] mb-1">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-[rgba(25,25,24,0.12)] rounded-[6px] px-4 py-3 text-sm bg-white text-[#191918] focus:outline-none focus:border-[#FCAA2D]"
                placeholder="New York"
              />
            </div>

            {status === "error" && (
              <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide py-4 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {status === "loading" ? "Joining..." : "Join the Waitlist"}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-[rgba(25,25,24,0.35)] text-center font-mono">
          Already registered?{" "}
          <Link to="/app" className="text-[#FCAA2D] hover:underline">
            Sign in to your portal
          </Link>
        </p>
      </main>
    </div>
  );
}
