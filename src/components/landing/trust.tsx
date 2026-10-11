import { Reveal } from "@/components/animation/reveal"
import { Container } from "@/components/layout/container"
import { SectionHeading } from "@/components/layout/section-heading"
import { TRUST_POINTS } from "@/data/landing"

export function Trust() {
  return (
    <section id="security" aria-labelledby="security-heading" className="scroll-mt-28 border-b border-line py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="security-heading"
            eyebrow="Security & trust"
            title="Controls you can inspect, not just trust."
            description="Only what the platform does today, described plainly."
          />
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_POINTS.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} as="li" delay={index * 40} className="rounded-panel border border-line bg-panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-control border border-line-strong bg-panel-raised">
                  <Icon size={16} className="text-accent" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{body}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  )
}
