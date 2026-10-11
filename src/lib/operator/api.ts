/**
 * Wave 45, Milestone I: the platform-operator console's OWN API layer -- deliberately not
 * `@/lib/api/client`. It never sends the tenant session token or X-Tenant-Id, never triggers the
 * tenant app's forced logout, and keeps the operator token in sessionStorage (scoped to one browser
 * tab, cleared when it closes) under a separate key. Every permission, MFA and fresh-authentication
 * rule is enforced by the API; this layer only carries the operator's own bearer token.
 */

import { API_BASE_URL } from "@/lib/api/config"
import { ApiError, parseErrorBody } from "@/lib/api/errors"

const TOKEN_KEY = "clarion.operator_session"

export function getOperatorToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setOperatorToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage unavailable: the session lasts only for this page load.
  }
}

export function clearOperatorToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export const FRESH_AUTH_CODE = "FreshAuthenticationRequiredError"

export function isFreshAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.code === FRESH_AUTH_CODE
}

export async function opFetch<T>(path: string, options: { method?: "GET" | "POST" | "PUT"; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options
  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const token = auth ? getOperatorToken() : null
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/operator${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Unable to reach the server. Check your connection and try again.")
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }
  if (!response.ok) throw parseErrorBody(response.status, data)
  return data as T
}

export type MfaState = "enrollment_required" | "challenge_required" | "verified"

export interface PermissionGrant {
  permission: string
  can_delegate: boolean
}

export interface OperatorOut {
  id: string
  email: string
  display_name: string
  status: "active" | "suspended" | "revoked"
  status_reason: string | null
  is_supreme: boolean
  parent_operator_id: string | null
  mfa_enrolled: boolean
  created_at: string
  grants: PermissionGrant[]
  effective_permissions: PermissionGrant[]
}

export interface OperatorMe extends OperatorOut {
  mfa_state: MfaState
  fresh_auth_until: string | null
  session_expires_at: string
  recovery_codes_remaining: number | null
}

export const ALL_PERMISSIONS = [
  "operators.manage",
  "live_access.review",
  "live_access.suspend",
  "live_access.emergency_suspend",
  "live_access.reactivate",
  "tenants.read",
  "audit.read",
] as const

export const PERMISSION_LABEL: Record<string, string> = {
  "operators.manage": "Manage operators below me",
  "live_access.review": "Approve / reject LIVE access",
  "live_access.suspend": "Propose suspensions, decide disputes, notices",
  "live_access.emergency_suspend": "Emergency suspension",
  "live_access.reactivate": "Reactivate suspended LIVE access",
  "tenants.read": "Read tenant LIVE status",
  "audit.read": "Read operator audit log",
}

export interface ReadinessCheck {
  key: string
  status: string
  blocks: string | null
  detail: string
}
export interface Readiness {
  evaluated_at: string
  checks: ReadinessCheck[]
  request_blockers: string[]
  issuance_blockers: string[]
}

export interface RequestSummary {
  id: string
  tenant_id: string
  tenant_name: string
  status: string
  requested_by_email: string
  created_at: string
  reviewed_at: string | null
}

export interface RequestDetail extends RequestSummary {
  use_case: string
  decision_reason: string | null
  reviewed_by_operator_id: string | null
  submitted_readiness: Readiness
  decision_readiness: Readiness | null
  current_readiness: Readiness
  readiness_changed_since_submission: boolean
}

export interface Grant {
  id: string
  status: "active" | "suspended"
  approved_at: string
  status_changed_at: string
}

export interface Suspension {
  id: string
  kind: "ordinary" | "emergency"
  status: string
  reason: string
  notice_id: string | null
  dispute_window_started_at: string | null
  dispute_deadline_at: string | null
  enforced_at: string | null
  enforced_by: string | null
  revoked_credential_count: number | null
  resolved_at: string | null
  resolution_reason: string | null
  created_at: string
  access_blocked: boolean
}

export interface Dispute {
  id: string
  suspension_id: string
  status: string
  statement: string
  created_at: string
  decided_at: string | null
  decision_reason: string | null
}

export interface Notice {
  id: string
  kind: string
  subject: string
  body: string
  channel: string
  delivery_status: string
  attempt_count: number
  last_attempt_at: string | null
  last_error: string | null
  confirmed_at: string | null
  confirmation_source: string | null
  created_at: string
}

export interface GrantRow {
  grant: Grant
  tenant_id: string
  tenant_name: string
  open_suspension: Suspension | null
}

export interface TenantLive {
  tenant_id: string
  tenant_name: string
  state: string
  readiness: Readiness
  grant: Grant | null
  suspensions: Suspension[]
  disputes: Dispute[]
  notices: Notice[]
  live_credentials: Array<{ id: string; key_prefix: string; label: string | null; status: string; created_at: string; revoked_at: string | null; revoked_reason: string | null }>
}

export interface AuditPage {
  items: Array<{ id: string; occurred_at: string; action: string; actor_type: string; actor_id: string | null; tenant_id: string | null; entity_type: string; entity_id: string | null; reason: string | null }>
  has_more: boolean
}

export const operatorApi = {
  login: (email: string, password: string) =>
    opFetch<{ access_token: string; expires_at: string; mfa_state: MfaState }>("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  logout: () => opFetch<void>("/auth/logout", { method: "POST" }),
  me: () => opFetch<OperatorMe>("/auth/me"),
  startEnrollment: () => opFetch<{ otpauth_uri: string; qr_svg: string; secret: string }>("/mfa/enrollment", { method: "POST" }),
  confirmEnrollment: (code: string) => opFetch<{ recovery_codes: string[]; note: string }>("/mfa/enrollment/confirm", { method: "POST", body: { code } }),
  challenge: (body: { code?: string; recovery_code?: string }) => opFetch<{ mfa_state: string; method: string }>("/mfa/challenge", { method: "POST", body }),
  reauthenticate: (code: string) => opFetch<{ fresh_until: string }>("/mfa/reauthenticate", { method: "POST", body: { code } }),
  regenerateRecoveryCodes: () => opFetch<{ recovery_codes: string[]; note: string }>("/mfa/recovery-codes", { method: "POST" }),

  operators: () => opFetch<OperatorOut[]>("/operators"),
  createOperator: (body: { email: string; display_name: string; permissions: Record<string, boolean> }) =>
    opFetch<{ operator: OperatorOut; initial_password: string; note: string }>("/operators", { method: "POST", body }),
  setPermissions: (id: string, permissions: Record<string, boolean>) =>
    opFetch<OperatorOut>(`/operators/${id}/permissions`, { method: "PUT", body: { permissions } }),
  setStatus: (id: string, status: "active" | "suspended" | "revoked", reason: string) =>
    opFetch<OperatorOut>(`/operators/${id}/status`, { method: "POST", body: { status, reason } }),

  requests: (status?: string) => opFetch<RequestSummary[]>(`/live-access/requests${status ? `?status=${status}` : ""}`),
  request: (id: string) => opFetch<RequestDetail>(`/live-access/requests/${id}`),
  approve: (id: string, reason: string) => opFetch<RequestDetail>(`/live-access/requests/${id}/approve`, { method: "POST", body: { reason } }),
  reject: (id: string, reason: string) => opFetch<RequestDetail>(`/live-access/requests/${id}/reject`, { method: "POST", body: { reason } }),
  grants: () => opFetch<GrantRow[]>("/live-access/grants"),
  tenant: (tenantId: string) => opFetch<TenantLive>(`/live-access/tenants/${tenantId}`),
  proposeSuspension: (grantId: string, reason: string) => opFetch<Suspension>(`/live-access/grants/${grantId}/suspensions`, { method: "POST", body: { reason } }),
  emergencySuspend: (grantId: string, reason: string) => opFetch<Suspension>(`/live-access/grants/${grantId}/emergency-suspension`, { method: "POST", body: { reason } }),
  reactivate: (grantId: string, reason: string) => opFetch<unknown>(`/live-access/grants/${grantId}/reactivate`, { method: "POST", body: { reason } }),
  cancelSuspension: (id: string, reason: string) => opFetch<Suspension>(`/live-access/suspensions/${id}/cancel`, { method: "POST", body: { reason } }),
  decideDispute: (id: string, decision: "accept" | "reject", reason: string) =>
    opFetch<Dispute>(`/live-access/disputes/${id}/decision`, { method: "POST", body: { decision, reason } }),
  attestDelivery: (id: string, evidence: string) => opFetch<Notice>(`/live-access/notices/${id}/attest-delivery`, { method: "POST", body: { evidence } }),
  retryDelivery: (id: string) => opFetch<Notice>(`/live-access/notices/${id}/retry-delivery`, { method: "POST" }),
  audit: (offset = 0) => opFetch<AuditPage>(`/audit-logs?limit=50&offset=${offset}`),
}
