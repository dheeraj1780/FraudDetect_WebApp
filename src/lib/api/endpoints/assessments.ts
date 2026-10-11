import { apiFetch } from "@/lib/api/client"
import type { AssessmentDetailOut, AssessmentListOut, EnvironmentName } from "@/lib/api/types"

/**
 * Query parameters for GET /assessments, matching the backend contract exactly
 * (fraud-platform-api/app/api/v1/assessments.py). `environment` is a label/filter here, never a
 * security boundary — tenant scoping always comes from the session, server-side.
 */
export interface AssessmentListParams {
  environment?: EnvironmentName
  risk_band?: "LOW" | "MEDIUM" | "HIGH"
  recommendation?: "PROCEED" | "STEP_UP" | "REVIEW" | "BLOCK"
  /** Inclusive, ISO-8601. */
  created_after?: string
  /** Exclusive, ISO-8601. */
  created_before?: string
  /** 1–100; the backend default is 20. */
  limit?: number
  offset?: number
}

function toQueryString(params: AssessmentListParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

export const assessmentsApi = {
  list: (params: AssessmentListParams = {}) =>
    apiFetch<AssessmentListOut>(`/assessments${toQueryString(params)}`),

  get: (assessmentId: string) => apiFetch<AssessmentDetailOut>(`/assessments/${assessmentId}`),
}
