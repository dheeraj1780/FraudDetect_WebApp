/**
 * Wire types and outcome vocabulary for the customer network collector
 * (fraud-platform-api's `/collector/v1/collect`). Mirrors
 * fraud-platform-api/docs/collector_client_contract.md and the server's own
 * closed `CollectorOutcome` enum (app/services/collector_service.py)
 * field-for-field, exactly as this repo's own convention for `lib/api/types.ts`
 * already requires for the dashboard API. See `README.md` in this directory
 * for the one deliberate scope boundary: this endpoint carries NO telemetry
 * payload -- the request body is `{"token": "<token>"}` and nothing else.
 */

/** The server's own closed outcome vocabulary (app/services/collector_service.py::CollectorOutcome),
 * reproduced verbatim -- never invented, never renamed. */
export type ServerCollectorOutcome =
  | "accepted"
  | "accepted_duplicate"
  | "rejected_not_production_ready"
  | "rejected_collector_disabled"
  | "rejected_rate_limited"
  | "rejected_malformed_request"
  | "rejected_token_invalid"
  | "rejected_storage_failure"

/**
 * Client-only conditions that have no server equivalent at all -- the server
 * never sees the request in these cases, so these are NOT a rename or a
 * duplicate of anything in `ServerCollectorOutcome` above; each is something
 * only the browser itself can detect, before or in place of a real HTTP
 * round trip.
 */
export type ClientOnlyOutcome =
  | "client_token_not_set" // submit() called before setToken() ever ran
  | "client_token_expired_locally" // the held token's own expires_at has passed; no network call was made
  | "client_network_failure" // fetch() itself rejected (offline, DNS, TLS, CORS preflight rejection, etc.)
  | "client_malformed_server_response" // a 2xx/4xx/5xx body that is not valid JSON, or not the expected shape

export type CollectorOutcome = ServerCollectorOutcome | ClientOnlyOutcome

/** `true` only for `accepted`/`accepted_duplicate` -- every other outcome, server or client-side, is a
 * non-success the caller must treat identically per the contract's own point 8: never block checkout,
 * never treat as a diagnostic signal, log nothing sensitive. */
export function isSuccessOutcome(outcome: CollectorOutcome): boolean {
  return outcome === "accepted" || outcome === "accepted_duplicate"
}

export interface CollectorSubmitResult {
  outcome: CollectorOutcome
  /** HTTP status, when a real response was received; absent for client-only outcomes. */
  httpStatus?: number
  /** Only populated when the server's own response carried one (429 responses, Wave 28F). Seconds. */
  retryAfterSeconds?: number
  /** Whether this result came from the client's OWN bounded single retry after a 429 (contract point 9),
   * not a second, independent submission the caller initiated. */
  wasRetried: boolean
}

/** The server's raw response body shape for the ingestion endpoint (app/collector_app.py::_response). */
export interface ServerCollectResponseBody {
  status: ServerCollectorOutcome
}
