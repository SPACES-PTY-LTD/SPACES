"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getRun } from "@/lib/api/runs"
import { isApiErrorResponse } from "@/lib/api/client"
import type { RunEndRequest } from "@/lib/types"

/** Keep dispatch review current when a driver resubmits from another device. */
export function useRunEndRequestRefresh(runId: string, request: RunEndRequest, accessToken: string | undefined, enabled: boolean) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    let live = true
    let loading = false
    let refreshing = false
    async function check() {
      if (!live || loading || refreshing || document.hidden) return
      loading = true
      try {
        const run = await getRun(runId, accessToken)
        if (!live || isApiErrorResponse(run)) return
        if (run.status !== "in_progress" || run.end_request?.request_id !== request.request_id || run.end_request?.status !== request.status) {
          refreshing = true
          router.refresh()
        }
      } catch {
        // Keep the loaded review and retry on the next visible check.
      } finally { loading = false }
    }
    void check()
    const timer = setInterval(() => void check(), 10000)
    window.addEventListener("focus", check)
    document.addEventListener("visibilitychange", check)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener("focus", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [runId, request.request_id, request.status, accessToken, enabled, router])
}
