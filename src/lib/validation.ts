const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required."
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address."
  return undefined
}

/** Mirrors the backend's RegisterRequest constraint (min_length=8). */
export function validateNewPassword(password: string): string | undefined {
  if (!password) return "Password is required."
  if (password.length < 8) return "Password must be at least 8 characters."
  return undefined
}

export function validateRequiredPassword(password: string): string | undefined {
  if (!password) return "Password is required."
  return undefined
}
