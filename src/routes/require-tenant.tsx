import { AlertTriangle } from "lucide-react"
import { Navigate, Outlet } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/spinner"
import { useAuth } from "@/lib/auth/context"

/** Nested inside RequireAuth: gates the main app shell on tenant resolution. */
export function RequireTenant() {
  const { status } = useAuth()

  if (status === "loading") {
    return <LoadingState label="Loading your workspace…" />
  }

  if (status === "needs-tenant") {
    return <Navigate to="/app/onboarding" replace />
  }

  if (status === "tenant-ambiguous") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <Alert variant="warning" title="Multiple organizations found">
          Your account belongs to more than one organization, and switching between them
          isn't supported in this interface yet. Contact support to resolve which
          organization your account should use.
        </Alert>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle size={28} className="text-danger" aria-hidden="true" />
        <p className="text-base font-semibold text-fg">Couldn't load your workspace</p>
        <p className="text-[13px] text-fg-muted">
          Something went wrong reaching the platform API. Try reloading the page.
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }

  return <Outlet />
}
