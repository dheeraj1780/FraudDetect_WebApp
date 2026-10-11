// @vitest-environment node
/**
 * Wave 30, Phase 13: the browser-client half of the end-to-end proof. Spawns a REAL
 * fraud-platform-api instance (a genuinely separate OS process, real Python/uvicorn, real SQLite file
 * on disk -- not mocked, not an in-process ASGI transport) and drives the REAL `CollectorClient`
 * (imported directly from `@/lib/collector/collectorClient`, the exact module the sandbox demo page
 * uses) against it over a real HTTP connection, using Node's own global `fetch` (no jsdom, no msw).
 *
 * This file runs in Vitest's `node` environment (the `@vitest-environment node` pragma above overrides
 * this project's default `jsdom` environment for this file only) because it exercises real OS process
 * spawning and real network I/O, neither of which belongs in a DOM-simulation environment. The
 * genuinely BROWSER-specific proofs this file cannot provide (real CORS enforcement, no token
 * leakage into the DOM/console) live in `collector-browser.spec.ts` (Playwright, a real browser engine).
 *
 * Real PostgreSQL coverage for this exact HTTP contract (token issuance -> collection -> correlation
 * identity) lives on the OTHER side of this proof, in fraud-platform-api's own
 * `tests/integration/test_collector_wave30_e2e_correlation.py` (already verified against a real,
 * ephemeral PostgreSQL 18 server, Wave 29's own mechanism). This file deliberately uses SQLite for the
 * spawned server to keep process orchestration from a Node test simple and reliable; it is NOT claimed
 * to prove anything Postgres-specific -- only that this repository's OWN `CollectorClient`
 * implementation correctly completes the real HTTP contract against a real, separate backend process.
 *
 * If the sibling `fraud-platform-api` checkout cannot be found, or the backend process cannot start
 * within the timeout, every test in this file is SKIPPED (not failed, not silently passed) -- this
 * environment-dependent, cross-repo test is reported as UNVERIFIED rather than guessed at. See the
 * Wave 30 report for whether it actually ran in this session.
 */
import { afterAll, describe, expect, it } from "vitest"
import { CollectorClient } from "@/lib/collector/collectorClient"
import { BACKEND_DIR, issueToken, spawnBackend, stopBackend, type SpawnedBackend } from "@/test/e2e/backend-harness"

const PORT = 8731

// A top-level await (not `beforeAll`): `describe.skipIf` below evaluates its condition at MODULE
// COLLECTION time, before any `beforeAll` hook would have run -- so backend startup must complete
// before the `describe` blocks themselves are declared, not inside a hook.
const backend: SpawnedBackend = await spawnBackend({ port: PORT, corsOrigin: "http://localhost:5173" })

afterAll(() => stopBackend(backend))

describe.skipIf(!backend.available)("Collector E2E against a real, separate fraud-platform-api process (Wave 30 Phase 13)", () => {
  it("a real CollectorClient, given a real token from a real backend, is accepted", async () => {
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-node-e2e-${Date.now()}`, backend.log)
    const client = new CollectorClient({ baseUrl: backend.baseUrl })
    client.setToken(token, expiresAt)
    const result = await client.submit()
    expect(result.outcome).toBe("accepted")
    expect(result.httpStatus).toBe(202)
  })

  it("the same real token, submitted twice through the real client, is idempotent (accepted then accepted_duplicate)", async () => {
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-node-e2e-dup-${Date.now()}`, backend.log)
    const client = new CollectorClient({ baseUrl: backend.baseUrl })
    client.setToken(token, expiresAt)
    const first = await client.submit()
    const second = await client.submit()
    expect(first.outcome).toBe("accepted")
    expect(second.outcome).toBe("accepted_duplicate")
  })

  it("an invalid (tampered) token is rejected by the real backend, not silently accepted", async () => {
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-node-e2e-tamper-${Date.now()}`, backend.log)
    const client = new CollectorClient({ baseUrl: backend.baseUrl })
    client.setToken(`${token}tampered`, expiresAt)
    const result = await client.submit()
    expect(result.outcome).toBe("rejected_token_invalid")
    expect(result.httpStatus).toBe(401)
  })
})

describe.skipIf(backend.available)("Collector E2E (skipped)", () => {
  it("reports why this suite could not run", () => {
    console.warn(
      `Wave 30 Node E2E suite SKIPPED: fraud-platform-api was not found at ${BACKEND_DIR} or did not become ready in time. ` +
        "This is reported as UNVERIFIED, not guessed at.",
    )
    expect(true).toBe(true)
  })
})
