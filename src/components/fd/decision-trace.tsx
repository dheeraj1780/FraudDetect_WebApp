import * as Accordion from "@radix-ui/react-accordion"
import { ChevronDown, CircleSlash } from "lucide-react"
import type { ReactNode } from "react"
import { EvaluationStateBadge, RecommendationBadge, RiskBadge } from "@/components/fd/risk-badge"
import { RuleCard } from "@/components/fd/rule-card"
import type { AssessmentOut } from "@/lib/api/types"
import { parseReasonCode } from "@/lib/fraud/reason"
import { EVALUATION_STATE_INFO, POLICY_STATUS_INFO, type EvaluationState } from "@/lib/fraud/vocabulary"
import { cn } from "@/lib/utils"

type StageId =
  | "input"
  | "normalization"
  | "signals"
  | "rules"
  | "score"
  | "confidence"
  | "policy"
  | "recommendation"

interface Stage {
  id: StageId
  title: string
  question: string
  /** Short value shown in the collapsed row; null = this stage's output isn't returned by the API. */
  summary: ReactNode | null
  detail: ReactNode
}

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

function KeyValues({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-[11px] uppercase tracking-wider text-fg-subtle">{label}</dt>
          <dd className="break-all font-mono text-xs text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function NotReturned({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] text-fg-muted">
      <CircleSlash size={14} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function buildStages(a: AssessmentOut): Stage[] {
  const reasons = a.reasons.map((r) => parseReasonCode(r.reason_code))
  const state = a.evaluation_state
  const stateInfo = state ? EVALUATION_STATE_INFO[state as EvaluationState] : null

  return [
    {
      id: "input",
      title: "Received",
      question: "When did we get it?",
      summary: <span className="text-fg-muted">Received {formatTimestamp(a.submitted_at)}</span>,
      detail: (
        <div className="flex flex-col gap-3">
          <KeyValues items={[["Submitted", a.submitted_at], ["Completed", a.completed_at]]} />
        </div>
      ),
    },
    {
      id: "rules",
      title: "Rules",
      question: "Which warning signs did we find?",
      summary: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-fg">{reasons.length}</span>
          <span className="text-fg-muted">{reasons.length === 1 ? "warning sign" : "warning signs"}</span>
          <EvaluationStateBadge state={state} />
        </span>
      ),
      detail: (
        <div className="flex flex-col gap-4">
          {stateInfo ? (
            <p className="text-[13px] text-fg-muted">
              <span className="font-semibold text-fg">{stateInfo.label}.</span> {stateInfo.description}
            </p>
          ) : (
            <NotReturned>We didn't report how complete this check was.</NotReturned>
          )}
          {reasons.length > 0 ? (
            <ul className="flex flex-col gap-2" aria-label="Triggered rules">
              {reasons.map((reason) => (
                <RuleCard key={reason.code} reason={reason} />
              ))}
            </ul>
          ) : (
            <p className="rounded-panel border border-dashed border-line-strong px-4 py-3 text-[13px] text-fg-muted">
              No warning signs were found.
              {state === "NOT_EVALUABLE"
                ? " But no rule could run, so this does not mean the payment is safe."
                : null}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "score",
      title: "Score",
      question: "How risky does it look?",
      summary: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-fg">{a.risk_score === null ? "None" : a.risk_score}</span>
          <RiskBadge band={a.risk_band} />
        </span>
      ),
      detail: (
        <div className="flex flex-col gap-3">
          <KeyValues
            items={[
              ["Risk score", a.risk_score === null ? "Not scored" : String(a.risk_score)],
              ["Risk level", a.risk_band ?? "Not set up yet"],
              ["Scoring model", a.engine.scoring_model_version],
              ["Scoring configuration", a.engine.scoring_configuration_version],
            ]}
          />
          <p className="text-xs text-fg-subtle">
            Each warning sign adds points. The total is the risk score, from 0 (no warning signs) to 100.
          </p>
        </div>
      ),
    },
    {
      id: "policy",
      title: "Policy",
      question: "Which policy was used?",
      summary: <span className="text-fg">{a.policy.status === "EXECUTED" ? `Version ${a.policy.policy_version ?? "?"}` : "Not used"}</span>,
      detail: (
        <div className="flex flex-col gap-3">
          <KeyValues
            items={[
              ["Status", a.policy.status],
              ["Policy", a.policy.policy_id ?? "None"],
              ["Policy version", a.policy.policy_version ?? "None"],
              ["Policy model", a.engine.policy_model_version],
            ]}
          />
          <p className="text-xs text-fg-subtle">
            {POLICY_STATUS_INFO[a.policy.status] ?? "Policy status as reported."}
          </p>
        </div>
      ),
    },
    {
      id: "recommendation",
      title: "Recommendation",
      question: "What should you do?",
      summary: <RecommendationBadge value={a.policy.recommendation} />,
      detail: (
        <div className="flex flex-col gap-3">
          <RecommendationBadge value={a.policy.recommendation} size="lg" className="self-start" />
          {a.policy.recommendation === null ? (
            <p className="text-xs text-fg-subtle">
              There is no recommendation. Don't treat that as “proceed”. Check the policy step above.
            </p>
          ) : (
            <p className="text-xs text-fg-subtle">
              This is advice from your policy, not a guarantee. Your own system decides what to do with it.
            </p>
          )}
        </div>
      ),
    },
  ]
}

/**
 * The signature FraudDetect view: why did this assessment come out the way it did?
 * Renders exactly what the API returned. Stages whose output the API does not expose say so
 * instead of showing invented values. Each stage is a keyboard-operable disclosure.
 */
export function DecisionTrace({ assessment, className }: { assessment: AssessmentOut; className?: string }) {
  const stages = buildStages(assessment)
  const observed = stages.filter((s) => s.summary !== null).map((s) => s.id)

  return (
    <section aria-labelledby="decision-trace-heading" className={className}>
      <h2 id="decision-trace-heading" className="text-sm font-semibold text-fg">
        Decision trace
      </h2>
      <p className="mt-0.5 text-[13px] text-fg-muted">How we got from your request to the recommendation, step by step.</p>

      <Accordion.Root type="multiple" defaultValue={["rules", "recommendation"]} className="mt-4">
        <ol className="relative flex flex-col">
          {stages.map((stage, index) => {
            const isObserved = observed.includes(stage.id)
            return (
              <li key={stage.id} className="relative pl-9">
                {index < stages.length - 1 ? (
                  <span aria-hidden="true" className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-line-strong" />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[11px]",
                    isObserved
                      ? "border-accent/50 bg-accent-soft text-accent"
                      : "border-dashed border-line-strong bg-canvas text-fg-subtle",
                  )}
                >
                  {index + 1}
                </span>
                <Accordion.Item value={stage.id} className="pb-2">
                  <Accordion.Header asChild>
                    <h3>
                      <Accordion.Trigger className="group flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent">
                        <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                          <span className="text-[13px] font-semibold uppercase tracking-wider text-fg">{stage.title}</span>
                          <span className="text-xs text-fg-subtle">{stage.question}</span>
                        </span>
                        <span className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {stage.summary ?? <span className="text-fg-subtle">Not returned</span>}
                          <ChevronDown
                            size={14}
                            aria-hidden="true"
                            className="text-fg-subtle transition-transform group-data-[state=open]:rotate-180"
                          />
                        </span>
                      </Accordion.Trigger>
                    </h3>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden px-2 pb-2 pt-2 data-[state=closed]:hidden">
                    {stage.detail}
                  </Accordion.Content>
                </Accordion.Item>
              </li>
            )
          })}
        </ol>
      </Accordion.Root>
    </section>
  )
}
