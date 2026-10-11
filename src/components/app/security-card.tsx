import { useState } from "react"
import { MfaEnrollment } from "@/components/app/mfa-enrollment"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ApiError } from "@/lib/api/errors"
import { authApi } from "@/lib/api/endpoints/auth"
import { useAuth } from "@/lib/auth/context"

const POLICY_TEXT: Record<string, string> = {
  optional: "Two-factor authentication is optional on this deployment.",
  required_for_live: "Two-factor authentication is required for LIVE actions (requesting LIVE access, LIVE credentials, disputes).",
  required: "Two-factor authentication is required for everyone on this deployment.",
}

/** Wave 46: the signed-in user's own MFA. Turning it off needs a current authenticator code. */
export function SecurityCard() {
  const { user, refreshSession } = useAuth()
  const [disableCode, setDisableCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  if (!user) return null
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Two-factor authentication</CardTitle>
        <Badge variant={user.mfa_enabled ? "success" : "outline"}>{user.mfa_enabled ? "On" : "Off"}</Badge>
      </div>
      <CardDescription className="mt-1">{POLICY_TEXT[user.tenant_mfa_policy] ?? ""}</CardDescription>
      {user.mfa_enabled ? (
        <>
          <p className="mt-2 text-[13px] text-fg-muted">Recovery codes remaining: {user.recovery_codes_remaining ?? "—"}</p>
          {user.tenant_mfa_policy !== "required" ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault()
                setPending(true)
                setError(null)
                try {
                  await authApi.disableMfa(disableCode.trim())
                  await refreshSession()
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Could not turn off two-factor authentication.")
                } finally {
                  setDisableCode("")
                  setPending(false)
                }
              }}
            >
              <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
                Current authenticator code
                <input
                  className="h-9 w-40 rounded-control border border-line bg-panel px-3 font-mono text-sm text-fg"
                  inputMode="numeric"
                  maxLength={10}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                />
              </label>
              <Button type="submit" variant="secondary" size="sm" disabled={pending || disableCode.trim().length < 6}>
                Turn off
              </Button>
            </form>
          ) : null}
        </>
      ) : (
        <div className="mt-3">
          <MfaEnrollment onDone={() => void refreshSession()} />
        </div>
      )}
      {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
    </Card>
  )
}
