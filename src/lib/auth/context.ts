import { createContext, useContext } from "react"
import type { MeOut, TenantOut } from "@/lib/api/types"

export type AuthStatus =
  | "loading"
  | "signed-out"
  | "needs-tenant"
  | "tenant-ambiguous"
  | "error"
  /** Wave 46: signed in, but the session must pass (or the user must set up) MFA first. */
  | "mfa-required"
  | "ready"

export interface AuthContextValue {
  status: AuthStatus
  user: MeOut | null
  /** Re-reads the session after an MFA step. */
  refreshSession: () => Promise<void>
  tenant: TenantOut | null
  login: (email: string, password: string) => Promise<void>
  /** Registers the account, then signs in with the same credentials. */
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  createTenant: (name: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}

/**
 * Thrown by `register` when account creation succeeded but the automatic
 * follow-up sign-in didn't — the account is real, so the UI should send the
 * user to /signin instead of implying registration itself failed.
 */
export class AccountCreatedButLoginFailedError extends Error {
  constructor() {
    super("Your account was created, but we couldn't sign you in automatically.")
    this.name = "AccountCreatedButLoginFailedError"
  }
}
