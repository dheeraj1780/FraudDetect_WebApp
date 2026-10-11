import path from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Wave 30: a SEPARATE config for src/test/e2e/** only -- these tests spawn a real
 * fraud-platform-api process and make real network calls against it (no mocks), so they must NOT
 * load vitest.config.ts's msw setupFile (which intercepts and rejects any unmocked network request).
 * No jsdom either: these are plain Node tests exercising real OS process spawning and real HTTP.
 *
 * Run with: `npm run test:e2e`. Not part of `npm test` (vitest.config.ts) -- these tests require a
 * sibling `fraud-platform-api` checkout and `uv`, and take tens of seconds to spin up a real backend
 * process, so they are deliberately not in the fast, always-run unit suite.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/e2e/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
