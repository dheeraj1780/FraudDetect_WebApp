import { Ban, CheckCircle2, CircleDashed, CircleHelp, Eye, FlaskConical, ShieldCheck, ShieldAlert, XCircle, type LucideIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { AssessmentLifecycleStatus } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import {
  ASSESSMENT_STATUS_INFO,
  asRecommendation,
  asSeverity,
  EVALUATION_STATE_INFO,
  RECOMMENDATION_STYLES,
  SEVERITY_STYLES,
  type EvaluationState,
  type RuleState,
  type Severity,
} from "@/lib/fraud/vocabulary"

const BAR_HEIGHTS = ["h-1", "h-1.5", "h-2", "h-3"]

/** Four rising bars; the number filled encodes severity so it never depends on colour alone. */
export function LevelGlyph({ severity, className }: { severity: Severity; className?: string }) {
  const style = SEVERITY_STYLES[severity]
  return (
    <span aria-hidden="true" className={cn("inline-flex h-3 items-end gap-[2px]", className)}>
      {BAR_HEIGHTS.map((height, i) => (
        <span
          key={height}
          className={cn("w-[3px] rounded-[1px]", height, i < style.level ? style.bar : "bg-line-strong")}
        />
      ))}
    </span>
  )
}

interface SeverityBadgeProps {
  severity: Severity
  className?: string
  /** Show the plain-English word (“High”) instead of the code (“HIGH”). */
  friendly?: boolean
}

/** General LOW/MEDIUM/HIGH/CRITICAL indicator: level glyph + text label + colour. */
export function SeverityBadge({ severity, className, friendly = false }: SeverityBadgeProps) {
  const style = SEVERITY_STYLES[severity]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-semibold tracking-wide",
        style.border,
        style.bg,
        style.text,
        className,
      )}
    >
      <LevelGlyph severity={severity} />
      {friendly ? style.label : severity}
    </span>
  )
}

/** The band an assessment returned. Unknown / null bands are shown honestly, never coerced to LOW. */
export function RiskBadge({ band, className }: { band: string | null; className?: string }) {
  const severity = asSeverity(band)
  if (severity) return <SeverityBadge severity={severity} className={className} />
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-panel-raised px-2 py-0.5 text-xs font-medium text-fg-muted",
        className,
      )}
    >
      <CircleHelp size={12} aria-hidden="true" />
      {band ?? "Not scored"}
    </span>
  )
}

const RECOMMENDATION_ICONS: Record<string, LucideIcon> = {
  PROCEED: CheckCircle2,
  STEP_UP: ShieldCheck,
  REVIEW: Eye,
  BLOCK: Ban,
}

/** The policy layer's recommendation — a policy output, distinct from the risk band. */
export function RecommendationBadge({
  value,
  className,
  size = "sm",
}: {
  value: string | null
  className?: string
  size?: "sm" | "lg"
}) {
  const rec = asRecommendation(value)
  const sizes = size === "lg" ? "gap-2 px-3 py-1.5 text-sm" : "gap-1.5 px-2 py-0.5 text-xs"
  if (!rec) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-control border border-line-strong bg-panel-raised font-medium text-fg-muted",
          sizes,
          className,
        )}
      >
        <CircleDashed size={size === "lg" ? 15 : 12} aria-hidden="true" />
        {value ?? "No recommendation"}
      </span>
    )
  }
  const style = RECOMMENDATION_STYLES[rec]
  const Icon = RECOMMENDATION_ICONS[rec]
  return (
    <span
      title={style.description}
      className={cn(
        "inline-flex items-center rounded-control border font-semibold",
        sizes,
        style.border,
        style.bg,
        style.text,
        className,
      )}
    >
      <Icon size={size === "lg" ? 15 : 12} aria-hidden="true" />
      {style.label}
    </span>
  )
}

export function EvaluationStateBadge({ state, className }: { state: EvaluationState | null; className?: string }) {
  if (!state) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-fg-muted", className)}>
        <CircleHelp size={12} aria-hidden="true" />
        Not reported
      </span>
    )
  }
  const info = EVALUATION_STATE_INFO[state]
  const tone =
    info.tone === "ok"
      ? "border-ok/30 bg-ok/10 text-ok"
      : info.tone === "warn"
        ? "border-warn/30 bg-warn/10 text-warn"
        : "border-line-strong bg-panel-raised text-fg-muted"
  const Icon = info.tone === "ok" ? CheckCircle2 : info.tone === "warn" ? ShieldAlert : CircleDashed
  return (
    <span
      title={info.description}
      className={cn("inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium", tone, className)}
    >
      <Icon size={12} aria-hidden="true" />
      {info.label}
    </span>
  )
}

/** The assessment's own lifecycle — processing / completed / failed. Distinct from risk band, which
 * only ever exists for a completed assessment. */
export function AssessmentStatusBadge({ status, className }: { status: AssessmentLifecycleStatus; className?: string }) {
  const info = ASSESSMENT_STATUS_INFO[status]
  const tone =
    info.tone === "ok"
      ? "border-ok/30 bg-ok/10 text-ok"
      : info.tone === "warn"
        ? "border-warn/30 bg-warn/10 text-warn"
        : "border-line-strong bg-panel-raised text-fg-muted"
  return (
    <span
      title={info.description}
      className={cn("inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium", tone, className)}
    >
      {status === "processing" ? (
        <Spinner size={12} />
      ) : status === "completed" ? (
        <CheckCircle2 size={12} aria-hidden="true" />
      ) : (
        <XCircle size={12} aria-hidden="true" />
      )}
      {info.label}
    </span>
  )
}

const RULE_STATE_INFO: Record<RuleState, { label: string; icon: LucideIcon; classes: string }> = {
  TRIGGERED: { label: "Triggered", icon: ShieldAlert, classes: "border-sev-high/30 bg-sev-high/10 text-sev-high" },
  NOT_TRIGGERED: { label: "Not triggered", icon: CheckCircle2, classes: "border-line-strong bg-panel-raised text-fg-muted" },
  INSUFFICIENT_DATA: { label: "Insufficient data", icon: CircleDashed, classes: "border-warn/30 bg-warn/10 text-warn" },
  SHADOW: { label: "Shadow", icon: FlaskConical, classes: "border-info/30 bg-info/10 text-info" },
}

/** Per-rule outcome. The four states are always distinguishable by label and icon, not just colour. */
export function RuleStateBadge({ state, className }: { state: RuleState; className?: string }) {
  const info = RULE_STATE_INFO[state]
  const Icon = info.icon
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium", info.classes, className)}
    >
      <Icon size={12} aria-hidden="true" />
      {info.label}
    </span>
  )
}

