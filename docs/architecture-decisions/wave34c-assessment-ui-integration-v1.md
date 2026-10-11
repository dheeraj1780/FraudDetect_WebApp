# Wave 34C — Real Tenant Assessment UI Integration

Frontend-only integration wave. Wires the production assessment list and detail pages to the real,
already-verified Wave 34B read API (`fraud-platform-api`), removing the former "not available yet"
placeholder from the production (non-sample) path. No backend or `fraud-engine` code was touched.

## 1. Wave objective

Replace the assessment list/detail pages' production path — which previously said plainly that
listing/looking up real assessments wasn't possible — with real data from `GET /api/v1/assessments`
and `GET /api/v1/assessments/{assessment_id}`, while leaving the existing, clearly-labelled sample-data
experience (`?sample=1`, `/app/assessments/sample/:sampleId`) completely untouched.

## 2. Wave 34B contract consumed

- `GET /api/v1/assessments` → `{ items: AssessmentListItemOut[], has_more: boolean }`, session-authenticated,
  tenant-scoped server-side. Query params used exactly as specified: `environment`, `risk_band`,
  `recommendation`, `created_after` (inclusive), `created_before` (exclusive), `limit` (1–100, default 20),
  `offset`. Sort order (`created_at DESC, id DESC`) and the absence of a total count are taken as given —
  nothing is derived or faked from them.
- `GET /api/v1/assessments/{assessment_id}` → `AssessmentDetailOut`, generic 404 for a nonexistent or
  cross-tenant id (treated identically — the UI never distinguishes the two, matching the backend's own
  no-existence-oracle design).
- Three lifecycle states (`processing`/`completed`/`failed`) are each rendered, not just `completed`.

## 3. Routes integrated

- `/app/assessments` — production path (`sample` param absent/`0`) now renders `RealAssessmentList`
  instead of `UnavailableState`. The `?sample=1` path is unchanged.
- `/app/assessments/:assessmentId` — **new route**, `RealAssessmentDetail`. Distinct from the existing
  `/app/assessments/sample/:sampleId` (unchanged); React Router ranks the static `sample` segment above
  the dynamic one, so there is no routing ambiguity.

## 4. API endpoints consumed

`src/lib/api/endpoints/assessments.ts` (new): `assessmentsApi.list(params)`, `assessmentsApi.get(id)`,
both through the existing `apiFetch` (which already attaches the session bearer token and `X-Tenant-Id`
automatically — neither this file nor any caller ever sets either manually).

## 5. Frontend types/hooks/components changed

- **Types** (`src/lib/api/types.ts`): added `AssessmentLifecycleStatus`, `AssessmentListItemOut`,
  `AssessmentListOut`, `AssessmentDetailOut` — a deliberately separate set from the existing `AssessmentOut`
  (the POST submission response), mirroring the backend's own Wave 34B decision not to widen that frozen
  schema. No existing type was changed.
- **Hooks** (`src/hooks/use-assessments.ts`, new): `useAssessments(params)`, `useAssessmentDetail(id)`,
  both plain `useQuery`; the list hook uses `placeholderData: keepPreviousData` so a filter/page change
  doesn't flash back to a loading spinner.
- **Query keys** (`src/lib/query/keys.ts`): added `assessments(params)` / `assessmentDetail(id)` builders.
- **Vocabulary** (`src/lib/fraud/vocabulary.ts`): added `ASSESSMENT_STATUS_INFO` (processing/completed/failed
  labels, descriptions, tone).
- **`AssessmentStatusBadge`** (`src/components/fd/risk-badge.tsx`, new export): the one genuinely new badge
  needed — none of the existing badges represent the assessment's own lifecycle state.
- **`AssessmentProcessingState` / `AssessmentFailedState`** (`src/components/fd/assessment-lifecycle-states.tsx`,
  new file): dedicated, minimal views for the two non-completed states. Deliberately NOT built by reusing
  `AssessmentCard`/`DecisionTrace` — those components assume a completed decision exists (they read
  `policy.recommendation`, `engine.*` as non-null) and reusing them would require either loosening their
  types (risking the sample-mode code path that still relies on the non-null `AssessmentOut` shape) or
  passing fabricated placeholder values, which the wave's own instructions explicitly forbid.
- **`AssessmentDetail`** (`src/components/fd/assessment-detail.tsx`): one additive change — a new optional
  `environment` prop, rendered in place of the old hardcoded "Not included in the response" line when
  supplied. Sample mode doesn't pass it, so sample mode's own display is byte-for-byte unchanged.
  `AssessmentCard` and `DecisionTrace` were **not modified at all**.
- **`toLegacyCompletedAssessment`** (`src/lib/fraud/assessment-adapter.ts`, new): converts a COMPLETED
  `AssessmentDetailOut` into the exact `AssessmentOut` shape `AssessmentDetail`/`AssessmentCard`/
  `DecisionTrace` already render, so those three existing, already-tested components are reused completely
  unchanged for the completed case — this is the main mechanism by which Phase 11 ("reuse, don't redesign")
  was satisfied for the detail page. Throws if called on a non-completed row (an internal
  contract the two call sites — `RealAssessmentDetailBody`'s own narrowing — never violate).
- **`OffsetPagination`** (`src/components/ui/pagination.tsx`, new export alongside the existing `Pagination`):
  a prev/next control for an endpoint with `has_more` instead of a total. The existing `Pagination`
  component requires a known `pageCount` and renders "Page X of Y" — reusing it for the real list would have
  required fabricating a page count the backend doesn't provide, which the wave's acceptance criteria (F)
  explicitly forbid. `Pagination` itself is untouched and still used by sample mode and audit logs.
- **`RealAssessmentList`** (inside `src/pages/app/assessments.tsx`, new): the production list, rendered only
  when sample mode is off.
- **`RealAssessmentDetail` / `RealAssessmentDetailBody`** (inside `src/pages/app/assessment-detail.tsx`, new):
  the production detail page.

## 6. Filters implemented

Exactly the five the backend supports, no more: `environment` (All/Sandbox/Live), `risk_band`
(All/LOW/MEDIUM/HIGH), `recommendation` (All/PROCEED/STEP_UP/REVIEW/BLOCK), and a `created_after`/
`created_before` date-time range. No `rule`/`reason_code` or `telemetry-quality` filter was added — the
backend doesn't offer them (Wave 34A's own contract explicitly excluded them from V1), so no such control
exists on the real list. The existing sample-mode filter bar (band + recommendation only) is unchanged;
the production bar is a separate, richer set that matches what the real API actually accepts.

Every filter change resets `offset` to `0` (verified by test).

## 7. Pagination behavior

Offset/limit/`has_more`, exactly as Wave 34B implemented it — no cursor, no fabricated total or page count.
`limit` is fixed at 20 (the backend's own default) rather than exposed as a user control, since no UI
requirement called for a page-size selector. `OffsetPagination` shows "Showing N–M" and disables
Previous/Next at the natural boundaries (`offset === 0` / `has_more === false`).

## 8. Processing/completed/failed handling

- **COMPLETED**: the full existing `AssessmentCard` + `DecisionTrace` experience, via the adapter in §5 —
  identical rendering to what a pasted/sample completed assessment already showed, now with the real
  `environment` field also displayed (which neither sample data nor a pasted response carries).
- **PROCESSING**: `AssessmentProcessingState` — a spinner, the status badge, submitted time, environment,
  and the assessment id. No score, band, recommendation, or Decision Trace section is rendered. No
  fabricated timer or progress percentage exists anywhere in the component.
- **FAILED**: `AssessmentFailedState` — the status badge, an explicit "No assessment was performed… no
  fraud decision was made" statement, submitted time, environment, and the assessment id.
  `failure_reason` is never requested, stored, or rendered (the backend never returns it to this endpoint
  either).

## 9. Error/loading/empty states

- **List**: `LoadingState` while pending; `ErrorState` (existing component, generic, retryable) for any
  non-404 failure including 500s and 429-shaped errors (the component already branches 403 → access
  message, otherwise a generic retryable failure with the server's own message — no bespoke rate-limit UI
  was built, since the backend doesn't actually rate-limit this endpoint and inventing a distinct
  treatment for a status code that can't occur would be speculative); a 401 is handled globally (the
  existing `apiFetch` → forced sign-out flow), not by this page. Two distinct empty states: "No
  assessments yet" (no filters active) vs. "No assessments match these filters" (a filter is active),
  each with its own icon and copy, with a "Clear filters" action on the latter.
- **Detail**: `LoadingState` while pending; a 404 **or** 422 (malformed id) both collapse into the same
  "Assessment not found" empty state — deliberately not distinguished, since the backend itself gives no
  existence oracle and a malformed id is, from the tenant's point of view, simply "not a real assessment
  you can see"; any other failure gets the generic `ErrorState`.

## 10. Security/privacy review

See Phase 12 of the wave instructions, checked explicitly:

- Grepped every new/changed file for `console.*`, `dangerouslySetInnerHTML`, `localStorage`/
  `sessionStorage` — none found. No new logging, no unsafe HTML, no new client-side storage.
- No `tenant_id`/`environment_id` is ever constructed or sent by hand; `apiFetch` supplies the tenant
  header automatically, exactly as every other authenticated endpoint already does, and `environment` in
  the assessments filter is a plain `"sandbox"|"live"` label/filter value, never an id, never used to
  authorize anything — the server remains the sole authority (and, per Wave 34B, enforces tenant scoping
  regardless of what `environment` is passed).
- A dedicated test (`"never renders any internal-only field, in any of the three states"`) asserts the
  rendered page text never contains `idempotency_key`, `request_fingerprint`, `failure_reason`, `rule_id`,
  `scoring_configuration_hash`, `decision_trace_reference`, `attempts`, `credential_id`, or
  `source_ip_hash` — none of these are in the TypeScript types consumed by any new component either, so
  this isn't just a rendering choice but a type-level impossibility for the data this wave introduced.
- No React Query data is persisted outside memory (no persistence plugin is configured); nothing new is
  written to `localStorage`/`sessionStorage`.

## 11. Sample-data removal

The production (`sample` param absent) path of `/app/assessments` previously rendered `UnavailableState`
plus two discovery cards ("Inspect a response you already have", "Explore sample assessments") that
existed only to compensate for the missing real capability. Both are removed from the production path —
they are now genuinely redundant: the Decision Trace paste-and-inspect tool remains reachable from its own
nav entry, and the sample-assessment detail pages remain reachable via the sample toggle itself. The
sample-mode branch (`?sample=1`) is byte-for-byte the same sample-generation code
(`sampleAssessments`/`sampleDetails` from `src/lib/fraud/sample.ts`, untouched) with the same filters,
table, and pagination component as before; only its trailing footnote text was reworded (it previously
claimed environment/date-range filtering would be "added when the API provides them," which is no longer
accurate now that the *real* list has them — the sentence now correctly says sample mode has its own,
simpler filter set and points at turning sample mode off for the richer real filters).

## 12. Tests and exact results

New file `src/test/assessments-real.test.tsx` (22 tests): list loading/data/empty/filtered-empty/error/
validation-or-rate-limit-shaped-error/auth-redirect states, filter query-param correctness, offset reset
on filter change, `has_more`-driven Previous/Next enablement, no fabricated page count, correct detail
linking; detail completed/processing/failed/not-found/backend-failure rendering and the internal-field
leak check; list→detail, detail→list, and direct-link navigation, plus a signed-out redirect on the new
route. One existing test in `src/test/fraud-ui.test.tsx` was updated (not deleted) — it previously
asserted the now-obsolete "Assessment history isn't available yet" placeholder; it now asserts the real
table renders and that placeholder text is absent, which is the whole point of this wave.

**Full suite result: 206/206 passing** (184 pre-existing + 22 new), run via `npx vitest run`. No existing
test was weakened or deleted.

## 13. Build/typecheck/lint results

- `npx tsc -b` — clean, no errors.
- `npx oxlint` — clean, exit code 0.
- `npx vite build` — succeeds (`✓ built in 1.82s`), new chunks for `assessments`, the real
  `assessment-detail`, `use-assessments`, and `pagination` all emitted normally.

## 14. Manual integration verification

**Not performed this wave.** All verification above is automated (Vitest + MSW mocks of the exact Wave 34B
response shapes, built directly from that wave's own schemas/documentation) plus static typechecking/
linting/build. No real `fraud-platform-api` instance was started and exercised from a browser against this
UI in this wave — that would require standing up the backend, a signed-in session, and seeded data, which
was judged out of scope for a frontend-integration-only wave whose contract was already independently
verified (Wave 34B's own 30-test suite, run against both SQLite and real PostgreSQL). This is reported
plainly rather than claimed.

## 15. Known limitations

- `limit` (page size) is fixed at 20, not user-configurable.
- No `rule`/`reason_code` or telemetry-quality filter exists, matching the backend's own V1 scope.
- Filters and pagination are local component state, not reflected in the URL — so a filtered view can't be
  bookmarked/shared, and a browser refresh resets filters to defaults (though a *direct link to a specific
  assessment's detail page* works correctly, since that id is a route param, not a filter). This mirrors
  the existing Audit Logs page's own pagination (also local state, not URL-synced); the one existing
  URL-state precedent in this codebase (`?sample=1`) is a single boolean flag, not a precedent for a
  multi-filter query string, so this wave did not introduce URL-synced filters for the real list.
- No manual/browser integration test against a live backend was performed (see §14).
- Offset pagination (not cursor) is used, matching Wave 34B's own backend choice exactly.

## 16. Intentionally deferred

- Real-time/polling updates for a PROCESSING assessment (the user must navigate back and re-open the
  detail page to see a later state) — the wave instructions explicitly said not to add polling unless the
  backend and existing architecture already supported it, and neither does.
- URL-synced filter/pagination state for the list (see §15) — a reasonable future enhancement, not
  attempted here to avoid scope creep beyond what was asked.
- Manual/browser integration testing against a running backend.

## 17. Backend and fraud-engine unchanged

No file in `fraud-platform-api` or `fraud-engine` was read-for-editing or modified in this wave — every
tool call this wave operated exclusively within `fraud-web-app`. No contradiction between the verified
Wave 34B contract and the frontend's requirements was discovered; the backend boundary was never
approached, let alone crossed.
