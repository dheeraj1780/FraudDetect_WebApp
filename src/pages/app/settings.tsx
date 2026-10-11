import { UserMinus, Users } from "lucide-react"
import { useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { SecurityCard } from "@/components/app/security-card"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { useAuth } from "@/lib/auth/context"
import { ApiError } from "@/lib/api/errors"
import type { MembershipOut, MembershipRole } from "@/lib/api/types"
import { useMembers, useRemoveMember, useUpdateMemberRole } from "@/hooks/use-members"

const ROLE_LABELS: Record<MembershipRole, string> = { owner: "Owner", admin: "Admin", member: "Member" }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function Settings() {
  const { user, tenant } = useAuth()
  const membersQuery = useMembers()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const [removeTarget, setRemoveTarget] = useState<MembershipOut | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const myRole = membersQuery.data?.find((m) => m.user_id === user?.id)?.role
  const canManageMembers = myRole === "owner"

  const handleRoleChange = async (member: MembershipOut, role: MembershipRole) => {
    setActionError(null)
    try {
      await updateRole.mutateAsync({ membershipId: member.id, body: { role } })
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not change the role.")
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setActionError(null)
    try {
      await removeMember.mutateAsync(removeTarget.id)
      setRemoveTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not remove this person.")
    }
  }

  const columns: Column<MembershipOut>[] = [
    {
      key: "user",
      header: "Member",
      cell: (member) => (
        <span className="text-fg">
          {member.email ?? `${member.user_id.slice(0, 8)}…`}
          {member.user_id === user?.id ? (
            <Badge variant="accent" className="ml-2">
              You
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (member) =>
        canManageMembers ? (
          <select
            aria-label={`Role for ${member.email ?? member.user_id}`}
            value={member.role}
            onChange={(e) => void handleRoleChange(member, e.target.value as MembershipRole)}
            disabled={updateRole.isPending}
            className="h-9 w-full max-w-[9rem] appearance-none rounded-control border border-line-strong bg-canvas pl-3 pr-8 text-sm capitalize text-fg transition-colors hover:border-accent/50 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-panel disabled:text-fg-subtle"
          >
            {(Object.keys(ROLE_LABELS) as MembershipRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        ) : (
          <span className="capitalize text-fg">{member.role}</span>
        ),
    },
    { key: "joined", header: "Joined", cell: (member) => <span className="text-fg-muted">{formatDate(member.created_at)}</span> },
  ]

  if (canManageMembers) {
    columns.push({
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (member) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => setRemoveTarget(member)}
          aria-label={`Remove ${member.email ?? member.user_id}`}
        >
          <UserMinus size={14} aria-hidden="true" />
          Remove
        </Button>
      ),
    })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Your organization, your team and your own sign-in security." />

      <div className="flex flex-col gap-5">
        <Card>
          <CardTitle>Organization</CardTitle>
          {tenant ? (
            <dl className="mt-3 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-fg-subtle">Name</dt>
                <dd className="mt-0.5 font-medium text-fg">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Organization ID (for support)</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-fg">{tenant.id}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Created</dt>
                <dd className="mt-0.5 text-fg-muted">{formatDate(tenant.created_at)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Last updated</dt>
                <dd className="mt-0.5 text-fg-muted">{formatDate(tenant.updated_at)}</dd>
              </div>
            </dl>
          ) : (
            <CardDescription className="mt-3">Not available.</CardDescription>
          )}
        </Card>

        <Card>
          <CardTitle>Team members</CardTitle>
          <CardDescription className="mt-1">
            {canManageMembers
              ? "Change someone's role or remove them. Inviting new people isn't possible yet."
              : "Only the owner can change roles or remove people."}
          </CardDescription>

          {actionError && !removeTarget ? (
            <Alert variant="error" className="mt-3">
              {actionError}
            </Alert>
          ) : null}

          <div className="mt-4">
            {membersQuery.isPending ? (
              <LoadingState label="Loading members…" />
            ) : membersQuery.isError ? (
              <ErrorState what="members" error={membersQuery.error} onRetry={() => void membersQuery.refetch()} />
            ) : membersQuery.data.length === 0 ? (
              <EmptyState icon={Users} title="No members found" />
            ) : (
              <DataTable caption="Team members" rows={membersQuery.data} getRowKey={(member) => member.id} columns={columns} />
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Your account</CardTitle>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-fg-subtle">Email</dt>
              <dd className="mt-0.5 text-fg">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Member since</dt>
              <dd className="mt-0.5 text-fg-muted">{user ? formatDate(user.created_at) : "—"}</dd>
            </div>
          </dl>
        </Card>

        <SecurityCard />
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
            setActionError(null)
          }
        }}
        title="Remove this member?"
        description={`${removeTarget?.email ?? "This member"} will lose access right away. This cannot be undone.`}
        confirmLabel="Remove member"
        onConfirm={() => void handleRemove()}
        pending={removeMember.isPending}
        destructive
        error={actionError}
      />
    </div>
  )
}
