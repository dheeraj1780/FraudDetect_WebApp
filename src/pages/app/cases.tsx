import { Clock, FileText, ListChecks, MessageSquare, Scale, ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/spinner"
import { UnavailableState } from "@/components/ui/states"

const PLANNED_STATES = ["OPEN", "IN_REVIEW", "RESOLVED"]

const PLANNED_PANELS = [
  { icon: FileText, title: "Case ID & assessment", body: "Each case links back to the assessment that raised it." },
  { icon: ShieldAlert, title: "Risk", body: "Risk band, score and policy recommendation at the time." },
  { icon: ListChecks, title: "Triggered rules", body: "The rules that fired, from the decision trace." },
  { icon: Clock, title: "Timeline", body: "Who did what, and when." },
  { icon: MessageSquare, title: "Analyst notes", body: "Free-text notes from the investigation." },
  { icon: Scale, title: "Status & decision", body: "Open, in review or resolved — with the analyst's decision." },
]

export function Cases() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        title="Cases"
        description="Investigation workflow for assessments that need a person's judgement."
        badges={<Badge variant="outline">Planned</Badge>}
      />

      <UnavailableState title="Case management isn't available yet">
        <p>
          The platform API has no case endpoints, so nothing can be opened, assigned, annotated or resolved here. Below
          is the planned layout only — no cases exist and none are stored.
        </p>
      </UnavailableState>

      <section aria-labelledby="planned-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="planned-heading" className="text-sm font-semibold text-fg">
            Planned case layout
          </h2>
          <Badge variant="outline">Not functional</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
          Planned statuses:
          {PLANNED_STATES.map((state) => (
            <span key={state} className="rounded-control border border-dashed border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
              {state}
            </span>
          ))}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANNED_PANELS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-panel border border-dashed border-line-strong bg-panel/50 p-4">
              <Icon size={16} className="text-fg-subtle" aria-hidden="true" />
              <h3 className="mt-2 text-[13px] font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-xs text-fg-muted">{body}</p>
              <div className="mt-3 flex flex-col gap-1.5" aria-hidden="true">
                <Skeleton className="h-2 w-full animate-none opacity-60" />
                <Skeleton className="h-2 w-2/3 animate-none opacity-60" />
              </div>
            </li>
          ))}
        </ul>

        <p className="text-xs text-fg-subtle">
          Until then, use Decision Trace to review why an assessment was flagged.
        </p>
      </section>
    </div>
  )
}
