/**
 * Single source of truth for the platform API's base URL. In dev, requests
 * go to the relative `/api/v1` path and Vite's dev-server proxy
 * (vite.config.ts) forwards them to the local fraud-platform-api instance,
 * so the browser never makes a cross-origin request and CORS_ALLOWED_ORIGINS
 * doesn't need to track the frontend's port. In a real deployment where the
 * API is served from a different origin, set VITE_API_BASE_URL to that
 * origin's `/api/v1` URL.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"
