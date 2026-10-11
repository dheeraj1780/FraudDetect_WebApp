import { Link } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { Badge } from "@/components/ui/badge"
import { UnavailableState } from "@/components/ui/states"

export function Cases() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="Cases"
        description="A place for your team to investigate risky payments, add notes and record a decision. Coming later."
        badges={<Badge variant="outline">Planned</Badge>}
      />

      <UnavailableState title="This page isn't ready yet">
        <p>
          For now, open a flagged payment from the{" "}
          <Link to="/app/assessments" className="text-accent underline-offset-2 hover:underline">
            Assessments
          </Link>{" "}
          page to see why it got its score.
        </p>
      </UnavailableState>
    </div>
  )
}
