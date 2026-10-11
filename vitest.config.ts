import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    env: { VITE_API_BASE_URL: "http://api.test/api/v1" },
    // Wave 30: src/test/e2e/** spawns a real backend process and makes real network calls against it --
    // this global setupFile's msw server (onUnhandledRequest: "error") would intercept and reject those
    // real requests. Run separately: `npm run test:e2e` (vitest.e2e.config.ts, no msw setup at all).
    // Extends (not replaces) Vitest's own default exclude list -- an explicit `exclude` array
    // overrides the defaults entirely, so they are repeated here rather than silently dropped.
    exclude: [
      "**/node_modules/**", "**/dist/**", "**/cypress/**", "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "src/test/e2e/**",
    ],
  },
})
