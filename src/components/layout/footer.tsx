import { Link } from "react-router-dom"
import { Container } from "@/components/layout/container"
import { Logo } from "@/components/layout/logo"
import { FOOTER_COLUMNS } from "@/data/landing"

export function Footer() {
  return (
    <footer className="border-t border-line bg-sidebar">
      <Container className="grid gap-12 py-14 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-[13px] leading-relaxed text-fg-muted">
            Real-time fraud detection for payments, accounts and digital transactions. A BrandSecOps security product.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">{column.heading}</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.comingSoon ? (
                    <span aria-disabled="true" className="cursor-not-allowed text-[13px] text-fg-subtle">
                      {link.label} · soon
                    </span>
                  ) : link.href.startsWith("/") ? (
                    <Link to={link.href} className="rounded-control text-[13px] text-fg-muted transition-colors hover:text-fg">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="rounded-control text-[13px] text-fg-muted transition-colors hover:text-fg">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-line">
        <Container className="flex flex-col items-start justify-between gap-2 py-5 sm:flex-row sm:items-center">
          <p className="text-xs text-fg-subtle">© {new Date().getFullYear()} BrandSecOps. FraudDetect is a BrandSecOps product.</p>
          <p className="text-xs text-fg-subtle">Early access · sandbox environment · rule-based, not machine learning.</p>
        </Container>
      </div>
    </footer>
  )
}
