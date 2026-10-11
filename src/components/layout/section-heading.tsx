import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: "left" | "center"
  className?: string
  id?: string
}

export function SectionHeading({ eyebrow, title, description, align = "left", className, id }: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      ) : null}
      <h2 id={id} className="max-w-2xl text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-balance text-[15px] leading-relaxed text-fg-muted">{description}</p>
      ) : null}
    </div>
  )
}
