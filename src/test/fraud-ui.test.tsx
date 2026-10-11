import { render, screen, within } from "@testing-library/react"
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
    expect(screen.getByTitle("Sample data — not your assessments")).toBeInTheDocument()
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
  it("shows all eight stages in order", () => {
    render(<DecisionTrace assessment={assessment} />)
    const titles = ["Input", "Normalization", "Signals", "Rules", "Score", "Confidence", "Policy", "Recommendation"]
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "")
    titles.forEach((title, i) => expect(headings[i]).toContain(title))
  })

  it("says plainly which stages the API does not return, and invents nothing for them", () => {
    render(<DecisionTrace assessment={assessment} />)
    expect(screen.getAllByText("Not returned")).toHaveLength(3) // normalization, signals, confidence
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

  it("distinguishes all four rule outcomes and states only triggered rules are reported", () => {
    render(<DecisionTrace assessment={assessment} />)
    for (const label of ["Triggered", "Not triggered", "Insufficient data", "Shadow"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/reports triggered rules only/i)).toBeInTheDocument()
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
    expect(screen.getByText(/not the same as “assessed and clean”/)).toBeInTheDocument()
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
    expect(screen.getByText(/never “proceed”/)).toBeInTheDocument()
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
    expect(within(summary).getByText(/score is not the final action/i)).toBeInTheDocument()
  })

  it("marks evidence, telemetry and confidence as not returned rather than filling them in", () => {
    render(<AssessmentDetail assessment={assessment} />)
    expect(screen.getByText(/Rule evidence isn.t returned/)).toBeInTheDocument()
    expect(screen.getByText(/Telemetry quality isn.t returned/)).toBeInTheDocument()
    expect(screen.getByText(/Confidence: not returned/)).toBeInTheDocument()
  })

  it("lists the reasons that flagged the assessment, with no invented severity per reason", () => {
    render(<AssessmentDetail assessment={assessment} />)
    const flagged = screen.getByRole("heading", { name: "Why this assessment was flagged" }).closest("section")!
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
    expect(screen.getByText("Idempotent replay")).toBeInTheDocument()
  })
})

describe("dashboard: no data vs failed vs sample", () => {
  it("shows unavailable metrics — not zeros — and no sample label by default", async () => {
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    const metrics = screen.getByRole("region", { name: "Key metrics" })
    expect(within(metrics).getAllByText("Not available")).toHaveLength(5)
    expect(within(metrics).queryByText("0")).not.toBeInTheDocument()
    expect(screen.queryByText(/^Sample data\./)).not.toBeInTheDocument()
    expect(screen.getByText(/this overview doesn.t show live assessment figures yet/i)).toBeInTheDocument()
  })

  it("does not fabricate risk activity, recent assessments or rules without sample mode, and points to the real pages instead", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.queryByText(/sample-\d{4}/)).not.toBeInTheDocument()
    expect(screen.getByText(/Risk activity isn.t shown on this overview yet/)).toBeInTheDocument()
    expect(screen.queryByText(/Risk activity will appear here once assessment history is available/)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /See real risk trends on Analytics/ })).toHaveAttribute("href", "/app/analytics")
    expect(screen.getByRole("link", { name: /See your real history on Assessments/ })).toHaveAttribute("href", "/app/assessments")
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
    expect(screen.getByText("credential.created")).toBeInTheDocument()
  })

  it("the global environment badge scopes its claim to credential issuance, never the environment itself (Wave 42B)", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.getByTitle(/LIVE credentials require approved LIVE access/)).toBeInTheDocument()
    expect(screen.queryByTitle(/Live environment isn.t available in this release/)).not.toBeInTheDocument()
  })

  it("describes the live environment accurately: credentials not issuable, never 'not available' (Wave 42B)", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.getByText("Requires LIVE approval")).toBeInTheDocument()
    expect(screen.queryByText("Not available in this release")).not.toBeInTheDocument()
  })

  it("states the real reason rule firing frequency isn't shown, not a false 'once assessments can be read' claim (Wave 42B)", async () => {
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.getByText(/Rule firing frequency isn.t exposed by the platform API/)).toBeInTheDocument()
    expect(screen.queryByText(/Rule firing frequency isn.t available until assessments can be read/)).not.toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Inspect" }))

    expect(await screen.findByText("pasted-1")).toBeInTheDocument()
    expect(screen.getByText("Pasted response")).toBeInTheDocument()
    expect(screen.getByText(/hasn.t verified that it came from your account/)).toBeInTheDocument()
    const stored = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? "")
    expect(stored.some((v) => v.includes("pasted-1"))).toBe(false)
    expect(window.location.href).not.toContain("pasted-1")
  })

  it("rejects bad input with an announced, specific error and shows no assessment", async () => {
    const user = userEvent.setup()
    renderApp("/app/decision-trace", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: "Inspect" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Paste an assessment response first.")

    await user.click(screen.getByLabelText("Response JSON"))
    await user.paste("{not json")
    await user.click(screen.getByRole("button", { name: "Inspect" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn.t valid JSON/)
    expect(screen.getByLabelText("Response JSON")).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByRole("heading", { name: "Decision trace" })).not.toBeInTheDocument()
  })

  it("loads a clearly-labelled sample and can clear it", async () => {
    const user = userEvent.setup()
    renderApp("/app/decision-trace", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: /Load a sample/ }))
    expect(await screen.findByText(/illustrative sample assessment, not one of your assessments/)).toBeInTheDocument()
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
    expect(screen.getByText(/aren.t exposed by the platform API yet/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /edit|save|enable|disable|delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /weight|threshold|mode/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^Velocity/ }))
    expect(screen.getByText("8 of 71 rules")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Velocity/ })).toHaveAttribute("aria-pressed", "true")

    await user.type(screen.getByLabelText("Search rules by id or name"), "zzzz-nothing")
    expect(await screen.findByText("No rules match")).toBeInTheDocument()
  })

  it.each([
    ["/app/transactions", "Transactions aren't available yet"],
    ["/app/cases", "Case management isn't available yet"],
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
    await screen.findByText("Case management isn't available yet")
    expect(screen.getByText("Not functional")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /create|assign|resolve|save|add note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("policies: separates score from action and uses the real vocabulary", async () => {
    renderApp("/app/policies", { signedIn: true })
    expect(await screen.findByText("Risk score is not the final customer action.")).toBeInTheDocument()
    for (const value of ["Proceed", "Step-up", "Manual review", "Block"]) expect(screen.getByText(value)).toBeInTheDocument()
    expect(screen.queryByText(/AUTO_APPROVE|DECLINE_RECOMMENDED/)).not.toBeInTheDocument()
    for (const status of ["EXECUTED", "NO_POLICY_CONFIGURED", "POLICY_INVALID", "NOT_EXECUTED"]) {
      expect(screen.getByText(status)).toBeInTheDocument()
    }
  })

  it("signals: describes inputs and does not claim families are active", async () => {
    renderApp("/app/signals", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Evidence you supply" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Context the platform derives" })).toBeInTheDocument()
    expect(screen.getByText(/doesn.t claim that every catalogue family is active/)).toBeInTheDocument()
    expect(screen.getByText("A live signal feed isn't available yet")).toBeInTheDocument()
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
    expect(screen.getByText(/does not mean there is no data/)).toBeInTheDocument()
  })
})

describe("shell, navigation and guards", () => {
  it("shows the grouped Fraud Detect navigation and the BrandSecOps → Fraud Detect brand", async () => {
    renderApp("/app/overview", { signedIn: true })
    const nav = await screen.findByRole("navigation", { name: "Application" })
    for (const heading of ["Overview", "Detection", "Investigation", "Configuration"]) {
      expect(within(nav).getByText(heading)).toBeInTheDocument()
    }
    for (const link of ["Dashboard", "Assessments", "Transactions", "Signals", "Rules", "Cases", "Decision Trace", "Policies", "API", "Settings"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(`^${link}`) })).toBeInTheDocument()
    }
    // existing functionality stays reachable
    expect(within(nav).getByRole("link", { name: /^Credentials/ })).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: /^Audit log/ })).toBeInTheDocument()
    expect(screen.getAllByText("BrandSecOps").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Fraud Detect").length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/clarion/i)
  })

  it("tags pages with no backing API as Soon, and marks the current page", async () => {
    renderApp("/app/rules", { signedIn: true })
    const nav = await screen.findByRole("navigation", { name: "Application" })
    expect(within(nav).getByRole("link", { name: /^Cases/ })).toHaveTextContent("Soon")
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
  it("presents Fraud Detect as a BrandSecOps product, with both calls to action", async () => {
    renderApp("/")
    expect(await screen.findByRole("heading", { level: 1, name: "Fraud Detect" })).toBeInTheDocument()
    expect(screen.getByText("Real-time fraud detection for modern payments.")).toBeInTheDocument()
    expect(screen.getAllByText("BrandSecOps").length).toBeGreaterThan(0)
    const hero = screen.getByRole("region", { name: "Fraud Detect" })
    expect(within(hero).getByRole("link", { name: /^Get started/ })).toHaveAttribute("href", "/signup")
    expect(within(hero).getByRole("link", { name: "Explore Fraud Detect" })).toHaveAttribute("href", "#product")
    expect(screen.getByText("Bring fraud detection into your security stack.")).toBeInTheDocument()
  })

  it("has every specified section", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "Fraud Detect" })
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
    await screen.findByRole("heading", { level: 1, name: "Fraud Detect" })
    expect(screen.getByRole("group", { name: /Illustrative product preview/ })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: /Illustrative dashboard preview with sample data/ })).toBeInTheDocument()
    expect(screen.getAllByText("Sample data").length).toBeGreaterThanOrEqual(2)
  })

  it("makes no unsupported claims and never brands itself as Clarion or as ML/AI", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "Fraud Detect" })
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/clarion/i)
    expect(text).not.toMatch(/100%|zero false positives|guaranteed|blocks every|AI-powered|AI powered/i)
    // the only mentions of machine learning are negations
    for (const match of text.matchAll(/machine learning/gi)) {
      const around = text.slice(Math.max(0, match.index - 40), match.index + 30).toLowerCase()
      expect(around).toMatch(/not|never|no /)
    }
  })

  it("shows the BrandSecOps › Security Products › Fraud Detect hierarchy without inventing products", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "Fraud Detect" })
    expect(screen.getByText("Security Products")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Security Products" })).not.toBeInTheDocument()
  })

  it("has a skip link and marks unavailable footer links as such", async () => {
    renderApp("/")
    await screen.findByRole("heading", { level: 1, name: "Fraud Detect" })
    expect(screen.getByRole("link", { name: "Skip to content" })).toBeInTheDocument()
    expect(screen.getByText("Privacy policy · soon")).toHaveAttribute("aria-disabled", "true")
  })
})

describe("auth screens", () => {
  it("sign-in and sign-up carry Fraud Detect branding, not Clarion", async () => {
    const { unmount } = renderApp("/signin")
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByText("Sign in to Fraud Detect.")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/clarion/i)
    unmount()

    renderApp("/signup")
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/clarion/i)
  })
})
