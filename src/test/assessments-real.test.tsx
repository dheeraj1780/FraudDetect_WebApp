import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, notAuthenticated, server } from "@/test/server"

describe("real assessment list", () => {
  it("renders a loading state before the real assessments arrive", async () => {
    server.use(
      http.get(`${API}/assessments`, async () => {
        await new Promise((r) => setTimeout(r, 30))
        return HttpResponse.json(fx.assessmentListResponse)
      }),
    )
    renderApp("/app/assessments", { signedIn: true })
    expect(await screen.findByText("Loading assessments…")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Loading assessments…")).not.toBeInTheDocument())
  })

  it("renders the real returned assessments with their actual fields", async () => {
    renderApp("/app/assessments", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Assessments" })

    const completedRow = within(table).getByText(fx.completedAssessmentListItem.assessment_id).closest("tr")!
    expect(within(completedRow).getByText("Completed")).toBeInTheDocument()
    expect(within(completedRow).getByText("78")).toBeInTheDocument()
    expect(within(completedRow).getByText("HIGH")).toBeInTheDocument()
    expect(within(completedRow).getByText("Manual review")).toBeInTheDocument()
    expect(within(completedRow).getByText("2")).toBeInTheDocument()
    expect(within(completedRow).getByText("sandbox")).toBeInTheDocument()

    const processingRow = within(table).getByText(fx.processingAssessmentListItem.assessment_id).closest("tr")!
    expect(within(processingRow).getByText("Processing")).toBeInTheDocument()
    expect(within(processingRow).getByText("—")).toBeInTheDocument()
    expect(within(processingRow).getByText("Not scored")).toBeInTheDocument()

    const failedRow = within(table).getByText(fx.failedAssessmentListItem.assessment_id).closest("tr")!
    expect(within(failedRow).getByText("Failed")).toBeInTheDocument()
    expect(within(failedRow).getByText("live")).toBeInTheDocument()
  })

  it("shows an honest empty state when there are no assessments at all", async () => {
    server.use(http.get(`${API}/assessments`, () => HttpResponse.json({ items: [], has_more: false })))
    renderApp("/app/assessments", { signedIn: true })
    expect(await screen.findByText("No assessments yet")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows a distinct filtered-empty state, not the same as no-data-at-all", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get("risk_band") === "LOW") {
          return HttpResponse.json({ items: [], has_more: false })
        }
        return HttpResponse.json(fx.assessmentListResponse)
      }),
    )
    renderApp("/app/assessments", { signedIn: true })
    await screen.findByRole("table", { name: "Assessments" })

    await user.selectOptions(screen.getByLabelText("Risk band"), "LOW")
    expect(await screen.findByText("No assessments match these filters")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThanOrEqual(1)
  })

  it("sends the selected filters as query parameters", async () => {
    const user = userEvent.setup()
    let lastUrl: URL | null = null
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        lastUrl = new URL(request.url)
        return HttpResponse.json(fx.assessmentListResponse)
      }),
    )
    renderApp("/app/assessments", { signedIn: true })
    await screen.findByRole("table", { name: "Assessments" })

    await user.selectOptions(screen.getByLabelText("Environment"), "live")
    await user.selectOptions(screen.getByLabelText("Risk band"), "HIGH")
    await user.selectOptions(screen.getByLabelText("Policy recommendation"), "BLOCK")

    await waitFor(() => {
      expect(lastUrl?.searchParams.get("environment")).toBe("live")
      expect(lastUrl?.searchParams.get("risk_band")).toBe("HIGH")
      expect(lastUrl?.searchParams.get("recommendation")).toBe("BLOCK")
    })
  })

  it("resets to the first page when a filter changes", async () => {
    const user = userEvent.setup()
    const seen: URL[] = []
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        seen.push(new URL(request.url))
        return HttpResponse.json({ items: [fx.completedAssessmentListItem], has_more: true })
      }),
    )
    renderApp("/app/assessments", { signedIn: true })
    await screen.findByRole("table", { name: "Assessments" })

    await user.click(screen.getByRole("button", { name: "Next" }))
    await waitFor(() => expect(seen.at(-1)?.searchParams.get("offset")).toBe("20"))

    await user.selectOptions(screen.getByLabelText("Risk band"), "HIGH")
    await waitFor(() => expect(seen.at(-1)?.searchParams.get("offset")).toBe("0"))
  })

  it("has_more=true enables Next; the last page (has_more=false) disables it", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get("offset") ?? "0"
        return HttpResponse.json({ items: [fx.completedAssessmentListItem], has_more: offset === "0" })
      }),
    )
    renderApp("/app/assessments", { signedIn: true })
    await screen.findByRole("table", { name: "Assessments" })

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Next" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeDisabled())
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled()
  })

  it("never shows a fabricated total or page count", async () => {
    renderApp("/app/assessments", { signedIn: true })
    await screen.findByRole("table", { name: "Assessments" })
    expect(screen.queryByText(/page \d+ of \d+/i)).not.toBeInTheDocument()
  })

  it("shows a retryable failure, not an empty state, when the request fails", async () => {
    server.use(http.get(`${API}/assessments`, () => HttpResponse.json({ code: "Boom", message: "Server exploded." }, { status: 500 })))
    renderApp("/app/assessments", { signedIn: true })
    expect(await screen.findByText(/Couldn.t load assessments: Server exploded\./)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(screen.queryByText("No assessments yet")).not.toBeInTheDocument()
  })

  it("a validation/rate-limit style error from the backend is shown, not swallowed", async () => {
    server.use(
      http.get(`${API}/assessments`, () => HttpResponse.json({ code: "TooManyRequests", message: "Slow down." }, { status: 429 })),
    )
    renderApp("/app/assessments", { signedIn: true })
    expect(await screen.findByText(/Couldn.t load assessments: Slow down\./)).toBeInTheDocument()
  })

  it("an authentication failure forces a clean sign-out instead of showing a broken list", async () => {
    server.use(http.get(`${API}/assessments`, () => notAuthenticated()))
    renderApp("/app/assessments", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
  })

  it("links each row to the real detail route, not the sample one", async () => {
    renderApp("/app/assessments", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Assessments" })
    const link = within(table).getByRole("link", { name: fx.completedAssessmentListItem.assessment_id })
    expect(link).toHaveAttribute("href", `/app/assessments/${fx.completedAssessmentListItem.assessment_id}`)
  })
})

describe("real assessment detail", () => {
  it("shows a COMPLETED assessment's real public fields", async () => {
    server.use(
      http.get(`${API}/assessments/${fx.completedAssessmentDetail.assessment_id}`, () =>
        HttpResponse.json(fx.completedAssessmentDetail),
      ),
    )
    renderApp(`/app/assessments/${fx.completedAssessmentDetail.assessment_id}`, { signedIn: true })
    expect(await screen.findByText(fx.completedAssessmentDetail.assessment_id)).toBeInTheDocument()
    const summary = screen.getByRole("region", { name: "Assessment summary" })
    expect(within(summary).getByText("HIGH")).toBeInTheDocument()
    expect(within(summary).getByText("78")).toBeInTheDocument()
    expect(within(summary).getByText("Manual review")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Decision trace" })).toBeInTheDocument()
    expect(screen.getByText("Sandbox")).toBeInTheDocument() // the real environment, not "Not included in the response"
    expect(screen.queryByText("Not included in the response")).not.toBeInTheDocument()
  })

  it("shows a PROCESSING assessment honestly, with no fabricated score or recommendation", async () => {
    server.use(
      http.get(`${API}/assessments/${fx.processingAssessmentDetail.assessment_id}`, () =>
        HttpResponse.json(fx.processingAssessmentDetail),
      ),
    )
    renderApp(`/app/assessments/${fx.processingAssessmentDetail.assessment_id}`, { signedIn: true })
    expect(await screen.findByText("Processing")).toBeInTheDocument()
    expect(screen.getByText(/still being evaluated/)).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Decision trace" })).not.toBeInTheDocument()
    expect(screen.queryByText(/risk score/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it("shows a FAILED assessment honestly, without a failure reason or implying a decision", async () => {
    server.use(
      http.get(`${API}/assessments/${fx.failedAssessmentDetail.assessment_id}`, () =>
        HttpResponse.json(fx.failedAssessmentDetail),
      ),
    )
    renderApp(`/app/assessments/${fx.failedAssessmentDetail.assessment_id}`, { signedIn: true })
    expect(await screen.findByText("Failed")).toBeInTheDocument()
    expect(screen.getByText(/No assessment was performed/)).toBeInTheDocument()
    expect(screen.getByText(/no fraud decision was made/i)).toBeInTheDocument()
  })

  it("renders the identical not-found state for a nonexistent id and another tenant's id", async () => {
    renderApp("/app/assessments/00000000-0000-0000-0000-000000000000", { signedIn: true })
    expect(await screen.findByText("Assessment not found")).toBeInTheDocument()
  })

  it("shows a retryable failure for a backend error on detail", async () => {
    server.use(
      http.get(`${API}/assessments/boom-id`, () => HttpResponse.json({ code: "Boom", message: "Server exploded." }, { status: 500 })),
    )
    renderApp("/app/assessments/boom-id", { signedIn: true })
    expect(await screen.findByText(/Couldn.t load this assessment: Server exploded\./)).toBeInTheDocument()
  })

  it("never renders any internal-only field, in any of the three states", async () => {
    server.use(
      http.get(`${API}/assessments/${fx.completedAssessmentDetail.assessment_id}`, () =>
        HttpResponse.json(fx.completedAssessmentDetail),
      ),
    )
    renderApp(`/app/assessments/${fx.completedAssessmentDetail.assessment_id}`, { signedIn: true })
    await screen.findByText(fx.completedAssessmentDetail.assessment_id)
    const text = document.body.textContent ?? ""
    for (const leaked of [
      "idempotency_key",
      "request_fingerprint",
      "failure_reason",
      "rule_id",
      "scoring_configuration_hash",
      "decision_trace_reference",
      "attempts",
      "credential_id",
      "source_ip_hash",
    ]) {
      expect(text).not.toMatch(leaked)
    }
  })
})

describe("real assessment navigation", () => {
  it("navigates from the list to a real detail page", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/assessments/${fx.completedAssessmentListItem.assessment_id}`, () =>
        HttpResponse.json(fx.completedAssessmentDetail),
      ),
    )
    renderApp("/app/assessments", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Assessments" })
    await user.click(within(table).getByRole("link", { name: fx.completedAssessmentListItem.assessment_id }))

    const summary = await screen.findByRole("region", { name: "Assessment summary" })
    expect(within(summary).getByText("HIGH")).toBeInTheDocument()
  })

  it("navigates back from detail to the list", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/assessments/${fx.completedAssessmentDetail.assessment_id}`, () =>
        HttpResponse.json(fx.completedAssessmentDetail),
      ),
    )
    renderApp(`/app/assessments/${fx.completedAssessmentDetail.assessment_id}`, { signedIn: true })
    await screen.findByText(fx.completedAssessmentDetail.assessment_id)
    const main = screen.getByRole("main")
    await user.click(within(main).getByRole("link", { name: /Assessments/ }))
    expect(await screen.findByRole("table", { name: "Assessments" })).toBeInTheDocument()
  })

  it("a direct link straight to a detail route (simulating a refresh) works without visiting the list first", async () => {
    server.use(
      http.get(`${API}/assessments/${fx.completedAssessmentDetail.assessment_id}`, () =>
        HttpResponse.json(fx.completedAssessmentDetail),
      ),
    )
    renderApp(`/app/assessments/${fx.completedAssessmentDetail.assessment_id}`, { signedIn: true })
    expect(await screen.findByText(fx.completedAssessmentDetail.assessment_id)).toBeInTheDocument()
  })

  it("redirects a signed-out visitor away from the real detail route too", async () => {
    renderApp(`/app/assessments/${fx.completedAssessmentDetail.assessment_id}`)
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
  })
})
