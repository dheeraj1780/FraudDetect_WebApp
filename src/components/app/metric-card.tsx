import { CircleSlash } from "lucide-react"
import type { ReactNode } from "react"
import { SampleBadge } from "@/components/fd/sample-data"
import { Skeleton } from "@/components/ui/spinner"
import { useCountTo } from "@/hooks/use-count-to"
import { cn } from "@/lib/utils"

export type MetricState =
  | { kind: "value"; value: number; sample?: boolean }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "unavailable" }

interface MetricCardProps {
  label: string
  state: MetricState
  /** Small caption under the value, e.g. "of all assessments". */
  hint?: ReactNode
  /** Tints only the accent line, never the whole card. */
  tone?: "default" | "warn" | "danger" | "info" | "ok"
  className?: string
}

const TONE_BAR: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "bg-line-strong",
  ok: "bg-ok",
  info: "bg-info",
  warn: "bg-warn",
  danger: "bg-danger",
}

function AnimatedNumber({ value }: { value: number }) {
  const shown = useCountTo(value)
  return <>{Math.round(shown).toLocaleString()}</>
}

/**
 * A single headline number. Never renders “0” for a failed or unavailable metric —
 * those get an explicit em dash plus a word, so absence of data is never read as zero.
 */
export function MetricCard({ label, state, hint, tone = "default", className }: MetricCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-panel border border-line bg-panel p-4", className)}>
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-px", TONE_BAR[tone])} />
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</p>
        {state.kind === "value" && state.sample ? <SampleBadge compact /> : null}
      </div>
      <div className="mt-2 min-h-9">
        {state.kind === "value" ? (
          <p className="font-mono text-3xl font-semibold leading-none text-fg">
            <AnimatedNumber value={state.value} />
          </p>
        ) : state.kind === "loading" ? (
          <div role="status" aria-label={`Loading ${label}`}>
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <p className="flex items-center gap-2">
            <span className="font-mono text-3xl font-semibold leading-none text-fg-subtle" aria-hidden="true">
              —
            </span>
            <span className="flex items-center gap-1 text-xs text-fg-muted">
              <CircleSlash size={12} aria-hidden="true" />
              {state.kind === "error" ? "Failed to load" : "Not available"}
            </span>
          </p>
        )}
      </div>
      {hint ? <p className="mt-2 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  )
}
