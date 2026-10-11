import { apiFetch } from "@/lib/api/client"

/**
 * Wave 45: the tenant side of the LIVE access lifecycle (GET/POST /live-access/*). Every rule --
 * who may request, when a dispute is allowed, whether issuance is possible -- is enforced by the
 * API; the UI only reflects the state it returns.
 */

export type LiveAccessState =
  | "not_requested"
  | "requested"
  | "rejected"
  | "approved_active"
  | "suspension_pending"
  | "suspended"

export interface ReadinessCheck {
  key: string
  status: "pass" | "fail" | "info" | "not_available"
  blocks: "request" | "issuance" | null
  detail: string
}

export interface Readiness {
  evaluated_at: string
  checks: ReadinessCheck[]
  request_blockers: string[]
  issuance_blockers: string[]
}

export interface LiveAccessRequestOut {
  id: string
  status: "submitted" | "approved" | "rejected" | "withdrawn"
  use_case: string
  requested_by_email: string
  created_at: string
  reviewed_at: string | null
  decision_reason: string | null
  submitted_readiness: Readiness
  decision_readiness: Readiness | null
}

export interface GrantOut {
  id: string
  status: "active" | "suspended"
  approved_at: string
  status_changed_at: string
}

export interface SuspensionOut {
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

export interface DisputeOut {
  id: string
  suspension_id: string
  status: "open" | "accepted" | "rejected"
  statement: string
  created_at: string
  decided_at: string | null
  decision_reason: string | null
}

export interface NoticeOut {
  id: string
  kind: string
  subject: string
  body: string
  channel: "in_app" | "email"
  delivery_status: "queued" | "delivery_unavailable" | "accepted_by_provider" | "bounced" | "failed" | "confirmed"
  attempt_count: number
  last_attempt_at: string | null
  last_error: string | null
  confirmed_at: string | null
  confirmation_source: "recipient_acknowledged" | "operator_attested" | "provider_delivery_event" | null
  created_at: string
}

export interface TenantLiveAccess {
  state: LiveAccessState
  readiness: Readiness
  grant: GrantOut | null
  suspension: SuspensionOut | null
  disputes: DisputeOut[]
  latest_request: LiveAccessRequestOut | null
  dispute_window_hours: number
}

export const liveAccessApi = {
  get: () => apiFetch<TenantLiveAccess>("/live-access"),
  submitRequest: (useCase: string) =>
    apiFetch<LiveAccessRequestOut>("/live-access/requests", { method: "POST", body: { use_case: useCase } }),
  withdrawRequest: (id: string) =>
    apiFetch<LiveAccessRequestOut>(`/live-access/requests/${id}/withdraw`, { method: "POST" }),
  notices: () => apiFetch<NoticeOut[]>("/live-access/notices"),
  acknowledgeNotice: (id: string) =>
    apiFetch<NoticeOut>(`/live-access/notices/${id}/acknowledge`, { method: "POST" }),
  dispute: (suspensionId: string, statement: string) =>
    apiFetch<DisputeOut>(`/live-access/suspensions/${suspensionId}/disputes`, { method: "POST", body: { statement } }),
}
