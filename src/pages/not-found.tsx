import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"

export function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-accent">404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Page not found</h1>
      <p className="max-w-sm text-fg-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Button asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </Container>
  )
}
