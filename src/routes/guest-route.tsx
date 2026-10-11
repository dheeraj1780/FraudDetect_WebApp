import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/lib/auth/context"

/** Keeps an already-signed-in user out of /signin and /signup. */
export function GuestRoute() {
  const { status } = useAuth()

  if (status === "loading") return null

  if (status !== "signed-out") {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
