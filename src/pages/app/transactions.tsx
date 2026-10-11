import { PageHeader } from "@/components/app/page-header"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { UnavailableState } from "@/components/ui/states"

export function Transactions() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title="Transactions" description="Payments and events evaluated by Fraud Detect." />

      <UnavailableState title="Transactions aren't available yet">
        <p>
          The platform API doesn&apos;t provide a way to list or search transactions from this console. Nothing is
          being hidden — there is no transaction data to load.
        </p>
      </UnavailableState>

      <Card>
        <CardTitle>How transactions reach Fraud Detect today</CardTitle>
        <CardDescription className="mt-1">
          Your backend sends each payment for assessment with <span className="font-mono">POST /assessments</span>, and
          reports completed, successful payments with <span className="font-mono">POST /context-events</span>. Those
          completed payments give Fraud Detect the history behind signals such as first-time instruments, beneficiaries
          and typical amounts.
        </CardDescription>
      </Card>
    </div>
  )
}
