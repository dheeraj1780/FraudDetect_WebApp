import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

describe("settings: team members management (Wave 39)", () => {
  it("lists real members with email, not fabricated data", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([fx.ownerMembership, fx.adminMembership])),
    )
    renderApp("/app/settings", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Team members" })
    expect(within(table).getByText(fx.ownerMembership.email!)).toBeInTheDocument()
    expect(within(table).getByText(fx.adminMembership.email!)).toBeInTheDocument()
    expect(screen.queryByText(/sample/i)).not.toBeInTheDocument()
  })

  it("an owner can change another member's role", async () => {
    let patched: unknown
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([fx.ownerMembership, fx.adminMembership])),
      http.patch(`${API}/tenants/current/members/${fx.adminMembership.id}`, async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...fx.adminMembership, role: "member" })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/settings", { signedIn: true })
    await screen.findByText(fx.adminMembership.email!)

    const select = screen.getByLabelText(`Role for ${fx.adminMembership.email}`)
    await user.selectOptions(select, "member")

    expect(patched).toEqual({ role: "member" })
  })

  it("a failed role change shows an error message instead of silently doing nothing", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([fx.ownerMembership, fx.adminMembership])),
      http.patch(`${API}/tenants/current/members/${fx.adminMembership.id}`, () =>
        HttpResponse.json({ code: "ConflictError", message: "Cannot change the role of the tenant's last owner." }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/app/settings", { signedIn: true })
    await screen.findByText(fx.adminMembership.email!)

    await user.selectOptions(screen.getByLabelText(`Role for ${fx.adminMembership.email}`), "owner")
    expect(await screen.findByText("Cannot change the role of the tenant's last owner.")).toBeInTheDocument()
  })

  it("removing a member requires confirmation and does not call the API on cancel", async () => {
    let deleteCalled = false
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([fx.ownerMembership, fx.adminMembership])),
      http.delete(`${API}/tenants/current/members/${fx.adminMembership.id}`, () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/settings", { signedIn: true })
    await screen.findByText(fx.adminMembership.email!)

    await user.click(screen.getByRole("button", { name: `Remove ${fx.adminMembership.email}` }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this member?" })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(deleteCalled).toBe(false)
  })

  it("confirming removal calls the API and the member disappears from the roster", async () => {
    let roster = [fx.ownerMembership, fx.adminMembership]
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json(roster)),
      http.delete(`${API}/tenants/current/members/${fx.adminMembership.id}`, () => {
        roster = [fx.ownerMembership]
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/settings", { signedIn: true })
    await screen.findByText(fx.adminMembership.email!)

    await user.click(screen.getByRole("button", { name: `Remove ${fx.adminMembership.email}` }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this member?" })
    await user.click(within(dialog).getByRole("button", { name: "Remove member" }))

    const table = await screen.findByRole("table", { name: "Team members" })
    await within(table).findByText(fx.ownerMembership.email!)
    expect(within(table).queryByText(fx.adminMembership.email!)).not.toBeInTheDocument()
  })

  it("a failed removal shows the error inside the confirmation dialog, which stays open", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([fx.ownerMembership, fx.adminMembership])),
      http.delete(`${API}/tenants/current/members/${fx.adminMembership.id}`, () =>
        HttpResponse.json({ code: "ForbiddenError", message: "You do not have permission to perform this action." }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/app/settings", { signedIn: true })
    await screen.findByText(fx.adminMembership.email!)

    await user.click(screen.getByRole("button", { name: `Remove ${fx.adminMembership.email}` }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this member?" })
    await user.click(within(dialog).getByRole("button", { name: "Remove member" }))

    expect(await within(dialog).findByText("You do not have permission to perform this action.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Remove this member?" })).toBeInTheDocument()
  })

  it("a non-owner sees the roster read-only, with no role selector or remove controls", async () => {
    const selfAsAdmin = { ...fx.ownerMembership, role: "admin" as const }
    server.use(
      http.get(`${API}/tenants/current/members`, () => HttpResponse.json([selfAsAdmin, fx.adminMembership])),
    )
    renderApp("/app/settings", { signedIn: true })
    const table = await screen.findByRole("table", { name: "Team members" })
    await within(table).findByText(fx.adminMembership.email!)

    expect(screen.getByText("Read-only. Only owners can change roles or remove members.")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument()
  })
})
