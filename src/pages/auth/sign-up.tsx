import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthLayout } from "@/components/auth/auth-layout"
import { FormField } from "@/components/form/form-field"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { AccountCreatedButLoginFailedError, useAuth } from "@/lib/auth/context"
import { validateEmail, validateNewPassword } from "@/lib/validation"

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

export function SignUp() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const emailError = validateEmail(email)
    const passwordError = validateNewPassword(password)
    const confirmError =
      password !== confirmPassword ? "Passwords don't match." : undefined
    setFieldErrors({ email: emailError, password: passwordError, confirmPassword: confirmError })
    if (emailError || passwordError || confirmError) return

    setSubmitting(true)
    try {
      await register(email, password)
      navigate("/app", { replace: true })
    } catch (error) {
      if (error instanceof AccountCreatedButLoginFailedError) {
        navigate("/signin", {
          replace: true,
          state: { justRegistered: true },
        })
        return
      }
      if (error instanceof ApiError) {
        if (error.fieldErrors) {
          setFieldErrors({
            email: error.fieldErrors.email?.[0],
            password: error.fieldErrors.password?.[0],
          })
        }
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
      title="Create your account"
      description="Create a FraudDetect workspace for your organization."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-accent underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={!fieldErrors.password ? "At least 8 characters." : undefined}
          disabled={submitting}
        />

        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          disabled={submitting}
        />

        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? <Spinner /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  )
}
