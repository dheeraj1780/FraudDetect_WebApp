import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { auditLogsApi, type AuditLogParams } from "@/lib/api/endpoints/auditLogs"
import { queryKeys } from "@/lib/query/keys"

export function useAuditLogs(params: AuditLogParams = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs(params),
    queryFn: () => auditLogsApi.list(params),
    placeholderData: keepPreviousData,
  })
}
