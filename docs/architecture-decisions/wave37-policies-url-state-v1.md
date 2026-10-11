# Wave 37 — Policies URL-Synchronized Environment State

## 1. Objective

Close the one UI-consistency gap Wave 35B disclosed: synchronize the Policies page's environment
selection into the URL, the same way Wave 36 did for the Assessments list. Per this wave's own
explicit instruction — "If the current Policies page does NOT actually have a user-selectable
environment state, stop and document that URL synchronization is not applicable rather than
inventing a feature" — Phase 0 required verifying that premise against the actual current code
before writing anything.

## 2. Finding: No Environment-Selection State Exists to Synchronize

Direct inspection of `src/pages/app/policies.tsx` (current file, re-read in full this wave, not
assumed from the Wave 35B report) shows `environment` is a **hardcoded literal string `"sandbox"`**
at every call site:

- `useActivePolicy("sandbox")` (line 91)
- `usePolicyVersions(effectivePolicyId, "sandbox")` (line 94)
- `activateVersion.mutateAsync({ versionId, body: { environment: "sandbox" } })` and the identical
  pattern for `reactivateVersion`/`retireVersion` (lines 121, 132, 143)
- `<PolicyDraftDialog environment="sandbox" ... />` (line 375)
- The section heading itself reads "Your sandbox policy" (line 298) — static copy, not derived from
  any state.

There is no `<Select>`, tab, toggle, route param, or any `useState`/`useSearchParams` call anywhere
in the component that represents an environment **choice**. `grep` of
`src/test/policies.test.tsx` (the full existing policy test suite, 15 tests) confirms it never
references "environment"/"sandbox"/"live" as a selectable concept either — only
`environment_id` appears, in the one data-leak assertion unrelated to UI state.

**This is not a bug and not an oversight to "fix".** It is the documented, deliberate outcome of
Wave 35A's own audit finding (re-confirmed, not merely cited): no production code path in
`fraud-platform-api` ever provisions a LIVE `TenantEnvironment` row for any tenant — the only
environment any real tenant has is SANDBOX. Wave 35B's own architecture document recorded this
explicitly as a known limitation: *"No LIVE environment support in practice... so the Policies page
only ever operates against `sandbox` (no environment selector was built, consistent with the rest of
the product today)."* Building a selector today would offer a choice between "sandbox" (always
works) and "live" (would 404 for every real tenant, since nothing can ever activate a LIVE
environment for them) — a UI control with no genuine second option, which this wave's own Phase 8
("do not redesign the Policies page... do not add live environment support" — also listed in Strict
Scope) and Phase 1 ("do NOT invent one merely to create URL state") both explicitly prohibit
building.

**Conclusion: URL synchronization is not applicable this wave.** No code was changed in
`src/pages/app/policies.tsx`, no new hook was created, and no test was added for environment
selection, because there is no selection state for a URL to represent. This mirrors Wave 36's own
reconciliation discipline (where "cursor pagination" turned out not to exist and the real,
offset-based contract was used instead) — here, the honest finding is that the premise itself
(an existing environment-selection capability) does not hold, so the correct action is to stop, not
to retrofit a URL parameter onto a control that was never built.

## 3. Existing Policies Environment Behavior (Unchanged)

Environment remains exactly what Wave 35B established: a fixed `"sandbox"` argument passed to every
hook/mutation call. The underlying infrastructure — `useActivePolicy(environment)`,
`usePolicyVersions(policyId, environment)`, `queryKeys.activePolicy(environment)`,
`queryKeys.policyVersions(policyId, environment)`, and the API client's `envQuery(environment)` — is
already fully environment-parameterized (confirmed by re-reading `src/hooks/use-policies.ts`,
`src/lib/query/keys.ts`, `src/lib/api/endpoints/policies.ts`). If a genuine environment-selection UI
is ever justified by a future wave (i.e., once a LIVE environment issuance path exists on the
backend — itself a Wave 35A-identified, still-open gap), the query-key and hook layer already
correctly discriminates by environment and needs no change at that time; only the page component
would need a real selector.

## 4. URL Parameter Contract

Not applicable — no parameter was added.

## 5. Validation Behavior

Not applicable.

## 6. Query-Key/Cache Behavior

No change made. Re-verified as already correct for a future selector: `queryKeys.activePolicy` and
`queryKeys.policyVersions` both already include `environment` as a discriminating key segment, so a
future environment-selection feature would not need a query-key fix — this requirement (Phase 7) is
already satisfied by Wave 35B's own design, confirmed by direct inspection rather than assumed.

## 7. Mutation Behavior

Unchanged. Every mutation (`activate`/`reactivate`/`retire`/`create_draft`) still sends
`environment: "sandbox"`, exactly as before this wave. No mutation behavior was touched.

## 8. Security/Privacy Considerations

No new surface was introduced, so no new review was required. Re-confirmed as a byproduct of
re-reading the page: no raw environment UUID is exposed anywhere in `policies.tsx` today (it only
ever passes the literal name `"sandbox"`), consistent with the approved tenant-facing contract
(Wave 35B §9).

## 9. Tests

No new tests were added, since no new behavior exists to test. The existing 15-test
`src/test/policies.test.tsx` suite was re-run to confirm the baseline remains green (see §10) — none
were modified or weakened.

## 10. Exact Validation Results

Run to confirm the (unchanged) baseline is clean:

- `src/test/policies.test.tsx`: **15/15 passing**.
- Full Vitest suite: **230/230 passing** (unchanged from Wave 36's own final count).
- `tsc -b`: clean.
- `oxlint`: clean.
- `vite build`: succeeds.

Backend: `fraud-platform-api` was not touched (no code change was needed or made), so no backend
regression suite was required by this wave's own Phase 10 instruction ("only run relevant policy/
security regression tests if backend code was touched"). Confirmed via `git status`/mtime check that
zero files changed in that repository this wave (§13).

## 11. Known Limitations

Identical to Wave 35B's own, unresolved by this wave because resolving it is out of scope: no LIVE
environment issuance path exists anywhere in `fraud-platform-api`, so a real environment-selection UI
(and therefore URL-synchronized environment state) cannot be meaningfully built until that backend
capability exists. This wave does not change that status.

## 12. Explicitly Deferred Work

Building an actual environment selector for the Policies page — deferred, pending a LIVE environment
issuance capability on the backend (a Wave 35A-identified gap, itself explicitly out of this wave's
scope, and prohibited by this wave's own Strict Scope section: "live environment support"). No
Analytics, Cases, Transactions, Platform Admin, generic lineage listing, new policy API, new RBAC, or
redesign work was performed, needed, or attempted.
