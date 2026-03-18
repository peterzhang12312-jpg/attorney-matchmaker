import { useState } from "react";
import type { AttorneyProfile, CasePreferences } from "../../types/api";
import { updateAttorneyPreferences, clearAttorneyPreferences } from "../../api/client";

const PRACTICE_AREAS = [
  "real estate", "ip", "immigration", "family", "criminal defense",
  "personal injury", "employment", "corporate", "bankruptcy", "estate planning",
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","Federal",
];

interface Props {
  profile: AttorneyProfile;
  token: string;
  onUpdate: (p: AttorneyProfile) => void;
}

export default function PreferencesTab({ profile, token, onUpdate }: Props) {
  const existing = profile.case_preferences ?? {};
  const [areas, setAreas] = useState<string[]>(existing.practice_areas ?? []);
  const [minBudget, setMinBudget] = useState<string>(
    existing.min_budget != null ? String(existing.min_budget) : ""
  );
  const [jurisdictions, setJurisdictions] = useState<string[]>(existing.jurisdictions ?? []);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleArea = (area: string) =>
    setAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);

  const toggleJurisdiction = (j: string) =>
    setJurisdictions(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j]);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const prefs: CasePreferences = {};
      if (areas.length) prefs.practice_areas = areas;
      if (minBudget) prefs.min_budget = parseFloat(minBudget);
      if (jurisdictions.length) prefs.jurisdictions = jurisdictions;
      const updated = await updateAttorneyPreferences(token, prefs);
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true); setError(null);
    try {
      const updated = await clearAttorneyPreferences(token);
      onUpdate(updated);
      setAreas([]); setMinBudget(""); setJurisdictions([]);
    } catch {
      setError("Failed to clear preferences.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <p className="text-xs text-[rgba(25,25,24,0.45)]">
        Only send me leads that match these criteria. Leave all blank to receive every lead.
      </p>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {/* Practice areas */}
      <div>
        <p className="text-xs font-medium text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
          Practice Areas
        </p>
        <div className="flex flex-wrap gap-2">
          {PRACTICE_AREAS.map(area => (
            <button
              key={area}
              type="button"
              onClick={() => toggleArea(area)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                areas.includes(area)
                  ? "bg-[#FCAA2D] border-[#FCAA2D] text-[#191918]"
                  : "bg-white border-[rgba(25,25,24,0.2)] text-[rgba(25,25,24,0.6)] hover:border-[#FCAA2D]"
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Min budget */}
      <div>
        <label className="text-xs font-medium text-[rgba(25,25,24,0.45)] uppercase tracking-widest block mb-2">
          Minimum Case Budget ($)
        </label>
        <input
          type="number"
          min={0}
          placeholder="e.g. 5000 — leave blank for no minimum"
          value={minBudget}
          onChange={e => setMinBudget(e.target.value)}
          className="w-full max-w-xs border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm text-[#191918] bg-white focus:outline-none focus:border-[#FCAA2D]"
        />
      </div>

      {/* Jurisdictions */}
      <div>
        <p className="text-xs font-medium text-[rgba(25,25,24,0.45)] uppercase tracking-widest mb-2">
          Preferred Jurisdictions
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {US_STATES.map(state => (
            <button
              key={state}
              type="button"
              onClick={() => toggleJurisdiction(state)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                jurisdictions.includes(state)
                  ? "bg-[#FCAA2D] border-[#FCAA2D] text-[#191918]"
                  : "bg-white border-[rgba(25,25,24,0.2)] text-[rgba(25,25,24,0.6)] hover:border-[#FCAA2D]"
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-2 rounded-md bg-[#FCAA2D] text-[#191918] min-h-[36px] disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Preferences"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-2 rounded-md border border-[rgba(25,25,24,0.2)] text-[#191918] min-h-[36px] disabled:opacity-50 hover:bg-[rgba(25,25,24,0.04)] transition-colors"
        >
          {clearing ? "Clearing..." : "Clear (Accept All)"}
        </button>
      </div>
    </div>
  );
}
