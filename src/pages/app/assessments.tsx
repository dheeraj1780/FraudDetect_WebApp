import { FileJson, FlaskConical, SearchX } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { AssessmentStatusBadge, EvaluationStateBadge, RecommendationBadge, RiskBadge } from "@/components/fd/risk-badge"
import { SampleBadge, SampleDataBanner, SampleToggle } from "@/components/fd/sample-data"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { OffsetPagination, Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { useAssessmentListFilters } from "@/hooks/use-assessment-list-filters"
import { useAssessments } from "@/hooks/use-assessments"
import { useSampleClock } from "@/hooks/use-sample-clock"
import { useSampleMode } from "@/hooks/use-sample-mode"
import type { AssessmentListItemOut, AssessmentOut } from "@/lib/api/types"
import { sampleAssessments } from "@/lib/fraud/sample"
import { RECOMMENDATION_STYLES, SEVERITY_STYLES, type Recommendation, type Severity } from "@/lib/fraud/vocabulary"

const PAGE_SIZE = 12

/** The real backend's default/approved page size (fraud-platform-api/app/api/v1/assessments.py) —
 * kept equal to it rather than inventing a different number. */
const LIST_PAGE_SIZE = 20

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

/**
 * The real, session-authenticated assessment list (GET /api/v1/assessments, Wave 34B). Filters and
 * the pagination offset live in the URL (`useAssessmentListFilters`, Wave 36) — not local React
 * state — so a refresh, a copied link, or browser back/forward all reproduce the same view. The
 * backend's own contract is offset/limit/has_more (Wave 34B's own documented, deliberate choice —
 * there is no cursor concept anywhere in this API), so that is exactly what's synced; no page-number
 * or cursor abstraction is invented on top of it.
 */
function RealAssessmentList() {
  const { filters, setFilter, setOffset, clearFilters } = useAssessmentListFilters()
  const { environment, riskBand, recommendation, createdAfter, createdBefore, offset } = filters

  const params = useMemo(
    () => ({
      environment: environment || undefined,
      risk_band: riskBand || undefined,
      recommendation: recommendation || undefined,
      created_after: createdAfter ? new Date(createdAfter).toISOString() : undefined,
      created_before: createdBefore ? new Date(createdBefore).toISOString() : undefined,
      limit: LIST_PAGE_SIZE,
      offset,
    }),
    [environment, riskBand, recommendation, createdAfter, createdBefore, offset],
  )
  const filtersActive = Boolean(environment || riskBand || recommendation || createdAfter || createdBefore)
  const query = useAssessments(params)

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36">
          <Select label="Environment" value={environment} onChange={(e) => setFilter("environment", e.target.value)}>
            <option value="">All environments</option>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </Select>
        </div>
        <div className="w-40">
          <Select label="Risk band" value={riskBand} onChange={(e) => setFilter("riskBand", e.target.value)}>
            <option value="">All bands</option>
            {(["HIGH", "MEDIUM", "LOW"] as Severity[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_STYLES[s].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <Select
            label="Policy recommendation"
            value={recommendation}
            onChange={(e) => setFilter("recommendation", e.target.value)}
          >
            <option value="">All recommendations</option>
            {(Object.keys(RECOMMENDATION_STYLES) as Recommendation[]).map((r) => (
              <option key={r} value={r}>
                {RECOMMENDATION_STYLES[r].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="created-after" className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            From
          </label>
          <input
            id="created-after"
            type="datetime-local"
            value={createdAfter}
            onChange={(e) => setFilter("createdAfter", e.target.value)}
            className="h-9 rounded-control border border-line-strong bg-canvas px-2 text-[13px] text-fg transition-colors hover:border-accent/50 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="created-before" className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            To
          </label>
          <input
            id="created-before"
            type="datetime-local"
            value={createdBefore}
            onChange={(e) => setFilter("createdBefore", e.target.value)}
            className="h-9 rounded-control border border-line-strong bg-canvas px-2 text-[13px] text-fg transition-colors hover:border-accent/50 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>
        {filtersActive ? (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {query.isPending ? (
        <LoadingState label="Loading assessments…" />
      ) : query.isError ? (
        <ErrorState what="assessments" error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={filtersActive ? SearchX : FileJson}
          title={filtersActive ? "No assessments match these filters" : "No assessments yet"}
          description={
            filtersActive
              ? "Clear a filter to see more."
              : "Assessments appear here once your integration calls POST /assessments with an API credential."
          }
          action={
            filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-panel">
          <DataTable<AssessmentListItemOut>
            className="rounded-none border-0"
            caption="Assessments"
            rows={query.data.items}
            getRowKey={(a) => a.assessment_id}
            columns={[
              {
                key: "id",
                header: "Assessment ID",
                cell: (a) => (
                  <Link
                    to={`/app/assessments/${a.assessment_id}`}
                    className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                  >
                    {a.assessment_id}
                  </Link>
                ),
              },
              { key: "time", header: "Submitted", cell: (a) => <span className="whitespace-nowrap text-fg-muted">{formatTime(a.submitted_at)}</span> },
              { key: "env", header: "Environment", secondary: true, cell: (a) => <span className="capitalize text-fg">{a.environment}</span> },
              { key: "status", header: "Status", cell: (a) => <AssessmentStatusBadge status={a.status} /> },
              { key: "score", header: "Risk score", cell: (a) => <span className="font-mono">{a.risk_score ?? "—"}</span> },
              { key: "band", header: "Risk band", cell: (a) => <RiskBadge band={a.risk_band} /> },
              { key: "rec", header: "Recommendation", cell: (a) => <RecommendationBadge value={a.policy?.recommendation ?? null} /> },
              { key: "state", header: "Evaluation", secondary: true, cell: (a) => <EvaluationStateBadge state={a.evaluation_state} /> },
              { key: "reasons", header: "Reasons", secondary: true, cell: (a) => <span className="font-mono text-fg-muted">{a.reason_count}</span>, className: "md:text-right" },
            ]}
          />
          <OffsetPagination
            hasPrevious={offset > 0}
            hasNext={query.data.has_more}
            onPrevious={() => setOffset(Math.max(0, offset - LIST_PAGE_SIZE))}
            onNext={() => setOffset(offset + LIST_PAGE_SIZE)}
            rangeLabel={`Showing ${offset + 1}–${offset + query.data.items.length}`}
          />
        </div>
      )}
    </>
  )
}

export function Assessments() {
  const sample = useSampleMode()
  const now = useSampleClock()
  const [band, setBand] = useState<"" | Severity>("")
  const [recommendation, setRecommendation] = useState<"" | Recommendation>("")
  const [page, setPage] = useState(1)

  const all = useMemo(() => (sample.enabled ? sampleAssessments(now) : []), [sample.enabled, now])
  const filtered = useMemo(
    () =>
      all.filter(
        (a) => (band === "" || a.risk_band === band) && (recommendation === "" || a.policy.recommendation === recommendation),
      ),
    [all, band, recommendation],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        title="Assessments"
        description="Risk assessments produced by the engine, one per evaluated payment or event."
        badges={sample.enabled ? <SampleBadge /> : undefined}
        action={<SampleToggle enabled={sample.enabled} onChange={sample.setEnabled} />}
      />

      {sample.enabled ? (
        <>
          <SampleDataBanner />

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select
                label="Risk band"
                value={band}
                onChange={(e) => {
                  setBand(e.target.value as "" | Severity)
                  setPage(1)
                }}
              >
                <option value="">All bands</option>
                {(["HIGH", "MEDIUM", "LOW"] as Severity[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_STYLES[s].label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-52">
              <Select
                label="Policy recommendation"
                value={recommendation}
                onChange={(e) => {
                  setRecommendation(e.target.value as "" | Recommendation)
                  setPage(1)
                }}
              >
                <option value="">All recommendations</option>
                {(Object.keys(RECOMMENDATION_STYLES) as Recommendation[]).map((r) => (
                  <option key={r} value={r}>
                    {RECOMMENDATION_STYLES[r].label}
                  </option>
                ))}
              </Select>
            </div>
            <p className="ml-auto text-xs text-fg-subtle" role="status">
              {filtered.length} of {all.length} sample assessments
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No sample assessments match these filters"
              description="Clear a filter to see more."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setBand("")
                    setRecommendation("")
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-panel border border-line bg-panel">
              <DataTable<AssessmentOut>
                className="rounded-none border-0"
                caption="Sample assessments"
                rows={rows}
                getRowKey={(a) => a.assessment_id}
                columns={[
                  {
                    key: "id",
                    header: "Assessment ID",
                    cell: (a) => (
                      <Link
                        to={`/app/assessments/sample/${a.assessment_id}`}
                        className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {a.assessment_id}
                      </Link>
                    ),
                  },
                  { key: "time", header: "Time", cell: (a) => <span className="whitespace-nowrap text-fg-muted">{formatTime(a.submitted_at)}</span> },
                  { key: "score", header: "Risk score", cell: (a) => <span className="font-mono">{a.risk_score}</span> },
                  { key: "band", header: "Risk band", cell: (a) => <RiskBadge band={a.risk_band} /> },
                  { key: "rec", header: "Recommendation", cell: (a) => <RecommendationBadge value={a.policy.recommendation} /> },
                  { key: "state", header: "Evaluation", secondary: true, cell: (a) => <EvaluationStateBadge state={a.evaluation_state} /> },
                  { key: "reasons", header: "Reasons", secondary: true, cell: (a) => <span className="font-mono text-fg-muted">{a.reasons.length}</span>, className: "md:text-right" },
                ]}
              />
              <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
            </div>
          )}

          <p className="text-xs text-fg-subtle">
            Sample data has its own simplified filter set. Turn sample data off to filter your real assessments by
            environment and date range too.
          </p>
        </>
      ) : (
        <RealAssessmentList />
      )}
    </div>
  )
}
