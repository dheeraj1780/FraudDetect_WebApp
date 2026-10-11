import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { diffThresholds } from "@/lib/fraud/policy-diff"
import type { PolicyVersionOut } from "@/lib/api/types"
import * as fx from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { API, server } from "@/test/server"

const version = (environment: "sandbox" | "live", thresholds: PolicyVersionOut["thresholds"], id = `${environment}-v1`): PolicyVersionOut => ({
  id,
  policy_id: `${environment}-lineage`,
  version: 1,
  environment,
  status: "active",
  thresholds,
  created_at: "2026-10-01T00:00:00Z",
  published_at: "2026-10-01T00:00:00Z",
  retired_at: null,
})

describe("diffThresholds", () => {
  it("classifies added, removed, changed and unchanged thresholds by minimum score", () => {
    const diffs = diffThresholds(
      [
        { minimum_score: 0, recommendation: "PROCEED" },
        { minimum_score: 40, recommendation: "STEP_UP" },
        { minimum_score: 90, recommendation: "BLOCK" },
      ],
      [
        { minimum_score: 0, recommendation: "PROCEED" },
        { minimum_score: 40, recommendation: "REVIEW" },
        { minimum_score: 70, recommendation: "STEP_UP" },
      ],
    )
    expect(diffs.map((d) => [d.minimum_score, d.kind])).toEqual([
      [0, "same"],
      [40, "changed"],
      [70, "added"],
      [90, "removed"],
    ])
  })
})

describe("Compare environments", () => {
  it("compares the persisted active versions and copies SANDBOX into a LIVE draft without activating", async () => {
    let copyBody: unknown = null
    server.use(
      http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxAndLiveEnvironments)),
      http.get(`${API}/policies/active`, ({ request }) => {
        const env = new URL(request.url).searchParams.get("environment")
        return HttpResponse.json(
          env === "sandbox"
            ? version("sandbox", [
                { minimum_score: 0, recommendation: "PROCEED" },
                { minimum_score: 90, recommendation: "BLOCK" },
              ])
            : null,
        )
      }),
      http.get(`${API}/policies/:policyId/versions`, () => HttpResponse.json([])),
      http.post(`${API}/policies/drafts/copy`, async ({ request }) => {
        copyBody = await request.json()
        return HttpResponse.json(
          {
            draft: { ...version("live", []), status: "draft", id: "live-draft" },
            summary: {
              source_version_id: "sandbox-v1", source_policy_id: "sandbox-lineage", source_version: 1, source_status: "active",
              source_environment: "sandbox", target_environment: "live", copied_threshold_count: 2, incompatibilities: [], activated: false,
            },
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/policies?compare=1", { signedIn: true })
    expect(await screen.findByText(/LIVE has no policy turned on yet/)).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Threshold differences" })
    expect(within(table).getAllByText("Only in SANDBOX")).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: /Copy SANDBOX policy to a LIVE draft/ }))
    await user.click(await screen.findByRole("button", { name: "Create LIVE draft" }))
    expect(await screen.findByText(/SANDBOX is unchanged/)).toBeInTheDocument()
    await waitFor(() =>
      expect(copyBody).toMatchObject({ source_environment: "sandbox", source_version_id: "sandbox-v1", target_environment: "live" }),
    )
  })

  it("is not offered before LIVE is provisioned", async () => {
    renderApp("/app/policies", { signedIn: true })
    await screen.findByRole("heading", { name: /Policies/ })
    expect(screen.queryByText("Compare environments")).not.toBeInTheDocument()
  })
})
