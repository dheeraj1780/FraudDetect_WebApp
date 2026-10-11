/**
 * Rule catalogue index — GENERATED from the frozen V1 catalogue
 * (fraud-engine/docs/rule-catalogue-v1.md). Identity only: rule id, name and
 * family. Deliberately carries NO status, mode, weight, threshold or version:
 * those are engine/tenant configuration, change over time, and are not exposed
 * by fraud-platform-api, so showing them here would be invented data.
 * Do not edit by hand — regenerate from the catalogue.
 */
export interface CatalogueRule {
  id: string
  name: string
}

export interface CatalogueFamily {
  id: string
  catalogueName: string
  rules: CatalogueRule[]
}

export const CATALOGUE_FAMILIES: CatalogueFamily[] = [
  {
    "id": "F1",
    "catalogueName": "Human Behaviour",
    "rules": [
      {
        "id": "F1-BOT-001",
        "name": "Impossible event frequency"
      },
      {
        "id": "F1-BOT-002",
        "name": "Deterministic repeated interaction timing"
      },
      {
        "id": "F1-BOT-003",
        "name": "Repeated identical interaction sequence"
      },
      {
        "id": "F1-FORM-001",
        "name": "Extremely fast form completion"
      },
      {
        "id": "F1-FORM-002",
        "name": "Abnormal form interaction sequence"
      },
      {
        "id": "F1-NAV-001",
        "name": "Repeated refresh/session restart burst"
      },
      {
        "id": "F1-BEH-001",
        "name": "Major behavioural baseline deviation"
      },
      {
        "id": "F1-BEH-002",
        "name": "New device + major behavioural deviation"
      }
    ]
  },
  {
    "id": "F2",
    "catalogueName": "Authentication & Login",
    "rules": [
      {
        "id": "F2-LOGIN-001",
        "name": "Repeated failed login attempts"
      },
      {
        "id": "F2-LOGIN-002",
        "name": "Login burst from one account"
      },
      {
        "id": "F2-LOGIN-003",
        "name": "Credential-stuffing pattern"
      },
      {
        "id": "F2-MFA-001",
        "name": "Repeated MFA failures"
      },
      {
        "id": "F2-MFA-002",
        "name": "MFA method change followed by sensitive action"
      },
      {
        "id": "F2-AUTH-001",
        "name": "Password reset followed by sensitive payment"
      },
      {
        "id": "F2-AUTH-002",
        "name": "Email/phone change followed by sensitive payment"
      },
      {
        "id": "F2-AUTH-003",
        "name": "New login followed quickly by sensitive payment"
      },
      {
        "id": "F2-TOKEN-001",
        "name": "Suspicious refresh-token reuse"
      }
    ]
  },
  {
    "id": "F3",
    "catalogueName": "Device & Identity Relationships",
    "rules": [
      {
        "id": "F3-DEVICE-001",
        "name": "Device associated with multiple accounts"
      },
      {
        "id": "F3-IDENTITY-001",
        "name": "Identity attributes reused across unrelated accounts"
      },
      {
        "id": "F3-PAYID-001",
        "name": "Payment identity associated with multiple identities"
      },
      {
        "id": "F3-CONTACT-001",
        "name": "Phone reused across accounts"
      },
      {
        "id": "F3-CONTACT-002",
        "name": "Email reused across accounts"
      },
      {
        "id": "F3-ADDRESS-001",
        "name": "Address reused across unrelated accounts"
      },
      {
        "id": "F3-IDENTITY-002",
        "name": "Previously confirmed fraudulent identity"
      },
      {
        "id": "F3-IDENTITY-003",
        "name": "Previously suspended identity"
      },
      {
        "id": "F3-CONSIST-001",
        "name": "Identity/payment consistency anomaly"
      }
    ]
  },
  {
    "id": "F4",
    "catalogueName": "Network & IP",
    "rules": [
      {
        "id": "F4-NET-001",
        "name": "VPN detected"
      },
      {
        "id": "F4-NET-002",
        "name": "Proxy detected"
      },
      {
        "id": "F4-NET-003",
        "name": "Tor exit node detected"
      },
      {
        "id": "F4-NET-004",
        "name": "Datacenter/hosting IP"
      },
      {
        "id": "F4-NET-005",
        "name": "High-risk ASN"
      },
      {
        "id": "F4-NET-006",
        "name": "Rapid IP rotation"
      },
      {
        "id": "F4-NET-007",
        "name": "Network change during sensitive flow"
      },
      {
        "id": "F4-NET-008",
        "name": "Excessive requests from one IP"
      }
    ]
  },
  {
    "id": "F5",
    "catalogueName": "Device & Browser",
    "rules": [
      {
        "id": "F5-DEVICE-001",
        "name": "New device for customer"
      },
      {
        "id": "F5-DEVICE-002",
        "name": "Device/browser fingerprint change during sensitive flow"
      },
      {
        "id": "F5-DEVICE-003",
        "name": "Emulator indicator"
      },
      {
        "id": "F5-DEVICE-004",
        "name": "Root/jailbreak indicator"
      },
      {
        "id": "F5-BROWSER-001",
        "name": "Headless/automation indicator"
      },
      {
        "id": "F5-DEVICE-005",
        "name": "Device-farm indicator"
      }
    ]
  },
  {
    "id": "F6",
    "catalogueName": "Transaction & Payment Instrument",
    "rules": [
      {
        "id": "F6-TXN-001",
        "name": "Amount far above customer baseline"
      },
      {
        "id": "F6-TXN-002",
        "name": "First high-value transaction"
      },
      {
        "id": "F6-TXN-004",
        "name": "Unusual payment method"
      },
      {
        "id": "F6-TXN-005",
        "name": "New payment instrument"
      },
      {
        "id": "F6-TXN-006",
        "name": "Payment-instrument consistency anomaly"
      },
      {
        "id": "F6-TXN-007",
        "name": "Unusual beneficiary/destination"
      },
      {
        "id": "F6-TXN-003",
        "name": "Rapid successive transactions"
      },
      {
        "id": "F6-TXN-008",
        "name": "Payment instrument reused across unrelated accounts"
      }
    ]
  },
  {
    "id": "F7",
    "catalogueName": "Merchant & Counterparty",
    "rules": [
      {
        "id": "F7-MER-001",
        "name": "New beneficiary or recipient"
      },
      {
        "id": "F7-MER-002",
        "name": "Beneficiary change followed by transfer"
      },
      {
        "id": "F7-MER-003",
        "name": "Counterparty previously confirmed fraudulent"
      },
      {
        "id": "F7-MER-004",
        "name": "Merchant/recipient risk above threshold"
      }
    ]
  },
  {
    "id": "F8",
    "catalogueName": "Account & Customer",
    "rules": [
      {
        "id": "F8-ACC-001",
        "name": "Dormant account reactivation"
      },
      {
        "id": "F8-ACC-002",
        "name": "Rapid profile/security changes"
      },
      {
        "id": "F8-ACC-003",
        "name": "Repeated disputes/chargebacks"
      },
      {
        "id": "F8-ACC-004",
        "name": "Account risk tier above threshold"
      },
      {
        "id": "F8-ACC-005",
        "name": "Account takeover context signal"
      }
    ]
  },
  {
    "id": "F9",
    "catalogueName": "Velocity & Frequency",
    "rules": [
      {
        "id": "F9-VEL-001",
        "name": "Transactions per account exceed threshold"
      },
      {
        "id": "F9-VEL-002",
        "name": "Failed payments per account exceed threshold"
      },
      {
        "id": "F9-VEL-003",
        "name": "Transactions per device exceed threshold"
      },
      {
        "id": "F9-VEL-004",
        "name": "Accounts per device exceed threshold"
      },
      {
        "id": "F9-VEL-005",
        "name": "Accounts per IP exceed threshold"
      },
      {
        "id": "F9-VEL-006",
        "name": "OTP requests/failures exceed threshold"
      },
      {
        "id": "F9-VEL-007",
        "name": "Beneficiary additions exceed threshold"
      },
      {
        "id": "F9-VEL-008",
        "name": "Burst activity across related entities — requires relationship/graph capability where applicable; do not duplicate graph/relationship scoring"
      }
    ]
  },
  {
    "id": "F10",
    "catalogueName": "Geographic & Location",
    "rules": [
      {
        "id": "F10-GEO-001",
        "name": "Impossible travel"
      },
      {
        "id": "F10-GEO-002",
        "name": "Country/region change during sensitive flow"
      },
      {
        "id": "F10-GEO-003",
        "name": "IP country inconsistent with context"
      },
      {
        "id": "F10-GEO-004",
        "name": "Timezone/locale inconsistency"
      },
      {
        "id": "F10-GEO-005",
        "name": "Location far outside usual location"
      },
      {
        "id": "F10-GEO-006",
        "name": "High-risk/sanctioned-country indicator"
      }
    ]
  }
]
