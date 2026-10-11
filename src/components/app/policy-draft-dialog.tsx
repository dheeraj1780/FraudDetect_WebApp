import { ChevronDown, Plus, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useCreatePolicyDraft } from "@/hooks/use-policies"
import { ApiError } from "@/lib/api/errors"
import type { EnvironmentName, PolicyThreshold, PolicyVersionOut } from "@/lib/api/types"
import { RECOMMENDATION_STYLES, type Recommendation } from "@/lib/fraud/vocabulary"

const DEFAULT_THRESHOLDS: PolicyThreshold[] = [
  { minimum_score: 0, recommendation: "PROCEED" },
  { minimum_score: 40, recommendation: "STEP_UP" },
  { minimum_score: 70, recommendation: "REVIEW" },
  { minimum_score: 90, recommendation: "BLOCK" },
]

interface PolicyDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  environment: EnvironmentName
  /** Set when authoring the next version of an existing lineage; omitted starts a new one. */
  policyId?: string
  onCreated: (version: PolicyVersionOut) => void
}

export function PolicyDraftDialog({ open, onOpenChange, environment, policyId, onCreated }: PolicyDraftDialogProps) {
  const [thresholds, setThresholds] = useState<PolicyThreshold[]>(DEFAULT_THRESHOLDS)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const createDraft = useCreatePolicyDraft()

  const updateRow = (index: number, patch: Partial<PolicyThreshold>) => {
    setThresholds((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  const addRow = () => setThresholds((rows) => [...rows, { minimum_score: 0, recommendation: "PROCEED" }])
  const removeRow = (index: number) => setThresholds((rows) => rows.filter((_, i) => i !== index))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const created = await createDraft.mutateAsync({
        environment,
        thresholds,
        policy_id: policyId ?? null,
        reason: reason.trim() || null,
      })
      setThresholds(DEFAULT_THRESHOLDS)
      setReason("")
      onOpenChange(false)
      onCreated(created)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{policyId ? "Draft a new policy version" : "Create a new policy"}</DialogTitle>
        <DialogDescription>
          {policyId
            ? "A new DRAFT version in this policy's history. It has no effect until you activate it."
            : `A new DRAFT policy, scoped to your ${environment} environment. It has no effect until you activate it.`}
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Thresholds</p>
            <p className="text-xs text-fg-subtle">
              Unique, ascending minimum scores (0–100). The lowest must be 0 or below so every score maps to a
              recommendation.
            </p>
            <div className="flex gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              <span className="w-28">Minimum score</span>
              <span className="flex-1">Recommendation</span>
            </div>
            {thresholds.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-28">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    aria-label={`Minimum score for row ${index + 1}`}
                    value={row.minimum_score}
                    onChange={(e) => updateRow(index, { minimum_score: Number(e.target.value) })}
                    disabled={createDraft.isPending}
                  />
                </div>
                <div className="relative flex-1">
                  <select
                    aria-label={`Recommendation for row ${index + 1}`}
                    value={row.recommendation}
                    onChange={(e) => updateRow(index, { recommendation: e.target.value })}
                    disabled={createDraft.isPending}
                    className="h-10 w-full appearance-none rounded-control border border-line-strong bg-canvas pl-3 pr-8 text-sm text-fg transition-colors hover:border-accent/50 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-panel disabled:text-fg-subtle"
                  >
                    {(Object.keys(RECOMMENDATION_STYLES) as Recommendation[]).map((r) => (
                      <option key={r} value={r}>
                        {RECOMMENDATION_STYLES[r].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove row ${index + 1}`}
                  onClick={() => removeRow(index)}
                  disabled={createDraft.isPending || thresholds.length <= 1}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addRow} disabled={createDraft.isPending} className="self-start">
              <Plus size={14} aria-hidden="true" />
              Add threshold
            </Button>
          </div>

          <Input
            aria-label="Reason (optional)"
            placeholder="Reason (optional) — recorded on the audit log"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={createDraft.isPending}
          />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={createDraft.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDraft.isPending}>
              {createDraft.isPending ? <Spinner /> : null}
              Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
