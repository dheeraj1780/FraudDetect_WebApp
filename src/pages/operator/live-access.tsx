import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useFreshAuth } from "@/components/operator/fresh-auth"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { LoadingState } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { operatorApi, type Readiness, type Suspension, type TenantLive } from "@/lib/operator/api"
import { hasPermission, useOperator } from "@/lib/operator/context"
import { when } from "@/lib/operator/format"

const TEXTAREA = "w-full rounded-control border border-line bg-panel px-3 py-2 text-sm text-fg"


function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

const STATUSES = ["submitted", "approved", "rejected", "withdrawn"] as const

export function OperatorRequests() {
  const [params, setParams] = useSearchParams()
  const raw = params.get("status") ?? "submitted"
  const status = (STATUSES as readonly string[]).includes(raw) ? raw : "submitted"
  const query = useQuery({ queryKey: ["operator", "requests", status], queryFn: () => operatorApi.requests(status) })
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">LIVE access requests</h1>
      <div className="flex gap-1" role="group" aria-label="Request status">
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === status ? "primary" : "secondary"}
            aria-pressed={s === status}
            onClick={() => setParams(s === "submitted" ? {} : { status: s }, { replace: true })}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>
      {query.isPending ? (
        <LoadingState label="Loading requests…" />
      ) : query.isError ? (
        <Alert variant="error">{message(query.error, "Could not load requests.")}</Alert>
      ) : query.data.length === 0 ? (
        <p className="text-sm text-fg-muted">No {status} requests.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-line bg-panel p-3">
              <div>
                <p className="font-medium text-fg">{r.tenant_name}</p>
                <p className="text-[13px] text-fg-muted">
                  {r.requested_by_email} · {when(r.created_at)}
                </p>
              </div>
              <Link className="text-sm text-accent underline-offset-2 hover:underline" to={`/operator/requests/${r.id}`}>
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReadinessList({ title, readiness }: { title: string; readiness: Readiness }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-fg">
        {title} <span className="font-normal text-fg-subtle">({when(readiness.evaluated_at)})</span>
      </p>
      <ul className="mt-1 flex flex-col gap-1 text-[13px]">
        {readiness.checks.map((c) => (
          <li key={c.key} className="flex gap-2">
            <Badge variant={c.status === "pass" ? "success" : c.status === "fail" ? "danger" : "neutral"}>{c.status}</Badge>
            <span className="text-fg-muted">
              {c.key}: {c.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OperatorRequestDetail() {
  const { requestId = "" } = useParams()
  const me = useOperator()
  const queryClient = useQueryClient()
  const { run, dialog } = useFreshAuth()
  const query = useQuery({ queryKey: ["operator", "request", requestId], queryFn: () => operatorApi.request(requestId) })
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const canReview = hasPermission(me, "live_access.review")

  if (query.isPending) return <LoadingState label="Loading request…" />
  if (query.isError) return <Alert variant="error">{message(query.error, "Could not load the request.")}</Alert>
  const r = query.data

  const decide = async (approve: boolean) => {
    setPending(true)
    setError(null)
    try {
      await run(() => (approve ? operatorApi.approve(r.id, reason.trim()) : operatorApi.reject(r.id, reason.trim())))
      setReason("")
      await queryClient.invalidateQueries({ queryKey: ["operator"] })
    } catch (err) {
      setError(message(err, "The decision failed."))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/operator/requests" className="text-sm text-accent">
        ← All requests
      </Link>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{r.tenant_name}</CardTitle>
          <Badge variant="outline" className="capitalize">
            {r.status}
          </Badge>
        </div>
        <CardDescription className="mt-1">
          Requested by {r.requested_by_email} on {when(r.created_at)}
        </CardDescription>
        <p className="mt-3 whitespace-pre-wrap text-sm text-fg">{r.use_case}</p>
        {r.decision_reason ? <p className="mt-2 text-sm text-fg-muted">Decision ({when(r.reviewed_at)}): {r.decision_reason}</p> : null}
      </Card>
      <Card>
        <CardTitle>Readiness</CardTitle>
        {r.readiness_changed_since_submission ? (
          <Alert variant="warning" className="mt-2">Readiness has changed since the request was submitted.</Alert>
        ) : null}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <ReadinessList title="At submission" readiness={r.submitted_readiness} />
          <ReadinessList title="Now" readiness={r.current_readiness} />
        </div>
        <p className="mt-2 text-xs text-fg-subtle">The API re-evaluates readiness again at the moment of the decision and stores it with the decision.</p>
      </Card>
      {r.status === "submitted" && canReview ? (
        <Card>
          <CardTitle>Decision</CardTitle>
          <CardDescription className="mt-1">
            Approval creates a LIVE access grant; it never creates credentials. You cannot decide a request you are connected to.
          </CardDescription>
          <label className="mt-3 flex flex-col gap-1 text-[13px] text-fg-muted">
            Reason (recorded and shown to the tenant)
            <textarea className={TEXTAREA} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
          <div className="mt-3 flex gap-2">
            <Button disabled={pending || reason.trim().length < 3} onClick={() => void decide(true)}>
              Approve
            </Button>
            <Button variant="secondary" disabled={pending || reason.trim().length < 3} onClick={() => void decide(false)}>
              Reject
            </Button>
          </div>
        </Card>
      ) : null}
      {dialog}
    </div>
  )
}

export function OperatorTenants() {
  const query = useQuery({ queryKey: ["operator", "grants"], queryFn: operatorApi.grants })
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Tenants with LIVE access</h1>
      {query.isPending ? (
        <LoadingState label="Loading…" />
      ) : query.isError ? (
        <Alert variant="error">{message(query.error, "Could not load LIVE tenants.")}</Alert>
      ) : query.data.length === 0 ? (
        <p className="text-sm text-fg-muted">No tenant has been granted LIVE access yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.map((row) => (
            <li key={row.grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-line bg-panel p-3">
              <div>
                <p className="font-medium text-fg">{row.tenant_name}</p>
                <p className="text-[13px] text-fg-muted">
                  Grant {row.grant.status}
                  {row.open_suspension ? ` · suspension ${row.open_suspension.status.replaceAll("_", " ")}` : ""}
                </p>
              </div>
              <Link className="text-sm text-accent underline-offset-2 hover:underline" to={`/operator/tenants/${row.tenant_id}`}>
                Manage
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActionForm({
  label,
  field = "Reason",
  minLength = 3,
  destructive,
  onSubmit,
}: {
  label: string
  field?: string
  minLength?: number
  destructive?: boolean
  onSubmit: (text: string) => Promise<void>
}) {
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError(null)
        try {
          await onSubmit(text.trim())
          setText("")
        } catch (err) {
          setError(message(err, `${label} failed.`))
        } finally {
          setPending(false)
        }
      }}
    >
      <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
        {field}
        <textarea className={TEXTAREA} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label={`${label}: ${field}`} />
      </label>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div>
        <Button type="submit" size="sm" variant={destructive ? "danger" : "secondary"} disabled={pending || text.length < minLength}>
          {label}
        </Button>
      </div>
    </form>
  )
}

function SuspensionBlock({ s, data, reload, run }: { s: Suspension; data: TenantLive; reload: () => Promise<unknown>; run: <T>(a: () => Promise<T>) => Promise<T> }) {
  const me = useOperator()
  const canSuspend = hasPermission(me, "live_access.suspend")
  const openDispute = data.disputes.find((d) => d.suspension_id === s.id && d.status === "open")
  const notice = data.notices.find((n) => n.id === s.notice_id)
  return (
    <li className="rounded-control border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-fg">
          {s.kind === "emergency" ? "Emergency" : "Ordinary"} · {s.status.replaceAll("_", " ")}
        </p>
        <Badge variant={s.access_blocked ? "danger" : "outline"}>{s.access_blocked ? "LIVE blocked" : "LIVE not blocked"}</Badge>
      </div>
      <p className="mt-1 text-fg-muted">Reason: {s.reason}</p>
      <p className="text-[13px] text-fg-subtle">
        Created {when(s.created_at)}
        {s.dispute_deadline_at ? ` · dispute deadline ${when(s.dispute_deadline_at)}` : ""}
        {s.enforced_at ? ` · enforced ${when(s.enforced_at)} (${s.enforced_by}), ${s.revoked_credential_count ?? 0} LIVE credential(s) revoked` : ""}
      </p>
      {notice ? (
        <p className="mt-1 text-[13px] text-fg-muted">
          Notice delivery: {notice.delivery_status.replaceAll("_", " ")}
          {notice.confirmation_source ? ` (${notice.confirmation_source.replaceAll("_", " ")})` : ""} · attempts {notice.attempt_count}
        </p>
      ) : null}
      {canSuspend && notice && notice.delivery_status !== "confirmed" ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={async () => {
              await run(() => operatorApi.retryDelivery(notice.id))
              await reload()
            }}
          >
            Retry delivery
          </Button>
          <ActionForm
            label="Record confirmed out-of-band delivery"
            field="Evidence (e.g. call reference, registered-mail ID)"
            minLength={10}
            onSubmit={async (evidence) => {
              await run(() => operatorApi.attestDelivery(notice.id, evidence))
              await reload()
            }}
          />
        </>
      ) : null}
      {canSuspend && s.kind === "ordinary" && (s.status === "awaiting_notice_delivery" || s.status === "dispute_window_open") ? (
        <ActionForm
          label="Withdraw proposal"
          onSubmit={async (reason) => {
            await run(() => operatorApi.cancelSuspension(s.id, reason))
            await reload()
          }}
        />
      ) : null}
      {openDispute ? (
        <div className="mt-2 rounded-control border border-warn/40 p-2">
          <p className="text-[13px] text-fg">Open dispute ({when(openDispute.created_at)}): {openDispute.statement}</p>
          {canSuspend ? (
            <div className="grid gap-2 md:grid-cols-2">
              <ActionForm
                label="Accept dispute"
                onSubmit={async (reason) => {
                  await run(() => operatorApi.decideDispute(openDispute.id, "accept", reason))
                  await reload()
                }}
              />
              <ActionForm
                label="Reject dispute"
                destructive
                onSubmit={async (reason) => {
                  await run(() => operatorApi.decideDispute(openDispute.id, "reject", reason))
                  await reload()
                }}
              />
            </div>
          ) : null}
          {s.kind === "emergency" ? <p className="mt-1 text-xs text-fg-subtle">Accepting does not restore access; reactivate separately.</p> : null}
        </div>
      ) : null}
    </li>
  )
}

export function OperatorTenantDetail() {
  const { tenantId = "" } = useParams()
  const me = useOperator()
  const { run, dialog } = useFreshAuth()
  const query = useQuery({ queryKey: ["operator", "tenant", tenantId], queryFn: () => operatorApi.tenant(tenantId) })
  if (query.isPending) return <LoadingState label="Loading tenant…" />
  if (query.isError) return <Alert variant="error">{message(query.error, "Could not load the tenant.")}</Alert>
  const d = query.data
  const reload = () => query.refetch()
  const open = d.suspensions.find((s) => ["awaiting_notice_delivery", "dispute_window_open", "disputed", "enforced"].includes(s.status))
  return (
    <div className="flex flex-col gap-4">
      <Link to="/operator/tenants" className="text-sm text-accent">
        ← LIVE tenants
      </Link>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{d.tenant_name}</CardTitle>
          <Badge variant={d.state === "suspended" ? "danger" : d.state === "suspension_pending" ? "warning" : "outline"}>{d.state.replaceAll("_", " ")}</Badge>
        </div>
        <CardDescription className="mt-1">{d.grant ? `Grant ${d.grant.status} since ${when(d.grant.status_changed_at)}` : "No LIVE grant."}</CardDescription>
      </Card>

      {d.grant ? (
        <Card>
          <CardTitle>Actions</CardTitle>
          {d.grant.status === "active" && !open && hasPermission(me, "live_access.suspend") ? (
            <ActionForm
              label="Propose suspension (notice + dispute window)"
              onSubmit={async (reason) => {
                await run(() => operatorApi.proposeSuspension(d.grant!.id, reason))
                await reload()
              }}
            />
          ) : null}
          {d.grant.status === "active" && hasPermission(me, "live_access.emergency_suspend") ? (
            <ActionForm
              label="Emergency suspend now (revokes every LIVE credential)"
              destructive
              onSubmit={async (reason) => {
                await run(() => operatorApi.emergencySuspend(d.grant!.id, reason))
                await reload()
              }}
            />
          ) : null}
          {d.grant.status === "suspended" && hasPermission(me, "live_access.reactivate") ? (
            <ActionForm
              label="Reactivate LIVE access (revoked credentials stay revoked)"
              onSubmit={async (reason) => {
                await run(() => operatorApi.reactivate(d.grant!.id, reason))
                await reload()
              }}
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardTitle>Suspensions</CardTitle>
        {d.suspensions.length === 0 ? (
          <CardDescription className="mt-1">None.</CardDescription>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {d.suspensions.map((s) => (
              <SuspensionBlock key={s.id} s={s} data={d} reload={reload} run={run} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>LIVE credentials</CardTitle>
        {d.live_credentials.length === 0 ? (
          <CardDescription className="mt-1">None issued.</CardDescription>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {d.live_credentials.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono text-xs text-fg">{c.key_prefix}…</span>
                <span className="text-fg-muted">
                  {c.status}
                  {c.revoked_reason ? ` (${c.revoked_reason.replaceAll("_", " ")}, ${when(c.revoked_at)})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Notices</CardTitle>
        <ul className="mt-2 flex flex-col gap-1 text-[13px]">
          {d.notices.map((n) => (
            <li key={n.id} className="text-fg-muted">
              {when(n.created_at)} · {n.channel} · {n.subject} · {n.delivery_status.replaceAll("_", " ")}
              {n.last_error ? ` — ${n.last_error}` : ""}
            </li>
          ))}
        </ul>
      </Card>
      {dialog}
    </div>
  )
}
