import { PageHeader } from "@/components/app/page-header"
import { SignalCard } from "@/components/fd/signal-card"
import { Alert } from "@/components/ui/alert"
import { UnavailableState } from "@/components/ui/states"
import { DERIVED_SIGNALS, SUPPLIED_SIGNALS } from "@/data/fraud-detect/signals"
import { Link } from "react-router-dom"

export function Signals() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Signals"
        description="The evidence Fraud Detect evaluates: what your backend supplies and what the platform derives."
      />

      <Alert variant="info">
        This page describes the <strong className="font-semibold text-fg">inputs</strong> Fraud Detect accepts and
        derives. It doesn&apos;t claim that every catalogue family is active for your tenant — which rules fire for a given
        assessment is shown in its{" "}
        <Link to="/app/decision-trace" className="text-accent underline-offset-2 hover:underline">
          decision trace
        </Link>
        .
      </Alert>

      <section aria-labelledby="supplied-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="supplied-heading" className="text-sm font-semibold text-fg">
            Evidence you supply
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Sections of the <span className="font-mono">POST /assessments</span> request. All are optional except the
            transaction itself.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SUPPLIED_SIGNALS.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="derived-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="derived-heading" className="text-sm font-semibold text-fg">
            Context the platform derives
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Computed by the platform from events you report and prior assessments. Where history is insufficient, a value
            is reported as insufficient — never guessed.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DERIVED_SIGNALS.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="observed-heading" className="flex flex-col gap-3">
        <h2 id="observed-heading" className="text-sm font-semibold text-fg">
          Signals observed on your traffic
        </h2>
        <UnavailableState title="A live signal feed isn't available yet">
          Per-tenant signal activity can&apos;t be read from the API yet. Triggered signals for a single assessment are
          visible in its decision trace.
        </UnavailableState>
      </section>
    </div>
  )
}
