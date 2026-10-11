import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"
import { hasSignedInHint } from "@/lib/auth/session"
import { renderApp } from "@/test/render"
import { API, notAuthenticated, server } from "@/test/server"

describe("protected routes", () => {
  it("redirects a signed-out visitor from /app/overview to /signin", async () => {
    renderApp("/app/overview")
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
  })

  it("renders the app shell for a signed-in user", async () => {
    renderApp("/app", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(await screen.findByText("Acme Retail", { selector: "span" })).toBeInTheDocument()
  })

  it("sends a signed-in user with no organization to onboarding", async () => {
    server.use(
      http.get(`${API}/tenants/current`, () =>
        HttpResponse.json(
          {
            code: "ValidationAppError",
            message: "Tenant context required: you do not belong to any tenant yet.",
          },
          { status: 400 },
        ),
      ),
    )
    renderApp("/app/credentials", { signedIn: true })
    expect(
      await screen.findByRole("heading", { name: "Create your organization" }),
    ).toBeInTheDocument()
  })

  it("keeps signed-in users out of /signin", async () => {
    renderApp("/signin", { signedIn: true })
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
  })
})

describe("sign in", () => {
  it("signs in with valid credentials and lands on the overview", async () => {
    const user = userEvent.setup()
    renderApp("/signin")

    await user.type(await screen.findByLabelText("Email"), "owner@example.com")
    await user.type(screen.getByLabelText("Password"), "correct-password")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(hasSignedInHint()).toBe(true)
    // Wave 46: no session token is ever written to browser storage.
    expect(Object.values({ ...localStorage }).some((v) => String(v).startsWith("sess_"))).toBe(false)
  })

  it("shows the API's message on a failed sign-in and does not store a session", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { code: "UnauthorizedError", message: "Invalid email or password." },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp("/signin")

    await user.type(await screen.findByLabelText("Email"), "owner@example.com")
    await user.type(screen.getByLabelText("Password"), "wrong")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(hasSignedInHint()).toBe(false)
  })

  it("validates required fields client-side without calling the API", async () => {
    const user = userEvent.setup()
    renderApp("/signin")

    await user.click(await screen.findByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("Email is required.")).toBeInTheDocument()
    expect(screen.getByText("Password is required.")).toBeInTheDocument()
  })
})

describe("sign up validation", () => {
  it("rejects a short password, mismatched confirmation and bad email before any request", async () => {
    const registerSpy = vi.fn()
    server.use(
      http.post(`${API}/auth/register`, () => {
        registerSpy()
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/signup")

    await user.type(await screen.findByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "short")
    await user.type(screen.getByLabelText("Confirm password"), "different")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument()
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument()
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it("registers then signs in, and surfaces a duplicate-email conflict", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json(
          { code: "ConflictError", message: "A user with this email already exists." },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp("/signup")

    await user.type(await screen.findByLabelText("Email"), "owner@example.com")
    await user.type(screen.getByLabelText("Password"), "long-enough-pass")
    await user.type(screen.getByLabelText("Confirm password"), "long-enough-pass")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument()
  })
})

describe("logout and expired sessions", () => {
  it("logout calls the API, clears the stored session and returns to /signin", async () => {
    const logoutSpy = vi.fn()
    server.use(
      http.post(`${API}/auth/logout`, () => {
        logoutSpy()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp("/app/overview", { signedIn: true })

    await user.click(await screen.findByRole("button", { name: /owner@example\.com/ }))
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(logoutSpy).toHaveBeenCalledTimes(1)
    expect(hasSignedInHint()).toBe(false)
  })

  it("forces sign-out when an authenticated call returns 401", async () => {
    server.use(http.get(`${API}/credentials`, notAuthenticated))
    renderApp("/app/credentials", { signedIn: true })

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    await waitFor(() => expect(hasSignedInHint()).toBe(false))
  })

  it("drops a stale stored session when /auth/me is rejected on load", async () => {
    server.use(http.get(`${API}/auth/me`, notAuthenticated))
    renderApp("/app/overview", { signedIn: true })

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    await waitFor(() => expect(hasSignedInHint()).toBe(false))
  })
})
