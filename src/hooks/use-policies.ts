import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { policiesApi } from "@/lib/api/endpoints/policies"
import type { EnvironmentName, PolicyCopyRequest, PolicyDraftCreate, PolicyTransitionRequest } from "@/lib/api/types"
import { queryKeys } from "@/lib/query/keys"

export function useActivePolicy(environment: EnvironmentName, enabled = true) {
  return useQuery({
    queryKey: queryKeys.activePolicy(environment),
    queryFn: () => policiesApi.getActive(environment),
    enabled,
  })
}

export function usePolicyVersions(policyId: string | undefined, environment: EnvironmentName) {
  return useQuery({
    queryKey: queryKeys.policyVersions(policyId ?? "", environment),
    queryFn: () => policiesApi.listVersions(policyId as string, environment),
    enabled: Boolean(policyId),
  })
}

/** Every mutation invalidates the whole `["policies", ...]` prefix — both the active-policy
 * query and any open lineage-history query always reflect the lifecycle change that just
 * happened, without each mutation needing to know which specific queries are on screen. */
function useInvalidatePolicies() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["policies"] })
}

export function useCreatePolicyDraft() {
  const invalidate = useInvalidatePolicies()
  return useMutation({
    mutationFn: (body: PolicyDraftCreate) => policiesApi.createDraft(body),
    onSuccess: () => invalidate(),
  })
}

export function useActivatePolicyVersion() {
  const invalidate = useInvalidatePolicies()
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: string; body: PolicyTransitionRequest }) =>
      policiesApi.activate(versionId, body),
    onSuccess: () => invalidate(),
  })
}

export function useReactivatePolicyVersion() {
  const invalidate = useInvalidatePolicies()
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: string; body: PolicyTransitionRequest }) =>
      policiesApi.reactivate(versionId, body),
    onSuccess: () => invalidate(),
  })
}

export function useRetirePolicyVersion() {
  const invalidate = useInvalidatePolicies()
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: string; body: PolicyTransitionRequest }) =>
      policiesApi.retire(versionId, body),
    onSuccess: () => invalidate(),
  })
}

export function useCopyPolicyToEnvironment() {
  const invalidate = useInvalidatePolicies()
  return useMutation({
    mutationFn: (body: PolicyCopyRequest) => policiesApi.copyToEnvironment(body),
    onSuccess: () => invalidate(),
  })
}
