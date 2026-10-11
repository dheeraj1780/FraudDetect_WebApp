import { Lock, SearchX } from "lucide-react"
import { useMemo, useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { Alert } from "@/components/ui/alert"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { CATALOGUE_FAMILIES } from "@/data/fraud-detect/catalogue"
import { FAMILY_META } from "@/data/fraud-detect/families"
import { cn } from "@/lib/utils"

interface RuleRow {
  id: string
  name: string
  familyId: string
  familyLabel: string
}

const ALL_RULES: RuleRow[] = CATALOGUE_FAMILIES.flatMap((family) => {
  const meta = FAMILY_META.find((m) => m.id === family.id)
  return family.rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    familyId: family.id,
    familyLabel: meta?.label ?? family.catalogueName,
  }))
})

export function Rules() {
  const [family, setFamily] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_RULES.filter(
      (r) => (family === null || r.familyId === family) && (q === "" || r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
    )
  }, [family, query])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        title="Rules"
        description="The warning signs we can look for, grouped by type. When one is found, it adds points to the risk score."
      />

      <Alert variant="info" title="For reference">
        <p>
          This is the full list of rules. Not every rule is switched on for your account, and you can&apos;t change rules
          here. To see which rules fired for a payment, open it from the Assessments page.
        </p>
      </Alert>

      <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={family === null}
          onClick={() => setFamily(null)}
          className={cn(
            "rounded-control border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
            family === null ? "border-accent/50 bg-accent-soft text-accent" : "border-line-strong text-fg-muted hover:bg-panel-hover hover:text-fg",
          )}
        >
          All types <span className="font-mono text-fg-subtle">{ALL_RULES.length}</span>
        </button>
        {FAMILY_META.map((meta) => {
          const count = ALL_RULES.filter((r) => r.familyId === meta.id).length
          const active = family === meta.id
          return (
            <button
              key={meta.id}
              type="button"
              aria-pressed={active}
              title={meta.scope}
              onClick={() => setFamily(active ? null : meta.id)}
              className={cn(
                "rounded-control border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                active ? "border-accent/50 bg-accent-soft text-accent" : "border-line-strong text-fg-muted hover:bg-panel-hover hover:text-fg",
              )}
            >
              {meta.label} <span className="font-mono text-fg-subtle">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm">
          <label htmlFor="rule-search" className="sr-only">
            Search rules by id or name
          </label>
          <Input
            id="rule-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by rule id or name"
            className="h-9"
          />
        </div>
        <p role="status" className="text-xs text-fg-subtle">
          {rows.length} of {ALL_RULES.length} rules
        </p>
        <p className="ml-auto flex items-center gap-1.5 text-xs text-fg-subtle">
          <Lock size={12} aria-hidden="true" /> Catalogue frozen · read-only
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No rules match" description="Try a different search or pick “All types”." />
      ) : (
        <DataTable<RuleRow>
          caption="Rule catalogue"
          rows={rows}
          getRowKey={(r) => r.id}
          columns={[
            { key: "id", header: "Rule ID", cell: (r) => <span className="font-mono text-xs text-fg">{r.id}</span>, className: "whitespace-nowrap" },
            { key: "name", header: "Name", cell: (r) => <span className="text-fg">{r.name}</span> },
            {
              key: "family",
              header: "Family",
              cell: (r) => (
                <span className="flex items-center gap-2 text-fg-muted">
                  <span className="rounded-control border border-line-strong px-1.5 py-px font-mono text-[11px]">{r.familyId}</span>
                  {r.familyLabel}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
