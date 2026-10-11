import type { AnalyticsParams } from "@/lib/api/endpoints/analytics"
import type { AuditLogParams } from "@/lib/api/endpoints/auditLogs"
import type { AssessmentListParams } from "@/lib/api/endpoints/assessments"
import type { EnvironmentName } from "@/lib/api/types"

/** Central registry of React Query keys — avoids ad-hoc key arrays scattered across hooks. */
export const queryKeys = {
  me: ["auth", "me"] as const,
  tenant: ["tenant", "current"] as const,
  members: ["tenant", "members"] as const,
  environments: ["tenant", "environments"] as const,
  credentials: ["credentials"] as const,
  liveAccess: ["live-access"] as const,
  liveAccessNotices: ["live-access", "notices"] as const,
  auditLogsAll: ["audit-logs"] as const,
  auditLogs: (params: AuditLogParams) => ["audit-logs", params] as const,
  assessments: (params: AssessmentListParams) => ["assessments", "list", params] as const,
  assessmentDetail: (assessmentId: string) => ["assessments", "detail", assessmentId] as const,
  activePolicy: (environment: EnvironmentName) => ["policies", "active", environment] as const,
  policyVersions: (policyId: string, environment: EnvironmentName) =>
    ["policies", "lineage", policyId, environment] as const,
  analytics: (params: AnalyticsParams) => ["analytics", "assessments", params] as const,
}
