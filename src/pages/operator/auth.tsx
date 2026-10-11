import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { clearOperatorToken, getOperatorToken, operatorApi, setOperatorToken } from "@/lib/operator/api"
import { useOperatorMe } from "@/lib/operator/context"

const INPUT = "h-10 rounded-control border border-line bg-panel px-3 text-sm text-fg"

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-panel border border-line bg-panel p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Clarion · Operator console</p>
        <h1 className="mt-1 text-lg font-semibold text-fg">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

/** Operator sign-in. A separate realm from tenant sign-in: tenant accounts cannot sign in here. */
export function OperatorSignIn() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <Frame title="Sign in">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          setError(null)
          try {
            const result = await operatorApi.login(email.trim(), password)
            setOperatorToken(result.access_token)
            queryClient.removeQueries({ queryKey: ["operator"] })
            navigate(result.mfa_state === "verified" ? "/operator/requests" : "/operator/mfa", { replace: true })
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Sign-in failed.")
          } finally {
            setPassword("")
            setPending(false)
          }
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
          Email
          <input className={INPUT} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
          Password
          <input className={INPUT} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button type="submit" disabled={pending || !email || !password}>
          Continue
        </Button>
      </form>
    </Frame>
  )
}

/**
 * MFA: first-time TOTP enrollment (QR code rendered as an <img> from the server's SVG -- never
 * injected as markup) with one-time recovery codes, or a challenge with a TOTP / recovery code.
 */
export function OperatorMfa() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useOperatorMe()
  const [enrollment, setEnrollment] = useState<{ qr_svg: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [useRecovery, setUseRecovery] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!getOperatorToken()) return <Navigate to="/operator/signin" replace />
  if (meQuery.isPending) return <LoadingState label="Loading…" />
  if (meQuery.isError) {
    clearOperatorToken()
    return <Navigate to="/operator/signin" replace />
  }

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["operator", "me"] })
    navigate("/operator/requests", { replace: true })
  }

  if (recoveryCodes) {
    return (
      <Frame title="Save your recovery codes">
        <Alert variant="warning" title="Shown only once">
          Each code works once if you lose your authenticator. Store them somewhere safe and offline.
        </Alert>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Recovery codes">
          {recoveryCodes.map((c) => (
            <li key={c} className="rounded-control border border-line px-2 py-1 text-fg">
              {c}
            </li>
          ))}
        </ul>
        <Button
          className="mt-4"
          onClick={() => {
            setRecoveryCodes(null)
            void finish()
          }}
        >
          I have saved them
        </Button>
      </Frame>
    )
  }

  if (meQuery.data.mfa_state === "verified") return <Navigate to="/operator/requests" replace />

  if (meQuery.data.mfa_state === "enrollment_required") {
    return (
      <Frame title="Set up two-factor authentication">
        <p className="text-[13px] text-fg-muted">
          An authenticator app (TOTP) is required for every operator. Nothing in the console works until it is set up.
        </p>
        {!enrollment ? (
          <Button
            className="mt-3"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setError(null)
              try {
                const started = await operatorApi.startEnrollment()
                setEnrollment({ qr_svg: started.qr_svg, secret: started.secret })
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Could not start enrollment.")
              } finally {
                setPending(false)
              }
            }}
          >
            Start setup
          </Button>
        ) : (
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault()
              setPending(true)
              setError(null)
              try {
                const confirmed = await operatorApi.confirmEnrollment(code.trim())
                setEnrollment(null)
                setRecoveryCodes(confirmed.recovery_codes)
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Verification failed.")
              } finally {
                setCode("")
                setPending(false)
              }
            }}
          >
            <img
              alt="QR code to scan with your authenticator app"
              className="mx-auto h-48 w-48 rounded-control bg-white p-2"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr_svg)}`}
            />
            <p className="text-[13px] text-fg-muted">
              Can&apos;t scan? Enter this key manually: <span className="break-all font-mono text-fg">{enrollment.secret}</span>
            </p>
            <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
              Code from your authenticator
              <input className={INPUT} inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <Button type="submit" disabled={pending || code.trim().length < 6}>
              Verify and enable
            </Button>
          </form>
        )}
        {error ? <Alert variant="error" className="mt-3">{error}</Alert> : null}
      </Frame>
    )
  }

  return (
    <Frame title="Two-factor verification">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          setError(null)
          try {
            await operatorApi.challenge(useRecovery ? { recovery_code: code.trim() } : { code: code.trim() })
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
        <button type="button" className="text-left text-[13px] text-accent underline-offset-2 hover:underline" onClick={() => setUseRecovery((v) => !v)}>
          {useRecovery ? "Use an authenticator code instead" : "Use a recovery code instead"}
        </button>
        {useRecovery ? (
          <p className="text-xs text-fg-subtle">A recovery code signs you in but does not count as a fresh verification for sensitive actions.</p>
        ) : null}
      </form>
    </Frame>
  )
}
