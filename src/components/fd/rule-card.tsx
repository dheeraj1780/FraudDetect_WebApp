import { RuleStateBadge } from "@/components/fd/risk-badge"
import type { ParsedReason } from "@/lib/fraud/reason"
import { cn } from "@/lib/utils"

/**
 * One triggered rule, as far as the public response lets us describe it: the reason code,
 * and — derived from that code and the frozen catalogue — rule id, name and family.
 * Evidence, threshold, observed value and contribution are NOT in the API response, so
 * this card never shows them.
 */
export function RuleCard({ reason, className }: { reason: ParsedReason; className?: string }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-panel border border-line bg-panel-raised/50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {reason.familyId ? (
            <span className="rounded-control border border-line-strong px-1.5 py-px font-mono text-[11px] text-fg-muted">
              {reason.familyId}
            </span>
          ) : null}
          <p className="text-sm font-medium text-fg">{reason.ruleName ?? reason.summary}</p>
        </div>
        <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {reason.ruleId ? (
            <div className="flex gap-1.5">
              <dt className="text-fg-subtle">Rule</dt>
              <dd className="font-mono text-fg-muted">{reason.ruleId}</dd>
            </div>
          ) : null}
          {reason.familyLabel ? (
            <div className="flex gap-1.5">
              <dt className="text-fg-subtle">Family</dt>
              <dd className="text-fg-muted">{reason.familyLabel}</dd>
            </div>
          ) : null}
          <div className="flex min-w-0 max-w-full gap-1.5">
            <dt className="shrink-0 text-fg-subtle">Reason code</dt>
            <dd className="min-w-0 break-all font-mono text-fg-muted">{reason.code}</dd>
          </div>
        </dl>
      </div>
      <RuleStateBadge state="TRIGGERED" className="self-start" />
    </li>
  )
}
