import { useState } from "react"
import { Link, Outlet } from "react-router-dom"
import { Logo } from "@/components/layout/logo"
import { SidebarNav } from "@/components/app/sidebar-nav"
import { Topbar } from "@/components/app/topbar"
import { MobileNavDrawer } from "@/components/app/mobile-nav-drawer"

/**
 * The authenticated FraudDetect shell: left sidebar (grouped navigation), top context bar
 * (tenant, environment, account), and the page outlet. Pages own any right-hand contextual panel.
 */
export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#app-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-ink"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-line px-5">
          <Link to="/app/overview" aria-label="FraudDetect by BrandSecOps, dashboard" className="rounded-control">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav />
        </div>
        <p className="border-t border-line px-5 py-3 text-[11px] leading-snug text-fg-subtle">
          Part of the BrandSecOps security platform.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main id="app-main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </div>
  )
}
