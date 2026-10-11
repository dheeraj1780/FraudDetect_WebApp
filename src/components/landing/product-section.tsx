import { Reveal } from "@/components/animation/reveal"
import { DashboardPreview } from "@/components/landing/product-preview"
import { Container } from "@/components/layout/container"
import { SectionHeading } from "@/components/layout/section-heading"

export function ProductSection() {
  return (
    <section id="product" aria-labelledby="product-heading" className="scroll-mt-28 border-b border-line bg-sidebar py-20">
      <Container>
        <Reveal>
          <SectionHeading
            id="product-heading"
            eyebrow="Product"
            title="One console for risk, rules and decisions."
            description="The dashboard below is rendered from the same components as the product, using clearly-labelled sample data, not real assessments."
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <DashboardPreview />
        </Reveal>
      </Container>
    </section>
  )
}
