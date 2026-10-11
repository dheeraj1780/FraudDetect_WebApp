import type { ClientOnlyOutcome, CollectorSubmitResult, ServerCollectResponseBody, ServerCollectorOutcome } from "@/lib/collector/types"

/**
 * The browser-side half of fraud-platform-api's customer network collector
 * (see fraud-platform-api/docs/collector_client_contract.md, the authoritative
 * contract this module implements -- read it before changing this file).
 *
 * Deliberately NOT built on `@/lib/api/client.ts` (`apiFetch`): that client
 * attaches this dashboard's OWN session `Authorization`/`X-Tenant-Id` headers
 * and targets `API_BASE_URL` (`/api/v1`, proxied in dev) -- the collector
 * endpoint is a SEPARATE, public, token-authenticated surface
 * (`/collector/v1/collect`, mounted on fraud-platform-api's own
 * `collector_app`, never proxied -- see vite.config.ts) that must never carry
 * this dashboard's own session credentials. This module is independent on
 * purpose (Wave 30 Phase 3: "Keep it independent from the fraud decision
 * itself"), with no dependency on this app's auth/query/routing stack, so it
 * can be lifted into any tenant's own frontend unchanged.
 *
 * Out of scope, deliberately: token ISSUANCE (`POST /api/v1/collector/tokens`)
 * is `X-Api-Key`-authenticated, server-to-server only (contract point 2) --
 * this module never calls it and never will; putting an API credential in
 * browser code is exactly the mistake the contract exists to prevent. A host
 * page obtains a token from ITS OWN backend and hands it to `setToken()`.
 *
 * Also out of scope: there is NO telemetry payload. The request body this
 * module sends is `{"token": "<token>"}` and nothing else (contract point 3;
 * `app/collector_app.py::_CollectRequest` on the server rejects any other
 * field, `extra="forbid"`). `flow_id` is never read or sent by this module --
 * correlation is carried entirely inside the opaque token (contract point 4).
 */

const DEFAULT_MAX_HONORED_RETRY_AFTER_SECONDS = 10

export interface CollectorClientOptions {
  /** The origin fraud-platform-api's collector surface is reachable at (e.g. "https://api.frauddetect.example"),
   * or "" (default) for a same-origin request. This module never reads `API_BASE_URL`
   * (`@/lib/api/config.ts`) -- that constant is this dashboard's own `/api/v1` path, a different mount
   * on a (usually) different logical boundary than `/collector`. */
  baseUrl?: string
  /** Called synchronously when `submit()` is attempted with an expired (or never-set) token. The ONLY
   * way to recover is for the host page's own backend to issue a fresh token (contract point 7) -- this
   * module cannot do that itself, so it only signals the need; it never retries issuance on its own. */
  onTokenExpired?: () => void
  /** A 429 response's `Retry-After` value (seconds) will only be honored up to this bound -- a CLIENT-side
   * safety cap against a misconfigured or hostile server asking for an unreasonable wait, never a
   * production rate-limit policy of fraud-platform-api's own (that remains entirely server-side,
   * app/core/config.py). Default 10s. Set lower (e.g. 0) to never honor Retry-After at all. */
  maxHonoredRetryAfterSeconds?: number
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
  /** Injectable for tests, so a 429-retry test never actually sleeps. Defaults to a real `setTimeout`-based delay. */
  delayImpl?: (ms: number) => Promise<void>
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isServerCollectBody(body: unknown): body is ServerCollectResponseBody {
  return typeof body === "object" && body !== null && typeof (body as ServerCollectResponseBody).status === "string"
}

const KNOWN_SERVER_OUTCOMES: readonly ServerCollectorOutcome[] = [
  "accepted",
  "accepted_duplicate",
  "rejected_not_production_ready",
  "rejected_collector_disabled",
  "rejected_rate_limited",
  "rejected_malformed_request",
  "rejected_token_invalid",
  "rejected_storage_failure",
]

function extractOutcome(body: unknown): ServerCollectorOutcome | ClientOnlyOutcome {
  if (isServerCollectBody(body) && (KNOWN_SERVER_OUTCOMES as string[]).includes(body.status)) {
    return body.status
  }
  // A 2xx/4xx/5xx with a body shape this module does not recognize (a future server change, a
  // misconfigured proxy rewriting the response, etc.) -- never guessed at, never treated as success.
  return "client_malformed_server_response"
}

/**
 * Stateful only in the narrowest sense required: which token is currently held, and when it expires.
 * Holds the token in a private instance field only -- never `localStorage`/`sessionStorage` (contract
 * point 5: "any other sink the server cannot control"), never a module-level global shared across
 * unrelated `CollectorClient` instances.
 */
export class CollectorClient {
  #token: string | null = null
  #expiresAt: Date | null = null
  readonly #baseUrl: string
  readonly #onTokenExpired: (() => void) | undefined
  readonly #maxHonoredRetryAfterSeconds: number
  readonly #fetchImpl: typeof fetch
  readonly #delayImpl: (ms: number) => Promise<void>

  constructor(options: CollectorClientOptions = {}) {
    this.#baseUrl = options.baseUrl ?? ""
    this.#onTokenExpired = options.onTokenExpired
    this.#maxHonoredRetryAfterSeconds = options.maxHonoredRetryAfterSeconds ?? DEFAULT_MAX_HONORED_RETRY_AFTER_SECONDS
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.#delayImpl = options.delayImpl ?? defaultDelay
  }

  /** Accepts a token already issued by the host page's own backend (`POST /api/v1/collector/tokens`
   * response: `{"token": "...", "expires_at": "..."}`, passed through verbatim). This is the ONLY way a
   * token enters this client -- there is no `acquireToken()` method. */
  setToken(token: string, expiresAt: string | Date): void {
    this.#token = token
    this.#expiresAt = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt
  }

  hasToken(): boolean {
    return this.#token !== null
  }

  /** `true` if no token is held, or the held token's own `expires_at` has passed. Never throws; a
   * malformed `expiresAt` given to `setToken()` resolves to `Invalid Date`, which compares as expired
   * (fail closed, never fail open on a bad timestamp). */
  isExpired(now: Date = new Date()): boolean {
    if (this.#expiresAt === null) return true
    return !(this.#expiresAt.getTime() > now.getTime())
  }

  clearToken(): void {
    this.#token = null
    this.#expiresAt = null
  }

  /**
   * Submits the held token to the collector. The caller must NOT await this before letting checkout
   * proceed (contract point 9) -- call it fire-and-forget, or await it only to log/metric the outcome
   * after navigation has already been allowed to continue. Every outcome, including every failure mode,
   * resolves (never rejects) -- a collector failure is evidence-quality information for the caller to
   * observe, never an exception that could accidentally abort an unrelated `try`/`catch` around checkout.
   */
  async submit(): Promise<CollectorSubmitResult> {
    if (this.#token === null) {
      return { outcome: "client_token_not_set", wasRetried: false }
    }
    if (this.isExpired()) {
      this.#onTokenExpired?.()
      return { outcome: "client_token_expired_locally", wasRetried: false }
    }
    return this.#post(this.#token, false)
  }

  async #post(token: string, wasRetried: boolean): Promise<CollectorSubmitResult> {
    let response: Response
    try {
      response = await this.#fetchImpl(`${this.#baseUrl}/collector/v1/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token }),
      })
    } catch {
      // Network failure, DNS failure, TLS failure, or the browser's OWN CORS preflight rejection
      // (a disallowed origin never even reaches `fetch`'s success path) -- indistinguishable from each
      // other at this layer, and the contract requires treating all of them identically anyway (point 8).
      return { outcome: "client_network_failure", wasRetried }
    }

    if (response.status === 429) {
      const retryAfterSeconds = parseRetryAfter(response)
      // The body is always the SAME generic {"status": "rejected_rate_limited"} shape, already fully
      // known from the status code -- read only to drain the stream, never inspected further.
      await parseJsonBody(response)
      if (!wasRetried && retryAfterSeconds !== undefined && retryAfterSeconds <= this.#maxHonoredRetryAfterSeconds) {
        await this.#delayImpl(retryAfterSeconds * 1000)
        return this.#post(token, true)
      }
      return { outcome: "rejected_rate_limited", httpStatus: 429, retryAfterSeconds, wasRetried }
    }

    const body = await parseJsonBody(response)
    const outcome = extractOutcome(body)
    return { outcome, httpStatus: response.status, wasRetried }
  }
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get("Retry-After")
  if (header === null || !/^\d+$/.test(header)) return undefined
  return Number(header)
}
