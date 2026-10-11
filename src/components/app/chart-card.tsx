import { CircleSlash, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  description?: string
  /** Right-aligned slot in the header: a SampleBadge, a view toggle, a range chip … */
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Titled container for one chart or list. */
export function ChartCard({ title, description, aside, children, className }: ChartCardProps) {
  return (
    <section aria-label={title} className={cn("flex flex-col rounded-panel border border-line bg-panel p-5 shadow-panel", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-fg-subtle">{description}</p> : null}
        </div>
        {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

export type PlaceholderKind = "loading" | "unavailable" | "empty" | "error"

/**
 * In-card stand-in when there is no chart to draw. The four kinds are worded and iconised
 * differently on purpose: “still loading”, “the API can't provide this yet”, “nothing to
 * show yet” and “the request failed” must never look the same — and none of them draws a zero.
 */
export function ChartPlaceholder({ kind, children }: { kind: PlaceholderKind; children?: ReactNode }) {
  if (kind === "loading") {
    return (
      <div role="status" aria-label="Loading chart" className="flex h-44 flex-col justify-end gap-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }
  const Icon = kind === "error" ? TriangleAlert : CircleSlash
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="flex h-44 flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line-strong px-4 text-center"
    >
      <Icon size={18} className={kind === "error" ? "text-danger" : "text-fg-subtle"} aria-hidden="true" />
      <p className="max-w-xs text-[13px] text-fg-muted">{children}</p>
    </div>
  )
}
