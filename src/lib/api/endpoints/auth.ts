import { apiFetch } from "@/lib/api/client"
import type { LoginRequest, MeOut, RegisterRequest, TokenResponse, UserOut } from "@/lib/api/types"

export const authApi = {
  register: (body: RegisterRequest) =>
    apiFetch<UserOut>("/auth/register", { method: "POST", body, auth: false }),

  login: (body: LoginRequest) =>
    apiFetch<TokenResponse>("/auth/login", { method: "POST", body, auth: false }),

  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),

  me: () => apiFetch<MeOut>("/auth/me"),

  // Wave 46: tenant-user MFA
  startMfaEnrollment: () =>
    apiFetch<{ otpauth_uri: string; qr_svg: string; secret: string }>("/auth/mfa/enrollment", { method: "POST" }),
  confirmMfaEnrollment: (code: string) =>
    apiFetch<{ recovery_codes: string[]; note: string }>("/auth/mfa/enrollment/confirm", { method: "POST", body: { code } }),
  mfaChallenge: (body: { code?: string; recovery_code?: string }) =>
    apiFetch<{ mfa_state: string; method: string }>("/auth/mfa/challenge", { method: "POST", body }),
  disableMfa: (code: string) => apiFetch<void>("/auth/mfa/disable", { method: "POST", body: { code } }),
  resetMfaWithRecoveryCode: (recoveryCode: string) =>
    apiFetch<void>("/auth/mfa/reset-with-recovery-code", { method: "POST", body: { recovery_code: recoveryCode } }),
}
