import { Reveal } from "@/components/animation/reveal"
import { Container } from "@/components/layout/container"
import { SectionHeading } from "@/components/layout/section-heading"
import { SIGNAL_GROUPS } from "@/data/landing"

export function Problem() {
  return (
    <section aria-labelledby="problem-heading" className="border-b border-line py-20">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        <Reveal>
          <SectionHeading
            id="problem-heading"
            eyebrow="The problem"
            title="Fraud signals are fragmented."
            description="Payment, device, account and network data are usually evaluated in separate places, so a suspicious pattern is hard to see and harder to explain. FraudDetect brings them into one explainable risk evaluation."
          />
        </Reveal>
        <Reveal delay={100}>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4">
            {SIGNAL_GROUPS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col gap-3 bg-panel p-4 transition-colors hover:bg-panel-hover">
                <Icon size={18} className="text-accent" aria-hidden="true" />
                <span className="text-[13px] font-medium text-fg">{label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  )
}
