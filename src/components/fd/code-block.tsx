import { Check, Copy } from "lucide-react"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g

/** Minimal JSON syntax highlighter — renders spans, never injects HTML. Colours come from design tokens. */
export function JsonCode({ code }: { code: string }) {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0

  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(code.slice(last, index))
    const [full, str, colon, num] = match
    if (str && colon) {
      nodes.push(
        <span key={key++} className="text-info">
          {str}
        </span>,
        colon,
      )
    } else if (str) {
      nodes.push(
        <span key={key++} className="text-ok">
          {str}
        </span>,
      )
    } else if (num) {
      nodes.push(
        <span key={key++} className="text-warn">
          {num}
        </span>,
      )
    } else {
      nodes.push(
        <span key={key++} className="text-sev-critical">
          {full}
        </span>,
      )
    }
    last = index + full.length
  }
  if (last < code.length) nodes.push(code.slice(last))

  return <code>{nodes}</code>
}

interface CodeBlockProps {
  title: string
  code: string
  language?: "json" | "shell"
  /** Tag shown top-right, e.g. "Example". Examples are never real data. */
  tag?: string
  className?: string
}

/** A titled, copyable code sample. Only ever used for static examples — never for secrets. */
export function CodeBlock({ title, code, language = "json", tag = "Example", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard permission can be denied; the text is still selectable.
    }
  }

  return (
    <figure className={cn("overflow-hidden rounded-panel border border-line bg-canvas", className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2">
        <span className="text-xs font-medium text-fg-muted">{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-fg-subtle">{tag}</span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={`Copy ${title}`}
            className="inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-xs text-fg-muted hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          >
            {copied ? <Check size={13} className="text-ok" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg-muted">
        {language === "json" ? <JsonCode code={code} /> : <code>{code}</code>}
      </pre>
    </figure>
  )
}
