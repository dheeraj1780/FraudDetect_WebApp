import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import type { NoticeOut, Readiness, TenantLiveAccess } from "@/lib/api/endpoints/liveAccess"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

const readiness = (over: Partial<Readiness> = {}): Readiness => ({
  evaluated_at: "2026-10-11T09:00:00Z",
  checks: [
    { key: "owner_present", status: "pass", blocks: "request", detail: "1 owner membership(s)." },
    { key: "live_environment_provisioned", status: "pass", blocks: "request", detail: "LIVE environment exists." },
    { key: "active_live_policy", status: "fail", blocks: "issuance", detail: "No LIVE policy is active." },
    { key: "sandbox_activity", status: "info", blocks: null, detail: "No SANDBOX assessments recorded." },
    { key: "tenant_user_mfa", status: "not_available", blocks: null, detail: "Tenant-user MFA is not implemented." },
  ],
  request_blockers: [],
  issuance_blockers: ["active_live_policy"],
  ...over,
})

const base: TenantLiveAccess = {
  state: "not_requested",
  readiness: readiness(),
  grant: null,
  suspension: null,
  disputes: [],
  latest_request: null,
  dispute_window_hours: 72,
}

function mock(data: TenantLiveAccess, notices: NoticeOut[] = []) {
  server.use(
    http.get(`${API}/live-access`, () => HttpResponse.json(data)),
    http.get(`${API}/live-access/notices`, () => HttpResponse.json(notices)),
  )
}

describe("LIVE access page", () => {
  it("lets the owner submit a request and shows readiness honestly", async () => {
    let body: unknown = null
    mock(base)
    server.use(
      http.post(`${API}/live-access/requests`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/live-access", { signedIn: true })
    expect(await screen.findByText("Not requested")).toBeInTheDocument()
    expect(screen.getByText("Tenant-user MFA is not implemented.")).toBeInTheDocument()
    expect(screen.getAllByText("for your information").length).toBe(2)
    await user.type(screen.getByRole("textbox", { name: /Describe how you will use FraudDetect/ }), "Checkout risk scoring for EU.")
    await user.click(screen.getByRole("button", { name: "Submit request" }))
    await waitFor(() => expect(body).toEqual({ use_case: "Checkout risk scoring for EU." }))
  })

  it("never offers the request form to a non-owner", async () => {
    mock(base)
    server.use(http.get(`${API}/tenants/current/members`, () => HttpResponse.json([{ ...fx.ownerMembership, role: "admin" }])))
    renderApp("/app/live-access", { signedIn: true })
    expect(await screen.findByText(/Only the organization owner can request LIVE access/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Submit request" })).not.toBeInTheDocument()
  })

  it("blocks issuance until a LIVE policy is active, then issues and shows the secret once", async () => {
    const grant = { id: "g1", status: "active" as const, approved_at: "2026-10-10T00:00:00Z", status_changed_at: "2026-10-10T00:00:00Z" }
    mock({ ...base, state: "approved_active", grant })
    const { unmount } = renderApp("/app/live-access", { signedIn: true })
    expect(await screen.findByText(/Activate a LIVE policy before issuing LIVE credentials/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Issue LIVE credential" })).not.toBeInTheDocument()
    unmount()

    let posted: unknown = null
    mock({ ...base, state: "approved_active", grant, readiness: readiness({ issuance_blockers: [] }) })
    server.use(
      http.post(`${API}/credentials`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ ...fx.activeCredential, environment: "live", key_prefix: "sk_live_abc", secret: "sk_live_SECRET" }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/live-access", { signedIn: true })
    await user.click(await screen.findByRole("button", { name: "Issue LIVE credential" }))
    expect(await screen.findByText("sk_live_SECRET")).toBeInTheDocument()
    expect(posted).toEqual({ label: null, environment: "live" })
  })

  it("labels a pending suspension as still active and lets the owner acknowledge and dispute", async () => {
    const grant = { id: "g1", status: "active" as const, approved_at: "2026-10-10T00:00:00Z", status_changed_at: "2026-10-10T00:00:00Z" }
    const suspension = {
      id: "s1", kind: "ordinary" as const, status: "dispute_window_open", reason: "Chargeback review", notice_id: "n1",
      dispute_window_started_at: "2026-10-11T00:00:00Z", dispute_deadline_at: "2026-10-14T00:00:00Z", enforced_at: null,
      enforced_by: null, revoked_credential_count: null, resolved_at: null, resolution_reason: null,
      created_at: "2026-10-11T00:00:00Z", access_blocked: false,
    }
    const notices: NoticeOut[] = [
      { id: "n1", kind: "live_access_suspension_proposed", subject: "Proposed suspension of LIVE access", body: "b", channel: "in_app", delivery_status: "queued", attempt_count: 1, last_attempt_at: null, last_error: null, confirmed_at: null, confirmation_source: null, created_at: "2026-10-11T00:00:00Z" },
      { id: "n2", kind: "live_access_suspension_proposed", subject: "Proposed suspension of LIVE access", body: "b", channel: "email", delivery_status: "delivery_unavailable", attempt_count: 1, last_attempt_at: null, last_error: "No email delivery provider is configured on this deployment.", confirmed_at: null, confirmation_source: null, created_at: "2026-10-11T00:00:00Z" },
    ]
    mock({ ...base, state: "suspension_pending", grant, suspension }, notices)
    const calls: string[] = []
    server.use(
      http.post(`${API}/live-access/notices/n1/acknowledge`, () => {
        calls.push("ack")
        return HttpResponse.json(notices[0])
      }),
      http.post(`${API}/live-access/suspensions/s1/disputes`, () => {
        calls.push("dispute")
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/live-access", { signedIn: true })
    expect(await screen.findByText("LIVE still works")).toBeInTheDocument()
    expect(screen.getByText("Pause proposed, LIVE still works")).toBeInTheDocument()
    expect(await screen.findByText(/no email provider configured/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Acknowledge" }))
    await user.type(screen.getByRole("textbox", { name: /Dispute this suspension/ }), "The ratio came from a known outage.")
    await user.click(screen.getByRole("button", { name: "Send reply" }))
    await waitFor(() => expect(calls).toEqual(["ack", "dispute"]))
  })

  it("shows an enforced suspension as blocked with revoked credentials", async () => {
    mock({
      ...base,
      state: "suspended",
      grant: { id: "g1", status: "suspended", approved_at: "x", status_changed_at: "x" },
      suspension: {
        id: "s1", kind: "emergency", status: "enforced", reason: "Account takeover", notice_id: null,
        dispute_window_started_at: null, dispute_deadline_at: null, enforced_at: "2026-10-11T00:00:00Z", enforced_by: "emergency",
        revoked_credential_count: 2, resolved_at: null, resolution_reason: null, created_at: "2026-10-11T00:00:00Z", access_blocked: true,
      },
    })
    renderApp("/app/live-access", { signedIn: true })
    expect(await screen.findByText("LIVE blocked")).toBeInTheDocument()
    expect(screen.getByText(/2 LIVE credential\(s\) were permanently revoked/)).toBeInTheDocument()
    expect(screen.getByText(/does not restore access automatically/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Issue LIVE credential" })).not.toBeInTheDocument()
  })
})
