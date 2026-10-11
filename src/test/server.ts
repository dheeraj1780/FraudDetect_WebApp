import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import * as fx from "@/test/fixtures"

export const API = "http://api.test/api/v1"

export const notAuthenticated = () =>
  HttpResponse.json({ code: "UnauthorizedError", message: "Not authenticated." }, { status: 401 })

/** Happy-path handlers for a signed-in owner with one active credential. */
export const defaultHandlers = [
  http.get(`${API}/auth/me`, () => HttpResponse.json(fx.me)),
  http.get(`${API}/tenants/current`, () => HttpResponse.json(fx.tenant)),
  http.get(`${API}/tenants/current/members`, () => HttpResponse.json([fx.ownerMembership])),
  http.patch(`${API}/tenants/current/members/:id`, () => HttpResponse.json(fx.ownerMembership)),
  http.delete(`${API}/tenants/current/members/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/tenants/current/environments`, () => HttpResponse.json(fx.sandboxOnlyEnvironments)),
  http.post(`${API}/tenants/current/environments/live`, () =>
    HttpResponse.json(fx.sandboxAndLiveEnvironments[1], { status: 201 }),
  ),
  http.get(`${API}/credentials`, () => HttpResponse.json([fx.activeCredential])),
  http.get(`${API}/audit-logs`, () => HttpResponse.json({ items: [fx.auditLog], has_more: false })),
  http.get(`${API}/assessments`, () => HttpResponse.json(fx.assessmentListResponse)),
  http.get(`${API}/assessments/:id`, () =>
    HttpResponse.json({ code: "NotFoundError", message: "Assessment not found." }, { status: 404 }),
  ),
  http.get(`${API}/policies/active`, () => HttpResponse.json(null)),
  http.get(`${API}/analytics/assessments`, () => HttpResponse.json(fx.assessmentAnalytics)),
  http.post(`${API}/auth/login`, () => HttpResponse.json(fx.loginResponse)),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
]

export const server = setupServer(...defaultHandlers)
