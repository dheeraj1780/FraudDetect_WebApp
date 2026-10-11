import { ArrowRight, FlaskConical } from "lucide-react"
import { Link } from "react-router-dom"
import { Reveal } from "@/components/animation/reveal"
import { HeroPreview } from "@/components/landing/product-preview"
import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden border-b border-line">
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
      <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-24">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-control border border-line-strong bg-panel px-2.5 py-1 text-xs text-fg-muted">
            <FlaskConical size={12} className="text-warn" aria-hidden="true" />
            Early access · sandbox environment
          </p>
          <h1 id="hero-heading" className="mt-5 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            Fraud Detect
          </h1>
          <p className="mt-3 text-xl font-medium text-accent sm:text-2xl">Real-time fraud detection for modern payments.</p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-fg-muted">
            Detect suspicious transactions, account behavior and fraud patterns with explainable risk intelligence.
            Detect suspicious activity before it becomes a loss.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">
                Get started
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <a href="#product">Explore Fraud Detect</a>
            </Button>
          </div>
          <p className="mt-6 text-xs text-fg-subtle">
            A BrandSecOps security product. Rule- and policy-based — not machine learning.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <HeroPreview />
        </Reveal>
      </Container>
    </section>
  )
}
