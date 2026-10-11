import { ArrowLeft } from "lucide-react"
import { useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { Container } from "@/components/layout/container"
import { Input } from "@/components/ui/input"
import { CollectorClient } from "@/lib/collector/collectorClient"
import { isSuccessOutcome, type CollectorOutcome, type CollectorSubmitResult } from "@/lib/collector/types"
import { useAuth } from "@/lib/auth/context"

/**
 * Wave 30 Phase 12: fraud-web-app is Clarion's own tenant back-office dashboard, not a merchant
 * checkout page -- no existing checkout/demo flow exists anywhere in this app to exercise the
 * collector client against (confirmed, Phase 1 reconciliation: zero "checkout"/"collector" code existed
 * before this wave). This is the smallest possible sandbox page to exercise `CollectorClient` end to
 * end, clearly labeled as such, never reachable from the authenticated `/app` dashboard shell, and
 * never a stand-in for a real merchant integration.
 *
 * Token ISSUANCE is `X-Api-Key`-authenticated, server-to-server only (contract point 2) -- this page
 * cannot and does not call it. A token is supplied externally: pasted in (for a human exercising this
 * page manually after issuing one via curl/the dashboard's own API tester) or passed as a `?token=` /
 * `?expires_at=` query parameter (for an automated end-to-end test driving a real browser, Wave 30
 * Phase 13) -- read once on mount, never persisted to storage, never echoed back into the DOM after
 * submission. An optional `?backend=` overrides where the collector call itself is sent (defaults to
 * same-origin) -- used only by Wave 30's own real-browser CORS test, where the frontend and the real
 * fraud-platform-api instance deliberately run on different origins; a real merchant integration would
 * instead deploy this client against its own fixed collector origin, not a runtime query parameter.
 *
 * Wave 32B: this page remains reachable WITHOUT a dashboard session (an external developer testing a
 * token their own backend issued has no reason to be signed into this console at all) -- it is now
 * additionally linked from the authenticated product's own "Developer" navigation group, so a signed-in
 * tenant user can find it. The "Back to dashboard" link below is purely a navigation convenience for
 * that case; it changes nothing about this page's own auth boundary (there still is none, by design).
 */

const OUTCOME_COPY: Record<CollectorOutcome, { title: string; description: string }> = {
  accepted: {
    title: "Accepted",
    description: "The collector recorded an observation for this flow. A later assessment for the same flow_id may use it.",
  },
  accepted_duplicate: {
    title: "Accepted (already recorded)",
    description: "This exact token was already submitted once. The original observation stands unchanged — this is expected on a retry, not an error.",
  },
  rejected_not_production_ready: {
    title: "Collector not ready",
    description: "The collector isn't fully configured in this environment yet (token keys, rate limits, etc.). Nothing about your request was wrong.",
  },
  rejected_collector_disabled: {
    title: "Collector disabled for this environment",
    description: "The collector is deployed but switched off for this token's environment. This is an operator setting, not a request error.",
  },
  rejected_rate_limited: {
    title: "Rate limited",
    description: "Too many requests for one of the collector's rate-limit dimensions. See Retry-After below if the server reported one.",
  },
  rejected_malformed_request: {
    title: "Malformed request",
    description: "The request body wasn't shaped the way the collector expects.",
  },
  rejected_token_invalid: {
    title: "Invalid token",
    description: "The token failed verification — expired, tampered, signed by an unknown key, or otherwise not trustworthy. Issue a fresh one from your backend.",
  },
  rejected_storage_failure: {
    title: "Storage failure",
    description: "The collector couldn't persist the observation due to an internal failure. Your checkout flow is unaffected — this is evidence-only.",
  },
  client_token_not_set: {
    title: "No token entered",
    description: "Enter a token and its expiry before submitting.",
  },
  client_token_expired_locally: {
    title: "Token already expired",
    description: "This client checked the expiry itself and never made a network call. Issue a fresh token from your backend.",
  },
  client_network_failure: {
    title: "Network failure",
    description: "The request never reached the server (offline, DNS, TLS, or a CORS preflight rejection — a disallowed browser origin looks identical to a network failure from here).",
  },
  client_malformed_server_response: {
    title: "Unrecognized server response",
    description: "The server responded, but not in the shape this client expects. Nothing was assumed about the outcome.",
  },
}

export function CollectorSandboxDemo() {
  const [searchParams] = useSearchParams()
  const [tokenInput, setTokenInput] = useState(() => searchParams.get("token") ?? "")
  const [expiresAtInput, setExpiresAtInput] = useState(() => searchParams.get("expires_at") ?? "")
  const [result, setResult] = useState<CollectorSubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const clientRef = useRef<CollectorClient | null>(null)
  const backendOverride = searchParams.get("backend") ?? undefined
  const { status } = useAuth()

  function client(): CollectorClient {
    clientRef.current ??= new CollectorClient({ baseUrl: backendOverride })
    return clientRef.current
  }

  async function handleSubmit(): Promise<void> {
    if (!tokenInput || !expiresAtInput) return
    setSubmitting(true)
    setResult(null)
    client().setToken(tokenInput, expiresAtInput)
    const outcome = await client().submit()
    setResult(outcome)
    setSubmitting(false)
  }

  return (
    <Container className="flex min-h-screen flex-col gap-6 py-16">
      {status === "ready" ? (
        <Link
          to="/app/overview"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to dashboard
        </Link>
      ) : null}

      <Alert variant="warning" title="Sandbox / test functionality">
        This page exercises the customer network collector client against a real backend for testing
        only. It is not, and must never be mistaken for, a real merchant checkout page. See{" "}
        <code className="font-mono text-xs">src/lib/collector/README.md</code> for the client&apos;s
        exact scope.
      </Alert>

      <Card className="flex flex-col gap-2">
        <CardTitle>What this tests</CardTitle>
        <CardDescription>
          The collector observes the connection that reaches it from a customer&apos;s browser, and
          correlates that observation to a later assessment by <span className="font-mono">flow_id</span> —
          the same identifier you already send to <span className="font-mono">POST /assessments</span>.
          It carries no other payload: no telemetry, no form data, nothing beyond the token below.
        </CardDescription>
        <CardDescription>
          Before using this page you need a token from{" "}
          <span className="font-mono">POST /api/v1/collector/tokens</span>, issued by your OWN backend
          using an API credential (see <Link to="/app/credentials" className="text-accent underline-offset-2 hover:underline">Credentials</Link>).
          This page never issues a token itself — that call is server-to-server, authenticated with a
          secret that must never reach a browser.
        </CardDescription>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Collector token</CardTitle>
          <CardDescription>
            Obtained out-of-band from your own backend (<code className="font-mono text-xs">POST /api/v1/collector/tokens</code>
            , X-Api-Key authenticated) -- this page never issues one itself. Paste a token and its
            <code className="font-mono text-xs"> expires_at</code> below, or load this page with
            <code className="font-mono text-xs"> ?token=...&amp;expires_at=...</code>.
          </CardDescription>
        </div>
        <label className="flex flex-col gap-1 text-sm text-fg-muted">
          Token
          <Input
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="CLARION-COLLECTOR-TOKEN-V1...."
            data-testid="collector-token-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-muted">
          Expires at (ISO 8601)
          <Input
            type="text"
            value={expiresAtInput}
            onChange={(e) => setExpiresAtInput(e.target.value)}
            placeholder="2026-10-01T12:00:00Z"
            data-testid="collector-expires-input"
          />
        </label>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitting || !tokenInput || !expiresAtInput}
          data-testid="collector-submit"
        >
          {submitting ? "Submitting..." : "Submit to collector"}
        </Button>
      </Card>

      {result ? (
        <Card data-testid="collector-result" data-outcome={result.outcome}>
          <CardTitle>Result</CardTitle>
          <Alert variant={isSuccessOutcome(result.outcome) ? "success" : "warning"} title={OUTCOME_COPY[result.outcome].title}>
            <p>{OUTCOME_COPY[result.outcome].description}</p>
            <p className="mt-2 font-mono text-[11px] text-fg-subtle">{result.outcome}</p>
            {result.httpStatus !== undefined ? <p className="mt-1">HTTP {result.httpStatus}</p> : null}
            {result.retryAfterSeconds !== undefined ? <p>Retry-After: {result.retryAfterSeconds}s</p> : null}
            {result.wasRetried ? <p>(client performed one bounded retry)</p> : null}
          </Alert>
        </Card>
      ) : null}
    </Container>
  )
}
