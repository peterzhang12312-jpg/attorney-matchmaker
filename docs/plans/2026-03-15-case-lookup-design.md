# Case Lookup Feature Design

**Date:** 2026-03-15
**Status:** Approved
**Goal:** Let clients find attorneys by searching a similar case (docket number, case name, or description), see the attorneys' motion timeline with plain-English explanations, understand what to expect if they hire that attorney, and get matched to similar available attorneys.

---

## Route

`/case-lookup` → `CaseLookupPage.tsx` — standalone page linked from landing page nav and hero.

---

## Data Flow

```
Client types query (docket number | case name | description)
    → POST /api/case-lookup { query: str }
    → Backend: detect query type
        • Docket number  regex \d+:\d+-[a-z]+-\d+  → CourtListener /dockets/?docket_number=
        • Case name      contains " v. " or " vs. " → CourtListener /search/?q=
        • Description    everything else            → Gemini extracts keywords → /search/
    → Fetch docket entries + motion timeline per attorney (reuse _build_docket_intelligence)
    → Claude generates "What to Expect" summary per attorney
    → Return CaseLookupResponse
    → Frontend renders CaseResultCard + CaseAttorneyList
    → Client clicks attorney → MotionTimelineModal
        • Chronological docket entries
        • Motion type chips (amber)
        • Plain-English explanation per motion
        • "What to Expect" AI summary (timeline, strategy, budget, risks)
    → Below: SimilarAttorneys section
        • Calls /api/match pipeline using extracted practice area + venue
        • Shows available attorneys accepting clients now
```

---

## Backend

### New service: `backend/services/case_lookup.py`

**Query type detection:**
- Docket number: regex `\d+:\d+-[a-z]+-\d+` or `\d+-[a-z]+-\d+`
- Case name: contains ` v. ` or ` vs. `
- Description: everything else → Gemini `extract_case_keywords()` → search terms

**CourtListener calls:**
- Docket number → `GET /dockets/?docket_number=<n>&format=json`
- Case name → `GET /search/?q=<name>&type=r&format=json`
- Description → keywords → `GET /search/?q=<kw>&type=r&format=json`

**Per attorney (reuse existing):**
- `_build_docket_intelligence(attorney_id, dockets)` — motion history
- `_fetch_docket_entries(docket_id)` — raw timeline entries
- New: `generate_attorney_expectation(attorney, docket_intelligence)` — Claude summary

**Claude expectation prompt covers:**
1. Estimated timeline (based on case type + historical durations)
2. Likely motion strategy (what they file first based on docket history)
3. Typical outcome patterns
4. Budget estimate (hourly rate × estimated hours by case complexity)
5. Risk flags (data-limited, specialization mismatch, high loss rate)

### New router: `backend/routers/case_lookup.py`

```
POST /api/case-lookup
Body: { query: str, jurisdiction?: str }
Returns: CaseLookupResponse {
    query_type: "docket_number" | "case_name" | "description"
    case: CaseMeta { name, docket_number, court, date_filed, judge, cl_url }
    attorneys: CaseLookupAttorney[] {
        name, firm, role,
        docket_intelligence: DocketIntelligence,
        timeline: TimelineEntry[],
        expectation: AttorneyExpectation
    }
    extracted_practice_area: str
    extracted_venue: str
}
```

### New schemas: `backend/models/schemas.py` additions

```python
class TimelineEntry(BaseModel):
    date: str
    description: str
    motion_type: Optional[str]       # "tro" | "msj" | "mtd" | "osc" | "alt_service"
    motion_label: Optional[str]      # "Temporary Restraining Order"
    plain_english: Optional[str]     # "Emergency court order to stop something immediately..."

class AttorneyExpectation(BaseModel):
    estimated_timeline: str          # "6-18 months based on 12 similar SDNY cases"
    likely_strategy: str             # "Expect early MTD filing, then MSJ if case proceeds"
    typical_outcomes: str            # "7 of 10 similar cases settled before trial"
    budget_estimate: str             # "$15,000-45,000 based on $450/hr × 33-100 hrs"
    risk_flags: list[str]            # ["Data-limited: only 3 docket entries found"]

class CaseMeta(BaseModel):
    name: str
    docket_number: Optional[str]
    court: str
    date_filed: Optional[str]
    judge: Optional[str]
    cl_url: Optional[str]

class CaseLookupAttorney(BaseModel):
    name: str
    firm: Optional[str]
    role: str                        # "plaintiff_attorney" | "defense_attorney" | "unknown"
    docket_intelligence: Optional[DocketIntelligence]
    timeline: list[TimelineEntry]
    expectation: Optional[AttorneyExpectation]

class CaseLookupResponse(BaseModel):
    query_type: str
    case: CaseMeta
    attorneys: list[CaseLookupAttorney]
    extracted_practice_area: str
    extracted_venue: str
    similar_case_id: Optional[str]   # intake case_id for /api/match
```

---

## Frontend

### Pages
- `frontend/src/pages/CaseLookupPage.tsx` — main page, Mosaic UI

### Components
| Component | Description |
|---|---|
| `caselookup/CaseSearchBox.tsx` | Search input with 3 example chips below it |
| `caselookup/CaseResultCard.tsx` | Found case: name, court, judge, date, docket link |
| `caselookup/CaseAttorneyCard.tsx` | Attorney name, firm, motion chips, "View Timeline →" |
| `caselookup/MotionTimelineModal.tsx` | Full timeline + motion explanations + expectation |
| `caselookup/SimilarAttorneys.tsx` | Available attorneys via existing match pipeline |

### Motion plain-English dictionary (frontend constant)
```ts
export const MOTION_EXPLANATIONS: Record<string, { label: string; purpose: string; what_it_means: string }> = {
  tro:  { label: "TRO / Preliminary Injunction", purpose: "Emergency stop order", what_it_means: "Asks the court to immediately stop the other side from doing something harmful while the case proceeds. Used when waiting for trial would cause irreparable harm." },
  msj:  { label: "Motion for Summary Judgment", purpose: "End case without trial", what_it_means: "Argues the facts are undisputed and the law is clear — so there's no need for a full trial. A win here resolves the case early." },
  mtd:  { label: "Motion to Dismiss", purpose: "Challenge the lawsuit itself", what_it_means: "Argues the complaint is legally deficient and shouldn't proceed. Often the first motion filed by a defendant." },
  osc:  { label: "Order to Show Cause", purpose: "Court-ordered explanation", what_it_means: "The court orders a party to explain why they shouldn't face consequences — often used for contempt or emergency relief." },
  alt_service: { label: "Alternative Service Motion", purpose: "Serve an evasive defendant", what_it_means: "When a defendant is hiding or evading service, this motion asks the court to allow service by alternative means (email, publication)." },
};
```

### Page layout
```
LandingNav
  Hero: "Search by similar case"
  Subhead: "Enter a docket number, case name, or describe a similar case"
  CaseSearchBox
    [ Search input                                    ] [Search →]
    Examples: "1:23-cv-04521"  "Roe v. Wade"  "real estate fraud Queens 2024"

  [on results]
  CaseResultCard
    Case name | Court | Judge | Date filed | [View on CourtListener →]

  "Attorneys in this case"
  CaseAttorneyCard × N
    Name · Firm · [Plaintiff / Defense]
    Motion chips: [TRO] [MSJ] [MTD]
    [View Timeline & Expectations →]

  MotionTimelineModal (drawer)
    ┌─ Timeline ─────────────────────────────┐
    │ 2023-04-12  Motion to Dismiss filed     │
    │             [MTD chip]                  │
    │             "Challenges whether the     │
    │              lawsuit should proceed..." │
    │ 2023-06-01  Opposition filed            │
    │ 2023-08-15  MSJ filed by plaintiff      │
    │             [MSJ chip]                  │
    │             "Argues case can be         │
    │              resolved without trial..." │
    └────────────────────────────────────────┘
    ┌─ What to Expect If You Hire This Attorney ─┐
    │ Timeline:   6-18 months                     │
    │ Strategy:   Expect early MTD, then MSJ      │
    │ Outcomes:   7/10 similar cases settled      │
    │ Budget est: $15,000-45,000                  │
    │ Risks:      ⚠ Only 3 docket entries found  │
    └────────────────────────────────────────────┘

  "Similar attorneys available now"
  SimilarAttorneys (existing ResultsSection adapted)

LandingFooter
```

---

## Landing Page Integration

Add "Search by Case" as second CTA in HeroBlock and a nav link in LandingNav:
- Nav: "Case Lookup" → `/case-lookup`
- Hero: secondary button "Search by Similar Case →" → `/case-lookup`

---

## Rate Limiting

`POST /api/case-lookup`: 5/minute (CourtListener + Claude calls are expensive)

---

## Error Handling

| Scenario | Response |
|---|---|
| Case not found | "No matching case found. Try a different docket number or description." |
| CourtListener timeout | Return partial result with available data, flag as incomplete |
| No attorneys in docket | "No attorney data available for this case (RECAP data may be incomplete)" |
| Gemini extraction fails | Fall back to raw query as search term |
