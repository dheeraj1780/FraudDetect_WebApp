# Wave 33B — Overview Real Activity Metric + Audit Log Large-Payload Verification

## 1. Wave Objective

Implement exactly the two frontend-only opportunities Wave 33A's read-only audit identified as safe,
and nothing else: (1) one real, derived (never fabricated) activity metric on Overview, computed
solely from already-fetched audit data; (2) verify — and only fix if a genuine problem is found —
Audit Logs' handling of large `after_json` payloads.

## 2. Wave 33A Findings Used as Baseline

`AuditLogOut`/`audit-logs.tsx` are fully generic (no action-type allowlist); `GET /audit-logs` is
tenant-scoped with a hardcoded `limit=50` and no pagination parameter; Overview's "Your workspace"
section already uses 100% real data; the sample-gated metrics/charts correctly show `unavailable`
rather than fabricated values; Assessments/Policies/Cases/Transactions/Analytics/Platform Admin/
live-environment UI all remain explicitly out of scope.

## 3. Overview Metric Selected

**"Activity today"** — a count of audit-log rows, among those the Overview page already fetches, whose
`occurred_at` falls on today's local calendar date.

## 4. Exact Source Fields/Events Used

The existing `GET /audit-logs` response (`useAuditLogs()`, already called by Overview before this
wave) — specifically each row's `occurred_at` field. No new field, no new query parameter, no new
request. The full, exhaustive set of `action` values this platform ever writes (re-confirmed this
wave by grepping every `write_audit_log(..., action=...)` call site in `fraud-platform-api`):
`collector_token.issued`, `context_event.ingested`, `permission.denied`, `assessment.completed`,
`assessment.failed`, `user.registered`, `user.login_failure`, `user.login_success`, `user.logout`,
`credential.created`, `credential.rotated`, `credential.revoked`, `tenant.created`, and the
`tenant_policy.*` family (unreachable via any route today, per Wave 33A's own finding — these could
never actually appear in a real tenant's log). The metric counts ALL of these together, rather than
filtering to a subset, specifically BECAUSE this mix spans administrative, security, and assessment
events — picking out only one category (e.g. "assessment.completed") would have required asserting a
specific business meaning ("assessment volume") the instructions explicitly forbade inferring.

## 5. Exact Derivation Logic

```ts
const activityToday = useMemo(() => {
  if (!auditQuery.data) return null
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const cutoff = startOfToday.getTime()
  return auditQuery.data.filter((log) => {
    const occurred = Date.parse(log.occurred_at)
    return !Number.isNaN(occurred) && occurred >= cutoff
  }).length
}, [auditQuery.data])
```

`null` while the query is loading or has failed (never a fabricated `0` standing in for "unknown") — a
genuine `0` is only ever shown once the query has actually succeeded and genuinely found no rows for
today. A malformed `occurred_at` (fails `Date.parse`) is never counted, failing closed rather than
throwing or silently miscounting.

## 6. Data/Time Scope

**Today, among the tenant's most recent audit activity (at most the 50 most-recent rows the backend
returns).** This is NOT an all-time count, and NOT guaranteed to be an exhaustive count of literally
every event that occurred today if the tenant had more than 50 total events across today and prior
days combined (the backend's own `limit=50`, unchanged, Wave 33A section 12) — the badge's own tooltip
makes this explicit: *"Audit events recorded for your organization today, among your most recent
activity."*

## 7. Why the Metric Is Not Misleading

It is labeled "Activity today," never "transactions," "assessments," "fraud events," "risk events," or
similar — tested directly (section 13) to confirm none of those words appear anywhere near it. It
never implies revenue, approval rate, fraud rate, or any score. It degrades honestly to no-display
(not a fabricated zero) on loading or error. Its own tooltip states its real, bounded scope rather than
implying an unqualified "all-time" or "complete" count.

## 8. Overview UI Changes

One badge (`<Badge variant="outline">{activityToday} today</Badge>`) added next to the existing
"Recent activity" card's own title, inside the SAME existing card — not a new card, not a new chart,
not a new section. The existing "Your workspace" layout, the existing sample-gated metrics row, and
every other part of Overview are byte-for-byte unchanged.

## 9. Audit Logs Verification

Inspected `src/components/ui/dialog.tsx`'s `DialogContent` (already has
`max-h-[calc(100dvh-2rem)] overflow-y-auto` — bounds the ENTIRE dialog vertically and makes it
scrollable) and `audit-logs.tsx`'s own `JsonRow` (already has `overflow-x-auto` on the container
wrapping `<pre>{JSON.stringify(value, null, 2)}</pre>`, containing horizontal overflow from long
unbroken strings). `JSON.stringify` output is rendered as a plain React text child — never
`dangerouslySetInnerHTML` — so HTML-shaped content inside `after_json`/`before_json` can never be
parsed as markup, by construction, regardless of payload content.

Seven new tests (`src/test/audit-logs-large-payload.test.tsx`) exercised this against: a small
payload, a 200-key payload, a 6-level-deep nested payload, a 2000-character unbroken string, a
500-key payload (dialog-boundedness check), an HTML/script-shaped payload, and a `null` payload — **all
seven passed on the first run, with zero code changes.**

## 10. Whether Large after_json Required a Code Change

**No.** The existing implementation already handles every case tested safely and legibly. Per the
wave's own explicit instruction ("If the current implementation already handles large after_json
safely and acceptably, make NO UI change. Document that verification passed."), no change was made to
`audit-logs.tsx`, `JsonRow`, or `dialog.tsx`.

## 11. Exact Audit Logs UI Change

None. (Section 10.)

## 12. Security/Privacy Review

No secret in any URL, `localStorage`, or `sessionStorage` (neither change touches storage or URLs at
all). No new network request was added anywhere (Overview's metric is a pure client-side computation
over data already fetched by the existing `useAuditLogs()` call). No `tenant_id`/`environment` is sent
by the browser in either change (the Overview metric reads only already-tenant-scoped response data;
the audit-log tests exercise only existing, unmodified rendering). No internal fraud-engine
information, raw credential, or secret is newly exposed — the audit-log viewer remains exactly as
generic as before; `after_json` was already visible pre-wave, and every `write_audit_log` call site
across the backend (re-confirmed by the same grep that produced section 4's list) already excludes
secrets/tokens/raw sensitive values from those JSON blobs, a backend-side discipline this frontend
change does not touch or need to duplicate. No `eval`/`new Function`/`dangerouslySetInnerHTML` was
introduced (none existed before; none exists now). No new tracking or analytics call was added.

## 13. Tests Added/Updated

`src/test/overview-activity-metric.test.tsx` (9 new tests): correct derivation excluding older rows;
honest `0 today` for all-older data; honest `0 today` for zero rows; correct count for multiple
today-events; no metric shown while loading; no metric shown on API failure; label/tooltip accuracy;
a malformed `occurred_at` is never counted; the metric and its surrounding card never use
transaction/assessment/fraud terminology (scoped to the card itself, since the page's own unrelated nav
legitimately contains words like "Transactions"/"Assessments").

`src/test/audit-logs-large-payload.test.tsx` (7 new tests): section 9.

**A genuine test-authoring bug was found and fixed while writing these tests**: an initial
`todayAt(hoursAgo)` helper computed timestamps by subtracting hours from the current wall-clock time,
which can underflow past local midnight depending on when the suite actually runs (e.g. subtracting 5
hours at 2 AM yields a timestamp on the PREVIOUS calendar day) — causing two tests to fail
intermittently depending on time-of-day. Fixed by anchoring timestamps to a fixed, small offset from
midnight instead (`todayAt(minutesAfterMidnight)`), which is unambiguously "today" regardless of when
the suite runs. This is a time-dependent test-flakiness class of bug, caught and corrected before it
could ever reach a real CI run at an inconvenient hour.

No existing test was weakened, skipped, or deleted.

## 14. Full Validation Results

| Suite | Result |
|---|---|
| Vitest (full) | **184 passed**, 0 failed (168 pre-existing + 9 + 7 new) |
| oxlint | clean |
| `tsc -b` (both projects) | clean |
| `vite build` | succeeds |
| Node E2E (`npm run test:e2e`) | **3 passed**, 1 skip-branch (unused) |
| Real-browser E2E (`npm run test:browser`, Chromium) | **5 passed** |
| Route count (`grep -oE 'path="[^"]*"' src/App.tsx \| wc -l`) | **21** — unchanged |

## 15. Files Changed

- `src/pages/app/overview.tsx` — modified (the one metric, section 8)
- `src/test/overview-activity-metric.test.tsx` — new (9 tests)
- `src/test/audit-logs-large-payload.test.tsx` — new (7 tests)
- `fraud-web-app/docs/architecture-decisions/wave33b-overview-audit-log-polish-v1.md` — new (this document)

`test-results/.last-run.json` was also touched, as an automatic Playwright-generated artifact from
running the E2E suite as part of validation (section 14) — not a source-code change, and not something
this wave edited directly. `.gitignore` does not currently exclude this directory; not corrected here
(out of this wave's authorized scope — a one-line housekeeping fix, noted for whenever the Developer/
Sandbox or E2E surface is next touched).

## 16. Explicitly Unchanged Backend Capabilities

`fraud-platform-api` and `fraud-engine` were not opened or modified at all this wave (confirmed: no
Read/Edit/Write call touched either repository this wave beyond the grep used to re-confirm the
exhaustive `action` vocabulary in section 4, which is read-only). No endpoint was added. No API
contract changed. No migration was created. `GET /audit-logs`'s own `limit=50` and lack of pagination
remain exactly as they were. `tests/sandbox_merchant.py` (the abandoned Wave 32 file) was not opened or
touched.

## 17. Known Limitations

"Activity today" can undercount if a tenant generates more than 50 total audit events across today and
earlier combined — the backend's own `limit=50` caps what the frontend ever sees, and this wave did
not and could not change that without a backend change (explicitly out of scope). The metric is
calendar-day-scoped to the BROWSER's own local time zone (via `Date`'s own local-time methods),
consistent with how every other timestamp on this page already renders (`formatDateTime`/`formatTime`
use `toLocaleString`) — not a new inconsistency, but worth naming explicitly since a tenant's staff
could be distributed across time zones.

## 18. Deferred Features

Unchanged from Wave 33A: Assessment listing/detail, Policies UI, Cases, Transactions/Analytics,
Platform Admin, live-environment UI, audit pagination, a collector-status endpoint — none were
implemented, none were newly motivated by this wave's own findings.

## 19. Wave Completion Status

**Complete.** Both items from Wave 33A's authorized scope were addressed: Item 1 implemented (one
real, non-fabricated, clearly-scoped metric); Item 2 verified with no code change required, backed by
7 new tests proving the existing implementation already handles every tested large/deep/malicious
payload shape safely. No scope expansion occurred — every item in the wave's own "NO-SCOPE-EXPANSION"
list was checked against the actual diff and confirmed absent.
