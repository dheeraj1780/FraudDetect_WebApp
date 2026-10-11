import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, LogOut, UserCircle } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/lib/auth/context"

export function UserMenu() {
  const { user, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-control px-2 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-panel-raised text-accent">
            <UserCircle size={19} aria-hidden="true" />
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{user.email}</span>
          <ChevronDown size={14} className="text-fg-subtle" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[220px] rounded-panel border border-line-strong bg-panel p-1.5 shadow-overlay"
        >
          <div className="truncate px-2.5 py-2 text-xs text-fg-subtle">{user.email}</div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault()
              void handleLogout()
            }}
            disabled={signingOut}
            className="flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-2 text-[13px] text-fg outline-none transition-colors data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger"
          >
            <LogOut size={15} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
