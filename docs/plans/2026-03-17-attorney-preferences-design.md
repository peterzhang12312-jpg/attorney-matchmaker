# Attorney Profile Editing & Case Preferences — Design
**Date:** 2026-03-17
**Status:** Approved

## Problem
Attorney portal fields are read-only after registration. Attorneys have no way to specify which cases they want — leading to irrelevant leads and poor match quality.

## Scope
- Make all existing attorney profile fields editable in the portal
- Add case preferences (practice areas, min budget, jurisdictions)
- Matching respects preferences — attorneys only receive leads they want
- Billing model unchanged (credit-based, pay-per-reveal)

## Backend

### 1. Migration
Add `case_preferences JSON` column to `attorneys_registered` (nullable, default null).

Schema:
```json
{
  "practice_areas": ["real estate", "ip"],
  "min_budget": 5000,
  "jurisdictions": ["New York", "California"]
}
```
Null = accept all cases (backward compatible).

### 2. Endpoints
- `GET /api/attorney/profile` — already exists; add `case_preferences` field to response
- `PUT /api/attorney/profile` — already exists; ensure all fields are writable: name, firm, bar_number, hourly_rate, availability, accepting_clients, jurisdictions, practice_areas
- `PUT /api/attorney/preferences` — new; accepts `{practice_areas?, min_budget?, jurisdictions?}`; saves to `case_preferences` column
- `DELETE /api/attorney/preferences` — new; sets `case_preferences = null` (clear / accept-all)

### 3. Matching Filter
Inserted before scoring in `services/match.py`:

```
for each attorney:
  prefs = attorney.case_preferences
  if prefs is null → pass (accept all)
  if prefs.practice_areas set and case.practice_area not in list → skip
  if prefs.min_budget set and case.budget < min_budget → skip
  if prefs.jurisdictions set and case.jurisdiction not in list → skip
```

**Fallback:** If filtering leaves fewer than 3 attorneys, use full unfiltered pool. Log `preference_fallback: true` in match audit.

## Frontend

### Profile Tab (existing)
Convert all display fields to editable inputs. Add "Save" button wired to `PUT /api/attorney/profile`. Fields: name, firm, bar number, hourly rate, availability, accepting clients, jurisdictions (tag input), practice areas (tag input).

### Preferences Tab (new)
New tab between Profile and Leads:
- Practice areas: checkboxes (same list as registration)
- Min budget: number input (total budget in $)
- Jurisdictions: multi-select (state list)
- "Save Preferences" button → `PUT /api/attorney/preferences`
- "Clear (accept all)" button → `DELETE /api/attorney/preferences`

## Data Model Change
```sql
ALTER TABLE attorneys_registered ADD COLUMN case_preferences JSONB;
```

## Out of Scope
- New profile fields (bio, photo, experience) — deferred
- Subscription billing tiers — deferred
- Client-facing preference display

## Success Criteria
- Attorney can edit all profile fields and save
- Attorney can set/clear case preferences
- Matching skips attorneys whose preferences exclude the case
- No existing tests broken; no unmatched cases due to over-filtering
