# Wave 36 — Complete Real Tenant Assessment Experience

## 1. Objective

Per the wave's own instructions, make the Assessments experience a real, production-grade tenant
product surface using only the already-verified Wave 34B contract. Phase 0 required reconciling the
wave's own assumptions against actual repository state before writing any code — that reconciliation
(§2 below) found most of the objective was already met by Wave 34C, which this wave builds on rather
than redoing.

## 2. Phase 0 Reconciliation — Critical Finding

**The wave's instructions assume cursor-based pagination throughout (Phases 7, 8, 18).** Direct
inspection of the actual, current backend contract —
`fraud-platform-api/docs/architecture-decisions/wave34b-assessment-read-api-v1.md` §3 and §8, and a
fresh run of `tests/integration/test_assessment_read_api.py` (30/30 passing, both SQLite and real
PostgreSQL, this wave) — confirms the real `GET /api/v1/assessments` contract is **offset-based**
(`limit`/`offset` query params, `AssessmentListOut{items, has_more}` response), not cursor-based.
Wave 34B's own document lists this explicitly under "Known Limitations": *"Offset pagination, not
cursor — accepted tradeoff."* There is no cursor concept anywhere in this codebase's API surface.

Per this wave's own Phase 19 ("if a frontend requirement cannot be satisfied by the current API,
determine whether it is (A) already supported but misunderstood"): this is case A. Every instruction
below referring to "cursor" is implemented against the **real, verified offset/limit/has_more
contract** instead — `has_more` drives Previous/Next exactly as the wave's Phase 8 requires ("Use
backend-provided pagination state... do not calculate pagination from array length... do not invent
total pages/count"), just without a literal cursor token. No cursor abstraction was invented on top
of the real contract, and the backend was not modified to introduce one.

**Second finding**: the assessment list and detail pages were **already real**, not sample/placeholder
— built in Wave 34C (`fraud-web-app/docs/architecture-decisions/wave34c-assessment-ui-integration-v1.md`),
manually verified end-to-end against a real backend+engine in a follow-up verification pass. Filters
(`environment`, `risk_band`, `recommendation`, date range), the offset/`has_more` pagination UI,
PROCESSING/COMPLETED/FAILED detail rendering, the internal-field withholding boundary, and tenant/
environment isolation were all already implemented and tested. This wave's own real, net-new scope is
therefore narrower than its instructions assume: **URL-synchronized filter/pagination state** — the
one gap Wave 34C's own documentation explicitly disclosed as a known limitation, and which this
wave's own Phase 20 explicitly scopes in ("Implement URL state only for the Assessment experience").

## 3. Wave 34A Contract Used

The public/internal field boundary Wave 34A designed and Wave 34B implemented: `AssessmentListItemOut`
(`assessment_id`, `environment`, `status`, `submitted_at`, `completed_at`, `risk_score`, `risk_band`,
`policy`, `reason_count`, `evaluation_state`) and `AssessmentDetailOut` (the same, with `reasons[]` and
`engine` instead of a count). Re-verified field-for-field against the current
`fraud-platform-api/app/schemas/assessment.py` before any frontend change — unchanged since Wave 34B.

## 4. Wave 34B Backend Capabilities Consumed

`GET /api/v1/assessments` (session-authenticated, tenant-scoped, filters: `environment`, `risk_band`,
`recommendation`, `created_after`, `created_before`, `limit`, `offset`) and
`GET /api/v1/assessments/{assessment_id}` (generic 404 for any inaccessible id). Both re-verified this
wave: 30/30 tests passing against SQLite and real PostgreSQL; zero backend files modified (confirmed
by `git status`/mtime check, §21).

## 5. Existing Frontend State Before This Wave

`src/pages/app/assessments.tsx` already had a complete `RealAssessmentList` (real `useAssessments`
hook, real filters, real `OffsetPagination`) gated behind the pre-existing, separate, explicitly
opt-in `?sample=1` preview mode (unchanged, untouched — see §14). `src/pages/app/assessment-detail.tsx`
already had a complete `RealAssessmentDetail` handling all three lifecycle states and the generic
404. Both were built in Wave 34C and are preserved, not rewritten, by this wave.

## 6. Routes Used

`/app/assessments`, `/app/assessments/:assessmentId`, `/app/assessments/sample/:sampleId` — all three
unchanged, confirmed via `grep` against `src/App.tsx` before and after this wave's changes. No route
was added, removed, or duplicated (Phase 11/22).

## 7. API Client Changes

None. `src/lib/api/endpoints/assessments.ts` and `src/lib/api/types.ts`'s assessment types were
already complete and correct (Wave 34C) and needed no change for URL synchronization, which operates
entirely on top of the existing `AssessmentListParams` shape.

## 8. Query/Hook Changes

`src/hooks/use-assessments.ts` unchanged. New: `src/hooks/use-assessment-list-filters.ts` — reads/
writes the five filter keys plus `offset` into the URL query string via `useSearchParams`, the same
mechanism `useSampleMode` already established for `?sample=1`. This hook owns no fetching logic itself
(Phase 3: "do not create duplicated fetching logic inside page components" — satisfied by keeping
`useAssessments` as the single fetching hook; the new hook only manages URL-backed UI state that feeds
its `params` argument).

## 9. Filters

Exactly the four the real backend supports — `environment`, `risk_band`, `recommendation`,
`created_after`/`created_before` — unchanged from Wave 34C. No new filter was added or invented.

## 10. URL Synchronization (This Wave's Net-New Work)

`useAssessmentListFilters` (`src/hooks/use-assessment-list-filters.ts`):

- Reads `environment`, `risk_band`, `recommendation`, `created_after`, `created_before`, `offset` from
  the URL query string on every render — the single source of truth, replacing the local `useState`
  calls `RealAssessmentList` used before this wave.
- **Validates every value read back against the exact enums the real API accepts.** An edited-by-hand
  or stale URL with an unrecognised `risk_band`/`environment`/`recommendation` is treated as unset
  (never forwarded to the API, never crashes) — verified by
  `test_an_invalid_filter_value_in_the_url_is_treated_as_unset`. `offset` is parsed and clamped to a
  non-negative integer — verified by `test_a_negative_or_non-numeric_offset_in_the_url_is_clamped_to_zero`.
- `setFilter(key, value)` always clears `offset` from the URL in the same update (Phase 7/8: a filter
  change starts over, never keeps a page position computed against a different result set) — verified
  by `test_changing_a_filter_resets_the_offset_out_of_the_url`.
- `clearFilters()` removes all six keys at once — verified by
  `test_clearing_filters_removes_every_filter_param_from_the_url`.
- Every update uses `{ replace: true }` (matching `useSampleMode`'s own convention) so filter changes
  don't spam the browser history stack with one entry per keystroke/selection — back/forward still
  moves between meaningfully different views, not every intermediate filter tweak.
- **No sensitive data enters the URL**: the six synced values are filter criteria and a plain integer
  offset — never a credential, token, tenant id, or assessment id (the detail route's assessment id is
  a route param, already an established, approved pattern since Wave 34C, and is a random, non-secret
  UUID). Verified explicitly by `test_no_sensitive_or_internal_identifiers_appear_in_the_list_url`.

`RealAssessmentList` itself changed only in how it obtains and updates `environment`/`riskBand`/
`recommendation`/`createdAfter`/`createdBefore`/`offset` — every other line (the filter bar JSX, the
table, the empty/loading/error states, `OffsetPagination`) is unchanged from Wave 34C.

## 11. Pagination Behavior

Unchanged mechanism (offset/limit/`has_more`, the fetch-limit-plus-one technique on the backend) —
now URL-synced. `Previous`/`Next` call `setOffset(offset ± LIST_PAGE_SIZE)`, which writes `offset`
into the URL (or removes it when back at zero) rather than local state. A direct link to
`?offset=40` restores page 3 exactly, both in the rendered "Showing 41–41" label and in the actual
request sent — verified by `test_a_direct_url_with_an_offset_restores_that_page`. No total count, no
page-number invention — `has_more` remains the only signal `Next` is enabled on, exactly as before.

## 12. Detail Behavior

Unchanged from Wave 34C: `GET /assessments/{id}`, generic 404 for any inaccessible id (nonexistent,
cross-tenant, or cross-environment — all indistinguishable, per the backend's own no-existence-oracle
design), malformed-UUID path param handled as a 404-equivalent not-found state by the frontend
(`isNotFound || isValidation`).

## 13. PROCESSING/COMPLETED/FAILED Handling

Unchanged from Wave 34C: `AssessmentProcessingState` (spinner, no fabricated score/band/recommendation,
no timer), `AssessmentFailedState` (no `failure_reason`, no internal error text), and the completed
path reusing `AssessmentCard`/`DecisionTrace` via the existing adapter. Re-verified this wave by the
full pre-existing `assessments-real.test.tsx` suite (22/22 passing, unchanged).

## 14. Security/Privacy Boundaries

Re-reviewed per this wave's own Phase 16 checklist: no tenant id or arbitrary environment UUID is ever
accepted from the client (the environment filter is one of exactly `"sandbox"|"live"`, validated, and
is a label/filter server-side per Wave 34B — never an authorization boundary); no credential/secret/
token ever enters a URL or browser storage (grepped the full assessment code path for
`console.*`/`dangerouslySetInnerHTML`/`localStorage`/`sessionStorage` — none found); no internal field
(`execution_json`, `rule_versions`, `decision_trace_reference`, `scoring_configuration_hash`,
`engine_assessment_id`, `credential_id`, `idempotency_key`, `request_fingerprint`, any `*_ref_hash`,
`source_ip_hash`, `failure_reason`, `attempts`, `claimed_at`) is in the TypeScript types consumed by
any component, let alone rendered — this is a type-level impossibility, not just a rendering choice,
unchanged since Wave 34C. The frontend remains never the authorization boundary — every isolation
guarantee is enforced server-side and only reflected, never re-implemented, client-side.

## 15. Sample-Data Removal Verification

Re-grepped the full assessment frontend for `sampleAssessments`/`sampleDetails` usage: both call sites
remain exactly where Wave 34C placed them — inside the explicit, URL-opt-in (`?sample=1`) preview
branch of `Assessments()` and inside the entirely separate `/app/assessments/sample/:sampleId` route's
own component. Neither is reachable from the production (`sample` param absent) path. This mirrors
the distinction the wave's own Phase 13 draws between a test fixture and production data: the sample
mode is a clearly-labelled, user-initiated preview feature (with its own `SampleDataBanner`/
`SampleBadge`), not sample data masquerading as real data — it was explicitly reviewed and kept as
intentional in Wave 34C and is unchanged here.

## 16. Accessibility/Responsive Considerations

No new interactive pattern was introduced — `useAssessmentListFilters` only changes where state lives,
not what's rendered or how. The existing `Select`/native `input[type=datetime-local]`/`Button`/
`DataTable`/`OffsetPagination` components (all pre-existing, all already accessible — labelled
controls, semantic table markup, responsive stacking below `md`) are reused unchanged. No horizontal-
overflow or keyboard-navigation regression is possible from this wave's change, and the full existing
test suite (role-based queries throughout) continues to pass unchanged, which would fail immediately
if any accessible name or semantic role had shifted.

## 17. Tests

**New**: `src/test/assessments-url-state.test.tsx`, **9 tests** — direct-URL filter restoration,
direct-URL offset restoration, filter-change updates the URL, clear-filters empties the URL, filter
change resets offset out of the URL, Next/Previous update the URL offset and round-trip through a
simulated reload, an invalid filter value in the URL is ignored not sent to the API, a negative/
non-numeric offset is clamped to zero, no sensitive data appears in the URL.

**Regression**: `src/test/assessments-real.test.tsx` (22 tests, unchanged, all passing — proving the
refactor from local state to URL state didn't change any existing filter/pagination/detail behavior)
plus the full suite.

## 18. Exact Validation Results

- **Frontend**: new suite 9/9 passing; full suite **230/230 passing** (12 files); `tsc -b` clean;
  `oxlint` clean; `vite build` succeeds.
- **Backend** (read-only verification, no files changed): `tests/integration/test_assessment_read_api.py`
  **30/30 passing** on SQLite; **30/30 passing** on real PostgreSQL 18; `tests/security` **122/122
  passing**. No migration, no schema change, no backend code touched this wave.

## 19. Known Limitations

- Pagination is offset-based, exactly matching the real, documented, deliberate Wave 34B contract —
  not a limitation of this wave's own work, but recorded here since the wave's own instructions
  assumed otherwise (see §2).
- URL state covers filters and the list offset only — the detail route's "back to list" link always
  returns to `/app/assessments` with whatever filters/offset are currently in the URL (since it's the
  same URL the user navigated from), not a separately remembered prior view; this matches how
  `react-router`'s own back-navigation already behaves and required no special handling.
- Sample mode (`?sample=1`) remains its own, separate, unsynchronized preview surface — intentionally
  out of this wave's scope (§15); it was not given URL-synced filters because Wave 34C already judged
  it a secondary, clearly-labelled preview feature, not the product surface being hardened here.

## 20. Explicitly Deferred Capabilities

Per the wave's strict scope boundaries: no Analytics, Cases, Transactions, Platform Admin, generic
policy-lineage listing, or any backend change was implemented or attempted. Cursor pagination was not
implemented, because it does not exist in the real backend contract (§2) — implementing it would have
meant inventing a backend capability outside this wave's explicit prohibition on inventing endpoints/
pagination mechanisms. The Policies page's own, separately-disclosed (Wave 35B) URL-state gap was left
untouched, per this wave's own Phase 20 instruction.

## 21. Git/Change Audit

`fraud-platform-api`: zero files modified (confirmed via `git status` and an mtime check against the
last file this session modified in that repo before Wave 36 began — no newer file found). `fraud-engine`:
untouched. `fraud-web-app` (not a git repository — confirmed by mtime, matching this session's
established convention for this repo): new files
`src/hooks/use-assessment-list-filters.ts`, `src/test/assessments-url-state.test.tsx`,
`fraud-web-app/docs/architecture-decisions/wave36-assessment-tenant-ui-v1.md`; modified
`src/pages/app/assessments.tsx` only. No other file touched.

## 22. Recommendation for the Next Wave

The Policies page (Wave 35B) has the identical, already-disclosed URL-state gap this wave just closed
for Assessments — applying the exact same `useSearchParams`-based pattern there (environment only,
since Policies has no other filters) would be a small, low-risk, high-consistency follow-up. Beyond
that, no further assessment-read gap was found during this wave's own re-verification; the next
substantive capability gap remains whatever Wave 35A's audit already identified as the next-highest
unaddressed priority (Cases, or the Platform Admin RBAC foundation), both explicitly out of this
wave's scope.
