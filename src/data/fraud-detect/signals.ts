/**
 * What FraudDetect actually accepts and derives — taken from fraud-platform-api's request
 * contract (`app/schemas/assessment.py`) and Context Provider (`DerivedContextOut`).
 * This describes INPUTS. It deliberately says nothing about which rules are live, calibrated
 * or firing for a tenant: that is not exposed by the API, so it is not shown.
 */
export type SignalSource = "supplied" | "derived"

export interface SignalDescriptor {
  id: string
  name: string
  source: SignalSource
  summary: string
  /** Plain-language fields, as named in the API contract. */
  fields: string[]
  /** Catalogue families these inputs are relevant to. */
  families: string[]
  /** Extra handling note, e.g. pseudonymisation. */
  note?: string
}

export const SUPPLIED_SIGNALS: SignalDescriptor[] = [
  {
    id: "transaction",
    name: "Transaction",
    source: "supplied",
    summary: "The payment being assessed.",
    fields: ["amount", "currency", "transaction type", "destination (beneficiary reference, country, currency, instrument type)"],
    families: ["F6", "F7"],
    note: "Your own order or transaction number. We keep it so you can match results, but don't use it for scoring.",
  },
  {
    id: "customer",
    name: "Customer",
    source: "supplied",
    summary: "Who is transacting.",
    fields: ["customer reference", "account age (days)", "contact: phone, email, address"],
    families: ["F3", "F8"],
    note: "Email and phone are scrambled before we store them. We never keep the real values.",
  },
  {
    id: "payment-instrument",
    name: "Payment instrument",
    source: "supplied",
    summary: "The instrument used, by token.",
    fields: ["instrument type", "instrument token", "instrument country"],
    families: ["F3", "F6"],
    note: "Send your payment provider's card token. Card numbers and CVV are rejected.",
  },
  {
    id: "authentication",
    name: "Authentication",
    source: "supplied",
    summary: "How the customer authenticated for this attempt.",
    fields: ["method", "result"],
    families: ["F2"],
  },
  {
    id: "device",
    name: "Device",
    source: "supplied",
    summary: "The tenant's device identity for the request.",
    fields: ["device id", "device id source (fingerprint / cookie)"],
    families: ["F3", "F5"],
    note: "Only used if you tell us where the device ID came from.",
  },
  {
    id: "browser",
    name: "Browser",
    source: "supplied",
    summary: "Browser environment.",
    fields: ["user agent", "platform", "languages"],
    families: ["F5"],
  },
  {
    id: "network",
    name: "Network",
    source: "supplied",
    summary: "The network the request arrived from.",
    fields: ["IP address"],
    families: ["F4"],
    note: "IP addresses are scrambled before we store them.",
  },
  {
    id: "geographic",
    name: "Geographic",
    source: "supplied",
    summary: "Location context declared by the tenant.",
    fields: ["billing country", "shipping country"],
    families: ["F10"],
  },
  {
    id: "behavioural",
    name: "Behavioural",
    source: "supplied",
    summary: "Coarse session behaviour.",
    fields: ["session duration", "interaction event count"],
    families: ["F1"],
  },
  {
    id: "device-attestation",
    name: "Device attestation",
    source: "supplied",
    summary: "Integrity indicators reported by the tenant's own SDK.",
    fields: ["emulator indicator", "root / jailbreak indicator", "headless-automation indicator"],
    families: ["F5"],
    note: "We don't scan the device ourselves. We use what you tell us.",
  },
]

export const DERIVED_SIGNALS: SignalDescriptor[] = [
  {
    id: "velocity",
    name: "Velocity",
    source: "derived",
    summary: "Recent authentication-attempt counts per account.",
    fields: ["failed logins (15 min)", "login attempts (5 min)", "MFA failures (15 min)"],
    families: ["F9"],
  },
  {
    id: "authentication-history",
    name: "Authentication history",
    source: "derived",
    summary: "When the customer last authenticated successfully.",
    fields: ["last successful authentication"],
    families: ["F2"],
  },
  {
    id: "account-activity",
    name: "Account activity",
    source: "derived",
    summary: "When the account was last active.",
    fields: ["last active"],
    families: ["F8"],
  },
  {
    id: "amount-baseline",
    name: "Customer amount baseline",
    source: "derived",
    summary: "The customer's typical transaction amounts, from completed payments you report.",
    fields: ["typical amount"],
    families: ["F6"],
  },
  {
    id: "instrument-history",
    name: "Instrument & device history",
    source: "derived",
    summary: "Whether an instrument token or device is new for this customer.",
    fields: ["new instrument token", "new device"],
    families: ["F5", "F6"],
    note: "We only say “new” when we're sure. If there isn't enough history, we say so.",
  },
  {
    id: "relationships",
    name: "Identity relationships",
    source: "derived",
    summary: "How widely a device, instrument or contact value has been seen across accounts.",
    fields: ["accounts per device", "identities per instrument", "accounts per phone / email / address"],
    families: ["F3"],
    note: "How many different accounts share the same detail. Worked out from scrambled values only.",
  },
  {
    id: "account-changes",
    name: "Account change events",
    source: "derived",
    summary: "Recent password, MFA or contact changes reported for the customer.",
    fields: ["change events in window"],
    families: ["F8"],
  },
  {
    id: "flow-history",
    name: "Session-flow history",
    source: "derived",
    summary: "Whether the device or IP changed within one session flow.",
    fields: ["device changed", "distinct IP count"],
    families: ["F4", "F5"],
  },
  {
    id: "beneficiary-history",
    name: "Beneficiary history",
    source: "derived",
    summary: "Whether the beneficiary is new to this customer.",
    fields: ["new to customer", "last beneficiary change"],
    families: ["F7"],
  },
]
