import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { LoadingState } from "@/components/ui/spinner"
import { SiteLayout } from "@/components/layout/site-layout"
import { Home } from "@/pages/home"
import { NotFound } from "@/pages/not-found"
import { GuestRoute } from "@/routes/guest-route"
import { RequireAuth } from "@/routes/require-auth"
import { RequireTenant } from "@/routes/require-tenant"

const AppShell = lazy(() => import("@/components/app/app-shell").then((m) => ({ default: m.AppShell })))
const Analytics = lazy(() => import("@/pages/app/analytics").then((m) => ({ default: m.Analytics })))
const ApiPage = lazy(() => import("@/pages/app/api").then((m) => ({ default: m.ApiPage })))
const Assessments = lazy(() => import("@/pages/app/assessments").then((m) => ({ default: m.Assessments })))
const SampleAssessmentDetail = lazy(() =>
  import("@/pages/app/assessment-detail").then((m) => ({ default: m.SampleAssessmentDetail })),
)
const RealAssessmentDetail = lazy(() =>
  import("@/pages/app/assessment-detail").then((m) => ({ default: m.RealAssessmentDetail })),
)
const AuditLogs = lazy(() => import("@/pages/app/audit-logs").then((m) => ({ default: m.AuditLogs })))
const Cases = lazy(() => import("@/pages/app/cases").then((m) => ({ default: m.Cases })))
const Credentials = lazy(() => import("@/pages/app/credentials").then((m) => ({ default: m.Credentials })))
const DecisionTracePage = lazy(() => import("@/pages/app/decision-trace").then((m) => ({ default: m.DecisionTracePage })))
const LiveAccess = lazy(() => import("@/pages/app/live-access").then((m) => ({ default: m.LiveAccess })))
const Onboarding = lazy(() => import("@/pages/app/onboarding").then((m) => ({ default: m.Onboarding })))
const Overview = lazy(() => import("@/pages/app/overview").then((m) => ({ default: m.Overview })))
const Policies = lazy(() => import("@/pages/app/policies").then((m) => ({ default: m.Policies })))
const Rules = lazy(() => import("@/pages/app/rules").then((m) => ({ default: m.Rules })))
const Settings = lazy(() => import("@/pages/app/settings").then((m) => ({ default: m.Settings })))
const Signals = lazy(() => import("@/pages/app/signals").then((m) => ({ default: m.Signals })))
const Transactions = lazy(() => import("@/pages/app/transactions").then((m) => ({ default: m.Transactions })))
// Wave 45: the internal platform-operator console -- separate routes, layout, session and API layer.
const OperatorShell = lazy(() => import("@/pages/operator/operator-shell").then((m) => ({ default: m.OperatorShell })))
const OperatorSignIn = lazy(() => import("@/pages/operator/auth").then((m) => ({ default: m.OperatorSignIn })))
const OperatorMfa = lazy(() => import("@/pages/operator/auth").then((m) => ({ default: m.OperatorMfa })))
const OperatorRequests = lazy(() => import("@/pages/operator/live-access").then((m) => ({ default: m.OperatorRequests })))
const OperatorRequestDetail = lazy(() => import("@/pages/operator/live-access").then((m) => ({ default: m.OperatorRequestDetail })))
const OperatorTenants = lazy(() => import("@/pages/operator/live-access").then((m) => ({ default: m.OperatorTenants })))
const OperatorTenantDetail = lazy(() => import("@/pages/operator/live-access").then((m) => ({ default: m.OperatorTenantDetail })))
const OperatorAdmin = lazy(() => import("@/pages/operator/admin").then((m) => ({ default: m.OperatorAdmin })))
const OperatorAudit = lazy(() => import("@/pages/operator/admin").then((m) => ({ default: m.OperatorAudit })))
const OperatorSecurity = lazy(() => import("@/pages/operator/admin").then((m) => ({ default: m.OperatorSecurity })))
const MfaPage = lazy(() => import("@/pages/auth/mfa").then((m) => ({ default: m.MfaPage })))
const SignIn = lazy(() => import("@/pages/auth/sign-in").then((m) => ({ default: m.SignIn })))
const SignUp = lazy(() => import("@/pages/auth/sign-up").then((m) => ({ default: m.SignUp })))
const CollectorSandboxDemo = lazy(() =>
  import("@/pages/sandbox/collector-demo").then((m) => ({ default: m.CollectorSandboxDemo })),
)

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route
          path="/"
          element={
            <SiteLayout>
              <Home />
            </SiteLayout>
          }
        />

        <Route element={<GuestRoute />}>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>

        {/* Wave 30: a sandbox/test-only page exercising the customer network collector client end to
            end -- deliberately unauthenticated (it is not part of this dashboard's own tenant session)
            and outside /app's shell, since it has nothing to do with the back-office product. */}
        <Route path="/mfa" element={<MfaPage />} />

        <Route path="/sandbox/collector" element={<CollectorSandboxDemo />} />

        <Route path="/app" element={<RequireAuth />}>
          <Route path="onboarding" element={<Onboarding />} />
          <Route element={<RequireTenant />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="assessments" element={<Assessments />} />
              <Route path="assessments/sample/:sampleId" element={<SampleAssessmentDetail />} />
              <Route path="assessments/:assessmentId" element={<RealAssessmentDetail />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="signals" element={<Signals />} />
              <Route path="rules" element={<Rules />} />
              <Route path="cases" element={<Cases />} />
              <Route path="decision-trace" element={<DecisionTracePage />} />
              <Route path="policies" element={<Policies />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="api" element={<ApiPage />} />
              <Route path="credentials" element={<Credentials />} />
              <Route path="live-access" element={<LiveAccess />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>

        <Route path="/operator/signin" element={<OperatorSignIn />} />
        <Route path="/operator/mfa" element={<OperatorMfa />} />
        <Route path="/operator" element={<OperatorShell />}>
          <Route index element={<Navigate to="requests" replace />} />
          <Route path="requests" element={<OperatorRequests />} />
          <Route path="requests/:requestId" element={<OperatorRequestDetail />} />
          <Route path="tenants" element={<OperatorTenants />} />
          <Route path="tenants/:tenantId" element={<OperatorTenantDetail />} />
          <Route path="operators" element={<OperatorAdmin />} />
          <Route path="audit" element={<OperatorAudit />} />
          <Route path="security" element={<OperatorSecurity />} />
        </Route>

        <Route
          path="*"
          element={
            <SiteLayout>
              <NotFound />
            </SiteLayout>
          }
        />
      </Routes>
    </Suspense>
  )
}
