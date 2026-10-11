import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { MfaEnrollment } from "@/components/app/mfa-enrollment"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { authApi } from "@/lib/api/endpoints/auth"
import { useAuth } from "@/lib/auth/context"

const INPUT = "h-10 rounded-control border border-line bg-panel px-3 text-sm text-fg"

/**
 * Wave 46: the step between password sign-in and the app. Either the session must pass the user's
 * MFA challenge, or (TENANT_MFA_POLICY=required) the user must enroll first. The API enforces both;
 * this page only offers the way through.
 */
export function MfaPage() {
  const { status, user, refreshSession, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/app"
  const [code, setCode] = useState("")
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (status === "loading") return <LoadingState label="Checking your session…" />
  if (status === "signed-out") return <Navigate to="/signin" replace />
  if (status !== "mfa-required" || !user) return <Navigate to={redirectTo} replace />

  const finish = async () => {
    await refreshSession()
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-panel border border-line bg-panel p-6">
        {user.mfa_state === "challenge_required" ? (
          <>
            <h1 className="text-lg font-semibold text-fg">Two-factor verification</h1>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault()
                setPending(true)
                setError(null)
                try {
                  await authApi.mfaChallenge(useRecovery ? { recovery_code: code.trim() } : { code: code.trim() })
                  await finish()
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Verification failed.")
                } finally {
                  setCode("")
                  setPending(false)
                }
              }}
            >
              <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
                {useRecovery ? "Recovery code" : "Authenticator code"}
                <input
                  className={INPUT}
                  autoComplete="one-time-code"
                  inputMode={useRecovery ? "text" : "numeric"}
                  maxLength={useRecovery ? 32 : 10}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              {error ? <Alert variant="error">{error}</Alert> : null}
              <Button type="submit" disabled={pending || code.trim().length < 6}>
                Verify
              </Button>
              <button
                type="button"
                className="text-left text-[13px] text-accent underline-offset-2 hover:underline"
                onClick={() => setUseRecovery((v) => !v)}
              >
                {useRecovery ? "Use an authenticator code instead" : "Use a recovery code instead"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-fg">Set up two-factor authentication</h1>
            <p className="mt-1 text-[13px] text-fg-muted">Your organization requires an authenticator app before you continue.</p>
            <div className="mt-4">
              <MfaEnrollment onDone={() => void finish()} />
            </div>
          </>
        )}
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
