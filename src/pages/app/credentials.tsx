import { KeyRound, Plus, RefreshCw, Rocket, XCircle } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { CreateCredentialDialog } from "@/components/app/create-credential-dialog"
import { SecretRevealDialog } from "@/components/app/secret-reveal-dialog"
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
import type { CredentialCreatedOut, CredentialOut } from "@/lib/api/types"
import { useCredentials, useRevokeCredential, useRotateCredential } from "@/hooks/use-credentials"
import { useEnvironments, useProvisionLiveEnvironment } from "@/hooks/use-environments"
import { useMembers } from "@/hooks/use-members"

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function Credentials() {
  const { user } = useAuth()
  const membersQuery = useMembers()
  const credentialsQuery = useCredentials()
  const environmentsQuery = useEnvironments()
  const rotateCredential = useRotateCredential()
  const revokeCredential = useRevokeCredential()
  const provisionLive = useProvisionLiveEnvironment()

  const [createOpen, setCreateOpen] = useState(false)
  const [revealed, setRevealed] = useState<CredentialCreatedOut | null>(null)
  const [rotateTarget, setRotateTarget] = useState<CredentialOut | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<CredentialOut | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [provisionError, setProvisionError] = useState<string | null>(null)

  const myRole = membersQuery.data?.find((m) => m.user_id === user?.id)?.role
  const canManage = myRole === "owner" || myRole === "admin"
  const isOwner = myRole === "owner"
  const hasLiveEnvironment = environmentsQuery.data?.some((e) => e.name === "live") ?? false

  const handleProvisionLive = async () => {
    setProvisionError(null)
    try {
      await provisionLive.mutateAsync()
    } catch (err) {
      setProvisionError(err instanceof ApiError ? err.message : "Could not set up LIVE.")
    }
  }

  const handleRotate = async () => {
    if (!rotateTarget) return
    setActionError(null)
    try {
      const rotated = await rotateCredential.mutateAsync(rotateTarget.id)
      setRotateTarget(null)
      setRevealed(rotated)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not replace this key.")
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setActionError(null)
    try {
      await revokeCredential.mutateAsync(revokeTarget.id)
      setRevokeTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not turn off this key.")
    }
  }

  const columns: Column<CredentialOut>[] = [
    {
      key: "credential",
      header: "Key",
      cell: (credential) => (
        <div>
          <p className="font-medium text-fg">{credential.label ?? "Untitled"}</p>
          <p className="font-mono text-xs text-fg-subtle">{credential.key_prefix}…</p>
        </div>
      ),
    },
    { key: "environment", header: "Environment", cell: (c) => <span className="capitalize text-fg">{c.environment}</span> },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <Badge variant={c.status === "active" ? "success" : "outline"}>
          {c.status === "active" ? "Active" : c.revoked_reason === "live_access_suspended" ? "Turned off (LIVE paused)" : "Turned off"}
        </Badge>
      ),
    },
    { key: "last-used", header: "Last used", cell: (c) => <span className="text-fg-muted">{formatDateTime(c.last_used_at)}</span>, className: "md:min-w-[8.5rem]" },
    { key: "created", header: "Created", cell: (c) => <span className="text-fg-muted">{formatDateTime(c.created_at)}</span>, className: "md:min-w-[8.5rem]" },
  ]

  if (canManage) {
    columns.push({
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (credential) =>
        credential.status === "active" ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRotateTarget(credential)}
              aria-label={`Replace key ${credential.label ?? credential.key_prefix}`}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setRevokeTarget(credential)}
              aria-label={`Turn off key ${credential.label ?? credential.key_prefix}`}
            >
              <XCircle size={14} aria-hidden="true" />
              Turn off
            </Button>
          </div>
        ) : (
          <span className="text-xs text-fg-subtle">No action</span>
        ),
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="API credentials"
        description="API keys let your server send payments to us for checking. Keep them secret and use them only on your server."
        action={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Create credential
            </Button>
          ) : undefined
        }
      />

      {!canManage && myRole ? (
        <Alert variant="info" className="mb-4">
          Only owners and admins can create, replace or turn off keys. You can see the existing keys below.
        </Alert>
      ) : null}

      <Card className="mb-4">
        <CardTitle>SANDBOX and LIVE</CardTitle>
        {environmentsQuery.isPending ? (
          <LoadingState label="Loading environments…" />
        ) : environmentsQuery.isError ? (
          <ErrorState what="environments" error={environmentsQuery.error} onRetry={() => void environmentsQuery.refetch()} />
        ) : hasLiveEnvironment ? (
          <>
            <CardDescription className="mt-1">
              Both SANDBOX (for testing) and LIVE (for real customers) are set up.
            </CardDescription>
            <Alert variant="info" className="mt-3">
              Keys you create on this page are SANDBOX keys. LIVE keys are created on the{" "}
              <Link to="/app/live-access" className="underline-offset-2 hover:underline">
                LIVE access
              </Link>{" "}
              page, after FraudDetect approves you and you turn on a LIVE policy.
            </Alert>
          </>
        ) : (
          <>
            <CardDescription className="mt-1">
              You have SANDBOX, which is for testing. When you are ready for real customers, set up LIVE. That lets you
              prepare a LIVE policy and ask for LIVE access. Nothing goes live yet.
            </CardDescription>
            {isOwner ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void handleProvisionLive()}
                  disabled={provisionLive.isPending}
                >
                  <Rocket size={14} aria-hidden="true" />
                  Set up LIVE
                </Button>
                {provisionError ? (
                  <Alert variant="error" className="mt-3">
                    {provisionError}
                  </Alert>
                ) : null}
              </>
            ) : (
              <Alert variant="info" className="mt-3">
                Only the organization owner can set up LIVE.
              </Alert>
            )}
          </>
        )}
      </Card>

      {credentialsQuery.isPending ? (
        <LoadingState label="Loading credentials…" />
      ) : credentialsQuery.isError ? (
        <ErrorState what="credentials" error={credentialsQuery.error} onRetry={() => void credentialsQuery.refetch()} />
      ) : credentialsQuery.data.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Create a SANDBOX key to start sending test checks."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-1">
                <Plus size={15} aria-hidden="true" />
                Create credential
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable caption="API credentials" columns={columns} rows={credentialsQuery.data} getRowKey={(c) => c.id} />
      )}

      <CreateCredentialDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(credential) => setRevealed(credential)}
      />

      <SecretRevealDialog
        open={Boolean(revealed)}
        onOpenChange={(open) => {
          if (!open) setRevealed(null)
        }}
        secret={revealed?.secret ?? null}
        keyPrefix={revealed?.key_prefix ?? ""}
      />

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRotateTarget(null)
            setActionError(null)
          }
        }}
        title="Replace this key?"
        description="The old key stops working right away and you get a new one. Put the new key on your server straight away."
        confirmLabel="Replace key"
        onConfirm={() => void handleRotate()}
        pending={rotateCredential.isPending}
        error={actionError}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null)
            setActionError(null)
          }
        }}
        title="Turn off this key?"
        description="The key stops working right away and for good. Anything using it will stop working. This cannot be undone."
        confirmLabel="Turn off key"
        onConfirm={() => void handleRevoke()}
        pending={revokeCredential.isPending}
        destructive
        error={actionError}
      />
    </div>
  )
}
