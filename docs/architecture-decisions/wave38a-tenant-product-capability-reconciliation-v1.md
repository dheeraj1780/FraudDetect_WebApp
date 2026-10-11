# Wave 38A — Clarion Tenant Product Capability Reconciliation

Read-only audit/reconciliation wave. No product code was implemented. This document and
`docs/tenant-product-capability-matrix-v1.json` are the only artifacts this wave produced.

## 1. Executive Summary

Clarion's tenant product today has four genuinely functional surfaces — Assessments, Policies,
Credentials/API, and Audit Logs — all backed by real, tested, PostgreSQL-verified HTTP APIs and
real frontend integrations. Five surfaces are honest placeholders or static pages that correctly
describe their own unavailability (Transactions, Cases, Rules, Signals) or are stale in their
unavailability claim (Analytics). One capability (LIVE environment) is fully blocked behind a
single root cause in `fraud-platform-api`. Platform Admin has zero foundation anywhere and should
remain deferred. No sensitive/internal field (rule internals, raw PII, hashes, secrets, decision
trace internals) is exposed to any tenant-facing surface — this invariant, established since Wave
34B, holds across every router and every frontend page re-audited this wave.

## 2. Repositories Inspected

| Repository | Role | Touched this wave |
|---|---|---|
| `fraud-platform-api` | Tenant platform API | No (read-only) |
| `fraud-engine` | Stateless scoring engine | No (read-only) |
| `fraud-web-app` | Tenant dashboard SPA | Docs only (this file + JSON matrix) |

## 3. Backend Capability Matrix

See `backend_capabilities` in the JSON matrix (28 entries). Summary by router:

- `auth`, `tenants`, `memberships` (read only), `credentials`, `audit`, `context_events` (write
  only), `assessments`, `collector`, `policies` — 9 routers, confirmed directly against
  `app/api/v1/router.py`:
  ```
  from app.api.v1 import (
      assessments, audit, auth, collector, context_events,
      credentials, memberships, policies, tenants,
  )
  ```
- Every read route uses `get_current_tenant_context` (session, human, multi-environment); every
  submission/token-issuance route uses `get_tenant_from_api_credential` (server-to-server, single
  fixed environment). No route mixes the two.
- Two gaps at the capability level: no membership-mutation endpoint (`memberships` router is read
  only, 25 lines, one route), and no read endpoint for `context_events` (write only).

## 4. Frontend Capability Matrix

See `frontend_routes` in the JSON matrix (20 routes). Of these: 11 are FUNCTIONAL against a real
backend, 2 are SAMPLE/opt-in demo data clearly labelled as such, 3 are honest UNAVAILABLE/STATIC
pages whose copy is accurate, 1 (Analytics) is UNAVAILABLE with **stale** copy (see §8), 1
(Cases) is an explicit PLACEHOLDER, and the rest are auth/marketing/ops routes not applicable to
this capability audit.

## 5. Rules Audit — Engine Capability vs. Tenant Product Capability

**Finding (reconfirmed, unchanged from Wave 35A): these are two entirely separate things and must
not be conflated.**

- **Engine capability (real, sophisticated, exists today):** `fraud-engine/app/rules/registry.py`
  implements `RuleRegistry.register()` (lines 58-102) with mandatory approval-metadata enforcement
  for PRODUCTION/CALIBRATING rules (`approved_by`, `approved_at`, `release_checklist_reference` —
  lines 72-80, raising `InvalidRuleRegistrationError` if missing), plus a `RuleEvaluationMode`
  concept (ACTIVE/SHADOW/etc.). `docs/rule-catalogue-v1.md` documents ~91 rule-table rows across
  families F1-F9.
- **How it's built (the reason it is not a tenant product capability):** the registry is built
  exactly once at process startup, from environment variables, via
  `build_rule_registry(cfg: Settings = settings)` (`app/main.py:163`), called from
  `build_pipeline_dependencies` (lines 438-442). It is **one global registry shared by every
  tenant** — there is no per-tenant or per-environment rule configuration concept anywhere in
  either repository, and changing it requires an environment-variable change plus a process
  restart.
- **Tenant/platform-operator reachability: zero.** No router, no schema, no service method in
  `fraud-platform-api` ever reads or writes rule configuration. `src/pages/app/rules.tsx` is a
  fully static page (`CATALOGUE_FAMILIES` local array, zero network calls) that itself displays
  "Catalogue frozen · read-only" with a lock icon — the frontend already correctly represents this
  as non-interactive.
- **Conclusion:** Rules is real and governed at the *engine* layer, but does not exist as a
  *tenant product* capability. Building a tenant-facing Rules product would require a new
  governance decision (tenant-configurable vs. platform-operator-governed vs. engine-registry-
  driven) before any API or UI work — classified P3, no dependency currently blocking a decision,
  but the decision itself is the blocker.

## 6. Signals Audit

**Privacy-sensitive — this audit does not recommend exposing raw signals, and none are exposed
today.** `src/pages/app/signals.tsx` is a static catalogue of SUPPLIED/DERIVED signal categories;
its own "observed on your traffic" section is an `UnavailableState`, and this is accurate: no
tenant-readable API exists for `context_events` (write-only), `network_intelligence_observations`
(not even tenant-scoped), or `collector_acquisition_observations` (no GET route). The only signal
information a tenant ever receives is the `reason_code` string already present in assessment
responses — a deliberately coarse, already-reviewed, tenant-safe derivative, not a raw signal feed.
Classified STATIC/accurate; no gap requiring urgent closure, no premature exposure recommended.

## 7. Cases Audit

Classification: **PLACEHOLDER (category D — no backend model exists, frontend describes a planned
layout honestly).** No `Case` model, schema, or migration exists in any repository. The frontend's
own copy ("The platform API has no case endpoints... Below is the planned layout only — no cases
exist and none are stored") plus a "Not functional" badge is accurate and non-misleading. Building
real Cases requires a new domain model + migration + HTTP API + RBAC — a P2 gap, with a natural
dependency on `Assessment.id` as the safe linking key (already a stable, tenant-visible public id,
requiring no new exposure).

## 8. Transactions Audit

**Important distinction preserved:** `POST /api/v1/assessments` is a fraud-scoring submission, not
a transaction record — the two must not be confused. `app/models/assessment.py`'s own module
docstring documents a deliberate privacy-minimization decision: the `Assessment` model never
persists amount, currency, instrument, or destination — only an opaque reference and a one-way
fingerprint. `src/pages/app/transactions.tsx`'s copy ("doesn't provide a way to list or search
transactions... Nothing is being hidden — there is no transaction data to load") is **accurate**
and correctly reflects this design decision, not a bug. Building a transaction read model is
classified **N/A** — it would require reversing a deliberate privacy decision, not merely adding
an endpoint, and is explicitly not recommended without a new product/legal decision.

## 9. Analytics Audit — Stale Documentation/Copy Finding

**This is the most significant historical-vs-current-code discrepancy found this wave.**

`src/pages/app/analytics.tsx` (lines 100-106) renders:

```tsx
<UnavailableState title="Analytics aren't available yet">
  <p>Analytics data will appear here once assessments are available.</p>
  <p className="mt-2 text-fg-subtle">
    The platform API doesn&apos;t yet expose assessment history or aggregates, so no live analytics
    are shown — and none are fabricated. Use "Preview with sample data" to see the layout.
  </p>
</UnavailableState>
```

This claim — "doesn't yet expose assessment history" — **is false as of Wave 34B** (which shipped
`GET /api/v1/assessments`) and has been false since Wave 34C, when `/app/assessments` began
consuming that exact endpoint. The copy was never updated in Wave 34C, 36, or 37 despite each of
those waves touching adjacent assessment-related surfaces. This wave does **not** fix the copy
(Wave 38A is read-only), but records it as a confirmed discrepancy (see §15) and recommends fixing
it as the lowest-risk, zero-dependency item in the roadmap (§16).

Separately: assessment history **does** exist and is queryable row-by-row, but no **aggregation**
endpoint exists (volume, risk-band mix, recommendation mix, latency, failure rate, environment
split, policy-version correlation would all require either new backend aggregation queries or
unbounded client-side pagination over full history, which is not viable). So two distinct findings
coexist: (a) the copy is factually stale about row-level access, and (b) real aggregate analytics
still requires new backend work regardless.

## 10. LIVE Environment Audit — Precise Blocker Table

Re-confirmed, unchanged from Wave 37's own finding, now traced to its exact root cause:

| Step | Capability | Status | Blocking evidence |
|---|---|---|---|
| 1 | LIVE `TenantEnvironment` provisioning | **BLOCKED (root cause)** | `app/services/tenant_service.py:33` — the sole `.create()` call for any `TenantEnvironment` row, hardcoded to `SANDBOX`. `TenantEnvironment`'s own docstring (`app/models/credential.py:17-21`) states LIVE is modeled for future compatibility but "only 'sandbox' is actually issuable this milestone." |
| 2 | LIVE credential issuance | Blocked by step 1 | `app/api/v1/credentials.py:44-51` calls only `create_sandbox_credential`; no LIVE-equivalent exists. |
| 3 | LIVE collector token issuance | Blocked by step 1 | `collector_live_enabled` gate is code-complete but unreachable — no LIVE environment row can ever exist to satisfy it. |
| 4 | LIVE assessments API | **Not blocked** | Code is already environment-agnostic; would work unchanged the moment a LIVE environment + credential exist. |
| 5 | LIVE policies API | **Not blocked (backend)** | `_resolve_environment` resolves by name server-side; already generic. |
| 6 | LIVE frontend selector (Policies) | Blocked by steps 1-3 | Correctly not built (Wave 37 finding) — there is nothing real to select yet. |

**Dependency order: 1 → 2, 3 → 6; 4 and 5 require no further change.** This collapses the entire
LIVE gap to a single engineering decision/change at step 1 — not a sprawling multi-system effort.

## 11. Developer/Collector Reconciliation

Re-confirmed functional and correctly scoped: `/sandbox/collector` and `/app/api` are real,
working, sandbox-only by design (not an oversight — no evidence any collector/developer-tool
capability was ever intended to span LIVE). `POST /api/v1/collector/tokens` and the separately
mounted `POST /collector/v1/collect` ASGI app both require credential auth and are tenant/
environment-scoped correctly.

## 12. Platform Admin Reaudit

**PLATFORM ADMIN UI SHOULD REMAIN DEFERRED.** Re-confirmed via fork audit: zero hits for
`superuser`/`impersonat`/`platform-admin`/`is_staff` or any equivalent across all three
repositories. No role, identity, router, or cross-tenant query path exists anywhere.
`get_current_tenant_context` structurally requires a tenant membership, so it cannot be extended
into a platform-admin context without a new, separate identity/authorization foundation — this is
a prerequisite wave in its own right, not an incremental addition to any existing capability.

## 13. Security/Privacy Exposure Classification

See `security_exposure_matrix` in the JSON (23 entries, 6-category classification:
TENANT_SAFE / TENANT_SAFE_WITH_REDACTION / DEVELOPER_SAFE / PLATFORM_ADMIN_ONLY /
ENGINE_INTERNAL / SENSITIVE_DO_NOT_EXPOSE). Every field documented as withheld in prior waves
(`idempotency_key`, `request_fingerprint`, `execution_json` and its sub-fields, `failure_reason`,
`source_ip_hash`, all `*_ref_hash` columns, `credential_id`) was re-confirmed withheld this wave.
One minor consistency note (not a vulnerability): policy lifecycle audit events store
`environment_id` as a raw UUID inside `before_json`/`after_json` (`app/services/policy_service.py`
`_state()` helper, lines 73-78) — visible only within the owning tenant's own audit log, never
cross-tenant, never accepted back as input, but inconsistent with the "environment is always a
name, never a UUID" boundary established elsewhere since Wave 34B. Logged as a P3 gap (§15), not a
security finding requiring urgent remediation.

## 14. RBAC / Authorization Matrix

See `rbac_matrix` in the JSON (12 entries). Pattern confirmed consistent across every capability
with write operations: role checks happen inside the service layer (`policy_authorization.py`,
`require_role` calls in `credentials.py`), never duplicated or relied upon at the router layer
alone. `audit` and `memberships` (read) are intentionally not role-gated — any member of a tenant
may read them. API-credential auth contexts always carry `role=None`, which every permission-
mapping function maps to zero permissions.

## 15. Historical Documentation vs. Current Code — Contradiction Log

1. **Analytics page copy (confirmed, §9):** claims the platform API doesn't expose assessment
   history/aggregates. False since Wave 34B/34C. Current code is authoritative; the copy is
   stale. Not modified this wave (read-only); recommended as Wave 38B (§16).
2. **No other confirmed contradictions were found.** Wave 35A, 35B, 36, and 37's own architecture
   documents were each re-checked against current code during this wave's forks and spot-checks
   (router list, policy hardcoded-environment finding, offset-pagination contract, query-key
   environment discrimination) and all were found to still accurately describe the current code —
   i.e., those documents are not stale, only the Analytics page's *in-product user-facing copy*
   is. No historical document was modified, per this wave's explicit instruction.

## 16. Gap Classification and Recommended Wave Roadmap

See `gaps` (12 entries, P0-P3/N-A) and `recommended_waves` (7 entries) in the JSON matrix. Headline
roadmap, in dependency order:

1. **Wave 38B (P2, no dependency):** Fix the stale Analytics `UnavailableState` copy only.
2. **Wave 39 (P2):** Membership mutation API (invite/role-change/remove) + minimal frontend —
   mirrors the already-proven Policy HTTP API pattern; persistence already exists.
3. **Wave 40 (P1):** LIVE environment provisioning + LIVE credential issuance — the single root
   blocker identified in §10. Requires a prior product/security decision (self-service vs.
   operator-gated) before implementation; must not include a frontend selector until this exists.
4. **Wave 41 (P2):** Analytics aggregation backend layer + real frontend, once row-level access is
   no longer mischaracterized as unavailable.
5. **Deferred, no wave recommended:** Transactions (would reverse a deliberate privacy decision),
   Rules tenant configuration (governance decision prerequisite, P3), Platform Admin (no
   foundation exists, must remain deferred).

## 17. Validation

- `node -e "JSON.parse(...)"` on `docs/tenant-product-capability-matrix-v1.json`: **valid**, all
  11 required top-level keys present (`generated_at, repositories, frontend_routes,
  backend_capabilities, engine_capabilities, environment_matrix, security_exposure_matrix,
  rbac_matrix, gaps, dependencies, recommended_waves`).
- Array sizes: frontend_routes 20, backend_capabilities 28, engine_capabilities 3,
  environment_matrix 10, security_exposure_matrix 23, rbac_matrix 12, gaps 12, dependencies 5,
  recommended_waves 7.
- No fabricated routes, endpoints, permissions, or timestamps — every entry traces to a fork
  citation or a direct spot-check performed this wave (router import list, Analytics stale copy,
  `tenant_service.py` LIVE-provisioning root cause).

## 18. File/Code Change Audit

Zero production code, migration, or test files were changed in any of the three repositories this
wave. The only files created are this document and `docs/tenant-product-capability-matrix-v1.json`,
both under `fraud-web-app/docs/`. `fraud-platform-api` and `fraud-engine` were read-only for the
entire wave (no Edit/Write calls against either repository).
