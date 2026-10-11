import { useQueryClient } from "@tanstack/react-query"
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { clearOperatorToken, getOperatorToken, operatorApi } from "@/lib/operator/api"
import { hasPermission, OperatorContext, useOperatorMe } from "@/lib/operator/context"

/**
 * The operator console's own layout and guard -- separate from the tenant AppShell. No operator
 * page renders until the API confirms an MFA-verified operator session; a missing, expired or
 * revoked session (401) or an unverified one sends the operator to sign-in / MFA. Navigation is
 * shown according to the operator's EFFECTIVE permissions, but every action is still authorized
 * by the API.
 */
export function OperatorShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useOperatorMe()

  if (!getOperatorToken()) return <Navigate to="/operator/signin" replace />
  if (meQuery.isPending) return <LoadingState label="Checking operator session…" />
  if (meQuery.isError) {
    if (meQuery.error instanceof ApiError && meQuery.error.isUnauthorized) {
      clearOperatorToken()
      return <Navigate to="/operator/signin" replace />
    }
    return <p className="p-6 text-sm text-danger">Could not load the operator session.</p>
  }
  const me = meQuery.data
  if (me.mfa_state !== "verified") return <Navigate to="/operator/mfa" replace />

  const links = [
    { to: "/operator/requests", label: "LIVE requests", show: hasPermission(me, "live_access.review") || hasPermission(me, "tenants.read") || hasPermission(me, "live_access.suspend") },
    { to: "/operator/tenants", label: "LIVE tenants", show: hasPermission(me, "live_access.review") || hasPermission(me, "tenants.read") || hasPermission(me, "live_access.suspend") },
    { to: "/operator/operators", label: "Operators", show: true },
    { to: "/operator/audit", label: "Audit", show: hasPermission(me, "audit.read") },
    { to: "/operator/security", label: "Security", show: true },
  ].filter((l) => l.show)

  return (
    <OperatorContext.Provider value={me}>
      <div className="min-h-screen bg-canvas text-fg">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Clarion · Operator console</span>
              <Badge variant="warning">Internal</Badge>
            </div>
            <nav aria-label="Operator" className="flex flex-wrap gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `rounded-control px-3 py-1.5 text-sm ${isActive ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2 text-[13px] text-fg-muted">
              <span>
                {me.display_name}
                {me.is_supreme ? " · Supreme" : ""}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await operatorApi.logout()
                  } catch {
                    // Even if the server call fails, drop the local session.
                  }
                  clearOperatorToken()
                  queryClient.removeQueries({ queryKey: ["operator"] })
                  navigate("/operator/signin", { replace: true })
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </OperatorContext.Provider>
  )
}
