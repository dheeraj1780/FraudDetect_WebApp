import { FlaskConical, KeyRound, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { CodeBlock } from "@/components/fd/code-block"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { useCredentials } from "@/hooks/use-credentials"
import { API_BASE_URL } from "@/lib/api/config"
import type { CredentialOut } from "@/lib/api/types"

const BASE_URL = /^https?:\/\//.test(API_BASE_URL) ? API_BASE_URL : "https://<your-api-host>/api/v1"

const ENDPOINTS = [
  {
    method: "POST",
    path: "/assessments",
    purpose: "Assess one payment or event and get a risk score, band and policy recommendation.",
    replay: "201 when new · 200 on an idempotent replay",
  },
  {
    method: "POST",
    path: "/context-events",
    purpose: "Report a completed, successful transaction or account event so the platform can build history.",
    replay: "201 when new · 200 on an idempotent replay",
  },
  {
    method: "POST",
    path: "/collector/tokens",
    purpose: "Issue a short-lived, single-use token for the browser-side network collector (see Sandbox below).",
    replay: "201 — a fresh token every call",
  },
]

const REQUEST_EXAMPLE = `curl -X POST "${BASE_URL}/assessments" \\
  -H "X-Api-Key: $FRAUD_DETECT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotency_key": "order-10482-attempt-1",
    "occurred_at": "2026-09-27T10:15:00Z",
    "channel": "web",
    "transaction": {
      "amount": "149.00",
      "currency": "USD",
      "transaction_type": "purchase"
    },
    "customer": { "customer_reference": "cus_7281" }
  }'`

const RESPONSE_EXAMPLE = `{
  "assessment_id": "<uuid issued by the platform>",
  "status": "completed",
  "submitted_at": "2026-09-27T10:15:00.412Z",
  "completed_at": "2026-09-27T10:15:00.598Z",
  "risk_score": 46.0,
  "risk_band": "MEDIUM",
  "policy": {
    "status": "EXECUTED",
    "recommendation": "STEP_UP",
    "policy_id": "<your policy id>",
    "policy_version": "1"
  },
  "reasons": [{ "reason_code": "F6_TXN_006_INSTRUMENT_COUNTRY_MISMATCH" }],
  "engine": {
    "engine_version": "…",
    "scoring_model_version": "…",
    "scoring_configuration_version": "…",
    "policy_model_version": "…"
  },
  "evaluation_state": "EVALUATED",
  "idempotent_replay": false
}`

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function ApiPage() {
  const credentialsQuery = useCredentials()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="API"
        description="Integrate Fraud Detect from your backend: authenticate with an API credential, submit evidence, act on the recommendation."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/credentials">
              <KeyRound size={14} aria-hidden="true" />
              Manage credentials
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="endpoints-heading" className="flex flex-col gap-3">
        <h2 id="endpoints-heading" className="text-sm font-semibold text-fg">
          Endpoints
        </h2>
        <DataTable
          caption="API endpoints available to API credentials"
          rows={ENDPOINTS}
          getRowKey={(e) => e.path}
          columns={[
            {
              key: "endpoint",
              header: "Endpoint",
              cell: (e) => (
                <span className="flex items-center gap-2">
                  <Badge variant="accent">{e.method}</Badge>
                  <span className="font-mono text-xs text-fg">/api/v1{e.path}</span>
                </span>
              ),
              className: "whitespace-nowrap",
            },
            { key: "purpose", header: "Purpose", cell: (e) => <span className="text-fg-muted">{e.purpose}</span> },
            { key: "status", header: "Result", cell: (e) => <span className="text-xs text-fg-subtle">{e.replay}</span> },
          ]}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ShieldCheck size={18} className="text-accent" aria-hidden="true" />
          <CardTitle className="mt-3">Authentication</CardTitle>
          <CardDescription className="mt-1">
            Send your credential in the <span className="font-mono">X-Api-Key</span> header. The credential alone decides
            the tenant and environment — neither is accepted in the request body, and a sandbox credential can only reach
            the sandbox.
          </CardDescription>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-fg-subtle">
            <li>Secrets are shown once, when a credential is created or rotated.</li>
            <li>Keep the key on your server; never ship it in browser or mobile code.</li>
            <li>Raw card data is rejected — send payment-instrument tokens instead.</li>
          </ul>
        </Card>

        <Card>
          <CardTitle>Base URL</CardTitle>
          <p className="mt-2 break-all rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-fg">{BASE_URL}</p>
          <CardDescription className="mt-3">
            Each request carries an <span className="font-mono">idempotency_key</span>. Retrying with the same key returns
            the original result without re-running the engine.
          </CardDescription>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CodeBlock title="Request" code={REQUEST_EXAMPLE} language="shell" />
        <CodeBlock title="Response" code={RESPONSE_EXAMPLE} />
      </div>
      <Alert variant="info">
        Examples only — values are placeholders, not real data. The response contains the outcome and reason codes, not
        the evidence or thresholds behind them. You can inspect a real response on the{" "}
        <Link to="/app/decision-trace" className="text-accent underline-offset-2 hover:underline">
          Decision Trace
        </Link>{" "}
        page.
      </Alert>

      <section aria-labelledby="collector-heading" className="flex flex-col gap-3">
        <h2 id="collector-heading" className="text-sm font-semibold text-fg">
          Network collector
        </h2>
        <Card>
          <FlaskConical size={18} className="text-warn" aria-hidden="true" />
          <CardTitle className="mt-3">Observing the connecting browser</CardTitle>
          <CardDescription className="mt-1">
            An optional, separate capability: your backend issues a short-lived token for one checkout
            flow (<span className="font-mono">POST /collector/tokens</span>, shown above), hands it to
            your own frontend code running in the customer&apos;s browser, and that browser code submits
            it to a public collector endpoint that observes the connection reaching it. The result is
            correlated to your assessment by the same <span className="font-mono">flow_id</span> you
            already send — nothing else is required on the assessment call itself.
          </CardDescription>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-fg-subtle">
            <li>The collector carries no telemetry payload — only the token.</li>
            <li>Token delivery to the browser, and the collector call itself, are documented in the sandbox page below.</li>
            <li>Sandbox only in this release, same as every credential issued from this console.</li>
          </ul>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to="/sandbox/collector">
              <FlaskConical size={14} aria-hidden="true" />
              Open the sandbox collector
            </Link>
          </Button>
        </Card>
      </section>

      <section aria-labelledby="credentials-heading" className="flex flex-col gap-3">
        <h2 id="credentials-heading" className="text-sm font-semibold text-fg">
          Your credentials
        </h2>
        {credentialsQuery.isPending ? (
          <LoadingState label="Loading credentials…" />
        ) : credentialsQuery.isError ? (
          <ErrorState what="credentials" error={credentialsQuery.error} onRetry={() => void credentialsQuery.refetch()} />
        ) : credentialsQuery.data.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No credentials yet"
            description="Create a sandbox credential to start integrating."
            action={
              <Button asChild size="sm">
                <Link to="/app/credentials">Go to credentials</Link>
              </Button>
            }
          />
        ) : (
          <DataTable<CredentialOut>
            caption="Credential overview"
            rows={credentialsQuery.data}
            getRowKey={(c) => c.id}
            columns={[
              {
                key: "credential",
                header: "Credential",
                cell: (c) => (
                  <span>
                    <span className="font-medium text-fg">{c.label ?? "Untitled"}</span>
                    <span className="ml-2 font-mono text-xs text-fg-subtle">{c.key_prefix}…</span>
                  </span>
                ),
              },
              { key: "env", header: "Environment", cell: (c) => <span className="capitalize text-fg-muted">{c.environment}</span> },
              {
                key: "status",
                header: "Status",
                cell: (c) => <Badge variant={c.status === "active" ? "success" : "outline"}>{c.status === "active" ? "Active" : "Revoked"}</Badge>,
              },
              { key: "used", header: "Last used", cell: (c) => <span className="text-fg-muted">{formatDateTime(c.last_used_at)}</span> },
            ]}
          />
        )}
        <p className="text-xs text-fg-subtle">Only the key prefix is ever shown. Secrets can&apos;t be retrieved after creation.</p>
      </section>
    </div>
  )
}
