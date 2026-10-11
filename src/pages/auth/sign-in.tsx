import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AuthLayout } from "@/components/auth/auth-layout"
import { FormField } from "@/components/form/form-field"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { useAuth } from "@/lib/auth/context"
import { validateEmail, validateRequiredPassword } from "@/lib/validation"

interface LocationState {
  from?: { pathname: string }
  justRegistered?: boolean
}

export function SignIn() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const justRegistered = Boolean((location.state as LocationState | null)?.justRegistered)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const emailError = validateEmail(email)
    const passwordError = validateRequiredPassword(password)
    setFieldErrors({ email: emailError, password: passwordError })
    if (emailError || passwordError) return

    setSubmitting(true)
    try {
      await login(email, password)
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/app"
      navigate(redirectTo, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message)
      } else {
        setFormError("Something went wrong. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Sign in to Fraud Detect."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-accent underline-offset-2 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {justRegistered && !formError ? (
          <Alert variant="success">Your account was created. Sign in to continue.</Alert>
        ) : null}
        {formError ? <Alert variant="error">{formError}</Alert> : null}

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          disabled={submitting}
        />

        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          disabled={submitting}
        />

        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? <Spinner /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  )
}
