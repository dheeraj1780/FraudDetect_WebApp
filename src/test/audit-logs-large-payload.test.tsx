import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import type { AuditLogOut } from "@/lib/api/types"
import { renderApp } from "@/test/render"
import * as fx from "@/test/fixtures"
import { API, server } from "@/test/server"

/**
 * Wave 33B Item 2: Wave 33A identified large `after_json` handling as the one Audit Logs verification
 * opportunity. These tests exercise the ACTUAL existing implementation against small, large, deeply
 * nested, long-unbroken-string, and HTML-shaped payloads. No code change was made to
 * `audit-logs.tsx`/`JsonRow` -- this file exists to lock in and document that the existing
 * `overflow-x-auto` container (JsonRow) plus the existing `DialogContent`'s own bounded
 * `max-h-[calc(100dvh-2rem)] overflow-y-auto` (components/ui/dialog.tsx) already handle every case
 * safely, and that React's own text-child rendering (`{JSON.stringify(...)}`, never
 * `dangerouslySetInnerHTML`) already prevents any HTML-injection risk regardless of payload content.
 */

function logWith(afterJson: Record<string, unknown>): AuditLogOut {
  return { ...fx.auditLog, id: crypto.randomUUID(), after_json: afterJson }
}

async function openDetails(): Promise<void> {
  const button = await screen.findByRole("button", { name: /Details for/i })
  await userEvent.click(button)
}

describe("Audit Logs: large after_json verification (Wave 33B Item 2)", () => {
  it("renders a small after_json completely and legibly", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logWith({ key_prefix: "sk_sandbox_abc", status: "active" })], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    expect(screen.getByText(/"key_prefix"/)).toBeInTheDocument()
    expect(screen.getByText(/"status"/)).toBeInTheDocument()
  })

  it("renders a large after_json (many keys) completely, without crashing or truncating", async () => {
    const large = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`field_${i}`, `value_${i}`]))
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logWith(large)], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    expect(screen.getByText(/"field_0"/)).toBeInTheDocument()
    expect(screen.getByText(/"field_199"/)).toBeInTheDocument() // the LAST key -- proves nothing was truncated
  })

  it("renders deeply nested after_json correctly", async () => {
    const deep = { a: { b: { c: { d: { e: { f: "bottom" } } } } } }
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logWith(deep)], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    expect(screen.getByText(/"bottom"/)).toBeInTheDocument()
  })

  it("the JSON container has horizontal overflow containment for long unbroken strings", async () => {
    const longString = "x".repeat(2000) // no spaces -- cannot soft-wrap
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logWith({ note: longString })], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    const pre = screen.getByText(/"note"/).closest("dd")
    expect(pre).toHaveClass("overflow-x-auto")
    expect(pre?.textContent).toContain(longString) // present in full, not truncated
  })

  it("the dialog itself is vertically bounded and scrollable, never able to expand the page unboundedly", async () => {
    const large = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, "v".repeat(50)]))
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logWith(large)], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    const dialog = (await screen.findByRole("dialog"))
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]")
    expect(dialog.className).toContain("overflow-y-auto")
  })

  it("HTML-shaped content inside after_json is rendered as literal text, never interpreted as markup", async () => {
    server.use(
      http.get(`${API}/audit-logs`, () =>
        HttpResponse.json({ items: [logWith({ note: "<img src=x onerror=alert(1)>", script: "<script>alert(1)</script>" })], has_more: false }),
      ),
    )
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    // The literal escaped text is present as a text node...
    expect(screen.getByText(/onerror=alert\(1\)/)).toBeInTheDocument()
    // ...and was never parsed into actual DOM elements.
    expect(document.querySelector("img[src='x']")).not.toBeInTheDocument()
    expect(document.querySelector("script")).not.toBeInTheDocument()
  })

  it("a null after_json (no details available) never crashes the details view", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [{ ...fx.auditLog, after_json: null, before_json: null }], has_more: false })))
    renderApp("/app/audit-logs", { signedIn: true })
    await openDetails()
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})
