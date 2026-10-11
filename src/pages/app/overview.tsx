import { CheckCircle2, Circle, Clock, KeyRound, ScrollText } from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"
import { BarList, RiskActivityChart } from "@/components/app/charts"
import { ChartCard, ChartPlaceholder } from "@/components/app/chart-card"
import { MetricCard, type MetricState } from "@/components/app/metric-card"
import { PageHeader } from "@/components/app/page-header"
import { RecommendationBadge, RiskBadge } from "@/components/fd/risk-badge"
import { SampleBadge, SampleDataBanner, SampleToggle } from "@/components/fd/sample-data"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Spinner } from "@/components/ui/spinner"
import { useAuditLogs } from "@/hooks/use-audit-logs"
import { useCredentials } from "@/hooks/use-credentials"
import { useMembers } from "@/hooks/use-members"
import { useSampleClock } from "@/hooks/use-sample-clock"
import { useSampleMode } from "@/hooks/use-sample-mode"
import { useAuth } from "@/lib/auth/context"
import type { AssessmentOut } from "@/lib/api/types"
import { parseReasonCode } from "@/lib/fraud/reason"
import { sampleAssessments, SAMPLE_DAYS, summarize } from "@/lib/fraud/sample"
import { SEVERITY_STYLES, type Severity } from "@/lib/fraud/vocabulary"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const UNAVAILABLE: MetricState = { kind: "unavailable" }

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

  const metric = (pick: (s: NonNullable<typeof sampleData>["summary"]) => number): MetricState =>
    sampleData ? { kind: "value", value: pick(sampleData.summary), sample: true } : UNAVAILABLE

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
        description="Real-time risk overview for payments, accounts and digital transactions."
        badges={
          <Badge variant="outline">
            {sampleData ? `Sample · last ${SAMPLE_DAYS} days` : "Sandbox"}
          </Badge>
        }
        action={<SampleToggle enabled={sample.enabled} onChange={sample.setEnabled} />}
      />

      {sampleData ? (
        <SampleDataBanner />
      ) : (
        <Alert variant="info" title="This overview doesn't show live assessment figures yet">
          Assessments are created by your backend calling <span className="font-mono">POST /assessments</span> with an
          API credential. Your real assessment history and aggregate analytics are already available on the{" "}
          <Link to="/app/assessments" className="underline-offset-2 hover:underline">
            Assessments
          </Link>{" "}
          and{" "}
          <Link to="/app/analytics" className="underline-offset-2 hover:underline">
            Analytics
          </Link>{" "}
          pages — this overview just doesn&apos;t pull them in yet, so the figures below show as not available
          rather than as zero. Use “Preview with sample data” to see the layout.
        </Alert>
      )}

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Assessments" state={metric((s) => s.total)} className="col-span-2 md:col-span-1" />
        <MetricCard label="High risk" tone="danger" state={metric((s) => s.byBand.HIGH)} />
        <MetricCard label="Step-up" tone="info" state={metric((s) => s.byRecommendation.STEP_UP)} />
        <MetricCard label="Manual review" tone="warn" state={metric((s) => s.byRecommendation.REVIEW)} />
        <MetricCard label="Block" tone="danger" state={metric((s) => s.byRecommendation.BLOCK)} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard
          title="Risk activity"
          description="Assessments per day by risk band"
          aside={sampleData ? <SampleBadge /> : undefined}
        >
          {sampleData ? (
            <RiskActivityChart summary={sampleData.summary} />
          ) : (
            <ChartPlaceholder kind="unavailable">
              Risk activity isn&apos;t shown on this overview yet.{" "}
              <Link to="/app/analytics" className="text-accent underline-offset-2 hover:underline">
                See real risk trends on Analytics
              </Link>
            </ChartPlaceholder>
          )}
        </ChartCard>

        <ChartCard
          title="Risk distribution"
          description="Share of assessments by risk band"
          aside={sampleData ? <SampleBadge /> : undefined}
        >
          {sampleData ? (
            <BarList
              ariaLabel="Risk distribution (sample data)"
              items={(["HIGH", "MEDIUM", "LOW"] as Severity[]).map((band) => ({
                key: band,
                label: SEVERITY_STYLES[band].label,
                value: sampleData.summary.byBand[band],
                barClass: SEVERITY_STYLES[band].bar,
              }))}
            />
          ) : (
            <ChartPlaceholder kind="unavailable">
              Risk distribution isn&apos;t shown on this overview yet.{" "}
              <Link to="/app/analytics" className="text-accent underline-offset-2 hover:underline">
                See the real breakdown on Analytics
              </Link>
            </ChartPlaceholder>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Recent assessments"
        description="Most recent first"
        aside={sampleData ? <SampleBadge /> : undefined}
      >
        {sampleData ? (
          <DataTable<AssessmentOut>
            caption="Recent assessments (sample data)"
            rows={sampleData.assessments.slice(0, 6)}
            getRowKey={(a) => a.assessment_id}
            columns={[
              {
                key: "id",
                header: "Assessment",
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
        ) : (
          <ChartPlaceholder kind="unavailable">
            Recent assessments aren&apos;t listed on this overview yet.{" "}
            <Link to="/app/assessments" className="text-accent underline-offset-2 hover:underline">
              See your real history on Assessments
            </Link>
          </ChartPlaceholder>
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Top triggered rules"
          description="By number of assessments"
          aside={sampleData ? <SampleBadge /> : undefined}
        >
          {sampleData ? (
            <BarList
              ariaLabel="Top triggered rules (sample data)"
              items={sampleData.summary.topRules.slice(0, 5).map((rule) => {
                const parsed = parseReasonCode(rule.code)
                return {
                  key: rule.code,
                  label: parsed.ruleName ?? parsed.summary,
                  hint: parsed.ruleId ?? undefined,
                  value: rule.count,
                }
              })}
            />
          ) : (
            <ChartPlaceholder kind="unavailable">Rule firing frequency isn&apos;t exposed by the platform API — only your assessment outcomes are, never individual rule identity.</ChartPlaceholder>
          )}
        </ChartCard>

        <ChartCard title="Recent cases" description="Investigations opened from assessments">
          <ChartPlaceholder kind="unavailable">
            Case management isn&apos;t available yet.{" "}
            <Link to="/app/cases" className="text-accent underline-offset-2 hover:underline">
              See the planned layout
            </Link>
          </ChartPlaceholder>
        </ChartCard>
      </div>

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
                  <dd className="capitalize text-fg-muted">{myMembership?.role ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Members</dt>
                  <dd className="text-fg-muted">
                    {membersQuery.isPending ? <Spinner size={14} /> : membersQuery.isError ? "—" : membersQuery.data.length}
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
                <Badge variant="outline" title="LIVE credentials can be issued only after Clarion approves LIVE access and a LIVE policy is active. See the LIVE access page.">
                  <Clock size={12} aria-hidden="true" /> Requires LIVE approval
                </Badge>
              </li>
            </ul>
            <Link
              to="/app/credentials"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent underline-offset-2 hover:underline"
            >
              <KeyRound size={13} aria-hidden="true" />
              Manage credentials
            </Link>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Recent activity</CardTitle>
                {activityToday !== null ? (
                  <Badge
                    variant="outline"
                    title="Audit events recorded for your organization today, among your most recent activity."
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
                    <span className="truncate font-mono text-xs text-fg">{log.action}</span>
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
