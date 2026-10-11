import { Building2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { Logo } from "@/components/layout/logo"
import { FormField } from "@/components/form/form-field"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingState, Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { useAuth } from "@/lib/auth/context"

/**
 * Not one of the endpoints the product spec calls out explicitly, but
 * POST /tenants is a real, already-implemented backend endpoint, and
 * without it a freshly registered user has no way to reach any tenant-
 * scoped page at all (every one of them 400s with "tenant context
 * required"). This is the minimal real bridge between signup and the rest
 * of the app — see docs/architecture.md.
 */
export function Onboarding() {
  const { status, createTenant } = useAuth()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === "ready") return <Navigate to="/app/overview" replace />
  if (status === "loading") return <LoadingState label="Loading your workspace…" />
  if (status !== "needs-tenant") return <Navigate to="/app" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Organization name is required.")
      return
    }
    setSubmitting(true)
    try {
      await createTenant(name.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-panel border border-line bg-panel p-8 shadow-panel">
          <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-panel-raised">
            <Building2 size={18} className="text-accent" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">Create your organization</h1>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            Your account isn't attached to an organization yet. Create one to continue —
            you'll be its owner.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField
              label="Organization name"
              autoComplete="organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder="Acme Retail"
            />

            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? <Spinner /> : null}
              {submitting ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
