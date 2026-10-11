import { PageHeader } from "@/components/app/page-header"
import { SignalCard } from "@/components/fd/signal-card"
import { Alert } from "@/components/ui/alert"
import { DERIVED_SIGNALS, SUPPLIED_SIGNALS } from "@/data/fraud-detect/signals"
import { Link } from "react-router-dom"

export function Signals() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Signals"
        description="The information we use to spot risk: what you send us, and what we work out from your past payments."
      />

      <Alert variant="info">
        The more of this you send, the more rules can run and the more accurate the score. To see which warning signs
        were found for one payment, open its{" "}
        <Link to="/app/decision-trace" className="text-accent underline-offset-2 hover:underline">
          decision trace
        </Link>
        .
      </Alert>

      <section aria-labelledby="supplied-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="supplied-heading" className="text-sm font-semibold text-fg">
            What you send us
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Parts of each check request. Only the payment itself is required. The rest is optional but helps.
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
            What we work out for you
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Worked out from the payments you told us about before. If there isn&apos;t enough history yet, we say so instead
            of guessing.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DERIVED_SIGNALS.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </ul>
      </section>

    </div>
  )
}
