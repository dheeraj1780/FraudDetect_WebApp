import { ChevronRight } from "lucide-react"
import { Fragment } from "react"
import { Reveal } from "@/components/animation/reveal"
import { Container } from "@/components/layout/container"
import { SectionHeading } from "@/components/layout/section-heading"
import { FLOW_STEPS } from "@/data/landing"

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-28 border-b border-line bg-sidebar py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="how-heading"
            eyebrow="How it works"
            title="From payment to action, in one explainable pass."
            description="Each step is recorded, so the outcome can be traced back to the signals and rules behind it."
          />
        </Reveal>

        <Reveal delay={100}>
          <ol className="mt-12 flex flex-col gap-2 lg:flex-row lg:items-stretch">
            {FLOW_STEPS.map((step, index) => (
              <Fragment key={step.title}>
                <li className="relative flex flex-1 flex-col gap-3 rounded-panel border border-line bg-panel p-4 transition-colors hover:border-accent/40">
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-control border border-accent/30 bg-accent-soft">
                      <step.icon size={16} className="text-accent" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[11px] text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-fg">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-fg-muted">{step.body}</p>
                </li>
                {index < FLOW_STEPS.length - 1 ? (
                  <li aria-hidden="true" className="flex items-center justify-center text-line-strong max-lg:rotate-90 max-lg:py-0.5">
                    <ChevronRight size={18} />
                  </li>
                ) : null}
              </Fragment>
            ))}
          </ol>
        </Reveal>
      </Container>
    </section>
  )
}
