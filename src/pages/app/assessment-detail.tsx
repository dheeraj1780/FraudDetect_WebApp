import { ArrowLeft, SearchX } from "lucide-react"
import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { AssessmentDetail } from "@/components/fd/assessment-detail"
import { AssessmentFailedState, AssessmentProcessingState } from "@/components/fd/assessment-lifecycle-states"
import { SampleBadge, SampleDataBanner } from "@/components/fd/sample-data"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/states"
import { useAssessmentDetail } from "@/hooks/use-assessments"
import { useSampleClock } from "@/hooks/use-sample-clock"
import { ApiError } from "@/lib/api/errors"
import { toLegacyCompletedAssessment } from "@/lib/fraud/assessment-adapter"
import { sampleAssessments, sampleDetails } from "@/lib/fraud/sample"

/**
 * Detail for a SAMPLE assessment (`/app/assessments/sample/:sampleId`), opt-in and clearly
 * labelled. The REAL detail view (`/app/assessments/:assessmentId`, GET /assessments/{id},
 * Wave 34B) is `RealAssessmentDetail` below.
 */
export function SampleAssessmentDetail() {
  const { sampleId = "" } = useParams()
  const now = useSampleClock()

  const assessment = useMemo(() => {
    const named = sampleDetails(now).find((d) => d.id === sampleId)
    if (named) return named.assessment
    return sampleAssessments(now).find((a) => a.assessment_id === sampleId) ?? null
  }, [sampleId, now])

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Assessment"
        description="Why FraudDetect assessed this transaction the way it did."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/assessments">
              <ArrowLeft size={14} aria-hidden="true" />
              Assessments
            </Link>
          </Button>
        }
      />
      {assessment ? (
        <AssessmentDetail assessment={assessment} notice={<SampleDataBanner hideLink={false} />} tag={<SampleBadge />} />
      ) : (
        <EmptyState
          icon={SearchX}
          title="Sample assessment not found"
          description="This link doesn't match a sample assessment."
        />
      )}
    </div>
  )
}

/**
 * Detail for a real assessment (GET /api/v1/assessments/{assessment_id}, Wave 34B,
 * session-authenticated, tenant-scoped). A nonexistent id and another tenant's id are
 * indistinguishable 404s server-side (no existence oracle) — both render the identical
 * "not found" state here, never a different message for either case.
 */
function RealAssessmentDetailBody({ query }: { query: ReturnType<typeof useAssessmentDetail> }) {
  if (query.isPending) return <LoadingState label="Loading assessment…" />

  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.isNotFound || query.error.isValidation)
    if (notFound) {
      return (
        <EmptyState
          icon={SearchX}
          title="Assessment not found"
          description="This assessment doesn't exist, or isn't visible to your organization."
        />
      )
    }
    return <ErrorState what="this assessment" error={query.error} onRetry={() => void query.refetch()} />
  }

  const data = query.data
  if (data.status === "processing") {
    return <AssessmentProcessingState assessmentId={data.assessment_id} environment={data.environment} submittedAt={data.submitted_at} />
  }
  if (data.status === "failed") {
    return <AssessmentFailedState assessmentId={data.assessment_id} environment={data.environment} submittedAt={data.submitted_at} />
  }
  return <AssessmentDetail assessment={toLegacyCompletedAssessment(data)} environment={data.environment} />
}

export function RealAssessmentDetail() {
  const { assessmentId = "" } = useParams()
  const query = useAssessmentDetail(assessmentId)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Assessment"
        description="Why FraudDetect assessed this transaction the way it did."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/assessments">
              <ArrowLeft size={14} aria-hidden="true" />
              Assessments
            </Link>
          </Button>
        }
      />
      <RealAssessmentDetailBody query={query} />
    </div>
  )
}
