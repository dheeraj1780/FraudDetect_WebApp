import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { setOperatorToken, type OperatorMe } from "@/lib/operator/api"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

const OP = `${API}/operator`

function me(over: Partial<OperatorMe> = {}): OperatorMe {
  return {
    id: "op-1",
    email: "reviewer@ops.example.com",
    display_name: "Reviewer",
    status: "active",
    status_reason: null,
    is_supreme: false,
    parent_operator_id: "op-0",
    mfa_enrolled: true,
    created_at: "2026-10-01T00:00:00Z",
    grants: [{ permission: "live_access.review", can_delegate: false }],
    effective_permissions: [{ permission: "live_access.review", can_delegate: false }],
    mfa_state: "verified",
    fresh_auth_until: null,
    session_expires_at: "2026-10-11T12:00:00Z",
    recovery_codes_remaining: 10,
    ...over,
  }
}

const readiness = { evaluated_at: "2026-10-11T00:00:00Z", checks: [], request_blockers: [], issuance_blockers: [] }
const detail = {
  id: "r1", tenant_id: "t1", tenant_name: "Acme", status: "submitted", requested_by_email: "owner@acme.example",
  created_at: "2026-10-10T00:00:00Z", reviewed_at: null, use_case: "Checkout scoring", decision_reason: null,
  reviewed_by_operator_id: null, submitted_readiness: readiness, decision_readiness: null, current_readiness: readiness,
  readiness_changed_since_submission: false,
}

describe("operator console", () => {
  it("is a separate realm: no operator token means sign-in, and tenant sign-in is not used", async () => {
    renderApp("/operator/requests")
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByText("FraudDetect · Operator console")).toBeInTheDocument()
  })

  it("signs in, enrolls MFA from a QR image and shows recovery codes once", async () => {
    let state: OperatorMe["mfa_state"] = "enrollment_required"
    const headersSeen: Array<Record<string, string | null>> = []
    server.use(
      http.post(`${OP}/auth/login`, () => HttpResponse.json({ access_token: "opsess_test", expires_at: "x", mfa_state: "enrollment_required" })),
      http.get(`${OP}/auth/me`, ({ request }) => {
        headersSeen.push({ auth: request.headers.get("authorization"), tenant: request.headers.get("x-tenant-id") })
        return HttpResponse.json(me({ mfa_state: state, mfa_enrolled: state === "verified" }))
      }),
      http.post(`${OP}/mfa/enrollment`, () => HttpResponse.json({ otpauth_uri: "otpauth://totp/x", qr_svg: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", secret: "ABCDEF" })),
      http.post(`${OP}/mfa/enrollment/confirm`, () => {
        state = "verified"
        return HttpResponse.json({ recovery_codes: ["aaaa-bbbb-cccc", "dddd-eeee-ffff"], note: "x" })
      }),
      http.get(`${OP}/live-access/requests`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderApp("/operator/signin")
    await user.type(await screen.findByLabelText("Email"), "reviewer@ops.example.com")
    await user.type(screen.getByLabelText("Password"), "pw-123456789")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(await screen.findByRole("button", { name: "Start setup" }))
    const qr = await screen.findByRole("img", { name: /QR code/ })
    expect(qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml/)
    await user.type(screen.getByLabelText("Code from your authenticator"), "123456")
    await user.click(screen.getByRole("button", { name: "Verify and enable" }))
    expect(await screen.findByText("aaaa-bbbb-cccc")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "I have saved them" }))
    expect(await screen.findByRole("heading", { name: "LIVE access requests" })).toBeInTheDocument()
    expect(headersSeen.every((h) => h.auth === "Bearer opsess_test" && h.tenant === null)).toBe(true)
  })

  it("an unverified session is sent to the MFA challenge, never into the console", async () => {
    setOperatorToken("opsess_test")
    server.use(http.get(`${OP}/auth/me`, () => HttpResponse.json(me({ mfa_state: "challenge_required" }))))
    renderApp("/operator/requests")
    expect(await screen.findByRole("heading", { name: "Two-factor verification" })).toBeInTheDocument()
  })

  it("asks for a fresh code when the API requires it, then retries the approval", async () => {
    setOperatorToken("opsess_test")
    let approvals = 0
    let reauth: unknown = null
    server.use(
      http.get(`${OP}/auth/me`, () => HttpResponse.json(me())),
      http.get(`${OP}/live-access/requests/r1`, () => HttpResponse.json(detail)),
      http.post(`${OP}/live-access/requests/r1/approve`, () => {
        approvals += 1
        if (approvals === 1) {
          return HttpResponse.json({ code: "FreshAuthenticationRequiredError", message: "Re-enter a verification code to continue." }, { status: 401 })
        }
        return HttpResponse.json({ ...detail, status: "approved" })
      }),
      http.post(`${OP}/mfa/reauthenticate`, async ({ request }) => {
        reauth = await request.json()
        return HttpResponse.json({ fresh_until: "x" })
      }),
      http.get(`${OP}/live-access/requests`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderApp("/operator/requests/r1")
    await user.type(await screen.findByRole("textbox", { name: /Reason/ }), "Reviewed")
    await user.click(screen.getByRole("button", { name: "Approve" }))
    await user.type(await screen.findByLabelText("Authenticator code"), "654321")
    await user.click(screen.getByRole("button", { name: "Verify" }))
    await waitFor(() => expect(approvals).toBe(2))
    expect(reauth).toEqual({ code: "654321" })
  })

  it("shows navigation by effective permission and hides decision controls without review permission", async () => {
    setOperatorToken("opsess_test")
    server.use(
      http.get(`${OP}/auth/me`, () =>
        HttpResponse.json(me({ grants: [{ permission: "tenants.read", can_delegate: false }], effective_permissions: [{ permission: "tenants.read", can_delegate: false }] })),
      ),
      http.get(`${OP}/live-access/requests/r1`, () => HttpResponse.json(detail)),
    )
    renderApp("/operator/requests/r1")
    expect(await screen.findByText("Checkout scoring")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument()
  })

  it("a revoked session (401) drops back to sign-in", async () => {
    setOperatorToken("opsess_revoked")
    server.use(http.get(`${OP}/auth/me`, () => HttpResponse.json({ code: "UnauthorizedError", message: "Not authenticated." }, { status: 401 })))
    renderApp("/operator/requests")
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
  })
})
