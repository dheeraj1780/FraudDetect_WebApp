import { apiFetch } from "@/lib/api/client"
import type { CredentialCreate, CredentialCreatedOut, CredentialOut } from "@/lib/api/types"

export const credentialsApi = {
  list: () => apiFetch<CredentialOut[]>("/credentials"),

  create: (body: CredentialCreate) =>
    apiFetch<CredentialCreatedOut>("/credentials", { method: "POST", body }),

  rotate: (id: string) =>
    apiFetch<CredentialCreatedOut>(`/credentials/${id}/rotate`, { method: "POST" }),

  revoke: (id: string) =>
    apiFetch<CredentialOut>(`/credentials/${id}/revoke`, { method: "POST" }),
}
