import type { PolicyThreshold } from "@/lib/api/types"

/** Plain-language version of the API's own validation, so a mistake is explained before saving. */
export function checkThresholds(rows: PolicyThreshold[]): string | null {
  if (rows.length === 0) return "Add at least one row."
  for (const [i, row] of rows.entries()) {
    if (!Number.isFinite(row.minimum_score)) return `Row ${i + 1} needs a score.`
    if (row.minimum_score < 0 || row.minimum_score > 100) return `Row ${i + 1}: scores must be between 0 and 100.`
    if (i > 0 && row.minimum_score <= rows[i - 1].minimum_score)
      return `Row ${i + 1} (${row.minimum_score}) must have a higher score than row ${i} (${rows[i - 1].minimum_score}).`
  }
  if (rows[0].minimum_score !== 0) return "The first row must start at 0, so every score gets a recommendation."
  return null
}
