import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState, type ReactNode } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ApiError } from "@/lib/api/errors"
import { isFreshAuthError, operatorApi } from "@/lib/operator/api"

/**
 * Sensitive operator actions need a TOTP verification within the API's fresh-authentication window.
 * `run(action)` performs the action; if the API answers FreshAuthenticationRequiredError, it asks
 * for a current authenticator code, re-authenticates, and retries the action once. The API is the
 * only judge of freshness -- the UI never guesses whether the window is still open.
 */
export function useFreshAuth(): { run: <T>(action: () => Promise<T>) => Promise<T>; dialog: ReactNode } {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const resolver = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null)

  const run = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action()
    } catch (err) {
      if (!isFreshAuthError(err)) throw err
      await new Promise<void>((resolve, reject) => {
        resolver.current = { resolve, reject }
        setCode("")
        setError(null)
        setOpen(true)
      })
      return await action()
    }
  }

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) {
          setOpen(false)
          resolver.current?.reject(new ApiError(401, "Verification cancelled."))
          resolver.current = null
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Confirm it&apos;s you</DialogTitle>
        <DialogDescription>This action needs a fresh code from your authenticator app.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setPending(true)
            setError(null)
            try {
              await operatorApi.reauthenticate(code.trim())
              await queryClient.invalidateQueries({ queryKey: ["operator", "me"] })
              setOpen(false)
              resolver.current?.resolve()
              resolver.current = null
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Verification failed.")
            } finally {
              setPending(false)
            }
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
            Authenticator code
            <input
              className="h-9 rounded-control border border-line bg-panel px-3 font-mono text-sm text-fg"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div>
            <Button type="submit" disabled={pending || code.trim().length < 6}>
              Verify
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  return { run, dialog }
}
