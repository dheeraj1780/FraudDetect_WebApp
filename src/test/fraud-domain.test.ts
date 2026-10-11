import { describe, expect, it } from "vitest"
import { CATALOGUE_FAMILIES } from "@/data/fraud-detect/catalogue"
import { parseAssessmentResponse } from "@/lib/fraud/parse-assessment"
import { parseReasonCode } from "@/lib/fraud/reason"
import { sampleAssessments, sampleDetails, summarize } from "@/lib/fraud/sample"
import { asRecommendation, asSeverity, SEVERITY_STYLES } from "@/lib/fraud/vocabulary"

const validResponse = {
  assessment_id: "0b6f6a2e-6a3e-4b2c-9e57-1b6a0d5f7c11",
  status: "completed",
  submitted_at: "2026-09-27T10:15:00.412Z",
  completed_at: "2026-09-27T10:15:00.598Z",
  risk_score: 46.0,
  risk_band: "MEDIUM",
  policy: { status: "EXECUTED", recommendation: "STEP_UP", policy_id: "p1", policy_version: "1" },
  reasons: [{ reason_code: "F6_TXN_006_INSTRUMENT_COUNTRY_MISMATCH" }],
  engine: {
    engine_version: "e1",
    scoring_model_version: "s1",
    scoring_configuration_version: "sc1",
    policy_model_version: "pm1",
  },
  evaluation_state: "EVALUATED",
  idempotent_replay: false,
}

describe("rule catalogue data", () => {
  it("covers all ten families and every rule has an id and a name", () => {
    expect(CATALOGUE_FAMILIES.map((f) => f.id)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"])
    const rules = CATALOGUE_FAMILIES.flatMap((f) => f.rules)
    expect(rules).toHaveLength(71)
    for (const rule of rules) {
      expect(rule.id).toMatch(/^F\d+-[A-Z0-9]+-\d+$/)
      expect(rule.name.length).toBeGreaterThan(0)
    }
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length)
  })

  it("carries no status, weight or threshold — those aren't exposed by the API", () => {
    const keys = new Set(CATALOGUE_FAMILIES.flatMap((f) => f.rules.flatMap((r) => Object.keys(r))))
    expect([...keys].sort()).toEqual(["id", "name"])
  })
})

describe("parseReasonCode", () => {
  it("derives rule id, family and catalogue name from a real reason code", () => {
    const parsed = parseReasonCode("F6_TXN_002_FIRST_HIGH_VALUE")
    expect(parsed.ruleId).toBe("F6-TXN-002")
    expect(parsed.familyId).toBe("F6")
    expect(parsed.familyLabel).toBe("Transaction")
    expect(parsed.summary).toBe("First high value")
    expect(parsed.code).toBe("F6_TXN_002_FIRST_HIGH_VALUE")
  })

  it("does not invent a rule name for a rule id that isn't in the catalogue", () => {
    const parsed = parseReasonCode("F9_VEL_010_FAILED_LOGINS_EXCEED_THRESHOLD")
    expect(parsed.ruleId).toBe("F9-VEL-010")
    expect(parsed.summary).toBe("Failed logins exceed threshold")
  })

  it("degrades gracefully for a code that doesn't follow the pattern", () => {
    const parsed = parseReasonCode("SOMETHING_ELSE")
    expect(parsed.ruleId).toBeNull()
    expect(parsed.familyId).toBeNull()
    expect(parsed.summary).toBe("Something else")
  })
})

describe("parseAssessmentResponse", () => {
  it("accepts a valid AssessmentOut", () => {
    const result = parseAssessmentResponse(JSON.stringify(validResponse))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assessment.risk_score).toBe(46)
      expect(result.assessment.policy.recommendation).toBe("STEP_UP")
      expect(result.assessment.reasons).toEqual([{ reason_code: "F6_TXN_006_INSTRUMENT_COUNTRY_MISMATCH" }])
    }
  })

  it.each([
    ["not JSON", "{oops"],
    ["a JSON array", "[]"],
    ["a missing assessment_id", JSON.stringify({ ...validResponse, assessment_id: undefined })],
    ["a non-completed status", JSON.stringify({ ...validResponse, status: "pending" })],
    ["a bad timestamp", JSON.stringify({ ...validResponse, submitted_at: "yesterday" })],
    ["a string risk_score", JSON.stringify({ ...validResponse, risk_score: "high" })],
    ["a malformed policy", JSON.stringify({ ...validResponse, policy: { status: 1 } })],
    ["malformed reasons", JSON.stringify({ ...validResponse, reasons: ["F6"] })],
    ["a missing engine block", JSON.stringify({ ...validResponse, engine: undefined })],
    ["an unknown evaluation_state", JSON.stringify({ ...validResponse, evaluation_state: "MAYBE" })],
  ])("rejects %s with a reason instead of rendering blanks", (_label, text) => {
    const result = parseAssessmentResponse(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(5)
  })

  it("keeps a null risk_score and null recommendation as null (never coerced to 0 / proceed)", () => {
    const result = parseAssessmentResponse(
      JSON.stringify({
        ...validResponse,
        risk_score: null,
        risk_band: null,
        policy: { status: "NO_POLICY_CONFIGURED", recommendation: null, policy_id: null, policy_version: null },
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assessment.risk_score).toBeNull()
      expect(result.assessment.risk_band).toBeNull()
      expect(result.assessment.policy.recommendation).toBeNull()
    }
  })

  it("tolerates an unknown band value without coercing it", () => {
    const result = parseAssessmentResponse(JSON.stringify({ ...validResponse, risk_band: "EXTREME" }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.assessment.risk_band).toBe("EXTREME")
    expect(asSeverity("EXTREME")).toBeNull()
  })
})

describe("vocabulary", () => {
  it("uses the real policy vocabulary and rejects the stale one", () => {
    for (const value of ["PROCEED", "STEP_UP", "REVIEW", "BLOCK"]) expect(asRecommendation(value)).toBe(value)
    for (const stale of ["AUTO_APPROVE", "MANUAL_REVIEW", "DECLINE_RECOMMENDED"]) expect(asRecommendation(stale)).toBeNull()
  })

  it("gives every severity a distinct level glyph, so colour is never the only cue", () => {
    const levels = Object.values(SEVERITY_STYLES).map((s) => s.level)
    expect(new Set(levels).size).toBe(4)
  })
})

describe("sample data", () => {
  const base = Date.parse("2026-09-27T12:00:00Z")

  it("is deterministic, clearly id-prefixed, and never uses a real-looking id", () => {
    const a = sampleAssessments(base)
    const b = sampleAssessments(base)
    expect(a).toEqual(b)
    expect(a.every((x) => x.assessment_id.startsWith("sample-"))).toBe(true)
    expect(sampleDetails(base).every((d) => d.assessment.assessment_id.startsWith("sample-"))).toBe(true)
  })

  it("only uses the engine's real bands and recommendations", () => {
    for (const a of sampleAssessments(base)) {
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(a.risk_band)
      expect(asRecommendation(a.policy.recommendation)).not.toBeNull()
    }
  })

  it("summarises consistently: bands, recommendations and per-day totals all add up", () => {
    const assessments = sampleAssessments(base)
    const s = summarize(assessments, base)
    expect(s.total).toBe(assessments.length)
    expect(s.byBand.LOW + s.byBand.MEDIUM + s.byBand.HIGH).toBe(s.total)
    expect(Object.values(s.byRecommendation).reduce((n, v) => n + v, 0)).toBe(s.total)
    expect(s.perDay.reduce((n, d) => n + d.total, 0)).toBe(s.total)
  })
})
