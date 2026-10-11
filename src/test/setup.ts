import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"
import { clearSession } from "@/lib/auth/session"
import { clearOperatorToken } from "@/lib/operator/api"
import { defaultHandlers, server } from "@/test/server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  cleanup()
  server.resetHandlers(...defaultHandlers)
  clearSession()
  clearOperatorToken()
})
afterAll(() => server.close())
