import { useMemo, type ReactNode } from "react"
import { RiskActivityChart } from "@/components/app/charts"
import { MetricCard } from "@/components/app/metric-card"
import { AssessmentCard } from "@/components/fd/assessment-card"
import { SampleBadge } from "@/components/fd/sample-data"
import { FraudDetectMark } from "@/components/layout/logo"
import { APP_NAV_GROUPS } from "@/data/app-nav-links"
import { useSampleClock } from "@/hooks/use-sample-clock"
import { parseReasonCode } from "@/lib/fraud/reason"
import { sampleAssessments, sampleDetails, summarize } from "@/lib/fraud/sample"

function WindowFrame({ title, children, label }: { title: string; children: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="overflow-hidden rounded-panel border border-line-strong bg-panel shadow-overlay"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel-raised px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
          <FraudDetectMark size={14} />
          <span className="truncate font-mono">{title}</span>
        </span>
        <SampleBadge />
      </div>
      {children}
    </div>
  )
}

/** Hero preview: the real AssessmentCard rendered with one clearly-labelled sample assessment. */
export function HeroPreview() {
  const now = useSampleClock()
  const assessment = useMemo(() => sampleDetails(now)[0].assessment, [now])
  const reasons = assessment.reasons.map((r) => parseReasonCode(r.reason_code))

  return (
    <WindowFrame
      label="Illustrative product preview: a sample high-risk assessment"
      title={`Assessment · ${assessment.assessment_id}`}
    >
      <div className="flex flex-col gap-4 p-4">
        <AssessmentCard assessment={assessment} className="border-line-strong shadow-none" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Why this assessment was flagged</p>
          <ul className="mt-2 divide-y divide-line rounded-panel border border-line bg-canvas/40">
            {reasons.map((reason) => (
              <li key={reason.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="rounded-control border border-line-strong px-1.5 py-px text-[11px] text-fg-muted">
                  {reason.familyLabel}
                </span>
                <span className="text-[13px] text-fg">{reason.ruleName ?? reason.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WindowFrame>
  )
}

/** Dashboard preview built from the same components as the authenticated dashboard, fed sample data. */
export function DashboardPreview() {
  const now = useSampleClock()
  const summary = useMemo(() => summarize(sampleAssessments(now), now), [now])

  return (
    <WindowFrame label="Illustrative dashboard preview with sample data" title="Overview · Sandbox">
      <div className="flex">
        <nav aria-hidden="true" className="hidden w-44 shrink-0 flex-col gap-4 border-r border-line bg-sidebar p-4 md:flex">
          {APP_NAV_GROUPS.slice(0, 3).map((group) => (
            <div key={group.heading} className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{group.heading}</p>
              {group.links.slice(0, 3).map((link, i) => (
                <span
                  key={link.label}
                  className={
                    group.heading === "Overview" && i === 0
                      ? "rounded-control bg-accent-soft px-2 py-1 text-xs font-medium text-accent"
                      : "px-2 py-1 text-xs text-fg-muted"
                  }
                >
                  {link.label}
                </span>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Assessments" state={{ kind: "value", value: summary.total }} />
            <MetricCard label="High risk" tone="danger" state={{ kind: "value", value: summary.byBand.HIGH }} />
            <MetricCard label="Step-up" tone="info" state={{ kind: "value", value: summary.byRecommendation.STEP_UP }} />
            <MetricCard label="Manual review" tone="warn" state={{ kind: "value", value: summary.byRecommendation.REVIEW }} />
          </div>
          <div className="rounded-panel border border-line bg-panel p-4">
            <p className="mb-3 text-sm font-semibold text-fg">Risk activity</p>
            <RiskActivityChart summary={summary} />
          </div>
        </div>
      </div>
    </WindowFrame>
  )
}
