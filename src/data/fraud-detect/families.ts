/**
 * Customer-facing names for the ten catalogue families (F1–F10). The catalogue
 * itself (`catalogue.ts`) is generated from the frozen doc; this file only maps
 * each family id to the label and one-line scope used in the UI. No status is
 * implied here — per-rule availability is not exposed by the platform API.
 */
export interface FamilyMeta {
  id: string
  label: string
  scope: string
}

export const FAMILY_META: FamilyMeta[] = [
  { id: "F1", label: "Human Behaviour", scope: "Interaction timing and form behaviour that separates a person from automation." },
  { id: "F2", label: "Authentication", scope: "Login, MFA and credential-change events around a payment." },
  { id: "F3", label: "Identity & Relationships", scope: "Devices, contacts and identity attributes shared across accounts." },
  { id: "F4", label: "Network", scope: "The network and IP context a request arrives from." },
  { id: "F5", label: "Device", scope: "Device and browser consistency and integrity indicators." },
  { id: "F6", label: "Transaction", scope: "Amount, currency and payment-instrument behaviour on the attempt." },
  { id: "F7", label: "Merchant / Beneficiary", scope: "Who the customer is paying and their history with that counterparty." },
  { id: "F8", label: "Account", scope: "Age, history and profile consistency of the customer account." },
  { id: "F9", label: "Velocity", scope: "How quickly activity accumulates across accounts, devices and instruments." },
  { id: "F10", label: "Geography", scope: "Whether the location story of a payment is plausible." },
]

const BY_ID = new Map(FAMILY_META.map((f) => [f.id, f]))

export function familyLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id
}
