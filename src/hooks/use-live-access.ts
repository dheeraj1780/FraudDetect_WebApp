import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { credentialsApi } from "@/lib/api/endpoints/credentials"
import { liveAccessApi } from "@/lib/api/endpoints/liveAccess"
import { queryKeys } from "@/lib/query/keys"

export function useLiveAccess() {
  return useQuery({ queryKey: queryKeys.liveAccess, queryFn: liveAccessApi.get })
}

export function useLiveAccessNotices() {
  return useQuery({ queryKey: queryKeys.liveAccessNotices, queryFn: liveAccessApi.notices })
}

function useInvalidateLiveAccess() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.liveAccess }),
      queryClient.invalidateQueries({ queryKey: queryKeys.liveAccessNotices }),
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials }),
      queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll }),
    ])
}

export function useSubmitLiveAccessRequest() {
  const invalidate = useInvalidateLiveAccess()
  return useMutation({ mutationFn: liveAccessApi.submitRequest, onSuccess: invalidate })
}

export function useWithdrawLiveAccessRequest() {
  const invalidate = useInvalidateLiveAccess()
  return useMutation({ mutationFn: liveAccessApi.withdrawRequest, onSuccess: invalidate })
}

export function useAcknowledgeNotice() {
  const invalidate = useInvalidateLiveAccess()
  return useMutation({ mutationFn: liveAccessApi.acknowledgeNotice, onSuccess: invalidate })
}

export function useDisputeSuspension() {
  const invalidate = useInvalidateLiveAccess()
  return useMutation({
    mutationFn: ({ suspensionId, statement }: { suspensionId: string; statement: string }) =>
      liveAccessApi.dispute(suspensionId, statement),
    onSuccess: invalidate,
  })
}

export function useIssueLiveCredential() {
  const invalidate = useInvalidateLiveAccess()
  return useMutation({
    mutationFn: (label: string | null) => credentialsApi.create({ label, environment: "live" }),
    onSuccess: invalidate,
  })
}
