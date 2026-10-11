import { apiFetch } from "@/lib/api/client"
import type { AnalyticsOut, EnvironmentName } from "@/lib/api/types"

/**
 * Query parameters for GET /analytics/assessments, matching the backend contract exactly
 * (fraud-platform-api/app/api/v1/analytics.py). `environment` is a label/filter here, never a
 * security boundary — tenant scoping always comes from the session, server-side.
 */
export interface AnalyticsParams {
  environment?: EnvironmentName
  /** Inclusive, ISO-8601. Omit to use the backend's own documented 30-day default. */
  created_after?: string
  /** Exclusive, ISO-8601. Omit to use "now". */
  created_before?: string
}

function toQueryString(params: AnalyticsParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

export const analyticsApi = {
  getAssessmentAnalytics: (params: AnalyticsParams = {}) =>
    apiFetch<AnalyticsOut>(`/analytics/assessments${toQueryString(params)}`),
}
