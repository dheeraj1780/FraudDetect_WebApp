import { useSearchParams } from "react-router-dom"
import type { EnvironmentName } from "@/lib/api/types"
import type { Recommendation } from "@/lib/fraud/vocabulary"

export type RiskBandFilter = "" | "LOW" | "MEDIUM" | "HIGH"
export type EnvironmentFilter = "" | EnvironmentName
export type RecommendationFilter = "" | Recommendation

const RISK_BANDS: readonly RiskBandFilter[] = ["LOW", "MEDIUM", "HIGH"]
const ENVIRONMENTS: readonly EnvironmentFilter[] = ["sandbox", "live"]
const RECOMMENDATIONS: readonly RecommendationFilter[] = ["PROCEED", "STEP_UP", "REVIEW", "BLOCK"]

function readEnum<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : ""
}

export interface AssessmentListFilters {
  environment: EnvironmentFilter
  riskBand: RiskBandFilter
  recommendation: RecommendationFilter
  /** Raw `datetime-local` input value (no timezone) — never the ISO string sent to the API. */
  createdAfter: string
  createdBefore: string
  offset: number
}

/**
 * Assessment list filters and pagination offset, synced into the URL query string — the same
 * established pattern `useSampleMode` already uses for `?sample=1`, applied here per Wave 36 so a
 * filtered/paginated view survives a refresh, is shareable, and responds correctly to browser
 * back/forward. Only ever reads/writes the five filter keys below plus `offset`; `sample` and any
 * other existing query param are left untouched (`new URLSearchParams(params)` copies them as-is).
 *
 * Values read back from the URL are validated against the exact enums the real
 * GET /api/v1/assessments contract accepts (Wave 34B) — an edited-by-hand or stale URL with an
 * unrecognised value is treated as "no filter", never sent to the API as-is and never trusted.
 */
export function useAssessmentListFilters() {
  const [params, setParams] = useSearchParams()

  const filters: AssessmentListFilters = {
    environment: readEnum(params.get("environment"), ENVIRONMENTS),
    riskBand: readEnum(params.get("risk_band"), RISK_BANDS),
    recommendation: readEnum(params.get("recommendation"), RECOMMENDATIONS),
    createdAfter: params.get("created_after") ?? "",
    createdBefore: params.get("created_before") ?? "",
    offset: Math.max(0, Number(params.get("offset")) || 0),
  }

  const FILTER_PARAM: Record<Exclude<keyof AssessmentListFilters, "offset">, string> = {
    environment: "environment",
    riskBand: "risk_band",
    recommendation: "recommendation",
    createdAfter: "created_after",
    createdBefore: "created_before",
  }

  /** Changing any filter always resets pagination to the first page — a filtered view starts over,
   * it never keeps an offset computed against a different result set. */
  function setFilter(key: Exclude<keyof AssessmentListFilters, "offset">, value: string) {
    const copy = new URLSearchParams(params)
    const param = FILTER_PARAM[key]
    if (value) copy.set(param, value)
    else copy.delete(param)
    copy.delete("offset")
    setParams(copy, { replace: true })
  }

  function setOffset(next: number) {
    const copy = new URLSearchParams(params)
    if (next > 0) copy.set("offset", String(next))
    else copy.delete("offset")
    setParams(copy, { replace: true })
  }

  function clearFilters() {
    const copy = new URLSearchParams(params)
    for (const key of ["environment", "risk_band", "recommendation", "created_after", "created_before", "offset"]) {
      copy.delete(key)
    }
    setParams(copy, { replace: true })
  }

  return { filters, setFilter, setOffset, clearFilters }
}
