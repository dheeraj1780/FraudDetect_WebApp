import { useId } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { APP_NAV_GROUPS } from "@/data/app-nav-links"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const uid = useId()
  return (
    <nav aria-label="Application" className="flex flex-col gap-5">
      {APP_NAV_GROUPS.map((group) => (
        <div key={group.heading} role="group" aria-labelledby={`${uid}-${group.heading}`} className="flex flex-col gap-0.5">
          <p
            id={`${uid}-${group.heading}`}
            className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle"
          >
            {group.heading}
          </p>
          {group.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-2.5 rounded-control px-3 py-1.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                    : "text-fg-muted hover:bg-panel-hover hover:text-fg",
                )
              }
            >
              <link.icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
              <span className="flex-1">{link.label}</span>
              {link.soon ? (
                <span className="rounded-control border border-line-strong px-1 py-px text-[9.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                  Soon
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
