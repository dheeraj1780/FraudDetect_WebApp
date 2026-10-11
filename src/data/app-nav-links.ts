import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Code2,
  FlaskConical,
  FolderSearch,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Radar,
  Rocket,
  Scale,
  ScrollText,
  Settings,
} from "lucide-react"

export interface AppNavLink {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  /**
   * Set when the page exists but the platform API has no backing capability yet. The page
   * explains that plainly; the sidebar tags it so nobody expects live data behind it.
   */
  soon?: boolean
}

export interface AppNavGroup {
  heading: string
  links: AppNavLink[]
}

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    heading: "Overview",
    links: [
      { label: "Dashboard", to: "/app/overview", icon: LayoutDashboard },
      { label: "Analytics", to: "/app/analytics", icon: BarChart3, soon: true },
    ],
  },
  {
    heading: "Detection",
    links: [
      { label: "Assessments", to: "/app/assessments", icon: Activity },
      { label: "Transactions", to: "/app/transactions", icon: ArrowLeftRight, soon: true },
      { label: "Signals", to: "/app/signals", icon: Radar },
      { label: "Rules", to: "/app/rules", icon: ListChecks },
    ],
  },
  {
    heading: "Investigation",
    links: [
      { label: "Cases", to: "/app/cases", icon: FolderSearch, soon: true },
      { label: "Decision Trace", to: "/app/decision-trace", icon: GitBranch },
    ],
  },
  {
    // Wave 32A found this capability real, PostgreSQL-verified (Waves 28-31), and reachable only by
    // direct URL -- undiscoverable from inside the product. Wave 32B's own canonical recommendation:
    // group API + the sandbox collector demo together, so the one real integration surface this
    // product has is actually findable. Neither link is "soon" -- both are real today.
    heading: "Developer",
    links: [
      { label: "API", to: "/app/api", icon: Code2 },
      { label: "Sandbox / Collector", to: "/sandbox/collector", icon: FlaskConical },
    ],
  },
  {
    heading: "Configuration",
    links: [
      { label: "Policies", to: "/app/policies", icon: Scale },
      { label: "Credentials", to: "/app/credentials", icon: KeyRound },
      { label: "LIVE access", to: "/app/live-access", icon: Rocket },
      { label: "Audit log", to: "/app/audit-logs", icon: ScrollText },
      { label: "Settings", to: "/app/settings", icon: Settings },
    ],
  },
]

/** Flat list, used for the mobile drawer and title lookups. */
export const APP_NAV_LINKS: AppNavLink[] = APP_NAV_GROUPS.flatMap((group) => group.links)
