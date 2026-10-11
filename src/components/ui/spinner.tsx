import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <Loader2
      size={size}
      className={cn("animate-spin motion-reduce:animate-none", className)}
      aria-hidden="true"
    />
  )
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-fg-muted">
      <Spinner size={22} className="text-accent" />
      <p className="text-[13px]">{label}</p>
    </div>
  )
}

/** Skeleton block for content whose shape is known. Decorative; pair with a labelled status region. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-control bg-panel-raised motion-reduce:animate-none", className)}
    />
  )
}
