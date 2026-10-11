/**
 * The FraudDetect vocabulary, taken from the real contract — not invented:
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
    description: "Your policy says: let the payment go through.",
    text: "text-ok",
    bg: "bg-ok/10",
    border: "border-ok/30",
  },
  STEP_UP: {
    label: "Step-up",
    description: "Your policy says: ask the customer to verify first, for example with a one-time code.",
    text: "text-info",
    bg: "bg-info/10",
    border: "border-info/30",
  },
  REVIEW: {
    label: "Manual review",
    description: "Your policy says: have a person on your team look at it before deciding.",
    text: "text-warn",
    bg: "bg-warn/10",
    border: "border-warn/30",
  },
  BLOCK: {
    label: "Block",
    description: "Your policy says: stop the payment.",
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
    label: "All checks ran",
    description: "Every rule that applies to this payment was checked.",
    tone: "ok",
  },
  PARTIALLY_EVALUATED: {
    label: "Some checks skipped",
    description: "Some rules could not run because information was missing, such as the customer's past payments. The score only counts the rules that ran.",
    tone: "warn",
  },
  NOT_EVALUABLE: {
    label: "Could not check",
    description:
      "No rule could run with the information sent. A score of 0 here means nothing was checked, not that the payment is safe.",
    tone: "warn",
  },
  NO_APPLICABLE_RULES: {
    label: "No rules apply",
    description: "None of your rules apply to this kind of payment or event.",
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
    description: "We are still checking this one. The result will appear shortly.",
    tone: "neutral",
  },
  completed: {
    label: "Completed",
    description: "The check is finished and has a result.",
    tone: "ok",
  },
  failed: {
    label: "Failed",
    description: "Something went wrong and this payment was not checked. Nothing was scored.",
    tone: "warn",
  },
}

export const POLICY_STATUS_INFO: Record<string, string> = {
  EXECUTED: "Your policy turned the risk score into a recommendation.",
  NO_POLICY_CONFIGURED: "You have no policy turned on here, so there is no recommendation. Turn one on in Policies.",
  POLICY_INVALID: "Your policy has a problem and could not be used. Check it in Policies.",
  NOT_EXECUTED: "Your policy was not used for this check.",
}

/** Per-rule outcomes the Decision Trace can label. Only TRIGGERED is observable in the public response today. */
export type RuleState = "TRIGGERED" | "NOT_TRIGGERED" | "INSUFFICIENT_DATA" | "SHADOW"
export const RULE_STATE_ORDER: RuleState[] = ["TRIGGERED", "NOT_TRIGGERED", "INSUFFICIENT_DATA", "SHADOW"]
