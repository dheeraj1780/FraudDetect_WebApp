/**
 * Plain-language names for the audit actions the platform records (fraud-platform-api write_audit_log
 * call sites). Anything not listed is shown exactly as recorded, so nothing is hidden or guessed.
 */
const ACTION_TEXT: Record<string, string> = {
  "assessment.completed": "Check completed",
  "assessment.failed": "Check failed",
  "context_event.ingested": "Payment history event received",
  "collector_token.issued": "Collector token issued",
  "credential.created": "API key created",
  "credential.rotated": "API key replaced",
  "credential.revoked": "API key turned off",
  "environment.provisioned": "LIVE set up",
  "membership.removed": "Team member removed",
  "membership.role_changed": "Team member role changed",
  "permission.denied": "Action blocked (no permission)",
  "tenant.created": "Organization created",
  "tenant_policy.created": "Policy draft saved",
  "tenant_policy.copied": "Policy copied to LIVE draft",
  "tenant_policy.activated": "Policy turned on",
  "tenant_policy.reactivated": "Older policy version turned back on",
  "tenant_policy.retired": "Policy turned off",
  "tenant_notice.acknowledged": "Message from FraudDetect acknowledged",
  "user.registered": "Account created",
  "user.login_success": "Signed in",
  "user.login_failure": "Failed sign-in attempt",
  "user.logout": "Signed out",
  "user.mfa_enrolled": "Two-factor sign-in turned on",
  "user.mfa_disabled": "Two-factor sign-in turned off",
  "user.mfa_reset": "Two-factor sign-in reset",
  "user.mfa_challenge_passed": "Two-factor code accepted",
  "user.mfa_challenge_failed": "Wrong two-factor code",
  "live_access_request.submitted": "LIVE access requested",
  "live_access_request.withdrawn": "LIVE access request withdrawn",
  "live_access_request.approved": "LIVE access approved",
  "live_access_request.rejected": "LIVE access request not approved",
  "live_access_grant.created": "LIVE access turned on",
  "live_access_grant.reactivated": "LIVE access turned back on",
  "live_access_suspension.proposed": "FraudDetect proposed pausing LIVE",
  "live_access_suspension.emergency_initiated": "FraudDetect paused LIVE urgently",
  "live_access_suspension.dispute_window_started": "Time to reply about LIVE pause started",
  "live_access_suspension.enforced": "LIVE access paused",
  "live_access_suspension.cancelled": "LIVE pause cancelled",
  "live_access_dispute.submitted": "Reply about LIVE pause sent",
  "live_access_dispute.accepted": "Reply about LIVE pause accepted",
  "live_access_dispute.rejected": "Reply about LIVE pause not accepted",
}

export function describeAuditAction(action: string): string {
  return ACTION_TEXT[action] ?? action
}
