import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { tenantsApi } from "@/lib/api/endpoints/tenants"
import { queryKeys } from "@/lib/query/keys"

export function useEnvironments() {
  return useQuery({
    queryKey: queryKeys.environments,
    queryFn: tenantsApi.environments,
  })
}

export function useProvisionLiveEnvironment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => tenantsApi.provisionLiveEnvironment(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.environments }),
  })
}
