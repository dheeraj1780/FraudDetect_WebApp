import { CircleSlash, Lock, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/errors"
import { cn } from "@/lib/utils"

/**
 * The four non-happy page states, kept visually and semantically distinct so a
 * failure is never mistaken for "no data":
 *
 *   EmptyState        ui/empty-state.tsx   the request worked; there is nothing yet
 *   ErrorState        this file            the request failed (can retry)
 *   UnauthorizedState this file            the API said 401/403 for this role
 *   UnavailableState  this file            the platform API has no such capability yet
 */

interface StateShellProps {
  icon: LucideIcon
  tone: "danger" | "warning" | "neutral"
  title: string
  children?: ReactNode
  action?: ReactNode
  badge?: string
  role?: "alert" | "status"
  className?: string
}

const TONES: Record<StateShellProps["tone"], string> = {
  danger: "border-danger/30 bg-danger/5 [&_.state-icon]:text-danger",
  warning: "border-warn/30 bg-warn/5 [&_.state-icon]:text-warn",
  neutral: "border-line-strong bg-panel [&_.state-icon]:text-fg-muted",
}

function StateShell({ icon: Icon, tone, title, children, action, badge, role, className }: StateShellProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-3 rounded-panel border px-6 py-10 text-center",
        TONES[tone],
        className,
      )}
    >
      <Icon size={20} className="state-icon" aria-hidden="true" />
      {badge ? <Badge variant="outline">{badge}</Badge> : null}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {children ? <div className="max-w-md text-[13px] text-fg-muted">{children}</div> : null}
      {action}
    </div>
  )
}

interface ErrorStateProps {
  /** What failed, e.g. "credentials". Rendered as "Couldn't load {what}: {message}". */
  what: string
  error: Error
  onRetry?: () => void
}

/** A failed request. 401/403 responses are routed to the unauthorized presentation. */
export function ErrorState({ what, error, onRetry }: ErrorStateProps) {
  const detail = `Couldn't load ${what}: ${error.message}`

  if (error instanceof ApiError && error.status === 403) {
    return <UnauthorizedState detail={detail} />
  }

  return (
    <StateShell
      icon={TriangleAlert}
      tone="danger"
      role="alert"
      title="This data failed to load"
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </Button>
        ) : undefined
      }
    >
      <p>{detail}</p>
      <p className="mt-1 text-fg-subtle">This is a load failure — it does not mean there is no data.</p>
    </StateShell>
  )
}

/** The signed-in role isn't allowed to see this. The API remains the authority; this only explains it. */
export function UnauthorizedState({ detail }: { detail?: string }) {
  return (
    <StateShell icon={Lock} tone="warning" role="alert" title="You don't have access to this">
      <p>{detail ?? "Your role doesn't include permission to view this. Ask an organization owner or admin."}</p>
    </StateShell>
  )
}

interface UnavailableStateProps {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

/** The capability is not exposed by the platform API yet. Says so plainly and invents nothing. */
export function UnavailableState({ title, children, action, className }: UnavailableStateProps) {
  return (
    <StateShell
      icon={CircleSlash}
      tone="neutral"
      role="status"
      badge="Not available yet"
      title={title}
      action={action}
      className={className}
    >
      {children}
    </StateShell>
  )
}
