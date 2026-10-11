import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { assessmentsApi, type AssessmentListParams } from "@/lib/api/endpoints/assessments"
import { queryKeys } from "@/lib/query/keys"

/** `placeholderData: keepPreviousData` keeps the current page visible while a filter/pagination
 * change is in flight, instead of flashing back to a loading state. */
export function useAssessments(params: AssessmentListParams) {
  return useQuery({
    queryKey: queryKeys.assessments(params),
    queryFn: () => assessmentsApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useAssessmentDetail(assessmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessmentDetail(assessmentId ?? ""),
    queryFn: () => assessmentsApi.get(assessmentId as string),
    enabled: Boolean(assessmentId),
  })
}
