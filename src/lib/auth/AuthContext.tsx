import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import { setUnauthorizedHandler } from "@/lib/api/client"
import { authApi } from "@/lib/api/endpoints/auth"
import { tenantsApi } from "@/lib/api/endpoints/tenants"
import { AccountCreatedButLoginFailedError, AuthContext, type AuthContextValue, type AuthStatus } from "@/lib/auth/context"
import { classifyTenantError } from "@/lib/auth/tenantError"
import { queryKeys } from "@/lib/query/keys"
import { clearSession, hasSignedInHint, setSignedInHint, setTenantId } from "@/lib/auth/session"

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [hasSession, setHasSession] = useState(() => hasSignedInHint())

  const forceSignOut = useCallback(() => {
    clearSession()
    setHasSession(false)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      forceSignOut()
      navigate("/signin", { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [forceSignOut, navigate])

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled: hasSession,
  })

  // Wave 46: until the session has passed MFA (or, under TENANT_MFA_POLICY=required, the user has
  // enrolled), every tenant route answers 403 -- so tenant data isn't even requested.
  const mfaBlocked =
    meQuery.data !== undefined &&
    (meQuery.data.mfa_state === "challenge_required" ||
      (meQuery.data.tenant_mfa_policy === "required" && meQuery.data.mfa_state === "not_enrolled"))

  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant,
    queryFn: tenantsApi.current,
    enabled: hasSession && meQuery.isSuccess && !mfaBlocked,
    retry: false,
  })

  useEffect(() => {
    if (tenantQuery.data) setTenantId(tenantQuery.data.id)
  }, [tenantQuery.data])

  const status: AuthStatus = useMemo(() => {
    if (!hasSession) return "signed-out"
    if (meQuery.isPending) return "loading"
    if (meQuery.isError) {
      // A 401 here already ran the unauthorized handler above, which clears
      // the stored token and flips hasSession to false — so by the time we
      // get here, meQuery.isError only means a non-401 failure (network
      // outage, 5xx, CORS): the session itself may still be valid, so this
      // must not look like "signed out." Retry, not resend credentials.
      return "error"
    }
    if (mfaBlocked) return "mfa-required"
    if (tenantQuery.isPending) return "loading"
    if (tenantQuery.isError) {
      const kind = classifyTenantError(tenantQuery.error)
      if (kind === "no-tenant") return "needs-tenant"
      if (kind === "ambiguous") return "tenant-ambiguous"
      return "error"
    }
    return "ready"
  }, [hasSession, meQuery.isPending, meQuery.isError, mfaBlocked, tenantQuery.isPending, tenantQuery.isError, tenantQuery.error])

  const login = useCallback(
    async (email: string, password: string) => {
      // The API sets the HttpOnly session cookie; the body carries no token for browser clients.
      await authApi.login({ email, password })
      setSignedInHint()
      setHasSession(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant }),
      ])
    },
    [queryClient],
  )

  const register = useCallback(
    async (email: string, password: string) => {
      await authApi.register({ email, password })
      try {
        await login(email, password)
      } catch {
        throw new AccountCreatedButLoginFailedError()
      }
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      if (hasSession) await authApi.logout()
    } catch {
      // Best-effort: the session is being cleared client-side regardless,
      // so a failed network call here shouldn't block signing the user out.
    }
    forceSignOut()
    navigate("/signin", { replace: true })
  }, [hasSession, forceSignOut, navigate])

  const createTenant = useCallback(
    async (name: string) => {
      await tenantsApi.create({ name })
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenant })
    },
    [queryClient],
  )

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me })
    await queryClient.invalidateQueries({ queryKey: queryKeys.tenant })
  }, [queryClient])

  const value: AuthContextValue = {
    status,
    user: meQuery.data ?? null,
    tenant: tenantQuery.data ?? null,
    login,
    register,
    logout,
    createTenant,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

