import { Link } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { UnavailableState } from "@/components/ui/states"

export function Transactions() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title="Transactions" description="A list of all your payments. Coming later." />

      <UnavailableState title="This page isn't ready yet">
        <p>
          Every payment your server sends us for checking is already listed on the{" "}
          <Link to="/app/assessments" className="text-accent underline-offset-2 hover:underline">
            Assessments
          </Link>{" "}
          page, with its score and recommendation.
        </p>
      </UnavailableState>
    </div>
  )
}
