import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        accent: "border-accent/30 bg-accent-soft text-accent",
        neutral: "border-line-strong bg-panel-raised text-fg-muted",
        outline: "border-line-strong text-fg-muted",
        success: "border-ok/30 bg-ok/10 text-ok",
        warning: "border-warn/30 bg-warn/10 text-warn",
        danger: "border-danger/30 bg-danger/10 text-danger",
        info: "border-info/30 bg-info/10 text-info",
      },
    },
    defaultVariants: { variant: "accent" },
  },
)

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}
