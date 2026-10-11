# Wave 33A — Tenant Application Capability + UX Audit

Read-only audit and planning wave. No application code, backend code, or fraud-engine code was
changed. Two artifacts were produced: this document and `docs/tenant-capability-matrix-v1.json`.

## 1. Executive Summary

Wave 32A's inventory (21 routes) was re-verified against the current route tree and found to have
**zero drift** — the exact same 21 paths exist, in the same nesting, with the same components. Wave
32B's own changes (the Developer nav group, the two page edits) are confirmed present and functional.
Re-verification against the current `fraud-platform-api` router found the **exact same 15 HTTP
endpoints** as Wave 32A's own exhaustive enumeration — no new route, no removed route. The backend
capability boundary has not moved since Wave 32A.

The single most actionable, evidence-based finding this wave adds beyond 32A: **Wave 32B's own
deferred question (recommendation #16) is now answered with code-level certainty.** `GET /audit-logs`
returns a fully generic `AuditLogOut` (no allowlist of `action` values anywhere in the schema or
service layer), and `/app/audit-logs` renders `action`, `actor_type`/`actor_id`, `entity_type`/
`entity_id`, `correlation_id`, and both `before_json`/`after_json` generically, with no special-casing
of any action string. `collector_token.issued` rows (written by
`app/api/v1/collector.py::issue_collector_token`) are therefore **already fully rendered today, with
zero code change required** — confirmed by reading both the schema and the rendering component in
full, not merely inferred from naming. The one real limitation found: `AuditRepository.list_for_tenant`
hardcodes `limit=50` with no pagination parameter exposed by the API at all — a backend characteristic,
not a frontend gap.

A second concrete, evidence-based, frontend-only opportunity was found on the Overview page (section
6): its "Your workspace" section already uses 100% real data (tenant identity, member count, active
credential count, 5 most recent real audit rows) — there is room to derive one or two additional real
(not fabricated) summary figures from data the page already fetches, without any backend change.

No other new functional opportunity was found. Every other currently-incomplete page remains blocked
on backend capability that does not exist (Policies, Rules configuration, Cases, Transactions,
Analytics, Assessment listing) — re-confirmed by direct route enumeration, not assumption.

## 2. Wave 32A/32B Baseline (Re-verified)

`grep -oE 'path="[^"]*"' src/App.tsx` run this wave reproduces the identical 21-path list Wave 32A
recorded. `app/api/v1/*.py` re-enumerated this wave reproduces the identical 15-endpoint list (plus
the separately-mounted `POST /collector/v1/collect`). `find app/api -iname "*polic*"` /
`*case*` / `*rule*` all return empty, confirmed again. Wave 32B's Developer nav group, `/app/api`'s new
collector section, and `/sandbox/collector`'s new explanatory card and `OUTCOME_COPY` are all present
and unchanged in the current source. **No contradiction was found between the prior two waves'
documentation and the current repository state.**

## 3. Current Route Inventory

| Route | Status | Backend dependency | Exists? | Page test |
|---|---|---|---|---|
| `/` | FUNCTIONAL | none | n/a | none |
| `/signin` | FUNCTIONAL | `POST /auth/login` | yes | `auth.test.tsx` |
| `/signup` | FUNCTIONAL | `POST /auth/register` | yes | `auth.test.tsx` |
| `/sandbox/collector` | FUNCTIONAL | `POST /collector/v1/collect` | yes | `collector-sandbox-page.test.tsx` + real-browser E2E |
| `/app/onboarding` | FUNCTIONAL | `POST /tenants` | yes | none (reached only via redirect) |
| `/app` (index) | FUNCTIONAL | none (redirect) | n/a | `auth.test.tsx` |
| `/app/overview` | PARTIAL | `GET /audit-logs`, `GET /credentials`, `GET /tenants/current/members` (real) + none for assessment metrics (sample) | partial | `auth.test.tsx`, `fraud-ui.test.tsx` |
| `/app/assessments` | SAMPLE_MODE | none (no list endpoint exists) | no | `fraud-ui.test.tsx` |
| `/app/assessments/sample/:sampleId` | STATIC_REFERENCE | none (sample-only by design) | no | `fraud-ui.test.tsx` |
| `/app/transactions` | UNAVAILABLE | none | no | none |
| `/app/signals` | STATIC_REFERENCE | none (product documentation) | no | none |
| `/app/rules` | STATIC_REFERENCE | none (product documentation) | no | none |
| `/app/cases` | PLACEHOLDER | none | no | none |
| `/app/decision-trace` | FUNCTIONAL | none (paste-based; operates on a real `POST /assessments` response) | n/a | component-level only (`fraud-ui.test.tsx`), no page-route test |
| `/app/policies` | STATIC_REFERENCE | none (no HTTP route exists anywhere for policy management) | no | none |
| `/app/analytics` | SAMPLE_MODE | none | no | none |
| `/app/api` | FUNCTIONAL | `GET /credentials` | yes | `developer-nav.test.tsx` (new, Wave 32B/33A) |
| `/app/credentials` | FUNCTIONAL | `GET/POST /credentials`, `POST .../rotate`, `POST .../revoke`, `GET /tenants/current/members` | yes | `auth.test.tsx`, `credentials.test.tsx` |
| `/app/audit-logs` | FUNCTIONAL | `GET /audit-logs` | yes | `credentials.test.tsx` |
| `/app/settings` | FUNCTIONAL | `GET /tenants/current`, `GET /tenants/current/members` | yes | `credentials.test.tsx` |
| `*` | FUNCTIONAL | none | n/a | none |

**Comparison against `ui-inventory-v1.json`**: one terminology difference, not a factual one.
Wave 32A's JSON used `EXISTS_PLACEHOLDER_SAMPLE`/`EXISTS_STATIC_DEMO`; this wave's prompt asked for
`SAMPLE_MODE`/`STATIC_REFERENCE`/`UNAVAILABLE` instead. `docs/tenant-capability-matrix-v1.json` (this
wave's own artifact) uses the new vocabulary; `ui-inventory-v1.json` was **not modified** (Phase 20) —
both files now coexist, each internally consistent, with this document explaining the mapping between
them rather than silently rewriting the older one.

## 4. Backend Capability Inventory

| Capability | Classification |
|---|---|
| Authentication (register/login/logout/me) | 1 — backend + frontend exist |
| Tenant creation / current tenant | 1 |
| Memberships (list) | 1 |
| Credentials (list/create/rotate/revoke) | 1 |
| Audit logs (list, tenant-scoped, limit 50) | 1 |
| Context events (`POST /context-events`) | 3 — backend exists, no frontend consumer (write-only, server-to-server by design; documented on `/app/api` but no dashboard UI calls it, correctly, since it's not a dashboard-user action) |
| Assessments (`POST /assessments` only) | 3 — backend exists (write path), no frontend consumer for the write path (correctly — assessments are the TENANT'S OWN backend's job, not the dashboard's); no read/list path exists at all (classification 8 for listing specifically) |
| Collector tokens (`POST /collector/tokens`) | 1 — now consumed via documentation + the sandbox demo (Wave 30/32B) |
| Collector ingestion (`POST /collector/v1/collect`) | 1 |
| Decision trace (public response fields only) | 5 — the full internal trace exists in `execution_json` but is deliberately not suitable for tenant exposure (assessment-api-v1.md section 9); only the public-contract subset is exposed, correctly, via the paste-based Decision Trace page |
| Rules (fraud-engine's own F1-F10 registry) | 6 — intentionally internal; no tenant-facing configuration route exists or is implied anywhere |
| Policies (versioning/activation/thresholds) | 8 — `TenantPolicyService`/`TenantPolicyVersion` exist as internal service-layer code only, exercised exclusively by tests (`tests/policy_support.py`); **no HTTP route exists for any client**, tenant or otherwise |
| Cases | 8 — no entity, no lifecycle, no route, nothing beyond the frontend's own placeholder copy |
| Transactions (list/search) | 8 — no route; `POST /context-events` reports completed events but there is no corresponding read/list endpoint |
| Analytics/monitoring/trends | 8 — no route, no aggregation service |
| Usage/rate limits (tenant-visible) | 8 — collector rate limiting exists server-side (Wave 28F) but is process-level configuration, not per-tenant, and no API exposes current usage or limits to a tenant |
| API activity beyond audit logs | 6 — audit logs already cover this; a separate "API activity" concept was not found and would duplicate it |
| Webhooks | 8 — confirmed absent again this wave (grepped) |
| Platform admin (any capability) | 8 — no role, no route, no cross-tenant query exists anywhere |

## 5. API → UI Contract Matrix

See `docs/tenant-capability-matrix-v1.json`'s `api_ui_contracts` array for the complete, per-endpoint
table (auth mechanism, tenant/environment source, request/response shape, frontend consumer, test
coverage) — not duplicated in prose here to keep the two artifacts from drifting apart. Headline
findings: **no frontend API client has no corresponding backend route** (every function in
`src/lib/api/endpoints/*.ts` and `src/lib/collector/collectorClient.ts` targets a route confirmed to
exist in section 4); **no backend endpoint is consumed by two different, duplicated frontend
representations**; `POST /context-events` and the write side of `POST /assessments` are the only two
backend routes with genuinely zero frontend consumer, and both are correctly so (server-to-server
actions, not dashboard-user actions).

## 6. Tenant Workflow Map

1. **Sign in → understand current state**: fully functional for identity/organization/credentials/
   recent-activity; NOT functional for "risk-system state" in the sense of real assessment volume or
   trend — Overview is honest about this (section 1, banner text), not broken.
2. **Manage API credentials**: fully functional, unchanged since Wave 32A's own audit.
3. **Use sandbox (Developer/API → Collector → telemetry → assessment relationship)**: functional for
   token issuance (documented) and collector submission (Wave 30, improved discoverability Wave 32B);
   the "assessment relationship" leg is real and verified at the BACKEND level (Wave 31's own
   full-correlation test, a real fraud-engine subprocess) but has **no dashboard-visible confirmation**
   — a tenant cannot see, from this UI, that their collector submission actually influenced a
   subsequent assessment's derived context. This is a genuine, named gap (section 17).
4. **View an assessment → recommendation → public-safe decision trace**: functional via the paste-based
   workflow (Decision Trace); NOT functional as an automatic "here are your assessments" list (no
   backend list endpoint).
5. **View audit activity**: fully functional, including collector/credential events (section 1).
6. **Configure risk rules**: blocked by backend (classification 6 — intentionally internal).
7. **Configure policies**: blocked by backend (classification 8 — no route at all).
8. **Investigate cases**: blocked by backend (classification 8).
9. **View transactions**: blocked by backend (classification 8).
10. **View analytics/monitoring**: blocked by backend (classification 8).

## 7. Overview Audit

Read in full this wave (`src/pages/app/overview.tsx`). The page is split cleanly into two halves:

- **Sample-gated half** (top metrics row, risk-activity chart, risk-distribution chart, recent
  assessments table, top-triggered-rules list): 100% behind `useSampleMode()`; every number shown when
  sample mode is off is `{kind: "unavailable"}`, never a fabricated zero or placeholder number. This is
  correct and should not change until an assessment-list/aggregate backend endpoint exists.
- **Real half** ("Your workspace" section): tenant name/created-date (`GET /tenants/current`), the
  caller's own role and total member count (`GET /tenants/current/members`), active credential count
  (`GET /credentials`, filtered client-side by `status === "active"`), environment status badges
  ("Sandbox: credentials issued / none yet" — real; "Live: Not available in this release" — honest,
  matches the backend exactly, section 12), and the 5 most recent real audit rows (`GET /audit-logs`).
  **No number here is fabricated.**

**Frontend-only opportunity identified** (not implemented this wave): the page already fetches up to
50 audit rows via `useAuditLogs()` for the "Recent activity" card but only displays 5. A real,
non-fabricated derived count — e.g. "N audit events in the visible window" or a small breakdown by
`action` prefix (`collector_token.*` vs `credential.*` vs others) — could be computed entirely
client-side from data already in memory, with no new backend call and no invented number. This is
listed as a Wave 33B candidate (section 17), not implemented here.

## 8. Assessments Audit

Re-confirmed: `POST /assessments` is the only assessment-related route; it returns one result
synchronously and persists it server-side, but **no endpoint lists, filters, sorts, or retrieves a
specific assessment by id**. Idempotency (`idempotency_key`, exact-retry replay, conflict-on-different-
body) was extensively verified in Wave 31 against a real engine and real PostgreSQL and is unchanged.
The public response contract (`AssessmentOut`: `assessment_id`, `status`, `submitted_at`,
`completed_at`, `risk_score`, `risk_band`, `policy{status,recommendation,policy_id,policy_version}`,
`reasons[].reason_code`, `engine{...}`, `evaluation_state`, `idempotent_replay`) deliberately excludes
rule ids/versions, evidence, thresholds, contributions, confidence, and the internal decision-trace
reference — the EXISTING Decision Trace page already respects this exactly (re-verified, section 1).
**The sample assessment UI cannot become real without new backend work** — specifically, a
tenant-scoped, paginated `GET /assessments` (list) and ideally `GET /assessments/{id}` (detail) would
be required, each needing to preserve every withholding rule above; this is explicitly BACKEND-FIRST
and out of scope for any frontend-only wave.

## 9. Rules/Policies Audit

Confirmed again, with the distinction Phase 7 asked for made explicit: fraud-engine owns an internal
F1–F10 rule registry (immutable, canonical, never tenant-configurable — no route anywhere suggests
otherwise, and none should be built). The PLATFORM layer separately has a policy versioning/activation
SERVICE (`app/services/policy_service.py`, `TenantPolicyVersion` model, draft→active→retired lifecycle,
even its own authorization helper `app/services/policy_authorization.py`) — but this entire capability
has **zero HTTP surface**, for a tenant or anyone else. It is exercised exclusively by
`tests/policy_support.py` inside the test suite. The existing `/app/policies` page's own static
"Risk/Confidence/Telemetry/Policy, exposed: true/false" framing is accurate product documentation, not
a stale assumption — Confidence and Telemetry genuinely remain unexposed today. **No tenant
configuration of rules or policies is possible today, and none should be implemented until a
policy-management HTTP API is designed and built as its own backend-first wave** (with its own
authorization model — `policy_authorization.py` already exists server-side but has never been wired to
any route, so even the permission question is unresolved, not merely the route).

## 10. Cases Audit

Confirmed again: no case entity, no lifecycle, no assignment, no notes, no audit trail beyond the
generic one, no route. `src/pages/app/cases.tsx`'s own `PLANNED_STATES`/`PLANNED_PANELS` constants are
exactly what they say — a static preview of a future design, not functionality. Entirely
BACKEND-FIRST; nothing to implement frontend-side.

## 11. Transactions/Monitoring/Analytics Audit

All three pages (`/app/transactions`, `/app/analytics`, and the sample-gated top half of `/app/overview`)
share the same root cause: no persisted, queryable transaction/assessment history exists via any API.
`POST /context-events` reports completed, successful transactions for building CONTEXT (customer
history used internally by the engine) but exposes no corresponding read path — it is write-only by
design (assessment-api-v1.md's own explicit scope). No chart or KPI anywhere in this product is backed
by real persisted, queryable data beyond what sections 6/7 already found. **No synthetic number should
be introduced on any of these three pages.**

## 12. Audit-Log Verification (Phase 10)

**Explicit recommendation: NO CHANGE.** `AuditLogOut` (`app/schemas/audit.py`) is fully generic — no
field is specific to any action type, and `audit-logs.tsx`'s own rendering (`action` as a raw
monospace string, `before_json`/`after_json` as pretty-printed JSON in a details dialog) applies
identically regardless of what wrote the row. `collector_token.issued` rows (and anything else any
future wave writes via `write_audit_log`) are already fully visible with zero code change, confirmed by
reading both the schema and the component in full this wave. The one real limitation —
`list_for_tenant`'s hardcoded `limit=50` with no pagination parameter on the API — is a backend
characteristic that would need its own backend-first change (an `offset`/`cursor` query parameter) if
a tenant's audit history ever needs to exceed 50 rows of visibility; not addressed this wave, correctly
out of scope for an audit-only pass.

## 13. Permission/Security Audit

Re-confirmed, unchanged from Wave 32A: the only role-gated action anywhere is credential
create/rotate/revoke (`require_role(OWNER, ADMIN)`, `app/api/v1/credentials.py`). Every other route
(`tenants/current`, `members`, `audit-logs`, `credentials` list) requires only an authenticated,
tenant-resolved session — any role. No UI action anywhere lacks backend enforcement (re-checked:
`canManage` in `credentials.tsx` is a mirror of the backend's own independent check, never a
substitute). No `tenant_id` or `environment` field is ever sent by the browser in any request body
(re-confirmed by reading every API client function in `src/lib/api/endpoints/*.ts` and
`src/lib/collector/collectorClient.ts`) — both are always derived server-side from the session or
credential. No privilege-escalation path, no cross-tenant reference, and no internal fraud-engine data
exposure were found anywhere in the current frontend (re-walked every page's own API consumption this
wave).

## 14. Environment/Sandbox Analysis

Unchanged: environment is 100% server-derived (from the session for dashboard routes, from the
credential for API routes, from the token's own signed claim for the collector). No UI anywhere
offers or implies a selector; `Topbar`'s own `EnvironmentBadge` is a static, honest indicator
("Sandbox" with a tooltip explaining live isn't available), the correct existing pattern, re-confirmed
not to have been touched. **A selector should not be built** — there is no backend capability for a
tenant session to safely request live-scoped data; credentials remain sandbox-only at issuance
(`create_sandbox_credential`).

## 15. UX Consistency Findings

No redesign performed (out of scope). Concrete, minor inconsistencies noted for future reference, not
acted on: (1) the "soon" nav badge is applied to Analytics/Transactions/Cases but not to
Assessments/Signals/Rules/Policies despite all seven having no live backend — already flagged in Wave
32A section 3, still true, still not corrected (a one-line nav-data fix, not attempted this wave since
it is cosmetic, not a capability gap); (2) `ChartPlaceholder kind="unavailable"` and the page-level
`UnavailableState` component serve visually similar but not identical purposes across different pages
— both are legitimate existing primitives (Phase 13's own instruction: identify, don't redesign), and
no page uses either incorrectly.

## 16. Privacy/Data Exposure Findings

No tenant-visible page displays raw IP, raw device fingerprint, raw payment data, rule evidence,
threshold values, or internal engine trace content — re-confirmed by walking every page's own render
output this wave. `AuditLogOut.after_json`/`before_json` are rendered verbatim in the Audit Logs
detail dialog — this is already safe because every `write_audit_log` call site in the backend (audited
in Waves 28–31) deliberately excludes secrets/payloads/raw sensitive values from those JSON blobs; the
frontend's own generic rendering inherits that discipline rather than needing its own filtering logic.
No frontend code persists telemetry, credentials, or collector tokens beyond the documented,
already-reviewed in-memory lifetimes (Wave 30/32B).

## 17. Test Coverage

9 of 21 routes have a dedicated page-level render test (unchanged count from Wave 32A, plus the new
`developer-nav.test.tsx` now covering `/app/api` for the first time — effectively **10 of 21** as of
this wave, since Wave 32B's own test additions already closed one of Wave 32A's named gaps). Still
without a dedicated page-route test: Home, NotFound, Onboarding, Analytics, Transactions, Signals,
Rules, Cases, Policies, Decision Trace (component-level only). No E2E test exists for any `/app/*`
page's full user journey (only the sandbox collector page has real-browser E2E coverage, Wave 30/32B).
No security-boundary-specific frontend test exists beyond what `auth.test.tsx`/`credentials.test.tsx`
already cover (role-gated credential actions); this matches the small, fully-enumerated permission
surface in section 13 — there is no larger surface currently untested.

## 18. Frontend-Only vs Backend-First Dependency Classification

See `docs/tenant-capability-matrix-v1.json`'s `page_dependencies` array for the complete,
per-page classification (A–E per this wave's own taxonomy). Summary counts in the final report
(section "Final Report" below); the two concrete **A (frontend-only)** candidates found are the
Overview "derived-from-already-fetched-data" metric (section 7) and verifying/polishing the audit log
page's handling of long `after_json` blobs if any are found to render awkwardly (not confirmed as a
problem, only as unexamined — a verification task, not a known defect).

## 19. Wave 33B Proposed Scope

Proposed, not started:

1. **Overview: one real, derived (not fabricated) activity metric.** Current state: "Your workspace"
   already fetches up to 50 real audit rows via `useAuditLogs()` and shows only the 5 most recent.
   Why ready: zero new backend call, zero new permission, pure client-side aggregation of data already
   in memory. Existing contract: `GET /audit-logs` (unchanged). Frontend work: compute and display one
   additional real figure (e.g., a count of audit events within the visible window, or a small
   breakdown by action-type prefix) alongside the existing "Recent activity" card. Tests required: a
   render test asserting the derived figure matches a known fixture's real data, and that it never
   appears when the audit query errors or returns zero rows (no fabricated "0" presented as a trend).
   Security considerations: none beyond what already applies to `useAuditLogs()`. Acceptance criteria:
   the new figure is demonstrably computed from the SAME data already fetched (no new network call),
   disappears/degrades honestly on error exactly like the rest of the card, and is covered by a new
   test.
2. **Audit Logs: verify long `after_json` rendering.** Current state: unexamined this wave beyond
   confirming the mechanism is generic and correct. Why ready: read-only verification, zero code risk.
   Frontend work: none anticipated unless a real overflow/formatting issue is found; if found, a
   small, scoped CSS/formatting fix only. Tests required: a render test with a deliberately large
   `after_json` fixture. Acceptance criteria: no horizontal page overflow, no truncated-without-
   indication content.

## "DO NOT IMPLEMENT IN WAVE 33B"

Assessment listing/detail UI (needs a new, carefully-scoped `GET /assessments` backend wave with its
own contract freeze, mirroring how the collector capability was frozen in Waves 28A–C, preserving every
withholding rule in section 8); Policies UI backed by real data (needs a policy-management HTTP API
and its own authorization decision — `policy_authorization.py` exists but has never been wired to a
route); Cases (needs an entire new entity/lifecycle); Transactions/Analytics (needs a read/list/
aggregate endpoint that does not exist); any Platform Admin surface (needs a role/permission system
that does not exist); any live-environment UI or selector (needs a live-issuance decision that is
explicitly an owner decision per every prior wave, not a frontend task); a nav-badge "soon" consistency
fix (cosmetic, non-blocking, not worth its own wave item but noted in section 15 for whenever an
adjacent page is next touched).

## 20. Risks/Open Questions

1. The "soon" badge inconsistency (section 15) could confuse a new tenant about which pages are truly
   unavailable vs. which are static reference material — low risk, not urgent, flagged for
   opportunistic fixing.
2. `AuditRepository.list_for_tenant`'s hardcoded `limit=50` (section 12) means a very active tenant
   (heavy collector/credential testing) could lose visibility into older events with no way to page
   further — an open backend question for a future wave, not resolved here.
3. The sandbox/collector-to-assessment relationship (workflow 3, section 6) is real and verified at
   the backend/test level (Wave 31) but has no tenant-visible confirmation in this product at all —
   open question for whether/how to surface this without inventing a new backend endpoint (e.g.,
   could the EXISTING Decision Trace page, when a pasted assessment response's `derived_context`
   happened to be echoed back — it currently is NOT, by design, section 8 — ever show "network
   intelligence was available for this assessment"? This would require the public response contract
   itself to change, an owner decision, not something to resolve here).

## Evidence References

Routes: `src/App.tsx`. Nav: `src/data/app-nav-links.ts`. Backend routes: `app/api/v1/{assessments,
audit,auth,collector,context_events,credentials,memberships,tenants}.py`, `app/collector_app.py`.
Schemas: `app/schemas/{assessment,audit,credential,...}.py`. Policy service (no route):
`app/services/policy_service.py`, `app/services/policy_authorization.py`, `tests/policy_support.py`.
Audit: `app/schemas/audit.py`, `app/repositories/audit_repository.py`, `app/api/v1/audit.py`,
`src/pages/app/audit-logs.tsx`. Overview: `src/pages/app/overview.tsx`. Prior waves:
`fraud-platform-api/docs/architecture-decisions/{assessment-api-v1,wave28a..wave31-*}.md`,
`fraud-web-app/docs/architecture-decisions/{wave32a-*,wave32b-*}.md`,
`fraud-web-app/docs/ui-inventory-v1.json`.
