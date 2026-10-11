import { useEffect, useState } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function"

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => canMatch() && window.matchMedia(QUERY).matches)

  useEffect(() => {
    if (!canMatch()) return
    const mql = window.matchMedia(QUERY)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return reduced
}
