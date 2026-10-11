import { describe, expect, it, vi } from "vitest"
import { CollectorClient } from "@/lib/collector/collectorClient"
import { isSuccessOutcome } from "@/lib/collector/types"

const VALID_TOKEN = "CLARION-COLLECTOR-TOKEN-V1.eyJ0ZXN0IjoidHJ1ZSJ9.deadbeef"

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
}

function future(seconds = 300): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function past(seconds = 1): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

describe("CollectorClient: token handling (Wave 30 Phase 4)", () => {
  it("submit() before any setToken() call never makes a network request", async () => {
    const fetchImpl = vi.fn()
    const client = new CollectorClient({ fetchImpl })
    const result = await client.submit()
    expect(result).toEqual({ outcome: "client_token_not_set", wasRetried: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("hasToken() reflects setToken()/clearToken() state", () => {
    const client = new CollectorClient()
    expect(client.hasToken()).toBe(false)
    client.setToken(VALID_TOKEN, future())
    expect(client.hasToken()).toBe(true)
    client.clearToken()
    expect(client.hasToken()).toBe(false)
  })

  it("isExpired() is true before setToken(), false for a future expiry, true for a past expiry", () => {
    const client = new CollectorClient()
    expect(client.isExpired()).toBe(true)
    client.setToken(VALID_TOKEN, future())
    expect(client.isExpired()).toBe(false)
    client.setToken(VALID_TOKEN, past())
    expect(client.isExpired()).toBe(true)
  })

  it("an expired token triggers onTokenExpired and makes no network request", async () => {
    const onTokenExpired = vi.fn()
    const fetchImpl = vi.fn()
    const client = new CollectorClient({ onTokenExpired, fetchImpl })
    client.setToken(VALID_TOKEN, past())
    const result = await client.submit()
    expect(result).toEqual({ outcome: "client_token_expired_locally", wasRetried: false })
    expect(onTokenExpired).toHaveBeenCalledTimes(1)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("a malformed expiresAt (Invalid Date) is treated as expired -- fails closed, never open", async () => {
    const fetchImpl = vi.fn()
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, "not-a-real-date")
    expect(client.isExpired()).toBe(true)
    await client.submit()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("accepts a Date object directly, not only an ISO string", () => {
    const client = new CollectorClient()
    client.setToken(VALID_TOKEN, new Date(Date.now() + 60_000))
    expect(client.isExpired()).toBe(false)
  })

  it("the token is sent in the JSON body, never a URL query parameter, never a custom header", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).not.toContain(VALID_TOKEN)
      expect(String(url)).not.toContain("?")
      const headerEntries = Object.entries((init?.headers as Record<string, string>) ?? {})
      for (const [name, value] of headerEntries) {
        expect(name.toLowerCase()).not.toBe("x-clarion-collector-token")
        expect(value).not.toContain(VALID_TOKEN)
      }
      expect(JSON.parse(String(init?.body))).toEqual({ token: VALID_TOKEN })
      return jsonResponse(202, { status: "accepted" })
    })
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    await client.submit()
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/collector/v1/collect"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("never calls the token-issuance endpoint -- this module has no such method at all", () => {
    const client = new CollectorClient()
    expect((client as unknown as Record<string, unknown>).acquireToken).toBeUndefined()
    expect((client as unknown as Record<string, unknown>).issueToken).toBeUndefined()
  })
})

describe("CollectorClient: no secret/token logging (Wave 30 Phase 4 / 18)", () => {
  it("never calls console.log/warn/error/info/debug during a full submit cycle, success or failure", async () => {
    const spies = (["log", "warn", "error", "info", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined))
    try {
      const fetchImpl = vi.fn(async () => jsonResponse(202, { status: "accepted" }))
      const client = new CollectorClient({ fetchImpl })
      client.setToken(VALID_TOKEN, future())
      await client.submit()

      const failFetch = vi.fn(async () => jsonResponse(401, { status: "rejected_token_invalid" }))
      const failClient = new CollectorClient({ fetchImpl: failFetch })
      failClient.setToken(VALID_TOKEN, future())
      await failClient.submit()

      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})

describe("CollectorClient: outcome mapping (server vocabulary, Wave 30 Phase 11)", () => {
  const cases: [number, string, string][] = [
    [202, "accepted", "accepted"],
    [202, "accepted_duplicate", "accepted_duplicate"],
    [503, "rejected_not_production_ready", "rejected_not_production_ready"],
    [503, "rejected_collector_disabled", "rejected_collector_disabled"],
    [400, "rejected_malformed_request", "rejected_malformed_request"],
    [401, "rejected_token_invalid", "rejected_token_invalid"],
    [503, "rejected_storage_failure", "rejected_storage_failure"],
  ]

  it.each(cases)("HTTP %i with status=%s maps to outcome=%s", async (status, bodyStatus, expectedOutcome) => {
    const fetchImpl = vi.fn(async () => jsonResponse(status, { status: bodyStatus }))
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(result.outcome).toBe(expectedOutcome)
    expect(result.httpStatus).toBe(status)
  })

  it("isSuccessOutcome() is true only for accepted/accepted_duplicate", () => {
    expect(isSuccessOutcome("accepted")).toBe(true)
    expect(isSuccessOutcome("accepted_duplicate")).toBe(true)
    expect(isSuccessOutcome("rejected_token_invalid")).toBe(false)
    expect(isSuccessOutcome("client_network_failure")).toBe(false)
  })

  it("a response body that isn't the expected shape maps to client_malformed_server_response, never a guess", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(202, { unexpected: "shape" }))
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(result.outcome).toBe("client_malformed_server_response")
  })

  it("a non-JSON response body maps to client_malformed_server_response", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>not json</html>", { status: 503 }))
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(result.outcome).toBe("client_malformed_server_response")
  })

  it("an unrecognized status string is never passed through -- only the closed vocabulary is trusted", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(202, { status: "something_a_future_server_might_add" }))
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(result.outcome).toBe("client_malformed_server_response")
  })

  it("network failure (fetch throws) maps to client_network_failure, including a CORS preflight rejection", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(result.outcome).toBe("client_network_failure")
  })

  it("submit() never rejects -- every outcome, including failures, resolves", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom")
    })
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    await expect(client.submit()).resolves.toBeDefined()
  })

  it("5xx responses never silently become success", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { status: "rejected_storage_failure" }))
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(isSuccessOutcome(result.outcome)).toBe(false)
  })
})

describe("CollectorClient: Retry-After / bounded retry (Wave 30 Phase 10)", () => {
  it("honors a Retry-After within the configured bound: exactly one bounded retry, then returns its outcome", async () => {
    const delayImpl = vi.fn(async () => undefined)
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls === 1) return jsonResponse(429, { status: "rejected_rate_limited" }, { "Retry-After": "2" })
      return jsonResponse(202, { status: "accepted" })
    })
    const client = new CollectorClient({ fetchImpl, delayImpl, maxHonoredRetryAfterSeconds: 10 })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(delayImpl).toHaveBeenCalledWith(2000)
    expect(result).toEqual({ outcome: "accepted", httpStatus: 202, wasRetried: true })
  })

  it("never retries more than once, even if the retry itself is rate-limited again", async () => {
    const delayImpl = vi.fn(async () => undefined)
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: "rejected_rate_limited" }, { "Retry-After": "1" }))
    const client = new CollectorClient({ fetchImpl, delayImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(2) // original + exactly one retry
    expect(delayImpl).toHaveBeenCalledTimes(1) // never spins
    expect(result.outcome).toBe("rejected_rate_limited")
    expect(result.wasRetried).toBe(true)
  })

  it("does not retry when Retry-After exceeds the configured bound", async () => {
    const delayImpl = vi.fn(async () => undefined)
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: "rejected_rate_limited" }, { "Retry-After": "999" }))
    const client = new CollectorClient({ fetchImpl, delayImpl, maxHonoredRetryAfterSeconds: 10 })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(delayImpl).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: "rejected_rate_limited", httpStatus: 429, retryAfterSeconds: 999, wasRetried: false })
  })

  it("does not retry when no Retry-After header is present", async () => {
    const delayImpl = vi.fn(async () => undefined)
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: "rejected_rate_limited" }))
    const client = new CollectorClient({ fetchImpl, delayImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.retryAfterSeconds).toBeUndefined()
  })

  it("maxHonoredRetryAfterSeconds: 0 disables retrying entirely", async () => {
    const delayImpl = vi.fn(async () => undefined)
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: "rejected_rate_limited" }, { "Retry-After": "1" }))
    const client = new CollectorClient({ fetchImpl, delayImpl, maxHonoredRetryAfterSeconds: 0 })
    client.setToken(VALID_TOKEN, future())
    await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("a rate-limited submission is never reported as a successful outcome", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: "rejected_rate_limited" }))
    const client = new CollectorClient({ fetchImpl, delayImpl: async () => undefined })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(isSuccessOutcome(result.outcome)).toBe(false)
  })

  it("a malformed (non-numeric) Retry-After header is not honored and not treated as a crash", async () => {
    const delayImpl = vi.fn(async () => undefined)
    const fetchImpl = vi.fn(async () => jsonResponse(429, { status: "rejected_rate_limited" }, { "Retry-After": "not-a-number" }))
    const client = new CollectorClient({ fetchImpl, delayImpl })
    client.setToken(VALID_TOKEN, future())
    const result = await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(delayImpl).not.toHaveBeenCalled()
    expect(result.retryAfterSeconds).toBeUndefined()
  })
})

describe("CollectorClient: duplicate submission (Wave 30 Phase 7/20)", () => {
  it("calling submit() twice with the same token is the caller's own choice -- each call is independent and both reach the server", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(202, { status: "accepted_duplicate" }))
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    const first = await client.submit()
    const second = await client.submit()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(first.outcome).toBe("accepted_duplicate")
    expect(second.outcome).toBe("accepted_duplicate")
  })
})

describe("CollectorClient: baseUrl configuration", () => {
  it("defaults to a same-origin relative path", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("/collector/v1/collect")
      return jsonResponse(202, { status: "accepted" })
    })
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    await client.submit()
  })

  it("prefixes a configured baseUrl", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://collector.example.com/collector/v1/collect")
      return jsonResponse(202, { status: "accepted" })
    })
    const client = new CollectorClient({ baseUrl: "https://collector.example.com", fetchImpl })
    client.setToken(VALID_TOKEN, future())
    await client.submit()
  })
})

describe("CollectorClient: no flow_id handling at all (Wave 30 Phase 5)", () => {
  it("has no public method or option that accepts a flow_id-shaped value", () => {
    const client = new CollectorClient()
    const publicApi = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
    for (const name of publicApi) {
      expect(name.toLowerCase()).not.toContain("flow")
      expect(name.toLowerCase()).not.toContain("session")
    }
  })

  it("the exact token bytes passed to setToken() are the exact bytes sent in the request body -- no mutation, no re-derivation", async () => {
    let sentBody = ""
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentBody = String(init?.body)
      return jsonResponse(202, { status: "accepted" })
    })
    const client = new CollectorClient({ fetchImpl })
    client.setToken(VALID_TOKEN, future())
    await client.submit()
    expect(JSON.parse(sentBody)).toEqual({ token: VALID_TOKEN })
  })
})
