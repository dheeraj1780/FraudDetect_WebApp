import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ChevronRight, Menu, X } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "@/components/layout/container"
import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { SITE_NAV } from "@/data/landing"

/**
 * Two tiers, so the relationship reads at a glance: a thin BrandSecOps strip
 * (BrandSecOps › Security Products › FraudDetect) above the FraudDetect product bar.
 * "Security Products" is a label only — no other products are implied or linked.
 */
export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="hidden border-b border-line bg-sidebar md:block">
        <Container className="flex h-8 items-center gap-1.5 text-[11px] text-fg-subtle">
          <span className="font-semibold uppercase tracking-[0.2em]">BrandSecOps</span>
          <ChevronRight size={11} aria-hidden="true" />
          <span>Security Products</span>
          <ChevronRight size={11} aria-hidden="true" />
          <span className="font-medium text-fg-muted" aria-current="page">
            FraudDetect
          </span>
        </Container>
      </div>

      <Container className="flex h-14 items-center justify-between gap-6">
        <Link to="/" className="rounded-control" aria-label="FraudDetect by BrandSecOps, home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {SITE_NAV.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-control text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-control text-fg-muted hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-canvas/75 backdrop-blur-[2px] lg:hidden" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-[90vw] flex-col gap-1 overflow-y-auto border-l border-line-strong bg-sidebar p-5 shadow-overlay focus:outline-none lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <DialogPrimitive.Title className="text-sm font-semibold text-fg">Menu</DialogPrimitive.Title>
                <DialogPrimitive.Close
                  className="rounded-control p-1.5 text-fg-subtle hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label="Close menu"
                >
                  <X size={20} aria-hidden="true" />
                </DialogPrimitive.Close>
              </div>

              <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                BrandSecOps › FraudDetect
              </p>
              <nav aria-label="Mobile" className="flex flex-col gap-1">
                {SITE_NAV.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-control px-3 py-2.5 text-[15px] font-medium text-fg hover:bg-panel-hover"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                <Button variant="secondary" asChild>
                  <Link to="/signin" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/signup" onClick={() => setOpen(false)}>
                    Get started
                  </Link>
                </Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </Container>
    </header>
  )
}
