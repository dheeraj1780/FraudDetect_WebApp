import { Eye, KeyRound, ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/layout/logo"

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

const POINTS = [
  { icon: Eye, text: "Explainable risk assessments, with a decision trace" },
  { icon: ShieldCheck, text: "Tenant-isolated, audited, policy-driven decisions" },
  { icon: KeyRound, text: "API-first integration with scoped credentials" },
]

/**
 * Split auth surface: a product statement beside the form on large screens; the form alone
 * (under the lockup) on tablet and phone.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-sidebar p-12 lg:flex">
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
        <Link to="/" aria-label="Fraud Detect by BrandSecOps, home" className="relative w-fit rounded-control">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-fg">
            Detect suspicious activity before it becomes a loss.
          </h2>
          <p className="mt-3 text-sm text-fg-muted">
            Real-time risk assessment for payments, accounts and digital transactions.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[13px] text-fg-muted">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-line-strong bg-panel">
                  <Icon size={14} className="text-accent" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-fg-subtle">A BrandSecOps security product.</p>
      </aside>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex justify-center lg:hidden" aria-label="Fraud Detect by BrandSecOps, home">
            <Logo />
          </Link>

          <div className="rounded-panel border border-line bg-panel p-8 shadow-panel">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
            <p className="mt-1.5 text-[13px] text-fg-muted">{description}</p>

            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-6 text-center text-[13px] text-fg-muted">{footer}</p>
        </div>
      </div>
    </div>
  )
}
