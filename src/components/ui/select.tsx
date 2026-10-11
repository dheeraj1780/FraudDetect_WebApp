import { ChevronDown } from "lucide-react"
import { forwardRef, useId, type SelectHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
}

/** Native <select> (free keyboard + screen-reader behaviour) with a visible label and the console styling. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, className, id, children, ...props }, ref) => {
  const generated = useId()
  const selectId = id ?? generated
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-9 w-full appearance-none rounded-control border border-line-strong bg-canvas pl-3 pr-8 text-[13px] text-fg",
            "transition-colors hover:border-accent/50 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
      </div>
    </div>
  )
})
Select.displayName = "Select"
