import type { AssessmentDetailOut, AssessmentOut } from "@/lib/api/types"

/**
 * Adapts a COMPLETED real `AssessmentDetailOut` (Wave 34B, GET /assessments/{id}) into the exact
 * `AssessmentOut` shape that `AssessmentCard`/`DecisionTrace`/`AssessmentDetail` already render,
 * reusing those components unchanged rather than loosening their types or duplicating their
 * rendering logic. Only ever call this for `status === "completed"` — every field it reads
 * (`policy`, `engine`, `completed_at`) is genuinely non-null only in that state.
 *
 * `idempotent_replay` is always `false`: a GET never replays or re-invokes anything, so the
 * "original result was returned without re-running the engine" fact this flag reports doesn't
 * apply to a read at all.
 */
export function toLegacyCompletedAssessment(detail: AssessmentDetailOut): AssessmentOut {
  if (detail.status !== "completed" || !detail.policy || !detail.engine || detail.completed_at === null) {
    // Structurally unreachable if the backend contract holds (a COMPLETED row always has these,
    // and only a COMPLETED row should ever reach this function), but asserted rather than
    // silently rendering a broken view if it is ever violated.
    throw new Error("toLegacyCompletedAssessment called on a non-completed assessment.")
  }
  return {
    assessment_id: detail.assessment_id,
    status: "completed",
    submitted_at: detail.submitted_at,
    completed_at: detail.completed_at,
    risk_score: detail.risk_score,
    risk_band: detail.risk_band,
    policy: detail.policy,
    reasons: detail.reasons,
    engine: detail.engine,
    evaluation_state: detail.evaluation_state,
    idempotent_replay: false,
  }
}
