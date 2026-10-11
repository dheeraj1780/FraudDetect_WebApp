import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

describe("policies page", () => {
  it("shows a loading state before the active policy arrives", async () => {
    server.use(
      http.get(`${API}/policies/active`, async () => {
        await new Promise((r) => setTimeout(r, 30))
        return HttpResponse.json(fx.activePolicyVersion)
      }),
    )
    renderApp("/app/policies", { signedIn: true })
    expect(await screen.findByText("Loading your active policy…")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Loading your active policy…")).not.toBeInTheDocument())
  })

  it("renders the real active policy with its thresholds", async () => {
    server.use(http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)))
    renderApp("/app/policies", { signedIn: true })
    expect(await screen.findByText("Version 2")).toBeInTheDocument()
    const activeSection = screen.getByText("Version 2").closest("section")!
    expect(within(activeSection).getByText("In use")).toBeInTheDocument()
    expect(within(activeSection).getByText("Step-up")).toBeInTheDocument()
    expect(within(activeSection).getByText("Block")).toBeInTheDocument()
  })

  it("shows an honest empty state when there is no active policy", async () => {
    server.use(http.get(`${API}/policies/active`, () => HttpResponse.json(null)))
    renderApp("/app/policies", { signedIn: true })
    const empty = (await screen.findByText("No policy turned on")).closest("div")!
    expect(within(empty).getByText(/no recommendation until you create a policy/)).toBeInTheDocument()
  })

  it("shows version history once a lineage is known, with all three statuses distinguishable", async () => {
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
    )
    renderApp("/app/policies", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Policy version history" })
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText("v1")).toBeInTheDocument()
    expect(within(rows[0]).getByText("Turned off")).toBeInTheDocument()
    expect(within(rows[1]).getByText("v2")).toBeInTheDocument()
    expect(within(rows[1]).getByText("In use")).toBeInTheDocument()
    expect(within(rows[2]).getByText("v3")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Draft")).toBeInTheDocument()
  })

  it("a retryable failure is shown for the active policy, not an empty state", async () => {
    server.use(http.get(`${API}/policies/active`, () => HttpResponse.json({ code: "Boom", message: "Server exploded." }, { status: 500 })))
    renderApp("/app/policies", { signedIn: true })
    expect(await screen.findByText(/Couldn.t load your active policy: Server exploded\./)).toBeInTheDocument()
    expect(screen.queryByText("No policy turned on")).not.toBeInTheDocument()
  })

  it("a retryable failure is shown for version history", async () => {
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json({ code: "Boom", message: "History unavailable." }, { status: 500 })),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")
    expect(await screen.findByText(/Couldn.t load policy version history: History unavailable\./)).toBeInTheDocument()
  })

  it("members cannot see any create or lifecycle controls", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([{ ...fx.ownerMembership, role: "member" }])),
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")
    expect(screen.queryByRole("button", { name: "New policy" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "New draft version" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument()
    expect(screen.getByText(/Owners and admins can create policies/)).toBeInTheDocument()
  })

  it("admins can draft but not activate, retire, or reactivate", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([{ ...fx.ownerMembership, role: "admin" }])),
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")
    expect(screen.getByRole("button", { name: "New policy" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Turn on version 3/ })).not.toBeInTheDocument()
  })

  it("an owner can create a draft and it appears in the workspace", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(null)),
      http.post(`${API}/policies/drafts`, () => HttpResponse.json(fx.draftPolicyVersion, { status: 201 })),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json([fx.draftPolicyVersion])),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("No policy turned on")
    await user.click(screen.getByRole("button", { name: "New policy" }))

    const dialog = await screen.findByRole("dialog", { name: "Create a policy" })
    await user.click(within(dialog).getByRole("button", { name: "Save draft" }))

    expect(await screen.findByRole("table", { name: "Policy version history" })).toBeInTheDocument()
    expect(screen.getByText("v3")).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
  })

  it("shows a validation error inside the draft dialog without closing it", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(null)),
      http.post(`${API}/policies/drafts`, () =>
        HttpResponse.json({ code: "ValidationAppError", message: "unsupported recommendation 'MAYBE'" }, { status: 400 }),
      ),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("No policy turned on")
    await user.click(screen.getByRole("button", { name: "New policy" }))
    const dialog = await screen.findByRole("dialog", { name: "Create a policy" })
    await user.click(within(dialog).getByRole("button", { name: "Save draft" }))

    expect(await within(dialog).findByText(/unsupported recommendation/)).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create a policy" })).toBeInTheDocument()
  })

  it("an owner can activate a draft version via a confirm dialog", async () => {
    const user = userEvent.setup()
    let activateCalled = false
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
      http.post(`${API}/policies/versions/${fx.draftPolicyVersion.id}/activate`, () => {
        activateCalled = true
        return HttpResponse.json({ ...fx.draftPolicyVersion, status: "active" })
      }),
    )
    renderApp("/app/policies", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Policy version history" })
    await user.click(within(table).getByRole("button", { name: /Turn on version 3/ }))

    const dialog = await screen.findByRole("dialog", { name: "Turn on this version?" })
    await user.click(within(dialog).getByRole("button", { name: "Turn on" }))
    await waitFor(() => expect(activateCalled).toBe(true))
  })

  it("an owner can retire the active version via a destructive confirm dialog", async () => {
    const user = userEvent.setup()
    let retireCalled = false
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
      http.post(`${API}/policies/versions/${fx.activePolicyVersion.id}/retire`, () => {
        retireCalled = true
        return HttpResponse.json({ ...fx.activePolicyVersion, status: "retired" })
      }),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")
    await user.click(screen.getByRole("button", { name: "Turn off" }))
    const dialog = await screen.findByRole("dialog", { name: "Turn off this policy?" })
    await user.click(within(dialog).getByRole("button", { name: "Turn off" }))
    await waitFor(() => expect(retireCalled).toBe(true))
  })

  it("an owner can reactivate a retired version", async () => {
    const user = userEvent.setup()
    let reactivateCalled = false
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
      http.post(`${API}/policies/versions/${fx.retiredPolicyVersion.id}/reactivate`, () => {
        reactivateCalled = true
        return HttpResponse.json({ ...fx.retiredPolicyVersion, status: "active" })
      }),
    )
    renderApp("/app/policies", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Policy version history" })
    await user.click(within(table).getByRole("button", { name: /Use version 1 again/ }))
    const dialog = await screen.findByRole("dialog", { name: "Go back to this version?" })
    await user.click(within(dialog).getByRole("button", { name: "Use this version" }))
    await waitFor(() => expect(reactivateCalled).toBe(true))
  })

  it("never renders any internal policy field", async () => {
    server.use(
      http.get(`${API}/policies/active`, () => HttpResponse.json(fx.activePolicyVersion)),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json(fx.policyVersionHistory)),
    )
    renderApp("/app/policies", { signedIn: true })
    await screen.findByText("Version 2")
    const text = document.body.textContent ?? ""
    for (const leaked of ["created_by_user_id", "published_by_user_id", "tenant_id", "environment_id"]) {
      expect(text).not.toMatch(leaked)
    }
  })

  it("explains how a policy works in plain language, with the real vocabulary", async () => {
    renderApp("/app/policies", { signedIn: true })
    expect(await screen.findByText("How a policy works")).toBeInTheDocument()
    for (const value of ["Proceed", "Step-up", "Manual review", "Block"]) {
      expect(screen.getAllByText(value).length).toBeGreaterThan(0)
    }
    expect(screen.getByText("The first row must start at 0, so every score gets an answer.")).toBeInTheDocument()
    expect(screen.getByText(/That never means “proceed”/)).toBeInTheDocument()
  })
})
