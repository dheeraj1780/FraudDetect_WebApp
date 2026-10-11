import { CircleSlash, Repeat } from "lucide-react"
import type { ReactNode } from "react"
import { AssessmentCard } from "@/components/fd/assessment-card"
import { DecisionTrace } from "@/components/fd/decision-trace"
import { EvaluationStateBadge } from "@/components/fd/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardTitle } from "@/components/ui/card"
import type { AssessmentOut } from "@/lib/api/types"
import { parseReasonCode } from "@/lib/fraud/reason"
import { EVALUATION_STATE_INFO, type EvaluationState } from "@/lib/fraud/vocabulary"

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

function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{title}</CardTitle>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

function Unreturned({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] text-fg-muted">
      <CircleSlash size={14} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

interface AssessmentDetailProps {
  assessment: AssessmentOut
  /** Rendered above the header — e.g. the sample-data banner or “pasted response” notice. */
  notice?: ReactNode
  /** Shown in the header next to the ID, e.g. a “Sample data” badge. */
  tag?: ReactNode
  /** The assessment's own environment (sandbox/live) — only known for a real GET /assessments/{id}
   * response (Wave 34B); a pasted/sample response doesn't carry it, so it stays unset there. */
  environment?: string
}

/**
 * Full analyst view of one assessment. Renders only the fields of the real AssessmentOut.
 * Sections the response has no data for (evidence, telemetry, confidence) are shown as
 * explicitly "not returned" rather than left out or filled in.
 */
export function AssessmentDetail({ assessment, notice, tag, environment }: AssessmentDetailProps) {
  const reasons = assessment.reasons.map((r) => parseReasonCode(r.reason_code))
  const state = assessment.evaluation_state
  const stateInfo = state ? EVALUATION_STATE_INFO[state as EvaluationState] : null

  return (
    <div className="flex flex-col gap-5">
      {notice}

      <header className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-wider text-fg-subtle">Assessment</p>
          {tag}
          {assessment.idempotent_replay ? (
            <Badge variant="neutral" title="The original result for this idempotency key was returned; the engine was not re-run.">
              <Repeat size={11} aria-hidden="true" />
              Idempotent replay
            </Badge>
          ) : null}
        </div>
        <h2 className="break-all font-mono text-lg font-semibold text-fg">{assessment.assessment_id}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">Submitted</dt>
            <dd className="text-fg-muted">{formatTimestamp(assessment.submitted_at)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">Completed</dt>
            <dd className="text-fg-muted">{formatTimestamp(assessment.completed_at)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">Environment</dt>
            <dd className="capitalize text-fg-muted">{environment ?? "Not included in the response"}</dd>
          </div>
        </dl>
      </header>

      <AssessmentCard assessment={assessment} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="flagged-heading">
            <h2 id="flagged-heading" className="text-sm font-semibold text-fg">
              Why this assessment was flagged
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">Triggered signals, as reported by the engine.</p>
            {reasons.length > 0 ? (
              <ul className="mt-3 divide-y divide-line rounded-panel border border-line bg-panel">
                {reasons.map((reason) => (
                  <li key={reason.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    {reason.familyLabel ? (
                      <span className="rounded-control border border-line-strong px-1.5 py-px text-[11px] text-fg-muted">
                        {reason.familyLabel}
                      </span>
                    ) : null}
                    <span className="text-sm text-fg">{reason.ruleName ?? reason.summary}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-panel border border-dashed border-line-strong px-4 py-4 text-[13px] text-fg-muted">
                No signals were reported as triggered for this assessment.
              </p>
            )}
          </section>

          <Card>
            <DecisionTrace assessment={assessment} />
          </Card>
        </div>

        <aside aria-label="Assessment context" className="flex flex-col gap-4">
          <SidePanel title="Evaluation state">
            <EvaluationStateBadge state={state} />
            <p className="mt-2 text-[13px] text-fg-muted">
              {stateInfo ? stateInfo.description : "Not reported for this assessment."}
            </p>
            <p className="mt-2 text-xs text-fg-subtle">A coverage fact — not a risk or confidence measure.</p>
          </SidePanel>

          <SidePanel title="Evidence">
            <Unreturned>Rule evidence isn&apos;t returned by the API in this release.</Unreturned>
          </SidePanel>

          <SidePanel title="Telemetry">
            <Unreturned>Telemetry quality isn&apos;t returned by the API in this release.</Unreturned>
          </SidePanel>

          <SidePanel title="Engine">
            <dl className="flex flex-col gap-2 text-xs">
              {(
                [
                  ["Engine", assessment.engine.engine_version],
                  ["Scoring model", assessment.engine.scoring_model_version],
                  ["Scoring config", assessment.engine.scoring_configuration_version],
                  ["Policy model", assessment.engine.policy_model_version],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd className="break-all text-right font-mono text-fg-muted">{value}</dd>
                </div>
              ))}
            </dl>
          </SidePanel>
        </aside>
      </div>
    </div>
  )
}
