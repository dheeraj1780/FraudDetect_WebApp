import type { PolicyThreshold } from "@/lib/api/types"

/** Wave 45: threshold-level differences between two persisted policy versions, keyed by minimum score. */
export type ThresholdDiff =
  | { kind: "added"; minimum_score: number; live: string }
  | { kind: "removed"; minimum_score: number; sandbox: string }
  | { kind: "changed"; minimum_score: number; sandbox: string; live: string }
  | { kind: "same"; minimum_score: number; value: string }

export function diffThresholds(sandbox: PolicyThreshold[], live: PolicyThreshold[]): ThresholdDiff[] {
  const s = new Map(sandbox.map((t) => [t.minimum_score, t.recommendation]))
  const l = new Map(live.map((t) => [t.minimum_score, t.recommendation]))
  const scores = [...new Set([...s.keys(), ...l.keys()])].sort((a, b) => a - b)
  return scores.map((score): ThresholdDiff => {
    const a = s.get(score)
    const b = l.get(score)
    if (a === undefined) return { kind: "added", minimum_score: score, live: b as string }
    if (b === undefined) return { kind: "removed", minimum_score: score, sandbox: a }
    if (a !== b) return { kind: "changed", minimum_score: score, sandbox: a, live: b }
    return { kind: "same", minimum_score: score, value: a }
  })
}
