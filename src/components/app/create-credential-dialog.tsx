import { useState, type FormEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/form/form-field"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/errors"
import type { CredentialCreatedOut } from "@/lib/api/types"
import { useCreateCredential } from "@/hooks/use-credentials"

interface CreateCredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (credential: CredentialCreatedOut) => void
}

export function CreateCredentialDialog({ open, onOpenChange, onCreated }: CreateCredentialDialogProps) {
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const createCredential = useCreateCredential()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const credential = await createCredential.mutateAsync({ label: label.trim() || null })
      setLabel("")
      onOpenChange(false)
      onCreated(credential)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Create a SANDBOX API key</DialogTitle>
        <DialogDescription>
          A key for testing. We show it only once, so be ready to copy it.
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField
            label="Name (optional, e.g. “Test server”)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Staging integration"
            disabled={createCredential.isPending}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={createCredential.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCredential.isPending}>
              {createCredential.isPending ? <Spinner /> : null}
              Create credential
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
