import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-control border bg-canvas px-3 text-sm text-fg placeholder:text-fg-subtle",
        "border-line-strong transition-colors focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:bg-panel disabled:text-fg-subtle",
        invalid && "border-danger focus-visible:outline-danger",
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = "Input"
