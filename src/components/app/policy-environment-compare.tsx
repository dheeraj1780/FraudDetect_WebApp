import { ArrowRightLeft, Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { useActivePolicy, useCopyPolicyToEnvironment } from "@/hooks/use-policies"
import { ApiError } from "@/lib/api/errors"
import type { PolicyCopyOut, PolicyVersionOut } from "@/lib/api/types"
import { diffThresholds, type ThresholdDiff } from "@/lib/fraud/policy-diff"

/**
 * Wave 45, Milestone E: compares the ACTIVE policy versions persisted for SANDBOX and LIVE --
 * nothing is computed from anything but the two stored versions -- and copies the SANDBOX
 * configuration into an independent LIVE DRAFT (the source is never changed and the copy is never
 * activated; activation stays the normal, OWNER-only lifecycle step).
 *
 * A policy version holds thresholds only (no environment-specific references), so the only kind of
 * incompatibility that can exist is one the API's own validation reports when copying.
 */

const DIFF_BADGE: Record<ThresholdDiff["kind"], { label: string; variant: "success" | "danger" | "warning" | "neutral" }> = {
  added: { label: "Only in LIVE", variant: "success" },
  removed: { label: "Only in SANDBOX", variant: "danger" },
  changed: { label: "Changed", variant: "warning" },
  same: { label: "Same", variant: "neutral" },
}

function versionLine(v: PolicyVersionOut | null | undefined) {
  if (!v) return "no policy turned on"
  return `version ${v.version}, turned on ${v.published_at ? new Date(v.published_at).toLocaleDateString() : "recently"}`
}

export function PolicyEnvironmentCompare({ canCreate }: { canCreate: boolean }) {
  const [params, setParams] = useSearchParams()
  const open = params.get("compare") === "1"
  const sandboxQuery = useActivePolicy("sandbox", open)
  const liveQuery = useActivePolicy("live", open)
  const copy = useCopyPolicyToEnvironment()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PolicyCopyOut | null>(null)

  const toggle = () => {
    const next = new URLSearchParams(params)
    if (open) next.delete("compare")
    else next.set("compare", "1")
    setParams(next, { replace: true })
  }

  const diffs = useMemo(
    () => diffThresholds(sandboxQuery.data?.thresholds ?? [], liveQuery.data?.thresholds ?? []),
    [sandboxQuery.data, liveQuery.data],
  )

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft size={16} aria-hidden="true" />
          Compare environments
        </CardTitle>
        <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={open}>
          {open ? "Hide comparison" : "Compare SANDBOX and LIVE"}
        </Button>
      </div>
      {!open ? null : sandboxQuery.isPending || liveQuery.isPending ? (
        <LoadingState label="Loading active policies…" />
      ) : sandboxQuery.isError || liveQuery.isError ? (
        <ErrorState
          what="active policies"
          error={(sandboxQuery.error ?? liveQuery.error) as Error}
          onRetry={() => {
            void sandboxQuery.refetch()
            void liveQuery.refetch()
          }}
        />
      ) : (
        <>
          <CardDescription className="mt-1">
            The policy in use in each place. SANDBOX: {versionLine(sandboxQuery.data)}. LIVE:{" "}
            {versionLine(liveQuery.data)}.
          </CardDescription>
          {!sandboxQuery.data && !liveQuery.data ? (
            <Alert variant="info" className="mt-3">Neither SANDBOX nor LIVE has a policy turned on, so there is nothing to compare.</Alert>
          ) : (
            <>
              {!liveQuery.data ? <Alert variant="warning" className="mt-3">LIVE has no policy turned on yet. Copy your SANDBOX policy below to start one.</Alert> : null}
              {!sandboxQuery.data ? <Alert variant="info" className="mt-3">SANDBOX has no policy turned on.</Alert> : null}
              <table className="mt-3 w-full text-left text-[13px]">
                <caption className="sr-only">Threshold differences</caption>
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wider text-fg-subtle">
                    <th scope="col" className="py-2 pr-4 font-medium">From score</th>
                    <th scope="col" className="py-2 pr-4 font-medium">SANDBOX</th>
                    <th scope="col" className="py-2 pr-4 font-medium">LIVE</th>
                    <th scope="col" className="py-2 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {diffs.map((d) => (
                    <tr key={d.minimum_score}>
                      <td className="py-2 pr-4 font-mono text-fg-muted">{d.minimum_score}</td>
                      <td className="py-2 pr-4 text-fg">{d.kind === "same" ? d.value : d.kind === "added" ? "Not set" : d.sandbox}</td>
                      <td className="py-2 pr-4 text-fg">{d.kind === "same" ? d.value : d.kind === "removed" ? "Not set" : d.live}</td>
                      <td className="py-2">
                        <Badge variant={DIFF_BADGE[d.kind].variant}>{DIFF_BADGE[d.kind].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {canCreate && sandboxQuery.data ? (
            <div className="mt-3">
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <Copy size={14} aria-hidden="true" />
                Copy SANDBOX policy to a LIVE draft
              </Button>
            </div>
          ) : null}
          {result ? (
            <Alert variant="success" className="mt-3" title="LIVE draft created">
              Copied {result.summary.copied_threshold_count} row(s) from SANDBOX version {result.summary.source_version} into a LIVE
              draft (version {result.draft.version}). SANDBOX is unchanged. To use it, pick LIVE below and turn the draft on.
            </Alert>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next)
          if (!next) setError(null)
        }}
        title="Copy to a LIVE draft?"
        description="This makes a LIVE draft with the same rows as your SANDBOX policy. Nothing is turned on and SANDBOX does not change."
        confirmLabel="Create LIVE draft"
        pending={copy.isPending}
        error={error}
        onConfirm={async () => {
          if (!sandboxQuery.data) return
          setError(null)
          try {
            setResult(
              await copy.mutateAsync({
                source_environment: "sandbox",
                source_version_id: sandboxQuery.data.id,
                target_environment: "live",
                reason: "Copied from SANDBOX via Compare environments",
              }),
            )
            setConfirmOpen(false)
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Copy failed.")
          }
        }}
      />
    </Card>
  )
}
