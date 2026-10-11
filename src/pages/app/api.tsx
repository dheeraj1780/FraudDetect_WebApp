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
    purpose: "Check one payment or event. You get back a risk score and what your policy recommends.",
    replay: "201 when new, 200 when repeated",
  },
  {
    method: "POST",
    path: "/context-events",
    purpose: "Tell us about a finished payment or account event, so later checks know the customer's history.",
    replay: "201 when new, 200 when repeated",
  },
  {
    method: "POST",
    path: "/collector/tokens",
    purpose: "Issue a short-lived, single-use token for the browser-side network collector (see Sandbox below).",
    replay: "201, a fresh token every call",
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

const RESPONSE_GUIDE: [string, string][] = [
  ["risk_score", "0 to 100. Each warning sign we find adds points. Higher means riskier."],
  ["reasons", "The warning signs we found, for example a card from a different country than the billing address."],
  ["policy.recommendation", "What your policy says to do: PROCEED, STEP_UP (ask the customer to verify), REVIEW or BLOCK."],
  ["policy.status", "EXECUTED means your policy was used. NO_POLICY_CONFIGURED means no policy is turned on, so there is no recommendation."],
  ["evaluation_state", "EVALUATED means every rule ran. PARTIALLY_EVALUATED means some rules were skipped because information was missing."],
  ["risk_band", "LOW, MEDIUM or HIGH. Empty if score ranges aren't set up yet."],
  ["idempotent_replay", "true if you sent this request before with the same idempotency_key and got the first answer back."],
  ["assessment_id", "The ID of this check. Use it to find the check on the Assessments page."],
]

function formatDateTime(iso: string | null) {
  if (!iso) return "Never"
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function ApiPage() {
  const credentialsQuery = useCredentials()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="API"
        description="For your developers. Your server sends each payment to us, and we send back a score and a recommendation."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/credentials">
              <KeyRound size={14} aria-hidden="true" />
              Manage API keys
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
            Put your API key in the <span className="font-mono">X-Api-Key</span> header. The key tells us who you are and
            whether this is SANDBOX or LIVE. A SANDBOX key only works for SANDBOX.
          </CardDescription>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-fg-subtle">
            <li>A key is shown only once, when you create or replace it.</li>
            <li>Keep the key on your server. Never put it in a website or mobile app.</li>
            <li>Don&apos;t send card numbers. We reject them. Send your payment provider&apos;s card token instead.</li>
          </ul>
        </Card>

        <Card>
          <CardTitle>Base URL</CardTitle>
          <p className="mt-2 break-all rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-fg">{BASE_URL}</p>
          <CardDescription className="mt-3">
            Give every request its own <span className="font-mono">idempotency_key</span>, such as your order number. If
            you send the same request again with the same key, you get the first answer back instead of a second check.
          </CardDescription>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CodeBlock title="Request" code={REQUEST_EXAMPLE} language="shell" />
        <CodeBlock title="Response" code={RESPONSE_EXAMPLE} />
      </div>
      <Card>
        <CardTitle>Reading the response</CardTitle>
        <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
          {RESPONSE_GUIDE.map(([field, meaning]) => (
            <div key={field}>
              <dt className="font-mono text-xs text-fg">{field}</dt>
              <dd className="mt-0.5 text-fg-muted">{meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Alert variant="info">
        These are examples with made-up values. To see a real response explained, paste it on the{" "}
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
            already send. Nothing else is required on the assessment call itself.
          </CardDescription>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-fg-subtle">
            <li>The collector carries no telemetry payload, only the token.</li>
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
          Your API keys
        </h2>
        {credentialsQuery.isPending ? (
          <LoadingState label="Loading credentials…" />
        ) : credentialsQuery.isError ? (
          <ErrorState what="credentials" error={credentialsQuery.error} onRetry={() => void credentialsQuery.refetch()} />
        ) : credentialsQuery.data.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create a SANDBOX key to start testing."
            action={
              <Button asChild size="sm">
                <Link to="/app/credentials">Go to Credentials</Link>
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
                header: "Key",
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
                cell: (c) => <Badge variant={c.status === "active" ? "success" : "outline"}>{c.status === "active" ? "Active" : "Turned off"}</Badge>,
              },
              { key: "used", header: "Last used", cell: (c) => <span className="text-fg-muted">{formatDateTime(c.last_used_at)}</span> },
            ]}
          />
        )}
        <p className="text-xs text-fg-subtle">We only show the start of each key. The full key can&apos;t be shown again after it is created.</p>
      </section>
    </div>
  )
}
