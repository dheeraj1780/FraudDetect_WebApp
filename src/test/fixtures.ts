import type {
  AnalyticsOut,
  AssessmentDetailOut,
  AssessmentListItemOut,
  AssessmentListOut,
  AuditLogOut,
  CredentialCreatedOut,
  CredentialOut,
  EnvironmentOut,
  MeOut,
  MembershipOut,
  PolicyVersionOut,
  TenantOut,
  TokenResponse,
  UserOut,
} from "@/lib/api/types"

/** Shapes copied from real fraud-platform-api responses (verified against a live instance). */
export const user: UserOut = {
  id: "76da112d-f438-41b9-83cf-fa677c280c3e",
  email: "owner@example.com",
  is_active: true,
  created_at: "2026-09-17T19:28:09.151687Z",
}

export const tenant: TenantOut = {
  id: "043031e7-79ea-4c66-b7c1-f91d6677a46b",
  name: "Acme Retail",
  created_at: "2026-09-17T19:28:20.599429Z",
  updated_at: "2026-09-17T19:28:20.599432Z",
}

export const ownerMembership: MembershipOut = {
  id: "4fe7c751-38fd-4981-9a1b-426afdfaaaa7",
  user_id: user.id,
  email: user.email,
  role: "owner",
  created_at: "2026-09-17T19:28:20.605478",
}

export const sandboxOnlyEnvironments: EnvironmentOut[] = [
  { name: "sandbox", created_at: "2026-09-17T19:28:20.599429Z" },
]

export const sandboxAndLiveEnvironments: EnvironmentOut[] = [
  { name: "sandbox", created_at: "2026-09-17T19:28:20.599429Z" },
  { name: "live", created_at: "2026-10-06T12:00:00.000000Z" },
]

export const adminMembership: MembershipOut = {
  id: "b3a2a3c1-8a9b-4d7a-9a6f-5d6b6b2f2a11",
  user_id: "8f1b6c0a-2e3d-4a1b-9c5e-7f2a1b3c4d5e",
  email: "admin@example.com",
  role: "admin",
  created_at: "2026-09-18T10:00:00.000000",
}

/** Wave 46: browser sign-ins never receive the session token -- it is an HttpOnly cookie. */
export const loginResponse: TokenResponse = {
  access_token: null,
  token_type: "bearer",
  expires_at: "2026-09-18T19:28:09.477750Z",
  user,
  mfa_state: "not_enrolled",
}

/** GET /auth/me (Wave 46). */
export const me: MeOut = {
  ...user,
  mfa_enabled: false,
  mfa_state: "not_enrolled",
  recovery_codes_remaining: null,
  tenant_mfa_policy: "optional",
}

export const activeCredential: CredentialOut = {
  id: "1516a3c9-a0fe-42d1-a5d6-919f3bc69b44",
  environment: "sandbox",
  key_prefix: "sk_sandbox_ligpw",
  label: "My first key",
  status: "active",
  created_at: "2026-09-17T19:28:21.655988Z",
  updated_at: "2026-09-17T19:28:21.655990Z",
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
}

export const createdCredential: CredentialCreatedOut = {
  ...activeCredential,
  id: "2222a3c9-a0fe-42d1-a5d6-919f3bc69b44",
  key_prefix: "sk_sandbox_newkey",
  label: "New key",
  secret: "sk_sandbox_newkey-ONE-TIME-SECRET-VALUE",
}

export const completedAssessmentListItem: AssessmentListItemOut = {
  assessment_id: "aaaaaaaa-0000-4000-8000-000000000001",
  environment: "sandbox",
  status: "completed",
  submitted_at: "2026-09-27T10:15:00.412Z",
  completed_at: "2026-09-27T10:15:00.598Z",
  risk_score: 78,
  risk_band: "HIGH",
  policy: { status: "EXECUTED", recommendation: "REVIEW", policy_id: "pol-1", policy_version: "3" },
  reason_count: 2,
  evaluation_state: "EVALUATED",
}

export const processingAssessmentListItem: AssessmentListItemOut = {
  assessment_id: "aaaaaaaa-0000-4000-8000-000000000002",
  environment: "sandbox",
  status: "processing",
  submitted_at: "2026-09-27T10:16:00.000Z",
  completed_at: null,
  risk_score: null,
  risk_band: null,
  policy: null,
  reason_count: 0,
  evaluation_state: null,
}

export const failedAssessmentListItem: AssessmentListItemOut = {
  assessment_id: "aaaaaaaa-0000-4000-8000-000000000003",
  environment: "live",
  status: "failed",
  submitted_at: "2026-09-27T10:17:00.000Z",
  completed_at: null,
  risk_score: null,
  risk_band: null,
  policy: null,
  reason_count: 0,
  evaluation_state: null,
}

export const assessmentListResponse: AssessmentListOut = {
  items: [completedAssessmentListItem, processingAssessmentListItem, failedAssessmentListItem],
  has_more: false,
}

export const completedAssessmentDetail: AssessmentDetailOut = {
  assessment_id: completedAssessmentListItem.assessment_id,
  environment: "sandbox",
  status: "completed",
  submitted_at: "2026-09-27T10:15:00.412Z",
  completed_at: "2026-09-27T10:15:00.598Z",
  risk_score: 78,
  risk_band: "HIGH",
  policy: { status: "EXECUTED", recommendation: "REVIEW", policy_id: "pol-1", policy_version: "3" },
  reasons: [{ reason_code: "F6_TXN_002_FIRST_HIGH_VALUE" }, { reason_code: "F6_TXN_006_INSTRUMENT_COUNTRY_MISMATCH" }],
  engine: {
    engine_version: "eng-1",
    scoring_model_version: "score-1",
    scoring_configuration_version: "cfg-1",
    policy_model_version: "pol-model-1",
  },
  evaluation_state: "EVALUATED",
}

export const processingAssessmentDetail: AssessmentDetailOut = {
  assessment_id: processingAssessmentListItem.assessment_id,
  environment: "sandbox",
  status: "processing",
  submitted_at: "2026-09-27T10:16:00.000Z",
  completed_at: null,
  risk_score: null,
  risk_band: null,
  policy: null,
  reasons: [],
  engine: null,
  evaluation_state: null,
}

export const failedAssessmentDetail: AssessmentDetailOut = {
  assessment_id: failedAssessmentListItem.assessment_id,
  environment: "live",
  status: "failed",
  submitted_at: "2026-09-27T10:17:00.000Z",
  completed_at: null,
  risk_score: null,
  risk_band: null,
  policy: null,
  reasons: [],
  engine: null,
  evaluation_state: null,
}

export const auditLog: AuditLogOut = {
  id: "61370a89-a950-4fab-a1ea-f4d335334e13",
  occurred_at: "2026-09-17T19:28:21.657337",
  action: "credential.created",
  actor_type: "user",
  actor_id: user.id,
  tenant_id: tenant.id,
  entity_type: "api_credential",
  entity_id: activeCredential.id,
  correlation_id: "3d6e4af0-1fbb-47ec-8c67-53a003e687c4",
  reason: null,
  before_json: null,
  after_json: { key_prefix: "sk_sandbox_ligpw", status: "active" },
}

const POLICY_LINEAGE_ID = "aa11bb22-cc33-4d44-8e55-ff6677889900"

export const activePolicyVersion: PolicyVersionOut = {
  id: "11111111-2222-4333-8444-555555555555",
  policy_id: POLICY_LINEAGE_ID,
  version: 2,
  environment: "sandbox",
  status: "active",
  thresholds: [
    { minimum_score: 0, recommendation: "PROCEED" },
    { minimum_score: 40, recommendation: "STEP_UP" },
    { minimum_score: 90, recommendation: "BLOCK" },
  ],
  created_at: "2026-09-20T10:00:00Z",
  published_at: "2026-09-20T10:05:00Z",
  retired_at: null,
}

export const retiredPolicyVersion: PolicyVersionOut = {
  id: "22222222-3333-4444-8555-666666666666",
  policy_id: POLICY_LINEAGE_ID,
  version: 1,
  environment: "sandbox",
  status: "retired",
  thresholds: [{ minimum_score: 0, recommendation: "PROCEED" }],
  created_at: "2026-09-10T10:00:00Z",
  published_at: "2026-09-10T10:05:00Z",
  retired_at: "2026-09-20T10:05:00Z",
}

export const draftPolicyVersion: PolicyVersionOut = {
  id: "33333333-4444-4555-8666-777777777777",
  policy_id: POLICY_LINEAGE_ID,
  version: 3,
  environment: "sandbox",
  status: "draft",
  thresholds: [{ minimum_score: 0, recommendation: "REVIEW" }],
  created_at: "2026-09-25T10:00:00Z",
  published_at: null,
  retired_at: null,
}

export const policyVersionHistory: PolicyVersionOut[] = [retiredPolicyVersion, activePolicyVersion, draftPolicyVersion]

export const assessmentAnalytics: AnalyticsOut = {
  generated_at: "2026-10-07T12:00:00Z",
  environment: null,
  range_start: "2026-09-07T00:00:00Z",
  range_end: "2026-10-07T00:00:00Z",
  summary: {
    total_assessments: 42,
    completed_count: 38,
    processing_count: 1,
    failed_count: 3,
    failure_rate: 3 / 42,
  },
  time_series: {
    bucket: "day",
    timezone: "UTC",
    points: [
      { bucket_start: "2026-10-05T00:00:00Z", count: 20 },
      { bucket_start: "2026-10-06T00:00:00Z", count: 22 },
    ],
  },
  risk_band_distribution: [
    { risk_band: "LOW", count: 20 },
    { risk_band: "MEDIUM", count: 10 },
    { risk_band: "HIGH", count: 8 },
    { risk_band: "UNAVAILABLE", count: 4 },
  ],
  recommendation_distribution: [
    { recommendation: "PROCEED", count: 25 },
    { recommendation: "REVIEW", count: 8 },
    { recommendation: "BLOCK", count: 5 },
    { recommendation: "UNAVAILABLE", count: 4 },
  ],
  status_distribution: [
    { status: "completed", count: 38 },
    { status: "processing", count: 1 },
    { status: "failed", count: 3 },
  ],
  environment_distribution: [
    { environment: "sandbox", count: 42 },
  ],
  policy_version_distribution: [
    { policy_id: "11111111-2222-4333-8444-555555555555", policy_version: "2", count: 38 },
  ],
  latency: { sample_size: 38, avg_ms: 182.4, p50_ms: null, p95_ms: null },
}

export const emptyAssessmentAnalytics: AnalyticsOut = {
  generated_at: "2026-10-07T12:00:00Z",
  environment: null,
  range_start: "2026-09-07T00:00:00Z",
  range_end: "2026-10-07T00:00:00Z",
  summary: { total_assessments: 0, completed_count: 0, processing_count: 0, failed_count: 0, failure_rate: null },
  time_series: { bucket: "day", timezone: "UTC", points: [] },
  risk_band_distribution: [],
  recommendation_distribution: [],
  status_distribution: [],
  environment_distribution: [],
  policy_version_distribution: [],
  latency: { sample_size: 0, avg_ms: null, p50_ms: null, p95_ms: null },
}
