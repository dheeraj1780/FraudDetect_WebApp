import { Navigate, Outlet, useLocation } from "react-router-dom"
import { LoadingState } from "@/components/ui/spinner"
import { useAuth } from "@/lib/auth/context"

/** Only checks that a session exists — tenant resolution is RequireTenant's job. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return <LoadingState label="Checking your session…" />
  }

  if (status === "signed-out") {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  if (status === "mfa-required") {
    return <Navigate to="/mfa" replace state={{ from: location }} />
  }

  return <Outlet />
}
