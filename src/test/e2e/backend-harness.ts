/**
 * Wave 30: shared logic for spawning a REAL, separate fraud-platform-api process for end-to-end
 * tests -- used by both `collector-e2e.node.test.ts` (Vitest) and `collector-browser.spec.ts`
 * (Playwright). Factored out rather than duplicated once a second consumer needed it.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHmac } from "node:crypto"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const BACKEND_DIR = process.env.FRAUD_PLATFORM_API_DIR ?? path.resolve(HERE, "..", "..", "..", "..", "fraud-platform-api")

export interface SpawnedBackend {
  baseUrl: string
  available: boolean
  process: ChildProcessWithoutNullStreams | undefined
  dbPath: string | undefined
  log: () => string
  /** Wave 46: the exact environment the backend runs with (for CLI calls against the same database). */
  env?: NodeJS.ProcessEnv
}

async function waitForReady(baseUrl: string, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return true
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, shell: true })
    let stderr = ""
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}: ${stderr.slice(-2000)}`))
    })
  })
}

/**
 * Starts a real fraud-platform-api instance (real Python/uvicorn, real SQLite file on disk) with the
 * collector fully configured and ready. `corsOrigin` is the ONE origin `COLLECTOR_CORS_ALLOWED_ORIGINS_SANDBOX`
 * will permit (callers that need to prove a DIFFERENT, unconfigured origin is rejected use a second
 * hostname pointed at the same frontend server -- see collector-browser.spec.ts).
 */
export async function spawnBackend(options: { port: number; corsOrigin: string; extraEnv?: NodeJS.ProcessEnv }): Promise<SpawnedBackend> {
  if (!existsSync(BACKEND_DIR)) {
    return { baseUrl: `http://127.0.0.1:${options.port}`, available: false, process: undefined, dbPath: undefined, log: () => "" }
  }

  const tmpDir = mkdtempSync(path.join(tmpdir(), "frauddetect-collector-e2e-"))
  const dbPath = path.join(tmpDir, "e2e.db").replace(/\\/g, "/")
  const baseUrl = `http://127.0.0.1:${options.port}`

  // app/core/identity_keys.py: a declared ENTITY_HASH_KEY domain requires all four settings together
  // (key, epoch, activation instant, a public non-secret HMAC "check" value) -- computed with the SAME
  // construction (CHECK_CONSTANTS["entity"], HMAC-SHA256) the server itself verifies against, mirroring
  // fraud-platform-api's own tests/key_support.py::key_check for exactly this reason.
  const entityHashKey = "a".repeat(32)
  const entityHashKeyCheck = createHmac("sha256", entityHashKey).update("frauddetect-key-check|entity-identity-domain").digest("hex")

  const sharedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    // Wave 46: never let a developer's fraud-platform-api/.env change what the e2e backend does.
    FRAUDDETECT_DOTENV_FILE: "none",
    DATABASE_URL: `sqlite+aiosqlite:///${dbPath}`,
    ENTITY_HASH_KEY: entityHashKey,
    ENTITY_HASH_KEY_EPOCH: "1",
    ENTITY_HASH_KEY_ACTIVATED_AT: "2026-01-01T00:00:00+00:00",
    ENTITY_HASH_KEY_CHECK: entityHashKeyCheck,
    COLLECTOR_TOKEN_ACTIVE_KEY_ID: "wave30-e2e-key",
    COLLECTOR_TOKEN_ACTIVE_KEY_SECRET: "wave30-e2e-collector-secret-32b!",
    COLLECTOR_TOKEN_TTL_SECONDS: "300",
    COLLECTOR_SANDBOX_ENABLED: "true",
    COLLECTOR_LIVE_ENABLED: "false",
    COLLECTOR_RATE_LIMITER_CONFIGURED: "true",
    COLLECTOR_RATE_LIMIT_TENANT_PER_MINUTE: "600",
    COLLECTOR_RATE_LIMIT_ENVIRONMENT_PER_MINUTE: "600",
    COLLECTOR_RATE_LIMIT_SOURCE_IP_PER_MINUTE: "600",
    COLLECTOR_RATE_LIMIT_TOKEN_VERIFICATION_ATTEMPT_PER_MINUTE: "600",
    COLLECTOR_RATE_LIMIT_COLLECTOR_ENDPOINT_PER_MINUTE: "600",
    COLLECTOR_CORS_ALLOWED_ORIGINS_SANDBOX: options.corsOrigin,
    ...options.extraEnv,
  }

  try {
    await run("uv", ["run", "alembic", "upgrade", "head"], BACKEND_DIR, sharedEnv)
  } catch {
    return { baseUrl, available: false, process: undefined, dbPath, log: () => "" }
  }

  let log = ""
  let proc: ChildProcessWithoutNullStreams | undefined
  try {
    proc = spawn("uv", ["run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(options.port)], {
      cwd: BACKEND_DIR, env: sharedEnv, shell: true,
    })
    proc.stderr?.on("data", (d: Buffer) => {
      log += d.toString()
    })
    proc.stdout?.on("data", (d: Buffer) => {
      log += d.toString()
    })
    const available = await waitForReady(baseUrl, Date.now() + 45_000)
    return { baseUrl, available, process: proc, dbPath, log: () => log, env: sharedEnv }
  } catch {
    return { baseUrl, available: false, process: proc, dbPath, log: () => log }
  }
}

/**
 * `spawn(..., { shell: true })` on Windows makes `backend.process` the CMD.EXE wrapper, not `uv`/
 * `uvicorn` itself -- `ChildProcess.kill()` only signals that wrapper, leaving the real server process
 * tree orphaned and still bound to its port (discovered during this wave's own development: stray
 * orphaned instances from earlier runs caused LATER runs to silently hit stale, mismatched server
 * state). `taskkill /T /F` kills the whole process tree rooted at the wrapper's PID -- and this
 * function is always AWAITED by callers, since an un-awaited, fire-and-forget kill can lose its race
 * against the parent process's own exit.
 */
export async function stopBackend(backend: SpawnedBackend): Promise<void> {
  if (backend.process?.pid !== undefined) {
    if (process.platform === "win32") {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(backend.process?.pid), "/T", "/F"], { shell: true })
        killer.on("exit", () => resolve())
        killer.on("error", () => resolve())
      })
    } else {
      backend.process.kill()
    }
  }
  if (backend.dbPath) {
    try {
      rmSync(path.dirname(backend.dbPath), { recursive: true, force: true })
    } catch {
      // best effort
    }
  }
}

export async function issueToken(
  baseUrl: string, flowId: string, log: () => string,
): Promise<{ token: string; expiresAt: string }> {
  const email = `wave30-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const password = "correct-horse-1"
  const registerResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (registerResponse.status !== 201) {
    throw new Error(`register failed: ${registerResponse.status} body=${await registerResponse.text()} log=${log().slice(-3000)}`)
  }

  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const { access_token: bearer } = (await loginResponse.json()) as { access_token: string }

  const tenantResponse = await fetch(`${baseUrl}/api/v1/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ name: "Wave 30 E2E Co" }),
  })
  const tenant = (await tenantResponse.json()) as { id: string }

  const credentialResponse = await fetch(`${baseUrl}/api/v1/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}`, "X-Tenant-Id": tenant.id },
    body: JSON.stringify({ label: null }),
  })
  const credential = (await credentialResponse.json()) as { secret: string }

  const tokenResponse = await fetch(`${baseUrl}/api/v1/collector/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": credential.secret },
    body: JSON.stringify({ flow_id: flowId }),
  })
  if (tokenResponse.status !== 201) throw new Error(`token issuance failed: ${tokenResponse.status}`)
  const body = (await tokenResponse.json()) as { token: string; expires_at: string }
  return { token: body.token, expiresAt: body.expires_at }
}


/** Wave 46: runs a deployment CLI (e.g. `python -m app.cli.operators bootstrap-supreme`) against the
 * spawned backend's own database, feeding `input` on stdin (passwords are never passed as arguments). */
export function runBackendCli(backend: SpawnedBackend, args: string[], input = ""): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("uv", ["run", "python", "-m", ...args], { cwd: BACKEND_DIR, env: backend.env, shell: true })
    let out = ""
    child.stdout?.on("data", (d: Buffer) => {
      out += d.toString()
    })
    child.stderr?.on("data", (d: Buffer) => {
      out += d.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`cli exited ${code}: ${out.slice(-1500)}`))))
    child.stdin?.end(input)
  })
}
