import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { AssessmentVolumeChart, BarList, RiskActivityChart } from "@/components/app/charts"
import { ChartCard, ChartPlaceholder } from "@/components/app/chart-card"
import { MetricCard } from "@/components/app/metric-card"
import { PageHeader } from "@/components/app/page-header"
import { SampleBadge, SampleDataBanner, SampleToggle } from "@/components/fd/sample-data"
import { DataTable } from "@/components/ui/data-table"
import { ErrorState } from "@/components/ui/states"
import { useAssessmentAnalytics } from "@/hooks/use-analytics"
import { useSampleClock } from "@/hooks/use-sample-clock"
import { useSampleMode } from "@/hooks/use-sample-mode"
import type { AnalyticsOut, EnvironmentName } from "@/lib/api/types"
import { parseReasonCode } from "@/lib/fraud/reason"
import { sampleAssessments, summarize } from "@/lib/fraud/sample"
import { RECOMMENDATION_STYLES, SEVERITY_STYLES, type Recommendation, type Severity } from "@/lib/fraud/vocabulary"
import { cn } from "@/lib/utils"

const REC_BARS: Record<Recommendation, string> = {
  PROCEED: "bg-ok",
  STEP_UP: "bg-info",
  REVIEW: "bg-warn",
  BLOCK: "bg-danger",
}

const RANGE_OPTIONS = [7, 30, 90] as const
type RangeDays = (typeof RANGE_OPTIONS)[number]
/** Wave 41's own documented default range (matches the backend's own default exactly — see
 * fraud-platform-api/app/services/analytics_service.py::DEFAULT_RANGE_DAYS). Selecting it
 * omits `created_after` entirely rather than computing an equivalent client-side, so the
 * backend's own default is always the single source of truth. */
const DEFAULT_RANGE: RangeDays = 30

function readRange(value: string | null): RangeDays {
  const n = Number(value)
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : DEFAULT_RANGE
}

function readEnvironment(value: string | null): EnvironmentName | null {
  return value === "sandbox" || value === "live" ? value : null
}

function ToggleGroup<T extends string | number | null>({
  label,
  options,
  value,
  labelFor,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  labelFor: (option: T) => string
  onChange: (next: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-control border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
            value === option
              ? "border-accent/50 bg-accent-soft text-accent"
              : "border-line-strong text-fg-muted hover:bg-panel-hover hover:text-fg",
          )}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  )
}

function countsByKey<K extends string>(items: { count: number }[], key: K): Record<string, number> {
  return Object.fromEntries(items.map((item) => [(item as unknown as Record<K, string>)[key], item.count]))
}

export function Analytics() {
  const sample = useSampleMode()
  const now = useSampleClock()
  const sampleSummary = useMemo(() => {
    if (!sample.enabled) return null
    return summarize(sampleAssessments(now), now)
  }, [sample.enabled, now])

  const [searchParams, setSearchParams] = useSearchParams()
  const environment = readEnvironment(searchParams.get("environment"))
  const range = readRange(searchParams.get("range"))
  const createdAfter = useMemo(
    () => (range === DEFAULT_RANGE ? undefined : new Date(now - range * 86_400_000).toISOString()),
    [range, now],
  )

  const analyticsQuery = useAssessmentAnalytics(
    { environment: environment ?? undefined, created_after: createdAfter },
    !sample.enabled,
  )

  const selectEnvironment = (next: EnvironmentName | null) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === null) params.delete("environment")
        else params.set("environment", next)
        return params
      },
      { replace: true },
    )
  }

  const selectRange = (next: RangeDays) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === DEFAULT_RANGE) params.delete("range")
        else params.set("range", String(next))
        return params
      },
      { replace: true },
    )
  }

  const data = analyticsQuery.data

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="How many payments you sent us, how risky they looked, and what your policy recommended."
        badges={sampleSummary ? <SampleBadge /> : undefined}
        action={<SampleToggle enabled={sample.enabled} onChange={sample.setEnabled} />}
      />

      {sampleSummary ? (
        <>
          <SampleDataBanner />

          <section aria-label="Volume" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Assessments" state={{ kind: "value", value: sampleSummary.total, sample: true }} />
            <MetricCard label="High risk" tone="danger" state={{ kind: "value", value: sampleSummary.byBand.HIGH, sample: true }} />
            <MetricCard label="Flagged for review" tone="warn" state={{ kind: "value", value: sampleSummary.byRecommendation.REVIEW, sample: true }} />
            <MetricCard label="Block" tone="danger" state={{ kind: "value", value: sampleSummary.byRecommendation.BLOCK, sample: true }} />
          </section>

          <ChartCard title="Assessment volume and risk trend" description="Assessments per day by risk band" aside={<SampleBadge />}>
            <RiskActivityChart summary={sampleSummary} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Risk distribution" aside={<SampleBadge />}>
              <BarList
                ariaLabel="Risk distribution (sample data)"
                items={(["HIGH", "MEDIUM", "LOW"] as Severity[]).map((band) => ({
                  key: band,
                  label: SEVERITY_STYLES[band].label,
                  value: sampleSummary.byBand[band],
                  barClass: SEVERITY_STYLES[band].bar,
                }))}
              />
            </ChartCard>

            <ChartCard title="Policy recommendation distribution" aside={<SampleBadge />}>
              <BarList
                ariaLabel="Policy recommendation distribution (sample data)"
                items={(Object.keys(REC_BARS) as Recommendation[]).map((rec) => ({
                  key: rec,
                  label: RECOMMENDATION_STYLES[rec].label,
                  value: sampleSummary.byRecommendation[rec],
                  barClass: REC_BARS[rec],
                }))}
              />
            </ChartCard>

            <ChartCard title="Rule firing frequency" description="Assessments each rule fired on" aside={<SampleBadge />}>
              <BarList
                ariaLabel="Rule firing frequency (sample data)"
                total={sampleSummary.total}
                items={sampleSummary.topRules.map((rule) => {
                  const parsed = parseReasonCode(rule.code)
                  return { key: rule.code, label: parsed.ruleName ?? parsed.summary, hint: parsed.ruleId ?? undefined, value: rule.count }
                })}
              />
            </ChartCard>

            <div className="grid gap-4">
              <ChartCard title="Telemetry quality">
                <ChartPlaceholder kind="unavailable">Not available yet.</ChartPlaceholder>
              </ChartCard>
              <ChartCard title="Assessment outcomes">
                <ChartPlaceholder kind="unavailable">Not available yet. Later you&apos;ll be able to mark payments as fraud or genuine.</ChartPlaceholder>
              </ChartCard>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <ToggleGroup
              label="Environment"
              options={[null, "sandbox", "live"] as const}
              value={environment}
              labelFor={(v) => (v === null ? "SANDBOX and LIVE" : v === "sandbox" ? "SANDBOX only" : "LIVE only")}
              onChange={selectEnvironment}
            />
            <ToggleGroup
              label="Date range"
              options={RANGE_OPTIONS}
              value={range}
              labelFor={(v) => `Last ${v} days`}
              onChange={selectRange}
            />
          </div>

          {analyticsQuery.isPending ? (
            <ChartCard title="Analytics">
              <ChartPlaceholder kind="loading" />
            </ChartCard>
          ) : analyticsQuery.isError ? (
            <ChartCard title="Analytics">
              <ErrorState what="analytics" error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
            </ChartCard>
          ) : data ? (
            <AnalyticsDashboard data={data} />
          ) : null}
        </>
      )}
    </div>
  )
}

function AnalyticsDashboard({ data }: { data: AnalyticsOut }) {
  const riskCounts = countsByKey(data.risk_band_distribution, "risk_band")
  const recCounts = countsByKey(data.recommendation_distribution, "recommendation")
  const statusCounts = countsByKey(data.status_distribution, "status")
  const envCounts = countsByKey(data.environment_distribution, "environment")

  return (
    <>
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Assessments" state={{ kind: "value", value: data.summary.total_assessments }} hint={`${formatDate(data.range_start)} – ${formatDate(data.range_end)}`} />
        <MetricCard
          label="Failed checks"
          tone={data.summary.failure_rate && data.summary.failure_rate > 0 ? "warn" : "default"}
          state={data.summary.failure_rate === null ? { kind: "unavailable" } : { kind: "value", value: Math.round(data.summary.failure_rate * 100) }}
          hint="% that couldn't be checked because of an error (not fraud)"
        />
        <MetricCard
          label="Average response time"
          state={data.latency.avg_ms === null ? { kind: "unavailable" } : { kind: "value", value: Math.round(data.latency.avg_ms) }}
          hint={`milliseconds, over ${data.latency.sample_size} finished check${data.latency.sample_size === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Completed"
          state={{ kind: "value", value: data.summary.completed_count }}
          hint={`${data.summary.processing_count} still running, ${data.summary.failed_count} failed`}
        />
      </section>

      <ChartCard title="Checks per day" description="Days are in UTC">
        {data.time_series.points.length === 0 ? (
          <ChartPlaceholder kind="empty">No checks in this period.</ChartPlaceholder>
        ) : (
          <AssessmentVolumeChart
            ariaLabel={`Assessments per day for the selected range, ${data.time_series.points.length} days with activity`}
            points={data.time_series.points.map((p) => ({ bucketStart: p.bucket_start, count: p.count }))}
          />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Risk levels">
          {data.risk_band_distribution.length === 0 ? (
            <ChartPlaceholder kind="empty">No checks in this period.</ChartPlaceholder>
          ) : (
            <BarList
              ariaLabel="Risk distribution"
              items={(["LOW", "MEDIUM", "HIGH", "UNAVAILABLE"] as const)
                .filter((band) => riskCounts[band] !== undefined)
                .map((band) => ({
                  key: band,
                  label: band === "UNAVAILABLE" ? "Not available" : SEVERITY_STYLES[band].label,
                  value: riskCounts[band],
                  barClass: band === "UNAVAILABLE" ? "bg-line-strong" : SEVERITY_STYLES[band].bar,
                  hint: band === "UNAVAILABLE" ? "still running, failed, or couldn't be checked" : undefined,
                }))}
            />
          )}
        </ChartCard>

        <ChartCard title="What your policy recommended">
          {data.recommendation_distribution.length === 0 ? (
            <ChartPlaceholder kind="empty">No checks in this period.</ChartPlaceholder>
          ) : (
            <BarList
              ariaLabel="Policy recommendation distribution"
              items={(["PROCEED", "STEP_UP", "REVIEW", "BLOCK", "UNAVAILABLE"] as const)
                .filter((rec) => recCounts[rec] !== undefined)
                .map((rec) => ({
                  key: rec,
                  label: rec === "UNAVAILABLE" ? "Not available" : RECOMMENDATION_STYLES[rec].label,
                  value: recCounts[rec],
                  barClass: rec === "UNAVAILABLE" ? "bg-line-strong" : REC_BARS[rec],
                  hint: rec === "UNAVAILABLE" ? "no policy was turned on, or the check failed" : undefined,
                }))}
            />
          )}
        </ChartCard>

        <ChartCard title="Check status">
          {data.status_distribution.length === 0 ? (
            <ChartPlaceholder kind="empty">No checks in this period.</ChartPlaceholder>
          ) : (
            <BarList
              ariaLabel="Assessment status distribution"
              items={(["completed", "processing", "failed"] as const)
                .filter((status) => statusCounts[status] !== undefined)
                .map((status) => ({
                  key: status,
                  label: status === "completed" ? "Finished" : status === "processing" ? "Still running" : "Failed",
                  value: statusCounts[status],
                  barClass: status === "completed" ? "bg-ok" : status === "processing" ? "bg-line-strong" : "bg-warn",
                }))}
            />
          )}
        </ChartCard>

        <ChartCard title="SANDBOX vs LIVE" description="Always shows both, whatever you picked above">
          {data.environment_distribution.length === 0 ? (
            <ChartPlaceholder kind="empty">No checks in this period.</ChartPlaceholder>
          ) : (
            <BarList
              ariaLabel="Environment distribution"
              items={(["sandbox", "live"] as const)
                .filter((env) => envCounts[env] !== undefined)
                .map((env) => ({ key: env, label: env === "sandbox" ? "Sandbox" : "Live", value: envCounts[env] }))}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Policy versions used" description="How many checks used each version of your policy">
        {data.policy_version_distribution.length === 0 ? (
          <ChartPlaceholder kind="empty">No checks in this period.</ChartPlaceholder>
        ) : (
          <DataTable
            caption="Policy version usage"
            rows={data.policy_version_distribution}
            getRowKey={(row) => `${row.policy_id ?? "none"}-${row.policy_version ?? "none"}`}
            columns={[
              {
                key: "policy",
                header: "Policy",
                cell: (row) =>
                  row.policy_id ? (
                    <span className="font-mono text-xs text-fg">{row.policy_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="text-fg-subtle">No policy turned on</span>
                  ),
              },
              { key: "version", header: "Version", cell: (row) => (row.policy_version ? <span className="font-mono text-fg">v{row.policy_version}</span> : <span className="text-fg-subtle">None</span>) },
              { key: "count", header: "Checks", cell: (row) => row.count, className: "tabular-nums" },
            ]}
          />
        )}
      </ChartCard>
    </>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
}
