/**
 * Wave 30, Phase 9 / 18: genuinely browser-specific proofs that no Node-environment test can provide --
 * real CORS preflight enforcement (a BROWSER behavior, not reproducible via Node's own `fetch`) and no
 * token leakage into the console, the DOM, or any request URL, across a REAL browser session talking to
 * a REAL, separate fraud-platform-api process.
 *
 * Two different ORIGINS are obtained from the SAME `vite preview` server by navigating to it via two
 * different hostnames (`localhost` vs `127.0.0.1`) -- browsers treat these as different origins even on
 * the same port, so this proves real CORS enforcement without needing two separate frontend builds.
 *
 * If the sibling `fraud-platform-api` checkout cannot be found or either process fails to start, every
 * test in this file is skipped (reported as UNVERIFIED, not guessed at) -- see the Wave 30 report.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { issueToken, type SpawnedBackend, spawnBackend, stopBackend } from "@/test/e2e/backend-harness"

const BACKEND_PORT = 8741
const FRONTEND_PORT = 4321
const ALLOWED_ORIGIN = `http://localhost:${FRONTEND_PORT}`
const DISALLOWED_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..")

let backend: SpawnedBackend
let frontend: ChildProcessWithoutNullStreams | undefined
let frontendReady = false

function sandboxUrl(origin: string, token: string, expiresAt: string): string {
  const params = new URLSearchParams({ token, expires_at: expiresAt, backend: backend.baseUrl })
  return `${origin}/sandbox/collector?${params.toString()}`
}

async function waitForFrontend(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const r = await fetch(ALLOWED_ORIGIN)
      if (r.ok) return true
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

test.beforeAll(async () => {
  backend = await spawnBackend({ port: BACKEND_PORT, corsOrigin: ALLOWED_ORIGIN })
  if (!backend.available) return

  frontend = spawn(
    "npx", ["vite", "preview", "--port", String(FRONTEND_PORT), "--host", "0.0.0.0", "--strictPort"],
    { cwd: REPO_ROOT, shell: true },
  )
  frontendReady = await waitForFrontend(Date.now() + 30_000)
})

test.afterAll(async () => {
  if (frontend?.pid !== undefined) {
    if (process.platform === "win32") {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(frontend?.pid), "/T", "/F"], { shell: true })
        killer.on("exit", () => resolve())
        killer.on("error", () => resolve())
      })
    } else {
      frontend.kill()
    }
  }
  if (backend) await stopBackend(backend)
})

test.describe("Collector browser CORS and token-leakage proof (Wave 30 Phase 9/18)", () => {
  // `beforeAll` has already run by the time any test body executes, so `backend`/`frontendReady` are
  // settled here (unlike Vitest's `describe.skipIf`, which evaluates before its own `beforeAll` runs --
  // see collector-e2e.node.test.ts's own comment on that same timing issue). Checked as the first line
  // of every test rather than via `test.skip()`'s callback-condition overload, whose exact generic
  // signature proved awkward to satisfy cleanly here.
  function skipIfUnavailable(): void {
    test.skip(!backend?.available || !frontendReady, "fraud-platform-api or the frontend preview server was not available")
  }

  test("an allowed origin completes the real collector flow end to end", async ({ page }) => {
    skipIfUnavailable()
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-browser-allowed-${Date.now()}`, backend.log)

    await page.goto(sandboxUrl(ALLOWED_ORIGIN, token, expiresAt))
    await page.getByTestId("collector-submit").click()
    const result = page.getByTestId("collector-result")
    await expect(result).toHaveAttribute("data-outcome", "accepted", { timeout: 15_000 })
  })

  test("an unconfigured origin is blocked by the browser's own CORS enforcement, not silently treated as success", async ({ page }) => {
    skipIfUnavailable()
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-browser-disallowed-${Date.now()}`, backend.log)

    await page.goto(sandboxUrl(DISALLOWED_ORIGIN, token, expiresAt))
    await page.getByTestId("collector-submit").click()
    const result = page.getByTestId("collector-result")
    await expect(result).toHaveAttribute("data-outcome", "client_network_failure", { timeout: 15_000 })
  })

  test("the token never appears in the console or in any request URL across the full flow", async ({ page }) => {
    skipIfUnavailable()
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-browser-leak-${Date.now()}`, backend.log)

    const consoleTexts: string[] = []
    const requestUrls: string[] = []
    page.on("console", (msg) => consoleTexts.push(msg.text()))
    page.on("request", (req) => requestUrls.push(req.url()))

    await page.goto(sandboxUrl(ALLOWED_ORIGIN, token, expiresAt))
    requestUrls.length = 0 // the token appears in THIS navigation's own URL (page.goto), by the test's own design -- only POST-navigation leakage matters
    await page.getByTestId("collector-submit").click()
    await expect(page.getByTestId("collector-result")).toHaveAttribute("data-outcome", "accepted", { timeout: 15_000 })

    for (const text of consoleTexts) expect(text).not.toContain(token)
    for (const url of requestUrls) expect(url).not.toContain(token)
  })

  test("the token input is never readable as plain visible text (type=password)", async ({ page }) => {
    skipIfUnavailable()
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-browser-masked-${Date.now()}`, backend.log)
    await page.goto(sandboxUrl(ALLOWED_ORIGIN, token, expiresAt))
    await expect(page.getByTestId("collector-token-input")).toHaveAttribute("type", "password")
  })

  test("the token is never written to localStorage or sessionStorage", async ({ page }) => {
    skipIfUnavailable()
    const { token, expiresAt } = await issueToken(backend.baseUrl, `wave30-browser-storage-${Date.now()}`, backend.log)
    await page.goto(sandboxUrl(ALLOWED_ORIGIN, token, expiresAt))
    await page.getByTestId("collector-submit").click()
    await expect(page.getByTestId("collector-result")).toHaveAttribute("data-outcome", "accepted", { timeout: 15_000 })

    const storageDump = await page.evaluate(() => ({
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
    }))
    expect(storageDump.local).not.toContain(token)
    expect(storageDump.session).not.toContain(token)
  })
})
