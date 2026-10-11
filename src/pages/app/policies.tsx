import { CheckCircle2, CircleDashed, FileX2, Plus, Repeat, Rocket, ShieldOff } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { PolicyDraftDialog } from "@/components/app/policy-draft-dialog"
import { PolicyEnvironmentCompare } from "@/components/app/policy-environment-compare"
import { RecommendationBadge } from "@/components/fd/risk-badge"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import {
  useActivatePolicyVersion,
  useActivePolicy,
  usePolicyVersions,
  useReactivatePolicyVersion,
  useRetirePolicyVersion,
} from "@/hooks/use-policies"
import { useEnvironments, useProvisionLiveEnvironment } from "@/hooks/use-environments"
import { useMembers } from "@/hooks/use-members"
import { useAuth } from "@/lib/auth/context"
import { ApiError } from "@/lib/api/errors"
import type { EnvironmentName, PolicyLifecycleStatus, PolicyVersionOut } from "@/lib/api/types"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<PolicyLifecycleStatus, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  draft: { label: "Draft", icon: CircleDashed, classes: "border-line-strong bg-panel-raised text-fg-muted" },
  active: { label: "In use", icon: CheckCircle2, classes: "border-ok/30 bg-ok/10 text-ok" },
  retired: { label: "Turned off", icon: ShieldOff, classes: "border-line-strong bg-panel-raised text-fg-subtle" },
}

function PolicyStatusBadge({ status }: { status: PolicyLifecycleStatus }) {
  const info = STATUS_STYLE[status]
  const Icon = info.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium ${info.classes}`}>
      <Icon size={12} aria-hidden="true" />
      {info.label}
    </span>
  )
}

function formatDateTime(iso: string | null) {
  if (!iso) return "Not yet"
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function ThresholdsTable({ thresholds }: { thresholds: PolicyVersionOut["thresholds"] }) {
  return (
    <table className="mt-3 w-full text-left text-[13px]">
      <caption className="sr-only">Policy thresholds</caption>
      <thead>
        <tr className="border-b border-line text-[11px] uppercase tracking-wider text-fg-subtle">
          <th scope="col" className="py-2 pr-4 font-medium">Minimum score</th>
          <th scope="col" className="py-2 font-medium">Recommendation</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {thresholds.map((t) => (
          <tr key={`${t.minimum_score}-${t.recommendation}`}>
            <td className="py-2 pr-4 font-mono text-fg-muted">≥ {t.minimum_score}</td>
            <td className="py-2">
              <RecommendationBadge value={t.recommendation} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function readEnvironment(value: string | null): EnvironmentName {
  return value === "live" ? "live" : "sandbox"
}

export function Policies() {
  const { user } = useAuth()
  const membersQuery = useMembers()
  const environmentsQuery = useEnvironments()
  const provisionLive = useProvisionLiveEnvironment()
  const [searchParams, setSearchParams] = useSearchParams()
  const environment = readEnvironment(searchParams.get("environment"))
  const hasLiveEnvironment = environmentsQuery.data?.some((e) => e.name === "live") ?? false
  const environmentReady = environment === "sandbox" || hasLiveEnvironment

  const activePolicyQuery = useActivePolicy(environment, environmentReady)
  const [trackedPolicyId, setTrackedPolicyId] = useState<string | null>(null)
  const effectivePolicyId = trackedPolicyId ?? activePolicyQuery.data?.policy_id
  const versionsQuery = usePolicyVersions(environmentReady ? effectivePolicyId : undefined, environment)

  const activateVersion = useActivatePolicyVersion()
  const reactivateVersion = useReactivatePolicyVersion()
  const retireVersion = useRetirePolicyVersion()

  const [draftDialogFor, setDraftDialogFor] = useState<"new" | "continue" | null>(null)
  const [activateTarget, setActivateTarget] = useState<PolicyVersionOut | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<PolicyVersionOut | null>(null)
  const [retireTarget, setRetireTarget] = useState<PolicyVersionOut | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [provisionError, setProvisionError] = useState<string | null>(null)

  const myRole = membersQuery.data?.find((m) => m.user_id === user?.id)?.role
  const canCreate = myRole === "owner" || myRole === "admin"
  const canPublish = myRole === "owner"
  const isOwner = myRole === "owner"

  const selectEnvironment = (next: EnvironmentName) => {
    setTrackedPolicyId(null)
    resetActionState()
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === "sandbox") params.delete("environment")
        else params.set("environment", next)
        return params
      },
      { replace: true },
    )
  }

  const handleProvisionLive = async () => {
    setProvisionError(null)
    try {
      await provisionLive.mutateAsync()
    } catch (err) {
      setProvisionError(err instanceof ApiError ? err.message : "Could not set up LIVE.")
    }
  }

  const resetActionState = () => {
    setActivateTarget(null)
    setReactivateTarget(null)
    setRetireTarget(null)
    setActionError(null)
  }

  const handleActivate = async () => {
    if (!activateTarget) return
    setActionError(null)
    try {
      await activateVersion.mutateAsync({ versionId: activateTarget.id, body: { environment } })
      setActivateTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not turn on this version.")
    }
  }

  const handleReactivate = async () => {
    if (!reactivateTarget) return
    setActionError(null)
    try {
      await reactivateVersion.mutateAsync({ versionId: reactivateTarget.id, body: { environment } })
      setReactivateTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not switch back to this version.")
    }
  }

  const handleRetire = async () => {
    if (!retireTarget) return
    setActionError(null)
    try {
      await retireVersion.mutateAsync({ versionId: retireTarget.id, body: { environment } })
      setRetireTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not turn off this policy.")
    }
  }

  const versionColumns: Column<PolicyVersionOut>[] = [
    { key: "version", header: "Version", cell: (v) => <span className="font-mono text-fg">v{v.version}</span> },
    { key: "status", header: "Status", cell: (v) => <PolicyStatusBadge status={v.status} /> },
    { key: "created", header: "Created", secondary: true, cell: (v) => <span className="text-fg-muted">{formatDateTime(v.created_at)}</span> },
    { key: "published", header: "Turned on", secondary: true, cell: (v) => <span className="text-fg-muted">{formatDateTime(v.published_at)}</span> },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      className: "md:text-right",
      cell: (v) =>
        canPublish && v.status === "draft" ? (
          <Button variant="ghost" size="sm" onClick={() => setActivateTarget(v)} aria-label={`Turn on version ${v.version}`}>
            Turn on
          </Button>
        ) : canPublish && v.status === "retired" ? (
          <Button variant="ghost" size="sm" onClick={() => setReactivateTarget(v)} aria-label={`Use version ${v.version} again`}>
            <Repeat size={13} aria-hidden="true" />
            Use again
          </Button>
        ) : (
          <span className="text-xs text-fg-subtle">No action</span>
        ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Policies"
        description="A policy decides what to do for each risk score: proceed, ask the customer to verify, review it, or block it."
        action={
          canCreate && environmentReady ? (
            <Button onClick={() => setDraftDialogFor("new")}>
              <Plus size={16} aria-hidden="true" />
              New policy
            </Button>
          ) : undefined
        }
      />

      {hasLiveEnvironment ? <PolicyEnvironmentCompare canCreate={canCreate} /> : null}

      <div role="group" aria-label="Environment" className="flex flex-wrap gap-2">
        {(["sandbox", "live"] as EnvironmentName[]).map((env) => (
          <button
            key={env}
            type="button"
            aria-pressed={environment === env}
            onClick={() => selectEnvironment(env)}
            className={cn(
              "rounded-control border px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-accent",
              environment === env
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-line-strong text-fg-muted hover:bg-panel-hover hover:text-fg",
            )}
          >
            {env}
          </button>
        ))}
      </div>

      {!canCreate && myRole ? (
        <Alert variant="info">
          Owners and admins can create policies. Only the owner can turn a policy on or off.
        </Alert>
      ) : null}

      <section aria-labelledby="active-policy-heading" className="flex flex-col gap-3">
        <h2 id="active-policy-heading" className="text-sm font-semibold text-fg capitalize">
          Your {environment} policy
        </h2>

        {!environmentReady ? (
          <EmptyState
            icon={Rocket}
            title="LIVE is not set up yet"
            description="Set up LIVE to prepare a LIVE policy before you go live. You will also need approval on the LIVE access page."
            action={
              isOwner ? (
                <Button size="sm" onClick={() => void handleProvisionLive()} disabled={provisionLive.isPending} className="mt-1">
                  <Rocket size={15} aria-hidden="true" />
                  Set up LIVE
                </Button>
              ) : undefined
            }
          />
        ) : activePolicyQuery.isPending ? (
          <LoadingState label="Loading your active policy…" />
        ) : activePolicyQuery.isError ? (
          <ErrorState what="your active policy" error={activePolicyQuery.error} onRetry={() => void activePolicyQuery.refetch()} />
        ) : activePolicyQuery.data ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Version {activePolicyQuery.data.version}</CardTitle>
                  <PolicyStatusBadge status={activePolicyQuery.data.status} />
                </div>
                <CardDescription className="mt-1">
                  Turned on {formatDateTime(activePolicyQuery.data.published_at)}. Every new {environment === "live" ? "LIVE" : "SANDBOX"} check uses it.
                </CardDescription>
              </div>
              {canPublish ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => activePolicyQuery.data && setRetireTarget(activePolicyQuery.data)}
                >
                  <ShieldOff size={14} aria-hidden="true" />
                  Turn off
                </Button>
              ) : null}
            </div>
            <ThresholdsTable thresholds={activePolicyQuery.data.thresholds} />
          </Card>
        ) : (
          <EmptyState
            icon={FileX2}
            title="No policy turned on"
            description="Checks here get a risk score but no recommendation until you create a policy and turn it on."
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setDraftDialogFor(effectivePolicyId ? "continue" : "new")} className="mt-1">
                  <Plus size={15} aria-hidden="true" />
                  {effectivePolicyId ? "Create a new version" : "Create a policy"}
                </Button>
              ) : undefined
            }
          />
        )}
        {provisionError ? (
          <Alert variant="error">{provisionError}</Alert>
        ) : null}
      </section>

      {environmentReady && effectivePolicyId ? (
        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="history-heading" className="text-sm font-semibold text-fg">
              All versions
            </h2>
            {canCreate ? (
              <Button variant="secondary" size="sm" onClick={() => setDraftDialogFor("continue")}>
                <Plus size={14} aria-hidden="true" />
                New version
              </Button>
            ) : null}
          </div>

          {versionsQuery.isPending ? (
            <LoadingState label="Loading version history…" />
          ) : versionsQuery.isError ? (
            <ErrorState what="policy version history" error={versionsQuery.error} onRetry={() => void versionsQuery.refetch()} />
          ) : (
            <DataTable caption="Policy version history" columns={versionColumns} rows={versionsQuery.data} getRowKey={(v) => v.id} />
          )}
        </section>
      ) : null}

      <HowPoliciesWork />

      <PolicyDraftDialog
        open={draftDialogFor !== null}
        onOpenChange={(open) => !open && setDraftDialogFor(null)}
        environment={environment}
        policyId={draftDialogFor === "continue" ? effectivePolicyId : undefined}
        onCreated={(v) => setTrackedPolicyId(v.policy_id)}
      />

      <ConfirmDialog
        open={Boolean(activateTarget)}
        onOpenChange={(open) => !open && resetActionState()}
        title="Turn on this version?"
        description={`Version ${activateTarget?.version ?? ""} will be used for every new ${environment === "live" ? "LIVE" : "SANDBOX"} check right away. The version in use now will be turned off.`}
        confirmLabel="Turn on"
        onConfirm={() => void handleActivate()}
        pending={activateVersion.isPending}
        error={actionError}
      />

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        onOpenChange={(open) => !open && resetActionState()}
        title="Go back to this version?"
        description={`Version ${reactivateTarget?.version ?? ""} will be used again right away. The version in use now will be turned off.`}
        confirmLabel="Use this version"
        onConfirm={() => void handleReactivate()}
        pending={reactivateVersion.isPending}
        error={actionError}
      />

      <ConfirmDialog
        open={Boolean(retireTarget)}
        onOpenChange={(open) => !open && resetActionState()}
        title="Turn off this policy?"
        description={`New ${environment === "live" ? "LIVE" : "SANDBOX"} checks will get no recommendation until you turn a policy on again. You can turn this version back on later.`}
        confirmLabel="Turn off"
        onConfirm={() => void handleRetire()}
        pending={retireVersion.isPending}
        destructive
        error={actionError}
      />
    </div>
  )
}

const EXAMPLE_POLICY: [number, string, string][] = [
  [0, "PROCEED", "0 to 39"],
  [40, "STEP_UP", "40 to 69"],
  [70, "REVIEW", "70 to 89"],
  [90, "BLOCK", "90 and above"],
]

function HowPoliciesWork() {
  return (
    <Card>
      <CardTitle>How a policy works</CardTitle>
      <CardDescription className="mt-1">
        Every check gets a risk score from 0 to 100. Your policy is a short list that says what to do from each score
        upward. Here is an example:
      </CardDescription>
      <table className="mt-4 w-full max-w-md text-left text-[13px]">
        <caption className="sr-only">Example policy (not your policy)</caption>
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wider text-fg-subtle">
            <th scope="col" className="py-2 pr-4 font-medium">
              From score
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Recommendation
            </th>
            <th scope="col" className="py-2 font-medium">
              Covers
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {EXAMPLE_POLICY.map(([min, rec, covers]) => (
            <tr key={rec}>
              <td className="py-2 pr-4 font-mono text-fg">{min}</td>
              <td className="py-2 pr-4">
                <RecommendationBadge value={rec} />
              </td>
              <td className="py-2 text-fg-muted">{covers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-4 list-disc space-y-1 pl-4 text-[13px] text-fg-muted">
        <li>The first row must start at 0, so every score gets an answer.</li>
        <li>Each row must have a higher score than the row above it.</li>
        <li>Scores go up to 100.</li>
        <li>
          The score shows how risky a payment looks. The recommendation is advice; your own system decides what to do
          with it.
        </li>
        <li>If no policy is turned on, checks get a score but no recommendation. That never means “proceed”.</li>
      </ul>
    </Card>
  )
}
