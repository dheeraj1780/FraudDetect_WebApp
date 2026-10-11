import { FlaskConical } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Opt-in switch for previewing layouts with clearly-labelled sample data. Off by default. */
export function SampleToggle({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="inline-flex items-center gap-2 rounded-control border border-line-strong bg-panel-raised px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          enabled ? "bg-warn" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-canvas transition-[left]",
            enabled ? "left-[14px]" : "left-0.5",
          )}
        />
      </span>
      Preview with sample data
    </button>
  )
}

/** Small inline tag for any element that renders sample data. */
export function SampleBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Badge
      variant="warning"
      title="Sample data, not your assessments"
      className={cn("whitespace-nowrap uppercase tracking-wider", compact && "px-1.5 py-px text-[10px]", className)}
    >
      <FlaskConical size={compact ? 10 : 11} aria-hidden="true" />
      {compact ? "Sample" : "Sample data"}
    </Badge>
  )
}

/**
 * Banner shown on every surface that displays sample data. Sample data is opt-in
 * (`?sample=1`), generated locally, and is never presented as a customer's assessments.
 */
export function SampleDataBanner({ className, hideLink = true }: { className?: string; hideLink?: boolean }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.delete("sample")
  const exit = `${location.pathname}${params.size ? `?${params}` : ""}`
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warn/40 bg-warn/8 px-4 py-2.5 text-[13px]",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-fg">
        <FlaskConical size={15} className="shrink-0 text-warn" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Sample data.</strong>{" "}
          <span className="text-fg-muted">
            These are made-up figures so you can see what the page looks like. They are not your assessments.
          </span>
        </span>
      </p>
      {hideLink ? (
        <Link to={exit} className="rounded-control text-[13px] font-medium text-accent underline-offset-2 hover:underline">
          Hide sample data
        </Link>
      ) : null}
    </div>
  )
}
