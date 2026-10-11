import { Building2 } from "lucide-react"
import { useAuth } from "@/lib/auth/context"

export function TenantBadge() {
  const { tenant } = useAuth()

  if (!tenant) return null

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-control border border-line bg-panel px-2.5 py-1">
      <Building2 size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
      <span className="max-w-[9rem] truncate text-[13px] font-medium text-fg sm:max-w-[16rem]" title={tenant.name}>
        {tenant.name}
      </span>
    </div>
  )
}
