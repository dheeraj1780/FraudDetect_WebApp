import { CheckCircle2, Circle, Clock, KeyRound, ScrollText } from "lucide-react"
import { useMemo, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { AssessmentVolumeChart, BarList, RiskActivityChart } from "@/components/app/charts"
import { ChartCard, ChartPlaceholder } from "@/components/app/chart-card"
import { MetricCard, type MetricState } from "@/components/app/metric-card"
import { PageHeader } from "@/components/app/page-header"
import { AssessmentStatusBadge, RecommendationBadge, RiskBadge } from "@/components/fd/risk-badge"
import { SampleBadge, SampleDataBanner, SampleToggle } from "@/components/fd/sample-data"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ErrorState } from "@/components/ui/states"
import { Spinner } from "@/components/ui/spinner"
import { useAssessmentAnalytics } from "@/hooks/use-analytics"
import { useAssessments } from "@/hooks/use-assessments"
import { useAuditLogs } from "@/hooks/use-audit-logs"
import { useCredentials } from "@/hooks/use-credentials"
import { useMembers } from "@/hooks/use-members"
import { useSampleClock } from "@/hooks/use-sample-clock"
import { useSampleMode } from "@/hooks/use-sample-mode"
import { describeAuditAction } from "@/lib/audit-actions"
import { useAuth } from "@/lib/auth/context"
import type {
  AnalyticsOut,
  AssessmentListItemOut,
  AssessmentOut,
  RecommendationCountOut,
  RiskBandCountOut,
} from "@/lib/api/types"
import { parseReasonCode } from "@/lib/fraud/reason"
import { sampleAssessments, SAMPLE_DAYS, summarize, type SampleSummary } from "@/lib/fraud/sample"
import { RECOMMENDATION_STYLES, SEVERITY_STYLES, type Recommendation, type Severity } from "@/lib/fraud/vocabulary"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function Overview() {
  const { user, tenant } = useAuth()
  const credentialsQuery = useCredentials()
  const membersQuery = useMembers()
  // The newest 100 events: enough for "Recent activity" and today's count (shown as a lower bound,
  // e.g. "100+", when the whole page is from today and the API reports more).
  const auditQuery = useAuditLogs({ limit: 100 })
  const auditItems = auditQuery.data?.items
  const sample = useSampleMode()
  const now = useSampleClock()

  const activeCredentialCount = credentialsQuery.data?.filter((c) => c.status === "active").length ?? 0
  const myMembership = membersQuery.data?.find((m) => m.user_id === user?.id)

  const sampleData = useMemo(() => {
    if (!sample.enabled) return null
    const assessments = sampleAssessments(now)
    return { assessments, summary: summarize(assessments, now) }
  }, [sample.enabled, now])

  const recentAudit = [...(auditItems ?? [])]
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, 5)

  /**
   * Wave 33B: the one real, derived (never fabricated) activity metric Wave 33A's own audit found
   * safe to add -- a count of audit-log rows (GET /audit-logs, already fetched by this page for the
   * "Recent activity" card below) whose own `occurred_at` falls on today's calendar date. This is
   * deliberately generic ("activity", not "transactions"/"assessments"/"fraud") because the audit
   * log's own closed action vocabulary (app/services/*.py's write_audit_log call sites) mixes
   * administrative events (credential/tenant/login) with assessment outcomes -- counting all of them
   * together, honestly labeled as activity, avoids any claim this represents transaction or fraud
   * volume specifically. `null` while loading or on error -- NEVER a fabricated 0 standing in for
   * "we don't actually know" (the real, verified zero case below is a DIFFERENT, correctly-reached
   * state: the query succeeded and genuinely returned no rows for today).
   */
  const activityToday = useMemo(() => {
    if (!auditQuery.data) return null
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const cutoff = startOfToday.getTime()
    const count = auditQuery.data.items.filter((log) => {
      const occurred = Date.parse(log.occurred_at)
      return !Number.isNaN(occurred) && occurred >= cutoff
    }).length
    // Every row on the page is from today and the API has more: the true count is at least this.
    const lowerBound = auditQuery.data.has_more && count === auditQuery.data.items.length
    return lowerBound ? `${count}+` : String(count)
  }, [auditQuery.data])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Overview"
        description={
          sampleData
            ? `Example figures for the last ${SAMPLE_DAYS} days.`
            : "Your checks from the last 30 days, in SANDBOX and LIVE together."
        }
        action={<SampleToggle enabled={sample.enabled} onChange={sample.setEnabled} />}
      />

      {sampleData ? (
        <>
          <SampleDataBanner />
          <SampleOverview data={sampleData} />
        </>
      ) : (
        <RealOverview />
      )}

      <section aria-labelledby="workspace-heading" className="flex flex-col gap-3">
        <h2 id="workspace-heading" className="text-sm font-semibold text-fg">
          Your workspace
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardTitle>Organization</CardTitle>
            {tenant ? (
              <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Name</dt>
                  <dd className="font-medium text-fg">{tenant.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Created</dt>
                  <dd className="text-fg-muted">{formatDate(tenant.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Your role</dt>
                  <dd className="capitalize text-fg-muted">{myMembership?.role ?? "Unknown"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Members</dt>
                  <dd className="text-fg-muted">
                    {membersQuery.isPending ? <Spinner size={14} /> : membersQuery.isError ? "Unknown" : membersQuery.data.length}
                  </dd>
                </div>
              </dl>
            ) : (
              <CardDescription className="mt-3">Not available.</CardDescription>
            )}
          </Card>

          <Card>
            <CardTitle>Environments</CardTitle>
            <ul className="mt-3 flex flex-col gap-3 text-[13px]">
              <li className="flex items-center justify-between gap-4">
                <span className="text-fg">Sandbox</span>
                {credentialsQuery.isPending ? (
                  <Spinner size={14} />
                ) : credentialsQuery.isError ? (
                  <Badge variant="outline">Unknown</Badge>
                ) : activeCredentialCount > 0 ? (
                  <Badge variant="success">
                    <CheckCircle2 size={12} aria-hidden="true" /> Credentials issued
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Circle size={12} aria-hidden="true" /> No credentials yet
                  </Badge>
                )}
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="text-fg">Live</span>
                <Badge variant="outline" title="You can create LIVE keys after FraudDetect approves your LIVE access and a LIVE policy is turned on. See the LIVE access page.">
                  <Clock size={12} aria-hidden="true" /> Requires LIVE approval
                </Badge>
              </li>
            </ul>
            <Link
              to="/app/credentials"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent underline-offset-2 hover:underline"
            >
              <KeyRound size={13} aria-hidden="true" />
              Manage API keys
            </Link>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Recent activity</CardTitle>
                {activityToday !== null ? (
                  <Badge
                    variant="outline"
                    title="Things that happened in your organization today, such as sign-ins, new keys and checks."
                  >
                    {activityToday} today
                  </Badge>
                ) : null}
              </div>
              <Link to="/app/audit-logs" className="text-xs text-accent underline-offset-2 hover:underline">
                Audit log
              </Link>
            </div>
            {auditQuery.isPending ? (
              <div className="mt-4">
                <Spinner size={16} />
              </div>
            ) : auditQuery.isError ? (
              <p className="mt-3 text-[13px] text-fg-muted">Couldn&apos;t load recent activity.</p>
            ) : recentAudit.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted">
                <ScrollText size={14} aria-hidden="true" /> No activity recorded yet.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-[13px]">
                {recentAudit.map((log) => (
                  <li key={log.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs text-fg">{describeAuditAction(log.action)}</span>
                    <span className="shrink-0 text-xs text-fg-subtle">{formatTime(log.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {credentialsQuery.isError || membersQuery.isError ? (
        <Alert variant="warning">Some workspace data couldn&apos;t be loaded. Try refreshing.</Alert>
      ) : null}
    </div>
  )
}

type SampleData = { assessments: AssessmentOut[]; summary: SampleSummary }

function SampleOverview({ data }: { data: SampleData }) {
  const metric = (value: number): MetricState => ({ kind: "value", value, sample: true })
  return (
    <>
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Checks" state={metric(data.summary.total)} className="col-span-2 md:col-span-1" />
        <MetricCard label="High risk" tone="danger" state={metric(data.summary.byBand.HIGH)} />
        <MetricCard label="Step-up" tone="info" state={metric(data.summary.byRecommendation.STEP_UP)} />
        <MetricCard label="Manual review" tone="warn" state={metric(data.summary.byRecommendation.REVIEW)} />
        <MetricCard label="Block" tone="danger" state={metric(data.summary.byRecommendation.BLOCK)} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard title="Risk activity" description="Checks per day, by risk level" aside={<SampleBadge />}>
          <RiskActivityChart summary={data.summary} />
        </ChartCard>
        <ChartCard title="Risk levels" description="How many checks were low, medium or high risk" aside={<SampleBadge />}>
          <BarList
            ariaLabel="Risk distribution (sample data)"
            items={(["HIGH", "MEDIUM", "LOW"] as Severity[]).map((band) => ({
              key: band,
              label: SEVERITY_STYLES[band].label,
              value: data.summary.byBand[band],
              barClass: SEVERITY_STYLES[band].bar,
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard title="Recent checks" description="Newest first" aside={<SampleBadge />}>
        <DataTable<AssessmentOut>
          caption="Recent assessments (sample data)"
          rows={data.assessments.slice(0, 6)}
          getRowKey={(a) => a.assessment_id}
          columns={[
            {
              key: "id",
              header: "Check",
              cell: (a) => (
                <Link
                  to={`/app/assessments/sample/${a.assessment_id}`}
                  className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                >
                  {a.assessment_id}
                </Link>
              ),
            },
            { key: "time", header: "Time", cell: (a) => <span className="text-fg-muted">{formatTime(a.submitted_at)}</span> },
            { key: "score", header: "Score", cell: (a) => <span className="font-mono">{a.risk_score}</span> },
            { key: "band", header: "Risk", cell: (a) => <RiskBadge band={a.risk_band} /> },
            { key: "rec", header: "Recommendation", cell: (a) => <RecommendationBadge value={a.policy.recommendation} /> },
          ]}
        />
      </ChartCard>

      <ChartCard title="Rules that fired most" description="How many checks each rule fired on" aside={<SampleBadge />}>
        <BarList
          ariaLabel="Top triggered rules (sample data)"
          items={data.summary.topRules.slice(0, 5).map((rule) => {
            const parsed = parseReasonCode(rule.code)
            return { key: rule.code, label: parsed.ruleName ?? parsed.summary, hint: parsed.ruleId ?? undefined, value: rule.count }
          })}
        />
      </ChartCard>
    </>
  )
}

const REC_BARS: Record<Recommendation, string> = {
  PROCEED: "bg-ok",
  STEP_UP: "bg-info",
  REVIEW: "bg-warn",
  BLOCK: "bg-danger",
}

function count<T extends { count: number }>(items: T[], pick: (item: T) => boolean) {
  return items.filter(pick).reduce((sum, item) => sum + item.count, 0)
}

function RealOverview() {
  const analyticsQuery = useAssessmentAnalytics({})
  const recentQuery = useAssessments({ limit: 6 })
  const data = analyticsQuery.data

  const metric = (value: (d: AnalyticsOut) => number): MetricState =>
    analyticsQuery.isPending ? { kind: "loading" } : analyticsQuery.isError || !data ? { kind: "error" } : { kind: "value", value: value(data) }
  const byRec = (rec: Recommendation) => (d: AnalyticsOut) =>
    count(d.recommendation_distribution, (i: RecommendationCountOut) => i.recommendation === rec)
  const isEmpty = data?.summary.total_assessments === 0

  return (
    <>
      {isEmpty ? <GettingStarted /> : null}

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Checks"
          state={metric((d) => d.summary.total_assessments)}
          hint="Payments and events you sent us"
          className="col-span-2 md:col-span-1"
        />
        <MetricCard
          label="High risk"
          tone="danger"
          state={metric((d) => count(d.risk_band_distribution, (i: RiskBandCountOut) => i.risk_band === "HIGH"))}
        />
        <MetricCard label="Step-up" tone="info" state={metric(byRec("STEP_UP"))} hint="Ask the customer to verify" />
        <MetricCard label="Manual review" tone="warn" state={metric(byRec("REVIEW"))} hint="A person should look" />
        <MetricCard label="Block" tone="danger" state={metric(byRec("BLOCK"))} hint="Stop the payment" />
      </section>

      {analyticsQuery.isError ? (
        <ErrorState what="your figures" error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard
          title="Checks per day"
          description="Days are in UTC"
          aside={
            <Link to="/app/analytics" className="text-xs text-accent underline-offset-2 hover:underline">
              More in Analytics
            </Link>
          }
        >
          {analyticsQuery.isPending ? (
            <ChartPlaceholder kind="loading" />
          ) : !data ? (
            <ChartPlaceholder kind="error">Couldn&apos;t load this chart.</ChartPlaceholder>
          ) : data.time_series.points.length === 0 ? (
            <ChartPlaceholder kind="empty">No checks in the last 30 days.</ChartPlaceholder>
          ) : (
            <AssessmentVolumeChart
              ariaLabel={`Checks per day, ${data.time_series.points.length} days with activity`}
              points={data.time_series.points.map((p) => ({ bucketStart: p.bucket_start, count: p.count }))}
            />
          )}
        </ChartCard>

        <ChartCard title="What we recommended" description="The answer your policy gave for each check">
          {analyticsQuery.isPending ? (
            <ChartPlaceholder kind="loading" />
          ) : !data ? (
            <ChartPlaceholder kind="error">Couldn&apos;t load this chart.</ChartPlaceholder>
          ) : data.recommendation_distribution.length === 0 ? (
            <ChartPlaceholder kind="empty">No checks in the last 30 days.</ChartPlaceholder>
          ) : (
            <BarList
              ariaLabel="Recommendations"
              items={(["PROCEED", "STEP_UP", "REVIEW", "BLOCK", "UNAVAILABLE"] as const)
                .map((rec) => ({ rec, value: count(data.recommendation_distribution, (i: RecommendationCountOut) => i.recommendation === rec) }))
                .filter(({ value }) => value > 0)
                .map(({ rec, value }) => ({
                  key: rec,
                  label: rec === "UNAVAILABLE" ? "No recommendation" : RECOMMENDATION_STYLES[rec].label,
                  value,
                  barClass: rec === "UNAVAILABLE" ? "bg-line-strong" : REC_BARS[rec],
                  hint: rec === "UNAVAILABLE" ? "no policy turned on, or the check failed" : undefined,
                }))}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Recent checks"
        description="Newest first"
        aside={
          <Link to="/app/assessments" className="text-xs text-accent underline-offset-2 hover:underline">
            See all
          </Link>
        }
      >
        {recentQuery.isPending ? (
          <ChartPlaceholder kind="loading" />
        ) : recentQuery.isError ? (
          <ChartPlaceholder kind="error">Couldn&apos;t load your recent checks.</ChartPlaceholder>
        ) : recentQuery.data.items.length === 0 ? (
          <ChartPlaceholder kind="empty">No checks yet. They appear here as soon as your server sends one.</ChartPlaceholder>
        ) : (
          <DataTable<AssessmentListItemOut>
            caption="Recent assessments"
            rows={recentQuery.data.items}
            getRowKey={(a) => a.assessment_id}
            columns={[
              {
                key: "id",
                header: "Check",
                cell: (a) => (
                  <Link
                    to={`/app/assessments/${a.assessment_id}`}
                    className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                  >
                    {a.assessment_id.slice(0, 8)}
                  </Link>
                ),
              },
              { key: "time", header: "Time", cell: (a) => <span className="text-fg-muted">{formatTime(a.submitted_at)}</span> },
              { key: "env", header: "Where", secondary: true, cell: (a) => <span className="capitalize text-fg">{a.environment}</span> },
              { key: "status", header: "Status", cell: (a) => <AssessmentStatusBadge status={a.status} /> },
              { key: "score", header: "Score", cell: (a) => <span className="font-mono">{a.risk_score ?? "None"}</span> },
              { key: "rec", header: "Recommendation", cell: (a) => <RecommendationBadge value={a.policy?.recommendation ?? null} /> },
            ]}
          />
        )}
      </ChartCard>
    </>
  )
}

function GettingStarted() {
  const step = (n: number, title: string, body: ReactNode) => (
    <li className="flex items-start gap-3 text-sm">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent" aria-hidden="true">
        {n}
      </span>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="text-[13px] text-fg-muted">{body}</p>
      </div>
    </li>
  )
  const link = (to: string, text: string) => (
    <Link to={to} className="text-accent underline-offset-2 hover:underline">
      {text}
    </Link>
  )
  return (
    <Card>
      <CardTitle>Get started in three steps</CardTitle>
      <CardDescription className="mt-1">
        You haven&apos;t sent any checks yet. Everything here starts in SANDBOX, which is safe for testing.
      </CardDescription>
      <ol className="mt-4 flex flex-col gap-3">
        {step(1, "Create an API key", <>On {link("/app/credentials", "Credentials")}, create a SANDBOX key and copy it.</>)}
        {step(2, "Turn on a policy", <>On {link("/app/policies", "Policies")}, choose which score means proceed, verify, review or block.</>)}
        {step(3, "Send a test check", <>Follow the example on the {link("/app/api", "API")} page. The result shows up here.</>)}
      </ol>
    </Card>
  )
}
