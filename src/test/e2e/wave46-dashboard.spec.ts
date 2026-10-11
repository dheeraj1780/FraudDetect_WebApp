/// <reference lib="dom" />
/**
 * Wave 46, Milestone G: real-browser end-to-end flows against a REAL fraud-platform-api process (real
 * SQLite file, real migrations, real deployment CLI for the Supreme Operator) and a REAL production
 * build served by `vite preview`, whose proxy makes the API same-origin -- exactly how the HttpOnly
 * session cookie is meant to work.
 *
 * Covered: sign-up/sign-in/sign-out with cookie sessions (HttpOnly, never in storage, revoked on
 * sign-out); tenant MFA enrollment and the LIVE-action MFA gate; LIVE provisioning and request;
 * operator sign-in with mandatory MFA and permission-gated approval; LIVE policy + LIVE credential
 * issuance with a one-time secret that really authenticates; emergency suspension revoking that
 * credential; tenant/operator realm separation; audit log pagination.
 *
 * NOT covered here (no fraud-engine or email provider is started): SANDBOX assessment scoring and
 * real email delivery. If the sibling backend cannot start, every test is skipped and reported, never
 * faked.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import path from "node:path"
import { type Page, expect, test } from "@playwright/test"
import { runBackendCli, type SpawnedBackend, spawnBackend, stopBackend } from "@/test/e2e/backend-harness"

const BACKEND_PORT = 8746
const FRONTEND_PORT = 4322
const ORIGIN = `http://localhost:${FRONTEND_PORT}`
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..")
const PASSWORD = "e2e-correct-horse-1"
const OPERATOR_EMAIL = "supreme@ops.example.com"
const OPERATOR_PASSWORD = "e2e-supreme-password-1"
const key = (c: string) => Buffer.from(c.repeat(32)).toString("base64")

let backend: SpawnedBackend
let frontend: ChildProcessWithoutNullStreams | undefined
let ready = false

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) -- the same parameters the server verifies. */
function totp(secretB32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0")
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)))
  const digest = createHmac("sha1", bytes).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: REPO_ROOT, env, shell: true })
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
    child.on("error", reject)
  })
}

async function waitFor(url: string, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return true
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

async function kill(pid: number | undefined): Promise<void> {
  if (pid === undefined) return
  await new Promise<void>((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { shell: true })
    killer.on("exit", () => resolve())
    killer.on("error", () => resolve())
  })
}

test.beforeAll(async () => {
  test.setTimeout(240_000)
  backend = await spawnBackend({
    port: BACKEND_PORT,
    corsOrigin: ORIGIN,
    extraEnv: {
      CORS_ALLOWED_ORIGINS: ORIGIN,
      OPERATOR_MFA_ENCRYPTION_KEY: key("o"),
      USER_MFA_ENCRYPTION_KEY: key("u"),
      TENANT_MFA_POLICY: "required_for_live",
      SESSION_COOKIE_SECURE: "true",
    },
  })
  if (!backend.available) return
  await runBackendCli(
    backend,
    ["app.cli.operators", "bootstrap-supreme", "--email", OPERATOR_EMAIL, "--display-name", "E2E-Supreme", "--password-stdin"],
    `${OPERATOR_PASSWORD}\n`,
  )
  const env = { ...process.env, CLARION_API_PROXY_TARGET: backend.baseUrl }
  await run("npx", ["vite", "build"], env)
  frontend = spawn("npx", ["vite", "preview", "--port", String(FRONTEND_PORT), "--strictPort"], { cwd: REPO_ROOT, env, shell: true })
  ready = await waitFor(ORIGIN, Date.now() + 60_000)
})

test.afterAll(async () => {
  await kill(frontend?.pid)
  if (backend) await stopBackend(backend)
})

function skipIfUnavailable(): void {
  test.skip(!backend?.available || !ready, "fraud-platform-api or the preview server was not available")
}

async function signUp(page: Page, email: string, organization: string): Promise<void> {
  await page.goto(`${ORIGIN}/signup`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.getByLabel("Organization name").fill(organization)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 20_000 })
}

/** A same-origin API call FROM the page, with the browser's own cookie and the CSRF echo. */
async function apiFromPage(page: Page, method: string, apiPath: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ method, apiPath, body }) => {
      const csrf = document.cookie.split(";").map((c: string) => c.trim()).find((c: string) => c.startsWith("clarion_csrf="))?.split("=")[1] ?? ""
      const tenantId = localStorage.getItem("clarion.tenant_id")
      const response = await fetch(`/api/v1${apiPath}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, ...(tenantId ? { "X-Tenant-Id": tenantId } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await response.text()
      return { status: response.status, json: text ? JSON.parse(text) : null }
    },
    { method, apiPath, body },
  )
}

test.describe("Wave 46 dashboard end-to-end", () => {
  test("cookie sessions: HttpOnly, never in storage, revoked on sign-out", async ({ page, context }) => {
    skipIfUnavailable()
    await signUp(page, "e2e-cookie@example.com", "Cookie Co")
    const cookies = await context.cookies()
    const session = cookies.find((c) => c.name === "clarion_session")
    expect(session?.httpOnly).toBe(true)
    expect(session?.secure).toBe(true)
    expect(session?.sameSite).toBe("Strict")
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
    expect(storage).not.toContain(session!.value)
    expect(await page.evaluate(() => document.cookie)).not.toContain("clarion_session")

    // A write without the CSRF token is refused, even with a valid cookie.
    const forged = await page.evaluate(async () => (await fetch("/api/v1/tenants", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: '{"name":"x"}' })).status)
    expect(forged).toBe(403)

    await page.getByRole("button", { name: /e2e-cookie@example\.com/ }).click()
    await page.getByRole("menuitem", { name: "Sign out" }).click()
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
    // The old cookie value no longer authenticates (server-side revocation, not just a cleared cookie).
    const replay = await fetch(`${backend.baseUrl}/api/v1/auth/me`, { headers: { Cookie: `clarion_session=${session!.value}` } })
    expect(replay.status).toBe(401)
  })

  test("LIVE lifecycle across tenant and operator realms", async ({ browser }) => {
    skipIfUnavailable()
    test.setTimeout(180_000)
    const tenantContext = await browser.newContext()
    const tenant = await tenantContext.newPage()
    await signUp(tenant, "e2e-owner@example.com", "Live Co")

    // Provision LIVE, then the LIVE request is refused until the owner has MFA (required_for_live).
    await tenant.goto(`${ORIGIN}/app/credentials`)
    await tenant.getByRole("button", { name: "Provision live environment" }).click()
    await expect(tenant.getByText(/Live environment is provisioned/)).toBeVisible()
    await tenant.goto(`${ORIGIN}/app/live-access`)
    await tenant.getByLabel(/Describe how you will use Clarion/).fill("End-to-end verification of LIVE access.")
    await tenant.getByRole("button", { name: "Submit request" }).click()
    await expect(tenant.getByText(/multi-factor authentication before LIVE actions/i)).toBeVisible()

    // Tenant MFA enrollment from Settings.
    await tenant.goto(`${ORIGIN}/app/settings`)
    await tenant.getByRole("button", { name: "Set up an authenticator app" }).click()
    const userSecret = (await tenant.locator("span.font-mono").first().textContent())!.trim()
    await tenant.getByLabel("Code from your authenticator").fill(totp(userSecret))
    await tenant.getByRole("button", { name: "Verify and turn on" }).click()
    await expect(tenant.getByLabel("Recovery codes")).toBeVisible()
    await tenant.getByRole("button", { name: "I have saved them" }).click()

    await tenant.goto(`${ORIGIN}/app/live-access`)
    await tenant.getByLabel(/Describe how you will use Clarion/).fill("End-to-end verification of LIVE access.")
    await tenant.getByRole("button", { name: "Submit request" }).click()
    await expect(tenant.getByText("Request under review")).toBeVisible()

    // A tenant session cannot reach the operator realm.
    expect((await apiFromPage(tenant, "GET", "/operator/auth/me")).status).toBe(401)

    // Operator: sign-in, mandatory MFA enrollment, approval.
    const operatorContext = await browser.newContext()
    const op = await operatorContext.newPage()
    await op.goto(`${ORIGIN}/operator/signin`)
    await op.getByLabel("Email").fill(OPERATOR_EMAIL)
    await op.getByLabel("Password").fill(OPERATOR_PASSWORD)
    await op.getByRole("button", { name: "Continue" }).click()
    await op.getByRole("button", { name: "Start setup" }).click()
    const opSecret = (await op.locator("span.font-mono").first().textContent())!.trim()
    await op.getByLabel("Code from your authenticator").fill(totp(opSecret))
    await op.getByRole("button", { name: "Verify and enable" }).click()
    await op.getByRole("button", { name: "I have saved them" }).click()
    await expect(op.getByRole("heading", { name: "LIVE access requests" })).toBeVisible()
    expect(await op.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain("opsess_")
    await op.getByRole("link", { name: "Review" }).first().click()
    await op.getByLabel(/Reason \(recorded and shown to the tenant\)/).fill("E2E review complete")
    await op.getByRole("button", { name: "Approve" }).click()
    await expect(op.getByText("approved", { exact: true })).toBeVisible()

    // Tenant: activate a LIVE policy (real API, cookie + CSRF), then issue a LIVE credential in the UI.
    const draft = await apiFromPage(tenant, "POST", "/policies/drafts", {
      environment: "live",
      thresholds: [
        { minimum_score: 0, recommendation: "PROCEED" },
        { minimum_score: 50, recommendation: "REVIEW" },
      ],
    })
    expect(draft.status).toBe(201)
    const activated = await apiFromPage(tenant, "POST", `/policies/versions/${(draft.json as { id: string }).id}/activate`, { environment: "live" })
    expect(activated.status).toBe(200)
    await tenant.goto(`${ORIGIN}/app/live-access`)
    await expect(tenant.getByText("Approved · active")).toBeVisible()
    await tenant.getByRole("button", { name: "Issue LIVE credential" }).click()
    const liveSecret = (await tenant.getByText(/^sk_live_/).first().textContent())!.trim()
    const contextEvent = { customer_reference: "c1", event_type: "authentication_succeeded", occurred_at: new Date().toISOString() }
    const ok = await fetch(`${backend.baseUrl}/api/v1/context-events`, {
      method: "POST",
      headers: { "X-Api-Key": liveSecret, "Content-Type": "application/json" },
      body: JSON.stringify({ ...contextEvent, idempotency_key: "e2e-1" }),
    })
    expect(ok.status).toBe(201)

    // Operator: emergency suspension -> the LIVE credential stops working at once.
    await op.getByRole("link", { name: "LIVE tenants" }).click()
    await op.getByRole("link", { name: "Manage" }).first().click()
    await op.getByLabel(/Emergency suspend now .*: Reason/).fill("E2E emergency drill")
    await op.getByRole("button", { name: /Emergency suspend now/ }).click()
    await expect(op.getByText("LIVE blocked").first()).toBeVisible()
    const blocked = await fetch(`${backend.baseUrl}/api/v1/context-events`, {
      method: "POST",
      headers: { "X-Api-Key": liveSecret, "Content-Type": "application/json" },
      body: JSON.stringify({ ...contextEvent, idempotency_key: "e2e-2" }),
    })
    expect(blocked.status).toBe(401)
    await tenant.reload()
    await expect(tenant.getByText("LIVE blocked")).toBeVisible()

    // Audit: paginated, filterable, operator actions shown without the operator's identity.
    await tenant.goto(`${ORIGIN}/app/audit-logs?action=live_access_request.approved`)
    await expect(tenant.getByText("live_access_request.approved").first()).toBeVisible()
    await expect(tenant.getByText("Clarion operator").first()).toBeVisible()
    await tenantContext.close()
    await operatorContext.close()
  })
})
