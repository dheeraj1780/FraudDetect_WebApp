import { RecommendationBadge, RiskBadge } from "@/components/fd/risk-badge"
import type { AssessmentOut } from "@/lib/api/types"
import { asSeverity, RECOMMENDATION_STYLES, asRecommendation, SEVERITY_STYLES } from "@/lib/fraud/vocabulary"
import { cn } from "@/lib/utils"

/** 0–100 horizontal meter. The number is real text; the bar is decorative. */
export function ScoreMeter({ score, band, className }: { score: number | null; band: string | null; className?: string }) {
  const severity = asSeverity(band)
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score))
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-strong">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", severity ? SEVERITY_STYLES[severity].bar : "bg-fg-subtle")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * The headline of an assessment: risk band, score and the policy recommendation —
 * kept visibly separate, because the score is NOT the final customer action.
 */
export function AssessmentCard({ assessment, className }: { assessment: AssessmentOut; className?: string }) {
  const rec = asRecommendation(assessment.policy.recommendation)
  return (
    <section
      aria-label="Assessment summary"
      className={cn("rounded-panel border border-line bg-panel shadow-panel", className)}
    >
      <div className="grid gap-px overflow-hidden rounded-panel bg-line md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4 bg-panel p-5">
          <p className="text-[11px] uppercase tracking-wider text-fg-subtle">Risk</p>
          <div className="flex flex-wrap items-center gap-3">
            <RiskBadge band={assessment.risk_band} className="px-2.5 py-1 text-sm" />
            <p className="flex items-baseline gap-1.5">
              <span className="text-sm text-fg-muted">Risk score</span>
              <span className="font-mono text-3xl font-semibold leading-none text-fg">
                {assessment.risk_score === null ? "—" : assessment.risk_score}
              </span>
              {assessment.risk_score !== null ? <span className="text-xs text-fg-subtle">/ 100</span> : null}
            </p>
          </div>
          <ScoreMeter score={assessment.risk_score} band={assessment.risk_band} />
        </div>

        <div className="flex flex-col gap-4 bg-panel p-5">
          <p className="text-[11px] uppercase tracking-wider text-fg-subtle">Policy recommendation</p>
          <RecommendationBadge value={assessment.policy.recommendation} size="lg" className="self-start" />
          <p className="text-[13px] text-fg-muted">
            {rec
              ? RECOMMENDATION_STYLES[rec].description
              : "Your policy gave no recommendation. Don't treat that as “proceed”."}
          </p>
          <p className="text-xs text-fg-subtle">
            The score shows how risky it looks. Your policy turns it into this recommendation.
          </p>
        </div>
      </div>
    </section>
  )
}
