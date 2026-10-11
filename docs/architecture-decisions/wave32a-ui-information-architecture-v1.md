# Wave 32A — Complete Clarion Web-App UI Inventory + Information Architecture Audit

Read-only reconciliation. No pages were built, no routes were added, no backend contract was changed.
The only artifacts produced are this document and `docs/ui-inventory-v1.json`.

## 1. Executive Summary

fraud-web-app has **21 routes**, all accounted for. The dashboard's own `app-nav-links.ts` already
self-documents three pages as `soon: true` (no live backend) — this audit confirms that signal is
**correct but incomplete**: four MORE pages (Assessments, Signals, Rules, Policies) are equally
backend-less but untagged, for defensible reasons in three cases (Signals/Rules are honest static
product documentation, not tenant data) and one genuine finding in the fourth (**Policies has no
backend API at all** — not "partial," not "needs more wiring," there is no HTTP route anywhere in
fraud-platform-api for policy management; it exists only as internal service-layer code exercised by
tests). The single most significant finding: **the collector capability — fully built and
PostgreSQL-verified across Waves 28–31 — has zero representation inside the authenticated tenant
dashboard.** Its only UI surface is the unauthenticated, nav-external `/sandbox/collector` demo page
from Wave 30. A real tenant using this product today cannot discover the collector exists.

No Platform Admin surface exists, and none should be built yet — no platform-admin role, permission,
or cross-tenant API exists anywhere in fraud-platform-api.

## 2. Repository Scope

`fraud-web-app` (the entire frontend inventory), `fraud-platform-api` (`app/api/v1/*` — the complete,
exhaustive list of every HTTP route that exists, enumerated directly from source, not inferred),
`fraud-engine` (consulted only to confirm no tenant-facing policy/rule-configuration API exists there
either — fraud-engine has no HTTP surface a tenant or this dashboard ever reaches directly).

## 3. Current Route Inventory

21 routes, read directly from `src/App.tsx`:

| Route | Component | Auth | Status |
|---|---|---|---|
| `/` | Home | public | FUNCTIONAL |
| `/signin` | SignIn | guest-only | FUNCTIONAL |
| `/signup` | SignUp | guest-only | FUNCTIONAL |
| `/sandbox/collector` | CollectorSandboxDemo | public (unauth.) | FUNCTIONAL |
| `/app/onboarding` | Onboarding | auth, no tenant | FUNCTIONAL |
| `/app` | → redirect to overview | auth+tenant | FUNCTIONAL |
| `/app/overview` | Overview | auth+tenant | PARTIAL |
| `/app/assessments` | Assessments | auth+tenant | PLACEHOLDER/SAMPLE |
| `/app/assessments/sample/:sampleId` | SampleAssessmentDetail | auth+tenant | STATIC/DEMO |
| `/app/transactions` | Transactions | auth+tenant | PLACEHOLDER |
| `/app/signals` | Signals | auth+tenant | STATIC/DEMO |
| `/app/rules` | Rules | auth+tenant | STATIC/DEMO |
| `/app/cases` | Cases | auth+tenant | PLACEHOLDER |
| `/app/decision-trace` | DecisionTracePage | auth+tenant | FUNCTIONAL |
| `/app/policies` | Policies | auth+tenant | STATIC/DEMO (no API exists) |
| `/app/analytics` | Analytics | auth+tenant | PLACEHOLDER/SAMPLE |
| `/app/api` | ApiPage | auth+tenant | FUNCTIONAL |
| `/app/credentials` | Credentials | auth+tenant | FUNCTIONAL |
| `/app/audit-logs` | AuditLogs | auth+tenant | FUNCTIONAL |
| `/app/settings` | Settings | auth+tenant | FUNCTIONAL |
| `*` | NotFound | public | FUNCTIONAL |

Full per-route detail (backend dependency, permissions, test coverage, notes) is in
`docs/ui-inventory-v1.json`, not duplicated here.

## 4. Public Website

**Existing**: Home (one single-scroll marketing page: Hero → Problem → HowItWorks → Features →
ProductSection → Trust → FinalCta), SignIn, SignUp, NotFound.

**Recommended missing** (none built this wave): Pricing (P3 — no backend dependency, pure business
decision), Docs (P1 — would document the real, already-existing API contract; the collector API has
no documentation anywhere today), Legal/Privacy/Terms (P2 — no backend dependency), Contact (P3),
Password recovery (P1 — **and no backend support exists for it either**: no password-reset endpoint
exists in fraud-platform-api at all, so this is a real product gap, not merely a missing page).

## 5. Tenant Application

Covered exhaustively in section 3 / the JSON inventory. Summary by status:

- **FUNCTIONAL** (7): Overview (partial, see below), Decision Trace, API, Credentials, Audit Log,
  Settings, Onboarding.
- **PARTIAL** (1): Overview — the audit-log widget is real; risk/assessment metrics are sample-only.
- **STATIC/DEMO** (4): Assessment sample detail, Signals, Rules, Policies.
- **PLACEHOLDER** (3): Transactions, Cases, (Assessments and Analytics are placeholder-with-sample,
  a distinct fourth shade — see section 20's own category list).

No Rules/Policies CRUD exists. No Monitoring page, no Integrations page, no Developer-tools page
distinct from the single `/app/api` page, no notifications, no usage/billing page — none of these
were found anywhere in the route tree or component tree.

## 6. Platform Admin

**Does not exist.** Grepped across both backend repositories: no `platform-admin`, no platform-level
role beyond the per-tenant `OWNER`/`ADMIN`/`MEMBER` (`app/models/membership.py::MembershipRole`), no
tenant-management-across-tenants endpoint, no platform-audit endpoint distinct from the per-tenant
`GET /api/v1/audit-logs`, no system-configuration or operational-view API. **No Platform Admin UI
should be built** until this backend capability exists — building one now would mean inventing the
very backend contract this wave is forbidden from inventing.

## 7. Developer / Integration Surface

Two pages, not a dedicated nav section: `/app/api` (real credential table + static request/response
documentation) and `/sandbox/collector` (Wave 30's demo, reachable only by direct URL, outside the
nav entirely). **Gap**: `/app/api` documents only `POST /assessments` and `POST /context-events` — the
collector API (`POST /api/v1/collector/tokens`, `POST /collector/v1/collect`) is entirely
undocumented here despite being fully built and PostgreSQL-verified.

## 8. Sandbox Surface

Exactly one page: `/sandbox/collector`. It sits OUTSIDE the `/app` shell and outside
`APP_NAV_GROUPS` entirely — there is no link to it from anywhere in the authenticated dashboard. Per
Phase 13's own question ("determine the best existing route based on current application structure"):
the current IA has no `Developer`/`Integrations` nav group to place it under — "Configuration" is the
closest existing group, but conceptually mismatched (it holds Policies/API/Credentials/Audit/Settings,
all tenant-facing configuration, not a sandbox playground). This is a genuine navigation gap, not
merely a missing page (section 28/29).

## 9. Backend Capability Inventory

The **complete, exhaustive** list of every HTTP route in fraud-platform-api (enumerated directly from
`app/api/v1/router.py` and each router module, not inferred from naming):

| Capability | Route | UI? | Notes |
|---|---|---|---|
| Register | `POST /auth/register` | yes | SignUp |
| Login | `POST /auth/login` | yes | SignIn |
| Logout | `POST /auth/logout` | yes | (session.ts/AuthContext) |
| Current user | `GET /auth/me` | yes | AuthContext bootstrap |
| Create tenant | `POST /tenants` | yes | Onboarding |
| Current tenant | `GET /tenants/current` | yes | Settings |
| Members | `GET /tenants/current/members` | yes | Settings, Credentials (role check) |
| List credentials | `GET /credentials` | yes | Credentials, API page |
| Create credential | `POST /credentials` | yes | Credentials |
| Rotate credential | `POST /credentials/{id}/rotate` | yes | Credentials |
| Revoke credential | `POST /credentials/{id}/revoke` | yes | Credentials |
| Audit logs | `GET /audit-logs` | yes | Audit Logs, Overview |
| Context events | `POST /context-events` | **no** | Documented on /app/api but no dashboard UI consumes it (write-only, server-to-server by design) |
| Assessments | `POST /assessments` | **no live fetch** | Documented on /app/api; consumed indirectly via Decision Trace's paste workflow only |
| Collector tokens | `POST /collector/tokens` | **no** | Zero UI anywhere in /app (section 7/8) |
| Collector ingestion | `POST /collector/v1/collect` (separate mount) | partial | Only via the external, nav-disconnected sandbox demo |
| Policy management | **no route exists** | n/a | Section 15 |
| Rule configuration | **no route exists** | n/a | Static catalogue only |
| Platform admin (any) | **no route exists** | n/a | Section 6 |
| Cases | **no route exists** | n/a | Placeholder page only |
| Webhooks | **no route exists** | n/a | Confirmed absent in Wave 31 too |

## 10. Page → API Matrix

See `docs/ui-inventory-v1.json`'s `api_dependencies` field per page — not duplicated in prose here, to
keep this document and the machine-readable file from drifting apart.

## 11. API → Page Matrix

The inverse view of section 9's table — every route's UI column, in one place, is section 9 itself.

## 12. Permission Matrix

The **entire** RBAC surface in fraud-platform-api, read directly from source:

| UI Page | Action | Backend enforcement | Role(s) | UI enforcement |
|---|---|---|---|---|
| Credentials | List | none (any member) | owner/admin/member | n/a |
| Credentials | Create/Rotate/Revoke | `require_role(OWNER, ADMIN)` | owner, admin | `canManage` client-side gate mirrors it (defense-in-depth, not the sole boundary — backend enforces independently) |
| Settings (members) | List | none (any member) | owner/admin/member | n/a |
| Audit Logs | List | none (any member) | owner/admin/member | n/a |
| Tenants | Create | authenticated user only (no tenant yet) | n/a | n/a |
| Tenants | Read current | none (any member) | owner/admin/member | n/a |

**No other permission exists anywhere in the codebase.** There is no granular permission-string system
(no `"policy:read"`, no `"tenant:update"`, etc., despite assessment-api-v1.md's own prose once
mentioning "Human policy:read" conceptually — grepped: no such string exists in code; it was
describing a hypothetical, not an implemented check). `require_role()` is the only authorization
primitive, used in exactly one place. No UI action anywhere lacks backend authorization — the surface
is simply much smaller than the prompt's example list implied, and nothing was invented to fill it out.

## 13. Environment Matrix

| Page | Sandbox | Live | Selector? | Source of truth |
|---|---|---|---|---|
| Credentials | yes | **no** (`create_sandbox_credential` is the only issuance path, no UI or public API issues live) | n/a | environment column is always "sandbox" in practice |
| Collector sandbox demo | yes | no | n/a | the token's own environment claim |
| Overview/Audit/Settings | n/a (not environment-scoped data) | n/a | n/a | n/a |
| Assessments/Analytics/Transactions | n/a (sample data only) | n/a | n/a | n/a |

**No page has an environment selector, and none should** — environment is correctly, exclusively
derived from the authenticated credential/session server-side (Wave 31's own finding, re-confirmed
here for the UI layer: the dashboard has no code path that could request "live" data even if a
malicious user tried, since no live-scoped endpoint is reachable from session auth at all). No risk of
accidental cross-environment display was found.

## 14. Decision Trace

`src/components/fd/decision-trace.tsx` + `src/components/fd/assessment-detail.tsx`, driving
`/app/decision-trace`'s paste-based tool. Compared field-by-field against the actual public response
contract (`assessment-api-v1.md` section 9, re-confirmed against `AssessmentOut` in
Wave 31): the page's own `_PUBLIC_KEYS`-shaped rendering already matches the real contract exactly —
it shows `assessment_id`, `risk_score`, `risk_band`, `policy.{status,recommendation,policy_id,
policy_version}`, `reasons[].reason_code`, `engine.*`, `evaluation_state`, `idempotent_replay`, and
correctly marks evidence/telemetry/confidence as "isn't returned by the API in this release" rather
than fabricating them. **No change is needed.** The existing tenant-facing hierarchy is already
correct: recommendation and reason codes first, raw score/band next, engine identity last — and
nothing beyond the public contract is shown. There is no "platform operator" view distinct from this
in the frontend at all (no Platform Admin, section 6) — the question of a richer internal view is
moot until one exists.

## 15. Credentials

Fully inspected (`app/models/credential.py`, `app/api/v1/credentials.py`,
`app/services/credential_service.py`, `src/pages/app/credentials.tsx`,
`src/components/app/{create-credential-dialog,secret-reveal-dialog}.tsx`). The existing UI already
implements exactly what the backend safely permits: list, create (secret shown once, matching
`CredentialCreatedOut`'s own one-time-secret design), rotate (old secret invalidated, new one
revealed once), revoke (permanent, no secret return), environment (display-only, always sandbox),
status (active/revoked), created/last-used timestamps. **No gap found.** Nothing was invented; nothing
needs to be added without new backend fields first (e.g. there is no `expires_at`-driven UI warning,
but the field exists on the model and in `CredentialOut` — a legitimate, low-effort future UI
addition, not a backend gap).

## 16. Collector

The single largest gap this audit found (sections 1, 7, 8, 9). Classification per Phase 12's own
framework:

| Desired UI | Backend support |
|---|---|
| Collector status / activation state visibility | **SUPPORTED** — `collector_sandbox_enabled`/`collector_live_enabled` exist server-side, but there is no API exposing their current value to a tenant or dashboard; would need a small new read endpoint |
| Token management (view issuance history) | **REQUIRES BACKEND WORK** — token issuance writes an audit row (`collector_token.issued`) but there is no dedicated listing; the generic Audit Logs page could show these today with zero backend change (untested whether it already renders them legibly) |
| Origin configuration (CORS) | **REQUIRES BACKEND WORK** — `COLLECTOR_CORS_ALLOWED_ORIGINS_SANDBOX/_LIVE` are process-level env vars, not per-tenant, not exposed via any API |
| Rate-limit visibility | **REQUIRES BACKEND WORK** — limits are global process config, not per-tenant, not exposed |
| Client installation instructions | **SUPPORTED TODAY WITH ZERO BACKEND CHANGE** — `fraud-platform-api/docs/collector_client_contract.md` already exists; it could be rendered/linked from `/app/api` immediately |
| Integration diagnostics (did my last token get consumed?) | **REQUIRES BACKEND WORK** — no per-flow_id status-lookup endpoint exists |

No UI toggle should be built that pretends to flip `collector_sandbox_enabled` from the dashboard —
that setting is process-level configuration today, not tenant-level, and no API exists to change it
per-tenant.

## 17. Navigation Audit

Current (`src/data/app-nav-links.ts`): Overview (Dashboard, Analytics*), Detection (Assessments,
Transactions*, Signals, Rules), Investigation (Cases*, Decision Trace), Configuration (Policies, API,
Credentials, Audit log, Settings). (*marked `soon: true`.)

Recommended canonical hierarchy, changing nothing that already works correctly, based ONLY on
verified capability (not aspirational):

```
PUBLIC            Home · Sign in · Sign up                               [existing]
TENANT            Overview · Credentials · Audit Log · Settings          [existing, functional]
                   Decision Trace                                        [existing, functional]
                   Assessments · Signals · Rules · Policies · Analytics · Transactions · Cases
                                                                          [existing, honestly-gated reference/sample pages]
DEVELOPER          API (docs) · Sandbox (collector demo)                 [exists but NOT grouped/linked together today —
                                                                           recommend a "Developer" nav group containing both]
PLATFORM ADMIN     [does not exist; do not build]
```

The ONE concrete navigation change this audit recommends (not implemented this wave, since Phase 24
forbids it): add a "Developer" nav group containing API + a link to the sandbox collector demo, so
the one genuinely functional cross-cutting integration surface is discoverable from inside the
product at all.

## 18. Component Inventory

`src/components/ui/`: alert, badge, button, card, confirm-dialog, data-table, dialog, empty-state,
input, pagination, select, spinner, states — a complete, non-duplicated primitive set; every page
audited reuses these consistently, no ad hoc one-off styling found. `src/components/app/`: app-shell,
chart-card, charts, create-credential-dialog, metric-card, mobile-nav-drawer, page-header,
secret-reveal-dialog, sidebar-nav, tenant-badge, topbar, user-menu. `src/components/fd/`:
assessment-card, assessment-detail, code-block, decision-trace, risk-badge, rule-card, sample-data,
signal-card. No duplication found; nothing needs rewriting.

## 19. Existing Functional Pages

Home, SignIn, SignUp, NotFound, Onboarding, Overview (partial), Decision Trace, API, Credentials,
Audit Logs, Settings, CollectorSandboxDemo. **12 of 21 routes.**

## 20. Partial Pages

Overview only (real audit-log widget; sample-only risk metrics/charts). **1 of 21.**

## 21. Placeholder Pages

Transactions, Cases (both explicit "not built yet," no sample mode). **2 of 21.**

(Assessments and Analytics are a distinct, fourth shade — placeholder-with-opt-in-sample-data, more
honest than a bare placeholder since the tenant can affirmatively choose to see illustrative data —
tracked separately in the JSON as `EXISTS_PLACEHOLDER_SAMPLE`.)

## 22. Missing Pages

See `missing_pages` in the JSON inventory: Pricing, Docs, Legal/Privacy/Terms, Password recovery
(public); a collector/developer-integration surface inside `/app` (P0); any Platform Admin page (P3,
explicitly not recommended yet).

## 23. Orphaned UI

**None found.** Every page was checked for: calling an obsolete endpoint (none do — all
`api_dependencies` resolve to routes confirmed to exist in section 9), stale schema assumptions (the
Decision Trace / API page's shown contract matches the real, current `AssessmentOut` exactly),
outdated policy vocabulary (Policies page shows conceptual Risk/Confidence/Telemetry/Policy framing,
which still matches current reality — Confidence and Telemetry are STILL not exposed, exactly as the
page says), internal-field exposure (none found anywhere — re-verified against section 9's capability
list), or mock data presented as real (every sample-mode page is explicitly, visibly labeled).

## 24. Orphaned Backend Capabilities

See `orphaned_backend_capabilities` in the JSON inventory: policy versioning (no API at all, not
appropriate for UI yet), collector (real API, no UI — the headline finding), configuration
snapshots/reproducibility identity (intentionally not public, correctly never surfaced), credential
rotation audit detail (partially surfaced — visible generically via Audit Logs, not cross-referenced
from Credentials itself).

## 25. Security Review

- **Secret exposure**: Credentials' reveal-once dialog never re-displays a secret after dismissal
  (matches backend: secrets are never retrievable after creation). No secret appears in any other
  page, log, or URL (re-confirmed; same discipline as Wave 30's own collector-token review).
- **Tenant/environment leakage**: no page issues a request containing a tenant or environment field at
  all — every call relies on the session/credential alone, matching the backend's own "credential is
  the sole authority" design (Wave 31).
- **Unauthorized actions**: the only mutating, role-gated actions (credential create/rotate/revoke)
  are correctly hidden behind `canManage` AND independently enforced server-side.
- **Excessive information**: Decision Trace/API page expose nothing beyond the public contract
  (section 14).
- **Raw IP / raw provider data**: never rendered anywhere in the frontend — grepped, no match.
- **Unsafe browser storage**: session token/tenant id use `localStorage` (a known, documented
  trade-off, `src/lib/auth/session.ts`'s own docstring) — unrelated to this wave's scope, not a new
  finding. The collector token (Wave 30) correctly never touches storage at all.
- **URL leakage**: no secret or credential ever appears in a URL anywhere in the app (the collector
  sandbox demo's own `?token=` param is explicitly test/demo-only and documented as such in its own
  file, Wave 30).
- **Audit information exposure**: Audit Logs page renders exactly what `AuditLogOut` returns — no
  payload/secret fields exist on that model to leak in the first place.

No new finding; no change made.

## 26. Privacy Review

No page collects or transmits personal data beyond what authentication itself requires (email,
password at signup). No analytics/tracking library exists in `package.json` (checked: no
Segment/Mixpanel/GA/etc. dependency). No behavioral tracking beyond what React Query's own
devtools-free production build does internally. Nothing was added this wave.

## 27. Test Coverage

| Route | Component test | Route-level render test |
|---|---|---|
| Overview | — | yes (`auth.test.tsx`, `fraud-ui.test.tsx`) |
| Assessments / sample detail | — | yes (`fraud-ui.test.tsx`) |
| Credentials | — | yes (`auth.test.tsx`, `credentials.test.tsx`) |
| Audit Logs | — | yes (`credentials.test.tsx`) |
| Settings | — | yes (`credentials.test.tsx`) |
| SignIn / SignUp | — | yes (`auth.test.tsx`) |
| Sandbox collector demo | — | yes (`collector-sandbox-page.test.tsx` + real-browser + real-backend E2E) |
| Decision Trace | yes (`DecisionTrace`/`AssessmentDetail` components, `fraud-ui.test.tsx`) | **no** (the page route itself is never rendered in a test) |
| API page | — | **no** |
| Onboarding | — | **no** |
| Home, NotFound | — | **no** |
| Analytics, Transactions, Signals, Rules, Cases, Policies | — | **no** |

**9 of 21 routes have a dedicated route-level render test.** No empty-state or error-state test exists
specifically for `/app/api` or `/app/decision-trace` as pages (their underlying data hooks/components
are tested in isolation instead). No E2E test exists for any `/app/*` page — only the Wave 30
collector sandbox page has real-browser E2E coverage.

## 28. Canonical Information Architecture

| Route | Purpose | Audience | Parent nav | Permission | Environment | Backend API | Status |
|---|---|---|---|---|---|---|---|
| (see `docs/ui-inventory-v1.json` for the complete, per-field table — not duplicated here to avoid the two documents drifting apart) | | | | | | | |

## 29. Dependency Classification

**P0** (required to operate an existing backend capability safely): a collector/developer-integration
surface inside `/app` — the ONLY P0 item found; the capability is fully built and verified, and its
total absence from the product is the single highest-priority gap.

**P1** (required for a coherent sandbox integration): Docs page documenting the real API contract
(including the collector, currently undocumented); password recovery (also blocked on a backend gap).

**P2** (useful operational/product surface): Legal/Privacy/Terms; cross-referencing credential
rotation events from the Credentials page itself.

**P3** (future capability with backend dependency): Pricing, Contact; any Platform Admin page (blocked
entirely on backend work that does not exist); real Assessments/Transactions/Cases/Analytics listing
(blocked on backend list/search endpoints that do not exist); Rules/Policies live configuration
(blocked on backend endpoints that do not exist, Policies additionally blocked on the service having
no HTTP surface at all today).

## 30. Recommended Build Sequence

Not implemented this wave (Phase 24). In dependency order only, not subjective preference: (1) add a
"Developer" nav group linking API + the sandbox collector demo, and document the collector contract on
the API page — zero backend change required; (2) a minimal collector-status read endpoint + dashboard
widget (small, well-scoped backend addition); (3) a documentation/Docs public page; (4) password-reset
backend + page; (5) everything else is gated on backend work substantially larger than a single wave
(assessment listing, policy management API, platform admin).

## 31. Explicit Non-Goals

No page was built or changed. No route was added or removed. No backend contract was changed. No
authentication, RBAC, fraud-engine, scoring, policy, or collector behavior was modified. The two files
this wave produced (this document and `docs/ui-inventory-v1.json`) are the entire deliverable.

## 32. Wave 33 Preconditions

If Wave 33 implements UI, it should do so one coherent section at a time, starting from the P0/P1
items in section 29/30 — not all missing pages at once, and never ahead of the backend capability
each depends on. Before building the collector/developer surface specifically, confirm with an owner
whether a collector-status read endpoint is in scope for that wave or whether the UI should ship
first as pure documentation (zero backend change, immediately buildable).
