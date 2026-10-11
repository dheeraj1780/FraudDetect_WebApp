import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

describe("credentials page: live environment provisioning (Wave 40)", () => {
  it("an owner sees a provisioning CTA when only sandbox is provisioned", async () => {
    server.use(http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxOnlyEnvironments)))
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText("You have SANDBOX, which is for testing.", { exact: false })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set up LIVE" })).toBeInTheDocument()
  })

  it("provisioning live updates the card to reflect the new environment, with no fake data", async () => {
    let provisioned = false
    server.use(
      http.get(`${API}/tenants/current/environments`, () =>
        HttpResponse.json(provisioned ? fx.sandboxAndLiveEnvironments : fx.sandboxOnlyEnvironments),
      ),
      http.post(`${API}/tenants/current/environments/live`, () => {
        provisioned = true
        return HttpResponse.json(fx.sandboxAndLiveEnvironments[1], { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/credentials", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: "Set up LIVE" }))

    expect(await screen.findByText(/Keys you create on this page are SANDBOX keys/)).toBeInTheDocument()
    expect(screen.getByText(/LIVE keys are created on the/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set up LIVE" })).not.toBeInTheDocument()
  })

  it("a failed provisioning attempt shows the server's error message", async () => {
    server.use(
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxOnlyEnvironments)),
      http.post(`${API}/tenants/current/environments/live`, () =>
        HttpResponse.json({ code: "ConflictError", message: "A live environment already exists for this tenant." }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/app/credentials", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: "Set up LIVE" }))
    expect(await screen.findByText("A live environment already exists for this tenant.")).toBeInTheDocument()
  })

  it("an admin sees provisioned status but no provisioning control", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([{ ...fx.ownerMembership, role: "admin" as const }])),
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxOnlyEnvironments)),
    )
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText("Only the organization owner can set up LIVE.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set up LIVE" })).not.toBeInTheDocument()
  })

  it("already-provisioned live shows status with no button, for the owner too", async () => {
    server.use(http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxAndLiveEnvironments)))
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText(/Keys you create on this page are SANDBOX keys/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set up LIVE" })).not.toBeInTheDocument()
  })
})

describe("policies page: real environment selection (Wave 40)", () => {
  it("defaults to sandbox and offers a live tab", async () => {
    server.use(http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)))
    renderApp("/app/policies", { signedIn: true })
    const sandboxTab = await screen.findByRole("button", { name: "sandbox" })
    expect(sandboxTab).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "live" })).toHaveAttribute("aria-pressed", "false")
  })

  it("selecting live when it isn't provisioned shows a provisioning prompt, not a generic error", async () => {
    server.use(
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxOnlyEnvironments)),
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
    )
    const user = userEvent.setup()
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")

    await user.click(screen.getByRole("button", { name: "live" }))
    expect(await screen.findByText("LIVE is not set up yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set up LIVE" })).toBeInTheDocument()
    expect(screen.queryByText("Version 2")).not.toBeInTheDocument()
  })

  it("a non-owner sees the provisioning prompt without a provisioning control", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([{ ...fx.ownerMembership, role: "admin" as const }])),
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxOnlyEnvironments)),
    )
    const user = userEvent.setup()
    renderApp("/app/policies", { signedIn: true })
    await screen.findByRole("button", { name: "live" })
    await user.click(screen.getByRole("button", { name: "live" }))
    expect(await screen.findByText("LIVE is not set up yet")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set up LIVE" })).not.toBeInTheDocument()
  })

  it("once live is provisioned, the real live policy UI renders, parameterized correctly", async () => {
    server.use(
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxAndLiveEnvironments)),
      http.get(`${API}/policies/active`, ({ request }) => {
        const env = new URL(request.url).searchParams.get("environment")
        return HttpResponse.json(env === "live" ? null : fx.activePolicyVersion)
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")

    await user.click(screen.getByRole("button", { name: "live" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "live" })).toHaveAttribute("aria-pressed", "true"))
    expect(await screen.findByText("No policy turned on")).toBeInTheDocument()
    const heading = screen.getByRole("heading", { name: "Your live policy" })
    expect(heading).toBeInTheDocument()
  })

  it("the selected environment is reflected in the URL and restored on reload", async () => {
    server.use(
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxAndLiveEnvironments)),
      http.get(`${API}/policies/active`, () => HttpResponse.json(null)),
    )
    renderApp("/app/policies?environment=live", { signedIn: true })
    const liveTab = await screen.findByRole("button", { name: "live" })
    expect(liveTab).toHaveAttribute("aria-pressed", "true")
    expect(await screen.findByRole("heading", { name: "Your live policy" })).toBeInTheDocument()
  })
})
