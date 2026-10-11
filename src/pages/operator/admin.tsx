import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useFreshAuth } from "@/components/operator/fresh-auth"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { OffsetPagination } from "@/components/ui/pagination"
import { LoadingState } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import { ALL_PERMISSIONS, operatorApi, PERMISSION_LABEL, type OperatorOut } from "@/lib/operator/api"
import { when } from "@/lib/operator/format"
import { hasPermission, useOperator } from "@/lib/operator/context"

const INPUT = "h-9 rounded-control border border-line bg-panel px-3 text-sm text-fg"

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

/**
 * Operator administration. The checkboxes offered are exactly the permissions the signed-in operator
 * may DELEGATE (its effective permissions with can_delegate) -- a UI convenience only: the API
 * enforces the authority ceiling, the subtree rule and "never yourself" on every call.
 */
export function OperatorAdmin() {
  const me = useOperator()
  const queryClient = useQueryClient()
  const { run, dialog } = useFreshAuth()
  const query = useQuery({ queryKey: ["operator", "operators"], queryFn: operatorApi.operators })
  const delegable = me.effective_permissions.filter((p) => p.can_delegate).map((p) => p.permission)
  const canManage = hasPermission(me, "operators.manage")
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Operators</h1>
      {!canManage ? <Alert variant="info">You can view your own operator profile. Managing operators needs the “operators.manage” permission.</Alert> : null}
      {canManage ? (
        <CreateOperator
          delegable={delegable}
          onCreate={async (body) => {
            const result = await run(() => operatorApi.createOperator(body))
            setCreated({ email: result.operator.email, password: result.initial_password })
            await queryClient.invalidateQueries({ queryKey: ["operator", "operators"] })
          }}
        />
      ) : null}
      {created ? (
        <Alert variant="warning" title="One-time initial password">
          Give this to {created.email} out of band. It is not stored in a recoverable form and will not be shown again:{" "}
          <span className="font-mono">{created.password}</span>{" "}
          <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
            Done
          </Button>
        </Alert>
      ) : null}
      {query.isPending ? (
        <LoadingState label="Loading operators…" />
      ) : query.isError ? (
        <Alert variant="error">{message(query.error, "Could not load operators.")}</Alert>
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.map((op) => (
            <OperatorRow
              key={op.id}
              op={op}
              isSelf={op.id === me.id}
              canManage={canManage}
              delegable={delegable}
              run={run}
              reload={() => queryClient.invalidateQueries({ queryKey: ["operator", "operators"] })}
            />
          ))}
        </ul>
      )}
      {dialog}
    </div>
  )
}

function PermissionPicker({ delegable, value, onChange }: { delegable: string[]; value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-[13px] text-fg-muted">Permissions (only those you may delegate)</legend>
      {ALL_PERMISSIONS.filter((p) => delegable.includes(p)).map((p) => (
        <div key={p} className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p in value}
              onChange={(e) => {
                const next = { ...value }
                if (e.target.checked) next[p] = false
                else delete next[p]
                onChange(next)
              }}
            />
            {PERMISSION_LABEL[p] ?? p}
          </label>
          {p in value ? (
            <label className="flex items-center gap-1 text-xs text-fg-subtle">
              <input type="checkbox" checked={value[p]} onChange={(e) => onChange({ ...value, [p]: e.target.checked })} />
              may delegate further
            </label>
          ) : null}
        </div>
      ))}
    </fieldset>
  )
}

function CreateOperator({ delegable, onCreate }: { delegable: string[]; onCreate: (body: { email: string; display_name: string; permissions: Record<string, boolean> }) => Promise<void> }) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <Card>
      <CardTitle>Add an operator below you</CardTitle>
      <CardDescription className="mt-1">The new operator must set up two-factor authentication at first sign-in.</CardDescription>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          setError(null)
          try {
            await onCreate({ email: email.trim(), display_name: name.trim(), permissions: perms })
            setEmail("")
            setName("")
            setPerms({})
          } catch (err) {
            setError(message(err, "Could not create the operator."))
          } finally {
            setPending(false)
          }
        }}
      >
        <div className="flex flex-wrap gap-2">
          <input className={INPUT} type="email" placeholder="email" aria-label="Operator email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={INPUT} placeholder="display name" aria-label="Operator display name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <PermissionPicker delegable={delegable} value={perms} onChange={setPerms} />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div>
          <Button type="submit" disabled={pending || !email || !name}>
            Create operator
          </Button>
        </div>
      </form>
    </Card>
  )
}

function OperatorRow({
  op,
  isSelf,
  canManage,
  delegable,
  run,
  reload,
}: {
  op: OperatorOut
  isSelf: boolean
  canManage: boolean
  delegable: string[]
  run: <T>(a: () => Promise<T>) => Promise<T>
  reload: () => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [perms, setPerms] = useState<Record<string, boolean>>(Object.fromEntries(op.grants.map((g) => [g.permission, g.can_delegate])))
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const manageable = canManage && !isSelf && !op.is_supreme && op.status !== "revoked"
  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await run(fn)
      setReason("")
      setEditing(false)
      await reload()
    } catch (err) {
      setError(message(err, "The change failed."))
    }
  }
  return (
    <li className="rounded-panel border border-line bg-panel p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-fg">
            {op.display_name} <span className="font-normal text-fg-muted">· {op.email}</span>
            {isSelf ? <span className="ml-1 text-xs text-fg-subtle">(you)</span> : null}
          </p>
          <p className="text-xs text-fg-subtle">
            Since {when(op.created_at)} · MFA {op.mfa_enrolled ? "enrolled" : "not enrolled"}
            {op.status_reason ? ` · ${op.status_reason}` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {op.is_supreme ? <Badge variant="accent">Supreme</Badge> : null}
          <Badge variant={op.status === "active" ? "success" : op.status === "suspended" ? "warning" : "danger"}>{op.status}</Badge>
        </div>
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        Effective: {op.is_supreme ? "all permissions" : op.effective_permissions.map((p) => p.permission).join(", ") || "none"}
        {!op.is_supreme && op.grants.length !== op.effective_permissions.length ? " (some grants exceed the creator's current authority and are inactive)" : ""}
      </p>
      {manageable ? (
        editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <PermissionPicker delegable={delegable} value={perms} onChange={setPerms} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void act(() => operatorApi.setPermissions(op.id, perms))}>
                Save permissions
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <input className={INPUT} placeholder="reason" aria-label={`Reason for ${op.email}`} value={reason} onChange={(e) => setReason(e.target.value)} />
              {op.status === "active" ? (
                <Button size="sm" variant="secondary" disabled={reason.trim().length < 3} onClick={() => void act(() => operatorApi.setStatus(op.id, "suspended", reason.trim()))}>
                  Suspend
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={reason.trim().length < 3} onClick={() => void act(() => operatorApi.setStatus(op.id, "active", reason.trim()))}>
                  Reactivate
                </Button>
              )}
              <Button size="sm" variant="danger" disabled={reason.trim().length < 3} onClick={() => void act(() => operatorApi.setStatus(op.id, "revoked", reason.trim()))}>
                Revoke permanently
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => setEditing(true)}>
            Manage
          </Button>
        )
      ) : null}
      {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
    </li>
  )
}

export function OperatorAudit() {
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get("offset") ?? "0")
  const offset = Number.isInteger(raw) && raw >= 0 ? raw - (raw % 50) : 0
  const query = useQuery({ queryKey: ["operator", "audit", offset], queryFn: () => operatorApi.audit(offset) })
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Operator audit log</h1>
      {query.isPending ? (
        <LoadingState label="Loading…" />
      ) : query.isError ? (
        <Alert variant="error">{message(query.error, "Could not load the audit log.")}</Alert>
      ) : (
        <div className="rounded-panel border border-line bg-panel">
          <ul className="divide-y divide-line text-[13px]">
            {query.data.items.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2 px-3 py-2">
                <span className="text-fg-subtle">{when(e.occurred_at)}</span>
                <span className="font-mono text-fg">{e.action}</span>
                <span className="text-fg-muted">
                  {e.actor_type} {e.actor_id ? e.actor_id.slice(0, 8) : ""} → {e.entity_type} {e.entity_id ? e.entity_id.slice(0, 8) : ""}
                </span>
                {e.reason ? <span className="text-fg-muted">“{e.reason}”</span> : null}
              </li>
            ))}
          </ul>
          <OffsetPagination
            hasPrevious={offset > 0}
            hasNext={query.data.has_more}
            onPrevious={() => setParams(offset - 50 > 0 ? { offset: String(offset - 50) } : {}, { replace: true })}
            onNext={() => setParams({ offset: String(offset + 50) }, { replace: true })}
            rangeLabel={query.data.items.length ? `Showing ${offset + 1}–${offset + query.data.items.length}` : "No entries"}
          />
        </div>
      )}
    </div>
  )
}

export function OperatorSecurity() {
  const me = useOperator()
  const queryClient = useQueryClient()
  const { run, dialog } = useFreshAuth()
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Security</h1>
      <Card>
        <CardTitle>Session</CardTitle>
        <CardDescription className="mt-1">
          Session expires {when(me.session_expires_at)}. Fresh verification {me.fresh_auth_until ? `valid until ${when(me.fresh_auth_until)}` : "not active"}.
          Recovery codes remaining: {me.recovery_codes_remaining ?? "—"}.
        </CardDescription>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={async () => {
            setError(null)
            try {
              const result = await run(() => operatorApi.regenerateRecoveryCodes())
              setCodes(result.recovery_codes)
              await queryClient.invalidateQueries({ queryKey: ["operator", "me"] })
            } catch (err) {
              setError(message(err, "Could not regenerate recovery codes."))
            }
          }}
        >
          Regenerate recovery codes
        </Button>
        {error ? <Alert variant="error" className="mt-2">{error}</Alert> : null}
        {codes ? (
          <Alert variant="warning" title="New recovery codes — shown once" className="mt-3">
            <ul className="mt-1 grid grid-cols-2 gap-1 font-mono">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </Card>
      {dialog}
    </div>
  )
}
