import { CheckCircle2, CircleSlash, Info, KeyRound, ShieldAlert, XCircle } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { SecretRevealDialog } from "@/components/app/secret-reveal-dialog"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { ApiError } from "@/lib/api/errors"
import type {
  LiveAccessState,
  NoticeOut,
  Readiness,
  SuspensionOut,
  TenantLiveAccess,
} from "@/lib/api/endpoints/liveAccess"
import type { CredentialCreatedOut } from "@/lib/api/types"
import { useAuth } from "@/lib/auth/context"
import {
  useAcknowledgeNotice,
  useDisputeSuspension,
  useIssueLiveCredential,
  useLiveAccess,
  useLiveAccessNotices,
  useSubmitLiveAccessRequest,
  useWithdrawLiveAccessRequest,
} from "@/hooks/use-live-access"
import { useMembers } from "@/hooks/use-members"

const STATE_LABEL: Record<LiveAccessState, { label: string; variant: "neutral" | "info" | "danger" | "success" | "warning" }> = {
  not_requested: { label: "Not requested", variant: "neutral" },
  requested: { label: "Request under review", variant: "info" },
  rejected: { label: "Request rejected", variant: "danger" },
  approved_active: { label: "Approved · active", variant: "success" },
  suspension_pending: { label: "Suspension proposed · still active", variant: "warning" },
  suspended: { label: "Suspended", variant: "danger" },
}

const CHECK_LABEL: Record<string, string> = {
  owner_present: "Organization has an owner",
  live_environment_provisioned: "LIVE environment provisioned",
  active_live_policy: "A LIVE policy is active",
  sandbox_activity: "SANDBOX activity",
  tenant_user_mfa: "Team member MFA",
}

function when(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

const TEXTAREA = "w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-fg"

export function LiveAccess() {
  const { user } = useAuth()
  const membersQuery = useMembers()
  const liveQuery = useLiveAccess()
  const isOwner = membersQuery.data?.find((m) => m.user_id === user?.id)?.role === "owner"

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="LIVE access"
        description="Request production (LIVE) access, follow its review, and manage LIVE credentials. Every rule shown here is enforced by the Clarion API."
      />
      {liveQuery.isPending ? (
        <LoadingState label="Loading LIVE access…" />
      ) : liveQuery.isError ? (
        <ErrorState what="LIVE access" error={liveQuery.error} onRetry={() => void liveQuery.refetch()} />
      ) : (
        <LiveAccessBody data={liveQuery.data} isOwner={isOwner} />
      )}
    </div>
  )
}

function LiveAccessBody({ data, isOwner }: { data: TenantLiveAccess; isOwner: boolean }) {
  const state = STATE_LABEL[data.state]
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Status</CardTitle>
          <Badge variant={state.variant}>{state.label}</Badge>
        </div>
        <StatusExplanation data={data} />
        {!isOwner ? (
          <Alert variant="info" className="mt-3">
            Only the organization owner can request LIVE access, acknowledge notices, dispute a suspension or issue LIVE
            credentials. You can follow the status here.
          </Alert>
        ) : null}
      </Card>

      <ReadinessCard readiness={data.readiness} />

      {data.suspension ? <SuspensionCard data={data} suspension={data.suspension} isOwner={isOwner} /> : null}

      {data.state === "not_requested" || data.state === "rejected" ? (
        <RequestCard readiness={data.readiness} isOwner={isOwner} />
      ) : null}

      {data.latest_request ? <RequestHistoryCard data={data} isOwner={isOwner} /> : null}

      {data.state === "approved_active" || data.state === "suspension_pending" ? (
        <IssueCard data={data} isOwner={isOwner} />
      ) : null}

      <NoticesCard isOwner={isOwner} />
    </>
  )
}

function StatusExplanation({ data }: { data: TenantLiveAccess }) {
  const text: Record<LiveAccessState, string> = {
    not_requested: "LIVE access has not been requested. SANDBOX works without it.",
    requested: "Your request is waiting for review by a Clarion operator. Approval does not create credentials by itself.",
    rejected: "Your last request was rejected. You can address the reason and request again.",
    approved_active: "LIVE access is approved and active. LIVE credentials work while it stays active.",
    suspension_pending:
      "Clarion has proposed suspending LIVE access. LIVE keeps working until the proposal is enforced; you can dispute it within the window.",
    suspended:
      "LIVE access is suspended. Every LIVE credential was permanently revoked. SANDBOX is unaffected. Only an explicit reactivation by Clarion restores LIVE access, after which new credentials must be issued.",
  }
  return <CardDescription className="mt-1">{text[data.state]}</CardDescription>
}

function ReadinessCard({ readiness }: { readiness: Readiness }) {
  return (
    <Card>
      <CardTitle>Readiness</CardTitle>
      <CardDescription className="mt-1">Evaluated by the API at {when(readiness.evaluated_at)}.</CardDescription>
      <ul className="mt-3 flex flex-col gap-2">
        {readiness.checks.map((check) => {
          const Icon =
            check.status === "pass" ? CheckCircle2 : check.status === "fail" ? XCircle : check.status === "info" ? Info : CircleSlash
          const tone =
            check.status === "pass" ? "text-ok" : check.status === "fail" ? "text-danger" : "text-fg-subtle"
          return (
            <li key={check.key} className="flex items-start gap-2 text-sm">
              <Icon size={16} className={`mt-0.5 shrink-0 ${tone}`} aria-hidden="true" />
              <div>
                <p className="text-fg">
                  {CHECK_LABEL[check.key] ?? check.key}
                  {check.blocks ? (
                    <span className="ml-2 text-xs text-fg-subtle">
                      {check.blocks === "request" ? "required to request" : "required to issue credentials"}
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-fg-subtle">informational</span>
                  )}
                </p>
                <p className="text-[13px] text-fg-muted">{check.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function RequestCard({ readiness, isOwner }: { readiness: Readiness; isOwner: boolean }) {
  const submit = useSubmitLiveAccessRequest()
  const [useCase, setUseCase] = useState("")
  const [error, setError] = useState<string | null>(null)
  const blocked = readiness.request_blockers.length > 0
  if (!isOwner) return null
  return (
    <Card>
      <CardTitle>Request LIVE access</CardTitle>
      {blocked ? (
        <Alert variant="warning" className="mt-3">
          Resolve the items marked “required to request” first.{" "}
          {readiness.request_blockers.includes("live_environment_provisioned") ? (
            <Link to="/app/credentials" className="underline-offset-2 hover:underline">
              Provision the LIVE environment on the Credentials page.
            </Link>
          ) : null}
        </Alert>
      ) : (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            try {
              await submit.mutateAsync(useCase.trim())
              setUseCase("")
            } catch (err) {
              setError(errorText(err, "Could not submit the request."))
            }
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
            Describe how you will use Clarion in production
            <textarea
              className={TEXTAREA}
              rows={4}
              maxLength={2000}
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="e.g. Card-not-present checkout risk scoring for our EU web shop."
            />
          </label>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div>
            <Button type="submit" disabled={submit.isPending || useCase.trim().length < 10}>
              Submit request
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

function RequestHistoryCard({ data, isOwner }: { data: TenantLiveAccess; isOwner: boolean }) {
  const withdraw = useWithdrawLiveAccessRequest()
  const [error, setError] = useState<string | null>(null)
  const request = data.latest_request
  if (!request) return null
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Latest request</CardTitle>
        <Badge variant="outline" className="capitalize">
          {request.status}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Field label="Submitted" value={`${when(request.created_at)} by ${request.requested_by_email}`} />
        <Field label="Decided" value={when(request.reviewed_at)} />
        <Field label="Use case" value={request.use_case} wide />
        {request.decision_reason ? <Field label="Decision reason" value={request.decision_reason} wide /> : null}
      </dl>
      {isOwner && request.status === "submitted" ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={withdraw.isPending}
            onClick={async () => {
              setError(null)
              try {
                await withdraw.mutateAsync(request.id)
              } catch (err) {
                setError(errorText(err, "Could not withdraw the request."))
              }
            }}
          >
            Withdraw request
          </Button>
          {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
        </div>
      ) : null}
    </Card>
  )
}

function SuspensionCard({ data, suspension, isOwner }: { data: TenantLiveAccess; suspension: SuspensionOut; isOwner: boolean }) {
  const dispute = useDisputeSuspension()
  const [statement, setStatement] = useState("")
  const [error, setError] = useState<string | null>(null)
  const openDispute = data.disputes.find((d) => d.status === "open")
  const canDispute =
    isOwner &&
    !openDispute &&
    (suspension.status === "dispute_window_open" || (suspension.kind === "emergency" && suspension.status === "enforced"))
  const statusText: Record<string, string> = {
    awaiting_notice_delivery:
      "Proposed. The dispute window has not started: it starts only once delivery of the notice is confirmed (for example, when an owner acknowledges it below).",
    dispute_window_open: `Dispute window open until ${when(suspension.dispute_deadline_at)}. Without a dispute, LIVE access is suspended at that time.`,
    disputed: "Disputed. Nothing changes until a Clarion operator decides your dispute.",
    enforced: `Enforced ${when(suspension.enforced_at)}. ${suspension.revoked_credential_count ?? 0} LIVE credential(s) were permanently revoked.`,
  }
  return (
    <Card className={suspension.access_blocked ? "border-danger/40" : "border-warn/40"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert size={16} aria-hidden="true" />
          {suspension.kind === "emergency" ? "Emergency suspension" : "Suspension"}
        </CardTitle>
        <Badge variant={suspension.access_blocked ? "danger" : "warning"}>
          {suspension.access_blocked ? "LIVE blocked" : "LIVE still active"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-fg">Reason: {suspension.reason}</p>
      <p className="mt-1 text-[13px] text-fg-muted">{statusText[suspension.status] ?? suspension.status}</p>
      {data.disputes.length ? (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {data.disputes.map((d) => (
            <li key={d.id} className="rounded-control border border-line p-2">
              <p className="text-fg">
                Dispute ({d.status}) · {when(d.created_at)}
              </p>
              <p className="text-[13px] text-fg-muted">{d.statement}</p>
              {d.decision_reason ? <p className="text-[13px] text-fg-muted">Decision: {d.decision_reason}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canDispute ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            try {
              await dispute.mutateAsync({ suspensionId: suspension.id, statement: statement.trim() })
              setStatement("")
            } catch (err) {
              setError(errorText(err, "Could not submit the dispute."))
            }
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
            Dispute this suspension
            <textarea className={TEXTAREA} rows={3} maxLength={4000} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </label>
          {suspension.kind === "emergency" ? (
            <p className="text-xs text-fg-subtle">Disputing an emergency suspension does not restore access automatically.</p>
          ) : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div>
            <Button type="submit" variant="secondary" disabled={dispute.isPending || statement.trim().length < 10}>
              Submit dispute
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  )
}

function IssueCard({ data, isOwner }: { data: TenantLiveAccess; isOwner: boolean }) {
  const issue = useIssueLiveCredential()
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<CredentialCreatedOut | null>(null)
  const blockers = data.readiness.issuance_blockers
  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <KeyRound size={16} aria-hidden="true" />
        LIVE credentials
      </CardTitle>
      <CardDescription className="mt-1">
        A LIVE key is a server secret for your backend only. It is shown once and never again. Manage existing keys on the{" "}
        <Link to="/app/credentials" className="underline-offset-2 hover:underline">
          Credentials
        </Link>{" "}
        page.
      </CardDescription>
      {blockers.length ? (
        <Alert variant="warning" className="mt-3">
          {blockers.includes("active_live_policy") ? (
            <>
              Activate a LIVE policy before issuing LIVE credentials —{" "}
              <Link to="/app/policies?environment=live" className="underline-offset-2 hover:underline">
                go to Policies
              </Link>
              .
            </>
          ) : (
            `Issuance is blocked: ${blockers.join(", ")}.`
          )}
        </Alert>
      ) : isOwner ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            try {
              setRevealed(await issue.mutateAsync(label.trim() || null))
              setLabel("")
            } catch (err) {
              setError(errorText(err, "Could not issue a LIVE credential."))
            }
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
            Label (optional)
            <input className="h-9 w-64 rounded-control border border-line bg-panel px-3 text-sm text-fg" maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <Button type="submit" disabled={issue.isPending}>
            Issue LIVE credential
          </Button>
        </form>
      ) : null}
      {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
      <SecretRevealDialog
        open={Boolean(revealed)}
        onOpenChange={(open) => {
          if (!open) setRevealed(null)
        }}
        secret={revealed?.secret ?? null}
        keyPrefix={revealed?.key_prefix ?? ""}
      />
    </Card>
  )
}

const DELIVERY_LABEL: Record<NoticeOut["delivery_status"], string> = {
  queued: "Available in the dashboard · not yet acknowledged",
  delivery_unavailable: "Not delivered · no email provider configured",
  accepted_by_provider: "Accepted by the email provider · delivery not yet confirmed",
  bounced: "Bounced · not delivered",
  failed: "Delivery failed",
  confirmed: "Delivery confirmed",
}

function NoticesCard({ isOwner }: { isOwner: boolean }) {
  const noticesQuery = useLiveAccessNotices()
  const acknowledge = useAcknowledgeNotice()
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <CardTitle>Notices from Clarion</CardTitle>
      {noticesQuery.isPending ? (
        <LoadingState label="Loading notices…" />
      ) : noticesQuery.isError ? (
        <ErrorState what="notices" error={noticesQuery.error} onRetry={() => void noticesQuery.refetch()} />
      ) : noticesQuery.data.length === 0 ? (
        <CardDescription className="mt-1">No notices.</CardDescription>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {noticesQuery.data.map((n) => (
            <li key={n.id} className="rounded-control border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-fg">{n.subject}</p>
                <span className="text-xs text-fg-subtle">
                  {n.channel === "in_app" ? "Dashboard" : "Email"} · {DELIVERY_LABEL[n.delivery_status]}
                  {n.confirmation_source === "operator_attested" ? " (attested by Clarion)" : ""}
                  {n.confirmation_source === "provider_delivery_event" ? " (reported by the email provider)" : ""}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-fg-muted">{n.body}</p>
              <p className="mt-1 text-xs text-fg-subtle">{when(n.created_at)}</p>
              {isOwner && n.channel === "in_app" && n.delivery_status !== "confirmed" ? (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="secondary"
                  disabled={acknowledge.isPending}
                  onClick={async () => {
                    setError(null)
                    try {
                      await acknowledge.mutateAsync(n.id)
                    } catch (err) {
                      setError(errorText(err, "Could not acknowledge the notice."))
                    }
                  }}
                >
                  Acknowledge
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
    </Card>
  )
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-fg">{value}</dd>
    </div>
  )
}
