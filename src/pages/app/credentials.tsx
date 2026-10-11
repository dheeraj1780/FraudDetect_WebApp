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
      setProvisionError(err instanceof ApiError ? err.message : "Failed to provision a live environment.")
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
      setActionError(err instanceof ApiError ? err.message : "Failed to rotate credential.")
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setActionError(null)
    try {
      await revokeCredential.mutateAsync(revokeTarget.id)
      setRevokeTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to revoke credential.")
    }
  }

  const columns: Column<CredentialOut>[] = [
    {
      key: "credential",
      header: "Credential",
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
          {c.status === "active" ? "Active" : c.revoked_reason === "live_access_suspended" ? "Revoked · LIVE suspended" : "Revoked"}
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
              aria-label={`Rotate credential ${credential.label ?? credential.key_prefix}`}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Rotate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setRevokeTarget(credential)}
              aria-label={`Revoke credential ${credential.label ?? credential.key_prefix}`}
            >
              <XCircle size={14} aria-hidden="true" />
              Revoke
            </Button>
          </div>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        ),
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="API credentials"
        description="Server-side API credentials for integrating with the Fraud Detect API."
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
          Only owners and admins can create, rotate, or revoke credentials. You can view
          existing credentials below.
        </Alert>
      ) : null}

      <Card className="mb-4">
        <CardTitle>Environments</CardTitle>
        {environmentsQuery.isPending ? (
          <LoadingState label="Loading environments…" />
        ) : environmentsQuery.isError ? (
          <ErrorState what="environments" error={environmentsQuery.error} onRetry={() => void environmentsQuery.refetch()} />
        ) : hasLiveEnvironment ? (
          <>
            <CardDescription className="mt-1">
              Sandbox and live environments are both provisioned for this organization.
            </CardDescription>
            <Alert variant="info" className="mt-3">
              Live environment is provisioned. LIVE credentials are issued from the{" "}
              <Link to="/app/live-access" className="underline-offset-2 hover:underline">
                LIVE access
              </Link>{" "}
              page once Clarion has approved LIVE access and a LIVE policy is active. “Create credential” below issues
              SANDBOX credentials.
            </Alert>
          </>
        ) : (
          <>
            <CardDescription className="mt-1">
              Only sandbox is provisioned. Provisioning the LIVE environment is the first step towards production: it
              lets you author and activate a LIVE policy and request LIVE access.
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
                  Provision live environment
                </Button>
                {provisionError ? (
                  <Alert variant="error" className="mt-3">
                    {provisionError}
                  </Alert>
                ) : null}
              </>
            ) : (
              <Alert variant="info" className="mt-3">
                Only the organization owner can provision a live environment.
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
          title="No credentials yet"
          description="Create a sandbox credential to start integrating with the platform API."
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
        title="Rotate this credential?"
        description="The current secret will stop working immediately and a new one will be issued. Any integration using the old secret must be updated."
        confirmLabel="Rotate credential"
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
        title="Revoke this credential?"
        description="This permanently disables the credential. Any integration using it will stop working immediately. This cannot be undone."
        confirmLabel="Revoke credential"
        onConfirm={() => void handleRevoke()}
        pending={revokeCredential.isPending}
        destructive
        error={actionError}
      />
    </div>
  )
}
