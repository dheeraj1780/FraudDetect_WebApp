import { Check, Copy, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface SecretRevealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  secret: string | null
  keyPrefix: string
}

/**
 * The secret is passed in as local component state by the caller (never
 * written to storage), and closing this dialog is the caller's cue to drop
 * it from memory — see the onOpenChange handler in credentials.tsx.
 */
export function SecretRevealDialog({ open, onOpenChange, secret, keyPrefix }: SecretRevealDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard permission can be denied; the secret is still selectable text.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Your new API key</DialogTitle>
        <DialogDescription>It starts with {keyPrefix}</DialogDescription>

        <Alert variant="warning" title="This is shown only once" className="mt-4">
          Copy the key now and keep it somewhere safe, like your server's settings. You can't see it again after you
          close this window. Never put it in a website or app.
        </Alert>

        <div className="mt-4 flex items-center gap-2 rounded-control border border-line-strong bg-canvas px-3 py-2.5">
          <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-fg">
            {secret}
          </code>
          <Button variant="ghost" size="sm" onClick={() => void handleCopy()} aria-label="Copy secret">
            {copied ? (
              <Check size={16} className="text-ok" aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            <ShieldAlert size={15} aria-hidden="true" />
            I've saved this secret
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
