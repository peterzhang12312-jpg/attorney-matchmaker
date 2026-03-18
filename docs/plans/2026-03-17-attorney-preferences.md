# Attorney Profile Editing & Case Preferences — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all attorney profile fields editable in the portal and add case preferences (practice area, min budget, jurisdiction) that the matching engine respects.

**Architecture:** Add `case_preferences JSON` column via startup migration. Two new endpoints (`PUT/DELETE /api/attorney/preferences`). Matching filter added before scoring in `find_matches()`. Frontend: profile card becomes editable, new Preferences tab added.

**Tech Stack:** FastAPI + SQLAlchemy async, React 18 + TypeScript + Tailwind 3, no Alembic (inline `ALTER TABLE IF NOT EXISTS` migrations in `main.py`)

---

### Task 1: DB Model + Startup Migration

**Files:**
- Modify: `backend/db/models.py` — add `case_preferences` column
- Modify: `backend/main.py` — add startup migration

**Step 1: Add column to ORM model**

In `backend/db/models.py`, after line 81 (`webhook_config = Column(JSON, ...)`), add:

```python
case_preferences = Column(JSON, nullable=True)  # {practice_areas?, min_budget?, jurisdictions?}
```

**Step 2: Add startup migration in `backend/main.py`**

Find the last `# Column migration:` block (ends around line 230). After it, add:

```python
    # Column migration: add case_preferences to attorneys_registered
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS case_preferences JSON"
            ))
        log.info("db_migration_case_preferences_ok")
    except Exception as _exc:
        log.warning("db_migration_case_preferences_skipped", reason=str(_exc))
```

**Step 3: Verify locally**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```
Expected: `OK` (no import errors)

**Step 4: Commit**

```bash
git add backend/db/models.py backend/main.py
git commit -m "feat: add case_preferences column to attorneys_registered"
```

---

### Task 2: Backend Schemas

**Files:**
- Modify: `backend/models/schemas.py`

**Step 1: Add `CasePreferences` model**

Find the `AttorneyProfileUpdate` class (~line 570). Add before it:

```python
class CasePreferences(BaseModel):
    """Attorney case preference filters. Null fields mean 'accept all'."""
    practice_areas: Optional[list[str]] = None
    min_budget: Optional[float] = None
    jurisdictions: Optional[list[str]] = None
```

**Step 2: Add `name` to `AttorneyProfileUpdate`**

`AttorneyProfileUpdate` currently starts at ~line 570 and is missing `name`. Add it:

```python
class AttorneyProfileUpdate(BaseModel):
    """Partial update for an attorney's own profile."""
    name: Optional[str] = None          # ← add this
    bar_number: Optional[str] = None
    firm: Optional[str] = None
    jurisdictions: Optional[list[str]] = None
    practice_areas: Optional[list[str]] = None
    hourly_rate: Optional[str] = None
    availability: Optional[str] = None
    accepting_clients: Optional[bool] = None
```

**Step 3: Add `case_preferences` to `AttorneyProfileResponse`**

Find `AttorneyProfileResponse` (~line 595). Add `case_preferences` field:

```python
class AttorneyProfileResponse(BaseModel):
    """Public-facing attorney profile (no password hash)."""
    id: str
    name: str
    email: str
    bar_number: Optional[str]
    firm: Optional[str]
    jurisdictions: Optional[list[str]]
    practice_areas: Optional[list[str]]
    hourly_rate: Optional[str]
    availability: str
    accepting_clients: bool
    is_founding: bool
    credits: int = 0
    created_at: Optional[str] = None
    case_preferences: Optional[CasePreferences] = None   # ← add this
```

**Step 4: Export `CasePreferences` from schemas**

Check the imports in `routers/attorney.py` — you'll need to add `CasePreferences` to the import list in Task 3.

**Step 5: Verify**

```bash
cd backend
python -c "from models.schemas import CasePreferences, AttorneyProfileUpdate, AttorneyProfileResponse; print('OK')"
```
Expected: `OK`

**Step 6: Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: add CasePreferences schema, name to ProfileUpdate, preferences to ProfileResponse"
```

---

### Task 3: Backend Endpoints — Preferences + Profile Fix

**Files:**
- Modify: `backend/routers/attorney.py`

**Step 1: Add `CasePreferences` to the import block**

At the top of `backend/routers/attorney.py`, the schemas import block (~line 26) imports many models. Add `CasePreferences` to that list:

```python
from models.schemas import (
    ...
    CasePreferences,
    ...
)
```

**Step 2: Fix `_to_profile_response` to include `case_preferences`**

Find `_to_profile_response` (~line 157). Update it:

```python
def _to_profile_response(atty: AttorneyRegistered) -> AttorneyProfileResponse:
    raw_prefs = atty.case_preferences
    prefs = CasePreferences(**raw_prefs) if raw_prefs else None
    return AttorneyProfileResponse(
        id=atty.id,
        name=atty.name,
        email=atty.email,
        bar_number=atty.bar_number,
        firm=atty.firm,
        jurisdictions=atty.jurisdictions,
        practice_areas=atty.practice_areas,
        hourly_rate=atty.hourly_rate,
        availability=atty.availability or "available",
        accepting_clients=atty.accepting_clients == "true",
        is_founding=atty.is_founding == "true",
        credits=atty.credits or 0,
        created_at=atty.created_at.isoformat() if atty.created_at else None,
        case_preferences=prefs,
    )
```

**Step 3: Add preferences endpoints**

Find the `# GET /api/attorney/leads` section (~line 329). Insert before it:

```python
# ---------------------------------------------------------------------------
# PUT /api/attorney/preferences
# ---------------------------------------------------------------------------

@router.put(
    "/preferences",
    response_model=AttorneyProfileResponse,
    summary="Set case intake preferences (filters which leads attorney receives)",
)
async def update_preferences(
    body: CasePreferences,
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
) -> AttorneyProfileResponse:
    prefs = body.model_dump(exclude_none=True)  # only save non-null fields
    await db.execute(
        update(AttorneyRegistered)
        .where(AttorneyRegistered.id == attorney.id)
        .values(case_preferences=prefs if prefs else None)
    )
    await db.commit()
    await db.refresh(attorney)
    log.info("attorney_preferences_updated", attorney_id=attorney.id, prefs=prefs)
    return _to_profile_response(attorney)


# ---------------------------------------------------------------------------
# DELETE /api/attorney/preferences
# ---------------------------------------------------------------------------

@router.delete(
    "/preferences",
    response_model=AttorneyProfileResponse,
    summary="Clear case preferences (attorney receives all leads)",
)
async def clear_preferences(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
) -> AttorneyProfileResponse:
    await db.execute(
        update(AttorneyRegistered)
        .where(AttorneyRegistered.id == attorney.id)
        .values(case_preferences=None)
    )
    await db.commit()
    await db.refresh(attorney)
    log.info("attorney_preferences_cleared", attorney_id=attorney.id)
    return _to_profile_response(attorney)
```

**Step 4: Verify import + syntax**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); from routers.attorney import router; print('OK')"
```
Expected: `OK`

**Step 5: Manual test (requires running backend)**

```bash
# Start backend
python -m uvicorn main:app --reload --port 8080

# In another terminal — login first
TOKEN=$(curl -s -X POST http://localhost:8080/api/attorney/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Set preferences
curl -s -X PUT http://localhost:8080/api/attorney/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"practice_areas":["real estate"],"min_budget":5000}' | python3 -m json.tool

# Clear preferences
curl -s -X DELETE http://localhost:8080/api/attorney/preferences \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
Expected: Profile response with `case_preferences` populated / null

**Step 6: Commit**

```bash
git add backend/routers/attorney.py
git commit -m "feat: add PUT/DELETE /api/attorney/preferences endpoints"
```

---

### Task 4: Matching Filter

**Files:**
- Modify: `backend/services/matcher.py`

**Step 1: Understand where to insert the filter**

In `find_matches()` (~line 346), attorneys are fetched from DB and stored in the `attorneys` list (~line 379). The scoring loop comes later. We need to filter `attorneys` after they're fetched but before scoring.

**Step 2: Locate the registered attorneys DB fetch**

Search for where `AttorneyRegistered` rows are fetched in `matcher.py`:

```bash
grep -n "AttorneyRegistered\|attorneys_registered\|from db" backend/services/matcher.py | head -20
```

Note the line where the registered attorney list is built. The filter goes right after that.

**Step 3: Add the preference filter function**

Near the top of `matcher.py` (after imports), add:

```python
def _passes_preferences(attorney_row, practice_area: str, budget_total: Optional[float], jurisdiction: str) -> bool:
    """Return True if the case passes the attorney's intake preferences.
    If attorney has no preferences (case_preferences is None), always return True."""
    prefs = getattr(attorney_row, "case_preferences", None)
    if not prefs:
        return True
    if prefs.get("practice_areas") and practice_area:
        allowed = [p.lower() for p in prefs["practice_areas"]]
        if practice_area.lower() not in allowed:
            return False
    if prefs.get("min_budget") and budget_total is not None:
        if budget_total < prefs["min_budget"]:
            return False
    if prefs.get("jurisdictions") and jurisdiction:
        allowed_j = [j.lower() for j in prefs["jurisdictions"]]
        if jurisdiction.lower() not in allowed_j:
            return False
    return True
```

**Step 4: Apply filter after fetching registered attorneys**

Find where registered attorneys are loaded from DB (they're fetched as `AttorneyRegistered` ORM rows). After loading, apply filter:

```python
# After: registered_attorneys = [list of AttorneyRegistered rows]
case_practice_area = analysis.practice_area or ""
case_budget = budget_goals.total_budget if budget_goals and budget_goals.total_budget else None
case_jurisdiction = meta.get("jurisdiction") or ""

filtered = [a for a in registered_attorneys
            if _passes_preferences(a, case_practice_area, case_budget, case_jurisdiction)]

# Fallback: if fewer than 3 pass, use full list
if len(filtered) < 3:
    log.info("preference_filter_fallback", filtered=len(filtered), total=len(registered_attorneys))
    filtered = registered_attorneys

registered_attorneys = filtered
```

**Step 5: Verify**

```bash
cd backend
python -c "import sys; sys.path.insert(0,'.'); from services.matcher import find_matches; print('OK')"
```
Expected: `OK`

**Step 6: Commit**

```bash
git add backend/services/matcher.py
git commit -m "feat: filter attorneys by case_preferences before scoring"
```

---

### Task 5: Frontend Types + API Client

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/client.ts`

**Step 1: Add `CasePreferences` interface and update `AttorneyProfile`**

In `frontend/src/types/api.ts`, after the `AttorneyProfile` interface (~line 265), add:

```typescript
export interface CasePreferences {
  practice_areas?: string[];
  min_budget?: number;
  jurisdictions?: string[];
}
```

And in `AttorneyProfile`, add:

```typescript
  case_preferences?: CasePreferences;
```

**Step 2: Add API functions to `frontend/src/api/client.ts`**

Find where `getAttorneyProfile` is defined (~line 177). After the existing attorney functions, add:

```typescript
export async function updateAttorneyProfile(
  token: string,
  updates: Partial<{
    name: string;
    bar_number: string;
    firm: string;
    hourly_rate: string;
    availability: string;
    accepting_clients: boolean;
    jurisdictions: string[];
    practice_areas: string[];
  }>
): Promise<AttorneyProfile> {
  return request<AttorneyProfile>("/api/attorney/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
}

export async function updateAttorneyPreferences(
  token: string,
  prefs: { practice_areas?: string[]; min_budget?: number; jurisdictions?: string[] }
): Promise<AttorneyProfile> {
  return request<AttorneyProfile>("/api/attorney/preferences", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(prefs),
  });
}

export async function clearAttorneyPreferences(token: string): Promise<AttorneyProfile> {
  return request<AttorneyProfile>("/api/attorney/preferences", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

**Step 3: Type-check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/api/client.ts
git commit -m "feat: add CasePreferences type and profile/preferences API functions"
```

---

### Task 6: Frontend — Editable Profile Card

**Files:**
- Modify: `frontend/src/components/AttorneyDashboard.tsx`

**Step 1: Add edit state variables**

In `AttorneyDashboardInner`, find the existing state declarations (~line 293). Add:

```typescript
const [editingProfile, setEditingProfile] = useState(false);
const [profileDraft, setProfileDraft] = useState<Partial<{
  name: string; firm: string; bar_number: string;
  hourly_rate: string; availability: string;
  accepting_clients: boolean; jurisdictions: string[]; practice_areas: string[];
}>>({});
const [profileSaving, setProfileSaving] = useState(false);
const [profileError, setProfileError] = useState<string | null>(null);
```

**Step 2: Add save handler**

After the `loadData` function, add:

```typescript
const handleSaveProfile = async () => {
  setProfileSaving(true);
  setProfileError(null);
  try {
    const updated = await updateAttorneyProfile(token, profileDraft);
    setProfile(updated);
    setEditingProfile(false);
  } catch {
    setProfileError("Failed to save profile.");
  } finally {
    setProfileSaving(false);
  }
};
```

Make sure `updateAttorneyProfile` is imported from `"../api/client"`.

**Step 3: Replace the profile card read-only section**

Find the `{profileOpen && (` block (~line 433). Replace the inner content with an editable form. The edit button toggles `editingProfile`. When `editingProfile` is false, show the current read-only view with an "Edit" button. When true, show input fields:

```tsx
{profileOpen && (
  <div className="px-6 pb-5 space-y-4 border-t border-[rgba(25,25,24,0.08)]">
    {!editingProfile ? (
      <>
        {/* existing read-only display — keep as-is */}
        {profile.practice_areas && profile.practice_areas.length > 0 && (
          /* ... existing practice areas display ... */
        )}
        {/* ... existing jurisdictions, rate, availability display ... */}
        <div className="pt-2">
          <button
            onClick={() => {
              setProfileDraft({
                name: profile.name,
                firm: profile.firm,
                bar_number: profile.bar_number,
                hourly_rate: profile.hourly_rate,
                availability: profile.availability,
                accepting_clients: profile.accepting_clients,
                jurisdictions: profile.jurisdictions ?? [],
                practice_areas: profile.practice_areas ?? [],
              });
              setEditingProfile(true);
            }}
            className="font-mono text-[0.65rem] uppercase tracking-widest px-3 py-1.5 border border-[rgba(25,25,24,0.2)] rounded-md text-[#191918] hover:bg-[rgba(25,25,24,0.04)]"
          >
            Edit Profile
          </button>
        </div>
      </>
    ) : (
      <div className="pt-4 space-y-3">
        {profileError && <p className="text-red-600 text-xs">{profileError}</p>}
        {[
          { label: "Name", key: "name" as const, type: "text" },
          { label: "Firm", key: "firm" as const, type: "text" },
          { label: "Bar Number", key: "bar_number" as const, type: "text" },
          { label: "Hourly Rate ($)", key: "hourly_rate" as const, type: "text" },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="text-xs text-[rgba(25,25,24,0.45)] block mb-1">{label}</label>
            <input
              type={type}
              value={(profileDraft[key] as string) ?? ""}
              onChange={e => setProfileDraft(d => ({ ...d, [key]: e.target.value }))}
              className="w-full border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm text-[#191918] bg-white focus:outline-none focus:border-[#FCAA2D]"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-[rgba(25,25,24,0.45)] block mb-1">Availability</label>
          <select
            value={profileDraft.availability ?? "available"}
            onChange={e => setProfileDraft(d => ({ ...d, availability: e.target.value }))}
            className="w-full border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm text-[#191918] bg-white focus:outline-none focus:border-[#FCAA2D]"
          >
            <option value="available">Available</option>
            <option value="limited">Limited</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="accepting_clients"
            checked={profileDraft.accepting_clients ?? true}
            onChange={e => setProfileDraft(d => ({ ...d, accepting_clients: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="accepting_clients" className="text-sm text-[#191918]">Accepting new clients</label>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-2 rounded-md bg-[#FCAA2D] text-[#191918] min-h-[36px] disabled:opacity-50"
          >
            {profileSaving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => { setEditingProfile(false); setProfileError(null); }}
            className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-2 rounded-md border border-[rgba(25,25,24,0.2)] text-[#191918] min-h-[36px]"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

**Step 4: Type-check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (fix any type errors before proceeding)

**Step 5: Commit**

```bash
git add frontend/src/components/AttorneyDashboard.tsx
git commit -m "feat: make attorney profile card editable"
```

---

### Task 7: Frontend — Preferences Tab

**Files:**
- Create: `frontend/src/components/attorney/PreferencesTab.tsx`
- Modify: `frontend/src/components/AttorneyDashboard.tsx`

**Step 1: Create `PreferencesTab.tsx`**

```tsx
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
          onClick={handleSave}
          disabled={saving}
          className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-2 rounded-md bg-[#FCAA2D] text-[#191918] min-h-[36px] disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Preferences"}
        </button>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="font-mono text-[0.65rem] uppercase tracking-widest px-4 py-2 rounded-md border border-[rgba(25,25,24,0.2)] text-[#191918] min-h-[36px] disabled:opacity-50"
        >
          {clearing ? "Clearing..." : "Clear (Accept All)"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Wire into `AttorneyDashboard.tsx`**

1. Import at the top:
```tsx
import PreferencesTab from "./attorney/PreferencesTab";
```

2. Update tab type and tab bar. Find:
```tsx
const [activeTab, setActiveTab] = useState<"leads" | "analytics" | "api-keys" | "webhook">("leads");
```
Change to:
```tsx
const [activeTab, setActiveTab] = useState<"leads" | "analytics" | "api-keys" | "webhook" | "preferences">("leads");
```

3. Find the tab bar array:
```tsx
{(["leads", "analytics", "api-keys", "webhook"] as const).map(tab => (
```
Change to:
```tsx
{(["leads", "analytics", "preferences", "api-keys", "webhook"] as const).map(tab => (
```

4. Find where tabs render their content (where `activeTab === "webhook"` renders `<WebhookSettings />`). Add the preferences tab alongside the others:

```tsx
{activeTab === "preferences" && profile && (
  <PreferencesTab
    profile={profile}
    token={token}
    onUpdate={setProfile}
  />
)}
```

**Step 3: Type-check + build**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -30
npm run build 2>&1 | tail -10
```
Expected: no errors, build succeeds

**Step 4: Commit**

```bash
git add frontend/src/components/attorney/PreferencesTab.tsx frontend/src/components/AttorneyDashboard.tsx
git commit -m "feat: add Preferences tab to attorney portal"
```

---

### Task 8: Push + Verify Live

**Step 1: Push to Render**

```bash
git push origin main
```
(Approve in Telegram bot)

**Step 2: Verify live endpoints**

```bash
# Health check
curl -s https://attorney-matchmaker.onrender.com/api/health | python3 -m json.tool

# Login (use a real test attorney account)
TOKEN=$(curl -s -X POST https://attorney-matchmaker.onrender.com/api/attorney/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','ERR:'+str(d)))")

# Get profile — should include case_preferences field
curl -s https://attorney-matchmaker.onrender.com/api/attorney/profile \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Set preferences
curl -s -X PUT https://attorney-matchmaker.onrender.com/api/attorney/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"practice_areas":["real estate"],"min_budget":5000}' | python3 -m json.tool
```
Expected: Profile response with `case_preferences: {"practice_areas": ["real estate"], "min_budget": 5000}`

**Step 3: Update memory**

Update `~/.claude/projects/C--Users-Admin/memory/project_phase_status.md` to mark this feature complete.
