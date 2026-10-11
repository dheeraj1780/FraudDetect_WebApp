import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { MemoryRouter, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { App } from "@/App"
import { AuthProvider } from "@/lib/auth/AuthContext"
import { setSignedInHint } from "@/lib/auth/session"
import * as fx from "@/test/fixtures"
import { API, server } from "@/test/server"

/**
 * Wave 36: URL-synchronized assessment list state. `renderApp` (src/test/render.tsx) doesn't expose
 * MemoryRouter's current location, so this file uses its own small harness that renders a sibling
 * `<LocationProbe>` inside the SAME MemoryRouter — it reads the identical shared location via
 * `useLocation()`, letting these tests assert on the exact URL search string, not just on the
 * resulting network request (which assessments-real.test.tsx already covers).
 */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderWithLocationProbe(route: string) {
  setSignedInHint()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <LocationProbe />
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function currentSearch(): string {
  return new URL(`http://test${screen.getByTestId("location").textContent}`).search
}

describe("assessment list URL state", () => {
  it("a direct URL with filters already set restores the same filter selections and query", async () => {
    let lastUrl: URL | null = null
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        lastUrl = new URL(request.url)
        return HttpResponse.json(fx.assessmentListResponse)
      }),
    )
    renderWithLocationProbe("/app/assessments?risk_band=HIGH&environment=live&recommendation=BLOCK")
    await screen.findByRole("table", { name: "Assessments" })

    expect(screen.getByLabelText("Risk band")).toHaveValue("HIGH")
    expect(screen.getByLabelText("Environment")).toHaveValue("live")
    expect(screen.getByLabelText("Policy recommendation")).toHaveValue("BLOCK")
    await waitFor(() => {
      expect(lastUrl?.searchParams.get("risk_band")).toBe("HIGH")
      expect(lastUrl?.searchParams.get("environment")).toBe("live")
      expect(lastUrl?.searchParams.get("recommendation")).toBe("BLOCK")
    })
  })

  it("a direct URL with an offset restores that page, both in the UI and the request", async () => {
    let lastUrl: URL | null = null
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        lastUrl = new URL(request.url)
        return HttpResponse.json({ items: [fx.completedAssessmentListItem], has_more: false })
      }),
    )
    renderWithLocationProbe("/app/assessments?offset=40")
    await screen.findByRole("table", { name: "Assessments" })
    expect(screen.getByText("Showing 41–41")).toBeInTheDocument()
    await waitFor(() => expect(lastUrl?.searchParams.get("offset")).toBe("40"))
  })

  it("changing a filter updates the URL", async () => {
    const user = userEvent.setup()
    renderWithLocationProbe("/app/assessments")
    await screen.findByRole("table", { name: "Assessments" })
    expect(currentSearch()).toBe("")

    await user.selectOptions(screen.getByLabelText("Risk band"), "HIGH")
    await waitFor(() => expect(currentSearch()).toBe("?risk_band=HIGH"))
  })

  it("clearing filters removes every filter param from the URL", async () => {
    const user = userEvent.setup()
    renderWithLocationProbe("/app/assessments?risk_band=HIGH&environment=sandbox")
    await screen.findByRole("table", { name: "Assessments" })
    expect(currentSearch()).toContain("risk_band=HIGH")

    await user.click(screen.getByRole("button", { name: "Clear filters" }))
    await waitFor(() => expect(currentSearch()).toBe(""))
    expect(screen.getByLabelText("Risk band")).toHaveValue("")
    expect(screen.getByLabelText("Environment")).toHaveValue("")
  })

  it("changing a filter resets the offset out of the URL", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get("offset") ?? "0"
        return HttpResponse.json({ items: [fx.completedAssessmentListItem], has_more: offset === "0" })
      }),
    )
    renderWithLocationProbe("/app/assessments?offset=20")
    await screen.findByRole("table", { name: "Assessments" })
    expect(currentSearch()).toContain("offset=20")

    await user.selectOptions(screen.getByLabelText("Risk band"), "LOW")
    await waitFor(() => expect(currentSearch()).not.toContain("offset"))
    expect(currentSearch()).toContain("risk_band=LOW")
  })

  it("pagination Next/Previous update the URL offset, and it round-trips on reload", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get("offset") ?? "0"
        return HttpResponse.json({ items: [fx.completedAssessmentListItem], has_more: offset === "0" })
      }),
    )
    renderWithLocationProbe("/app/assessments")
    await screen.findByRole("table", { name: "Assessments" })
    await user.click(screen.getByRole("button", { name: "Next" }))
    await waitFor(() => expect(currentSearch()).toBe("?offset=20"))

    // "reload": mount fresh at the URL the app just produced.
    const reloaded = renderWithLocationProbe(`/app/assessments${currentSearch()}`)
    await within(reloaded.container).findByRole("table", { name: "Assessments" })
    const probe = within(reloaded.container).getByTestId("location")
    expect(new URL(`http://test${probe.textContent}`).search).toBe("?offset=20")
  })

  it("an invalid filter value in the URL is treated as unset, not sent to the API", async () => {
    let lastUrl: URL | null = null
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        lastUrl = new URL(request.url)
        return HttpResponse.json(fx.assessmentListResponse)
      }),
    )
    renderWithLocationProbe("/app/assessments?risk_band=NOT_A_REAL_BAND&environment=staging")
    await screen.findByRole("table", { name: "Assessments" })
    expect(screen.getByLabelText("Risk band")).toHaveValue("")
    expect(screen.getByLabelText("Environment")).toHaveValue("")
    await waitFor(() => {
      expect(lastUrl?.searchParams.has("risk_band")).toBe(false)
      expect(lastUrl?.searchParams.has("environment")).toBe(false)
    })
  })

  it("a negative or non-numeric offset in the URL is clamped to zero", async () => {
    let lastUrl: URL | null = null
    server.use(
      http.get(`${API}/assessments`, ({ request }) => {
        lastUrl = new URL(request.url)
        return HttpResponse.json(fx.assessmentListResponse)
      }),
    )
    renderWithLocationProbe("/app/assessments?offset=-50")
    await screen.findByRole("table", { name: "Assessments" })
    await waitFor(() => expect(lastUrl?.searchParams.get("offset")).toBe("0"))
  })

  it("no sensitive or internal identifiers appear in the list URL", async () => {
    const user = userEvent.setup()
    renderWithLocationProbe("/app/assessments")
    await screen.findByRole("table", { name: "Assessments" })
    await user.selectOptions(screen.getByLabelText("Risk band"), "HIGH")
    await waitFor(() => expect(currentSearch()).toContain("risk_band"))
    for (const leaked of ["token", "secret", "credential", "sess_", "tenant_id", "assessment_id"]) {
      expect(currentSearch().toLowerCase()).not.toContain(leaked)
    }
  })
})
