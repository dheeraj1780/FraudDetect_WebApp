import { describe, expect, it } from "vitest"
import { checkThresholds } from "@/lib/policy-thresholds"
import type { PolicyThreshold } from "@/lib/api/types"

const rows = (...scores: number[]): PolicyThreshold[] => scores.map((minimum_score) => ({ minimum_score, recommendation: "PROCEED" }))

describe("policy threshold check (plain-language mirror of the API's validation)", () => {
  it("accepts a valid ascending policy that starts at 0", () => {
    expect(checkThresholds(rows(0, 40, 70, 90))).toBeNull()
  })

  it("explains a row that is lower than the one above it (30, 40, 70, 90, 6)", () => {
    expect(checkThresholds(rows(30, 40, 70, 90, 6))).toBe("Row 5 (6) must have a higher score than row 4 (90).")
  })

  it("explains a first row that doesn't start at 0", () => {
    expect(checkThresholds(rows(30, 40, 70, 90))).toBe("The first row must start at 0, so every score gets a recommendation.")
  })

  it("rejects duplicates, out-of-range scores and an empty policy", () => {
    expect(checkThresholds(rows(0, 40, 40))).toMatch(/Row 3 \(40\) must have a higher score/)
    expect(checkThresholds(rows(0, 101))).toBe("Row 2: scores must be between 0 and 100.")
    expect(checkThresholds(rows(-5, 10))).toBe("Row 1: scores must be between 0 and 100.")
    expect(checkThresholds([])).toBe("Add at least one row.")
    expect(checkThresholds(rows(0, Number.NaN))).toBe("Row 2 needs a score.")
  })
})
