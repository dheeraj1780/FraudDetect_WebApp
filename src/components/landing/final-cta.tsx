import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { Reveal } from "@/components/animation/reveal"
import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"

export function FinalCta() {
  return (
    <section id="cta" aria-labelledby="cta-heading" className="relative overflow-hidden py-24">
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
      <Container className="relative">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <h2 id="cta-heading" className="text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Bring fraud detection into your security stack.
          </h2>
          <p className="text-[15px] text-fg-muted">
            Create a workspace, issue a sandbox credential and send your first assessment.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">
                Get started
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/signin">Sign in</Link>
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
