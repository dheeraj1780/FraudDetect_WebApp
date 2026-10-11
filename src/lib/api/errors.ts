import type { ApiErrorDetail, ValidationErrorDetail } from "@/lib/api/types"

/**
 * Normalizes both of the backend's error shapes (AppError's {code, message}
 * and FastAPI's 422 {detail: [...]}) into one consistent error the UI can
 * branch on, per docs/architecture.md in fraud-platform-api: check `status`
 * first, `code` second.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  /** Field name -> messages, populated only for 422 validation failures. */
  readonly fieldErrors?: Record<string, string[]>

  constructor(
    status: number,
    message: string,
    options?: { code?: string; fieldErrors?: Record<string, string[]> },
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = options?.code
    this.fieldErrors = options?.fieldErrors
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }

  get isNotFound() {
    return this.status === 404
  }

  get isConflict() {
    return this.status === 409
  }

  get isValidation() {
    return this.status === 400 || this.status === 422
  }
}

function isValidationErrorDetail(body: unknown): body is ValidationErrorDetail {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as ValidationErrorDetail).detail)
  )
}

function isApiErrorDetail(body: unknown): body is ApiErrorDetail {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as ApiErrorDetail).code === "string" &&
    typeof (body as ApiErrorDetail).message === "string"
  )
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  if (isValidationErrorDetail(body)) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of body.detail) {
      const field = String(issue.loc.at(-1) ?? "form")
      fieldErrors[field] ??= []
      fieldErrors[field].push(issue.msg)
    }
    return new ApiError(status, "Please fix the highlighted fields.", { fieldErrors })
  }

  if (isApiErrorDetail(body)) {
    return new ApiError(status, body.message, { code: body.code })
  }

  return new ApiError(status, "Something went wrong. Please try again.")
}
