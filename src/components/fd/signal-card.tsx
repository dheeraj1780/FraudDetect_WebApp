import { Badge } from "@/components/ui/badge"
import type { SignalDescriptor } from "@/data/fraud-detect/signals"

/** One input Fraud Detect accepts or derives. Describes the input only — never a live signal value. */
export function SignalCard({ signal }: { signal: SignalDescriptor }) {
  return (
    <li className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{signal.name}</h3>
        <Badge variant={signal.source === "supplied" ? "neutral" : "accent"} className="shrink-0">
          {signal.source === "supplied" ? "Supplied by you" : "Derived by platform"}
        </Badge>
      </div>
      <p className="text-[13px] text-fg-muted">{signal.summary}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={`${signal.name} fields`}>
        {signal.fields.map((field) => (
          <li key={field} className="rounded-control border border-line px-1.5 py-0.5 text-xs text-fg-muted">
            {field}
          </li>
        ))}
      </ul>
      {signal.note ? <p className="text-xs text-fg-subtle">{signal.note}</p> : null}
      <p className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
        Relevant to
        {signal.families.map((family) => (
          <span key={family} className="rounded-control border border-line-strong px-1.5 py-px font-mono text-[11px] text-fg-muted">
            {family}
          </span>
        ))}
      </p>
    </li>
  )
}
