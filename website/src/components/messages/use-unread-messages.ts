"use client"

import { useEffect, useState } from "react"
import { conversationRequest } from "@/lib/api/conversations"

export function useUnreadMessages(token?: string, merchantId?: string, enabled = true) {
  const [result, setResult] = useState<{ token: string; merchantId: string; count: number } | null>(null)

  useEffect(() => {
    if (!enabled || !token || !merchantId) return
    const accessToken = token
    const activeMerchantId = merchantId
    let live = true
    let running = false
    let refreshPending = false
    async function refresh() {
      if (!live || document.hidden) return
      if (running) {
        refreshPending = true
        return
      }
      running = true
      try {
        const response = await conversationRequest<{ unread_count: number }>(
          accessToken, `/unread?${new URLSearchParams({ merchant_id: activeMerchantId })}`
        )
        if (live) setResult({ token: accessToken, merchantId: activeMerchantId, count: response.data.unread_count })
      } catch {
        // Keep the last confirmed count during transient failures.
      } finally {
        running = false
        if (live && refreshPending) {
          refreshPending = false
          void refresh()
        }
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 10000)
    window.addEventListener("focus", refresh)
    window.addEventListener("messages-read", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("messages-read", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [token, merchantId, enabled])

  return enabled && result && result.token === token && result?.merchantId === merchantId ? result.count : 0
}
