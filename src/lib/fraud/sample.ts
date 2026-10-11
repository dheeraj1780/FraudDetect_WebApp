import type { AssessmentOut } from "@/lib/api/types"
import { SEVERITY_ORDER, type Recommendation, type Severity } from "@/lib/fraud/vocabulary"

/**
 * SAMPLE DATA ONLY. Everything here is generated locally and deterministically so the
 * dashboard and analytics layouts can be previewed. It is never mixed with API data:
 * every surface that shows it renders <SampleDataBanner /> and a "Sample" badge, ids are
 * prefixed `sample-`, and the switch that reveals it is opt-in (URL `?sample=1`).
 * Reason codes are real rule codes; scores, counts and timings are invented.
 */

export const SAMPLE_ENGINE = {
  engine_version: "sample",
  scoring_model_version: "sample",
  scoring_configuration_version: "sample",
  policy_model_version: "sample",
} as const

const HOUR = 3_600_000

function makeAssessment(
  id: string,
  hoursAgo: number,
  score: number,
  band: Severity,
  recommendation: Recommendation,
  reasons: string[],
  evaluation_state: AssessmentOut["evaluation_state"] = "EVALUATED",
  base = Date.now(),
): AssessmentOut {
  const submitted = new Date(base - hoursAgo * HOUR)
  return {
    assessment_id: id,
    status: "completed",
    submitted_at: submitted.toISOString(),
    completed_at: new Date(submitted.getTime() + 180).toISOString(),
    risk_score: score,
    risk_band: band,
    policy: {
      status: "EXECUTED",
      recommendation,
      policy_id: "sample-policy",
      policy_version: "1",
    },
    reasons: reasons.map((reason_code) => ({ reason_code })),
    engine: { ...SAMPLE_ENGINE },
    evaluation_state,
    idempotent_replay: false,
  }
}

const R_FIRST_HIGH = "F6_TXN_002_FIRST_HIGH_VALUE"
const R_COUNTRY = "F6_TXN_006_INSTRUMENT_COUNTRY_MISMATCH"
const R_FAILED_LOGINS = "F9_VEL_010_FAILED_LOGINS_EXCEED_THRESHOLD"

export interface SampleDetail {
  id: string
  title: string
  blurb: string
  assessment: AssessmentOut
}

export function sampleDetails(base = Date.now()): SampleDetail[] {
  return [
    {
      id: "sample-high",
      title: "Sample · High risk, manual review",
      blurb: "Three reasons fired; policy recommends manual review.",
      assessment: makeAssessment("sample-a1f3", 2, 78, "HIGH", "REVIEW", [R_FIRST_HIGH, R_COUNTRY, R_FAILED_LOGINS], "EVALUATED", base),
    },
    {
      id: "sample-medium",
      title: "Sample · Medium risk, step-up",
      blurb: "One reason fired and some rules could not be fully evaluated.",
      assessment: makeAssessment("sample-b7c2", 5, 46, "MEDIUM", "STEP_UP", [R_COUNTRY], "PARTIALLY_EVALUATED", base),
    },
    {
      id: "sample-low",
      title: "Sample · Low risk, proceed",
      blurb: "No reasons fired.",
      assessment: makeAssessment("sample-c9d4", 9, 6, "LOW", "PROCEED", [], "EVALUATED", base),
    },
  ]
}

/** Small deterministic PRNG (mulberry32) so the sample set is identical on every render. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const SAMPLE_DAYS = 14

export function sampleAssessments(base = Date.now()): AssessmentOut[] {
  const rand = rng(20260927)
  const out: AssessmentOut[] = []
  for (let i = 0; i < 96; i += 1) {
    const hoursAgo = rand() * SAMPLE_DAYS * 24 * 0.98 + 0.5
    const roll = rand()
    let band: Severity
    let score: number
    let recommendation: Recommendation
    let reasons: string[]
    if (roll < 0.62) {
      band = "LOW"
      score = Math.round(rand() * 30)
      recommendation = "PROCEED"
      reasons = []
    } else if (roll < 0.87) {
      band = "MEDIUM"
      score = 34 + Math.round(rand() * 30)
      recommendation = rand() < 0.7 ? "STEP_UP" : "REVIEW"
      reasons = rand() < 0.6 ? [R_COUNTRY] : [R_FIRST_HIGH]
    } else {
      band = "HIGH"
      score = 67 + Math.round(rand() * 30)
      recommendation = rand() < 0.6 ? "REVIEW" : "BLOCK"
      reasons = [R_FIRST_HIGH, R_COUNTRY].concat(rand() < 0.5 ? [R_FAILED_LOGINS] : [])
    }
    out.push(makeAssessment(`sample-${String(i + 1).padStart(4, "0")}`, hoursAgo, score, band, recommendation, reasons, "EVALUATED", base))
  }
  return out.sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at))
}

export interface SampleSummary {
  total: number
  byBand: Record<Severity, number>
  byRecommendation: Record<Recommendation, number>
  /** Oldest → newest, one entry per day. */
  perDay: { day: string; counts: Record<Severity, number>; total: number }[]
  topRules: { code: string; count: number }[]
}

export function summarize(assessments: AssessmentOut[], base = Date.now()): SampleSummary {
  const byBand = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>
  const byRecommendation: Record<Recommendation, number> = { PROCEED: 0, STEP_UP: 0, REVIEW: 0, BLOCK: 0 }
  const rules = new Map<string, number>()
  const days = Array.from({ length: SAMPLE_DAYS }, (_, i) => {
    const date = new Date(base - (SAMPLE_DAYS - 1 - i) * 24 * HOUR)
    return {
      day: date.toISOString().slice(0, 10),
      counts: Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>,
      total: 0,
    }
  })
  const dayIndex = new Map(days.map((d, i) => [d.day, i]))

  for (const a of assessments) {
    const band = a.risk_band as Severity
    if (band in byBand) byBand[band] += 1
    const rec = a.policy.recommendation as Recommendation | null
    if (rec && rec in byRecommendation) byRecommendation[rec] += 1
    for (const r of a.reasons) rules.set(r.reason_code, (rules.get(r.reason_code) ?? 0) + 1)
    const idx = dayIndex.get(a.submitted_at.slice(0, 10))
    if (idx !== undefined && band in byBand) {
      days[idx].counts[band] += 1
      days[idx].total += 1
    }
  }

  return {
    total: assessments.length,
    byBand,
    byRecommendation,
    perDay: days,
    topRules: [...rules.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
  }
}
