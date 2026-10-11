import { CircleSlash } from "lucide-react"
import { AssessmentStatusBadge } from "@/components/fd/risk-badge"
import { Spinner } from "@/components/ui/spinner"

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
}

interface LifecycleStateProps {
  assessmentId: string
  environment: string
  submittedAt: string
}

/**
 * A PROCESSING assessment has no decision yet — this deliberately does NOT reuse
 * AssessmentCard/DecisionTrace (which assume a completed result exists) and does not show a
 * fabricated timer, progress percentage, score, band or recommendation. The caller is expected to
 * refetch (e.g. by navigating back) rather than this view polling on its own.
 */
export function AssessmentProcessingState({ assessmentId, environment, submittedAt }: LifecycleStateProps) {
  return (
    <section
      aria-label="Assessment summary"
      className="flex flex-col items-center gap-3 rounded-panel border border-line bg-panel px-6 py-10 text-center shadow-panel"
    >
      <Spinner size={22} className="text-accent" />
      <AssessmentStatusBadge status="processing" />
      <p className="max-w-md text-[13px] text-fg-muted">
        This assessment is still being evaluated. No score, risk band or recommendation exists yet —
        none is shown here rather than guessed at.
      </p>
      <dl className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-fg-subtle">Submitted</dt>
          <dd className="text-fg-muted">{formatTimestamp(submittedAt)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-subtle">Environment</dt>
          <dd className="capitalize text-fg-muted">{environment}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-subtle">Assessment</dt>
          <dd className="break-all font-mono text-fg-muted">{assessmentId}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * A FAILED assessment never produced a result — no fraud decision was made. `failure_reason` is
 * an internal field the API never returns here, so there is nothing more specific to show; this
 * deliberately does not speculate about why it failed.
 */
export function AssessmentFailedState({ assessmentId, environment, submittedAt }: LifecycleStateProps) {
  return (
    <section
      aria-label="Assessment summary"
      className="flex flex-col items-center gap-3 rounded-panel border border-warn/30 bg-warn/5 px-6 py-10 text-center shadow-panel"
    >
      <CircleSlash size={22} className="text-warn" aria-hidden="true" />
      <AssessmentStatusBadge status="failed" />
      <p className="max-w-md text-[13px] text-fg-muted">
        No assessment was performed for this request. There is no score, risk band or recommendation
        to show, and no fraud decision was made.
      </p>
      <dl className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-fg-subtle">Submitted</dt>
          <dd className="text-fg-muted">{formatTimestamp(submittedAt)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-subtle">Environment</dt>
          <dd className="capitalize text-fg-muted">{environment}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-subtle">Assessment</dt>
          <dd className="break-all font-mono text-fg-muted">{assessmentId}</dd>
        </div>
      </dl>
    </section>
  )
}
