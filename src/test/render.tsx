import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { App } from "@/App"
import { AuthProvider } from "@/lib/auth/AuthContext"
import { setSignedInHint } from "@/lib/auth/session"

export function renderApp(route: string, options: { signedIn?: boolean } = {}) {
  if (options.signedIn) setSignedInHint()

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
