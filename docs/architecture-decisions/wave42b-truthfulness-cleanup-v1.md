# Wave 42B — Product Truthfulness Cleanup

Narrow frontend-only correction wave, directly implementing the two highest-value stale-copy
findings surfaced by Wave 42A's read-only audit
(`fraud-platform-api/docs/architecture-decisions/wave42a-product-completeness-reconciliation-v1.md`,
§7). No backend, database, migration, fraud-engine, or API change was made or needed.

## 1. Why This Copy Was Stale

Two capabilities shipped in earlier waves without their frontend copy ever being updated to
reflect them — the same bug class this project already found and fixed once before for the
Analytics page (Wave 38B):

- **Wave 34B/34C** added the real `GET /api/v1/assessments` list/detail API and wired it into
  `/app/assessments`.
- **Wave 41** added the real aggregate analytics API and wired it into `/app/analytics`.
- **Wave 40** added real, self-service LIVE environment provisioning
  (`POST /api/v1/tenants/current/environments/live`).

`src/pages/app/overview.tsx` and `src/components/app/topbar.tsx` were never updated after any of
these three waves. Both still contained copy written when none of these capabilities existed,
and both were therefore actively misleading a user about what the product can currently do.

## 2. Corrections Made

### 2.1 `src/pages/app/overview.tsx` — stale assessment-history/analytics claims

| Location | Before | After |
|---|---|---|
| Top info banner | "Assessment history isn't available in this console yet... The platform doesn't expose a way to list or aggregate them here yet" | "This overview doesn't show live assessment figures yet" — states plainly that the real data lives on **Assessments** and **Analytics** (linked), and that this specific page just doesn't pull it in |
| "Risk activity" chart placeholder | "Risk activity will appear here once assessment history is available through the API." | "Risk activity isn't shown on this overview yet." + a real link to Analytics |
| "Risk distribution" chart placeholder | "Distribution isn't available until assessments can be read." | "Risk distribution isn't shown on this overview yet." + a real link to Analytics |
| "Recent assessments" table placeholder | "Recent assessments will be listed here once the API can return them." | "Recent assessments aren't listed on this overview yet." + a real link to Assessments |
| "Top triggered rules" placeholder | "Rule firing frequency isn't available until assessments can be read." | "Rule firing frequency isn't exposed by the platform API — only your assessment outcomes are, never individual rule identity." — this one needed a **different** correction, not just an updated availability date: rule-level firing detail is not blocked by the (now-real) assessment-read capability at all; it is withheld by the platform's own permanent rule-internals boundary, the same boundary that keeps rule ids out of every other tenant-facing surface. The old copy attributed the wrong cause. |
| "Environments" card, Live row | Badge: "Not available in this release" | Badge: "Credentials not issuable yet", with a tooltip correctly scoping the claim to credential issuance, not the environment itself (see §2.2 — this is the same underlying falsehood as the topbar badge, found in a second location while already editing this page for the assessment-copy fix, not a new unrelated issue) |

**What was deliberately NOT changed:** no real data was wired into Overview's own cards/charts.
The underlying fact that *this specific page* doesn't pull in live assessment figures remains
true and is now stated honestly, with a pointer to where the real data already lives — exactly
the same resolution pattern Wave 38B used for the Analytics page itself. Wiring real assessment/
analytics data into Overview's own widgets would be a feature addition, out of this wave's
explicit "copy only" scope.

### 2.2 `src/components/app/topbar.tsx` — stale global EnvironmentBadge

The persistent, always-rendered `EnvironmentBadge` (visible on every authenticated page) had a
tooltip reading **"Live environment isn't available in this release."** This was false since
Wave 40: a live environment can be explicitly provisioned by a tenant's OWNER from the Credentials
or Policies page. What remains unavailable is specifically **live credential issuance** — a
separate, still-open product decision (Wave 31/35A/40's own architecture decisions), not the
environment itself.

Corrected tooltip: **"Live credential issuance isn't available yet. A live environment can be
provisioned separately from Credentials or Policies."** The visible badge text ("Sandbox") and
its icon/styling were left unchanged — credential issuance genuinely remains sandbox-only, so
"Sandbox" is still an accurate label for what the badge has always meant to communicate. The
badge remains static (no new data fetch was added to the global Topbar component); only the
wording was corrected, keeping this a pure copy fix with zero new behavior.

**What was deliberately NOT done:** the badge was not made dynamic/data-driven (it does not check
whether this specific tenant has actually provisioned LIVE), and the fix does not imply that live
credential issuance is now available — both per this wave's explicit constraints.

## 3. Verification Performed

- Read both files in full before editing, and re-read the exact stale strings being replaced
  rather than assuming their wording from memory.
- Confirmed via `grep` that no other test file asserted the old stale strings beyond the two
  found and updated in `src/test/fraud-ui.test.tsx`.
- Confirmed via `grep` that the "Rule firing frequency" capability does not exist anywhere in the
  real product (sample-mode-only, on both Overview and Analytics) before writing its corrected
  copy, so the new wording does not imply a capability that doesn't exist.
- Confirmed the `Badge` component accepts a `title` prop (extends `HTMLAttributes<HTMLSpanElement>`)
  before using it for the Environments-card tooltip.

## 4. Tests

`src/test/fraud-ui.test.tsx`:
- 2 existing assertions updated to match the corrected copy (`history isn't available in this
  console yet` → `this overview doesn't show live assessment figures yet`; the old "Risk activity
  will appear here..." string → the new "isn't shown on this overview yet" string, plus new
  assertions that the two real links to Assessments/Analytics are present and point to the right
  routes).
- 3 new tests added: the global badge's tooltip correction, the Environments card's Live-row
  correction, and the rule-firing-frequency copy correction — each asserting both that the new
  text is present **and** that the specific old false string is gone.

No fake functionality or sample data was added to satisfy any test; every new assertion checks
real, static copy already rendered by the corrected components.

## 5. Validation

- Targeted: `npx vitest run src/test/fraud-ui.test.tsx` — **67/67 passing** (64 prior + 3 new).
- Full suite: `npx vitest run --no-file-parallelism` — **261/261 passing** (258 prior + 3 new, no
  regressions).
- `npx tsc -b` — clean.
- `npx oxlint` — clean.
- `npx vite build` — succeeds.

## 6. Change Audit

Exactly two source files and one test file were modified, all in `fraud-web-app`:
- `src/pages/app/overview.tsx`
- `src/components/app/topbar.tsx`
- `src/test/fraud-ui.test.tsx`

Plus this documentation file. **No file in `fraud-platform-api` or `fraud-engine` was read-write
touched this wave** (`fraud-platform-api`'s Wave 42A audit docs were read as input context only).
No API, database schema, migration, or fraud-engine behavior was changed. No LIVE credential
issuance capability was added. No rate limiting, audit pagination, security headers, or any other
Wave 42A-identified hardening item was touched — all remain exactly as Wave 42A found them,
correctly out of this wave's scope.
