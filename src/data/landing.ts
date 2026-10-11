import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowLeftRight,
  Building2,
  Code2,
  Eye,
  Fingerprint,
  FolderSearch,
  GitBranch,
  KeyRound,
  ListChecks,
  MapPin,
  Network,
  Radar,
  Scale,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  UserRound,
  Users,
} from "lucide-react"

/**
 * Public-site copy. Every claim here must be true of the code today: V1 is deterministic and
 * configurable (no ML), sandbox-only, and returns reason codes — not rule-level evidence.
 */

export interface NavAnchor {
  label: string
  href: string
}

export const SITE_NAV: NavAnchor[] = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
]

export interface FooterColumn {
  heading: string
  links: { label: string; href: string; comingSoon?: boolean }[]
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "FraudDetect",
    links: [
      { label: "Overview", href: "#product" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Security & trust", href: "#security" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "API-first integration", href: "#features" },
      { label: "Documentation", href: "#", comingSoon: true },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/signin" },
      { label: "Get started", href: "/signup" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "#", comingSoon: true },
      { label: "Terms of service", href: "#", comingSoon: true },
    ],
  },
]

export const SIGNAL_GROUPS: { icon: LucideIcon; label: string }[] = [
  { icon: Activity, label: "Behavioural signals" },
  { icon: KeyRound, label: "Authentication signals" },
  { icon: Fingerprint, label: "Device signals" },
  { icon: Network, label: "Network signals" },
  { icon: Users, label: "Identity relationships" },
  { icon: ArrowLeftRight, label: "Transaction anomalies" },
  { icon: Timer, label: "Velocity" },
  { icon: MapPin, label: "Geography" },
]

export const FLOW_STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Payment / Session", body: "Your backend sends the evidence for one payment or event.", icon: ArrowLeftRight },
  { title: "Signal extraction", body: "Inputs are normalised and combined with history the platform derives.", icon: Radar },
  { title: "Rule evaluation", body: "Configured rules check the signals; triggered rules are recorded.", icon: ListChecks },
  { title: "Risk score", body: "Rule contributions combine into a score and a risk band.", icon: Activity },
  { title: "Policy", body: "Your tenant policy maps the score to a recommendation.", icon: Scale },
  { title: "Action", body: "You receive proceed, step-up, review or block, and decide what to do.", icon: ShieldCheck },
]

export const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Timer,
    title: "Real-time risk assessment",
    body: "One synchronous API call returns a risk score, band and policy recommendation for a payment or event.",
  },
  {
    icon: Eye,
    title: "Explainable signals",
    body: "Every result names the rules that triggered, so analysts can see why, not just a number.",
  },
  {
    icon: SlidersHorizontal,
    title: "Configurable rules",
    body: "A versioned rule catalogue across ten families. Thresholds and weights are configuration, not code.",
  },
  {
    icon: Scale,
    title: "Risk policies",
    body: "Score is separate from action. Tenant policy turns a score into a recommendation you control.",
  },
  {
    icon: FolderSearch,
    title: "Investigation",
    body: "Review triggered signals and reason codes per assessment. A full case workflow is planned.",
  },
  {
    icon: GitBranch,
    title: "Decision trace",
    body: "Follow an assessment from input to recommendation, with engine and policy versions recorded.",
  },
  {
    icon: Building2,
    title: "Multi-tenant architecture",
    body: "Tenants and environments are isolated in the data layer; a credential binds to exactly one of each.",
  },
  {
    icon: Code2,
    title: "API-first integration",
    body: "Integrate with a single authenticated API and idempotent requests. Manage credentials per tenant.",
  },
]

export const TRUST_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Building2,
    title: "Tenant isolation",
    body: "Every assessment, event and policy query is filtered by tenant and environment. Neither is ever taken from a request body.",
  },
  {
    icon: ScrollText,
    title: "Auditability",
    body: "Material actions are written to an audit log, and each assessment records the engine, scoring and policy versions that produced it.",
  },
  {
    icon: Eye,
    title: "Explainable decisions",
    body: "Results carry the reason codes of the rules that triggered, and a coverage state showing how fully rules could be evaluated.",
  },
  {
    icon: SlidersHorizontal,
    title: "Configurable controls",
    body: "Policy thresholds are versioned per tenant and environment, and only an active version is used.",
  },
  {
    icon: KeyRound,
    title: "API security",
    body: "Scoped API credentials with one-time secrets. Raw card data is rejected, and personal identifiers are stored only as keyed pseudonyms.",
  },
  {
    icon: UserRound,
    title: "Deterministic by design",
    body: "V1 is rule- and policy-based. It does not use machine learning, and it never claims to catch every fraud.",
  },
]
