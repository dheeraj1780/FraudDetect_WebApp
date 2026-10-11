import { FlaskConical, Menu } from "lucide-react"
import { TenantBadge } from "@/components/app/tenant-badge"
import { UserMenu } from "@/components/app/user-menu"

/**
 * Environment context. Wave 45: LIVE credentials exist only after a FraudDetect operator approves LIVE
 * access (the LIVE access page); the bar states that fact rather than offering a switcher that does
 * nothing.
 */
function EnvironmentBadge() {
  return (
    <span
      title="SANDBOX is for testing. To work with real customers, see the LIVE access page."
      className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-warn/30 bg-warn/10 px-2 py-1 text-xs font-medium text-warn"
    >
      <FlaskConical size={12} aria-hidden="true" />
      Sandbox
    </span>
  )
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="inline-flex h-9 w-9 items-center justify-center rounded-control text-fg-muted hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <TenantBadge />
      <EnvironmentBadge />

      <div className="ml-auto flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  )
}
