import { useSearchParams } from "react-router-dom"

/**
 * Sample data is opt-in and lives in the URL (`?sample=1`), so it is visible, shareable and
 * impossible to leave switched on by accident. Nothing is persisted.
 */
export function useSampleMode() {
  const [params, setParams] = useSearchParams()
  const enabled = params.get("sample") === "1"

  const setEnabled = (next: boolean) => {
    const copy = new URLSearchParams(params)
    if (next) copy.set("sample", "1")
    else copy.delete("sample")
    setParams(copy, { replace: true })
  }

  return { enabled, setEnabled }
}
