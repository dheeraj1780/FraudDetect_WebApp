import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { MetricCard } from "@/components/app/metric-card"
import { AssessmentDetail } from "@/components/fd/assessment-detail"
import { DecisionTrace } from "@/components/fd/decision-trace"
import { RecommendationBadge, RiskBadge, SeverityBadge } from "@/components/fd/risk-badge"
import { DataTable } from "@/components/ui/data-table"
import type { AssessmentOut } from "@/lib/api/types"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

const assessment: AssessmentOut = {
  assessment_id: "a-1234",
  status: "completed",
  submitted_at: "2026-09-27T10:15:00.412Z",
  completed_at: "2026-09-27T10:15:00.598Z",
  risk_score: 78,
  risk_band: "HIGH",
  policy: { status: "EXECUTED", recommendation: "REVIEW", policy_id: "pol-1", policy_version: "3" },
  reasons: [
    { reason_code: "F6_TXN_002_FIRST_HIGH_VALUE" },
    { reason_code: "F6_TXN_006_INSTRUMENT_COUNTRY_MISMATCH" },
  ],
  engine: {
    engine_version: "eng-1",
    scoring_model_version: "score-1",
    scoring_configuration_version: "cfg-1",
    policy_model_version: "pol-model-1",
  },
  evaluation_state: "EVALUATED",
  idempotent_replay: false,
}

describe("risk badges", () => {
  it("shows severity as text and a level glyph, not colour alone", () => {
    const { container } = render(<SeverityBadge severity="HIGH" />)
    expect(screen.getByText("HIGH")).toBeInTheDocument()
    // four glyph bars, three of them filled for HIGH
    const bars = container.querySelectorAll('span[aria-hidden="true"] > span')
    expect(bars).toHaveLength(4)
    expect([...bars].filter((b) => b.className.includes("bg-sev-high"))).toHaveLength(3)
  })

  it("renders an unknown or missing band honestly instead of coercing it to LOW", () => {
    const { rerender } = render(<RiskBadge band="EXTREME" />)
    expect(screen.getByText("EXTREME")).toBeInTheDocument()
    expect(screen.queryByText("LOW")).not.toBeInTheDocument()
    rerender(<RiskBadge band={null} />)
    expect(screen.getByText("Not scored")).toBeInTheDocument()
  })

  it("labels every recommendation and never treats null as proceed", () => {
    const { rerender } = render(<RecommendationBadge value="BLOCK" />)
    expect(screen.getByText("Block")).toBeInTheDocument()
    rerender(<RecommendationBadge value="STEP_UP" />)
    expect(screen.getByText("Step-up")).toBeInTheDocument()
    rerender(<RecommendationBadge value={null} />)
    expect(screen.getByText("No recommendation")).toBeInTheDocument()
    expect(screen.queryByText("Proceed")).not.toBeInTheDocument()
  })
})

describe("MetricCard", () => {
  it("never shows 0 for an unavailable or failed metric", () => {
    const { rerender } = render(<MetricCard label="High risk" state={{ kind: "unavailable" }} />)
    expect(screen.getByText("Not available")).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    rerender(<MetricCard label="High risk" state={{ kind: "error" }} />)
    expect(screen.getByText("Failed to load")).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("shows a real zero when the value really is zero, and flags sample values", () => {
    render(<MetricCard label="Block" state={{ kind: "value", value: 0, sample: true }} />)
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getByText("Sample")).toBeInTheDocument()
    expect(screen.getByTitle("Sample data, not your assessments")).toBeInTheDocument()
  })

  it("announces loading with an accessible name", () => {
    render(<MetricCard label="Assessments" state={{ kind: "loading" }} />)
    expect(screen.getByRole("status", { name: "Loading Assessments" })).toBeInTheDocument()
  })
})

describe("DataTable", () => {
  it("labels each cell with its column header so rows can stack on small screens", () => {
    render(
      <DataTable
        caption="Things"
        rows={[{ id: "1", name: "Alpha" }]}
        getRowKey={(r) => r.id}
        columns={[{ key: "name", header: "Name", cell: (r) => r.name }]}
      />,
    )
    expect(screen.getByRole("table", { name: "Things" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Alpha" })).toHaveAttribute("data-label", "Name")
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument()
  })
})

describe("DecisionTrace", () => {
  it("shows the five stages in order", () => {
    render(<DecisionTrace assessment={assessment} />)
    const titles = ["Received", "Rules", "Score", "Policy", "Recommendation"]
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "")
    titles.forEach((title, i) => expect(headings[i]).toContain(title))
  })

  it("shows only stages the API returns, and invents nothing for them", () => {
    render(<DecisionTrace assessment={assessment} />)
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5)
    for (const hidden of ["Normalization", "Confidence"]) expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    expect(screen.queryByText(/threshold:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/contribution:/i)).not.toBeInTheDocument()
  })

  it("renders each triggered rule from the reason code: id, name, family and TRIGGERED state", () => {
    render(<DecisionTrace assessment={assessment} />)
    const list = screen.getByRole("list", { name: "Triggered rules" })
    const items = within(list).getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText("F6-TXN-002")).toBeInTheDocument()
    expect(within(items[0]).getByText("Transaction")).toBeInTheDocument()
    expect(within(items[0]).getByText("F6_TXN_002_FIRST_HIGH_VALUE")).toBeInTheDocument()
    expect(within(items[0]).getByText("Triggered")).toBeInTheDocument()
  })

  it("labels the rules stage in plain words", () => {
    render(<DecisionTrace assessment={assessment} />)
    expect(screen.getByText("warning signs").previousElementSibling).toHaveTextContent("2")
  })

  it("stages are keyboard-operable disclosures that expand and collapse", async () => {
    const user = userEvent.setup()
    render(<DecisionTrace assessment={assessment} />)
    const trigger = screen.getByRole("button", { name: /Score/ })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    trigger.focus()
    await user.keyboard("{Enter}")
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("score-1")).toBeInTheDocument()
    await user.keyboard("{Enter}")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("explains an empty result honestly when nothing could be evaluated", () => {
    render(
      <DecisionTrace
        assessment={{ ...assessment, reasons: [], risk_score: 0, risk_band: "LOW", evaluation_state: "NOT_EVALUABLE" }}
      />,
    )
    expect(screen.getByText(/this does not mean the payment is safe/)).toBeInTheDocument()
  })

  it("never presents a missing recommendation as proceed", () => {
    render(
      <DecisionTrace
        assessment={{
          ...assessment,
          policy: { status: "NO_POLICY_CONFIGURED", recommendation: null, policy_id: null, policy_version: null },
        }}
      />,
    )
    expect(screen.getByText(/Don.t treat that as “proceed”/)).toBeInTheDocument()
    expect(screen.queryByText("Proceed")).not.toBeInTheDocument()
  })
})

describe("AssessmentDetail", () => {
  it("presents risk and policy recommendation as separate things, with the actual values", () => {
    render(<AssessmentDetail assessment={assessment} />)
    const summary = screen.getByRole("region", { name: "Assessment summary" })
    expect(within(summary).getByText("HIGH")).toBeInTheDocument()
    expect(within(summary).getByText("78")).toBeInTheDocument()
    expect(within(summary).getByText("Manual review")).toBeInTheDocument()
    expect(within(summary).getByText(/Your policy turns it into this recommendation/)).toBeInTheDocument()
  })

  it("does not fill in evidence, telemetry or confidence the API doesn't return", () => {
    render(<AssessmentDetail assessment={assessment} />)
    for (const absent of [/evidence/i, /telemetry/i, /confidence/i]) expect(screen.queryByText(absent)).not.toBeInTheDocument()
  })

  it("lists the reasons that flagged the assessment, with no invented severity per reason", () => {
    render(<AssessmentDetail assessment={assessment} />)
    const flagged = screen.getByRole("heading", { name: "Why it got this score" }).closest("section")!
    expect(within(flagged).getAllByRole("listitem")).toHaveLength(2)
    expect(within(flagged).queryByText("MEDIUM")).not.toBeInTheDocument()
  })

  it("renders untrusted reason codes as text, never as markup", () => {
    const hostile = { ...assessment, reasons: [{ reason_code: "<img src=x onerror=alert(1)>" }] }
    const { container } = render(<AssessmentDetail assessment={hostile} />)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0)
  })

  it("flags an idempotent replay", () => {
    render(<AssessmentDetail assessment={{ ...assessment, idempotent_replay: true }} />)
    expect(screen.getByText("Repeat request")).toBeInTheDocument()
  })
})

describe("dashboard: no data vs failed vs sample", () => {
  it("shows the tenant's real figures from the analytics API, with no sample label by default", async () => {
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    const metrics = screen.getByRole("region", { name: "Key metrics" })
    expect(await within(metrics).findByText("42")).toBeInTheDocument() // total checks
    await waitFor(() => expect(within(metrics).getAllByText("8")).toHaveLength(2)) // high risk, manual review
    expect(within(metrics).getByText("5")).toBeInTheDocument() // block
    expect(within(metrics).queryByText("Not available")).not.toBeInTheDocument()
    expect(screen.queryByText(/^Sample data\./)).not.toBeInTheDocument()
    expect(screen.queryByText("Get started in three steps")).not.toBeInTheDocument()
  })

  it("lists real recent checks and links to the full pages, never sample rows", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.queryByText(/sample-\d{4}/)).not.toBeInTheDocument()
    const rows = await screen.findAllByRole("link", { name: "aaaaaaaa" })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute("href", "/app/assessments/aaaaaaaa-0000-4000-8000-000000000001")
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/app/assessments")
    expect(screen.getByRole("link", { name: "More in Analytics" })).toHaveAttribute("href", "/app/analytics")
  })

  it("shows a getting-started guide when the tenant has sent no checks yet", async () => {
    server.use(
      http.get(`${API}/analytics/assessments`, () => HttpResponse.json(fx.emptyAssessmentAnalytics)),
      http.get(`${API}/assessments`, () => HttpResponse.json({ items: [], has_more: false })),
    )
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText("Get started in three steps")).toBeInTheDocument()
    const guide = screen.getByText("Get started in three steps").closest("div")!.parentElement!
    expect(within(guide).getByRole("link", { name: "Credentials" })).toHaveAttribute("href", "/app/credentials")
    expect(await screen.findByText(/No checks yet/)).toBeInTheDocument()
  })

  it("shows a failed figures load as a failure, never as zero", async () => {
    server.use(http.get(`${API}/analytics/assessments`, () => HttpResponse.json({ code: "Boom", message: "x" }, { status: 500 })))
    renderApp("/app/overview", { signedIn: true })
    const metrics = await screen.findByRole("region", { name: "Key metrics" })
    await waitFor(() => expect(within(metrics).getAllByText("Failed to load")).toHaveLength(5))
    expect(within(metrics).queryByText("0")).not.toBeInTheDocument()
  })

  it("sample mode is opt-in, loudly labelled, and every panel is tagged", async () => {
    renderApp("/app/overview?sample=1", { signedIn: true })
    expect(await screen.findByText(/^Sample data\./)).toBeInTheDocument()
    expect(screen.getByText(/They are not your assessments/)).toBeInTheDocument()
    expect(screen.getAllByText("Sample data").length).toBeGreaterThanOrEqual(4)
    expect(within(screen.getByRole("region", { name: "Key metrics" })).getAllByText("Sample")).toHaveLength(5)
    const metrics = screen.getByRole("region", { name: "Key metrics" })
    expect(within(metrics).queryByText("Not available")).not.toBeInTheDocument()
    expect(screen.getAllByText(/^sample-\d{4}$/).length).toBeGreaterThan(0)
  })

  it("the sample switch is an accessible toggle that adds and removes sample data", async () => {
    const user = userEvent.setup()
    renderApp("/app/overview", { signedIn: true })
    const toggle = await screen.findByRole("switch", { name: "Preview with sample data" })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    await user.click(toggle)
    expect(await screen.findByText(/^Sample data\./)).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Preview with sample data" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("switch", { name: "Preview with sample data" }))
    expect(screen.queryByText(/^Sample data\./)).not.toBeInTheDocument()
  })

  it("keeps real workspace data (organization, credentials) alongside", async () => {
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText("Credentials issued")).toBeInTheDocument()
    expect(screen.getByText("API key created")).toBeInTheDocument()
  })

  it("the global environment badge scopes its claim to credential issuance, never the environment itself (Wave 42B)", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.getByTitle(/To work with real customers, see the LIVE access page/)).toBeInTheDocument()
    expect(screen.queryByTitle(/Live environment isn.t available in this release/)).not.toBeInTheDocument()
  })

  it("describes the live environment accurately: credentials not issuable, never 'not available' (Wave 42B)", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.getByText("Requires LIVE approval")).toBeInTheDocument()
    expect(screen.queryByText("Not available in this release")).not.toBeInTheDocument()
  })

  it("does not show a rule-frequency panel outside sample mode, since the API doesn't expose it", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.queryByText("Rules that fired most")).not.toBeInTheDocument()
  })

  it("shows a failed load as a failure, not as empty", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ code: "Boom", message: "x" }, { status: 500 })))
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText(/Couldn.t load recent activity/)).toBeInTheDocument()
    expect(screen.queryByText(/No activity recorded yet/)).not.toBeInTheDocument()
  })
})

describe("assessments", () => {
  it("loads the real assessment list by default (Wave 34C — no longer an 'unavailable' placeholder)", async () => {
    renderApp("/app/assessments", { signedIn: true })
    expect(await screen.findByRole("table", { name: "Assessments" })).toBeInTheDocument()
    expect(screen.queryByText("Assessment history isn't available yet")).not.toBeInTheDocument()
  })

  it("in sample mode lists labelled sample rows and filters them by real fields only", async () => {
    const user = userEvent.setup()
    renderApp("/app/assessments?sample=1", { signedIn: true })
    expect(await screen.findByRole("table", { name: "Sample assessments" })).toBeInTheDocument()
    expect(screen.getByText(/^Sample data\./)).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /confidence|telemetry|environment/i })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("Risk band"), "HIGH")
    const table = screen.getByRole("table", { name: "Sample assessments" })
    const bands = within(table).getAllByRole("row").slice(1)
    expect(bands.length).toBeGreaterThan(0)
    bands.forEach((row) => expect(within(row).getByText("HIGH")).toBeInTheDocument())
  })

  it("opens a sample assessment with the banner, a sample tag and its decision trace", async () => {
    renderApp("/app/assessments/sample/sample-high", { signedIn: true })
    expect(await screen.findByText("sample-a1f3")).toBeInTheDocument()
    expect(screen.getByText(/They are not your assessments/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Decision trace" })).toBeInTheDocument()
    const summary = screen.getByRole("region", { name: "Assessment summary" })
    expect(within(summary).getByText("Manual review")).toBeInTheDocument()
  })

  it("does not pretend an unknown sample id is an assessment", async () => {
    renderApp("/app/assessments/sample/nope", { signedIn: true })
    expect(await screen.findByText("Sample assessment not found")).toBeInTheDocument()
  })
})

describe("decision trace page", () => {
  const valid = JSON.stringify({
    assessment_id: "pasted-1",
    status: "completed",
    submitted_at: "2026-09-27T10:15:00Z",
    completed_at: "2026-09-27T10:15:01Z",
    risk_score: 12,
    risk_band: "LOW",
    policy: { status: "EXECUTED", recommendation: "PROCEED", policy_id: "p", policy_version: "1" },
    reasons: [],
    engine: { engine_version: "e", scoring_model_version: "s", scoring_configuration_version: "c", policy_model_version: "p" },
    evaluation_state: "EVALUATED",
  })

  it("inspects a pasted response locally and never stores it", async () => {
    const user = userEvent.setup()
    renderApp("/app/decision-trace", { signedIn: true })
    const box = await screen.findByLabelText("Response JSON")
    await user.click(box)
    await user.paste(valid)
    await user.click(screen.getByRole("button", { name: "Explain" }))

    expect(await screen.findByText("pasted-1")).toBeInTheDocument()
    expect(screen.getByText("Pasted response")).toBeInTheDocument()
    expect(screen.getByText(/haven.t checked that it came from your account/)).toBeInTheDocument()
    const stored = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? "")
    expect(stored.some((v) => v.includes("pasted-1"))).toBe(false)
    expect(window.location.href).not.toContain("pasted-1")
  })

  it("rejects bad input with an announced, specific error and shows no assessment", async () => {
    const user = userEvent.setup()
    renderApp("/app/decision-trace", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: "Explain" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Paste a response first.")

    await user.click(screen.getByLabelText("Response JSON"))
    await user.paste("{not json")
    await user.click(screen.getByRole("button", { name: "Explain" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn.t valid JSON/)
    expect(screen.getByLabelText("Response JSON")).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByRole("heading", { name: "Decision trace" })).not.toBeInTheDocument()
  })

  it("loads a clearly-labelled sample and can clear it", async () => {
    const user = userEvent.setup()
    renderApp("/app/decision-trace", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: /Try an example/ }))
    expect(await screen.findByText(/made-up example, not one of your checks/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear" }))
    expect(screen.queryByRole("heading", { name: "Decision trace" })).not.toBeInTheDocument()
  })
})

describe("read-only reference and unavailable pages", () => {
  it("rules: shows the frozen catalogue read-only, filterable, with no edit controls", async () => {
    const user = userEvent.setup()
    renderApp("/app/rules", { signedIn: true })
    expect(await screen.findByRole("table", { name: "Rule catalogue" })).toBeInTheDocument()
    expect(screen.getByText("71 of 71 rules")).toBeInTheDocument()
    expect(screen.getByText(/you can.t change rules\s+here/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /edit|save|enable|disable|delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /weight|threshold|mode/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^Velocity/ }))
    expect(screen.getByText("8 of 71 rules")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Velocity/ })).toHaveAttribute("aria-pressed", "true")

    await user.type(screen.getByLabelText("Search rules by id or name"), "zzzz-nothing")
    expect(await screen.findByText("No rules match")).toBeInTheDocument()
  })

  it.each([
    ["/app/transactions", "This page isn't ready yet"],
    ["/app/cases", "This page isn't ready yet"],
  ])("%s says the feature is unavailable instead of faking data", async (route, message) => {
    renderApp(route, { signedIn: true })
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getAllByText("Not available yet").length).toBeGreaterThan(0)
  })

  it("analytics: sample mode makes no real analytics API call", async () => {
    const user = userEvent.setup()
    let analyticsRequested = false
    server.use(
      http.get(`${API}/analytics/assessments`, () => {
        analyticsRequested = true
        return HttpResponse.json(fx.assessmentAnalytics)
      }),
    )
    renderApp("/app/analytics", { signedIn: true })
    await screen.findByRole("heading", { name: "Analytics" })
    analyticsRequested = false // real mode's own initial load call doesn't count

    await user.click(screen.getByRole("switch", { name: /preview with sample data/i }))
    expect(await screen.findByRole("region", { name: "Volume" })).toBeInTheDocument()
    expect(screen.getAllByText("Sample data").length).toBeGreaterThan(0)
    expect(analyticsRequested).toBe(false)
  })

  it("cases: offers no controls that imply persistence", async () => {
    renderApp("/app/cases", { signedIn: true })
    await screen.findByText("This page isn't ready yet")
    expect(screen.getByText("Planned")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /create|assign|resolve|save|add note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("policies: separates score from action and uses the real vocabulary", async () => {
    renderApp("/app/policies", { signedIn: true })
    expect(await screen.findByText("How a policy works")).toBeInTheDocument()
    for (const value of ["Proceed", "Step-up", "Manual review", "Block"]) expect(screen.getByText(value)).toBeInTheDocument()
    expect(screen.queryByText(/AUTO_APPROVE|DECLINE_RECOMMENDED/)).not.toBeInTheDocument()
    expect(screen.getByText(/The recommendation is advice/)).toBeInTheDocument()
  })

  it("signals: describes inputs and does not claim families are active", async () => {
    renderApp("/app/signals", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "What you send us" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What we work out for you" })).toBeInTheDocument()
    expect(screen.getByText(/we say so instead\s+of guessing/)).toBeInTheDocument()
  })
})

describe("api page", () => {
  it("shows endpoints, auth and examples, and only a credential prefix — never a secret", async () => {
    renderApp("/app/api", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "API" })).toBeInTheDocument()
    expect(screen.getByRole("table", { name: /API endpoints/ })).toBeInTheDocument()
    expect(screen.getAllByText(/X-Api-Key/).length).toBeGreaterThan(0)
    expect(await screen.findByText(/sk_sandbox_ligpw/)).toBeInTheDocument()
    expect(screen.queryByText(/sk_sandbox_[a-z]+-/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/"secret"/)
  })

  it("routes a 403 on credentials to an access state, and a 500 to a retryable failure", async () => {
    server.use(http.get(`${API}/credentials`, () => HttpResponse.json({ code: "ForbiddenError", message: "Nope." }, { status: 403 })))
    const { unmount } = renderApp("/app/api", { signedIn: true })
    expect(await screen.findByText("You don't have access to this")).toBeInTheDocument()
    unmount()

    server.use(http.get(`${API}/credentials`, () => HttpResponse.json({ code: "Boom", message: "Server exploded." }, { status: 500 })))
    renderApp("/app/api", { signedIn: true })
    expect(await screen.findByText("This data failed to load")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(screen.getByText(/Your data is still there/)).toBeInTheDocument()
  })
})

describe("shell, navigation and guards", () => {
  it("shows the grouped FraudDetect navigation and the BrandSecOps → FraudDetect brand", async () => {
    renderApp("/app/overview", { signedIn: true })
    const nav = await screen.findByRole("navigation", { name: "Application" })
    for (const heading of ["Overview", "Checks", "Developer", "Setup"]) {
      expect(within(nav).getByText(heading)).toBeInTheDocument()
    }
    for (const link of ["Dashboard", "Analytics", "Assessments", "Signals", "Rules", "Decision Trace", "Policies", "API", "LIVE access", "Settings"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(`^${link}`) })).toBeInTheDocument()
    }
    // existing functionality stays reachable
    expect(within(nav).getByRole("link", { name: /^Credentials/ })).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: /^Audit log/ })).toBeInTheDocument()
    expect(screen.getAllByText("BrandSecOps").length).toBeGreaterThan(0)
    expect(screen.getAllByText("FraudDetect").length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/FraudDetect/)
  })

  it("keeps pages with no backing API out of the menu, and marks the current page", async () => {
    renderApp("/app/rules", { signedIn: true })
    const nav = await screen.findByRole("navigation", { name: "Application" })
    for (const hidden of [/^Cases/, /^Transactions/]) expect(within(nav).queryByRole("link", { name: hidden })).not.toBeInTheDocument()
    expect(within(nav).queryByText("Soon")).not.toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: /^Rules/ })).toHaveAttribute("aria-current", "page")
  })

  it("has a skip link and a labelled main landmark", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#app-main-content")
    expect(screen.getByRole("main")).toHaveAttribute("id", "app-main-content")
  })

  it.each([
    "/app/assessments",
    "/app/assessments/sample/sample-high",
    "/app/transactions",
    "/app/signals",
    "/app/rules",
    "/app/cases",
    "/app/decision-trace",
    "/app/policies",
    "/app/analytics",
    "/app/api",
  ])("redirects a signed-out visitor from %s to sign in", async (route) => {
    renderApp(route)
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
  })

  it("sends a user with no organization to onboarding from the new routes too", async () => {
    server.use(
      http.get(`${API}/tenants/current`, () =>
        HttpResponse.json({ code: "ValidationAppError", message: "Tenant context required: you do not belong to any tenant yet." }, { status: 400 }),
      ),
    )
    renderApp("/app/signals", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Create your organization" })).toBeInTheDocument()
  })

  it("keeps RBAC: members still cannot manage credentials from the API page's linked screen", async () => {
    server.use(http.get(`${API}/tenants/current/members`, () => HttpResponse.json([{ ...fx.ownerMembership, role: "member" }])))
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText(/Only owners and admins can create/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Rotate credential/ })).not.toBeInTheDocument()
  })

  it("does not read the tenant from anything client-editable: the sample flag can't change identity", async () => {
    renderApp("/app/overview?sample=1&tenant=evil&tenant_id=evil", { signedIn: true })
    expect(await screen.findByText("Acme Retail", { selector: "span" })).toBeInTheDocument()
    expect(screen.queryByText("evil")).not.toBeInTheDocument()
  })
})

describe("public landing page", () => {
  it("presents FraudDetect as a BrandSecOps product, with both calls to action", async () => {
    renderApp("/")
    expect(await screen.findByRole("heading", { level: 1, name: "FraudDetect" })).toBeInTheDocument()
    expect(screen.getByText("Real-time fraud detection for modern payments.")).toBeInTheDocument()
    expect(screen.getAllByText("BrandSecOps").length).toBeGreaterThan(0)
    const hero = screen.getByRole("region", { name: "FraudDetect" })
    expect(within(hero).getByRole("link", { name: /^Get started/ })).toHaveAttribute("href", "/signup")
    expect(within(hero).getByRole("link", { name: "Explore FraudDetect" })).toHaveAttribute("href", "#product")
    expect(screen.getByText("Bring fraud detection into your security stack.")).toBeInTheDocument()
  })

  it("has every specified section", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "FraudDetect" })
    for (const name of [
      "Fraud signals are fragmented.",
      "From payment to action, in one explainable pass.",
      "One console for risk, rules and decisions.",
      "Controls you can inspect, not just trust.",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
    }
    for (const step of ["Payment / Session", "Signal extraction", "Rule evaluation", "Risk score", "Policy", "Action"]) {
      expect(screen.getByRole("heading", { name: step })).toBeInTheDocument()
    }
    for (const feature of [
      "Real-time risk assessment",
      "Explainable signals",
      "Configurable rules",
      "Risk policies",
      "Investigation",
      "Decision trace",
      "Multi-tenant architecture",
      "API-first integration",
    ]) {
      expect(screen.getByRole("heading", { name: feature })).toBeInTheDocument()
    }
  })

  it("labels its product previews as sample data", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "FraudDetect" })
    expect(screen.getByRole("group", { name: /Illustrative product preview/ })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: /Illustrative dashboard preview with sample data/ })).toBeInTheDocument()
    expect(screen.getAllByText("Sample data").length).toBeGreaterThanOrEqual(2)
  })

  it("makes no unsupported claims and brands itself as FraudDetect and never as ML/AI", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "FraudDetect" })
    const text = document.body.textContent ?? ""
    expect(text).toMatch(/FraudDetect/)
    expect(text).not.toMatch(/100%|zero false positives|guaranteed|blocks every|AI-powered|AI powered/i)
    // the only mentions of machine learning are negations
    for (const match of text.matchAll(/machine learning/gi)) {
      const around = text.slice(Math.max(0, match.index - 40), match.index + 30).toLowerCase()
      expect(around).toMatch(/not|never|no /)
    }
  })

  it("shows the BrandSecOps › Security Products › FraudDetect hierarchy without inventing products", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "FraudDetect" })
    expect(screen.getByText("Security Products")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Security Products" })).not.toBeInTheDocument()
  })

  it("has a skip link and marks unavailable footer links as such", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "FraudDetect" })
    expect(screen.getByRole("link", { name: "Skip to content" })).toBeInTheDocument()
    expect(screen.getByText("Privacy policy · soon")).toHaveAttribute("aria-disabled", "true")
  })
})

describe("auth screens", () => {
  it("sign-in and sign-up carry FraudDetect branding", async () => {
    const { unmount } = renderApp("/signin")
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByText("Sign in to FraudDetect.")).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/FraudDetect/)
    unmount()

    renderApp("/signup")
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/FraudDetect/)
  })
})
