import { apiFetch } from "@/lib/api/client"
import type {
  EnvironmentName,
  PolicyCopyOut,
  PolicyCopyRequest,
  PolicyDraftCreate,
  PolicyTransitionRequest,
  PolicyVersionOut,
} from "@/lib/api/types"

function envQuery(environment: EnvironmentName): string {
  return `?environment=${environment}`
}

export const policiesApi = {
  getActive: (environment: EnvironmentName) =>
    apiFetch<PolicyVersionOut | null>(`/policies/active${envQuery(environment)}`),

  getVersion: (versionId: string, environment: EnvironmentName) =>
    apiFetch<PolicyVersionOut>(`/policies/versions/${versionId}${envQuery(environment)}`),

  listVersions: (policyId: string, environment: EnvironmentName) =>
    apiFetch<PolicyVersionOut[]>(`/policies/${policyId}/versions${envQuery(environment)}`),

  createDraft: (body: PolicyDraftCreate) =>
    apiFetch<PolicyVersionOut>("/policies/drafts", { method: "POST", body }),

  copyToEnvironment: (body: PolicyCopyRequest) =>
    apiFetch<PolicyCopyOut>("/policies/drafts/copy", { method: "POST", body }),

  activate: (versionId: string, body: PolicyTransitionRequest) =>
    apiFetch<PolicyVersionOut>(`/policies/versions/${versionId}/activate`, { method: "POST", body }),

  reactivate: (versionId: string, body: PolicyTransitionRequest) =>
    apiFetch<PolicyVersionOut>(`/policies/versions/${versionId}/reactivate`, { method: "POST", body }),

  retire: (versionId: string, body: PolicyTransitionRequest) =>
    apiFetch<PolicyVersionOut>(`/policies/versions/${versionId}/retire`, { method: "POST", body }),
}
