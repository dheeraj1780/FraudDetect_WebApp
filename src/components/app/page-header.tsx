import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  /** Small status chips beside the title (e.g. “Sample data”, “Not available yet”). */
  badges?: ReactNode
}

export function PageHeader({ title, description, action, badges }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {badges}
        </div>
        {description ? <p className="mt-1 max-w-2xl text-[13px] text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
