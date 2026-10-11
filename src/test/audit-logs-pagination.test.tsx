import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

/** Wave 45: GET /audit-logs is server-paginated (`limit`/`offset`, `has_more`) and filterable. */
describe("audit log pagination", () => {
  it("requests pages from the server and follows has_more", async () => {
    const seen: URLSearchParams[] = []
    server.use(
      http.get(`${API}/audit-logs`, ({ request }) => {
        const params = new URL(request.url).searchParams
        seen.push(params)
        const offset = Number(params.get("offset") ?? "0")
        const action = offset === 0 ? "credential.created" : "credential.revoked"
        return HttpResponse.json({ items: [{ ...fx.auditLog, id: `log-${offset}`, action }], has_more: offset === 0 })
      }),
    )
    renderApp("/app/audit-logs", { signedIn: true })
    expect(await screen.findByText("credential.created")).toBeInTheDocument()
    expect(seen[0].get("limit")).toBe("50")
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(await screen.findByText("credential.revoked")).toBeInTheDocument()
    expect(seen.at(-1)?.get("offset")).toBe("50")
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled()
    expect(screen.getByText("Showing 51–51")).toBeInTheDocument()
  })

  it("sends the exact action filter and shows operator actions without an identity", async () => {
    const seen: string[] = []
    server.use(
      http.get(`${API}/audit-logs`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("action") ?? "")
        return HttpResponse.json({
          items: [{ ...fx.auditLog, action: "live_access_request.approved", actor_type: "operator", actor_id: null }],
          has_more: false,
        })
      }),
    )
    renderApp("/app/audit-logs?action=live_access_request.approved", { signedIn: true })
    expect(await screen.findByText("live_access_request.approved")).toBeInTheDocument()
    expect(screen.getByText("Clarion operator")).toBeInTheDocument()
    await waitFor(() => expect(seen).toContain("live_access_request.approved"))
  })
})
