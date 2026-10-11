/**
 * The Fraud Detect vocabulary, taken from the real contract — not invented:
 *  - risk bands: the engine emits LOW | MEDIUM | HIGH (RiskBand in engine_contract.py).
 *    CRITICAL exists in the design system's SEVERITY scale (for UI status use) but the
 *    engine never returns it as a risk band.
 *  - recommendations: PROCEED | STEP_UP | REVIEW | BLOCK (the frozen policy vocabulary).
 *    The old AUTO_APPROVE / MANUAL_REVIEW / DECLINE_RECOMMENDED names are stale.
 */

import type { AssessmentLifecycleStatus } from "@/lib/api/types"

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export const SEVERITY_ORDER: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

export interface SeverityStyle {
  label: string
  /** 1–4 filled bars in the level glyph — the non-colour cue. */
  level: 1 | 2 | 3 | 4
  text: string
  bg: string
  border: string
  bar: string
  /** CSS colour for SVG strokes/fills. */
  color: string
}

export const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  LOW: {
    label: "Low",
    level: 1,
    text: "text-sev-low",
    bg: "bg-sev-low/10",
    border: "border-sev-low/30",
    bar: "bg-sev-low",
    color: "var(--color-sev-low)",
  },
  MEDIUM: {
    label: "Medium",
    level: 2,
    text: "text-sev-medium",
    bg: "bg-sev-medium/10",
    border: "border-sev-medium/30",
    bar: "bg-sev-medium",
    color: "var(--color-sev-medium)",
  },
  HIGH: {
    label: "High",
    level: 3,
    text: "text-sev-high",
    bg: "bg-sev-high/10",
    border: "border-sev-high/30",
    bar: "bg-sev-high",
    color: "var(--color-sev-high)",
  },
  CRITICAL: {
    label: "Critical",
    level: 4,
    text: "text-sev-critical",
    bg: "bg-sev-critical/10",
    border: "border-sev-critical/30",
    bar: "bg-sev-critical",
    color: "var(--color-sev-critical)",
  },
}

/** Narrow an arbitrary API string to a known severity; unknown values stay unknown (never coerced). */
export function asSeverity(value: string | null | undefined): Severity | null {
  return value != null && value in SEVERITY_STYLES ? (value as Severity) : null
}

export type Recommendation = "PROCEED" | "STEP_UP" | "REVIEW" | "BLOCK"

export interface RecommendationStyle {
  label: string
  description: string
  text: string
  bg: string
  border: string
}

export const RECOMMENDATION_STYLES: Record<Recommendation, RecommendationStyle> = {
  PROCEED: {
    label: "Proceed",
    description: "Policy recommends letting the payment continue.",
    text: "text-ok",
    bg: "bg-ok/10",
    border: "border-ok/30",
  },
  STEP_UP: {
    label: "Step-up",
    description: "Policy recommends additional verification before continuing.",
    text: "text-info",
    bg: "bg-info/10",
    border: "border-info/30",
  },
  REVIEW: {
    label: "Manual review",
    description: "Policy recommends routing to a person for review.",
    text: "text-warn",
    bg: "bg-warn/10",
    border: "border-warn/30",
  },
  BLOCK: {
    label: "Block",
    description: "Policy recommends blocking the payment.",
    text: "text-danger",
    bg: "bg-danger/10",
    border: "border-danger/30",
  },
}

export function asRecommendation(value: string | null | undefined): Recommendation | null {
  return value != null && value in RECOMMENDATION_STYLES ? (value as Recommendation) : null
}

export type EvaluationState = "EVALUATED" | "PARTIALLY_EVALUATED" | "NOT_EVALUABLE" | "NO_APPLICABLE_RULES"

/** A coverage fact about how fully the applicable rules could be evaluated — not a risk or confidence measure. */
export const EVALUATION_STATE_INFO: Record<EvaluationState, { label: string; description: string; tone: "ok" | "warn" | "neutral" }> = {
  EVALUATED: {
    label: "Evaluated",
    description: "The applicable rules were evaluated.",
    tone: "ok",
  },
  PARTIALLY_EVALUATED: {
    label: "Partially evaluated",
    description: "Some applicable rules could not be fully evaluated with the data supplied.",
    tone: "warn",
  },
  NOT_EVALUABLE: {
    label: "Not evaluable",
    description:
      "Nothing could be evaluated. A score of 0 here means “nothing could be evaluated”, not “assessed and clean”.",
    tone: "warn",
  },
  NO_APPLICABLE_RULES: {
    label: "No applicable rules",
    description: "No configured rule applied to this assessment.",
    tone: "neutral",
  },
}

/** The assessment's own lifecycle (app/models/assessment.py::AssessmentStatus) — distinct from risk
 * band or evaluation state. PROCESSING and FAILED are real, reportable outcomes, not errors to hide. */
export const ASSESSMENT_STATUS_INFO: Record<
  AssessmentLifecycleStatus,
  { label: string; description: string; tone: "ok" | "warn" | "neutral" }
> = {
  processing: {
    label: "Processing",
    description: "The engine has not finished evaluating this assessment yet. No result exists yet.",
    tone: "neutral",
  },
  completed: {
    label: "Completed",
    description: "The engine produced a result for this assessment.",
    tone: "ok",
  },
  failed: {
    label: "Failed",
    description: "No assessment was performed for this request.",
    tone: "warn",
  },
}

export const POLICY_STATUS_INFO: Record<string, string> = {
  EXECUTED: "A tenant policy was applied to the risk score.",
  NO_POLICY_CONFIGURED: "No active policy exists for this environment, so no recommendation was produced.",
  POLICY_INVALID: "The configured policy was invalid and was not applied.",
  NOT_EXECUTED: "Policy was not executed for this assessment.",
}

/** Per-rule outcomes the Decision Trace can label. Only TRIGGERED is observable in the public response today. */
export type RuleState = "TRIGGERED" | "NOT_TRIGGERED" | "INSUFFICIENT_DATA" | "SHADOW"
export const RULE_STATE_ORDER: RuleState[] = ["TRIGGERED", "NOT_TRIGGERED", "INSUFFICIENT_DATA", "SHADOW"]
