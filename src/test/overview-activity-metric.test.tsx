import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import type { AuditLogOut } from "@/lib/api/types"
import { renderApp } from "@/test/render"
import * as fx from "@/test/fixtures"
import { API, server } from "@/test/server"

/**
 * Wave 33B: the one real, derived (never fabricated) Overview activity metric Wave 33A's own audit
 * identified as safe -- a count of today's rows among the audit log this page already fetches. These
 * tests exercise the derivation directly, with controlled fixture timestamps, rather than relying on
 * the default fixture's own fixed historical date.
 */

function logAt(occurredAt: string, overrides: Partial<AuditLogOut> = {}): AuditLogOut {
  return { ...fx.auditLog, id: crypto.randomUUID(), occurred_at: occurredAt, ...overrides }
}

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** A timestamp guaranteed to fall within today's calendar date regardless of the current wall-clock
 * time when the test runs -- anchored to midnight plus a small, fixed offset, never derived by
 * subtracting from "now" (which can underflow past local midnight depending on when the suite runs). */
function todayAt(minutesAfterMidnight: number): string {
  return new Date(startOfTodayMs() + minutesAfterMidnight * 60_000).toISOString()
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe("Overview activity-today metric (Wave 33B)", () => {
  it("counts only today's rows, correctly excluding older ones", async () => {
    server.use(
      http.get(`${API}/audit-logs`, () =>
        HttpResponse.json({ items: [logAt(todayAt(1)), logAt(todayAt(5)), logAt(daysAgo(1)), logAt(daysAgo(10))], has_more: false }),
      ),
    )
    renderApp("/app/overview", { signedIn: true })
    const badge = await screen.findByText("2 today")
    expect(badge).toBeInTheDocument()
  })

  it("shows 0 today honestly when every fetched row is older than today -- never hidden, never fabricated", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logAt(daysAgo(1)), logAt(daysAgo(2))], has_more: false })))
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText("0 today")).toBeInTheDocument()
  })

  it("shows 0 today honestly when there is no activity at all", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [], has_more: false })))
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText("0 today")).toBeInTheDocument()
  })

  it("counts multiple events recorded today correctly", async () => {
    server.use(
      http.get(`${API}/audit-logs`, () =>
        HttpResponse.json({ items: [logAt(todayAt(0)), logAt(todayAt(2)), logAt(todayAt(4)), logAt(todayAt(6))], has_more: false }),
      ),
    )
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText("4 today")).toBeInTheDocument()
  })

  it("shows no metric at all while the audit query is still loading -- never a flashed fabricated value", async () => {
    server.use(http.get(`${API}/audit-logs`, async () => await new Promise(() => undefined)))
    renderApp("/app/overview", { signedIn: true })
    await screen.findByRole("heading", { name: "Overview" })
    expect(screen.queryByText(/today$/)).not.toBeInTheDocument()
  })

  it("shows no metric at all when the audit query fails -- never a fabricated 0 standing in for an error", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ code: "InternalError", message: "boom" }, { status: 500 })))
    renderApp("/app/overview", { signedIn: true })
    await screen.findByText(/Couldn.t load recent activity/)
    expect(screen.queryByText(/today$/)).not.toBeInTheDocument()
  })

  it("the metric label and tooltip accurately describe its real, bounded scope", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logAt(todayAt(1))], has_more: false })))
    renderApp("/app/overview", { signedIn: true })
    const badge = await screen.findByText("1 today")
    expect(badge).toHaveAttribute(
      "title",
      "Audit events recorded for your organization today, among your most recent activity.",
    )
  })

  it("a malformed occurred_at value is never counted as today -- fails closed, not fabricated", async () => {
    server.use(
      http.get(`${API}/audit-logs`, () =>
        HttpResponse.json({ items: [logAt(todayAt(1)), logAt("not-a-real-timestamp")], has_more: false }),
      ),
    )
    renderApp("/app/overview", { signedIn: true })
    expect(await screen.findByText("1 today")).toBeInTheDocument()
  })

  it("never implies transaction, assessment, or fraud activity -- the label is generic and accurate", async () => {
    server.use(http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [logAt(todayAt(1))], has_more: false })))
    renderApp("/app/overview", { signedIn: true })
    const badge = await screen.findByText("1 today")
    // Scoped to the "Recent activity" card itself (not the whole page, which legitimately has its own
    // "Assessments"/"Transactions" nav links and sample-mode cards unrelated to this metric).
    const card = badge.closest(".rounded-panel") as HTMLElement
    for (const forbidden of ["fraud detected", "risk events", "transactions", "assessments", "threats", "suspicious activity"]) {
      expect(within(card).queryByText(new RegExp(forbidden, "i"))).not.toBeInTheDocument()
    }
  })
})
