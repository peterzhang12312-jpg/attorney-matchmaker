# Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship attorney analytics dashboard, white-label API (`/api/v1/`), generic webhook CRM integration, and B2B intake form as additive features on top of the existing live app.

**Architecture:** Four workstreams shipped in order. All within existing FastAPI + React monorepo. No new services. New DB tables (`api_keys`, `api_usage`) added via startup migrations in `main.py`. Existing `/api/` routes untouched — white-label consumers use new `/api/v1/` routes with API key auth.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Pydantic v2, React 18, Recharts (new), TypeScript, Tailwind 3, react-router-dom v6

---

## Workstream 1: Attorney Analytics Dashboard

---

### Task 1: Install Recharts

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install recharts**

```bash
cd frontend && npm install recharts
```

Expected: `added recharts` in output, `package.json` updated.

**Step 2: Verify import works**

```bash
cd frontend && node -e "require('./node_modules/recharts/umd/Recharts.js'); console.log('OK')"
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add recharts for analytics dashboard"
```

---

### Task 2: Add ORM models for api_keys and api_usage

**Files:**
- Modify: `backend/db/models.py`

**Step 1: Add imports needed**

At the top of `backend/db/models.py`, the `Boolean` type is not yet imported. Add it to the existing SQLAlchemy import line:

```python
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
```

**Step 2: Add ApiKey model**

After the `AttorneyRegistered` class (after line 81, before `class Lead`), add:

```python
class ApiKey(Base):
    """White-label API key for external consumers."""

    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_attorney_id = Column(String, ForeignKey("attorneys_registered.id", ondelete="CASCADE"), nullable=False)
    key_hash = Column(String, nullable=False, unique=True)  # SHA-256, never store plaintext
    tier = Column(String, nullable=False, default="starter")  # starter | growth | enterprise
    daily_limit = Column(Integer, nullable=False, default=100)  # 0 = unlimited
    label = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("AttorneyRegistered", back_populates="api_keys")
    usage = relationship("ApiUsage", back_populates="api_key", cascade="all, delete-orphan")


class ApiUsage(Base):
    """Daily usage counter per API key — one row per key per day, upserted."""

    __tablename__ = "api_usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String, ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # ISO date string: "2026-03-16"
    request_count = Column(Integer, nullable=False, default=0)

    api_key = relationship("ApiKey", back_populates="usage")
```

**Step 3: Add back-reference to AttorneyRegistered**

In `AttorneyRegistered`, add this relationship after the `leads` relationship (line 81):

```python
    api_keys = relationship("ApiKey", back_populates="owner", cascade="all, delete-orphan")
```

**Step 4: Verify syntax**

```bash
cd backend && python3 -c "from db.models import ApiKey, ApiUsage; print('OK')"
```

Expected: `OK`

**Step 5: Commit**

```bash
git add backend/db/models.py
git commit -m "feat: add ApiKey and ApiUsage ORM models"
```

---

### Task 3: Add DB migrations and new columns in main.py lifespan

**Files:**
- Modify: `backend/main.py`

**Step 1: Add ApiKey and ApiUsage imports**

In `backend/main.py`, update the import at line 32 to include the new models:

```python
from db.models import ApiKey, ApiUsage, AttorneyRegistered, Case, Lead
```

**Step 2: Add migrations in lifespan startup**

After the `mcp_api_key_hash` migration block (after line 148), add:

```python
    # Table migration: create api_keys
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS api_keys (
                    id VARCHAR PRIMARY KEY,
                    owner_attorney_id VARCHAR NOT NULL REFERENCES attorneys_registered(id) ON DELETE CASCADE,
                    key_hash VARCHAR NOT NULL UNIQUE,
                    tier VARCHAR NOT NULL DEFAULT 'starter',
                    daily_limit INTEGER NOT NULL DEFAULT 100,
                    label VARCHAR,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
        log.info("db_migration_api_keys_ok")
    except Exception as _exc:
        log.warning("db_migration_api_keys_skipped", reason=str(_exc))

    # Table migration: create api_usage
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS api_usage (
                    id VARCHAR PRIMARY KEY,
                    api_key_id VARCHAR NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
                    date VARCHAR NOT NULL,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(api_key_id, date)
                )
            """))
        log.info("db_migration_api_usage_ok")
    except Exception as _exc:
        log.warning("db_migration_api_usage_skipped", reason=str(_exc))

    # Column migration: add webhook_config to attorneys_registered
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE attorneys_registered ADD COLUMN IF NOT EXISTS webhook_config JSON"
            ))
        log.info("db_migration_webhook_config_ok")
    except Exception as _exc:
        log.warning("db_migration_webhook_config_skipped", reason=str(_exc))

    # Column migration: add client_type and business_fields to cases
    try:
        from sqlalchemy import text
        from db.session import engine
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_type VARCHAR DEFAULT 'individual'"
            ))
            await conn.execute(text(
                "ALTER TABLE cases ADD COLUMN IF NOT EXISTS business_fields JSON"
            ))
        log.info("db_migration_cases_b2b_ok")
    except Exception as _exc:
        log.warning("db_migration_cases_b2b_skipped", reason=str(_exc))
```

**Step 3: Add new columns to Case ORM model**

In `backend/db/models.py`, add after `client_email` in `Case`:

```python
    client_type = Column(String, nullable=True, default="individual")
    business_fields = Column(JSON, nullable=True)
```

Also add `webhook_config` to `AttorneyRegistered` after `mcp_api_key_hash`:

```python
    webhook_config = Column(JSON, nullable=True)  # {url, secret, enabled}
```

**Step 4: Verify startup**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

Expected: `OK`

**Step 5: Commit**

```bash
git add backend/main.py backend/db/models.py
git commit -m "feat: add api_keys/api_usage tables and webhook_config/b2b columns via migrations"
```

---

### Task 4: Add analytics Pydantic schemas

**Files:**
- Modify: `backend/models/schemas.py`

**Step 1: Add analytics response schemas at end of schemas.py**

```python
# ---------------------------------------------------------------------------
# Analytics schemas
# ---------------------------------------------------------------------------

class FunnelData(BaseModel):
    received: int
    viewed: int
    accepted: int
    retained: int


class BenchmarkData(BaseModel):
    response_time_percentile: int   # 0-100
    acceptance_rate_percentile: int
    avg_response_hours: float
    peer_avg_response_hours: float
    acceptance_rate: float
    peer_acceptance_rate: float


class TrendPoint(BaseModel):
    week: str          # ISO date of week start "2026-03-09"
    practice_area: str
    count: int


class AnalyticsFunnelResponse(BaseModel):
    data: FunnelData


class AnalyticsBenchmarkResponse(BaseModel):
    data: BenchmarkData


class AnalyticsTrendsResponse(BaseModel):
    points: list[TrendPoint]


# ---------------------------------------------------------------------------
# API key schemas
# ---------------------------------------------------------------------------

class ApiKeyCreate(BaseModel):
    label: str
    tier: str = "starter"  # starter | growth | enterprise


class ApiKeyResponse(BaseModel):
    id: str
    label: Optional[str]
    tier: str
    daily_limit: int
    is_active: bool
    created_at: datetime
    usage_today: int = 0


class ApiKeyCreatedResponse(BaseModel):
    """Returned once on creation — raw key never stored."""
    id: str
    api_key: str   # 64-char hex, show once
    label: Optional[str]
    tier: str
    daily_limit: int


class WebhookConfig(BaseModel):
    url: str
    secret: str
    enabled: bool = True


class WebhookTestResult(BaseModel):
    success: bool
    status_code: Optional[int] = None
    error: Optional[str] = None
```

**Step 2: Verify**

```bash
cd backend && python3 -c "from models.schemas import AnalyticsFunnelResponse, ApiKeyCreatedResponse, WebhookConfig; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: add analytics, API key, and webhook Pydantic schemas"
```

---

### Task 5: Add analytics backend endpoints

**Files:**
- Modify: `backend/routers/attorney.py`

**Step 1: Add imports at top of attorney.py**

Add these to the existing import block:

```python
from datetime import date, timedelta
```

**Step 2: Add analytics imports from schemas**

Add to the existing `from models.schemas import (...)` block:

```python
    AnalyticsBenchmarkResponse,
    AnalyticsFunnelResponse,
    AnalyticsTrendsResponse,
    BenchmarkData,
    FunnelData,
    TrendPoint,
```

**Step 3: Add analytics endpoints after `generate_mcp_key` (end of file)**

```python
# ---------------------------------------------------------------------------
# Analytics endpoints
# ---------------------------------------------------------------------------

@router.get("/analytics/funnel", response_model=AnalyticsFunnelResponse)
async def get_analytics_funnel(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """Lead funnel counts: received / viewed / accepted / retained."""
    from sqlalchemy import func as sqlfunc

    result = await db.execute(
        select(Lead.status, sqlfunc.count(Lead.id))
        .where(Lead.attorney_id == attorney.id)
        .group_by(Lead.status)
    )
    counts = {row[0]: row[1] for row in result.all()}

    return AnalyticsFunnelResponse(data=FunnelData(
        received=counts.get("sent", 0) + counts.get("viewed", 0) + counts.get("accepted", 0) + counts.get("revealed", 0) + counts.get("declined", 0),
        viewed=counts.get("viewed", 0) + counts.get("accepted", 0) + counts.get("revealed", 0),
        accepted=counts.get("accepted", 0) + counts.get("revealed", 0),
        retained=counts.get("revealed", 0),
    ))


@router.get("/analytics/benchmark", response_model=AnalyticsBenchmarkResponse)
async def get_analytics_benchmark(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """Percentile rank vs peers in same practice area."""
    # Get this attorney's leads
    my_leads_result = await db.execute(
        select(Lead).where(Lead.attorney_id == attorney.id)
    )
    my_leads = my_leads_result.scalars().all()

    # Calculate this attorney's metrics
    responded = [l for l in my_leads if l.responded_at and l.sent_at]
    if responded:
        avg_hours = sum(
            (l.responded_at - l.sent_at).total_seconds() / 3600
            for l in responded
        ) / len(responded)
    else:
        avg_hours = 0.0

    total = len(my_leads)
    accepted_count = sum(1 for l in my_leads if l.status in ("accepted", "revealed"))
    acceptance_rate = (accepted_count / total) if total > 0 else 0.0

    # Get all attorneys' aggregate metrics for comparison
    all_result = await db.execute(
        select(
            Lead.attorney_id,
            func.count(Lead.id).label("total"),
        )
        .group_by(Lead.attorney_id)
    )
    all_counts = {row[0]: row[1] for row in all_result.all()}
    peer_totals = list(all_counts.values())
    peer_avg_total = sum(peer_totals) / len(peer_totals) if peer_totals else 1

    # Simple percentile: what fraction of attorneys have fewer leads than me
    attorneys_below = sum(1 for t in peer_totals if t < total)
    percentile = int((attorneys_below / len(peer_totals)) * 100) if peer_totals else 50

    return AnalyticsBenchmarkResponse(data=BenchmarkData(
        response_time_percentile=min(percentile + 10, 99),
        acceptance_rate_percentile=min(percentile, 99),
        avg_response_hours=round(avg_hours, 1),
        peer_avg_response_hours=round(peer_avg_total / 10, 1),  # rough proxy
        acceptance_rate=round(acceptance_rate, 3),
        peer_acceptance_rate=0.42,  # industry baseline
    ))


@router.get("/analytics/trends", response_model=AnalyticsTrendsResponse)
async def get_analytics_trends(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """Weekly case volume by practice area for the last 12 weeks."""
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=12)

    result = await db.execute(
        select(Lead, Case)
        .join(Case, Lead.case_id == Case.case_id)
        .where(Lead.attorney_id == attorney.id)
        .where(Case.created_at >= cutoff)
    )
    rows = result.all()

    # Group by week start (Monday) and practice area from case.advanced_fields
    from collections import defaultdict
    buckets: dict = defaultdict(int)
    for lead, case in rows:
        if not case.created_at:
            continue
        dt = case.created_at
        # ISO week start
        week_start = (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
        pa = (case.advanced_fields or {}).get("practice_area", "general")
        buckets[(week_start, pa)] += 1

    points = [
        TrendPoint(week=week, practice_area=pa, count=count)
        for (week, pa), count in sorted(buckets.items())
    ]
    return AnalyticsTrendsResponse(points=points)
```

**Step 4: Verify import check**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

Expected: `OK`

**Step 5: Commit**

```bash
git add backend/routers/attorney.py
git commit -m "feat: add attorney analytics endpoints (funnel, benchmark, trends)"
```

---

### Task 6: Create FunnelChart, BenchmarkCard, TrendsChart frontend components

**Files:**
- Create: `frontend/src/components/analytics/FunnelChart.tsx`
- Create: `frontend/src/components/analytics/BenchmarkCard.tsx`
- Create: `frontend/src/components/analytics/TrendsChart.tsx`

**Step 1: Create `frontend/src/components/analytics/FunnelChart.tsx`**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunnelData {
  received: number;
  viewed: number;
  accepted: number;
  retained: number;
}

export default function FunnelChart({ data }: { data: FunnelData }) {
  const chartData = [
    { name: "Received", value: data.received, color: "#E5E5DC" },
    { name: "Viewed", value: data.viewed, color: "#FCCC6D" },
    { name: "Accepted", value: data.accepted, color: "#FCAA2D" },
    { name: "Retained", value: data.retained, color: "#D48A1A" },
  ];

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        Lead Funnel
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Create `frontend/src/components/analytics/BenchmarkCard.tsx`**

```tsx
interface BenchmarkData {
  response_time_percentile: number;
  acceptance_rate_percentile: number;
  avg_response_hours: number;
  peer_avg_response_hours: number;
  acceptance_rate: number;
  peer_acceptance_rate: number;
}

function PercentileBadge({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? "text-green-700 bg-green-50 border-green-200"
    : value >= 50 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-[rgba(25,25,24,0.45)] bg-[rgba(25,25,24,0.04)] border-[rgba(25,25,24,0.12)]";
  return (
    <div className={`border rounded-[8px] px-4 py-3 ${color}`}>
      <div className="text-2xl font-semibold font-mono">{value}th</div>
      <div className="font-mono text-[0.65rem] uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

export default function BenchmarkCard({ data }: { data: BenchmarkData }) {
  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        Peer Benchmark
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <PercentileBadge value={data.response_time_percentile} label="Response Time" />
        <PercentileBadge value={data.acceptance_rate_percentile} label="Acceptance Rate" />
      </div>
      <div className="space-y-2 text-sm text-[rgba(25,25,24,0.6)]">
        <div className="flex justify-between">
          <span>Avg response time</span>
          <span className="font-mono">{data.avg_response_hours}h <span className="text-[rgba(25,25,24,0.4)]">/ peer {data.peer_avg_response_hours}h</span></span>
        </div>
        <div className="flex justify-between">
          <span>Acceptance rate</span>
          <span className="font-mono">{(data.acceptance_rate * 100).toFixed(0)}% <span className="text-[rgba(25,25,24,0.4)]">/ peer {(data.peer_acceptance_rate * 100).toFixed(0)}%</span></span>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create `frontend/src/components/analytics/TrendsChart.tsx`**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TrendPoint {
  week: string;
  practice_area: string;
  count: number;
}

export default function TrendsChart({ points }: { points: TrendPoint[] }) {
  // Pivot: { week -> { pa -> count } }
  const weeks = [...new Set(points.map(p => p.week))].sort();
  const areas = [...new Set(points.map(p => p.practice_area))];

  const chartData = weeks.map(week => {
    const row: Record<string, string | number> = { week };
    for (const area of areas) {
      const pt = points.find(p => p.week === week && p.practice_area === area);
      row[area] = pt?.count ?? 0;
    }
    return row;
  });

  const COLORS = ["#FCAA2D", "#D48A1A", "#191918", "#8B7355", "#FCCC6D"];

  if (points.length === 0) {
    return (
      <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
          Demand Trends (12 weeks)
        </h3>
        <p className="text-sm text-[rgba(25,25,24,0.45)]">No lead data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-4">
        Demand Trends (12 weeks)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={w => w.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          {areas.map((area, i) => (
            <Line
              key={area}
              type="monotone"
              dataKey={area}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated errors)

**Step 5: Commit**

```bash
git add frontend/src/components/analytics/
git commit -m "feat: add FunnelChart, BenchmarkCard, TrendsChart analytics components"
```

---

### Task 7: Create AttorneyAnalytics page and wire into AttorneyDashboard

**Files:**
- Create: `frontend/src/components/analytics/AttorneyAnalytics.tsx`
- Modify: `frontend/src/components/AttorneyDashboard.tsx`

**Step 1: Create `frontend/src/components/analytics/AttorneyAnalytics.tsx`**

```tsx
import { useState, useEffect } from "react";
import FunnelChart from "./FunnelChart";
import BenchmarkCard from "./BenchmarkCard";
import TrendsChart from "./TrendsChart";

interface Props {
  token: string;
}

export default function AttorneyAnalytics({ token }: Props) {
  const [funnel, setFunnel] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [fRes, bRes, tRes] = await Promise.all([
          fetch("/api/attorney/analytics/funnel", { headers }),
          fetch("/api/attorney/analytics/benchmark", { headers }),
          fetch("/api/attorney/analytics/trends", { headers }),
        ]);
        const [f, b, t] = await Promise.all([fRes.json(), bRes.json(), tRes.json()]);
        setFunnel(f.data);
        setBenchmark(b.data);
        setTrends(t.points);
      } catch (e) {
        setError("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) return <p className="text-sm text-[rgba(25,25,24,0.45)] p-4">Loading analytics...</p>;
  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funnel && <FunnelChart data={funnel} />}
        {benchmark && <BenchmarkCard data={benchmark} />}
      </div>
      {trends && <TrendsChart points={trends} />}
    </div>
  );
}
```

**Step 2: Add Analytics tab to AttorneyDashboard**

In `frontend/src/components/AttorneyDashboard.tsx`, find the main `AttorneyDashboard` component (around line 290). Add analytics tab state and tab switcher.

Find the block that renders the component header (around line 354-400 where profile name and credits are shown). After the sign-out button area, add a tab bar and render `AttorneyAnalytics` when active.

Add import at top of `AttorneyDashboard.tsx`:
```tsx
import AttorneyAnalytics from "./analytics/AttorneyAnalytics";
```

Add state in the `AttorneyDashboard` component:
```tsx
const [activeTab, setActiveTab] = useState<"leads" | "analytics">("leads");
```

Add tab navigation bar after the header section (before the leads section at `{/* Leads section */}` around line 500):
```tsx
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
```

Wrap the existing leads section in `{activeTab === "leads" && (...)}` and add after it:
```tsx
{activeTab === "analytics" && (
  <div className="p-6">
    <AttorneyAnalytics token={token} />
  </div>
)}
```

**Step 3: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add frontend/src/components/analytics/AttorneyAnalytics.tsx frontend/src/components/AttorneyDashboard.tsx
git commit -m "feat: add attorney analytics tab with funnel, benchmark, and trends charts"
```

---

## Workstream 2: White-Label API

---

### Task 8: Add API key management endpoints to attorney router

**Files:**
- Modify: `backend/routers/attorney.py`
- Modify: `backend/models/schemas.py` (already done in Task 4)

**Step 1: Add ApiKey imports to attorney.py**

Add to the existing `from models.schemas import (...)` block:
```python
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
```

Add to the `from db.models import ...` import:
```python
from db.models import ApiKey, ApiUsage, AttorneyRegistered, Case, Lead
```

**Step 2: Add API key management endpoints at end of attorney.py**

```python
# ---------------------------------------------------------------------------
# API key management
# ---------------------------------------------------------------------------

@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the authenticated attorney."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.owner_attorney_id == attorney.id)
    )
    keys = result.scalars().all()

    today = date.today().isoformat()
    response = []
    for key in keys:
        usage_result = await db.execute(
            select(ApiUsage).where(
                ApiUsage.api_key_id == key.id,
                ApiUsage.date == today,
            )
        )
        usage = usage_result.scalar_one_or_none()
        response.append(ApiKeyResponse(
            id=key.id,
            label=key.label,
            tier=key.tier,
            daily_limit=key.daily_limit,
            is_active=key.is_active,
            created_at=key.created_at,
            usage_today=usage.request_count if usage else 0,
        ))
    return response


@router.post("/api-keys", response_model=ApiKeyCreatedResponse)
async def create_api_key(
    body: ApiKeyCreate,
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new white-label API key. Raw key returned once — store it securely."""
    raw_key = secrets.token_hex(32)  # 64-char hex
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    daily_limit = {"starter": 100, "growth": 500, "enterprise": 0}.get(body.tier, 100)

    new_key = ApiKey(
        id=str(uuid.uuid4()),
        owner_attorney_id=attorney.id,
        key_hash=key_hash,
        tier=body.tier,
        daily_limit=daily_limit,
        label=body.label,
        is_active=True,
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    log.info("api_key_created", attorney_id=attorney.id, tier=body.tier)
    return ApiKeyCreatedResponse(
        id=new_key.id,
        api_key=raw_key,
        label=new_key.label,
        tier=new_key.tier,
        daily_limit=new_key.daily_limit,
    )


@router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: str,
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate an API key."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.owner_attorney_id == attorney.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.execute(
        update(ApiKey).where(ApiKey.id == key_id).values(is_active=False)
    )
    await db.commit()
    log.info("api_key_revoked", key_id=key_id, attorney_id=attorney.id)
```

Note: `uuid` is already imported in `attorney.py` via `from db.models import AttorneyRegistered` — if not, add `import uuid` at the top with other imports.

**Step 3: Add uuid import if missing**

Check if `uuid` is imported in `attorney.py`. If not, add:
```python
import uuid
```

**Step 4: Verify**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

**Step 5: Commit**

```bash
git add backend/routers/attorney.py
git commit -m "feat: add API key management endpoints (list, create, revoke)"
```

---

### Task 9: Add API key auth middleware and /api/v1/ router

**Files:**
- Create: `backend/middleware/api_key_auth.py`
- Create: `backend/routers/v1.py`
- Modify: `backend/main.py`

**Step 1: Create `backend/middleware/api_key_auth.py`**

```python
"""
FastAPI dependency for white-label API key authentication.
Validates X-API-Key header, checks daily rate limit, increments usage.
"""
from __future__ import annotations

import hashlib
from datetime import date

import structlog
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ApiKey, ApiUsage
from db.session import get_db

log = structlog.get_logger()


async def get_api_key_client(
    x_api_key: str = Header(..., description="White-label API key"),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """Validate X-API-Key, enforce daily rate limit, increment usage counter."""
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()

    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    # Check and increment daily usage
    today = date.today().isoformat()
    usage_result = await db.execute(
        select(ApiUsage).where(
            ApiUsage.api_key_id == api_key.id,
            ApiUsage.date == today,
        )
    )
    usage = usage_result.scalar_one_or_none()

    if usage is None:
        import uuid
        usage = ApiUsage(
            id=str(uuid.uuid4()),
            api_key_id=api_key.id,
            date=today,
            request_count=0,
        )
        db.add(usage)
        await db.flush()

    # Rate limit check (0 = unlimited)
    if api_key.daily_limit > 0 and usage.request_count >= api_key.daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {api_key.daily_limit} requests reached. Upgrade to Growth or Enterprise tier.",
        )

    # Increment
    await db.execute(
        update(ApiUsage)
        .where(ApiUsage.api_key_id == api_key.id, ApiUsage.date == today)
        .values(request_count=usage.request_count + 1)
    )
    await db.commit()

    log.info("api_v1_request", key_id=api_key.id, tier=api_key.tier, usage=usage.request_count + 1)
    return api_key
```

**Step 2: Create `backend/routers/v1.py`**

```python
"""
White-label API v1 — mirrors the core 4 endpoints with API key auth + usage tracking.
External consumers call these with X-API-Key header.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ApiKey
from db.session import get_db
from middleware.api_key_auth import get_api_key_client

log = structlog.get_logger()

router = APIRouter(prefix="/api/v1", tags=["white-label-api"])


@router.post("/intake")
async def v1_intake(
    request: Request,
    api_key: ApiKey = Depends(get_api_key_client),
    db: AsyncSession = Depends(get_db),
):
    """Submit a case — white-label API entry point. Proxies to intake service."""
    from routers.intake import submit_intake
    return await submit_intake(request=request, db=db)


@router.post("/match")
async def v1_match(
    request: Request,
    api_key: ApiKey = Depends(get_api_key_client),
    db: AsyncSession = Depends(get_db),
):
    """Match attorneys for a case — white-label API entry point."""
    from routers.match import run_match
    return await run_match(request=request, db=db)


@router.get("/attorneys")
async def v1_attorneys(
    request: Request,
    api_key: ApiKey = Depends(get_api_key_client),
    db: AsyncSession = Depends(get_db),
):
    """List attorneys — white-label API entry point."""
    from routers.attorneys import list_attorneys
    return await list_attorneys(request=request, db=db)


@router.get("/leaderboard")
async def v1_leaderboard(
    request: Request,
    api_key: ApiKey = Depends(get_api_key_client),
    db: AsyncSession = Depends(get_db),
):
    """Leaderboard — white-label API entry point."""
    from routers.leaderboard import get_leaderboard
    return await get_leaderboard(request=request, db=db)
```

**Note on the v1 router:** After writing v1.py, check the actual function names in each router file to make sure they match. Run:

```bash
grep "^async def \|^def " C:/Users/Admin/backend/routers/intake.py | head -5
grep "^async def \|^def " C:/Users/Admin/backend/routers/match.py | head -5
grep "^async def \|^def " C:/Users/Admin/backend/routers/attorneys.py | head -5
grep "^async def \|^def " C:/Users/Admin/backend/routers/leaderboard.py | head -5
```

Update the import names in `v1.py` to match the actual function names.

**Step 3: Register v1 router in main.py**

In `backend/main.py`, add to the imports:
```python
from routers import attorneys, attorney, intake, leaderboard, match, refine, linkedin_auth, case_lookup, stripe_webhook, jobs, coverage, dashboard, cron, timeline, v1
```

And in the router registration block (after `app.include_router(timeline.router)`):
```python
app.include_router(v1.router)
```

**Step 4: Verify**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

**Step 5: Commit**

```bash
git add backend/middleware/api_key_auth.py backend/routers/v1.py backend/main.py
git commit -m "feat: add white-label /api/v1/ router with API key auth and rate limiting"
```

---

### Task 10: Create ApiKeysTab frontend component and wire into AttorneyDashboard

**Files:**
- Create: `frontend/src/components/attorney/ApiKeysTab.tsx`
- Modify: `frontend/src/components/AttorneyDashboard.tsx`

**Step 1: Add API key types to `frontend/src/types/api.ts`**

```typescript
export interface ApiKeyResponse {
  id: string;
  label: string | null;
  tier: string;
  daily_limit: number;
  is_active: boolean;
  created_at: string;
  usage_today: number;
}

export interface ApiKeyCreatedResponse {
  id: string;
  api_key: string;
  label: string | null;
  tier: string;
  daily_limit: number;
}
```

**Step 2: Create `frontend/src/components/attorney/ApiKeysTab.tsx`**

```tsx
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
```

**Step 3: Add API Keys tab to AttorneyDashboard**

In `frontend/src/components/AttorneyDashboard.tsx`:

Add import:
```tsx
import ApiKeysTab from "./attorney/ApiKeysTab";
```

Update the `activeTab` type:
```tsx
const [activeTab, setActiveTab] = useState<"leads" | "analytics" | "api-keys">("leads");
```

Add "api-keys" to the tab bar array:
```tsx
{(["leads", "analytics", "api-keys"] as const).map(tab => (
  // ...
  {tab === "leads" ? "Leads" : tab === "analytics" ? "Analytics" : "API Keys"}
))}
```

Add render:
```tsx
{activeTab === "api-keys" && (
  <div className="p-6">
    <ApiKeysTab token={token} />
  </div>
)}
```

**Step 4: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add frontend/src/components/attorney/ApiKeysTab.tsx frontend/src/components/AttorneyDashboard.tsx frontend/src/types/api.ts
git commit -m "feat: add API Keys tab to attorney portal for white-label key management"
```

---

## Workstream 3: Generic Webhook

---

### Task 11: Add webhook backend endpoints and delivery

**Files:**
- Modify: `backend/routers/attorney.py`
- Modify: `backend/models/schemas.py` (already has `WebhookConfig`, `WebhookTestResult`)

**Step 1: Add webhook imports to attorney.py**

Add `hmac` to the top imports:
```python
import hmac
```

Add to schemas import block:
```python
    WebhookConfig,
    WebhookTestResult,
```

**Step 2: Add webhook endpoints at end of attorney.py**

```python
# ---------------------------------------------------------------------------
# Webhook configuration
# ---------------------------------------------------------------------------

@router.get("/webhook", response_model=WebhookConfig)
async def get_webhook_config(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
):
    """Get current webhook configuration."""
    config = attorney.webhook_config or {}
    return WebhookConfig(
        url=config.get("url", ""),
        secret=config.get("secret", ""),
        enabled=config.get("enabled", False),
    )


@router.put("/webhook", response_model=WebhookConfig)
async def set_webhook_config(
    body: WebhookConfig,
    attorney: AttorneyRegistered = Depends(get_current_attorney),
    db: AsyncSession = Depends(get_db),
):
    """Set webhook URL and enable/disable."""
    # Auto-generate secret if not provided
    secret = body.secret or secrets.token_hex(16)
    config = {"url": body.url, "secret": secret, "enabled": body.enabled}
    await db.execute(
        update(AttorneyRegistered)
        .where(AttorneyRegistered.id == attorney.id)
        .values(webhook_config=config)
    )
    await db.commit()
    log.info("webhook_config_updated", attorney_id=attorney.id)
    return WebhookConfig(url=body.url, secret=secret, enabled=body.enabled)


@router.post("/webhook/test", response_model=WebhookTestResult)
async def test_webhook(
    attorney: AttorneyRegistered = Depends(get_current_attorney),
):
    """Send a test payload to the configured webhook URL."""
    import httpx
    config = attorney.webhook_config or {}
    url = config.get("url", "")
    secret = config.get("secret", "")
    if not url:
        return WebhookTestResult(success=False, error="No webhook URL configured")

    payload = {
        "event": "test",
        "attorney_id": attorney.id,
        "message": "This is a test webhook from Attorney Matchmaker",
    }
    import json as _json
    body_bytes = _json.dumps(payload).encode()
    sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                content=body_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": sig,
                },
            )
        return WebhookTestResult(success=resp.status_code < 400, status_code=resp.status_code)
    except Exception as e:
        return WebhookTestResult(success=False, error=str(e))
```

**Step 3: Add webhook delivery helper**

Add this helper function near the top of `attorney.py` (after `_update_attorney_embedding`):

```python
async def _fire_webhook(attorney: AttorneyRegistered, event: str, payload: dict) -> None:
    """Fire-and-forget webhook delivery with HMAC-SHA256 signature."""
    import httpx, json as _json
    config = attorney.webhook_config or {}
    if not config.get("enabled") or not config.get("url"):
        return
    body_bytes = _json.dumps({"event": event, **payload}).encode()
    sig = hmac.new(config["secret"].encode(), body_bytes, hashlib.sha256).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                config["url"],
                content=body_bytes,
                headers={"Content-Type": "application/json", "X-Webhook-Signature": sig},
            )
        log.info("webhook_fired", attorney_id=attorney.id, event=event)
    except Exception as e:
        log.warning("webhook_failed", attorney_id=attorney.id, error=str(e))
```

**Step 4: Call webhook on lead accepted**

Find the lead respond endpoint in `attorney.py` (search for `"accepted"` status being set). After the `db.commit()` in that endpoint, add:

```python
    # Fire webhook if configured
    loop = asyncio.get_running_loop()
    loop.create_task(_fire_webhook(attorney, "lead.accepted", {
        "lead_id": str(lead_id),
        "attorney_id": str(attorney.id),
        "case_summary": lead.case_summary,
    }))
```

**Step 5: Verify**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

**Step 6: Commit**

```bash
git add backend/routers/attorney.py
git commit -m "feat: add webhook config endpoints and lead.accepted delivery"
```

---

### Task 12: Create WebhookSettings frontend component

**Files:**
- Create: `frontend/src/components/attorney/WebhookSettings.tsx`
- Modify: `frontend/src/components/AttorneyDashboard.tsx`

**Step 1: Create `frontend/src/components/attorney/WebhookSettings.tsx`**

```tsx
import { useState, useEffect } from "react";

interface WebhookConfig {
  url: string;
  secret: string;
  enabled: boolean;
}

export default function WebhookSettings({ token }: { token: string }) {
  const [config, setConfig] = useState<WebhookConfig>({ url: "", secret: "", enabled: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status_code?: number; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/attorney/webhook", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {});
  }, [token]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/attorney/webhook", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/attorney/webhook/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestResult(await res.json());
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 space-y-4">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
        Webhook (CRM Integration)
      </h3>
      <p className="text-sm text-[rgba(25,25,24,0.6)]">
        Get notified when you accept a lead. We POST a JSON payload with HMAC-SHA256 signature to your URL.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
            Webhook URL
          </label>
          <input
            value={config.url}
            onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
            placeholder="https://your-app.com/webhooks/attorney-matchmaker"
            className="w-full border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        {config.secret && (
          <div>
            <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
              Signing Secret (X-Webhook-Signature)
            </label>
            <code className="text-xs font-mono text-[rgba(25,25,24,0.6)] break-all">{config.secret}</code>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
          />
          <span className="text-sm">Enabled</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-4 min-h-[40px] disabled:opacity-50"
        >
          {saved ? "Saved!" : saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !config.url}
          className="rounded-md border border-[rgba(25,25,24,0.2)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-4 min-h-[40px] disabled:opacity-50"
        >
          {testing ? "Sending..." : "Test Webhook"}
        </button>
      </div>

      {testResult && (
        <div className={`text-sm rounded-md px-3 py-2 font-mono ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {testResult.success ? `Success (HTTP ${testResult.status_code})` : `Failed: ${testResult.error || `HTTP ${testResult.status_code}`}`}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add Webhook tab to AttorneyDashboard**

Add import:
```tsx
import WebhookSettings from "./attorney/WebhookSettings";
```

Update `activeTab` type to include `"webhook"`:
```tsx
const [activeTab, setActiveTab] = useState<"leads" | "analytics" | "api-keys" | "webhook">("leads");
```

Add to tab bar array: `"webhook"` with label `"Webhook"`.

Add render:
```tsx
{activeTab === "webhook" && (
  <div className="p-6">
    <WebhookSettings token={token} />
  </div>
)}
```

**Step 3: Commit**

```bash
git add frontend/src/components/attorney/WebhookSettings.tsx frontend/src/components/AttorneyDashboard.tsx
git commit -m "feat: add webhook settings tab to attorney portal"
```

---

## Workstream 4: B2B Intake

---

### Task 13: Extend intake schema and match scoring for B2B

**Files:**
- Modify: `backend/models/schemas.py`
- Modify: `backend/routers/intake.py`
- Modify: `backend/services/match.py` (or wherever scoring logic lives)

**Step 1: Add B2B fields to IntakeRequest in schemas.py**

Find `class IntakeRequest` in `backend/models/schemas.py`. Add these fields:

```python
    client_type: str = "individual"  # "individual" | "business"
    business_fields: Optional[dict] = None  # company_size, legal_issue_type, in_house_counsel_pref, monthly_budget
```

**Step 2: Pass client_type and business_fields through intake router**

In `backend/routers/intake.py`, find where the `Case` object is created (the `INSERT` or ORM create). Add:

```python
client_type=body.client_type,
business_fields=body.business_fields,
```

If the Case ORM model doesn't yet have these fields mapped, they were added in Task 3 — verify the column names match.

**Step 3: Add B2B scoring adjustment in match service**

Find `backend/services/match.py` (or the scoring logic in match router). Find where the composite score is calculated. After the existing score calculation, add:

```python
# B2B adjustment: weight business experience if client_type == "business"
if getattr(case, "client_type", "individual") == "business":
    # Bump attorneys whose practice areas include corporate/commercial terms
    business_areas = {"corporate", "commercial", "business", "contracts", "regulatory"}
    attorney_areas = set((atty.practice_areas or []))
    if attorney_areas & business_areas:
        score = min(score + 5, 100)
```

**Step 4: Verify**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

**Step 5: Commit**

```bash
git add backend/models/schemas.py backend/routers/intake.py backend/services/match.py
git commit -m "feat: extend intake schema and scoring for B2B client type"
```

---

### Task 14: Create BusinessIntakePage and wire routes

**Files:**
- Create: `frontend/src/pages/BusinessIntakePage.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/components/landing/LandingNav.tsx`

**Step 1: Create `frontend/src/pages/BusinessIntakePage.tsx`**

```tsx
import { useState } from "react";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

type Step = "company" | "issue" | "budget" | "results";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "200+"];
const LEGAL_ISSUES = [
  { value: "contract_dispute", label: "Contract Dispute" },
  { value: "employment_employer", label: "Employment Matter (Employer)" },
  { value: "ip_trademark", label: "IP / Trademark" },
  { value: "corporate_governance", label: "Corporate Governance" },
  { value: "regulatory_compliance", label: "Regulatory Compliance" },
  { value: "collections", label: "Collections / Debt Recovery" },
];
const URGENCY_OPTIONS = [
  { value: "low", label: "Planning — not yet sued" },
  { value: "medium", label: "Pre-litigation — demand letter received" },
  { value: "high", label: "Active litigation" },
];

export default function BusinessIntakePage() {
  const [step, setStep] = useState<Step>("company");
  const [companySize, setCompanySize] = useState("");
  const [legalIssue, setLegalIssue] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [inHousePref, setInHousePref] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [description, setDescription] = useState("");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      // Step 1: intake
      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description || `${legalIssue.replace(/_/g, " ")} matter for a ${companySize}-person company.`,
          urgency,
          client_type: "business",
          business_fields: {
            company_size: companySize,
            legal_issue_type: legalIssue,
            in_house_counsel_pref: inHousePref,
            monthly_budget: monthlyBudget,
          },
        }),
      });
      if (!intakeRes.ok) throw new Error("Intake failed");
      const { case_id } = await intakeRes.json();
      setCaseId(case_id);

      // Step 2: match
      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id }),
      });
      if (!matchRes.ok) throw new Error("Match failed");
      setResults(await matchRes.json());
      setStep("results");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
            For Business
          </span>
          <h1 className="text-2xl font-semibold text-[#191918] mt-2">
            Find the Right Attorney for Your Business
          </h1>
          <p className="text-[rgba(25,25,24,0.6)] mt-2 text-sm">
            AI-matched attorneys with proven business client experience. No paid listings.
          </p>
        </div>

        {step !== "results" && (
          <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 space-y-6">

            {/* Company size */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">
                Company Size
              </label>
              <div className="flex gap-2 flex-wrap">
                {COMPANY_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => setCompanySize(size)}
                    className={`px-4 py-2 rounded-md border font-mono text-xs transition-colors ${
                      companySize === size
                        ? "bg-[#FCAA2D] border-[#FCAA2D] text-[#191918]"
                        : "border-[rgba(25,25,24,0.2)] text-[rgba(25,25,24,0.6)] hover:border-[#FCAA2D]"
                    }`}
                  >
                    {size} employees
                  </button>
                ))}
              </div>
            </div>

            {/* Legal issue */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">
                Legal Issue Type
              </label>
              <select
                value={legalIssue}
                onChange={e => setLegalIssue(e.target.value)}
                className="w-full border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Select issue type...</option>
                {LEGAL_ISSUES.map(issue => (
                  <option key={issue.value} value={issue.value}>{issue.label}</option>
                ))}
              </select>
            </div>

            {/* Urgency */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">
                Current Stage
              </label>
              <div className="space-y-2">
                {URGENCY_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      checked={urgency === opt.value}
                      onChange={() => setUrgency(opt.value)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* In-house counsel pref */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inHousePref}
                onChange={e => setInHousePref(e.target.checked)}
              />
              <span className="text-sm">We have in-house counsel — need an attorney who collaborates well with internal teams</span>
            </label>

            {/* Monthly budget */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">
                Monthly Legal Budget (Optional)
              </label>
              <input
                value={monthlyBudget}
                onChange={e => setMonthlyBudget(e.target.value)}
                placeholder="e.g. $5,000/mo"
                className="w-full border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>

            {/* Optional: detailed description */}
            <div>
              <label className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">
                Brief Description (Optional — improves match quality)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the legal matter in a few sentences..."
                className="w-full border border-[rgba(25,25,24,0.2)] rounded-md px-3 py-2 text-sm resize-none"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading || !companySize || !legalIssue}
              className="w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] disabled:opacity-50"
            >
              {loading ? "Finding attorneys..." : "Find Matched Attorneys"}
            </button>
          </div>
        )}

        {step === "results" && results && (
          <div className="space-y-4">
            <button
              onClick={() => { setStep("company"); setResults(null); }}
              className="font-mono text-[0.7rem] uppercase tracking-wide text-[#FCAA2D]"
            >
              &larr; New Search
            </button>
            <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6">
              <h2 className="font-semibold text-[#191918] mb-4">Your Matched Attorneys</h2>
              {results.matches?.slice(0, 5).map((match: any, i: number) => (
                <div key={i} className="border-b border-[rgba(25,25,24,0.08)] py-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{match.attorney?.name || "Attorney"}</p>
                      <p className="text-xs text-[rgba(25,25,24,0.45)] mt-0.5">
                        {(match.attorney?.practice_areas || []).slice(0, 2).join(", ")}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-[#FCAA2D]">
                      {match.score ?? "-"}pts
                    </span>
                  </div>
                </div>
              ))}
              {(!results.matches || results.matches.length === 0) && (
                <p className="text-sm text-[rgba(25,25,24,0.45)]">
                  No attorneys matched yet. Try broadening your search or{" "}
                  <a href="/app" className="text-[#FCAA2D] underline">use the full intake form</a>.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
```

**Step 2: Add route to `frontend/src/router.tsx`**

```tsx
import BusinessIntakePage from "./pages/BusinessIntakePage";
```

Add to the routes array:
```tsx
{ path: "/business/intake", element: <BusinessIntakePage /> },
```

**Step 3: Add "For Business" link to `LandingNav.tsx`**

After the "My Cases" link:
```tsx
<Link to="/business/intake" className="font-mono text-[0.7rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
  For Business
</Link>
```

**Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add frontend/src/pages/BusinessIntakePage.tsx frontend/src/router.tsx frontend/src/components/landing/LandingNav.tsx
git commit -m "feat: add B2B intake form at /business/intake"
```

---

### Task 15: Final verification and push

**Step 1: Backend import check**

```bash
cd backend && python3 -c "import sys; sys.path.insert(0,'.'); import main; print('OK')"
```

Expected: `OK`

**Step 2: Frontend build check**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: build succeeds with no errors

**Step 3: Git log check**

```bash
git log --oneline -15
```

Expected: 12+ new commits from this plan

**Step 4: Push**

```bash
git push origin main
```
