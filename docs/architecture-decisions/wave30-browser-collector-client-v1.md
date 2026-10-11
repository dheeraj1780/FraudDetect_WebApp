# Wave 30 — Real Browser Collector Client + End-to-End Sandbox Validation

## 1. Executive Summary

Wave 30 built the minimal real browser-side client for fraud-platform-api's customer network
collector, and proved the complete real path end to end: a real browser (Chromium, via Playwright),
a real separate fraud-platform-api process, real token issuance, real collection, and (on the backend
side) real PostgreSQL. Two genuine defects were found and fixed along the way — neither invented,
both surfaced by actually exercising the real path rather than trusting prior mocked/loosely-asserting
coverage:

1. **The collector could never actually accept traffic in any real deployment.** `get_rate_limiter()`
   returned `NullRateLimiter` (denies everything) unconditionally, with no path for a real running
   process to ever obtain a working limiter — only test fixtures could override it. Fixed: the factory
   now constructs a real `InMemoryRateLimiter` from already-configured settings once both readiness
   signals are true.
2. **A real browser's CORS preflight to the collector was silently governed by the DASHBOARD's own
   CORS settings, not the collector's.** `app.mount("/collector", collector_app)` does not give the
   mounted sub-application an independent middleware stack, contrary to what Wave 28D's own docstring
   claimed — the outer app's `CORSMiddleware` wraps everything, including every mounted path. Fixed
   with a path-excluding middleware wrapper; the collector's own, separately-configured CORS policy
   now actually governs its own requests.

Both defects went undetected through every prior wave's Python `ASGITransport`-based tests, including
one test whose own loose `assert status_code in (200, 400)` masked exactly the second bug. Real
browser testing is what caught them — a concrete justification for this wave's own instruction not to
mock the primary end-to-end path.

The collector telemetry capability this wave's own instructions described (mandatory/optional events,
typing, bot signal, mouse/touch) **does not exist in the frozen backend contract** and was not
invented — see section 3.

## 2. Wave 29 Baseline

Confirmed unchanged at the start of this wave: real PostgreSQL 18 verification, collector/PostgreSQL
integration (82 tests), migration head `c2c0dd59eac9`, token issuance/verification, concurrency,
audit-rollback semantics, cross-tenant isolation, the environment-lookup storage-failure fix, 9/9
mutation tests killed, 481 unit/security/services, 948 integration tests, ruff/mypy clean.

## 3. Existing Client Contract

`fraud-platform-api/docs/collector_client_contract.md` is the authoritative, frozen contract — read in
full before any code was written. Its nine required behaviors (token acquisition is server-to-server
only; delivery to the browser is out of scope for this client; the collector call is
`POST /collector/v1/collect` with `{"token": "..."}` and NOTHING else; correlation is implicit in the
token; the token must never be logged; same-token retry is idempotent; an expired token requires fresh
server-side issuance; collector errors must never block checkout; no indefinite retry) match the
current server implementation exactly (`app/collector_app.py::_CollectRequest`,
`model_config = ConfigDict(extra="forbid")`) — **no mismatch exists between the documented contract and
the actual implementation.**

**The mismatch is between Wave 30's own prompt and both of those.** The prompt describes telemetry
collection (mandatory/optional events, typing, bot signal, navigation, form, mouse/touch) as part of
this client's job. No such capability exists anywhere in the frozen collector architecture (Waves
27–29): the collector's entire body is a single opaque token; it observes exactly one fact (the
connecting IP's Tor classification, via the existing, unmodified classifier) and nothing else. Per
Phase 2's own instruction — "if the current backend implementation and documented contract disagree:
STOP and document the exact mismatch before changing either side" — this is documented here and in
`src/lib/collector/README.md`, not silently resolved by inventing a telemetry payload or extending the
backend. **Telemetry collection, event batching, and telemetry payload validation (Phases 6–8) are
N/A** for this reason, not omitted by oversight.

## 4. Client Architecture

`src/lib/collector/` (framework-independent, no React/routing/query dependency):

- `collectorClient.ts` — `CollectorClient`: `setToken()`, `hasToken()`, `isExpired()`, `clearToken()`,
  `submit()`. No telemetry collection, no payload construction beyond the token itself (section 3).
  Deliberately not built on `@/lib/api/client.ts` (`apiFetch`) — that client attaches this dashboard's
  own session credentials and targets `/api/v1`, a different, unrelated boundary.
- `types.ts` — the server's closed `CollectorOutcome` vocabulary, reproduced verbatim, plus four
  client-only conditions with no server equivalent (`client_token_not_set`,
  `client_token_expired_locally`, `client_network_failure`, `client_malformed_server_response`).
- `index.ts` — barrel export.
- `README.md` — the scope-mismatch documentation from section 3.

The client computes no risk score, band, policy, or fraud decision, and contains no F4 logic — it has
no code path that could (confirmed by reading the full, ~200-line module: it is a token holder and an
HTTP POST, nothing else).

## 5. Token Lifecycle

Issuance (`POST /api/v1/collector/tokens`, `X-Api-Key`) is **not implemented client-side** — doing so
would require embedding a merchant API credential in browser code, exactly what the contract exists to
prevent (contract point 2). `setToken()` is the only way a token enters the client; it is held in a
private class field (`#token`, `#expiresAt`), never `localStorage`/`sessionStorage`. `isExpired()`
fails closed (`null` expiry, or an unparseable date, both count as expired). An expired token triggers
`onTokenExpired` (an optional callback) and makes **no network call** — verified by a unit test
(`fetchImpl` spy, zero calls). Re-acquisition is the host page's own responsibility, per the contract's
own "a real implementation needs a way to ask its own backend for a fresh token" note.

## 6. flow_id Correlation

The client never reads, stores, or sends `flow_id` or any session-shaped identifier — confirmed by a
structural unit test enumerating the client's entire public API surface and asserting no property name
contains `flow` or `session`. Correlation is carried entirely inside the opaque token (the contract's
own point 4); the client is a byte-for-byte pass-through, proven by a test asserting the exact string
given to `setToken()` is the exact string sent in the request body. The backend-side identity proof
(the SAME `flow_id` → the SAME `correlation_reference`, through real token issuance → real collection →
a later, independent lookup) is `fraud-platform-api/tests/integration/test_collector_wave30_e2e_correlation.py`
(new this wave, verified against real PostgreSQL, section 14). No `collector_session_id` was
introduced anywhere in either repository (grepped, zero matches in both).

## 7. Telemetry Collection

**N/A — see section 3.** No telemetry collection, no bot-signal inference, no fingerprinting, and no
additional personal data collection exist in this client. Nothing was built to leave stubbed.

## 8. Event Lifecycle

**N/A — see section 3.** No event batching, no background telemetry queue. `submit()` is a single,
bounded, idempotent call.

## 9. Payload Contract

The ONLY payload is `{"token": "<token>"}`. Tested: valid payload (acceptance), missing token
(`client_token_not_set`, never a network call), malformed/tampered token (`rejected_token_invalid` from
the real backend), invalid/empty `flow_id` — N/A to this client (flow_id is never sent, section 6).
"Oversized payload" — N/A (the payload is one bounded string, the token itself, whose shape the server
already validates structurally). Backend validation (`extra="forbid"`, structural claim validation) was
not weakened in any way to accommodate the client — the client was built to already match it exactly.

## 10. CORS

**A genuine defect found and fixed** (section 1, item 2). Before the fix: a real browser's preflight to
`/collector/v1/collect` was evaluated by the DASHBOARD's own `CORSMiddleware` (added to the outer
`app`, which wraps the entire ASGI application including everything reachable through
`app.mount("/collector", collector_app)`), never reaching `collector_app`'s own, separately-configured
CORS policy. Fixed with `app/core/middleware.py::PathExcludingCORSMiddleware` — a thin wrapper that
skips the dashboard's `CORSMiddleware` entirely for `/collector/*` paths, letting the request fall
through to routing → the `Mount` → `collector_app`'s own `CORSMiddleware`, which now actually runs.
Verified three ways: (a) a new Python regression test proving a dashboard-allowed origin is correctly
REJECTED on the collector path while still succeeding on a dashboard path; (b) a real Chromium browser
test proving an allowed origin succeeds end-to-end; (c) the same real browser proving an unconfigured
origin is blocked by the browser's own CORS enforcement (`client_network_failure`, never treated as
success). The collector's own CORS settings (`COLLECTOR_CORS_ALLOWED_ORIGINS_SANDBOX`/`_LIVE`) are
still, correctly, never the authorization boundary — the token's signature is — this fix only restores
CORS's own defense-in-depth role to actually functioning for this path.

## 11. Retry-After

Implemented per the contract's point 9 ("MAY honor it for a single bounded retry; must not spin"): a
429 with a `Retry-After` header is retried exactly once, only if the wait is within a client-side
safety cap (`maxHonoredRetryAfterSeconds`, default 10s — a defensive UX bound, never a production
rate-limit policy, which remains entirely server-side). A non-numeric or absent header is never
honored. A rate-limited outcome is never reported as success. Mutation-tested (section 23): the bound
check and the single-retry guard are both confirmed load-bearing.

## 12. Safe Failure

The full closed vocabulary (`types.ts`) distinguishes every server outcome plus four client-only
conditions. A collector failure of any kind resolves (never rejects) `submit()`'s promise — it cannot
accidentally abort an unrelated `try`/`catch` around checkout — and is never silently treated as
"telemetry clean" (there is no telemetry to begin with, section 3) and never feeds into any
BLOCK/STEP_UP/REVIEW decision anywhere in this client (it computes none).

## 13. Frontend Integration

fraud-web-app is Clarion's own tenant back-office dashboard, not a merchant checkout page — no existing
checkout/demo flow existed to integrate against (confirmed, Phase 1: zero prior "collector" code
anywhere in this repo). Per the instruction's own fallback, the smallest sandbox demonstration page was
built: `src/pages/sandbox/collector-demo.tsx`, routed at `/sandbox/collector`, outside the authenticated
`/app` shell, clearly labeled "Sandbox / test functionality" with a warning banner. No Redux/state
library was introduced (none was needed); no second HTTP framework; no rewrite of existing
authentication. An optional `?backend=` query parameter lets the demo page target a different collector
origin than its own — used only by this wave's own cross-origin CORS test, documented as not something
a real merchant integration would do (a real integration points at one fixed collector origin).

## 14. End-to-End Sandbox Flow

Two real, non-mocked proofs, deliberately split by what each can prove:

- **Backend identity proof** (`fraud-platform-api/tests/integration/test_collector_wave30_e2e_correlation.py`,
  2 tests, verified against real PostgreSQL): real HTTP token issuance → real HTTP collection → a
  later, independent lookup using ONLY a re-derived `flow_id` pseudonym, proving the same observation is
  found (not merely that the HTTP calls returned 2xx).
- **Browser client proof** (`fraud-web-app/src/test/e2e/collector-e2e.node.test.ts`, 3 tests, real Node
  `fetch` against a real, separately-spawned fraud-platform-api process; and
  `collector-browser.spec.ts`, 5 tests, real Chromium via Playwright against the same kind of real
  process): the REAL `CollectorClient` class, the exact module the sandbox page uses, driven against a
  real backend, proving acceptance, idempotency, invalid-token rejection, real CORS enforcement, and no
  token leakage.

Both are live-process, not ASGI-transport-mocked, and both are documented as SQLite-backed (the
Node/browser side) specifically to keep process orchestration from a JS test simple — the PostgreSQL
claim is carried by the Python-side proof, for the identical code paths.

## 15. Tenant Isolation

Carried by the backend's own, already-verified mechanism (Wave 29): the environment lookup is scoped
by `(environment_id, tenant_id)` together, both derived only from the signed token's own claims — the
collector request body has exactly one field (`token`), so there is no payload vector for a caller to
even attempt supplying a different tenant. Not re-derived this wave; re-confirmed still true by reading
`app/services/collector_service.py` in full (Phase 1).

## 16. Environment Isolation

Same mechanism, same confirmation. `collector_sandbox_enabled`/`collector_live_enabled` are resolved
from the verified token's own `environment_id`, never from any browser-supplied value — the client has
no environment-shaped field to even send (section 6's structural test also covers this: no property
name contains `environment`).

## 17. Rate Limiting

**A genuine defect found and fixed** (section 1, item 1): `get_rate_limiter()` returned
`NullRateLimiter` unconditionally; no real deployment could ever accept a collector request. Fixed:
constructs one real `InMemoryRateLimiter` from `Settings`'s own already-configured numeric limits once
both `collector_rate_limiter_configured` and `collector_rate_limits_configured` are true — inventing no
number, reusing exactly the values `collector_production_ready` already requires. A new backend test
proves the default-wired (no DI override) limiter genuinely enforces its configured limit. The
E2E/browser tests above exercise this exact code path for the first time outside a test fixture.

## 18. Token Expiry

`isExpired()` fails closed on `null` or unparseable `expiresAt`. Client-side expiry check happens
BEFORE any network call (verified: zero `fetchImpl` invocations for an expired token). No short TTL
was put into any production configuration — the test-only TTLs used in this wave's own test env vars
(300s, for E2E process spin-up convenience) are explicitly test-only, matching every prior wave's own
"no invented production value" discipline.

## 19. Security Review

- **Token exposure in console**: tested directly (spies on all five `console.*` methods across a full
  submit cycle, success and failure) — zero calls. Also tested in a real browser (Playwright
  `page.on("console")`) across the full flow.
- **Token exposure in URL**: tested — the request body, not the URL, carries it; also tested in a real
  browser across every request the full flow makes.
- **Token exposure in telemetry**: N/A, no telemetry exists.
- **Credential exposure**: no API credential (`X-Api-Key`) appears anywhere in this client — issuance
  is out of scope by design (section 5).
- **XSS-sensitive insertion points**: the sandbox page uses no `dangerouslySetInnerHTML` anywhere
  (confirmed by reading the full component); React's default JSX escaping applies throughout.
- **Unsafe localStorage/sessionStorage use**: none — tested directly in a real browser, dumping both
  stores after a full successful submission and asserting the token string appears in neither.
- **Accidental logging**: covered by the console test above.
- **Cross-origin requests**: covered by section 10's CORS fix and its three-way verification.
- **Environment/tenant spoofing**: N/A to the client (sections 15–16) — no field exists to spoof.
- **flow_id manipulation**: N/A — no field exists (section 6).
- **Duplicate submissions**: tested — idempotent, both via unit test (mocked) and the real E2E/browser
  proofs (real `accepted` then real `accepted_duplicate`).
- **Malformed server responses**: tested — non-JSON body, unexpected shape, and an unrecognized
  (future) status string all map to `client_malformed_server_response`, never guessed at.

## 20. Privacy Review

Every field this client sends, exhaustively: **`token`** (one field, the entire payload). Why needed:
it is the sole input the collector endpoint accepts. Required by the frozen contract: yes, exactly.
Personal data: no — an opaque, server-issued, short-lived, single-use correlation artifact containing
no customer-identifying content readable by this client (it cannot decode the signed claims, which are
base64-encoded and HMAC-protected server-side only). Sent only to the intended collector: yes — the
client has no other network call anywhere in its code. Stored: no, held only in a private in-memory
field for the current page session. Logged: no (section 19). Removable without breaking the contract:
no — it is the one thing the contract requires. No additional tracking, fingerprinting, or inferred
sensitive/protected characteristic exists anywhere in this client.

## 21. Testing

`src/test/collector-client.test.ts` — 35 unit tests (token handling, no-logging, outcome mapping,
Retry-After/bounded retry, duplicate submission, baseUrl configuration, no-flow_id structural checks).
`src/test/collector-sandbox-page.test.tsx` — 8 integration-style tests (msw-mocked) covering the
sandbox page's own UI behavior, including the masked token input and that an expired token never
reaches the network. All using this repository's existing framework (Vitest, Testing Library, msw) —
no new unit-test framework introduced.

## 22. E2E Verification

`vitest.e2e.config.ts` (`npm run test:e2e`, Node environment, no msw) — 3 real-backend tests. Chromium
via Playwright (`npm run test:browser`, `playwright.config.ts`) — 5 real-browser tests, installed this
wave (`@playwright/test`, Chromium only — the smallest appropriate addition, no other browser engine,
no large test platform). Both suites gracefully skip (reported UNVERIFIED, not guessed at) if the
sibling `fraud-platform-api` checkout or its runtime (`uv`) is unavailable — in THIS session, both
repositories and `uv` were present, so both suites actually ran, and both passed in full after the two
fixes in sections 10 and 17.

## 23. Mutation Testing

Client (`collectorClient.ts`, 6 mutants: expiry-comparison inversion, null-expiry fail-open, Retry-After
bound inversion, bounded-retry guard removal, outcome-whitelist removal, 429-status-check corruption) —
**6/6 killed**. Backend `get_rate_limiter()` wiring (3 mutants: AND→OR guard inversion, guard removal,
a dropped rate-limit dimension) — **3/3 killed**. Backend `PathExcludingCORSMiddleware` (2 mutants:
exclusion check removed, exclusion inverted) — **2/2 killed**. The full Wave 28F/29 backend mutation
sweep (9 mutants) was re-run unchanged after all Wave 30 backend edits and remains **9/9 killed**. No
survivor was dismissed or weakened around; every one that appeared was closed with a new test.

## 24. Full Regression

| Suite | Result |
|---|---|
| Frontend unit/integration (Vitest, `npm test`) | **154 passed**, 0 failed |
| Frontend E2E (`npm run test:e2e`) | **3 passed**, 1 skip-branch (unused) |
| Frontend real-browser (`npm run test:browser`, Chromium) | **5 passed** |
| Frontend lint (oxlint) | clean |
| Frontend type-check (`tsc -b`, both projects) | clean |
| Frontend production build (`vite build`) | succeeds |
| Backend unit + security + services | **481 passed**, 0 failed |
| Backend integration (3 of 4 foreground chunks completed) | **707 passed**, 0 failed |
| Backend integration (4th chunk: waves 3/4/5/6/9/11/12/16/17/26) | **NOT completed — host memory pressure killed it twice; per explicit instruction, not restarted without being asked** |
| Backend collector suite, real PostgreSQL | **83 passed**, 0 failed |
| Backend ruff | clean |
| Backend mypy | clean (98 files, one documented `type: ignore[arg-type]` for a known Starlette/mypy ParamSpec friction, not a real defect) |
| Backend mutation | **20/20 killed** (cumulative: 8 Wave 28F + 1 Wave 29 + 3+2 Wave 30 + 6 client) |

The incomplete backend chunk covers context-provider/rotation/scoring logic unrelated to CORS or rate
limiting; it was fully green in Wave 29 and nothing in those files was touched this wave. Risk is
assessed as low but **not claimed as verified** — stated honestly per this wave's own discipline, not
silently assumed passing.

## 25. Production Configuration Still Pending

Unchanged from Wave 29: `collector_token_ttl_seconds`, all five `collector_rate_limit_*_per_minute`
values, `collector_cors_allowed_origins_sandbox`/`_live` production values, retention period, final
deployment-topology commitment, security/operational ownership assignment, formal Model-A rollout
decision. None were invented this wave, including while building and exercising the real E2E tests
(which use clearly-labeled, clearly-test-only values, injected only into ephemeral, throwaway spawned
processes, never written to any `.env` or production configuration file in either repository).

## 26. Wave 31 Preconditions

1. Complete the one remaining backend regression chunk (waves 3/4/5/6/9/11/12/16/17/26 integration
   tests) once host memory allows, to close out full-suite confidence for this wave's two backend fixes.
2. An owner must resolve section 25's items before any sandbox activation attempt.
3. If Wave 31's scope is real browser telemetry (mouse/touch/typing/bot-signal), that is a NEW backend
   capability requiring its own contract-freeze wave (mirroring Wave 28A–C's process) — this wave's own
   finding (section 3) means it cannot be assumed to already exist.
4. The two fixes in this wave (sections 10, 17) should be specifically called out to whoever eventually
   reviews sandbox-readiness sign-off, since they silently blocked ALL real collector traffic until now
   — any prior belief that "the collector just needs configuration values to go live" was incomplete.
