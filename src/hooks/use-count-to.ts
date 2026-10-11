import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

/**
 * Returns `target`, easing between values when it changes. Unlike a count-up from zero it
 * starts AT the target on first render, so a metric is never briefly shown as a misleading 0.
 * Snaps immediately under prefers-reduced-motion.
 */
export function useCountTo(target: number, durationMs = 500) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (reduced || from === target) {
      fromRef.current = target
      const snap = requestAnimationFrame(() => setShown(target))
      return () => cancelAnimationFrame(snap)
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const value = from + (target - from) * (1 - (1 - t) ** 3)
      fromRef.current = value
      setShown(value)
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduced])

  return shown
}
