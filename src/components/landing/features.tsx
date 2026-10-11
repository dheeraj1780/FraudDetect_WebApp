import { Reveal } from "@/components/animation/reveal"
import { Container } from "@/components/layout/container"
import { SectionHeading } from "@/components/layout/section-heading"
import { FEATURES } from "@/data/landing"

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-28 border-b border-line py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="features-heading"
            eyebrow="Features"
            title="Built for the people who have to explain the decision."
            description="Detection, policy and investigation designed around explainability and control."
          />
        </Reveal>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} as="li" delay={index * 40} className="flex flex-col gap-3 bg-panel p-5 transition-colors hover:bg-panel-hover">
              <Icon size={18} className="text-accent" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-fg">{title}</h3>
              <p className="text-[13px] leading-relaxed text-fg-muted">{body}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  )
}
