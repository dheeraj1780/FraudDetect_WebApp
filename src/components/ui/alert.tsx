import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type AlertVariant = "error" | "success" | "info" | "warning"

const VARIANT_STYLES: Record<AlertVariant, { container: string; icon: typeof Info }> = {
  error: { container: "border-danger/30 bg-danger/8 [&_svg]:text-danger", icon: XCircle },
  success: { container: "border-ok/30 bg-ok/8 [&_svg]:text-ok", icon: CheckCircle2 },
  info: { container: "border-info/30 bg-info/8 [&_svg]:text-info", icon: Info },
  warning: { container: "border-warn/30 bg-warn/8 [&_svg]:text-warn", icon: AlertTriangle },
}

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  className?: string
}

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const { container, icon: Icon } = VARIANT_STYLES[variant]
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-panel border px-4 py-3 text-[13px]", container, className)}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        <div className="text-fg-muted">{children}</div>
      </div>
    </div>
  )
}
