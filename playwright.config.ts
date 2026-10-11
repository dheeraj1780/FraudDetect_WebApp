import { defineConfig, devices } from "@playwright/test"

/**
 * Wave 30, Phase 21: the real-browser-engine suite -- genuinely browser-specific proofs
 * (CORS preflight enforcement, no token leakage into the DOM/console/URL) that no Node-environment test
 * can provide, since those behaviors are the BROWSER's own enforcement, not reproducible outside one.
 *
 * Run with: `npm run test:browser`. Separate from `npm test` (Vitest) -- this suite needs a real
 * Chromium binary (`npx playwright install chromium`, already done once for this session) and spawns
 * both a real fraud-platform-api backend process AND a real `vite preview` frontend server, so it is
 * slower and has more moving parts than the fast unit suite.
 */
export default defineConfig({
  testDir: "./src/test/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false, // the spec file owns backend/frontend process lifecycle itself; avoid races
  // Wave 46: one worker -- spec files spawn their own servers and one of them rebuilds dist/, which
  // must never happen while another file's preview server is serving it.
  workers: 1,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
})
