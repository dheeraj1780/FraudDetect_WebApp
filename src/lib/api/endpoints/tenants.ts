import { apiFetch } from "@/lib/api/client"
import type { EnvironmentOut, MembershipOut, MembershipRoleUpdate, TenantCreate, TenantOut } from "@/lib/api/types"

export const tenantsApi = {
  create: (body: TenantCreate) => apiFetch<TenantOut>("/tenants", { method: "POST", body }),

  current: () => apiFetch<TenantOut>("/tenants/current"),

  members: () => apiFetch<MembershipOut[]>("/tenants/current/members"),

  updateMemberRole: (membershipId: string, body: MembershipRoleUpdate) =>
    apiFetch<MembershipOut>(`/tenants/current/members/${membershipId}`, { method: "PATCH", body }),

  removeMember: (membershipId: string) =>
    apiFetch<void>(`/tenants/current/members/${membershipId}`, { method: "DELETE" }),

  environments: () => apiFetch<EnvironmentOut[]>("/tenants/current/environments"),

  provisionLiveEnvironment: () =>
    apiFetch<EnvironmentOut>("/tenants/current/environments/live", { method: "POST" }),
}
