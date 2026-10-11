import { FinalCta } from "@/components/landing/final-cta"
import { Features } from "@/components/landing/features"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Problem } from "@/components/landing/problem"
import { ProductSection } from "@/components/landing/product-section"
import { Trust } from "@/components/landing/trust"

export function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <ProductSection />
      <Trust />
      <FinalCta />
    </>
  )
}
