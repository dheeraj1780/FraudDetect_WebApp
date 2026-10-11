import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { credentialsApi } from "@/lib/api/endpoints/credentials"
import type { CredentialCreate } from "@/lib/api/types"
import { queryKeys } from "@/lib/query/keys"

export function useCredentials() {
  return useQuery({
    queryKey: queryKeys.credentials,
    queryFn: credentialsApi.list,
  })
}

export function useCreateCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CredentialCreate) => credentialsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.credentials }),
  })
}

export function useRotateCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => credentialsApi.rotate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.credentials }),
  })
}

export function useRevokeCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => credentialsApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.credentials }),
  })
}
