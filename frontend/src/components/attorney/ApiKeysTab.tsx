import { useState, useEffect } from "react";
import type { ApiKeyCreatedResponse, ApiKeyResponse } from "../../types/api";

export default function ApiKeysTab({ token }: { token: string }) {
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [newKey, setNewKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [label, setLabel] = useState("");
  const [tier, setTier] = useState("starter");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadKeys() {
    const res = await fetch("/api/attorney/api-keys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setKeys(await res.json());
  }

  useEffect(() => { loadKeys(); }, [token]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/attorney/api-keys", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ label, tier }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewKey(await res.json());
      setLabel("");
      loadKeys();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    await fetch(`/api/attorney/api-keys/${keyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadKeys();
  }

  const TIER_LABELS: Record<string, string> = {
    starter: "Starter (100 req/day)",
    growth: "Growth (500 req/day)",
    enterprise: "Enterprise (unlimited)",
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
          Generate New API Key
        </h3>
        <div className="flex gap-3 flex-wrap">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Key label (e.g. My App)"
            className="flex-1 min-w-[160px] border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm font-mono"
          />
          <select
            value={tier}
            onChange={e => setTier(e.target.value)}
            className="border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm font-mono bg-white"
          >
            {Object.entries(TIER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !label}
            className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-4 min-h-[40px] disabled:opacity-50"
          >
            {creating ? "Generating..." : "Generate Key"}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {newKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-4">
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-amber-800 mb-2">
            New Key — Store it now, it will not be shown again
          </p>
          <code className="text-sm break-all text-amber-900 font-mono">{newKey.api_key}</code>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 block text-xs text-amber-700 underline"
          >
            I've saved it
          </button>
        </div>
      )}

      <div className="space-y-3">
        {keys.length === 0 && (
          <p className="text-sm text-[rgba(25,25,24,0.45)]">No API keys yet.</p>
        )}
        {keys.map(key => (
          <div key={key.id} className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">{key.label || "Unnamed key"}</p>
              <p className="text-xs text-[rgba(25,25,24,0.45)] font-mono mt-1">
                {key.tier} · {key.daily_limit > 0 ? `${key.usage_today}/${key.daily_limit} today` : `${key.usage_today} today (unlimited)`}
              </p>
            </div>
            <button
              onClick={() => handleRevoke(key.id)}
              className="text-xs font-mono uppercase tracking-wide text-red-600 hover:text-red-800 border border-red-200 px-3 py-1.5 rounded-md"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
