# Wave 38B — Analytics Stale Copy Correction

Tiny frontend-only correction wave, scoped exactly to the one gap Wave 38A disclosed. No Analytics
feature, backend endpoint, migration, or chart was added.

## 1. Stale Statement Discovered in Wave 38A

`src/pages/app/analytics.tsx`'s `UnavailableState` (rendered whenever sample mode is off) read:

```
Analytics data will appear here once assessments are available.

The platform API doesn't yet expose assessment history or aggregates, so no live analytics are
shown — and none are fabricated. Use "Preview with sample data" to see the layout.
```

## 2. Why It Was Factually Incorrect

`GET /api/v1/assessments` has existed in `fraud-platform-api` since Wave 34B, and `/app/assessments`
has consumed it as real, functional row-level assessment history since Wave 34C (reinforced by
Wave 36's URL-state work). The claim "doesn't yet expose assessment history" was therefore false —
and had been false since Wave 34C, unnoticed through Waves 34C, 36, and 37 because none of those
waves touched the Analytics page itself. Wave 38A's read-only reconciliation audit identified this
as the primary historical-vs-current-code contradiction in the whole product and explicitly
recommended correcting only this copy as the next, lowest-risk wave.

## 3. Corrected Wording / Concept

```
Aggregate trends — volume, risk mix, and policy outcomes — will appear here once that reporting
exists.

Your assessment history is already available on the Assessments page. The platform API doesn't
yet provide aggregate analytics, so no live analytics are shown here — and none are fabricated.
Use "Preview with sample data" to see the layout.
```

The page title ("Analytics aren't available yet") is unchanged — it remains true of *aggregate*
analytics, which this wave does not add.

## 4. Explicit Distinction: Row-Level History vs. Aggregate Analytics

| | Status |
|---|---|
| Row-level assessment history (list + detail) | **Available** — `GET /api/v1/assessments`, consumed by `/app/assessments` since Wave 34C |
| Aggregate assessment volume | Not available — no aggregation endpoint exists |
| Risk-band distribution | Not available |
| Recommendation distribution | Not available |
| Latency aggregates | Not available |
| Failure-rate aggregates | Not available |
| Environment aggregates | Not available |
| Policy-version correlation analytics | Not available |

The corrected copy communicates this distinction directly: it points the tenant to the real
history (Assessments page) while still accurately stating that aggregate analytics are not shown
and none are fabricated.

## 5. Files Changed

- `src/pages/app/analytics.tsx` — corrected the two `<p>` elements inside the `UnavailableState`
  branch. No other line in the file was touched; the sample-mode branch (charts, metrics, bar
  lists) is unchanged.
- `src/test/fraud-ui.test.tsx` — updated the one test that asserted the exact stale wording;
  added one new test asserting the stale claim is gone and the corrected claims are present; added
  one new test proving sample/preview mode still works and that no real `GET /api/v1/assessments`
  (or any other) network call is made from the Analytics page.

No other file in `fraud-web-app` was changed. `fraud-platform-api` and `fraud-engine` were not
touched.

## 6. Tests

- `src/test/fraud-ui.test.tsx`:
  - `"/app/analytics" says the feature is unavailable instead of faking data"` (existing,
    parameterized, unchanged) — still asserts the title "Analytics aren't available yet" renders.
  - `"analytics: states aggregates are unavailable without claiming assessment history is
    unavailable"` (rewritten from the old wording-exact test) — asserts the new copy is present
    and asserts the old false claim (`doesn't yet expose assessment history`) is absent.
  - `"analytics: preview/sample mode still works and makes no real analytics API call"` (new) —
    toggles sample mode on, confirms the sample Volume section renders and is badged "Sample
    data", and confirms `GET /api/v1/assessments` was never requested.

No existing test was weakened; the one test whose expected string changed was changed only because
the string it asserted was the stale text this wave intentionally removed.

## 7. Validation

- Targeted: `npx vitest run src/test/fraud-ui.test.tsx` — **66/66 passing**.
- Full suite: `npx vitest run --no-file-parallelism` — **231/231 passing** (230 previously + 1 net
  new test; no regressions).
- `npx tsc -b` — clean.
- `npx oxlint` — clean.
- `npx vite build` — succeeds.
- No backend validation performed or required: `fraud-platform-api` was not touched.

## 8. Deferred Analytics Implementation

Unchanged from Wave 38A's own recommendation: a real aggregate Analytics capability (Wave 41 in
the Wave 38A roadmap) still requires a new backend aggregation layer and is explicitly **not**
part of this wave. This wave corrects only the user-facing claim about what already exists; it
adds no new capability, chart, metric, or API call.

## 9. Change Audit

- `fraud-platform-api`: untouched (confirmed via `git status` — identical pre-existing diff from
  waves 34B–37, no new modifications).
- `fraud-engine`: untouched (confirmed via `git status` — identical pre-existing untracked tree).
- No migration added. No new API added. No new analytics functionality added. No generated
  artifacts committed (build output is in `dist/`, gitignored, not part of this change). No
  secrets touched.
- `fraud-web-app` has no `.git` repository; the only files modified this wave are the two listed
  in §5, confirmed via direct file-modification timestamps matching this wave's session exactly
  (both edited within the same minute, 2026-10-06, nothing else in `src/` carries that timestamp).
- No commit was made, per standing session convention.
