import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** "There is genuinely nothing here yet." Never use this for a failed request — see states.tsx. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-panel-raised">
        <Icon size={18} className="text-accent" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-fg-muted">{description}</p> : null}
      {action}
    </div>
  )
}
