import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

describe("credentials page", () => {
  it("never shows a secret in the list — only key prefix", async () => {
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText("My first key")).toBeInTheDocument()
    expect(screen.getByText(/sk_sandbox_ligpw/)).toBeInTheDocument()
    expect(screen.queryByText(/ONE-TIME-SECRET/)).not.toBeInTheDocument()
  })

  it("shows the returned secret once after creation, with a one-time warning, then discards it", async () => {
    server.use(
      http.post(`${API}/credentials`, () => HttpResponse.json(fx.createdCredential, { status: 201 })),
    )
    const user = userEvent.setup()
    renderApp("/app/credentials", { signedIn: true })

    await user.click(await screen.findByRole("button", { name: "Create credential" }))
    const createDialog = await screen.findByRole("dialog", { name: "Create sandbox credential" })
    await user.click(within(createDialog).getByRole("button", { name: "Create credential" }))

    const reveal = await screen.findByRole("dialog", { name: "Your new API credential" })
    expect(within(reveal).getByText("sk_sandbox_newkey-ONE-TIME-SECRET-VALUE")).toBeInTheDocument()
    expect(within(reveal).getByText("This is shown only once")).toBeInTheDocument()
    const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? "")
    expect(stored.some((value) => value.includes("ONE-TIME-SECRET"))).toBe(false)
    expect(window.location.href).not.toContain("ONE-TIME-SECRET")

    await user.click(within(reveal).getByRole("button", { name: /I've saved this secret/ }))
    expect(screen.queryByText(/ONE-TIME-SECRET/)).not.toBeInTheDocument()
  })

  it("requires confirmation before revoking and does not call the API on cancel", async () => {
    const revokeSpy = vi.fn()
    server.use(
      http.post(`${API}/credentials/${fx.activeCredential.id}/revoke`, () => {
        revokeSpy()
        return HttpResponse.json({ ...fx.activeCredential, status: "revoked" })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/credentials", { signedIn: true })

    await user.click(await screen.findByRole("button", { name: /Revoke credential My first key/ }))
    const dialog = await screen.findByRole("dialog", { name: "Revoke this credential?" })
    expect(revokeSpy).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog", { name: "Revoke this credential?" })).not.toBeInTheDocument()
    expect(revokeSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /Revoke credential My first key/ }))
    const again = await screen.findByRole("dialog", { name: "Revoke this credential?" })
    await user.click(within(again).getByRole("button", { name: "Revoke credential" }))
    await vi.waitFor(() => expect(revokeSpy).toHaveBeenCalledTimes(1))
  })

  it("requires confirmation before rotating, then reveals the new secret", async () => {
    server.use(
      http.post(`${API}/credentials/${fx.activeCredential.id}/rotate`, () =>
        HttpResponse.json(fx.createdCredential),
      ),
    )
    const user = userEvent.setup()
    renderApp("/app/credentials", { signedIn: true })

    await user.click(await screen.findByRole("button", { name: /Rotate credential My first key/ }))
    const confirm = await screen.findByRole("dialog", { name: "Rotate this credential?" })
    await user.click(within(confirm).getByRole("button", { name: "Rotate credential" }))

    expect(await screen.findByText("sk_sandbox_newkey-ONE-TIME-SECRET-VALUE")).toBeInTheDocument()
  })

  it("hides management actions from plain members", async () => {
    server.use(
      http.get(`${API}/tenants/current/members`, () =>
        HttpResponse.json([{ ...fx.ownerMembership, role: "member" }]),
      ),
    )
    renderApp("/app/credentials", { signedIn: true })

    expect(await screen.findByText(/Only owners and admins can create/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Revoke credential/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create credential" })).not.toBeInTheDocument()
  })

  it("shows an empty state when there are no credentials", async () => {
    server.use(http.get(`${API}/credentials`, () => HttpResponse.json([])))
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText("No credentials yet")).toBeInTheDocument()
  })

  it("shows an error state when credentials fail to load", async () => {
    server.use(
      http.get(`${API}/credentials`, () =>
        HttpResponse.json({ code: "ForbiddenError", message: "Nope." }, { status: 403 }),
      ),
    )
    renderApp("/app/credentials", { signedIn: true })
    expect(await screen.findByText(/Couldn't load credentials: Nope\./)).toBeInTheDocument()
  })
})

describe("audit logs and settings states", () => {
  it("lists audit log entries", async () => {
    renderApp("/app/audit-logs", { signedIn: true })
    expect(await screen.findByText("credential.created")).toBeInTheDocument()
  })

  it("shows an empty state with no audit logs", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    expect(await screen.findByText("No activity yet")).toBeInTheDocument()
  })

  it("shows an error state when audit logs fail", async () => {
    server.use(
      http.get(`${API}/audit-logs`, () =>
        HttpResponse.json({ code: "Boom", message: "Server exploded." }, { status: 500 }),
      ),
    )
    renderApp("/app/audit-logs", { signedIn: true })
    expect(await screen.findByText(/Couldn't load audit logs: Server exploded\./)).toBeInTheDocument()
  })

  it("shows tenant and membership info on settings", async () => {
    renderApp("/app/settings", { signedIn: true })
    expect(await screen.findByText(fx.tenant.id)).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Owner")).toBeInTheDocument()
  })
})
