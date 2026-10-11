import { useQuery } from "@tanstack/react-query"
import { createContext, useContext } from "react"
import { getOperatorToken, operatorApi, type OperatorMe } from "@/lib/operator/api"

export const OperatorContext = createContext<OperatorMe | null>(null)

export function useOperator(): OperatorMe {
  const me = useContext(OperatorContext)
  if (!me) throw new Error("useOperator must be used inside OperatorShell")
  return me
}

export function hasPermission(me: OperatorMe, permission: string): boolean {
  return me.effective_permissions.some((p) => p.permission === permission)
}

export function useOperatorMe(enabled = true) {
  return useQuery({ queryKey: ["operator", "me"], queryFn: operatorApi.me, enabled: enabled && Boolean(getOperatorToken()), retry: false })
}
