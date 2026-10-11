import { ApiError } from "@/lib/api/errors"

export type TenantErrorKind = "no-tenant" | "ambiguous" | "other"

/**
 * GET /tenants/current returns the same ValidationAppError code for two
 * different situations (see app/dependencies/tenant_context.py in
 * fraud-platform-api) — there's no distinct error code for each, so this
 * matches on the (stable, hardcoded) message text. If the backend ever
 * changes that copy, this falls back to "other" rather than throwing.
 */
export function classifyTenantError(error: unknown): TenantErrorKind {
  if (!(error instanceof ApiError) || error.status !== 400) return "other"
  if (error.message.includes("do not belong to any tenant")) return "no-tenant"
  if (error.message.includes("multiple tenants")) return "ambiguous"
  return "other"
}
