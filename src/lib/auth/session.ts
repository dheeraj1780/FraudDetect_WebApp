/**
 * The single place that touches browser storage for auth state.
 *
 * Wave 46: the tenant session is an HttpOnly, Secure, SameSite=Strict cookie set by the API at
 * sign-in (`X-FraudDetect-Client: web`). Page JavaScript can neither read nor store the session token,
 * so an XSS bug can no longer exfiltrate it from localStorage. What remains here is NOT a credential:
 *
 *   - a "signed in" hint, so public pages don't probe /auth/me on every load (the API's answer is
 *     always authoritative -- a stale hint just leads to one 401 and a clean sign-out), and
 *   - the selected tenant id (an identifier, not a secret).
 *
 * The CSRF token lives in the API-set `frauddetect_csrf` cookie, read only to echo it back in the
 * X-CSRF-Token header (double-submit); it authenticates nothing on its own.
 */

const SIGNED_IN_KEY = "frauddetect.signed_in"
const TENANT_KEY = "frauddetect.tenant_id"
/** Wave 45 and earlier stored the bearer token here; removed on first load. */
const LEGACY_TOKEN_KEY = "frauddetect.session_token"
const CSRF_COOKIE = "frauddetect_csrf"

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    // Storage can throw in private browsing / quota-exceeded states; degrade, never crash.
    return fallback
  }
}

safe(() => localStorage.removeItem(LEGACY_TOKEN_KEY), undefined)

export function hasSignedInHint(): boolean {
  return safe(() => localStorage.getItem(SIGNED_IN_KEY) === "1", false)
}

export function setSignedInHint(): void {
  safe(() => localStorage.setItem(SIGNED_IN_KEY, "1"), undefined)
}

export function getTenantId(): string | null {
  return safe(() => localStorage.getItem(TENANT_KEY), null)
}

export function setTenantId(tenantId: string): void {
  safe(() => localStorage.setItem(TENANT_KEY, tenantId), undefined)
}

export function clearSession(): void {
  safe(() => {
    localStorage.removeItem(SIGNED_IN_KEY)
    localStorage.removeItem(TENANT_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }, undefined)
}

export function getCsrfToken(): string | null {
  return safe(() => {
    for (const part of document.cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=")
      if (name === CSRF_COOKIE) return decodeURIComponent(rest.join("="))
    }
    return null
  }, null)
}
