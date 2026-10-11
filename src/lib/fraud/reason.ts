import { CATALOGUE_FAMILIES } from "@/data/fraud-detect/catalogue"
import { familyLabel } from "@/data/fraud-detect/families"

const RULE_NAME_BY_ID = new Map(
  CATALOGUE_FAMILIES.flatMap((family) => family.rules.map((rule) => [rule.id, rule.name] as const)),
)

export interface ParsedReason {
  /** The reason_code exactly as the API returned it. */
  code: string
  /** e.g. "F6-TXN-002" — derived from the code prefix; null if the code doesn't follow the pattern. */
  ruleId: string | null
  familyId: string | null
  familyLabel: string | null
  /** Catalogue name for `ruleId`, if that id is in the frozen catalogue. */
  ruleName: string | null
  /** The human-readable tail of the code, e.g. "First high value". */
  summary: string
}

const REASON_PATTERN = /^(F\d{1,2})_([A-Z0-9]+)_(\d{3})_(.+)$/

function humanize(value: string): string {
  const spaced = value.toLowerCase().replace(/_/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Derives display fields from a real `reason_code` (e.g. F6_TXN_002_FIRST_HIGH_VALUE).
 * Everything returned is a pure function of the code and the frozen catalogue — nothing
 * about evidence, thresholds or contribution can be inferred from a reason code, so none
 * is returned.
 */
export function parseReasonCode(code: string): ParsedReason {
  const match = REASON_PATTERN.exec(code)
  if (!match) {
    return { code, ruleId: null, familyId: null, familyLabel: null, ruleName: null, summary: humanize(code) }
  }
  const [, family, group, number, tail] = match
  const ruleId = `${family}-${group}-${number}`
  return {
    code,
    ruleId,
    familyId: family,
    familyLabel: familyLabel(family),
    ruleName: RULE_NAME_BY_ID.get(ruleId) ?? null,
    summary: humanize(tail),
  }
}
