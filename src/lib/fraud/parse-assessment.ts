import type { AssessmentOut } from "@/lib/api/types"

export type ParseResult = { ok: true; assessment: AssessmentOut } | { ok: false; error: string }

const EVALUATION_STATES = new Set(["EVALUATED", "PARTIALLY_EVALUATED", "NOT_EVALUABLE", "NO_APPLICABLE_RULES"])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

/**
 * Validates a pasted POST /assessments response against the real AssessmentOut shape.
 * Strict on structure (so a malformed paste is rejected with a reason instead of rendering
 * misleading blanks), tolerant of unknown enum *values* (they render as-is, never coerced).
 * The text is parsed locally and never sent anywhere, stored or logged.
 */
export function parseAssessmentResponse(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "That isn't valid JSON. Paste the response body exactly as returned." }
  }
  if (!isRecord(raw)) return { ok: false, error: "Expected a JSON object (the assessment response)." }

  if (typeof raw.assessment_id !== "string" || raw.assessment_id.length === 0) {
    return { ok: false, error: "Missing assessment_id. This doesn't look like an assessment response." }
  }
  if (raw.status !== "completed") return { ok: false, error: "Expected status “completed”." }
  if (!isIsoDate(raw.submitted_at) || !isIsoDate(raw.completed_at)) {
    return { ok: false, error: "submitted_at and completed_at must be ISO timestamps." }
  }
  const score = raw.risk_score
  if (score !== null && (typeof score !== "number" || !Number.isFinite(score))) {
    return { ok: false, error: "risk_score must be a number or null." }
  }
  if (!isStringOrNull(raw.risk_band)) return { ok: false, error: "risk_band must be a string or null." }

  const policy = raw.policy
  if (
    !isRecord(policy) ||
    typeof policy.status !== "string" ||
    !isStringOrNull(policy.recommendation) ||
    !isStringOrNull(policy.policy_id) ||
    !isStringOrNull(policy.policy_version)
  ) {
    return { ok: false, error: "policy is missing or malformed." }
  }

  const reasons = raw.reasons
  if (!Array.isArray(reasons) || !reasons.every((r) => isRecord(r) && typeof r.reason_code === "string")) {
    return { ok: false, error: "reasons must be a list of { reason_code }." }
  }

  const engine = raw.engine
  if (
    !isRecord(engine) ||
    typeof engine.engine_version !== "string" ||
    typeof engine.scoring_model_version !== "string" ||
    typeof engine.scoring_configuration_version !== "string" ||
    typeof engine.policy_model_version !== "string"
  ) {
    return { ok: false, error: "engine identity is missing or malformed." }
  }

  const state = raw.evaluation_state ?? null
  if (state !== null && (typeof state !== "string" || !EVALUATION_STATES.has(state))) {
    return { ok: false, error: "evaluation_state is not a recognised value." }
  }

  return {
    ok: true,
    assessment: {
      assessment_id: raw.assessment_id,
      status: "completed",
      submitted_at: raw.submitted_at,
      completed_at: raw.completed_at,
      risk_score: score as number | null,
      risk_band: raw.risk_band,
      policy: {
        status: policy.status,
        recommendation: policy.recommendation,
        policy_id: policy.policy_id,
        policy_version: policy.policy_version,
      },
      reasons: reasons.map((r) => ({ reason_code: (r as { reason_code: string }).reason_code })),
      engine: {
        engine_version: engine.engine_version,
        scoring_model_version: engine.scoring_model_version,
        scoring_configuration_version: engine.scoring_configuration_version,
        policy_model_version: engine.policy_model_version,
      },
      evaluation_state: state as AssessmentOut["evaluation_state"],
      idempotent_replay: raw.idempotent_replay === true,
    },
  }
}
