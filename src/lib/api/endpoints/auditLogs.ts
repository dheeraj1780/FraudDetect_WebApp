import { apiFetch } from "@/lib/api/client"
import type { AuditLogPage } from "@/lib/api/types"

export interface AuditLogParams {
  limit?: number
  offset?: number
  action?: string
  entityType?: string
  occurredAfter?: string
  occurredBefore?: string
}

export const AUDIT_PAGE_SIZE = 50

/** Server-side pagination and filtering (Wave 45): the API returns one page plus `has_more`. */
export const auditLogsApi = {
  list: (params: AuditLogParams = {}) => {
    const query = new URLSearchParams()
    query.set("limit", String(params.limit ?? AUDIT_PAGE_SIZE))
    if (params.offset) query.set("offset", String(params.offset))
    if (params.action) query.set("action", params.action)
    if (params.entityType) query.set("entity_type", params.entityType)
    if (params.occurredAfter) query.set("occurred_after", params.occurredAfter)
    if (params.occurredBefore) query.set("occurred_before", params.occurredBefore)
    return apiFetch<AuditLogPage>(`/audit-logs?${query.toString()}`)
  },
}
