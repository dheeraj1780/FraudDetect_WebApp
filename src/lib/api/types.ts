/**
 * Wire types for the fraud-platform-api. These mirror the backend's Pydantic
 * schemas field-for-field (see app/schemas/*.py in fraud-platform-api) — do
 * not add fields the API doesn't actually return, and do not reuse these as
 * UI view-models; components that need a shaped-for-display version should
 * derive it locally instead of growing these.
 */

export interface UserOut {
  id: string
  email: string
  is_active: boolean
  created_at: string
}

export type MfaState = "not_enrolled" | "challenge_required" | "verified"

export interface TokenResponse {
  /** Always null for browser sign-ins (Wave 46): the session exists only as an HttpOnly cookie. */
  access_token: string | null
  token_type: string
  expires_at: string
  user: UserOut
  mfa_state: MfaState
}

/** GET /auth/me (Wave 46). */
export interface MeOut extends UserOut {
  mfa_enabled: boolean
  mfa_state: MfaState
  recovery_codes_remaining: number | null
  tenant_mfa_policy: "optional" | "required_for_live" | "required"
}

export interface RegisterRequest {
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TenantOut {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface TenantCreate {
  name: string
}

export type MembershipRole = "owner" | "admin" | "member"

export interface MembershipOut {
  id: string
  user_id: string
  email: string | null
  role: MembershipRole
  created_at: string
}

export interface MembershipRoleUpdate {
  role: MembershipRole
  reason?: string
}

export type EnvironmentName = "sandbox" | "live"
export type CredentialStatus = "active" | "revoked"

export interface EnvironmentOut {
  name: EnvironmentName
  created_at: string
}

export interface CredentialOut {
  id: string
  environment: EnvironmentName
  key_prefix: string
  label: string | null
  status: CredentialStatus
  created_at: string
  updated_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  /** Wave 45: why it was revoked, e.g. "tenant_revoked" or "live_access_suspended". */
  revoked_reason?: string | null
}

/** Only ever returned from POST /credentials and POST /credentials/{id}/rotate. */
export interface CredentialCreatedOut extends CredentialOut {
  secret: string
}

export interface CredentialCreate {
  label?: string | null
  /** Wave 45: "live" is OWNER-only and requires an active LIVE access grant + active LIVE policy. */
  environment?: EnvironmentName
}

export interface AuditLogOut {
  id: string
  occurred_at: string
  action: string
  actor_type: string
  actor_id: string | null
  tenant_id: string | null
  entity_type: string
  entity_id: string | null
  correlation_id: string | null
  reason: string | null
  before_json: Record<string, unknown> | null
  after_json: Record<string, unknown> | null
}

/** GET /audit-logs (Wave 45): newest first, `has_more` instead of a total count. */
export interface AuditLogPage {
  items: AuditLogOut[]
  has_more: boolean
}

/** The {code, message} shape every AppError subclass serializes to. */
export interface ApiErrorDetail {
  code: string
  message: string
}

/** FastAPI's default shape for a 422 request-validation failure. */
export interface ValidationErrorDetail {
  detail: {
    type: string
    loc: (string | number)[]
    msg: string
    input?: unknown
  }[]
}

/**
 * POST /assessments response (app/schemas/assessment.py::AssessmentOut). The
 * platform deliberately exposes NO rule ids/weights, evidence, confidence or
 * per-family detail here — only reason codes. Called with an API credential
 * (X-Api-Key), not a browser session, so this app never fetches it; the type
 * exists so a response the user pastes can be validated and rendered.
 */
export interface AssessmentPolicyOut {
  status: string
  recommendation: string | null
  policy_id: string | null
  policy_version: string | null
}

export interface AssessmentEngineOut {
  engine_version: string
  scoring_model_version: string
  scoring_configuration_version: string
  policy_model_version: string
}

export interface AssessmentOut {
  assessment_id: string
  status: "completed"
  submitted_at: string
  completed_at: string
  risk_score: number | null
  risk_band: string | null
  policy: AssessmentPolicyOut
  reasons: { reason_code: string }[]
  engine: AssessmentEngineOut
  evaluation_state: "EVALUATED" | "PARTIALLY_EVALUATED" | "NOT_EVALUABLE" | "NO_APPLICABLE_RULES" | null
  idempotent_replay: boolean
}

/**
 * Wave 34B's tenant-facing read API (GET /assessments, GET /assessments/{id}; session-authenticated,
 * app/schemas/assessment.py::AssessmentListItemOut / AssessmentDetailOut). A SEPARATE shape from
 * AssessmentOut above, not a reuse of it — the backend deliberately did not widen the frozen
 * POST /assessments submission contract, since its `status` is fixed to "completed" and can't
 * represent PROCESSING or FAILED. `policy`/`engine`/`risk_score`/`risk_band`/`completed_at` are only
 * ever non-null for a COMPLETED assessment — they are genuinely absent for PROCESSING and FAILED,
 * never defaulted.
 */
export type AssessmentLifecycleStatus = "processing" | "completed" | "failed"

export interface AssessmentListItemOut {
  assessment_id: string
  environment: EnvironmentName
  status: AssessmentLifecycleStatus
  submitted_at: string
  completed_at: string | null
  risk_score: number | null
  risk_band: string | null
  policy: AssessmentPolicyOut | null
  reason_count: number
  evaluation_state: "EVALUATED" | "PARTIALLY_EVALUATED" | "NOT_EVALUABLE" | "NO_APPLICABLE_RULES" | null
}

/** `has_more` only — no total count (GET /credentials and GET /audit-logs don't return one either). */
export interface AssessmentListOut {
  items: AssessmentListItemOut[]
  has_more: boolean
}

export interface AssessmentDetailOut {
  assessment_id: string
  environment: EnvironmentName
  status: AssessmentLifecycleStatus
  submitted_at: string
  completed_at: string | null
  risk_score: number | null
  risk_band: string | null
  policy: AssessmentPolicyOut | null
  reasons: { reason_code: string }[]
  engine: AssessmentEngineOut | null
  evaluation_state: "EVALUATED" | "PARTIALLY_EVALUATED" | "NOT_EVALUABLE" | "NO_APPLICABLE_RULES" | null
}

/**
 * Wave 35B's tenant policy HTTP API (GET/POST /api/v1/policies/*,
 * app/schemas/policy.py). `environment` is the tenant-facing NAME
 * (matching the Wave 34B assessments precedent), never a raw environment
 * id — there is no frontend path that has one.
 */
export type PolicyLifecycleStatus = "draft" | "active" | "retired"

export interface PolicyThreshold {
  minimum_score: number
  recommendation: string
}

export interface PolicyVersionOut {
  id: string
  policy_id: string
  version: number
  environment: EnvironmentName
  status: PolicyLifecycleStatus
  thresholds: PolicyThreshold[]
  created_at: string
  published_at: string | null
  retired_at: string | null
}

export interface PolicyDraftCreate {
  environment: EnvironmentName
  thresholds: PolicyThreshold[]
  policy_id?: string | null
  reason?: string | null
}

export interface PolicyTransitionRequest {
  environment: EnvironmentName
  reason?: string | null
}

export interface AnalyticsSummaryOut {
  total_assessments: number
  completed_count: number
  processing_count: number
  failed_count: number
  failure_rate: number | null
}

export interface TimeSeriesPointOut {
  bucket_start: string
  count: number
}

export interface AnalyticsTimeSeriesOut {
  bucket: "day"
  timezone: "UTC"
  points: TimeSeriesPointOut[]
}

export interface RiskBandCountOut {
  risk_band: "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE"
  count: number
}

export interface RecommendationCountOut {
  recommendation: "PROCEED" | "STEP_UP" | "REVIEW" | "BLOCK" | "UNAVAILABLE"
  count: number
}

export interface StatusCountOut {
  status: "processing" | "completed" | "failed"
  count: number
}

export interface EnvironmentCountOut {
  environment: EnvironmentName
  count: number
}

export interface PolicyVersionCountOut {
  policy_id: string | null
  policy_version: string | null
  count: number
}

export interface LatencyOut {
  sample_size: number
  avg_ms: number | null
  p50_ms: number | null
  p95_ms: number | null
}

export interface AnalyticsOut {
  generated_at: string
  environment: EnvironmentName | null
  range_start: string
  range_end: string
  summary: AnalyticsSummaryOut
  time_series: AnalyticsTimeSeriesOut
  risk_band_distribution: RiskBandCountOut[]
  recommendation_distribution: RecommendationCountOut[]
  status_distribution: StatusCountOut[]
  environment_distribution: EnvironmentCountOut[]
  policy_version_distribution: PolicyVersionCountOut[]
  latency: LatencyOut
}

/** Wave 45: POST /policies/drafts/copy -- copy a persisted version into an independent DRAFT elsewhere. */
export interface PolicyCopyRequest {
  source_environment: EnvironmentName
  source_version_id: string
  target_environment: EnvironmentName
  target_policy_id?: string | null
  reason?: string | null
}

export interface PolicyCopyOut {
  draft: PolicyVersionOut
  summary: {
    source_version_id: string
    source_policy_id: string
    source_version: number
    source_status: string
    source_environment: EnvironmentName
    target_environment: EnvironmentName
    copied_threshold_count: number
    incompatibilities: string[]
    activated: boolean
  }
}
