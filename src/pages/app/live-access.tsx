import { CheckCircle2, CircleSlash, Info, KeyRound, ShieldAlert, XCircle } from "lucide-react"
import { useState, type ReactNode } from "react"
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
  approved_active: { label: "Approved", variant: "success" },
  suspension_pending: { label: "Pause proposed, LIVE still works", variant: "warning" },
  suspended: { label: "Suspended", variant: "danger" },
}

const CHECK_LABEL: Record<string, string> = {
  owner_present: "Your organization has an owner",
  live_environment_provisioned: "LIVE is set up on the Credentials page",
  active_live_policy: "A LIVE policy is turned on",
  sandbox_activity: "You have tried SANDBOX",
  tenant_user_mfa: "Two-factor sign-in",
}

function when(iso: string | null | undefined) {
  if (!iso) return "Not yet"
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
        description="LIVE means real customers and real payments. SANDBOX is for testing and does not need anything from this page."
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
            Only the organization owner can request LIVE access, reply to FraudDetect or create LIVE keys. You can follow the
            progress here.
          </Alert>
        ) : null}
      </Card>

      <StepsCard data={data} />

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
    not_requested: "You have not asked for LIVE yet. Follow the steps below when you are ready.",
    requested: "We received your request and the FraudDetect team will review it. You don't need to do anything right now.",
    rejected: "Your request was not approved. Read the reason below, fix it, and send a new request.",
    approved_active: "You are approved. Create a LIVE key below and use it on your server.",
    suspension_pending:
      "FraudDetect plans to pause your LIVE access. LIVE still works for now. If you disagree, you can reply below before the deadline.",
    suspended:
      "Your LIVE access is paused and all LIVE keys were turned off for good. SANDBOX still works. If FraudDetect turns LIVE back on, you will need to create new keys.",
  }
  return <CardDescription className="mt-1">{text[data.state]}</CardDescription>
}

type StepState = "done" | "now" | "later"

function StepsCard({ data }: { data: TenantLiveAccess }) {
  if (data.state === "suspended") return null
  const passed = (key: string) => data.readiness.checks.find((c) => c.key === key)?.status === "pass"
  const asked = data.state !== "not_requested" && data.state !== "rejected"
  const approved = data.state === "approved_active" || data.state === "suspension_pending"
  const link = (to: string, text: string) => (
    <Link to={to} className="underline-offset-2 hover:underline">
      {text}
    </Link>
  )
  const items: { title: string; body: ReactNode; done: boolean }[] = [
    {
      title: "Turn on two-factor sign-in",
      body: <>Open {link("/app/settings", "Settings")} and set up an authenticator app. LIVE actions ask for a code from it.</>,
      done: passed("tenant_user_mfa"),
    },
    {
      title: "Set up LIVE",
      body: <>On the {link("/app/credentials", "Credentials")} page, set up the LIVE environment. Nothing goes live yet.</>,
      done: passed("live_environment_provisioned"),
    },
    { title: "Send a request", body: "Tell us in a sentence or two how you will use FraudDetect with real customers.", done: asked },
    { title: "Wait for approval", body: "The FraudDetect team reviews your request. The answer appears on this page.", done: approved },
    {
      title: "Turn on a LIVE policy",
      body: (
        <>
          On the {link("/app/policies?environment=live", "Policies")} page, pick LIVE and turn on a policy. The policy
          decides what to do for each risk score.
        </>
      ),
      done: passed("active_live_policy"),
    },
    { title: "Create a LIVE key", body: "Create it below, copy it, and put it on your server.", done: false },
  ]
  const next = items.findIndex((item) => !item.done)
  return (
    <Card>
      <CardTitle>How to go LIVE</CardTitle>
      <ol className="mt-3 flex flex-col gap-3">
        {items.map((item, i) => {
          const state: StepState = item.done ? "done" : i === next ? "now" : "later"
          return (
            <li key={item.title} className="flex items-start gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "done" ? "bg-ok/10 text-ok" : state === "now" ? "bg-accent text-accent-ink" : "bg-panel-raised text-fg-subtle"
                }`}
                aria-hidden="true"
              >
                {state === "done" ? <CheckCircle2 size={14} /> : i + 1}
              </span>
              <div>
                <p className={state === "later" ? "text-fg-muted" : "font-medium text-fg"}>
                  {item.title}
                  {state === "done" ? <span className="ml-2 text-xs font-normal text-ok">Done</span> : null}
                  {state === "now" ? <span className="ml-2 text-xs font-normal text-fg-subtle">Next step</span> : null}
                </p>
                <p className="text-[13px] text-fg-muted">{item.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function ReadinessCard({ readiness }: { readiness: Readiness }) {
  return (
    <Card>
      <CardTitle>Checklist</CardTitle>
      <CardDescription className="mt-1">Last checked {when(readiness.evaluated_at)}.</CardDescription>
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
                      {check.blocks === "request" ? "needed before you can ask" : "needed before you can create a LIVE key"}
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-fg-subtle">for your information</span>
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
      <CardTitle>Ask for LIVE access</CardTitle>
      {blocked ? (
        <Alert variant="warning" className="mt-3">
          First finish the checklist items marked “needed before you can ask”.{" "}
          {readiness.request_blockers.includes("live_environment_provisioned") ? (
            <Link to="/app/credentials" className="underline-offset-2 hover:underline">
              Set up LIVE on the Credentials page.
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
            Describe how you will use FraudDetect with real customers
            <textarea
              className={TEXTAREA}
              rows={4}
              maxLength={2000}
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="For example: checking online card payments in our web shop."
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
        <CardTitle>Your latest request</CardTitle>
        <Badge variant="outline" className="capitalize">
          {request.status}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Field label="Submitted" value={`${when(request.created_at)} by ${request.requested_by_email}`} />
        <Field label="Answered" value={when(request.reviewed_at)} />
        <Field label="How you will use it" value={request.use_case} wide />
        {request.decision_reason ? <Field label="Reason given" value={request.decision_reason} wide /> : null}
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
      "FraudDetect sent you a message about this. Please read it and click Acknowledge below. Your time to reply starts after that.",
    dispute_window_open: `You can reply until ${when(suspension.dispute_deadline_at)}. If you don't reply by then, LIVE access will be paused.`,
    disputed: "You replied. Nothing changes until the FraudDetect team has looked at your reply.",
    enforced: `Paused on ${when(suspension.enforced_at)}. ${suspension.revoked_credential_count ?? 0} LIVE credential(s) were permanently revoked.`,
  }
  return (
    <Card className={suspension.access_blocked ? "border-danger/40" : "border-warn/40"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert size={16} aria-hidden="true" />
          {suspension.kind === "emergency" ? "Urgent pause of LIVE access" : "Planned pause of LIVE access"}
        </CardTitle>
        <Badge variant={suspension.access_blocked ? "danger" : "warning"}>
          {suspension.access_blocked ? "LIVE blocked" : "LIVE still works"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-fg">Reason: {suspension.reason}</p>
      <p className="mt-1 text-[13px] text-fg-muted">{statusText[suspension.status] ?? suspension.status}</p>
      {data.disputes.length ? (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {data.disputes.map((d) => (
            <li key={d.id} className="rounded-control border border-line p-2">
              <p className="text-fg">
                Your reply ({d.status}), {when(d.created_at)}
              </p>
              <p className="text-[13px] text-fg-muted">{d.statement}</p>
              {d.decision_reason ? <p className="text-[13px] text-fg-muted">Answer: {d.decision_reason}</p> : null}
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
            Dispute this suspension: tell us why you disagree
            <textarea className={TEXTAREA} rows={3} maxLength={4000} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </label>
          {suspension.kind === "emergency" ? (
            <p className="text-xs text-fg-subtle">Replying to an urgent pause does not restore access automatically. The FraudDetect team will decide.</p>
          ) : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div>
            <Button type="submit" variant="secondary" disabled={dispute.isPending || statement.trim().length < 10}>
              Send reply
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
        A LIVE key is a password for your server. Never put it in a website or mobile app. We show it only once, so copy
        it straight away. You can see and turn off existing keys on the{" "}
        <Link to="/app/credentials" className="underline-offset-2 hover:underline">
          Credentials
        </Link>{" "}
        page.
      </CardDescription>
      {blockers.length ? (
        <Alert variant="warning" className="mt-3">
          {blockers.includes("active_live_policy") ? (
            <>
              Activate a LIVE policy before issuing LIVE credentials. Open the{" "}
              <Link to="/app/policies?environment=live" className="underline-offset-2 hover:underline">
                Policies
              </Link>{" "}
              page, pick LIVE, and turn a policy on.
            </>
          ) : (
            `You can't create a LIVE key yet. Still needed: ${blockers.map((b) => CHECK_LABEL[b] ?? b).join(", ")}.`
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
            Name for this key (optional)
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
  queued: "Waiting for you to acknowledge",
  delivery_unavailable: "Not emailed (no email provider configured)",
  accepted_by_provider: "Email sent, delivery not yet confirmed",
  bounced: "Email bounced, not delivered",
  failed: "Delivery failed",
  confirmed: "Delivery confirmed",
}

function NoticesCard({ isOwner }: { isOwner: boolean }) {
  const noticesQuery = useLiveAccessNotices()
  const acknowledge = useAcknowledgeNotice()
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <CardTitle>Messages from FraudDetect</CardTitle>
      {noticesQuery.isPending ? (
        <LoadingState label="Loading notices…" />
      ) : noticesQuery.isError ? (
        <ErrorState what="notices" error={noticesQuery.error} onRetry={() => void noticesQuery.refetch()} />
      ) : noticesQuery.data.length === 0 ? (
        <CardDescription className="mt-1">No messages yet.</CardDescription>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {noticesQuery.data.map((n) => (
            <li key={n.id} className="rounded-control border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-fg">{n.subject}</p>
                <span className="text-xs text-fg-subtle">
                  {n.channel === "in_app" ? "Dashboard" : "Email"} · {DELIVERY_LABEL[n.delivery_status]}
                  {n.confirmation_source === "operator_attested" ? " (attested by FraudDetect)" : ""}
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
