/* ------------------------------------------------------------------ */
/*  API client — thin fetch wrappers for every backend endpoint        */
/*  All paths are relative so Vite's dev proxy handles routing.        */
/* ------------------------------------------------------------------ */

import type {
  HealthResponse,
  IntakeRequest,
  IntakeResponse,
  MatchRequest,
  MatchResponse,
  AttorneyListResponse,
  RefineFactsRequest,
  RefineFactsResponse,
  LeaderboardResponse,
  AttorneyRegisterRequest,
  AttorneyLoginResponse,
  AttorneyProfile,
  LeadSummary,
  CaseLookupResponse,
  CasePreferences,
} from "../types/api";

class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "Unknown error");
      throw new ApiError(res.status, body);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. The server took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ---------- Health ---------- */

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

/* ---------- Case Intake ---------- */

export async function submitIntake(
  payload: IntakeRequest,
): Promise<IntakeResponse> {
  return request<IntakeResponse>("/api/intake", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------- Match Pipeline ---------- */

export async function runMatch(
  payload: MatchRequest,
): Promise<MatchResponse> {
  return request<MatchResponse>("/api/match", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Enqueue async match — returns { job_id, case_id, stage } immediately. */
export async function enqueueMatch(
  payload: MatchRequest,
): Promise<{ job_id: string; case_id: string; stage: string }> {
  return request<{ job_id: string; case_id: string; stage: string }>("/api/match", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Poll a job by ID. Returns null if network blip; throws if 404. */
export async function pollJob(
  jobId: string,
): Promise<{ stage: string; case_id: string; result?: MatchResponse; error?: string }> {
  return request(`/api/jobs/${jobId}`);
}

/* ---------- Attorney Roster ---------- */

export async function fetchAttorneys(params?: {
  jurisdiction?: string;
  specialization?: string;
  availability?: string;
}): Promise<AttorneyListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.jurisdiction) searchParams.set("jurisdiction", params.jurisdiction);
  if (params?.specialization)
    searchParams.set("specialization", params.specialization);
  if (params?.availability) searchParams.set("availability", params.availability);

  const qs = searchParams.toString();
  const url = qs ? `/api/attorneys?${qs}` : "/api/attorneys";
  return request<AttorneyListResponse>(url);
}

/* ---------- Fact Refinement ---------- */

export async function refineFacts(
  payload: RefineFactsRequest,
): Promise<RefineFactsResponse> {
  return request<RefineFactsResponse>("/api/refine-facts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------- Leaderboard ---------- */

export async function fetchLeaderboard(params?: {
  domain?: string;
  jurisdiction?: string;
  top_n?: number;
  include_audit?: boolean;
}): Promise<LeaderboardResponse> {
  const searchParams = new URLSearchParams();
  if (params?.domain) searchParams.set("domain", params.domain);
  if (params?.jurisdiction) searchParams.set("jurisdiction", params.jurisdiction);
  if (params?.top_n !== undefined) searchParams.set("top_n", String(params.top_n));
  if (params?.include_audit !== undefined) searchParams.set("include_audit", String(params.include_audit));

  const qs = searchParams.toString();
  const url = qs ? `/api/leaderboard?${qs}` : "/api/leaderboard";
  return request<LeaderboardResponse>(url);
}

/* ---------- Attorney Onboarding ---------- */

export async function registerAttorney(
  data: AttorneyRegisterRequest,
): Promise<AttorneyLoginResponse> {
  return request<AttorneyLoginResponse>("/api/attorney/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginAttorney(
  email: string,
  password: string,
): Promise<AttorneyLoginResponse> {
  return request<AttorneyLoginResponse>("/api/attorney/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getAttorneyProfile(
  token: string,
): Promise<AttorneyProfile> {
  return request<AttorneyProfile>("/api/attorney/profile", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getAttorneyLeads(
  token: string,
): Promise<LeadSummary[]> {
  return request<LeadSummary[]>("/api/attorney/leads", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function respondToLead(
  token: string,
  leadId: string,
  action: "accept" | "decline",
): Promise<void> {
  await request<void>(`/api/attorney/leads/${leadId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action }),
  });
}

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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function updateAttorneyPreferences(
  token: string,
  prefs: CasePreferences
): Promise<AttorneyProfile> {
  return request<AttorneyProfile>("/api/attorney/preferences", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
}

export async function clearAttorneyPreferences(token: string): Promise<AttorneyProfile> {
  return request<AttorneyProfile>("/api/attorney/preferences", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function lookupCase(
  query: string,
  intakeCaseId?: string,
): Promise<CaseLookupResponse> {
  return request<CaseLookupResponse>("/api/case-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, intake_case_id: intakeCaseId ?? null }),
  });
}

