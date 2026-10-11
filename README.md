# fraud-web-app

The customer-facing web app for **Fraud Detect**, a BrandSecOps security product: real-time fraud
detection for payments, accounts and digital transactions. It contains the public landing page,
sign-in / sign-up / onboarding, and the authenticated Fraud Detect console, and it talks to the
sibling `fraud-platform-api` backend.

Fraud Detect V1 is deterministic and configurable (rules + policy). It does not use machine
learning, and the UI must never claim otherwise.

See [`docs/design-system.md`](docs/design-system.md) for tokens, components and copy rules, and
[`docs/architecture.md`](docs/architecture.md) for layers, routes and the backend contract.

## Stack

React 19 + TypeScript + Vite + React Router + TanStack Query + Tailwind CSS v4 + Radix UI
primitives (small shadcn-style layer) + Lucide icons. Charts are inline SVG. Tests: Vitest,
Testing Library, MSW. Lint: oxlint.

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server (Vite proxies /api to http://localhost:8000)
npm run build     # type-check (tsc -b) and build to dist/
npm test          # vitest
npm run lint      # oxlint
```

## What is real and what is not

The platform API currently exposes auth, tenants, members, credentials and audit logs to the
browser. It does **not** expose assessment history, rules, policies, cases, or analytics. Those
screens say so plainly (“Not available yet”) and never show fabricated live data; layouts can be
previewed with clearly labelled sample data (`?sample=1`). See the “Backend contract notes” in
`docs/architecture.md`.
