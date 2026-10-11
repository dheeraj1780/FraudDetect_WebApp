import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

/** Wave 46: cookie sessions (no token in browser storage), CSRF echo, and the tenant MFA gate. */
describe("session security", () => {
  it("sends credentials with every request and echoes the CSRF cookie on writes only", async () => {
    document.cookie = "clarion_csrf=csrf-test-value; path=/"
    const seen: Array<{ method: string; csrf: string | null; client: string | null }> = []
    server.use(
      http.post(`${API}/tenants/current/environments/live`, ({ request }) => {
        seen.push({ method: "POST", csrf: request.headers.get("x-csrf-token"), client: request.headers.get("x-clarion-client") })
        return HttpResponse.json(fx.sandboxAndLiveEnvironments[1], { status: 201 })
      }),
      http.get(`${API}/tenants/current/environments`, ({ request }) => {
        seen.push({ method: "GET", csrf: request.headers.get("x-csrf-token"), client: request.headers.get("x-clarion-client") })
        return HttpResponse.json(fx.sandboxOnlyEnvironments)
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/credentials", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: "Provision live environment" }))
    await waitFor(() => expect(seen.some((s) => s.method === "POST")).toBe(true))
    expect(seen.find((s) => s.method === "POST")?.csrf).toBe("csrf-test-value")
    expect(seen.find((s) => s.method === "GET")?.csrf).toBeNull()
    expect(seen.every((s) => s.client === "web")).toBe(true)
    document.cookie = "clarion_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  it("routes a session that still needs its MFA challenge to the MFA page, then into the app", async () => {
    let verified = false
    let challengeBody: unknown = null
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ ...fx.me, mfa_enabled: true, mfa_state: verified ? "verified" : "challenge_required" }),
      ),
      http.post(`${API}/auth/mfa/challenge`, async ({ request }) => {
        challengeBody = await request.json()
        verified = true
        return HttpResponse.json({ mfa_state: "verified", method: "totp" })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Two-factor verification" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Authenticator code"), "123456")
    await user.click(screen.getByRole("button", { name: "Verify" }))
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(challengeBody).toEqual({ code: "123456" })
  })

  it("requires enrollment first when the deployment policy is 'required'", async () => {
    server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ ...fx.me, tenant_mfa_policy: "required" })))
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Set up two-factor authentication" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set up an authenticator app" })).toBeInTheDocument()
  })

  it("offers MFA setup on the settings page", async () => {
    renderApp("/app/settings", { signedIn: true })
    expect(await screen.findByText("Two-factor authentication")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set up an authenticator app" })).toBeInTheDocument()
  })
})
