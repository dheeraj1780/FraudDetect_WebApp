import { useState } from "react"

/**
 * A "now" captured once per mounted component, so sample timestamps are stable across
 * re-renders (and render stays pure) while still looking recent when the page is opened.
 */
export function useSampleClock(): number {
  const [now] = useState(() => Date.now())
  return now
}
