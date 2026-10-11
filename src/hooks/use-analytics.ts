import { useQuery } from "@tanstack/react-query"
import type { AnalyticsParams } from "@/lib/api/endpoints/analytics"
import { analyticsApi } from "@/lib/api/endpoints/analytics"
import { queryKeys } from "@/lib/query/keys"

export function useAssessmentAnalytics(params: AnalyticsParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analytics(params),
    queryFn: () => analyticsApi.getAssessmentAnalytics(params),
    enabled,
  })
}
