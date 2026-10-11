import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { tenantsApi } from "@/lib/api/endpoints/tenants"
import type { MembershipRoleUpdate } from "@/lib/api/types"
import { queryKeys } from "@/lib/query/keys"

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: tenantsApi.members,
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ membershipId, body }: { membershipId: string; body: MembershipRoleUpdate }) =>
      tenantsApi.updateMemberRole(membershipId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members }),
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (membershipId: string) => tenantsApi.removeMember(membershipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members }),
  })
}
