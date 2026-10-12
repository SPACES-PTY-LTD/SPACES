"use client"

import { useEffect, useRef } from "react"
import { getRun } from "@/lib/api/runs"
import { isApiErrorResponse } from "@/lib/api/client"
import { conversationRequest, type Conversation } from "@/lib/api/conversations"

export type DraftRunReference = { type: "run"; id: string; label: string }

export function useRunMessageHandoff(runId: string | undefined, handoff: string | undefined, merchant: string, token: string,
  onOpen: (chat: Conversation, reference: DraftRunReference | null, error?: string) => void,
  onError: (message: string) => void, onMerchant: (merchant: string) => void) {
  const consumed = useRef("")
  useEffect(() => {
    const key = `${runId}:${handoff}`
    if (!runId || !merchant || consumed.current === key) return
    let live = true
    async function open() {
      try {
        const run = await getRun(runId!, token)
        if (!live) return
        if (isApiErrorResponse(run)) throw new Error(run.message)
        if (!run.merchant_id || !run.can_message_driver || !run.driver?.driver_id) throw new Error("This run's assigned driver chat is unavailable.")
        if (run.merchant_id !== merchant) { onMerchant(run.merchant_id); return }
        const result = await conversationRequest<Conversation>(token, "/driver", "POST", { merchant_id: merchant, driver_id: run.driver.driver_id })
        if (!live) return
        consumed.current = key
        if (result.data.status !== "active") {
          onOpen(result.data, null, "This driver conversation is closed. Reopen it before messaging.")
        } else {
          onOpen(result.data, { type: "run", id: run.run_id, label: `Run ${run.run_id}` })
        }
        clearHandoff()
      } catch (e) {
        if (!live) return
        consumed.current = key
        onError(e instanceof Error ? e.message : "Unable to open the driver conversation.")
        clearHandoff()
      }
    }
    function clearHandoff() {
      const url = new URL(window.location.href)
      url.searchParams.delete("run_id"); url.searchParams.delete("handoff")
      window.history.replaceState(window.history.state, "", url.toString())
    }
    void open()
    return () => { live = false }
  }, [runId, handoff, merchant, token, onOpen, onError, onMerchant])
}
