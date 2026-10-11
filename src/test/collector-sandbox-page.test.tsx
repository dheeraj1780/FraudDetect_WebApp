import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { renderApp } from "@/test/render"
import { server } from "@/test/server"

const TEST_TOKEN = "CLARION-COLLECTOR-TOKEN-V1.cGFnZS10ZXN0.feedface"

function futureIso(): string {
  return new Date(Date.now() + 5 * 60_000).toISOString()
}

describe("Collector sandbox demo page (Wave 30 Phase 12/18)", () => {
  it("renders the sandbox warning banner, clearly labeled", async () => {
    renderApp("/sandbox/collector")
    expect(await screen.findByText(/sandbox \/ test functionality/i)).toBeInTheDocument()
  })

  it("pre-fills token/expires_at from the URL query string", async () => {
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)
    const tokenInput = (await screen.findByTestId("collector-token-input")) as HTMLInputElement
    expect(tokenInput.value).toBe(TEST_TOKEN)
  })

  it("the token input is type=password -- never rendered as plain text in the DOM", async () => {
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}`)
    const tokenInput = (await screen.findByTestId("collector-token-input")) as HTMLInputElement
    expect(tokenInput.type).toBe("password")
  })

  it("a successful submission shows the accepted outcome and never echoes the token anywhere in the document", async () => {
    server.use(http.post("/collector/v1/collect", () => HttpResponse.json({ status: "accepted" }, { status: 202 })))
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)

    const submit = await screen.findByTestId("collector-submit")
    await userEvent.click(submit)

    const result = await screen.findByTestId("collector-result")
    expect(result.getAttribute("data-outcome")).toBe("accepted")
    expect(document.body.textContent).not.toContain(TEST_TOKEN)
  })

  it("a rejected/invalid token shows the rejected_token_invalid outcome, not a crash or a misleading success", async () => {
    server.use(http.post("/collector/v1/collect", () => HttpResponse.json({ status: "rejected_token_invalid" }, { status: 401 })))
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)

    await userEvent.click(await screen.findByTestId("collector-submit"))

    const result = await screen.findByTestId("collector-result")
    expect(result.getAttribute("data-outcome")).toBe("rejected_token_invalid")
  })

  it("a disabled collector shows rejected_collector_disabled, not a generic/opaque failure", async () => {
    server.use(http.post("/collector/v1/collect", () => HttpResponse.json({ status: "rejected_collector_disabled" }, { status: 503 })))
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)

    await userEvent.click(await screen.findByTestId("collector-submit"))

    expect(await screen.findByTestId("collector-result")).toHaveAttribute("data-outcome", "rejected_collector_disabled")
  })

  it("an expired token (per the form's own expires_at) never reaches the network -- shows client_token_expired_locally", async () => {
    let called = false
    server.use(
      http.post("/collector/v1/collect", () => {
        called = true
        return HttpResponse.json({ status: "accepted" }, { status: 202 })
      }),
    )
    const past = new Date(Date.now() - 60_000).toISOString()
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(past)}`)

    await userEvent.click(await screen.findByTestId("collector-submit"))

    const result = await screen.findByTestId("collector-result")
    expect(result.getAttribute("data-outcome")).toBe("client_token_expired_locally")
    await waitFor(() => expect(called).toBe(false))
  })

  it("the submit button is disabled until both token and expires_at are present", async () => {
    renderApp("/sandbox/collector")
    const submit = (await screen.findByTestId("collector-submit")) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it("Wave 32B: shows a human-readable title for a success outcome, not only the raw code", async () => {
    server.use(http.post("/collector/v1/collect", () => HttpResponse.json({ status: "accepted" }, { status: 202 })))
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)
    await userEvent.click(await screen.findByTestId("collector-submit"))
    const result = await screen.findByTestId("collector-result")
    expect(await screen.findByText("Accepted")).toBeInTheDocument()
    expect(result).toHaveTextContent("accepted") // the raw code is still shown, for developer transparency
  })

  it("Wave 32B: shows a human-readable title and explanation for a rate-limited outcome, including Retry-After", async () => {
    // Retry-After deliberately exceeds CollectorClient's own default bounded-retry cap (10s) so this
    // test observes the FIRST response directly, without waiting through a real client-side retry delay.
    server.use(
      http.post("/collector/v1/collect", () =>
        HttpResponse.json({ status: "rejected_rate_limited" }, { status: 429, headers: { "Retry-After": "999" } }),
      ),
    )
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)
    await userEvent.click(await screen.findByTestId("collector-submit"))
    expect(await screen.findByText("Rate limited")).toBeInTheDocument()
    expect(await screen.findByText(/Retry-After: 999s/)).toBeInTheDocument()
  })

  it("Wave 32B: a network failure shows a human-readable title, never a raw exception", async () => {
    server.use(
      http.post("/collector/v1/collect", () => HttpResponse.error()),
    )
    renderApp(`/sandbox/collector?token=${encodeURIComponent(TEST_TOKEN)}&expires_at=${encodeURIComponent(futureIso())}`)
    await userEvent.click(await screen.findByTestId("collector-submit"))
    expect(await screen.findByText("Network failure")).toBeInTheDocument()
  })
})
