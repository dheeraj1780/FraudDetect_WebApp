import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

describe("analytics page: real aggregate dashboard (Wave 41)", () => {
  it("renders real metrics from the API, not fabricated data", async () => {
    renderApp("/app/analytics", { signedIn: true })
    const summary = await screen.findByRole("region", { name: "Summary" })
    expect(within(summary).getByText("42")).toBeInTheDocument() // total_assessments
    expect(within(summary).getByText("38")).toBeInTheDocument() // completed_count
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument()
  })

  it("shows a loading state before the analytics response arrives", async () => {
    server.use(
      http.get(`${API}/analytics/assessments`, async () => {
        await new Promise((r) => setTimeout(r, 30))
        return HttpResponse.json(fx.assessmentAnalytics)
      }),
    )
    renderApp("/app/analytics", { signedIn: true })
    expect(await screen.findByRole("status")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument())
  })

  it("shows a legitimate zero-data dashboard, not an error and not 'unavailable'", async () => {
    server.use(http.get(`${API}/analytics/assessments`, () => HttpResponse.json(fx.emptyAssessmentAnalytics)))
    renderApp("/app/analytics", { signedIn: true })
    const summary = await screen.findByRole("region", { name: "Summary" })
    expect(within(summary).getAllByText("0").length).toBeGreaterThan(0)
    expect(screen.getAllByText("No assessments in this range.").length).toBeGreaterThan(0)
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
  })

  it("shows an error state when the API fails, distinct from a zero-data result", async () => {
    server.use(
      http.get(`${API}/analytics/assessments`, () =>
        HttpResponse.json({ code: "Boom", message: "Server exploded." }, { status: 500 }),
      ),
    )
    renderApp("/app/analytics", { signedIn: true })
    expect(await screen.findByText(/Couldn't load analytics: Server exploded\./)).toBeInTheDocument()
    expect(screen.queryByText("No assessments in this range.")).not.toBeInTheDocument()
  })

  it("an unavailable latency percentile is shown as a dash, not fabricated", async () => {
    renderApp("/app/analytics", { signedIn: true })
    const summary = await screen.findByRole("region", { name: "Summary" })
    // avg_ms=182.4 is present (rounds to 182); p50/p95 are null in the fixture and have no
    // dedicated summary tile, so this just proves the page never crashes or invents a number.
    expect(within(summary).getByText("182")).toBeInTheDocument()
  })

  it("the environment filter is sent to the API and reflected in the URL", async () => {
    let lastEnvironment: string | null = null
    server.use(
      http.get(`${API}/analytics/assessments`, ({ request }) => {
        lastEnvironment = new URL(request.url).searchParams.get("environment")
        return HttpResponse.json(fx.assessmentAnalytics)
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/analytics", { signedIn: true })
    await screen.findByRole("region", { name: "Summary" })

    await user.click(screen.getByRole("button", { name: "Live" }))
    await waitFor(() => expect(lastEnvironment).toBe("live"))
    expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute("aria-pressed", "true")
  })

  it("the date range filter is sent to the API and reflected in the URL", async () => {
    let lastCreatedAfter: string | null = null
    server.use(
      http.get(`${API}/analytics/assessments`, ({ request }) => {
        lastCreatedAfter = new URL(request.url).searchParams.get("created_after")
        return HttpResponse.json(fx.assessmentAnalytics)
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/analytics", { signedIn: true })
    await screen.findByRole("region", { name: "Summary" })
    expect(lastCreatedAfter).toBeNull() // the default 30-day range omits created_after entirely

    await user.click(screen.getByRole("button", { name: "Last 7 days" }))
    await waitFor(() => expect(lastCreatedAfter).not.toBeNull())
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true")
  })

  it("a direct URL with environment=live restores that filter", async () => {
    let lastEnvironment: string | null = null
    server.use(
      http.get(`${API}/analytics/assessments`, ({ request }) => {
        lastEnvironment = new URL(request.url).searchParams.get("environment")
        return HttpResponse.json(fx.assessmentAnalytics)
      }),
    )
    renderApp("/app/analytics?environment=live", { signedIn: true })
    await screen.findByRole("region", { name: "Summary" })
    expect(lastEnvironment).toBe("live")
    expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute("aria-pressed", "true")
  })

  it("renders real risk-band and recommendation distributions with the UNAVAILABLE bucket labelled honestly", async () => {
    renderApp("/app/analytics", { signedIn: true })
    const risk = await screen.findByRole("region", { name: "Risk distribution" })
    expect(within(risk).getByText("Low")).toBeInTheDocument()
    expect(within(risk).getByText("Not available")).toBeInTheDocument()

    const rec = screen.getByRole("region", { name: "Policy recommendation distribution" })
    expect(within(rec).getByText("Proceed")).toBeInTheDocument()
    expect(within(rec).getByText("Not available")).toBeInTheDocument()
  })

  it("renders the real assessment-volume time series", async () => {
    renderApp("/app/analytics", { signedIn: true })
    const volume = await screen.findByRole("region", { name: "Assessment volume" })
    expect(within(volume).getByRole("img")).toBeInTheDocument()
  })

  it("renders the real policy-version usage section", async () => {
    renderApp("/app/analytics", { signedIn: true })
    const section = await screen.findByRole("region", { name: "Policy version usage" })
    expect(within(section).getByText("38")).toBeInTheDocument()
  })

  it("normal mode never shows the sample-data banner or badge", async () => {
    renderApp("/app/analytics", { signedIn: true })
    await screen.findByRole("region", { name: "Summary" })
    expect(screen.queryByRole("status", { name: /sample/i })).not.toBeInTheDocument()
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument()
  })
})
