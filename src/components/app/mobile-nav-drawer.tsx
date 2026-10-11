import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/layout/logo"
import { SidebarNav } from "@/components/app/sidebar-nav"

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Uses Radix's Dialog primitive (not the centered `Dialog` in components/ui)
 * purely for its portal + focus-trap + focus-restore behavior, styled as a
 * left-anchored drawer instead of a centered card.
 */
export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-canvas/75 backdrop-blur-[2px] lg:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line-strong bg-sidebar p-4 shadow-overlay focus:outline-none lg:hidden"
        >
          <div className="flex items-center justify-between px-2 py-2">
            <DialogPrimitive.Title asChild>
              <Link to="/app/overview" onClick={() => onOpenChange(false)} aria-label="FraudDetect by BrandSecOps, dashboard">
                <Logo />
              </Link>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="rounded-control p-1.5 text-fg-subtle hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Close navigation"
            >
              <X size={20} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto px-1">
            <SidebarNav onNavigate={() => onOpenChange(false)} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
