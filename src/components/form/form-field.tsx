import { useId, type ReactNode } from "react"
import { Input, type InputProps } from "@/components/ui/input"

interface FormFieldProps extends InputProps {
  label: string
  error?: string
  hint?: ReactNode
}

export function FormField({ label, error, hint, id, ...inputProps }: FormFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-fg">
        {label}
      </label>
      <Input
        id={fieldId}
        invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
