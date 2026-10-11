# FraudDetect design system

Customer-facing product: **FraudDetect**. Parent ecosystem: **BrandSecOps**.
(Internal names — repository, package and API service names, and the `frauddetect.*` localStorage
keys — are unchanged on purpose; see "Branding" below.)

The visual language is a dark, security-console aesthetic in the BrandSecOps family
(near-black canvas, low-contrast borders, compact technical type, one restrained accent). It is
original to this product: no BrandSecOps source, CSS, assets, copy or logo is reused.

## Tokens

Single source of truth: the `@theme` block in `src/index.css`. Never hardcode a hex value in a
component; use the generated utilities.

| Group | Tokens | Utilities |
|---|---|---|
| Surfaces | `canvas`, `sidebar`, `panel`, `panel-raised`, `panel-hover` | `bg-canvas`, `bg-panel` … |
| Borders | `line`, `line-strong` | `border-line`, `border-line-strong` |
| Text | `fg`, `fg-muted`, `fg-subtle` (all ≥ 4.5:1 on panel surfaces) | `text-fg`, `text-fg-muted` … |
| Accent | `accent`, `accent-strong`, `accent-ink`, `accent-soft` | `text-accent`, `bg-accent` … |
| Severity | `sev-low`, `sev-medium`, `sev-high`, `sev-critical` | `text-sev-high`, `bg-sev-low/10` … |
| Status | `ok`, `warn`, `danger`, `info` | `text-ok`, `border-danger/30` … |
| Shape | `radius-panel` (8px), `radius-control` (6px) | `rounded-panel`, `rounded-control` |
| Type | Inter (UI), JetBrains Mono (ids, codes, numbers) | `font-sans`, `font-mono` |

### Severity is never colour alone

Every severity/status is rendered with **text + a shape cue + colour**:

- `SeverityBadge` / `RiskBadge`: label plus a 4-bar level glyph (1–4 bars filled).
- `RecommendationBadge`: label plus a distinct icon per recommendation.
- `RuleStateBadge`, `EvaluationStateBadge`: label plus icon.

LOW / MEDIUM / HIGH were validated for colour-vision separation on the panel surface with the
dataviz validator (CVD ΔE ≥ 8, normal-vision ≥ 15, contrast ≥ 3:1). Because the LOW↔MEDIUM
separation sits at the floor, the label and glyph are mandatory secondary encoding. CRITICAL is
part of the severity scale but is **never emitted as an engine risk band** (the engine returns
LOW | MEDIUM | HIGH).

## Vocabulary (from the real contract — not invented)

`src/lib/fraud/vocabulary.ts`:

- Risk bands: `LOW | MEDIUM | HIGH`.
- Policy recommendations: `PROCEED | STEP_UP | REVIEW | BLOCK` (shown as Proceed / Step-up /
  Manual review / Block). The older `AUTO_APPROVE / MANUAL_REVIEW / DECLINE_RECOMMENDED` names
  are stale and must not be used.
- Evaluation state: `EVALUATED | PARTIALLY_EVALUATED | NOT_EVALUABLE | NO_APPLICABLE_RULES` — a
  coverage fact, not a risk or confidence measure.
- Rule outcomes (labels only): `TRIGGERED | NOT_TRIGGERED | INSUFFICIENT_DATA | SHADOW`. The public
  response reports triggered rules only.

## Components

```
src/components/
  ui/       Button, Badge, Card, Alert, Input, Select, Dialog, ConfirmDialog, Pagination,
            EmptyState (spinner.tsx: Spinner, LoadingState, Skeleton),
            states.tsx: ErrorState, UnauthorizedState, UnavailableState,
            DataTable (single-DOM: table ≥ md, labelled stacked cards below md)
  app/      AppShell, SidebarNav, Topbar, MobileNavDrawer, PageHeader,
            MetricCard, ChartCard/ChartPlaceholder, charts (RiskActivityChart, BarList)
  fd/       RiskBadge & friends, AssessmentCard, AssessmentDetail, DecisionTrace, RuleCard,
            SignalCard, SampleBadge / SampleDataBanner / SampleToggle, CodeBlock
  layout/   Logo (BrandSecOps › FraudDetect lockup), Navbar, Footer, SiteLayout, SectionHeading
  landing/  Hero, Problem, HowItWorks, Features, ProductSection, Trust, FinalCta, previews
```

### The four non-happy states are distinct

| State | Meaning | Component |
|---|---|---|
| Loading | request in flight | `LoadingState`, `Skeleton`, `MetricCard {kind:"loading"}` |
| Empty | the request worked; there is nothing yet | `EmptyState` |
| Error | the request failed (retryable); 403 → access state | `ErrorState`, `UnauthorizedState` |
| Unavailable | the platform API has no such capability yet | `UnavailableState`, `ChartPlaceholder` |

A failed or unavailable metric is rendered as “—” with a word, **never as 0**.

## Sample data rule

Sample data is opt-in (`?sample=1`, `useSampleMode`), generated locally and deterministically
(`src/lib/fraud/sample.ts`), and always labelled: a `SampleDataBanner` on the page, a
`SampleBadge` on each panel, ids prefixed `sample-`. It is never mixed with API data. Reason
codes in it are real rule codes; scores, counts and times are invented.

## Charts

Inline SVG (no chart library). Thin marks, 2px surface gap between stacked segments, recessive
grid, an always-present legend, per-column hover/focus tooltip, and a “View as table” toggle.
`BarList` always prints label and exact value.

## Branding

- Customer-facing: **FraudDetect** by **BrandSecOps** (`Logo`, `FraudDetectMark`).
- The word “FraudDetect” does not appear in the UI. Internal identifiers are unchanged:
  repositories, Python packages, API service names, and the `frauddetect.session_token` /
  `frauddetect.tenant_id` localStorage keys (renaming those would silently sign users out).
- Copy rules: no “AI-powered”, ML, “100%”, “zero false positives”, “guaranteed”, or “blocks
  every attack”. V1 is deterministic and configurable.

## Motion and accessibility

- Subtle only: hover states, accordion disclosure, metric easing between values (never from 0),
  scroll reveal. `prefers-reduced-motion` is honoured globally and in JS (`useReducedMotion`).
- Skip links, one `h1` per page, labelled landmarks, visible `:focus-visible` outlines,
  `aria-pressed` / `role="switch"` on toggles, announced form errors, Radix dialogs.
