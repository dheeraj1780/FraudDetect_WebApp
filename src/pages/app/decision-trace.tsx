import { ClipboardPaste, FlaskConical, ShieldCheck, X } from "lucide-react"
import { useId, useState, type FormEvent } from "react"
import { PageHeader } from "@/components/app/page-header"
import { AssessmentDetail } from "@/components/fd/assessment-detail"
import { SampleBadge } from "@/components/fd/sample-data"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { AssessmentOut } from "@/lib/api/types"
import { parseAssessmentResponse } from "@/lib/fraud/parse-assessment"
import { sampleDetails } from "@/lib/fraud/sample"
import { cn } from "@/lib/utils"

const MAX_PASTE_CHARS = 100_000

const STAGES: { name: string; body: string; exposed: boolean }[] = [
  { name: "Input", body: "The evidence your backend submitted.", exposed: true },
  { name: "Normalization", body: "Values standardised for evaluation.", exposed: false },
  { name: "Signals", body: "Facts extracted from the input and context.", exposed: false },
  { name: "Rules", body: "Rules evaluated; triggered rules reported.", exposed: true },
  { name: "Score", body: "Rule contributions combined into a risk score and band.", exposed: true },
  { name: "Confidence", body: "How much evidence backs the score.", exposed: false },
  { name: "Policy", body: "Your tenant policy applied to the score.", exposed: true },
  { name: "Recommendation", body: "Proceed, step-up, review or block.", exposed: true },
]

type Inspected = { assessment: AssessmentOut; origin: "pasted" | "sample" }

export function DecisionTracePage() {
  const inputId = useId()
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [inspected, setInspected] = useState<Inspected | null>(null)

  const handleInspect = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!text.trim()) {
      setError("Paste an assessment response first.")
      return
    }
    if (text.length > MAX_PASTE_CHARS) {
      setError("That's larger than any assessment response. Paste only the response body.")
      return
    }
    const result = parseAssessmentResponse(text)
    if (!result.ok) {
      setInspected(null)
      setError(result.error)
      return
    }
    setInspected({ assessment: result.assessment, origin: "pasted" })
  }

  const handleClear = () => {
    setText("")
    setError(null)
    setInspected(null)
  }

  const loadSample = () => {
    setText("")
    setError(null)
    setInspected({ assessment: sampleDetails()[0].assessment, origin: "sample" })
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Decision Trace"
        description="Why did Fraud Detect make this assessment? Follow one assessment from input to recommendation."
      />

      <section aria-labelledby="stages-heading">
        <h2 id="stages-heading" className="sr-only">
          Trace stages
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage, index) => (
            <li key={stage.name} className="flex flex-col gap-1.5 bg-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                <Badge variant={stage.exposed ? "accent" : "outline"}>{stage.exposed ? "In API response" : "Not returned"}</Badge>
              </div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-fg">{stage.name}</p>
              <p className="text-xs text-fg-muted">{stage.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-fg-subtle">
          The platform returns the outcome of each stage where it is exposed. Stages marked “Not returned” are shown as
          such in a trace — nothing is filled in.
        </p>
      </section>

      <Card>
        <div className="flex items-start gap-3">
          <ClipboardPaste size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-fg">Inspect an assessment response</h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Paste the JSON returned by <span className="font-mono">POST /assessments</span>. It is parsed in your
              browser only — it isn&apos;t sent anywhere or stored.
            </p>

            <form onSubmit={handleInspect} noValidate className="mt-4 flex flex-col gap-3">
              <label htmlFor={inputId} className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Response JSON
              </label>
              <textarea
                id={inputId}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                placeholder={'{\n  "assessment_id": "…",\n  "status": "completed",\n  …\n}'}
                className={cn(
                  "w-full resize-y rounded-control border bg-canvas p-3 font-mono text-xs text-fg placeholder:text-fg-subtle",
                  "border-line-strong focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                  error && "border-danger",
                )}
              />
              {error ? (
                <p id={`${inputId}-error`} role="alert" className="text-[13px] text-danger">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Inspect
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={loadSample}>
                  <FlaskConical size={14} aria-hidden="true" />
                  Load a sample
                </Button>
                {text || inspected ? (
                  <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                    <X size={14} aria-hidden="true" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </Card>

      {inspected ? (
        <AssessmentDetail
          assessment={inspected.assessment}
          tag={inspected.origin === "sample" ? <SampleBadge /> : <Badge variant="neutral">Pasted response</Badge>}
          notice={
            inspected.origin === "sample" ? (
              <Alert variant="warning" title="Sample data">
                This is an illustrative sample assessment, not one of your assessments.
              </Alert>
            ) : (
              <Alert variant="info">
                Rendered locally from the JSON you pasted. Fraud Detect hasn&apos;t verified that it came from your
                account.
              </Alert>
            )
          }
        />
      ) : null}
    </div>
  )
}
