# Wave 32B — Developer + Sandbox Collector Experience

## 1. Wave Objective

Close Wave 32A's single P0 finding — the collector capability is real and PostgreSQL-verified
(Waves 28–31) but has zero representation inside the authenticated tenant product — with the smallest
production-grade change: group the existing `/app/api` page and the existing `/sandbox/collector` demo
under one discoverable "Developer" navigation entry, and improve both pages' own content so a tenant
user actually understands what the collector is and how to try it, without inventing any new backend
capability.

## 2. Wave 32A Findings Used as Baseline

21 routes, 0 fabricated/omitted (cross-validated against `App.tsx`). The collector backend is real;
its only UI was `/sandbox/collector`, reachable solely by direct URL, outside `APP_NAV_GROUPS` entirely.
Credential UI already fully matches backend capability — not to be redesigned. Decision Trace already
correctly restricted to the public contract — not touched. Environment is server-derived everywhere —
no selector exists or should exist. The only RBAC boundary anywhere is `require_role(OWNER, ADMIN)` on
credential mutation — no other permission exists to invent or enforce. Policies/Cases/Transactions/
Assessment-listing/Analytics/Platform Admin all remain correctly out of scope (no backend capability).

## 3. Existing Capabilities Discovered (Phase 1 Reconciliation)

Re-confirmed directly from source before any change:

- `POST /api/v1/collector/tokens` (X-Api-Key, server-to-server, request `{"flow_id"}`, response
  `{"token", "expires_at"}`) — `app/api/v1/collector.py`.
- `POST /collector/v1/collect` (public, token-body-only, no other auth) — `app/collector_app.py`,
  mounted separately from `/api/v1`.
- `CollectorClient` (`src/lib/collector/collectorClient.ts`, Wave 30) — accepts a token via
  `setToken()`, never issues one itself, submits to the collector, returns the full closed outcome
  vocabulary (`src/lib/collector/types.ts`).
- `/sandbox/collector` (`src/pages/sandbox/collector-demo.tsx`, Wave 30) — already fully functional:
  paste-a-token form, real submission, outcome display, real-browser CORS/no-leakage coverage
  (Playwright). **Nothing about its working functionality was broken or replaced.**
- `/app/api` (`src/pages/app/api.tsx`) — already functional: real credentials table
  (`useCredentials`), static request/response documentation for `/assessments` and `/context-events`
  only. The collector was undocumented here — the one concrete gap this wave closes.
- Navigation (`src/data/app-nav-links.ts` → `src/components/app/sidebar-nav.tsx` /
  `mobile-nav-drawer.tsx`) — both already fully data-driven off `APP_NAV_GROUPS`; adding a group
  required zero changes to either rendering component.
- `Topbar`'s existing `EnvironmentBadge` (`src/components/app/topbar.tsx`) already establishes the
  exact right pattern this wave had to stay consistent with: a static, honest "Sandbox" indicator,
  never a selector.

**No discrepancy was found between documentation and implementation** — Wave 32A's own inventory held
up under direct re-verification.

## 4. Changes Actually Implemented

1. Added a **Developer** navigation group (`API`, `Sandbox / Collector`) to `APP_NAV_GROUPS`, moving
   `API` out of `Configuration` (which keeps Policies/Credentials/Audit log/Settings). Zero new
   navigation component — `SidebarNav`/`MobileNavDrawer` already render any group in the array.
2. `/app/api`: added the collector token endpoint to the existing endpoint table, and one new card
   ("Observing the connecting browser") explaining the collector's purpose and linking to
   `/sandbox/collector`. The existing credentials table and request/response examples for
   `/assessments`/`/context-events` are unchanged.
3. `/sandbox/collector`: added a "What this tests" explanatory card (purpose, prerequisite — a token
   from the tenant's own backend — and a link to Credentials), a human-readable
   `OUTCOME_COPY` mapping (title + plain-English description) shown alongside the existing raw outcome
   code — not replacing it, since the raw code remains useful for a developer reading the real
   contract — and a "Back to dashboard" link shown only when an authenticated session exists. The
   existing form, submission logic, token-expiry check, and Retry-After handling are byte-for-byte
   unchanged.

No new backend endpoint was added (section 8).

## 5. Routes Changed/Added/Retained

**Retained, unchanged**: all 21 routes from Wave 32A's inventory, including `/sandbox/collector`'s own
path and its deliberately-unauthenticated boundary (Phase 11's own question — determined NOT worth
moving under `/app`: the page is designed to be usable by an external developer holding only a token,
with no dashboard session at all; moving it under `/app` would force an auth requirement the real
contract doesn't need and would break the existing `?token=&expires_at=&backend=` query-parameter
contract the Wave 30 E2E/Playwright suites depend on). **No route was added or removed.**

## 6. Navigation Changes

One new group ("Developer") containing `API` and `Sandbox / Collector`. `API` moved out of
"Configuration" into "Developer". No other group changed. Neither new link is tagged `soon` — both
capabilities are real today (verified by test, section 11).

## 7. Backend Endpoints Consumed

`GET /api/v1/credentials` (unchanged, `/app/api`'s existing credentials table) and
`POST /collector/v1/collect` (unchanged, the sandbox page's existing submission). No new endpoint
consumption.

## 8. Backend Endpoints Added

**None.** Phase 5's own decision process was followed explicitly: the one conceivable convenience — a
session-authenticated endpoint letting a signed-in dashboard user mint a collector token directly,
instead of needing their own backend to call the existing `X-Api-Key`-authenticated issuance endpoint
— was considered and rejected. It would blur the deliberate, frozen boundary between an API credential
(representing the tenant's own backend) and a dashboard session (representing a staff member), and the
dashboard cannot hold a credential secret long enough to use it anyway (the reveal-once dialog
deliberately drops the secret from memory on close). The existing contract already requires a
tenant's own backend to mint a token; nothing about making this page discoverable changes that
requirement, and nothing justified inventing a second issuance path.

## 9. Auth/RBAC Behavior

Unchanged. The Developer nav group inherits the same `RequireAuth`/`RequireTenant` gating as every
other `/app/*` route (it is rendered by the same `AppShell`/`SidebarNav`, which only ever mounts inside
those guards) — confirmed by test: a signed-out visitor to `/app/overview` is redirected to `/signin`
before the Developer group (or any nav) ever renders. `/sandbox/collector` remains unauthenticated by
design (section 5); it does not call any role-gated or tenant-scoped endpoint, so there was nothing to
gate. No new permission, role, or RBAC check was introduced anywhere.

## 10. Sandbox/Live Behavior

Unchanged and not touched: `/sandbox/collector` remains sandbox-only in effect (the only credentials
the dashboard can issue are sandbox, section 2); no live-environment control of any kind was added
anywhere, including no selector, toggle, or implied live support in any new copy. The new "What this
tests" card explicitly instructs the user to obtain a token via their own API credential (sandbox-only,
per the existing, unchanged `create_sandbox_credential` path) — it does not claim or imply live
collector support.

## 11. Credential/Token Behavior

Unchanged. `SecretRevealDialog`'s reveal-once behavior, `CredentialsRotate`/`Revoke`'s OWNER/ADMIN
gating, and the collector token's own body-only transport, password-masked input, and
never-echoed-after-submission handling are all byte-for-byte as they were before this wave — verified
by re-running every pre-existing test for both pages (section 13) with zero changes required to make
them pass.

## 12. Security/Privacy Review Results

Re-reviewed every new/modified line against Phase 8's checklist: no secret appears in any URL (the
`?token=` query param predates this wave and is explicitly documented, Wave 30, as a deliberate
test/automation convenience, not a secret-in-URL regression — the value is a short-lived,
single-use collector token, not an API credential secret); no secret written to
`localStorage`/`sessionStorage` (the new `OUTCOME_COPY` object and "What this tests" card are pure
static/derived JSX, no new storage call anywhere); no secret logged (`console.*` is not called
anywhere in either modified file); no client-controlled tenant or environment field was added to any
request; no cross-tenant call was introduced; no internal fraud-engine evidence, rule ID, threshold, or
decision-trace internal was added to either page (the new API-page collector section describes only
the publicly-documented contract, reusing language already present in
`fraud-platform-api/docs/collector_client_contract.md`); no new analytics/tracking call exists anywhere
in the diff. Re-confirmed by the full real-browser Playwright suite (section 13) continuing to pass
unchanged, including its own dedicated no-token-leakage and no-storage assertions.

## 13. Tests Executed, Exact Results

| Suite | Result |
|---|---|
| Vitest (full) | **168 passed**, 0 failed (154 pre-existing + 11 new `developer-nav.test.tsx` + 3 new in `collector-sandbox-page.test.tsx`) |
| oxlint | clean |
| `tsc -b` (both projects) | clean |
| `vite build` | succeeds |
| Node E2E (`npm run test:e2e`, real separate backend process) | **3 passed**, 1 skip-branch (unused) — unchanged from Wave 30/31 |
| Real-browser E2E (`npm run test:browser`, Chromium, real backend) | **5 passed** — unchanged from Wave 30, re-run against the MODIFIED sandbox page and confirmed still green |

New tests added this wave (14 total): `src/test/developer-nav.test.tsx` (11 — Developer group renders
with both links and no `Soon` tag; `API` shows `aria-current="page"` on `/app/api` and `Sandbox /
Collector` does not; clicking the sandbox link from the dashboard navigates there; a signed-out visitor
never sees the Developer nav at all; the API page renders with the new collector section and a working
link; the collector endpoint is documented; the existing credentials table still renders; the sandbox
page shows "Back to dashboard" only when signed in; the sandbox page explains its purpose and token
prerequisite). `src/test/collector-sandbox-page.test.tsx` (+3 — a human-readable title accompanies the
raw outcome code for a success case; a rate-limited outcome shows its title and `Retry-After`; a
network failure shows a human-readable title, never a raw exception). No existing test was weakened,
skipped, or deleted.

Backend: **not touched** (section 8) — no backend test suite was run this wave, since nothing in
`fraud-platform-api` or `fraud-engine` changed. Stated honestly, not silently assumed.

## 14. Known Limitations

- `CollectorClient`'s own bounded-retry behavior (Wave 30, unchanged) means that if a real server
  response carries a `Retry-After` value within the client's default 10-second honor window, the
  sandbox page's "Submitting…" state will genuinely wait that long before resolving — discovered while
  writing this wave's own rate-limit test (worked around there with a `Retry-After` value exceeding the
  cap, exactly as a real rate-limited server response legitimately might). This is correct, documented,
  pre-existing client behavior, not a regression — flagged here only because it is a real UX
  characteristic a developer exercising this page should expect, not a defect to fix in this wave.
- `/app/api`'s collector documentation is deliberately high-level (purpose + link to the sandbox page +
  the one token-issuance endpoint) rather than a full walkthrough with a copy-pasteable curl example
  for the collector call itself (unlike the existing `/assessments` example) — the collector call's
  body is trivial (`{"token": "..."}`), and a curl example would need a real token to be meaningful,
  which cannot be fabricated without misleading the reader; the sandbox page itself is the
  "try it" surface.

## 15. Explicitly Deferred Capabilities

Everything Wave 32A classified as blocked on backend work that does not exist (Policies, Cases,
Transactions, Assessment listing, Analytics, Platform Admin) remains untouched and unbuilt, per this
wave's own explicit instruction. A collector-status read endpoint (Wave 32A section 16/30, "SUPPORTED
— but requires a small new read endpoint") was considered against Phase 5's own "only if genuinely
required" test and judged NOT required for a coherent tenant-facing experience this wave — the existing
token-issuance-and-submission flow is fully exercisable without it. Rendering the collector's own audit
trail (`collector_token.issued` events) inside `/app/api` or cross-referenced from Credentials was also
deferred — the generic `/app/audit-logs` page already surfaces these with zero new backend or frontend
code, so building a second view was not judged worth the added surface area this wave.

## 16. Follow-up Recommendations for Wave 33

Not started automatically, per instruction. Two candidates, in dependency order: (1) verify whether
`/app/audit-logs` already renders `collector_token.issued` rows legibly for a tenant user (zero backend
change, a small frontend verification/polish task); (2) if a collector-status read endpoint is ever
judged worth building, scope it narrowly (e.g. "is the collector currently enabled for my sandbox
environment") rather than exposing raw configuration, and treat it as a genuinely new backend-capability
wave with its own contract freeze, tests, and PostgreSQL verification — not an incidental addition to a
frontend wave.

## Acceptance Criteria Checklist

| # | Criterion | Status |
|---|---|---|
| A | Developer navigation discoverable and coherent | **MET** |
| B | API and Sandbox/Collector grouped under Developer | **MET** |
| C | Existing credential behavior remains correct | **MET** — unchanged, re-verified by test |
| D | Existing sandbox collector functionality remains functional | **MET** — unchanged, re-verified by test (Vitest + real browser) |
| E | Sandbox collector reachable from the authenticated tenant product | **MET** |
| F | No unsupported backend capability fabricated | **MET** — no new endpoint |
| G | No live environment selector introduced | **MET** |
| H | No fake Platform Admin UI introduced | **MET** |
| I | No fake Policies/Cases/Transactions/Assessment-listing functionality introduced | **MET** |
| J | No internal fraud-engine information exposed | **MET** |
| K | No security boundary delegated to frontend controls | **MET** — all gating remains server-side; UI gating is defense-in-depth only, as before |
| L | Tenant isolation remains enforced by the backend | **MET** — backend untouched |
| M | Loading/error/empty/rate-limit states are production-grade | **MET** — extended with human-readable copy for the full closed outcome vocabulary |
| N | Tests cover all changed behavior | **MET** — 14 new tests, 0 weakened |
| O | All relevant validation suites pass | **MET** — frontend Vitest/oxlint/tsc/build/E2E/Playwright all green; backend not applicable (untouched) |
| P | Documentation accurately describes what was implemented | **MET** — this document |
| Q | Wave 32A inventory remains internally consistent with the final route tree | **MET** — no route was added, removed, or renamed; `docs/ui-inventory-v1.json` required no update |
| R | Git diff contains only intentional changes | **PARTIALLY APPLICABLE** — fraud-web-app is not a git repository (confirmed, `git status` fails); the exact file list in section 4/13 is the complete, manually-verified change set. fraud-platform-api IS a git repo but was not touched this wave; its pre-existing full-tree `git status` diff predates this wave and is unrelated to it (not caused or worsened by Wave 32B). The abandoned `tests/sandbox_merchant.py` from the interrupted Wave 32 was confirmed untouched (file mtime predates this wave's start). |

**Wave 32B is complete per every applicable acceptance criterion.**
