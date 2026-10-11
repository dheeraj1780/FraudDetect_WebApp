import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger delay in ms, applied via inline transition-delay. */
  delay?: number
  as?: "div" | "li"
}

/**
 * Scroll-reveal wrapper. Renders content fully visible up front when the
 * user prefers reduced motion, or before JS/IntersectionObserver is ready,
 * so content is never hidden behind a script failure.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement | HTMLLIElement>(null)
  const [visible, setVisible] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      const show = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(show)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion])

  const isVisible = reducedMotion || visible
  const revealClassName = cn(
    "transition-[opacity,transform] duration-700 ease-out",
    isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
    className,
  )
  const revealStyle = { transitionDelay: isVisible ? `${delay}ms` : "0ms" }

  if (as === "li") {
    return (
      <li
        ref={ref as RefObject<HTMLLIElement>}
        className={revealClassName}
        style={revealStyle}
      >
        {children}
      </li>
    )
  }

  return (
    <div
      ref={ref as RefObject<HTMLDivElement>}
      className={revealClassName}
      style={revealStyle}
    >
      {children}
    </div>
  )
}
