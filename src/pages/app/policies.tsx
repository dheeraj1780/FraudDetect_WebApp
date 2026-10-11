import { ArrowRight, CheckCircle2, CircleDashed, FileX2, Plus, Repeat, Rocket, ShieldOff } from "lucide-react"
import { Fragment, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { PolicyDraftDialog } from "@/components/app/policy-draft-dialog"
import { PolicyEnvironmentCompare } from "@/components/app/policy-environment-compare"
import { RecommendationBadge } from "@/components/fd/risk-badge"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { POLICY_STATUS_INFO } from "@/lib/fraud/vocabulary"
import { cn } from "@/lib/utils"

const FLOW: { name: string; body: string; exposed: boolean }[] = [
  { name: "Risk", body: "A risk score and band from the rules.", exposed: true },
  { name: "Confidence", body: "How much evidence backs the score.", exposed: false },
  { name: "Telemetry", body: "The quality of the data supplied.", exposed: false },
  { name: "Policy", body: "Your tenant's configured policy.", exposed: true },
  { name: "Recommendation", body: "Proceed, step-up, review or block.", exposed: true },
]

const STATUS_STYLE: Record<PolicyLifecycleStatus, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  draft: { label: "Draft", icon: CircleDashed, classes: "border-line-strong bg-panel-raised text-fg-muted" },
  active: { label: "Active", icon: CheckCircle2, classes: "border-ok/30 bg-ok/10 text-ok" },
  retired: { label: "Retired", icon: ShieldOff, classes: "border-line-strong bg-panel-raised text-fg-subtle" },
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
  if (!iso) return "—"
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
      setProvisionError(err instanceof ApiError ? err.message : "Failed to provision a live environment.")
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
      setActionError(err instanceof ApiError ? err.message : "Failed to activate this policy version.")
    }
  }

  const handleReactivate = async () => {
    if (!reactivateTarget) return
    setActionError(null)
    try {
      await reactivateVersion.mutateAsync({ versionId: reactivateTarget.id, body: { environment } })
      setReactivateTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to reactivate this policy version.")
    }
  }

  const handleRetire = async () => {
    if (!retireTarget) return
    setActionError(null)
    try {
      await retireVersion.mutateAsync({ versionId: retireTarget.id, body: { environment } })
      setRetireTarget(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to retire this policy version.")
    }
  }

  const versionColumns: Column<PolicyVersionOut>[] = [
    { key: "version", header: "Version", cell: (v) => <span className="font-mono text-fg">v{v.version}</span> },
    { key: "status", header: "Status", cell: (v) => <PolicyStatusBadge status={v.status} /> },
    { key: "created", header: "Created", secondary: true, cell: (v) => <span className="text-fg-muted">{formatDateTime(v.created_at)}</span> },
    { key: "published", header: "Activated", secondary: true, cell: (v) => <span className="text-fg-muted">{formatDateTime(v.published_at)}</span> },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      className: "md:text-right",
      cell: (v) =>
        canPublish && v.status === "draft" ? (
          <Button variant="ghost" size="sm" onClick={() => setActivateTarget(v)} aria-label={`Activate version ${v.version}`}>
            Activate
          </Button>
        ) : canPublish && v.status === "retired" ? (
          <Button variant="ghost" size="sm" onClick={() => setReactivateTarget(v)} aria-label={`Reactivate version ${v.version}`}>
            <Repeat size={13} aria-hidden="true" />
            Reactivate
          </Button>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Policies"
        description="Policy turns a risk assessment into a recommended action."
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

      <div className="rounded-panel border border-accent/30 bg-accent-soft/60 px-5 py-4">
        <p className="text-sm font-semibold text-fg">Risk score is not the final customer action.</p>
        <p className="mt-1 text-[13px] text-fg-muted">
          The score describes how risky an assessment looks. The policy layer owns the recommendation — and your
          application decides what to do with it.
        </p>
      </div>

      <section aria-labelledby="flow-heading">
        <h2 id="flow-heading" className="sr-only">
          From risk to recommendation
        </h2>
        <ol className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {FLOW.map((step, index) => (
            <Fragment key={step.name}>
              <li className="flex flex-1 flex-col gap-1.5 rounded-panel border border-line bg-panel p-4">
                <div className="flex flex-col items-start gap-1.5">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-fg">{step.name}</span>
                  <Badge variant={step.exposed ? "accent" : "outline"}>{step.exposed ? "In API response" : "Not returned"}</Badge>
                </div>
                <p className="text-xs text-fg-muted">{step.body}</p>
              </li>
              {index < FLOW.length - 1 ? (
                <li aria-hidden="true" className="flex items-center justify-center text-fg-subtle max-lg:rotate-90 max-lg:py-0.5">
                  <ArrowRight size={16} />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>
        <p className="mt-2 text-xs text-fg-subtle">
          The policy layer is defined to receive the score, band, confidence and data quality. Confidence and telemetry
          quality aren&apos;t included in the public API response in this release.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>How a policy maps a score</CardTitle>
          <CardDescription className="mt-1">
            A policy is an ordered list of score thresholds. The highest threshold whose minimum score is at or below the
            assessment&apos;s score decides the recommendation.
          </CardDescription>
          <table className="mt-4 w-full text-left text-[13px]">
            <caption className="sr-only">Structure of a policy (not your configured policy)</caption>
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-fg-subtle">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Minimum score
                </th>
                <th scope="col" className="py-2 font-medium">
                  Recommendation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["0", "PROCEED"],
                ["N₁", "STEP_UP"],
                ["N₂", "REVIEW"],
                ["N₃", "BLOCK"],
              ].map(([min, rec]) => (
                <tr key={rec}>
                  <td className="py-2 pr-4 font-mono text-fg-muted">≥ {min}</td>
                  <td className="py-2">
                    <RecommendationBadge value={rec} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-fg-subtle">
            <li>Thresholds are unique and strictly ascending, within the 0–100 score range.</li>
            <li>The lowest threshold must be 0 or below, so every score maps to a recommendation.</li>
            <li>N₁ &lt; N₂ &lt; N₃ are placeholders for your own values — this is the structure, not your policy.</li>
          </ul>
        </Card>

        <Card>
          <CardTitle>Policy status</CardTitle>
          <CardDescription className="mt-1">
            Every assessment reports whether a policy was applied. A missing recommendation is never “proceed”.
          </CardDescription>
          <dl className="mt-4 flex flex-col gap-3 text-[13px]">
            {Object.entries(POLICY_STATUS_INFO).map(([status, meaning]) => (
              <div key={status}>
                <dt className="font-mono text-xs text-fg">{status}</dt>
                <dd className="mt-0.5 text-fg-muted">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Alert variant="info" title="Policies are versioned">
        Only a policy&apos;s ACTIVE version is used when assessing, and it is resolved from the API credential&apos;s tenant
        and environment.
      </Alert>

      {!canCreate && myRole ? (
        <Alert variant="info">
          Only owners and admins can draft policy versions. Only owners can activate, retire or roll back a version.
        </Alert>
      ) : null}

      <section aria-labelledby="active-policy-heading" className="flex flex-col gap-3">
        <h2 id="active-policy-heading" className="text-sm font-semibold text-fg capitalize">
          Your {environment} policy
        </h2>

        {!environmentReady ? (
          <EmptyState
            icon={Rocket}
            title="Live environment not provisioned yet"
            description="Provision a live environment to author and activate a live policy ahead of go-live. LIVE traffic additionally requires approved LIVE access and LIVE credentials."
            action={
              isOwner ? (
                <Button size="sm" onClick={() => void handleProvisionLive()} disabled={provisionLive.isPending} className="mt-1">
                  <Rocket size={15} aria-hidden="true" />
                  Provision live environment
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
                  Activated {formatDateTime(activePolicyQuery.data.published_at)} · applies to {environment} assessments now.
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
                  Retire
                </Button>
              ) : null}
            </div>
            <ThresholdsTable thresholds={activePolicyQuery.data.thresholds} />
          </Card>
        ) : (
          <EmptyState
            icon={FileX2}
            title="No active policy"
            description="Assessments in this environment report NO_POLICY_CONFIGURED until a policy version is activated."
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setDraftDialogFor(effectivePolicyId ? "continue" : "new")} className="mt-1">
                  <Plus size={15} aria-hidden="true" />
                  {effectivePolicyId ? "Draft a version to activate" : "Create a policy"}
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
              Version history
            </h2>
            {canCreate ? (
              <Button variant="secondary" size="sm" onClick={() => setDraftDialogFor("continue")}>
                <Plus size={14} aria-hidden="true" />
                New draft version
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
        title="Activate this policy version?"
        description={`Version ${activateTarget?.version ?? ""} becomes the ACTIVE policy for ${environment} assessments immediately, retiring whichever version is active now.`}
        confirmLabel="Activate version"
        onConfirm={() => void handleActivate()}
        pending={activateVersion.isPending}
        error={actionError}
      />

      <ConfirmDialog
        open={Boolean(reactivateTarget)}
        onOpenChange={(open) => !open && resetActionState()}
        title="Reactivate this policy version?"
        description={`Version ${reactivateTarget?.version ?? ""} becomes ACTIVE again (a rollback), retiring whichever version is active now.`}
        confirmLabel="Reactivate version"
        onConfirm={() => void handleReactivate()}
        pending={reactivateVersion.isPending}
        error={actionError}
      />

      <ConfirmDialog
        open={Boolean(retireTarget)}
        onOpenChange={(open) => !open && resetActionState()}
        title="Retire this policy version?"
        description={`${environment === "live" ? "Live" : "Sandbox"} assessments will report NO_POLICY_CONFIGURED until another version is activated. You can reactivate this version later.`}
        confirmLabel="Retire version"
        onConfirm={() => void handleRetire()}
        pending={retireVersion.isPending}
        destructive
        error={actionError}
      />
    </div>
  )
}
