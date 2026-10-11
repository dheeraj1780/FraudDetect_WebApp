import { API_BASE_URL } from "@/lib/api/config"
import { ApiError, parseErrorBody } from "@/lib/api/errors"
import { getCsrfToken, getTenantId } from "@/lib/auth/session"

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/** Registered once by AuthProvider so a 401 on any authenticated call can force a clean logout. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  /**
   * Whether this call carries the session token/tenant header and can
   * trigger a forced logout on 401. False for /auth/register and
   * /auth/login themselves — a 401 there means "wrong credentials," not
   * "your session expired."
   */
  auth?: boolean
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options

  // Wave 46: the session is an HttpOnly cookie the browser attaches itself (credentials: "include");
  // this code never sees the session token. X-FraudDetect-Client asks /auth/login for a cookie session.
  const headers: Record<string, string> = { Accept: "application/json", "X-FraudDetect-Client": "web" }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (method !== "GET") {
    const csrf = getCsrfToken()
    if (csrf) headers["X-CSRF-Token"] = csrf
  }

  if (auth) {
    const tenantId = getTenantId()
    if (tenantId) headers["X-Tenant-Id"] = tenantId
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Unable to reach the server. Check your connection and try again.")
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = await parseBody(response)

  if (!response.ok) {
    const error = parseErrorBody(response.status, data)
    if (auth && error.isUnauthorized) {
      unauthorizedHandler?.()
    }
    throw error
  }

  return data as T
}
