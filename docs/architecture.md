# Authenticated app architecture

The public Fraud Detect landing page lives at `/`. The authenticated console lives under `/signin`,
`/signup` and `/app/*` and talks to `fraud-platform-api` (`/api/v1`). The frontend stack and the
auth/tenant/API layers below are unchanged by the Fraud Detect redesign (a UI-only change).

## Layers

```
src/lib/api/        typed fetch client + wire types (mirror backend Pydantic schemas 1:1)
  client.ts         the only place that calls fetch; attaches Bearer + X-Tenant-Id; 401 hook
  errors.ts         ApiError; normalizes {code,message} and FastAPI 422 {detail[]}
  endpoints/*.ts    one small typed module per resource
src/lib/auth/       session storage (session.ts), AuthProvider, useAuth, route status
src/lib/query/      React Query client + central query keys
src/hooks/          React Query hooks; pages never call the API directly
src/routes/         guards: RequireAuth -> RequireTenant, GuestRoute
src/components/app/ shell: sidebar, topbar, user menu, mobile drawer, dialogs
src/pages/          auth/* and app/*
```

API base URL: `src/lib/api/config.ts` (`VITE_API_BASE_URL`, default `/api/v1`).
In dev, Vite proxies `/api` to `http://localhost:8000`, so no CORS setup is needed.

## Session handling

- The backend issues an opaque `sess_…` bearer token (no JWT, no refresh). It is stored
  in `localStorage` **only** via `lib/auth/session.ts`.
- Tradeoff: any XSS on this origin could read it. An httpOnly cookie would fix that but
  needs backend/BFF support the API doesn't have today.
- A 401 on any authenticated call clears the session, empties the query cache and routes
  to `/signin`. Login/register calls opt out (a 401 there means bad credentials).
- Passwords, tokens and secrets are never logged. Revealed API secrets exist only in
  component state until the dialog closes; never in storage or URLs.

## Route status model

`AuthStatus`: `loading | signed-out | needs-tenant | tenant-ambiguous | error | ready`.
`RequireAuth` gates on a session; `RequireTenant` gates the shell on a resolved tenant.

## Backend contract notes

- `POST /auth/register` returns the user only (no session) — the UI registers, then logs in.
- A new user has no tenant; every tenant-scoped call returns 400 until one exists.
  `/app/onboarding` uses the real `POST /tenants` to bridge this. The "no tenant" and
  "multiple tenants" cases share one error code, so they are told apart by message text
  (`lib/auth/tenantError.ts`).
- No endpoint lists a user's tenants, so multi-tenant users get an explanatory message
  instead of a switcher.
- Audit logs have no `status` field and no pagination params; the UI shows what exists and
  paginates client-side (`Pagination` is ready for server-side paging).
- `GET /tenants/current/members` returns `user_id` only (no email).
- Only owner/admin may create/rotate/revoke credentials; the UI hides those actions for
  members, and the API remains the authority (403).

## Tests

`npm test` (Vitest + Testing Library + MSW). Handlers in `src/test/server.ts` use response
shapes verified against a live backend.

## Fraud Detect console (Wave 30)

Routes under `/app` (all behind `RequireAuth` → `RequireTenant`, inside `AppShell`):

| Route | Backed by | Notes |
|---|---|---|
| `overview` | credentials, members, audit-logs | real workspace data; assessment metrics show “Not available”; `?sample=1` previews layout |
| `assessments`, `assessments/sample/:id` | none | list is “not available yet”; sample list/detail only with sample data |
| `decision-trace` | none (client-side) | paste a `POST /assessments` response; parsed locally, never stored or sent |
| `transactions`, `cases`, `analytics` | none | unavailable states (cases show a non-functional planned layout) |
| `signals`, `rules`, `policies` | static reference | describe inputs / the frozen catalogue / policy semantics; no live status |
| `api` | credentials | endpoints, auth, examples (placeholders), credential prefixes only |
| `credentials`, `audit-logs`, `settings` | existing endpoints | behaviour and RBAC unchanged |

### Backend contract (what the UI relies on, and what it does not)

- `POST /assessments` and `POST /context-events` are authenticated with an **API credential**
  (`X-Api-Key`), not a browser session, so the console never calls them. `AssessmentOut` is
  mirrored in `lib/api/types.ts` only so a pasted response can be validated and rendered.
- The assessment response exposes **reason codes only**: no rule ids, evidence, thresholds,
  contribution, confidence or telemetry quality. The Decision Trace therefore marks those stages
  “Not returned” rather than inventing them. Rule id / name / family are derived from the reason
  code and the frozen catalogue (`lib/fraud/reason.ts`).
- There is no read/list API for assessments, rules, policies, cases or analytics. Adding one is
  backend work; the UI is ready to consume it (see `lib/fraud/*` and the pages above).
- `src/data/fraud-detect/catalogue.ts` is generated from `fraud-engine/docs/rule-catalogue-v1.md`
  (identity only — id, name, family). It carries no status/weight/threshold on purpose.

### Rules for contributors

1. Never render 0 for a failed or unavailable value — use `MetricCard`/`ErrorState`/`UnavailableState`.
2. Never mix sample data with API data; always render `SampleDataBanner` + `SampleBadge`.
3. Use the real vocabulary in `lib/fraud/vocabulary.ts`.
4. Authorization is the backend's job. Hiding a control is a convenience, never a control.
