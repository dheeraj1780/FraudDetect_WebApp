import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api/errors"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Retrying a 401/403/404/409 just repeats the same rejection —
        // only worth retrying transient/network failures.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
