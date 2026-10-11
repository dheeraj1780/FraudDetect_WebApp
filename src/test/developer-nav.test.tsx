import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderApp } from "@/test/render"

describe("Developer navigation group (Wave 32B)", () => {
  it("renders a Developer group containing API and Sandbox / Collector", async () => {
    renderApp("/app/overview", { signedIn: true })
    const nav = await screen.findByRole("navigation", { name: "Application" })
    const heading = await within(nav).findByText("Developer")
    const group = heading.closest("[role='group']")
    expect(group).not.toBeNull()
    expect(within(group as HTMLElement).getByRole("link", { name: "API" })).toBeInTheDocument()
    expect(within(group as HTMLElement).getByRole("link", { name: "Sandbox / Collector" })).toBeInTheDocument()
  })

  it("neither Developer link is tagged Soon -- both capabilities are real today", async () => {
    renderApp("/app/overview", { signedIn: true })
    const nav = await screen.findByRole("navigation", { name: "Application" })
    const heading = await within(nav).findByText("Developer")
    const group = within(heading.closest("[role='group']") as HTMLElement)
    expect(group.queryByText("Soon")).not.toBeInTheDocument()
  })

  it("the API link is marked active when on /app/api, and the Sandbox link is not", async () => {
    renderApp("/app/api", { signedIn: true })
    const apiLink = await screen.findByRole("link", { name: "API" })
    const sandboxLink = await screen.findByRole("link", { name: "Sandbox / Collector" })
    expect(apiLink).toHaveAttribute("aria-current", "page")
    expect(sandboxLink).not.toHaveAttribute("aria-current")
  })

  it("clicking Sandbox / Collector from the dashboard navigates to the sandbox page", async () => {
    renderApp("/app/overview", { signedIn: true })
    const sandboxLink = await screen.findByRole("link", { name: "Sandbox / Collector" })
    await userEvent.click(sandboxLink)
    expect(await screen.findByText("Sandbox / test functionality")).toBeInTheDocument()
  })

  it("a signed-out visitor to /app/overview never sees the Developer nav at all (redirected to sign in first)", async () => {
    renderApp("/app/overview")
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.queryByText("Developer")).not.toBeInTheDocument()
  })
})

describe("API (Developer) page (Wave 32B)", () => {
  it("renders successfully with the new collector section and a link to the sandbox", async () => {
    renderApp("/app/api", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "API", level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Observing the connecting browser" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: /Open the sandbox collector/i })).toHaveAttribute(
      "href",
      "/sandbox/collector",
    )
  })

  it("documents the collector token endpoint alongside the existing ones", async () => {
    renderApp("/app/api", { signedIn: true })
    expect(await screen.findByText("/api/v1/collector/tokens")).toBeInTheDocument()
  })

  it("still shows the real credentials table (unchanged behavior)", async () => {
    renderApp("/app/api", { signedIn: true })
    expect(await screen.findByText("Your credentials")).toBeInTheDocument()
  })
})

describe("Sandbox collector page navigation continuity (Wave 32B)", () => {
  it("shows a Back to dashboard link when reached from an authenticated session", async () => {
    renderApp("/sandbox/collector", { signedIn: true })
    expect(await screen.findByRole("link", { name: /Back to dashboard/i })).toHaveAttribute("href", "/app/overview")
  })

  it("shows no Back to dashboard link for an anonymous visitor -- the page's own auth boundary is unchanged", async () => {
    renderApp("/sandbox/collector")
    await screen.findByText("Sandbox / test functionality")
    expect(screen.queryByRole("link", { name: /Back to dashboard/i })).not.toBeInTheDocument()
  })

  it("explains what the collector tests and how to obtain a token, without inventing new behavior", async () => {
    renderApp("/sandbox/collector")
    expect(await screen.findByText("What this tests")).toBeInTheDocument()
    expect(screen.getAllByText(/POST \/api\/v1\/collector\/tokens/).length).toBeGreaterThan(0)
  })
})
