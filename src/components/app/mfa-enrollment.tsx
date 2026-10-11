import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/errors"
import { authApi } from "@/lib/api/endpoints/auth"

const INPUT = "h-10 rounded-control border border-line bg-panel px-3 text-sm text-fg"

/**
 * Wave 46: tenant-user TOTP enrollment. The QR code is the server's SVG rendered as an <img> data
 * URI (never injected as markup); the secret and the recovery codes are shown once and kept only in
 * this component's memory.
 */
export function MfaEnrollment({ onDone }: { onDone: () => void }) {
  const [enrollment, setEnrollment] = useState<{ qr_svg: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (codes) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="warning" title="Save your recovery codes. They are shown only once">
          If you lose your phone, each code lets you sign in once. Write them down or store them somewhere safe, not on the same phone.
        </Alert>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Recovery codes">
          {codes.map((c) => (
            <li key={c} className="rounded-control border border-line px-2 py-1 text-fg">
              {c}
            </li>
          ))}
        </ul>
        <div>
          <Button
            onClick={() => {
              setCodes(null)
              onDone()
            }}
          >
            I have saved them
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {!enrollment ? (
        <div>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setError(null)
              try {
                const started = await authApi.startMfaEnrollment()
                setEnrollment({ qr_svg: started.qr_svg, secret: started.secret })
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Could not start setup.")
              } finally {
                setPending(false)
              }
            }}
          >
            Set up two-factor sign-in
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setPending(true)
            setError(null)
            try {
              const confirmed = await authApi.confirmMfaEnrollment(code.trim())
              setEnrollment(null)
              setCodes(confirmed.recovery_codes)
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
            className="h-48 w-48 rounded-control bg-white p-2"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr_svg)}`}
          />
          <p className="text-[13px] text-fg-muted">
            Can&apos;t scan? Enter this key manually: <span className="break-all font-mono text-fg">{enrollment.secret}</span>
          </p>
          <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
            6-digit code from the app
            <input className={INPUT} inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div>
            <Button type="submit" disabled={pending || code.trim().length < 6}>
              Verify and turn on
            </Button>
          </div>
        </form>
      )}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  )
}
