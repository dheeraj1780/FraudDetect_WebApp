import { ScrollText } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { OffsetPagination } from "@/components/ui/pagination"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { AUDIT_PAGE_SIZE } from "@/lib/api/endpoints/auditLogs"
import type { AuditLogOut } from "@/lib/api/types"
import { useAuditLogs } from "@/hooks/use-audit-logs"

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Clarion platform operators appear by role only -- the API never exposes which operator acted. */
function actorLabel(actorType: string) {
  return actorType === "operator" ? "Clarion operator" : actorType
}

function shortId(id: string | null) {
  if (!id) return "—"
  return `${id.slice(0, 8)}…`
}

/** URL state (Wave 45): `?offset=` (a multiple of the page size) and `?action=` (exact action name). */
function useAuditUrlState() {
  const [params, setParams] = useSearchParams()
  const rawOffset = Number(params.get("offset") ?? "0")
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset - (rawOffset % AUDIT_PAGE_SIZE) : 0
  const rawAction = (params.get("action") ?? "").trim()
  const action = /^[a-z_.]{1,100}$/.test(rawAction) ? rawAction : ""
  const update = (next: { offset?: number; action?: string }) => {
    const merged = new URLSearchParams(params)
    const nextOffset = next.offset ?? offset
    const nextAction = next.action ?? action
    if (nextOffset > 0) merged.set("offset", String(nextOffset))
    else merged.delete("offset")
    if (nextAction) merged.set("action", nextAction)
    else merged.delete("action")
    setParams(merged, { replace: true })
  }
  return { offset, action, update }
}

export function AuditLogs() {
  const { offset, action, update } = useAuditUrlState()
  const auditLogsQuery = useAuditLogs({ limit: AUDIT_PAGE_SIZE, offset, action: action || undefined })
  const [actionDraft, setActionDraft] = useState(action)
  const [detail, setDetail] = useState<AuditLogOut | null>(null)

  const pageItems = auditLogsQuery.data?.items ?? []
  const hasMore = auditLogsQuery.data?.has_more ?? false

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit logs"
        description="A record of material actions taken in this organization, newest first."
      />

      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          update({ offset: 0, action: actionDraft.trim() })
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] text-fg-muted">
          Filter by exact action
          <input
            className="h-9 w-72 rounded-control border border-line bg-panel px-3 font-mono text-xs text-fg"
            placeholder="e.g. credential.created"
            value={actionDraft}
            onChange={(event) => setActionDraft(event.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
        {action ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionDraft("")
              update({ offset: 0, action: "" })
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {auditLogsQuery.isPending ? (
        <LoadingState label="Loading audit logs…" />
      ) : auditLogsQuery.isError ? (
        <ErrorState what="audit logs" error={auditLogsQuery.error} onRetry={() => void auditLogsQuery.refetch()} />
      ) : pageItems.length === 0 && offset === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={action ? "No matching activity" : "No activity yet"}
          description={
            action
              ? `No audit events with the action “${action}”.`
              : "Actions like creating credentials or inviting members will show up here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-panel">
          <DataTable
            className="rounded-none border-0"
            caption="Audit log"
            rows={pageItems}
            getRowKey={(log) => log.id}
            columns={[
              { key: "time", header: "Time", cell: (log) => <span className="text-fg-muted">{formatDateTime(log.occurred_at)}</span> },
              { key: "action", header: "Action", cell: (log) => <span className="font-mono text-xs text-fg">{log.action}</span> },
              {
                key: "actor",
                header: "Actor",
                cell: (log) => (
                  <span className="capitalize text-fg">
                    {actorLabel(log.actor_type)}
                    {log.actor_id ? <span className="ml-1 font-mono text-xs normal-case text-fg-subtle">{shortId(log.actor_id)}</span> : null}
                  </span>
                ),
              },
              {
                key: "entity",
                header: "Entity",
                cell: (log) => (
                  <span className="text-fg">
                    {log.entity_type}
                    {log.entity_id ? <span className="ml-1 font-mono text-xs text-fg-subtle">{shortId(log.entity_id)}</span> : null}
                  </span>
                ),
              },
              {
                key: "details",
                header: "Details",
                srOnlyHeader: true,
                className: "md:text-right",
                cell: (log) => (
                  <Button variant="ghost" size="sm" onClick={() => setDetail(log)} aria-label={`Details for ${log.action}`}>
                    Details
                  </Button>
                ),
              },
            ]}
          />

          <OffsetPagination
            hasPrevious={offset > 0}
            hasNext={hasMore}
            onPrevious={() => update({ offset: Math.max(0, offset - AUDIT_PAGE_SIZE) })}
            onNext={() => update({ offset: offset + AUDIT_PAGE_SIZE })}
            rangeLabel={pageItems.length ? `Showing ${offset + 1}–${offset + pageItems.length}` : "No more entries"}
          />
        </div>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogTitle>{detail?.action}</DialogTitle>
          <DialogDescription>{detail ? formatDateTime(detail.occurred_at) : null}</DialogDescription>

          {detail ? (
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <Row label="Actor" value={`${actorLabel(detail.actor_type)} ${detail.actor_id ? shortId(detail.actor_id) : ""}`.trim()} />
              <Row label="Entity" value={`${detail.entity_type} ${shortId(detail.entity_id)}`} />
              {detail.reason ? <Row label="Reason" value={detail.reason} /> : null}
              {detail.correlation_id ? <Row label="Correlation ID" value={detail.correlation_id} mono /> : null}
              {detail.before_json ? <JsonRow label="Before" value={detail.before_json} /> : null}
              {detail.after_json ? <JsonRow label="After" value={detail.after_json} /> : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className={mono ? "mt-0.5 break-all font-mono text-xs text-fg" : "mt-0.5 text-fg"}>{value}</dd>
    </div>
  )
}

function JsonRow({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="mt-1 overflow-x-auto rounded-control border border-line bg-canvas p-3 font-mono text-xs text-fg-muted">
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </dd>
    </div>
  )
}
